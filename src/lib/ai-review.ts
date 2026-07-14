import { db } from './firebase';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  writeBatch, serverTimestamp, increment, Timestamp, getCountFromServer,
} from 'firebase/firestore';
import { fibonacciLargestAndSum, isLapakAktif } from './ranking';
import type { AiReview, AiReviewEntry, AiReviewStatus, CommunityConfig, NeracaLog } from './types';

// ─── Public types ─────────────────────────────────────────────────────────────

export type DevProfile = {
  uid: string;
  shortId: string;
  displayName: string;
  level: string;
  lastAiReviewAt: Date | null;
};

export type DevAggregate = {
  uid: string;
  shortId: string;
  displayName: string;
  level: string;
  totalJual: number;
  totalBuyback: number;
  neracaDelta: number;
  logCount: number;
  topCounterpartiesJual: { shortId: string; count: number }[];
  topCounterpartiesBuyback: { shortId: string; count: number }[];
};

export type ParsedAiEntry = {
  shortId: string;
  uid: string;
  displayName: string;
  skor: number;
  alasan: string;
  minusNft: number;
  minusNeraca: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calcMinusNeraca(
  skor: number,
  config: Pick<CommunityConfig, 'ai_anomali_divisor' | 'ai_anomali_min_skor' | 'harga_dasar'>,
): { minusNft: number; minusNeraca: number } {
  const divisor = config.ai_anomali_divisor ?? 10;
  const minSkor = config.ai_anomali_min_skor ?? 30;
  const hargaDasar = config.harga_dasar ?? 100000;
  const minusNft = skor < minSkor
    ? Math.floor(skor / divisor / 2)
    : Math.floor(skor / divisor);
  return { minusNft, minusNeraca: minusNft * hargaDasar };
}

// ─── Fetch top developers + kandidat (capped at Fibonacci quota) ───────────

export async function getTopDevsForAiReview(
  config: CommunityConfig,
): Promise<{ devs: DevProfile[]; totalUsers: number }> {
  const minSold = config.minimum_soldNfts_top_developer ?? 24;

  const [topDevSnap, candidateSnap, totalCountResult] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('level', '==', 'top_developer'))),
    getDocs(query(
      collection(db, 'users'),
      where('soldNfts', '>=', minSold),
      orderBy('soldNfts', 'desc'),
      limit(200),
    )),
    getCountFromServer(collection(db, 'users')),
  ]);

  const totalUsers = totalCountResult.data().count;
  const { largest: quota } = fibonacciLargestAndSum(totalUsers);

  const seen = new Set<string>();
  const result: DevProfile[] = [];

  for (const d of topDevSnap.docs) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    if (!isLapakAktif(d.data())) continue; // lapak OFF — tidak direview, posisi teratas = posisi aktif
    const rawTs = d.data().last_ai_review_at;
    result.push({
      uid: d.id,
      shortId: d.id.substring(0, 6),
      displayName: (d.data().displayName as string) ?? 'User',
      level: 'top_developer',
      lastAiReviewAt: rawTs instanceof Timestamp ? rawTs.toDate() : null,
    });
  }

  for (const d of candidateSnap.docs) {
    if (result.length >= quota) break;
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    if (!isLapakAktif(d.data())) continue; // lapak OFF — tidak direview
    const rawTs = d.data().last_ai_review_at;
    result.push({
      uid: d.id,
      shortId: d.id.substring(0, 6),
      displayName: (d.data().displayName as string) ?? 'User',
      level: (d.data().level as string) ?? 'developer_biasa',
      lastAiReviewAt: rawTs instanceof Timestamp ? rawTs.toDate() : null,
    });
  }

  return { devs: result.slice(0, quota), totalUsers };
}

// ─── Fetch neraca_log per developer ───────────────────────────────────────────

