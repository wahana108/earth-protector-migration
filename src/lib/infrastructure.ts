import { db } from './firebase';
import {
  collection, doc, writeBatch, runTransaction, serverTimestamp,
  getDoc, getDocs, query, where, orderBy, limit, updateDoc, Timestamp, increment,
  type Transaction, type DocumentReference, type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore';
import { getCommunityConfig } from './community-config';
import type { ContributorCertificate, InfrastructureClaim, InfrastructurePayment } from './types';

export type InfrastructureFundStatus = {
  // Unified display fields — mapped dari field baru
  total_terkumpul: number;      // display: total_dari_fee + total_dari_anomali + total_dari_lain
  total_terdistribusi: number;  // audit: fee yang dibagi ke validator (field lama, dipertahankan)
  total_digunakan: number;      // display: total_dialokasikan_lencana
  sisa: number;                 // SUMBER KEBENARAN: saldo_tersedia aktif
  sertifikat_aktif_id: string | null;
  total_sertifikat_diterbitkan: number;
  cukup_untuk: number;
  harga_dasar: number;
  // Raw new fields untuk Neraca Sistem
  saldo_tersedia: number;
  total_dari_fee: number;
  total_dari_anomali: number;
  total_dari_lain: number;
  total_dialokasikan_lencana: number;
  migrated_at: Date | null;
};

export async function getInfrastructureFundStatus(): Promise<InfrastructureFundStatus | null> {
  const [snap, config] = await Promise.all([
    getDoc(doc(db, 'fee_pool', 'v1')),
    getCommunityConfig(),
  ]);
  if (!snap.exists() || !config) return null;

  const data = snap.data();

  // Field lama — dipertahankan sebagai audit trail, tidak dihapus
  const raw_total_terdistribusi = (data.total_terdistribusi as number) ?? 0;

  // Field baru — sumber kebenaran kas sistem
  const saldo_tersedia = (data.saldo_tersedia as number) ?? 0;
  const total_dari_fee = (data.total_dari_fee as number) ?? 0;
  const total_dari_anomali = (data.total_dari_anomali as number) ?? 0;
  const total_dari_lain = (data.total_dari_lain as number) ?? 0;
  const total_dialokasikan_lencana = (data.total_dialokasikan_lencana as number) ?? 0;

  const sertifikat_aktif_id = (data.sertifikat_aktif_id as string | null) ?? null;
  const total_sertifikat_diterbitkan = (data.total_sertifikat_diterbitkan as number) ?? 0;
  const cukup_untuk = saldo_tersedia >= config.harga_dasar
    ? Math.floor(saldo_tersedia / config.harga_dasar)
    : 0;

  return {
    // sisa = saldo_tersedia (sumber kebenaran) — semua cek kecukupan pakai ini
    sisa: saldo_tersedia,
    total_terkumpul: total_dari_fee + total_dari_anomali + total_dari_lain,
    total_terdistribusi: raw_total_terdistribusi,
    total_digunakan: total_dialokasikan_lencana,
    sertifikat_aktif_id,
    total_sertifikat_diterbitkan,
    cukup_untuk,
    harga_dasar: config.harga_dasar,
    saldo_tersedia,
    total_dari_fee,
    total_dari_anomali,
    total_dari_lain,
    total_dialokasikan_lencana,
    migrated_at: (data.migrated_at as Timestamp)?.toDate?.() ?? null,
  };
}

// @deprecated — Dinonaktifkan. Digantikan rewardInfrastructureContributor() yang zero-sum
// berbasis kontribusi nyata. Kode dipertahankan untuk referensi; jangan panggil dari alur aktif.
export async function checkAndIssueCertificate(adminUid?: string): Promise<string | null> {
  const [feePoolSnap, config] = await Promise.all([
    getDoc(doc(db, 'fee_pool', 'v1')),
    getCommunityConfig(),
  ]);

  if (!config) return null;

  const poolData = feePoolSnap.exists() ? feePoolSnap.data() : {};
  // Cek kecukupan dari saldo_tersedia — sumber kebenaran kas sistem
  const saldo_tersedia = (poolData.saldo_tersedia as number) ?? 0;
  const sertifikat_aktif_id = (poolData.sertifikat_aktif_id as string | null) ?? null;
  const total_sertifikat_diterbitkan = (poolData.total_sertifikat_diterbitkan as number) ?? 0;

  if (saldo_tersedia < config.harga_dasar) return null;
  if (sertifikat_aktif_id !== null) return null;

  // Lookup super admin uid jika tidak diberikan
  let superAdminUid = adminUid;
  if (!superAdminUid && config.super_admin_email) {
    const usersSnap = await getDocs(query(
      collection(db, 'users'),
      where('email', '==', config.super_admin_email),
      limit(1),
    ));
    if (!usersSnap.empty) superAdminUid = usersSnap.docs[0].id;
  }
  if (!superAdminUid) return null;

  const seq = total_sertifikat_diterbitkan + 1;
  const year = new Date().getFullYear();
  const certificate_code = `TMEP-NODE-${year}-${String(seq).padStart(4, '0')}`;

  const batch = writeBatch(db);
  const nftRef = doc(collection(db, 'nft_units'));
  const feePoolRef = doc(db, 'fee_pool', 'v1');
  const poolRef = doc(db, 'pool_rekomendasi', 'v1');

  batch.set(nftRef, {
    project_id: 'infrastructure',
    developer_id: superAdminUid,
    owner_id: superAdminUid,
    nama_nft: `Infrastructure Certificate #${seq}`,
    nama_project: 'Infrastructure Fund',
    deskripsi: 'Sertifikat kontribusi infrastruktur jaringan TMEP.',
    gambar_url: '',
    kategori: 'lainnya',
    status: 'valid',
    harga_jual: config.harga_dasar,
    harga_beli_terakhir: config.harga_dasar,
    nilai_selisih: 0,
    for_sale: true,
    in_pool: true,
    digunakan_validasi: false,
    project_validasi_id: null,
    like_count: 0,
    comment_count: 0,
    is_infrastructure: true,
    certificate_code,
    transferred_at: serverTimestamp(),
    created_at: serverTimestamp(),
  });

  batch.set(feePoolRef, {
    sertifikat_aktif_id: nftRef.id,
    total_sertifikat_diterbitkan: seq,
  }, { merge: true });

  batch.set(poolRef, {
    jumlah_nft_valid: increment(1),
  }, { merge: true });

  await batch.commit();
  return nftRef.id;
}

// Migrasi idempoten: pindahkan saldo lama (field lama) ke saldo_tersedia.
// Guard: hanya berjalan jika saldo_tersedia === 0 && old_sisa > 0 && belum migrated_at.
// Di emulator: saldo_tersedia = 4.2jt (dari anomali) → guard saldo_tersedia === 0 GAGAL
// → migrasi tidak jalan, penanda tetap ditambahkan.
export async function migrateFeePoolIfNeeded(): Promise<string> {
  const snap = await getDoc(doc(db, 'fee_pool', 'v1'));
  if (!snap.exists()) return 'fee_pool belum ada data, tidak perlu migrasi.';

  const data = snap.data();

  // Idempotency guard: jika sudah dimigrasi sebelumnya → tolak
  if (data.migrated_at) {
    return 'Sudah dimigrasi sebelumnya. Tidak ada perubahan.';
  }

  const total_terkumpul = (data.total_terkumpul as number) ?? 0;
  const total_terdistribusi = (data.total_terdistribusi as number) ?? 0;
  const total_digunakan = (data.total_digunakan as number) ?? 0;
  const saldo_tersedia = (data.saldo_tersedia as number) ?? 0;
  const old_sisa = total_terkumpul - total_terdistribusi - total_digunakan;

  const feePoolRef = doc(db, 'fee_pool', 'v1');
  const batch = writeBatch(db);

  let message: string;
  if (saldo_tersedia === 0 && old_sisa > 0) {
    // Saldo lama belum pernah masuk ke saldo_tersedia → migrasi additive
    batch.set(feePoolRef, {
      saldo_tersedia: increment(old_sisa),
      total_dari_lain: increment(old_sisa),
      migrated_at: serverTimestamp(),
    }, { merge: true });
    message = `Migrasi berhasil: Rp ${old_sisa.toLocaleString('id-ID')} dipindah ke saldo_tersedia (total_dari_lain).`;
  } else {
    // saldo_tersedia sudah ada nilai, atau old_sisa = 0 → tidak ada yang perlu dimigrasikan
    batch.set(feePoolRef, { migrated_at: serverTimestamp() }, { merge: true });
    message = `Tidak ada saldo lama yang perlu dimigrasikan (saldo_tersedia=${saldo_tersedia.toLocaleString('id-ID')}, old_sisa=${old_sisa.toLocaleString('id-ID')}). Penanda migrasi ditambahkan.`;
  }

  await batch.commit();
  return message;
}

// Cek saldo_tersedia >= nilai DI DALAM transaksi (bukan sebelumnya) — cegah race saldo
// antar dua approval/reward yang berjalan bersamaan.
async function checkSaldoTersediaTx(tx: Transaction, feePoolRef: DocumentReference, nilai: number): Promise<void> {
  const snap = await tx.get(feePoolRef);
  const saldo = snap.exists() ? ((snap.data().saldo_tersedia as number) ?? 0) : 0;

  if (saldo < nilai) {
    const fmt = (n: number) => new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
    }).format(n);
    throw new Error(`Kas sistem belum cukup (tersedia ${fmt(saldo)}, dibutuhkan ${fmt(nilai)}).`);
  }
}

