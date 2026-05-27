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
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { NFT, User, NFTCategory, TopDeveloper, BuybackRequest, Transaction } from './types';

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

// ─── Converters ───────────────────────────────────────────────────────────────

function toBuybackRequest(id: string, data: Record<string, any>): BuybackRequest {
  return {
    id,
    nftId: data.nftId,
    buyerId: data.buyerId,
    vendorId: data.vendorId,
    status: data.status,
    proofUrl: data.proofUrl ?? null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
  };
}

function toTransaction(id: string, data: Record<string, any>): Transaction {
  return {
    id,
    nftId: data.nftId,
    buyerId: data.buyerId,
    sellerId: data.sellerId,
    price: data.price ?? 0,
    description: data.description ?? '',
    proofLink: data.proofLink ?? '',
    type: data.type as 'purchase' | 'buyback',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
  };
}

// ─── BuybackRequest ───────────────────────────────────────────────────────────

export async function fetchBuybackRequestsByVendor(vendorId: string): Promise<BuybackRequest[]> {
  const q = query(collection(db, 'buybackRequests'), where('vendorId', '==', vendorId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => toBuybackRequest(d.id, d.data()));
}

export async function fetchBuybackRequestsByBuyer(buyerId: string): Promise<BuybackRequest[]> {
  const q = query(collection(db, 'buybackRequests'), where('buyerId', '==', buyerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => toBuybackRequest(d.id, d.data()));
}

export async function createBuybackRequest(nftId: string, vendorId: string, buyerId: string): Promise<string> {
  const ref = await addDoc(collection(db, 'buybackRequests'), {
    nftId, vendorId, buyerId,
    status: 'pending',
    proofUrl: null,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function confirmBuybackRequest(requestId: string, proofUrl: string): Promise<void> {
  await updateDoc(doc(db, 'buybackRequests', requestId), { status: 'confirmed', proofUrl });
}

export async function rejectBuybackRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'buybackRequests', requestId), { status: 'rejected' });
}

export async function completeBuybackRequest(requestId: string, nftId: string): Promise<void> {
  await updateDoc(doc(db, 'buybackRequests', requestId), { status: 'completed' });
  await updateDoc(doc(db, 'nfts', nftId), { owner: null, forSale: true });
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

export async function buyNft(
  nftId: string,
  buyerId: string,
  sellerId: string,
  proofLink: string,
  description: string
): Promise<void> {
  // Pre-flight: batch.update fails with NOT_FOUND if the seller doc doesn't
  // exist yet (e.g. new user whose doc creation lost a race with onAuthStateChanged).
  const sellerRef = doc(db, 'users', sellerId);
  const sellerSnap = await getDoc(sellerRef);

  const batch = writeBatch(db);

  const txRef = doc(collection(db, 'transactions'));
  batch.set(txRef, {
    nftId,
    buyerId,
    sellerId,
    proofLink,
    description,
    price: 0,
    type: 'purchase',
    createdAt: Timestamp.now(),
  });

  batch.update(doc(db, 'nfts', nftId), { owner: buyerId, forSale: false });

  if (sellerSnap.exists()) {
    batch.update(sellerRef, { soldNfts: increment(1) });
  }
  // If seller doc doesn't exist the buy still completes; their soldNfts
  // counter will be initialised to 0 when they next log in.

  await batch.commit();
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function fetchTransactionsByUser(userId: string): Promise<Transaction[]> {
  const [asB, asS] = await Promise.all([
    getDocs(query(collection(db, 'transactions'), where('buyerId', '==', userId), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'transactions'), where('sellerId', '==', userId), orderBy('createdAt', 'desc'))),
  ]);
  const seen = new Set<string>();
  const all: Transaction[] = [];
  for (const snap of [asB, asS]) {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) { seen.add(d.id); all.push(toTransaction(d.id, d.data())); }
    }
  }
  return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export async function fetchRecommendedNfts(): Promise<NFT[]> {
  const q = query(collection(db, 'nfts'), where('isRecommended', '==', true), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data()));
}

// ─── User profile ─────────────────────────────────────────────────────────────

export async function updateUserDisplayName(userId: string, displayName: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { displayName });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function createReport(transactionId: string, userId: string, reason: string): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    transactionId,
    userId,
    reason,
    createdAt: Timestamp.now(),
  });
}

// ─── Top Developers ───────────────────────────────────────────────────────────

export async function fetchTopDevelopers(maxResults = 20): Promise<TopDeveloper[]> {
  const q = query(
    collection(db, 'topDevelopers'),
    orderBy('contributionScore', 'desc'),
    limit(maxResults)
  );
  const snap = await getDocs(q);
  const developers: TopDeveloper[] = snap.docs.map(d => ({
    developerId: d.id,
    contributionScore: d.data().contributionScore ?? 0,
  }));

  // Enrich with user profiles
  const enriched = await Promise.all(
    developers.map(async (dev) => {
      const user = await fetchUserById(dev.developerId);
      return { ...dev, user: user ?? undefined };
    })
  );
  return enriched;
}