export async function fetchDevLogs(
  uid: string,
  historyLimit: number,
  historyDays: number,
  lastReviewAt: Date | null = null,
): Promise<NeracaLog[]> {
  const historyBound = new Date();
  historyBound.setDate(historyBound.getDate() - historyDays);

  // Watermark: ambil hanya log SETELAH review terakhir untuk cegah double-penalty.
  // Lower bound = max(historyBound, lastReviewAt). Operator '>' saat watermark
  // jadi lower bound (log persis di titik watermark sudah dinilai sebelumnya).
  const watermarkActive = lastReviewAt !== null && lastReviewAt > historyBound;
  const lowerBound: Date = watermarkActive ? (lastReviewAt as Date) : historyBound;
  const operator = watermarkActive ? '>' : '>=';

  const snap = await getDocs(query(
    collection(db, 'users', uid, 'neraca_log'),
    where('timestamp', operator as '<' | '<=' | '==' | '>=' | '>', Timestamp.fromDate(lowerBound)),
    orderBy('timestamp', 'desc'),
    limit(historyLimit),
  ));

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      type: (data.type as NeracaLog['type']) ?? 'beli',
      nft_unit_id: (data.nft_unit_id as string) ?? 'system',
      nama_nft: (data.nama_nft as string) ?? '',
      harga_transaksi: (data.harga_transaksi as number) ?? 0,
      nilai_selisih: (data.nilai_selisih as number) ?? 0,
      delta: (data.delta as number) ?? 0,
      counterparty_id: (data.counterparty_id as string) ?? '',
      timestamp: (data.timestamp as Timestamp)?.toDate?.() ?? new Date(),
    };
  });
}

// ─── Aggregate log per developer menjadi ringkasan teks ───────────────────────

export function aggregateDevData(dev: DevProfile, logs: NeracaLog[]): DevAggregate {
  let totalJual = 0;
  let totalBuyback = 0;
  let neracaDelta = 0;
  const counterJual = new Map<string, number>();
  const counterBuyback = new Map<string, number>();

  for (const log of logs) {
    neracaDelta += log.delta ?? 0;
    if (['jual', 'beli_auto', 'beli_dibatalkan'].includes(log.type)) {
      totalJual++;
      const cp = log.counterparty_id?.substring(0, 6);
      if (cp) counterJual.set(cp, (counterJual.get(cp) ?? 0) + 1);
    } else if (['buyback', 'buyback_auto'].includes(log.type)) {
      totalBuyback++;
      const cp = log.counterparty_id?.substring(0, 6);
      if (cp) counterBuyback.set(cp, (counterBuyback.get(cp) ?? 0) + 1);
    }
  }

  const topCounterpartiesJual = Array.from(counterJual.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([shortId, count]) => ({ shortId, count }));

  const topCounterpartiesBuyback = Array.from(counterBuyback.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([shortId, count]) => ({ shortId, count }));

  return {
    uid: dev.uid,
    shortId: dev.shortId,
    displayName: dev.displayName,
    level: dev.level,
    totalJual,
    totalBuyback,
    neracaDelta,
    logCount: logs.length,
    topCounterpartiesJual,
    topCounterpartiesBuyback,
  };
}

// ─── Generate teks data untuk clipboard ───────────────────────────────────────

export function generateDataText(aggregates: DevAggregate[]): string {
  return aggregates.map(agg => {
    const jualCp = agg.topCounterpartiesJual.map(c => `${c.shortId}(${c.count}x)`).join(', ') || '-';
    const bbCp = agg.topCounterpartiesBuyback.map(c => `${c.shortId}(${c.count}x)`).join(', ') || '-';
    return [
      `DEV: ${agg.shortId} | ${agg.displayName}`,
      `Jual: ${agg.totalJual} | Buyback: ${agg.totalBuyback} | Log: ${agg.logCount}`,
      `Counterparty jual (top 3): ${jualCp}`,
      `Counterparty buyback (top 3): ${bbCp}`,
    ].join('\n');
  }).join('\n\n');
}

// ─── Generate prompt baku untuk AI eksternal ──────────────────────────────────
// Fungsi ini juga dipakai oleh mode otonom Level 2 (api/ai-review-auto).

export function buildAiReviewPrompt(
  dataText: string,
  totalUsers: number,
  jumlahDev: number,
): string {
  return `Kamu adalah AI detector anomali untuk platform komunitas NFT nirlaba.
Tugasmu menilai log transaksi developer dan mendeteksi pola tidak wajar.
AI bukan pengambil keputusan — hanya menghasilkan skor anomali transparan.

KONTEKS KOMUNITAS:
Total user terdaftar: ${totalUsers} | Developer papan atas dinilai: ${jumlahDev}
Pada komunitas kecil, counterparty berulang lebih wajar terjadi. Kalibrasikan skor dengan mempertimbangkan ukuran komunitas: pola yang sama lebih mencurigakan di komunitas besar daripada komunitas kecil.

DATA DEVELOPER (dinonimasi, ID = 6 karakter pertama UID):
${dataText}

INSTRUKSI:
- Fokus deteksi: self-dealing (counterparty berulang di kedua arah jual + buyback), volume tidak wajar, pola sirkular antar akun.
- Skor 0 = bersih, 100 = anomali sangat berat.
- Developer TANPA aktivitas transaksi (Jual: 0, Buyback: 0, tanpa counterparty) WAJIB skor 0 dengan alasan "tidak ada aktivitas untuk dinilai". JANGAN beri skor kecil (1-10) karena keraguan.
- Skor > 0 HANYA jika ada pola konkret yang dirujuk dalam alasan (counterparty berulang dua arah, volume tak wajar, pola sirkular antar akun). Alasan harus menyebut data nyata dari log, bukan asumsi.
- Output HANYA daftar skor. Satu baris per developer. FORMAT PERSIS:
  SKOR: [id_6_char] | [0-100] | [alasan singkat, maks 80 karakter]
- Jangan tambahkan narasi, pembuka, atau penutup. Jangan ulangi data. Hanya baris SKOR.`;
}

