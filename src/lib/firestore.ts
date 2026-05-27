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
  tree_planting: 'Tree Planting',
  ocean_cleanup: 'Ocean Cleanup',
  wildlife_protection: 'Wildlife Protection',
  renewable_energy: 'Renewable Energy',
  carbon_reduction: 'Carbon Reduction',
  ecosystem_restoration: 'Ecosystem Restoration',
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

const notDeleted = (nft: NFT) => nft.title !== '[DELETED]';

export async function fetchAllNfts(): Promise<NFT[]> {
  const q = query(collection(db, 'nfts'), where('forSale', '==', true), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data())).filter(notDeleted);
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
  return snap.docs.map(d => toNFT(d.id, d.data())).filter(notDeleted);
}

export async function fetchNftsByOwner(owner: string): Promise<NFT[]> {
  const q = query(
    collection(db, 'nfts'),
    where('owner', '==', owner),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data())).filter(notDeleted);
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
    owner: null,
    forSale: true,
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
  return snap.docs.map(d => toNFT(d.id, d.data())).filter(notDeleted);
}

export async function deleteNft(nftId: string): Promise<void> {
  await deleteDoc(doc(db, 'nfts', nftId));
}

export async function setNftRecommended(nftId: string, recommended: boolean): Promise<{ ok: boolean; error?: string }> {
  if (recommended) {
    const nftSnap = await getDoc(doc(db, 'nfts', nftId));
    if (!nftSnap.exists()) return { ok: false, error: 'NFT not found.' };
    const createdBy = nftSnap.data().createdBy as string;

    const poolSnap = await getDocs(query(collection(db, 'nfts'), where('isRecommended', '==', true)));
    if (poolSnap.docs.length >= 3) return { ok: false, error: 'Recommendation pool is full (max 3).' };
    const alreadyHas = poolSnap.docs.some(d => d.data().createdBy === createdBy);
    if (alreadyHas) return { ok: false, error: 'You already have an NFT in the recommendation pool.' };
  }
  await updateDoc(doc(db, 'nfts', nftId), { isRecommended: recommended });
  return { ok: true };
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
  const reqSnap = await getDoc(doc(db, 'buybackRequests', requestId));
  const vendorId = reqSnap.exists() ? (reqSnap.data().vendorId as string) : null;

  const batch = writeBatch(db);
  batch.update(doc(db, 'buybackRequests', requestId), { status: 'completed' });
  batch.update(doc(db, 'nfts', nftId), { owner: null, forSale: true });
  if (vendorId) {
    const vendorSnap = await getDoc(doc(db, 'users', vendorId));
    if (vendorSnap.exists()) batch.update(doc(db, 'users', vendorId), { buybackCount: increment(1) });
  }
  await batch.commit();
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

// ─── Validated NFTs ───────────────────────────────────────────────────────────

export async function fetchValidatedNfts(): Promise<NFT[]> {
  const q = query(
    collection(db, 'nfts'),
    where('isValid', '==', true),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data())).filter(notDeleted);
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export async function fetchRecommendedNfts(): Promise<NFT[]> {
  const q = query(collection(db, 'nfts'), where('isRecommended', '==', true), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => toNFT(d.id, d.data())).filter(notDeleted);
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

  const enriched = await Promise.all(
    developers.map(async (dev) => {
      const user = await fetchUserById(dev.developerId);
      return { ...dev, user: user ?? undefined };
    })
  );
  return enriched;
}

// ─── Refund (admin only) ──────────────────────────────────────────────────────

export async function refundTransaction(txId: string): Promise<void> {
  const txSnap = await getDoc(doc(db, 'transactions', txId));
  if (!txSnap.exists()) throw new Error('Transaction not found');
  const data = txSnap.data();

  const sellerRef = doc(db, 'users', data.sellerId);
  const sellerSnap = await getDoc(sellerRef);

  const batch = writeBatch(db);

  // Refund record: original seller receives NFT back
  const refundRef = doc(collection(db, 'transactions'));
  batch.set(refundRef, {
    nftId: data.nftId,
    buyerId: data.sellerId,   // original seller is now "receiving" NFT back
    sellerId: data.buyerId,   // original buyer is "returning" NFT
    proofLink: '',
    description: `Admin refund of transaction ${txId}`,
    price: 0,
    type: 'refund',
    createdAt: Timestamp.now(),
  });

  // Return NFT to original seller, put back on market
  batch.update(doc(db, 'nfts', data.nftId), {
    owner: data.sellerId,
    forSale: true,
  });

  // Reverse seller's soldNfts increment
  if (sellerSnap.exists()) {
    batch.update(sellerRef, { soldNfts: increment(-1) });
  }

  await batch.commit();
}

// ─── Top Developer recalculation (admin only) ─────────────────────────────────

function getFibonacciCap(activeUsers: number): number {
  const fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  let cap = 1;
  for (const f of fibs) {
    if (f <= activeUsers) cap = f;
    else break;
  }
  return cap;
}

export async function recalculateTopDevelopers(): Promise<{ promoted: string[]; demoted: string[] }> {
  // Fetch all source data in parallel
  const [usersSnap, nftsSnap, txsSnap, buybackSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'nfts')),
    getDocs(collection(db, 'transactions')),
    getDocs(query(collection(db, 'buybackRequests'), where('status', '==', 'completed'))),
  ]);

  type UserDoc = { id: string; soldNfts: number; buybackCount: number; isTopDeveloper: boolean };
  type NftDoc  = { id: string; createdBy: string; isValid: boolean; isRecommended: boolean; likes: number };
  type TxDoc   = { sellerId?: string; buyerId?: string; nftId?: string; type?: string };
  const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserDoc);
  const allNfts  = nftsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as NftDoc);
  const allTxs   = txsSnap.docs.map(d => d.data() as TxDoc);

  // Count completed buybacks per vendor from buybackRequests collection
  const completedBuybacksByVendor: Record<string, number> = {};
  buybackSnap.docs.forEach(d => {
    const vendorId = d.data().vendorId as string;
    if (vendorId) completedBuybacksByVendor[vendorId] = (completedBuybacksByVendor[vendorId] || 0) + 1;
  });

  // Check which buyers have purchased a recommended NFT
  const recommendedNftIds = new Set(allNfts.filter(n => n.isRecommended).map(n => n.id));
  const recPurchasesByBuyer: Record<string, number> = {};
  allTxs.forEach(tx => {
    if (tx.type === 'purchase' && tx.buyerId && tx.nftId && recommendedNftIds.has(tx.nftId)) {
      recPurchasesByBuyer[tx.buyerId] = (recPurchasesByBuyer[tx.buyerId] || 0) + 1;
    }
  });

  // ── Score calculation ─────────────────────────────────────────────────────
  const scores: Record<string, number> = {};
  allNfts.forEach(nft => {
    if (nft.createdBy) {
      scores[nft.createdBy] = (scores[nft.createdBy] || 0) + 1 + ((nft.likes || 0) * 0.5);
    }
  });
  allTxs.forEach(tx => {
    if (tx.sellerId) scores[tx.sellerId] = (scores[tx.sellerId] || 0) + 0.2;
  });

  // ── Eligibility: soldNfts≥30, buybackPct≥50%, recPurchases≥1 ─────────────
  const eligible = allUsers.filter(u => {
    const sold = u.soldNfts || 0;
    if (sold < 30) return false;
    const completedBuybacks = completedBuybacksByVendor[u.id] || 0;
    if (sold > 0 && completedBuybacks / sold < 0.5) return false;
    return (recPurchasesByBuyer[u.id] || 0) >= 1;
  });

  // ── Fibonacci cap based on total active users ─────────────────────────────
  const cap = getFibonacciCap(allUsers.length);

  // ── Top developers = eligible users ranked by score, capped ──────────────
  const ranked = eligible
    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
    .slice(0, cap);

  const newTopIds = new Set(ranked.map(u => u.id));

  // ── Batch writes ──────────────────────────────────────────────────────────
  const batch = writeBatch(db);

  // Clear old topDevelopers entries
  const oldTopSnap = await getDocs(collection(db, 'topDevelopers'));
  oldTopSnap.docs.forEach(d => batch.delete(d.ref));

  // Write new entries
  ranked.forEach(u => {
    batch.set(doc(db, 'topDevelopers', u.id), { contributionScore: scores[u.id] || 0 });
  });

  // Update users.isTopDeveloper flags
  const promoted: string[] = [];
  const demoted:  string[] = [];
  allUsers.forEach(u => {
    const wasTop = !!(u.isTopDeveloper as boolean);
    const isTop  = newTopIds.has(u.id);
    if (wasTop !== isTop) {
      batch.update(doc(db, 'users', u.id), { isTopDeveloper: isTop });
      if (isTop) promoted.push(u.id);
      else demoted.push(u.id);
    }
  });

  // ── Auto-set isRecommended: one valid NFT per top developer, max 3 ────────
  const newRecommendedIds = new Set<string>();
  for (const devUser of ranked.slice(0, 3)) {
    const devNfts = allNfts
      .filter(n => n.createdBy === devUser.id && n.isValid)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0));
    if (devNfts.length > 0) newRecommendedIds.add(devNfts[0].id);
  }

  allNfts.forEach(nft => {
    const wasRec = !!(nft.isRecommended as boolean);
    const isRec  = newRecommendedIds.has(nft.id);
    if (wasRec !== isRec) {
      batch.update(doc(db, 'nfts', nft.id), { isRecommended: isRec });
    }
  });

  await batch.commit();
  return { promoted, demoted };
}
