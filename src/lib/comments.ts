import { db } from './firebase';
import {
  collection, collectionGroup, getDocs, getDoc, doc, query,
  orderBy, limit, where, writeBatch, updateDoc,
  serverTimestamp, Timestamp, increment,
} from 'firebase/firestore';

import type { Comment } from './types';
import { isBlocked } from './blocks';
import { getCommunityConfig } from './community-config';
import { checkAndIncrementUserUsage, checkGlobalDailyLimit, getTodayString } from './rate-limit';
import { isSuspended } from './ranking';

export type FlaggedComment = {
  id: string;
  nft_unit_id: string;
  user_id: string;
  display_name: string;
  text: string;
  timestamp: Date;
  nama_nft: string;
};

export async function fetchComments(nftUnitId: string): Promise<Comment[]> {
  const q = query(
    collection(db, 'nft_units', nftUnitId, 'comments'),
    orderBy('timestamp', 'desc'),
    limit(10),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      user_id: data.user_id as string,
      display_name: (data.display_name as string) ?? 'Anonymous',
      text: data.text as string,
      timestamp: (data.timestamp as Timestamp)?.toDate?.() ?? new Date(),
      anomali_flag: (data.anomali_flag as boolean) ?? false,
      is_pinned: (data.is_pinned as boolean) ?? false,
      badge_kontributor: (data.badge_kontributor as boolean) ?? false,
      total_kontribusi: (data.total_kontribusi as number) ?? 0,
    };
  });
}

export async function pinComment(
  commentId: string,
  nftUnitId: string,
  projectDeveloperId: string,
  requesterId: string,
): Promise<void> {
  if (requesterId !== projectDeveloperId) throw new Error('Hanya developer project yang bisa menyematkan komentar.');

  const commentsRef = collection(db, 'nft_units', nftUnitId, 'comments');
  const pinnedSnap = await getDocs(query(commentsRef, where('is_pinned', '==', true)));

  const batch = writeBatch(db);
  pinnedSnap.docs.forEach(d => {
    batch.update(d.ref, { is_pinned: false });
  });
  batch.update(doc(commentsRef, commentId), { is_pinned: true });
  await batch.commit();
}

export async function unpinComment(
  commentId: string,
  nftUnitId: string,
  projectDeveloperId: string,
  requesterId: string,
): Promise<void> {
  if (requesterId !== projectDeveloperId) throw new Error('Hanya developer project yang bisa melepas sematan.');
  await updateDoc(doc(db, 'nft_units', nftUnitId, 'comments', commentId), { is_pinned: false });
}

export async function addComment(
  nftUnitId: string,
  userId: string,
  displayName: string,
  text: string,
  nftOwnerId?: string,
): Promise<Comment> {
  if (nftOwnerId && nftOwnerId !== userId) {
    const blocked = await isBlocked(userId, nftOwnerId);
    if (blocked) throw new Error('Tidak bisa berkomentar di NFT user yang diblokir.');
  }

  // Config dan user doc bisa diambil paralel
  const [config, userSnap] = await Promise.all([
    getCommunityConfig(),
    getDoc(doc(db, 'users', userId)),
  ]);
  if (isSuspended(userSnap.data())) throw new Error('Akun Anda ditangguhkan administrator.');
  // Cek global setelah config tersedia — race condition minimal diterima (proteksi kasar)
  await checkGlobalDailyLimit('comments', config?.max_comments_global_per_day ?? 300);

  const batch = writeBatch(db);
  const userRef = doc(db, 'users', userId);
  const commentRef = doc(collection(db, 'nft_units', nftUnitId, 'comments'));
  const userData = userSnap.data() ?? {};
  // Snapshot badge di titik waktu ini (sama seperti display_name) — 0 read tambahan,
  // userSnap sudah di-fetch untuk rate limit. Komentar lama tidak retroaktif berubah.
  const badgeKontributor = (userData.badge_kontributor as boolean) ?? false;
  const totalKontribusi = (userData.total_kontribusi as number) ?? 0;

  // Per-user daily comment limit (userSnap sudah di-fetch, 0 read tambahan)
  checkAndIncrementUserUsage(
    batch, userRef, userData, 'comments',
    config?.max_comments_per_user_per_day ?? 30,
  );

  // Global increment — tulis ke daily_stats/{today} dalam batch yang sama
  if ((config?.max_comments_global_per_day ?? 300) > 0) {
    batch.set(doc(db, 'daily_stats', getTodayString()), { comments: increment(1) }, { merge: true });
  }

  batch.set(commentRef, {
    user_id: userId,
    display_name: displayName,
    text,
    timestamp: serverTimestamp(),
    anomali_flag: false,
    badge_kontributor: badgeKontributor,
    total_kontribusi: totalKontribusi,
  });

  batch.update(doc(db, 'nft_units', nftUnitId), {
    comment_count: increment(1),
  });

  await batch.commit();

  return {
    id: commentRef.id,
    user_id: userId,
    display_name: displayName,
    text,
    timestamp: new Date(),
    anomali_flag: false,
    badge_kontributor: badgeKontributor,
    total_kontribusi: totalKontribusi,
  };
}

