import { db } from './firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { ProjectCategory } from './types';

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
      gambar_url: input.gambar_url,
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