// Satu sumber kebenaran untuk write zero-sum reward kontributor — dipakai baik oleh
// reward langsung admin (rewardInfrastructureContributor) maupun approve klaim
// (approveInfrastructureClaim). extraUserFields digabung ke SATU tx.update(userRef)
// agar tidak ada dua write terpisah ke dokumen user yang sama dalam satu transaksi.
function writeContributorRewardTx(
  tx: Transaction,
  refs: { feePoolRef: DocumentReference; neracaLogRef: DocumentReference; paymentRef: DocumentReference; userRef: DocumentReference },
  params: { kontributorNama: string; nilai: number; buktiLink: string; keterangan: string; adminUid: string },
  extraUserFields: Record<string, unknown> = {},
) {
  tx.set(refs.feePoolRef, {
    saldo_tersedia: increment(-params.nilai),
    total_dialokasikan_lencana: increment(params.nilai),
  }, { merge: true });

  tx.update(refs.userRef, { total_poin: increment(params.nilai), ...extraUserFields });

  tx.set(refs.neracaLogRef, {
    type: 'kontribusi_infrastruktur',
    nft_unit_id: 'system',
    nama_nft: 'Reward Kontribusi Infrastruktur',
    harga_transaksi: 0,
    nilai_selisih: params.nilai,
    delta: params.nilai,
    counterparty_id: params.adminUid,
    link_bukti: params.buktiLink,
    alasan: params.keterangan || '',
    timestamp: serverTimestamp(),
  });

  tx.set(refs.paymentRef, {
    kontributor_id: refs.userRef.id,
    kontributor_nama: params.kontributorNama,
    nilai: params.nilai,
    bukti_link: params.buktiLink,
    keterangan: params.keterangan || '',
    verified_by: params.adminUid,
    created_at: serverTimestamp(),
  });
}

