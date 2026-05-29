import { db } from './firebase';
import {
  collection, doc, writeBatch, serverTimestamp,
  getDocs, query, where, updateDoc, runTransaction,
} from 'firebase/firestore';
import type { ProjectCategory } from './types';

export class BuyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuyError';
  }
}

export type CreateProjectInput = {
  developer_id: string;
  nama_project: string;
  deskripsi_project: string;
  gambar_url: string;
  link_bukti: string;
  tanggal_tindakan: string;
  kategori: ProjectCategory;
  lokasi_tindakan: string;
  nilai_project: number;
  harga_jual: number;
  harga_dasar: number;
};

export async function createProject(input: CreateProjectInput): Promise<string> {
  const jumlah_nft = Math.floor(input.nilai_project / input.harga_dasar);
  const nilai_selisih = input.harga_jual - input.harga_dasar;

  const batch = writeBatch(db);

  const projectRef = doc(collection(db, 'projects'));
  const projectId = projectRef.id;

  batch.set(projectRef, {
    developer_id: input.developer_id,
    nama_project: input.nama_project,
    deskripsi_project: input.deskripsi_project,
    gambar_url: input.gambar_url,
    link_bukti: input.link_bukti,
    tanggal_tindakan: input.tanggal_tindakan,
    kategori: input.kategori,
    lokasi_tindakan: input.lokasi_tindakan,
    nilai_project: input.nilai_project,
    harga_jual: input.harga_jual,
    jumlah_nft,
    status_project: 'aktif',
    daftar_invalidasi: false,
    pool_jaminan: 0,
    jumlah_validator: 0,
    validator_list: [],
    like_count: 0,
    anomali_flag: false,
    created_at: serverTimestamp(),
  });

  for (let i = 0; i < jumlah_nft; i++) {
    const nftRef = doc(collection(db, 'nft_units'));
    const paddedNum = String(i + 1).padStart(3, '0');

    batch.set(nftRef, {
      project_id: projectId,
      developer_id: input.developer_id,
      owner_id: input.developer_id,
      nama_nft: `${input.nama_project} #${paddedNum}`,
      nama_project: input.nama_project,
      gambar_url: input.gambar_url,
      kategori: input.kategori,
      status: 'biasa',
      harga_jual: input.harga_jual,
      harga_beli_terakhir: input.harga_jual,
      nilai_selisih,
      for_sale: true,
      digunakan_validasi: false,
      project_validasi_id: null,
      like_count: 0,
      created_at: serverTimestamp(),
    });
  }

  await batch.commit();
  return projectId;
}

// Toggle for_sale pada nft_unit milik owner
export async function toggleForSale(nftUnitId: string, newForSale: boolean): Promise<void> {
  await updateDoc(doc(db, 'nft_units', nftUnitId), { for_sale: newForSale });
}

// Update gambar_url di project + cascade ke semua nft_units dalam project tersebut
export async function updateProjectGambar(
  projectId: string,
  gambar_url: string,
): Promise<void> {
  const projectRef = doc(db, 'projects', projectId);
  const unitsSnap = await getDocs(
    query(collection(db, 'nft_units'), where('project_id', '==', projectId)),
  );

  const batch = writeBatch(db);
  batch.update(projectRef, { gambar_url });
  unitsSnap.docs.forEach((d) => batch.update(d.ref, { gambar_url }));
  await batch.commit();
}

// Update gambar_url pada satu nft_unit saja (tanpa cascade)
export async function updateNftUnitGambar(
  nftUnitId: string,
  gambar_url: string,
): Promise<void> {
  await updateDoc(doc(db, 'nft_units', nftUnitId), { gambar_url });
}

