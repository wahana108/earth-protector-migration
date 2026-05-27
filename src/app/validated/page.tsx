'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Skeleton } from '@/components/ui/skeleton';
import { NftCard } from '@/components/nft-card';
import { fetchValidatedNfts, fetchUserById } from '@/lib/firestore';
import type { NFT, User } from '@/lib/types';

type NftWithCreator = { nft: NFT; creator: User | null };

export default function ValidatedPage() {
  const [items, setItems] = useState<NftWithCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const nfts = await fetchValidatedNfts();
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
      <div className="space-y-8 max-w-5xl mx-auto">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2 flex items-center gap-3">
            <BadgeCheck className="h-9 w-9 text-primary" />
            Validated NFTs
          </h1>
          <p className="text-muted-foreground">
            NFTs approved by the community — 80%+ approval vote required to appear here.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-60 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <BadgeCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-1">No Validated NFTs Yet</h3>
            <p className="text-muted-foreground text-sm">
              NFTs need 80%+ community approval to appear here. Visit <a href="/validation" className="text-primary hover:underline">Validation</a> to vote.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{items.length} validated NFT{items.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {items.map(({ nft, creator }) => (
                <NftCard key={nft.id} nft={nft} creator={creator ?? undefined} />
              ))}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
