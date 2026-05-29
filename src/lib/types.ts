export type NFTCategory =
  | 'tree_planting'
  | 'ocean_cleanup'
  | 'wildlife_protection'
  | 'renewable_energy'
  | 'carbon_reduction'
  | 'ecosystem_restoration';

export type User = {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  createdAt: Date;
  totalLikes?: number;
  soldNfts?: number;
  buybackCount?: number;
  isTopDeveloper?: boolean;
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
  nftId: string;
  buyerId: string;
  vendorId: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed';
  proofUrl: string | null;
  createdAt: Date;
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
  minimum_top_developer: number;
  kapasitas_pool_minimum: number;
  fase_aktif: number;
  ai_provider: string;
  ai_anomali_threshold: { flag: number; invalid: number };
  updated_at: Date;
  updated_by: string;
};
