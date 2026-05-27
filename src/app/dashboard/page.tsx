'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle, Heart, ShoppingBag, RefreshCcw, Star, Trash2, Loader2, BadgeCheck } from 'lucide-react';

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
  deleteNft,
  setNftRecommended,
} from '@/lib/firestore';
import type { NFT, User } from '@/lib/types';

// Simple inline progress bar
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function VendorStatusCard({ profile, soldNfts }: { profile: User; soldNfts: number }) {
  const sold = profile.soldNfts ?? 0;
  const buybackCount = profile.buybackCount ?? 0;
  const buybackRate = sold > 0 ? Math.round((buybackCount / sold) * 100) : 0;
  const isTopDev = profile.isTopDeveloper ?? false;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400" />
          Vendor Status
          {isTopDev && (
            <Badge className="ml-auto text-xs bg-yellow-400/20 text-yellow-600 border-yellow-400/30">
              Top Developer
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">NFTs Sold</span>
            <span className={sold >= 30 ? 'text-green-500 font-semibold' : ''}>{sold}/30</span>
          </div>
          <ProgressBar value={sold} max={30} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Buyback Rate</span>
            <span className={buybackRate >= 50 ? 'text-green-500 font-semibold' : ''}>{buybackRate}%/50%</span>
          </div>
          <ProgressBar value={buybackRate} max={50} />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <BadgeCheck className={`h-4 w-4 ${soldNfts > 0 ? 'text-green-500' : 'text-muted-foreground'}`} />
          <span className="text-muted-foreground">
            Recommended NFT purchase
            {soldNfts === 0 && <span className="ml-1 text-xs">(buy a recommended NFT to qualify)</span>}
          </span>
        </div>
        {!isTopDev && (
          <p className="text-xs text-muted-foreground pt-1 border-t">
            Criteria: Sell 30+ NFTs · 50%+ buyback rate · Buy 1 recommended NFT
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecommendationManagement({ createdNfts, onChanged }: { createdNfts: NFT[]; onChanged: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validNfts = createdNfts.filter(n => n.isValid);
  const poolCount = createdNfts.filter(n => n.isRecommended).length;

  const toggle = async (nft: NFT) => {
    setSaving(nft.id);
    setError(null);
    const result = await setNftRecommended(nft.id, !nft.isRecommended);
    setSaving(null);
    if (!result.ok) {
      setError(result.error ?? 'Failed to update.');
    } else {
      onChanged();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400" />
          NFT Recommendation Management
          <Badge variant="outline" className="ml-auto text-xs">{poolCount}/3 slots</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {validNfts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No validated NFTs to manage. Create and get NFTs validated first.</p>
        ) : (
          <div className="space-y-2">
            {validNfts.map(nft => (
              <div key={nft.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/40">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{nft.title}</p>
                  <p className="text-xs text-muted-foreground">{nft.likes} likes</p>
                </div>
                <Button
                  size="sm"
                  variant={nft.isRecommended ? 'default' : 'outline'}
                  disabled={saving === nft.id}
                  onClick={() => toggle(nft)}
                  className="flex-shrink-0 gap-1 text-xs"
                >
                  {saving === nft.id && <Loader2 className="h-3 w-3 animate-spin" />}
                  {nft.isRecommended ? 'Remove' : 'Add to Pool'}
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Max 3 NFTs in pool · 1 per vendor · NFT must be validated</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [fullProfile, setFullProfile] = useState<User | null>(null);
  const [createdNfts, setCreatedNfts] = useState<NFT[]>([]);
  const [ownedNfts, setOwnedNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    try {
      const [profile, created, owned] = await Promise.all([
        fetchUserById(user.id),
        fetchNftsByCreator(user.id),
        fetchNftsByOwner(user.id),
      ]);
      setFullProfile(profile);
      setCreatedNfts(created);
      setOwnedNfts(owned);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleDelete = async (nftId: string) => {
    if (!window.confirm('Delete this NFT? This cannot be undone after 30 minutes.')) return;
    setDeleting(nftId);
    try {
      await deleteNft(nftId);
      await load();
    } finally {
      setDeleting(null);
    }
  };

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

  const isTopDev = fullProfile?.isTopDeveloper ?? false;

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
          <>
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
                  isTopDev ? (
                    <Badge className="text-xs bg-yellow-400/20 text-yellow-600 border-yellow-400/30">
                      Top Developer
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Active User</span>
                  )
                }
              />
            </div>

            {/* Vendor status + recommendation management side by side on lg */}
            <div className={`grid gap-4 ${isTopDev ? 'lg:grid-cols-2' : 'lg:grid-cols-1 max-w-md'}`}>
              {fullProfile && (
                <VendorStatusCard profile={fullProfile} soldNfts={ownedNfts.filter(n => n.isRecommended).length} />
              )}
              {isTopDev && (
                <RecommendationManagement createdNfts={createdNfts} onChanged={load} />
              )}
            </div>
          </>
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
                  <div key={nft.id} className="relative">
                    <NftCard nft={nft} creator={user} />
                    <button
                      onClick={() => handleDelete(nft.id)}
                      disabled={deleting === nft.id}
                      title="Delete NFT"
                      className="absolute top-2 right-2 z-10 rounded-md bg-background/80 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      {deleting === nft.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Trash2 className="h-4 w-4" />
                      }
                    </button>
                  </div>
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
    <div className="space-y-4">
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
      <Skeleton className="h-32 w-full max-w-md" />
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
