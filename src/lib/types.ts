export type NFTCategory =
  | 'tree_planting'
  | 'ocean_cleanup'
  | 'wildlife_protection'
  | 'renewable_energy'
  | 'carbon_reduction'
  | 'ecosystem_restoration';

export type ValidatorAktif = {
  project_id: string;
  nft_unit_ids: string[];
  nilai_total: number;
  fee_diterima: number;
};

export type User = {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  createdAt: Date;
  total_poin?: number;
  totalLikes?: number;
  soldNfts?: number;
  buybackCount?: number;
  isTopDeveloper?: boolean;
  validator_aktif?: ValidatorAktif[];
  pending_seller_actions?: number;
};

export type NFT = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  impact: string;
  likes: number;
  owner: string | null;
  createdBy: string;
  forSale: boolean;
  price: number;
  category: NFTCategory;
  isValid: boolean;
  isRecommended: boolean;
  createdAt: Date;
};

export type Transaction = {
  id: string;
  nftId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  description: string;
  proofLink: string;
  type: 'purchase' | 'buyback' | 'refund';
  createdAt: Date;
};

export type Vote = {
  userId: string;
  voteStatus: 'approve' | 'reject';
  createdAt: Date;
};

export type Like = {
  userId: string;
  createdAt: Date;
};

export type BuybackRequest = {
  id: string;
  nft_unit_id: string;
  requester_id: string;
  seller_id: string;
  nft_nama: string;
  harga_buyback: number;
  nilai_selisih: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed' | 'cancelled';
  proof_link: string | null;
  ai_confidence: number | null;
  requester_note: string | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type TopDeveloper = {
  developerId: string;
  contributionScore: number;
  user?: User;
};

export type Report = {
  id: string;
  transactionId: string;
  userId: string;
  reason: string;
  createdAt: Date;
  status: 'pending' | 'upheld' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
};

export type CommunityConfig = {
  harga_dasar: number;
  batas_atas: number;
  nilai_minimum_project: number;
  minimum_buyback_pct: number;
  fee_project_pct: { min: number; max: number };
  fee_trigger_per_nft: number;
  fee_infrastruktur_pct: number;
  minimum_top_developer: number;
  minimum_soldNfts_top_developer: number;
  kapasitas_pool_minimum: number;
  minimum_nft_pool_untuk_validasi: number;
  minimum_holding_days: number;
  fase_aktif: number;
  ai_provider: string;
  ai_anomali_threshold: { flag: number; invalid: number };
  updated_at: Date;
  updated_by: string;
};

export type FeePool = {
  total_terkumpul: number;
  total_terdistribusi: number;
  updated_at: Date;
};

export type ProjectCategory =
  | 'lingkungan'
  | 'tree_planting'
  | 'ocean_cleanup'
  | 'wildlife_protection'
  | 'ecosystem_restoration'
  | 'energi'
  | 'renewable_energy'
  | 'carbon_reduction'
  | 'sosial'
  | 'pendidikan'
  | 'kesehatan'
  | 'lainnya';

export const KATEGORI_LABELS: Record<ProjectCategory, string> = {
  lingkungan: 'Lingkungan',
  tree_planting: 'Penanaman Pohon',
  ocean_cleanup: 'Kebersihan Laut',
  wildlife_protection: 'Perlindungan Satwa',
  ecosystem_restoration: 'Restorasi Ekosistem',
  energi: 'Energi',
  renewable_energy: 'Energi Terbarukan',
  carbon_reduction: 'Pengurangan Karbon',
  sosial: 'Sosial',
  pendidikan: 'Pendidikan',
  kesehatan: 'Kesehatan',
  lainnya: 'Lainnya',
};

export const KATEGORI_UTAMA: ProjectCategory[] = [
  'lingkungan', 'energi', 'sosial', 'pendidikan', 'kesehatan', 'lainnya',
];

export const KATEGORI_CHILDREN: Partial<Record<ProjectCategory, ProjectCategory[]>> = {
  lingkungan: ['tree_planting', 'ocean_cleanup', 'wildlife_protection', 'ecosystem_restoration'],
  energi: ['renewable_energy', 'carbon_reduction'],
};

export const KATEGORI_PARENT: Partial<Record<ProjectCategory, ProjectCategory>> = {
  tree_planting: 'lingkungan',
  ocean_cleanup: 'lingkungan',
  wildlife_protection: 'lingkungan',
  ecosystem_restoration: 'lingkungan',
  renewable_energy: 'energi',
  carbon_reduction: 'energi',
};

export type NFTStatus = 'biasa' | 'valid' | 'invalid';

export type ValidatorEntry = {
  user_id: string;
  nft_unit_id: string;
  nilai: number;
  timestamp: Date | null;
};

export type Project = {
  id: string;
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
  jumlah_nft: number;
  fee_project_pct?: number;
  jumlah_nft_terjual?: number;
  link_bukti_status?: 'aktif' | 'tidak_aktif' | 'belum_dicek';
  link_bukti_last_checked?: Date | null;
  status_project: 'aktif' | 'dalam_invalidasi';
  daftar_invalidasi: boolean;
  pool_jaminan: number;
  jumlah_validator: number;
  validator_list: ValidatorEntry[];
  like_count: number;
  anomali_flag: boolean;
  created_at: Date;
};

export type NeracaLog = {
  id: string;
  type: 'beli' | 'beli_pool' | 'jual' | 'validasi' | 'buyback' | 'level_change' | 'transfer_pool' | 'lewati_fifo' | 'fee_keluar' | 'fee_validator' | 'revalidasi_keluar' | 'revalidasi_masuk';
  nft_unit_id: string;
  nama_nft: string;
  harga_transaksi: number;
  nilai_selisih: number;
  delta: number;
  counterparty_id: string;
  project_id?: string;
  link_bukti?: string;
  timestamp: Date;
};

export type HistoryKepemilikan = {
  id: string;
  dari: string;
  ke: string;
  harga: number;
  timestamp: Date;
};

export type Comment = {
  id: string;
  user_id: string;
  display_name: string;
  text: string;
  timestamp: Date;
  anomali_flag: boolean;
};

export type NFTUnit = {
  id: string;
  project_id: string;
  developer_id: string;
  owner_id: string;
  nama_nft: string;
  nama_project: string;
  gambar_url: string;
  kategori: ProjectCategory;
  status: NFTStatus;
  harga_jual: number;
  harga_beli_terakhir: number;
  nilai_selisih: number;
  for_sale: boolean;
  in_pool: boolean;
  digunakan_validasi: boolean;
  project_validasi_id: string | null;
  harga_beli_sebelum_validasi?: number | null;
  nilai_selisih_sebelum_validasi?: number | null;
  pernah_digunakan_validasi?: boolean;
  like_count: number;
  comment_count: number;
  created_at: Date;
  purchased_at?: Date;
  buyback_pending?: boolean;
  transferred_at?: Date;
  fifo_skip_count?: number;
  last_skipped_by?: string;
  last_skip_reason?: string;
};
