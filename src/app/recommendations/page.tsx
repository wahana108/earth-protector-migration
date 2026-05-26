'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { NftCard } from '@/components/nft-card';
import { fetchRecommendedNfts, fetchUserById } from '@/lib/firestore';
import type { NFT, User } from '@/lib/types';

type NftWithCreator = { nft: NFT; creator: User | null };

export default function RecommendationsPage() {
  const [items, setItems] = useState<NftWithCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const nfts = await fetchRecommendedNfts();
      const enriched = await Promise.all(
        nfts.map(async nft => ({ nft, creator: await fetchUserById(nft.createdBy) }))
      );
      setItems(enriched);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <MainLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">For You</h1>
          <p className="text-muted-foreground">
            Curated NFTs hand-picked by Top Vendors — up to 3 recommendations, one per vendor.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-60 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-1">No Recommendations Yet</h3>
            <p className="text-muted-foreground text-sm">
              Top Vendors can add up to one NFT each to the recommendation pool.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(({ nft, creator }) => (
              <NftCard key={nft.id} nft={nft} creator={creator ?? undefined} />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