// ─── Parse output AI → entries tervalidasi ────────────────────────────────────

export function parseAiOutput(
  text: string,
  shortIdToInfo: Map<string, { uid: string; displayName: string }>,
  config: Pick<CommunityConfig, 'ai_anomali_divisor' | 'ai_anomali_min_skor' | 'harga_dasar'>,
): ParsedAiEntry[] | string {
  const lines = text.split('\n').filter(l => l.trim().toUpperCase().startsWith('SKOR:'));
  if (lines.length === 0) return 'Tidak ada baris "SKOR:" ditemukan. Pastikan output AI sesuai format.';

  const results: ParsedAiEntry[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    const parts = line.replace(/^SKOR:\s*/i, '').split('|').map(p => p.trim());
    if (parts.length < 3) {
      errors.push(`Format salah (kurang dari 3 bagian): "${line.substring(0, 60)}"`);
      continue;
    }
    const shortId = parts[0];
    const skor = parseInt(parts[1], 10);
    const alasan = parts.slice(2).join('|').trim();

    if (isNaN(skor) || skor < 0 || skor > 100) {
      errors.push(`Skor tidak valid "${parts[1]}" untuk ID "${shortId}"`);
      continue;
    }

    const devInfo = shortIdToInfo.get(shortId);
    if (!devInfo) {
      errors.push(`ID tidak dikenal atau tidak dalam daftar review: "${shortId}"`);
      continue;
    }

    const { minusNft, minusNeraca } = calcMinusNeraca(skor, config);
    results.push({ shortId, uid: devInfo.uid, displayName: devInfo.displayName, skor, alasan, minusNft, minusNeraca });
  }

  if (errors.length > 0) return errors.join('\n');
  return results;
}

// ─── Apply review ke Firestore ────────────────────────────────────────────────

export async function applyAiReview(
  entries: ParsedAiEntry[],
  config: CommunityConfig,
  adminUid: string,
): Promise<string> {
  const batch = writeBatch(db);
  const reviewRef = doc(collection(db, 'ai_reviews'));
  const reviewId = reviewRef.id;
  const revertDays = config.ai_review_revert_days ?? 7;
  const revertDeadline = new Date();
  revertDeadline.setDate(revertDeadline.getDate() + revertDays);

  const appliedEntries: AiReviewEntry[] = [];
  let totalMinus = 0;

  for (const entry of entries) {
    appliedEntries.push({
      dev_id: entry.uid,
      nama: entry.displayName,
      skor: entry.skor,
      alasan: entry.alasan,
      minus_diterapkan: entry.minusNeraca,
      status: 'applied',
    });

    // Watermark di-set untuk SEMUA developer yang dinilai (termasuk skor 0)
    // agar log sampai titik ini tidak dinilai ulang di sesi review berikutnya.
    if (entry.minusNeraca > 0) {
      batch.update(doc(db, 'users', entry.uid), {
        last_ai_review_at: serverTimestamp(),
        total_poin: increment(-entry.minusNeraca),
      });

      batch.set(doc(collection(db, 'users', entry.uid, 'neraca_log')), {
        type: 'anomali_ai',
        nft_unit_id: 'system',
        nama_nft: 'AI Anomali Review',
        harga_transaksi: 0,
        nilai_selisih: entry.minusNeraca,
        delta: -entry.minusNeraca,
        counterparty_id: adminUid,
        review_id: reviewId,
        alasan: entry.alasan,
        timestamp: serverTimestamp(),
      });

      totalMinus += entry.minusNeraca;
    } else {
      batch.update(doc(db, 'users', entry.uid), { last_ai_review_at: serverTimestamp() });

      batch.set(doc(collection(db, 'users', entry.uid, 'neraca_log')), {
        type: 'anomali_ai_bersih',
        nft_unit_id: 'system',
        nama_nft: 'AI Review — Bersih',
        harga_transaksi: 0,
        nilai_selisih: 0,
        delta: 0,
        counterparty_id: adminUid,
        review_id: reviewId,
        alasan: entry.alasan,
        timestamp: serverTimestamp(),
      });
    }
  }

  if (totalMinus > 0) {
    batch.set(doc(db, 'fee_pool', 'v1'), {
      total_dari_anomali: increment(totalMinus),
      saldo_tersedia: increment(totalMinus),
    }, { merge: true });
  }

  batch.set(reviewRef, {
    created_at: serverTimestamp(),
    created_by: adminUid,
    entries: appliedEntries,
    revert_deadline: Timestamp.fromDate(revertDeadline),
    total_minus: totalMinus,
    status: 'applied',
  });

  await batch.commit();
  return reviewId;
}