// Beli NFT — satu Firestore transaction yang mengupdate semua dokumen terkait atomik
export async function buyNftUnit(
  nftUnitId: string,
  buyerId: string,
  harga_dasar: number,
  batas_atas: number,
): Promise<void> {
  const nftRef = doc(db, 'nft_units', nftUnitId);

  await runTransaction(db, async (tx) => {
    // ── Baca semua dokumen dulu sebelum ada write ──────────────────────────
    const nftSnap = await tx.get(nftRef);
    if (!nftSnap.exists()) throw new BuyError('NFT tidak ditemukan.');

    const nft = nftSnap.data();

    if (!nft.for_sale) throw new BuyError('NFT ini sedang tidak dijual.');
    if (nft.owner_id === buyerId) throw new BuyError('Tidak bisa membeli NFT milikmu sendiri.');
    if (nft.harga_jual < harga_dasar || nft.harga_jual > batas_atas) {
      throw new BuyError('Harga NFT di luar batas konfigurasi komunitas.');
    }

    const sellerId = nft.owner_id as string;
    const harga_jual = nft.harga_jual as number;
    const nilai_selisih = nft.nilai_selisih as number;
    const nama_nft = nft.nama_nft as string;

    const sellerRef = doc(db, 'users', sellerId);
    const buyerRef = doc(db, 'users', buyerId);

    const sellerSnap = await tx.get(sellerRef);
    const buyerSnap = await tx.get(buyerRef);

    if (!sellerSnap.exists()) throw new BuyError('Data penjual tidak ditemukan.');
    if (!buyerSnap.exists()) throw new BuyError('Data pembeli tidak ditemukan.');

    const sellerPoin: number = sellerSnap.data().total_poin ?? 0;
    const buyerPoin: number = buyerSnap.data().total_poin ?? 0;
    const sellerSoldNfts: number = sellerSnap.data().soldNfts ?? 0;

    // ── Semua write setelah semua read selesai ─────────────────────────────

    // 4. Update nft_unit — pindah kepemilikan
    tx.update(nftRef, {
      owner_id: buyerId,
      for_sale: false,
      harga_beli_terakhir: harga_jual,
    });

    // 5. Neraca penjual: -= nilai_selisih (PENJUAL selalu minus atau nol)
    tx.update(sellerRef, {
      total_poin: sellerPoin - nilai_selisih,
      soldNfts: sellerSoldNfts + 1,
    });

    // 6. Neraca pembeli: += nilai_selisih (PEMBELI selalu plus atau nol)
    tx.update(buyerRef, {
      total_poin: buyerPoin + nilai_selisih,
    });

    // 7. Log neraca penjual (immutable)
    tx.set(doc(collection(db, 'users', sellerId, 'neraca_log')), {
      type: 'jual',
      nft_unit_id: nftUnitId,
      nama_nft,
      harga_transaksi: harga_jual,
      nilai_selisih,
      delta: -nilai_selisih,
      counterparty_id: buyerId,
      timestamp: serverTimestamp(),
    });

    // 8. Log neraca pembeli (immutable)
    tx.set(doc(collection(db, 'users', buyerId, 'neraca_log')), {
      type: 'beli',
      nft_unit_id: nftUnitId,
      nama_nft,
      harga_transaksi: harga_jual,
      nilai_selisih,
      delta: nilai_selisih,
      counterparty_id: sellerId,
      timestamp: serverTimestamp(),
    });

    // 9. History kepemilikan nft_unit (immutable)
    tx.set(doc(collection(db, 'nft_units', nftUnitId, 'history_kepemilikan')), {
      dari: sellerId,
      ke: buyerId,
      harga: harga_jual,
      timestamp: serverTimestamp(),
    });
  });
}

// Toggle like pada nft_unit — atomic via transaction
export async function toggleNftLike(
  nftUnitId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<void> {
  const nftRef = doc(db, 'nft_units', nftUnitId);
  const likeRef = doc(db, 'nft_units', nftUnitId, 'likes', userId);

  await runTransaction(db, async (tx) => {
    const nftSnap = await tx.get(nftRef);
    if (!nftSnap.exists()) throw new Error('NFT unit tidak ditemukan.');
    const count: number = nftSnap.data().like_count ?? 0;

    if (currentlyLiked) {
      tx.delete(likeRef);
      tx.update(nftRef, { like_count: Math.max(0, count - 1) });
    } else {
      tx.set(likeRef, { user_id: userId, created_at: serverTimestamp() });
      tx.update(nftRef, { like_count: count + 1 });
    }
  });
}
