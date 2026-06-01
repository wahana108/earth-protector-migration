import { db } from './firebase';
import {
  collection, doc, writeBatch, serverTimestamp,
  getDocs, getDoc, query, where, updateDoc, runTransaction,
  setDoc, increment, arrayUnion, Timestamp,
} from 'firebase/firestore';
import { getCommunityConfig } from './community-config';
import { checkLinkBukti } from './link-checker';
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
  fee_project_pct?: number;
};

export async function createProject(input: CreateProjectInput): Promise<string> {
  const jumlah_nft = Math.floor(input.nilai_project / input.harga_dasar);
  const nilai_selisih = input.harga_jual - input.harga_dasar;

  const link_bukti_status = await checkLinkBukti(input.link_bukti);

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
    fee_project_pct: input.fee_project_pct ?? null,
    jumlah_nft_terjual: 0,
    link_bukti_status,
    link_bukti_last_checked: serverTimestamp(),
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

// ─── Level Check ─────────────────────────────────────────────────────────────

// Evaluasi syarat Top Developer dan update level jika berubah.
// Dipanggil setelah buyNftUnit (soldNfts +1) dan buybackNftUnit (buybackCount +1).
export async function checkAndUpdateDeveloperLevel(userId: string): Promise<void> {
  const poolRef = doc(db, 'pool_rekomendasi', 'v1');

  const [config, userSnap, poolSnap] = await Promise.all([
    getCommunityConfig(),
    getDoc(doc(db, 'users', userId)),
    getDoc(poolRef),
  ]);
  if (!config || !userSnap.exists()) return;

  const userData = userSnap.data();
  const soldNfts: number = (userData.soldNfts as number) ?? 0;
  const buybackCount: number = (userData.buybackCount as number) ?? 0;
  const currentLevel: string = (userData.level as string) ?? 'developer_biasa';

  const meetsMinSold = soldNfts >= config.minimum_soldNfts_top_developer;
  const meetsBuybackRate =
    soldNfts >= 1 &&
    Math.floor((buybackCount / soldNfts) * 100) >= config.minimum_buyback_pct;

  const newLevel = meetsMinSold && meetsBuybackRate ? 'top_developer' : 'developer_biasa';

  if (currentLevel === newLevel) return;

  // Hitung kapasitas pool baru berdasarkan perubahan jumlah top developer
  const currentTopCount: number = poolSnap.exists()
    ? ((poolSnap.data().jumlah_top_developer as number) ?? 0)
    : 0;
  const levelDelta = newLevel === 'top_developer' ? 1 : -1;
  const newTopCount = Math.max(0, currentTopCount + levelDelta);
  const newKapasitas = newTopCount * 3;
  const newIsAktif = newKapasitas >= config.kapasitas_pool_minimum;

  const batch = writeBatch(db);

  batch.update(doc(db, 'users', userId), { level: newLevel });

  // Sync pool metadata
  batch.set(poolRef, {
    jumlah_top_developer: newTopCount,
    kapasitas_aktif: newKapasitas,
    is_aktif: newIsAktif,
  }, { merge: true });

  // Downgrade: semua project developer ditandai daftar_invalidasi = true
  if (currentLevel === 'top_developer' && newLevel === 'developer_biasa') {
    const projectsSnap = await getDocs(
      query(collection(db, 'projects'), where('developer_id', '==', userId)),
    );
    projectsSnap.docs.forEach(d => batch.update(d.ref, { daftar_invalidasi: true }));
  }

  // Log perubahan level di neraca_log
  batch.set(doc(collection(db, 'users', userId, 'neraca_log')), {
    type: 'level_change',
    nft_unit_id: '',
    nama_nft: `Level ${currentLevel} → ${newLevel}`,
    harga_transaksi: 0,
    nilai_selisih: 0,
    delta: 0,
    counterparty_id: '',
    timestamp: serverTimestamp(),
  });

  await batch.commit();
}

// Beli NFT — satu Firestore transaction yang mengupdate semua dokumen terkait atomik
export async function buyNftUnit(
  nftUnitId: string,
  buyerId: string,
  harga_dasar: number,
  batas_atas: number,
): Promise<void> {
  const nftRef = doc(db, 'nft_units', nftUnitId);
  const poolRef = doc(db, 'pool_rekomendasi', 'v1');
  let developerIdCapture = '';
  let isPoolPurchaseCapture = false;
  let nftStatusCapture: string = '';
  let projectIdCapture = '';
  let hargaJualCapture = 0;

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
    // Selalu cek level developer asli NFT — soldNfts milik developer_id
    developerIdCapture = nft.developer_id as string;
    const harga_jual = nft.harga_jual as number;
    const nilai_selisih = nft.nilai_selisih as number;
    const nama_nft = nft.nama_nft as string;
    const project_id = nft.project_id as string;
    const isPoolPurchase = (nft.in_pool as boolean) ?? false;
    isPoolPurchaseCapture = isPoolPurchase;
    nftStatusCapture = (nft.status as string) ?? 'biasa';
    projectIdCapture = project_id;
    hargaJualCapture = harga_jual;

    const sellerRef = doc(db, 'users', sellerId);
    const buyerRef = doc(db, 'users', buyerId);
    const projectRef = doc(db, 'projects', project_id);

    const sellerSnap = await tx.get(sellerRef);
    const buyerSnap = await tx.get(buyerRef);
    const projectSnap = await tx.get(projectRef);

    if (!sellerSnap.exists()) throw new BuyError('Data penjual tidak ditemukan.');
    if (!buyerSnap.exists()) throw new BuyError('Data pembeli tidak ditemukan.');

    const sellerPoin: number = sellerSnap.data().total_poin ?? 0;
    const buyerPoin: number = buyerSnap.data().total_poin ?? 0;
    const buyerBuybackCount: number = buyerSnap.data().buybackCount ?? 0;
    const sellerSoldNfts: number = sellerSnap.data().soldNfts ?? 0;
    const link_bukti = projectSnap.exists()
      ? (projectSnap.data().link_bukti as string) ?? ''
      : '';

    // ── Semua write setelah semua read selesai ─────────────────────────────

    // 4. Update nft_unit — pindah kepemilikan; keluarkan dari pool jika beli_pool
    tx.update(nftRef, {
      owner_id: buyerId,
      for_sale: false,
      harga_beli_terakhir: harga_jual,
      ...(isPoolPurchase ? { in_pool: false } : {}),
    });

    // 5. Neraca penjual: -= nilai_selisih (PENJUAL selalu minus atau nol)
    tx.update(sellerRef, {
      total_poin: sellerPoin - nilai_selisih,
      soldNfts: sellerSoldNfts + 1,
    });

    // 6. Neraca pembeli: += nilai_selisih; beli_pool juga tambah buybackCount
    tx.update(buyerRef, {
      total_poin: buyerPoin + nilai_selisih,
      ...(isPoolPurchase ? { buybackCount: buyerBuybackCount + 1 } : {}),
    });

    // 7. Pool rekomendasi: kurangi counter NFT saat terbeli dari pool
    if (isPoolPurchase) {
      tx.update(poolRef, { jumlah_nft_valid: increment(-1) });
    }

    // 8. Log neraca penjual (immutable)
    tx.set(doc(collection(db, 'users', sellerId, 'neraca_log')), {
      type: 'jual',
      nft_unit_id: nftUnitId,
      nama_nft,
      harga_transaksi: harga_jual,
      nilai_selisih,
      delta: -nilai_selisih,
      counterparty_id: buyerId,
      project_id,
      link_bukti,
      timestamp: serverTimestamp(),
    });

    // 9. Log neraca pembeli — tipe berbeda untuk pembelian dari pool
    tx.set(doc(collection(db, 'users', buyerId, 'neraca_log')), {
      type: isPoolPurchase ? 'beli_pool' : 'beli',
      nft_unit_id: nftUnitId,
      nama_nft,
      harga_transaksi: harga_jual,
      nilai_selisih,
      delta: nilai_selisih,
      counterparty_id: sellerId,
      project_id,
      link_bukti,
      timestamp: serverTimestamp(),
    });

    // 10. History kepemilikan nft_unit (immutable)
    tx.set(doc(collection(db, 'nft_units', nftUnitId, 'history_kepemilikan')), {
      dari: sellerId,
      ke: buyerId,
      harga: harga_jual,
      timestamp: serverTimestamp(),
    });
  });

  // Cek dan update level developer asli NFT setelah soldNfts bertambah (non-critical)
  if (developerIdCapture) {
    try { await checkAndUpdateDeveloperLevel(developerIdCapture); } catch { /* silent */ }
  }
  // Beli dari pool: cek juga level buyer karena buybackCount bertambah (non-critical)
  if (isPoolPurchaseCapture) {
    try { await checkAndUpdateDeveloperLevel(buyerId); } catch { /* silent */ }
  }
  // Fee sharing: trigger jika NFT berstatus valid (non-critical)
  if (nftStatusCapture === 'valid' && projectIdCapture) {
    try { await maybeTriggerFee(projectIdCapture, hargaJualCapture); } catch { /* silent */ }
  }
}

