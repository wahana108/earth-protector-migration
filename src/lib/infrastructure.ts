import { db } from './firebase';
import {
  collection, doc, writeBatch, serverTimestamp, getDoc, getDocs,
  query, where, orderBy, limit, Timestamp, increment,
} from 'firebase/firestore';
import { getCommunityConfig } from './community-config';
import type { ContributorCertificate } from './types';

export type InfrastructureFundStatus = {
  total_terkumpul: number;
  total_terdistribusi: number;
  total_digunakan: number;
  sisa: number;
  sertifikat_aktif_id: string | null;
  total_sertifikat_diterbitkan: number;
  cukup_untuk: number;
  harga_dasar: number;
};

export async function getInfrastructureFundStatus(): Promise<InfrastructureFundStatus | null> {
  const [snap, config] = await Promise.all([
    getDoc(doc(db, 'fee_pool', 'v1')),
    getCommunityConfig(),
  ]);
  if (!snap.exists() || !config) return null;

  const data = snap.data();
  const total_terkumpul = (data.total_terkumpul as number) ?? 0;
  const total_terdistribusi = (data.total_terdistribusi as number) ?? 0;
  const total_digunakan = (data.total_digunakan as number) ?? 0;
  const sisa = total_terkumpul - total_terdistribusi - total_digunakan;
  const sertifikat_aktif_id = (data.sertifikat_aktif_id as string | null) ?? null;
  const total_sertifikat_diterbitkan = (data.total_sertifikat_diterbitkan as number) ?? 0;
  const cukup_untuk = sisa >= config.harga_dasar ? Math.floor(sisa / config.harga_dasar) : 0;

  return {
    total_terkumpul,
    total_terdistribusi,
    total_digunakan,
    sisa,
    sertifikat_aktif_id,
    total_sertifikat_diterbitkan,
    cukup_untuk,
    harga_dasar: config.harga_dasar,
  };
}

// Cek fee_pool, terbitkan satu Infrastructure Certificate jika sisa >= harga_dasar
// dan belum ada sertifikat aktif. adminUid opsional: jika tidak diberikan, dicari
// dari community_config.super_admin_email.
export async function checkAndIssueCertificate(adminUid?: string): Promise<string | null> {
  const [feePoolSnap, config] = await Promise.all([
    getDoc(doc(db, 'fee_pool', 'v1')),
    getCommunityConfig(),
  ]);

  if (!config) return null;

  const poolData = feePoolSnap.exists() ? feePoolSnap.data() : {};
  const total_terkumpul = (poolData.total_terkumpul as number) ?? 0;
  const total_terdistribusi = (poolData.total_terdistribusi as number) ?? 0;
  const total_digunakan = (poolData.total_digunakan as number) ?? 0;
  const sisa = total_terkumpul - total_terdistribusi - total_digunakan;
  const sertifikat_aktif_id = (poolData.sertifikat_aktif_id as string | null) ?? null;
  const total_sertifikat_diterbitkan = (poolData.total_sertifikat_diterbitkan as number) ?? 0;

  if (sisa < config.harga_dasar) return null;
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
