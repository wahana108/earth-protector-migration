export type User = {
  id: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  createdAt: Date;
};

export type NFT = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  impact: string;
  likes: number;
  ownerId: string | null;
  creatorId: string;
  forSale: boolean;
  price: number;
  category: 'Reforestation' | 'Ocean Cleanup' | 'Wildlife Conservation';
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
  createdAt: Date;
};

export type Vote = {
  userId: string;
  voteStatus: 'approve' | 'reject';
};

export type Like = {
  userId: string;
  likedAt: Date;
};

export type BuybackRequest = {
  id:string;
  nftId: string;
  buyerId: string; // current owner
  vendorId: string; // creator
  status: 'pending' | 'confirmed' | 'rejected' | 'completed';
  proofUrl: string | null;
  createdAt: Date;
};

export type TopDeveloper = {
  developerId: string;
  contributionScore: number;
  user?: User;
};