// ─── Buyback ──────────────────────────────────────────────────────────────────

export class BuybackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BuybackError';
  }
}

// Kembalikan NFT dari pemilik ke developer asalnya.
// Neraca developer += nilai_selisih, neraca pemilik -= nilai_selisih.
export async function buybackNftUnit(
  nftUnitId: string,
  ownerId: string,
): Promise<void> {
  const nftRef = doc(db, 'nft_units', nftUnitId);
  let developerIdCapture = '';

  await runTransaction(db, async (tx) => {
    // ── Semua read sebelum write ───────────────────────────────────────────
    const nftSnap = await tx.get(nftRef);
    if (!nftSnap.exists()) throw new BuybackError('NFT tidak ditemukan.');

    const nft = nftSnap.data();
    if (nft.owner_id !== ownerId) throw new BuybackError('Kamu bukan pemilik NFT ini.');
    if (nft.developer_id === ownerId) throw new BuybackError('NFT masih berada di tangan developer.');
    if (nft.digunakan_validasi) throw new BuybackError('NFT sedang digunakan validasi.');

    const developerId = nft.developer_id as string;
    developerIdCapture = developerId;
    const nilai_selisih = nft.nilai_selisih as number;
    const nama_nft = nft.nama_nft as string;
    const project_id = nft.project_id as string;
    const harga_beli_terakhir = nft.harga_beli_terakhir as number;

    const developerRef = doc(db, 'users', developerId);
    const ownerRef = doc(db, 'users', ownerId);
    const projectRef = doc(db, 'projects', project_id);

    const developerSnap = await tx.get(developerRef);
    const ownerSnap = await tx.get(ownerRef);
    const projectSnap = await tx.get(projectRef);

    if (!developerSnap.exists()) throw new BuybackError('Data developer tidak ditemukan.');
    if (!ownerSnap.exists()) throw new BuybackError('Data pemilik tidak ditemukan.');

    const developerPoin: number = (developerSnap.data().total_poin as number) ?? 0;
    const ownerPoin: number = (ownerSnap.data().total_poin as number) ?? 0;
    const developerBuybackCount: number = (developerSnap.data().buybackCount as number) ?? 0;
    const link_bukti = projectSnap.exists()
      ? (projectSnap.data().link_bukti as string) ?? ''
      : '';

    // ── Semua write setelah semua read selesai ─────────────────────────────

    // 1. NFT kembali ke developer, tidak dijual
    tx.update(nftRef, {
      owner_id: developerId,
      for_sale: false,
    });

    // 2. Neraca developer: +nilai_selisih, buybackCount +1
    tx.update(developerRef, {
      total_poin: developerPoin + nilai_selisih,
      buybackCount: developerBuybackCount + 1,
    });

    // 3. Neraca pemilik: -nilai_selisih
    tx.update(ownerRef, {
      total_poin: ownerPoin - nilai_selisih,
    });

    // 4. Log neraca developer (immutable)
    tx.set(doc(collection(db, 'users', developerId, 'neraca_log')), {
      type: 'buyback',
      nft_unit_id: nftUnitId,
      nama_nft,
      harga_transaksi: harga_beli_terakhir,
      nilai_selisih,
      delta: nilai_selisih,
      counterparty_id: ownerId,
      project_id,
      link_bukti,
      timestamp: serverTimestamp(),
    });

    // 5. Log neraca pemilik (immutable)
    tx.set(doc(collection(db, 'users', ownerId, 'neraca_log')), {
      type: 'buyback',
      nft_unit_id: nftUnitId,
      nama_nft,
      harga_transaksi: harga_beli_terakhir,
      nilai_selisih,
      delta: -nilai_selisih,
      counterparty_id: developerId,
      project_id,
      link_bukti,
      timestamp: serverTimestamp(),
    });
  });

  // Cek dan update level developer setelah buybackCount bertambah (non-critical)
  if (developerIdCapture) {
    try { await checkAndUpdateDeveloperLevel(developerIdCapture); } catch { /* silent */ }
  }
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

// ─── Transfer ke Pool ─────────────────────────────────────────────────────────

export class TransferPoolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransferPoolError';
  }
}

