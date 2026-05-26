import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  increment,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { NFT, User, NFTCategory } from './types';

export const CATEGORY_LABELS: Record<NFTCategory, string> = {
  tree_planting: 'Reforestation',
  ocean_cleanup: 'Ocean Cleanup',
  wildlife_protection: 'Wildlife Conservation',
};

function toNFT(id: string, data: Record<string, any>): NFT {
  return {
    id,
    title: data.title,
    description: data.description,
    imageUrl: data.imageUrl,
    impact: data.impact,
    likes: data.likes ?? 0,
    owner: data.owner ?? null,
    createdBy: data.createdBy,
    forSale: data.forSale ?? false,
    price: data.price ?? 0,
    category: data.category as NFTCategory,
    isValid: data.isValid ?? false,
    isRecommended: data.isRecommended ?? false,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
  };
}

function toUser(id: string, data: Record<string, any>): User {
  return {
    id,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    email: data.email ?? null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt ?? Date.now()),
    totalLikes: data.totalLikes,
    soldNfts: data.soldNfts,
    buybackCount: data.buybackCount,
    isTopDeveloper: data.isTopDeveloper,
  };
}

export async function fetchAllNfts(): Promise<NFT[]> {
  const q = query(collection(db, 'nfts'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data()));
}

export async function fetchNftById(id: string): Promise<NFT | null> {
  const snap = await getDoc(doc(db, 'nfts', id));
  if (!snap.exists()) return null;
  return toNFT(snap.id, snap.data());
}

export async function fetchUserById(id: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) return null;
  return toUser(snap.id, snap.data());
}

export async function fetchNftsByCreator(createdBy: string): Promise<NFT[]> {
  const q = query(
    collection(db, 'nfts'),
    where('createdBy', '==', createdBy),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data()));
}

export async function fetchNftsByOwner(owner: string): Promise<NFT[]> {
  const q = query(
    collection(db, 'nfts'),
    where('owner', '==', owner),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data()));
}

export async function createNft(data: {
  title: string;
  description: string;
  imageUrl: string;
  impact: string;
  price: number;
  category: NFTCategory;
  createdBy: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'nfts'), {
    ...data,
    likes: 0,
    owner: data.createdBy,
    forSale: false,
    isValid: false,
    isRecommended: false,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function likeNft(nftId: string, userId: string): Promise<void> {
  const likeRef = doc(db, 'nfts', nftId, 'likes', userId);
  const likeSnap = await getDoc(likeRef);
  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(doc(db, 'nfts', nftId), { likes: increment(-1) });
  } else {
    await setDoc(likeRef, { userId, createdAt: Timestamp.now() });
    await updateDoc(doc(db, 'nfts', nftId), { likes: increment(1) });
  }
}

export async function hasUserLiked(nftId: string, userId: string): Promise<boolean> {
  const likeSnap = await getDoc(doc(db, 'nfts', nftId, 'likes', userId));
  return likeSnap.exists();
}

export async function fetchPendingNfts(): Promise<NFT[]> {
  const q = query(
    collection(db, 'nfts'),
    where('isValid', '==', false),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data()));
}

export type VoteStatus = 'approve' | 'reject';

export async function getUserVote(nftId: string, userId: string): Promise<VoteStatus | null> {
  const snap = await getDoc(doc(db, 'nfts', nftId, 'votes', userId));
  if (!snap.exists()) return null;
  return snap.data().voteStatus as VoteStatus;
}

export async function castVote(nftId: string, userId: string, voteStatus: VoteStatus): Promise<void> {
  await setDoc(doc(db, 'nfts', nftId, 'votes', userId), {
    voteStatus,
    createdAt: Timestamp.now(),
  });

  // Count votes and auto-validate if approve >= 80%
  const votesSnap = await getDocs(collection(db, 'nfts', nftId, 'votes'));
  const votes = votesSnap.docs.map(d => d.data().voteStatus as VoteStatus);
  const approvals = votes.filter(v => v === 'approve').length;
  const total = votes.length;
  if (total > 0 && approvals / total >= 0.8) {
    await updateDoc(doc(db, 'nfts', nftId), { isValid: true });
  }
}

export async function fetchVoteStats(nftId: string): Promise<{ approve: number; reject: number; total: number }> {
  const snap = await getDocs(collection(db, 'nfts', nftId, 'votes'));
  const votes = snap.docs.map(d => d.data().voteStatus as VoteStatus);
  const approve = votes.filter(v => v === 'approve').length;
  const reject = votes.filter(v => v === 'reject').length;
  return { approve, reject, total: votes.length };
}