// Beri reward poin ke kontributor yang sudah membayar infrastruktur nyata.
// Zero-sum: sistem -nilai, kontributor +nilai. Cek saldo sebelum eksekusi.
export async function rewardInfrastructureContributor(
  kontributorId: string,
  kontributorNama: string,
  nilai: number,
  buktiLink: string,
  keterangan: string,
  adminUid: string,
): Promise<void> {
  const feePoolRef = doc(db, 'fee_pool', 'v1');
  const neracaLogRef = doc(collection(db, 'users', kontributorId, 'neraca_log'));
  const paymentRef = doc(collection(db, 'infrastructure_payments'));
  const userRef = doc(db, 'users', kontributorId);

  await runTransaction(db, async (tx) => {
    await checkSaldoTersediaTx(tx, feePoolRef, nilai);
    writeContributorRewardTx(tx, { feePoolRef, neracaLogRef, paymentRef, userRef }, { kontributorNama, nilai, buktiLink, keterangan, adminUid });
  });
}

// Klaim kontribusi infrastruktur — user mengajukan, admin memverifikasi (approve/reject).
// Submit HANYA mencatat klaim + jejak publik (delta 0); poin & badge baru diberikan saat approve.
export async function submitInfrastructureClaim(
  userId: string,
  userNama: string,
  nilai: number,
  buktiLink: string,
  keterangan: string,
): Promise<void> {
  const claimRef = doc(collection(db, 'infrastructure_claims'));
  const neracaLogRef = doc(collection(db, 'users', userId, 'neraca_log'));

  const batch = writeBatch(db);
  batch.set(claimRef, {
    user_id: userId,
    user_nama: userNama,
    nilai,
    bukti_link: buktiLink,
    keterangan: keterangan || '',
    status: 'pending',
    created_at: serverTimestamp(),
  });
  batch.set(neracaLogRef, {
    type: 'klaim_lencana',
    nft_unit_id: 'system',
    nama_nft: 'Klaim Kontribusi Infrastruktur',
    harga_transaksi: 0,
    nilai_selisih: 0,
    delta: 0,
    counterparty_id: userId,
    link_bukti: buktiLink,
    alasan: keterangan || '',
    timestamp: serverTimestamp(),
  });
  await batch.commit();
}

