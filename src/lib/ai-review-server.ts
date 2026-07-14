// Server-side Admin SDK path untuk AI Review otonom (Level 2).
// Fungsi di sini adalah mirror dari ai-review.ts menggunakan firebase-admin,
// sehingga dapat berjalan dari API route tanpa auth user.
// Business logic murni (aggregateDevData, buildAiReviewPrompt, parseAiOutput, dll.)
// tetap di ai-review.ts dan dipakai langsung tanpa duplikasi.

import { getAdminDb } from './firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { fibonacciLargestAndSum, isLapakAktif } from './ranking';
import { calcMinusNeraca } from './ai-review';
import type { DevProfile, ParsedAiEntry } from './ai-review';
import type { CommunityConfig, NeracaLog } from './types';
import type { AiReviewEntry, AiReviewStatus } from './types';

// ─── Fetch top developers + kandidat via Admin SDK ────────────────────────────

export async function getTopDevsForAiReviewAdmin(
  config: CommunityConfig,
): Promise<{ devs: DevProfile[]; totalUsers: number }> {
  const adminDb = getAdminDb();
  const minSold = config.minimum_soldNfts_top_developer ?? 24;

  const [topDevSnap, candidateSnap, countSnap] = await Promise.all([
    adminDb.collection('users').where('level', '==', 'top_developer').get(),
    adminDb.collection('users')
      .where('soldNfts', '>=', minSold)
      .orderBy('soldNfts', 'desc')
      .limit(200)
      .get(),
    adminDb.collection('users').count().get(),
  ]);

  const totalUsers: number = countSnap.data().count;
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

// ─── Fetch neraca_log per developer via Admin SDK ─────────────────────────────

export async function fetchDevLogsAdmin(
  uid: string,
  historyLimit: number,
  historyDays: number,
  lastReviewAt: Date | null = null,
): Promise<NeracaLog[]> {
  const adminDb = getAdminDb();

  const historyBound = new Date();
  historyBound.setDate(historyBound.getDate() - historyDays);

  const watermarkActive = lastReviewAt !== null && lastReviewAt > historyBound;
  const lowerBound: Date = watermarkActive ? lastReviewAt : historyBound;
  const operator: '>' | '>=' = watermarkActive ? '>' : '>=';

  const snap = await adminDb
    .collection('users').doc(uid).collection('neraca_log')
    .where('timestamp', operator, Timestamp.fromDate(lowerBound))
    .orderBy('timestamp', 'desc')
    .limit(historyLimit)
    .get();

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

// ─── Apply review ke Firestore via Admin SDK ──────────────────────────────────
// Mirror dari applyAiReview() di ai-review.ts.
// adminUid = 'ai-auto' untuk run otonom (membedakan dari keputusan admin manual).

export async function applyAiReviewAdmin(
  entries: ParsedAiEntry[],
  config: CommunityConfig,
  adminUid: string,
): Promise<string> {
  const adminDb = getAdminDb();
  const batch = adminDb.batch();

  const reviewRef = adminDb.collection('ai_reviews').doc();
  const reviewId = reviewRef.id;
  const revertDays = config.ai_review_revert_days ?? 7;
  const revertDeadline = new Date();
  revertDeadline.setDate(revertDeadline.getDate() + revertDays);

  const appliedEntries: AiReviewEntry[] = [];
  let totalMinus = 0;

  for (const entry of entries) {
    const { minusNeraca } = calcMinusNeraca(entry.skor, config);

    appliedEntries.push({
      dev_id: entry.uid,
      nama: entry.displayName,
      skor: entry.skor,
      alasan: entry.alasan,
      minus_diterapkan: minusNeraca,
      status: 'applied',
    });

    const userRef = adminDb.collection('users').doc(entry.uid);
    const logRef = adminDb.collection('users').doc(entry.uid).collection('neraca_log').doc();

    if (minusNeraca > 0) {
      batch.update(userRef, {
        last_ai_review_at: FieldValue.serverTimestamp(),
        total_poin: FieldValue.increment(-minusNeraca),
      });

      batch.set(logRef, {
        type: 'anomali_ai',
        nft_unit_id: 'system',
        nama_nft: 'AI Anomali Review',
        harga_transaksi: 0,
        nilai_selisih: minusNeraca,
        delta: -minusNeraca,
        counterparty_id: adminUid,
        review_id: reviewId,
        alasan: entry.alasan,
        timestamp: FieldValue.serverTimestamp(),
      });

      totalMinus += minusNeraca;
    } else {
      batch.update(userRef, { last_ai_review_at: FieldValue.serverTimestamp() });

      batch.set(logRef, {
        type: 'anomali_ai_bersih',
        nft_unit_id: 'system',
        nama_nft: 'AI Review — Bersih',
        harga_transaksi: 0,
        nilai_selisih: 0,
        delta: 0,
        counterparty_id: adminUid,
        review_id: reviewId,
        alasan: entry.alasan,
        timestamp: FieldValue.serverTimestamp(),
      });
    }
  }

  if (totalMinus > 0) {
    batch.set(adminDb.collection('fee_pool').doc('v1'), {
      total_dari_anomali: FieldValue.increment(totalMinus),
      saldo_tersedia: FieldValue.increment(totalMinus),
    }, { merge: true });
  }

  batch.set(reviewRef, {
    created_at: FieldValue.serverTimestamp(),
    created_by: adminUid,
    entries: appliedEntries,
    revert_deadline: Timestamp.fromDate(revertDeadline),
    total_minus: totalMinus,
    status: 'applied' as AiReviewStatus,
  });

  await batch.commit();
  return reviewId;
}