// Pindahkan NFT milik top developer ke pool rekomendasi komunitas.
// Hanya bisa dilakukan oleh top_developer yang adalah owner atau developer_id NFT.
export async function transferToPool(nftUnitId: string, userId: string): Promise<void> {
  const nftSnap = await getDoc(doc(db, 'nft_units', nftUnitId));
  if (!nftSnap.exists()) throw new TransferPoolError('NFT tidak ditemukan.');

  const nft = nftSnap.data();
  const isOwnerOrDeveloper =
    nft.owner_id === userId || nft.developer_id === userId;
  if (!isOwnerOrDeveloper) throw new TransferPoolError('Kamu bukan owner atau developer NFT ini.');
  if (nft.digunakan_validasi) throw new TransferPoolError('NFT sedang digunakan validasi.');
  if (nft.in_pool) throw new TransferPoolError('NFT sudah berada di pool rekomendasi.');

  // Cek level user
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) throw new TransferPoolError('Data user tidak ditemukan.');
  if ((userSnap.data().level as string) !== 'top_developer') {
    throw new TransferPoolError('Hanya Top Developer yang bisa transfer ke pool.');
  }

  const nama_nft = nft.nama_nft as string;
  const project_id = nft.project_id as string;
  const poolRef = doc(db, 'pool_rekomendasi', 'v1');

  const batch = writeBatch(db);

  // Update nft_unit: masuk pool, otomatis dijual, catat waktu masuk
  batch.update(doc(db, 'nft_units', nftUnitId), {
    in_pool: true,
    for_sale: true,
    transferred_at: serverTimestamp(),
  });

  // Update pool_rekomendasi metadata (upsert — setDoc merge:true creates doc if missing)
  batch.set(poolRef, {
    is_aktif: false,
    jumlah_top_developer: 0,
    kapasitas_aktif: 0,
    total_jaminan: 0,
    jumlah_nft_valid: increment(1),
  }, { merge: true });

  // Log di neraca_log
  batch.set(doc(collection(db, 'users', userId, 'neraca_log')), {
    type: 'transfer_pool',
    nft_unit_id: nftUnitId,
    nama_nft,
    harga_transaksi: (nft.harga_jual as number) ?? 0,
    nilai_selisih: 0,
    delta: 0,
    counterparty_id: '',
    project_id,
    timestamp: serverTimestamp(),
  });

  await batch.commit();
}