export async function approveInfrastructureClaim(claimId: string, adminUid: string): Promise<void> {
  const claimRef = doc(db, 'infrastructure_claims', claimId);
  const feePoolRef = doc(db, 'fee_pool', 'v1');

  await runTransaction(db, async (tx) => {
    const claimSnap = await tx.get(claimRef);
    if (!claimSnap.exists()) throw new Error('Klaim tidak ditemukan.');

    const claim = claimSnap.data();
    if (claim.status !== 'pending') throw new Error('Klaim sudah diproses sebelumnya.');

    const kontributorId = claim.user_id as string;
    const kontributorNama = (claim.user_nama as string) ?? 'User';
    const nilai = (claim.nilai as number) ?? 0;
    const buktiLink = (claim.bukti_link as string) ?? '';
    const keterangan = (claim.keterangan as string) ?? '';

    const userRef = doc(db, 'users', kontributorId);
    const neracaLogRef = doc(collection(db, 'users', kontributorId, 'neraca_log'));
    const paymentRef = doc(collection(db, 'infrastructure_payments'));

    // Cek saldo DI DALAM transaction yang sama (bukan hasil pembacaan sebelumnya) — cegah race
    await checkSaldoTersediaTx(tx, feePoolRef, nilai);

    writeContributorRewardTx(
      tx,
      { feePoolRef, neracaLogRef, paymentRef, userRef },
      { kontributorNama, nilai, buktiLink, keterangan, adminUid },
      { badge_kontributor: true, total_kontribusi: increment(nilai) },
    );

    tx.update(claimRef, {
      status: 'approved',
      admin_uid: adminUid,
      processed_at: serverTimestamp(),
    });
  });
}

export async function rejectInfrastructureClaim(claimId: string, alasan: string, adminUid: string): Promise<void> {
  await updateDoc(doc(db, 'infrastructure_claims', claimId), {
    status: 'rejected',
    alasan_penolakan: alasan,
    admin_uid: adminUid,
    processed_at: serverTimestamp(),
  });
}

function mapInfrastructureClaim(d: QueryDocumentSnapshot<DocumentData>): InfrastructureClaim {
  const data = d.data();
  return {
    id: d.id,
    user_id: (data.user_id as string) ?? '',
    user_nama: (data.user_nama as string) ?? 'User',
    nilai: (data.nilai as number) ?? 0,
    bukti_link: (data.bukti_link as string) ?? '',
    keterangan: (data.keterangan as string) ?? '',
    status: (data.status as InfrastructureClaim['status']) ?? 'pending',
    admin_uid: data.admin_uid as string | undefined,
    alasan_penolakan: data.alasan_penolakan as string | undefined,
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
    processed_at: (data.processed_at as Timestamp)?.toDate?.() ?? null,
  };
}

// Guard "1 klaim pending per user" hanya diperiksa client-side (lihat komentar di
// firestore.rules match /infrastructure_claims — tidak ada query arbitrer di rules).
export async function getUserClaims(userId: string): Promise<InfrastructureClaim[]> {
  const snap = await getDocs(query(
    collection(db, 'infrastructure_claims'),
    where('user_id', '==', userId),
    orderBy('created_at', 'desc'),
  ));
  return snap.docs.map(mapInfrastructureClaim);
}

export async function getPendingInfrastructureClaims(): Promise<InfrastructureClaim[]> {
  const snap = await getDocs(query(
    collection(db, 'infrastructure_claims'),
    where('status', '==', 'pending'),
    orderBy('created_at', 'desc'),
  ));
  return snap.docs.map(mapInfrastructureClaim);
}

export async function getInfrastructurePayments(maxCount = 20): Promise<InfrastructurePayment[]> {
  const snap = await getDocs(query(
    collection(db, 'infrastructure_payments'),
    orderBy('created_at', 'desc'),
    limit(maxCount),
  ));

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      kontributor_id: (data.kontributor_id as string) ?? '',
      kontributor_nama: (data.kontributor_nama as string) ?? 'User',
      nilai: (data.nilai as number) ?? 0,
      bukti_link: (data.bukti_link as string) ?? '',
      keterangan: (data.keterangan as string) ?? '',
      verified_by: (data.verified_by as string) ?? '',
      created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
    };
  });
}

export async function getLatestContributorCertificates(maxCount = 20): Promise<ContributorCertificate[]> {
  const snap = await getDocs(query(
    collection(db, 'contributor_certificates'),
    orderBy('created_at', 'desc'),
    limit(maxCount),
  ));

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      user_id: data.user_id as string,
      nft_unit_id: data.nft_unit_id as string,
      certificate_code: (data.certificate_code as string) ?? '',
      nilai: (data.nilai as number) ?? 0,
      created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
      purchased_at: (data.purchased_at as Timestamp)?.toDate?.() ?? new Date(),
    };
  });
}

export async function getUserCertificates(userId: string): Promise<ContributorCertificate[]> {
  const snap = await getDocs(query(
    collection(db, 'contributor_certificates'),
    where('user_id', '==', userId),
    orderBy('purchased_at', 'desc'),
  ));

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      user_id: data.user_id as string,
      nft_unit_id: data.nft_unit_id as string,
      certificate_code: (data.certificate_code as string) ?? '',
      nilai: (data.nilai as number) ?? 0,
      created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
      purchased_at: (data.purchased_at as Timestamp)?.toDate?.() ?? new Date(),
    };
  });
}
