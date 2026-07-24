import { NextRequest, NextResponse } from 'next/server';
import { getCommunityConfig } from '@/lib/community-config';
import { getAdminDb } from '@/lib/firebase-admin';
import { buildInflationPrompt, parseInflationOutput } from '@/lib/inflation';
import { recordInflationAdmin } from '@/lib/inflation-server';
import { ai } from '@/ai/genkit';

function err500(step: string, msg: string) {
  console.error(`[inflation-auto] step=${step} error:`, msg);
  return NextResponse.json({ ok: false, step, error: msg }, { status: 500 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const secret = process.env.INFLATION_AUTO_SECRET;
  if (!secret || req.headers.get('x-inflation-auto-secret') !== secret) {
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
  if (!config.inflation_enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Info Inflasi/Deflasi dinonaktifkan (inflation_enabled=false). Aktifkan di /parameters.' });
  }
  if (!(config.inflation_auto_enabled ?? false)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'Mode otonom dinonaktifkan (inflation_auto_enabled=false). Aktifkan di /parameters.' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'GEMINI_API_KEY tidak ditemukan. Set env var untuk mengaktifkan mode otonom.' });
  }

  // ── 4. Init Admin SDK ──────────────────────────────────────────────────────
  try {
    getAdminDb();
  } catch (e: unknown) {
    return err500('admin_sdk_init', e instanceof Error ? e.message : String(e));
  }

  // ── 5. Tahun target = tahun sekarang − 1 (tahun yang baru selesai) ─────────
  const tahunTarget = new Date().getFullYear() - 1;

  // ── 6. Idempotency guard — hormati entri yang sudah ada (manual/otonom) ───
  const sudahAda = (config.inflation_history ?? []).some(h => h.tahun === tahunTarget);
  if (sudahAda) {
    return NextResponse.json({
      ok: true, skipped: true,
      reason: `Tahun ${tahunTarget} sudah tercatat sebelumnya (manual/otonom) — tidak ditimpa.`,
    });
  }

  // ── 7. Call Gemini (fallback chain) ────────────────────────────────────────
  const prompt = buildInflationPrompt(tahunTarget);

  // gemini-3-flash tidak ada di @genkit-ai/google-genai@1.20.0 → tidak disertakan
  const MODEL_CANDIDATES = [...new Set([
    process.env.GEMINI_MODEL,
    'googleai/gemini-2.5-flash-lite',
    'googleai/gemini-2.5-flash',
    'googleai/gemini-2.5-pro',
    'googleai/gemini-2.0-flash-lite',
    'googleai/gemini-2.0-flash',
  ].filter(Boolean) as string[])];

  let geminiText = '';
  let modelUsed = '';
  let lastGeminiError = '';
  const triedModels: string[] = [];

  for (const model of MODEL_CANDIDATES) {
    triedModels.push(model);
    try {
      const response = await ai.generate({ model, prompt, config: { temperature: 0.15 } });
      geminiText = response.text;
      modelUsed = model;
      console.log(`[inflation-auto] gemini success model=${model}, raw (first 300):`, geminiText.substring(0, 300));
      break;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      lastGeminiError = msg;
      const isRetryable = /404|429|not available|quota|no longer|retired/i.test(msg);
      console.warn(`[inflation-auto] model ${model} ${isRetryable ? 'tidak tersedia, coba berikutnya' : 'error (berhenti)'}: ${msg.substring(0, 150)}`);
      if (!isRetryable) break;
    }
  }

  if (!geminiText || !modelUsed) {
    return NextResponse.json({
      ok: false,
      step: 'gemini',
      error: 'Semua model Gemini gagal.',
      tried: triedModels,
      last_error: lastGeminiError,
    }, { status: 500 });
  }

  // ── 8. Parse output ─────────────────────────────────────────────────────────
  const parsed = parseInflationOutput(geminiText);
  if (typeof parsed === 'string') {
    console.error('[inflation-auto] parse failed. raw gemini:', geminiText);
    return err500('parse', parsed);
  }

  // ── 9. Catat via Admin SDK ───────────────────────────────────────────────────
  try {
    await recordInflationAdmin(tahunTarget, parsed.pct, 'ai-auto', 'AI Otonom', parsed.alasan);
  } catch (e: unknown) {
    return err500('record', e instanceof Error ? e.message : String(e));
  }

  // ── 10. Response ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    ok: true,
    tahun: tahunTarget,
    pct: parsed.pct,
    model_used: modelUsed,
  });
}