export async function deleteComment(nftUnitId: string, commentId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'nft_units', nftUnitId, 'comments', commentId));
  batch.update(doc(db, 'nft_units', nftUnitId), {
    comment_count: increment(-1),
  });
  await batch.commit();
}

export async function reportComment(
  nftUnitId: string,
  commentId: string,
  reporterId: string,
  commentAuthorId?: string,
): Promise<void> {
  const reporterRef = doc(db, 'users', reporterId);
  const [config, reporterSnap] = await Promise.all([
    getCommunityConfig(),
    getDoc(reporterRef),
  ]);
  if (isSuspended(reporterSnap.data())) throw new Error('Akun Anda ditangguhkan administrator.');
  if (commentAuthorId && commentAuthorId !== reporterId) {
    const blocked = await isBlocked(reporterId, commentAuthorId);
    if (blocked) throw new Error('Tidak bisa melaporkan user yang diblokir/memblokir Anda.');
  }
  await checkGlobalDailyLimit('reports', config?.max_reports_global_per_day ?? 50);

  const batch = writeBatch(db);
  checkAndIncrementUserUsage(
    batch, reporterRef, reporterSnap.data() ?? {}, 'reports',
    config?.max_reports_per_user_per_day ?? 3,
  );
  if ((config?.max_reports_global_per_day ?? 50) > 0) {
    batch.set(doc(db, 'daily_stats', getTodayString()), { reports: increment(1) }, { merge: true });
  }
  batch.update(doc(db, 'nft_units', nftUnitId, 'comments', commentId), { anomali_flag: true });
  await batch.commit();
}

export async function ignoreComment(nftUnitId: string, commentId: string): Promise<void> {
  await updateDoc(doc(db, 'nft_units', nftUnitId, 'comments', commentId), {
    anomali_flag: false,
  });
}

// Tidak ada orderBy di query (hindari index komposit collectionGroup) — sort waktu
// di JS setelah fetch. limit() membatasi biaya read worst-case scan collectionGroup,
// bukan menjamin N komentar TERBARU (urutan sebelum limit tidak dijamin per-waktu).
export async function fetchFlaggedComments(maxCount = 50): Promise<FlaggedComment[]> {
  const q = query(
    collectionGroup(db, 'comments'),
    where('anomali_flag', '==', true),
    limit(maxCount),
  );
  const snap = await getDocs(q);

  const rawComments = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      nft_unit_id: d.ref.parent.parent!.id,
      user_id: data.user_id as string,
      display_name: (data.display_name as string) ?? 'Anonymous',
      text: data.text as string,
      timestamp: (data.timestamp as Timestamp)?.toDate?.() ?? new Date(),
    };
  });

  // Sort by timestamp desc di JS — hindari kebutuhan composite index Firestore
  rawComments.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Fetch nama_nft dari parent nft_unit — parallel untuk semua unique IDs
  const uniqueIds = [...new Set(rawComments.map((c) => c.nft_unit_id))];
  const nftDocs = await Promise.all(
    uniqueIds.map((id) => getDoc(doc(db, 'nft_units', id))),
  );
  const nameMap: Record<string, string> = {};
  nftDocs.forEach((d) => {
    if (d.exists()) nameMap[d.id] = (d.data().nama_nft as string) ?? d.id;
  });

  return rawComments.map((c) => ({
    ...c,
    nama_nft: nameMap[c.nft_unit_id] ?? c.nft_unit_id,
  }));
}
