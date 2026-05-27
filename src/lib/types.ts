export type NFTCategory = 'tree_planting' | 'ocean_cleanup' | 'wildlife_protection';

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
