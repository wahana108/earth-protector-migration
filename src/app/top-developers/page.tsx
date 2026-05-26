'use client';

import { useEffect, useState } from 'react';
import { Trophy, Medal, Star, TrendingUp } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchTopDevelopers } from '@/lib/firestore';
import type { TopDeveloper } from '@/lib/types';

const RANK_STYLES: Record<number, { icon: React.ReactNode; badge: string; ring: string }> = {
  1: {
    icon: <Trophy className="h-5 w-5 text-yellow-500" />,
    badge: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    ring: 'ring-2 ring-yellow-500',
  },
  2: {
    icon: <Medal className="h-5 w-5 text-slate-400" />,
    badge: 'bg-slate-400/20 text-slate-500 dark:text-slate-300 border-slate-400/30',
    ring: 'ring-2 ring-slate-400',
  },
  3: {
    icon: <Medal className="h-5 w-5 text-amber-600" />,
    badge: 'bg-amber-600/20 text-amber-700 dark:text-amber-500 border-amber-600/30',
    ring: 'ring-2 ring-amber-600',
  },
};

export default function TopDevelopersPage() {
  const [developers, setDevelopers] = useState<TopDeveloper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopDevelopers(20)
      .then(setDevelopers)
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">Top Developers</h1>
          <p className="text-muted-foreground">
            Ranked by contribution score — based on NFTs created, likes received, and transaction volume.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : developers.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-1">No Rankings Yet</h3>
            <p className="text-muted-foreground text-sm">
              Rankings are calculated by the AI scoring system. Check back after some NFT activity.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {developers.map((dev, index) => {
              const rank = index + 1;
              const rankStyle = RANK_STYLES[rank];
              const displayName = dev.user?.displayName || dev.developerId.slice(0, 8) + '…';
              const photoURL = dev.user?.photoURL || '';
              const initial = displayName.charAt(0).toUpperCase();

              return (
                <Card
                  key={dev.developerId}
                  className={rank <= 3 ? 'border-primary/20 bg-primary/[0.02]' : ''}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Rank number */}
                    <div className="w-8 flex-shrink-0 text-center">
                      {rankStyle ? (
                        rankStyle.icon
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <Avatar className={`h-10 w-10 flex-shrink-0 ${rankStyle?.ring ?? ''}`}>
                      {photoURL && <AvatarImage src={photoURL} alt={displayName} />}
                      <AvatarFallback className="text-sm font-semibold">{initial}</AvatarFallback>
                    </Avatar>

                    {/* Name + email */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{displayName}</p>
                      {dev.user?.email && (
                        <p className="text-xs text-muted-foreground truncate">{dev.user.email}</p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {dev.user?.isTopDeveloper && (
                        <Badge variant="outline" className="gap-1 text-xs border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
                          <Star className="h-3 w-3" />
                          Top Dev
                        </Badge>
                      )}
                      <div className="text-right">
                        <p className="font-bold text-primary tabular-nums">
                          {dev.contributionScore.toFixed(1)}
                        </p>
                        <p className="text-xs text-muted-foreground">score</p>
                      </div>
                      {rankStyle && (
                        <Badge variant="outline" className={`text-xs ${rankStyle.badge}`}>
                          #{rank}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground pt-4">
          Score = NFTs created × 1pt + likes × 0.5pt + transactions × 0.2pt
        </p>
      </div>
    </MainLayout>
  );
}
