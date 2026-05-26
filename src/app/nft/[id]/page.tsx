'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ArrowLeft, Tag, Leaf, User as UserIcon } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchNftById,
  fetchUserById,
  likeNft,
  hasUserLiked,
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
          <div className="relative aspect-square rounded-xl overflow-hidden">
            <img
              src={nft.imageUrl}
              alt={nft.title}
              className="absolute inset-0 h-full w-full object-cover"
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

            <div className="flex gap-3">
              {nft.forSale && authUser && (
                <Button size="lg" className="flex-1">
                  Buy Now
                </Button>
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
    </MainLayout>
  );
}
