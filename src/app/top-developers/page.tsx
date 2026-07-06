'use client';

import { useEffect, useState } from 'react';
import {
  collection, getDocs, query, where,
} from 'firebase/firestore';
import { AlertTriangle, Users, UserX } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { BlockUserDialog } from '@/components/block-user-dialog';
import { cn } from '@/lib/utils';
import { getCommunityConfig } from '@/lib/community-config';
import { calculateEffectiveBuyback } from '@/lib/ranking';

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

type DeveloperRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  total_poin: number;
  soldNfts: number;
  buybackCount: number;
  buyback_pct: number | null;
  effective_buyback_pct: number | null;
  penalty: number;
  has_anomali: boolean;
  is_flagged: boolean;
};

async function fetchDeveloperRows(): Promise<DeveloperRow[]> {
  const [usersSnap, anomaliSnap, config] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(query(collection(db, 'projects'), where('anomali_flag', '==', true))),
    getCommunityConfig(),
  ]);

  const hargaDasar = config?.harga_dasar ?? 100000;

  const anomaliDevIds = new Set(
    anomaliSnap.docs.map((d) => d.data().developer_id as string),
  );

  const rows: DeveloperRow[] = usersSnap.docs.map((d) => {
    const data = d.data();
    const soldNfts = (data.soldNfts as number) ?? 0;
    const buybackCount = (data.buybackCount as number) ?? 0;
    const total_poin = (data.total_poin as number) ?? 0;
    const buyback_pct = soldNfts > 0 ? Math.round((buybackCount / soldNfts) * 100) : null;
    const penalty = total_poin < 0 ? Math.floor(Math.abs(total_poin) / hargaDasar) : 0;
    const effectiveBuyback = calculateEffectiveBuyback(buybackCount, total_poin, hargaDasar);
    const effective_buyback_pct = soldNfts > 0 ? Math.round((effectiveBuyback / soldNfts) * 100) : null;
    const has_anomali = anomaliDevIds.has(d.id);

    return {
      id: d.id,
      displayName: (data.displayName as string | null) ?? null,
      email: (data.email as string | null) ?? null,
      photoURL: (data.photoURL as string | null) ?? null,
      total_poin,
      soldNfts,
      buybackCount,
      buyback_pct,
      effective_buyback_pct,
      penalty,
      has_anomali,
      is_flagged: total_poin < 0 || has_anomali,
    };
  });

  // Urut: effective_buyback_pct DESC → total_poin DESC → soldNfts DESC
  rows.sort((a, b) => {
    if (a.effective_buyback_pct === null && b.effective_buyback_pct === null)
      return b.total_poin - a.total_poin;
    if (a.effective_buyback_pct === null) return 1;
    if (b.effective_buyback_pct === null) return -1;
    if (b.effective_buyback_pct !== a.effective_buyback_pct)
      return b.effective_buyback_pct - a.effective_buyback_pct;
    if (b.total_poin !== a.total_poin) return b.total_poin - a.total_poin;
    return b.soldNfts - a.soldNfts;
  });

  return rows;
}

// ─── Buyback Progress Bar ─────────────────────────────────────────────────────

function BuybackBar({ pct }: { pct: number }) {
  const barColor =
    pct >= 50 ? 'bg-green-500' :
    pct >= 20 ? 'bg-yellow-500' :
    'bg-destructive';

  const textColor =
    pct >= 50 ? 'text-green-600' :
    pct >= 20 ? 'text-yellow-600' :
    'text-destructive';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', barColor)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className={cn('text-sm font-bold tabular-nums w-12 text-right', textColor)}>
        {pct}%
      </span>
    </div>
  );
}

// ─── Developer Card ───────────────────────────────────────────────────────────

function DeveloperCard({ dev, rank, currentUserId }: { dev: DeveloperRow; rank: number; currentUserId?: string }) {
  const displayName = dev.displayName ?? dev.id.slice(0, 8) + '…';
  const initial = displayName.charAt(0).toUpperCase();
  const isPosNeraca = dev.total_poin >= 0;
  const [blockTarget, setBlockTarget] = useState<{ userId: string; name: string } | null>(null);

  return (
    <>
    <Card className={cn(
      dev.is_flagged && 'border-destructive/40 bg-destructive/[0.03]',
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="w-7 flex-shrink-0 text-center pt-1">
            <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
          </div>

          {/* Avatar */}
          <Avatar className="h-10 w-10 flex-shrink-0">
            {dev.photoURL && <AvatarImage src={dev.photoURL} alt={displayName} />}
            <AvatarFallback className="text-sm font-semibold">{initial}</AvatarFallback>
          </Avatar>

          {/* Nama + stats */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{displayName}</p>
              {dev.has_anomali && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5 cursor-default">
                        <AlertTriangle className="h-3 w-3" />
                        Anomali
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Ada project dengan link bukti bermasalah
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {dev.email && (
              <p className="text-xs text-muted-foreground truncate">{dev.email}</p>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1">% Buyback Efektif</p>
              {dev.effective_buyback_pct !== null ? (
                <>
                  <BuybackBar pct={dev.effective_buyback_pct} />
                  {dev.penalty > 0 && (
                    <p className="text-xs text-destructive mt-0.5">
                      Penalti neraca: -{dev.penalty} poin buyback
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">Belum ada penjualan</p>
              )}
            </div>
          </div>

          {/* Neraca + counter + blokir */}
          <div className="flex-shrink-0 text-right space-y-1.5 min-w-[90px]">
            <div>
              <p className={cn(
                'font-bold text-sm tabular-nums',
                isPosNeraca ? 'text-green-600' : 'text-destructive',
              )}>
                {isPosNeraca ? '+' : ''}{formatIDR(dev.total_poin)}
              </p>
              <p className="text-xs text-muted-foreground">neraca</p>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Jual: <span className="font-medium text-foreground">{dev.soldNfts}</span></p>
              <p>Buyback: <span className="font-medium text-foreground">{dev.buybackCount}</span></p>
            </div>
            {currentUserId && currentUserId !== dev.id && (
              <button
                onClick={() => setBlockTarget({ userId: dev.id, name: displayName })}
                className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-destructive transition-colors ml-auto"
                title="Blokir developer ini"
              >
                <UserX className="h-3 w-3" />
                Blokir
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    {blockTarget && currentUserId && (
      <BlockUserDialog
        targetUserId={blockTarget.userId}
        targetName={blockTarget.name}
        currentUserId={currentUserId}
        onClose={() => setBlockTarget(null)}
        onBlocked={() => setBlockTarget(null)}
      />
    )}
  </>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-start gap-3">
            <Skeleton className="h-7 w-7 rounded mt-1" />
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full" />
            </div>
            <div className="space-y-2 text-right min-w-[90px]">
              <Skeleton className="h-4 w-20 ml-auto" />
              <Skeleton className="h-3 w-16 ml-auto" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function DeveloperRankingPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DeveloperRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeveloperRows()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold mb-1">Developer Ranking</h1>
          <p className="text-muted-foreground text-sm">
            Semua developer diurutkan berdasarkan persentase buyback.
            Merah menandakan neraca negatif atau ada project dengan anomali.
          </p>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : rows.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-1">Belum ada developer</h3>
            <p className="text-sm text-muted-foreground">
              Belum ada user yang terdaftar di komunitas ini.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {rows.map((dev, index) => (
                <DeveloperCard key={dev.id} dev={dev} rank={index + 1} currentUserId={user?.id} />
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground pt-2">
              {rows.length} developer · Diurutkan berdasarkan % buyback efektif · tiebreaker neraca
            </p>
          </>
        )}
      </div>
    </MainLayout>
  );
}
