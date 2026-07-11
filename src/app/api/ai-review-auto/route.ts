import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCommunityConfig } from '@/lib/community-config';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { aggregateDevData, generateDataText, buildAiReviewPrompt, parseAiOutput } from '@/lib/ai-review';
import { getTopDevsForAiReviewAdmin, fetchDevLogsAdmin, applyAiReviewAdmin } from '@/lib/ai-review-server';
import { ai } from '@/ai/genkit';

function err500(step: string, msg: string) {
  console.error(`[ai-review-auto] step=${step} error:`, msg);
  return NextResponse.json({ ok: false, step, error: msg }, { status: 500 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.AI_REVIEW_SECRET;
  if (!secret || req.headers.get('x-ai-review-secret') !== secret) {
    return NextResponse.json({ ok: false, step: 'auth', error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Community config ────────────────────────────────────────────────────
  let config;
  try {
    config = await getCommunityConfig();
  } catch (e: unknown) {
    return err500('config', e instanceof Error ? e.message : String(e));
  }
  if (!config) {
    return err500('config', 'community_config tidak ditemukan di Firestore.');
  }

  // ── 3. Guards — kembalikan 200 agar log cron tidak merah ───────────────────
  if (!config.ai_governance_enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'AI Governance dinonaktifkan (ai_governance_enabled=false). Aktifkan di /parameters.' });
  }
  if (!(config.ai_auto_mode_enabled ?? false)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Mode otonom dinonaktifkan (ai_auto_mode_enabled=false). Aktifkan di /parameters.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'GEMINI_API_KEY tidak ditemukan. Set env var untuk mengaktifkan mode otonom.' });
  }

  // ── 4. Init Admin SDK ──────────────────────────────────────────────────────
  let adminDb: ReturnType<typeof getAdminDb>;
  try {
    adminDb = getAdminDb();
  } catch (e: unknown) {
    return err500('admin_sdk_init', e instanceof Error ? e.message : String(e));
  }

  // ── 5. Interval check ──────────────────────────────────────────────────────
  try {
    const feePoolSnap = await getDoc(doc(db, 'fee_pool', 'v1'));
    const rawTs = feePoolSnap.data()?.last_auto_review_at;
    const lastAutoAt: Date | null =
      rawTs instanceof Timestamp ? rawTs.toDate() : (rawTs?.toDate?.() ?? null);

    const intervalDays = config.ai_auto_interval_days ?? 30;
    if (lastAutoAt) {
      const daysSinceLast = (Date.now() - lastAutoAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLast < intervalDays) {
        const nextRunAt = new Date(lastAutoAt.getTime() + intervalDays * 86400000);
        return NextResponse.json({
          ok: true, skipped: true,
          reason: `Belum waktunya. Run berikutnya sekitar ${nextRunAt.toISOString().substring(0, 10)} (interval ${intervalDays} hari).`,
        });
      }
    }
  } catch (e: unknown) {
    return err500('interval_check', e instanceof Error ? e.message : String(e));
  }

  // ── 6. Fetch + sort developers ─────────────────────────────────────────────
  let allDevs: Awaited<ReturnType<typeof getTopDevsForAiReviewAdmin>>['devs'];
  let totalUsers: number;
  try {
    const result = await getTopDevsForAiReviewAdmin(config);
    allDevs = result.devs;
    totalUsers = result.totalUsers;
  } catch (e: unknown) {
    return err500('fetch_devs', e instanceof Error ? e.message : String(e));
  }

  if (allDevs.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Tidak ada developer yang memenuhi syarat untuk ditinjau.' });
  }

  const maxDevs = config.ai_auto_max_devs_per_run ?? 10;
  allDevs.sort((a, b) => {
    if (!a.lastAiReviewAt && !b.lastAiReviewAt) return 0;
    if (!a.lastAiReviewAt) return -1;
    if (!b.lastAiReviewAt) return 1;
    return a.lastAiReviewAt.getTime() - b.lastAiReviewAt.getTime();
  });
  const targetDevs = allDevs.slice(0, maxDevs);
  const devsRemaining = Math.max(0, allDevs.length - maxDevs);

  // ── 7. Fetch logs per developer ────────────────────────────────────────────
  const histLimit = config.ai_review_history_limit ?? 50;
  const histDays = config.ai_review_history_days ?? 50;
  let logsArr: Awaited<ReturnType<typeof fetchDevLogsAdmin>>[];
  try {
    logsArr = await Promise.all(
      targetDevs.map(d => fetchDevLogsAdmin(d.uid, histLimit, histDays, d.lastAiReviewAt)),
    );
  } catch (e: unknown) {
    return err500('fetch_logs', e instanceof Error ? e.message : String(e));
  }

  // ── 8. Aggregate + build prompt ────────────────────────────────────────────
  const aggs = targetDevs.map((d, i) => aggregateDevData(d, logsArr[i]));
  const shortIdToInfo = new Map<string, { uid: string; displayName: string }>();
  for (const agg of aggs) {
    shortIdToInfo.set(agg.shortId, { uid: agg.uid, displayName: agg.displayName });
  }
  const dataText = generateDataText(aggs);
  const prompt = buildAiReviewPrompt(dataText, totalUsers, aggs.length);

  // ── 9. Call Gemini ─────────────────────────────────────────────────────────
  let geminiText: string;
  try {
    const response = await ai.generate({ prompt, config: { temperature: 0.15 } });
    geminiText = response.text;
    console.log('[ai-review-auto] gemini raw (first 300 chars):', geminiText.substring(0, 300));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return err500('gemini', `model=${process.env.GEMINI_MODEL ?? 'googleai/gemini-2.0-flash'} — ${msg}`);
  }

  // ── 10. Parse output ───────────────────────────────────────────────────────
  const parsed = parseAiOutput(geminiText, shortIdToInfo, config);
  if (typeof parsed === 'string') {
    console.error('[ai-review-auto] parse failed. raw gemini:', geminiText);
    return err500('parse', parsed);
  }

  // ── 11. Apply ──────────────────────────────────────────────────────────────
  let reviewId: string;
  try {
    reviewId = await applyAiReviewAdmin(parsed, config, 'ai-auto');
  } catch (e: unknown) {
    return err500('apply', e instanceof Error ? e.message : String(e));
  }

  // ── 12. Update last_auto_review_at ─────────────────────────────────────────
  try {
    await adminDb.collection('fee_pool').doc('v1').set(
      { last_auto_review_at: FieldValue.serverTimestamp() },
      { merge: true },
    );
  } catch (e: unknown) {
    // Review sudah berhasil di-apply; gagal update timestamp bukan error fatal.
    console.warn('[ai-review-auto] gagal update last_auto_review_at:', e instanceof Error ? e.message : String(e));
  }

  // ── 13. Response ───────────────────────────────────────────────────────────
  const totalMinus = parsed.reduce((sum, e) => sum + e.minusNeraca, 0);
  return NextResponse.json({
    ok: true,
    review_id: reviewId,
    devs_reviewed: targetDevs.length,
    total_minus: totalMinus,
    devs_remaining: devsRemaining,
  });
}
