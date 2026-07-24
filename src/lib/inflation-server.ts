// Server-side Admin SDK path untuk Info Inflasi/Deflasi otonom.
// Mirror dari recordInflation() di inflation.ts menggunakan firebase-admin,
// sehingga dapat berjalan dari API route tanpa auth user (cron/server-to-server
// tidak punya request.auth → isAdmin() di firestore.rules selalu false untuk
// client SDK). Prompt/parse murni (buildInflationPrompt, parseInflationOutput)
// tetap di inflation.ts dan dipakai langsung tanpa duplikasi.

import { getAdminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { InflationEntry } from './inflation';

// ─── Catat peristiwa resmi inflasi/deflasi tahunan via Admin SDK ────────────
// Logika upsert identik recordInflation: satu batch, dua tulisan
// (community_config + inflation_log). TIDAK pernah transaction — tidak ada
// saldo yang dicek, murni upsert config + jejak log publik delta 0.
export async function recordInflationAdmin(
  tahun: number,
  pct: number,
  aktorUid: string,
  aktorNama: string,
  alasan: string,
): Promise<void> {
  const adminDb = getAdminDb();
  const configRef = adminDb.collection('community_config').doc('v1');

  const configSnap = await configRef.get();
  const history = (configSnap.data()?.inflation_history as InflationEntry[] | undefined) ?? [];
  const idx = history.findIndex(h => h.tahun === tahun);
  const updatedHistory = idx >= 0
    ? history.map((h, i) => (i === idx ? { tahun, pct } : h))
    : [...history, { tahun, pct }];

  const batch = adminDb.batch();

  batch.update(configRef, {
    inflation_history: updatedHistory,
    updated_at: FieldValue.serverTimestamp(),
    updated_by: aktorUid,
  });

  batch.set(adminDb.collection('inflation_log').doc(), {
    tahun,
    pct,
    aktor_uid: aktorUid,
    aktor_nama: aktorNama,
    alasan,
    created_at: FieldValue.serverTimestamp(),
  });

  await batch.commit();
}
