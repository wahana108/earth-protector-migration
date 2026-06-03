import { db } from './firebase';
import {
  collection, collectionGroup, getDocs, getDoc, doc, query,
  orderBy, limit, where, writeBatch, updateDoc,
  serverTimestamp, Timestamp, increment,
} from 'firebase/firestore';
import type { Comment } from './types';
import { isBlocked } from './blocks';

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
    };
  });
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
  const batch = writeBatch(db);
  const commentRef = doc(collection(db, 'nft_units', nftUnitId, 'comments'));

  batch.set(commentRef, {
    user_id: userId,
    display_name: displayName,
    text,
    timestamp: serverTimestamp(),
    anomali_flag: false,
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

export async function reportComment(nftUnitId: string, commentId: string): Promise<void> {
  await updateDoc(doc(db, 'nft_units', nftUnitId, 'comments', commentId), {
    anomali_flag: true,
  });
}

export async function ignoreComment(nftUnitId: string, commentId: string): Promise<void> {
  await updateDoc(doc(db, 'nft_units', nftUnitId, 'comments', commentId), {
    anomali_flag: false,
  });
}

export async function fetchFlaggedComments(): Promise<FlaggedComment[]> {
  const q = query(
    collectionGroup(db, 'comments'),
    where('anomali_flag', '==', true),
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
