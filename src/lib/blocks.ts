import { db } from './firebase';
import {
  collection, doc, addDoc, deleteDoc, getDocs, updateDoc,
  query, where, serverTimestamp, Timestamp, limit,
} from 'firebase/firestore';
import type { UserBlock } from './types';

function toUserBlock(id: string, data: Record<string, unknown>): UserBlock {
  return {
    id,
    blocker_id: data.blocker_id as string,
    blocked_id: data.blocked_id as string,
    reason: (data.reason as string) ?? '',
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
    reviewed_by_admin: (data.reviewed_by_admin as boolean) ?? false,
    admin_decision: (data.admin_decision as UserBlock['admin_decision']) ?? null,
  };
}

// Buat blokir baru. Mengembalikan ID dokumen yang dibuat.
export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason: string,
): Promise<string> {
  if (blockerId === blockedId) throw new Error('Tidak bisa memblokir diri sendiri.');
  const ref = await addDoc(collection(db, 'user_blocks'), {
    blocker_id: blockerId,
    blocked_id: blockedId,
    reason,
    created_at: serverTimestamp(),
    reviewed_by_admin: false,
    admin_decision: null,
  });
  return ref.id;
}

// Hapus blokir (hanya blocker sendiri yang bisa menghapus).
export async function unblockUser(blockId: string): Promise<void> {
  await deleteDoc(doc(db, 'user_blocks', blockId));
}

// Semua user yang diblokir oleh userId (efektif — bukan yang sudah dibatalkan admin).
export async function getBlockList(userId: string): Promise<UserBlock[]> {
  const snap = await getDocs(query(
    collection(db, 'user_blocks'),
    where('blocker_id', '==', userId),
  ));
  return snap.docs
    .map(d => toUserBlock(d.id, d.data() as Record<string, unknown>))
    .filter(b => b.admin_decision !== 'reversed');
}

// Semua blokir yang belum ditinjau admin (untuk halaman /admin).
// Tidak ada orderBy di query (hindari index komposit) — sort waktu di JS,
// limit() hanya membatasi biaya read worst-case, bukan menjamin N terbaru.
export async function getPendingBlocks(maxCount = 50): Promise<UserBlock[]> {
  const snap = await getDocs(query(
    collection(db, 'user_blocks'),
    where('reviewed_by_admin', '==', false),
    limit(maxCount),
  ));
  return snap.docs
    .map(d => toUserBlock(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
}

// Cek apakah ada blokir efektif antara dua user (kedua arah).
export async function isBlocked(uid1: string, uid2: string): Promise<boolean> {
  const [fwd, bwd] = await Promise.all([
    getDocs(query(collection(db, 'user_blocks'), where('blocker_id', '==', uid1), where('blocked_id', '==', uid2))),
    getDocs(query(collection(db, 'user_blocks'), where('blocker_id', '==', uid2), where('blocked_id', '==', uid1))),
  ]);
  return [...fwd.docs, ...bwd.docs].some(d => d.data().admin_decision !== 'reversed');
}

// Admin: tandai sudah ditinjau (upheld = valid, reversed = dibatalkan).
export async function adminResolveBlock(
  blockId: string,
  decision: 'upheld' | 'reversed',
): Promise<void> {
  await updateDoc(doc(db, 'user_blocks', blockId), {
    reviewed_by_admin: true,
    admin_decision: decision,
  });
}
