'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ThumbsUp, ThumbsDown, ShieldCheck } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchPendingNfts,
  fetchUserById,
  castVote,
  getUserVote,
  fetchVoteStats,
  type VoteStatus,
} from '@/lib/firestore';
import type { NFT, User } from '@/lib/types';
import { cn } from '@/lib/utils';

type VoteStats = { approve: number; reject: number; total: number };

type NftWithMeta = {
  nft: NFT;
  creator: User | null;
  stats: VoteStats;
  userVote: VoteStatus | null;
};

export default function ValidationPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NftWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pending = await fetchPendingNfts();
      const enriched = await Promise.all(
        pending.map(async (nft) => {
          const [creator, stats, userVote] = await Promise.all([
            fetchUserById(nft.createdBy),
            fetchVoteStats(nft.id),
            user ? getUserVote(nft.id, user.id) : Promise.resolve(null),
          ]);
          return { nft, creator, stats, userVote };
        })
      );
      setItems(enriched);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async (nftId: string, vote: VoteStatus) => {
    if (!user || voting) return;
    setVoting(nftId);
    try {
      await castVote(nftId, user.id, vote);
      // Refresh just this item's stats and vote
      const [stats, userVote] = await Promise.all([
        fetchVoteStats(nftId),
        getUserVote(nftId, user.id),
      ]);
      setItems(prev =>
        prev
          .map(item =>
            item.nft.id === nftId
              ? { ...item, stats, userVote, nft: { ...item.nft } }
              : item
          )
          // Remove from list if now validated (approve >= 80%)
          .filter(item => {
            if (item.nft.id !== nftId) return true;
            const pct = item.stats.total > 0 ? item.stats.approve / item.stats.total : 0;
            return pct < 0.8;
          })
      );
    } finally {
      setVoting(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">Community Endorsement</h1>
          <p className="text-muted-foreground">
            All NFTs are available for purchase from the moment they are listed. Voting here gives an NFT
            the <strong>Community Validated</strong> badge — a mark of trust, not a prerequisite to buy.
          </p>
        </div>

        {!user && (
          <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-sm">
            <Link href="/login" className="font-medium underline">Sign in</Link> to cast your vote.
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="aspect-video w-full" />
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <ShieldCheck className="h-12 w-12 mx-auto text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-1">Nothing Pending Endorsement</h3>
            <p className="text-muted-foreground">All listed NFTs have already been reviewed by the community.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(({ nft, creator, stats, userVote }) => {
              const approvePct = stats.total > 0 ? Math.round((stats.approve / stats.total) * 100) : 0;
              const isVoting = voting === nft.id;

              return (
                <Card key={nft.id} className="overflow-hidden flex flex-col">
                  {/* Image */}
                  <Link href={`/nft/${nft.id}`} className="block overflow-hidden">
                    <div className="aspect-video w-full overflow-hidden bg-muted">
                      <img
                        src={nft.imageUrl}
                        alt={nft.title}
                        className="h-full w-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </Link>

                  <CardContent className="p-4 flex-1 space-y-3">
                    <div>
                      <Link href={`/nft/${nft.id}`} className="font-headline font-semibold hover:text-primary transition-colors line-clamp-1">
                        {nft.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        by {creator?.displayName || 'Unknown'}
                      </p>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">{nft.description}</p>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{stats.approve} endorse · {stats.reject} reject</span>
                        <span className="font-medium text-primary">{approvePct}%</span>
                      </div>
                      <Progress value={approvePct} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        80% endorsement earns the Validated badge · {stats.total} vote{stats.total !== 1 ? 's' : ''} cast
                      </p>
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0 gap-2">
                    <Button
                      variant={userVote === 'approve' ? 'default' : 'outline'}
                      size="sm"
                      className={cn('flex-1 gap-1.5', userVote === 'approve' && 'bg-green-600 hover:bg-green-700 border-green-600')}
                      disabled={!user || isVoting}
                      onClick={() => handleVote(nft.id, 'approve')}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant={userVote === 'reject' ? 'default' : 'outline'}
                      size="sm"
                      className={cn('flex-1 gap-1.5', userVote === 'reject' && 'bg-red-600 hover:bg-red-700 border-red-600')}
                      disabled={!user || isVoting}
                      onClick={() => handleVote(nft.id, 'reject')}
                    >
                      <ThumbsDown className="h-4 w-4" />
                      Reject
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
