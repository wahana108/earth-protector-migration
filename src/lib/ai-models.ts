// Daftar diverifikasi lewat panggilan nyata pada 2026-08-06 dengan API key
// project baru. Model 2.x sudah 404/limit:0 untuk project baru. Verifikasi
// ulang dengan scripts/check-gemini-models.ts bila muncul kegagalan model
// di masa depan.
export const MODEL_CANDIDATES = [...new Set([
  process.env.GEMINI_MODEL,
  'googleai/gemini-3.6-flash',
  'googleai/gemini-3.5-flash',
  'googleai/gemini-3.5-flash-lite',
  'googleai/gemini-3.1-flash-lite',
  'googleai/gemini-3-flash-preview', // preview — sengaja di belakang
  'googleai/gemini-flash-latest',    // alias — jaring pengaman
  'googleai/gemini-flash-lite-latest',
].filter(Boolean) as string[])];