// ─── Validasi Bergulir ────────────────────────────────────────────────────────

export class ValidasiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidasiError';
  }
}

// Validasi project: serahkan nilai selisih NFT yang dipilih ke pool jaminan project.
// Mode pertama (pool_jaminan < nilai_project): lock NFT, simpan nilai sebelum reset.
// Mode revalidasi (pool_jaminan >= nilai_project): rotasi FIFO — validator terlama
// digantikan, NFT mereka dikembalikan ke kondisi semula.
export async function validateProject(
  projectId: string,
  userId: string,
  selectedNftIds: string[],
  harga_dasar: number,
): Promise<void> {
  if (selectedNftIds.length === 0) throw new ValidasiError('Pilih minimal 1 NFT untuk validasi.');

  const projectRef = doc(db, 'projects', projectId);
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (tx) => {
    // ── Baca project + user + NFT baru ────────────────────────────────────
    const projectSnap = await tx.get(projectRef);
    const userSnap = await tx.get(userRef);
    const nftSnaps = await Promise.all(
      selectedNftIds.map(id => tx.get(doc(db, 'nft_units', id))),
    );

    if (!projectSnap.exists()) throw new ValidasiError('Project tidak ditemukan.');
    if (!userSnap.exists()) throw new ValidasiError('Data user tidak ditemukan.');

    const projectData = projectSnap.data();
    const isRevalidasi =
      (projectData.pool_jaminan as number) >= (projectData.nilai_project as number);

    // Validasi eligibility setiap NFT baru
    for (const snap of nftSnaps) {
      if (!snap.exists()) throw new ValidasiError('NFT tidak ditemukan.');
      const nft = snap.data();
      if (nft.owner_id !== userId) throw new ValidasiError(`NFT ${nft.nama_nft} bukan milikmu.`);
      if (nft.for_sale) throw new ValidasiError(`NFT ${nft.nama_nft} sedang dalam status dijual.`);
      if (nft.digunakan_validasi) throw new ValidasiError(`NFT ${nft.nama_nft} sudah dipakai validasi.`);
      if (nft.pernah_digunakan_validasi) throw new ValidasiError(`NFT ${nft.nama_nft} sudah pernah digunakan validasi sebelumnya.`);
      if ((nft.nilai_selisih as number) <= 0) throw new ValidasiError(`NFT ${nft.nama_nft} tidak memiliki nilai selisih.`);
    }

    // ── Jika revalidasi: baca validator lama yang akan dirotasi ───────────
    type RawValidatorEntry = { user_id: string; nft_unit_id: string; nilai: number; timestamp: unknown };
    const rawValidatorList =
      (projectData.validator_list as RawValidatorEntry[]) ?? [];

    // Urutkan FIFO (timestamp terlama dulu)
    const sortedValidators = [...rawValidatorList].sort((a, b) => {
      const toMs = (ts: unknown): number => {
        if (ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function')
          return (ts as { toMillis: () => number }).toMillis();
        if (ts instanceof Date) return ts.getTime();
        return 0;
      };
      return toMs(a.timestamp) - toMs(b.timestamp);
    });

    // Ambil N entry terlama (N = jumlah NFT baru)
    const oldEntries = isRevalidasi
      ? sortedValidators.slice(0, selectedNftIds.length)
      : [];

    // Baca dokumen NFT lama dan user lama (dalam transaction)
    const oldNftSnapMap = new Map<string, Awaited<ReturnType<typeof tx.get>>>();
    const oldUserSnapMap = new Map<string, Awaited<ReturnType<typeof tx.get>>>();

    if (oldEntries.length > 0) {
      const oldNftReads = await Promise.all(
        oldEntries.map(e => tx.get(doc(db, 'nft_units', e.nft_unit_id))),
      );
      oldNftReads.forEach((snap, i) => oldNftSnapMap.set(oldEntries[i].nft_unit_id, snap));

      const uniqueOldUserIds = [...new Set(oldEntries.map(e => e.user_id))];
      const oldUserReads = await Promise.all(
        uniqueOldUserIds.map(uid => tx.get(doc(db, 'users', uid))),
      );
      oldUserReads.forEach((snap, i) => oldUserSnapMap.set(uniqueOldUserIds[i], snap));
    }

    // ── Hitung total nilai NFT baru ───────────────────────────────────────
    const totalSelisih = nftSnaps.reduce(
      (sum, snap) => sum + ((snap.data()!.nilai_selisih as number) ?? 0),
      0,
    );
    const now = Timestamp.now();

    // ── WRITES ────────────────────────────────────────────────────────────

    if (isRevalidasi) {
      // Rotasi keluar: restore NFT lama, hapus dari validator_aktif user lama
      for (const oldEntry of oldEntries) {
        const oldNftSnap = oldNftSnapMap.get(oldEntry.nft_unit_id);
        if (!oldNftSnap?.exists()) continue;
        const oldNft = oldNftSnap.data() as Record<string, unknown>;

        tx.update(oldNftSnap.ref, {
          harga_beli_terakhir: (oldNft.harga_beli_sebelum_validasi as number) ?? (oldNft.harga_beli_terakhir as number),
          nilai_selisih: (oldNft.nilai_selisih_sebelum_validasi as number) ?? 0,
          digunakan_validasi: false,
          project_validasi_id: null,
          pernah_digunakan_validasi: true,
          harga_beli_sebelum_validasi: null,
          nilai_selisih_sebelum_validasi: null,
        });

        const oldUserSnap = oldUserSnapMap.get(oldEntry.user_id);
        if (oldUserSnap?.exists()) {
          type ValidatorAktifEntry = { project_id: string; nft_unit_ids: string[]; nilai_total: number; fee_diterima: number };
          const oldValidatorAktif =
            ((oldUserSnap.data() as Record<string, unknown>).validator_aktif as ValidatorAktifEntry[]) ?? [];
          const updatedValidatorAktif = oldValidatorAktif.filter(
            v => !(v.project_id === projectId && v.nft_unit_ids.includes(oldEntry.nft_unit_id)),
          );
          tx.update(oldUserSnap.ref, { validator_aktif: updatedValidatorAktif });

          tx.set(doc(collection(db, 'users', oldEntry.user_id, 'neraca_log')), {
            type: 'revalidasi_keluar',
            nft_unit_id: oldEntry.nft_unit_id,
            nama_nft: (oldNft.nama_nft as string) ?? '',
            harga_transaksi: 0,
            nilai_selisih: 0,
            delta: 0,
            counterparty_id: userId,
            project_id: projectId,
            keterangan: 'digantikan validator baru, NFT dikembalikan',
            timestamp: now,
          });
        }
      }

      // Lock NFT baru (simpan nilai sebelum reset), log revalidasi_masuk
      for (const snap of nftSnaps) {
        const nft = snap.data()!;
        const nilai = nft.nilai_selisih as number;
        const hargaBeli = nft.harga_beli_terakhir as number;
        const nama_nft = nft.nama_nft as string;

        tx.update(snap.ref, {
          harga_beli_sebelum_validasi: hargaBeli,
          nilai_selisih_sebelum_validasi: nilai,
          digunakan_validasi: true,
          project_validasi_id: projectId,
          harga_beli_terakhir: harga_dasar,
          nilai_selisih: 0,
          for_sale: false,
        });

        tx.set(doc(collection(db, 'users', userId, 'neraca_log')), {
          type: 'revalidasi_masuk',
          nft_unit_id: snap.id,
          nama_nft,
          harga_transaksi: harga_dasar,
          nilai_selisih: nilai,
          delta: -nilai,
          counterparty_id: projectId,
          project_id: projectId,
          timestamp: now,
        });
      }

      // Update project: ganti validator_list secara langsung (bukan arrayUnion)
      const oldNftIds = new Set(oldEntries.map(e => e.nft_unit_id));
      const keptValidators = rawValidatorList.filter(v => !oldNftIds.has(v.nft_unit_id));
      const newValidatorEntries = nftSnaps.map(snap => ({
        user_id: userId,
        nft_unit_id: snap.id,
        nilai: snap.data()!.nilai_selisih as number,
        timestamp: now,
      }));

      tx.update(projectRef, {
        pool_jaminan: increment(totalSelisih),
        // jumlah_validator tidak berubah: N keluar, N masuk = net 0
        validator_list: [...keptValidators, ...newValidatorEntries],
      });

    } else {
      // Validasi pertama kali: simpan nilai sebelum reset, log 'validasi'
      for (const snap of nftSnaps) {
        const nft = snap.data()!;
        const nilai = nft.nilai_selisih as number;
        const hargaBeli = nft.harga_beli_terakhir as number;
        const nama_nft = nft.nama_nft as string;

        tx.update(snap.ref, {
          harga_beli_sebelum_validasi: hargaBeli,
          nilai_selisih_sebelum_validasi: nilai,
          digunakan_validasi: true,
          project_validasi_id: projectId,
          harga_beli_terakhir: harga_dasar,
          nilai_selisih: 0,
          for_sale: false,
        });

        tx.set(doc(collection(db, 'users', userId, 'neraca_log')), {
          type: 'validasi',
          nft_unit_id: snap.id,
          nama_nft,
          harga_transaksi: harga_dasar,
          nilai_selisih: nilai,
          delta: -nilai,
          counterparty_id: projectId,
          project_id: projectId,
          timestamp: now,
        });
      }

      const newValidatorEntries = nftSnaps.map(snap => ({
        user_id: userId,
        nft_unit_id: snap.id,
        nilai: snap.data()!.nilai_selisih as number,
        timestamp: now,
      }));

      tx.update(projectRef, {
        pool_jaminan: increment(totalSelisih),
        jumlah_validator: increment(nftSnaps.length),
        validator_list: arrayUnion(...newValidatorEntries),
      });
    }

    // Update user baru: catat partisipasi validasi (sama di kedua mode)
    tx.update(userRef, {
      validator_aktif: arrayUnion({
        project_id: projectId,
        nft_unit_ids: selectedNftIds,
        nilai_total: totalSelisih,
        fee_diterima: 0,
      }),
    });
  });
}

