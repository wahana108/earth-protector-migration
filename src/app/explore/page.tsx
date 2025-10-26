'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { MainLayout } from '@/components/layout/main-layout';
import { NftCard } from '@/components/nft-card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getNfts } from '@/lib/placeholder-data';
import type { NFT } from '@/lib/types';
import { Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function ExplorePageContent() {
  const searchParams = useSearchParams();
  const nfts = getNfts();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [sortBy, setSortBy] = useState('newest');

  const filteredAndSortedNfts = useMemo(() => {
    return nfts
      .filter((nft: NFT) => {
        const matchesCategory = category === 'all' || nft.category === category;
        const matchesSearch = nft.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a: NFT, b: NFT) => {
        switch (sortBy) {
          case 'newest':
            return b.createdAt.getTime() - a.createdAt.getTime();
          case 'oldest':
            return a.createdAt.getTime() - b.createdAt.getTime();
          case 'likes':
            return b.likes - a.likes;
          case 'price_asc':
            return a.price - b.price;
          case 'price_desc':
            return b.price - a.price;
          default:
            return 0;
        }
      });
  }, [nfts, searchTerm, category, sortBy]);

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">Explore NFTs</h1>
          <p className="text-muted-foreground">
            Find digital art that makes a real-world impact.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Reforestation">Reforestation</SelectItem>
                <SelectItem value="Ocean Cleanup">Ocean Cleanup</SelectItem>
                <SelectItem value="Wildlife Conservation">Wildlife Conservation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="likes">Most Liked</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredAndSortedNfts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedNfts.map((nft) => (
              <NftCard key={nft.id} nft={nft} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h3 className="text-xl font-semibold">No NFTs Found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}


function LoadingSkeleton() {
  return (
    <MainLayout>
       <div className="space-y-8">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-80 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}


export default function ExplorePage() {
    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <ExplorePageContent />
        </Suspense>
    )
}
