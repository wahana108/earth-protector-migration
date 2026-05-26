'use client';

import { useEffect, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { Pencil, Check, X, Heart, ShoppingBag, RefreshCcw, Star, User as UserIcon } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { NftCard } from '@/components/nft-card';
import { useAuth } from '@/hooks/use-auth';
import { auth } from '@/lib/firebase';
import {
  fetchUserById,
  fetchNftsByCreator,
  fetchNftsByOwner,
  updateUserDisplayName,
} from '@/lib/firestore';
import type { NFT, User } from '@/lib/types';

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth();
  const [fullProfile, setFullProfile] = useState<User | null>(null);
  const [createdNfts, setCreatedNfts] = useState<NFT[]>([]);
  const [ownedNfts, setOwnedNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNameInput(user.displayName || '');
    async function load() {
      const [profile, created, owned] = await Promise.all([
        fetchUserById(user!.id),
        fetchNftsByCreator(user!.id),
        fetchNftsByOwner(user!.id),
      ]);
      setFullProfile(profile);
      setCreatedNfts(created);
      setOwnedNfts(owned);
      setLoading(false);
    }
    load();
  }, [user]);

  const saveName = async () => {
    if (!user || !nameInput.trim() || !firebaseUser) return;
    setSavingName(true);
    try {
      await Promise.all([
        updateUserDisplayName(user.id, nameInput.trim()),
        updateProfile(firebaseUser, { displayName: nameInput.trim() }),
      ]);
      setFullProfile(p => p ? { ...p, displayName: nameInput.trim() } : p);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-muted-foreground mb-4">Sign in to view your profile.</p>
          <Button asChild><a href="/login">Sign In</a></Button>
        </div>
      </MainLayout>
    );
  }

  const displayName = fullProfile?.displayName ?? user.displayName ?? 'Anonymous';
  const photoURL = fullProfile?.photoURL ?? user.photoURL ?? '';

  return (
    <MainLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Profile header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Avatar className="h-24 w-24 ring-2 ring-primary/20">
            {photoURL && <AvatarImage src={photoURL} alt={displayName} />}
            <AvatarFallback className="text-2xl">
              {displayName ? displayName.charAt(0).toUpperCase() : <UserIcon className="h-10 w-10" />}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center sm:text-left space-y-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  className="max-w-xs h-9"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                />
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={saveName} disabled={savingName}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditingName(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h1 className="text-2xl font-headline font-bold">{displayName}</h1>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingName(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <p className="text-muted-foreground text-sm">{user.email}</p>
            {fullProfile?.isTopDeveloper && (
              <Badge variant="outline" className="gap-1 border-yellow-500/40 text-yellow-600 dark:text-yellow-400">
                <Star className="h-3 w-3" /> Top Developer
              </Badge>
            )}
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-8 w-16 mb-1" /><Skeleton className="h-3 w-20" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Heart className="h-5 w-5 text-red-400" />} label="Total Likes" value={fullProfile?.totalLikes ?? 0} />
            <StatCard icon={<ShoppingBag className="h-5 w-5 text-primary" />} label="NFTs Sold" value={fullProfile?.soldNfts ?? 0} />
            <StatCard icon={<RefreshCcw className="h-5 w-5 text-blue-400" />} label="Buybacks" value={fullProfile?.buybackCount ?? 0} />
            <StatCard icon={<UserIcon className="h-5 w-5 text-muted-foreground" />} label="NFTs Created" value={createdNfts.length} />
          </div>
        )}

        {/* NFT tabs */}
        <Tabs defaultValue="created">
          <TabsList>
            <TabsTrigger value="created">My NFTs {!loading && `(${createdNfts.length})`}</TabsTrigger>
            <TabsTrigger value="owned">My Collection {!loading && `(${ownedNfts.length})`}</TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="mt-6">
            {loading ? <NftGridSkeleton /> : createdNfts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {createdNfts.map(nft => <NftCard key={nft.id} nft={nft} creator={user} />)}
              </div>
            ) : <EmptyState message="You haven't created any NFTs yet." href="/create" label="Create your first NFT" />}
          </TabsContent>

          <TabsContent value="owned" className="mt-6">
            {loading ? <NftGridSkeleton /> : ownedNfts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {ownedNfts.map(nft => <NftCard key={nft.id} nft={nft} />)}
              </div>
            ) : <EmptyState message="You don't own any NFTs yet." href="/explore" label="Explore NFTs" />}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function EmptyState({ message, href, label }: { message: string; href: string; label: string }) {
  return (
    <div className="text-center py-16 border-2 border-dashed rounded-lg">
      <p className="text-muted-foreground mb-4">{message}</p>
      <Button asChild variant="outline"><a href={href}>{label}</a></Button>
    </div>
  );
}

function NftGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3"><Skeleton className="h-60 w-full" /><Skeleton className="h-5 w-3/4" /></div>
      ))}
    </div>
  );
}
