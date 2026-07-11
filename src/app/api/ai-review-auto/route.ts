import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCommunityConfig } from '@/lib/community-config';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { aggregateDevData, generateDataText, buildAiReviewPrompt, parseAiOutput } from '@/lib/ai-review';
import { getTopDevsForAiReviewAdmin, fetchDevLogsAdmin, applyAiReviewAdmin } from '@/lib/ai-review-server';
import { ai } from '@/ai/genkit';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.AI_REVIEW_SECRET;
  if (!secret || req.headers.get('x-ai-review-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Community config ────────────────────────────────────────────────────
  const config = await getCommunityConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: 'community_config tidak ditemukan.' },
      { status: 500 },
    );
  }

  // ── 3. Guards — semua kembalikan 200 agar log cron tidak merah ─────────────
  if (!config.ai_governance_enabled) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: 'AI Governance dinonaktifkan (ai_governance_enabled=false). Aktifkan di /parameters.',
    });
  }
  if (!(config.ai_auto_mode_enabled ?? false)) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: 'Mode otonom dinonaktifkan (ai_auto_mode_enabled=false). Aktifkan di /parameters.',
    });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: 'GEMINI_API_KEY tidak ditemukan. Set env var di Vercel untuk mengaktifkan mode otonom.',
    });
  }

  // ── 4. Init Admin SDK ──────────────────────────────────────────────────────
  const adminDbResult = (() => {
    try { return { db: getAdminDb(), err: null }; }
    catch (err: unknown) { return { db: null, err }; }
  })();
  if (!adminDbResult.db) {
    const msg = adminDbResult.err instanceof Error
      ? adminDbResult.err.message
      : 'Firebase Admin SDK gagal diinisialisasi.';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  const adminDb = adminDbResult.db;

  // ── 5. Interval check ──────────────────────────────────────────────────────
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

  // ── 6. Fetch + sort developers ─────────────────────────────────────────────
  const maxDevs = config.ai_auto_max_devs_per_run ?? 10;

  const { devs: allDevs, totalUsers } = await getTopDevsForAiReviewAdmin(config);
  if (allDevs.length === 0) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: 'Tidak ada developer yang memenuhi syarat untuk ditinjau.',
    });
  }

  // null (belum pernah dinilai) → prioritas tertinggi; lalu urutkan terlama duluan
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

  const logsArr = await Promise.all(
    targetDevs.map(d => fetchDevLogsAdmin(d.uid, histLimit, histDays, d.lastAiReviewAt)),
  );

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Gemini API error: ${msg}` }, { status: 500 });
  }

  // ── 10. Parse output ───────────────────────────────────────────────────────
  const parsed = parseAiOutput(geminiText, shortIdToInfo, config);
  if (typeof parsed === 'string') {
    return NextResponse.json({ ok: false, error: `Parse output AI gagal: ${parsed}` }, { status: 500 });
  }

  // ── 11. Apply ──────────────────────────────────────────────────────────────
  const reviewId = await applyAiReviewAdmin(parsed, config, 'ai-auto');

  // ── 12. Update last_auto_review_at ─────────────────────────────────────────
  await adminDb.collection('fee_pool').doc('v1').set(
    { last_auto_review_at: FieldValue.serverTimestamp() },
    { merge: true },
  );

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