// ─── Revert review — kembalikan neraca SETIAP user yang kena minus ────────────

export async function revertAiReview(reviewId: string, review: AiReview, adminUid: string): Promise<void> {
  const batch = writeBatch(db);
  let totalRestored = 0;

  // last_ai_review_at TIDAK diubah saat revert — keputusan sadar:
  // revert mengoreksi nilai (total_poin), bukan membuka kembali log
  // yang sudah dinilai untuk sesi review berikutnya.

  // Loop per-entry: kembalikan total_poin + tulis log revert untuk setiap user
  for (const entry of review.entries) {
    if (entry.minus_diterapkan <= 0) continue;

    batch.update(doc(db, 'users', entry.dev_id), {
      total_poin: increment(entry.minus_diterapkan),
    });

    batch.set(doc(collection(db, 'users', entry.dev_id, 'neraca_log')), {
      type: 'anomali_ai_revert',
      nft_unit_id: 'system',
      nama_nft: 'Pembatalan AI Anomali Review',
      harga_transaksi: 0,
      nilai_selisih: entry.minus_diterapkan,
      delta: entry.minus_diterapkan,
      counterparty_id: adminUid,
      reverted_by: adminUid,
      review_id: reviewId,
      alasan: `Pembatalan: ${entry.alasan}`,
      timestamp: serverTimestamp(),
    });

    totalRestored += entry.minus_diterapkan;
  }

  if (totalRestored > 0) {
    batch.set(doc(db, 'fee_pool', 'v1'), {
      total_dari_anomali: increment(-totalRestored),
      saldo_tersedia: increment(-totalRestored),
    }, { merge: true });
  }

  // Update review: status top-level + entries[].status semua → 'reverted'
  const revertedEntries: AiReviewEntry[] = review.entries.map(e => ({
    ...e,
    status: 'reverted' as AiReviewStatus,
  }));

  batch.update(doc(db, 'ai_reviews', reviewId), {
    status: 'reverted',
    entries: revertedEntries,
  });

  await batch.commit();
}

// ─── Fetch all reviews ────────────────────────────────────────────────────────

export async function getAiReviews(): Promise<AiReview[]> {
  const snap = await getDocs(query(
    collection(db, 'ai_reviews'),
    orderBy('created_at', 'desc'),
  ));

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
      created_by: (data.created_by as string) ?? '',
      entries: (data.entries as AiReviewEntry[]) ?? [],
      revert_deadline: (data.revert_deadline as Timestamp)?.toDate?.() ?? new Date(),
      total_minus: (data.total_minus as number) ?? 0,
      status: (data.status as AiReviewStatus) ?? 'applied',
    };
  });
}

// ─── Lazy auto-final: reviews lewat deadline → status 'final' ─────────────────

export async function maybeFinalizeReviews(reviews: AiReview[]): Promise<AiReview[]> {
  const now = new Date();
  const expired = reviews.filter(r => r.status === 'applied' && r.revert_deadline < now);
  if (expired.length === 0) return reviews;

  const batch = writeBatch(db);
  for (const r of expired) {
    const finalEntries: AiReviewEntry[] = r.entries.map(e => ({ ...e, status: 'final' as AiReviewStatus }));
    batch.update(doc(db, 'ai_reviews', r.id), { status: 'final', entries: finalEntries });
  }
  await batch.commit();

  return reviews.map(r => {
    if (!expired.some(e => e.id === r.id)) return r;
    return {
      ...r,
      status: 'final' as AiReviewStatus,
      entries: r.entries.map(e => ({ ...e, status: 'final' as AiReviewStatus })),
    };
  });
}

// ─── Re-export types pakai di halaman ─────────────────────────────────────────
export type { AiReview, AiReviewEntry, AiReviewStatus };
