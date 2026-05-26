'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Heart, ShoppingBag, RefreshCcw, Star } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { NftCard } from '@/components/nft-card';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchUserById,
  fetchNftsByCreator,
  fetchNftsByOwner,
} from '@/lib/firestore';
import type { NFT, User } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [fullProfile, setFullProfile] = useState<User | null>(null);
  const [createdNfts, setCreatedNfts] = useState<NFT[]>([]);
  const [ownedNfts, setOwnedNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [profile, created, owned] = await Promise.all([
          fetchUserById(user!.id),
          fetchNftsByCreator(user!.id),
          fetchNftsByOwner(user!.id),
        ]);
        setFullProfile(profile);
        setCreatedNfts(created);
        setOwnedNfts(owned);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16">
          <h2 className="text-2xl font-headline font-bold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-4">You must be signed in to view your dashboard.</p>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-headline font-bold mb-1">My Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user.displayName}
            </p>
          </div>
          <Button asChild>
            <Link href="/create" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Create NFT
            </Link>
          </Button>
        </div>

        {loading ? (
          <StatsSkeletons />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Heart className="h-5 w-5 text-red-400" />}
              label="Total Likes"
              value={fullProfile?.totalLikes ?? 0}
            />
            <StatCard
              icon={<ShoppingBag className="h-5 w-5 text-primary" />}
              label="NFTs Sold"
              value={fullProfile?.soldNfts ?? 0}
            />
            <StatCard
              icon={<RefreshCcw className="h-5 w-5 text-blue-400" />}
              label="Buybacks"
              value={fullProfile?.buybackCount ?? 0}
            />
            <StatCard
              icon={<Star className="h-5 w-5 text-yellow-400" />}
              label="Status"
              value={
                fullProfile?.isTopDeveloper ? (
                  <Badge className="text-xs bg-yellow-400/20 text-yellow-600 border-yellow-400/30">
                    Top Developer
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Active User</span>
                )
              }
            />
          </div>
        )}

        <Tabs defaultValue="created">
          <TabsList>
            <TabsTrigger value="created">
              My NFTs {!loading && `(${createdNfts.length})`}
            </TabsTrigger>
            <TabsTrigger value="owned">
              My Collection {!loading && `(${ownedNfts.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="mt-6">
            {loading ? (
              <NftGridSkeleton />
            ) : createdNfts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {createdNfts.map((nft) => (
                  <NftCard key={nft.id} nft={nft} creator={user} />
                ))}
              </div>
            ) : (
              <EmptyState
                message="You haven't created any NFTs yet."
                action={{ href: '/create', label: 'Create your first NFT' }}
              />
            )}
          </TabsContent>

          <TabsContent value="owned" className="mt-6">
            {loading ? (
              <NftGridSkeleton />
            ) : ownedNfts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {ownedNfts.map((nft) => (
                  <NftCard key={nft.id} nft={nft} />
                ))}
              </div>
            ) : (
              <EmptyState
                message="You don't own any NFTs yet."
                action={{ href: '/explore', label: 'Explore NFTs' }}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, action }: { message: string; action: { href: string; label: string } }) {
  return (
    <div className="text-center py-16 border-2 border-dashed rounded-lg">
      <p className="text-muted-foreground mb-4">{message}</p>
      <Button asChild variant="outline">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    </div>
  );
}

function StatsSkeletons() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NftGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
