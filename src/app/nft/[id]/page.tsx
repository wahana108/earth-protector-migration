'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ArrowLeft, Tag, Leaf, User as UserIcon, ShoppingBag, Loader2, RefreshCcw } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchNftById,
  fetchUserById,
  likeNft,
  hasUserLiked,
  buyNft,
  createBuybackRequest,
  CATEGORY_LABELS,
} from '@/lib/firestore';
import type { NFT, User } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function NftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user: authUser } = useAuth();

  const [nft, setNft] = useState<NFT | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);

  // Buy dialog state
  const [buyOpen, setBuyOpen] = useState(false);
  const [proofLink, setProofLink] = useState('');
  const [description, setDescription] = useState('');
  const [buying, setBuying] = useState(false);

  // Buyback request state
  const [requestingBuyback, setRequestingBuyback] = useState(false);
  const [buybackDone, setBuybackDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const nftData = await fetchNftById(id);
        if (!nftData) {
          router.push('/explore');
          return;
        }
        setNft(nftData);
        setLikeCount(nftData.likes);

        const [creatorData, ownerData] = await Promise.all([
          fetchUserById(nftData.createdBy),
          nftData.owner ? fetchUserById(nftData.owner) : Promise.resolve(null),
        ]);
        setCreator(creatorData);
        setOwner(ownerData);

        if (authUser) {
          const liked = await hasUserLiked(id, authUser.id);
          setIsLiked(liked);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, authUser, router]);

  const handleLike = async () => {
    if (!authUser || !nft || liking) return;
    setLiking(true);
    try {
      await likeNft(nft.id, authUser.id);
      const nowLiked = !isLiked;
      setIsLiked(nowLiked);
      setLikeCount(c => nowLiked ? c + 1 : c - 1);
    } finally {
      setLiking(false);
    }
  };

  const handleBuy = async () => {
    if (!authUser || !nft || !nft.owner || !proofLink.trim() || buying) return;
    setBuying(true);
    try {
      await buyNft(nft.id, authUser.id, nft.owner, proofLink.trim(), description.trim());
      setNft(prev => prev ? { ...prev, owner: authUser.id, forSale: false } : prev);
      setOwner({ id: authUser.id, displayName: authUser.displayName, photoURL: authUser.photoURL, email: authUser.email, createdAt: new Date() });
      setBuyOpen(false);
      setProofLink('');
      setDescription('');
    } finally {
      setBuying(false);
    }
  };

  const canBuy = !!nft?.forSale && !!authUser && nft.owner !== authUser.id;
  // Current owner who bought from someone else can request creator buyback
  const canRequestBuyback = !!nft && !nft.forSale && !!authUser &&
    nft.owner === authUser.id && nft.createdBy !== authUser.id && !buybackDone;

  const handleRequestBuyback = async () => {
    if (!authUser || !nft || requestingBuyback) return;
    setRequestingBuyback(true);
    try {
      await createBuybackRequest(nft.id, nft.createdBy, authUser.id);
      setBuybackDone(true);
    } finally {
      setRequestingBuyback(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-1/2" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!nft) return null;

  const categoryLabel = CATEGORY_LABELS[nft.category] ?? nft.category;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/explore">
            <ArrowLeft className="h-4 w-4" />
            Back to Explore
          </Link>
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center max-h-[520px]">
            <img
              src={nft.imageUrl}
              alt={nft.title}
              className="max-h-[520px] w-full object-contain"
            />
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="gap-1">
                  <Leaf className="h-3 w-3" />
                  {categoryLabel}
                </Badge>
                {!nft.isValid && (
                  <Badge variant="destructive">Pending Validation</Badge>
                )}
              </div>
              <h1 className="text-3xl font-headline font-bold">{nft.title}</h1>
            </div>

            <p className="text-muted-foreground leading-relaxed">{nft.description}</p>

            <div className="p-4 bg-secondary/50 rounded-lg space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Impact</p>
              <p className="font-semibold text-primary">{nft.impact}</p>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {creator?.photoURL && <AvatarImage src={creator.photoURL} alt={creator.displayName || 'Creator'} />}
                  <AvatarFallback>
                    {creator?.displayName ? creator.displayName.charAt(0) : <UserIcon className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs text-muted-foreground">Creator</p>
                  <p className="font-medium">{creator?.displayName || 'Unknown'}</p>
                </div>
              </div>

              {owner && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {owner.photoURL && <AvatarImage src={owner.photoURL} alt={owner.displayName || 'Owner'} />}
                    <AvatarFallback>
                      {owner.displayName ? owner.displayName.charAt(0) : <UserIcon className="w-4 h-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs text-muted-foreground">Owner</p>
                    <p className="font-medium">{owner.displayName || 'Unknown'}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pt-2">
              {nft.forSale && (
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold text-primary">{nft.price} ETH</span>
                </div>
              )}
              {!nft.forSale && (
                <Badge variant="outline" className="text-sm px-3 py-1">Not for sale</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {canBuy && (
                <Button size="lg" className="flex-1 gap-2" onClick={() => setBuyOpen(true)}>
                  <ShoppingBag className="h-5 w-5" />
                  Buy Now
                </Button>
              )}
              {canRequestBuyback && (
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2"
                  disabled={requestingBuyback}
                  onClick={handleRequestBuyback}
                >
                  {requestingBuyback
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RefreshCcw className="h-4 w-4" />
                  }
                  Request Buyback
                </Button>
              )}
              {buybackDone && (
                <Badge variant="outline" className="text-sm px-3 py-1 self-center text-green-600 border-green-500/40">
                  Buyback requested — check /buyback
                </Badge>
              )}
              {!nft.forSale && authUser && nft.owner === authUser.id && nft.createdBy === authUser.id && (
                <Badge variant="outline" className="text-sm px-3 py-1 self-center">You own this NFT</Badge>
              )}
              <Button
                variant="outline"
                size="lg"
                onClick={handleLike}
                disabled={!authUser || liking}
                className="gap-2"
              >
                <Heart
                  className={cn(
                    'h-5 w-5',
                    isLiked ? 'text-red-500 fill-current' : 'text-muted-foreground'
                  )}
                />
                {likeCount}
              </Button>
            </div>

            {!authUser && (
              <p className="text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline">Sign in</Link> to like or buy this NFT.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Buy Dialog */}
      <Dialog open={buyOpen} onOpenChange={open => { if (!buying) setBuyOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buy &ldquo;{nft.title}&rdquo;</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Complete your purchase on an external marketplace, then submit the proof link below to record the transaction.
            </p>

            <div className="space-y-2">
              <Label htmlFor="proof-link">Proof URL <span className="text-destructive">*</span></Label>
              <Input
                id="proof-link"
                placeholder="https://opensea.io/..."
                value={proofLink}
                onChange={e => setProofLink(e.target.value)}
                disabled={buying}
              />
              <p className="text-xs text-muted-foreground">Link to the transaction on an external marketplace.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buy-description">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="buy-description"
                placeholder="e.g. Purchased via OpenSea auction on 2026-05-27"
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={buying}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBuyOpen(false)} disabled={buying}>
              Cancel
            </Button>
            <Button onClick={handleBuy} disabled={!proofLink.trim() || buying} className="gap-2">
              {buying && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
