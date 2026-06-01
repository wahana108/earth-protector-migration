'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  collection, doc, getDocs, getDoc,
  query, where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import {
  ImageOff, Loader2, ShoppingCart, Heart,
  Layers, AlertTriangle, ListOrdered, SkipForward,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Dialog as AlertDialog,
  DialogContent as AlertDialogContent,
  DialogHeader as AlertDialogHeader,
  DialogTitle as AlertDialogTitle,
  DialogFooter as AlertDialogFooter,
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getCommunityConfig } from '@/lib/community-config';
import { buyNftUnit, BuyError, skipFifoNft, SkipFifoError } from '@/lib/projects';
import type { NFTUnit, ProjectCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

function toNFTUnit(id: string, data: Record<string, unknown>): NFTUnit {
  return {
    id,
    project_id: data.project_id as string,
    developer_id: data.developer_id as string,
    owner_id: data.owner_id as string,
    nama_nft: data.nama_nft as string,
    nama_project: (data.nama_project as string) ?? '',
    gambar_url: (data.gambar_url as string) ?? '',
    kategori: (data.kategori as ProjectCategory) ?? 'lainnya',
    status: (data.status as NFTUnit['status']) ?? 'biasa',
    harga_jual: (data.harga_jual as number) ?? 0,
    harga_beli_terakhir: (data.harga_beli_terakhir as number) ?? 0,
    nilai_selisih: (data.nilai_selisih as number) ?? 0,
    for_sale: (data.for_sale as boolean) ?? false,
    in_pool: (data.in_pool as boolean) ?? false,
    digunakan_validasi: (data.digunakan_validasi as boolean) ?? false,
    project_validasi_id: (data.project_validasi_id as string | null) ?? null,
    like_count: (data.like_count as number) ?? 0,
    comment_count: (data.comment_count as number) ?? 0,
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
    transferred_at: (data.transferred_at as Timestamp)?.toDate?.() ?? undefined,
    fifo_skip_count: (data.fifo_skip_count as number) ?? 0,
    last_skipped_by: (data.last_skipped_by as string) ?? undefined,
    last_skip_reason: (data.last_skip_reason as string) ?? undefined,
  };
}

// ─── FIFO Queue Helper ────────────────────────────────────────────────────────

// Cari NFT teratas antrian FIFO yang bukan milik userId.
// NFT milik sendiri di-skip otomatis (transferred_at di-reset → geser ke belakang).
// Return null jika antrian kosong atau semua NFT milik sendiri.
async function fetchNextFifoNft(userId: string): Promise<NFTUnit | null> {
  const autoSkippedIds = new Set<string>();
  const MAX_AUTO_SKIP = 20;

  for (let i = 0; i < MAX_AUTO_SKIP; i++) {
    const snap = await getDocs(query(
      collection(db, 'nft_units'),
      where('in_pool', '==', true),
      where('for_sale', '==', true),
      orderBy('transferred_at', 'asc'),
      limit(1),
    ));

    if (snap.empty) return null;

    const d = snap.docs[0];
    const unit = toNFTUnit(d.id, d.data() as Record<string, unknown>);

    if (unit.developer_id !== userId && unit.owner_id !== userId) return unit;

    // Sudah pernah auto-skip ID ini → semua NFT milik sendiri
    if (autoSkippedIds.has(unit.id)) return null;

    autoSkippedIds.add(unit.id);
    try {
      await skipFifoNft(unit.id, userId, 'lewati_otomatis', 'NFT milik sendiri, dilewati otomatis');
    } catch {
      return null;
    }
  }

  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PoolMeta = {
  is_aktif: boolean;
  jumlah_nft_valid: number;
  kapasitas_aktif: number;
  total_jaminan: number;
};

// ─── Buy Dialog ───────────────────────────────────────────────────────────────

interface BuyDialogProps {
  unit: NFTUnit;
  buyerId: string;
  hargaDasar: number;
  batasAtas: number;
  onClose: () => void;
  onSuccess: (nftId: string) => void;
}

function BuyDialog({ unit, buyerId, hargaDasar, batasAtas, onClose, onSuccess }: BuyDialogProps) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setBuying(true);
    setError('');
    try {
      await buyNftUnit(unit.id, buyerId, hargaDasar, batasAtas);
      onSuccess(unit.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof BuyError ? err.message : 'Transaksi gagal. Coba lagi.');
    } finally {
      setBuying(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Konfirmasi Pembelian</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <p className="font-semibold leading-snug">{unit.nama_nft}</p>
            <p className="text-muted-foreground text-xs">{unit.nama_project}</p>
            <div className="pt-2 border-t space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga</span>
                <span className="font-bold">{formatIDR(unit.harga_jual)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Neracamu bertambah</span>
                <span className="font-semibold text-green-600">+{formatIDR(unit.nilai_selisih)}</span>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1 text-xs">
            <Layers className="h-3 w-3" />
            NFT dari Pool Rekomendasi
          </Badge>
          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={buying}>Batal</Button>
          <Button onClick={handleConfirm} disabled={buying}>
            {buying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Konfirmasi Beli
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skip Dialog ──────────────────────────────────────────────────────────────

const ALASAN_OPTIONS = [
  'NFT bermasalah',
  'Link bukti tidak valid',
  'Developer tidak responsif',
  'Alasan lain',
] as const;

type AlasanOption = (typeof ALASAN_OPTIONS)[number];

interface SkipDialogProps {
  unit: NFTUnit;
  userId: string;
  onClose: () => void;
  onSkipped: () => void;
}

function SkipDialog({ unit, userId, onClose, onSkipped }: SkipDialogProps) {
  const [alasan, setAlasan] = useState<AlasanOption>('NFT bermasalah');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const detailCukup = detail.trim().length >= 20;

  async function handleConfirm() {
    if (!detailCukup) return;
    setSubmitting(true);
    setError('');
    try {
      await skipFifoNft(unit.id, userId, alasan, detail.trim());
      onSkipped();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof SkipFifoError ? err.message : 'Gagal melewati. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Lewati Antrian FIFO</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4 py-1 text-sm">
          <div className="rounded-lg border p-3 space-y-1">
            <p className="font-semibold">{unit.nama_nft}</p>
            <p className="text-xs text-muted-foreground">{unit.nama_project}</p>
          </div>

          <div className="space-y-2">
            <Label>Alasan melewati</Label>
            <div className="space-y-2">
              {ALASAN_OPTIONS.map(opt => (
                <label
                  key={opt}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                    alasan === opt
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/40',
                  )}
                >
                  <input
                    type="radio"
                    name="alasan"
                    value={opt}
                    checked={alasan === opt}
                    onChange={() => setAlasan(opt)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skip-detail">
              Detail alasan
              <span className="text-muted-foreground font-normal ml-1">(min. 20 karakter)</span>
            </Label>
            <Textarea
              id="skip-detail"
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder="Jelaskan alasan lebih detail..."
              rows={3}
              className="resize-none text-sm"
              disabled={submitting}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className={detail.trim().length < 20 ? 'text-destructive' : 'text-green-600'}>
                {detail.trim().length}/20 karakter minimum
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2 leading-relaxed">
            NFT ini akan tetap di posisi teratas antrian FIFO. Alasan ini dicatat sebagai audit.
          </p>

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">{error}</p>
          )}
        </div>

        <AlertDialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!detailCukup || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Konfirmasi Lewati
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Pool Header ──────────────────────────────────────────────────────────────

interface PoolHeaderProps {
  meta: PoolMeta | null;
  kapasitasMinimum: number;
  loading: boolean;
}

function PoolHeader({ meta, kapasitasMinimum, loading }: PoolHeaderProps) {
  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  const jumlah = meta?.jumlah_nft_valid ?? 0;
  const isAktif = meta?.is_aktif ?? false;
  const pct = kapasitasMinimum > 0 ? Math.min(100, Math.round((jumlah / kapasitasMinimum) * 100)) : 0;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Pool Rekomendasi Komunitas</h2>
        </div>
        <Badge variant={isAktif ? 'default' : 'secondary'}>
          {isAktif ? 'Aktif' : 'Tidak Aktif'}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          NFT di pool: <span className="font-semibold text-foreground">{jumlah}</span>
        </span>
        <span>
          Kapasitas minimum: <span className="font-semibold text-foreground">{kapasitasMinimum}</span>
        </span>
      </div>

      <div className="space-y-1">
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground">{pct}% kapasitas terisi</p>
      </div>
    </div>
  );
}

// ─── NFT Pool Card ─────────────────────────────────────────────────────────────

interface NftPoolCardProps {
  unit: NFTUnit;
  currentUserId?: string;
  isTopDeveloper?: boolean;
  onBuy: (unit: NFTUnit) => void;
}

function NftPoolCard({ unit, currentUserId, isTopDeveloper, onBuy }: NftPoolCardProps) {
  const [imgError, setImgError] = useState(false);
  const isOwn = !!currentUserId && currentUserId === unit.owner_id;
  const canBuy = !!currentUserId && !isOwn && unit.for_sale && !isTopDeveloper;

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
      <div className="aspect-video bg-muted relative overflow-hidden shrink-0">
        <Link href={`/nft/${unit.id}`} className="absolute inset-0 z-0" aria-label={unit.nama_nft} />
        {unit.gambar_url && !imgError ? (
          <img
            src={unit.gambar_url}
            alt={unit.nama_nft}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-10 w-10" />
          </div>
        )}
        <div className="absolute top-2 left-2 z-10">
          <Badge className="text-xs gap-1 bg-amber-500 hover:bg-amber-500 text-white">
            <Layers className="h-2.5 w-2.5" />
            Pool
          </Badge>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <Link
            href={`/nft/${unit.id}`}
            className="font-semibold text-sm leading-snug line-clamp-1 hover:underline"
          >
            {unit.nama_nft}
          </Link>
          <p className="text-xs text-muted-foreground line-clamp-1">{unit.nama_project}</p>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <span className="font-bold text-sm">{formatIDR(unit.harga_jual)}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Heart className="h-3 w-3" />
            {unit.like_count}
          </span>
        </div>

        <Button
          size="sm"
          className="w-full h-8 text-xs gap-1"
          disabled={!canBuy}
          onClick={canBuy ? () => onBuy(unit) : undefined}
          title={
            !currentUserId ? 'Login untuk membeli' :
            isOwn ? 'Ini NFT milikmu' :
            isTopDeveloper ? 'Top Developer wajib membeli melalui antrian FIFO' :
            !unit.for_sale ? 'NFT tidak dijual' :
            'Beli NFT ini'
          }
        >
          <ShoppingCart className="h-3 w-3" />
          {isOwn ? 'Milikmu' : !unit.for_sale ? 'Tidak Dijual' : 'Beli'}
        </Button>
        {isTopDeveloper && !isOwn && unit.for_sale && (
          <p className="text-center text-[10px] text-muted-foreground leading-tight">
            Top Developer wajib membeli melalui antrian FIFO
          </p>
        )}
      </div>
    </div>
  );
}

// ─── FIFO Card ────────────────────────────────────────────────────────────────

interface FifoCardProps {
  unit: NFTUnit;
  userId: string;
  onBuy: (unit: NFTUnit) => void;
  onSkip: (unit: NFTUnit) => void;
}

function FifoCard({ unit, userId, onBuy, onSkip }: FifoCardProps) {
  const [imgError, setImgError] = useState(false);
  const isOwn = unit.owner_id === userId;
  const canBuy = !isOwn && unit.for_sale;

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden">
      <div className="flex gap-4 p-4">
        <div className="w-24 h-24 rounded-lg bg-muted overflow-hidden shrink-0">
          {unit.gambar_url && !imgError ? (
            <img
              src={unit.gambar_url}
              alt={unit.nama_nft}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ImageOff className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2 flex-wrap">
            <Link
              href={`/nft/${unit.id}`}
              className="font-semibold text-sm leading-snug hover:underline"
            >
              {unit.nama_nft}
            </Link>
            <Badge className="text-xs gap-1 bg-amber-500 hover:bg-amber-500 text-white shrink-0">
              <ListOrdered className="h-2.5 w-2.5" />
              Antrian #1
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{unit.nama_project}</p>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Harga: <span className="font-semibold text-foreground">{formatIDR(unit.harga_jual)}</span></span>
            <span>Selisih: <span className="font-semibold text-green-600">+{formatIDR(unit.nilai_selisih)}</span></span>
          </div>
          {(unit.fifo_skip_count ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Dilewati <span className="font-medium text-foreground">{unit.fifo_skip_count}×</span> sebelumnya
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              disabled={!canBuy}
              onClick={canBuy ? () => onBuy(unit) : undefined}
              title={isOwn ? 'Ini NFT milikmu' : 'Beli NFT ini'}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Beli Sekarang
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 text-muted-foreground"
              onClick={() => onSkip(unit)}
            >
              <SkipForward className="h-3.5 w-3.5" />
              Lewati
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PoolPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [poolMeta, setPoolMeta] = useState<PoolMeta | null>(null);
  const [kapasitasMinimum, setKapasitasMinimum] = useState(90);
  const [poolNfts, setPoolNfts] = useState<NFTUnit[]>([]);
  const [fifoNft, setFifoNft] = useState<NFTUnit | null>(null);
  const [isTopDeveloper, setIsTopDeveloper] = useState(false);
  const [buyTarget, setBuyTarget] = useState<NFTUnit | null>(null);
  const [skipTarget, setSkipTarget] = useState<NFTUnit | null>(null);
  const [config, setConfig] = useState<{ harga_dasar: number; batas_atas: number } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [poolSnap, cfg, nftsSnap] = await Promise.all([
        getDoc(doc(db, 'pool_rekomendasi', 'v1')),
        getCommunityConfig(),
        getDocs(query(
          collection(db, 'nft_units'),
          where('in_pool', '==', true),
          where('for_sale', '==', true),
          orderBy('like_count', 'desc'),
          limit(30),
        )),
      ]);

      if (poolSnap.exists()) {
        const d = poolSnap.data() as Record<string, unknown>;
        setPoolMeta({
          is_aktif: (d.is_aktif as boolean) ?? false,
          jumlah_nft_valid: (d.jumlah_nft_valid as number) ?? 0,
          kapasitas_aktif: (d.kapasitas_aktif as number) ?? 0,
          total_jaminan: (d.total_jaminan as number) ?? 0,
        });
      }

      if (cfg) {
        setKapasitasMinimum(cfg.kapasitas_pool_minimum);
        setConfig({ harga_dasar: cfg.harga_dasar, batas_atas: cfg.batas_atas });
      }

      setPoolNfts(
        nftsSnap.docs.map(d => toNFTUnit(d.id, d.data() as Record<string, unknown>)),
      );

      // Cek level user, lalu cari NFT FIFO yang valid (skip otomatis milik sendiri)
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.id));
        if (userSnap.exists()) {
          const ud = userSnap.data() as Record<string, unknown>;
          const isTopDev = (ud.level as string) === 'top_developer';
          setIsTopDeveloper(isTopDev);
          if (isTopDev) {
            const nextFifo = await fetchNextFifoNft(user.id);
            setFifoNft(nextFifo);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleBuySuccess(nftId: string) {
    setPoolNfts(prev => prev.map(u =>
      u.id === nftId ? { ...u, for_sale: false, owner_id: user?.id ?? u.owner_id } : u,
    ));
    if (fifoNft?.id === nftId) {
      // NFT teratas terbeli — reload untuk dapat NFT berikutnya
      loadData();
    }
    setBuyTarget(null);
  }

  function handleSkipSuccess() {
    setSkipTarget(null);
    setFifoNft(null);
    if (user) {
      fetchNextFifoNft(user.id)
        .then(next => setFifoNft(next))
        .catch(() => {});
    }
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-1">Pool Rekomendasi</h1>
          <p className="text-muted-foreground text-sm">
            NFT dari Top Developer yang dimasukkan ke antrian rekomendasi komunitas.
          </p>
        </div>

        {/* Pool Status Header */}
        <PoolHeader
          meta={poolMeta}
          kapasitasMinimum={kapasitasMinimum}
          loading={loading}
        />

        {/* Section B — FIFO Queue (top developer only) */}
        {!loading && isTopDeveloper && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">Antrian FIFO — Kewajiban Top Developer</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Sebagai Top Developer, kamu diharapkan membeli NFT berikutnya dalam antrian
              atau meninggalkan alasan jika melewatinya. NFT keluar dari antrian hanya setelah terbeli.
            </p>

            {fifoNft ? (
              <FifoCard
                unit={fifoNft}
                userId={user!.id}
                onBuy={setBuyTarget}
                onSkip={setSkipTarget}
              />
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Tidak ada NFT dari developer lain dalam antrian saat ini.
              </div>
            )}
          </section>
        )}

        {/* Section A — Grid semua NFT di pool */}
        <section className="space-y-3">
          <h2 className="font-semibold text-lg">NFT di Pool Rekomendasi</h2>

          {loading ? (
            <GridSkeleton />
          ) : poolNfts.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl">
              <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-lg font-semibold text-muted-foreground">Pool masih kosong</p>
              <p className="text-sm text-muted-foreground mt-1">
                Top Developer bisa transfer NFT mereka ke pool dari halaman Dashboard.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {poolNfts.map(unit => (
                  <NftPoolCard
                    key={unit.id}
                    unit={unit}
                    currentUserId={user?.id}
                    isTopDeveloper={isTopDeveloper}
                    onBuy={setBuyTarget}
                  />
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {poolNfts.length} NFT di pool · Diurutkan berdasarkan like terbanyak
              </p>
            </>
          )}
        </section>

      </div>

      {/* Buy Dialog */}
      {buyTarget && user && config && (
        <BuyDialog
          unit={buyTarget}
          buyerId={user.id}
          hargaDasar={config.harga_dasar}
          batasAtas={config.batas_atas}
          onClose={() => setBuyTarget(null)}
          onSuccess={handleBuySuccess}
        />
      )}

      {/* Skip Dialog */}
      {skipTarget && user && (
        <SkipDialog
          unit={skipTarget}
          userId={user.id}
          onClose={() => setSkipTarget(null)}
          onSkipped={handleSkipSuccess}
        />
      )}
    </MainLayout>
  );
}