// ─── FIFO Skip ────────────────────────────────────────────────────────────────

export class SkipFifoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkipFifoError';
  }
}

// Catat bahwa top developer melewati NFT teratas antrian FIFO.
// NFT tetap di posisi teratas (tidak digeser) — keluar hanya setelah terbeli.
export async function skipFifoNft(
  nftUnitId: string,
  userId: string,
  alasan: string,
  detail: string,
): Promise<void> {
  const [userSnap, nftSnap] = await Promise.all([
    getDoc(doc(db, 'users', userId)),
    getDoc(doc(db, 'nft_units', nftUnitId)),
  ]);

  if (!userSnap.exists()) throw new SkipFifoError('Data user tidak ditemukan.');
  if ((userSnap.data().level as string) !== 'top_developer') {
    throw new SkipFifoError('Hanya Top Developer yang bisa melewati antrian FIFO.');
  }
  if (!nftSnap.exists()) throw new SkipFifoError('NFT tidak ditemukan.');
  if (!nftSnap.data().in_pool) throw new SkipFifoError('NFT ini tidak berada dalam pool.');

  const nama_nft = nftSnap.data().nama_nft as string;
  const project_id = nftSnap.data().project_id as string;
  const owner_id = nftSnap.data().owner_id as string;

  const batch = writeBatch(db);

  // transferred_at di-reset ke sekarang agar NFT geser ke belakang antrian FIFO
  batch.update(doc(db, 'nft_units', nftUnitId), {
    fifo_skip_count: increment(1),
    last_skipped_by: userId,
    last_skip_reason: alasan,
    transferred_at: serverTimestamp(),
  });

  batch.set(doc(collection(db, 'users', userId, 'neraca_log')), {
    type: 'lewati_fifo',
    nft_unit_id: nftUnitId,
    nama_nft,
    harga_transaksi: 0,
    nilai_selisih: 0,
    delta: 0,
    counterparty_id: owner_id,
    project_id,
    alasan,
    detail,
    timestamp: serverTimestamp(),
  });

  await batch.commit();
}

