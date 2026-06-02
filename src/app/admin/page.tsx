'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, RefreshCcw, ShieldAlert, ArrowUpRight, ArrowDownRight,
  Minus, Flag, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import {
  collection, getDocs, query, where, orderBy, getDoc, doc, Timestamp,
} from 'firebase/firestore';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { recalculateAllDeveloperLevels, resolvePurchaseDispute, PurchaseError, type RecalcStats } from '@/lib/projects';
import { db } from '@/lib/firebase';

const ADMIN_EMAIL = 'ramawan@live.com';

// ─── Types ────────────────────────────────────────────────────────────────────

type DisputeItem = {
  id: string;
  nft_unit_id: string;
  nft_nama: string;
  seller_id: string;
  seller_name: string;
  buyer_id: string;
  buyer_name: string;
  type: string;
  reason: string;
  created_at: Date;
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

// ─── Resolve Dialog ───────────────────────────────────────────────────────────

function ResolveDialog({
  dispute, decision, onClose, onResolved,
}: {
  dispute: DisputeItem;
  decision: 'approve' | 'reject';
  onClose: () => void;
  onResolved: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isApprove = decision === 'approve';

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await resolvePurchaseDispute(dispute.id, decision);
      onResolved(dispute.id);
      onClose();
    } catch (err) {
      setError(err instanceof PurchaseError ? err.message : 'Gagal memproses. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isApprove ? 'Konfirmasi: Transaksi Sah' : 'Konfirmasi: Batalkan Transaksi'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="rounded-lg border p-3 space-y-1.5 text-sm">
            <p className="font-semibold">{dispute.nft_nama}</p>
            <p className="text-xs text-muted-foreground">
              Seller: <span className="text-foreground">{dispute.seller_name}</span>
              {' → '}
              Buyer: <span className="text-foreground">{dispute.buyer_name}</span>
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {isApprove
              ? 'Poin buyer akan aktif dan neraca seller akan berkurang. Tindakan ini tidak dapat dibatalkan.'
              : 'NFT akan dikembalikan ke seller. Poin pending buyer dihapus. Tindakan ini tidak dapat dibatalkan.'}
          </p>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isApprove
              ? <><CheckCircle2 className="h-4 w-4 mr-1.5" />Transaksi Sah</>
              : <><XCircle className="h-4 w-4 mr-1.5" />Batalkan Transaksi</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dispute Card ─────────────────────────────────────────────────────────────

function DisputeCard({
  dispute, onResolved,
}: {
  dispute: DisputeItem;
  onResolved: (id: string) => void;
}) {
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-snug">{dispute.nft_nama}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground">{dispute.seller_name}</span>
              {' → '}
              <span className="font-medium text-foreground">{dispute.buyer_name}</span>
            </p>
          </div>
          <Badge
            variant="secondary"
            className="text-[10px] bg-red-100 text-red-800 border-red-300 shrink-0"
          >
            {dispute.type === 'buyback' ? 'Buyback' : 'Pembelian'}
          </Badge>
        </div>

        <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-400">
          <p className="font-medium mb-0.5">Alasan laporan:</p>
          <p className="italic">"{dispute.reason}"</p>
        </div>

        <p className="text-xs text-muted-foreground">{formatDate(dispute.created_at)}</p>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setDialog('reject')}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Batalkan Transaksi
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setDialog('approve')}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Transaksi Sah
          </Button>
        </div>
      </div>

      {dialog && (
        <ResolveDialog
          dispute={dispute}
          decision={dialog}
          onClose={() => setDialog(null)}
          onResolved={onResolved}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Recalculate state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<RecalcStats | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  // Disputes state
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState(true);

  const isAdmin = !authLoading && user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) router.replace('/');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    loadDisputes();
  }, [isAdmin]);

  async function loadDisputes() {
    setLoadingDisputes(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'purchase_disputes'),
        where('status', '==', 'pending_admin'),
        orderBy('created_at', 'desc'),
      ));

      if (snap.empty) { setDisputes([]); return; }

      // Batch-fetch NFT names + seller/buyer names
      const nftIds = [...new Set(snap.docs.map(d => d.data().nft_unit_id as string))];
      const sellerIds = [...new Set(snap.docs.map(d => d.data().seller_id as string))];
      const buyerIds = [...new Set(snap.docs.map(d => d.data().buyer_id as string))];
      const allUserIds = [...new Set([...sellerIds, ...buyerIds])];

      const [nftSnaps, userSnaps] = await Promise.all([
        Promise.all(nftIds.map(id => getDoc(doc(db, 'nft_units', id)))),
        Promise.all(allUserIds.map(id => getDoc(doc(db, 'users', id)))),
      ]);

      const nftNameMap = new Map<string, string>();
      nftSnaps.forEach((s, i) => {
        nftNameMap.set(nftIds[i], s.exists() ? (s.data().nama_nft as string) ?? '—' : '—');
      });

      const userNameMap = new Map<string, string>();
      userSnaps.forEach((s, i) => {
        userNameMap.set(
          allUserIds[i],
          s.exists() ? (s.data().displayName as string) || allUserIds[i].slice(0, 8) + '…' : '—',
        );
      });

      setDisputes(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nft_unit_id: data.nft_unit_id as string,
          nft_nama: nftNameMap.get(data.nft_unit_id as string) ?? '—',
          seller_id: data.seller_id as string,
          seller_name: userNameMap.get(data.seller_id as string) ?? '—',
          buyer_id: data.buyer_id as string,
          buyer_name: userNameMap.get(data.buyer_id as string) ?? '—',
          type: (data.type as string) ?? 'purchase',
          reason: (data.reason as string) ?? '',
          created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
        };
      }));
    } finally {
      setLoadingDisputes(false);
    }
  }

  function handleResolved(id: string) {
    setDisputes(prev => prev.filter(d => d.id !== id));
  }

  async function handleRecalculate() {
    setRunning(true);
    setResult(null);
    setRecalcError(null);
    setProgress(null);
    try {
      const stats = await recalculateAllDeveloperLevels((processed, total) => {
        setProgress({ current: processed, total });
      });
      setResult(stats);
    } catch (e) {
      setRecalcError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  if (authLoading || !isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Admin Tools</h1>
            {disputes.length > 0 && (
              <Badge className="bg-red-600 hover:bg-red-600 text-white text-xs px-2">
                {disputes.length} dispute
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Alat bantu untuk koreksi data dan operasi massal.
          </p>
        </div>

        {/* Purchase Disputes */}
        <Card className={disputes.length > 0 ? 'border-red-200 dark:border-red-900' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Purchase Disputes — Laporan Transaksi
              {disputes.length > 0 && (
                <Badge className="bg-red-100 text-red-800 border-red-300 text-xs ml-auto font-normal">
                  {disputes.length} pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs leading-snug">
              Laporan transaksi mencurigakan dari seller atau keberatan dari buyer.
              Setiap resolusi bersifat permanen dan tidak dapat dibatalkan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDisputes ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat laporan...
              </div>
            ) : disputes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Tidak ada laporan yang perlu ditindak.
              </p>
            ) : (
              <div className="space-y-3">
                {disputes.map(d => (
                  <DisputeCard key={d.id} dispute={d} onResolved={handleResolved} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recalculate Developer Levels */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Recalculate Developer Levels
            </CardTitle>
            <CardDescription className="text-xs leading-snug">
              Evaluasi ulang level semua user berdasarkan parameter{' '}
              <span className="font-mono">minimum_buyback_pct</span> dan{' '}
              <span className="font-mono">minimum_soldNfts_top_developer</span> yang aktif saat ini.
              Berguna setelah mengubah parameter di halaman{' '}
              <Link href="/parameters" className="underline underline-offset-2">Parameters</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleRecalculate} disabled={running} size="sm" className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {running ? 'Memproses...' : 'Jalankan'}
            </Button>

            {running && progress && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Memproses {progress.current} dari {progress.total} user...
                </p>
                <Progress value={pct} className="h-1.5" />
              </div>
            )}

            {recalcError && <p className="text-sm text-destructive">{recalcError}</p>}

            {result && !running && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-semibold">Selesai — {result.total} user dievaluasi</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md border bg-background p-3 space-y-1">
                    <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                      <ArrowUpRight className="h-4 w-4" />
                      <span className="text-xl font-bold">{result.upgraded}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight">naik ke<br />top_developer</p>
                  </div>
                  <div className="rounded-md border bg-background p-3 space-y-1">
                    <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                      <ArrowDownRight className="h-4 w-4" />
                      <span className="text-xl font-bold">{result.downgraded}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight">turun ke<br />developer_biasa</p>
                  </div>
                  <div className="rounded-md border bg-background p-3 space-y-1">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Minus className="h-4 w-4" />
                      <span className="text-xl font-bold">{result.unchanged}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight">tidak<br />berubah</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Link ke admin reports */}
        <Link
          href="/admin/reports"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Flag className="h-4 w-4" />
          Komentar Terlaporkan
          <ArrowUpRight className="h-3 w-3" />
        </Link>

      </div>
    </MainLayout>
  );
}
