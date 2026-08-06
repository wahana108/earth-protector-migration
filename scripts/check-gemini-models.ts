/**
 * Script diagnostik Gemini — TMEP (feat/gemini-key-migration)
 *
 * TUJUAN: sebelum menukar GEMINI_API_KEY ke project Google BARU, cek model
 * mana yang benar-benar bisa dipanggil dengan key tsb (bukan cuma "terdaftar"
 * — model bisa listed tapi berjatah 0 / 404 "no longer available").
 *
 * (a) List semua model yang tersedia untuk key (REST langsung, tak lewat Genkit
 *     — endpoint list tidak melalui jalur generate yang mau kita validasi).
 * (b) Panggilan NYATA (bukan sekadar list) ke tiap kandidat MODEL_CANDIDATES,
 *     lewat genkit + @genkit-ai/google-genai — jalur SAMA persis dengan
 *     src/ai/genkit.ts dan kedua endpoint /api/ai-review-auto, /api/inflation-auto.
 * (c) Ringkasan OK / 404 / 429 (limit:0) / error lain.
 * (d) Blok MODEL_CANDIDATES siap-salin, eksplisit dulu lalu alias "-latest".
 *
 * JALANKAN:
 *   npx tsx scripts/check-gemini-models.ts
 *
 * Baca GEMINI_API_KEY dari .env.local (tidak pernah di-hardcode / dicetak).
 * Dev-only — jangan dipanggil dari route/build.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('GEMINI_API_KEY tidak ditemukan di .env.local. Set dulu, lalu jalankan ulang.');
  process.exit(1);
}

// Kandidat eksplisit (versi tetap) — sumber: MODEL_CANDIDATES di
// src/app/api/ai-review-auto/route.ts & src/app/api/inflation-auto/route.ts.
const EXPLICIT_CANDIDATES = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

// Kandidat alias "rolling" Google (selalu menunjuk versi stabil terbaru dari
// tier tsb). BELUM dipakai di kode — diuji di sini untuk lihat apakah key
// BARU mendukungnya, sebagai jaring pengaman andai versi eksplisit di atas
// suatu saat pensiun juga di project baru.
const ALIAS_CANDIDATES = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
];

const ENV_OVERRIDE = process.env.GEMINI_MODEL?.replace(/^googleai\//, '');

const ALL_CANDIDATES = [...new Set(
  [ENV_OVERRIDE, ...EXPLICIT_CANDIDATES, ...ALIAS_CANDIDATES].filter(Boolean) as string[]
)];

type Result = {
  model: string;
  status: 'OK' | '404' | '429' | 'ERROR';
  detail: string;
};

async function listAvailableModels(): Promise<Set<string>> {
  console.log('\n=== (a) Model tersedia untuk key ini (REST list, /v1beta/models) ===\n');
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  const available = new Set<string>();
  try {
    const res = await fetch(url);
    const json: any = await res.json();
    if (!res.ok) {
      console.error(`  Gagal list model: HTTP ${res.status} — ${json?.error?.message ?? JSON.stringify(json)}`);
      return available;
    }
    const models: any[] = json.models ?? [];
    for (const m of models) {
      const name = (m.name as string).replace(/^models\//, '');
      const supportsGenerate = (m.supportedGenerationMethods ?? []).includes('generateContent');
      if (supportsGenerate) {
        available.add(name);
        console.log(`  - ${name}`);
      }
    }
    if (available.size === 0) console.log('  (tidak ada model dengan dukungan generateContent)');
  } catch (e: unknown) {
    console.error('  Gagal memanggil REST list:', e instanceof Error ? e.message : String(e));
  }
  return available;
}

async function callViaGenkit(model: string): Promise<Result> {
  // Import di dalam fungsi (bukan top-level) supaya genkit hanya diinisialisasi
  // sekali GEMINI_API_KEY sudah pasti ada di process.env.
  const { genkit } = await import('genkit');
  const { googleAI } = await import('@genkit-ai/google-genai');

  // Instansiasi identik src/ai/genkit.ts — TIDAK mengimpor '@/ai/genkit' langsung
  // supaya script ini jalan berdiri sendiri lewat tsx tanpa bergantung pada
  // resolusi alias path "@/*" di luar Next.js.
  const ai = genkit({ plugins: [googleAI({ apiKey: API_KEY })] });

  try {
    const response = await ai.generate({
      model: `googleai/${model}`,
      prompt: 'Balas HANYA dengan satu kata: OK',
      config: { temperature: 0, maxOutputTokens: 50 },
    });
    const text = response.text?.trim() ?? '';
    if (!text) {
      return { model, status: 'ERROR', detail: 'Respons kosong (cek apakah maxOutputTokens habis oleh thinking tokens)' };
    }
    return { model, status: 'OK', detail: `"${text.substring(0, 60)}"` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|quota|resource.?exhausted/i.test(msg)) {
      return { model, status: '429', detail: msg.substring(0, 200) };
    }
    if (/404|not found|no longer|not available|retired/i.test(msg)) {
      return { model, status: '404', detail: msg.substring(0, 200) };
    }
    return { model, status: 'ERROR', detail: msg.substring(0, 200) };
  }
}

async function main() {
  const available = await listAvailableModels();

  console.log('\n=== (b) Panggilan nyata lewat Genkit (jalur sama dengan website) ===\n');
  const results: Result[] = [];
  for (const model of ALL_CANDIDATES) {
    process.stdout.write(`  Testing googleai/${model} ... `);
    const result = await callViaGenkit(model);
    console.log(`${result.status}${result.status === 'OK' ? ' ' + result.detail : ' — ' + result.detail}`);
    results.push(result);
  }

  console.log('\n=== (c) Ringkasan ===\n');
  const ok = results.filter(r => r.status === 'OK');
  const notFound = results.filter(r => r.status === '404');
  const rateLimited = results.filter(r => r.status === '429');
  const errored = results.filter(r => r.status === 'ERROR');

  console.log(`  OK (${ok.length}):        ${ok.map(r => r.model).join(', ') || '-'}`);
  console.log(`  404 (${notFound.length}):       ${notFound.map(r => r.model).join(', ') || '-'}`);
  console.log(`  429/limit:0 (${rateLimited.length}): ${rateLimited.map(r => r.model).join(', ') || '-'}`);
  console.log(`  Error lain (${errored.length}):  ${errored.map(r => r.model).join(', ') || '-'}`);

  const listedButUntested = [...available].filter(m => !ALL_CANDIDATES.includes(m));
  if (listedButUntested.length > 0) {
    console.log(`\n  Terdaftar di /v1beta/models tapi TIDAK ada di daftar kandidat (tidak diuji):`);
    console.log(`    ${listedButUntested.join(', ')}`);
  }

  console.log('\n=== (d) Blok MODEL_CANDIDATES siap-salin ===\n');
  console.log('  (eksplisit dulu, alias "-latest" di belakang sebagai fallback — HANYA model berstatus OK di atas)\n');
  const explicitOk = ok.filter(r => EXPLICIT_CANDIDATES.includes(r.model)).map(r => r.model);
  const aliasOk = ok.filter(r => ALIAS_CANDIDATES.includes(r.model)).map(r => r.model);
  const orderedOk = [...explicitOk, ...aliasOk];

  if (orderedOk.length === 0) {
    console.log('  (tidak ada kandidat OK — cek bagian error di atas sebelum mengubah kode)');
  } else {
    console.log('  const MODEL_CANDIDATES = [...new Set([');
    console.log('    process.env.GEMINI_MODEL,');
    for (const m of orderedOk) {
      console.log(`    'googleai/${m}',`);
    }
    console.log('  ].filter(Boolean) as string[])];');
  }

  console.log('\nSelesai. Tempel ringkasan (b)-(d) ke laporan sebelum mengubah kode manapun.\n');
}

main();