// ─── Fee Sharing ─────────────────────────────────────────────────────────────

// Dipanggil setelah beli NFT valid. Increment jumlah_nft_terjual project,
// dan jika sudah kelipatan fee_trigger_per_nft distribusikan fee ke validator.
export async function maybeTriggerFee(projectId: string, hargaJual: number): Promise<void> {
  const config = await getCommunityConfig();
  if (!config) return;

  const projectRef = doc(db, 'projects', projectId);

  // Atomik: baca counter, increment, cek modulo
  let shouldDistribute = false;
  let projectData: Record<string, unknown> | null = null;

  await runTransaction(db, async (tx) => {
    const projectSnap = await tx.get(projectRef);
    if (!projectSnap.exists()) return;
    const p = projectSnap.data();
    const newTerjual = ((p.jumlah_nft_terjual as number) ?? 0) + 1;
    shouldDistribute = config.fee_trigger_per_nft > 0 && newTerjual % config.fee_trigger_per_nft === 0;
    projectData = p;
    tx.update(projectRef, { jumlah_nft_terjual: newTerjual });
  });

  if (!shouldDistribute || !projectData) return;

  const p = projectData as Record<string, unknown>;
  const feeProjectPct: number = (p.fee_project_pct as number) ?? config.fee_project_pct.min;
  const feeTotal = hargaJual * (feeProjectPct / 100);
  const feeInfrastruktur = feeTotal * (config.fee_infrastruktur_pct / 100);
  const feeValidator = feeTotal - feeInfrastruktur;

  const developerIdFee = p.developer_id as string;
  const namaProject = (p.nama_project as string) ?? '';
  const validatorList: Array<{ user_id: string; nilai: number }> =
    (p.validator_list as Array<{ user_id: string; nilai: number }>) ?? [];

  // Baca neraca developer
  const developerRef = doc(db, 'users', developerIdFee);
  const developerSnap = await getDoc(developerRef);
  if (!developerSnap.exists()) return;
  const developerPoin: number = (developerSnap.data().total_poin as number) ?? 0;

  // Hitung total nilai validator untuk distribusi proporsional
  const totalNilai = validatorList.reduce((sum, v) => sum + (v.nilai ?? 0), 0);

  // Kumpulkan bagian per validator (gabungkan jika validator sama)
  const validatorShares = new Map<string, number>();
  if (totalNilai > 0 && feeValidator > 0) {
    for (const entry of validatorList) {
      const share = (entry.nilai / totalNilai) * feeValidator;
      validatorShares.set(entry.user_id, (validatorShares.get(entry.user_id) ?? 0) + share);
    }
  }

  // Baca semua neraca validator sebelum batch
  const validatorSnapshots = new Map<string, number>();
  await Promise.all(
    Array.from(validatorShares.keys()).map(async (vid) => {
      const vSnap = await getDoc(doc(db, 'users', vid));
      if (vSnap.exists()) {
        validatorSnapshots.set(vid, (vSnap.data().total_poin as number) ?? 0);
      }
    }),
  );

  const feePoolRef = doc(db, 'fee_pool', 'v1');
  const batch = writeBatch(db);

  // Developer neraca -= feeTotal
  batch.update(developerRef, { total_poin: developerPoin - feeTotal });
  batch.set(doc(collection(db, 'users', developerIdFee, 'neraca_log')), {
    type: 'fee_keluar',
    nft_unit_id: '',
    nama_nft: namaProject,
    harga_transaksi: hargaJual,
    nilai_selisih: 0,
    delta: -feeTotal,
    counterparty_id: projectId,
    project_id: projectId,
    timestamp: serverTimestamp(),
  });

  // fee_pool metadata
  batch.set(feePoolRef, {
    total_terkumpul: increment(feeTotal),
    total_terdistribusi: increment(feeValidator),
  }, { merge: true });

  // Setiap validator neraca += bagian proporsional
  for (const [validatorId, share] of validatorShares.entries()) {
    const currentPoin = validatorSnapshots.get(validatorId);
    if (currentPoin === undefined) continue;
    batch.update(doc(db, 'users', validatorId), { total_poin: currentPoin + share });
    batch.set(doc(collection(db, 'users', validatorId, 'neraca_log')), {
      type: 'fee_validator',
      nft_unit_id: '',
      nama_nft: namaProject,
      harga_transaksi: hargaJual,
      nilai_selisih: 0,
      delta: share,
      counterparty_id: projectId,
      project_id: projectId,
      timestamp: serverTimestamp(),
    });
  }

  await batch.commit();
}

