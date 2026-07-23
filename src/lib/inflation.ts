// Lapisan tampilan MURNI — tidak menulis apapun ke neraca.
// Menghitung nilai Rupiah-hari-ini dari sebuah harga yang tercatat (kekal),
// dengan compounding inflasi (pct > 0) atau deflasi (pct < 0) tahunan.

import { db } from './firebase';
import {
  collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { getCommunityConfig } from './community-config';
import type { InflationLog } from './types';

export type InflationEntry = { tahun: number; pct: number };

export function hargaEfektifTampilan(
  hargaDitetapkan: number,
  tanggalDibuat: Date,
  inflationHistory: InflationEntry[] | undefined,
): number {
  const tahunDibuat = tanggalDibuat.getFullYear();
  const tahunSekarang = new Date().getFullYear();
  const history = inflationHistory ?? [];

  let faktor = 1;
  for (let t = tahunDibuat; t < tahunSekarang; t++) {
    const pct = history.find(h => h.tahun === t)?.pct ?? 0;
    faktor *= 1 + pct / 100;
  }

  return hargaDitetapkan * faktor;
}

// Master toggle inflation_enabled — undefined dianggap aktif (default true).
// Dipakai di titik sumber data (bukan di komponen tampilan) supaya seluruh
// halaman yang sudah meneruskan inflationHistory ke banyak kartu/dialog
// bawaan cukup dapat array kosong saat nonaktif, tanpa perlu menambah prop
// baru di tiap komponen turunan.
export function effectiveInflationHistory(
  inflationHistory: InflationEntry[] | undefined,
  inflationEnabled: boolean | undefined,
): InflationEntry[] {
  if (inflationEnabled === false) return [];
  return inflationHistory ?? [];
}

// ─── Prompt baku manual-bridge (pola sama dengan buildAiReviewPrompt) ───────
// Dipakai ulang oleh versi otonom kelak — tahun disuntik dinamis, tidak ada
// data developer yang diekspor (inflasi bukan penilaian per-developer).
export function buildInflationPrompt(tahun: number): string {
  return `Kamu adalah asisten data ekonomi untuk platform komunitas NFT nirlaba. Beri estimasi inflasi tahunan Rupiah Indonesia untuk tahun ${tahun}. Ini bukan keputusan final — hanya estimasi transparan yang ditinjau administrator.
INSTRUKSI:
- Berikan satu bilangan bulat persen (boleh negatif = deflasi).
- Gunakan data resmi terbaru (mis. BPS) bila ada; jika tahun berjalan belum lengkap, beri estimasi terbaik + sebutkan dasarnya.
- Output HANYA satu baris, FORMAT PERSIS:
  INFLASI: [bilangan bulat] | [alasan/sumber singkat, maks 80 char]
- Jangan tambahkan narasi lain.`;
}

export type ParsedInflation = { pct: number; alasan: string };

// ─── Parse output AI → entri tervalidasi (mirror parseAiOutput) ────────────
export function parseInflationOutput(text: string): ParsedInflation | string {
  const line = text.split('\n').map(l => l.trim()).find(l => l.toUpperCase().startsWith('INFLASI:'));
  if (!line) return 'Tidak ada baris "INFLASI:" ditemukan. Pastikan output AI sesuai format.';

  const parts = line.replace(/^INFLASI:\s*/i, '').split('|').map(p => p.trim());
  if (parts.length < 2) return `Format salah (kurang dari 2 bagian): "${line.substring(0, 60)}"`;

  const pct = parseInt(parts[0], 10);
  const alasan = parts.slice(1).join('|').trim();
  if (isNaN(pct)) return `Bilangan tidak valid: "${parts[0]}"`;

  return { pct, alasan };
}

// ─── Catat peristiwa resmi inflasi/deflasi tahunan ───────────────────────────
// Meniru pola suspendUser/unsuspendUser (projects.ts): satu writeBatch, dua
// tulisan. TIDAK pernah runTransaction — tidak ada saldo yang dicek, murni
// upsert config + jejak log publik delta 0.
export async function recordInflation(
  tahun: number,
  pct: number,
  adminUid: string,
  adminNama: string,
  alasan: string,
): Promise<void> {
  const config = await getCommunityConfig();
  const history = config?.inflation_history ?? [];
  const idx = history.findIndex(h => h.tahun === tahun);
  const updatedHistory = idx >= 0
    ? history.map((h, i) => (i === idx ? { tahun, pct } : h))
    : [...history, { tahun, pct }];

  const batch = writeBatch(db);

  batch.update(doc(db, 'community_config', 'v1'), {
    inflation_history: updatedHistory,
    updated_at: serverTimestamp(),
    updated_by: adminUid,
  });

  batch.set(doc(collection(db, 'inflation_log')), {
    tahun,
    pct,
    aktor_uid: adminUid,
    aktor_nama: adminNama,
    alasan,
    created_at: serverTimestamp(),
  });

  await batch.commit();
}

// ─── Riwayat perubahan inflasi/deflasi, publik untuk transparansi ───────────
export async function getInflationLog(historyLimit: number): Promise<InflationLog[]> {
  const snap = await getDocs(query(
    collection(db, 'inflation_log'),
    orderBy('created_at', 'desc'),
    limit(historyLimit),
  ));

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      tahun: (data.tahun as number) ?? 0,
      pct: (data.pct as number) ?? 0,
      aktor_uid: (data.aktor_uid as string) ?? '',
      aktor_nama: (data.aktor_nama as string) ?? '',
      alasan: (data.alasan as string) ?? '',
      created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
    };
  });
}