// ─── Admin: Recalculate all developer levels ──────────────────────────────────

export type RecalcStats = {
  total: number;
  upgraded: number;
  downgraded: number;
  unchanged: number;
};

// Evaluasi ulang level semua user sesuai parameter komunitas saat ini.
// Hanya user yang levelnya perlu berubah yang ditulis ke Firestore.
// onProgress dipanggil setelah tiap user agar UI bisa menampilkan live progress.
export async function recalculateAllDeveloperLevels(
  onProgress?: (processed: number, total: number) => void,
): Promise<RecalcStats> {
  const [config, usersSnap] = await Promise.all([
    getCommunityConfig(),
    getDocs(collection(db, 'users')),
  ]);
  if (!config) throw new Error('Community config tidak ditemukan.');

  const stats: RecalcStats = {
    total: usersSnap.size,
    upgraded: 0,
    downgraded: 0,
    unchanged: 0,
  };
  let processed = 0;

  for (const userDoc of usersSnap.docs) {
    const d = userDoc.data();
    const soldNfts: number = (d.soldNfts as number) ?? 0;
    const buybackCount: number = (d.buybackCount as number) ?? 0;
    const currentLevel: string = (d.level as string) ?? 'developer_biasa';

    const meetsMinSold = soldNfts >= config.minimum_soldNfts_top_developer;
    const meetsBuybackRate =
      soldNfts >= 1 &&
      Math.floor((buybackCount / soldNfts) * 100) >= config.minimum_buyback_pct;

    const newLevel = meetsMinSold && meetsBuybackRate ? 'top_developer' : 'developer_biasa';

    if (currentLevel !== newLevel) {
      await checkAndUpdateDeveloperLevel(userDoc.id);
      if (newLevel === 'top_developer') stats.upgraded++;
      else stats.downgraded++;
    } else {
      stats.unchanged++;
    }

    processed++;
    onProgress?.(processed, stats.total);
  }

  // Sync pool metadata setelah semua level terupdate — hitung ulang dari data aktual
  const finalUsersSnap = await getDocs(collection(db, 'users'));
  const topCount = finalUsersSnap.docs.filter(
    d => (d.data().level as string) === 'top_developer',
  ).length;
  const finalKapasitas = topCount * 3;
  const finalIsAktif = finalKapasitas >= config.kapasitas_pool_minimum;

  const poolRef = doc(db, 'pool_rekomendasi', 'v1');
  await setDoc(poolRef, {
    jumlah_top_developer: topCount,
    kapasitas_aktif: finalKapasitas,
    is_aktif: finalIsAktif,
  }, { merge: true });

  return stats;
}
