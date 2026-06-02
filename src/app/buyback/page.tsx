'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  collection, getDocs, query, where, Timestamp,
} from 'firebase/firestore';
import { RefreshCcw, Loader2 } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { buybackNftUnit, BuybackError } from '@/lib/projects';
import { cn } from '@/lib/utils';
import { getPlaceholder } from '@/lib/category-placeholders';
import type { NFTUnit, ProjectCategory } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    nama_nft: (data.nama_nft as string) ?? '',
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
  };
}

// ─── Buyback Dialog ───────────────────────────────────────────────────────────

interface BuybackDialogProps {
  unit: NFTUnit;
  ownerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function BuybackDialog({ unit, ownerId, onClose, onSuccess }: BuybackDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await buybackNftUnit(unit.id, ownerId);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof BuybackError ? err.message : 'Gagal melakukan buyback. Coba lagi.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Konfirmasi Buyback</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <p className="font-semibold leading-snug">{unit.nama_nft}</p>
            <p className="text-muted-foreground text-xs">{unit.nama_project}</p>
            <div className="pt-2 border-t space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga buyback</span>
                <span className="font-bold">{formatIDR(unit.harga_beli_terakhir)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efek neracamu</span>
                <span className={cn(
                  'font-semibold',
                  unit.nilai_selisih > 0 ? 'text-destructive' : 'text-muted-foreground',
                )}>
                  {unit.nilai_selisih > 0
                    ? `−${formatIDR(unit.nilai_selisih)}`
                    : 'Tidak ada perubahan'}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            NFT akan dikembalikan ke developer. Tindakan ini tidak dapat dibatalkan.
          </p>

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Konfirmasi Buyback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────

function BuybackCard({
  unit, ownerId, onSuccess,
}: {
  unit: NFTUnit;
  ownerId: string;
  onSuccess: () => void;
}) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
        {/* Gambar */}
        <div className="aspect-video bg-muted relative overflow-hidden shrink-0">
          <img
            src={unit.gambar_url || getPlaceholder(unit.kategori)}
            alt={unit.nama_nft}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(unit.kategori); }}
          />
          <div className="absolute top-1.5 left-1.5">
            <Badge
              variant={unit.status === 'valid' ? 'default' : 'secondary'}
              className="text-[10px] px-1.5 py-0 capitalize"
            >
              {unit.status}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col gap-2 flex-1">
          <div>
            <p className="font-semibold text-sm leading-snug">{unit.nama_nft}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{unit.nama_project}</p>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Harga buyback</span>
              <span className="font-semibold">{formatIDR(unit.harga_beli_terakhir)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efek neraca</span>
              <span className={cn(
                'font-semibold',
                unit.nilai_selisih > 0 ? 'text-destructive' : 'text-muted-foreground',
              )}>
                {unit.nilai_selisih > 0 ? `−${formatIDR(unit.nilai_selisih)}` : '—'}
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-auto pt-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              asChild
            >
              <Link href={`/nft/${unit.id}`}>Detail</Link>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 text-xs"
              onClick={() => setShowDialog(true)}
            >
              <RefreshCcw className="h-3.5 w-3.5 mr-1" />
              Buyback
            </Button>
          </div>
        </div>
      </div>

      {showDialog && (
        <BuybackDialog
          unit={unit}
          ownerId={ownerId}
          onClose={() => setShowDialog(false)}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuybackPage() {
  const { user } = useAuth();
  const [units, setUnits] = useState<NFTUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUnits = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'nft_units'),
        where('owner_id', '==', user.id),
      );
      const snap = await getDocs(q);
      const all = snap.docs.map(d => toNFTUnit(d.id, d.data() as Record<string, unknown>));
      // Filter: bukan milik developer sendiri, tidak sedang divalidasi, tidak di pool
      const buybackable = all.filter(
        u => u.developer_id !== user.id && !u.digunakan_validasi && !u.in_pool,
      );
      setUnits(buybackable);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16 space-y-4">
          <h2 className="text-2xl font-bold">Login diperlukan</h2>
          <p className="text-muted-foreground">Login untuk melihat NFT yang bisa di-buyback.</p>
          <Button asChild><Link href="/login">Login</Link></Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <RefreshCcw className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold">Buyback NFT</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            NFT yang kamu miliki dan bisa dikembalikan ke developer asalnya.
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : units.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <RefreshCcw className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-lg">Tidak ada NFT yang bisa di-buyback</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              NFT yang memenuhi syarat buyback adalah NFT yang kamu beli dari developer lain
              dan tidak sedang digunakan untuk validasi atau berada di pool.
            </p>
            <Button variant="outline" asChild className="mt-2">
              <Link href="/explore">Jelajahi NFT</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {units.length} NFT tersedia untuk buyback
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {units.map(unit => (
                <BuybackCard
                  key={unit.id}
                  unit={unit}
                  ownerId={user.id}
                  onSuccess={loadUnits}
                />
              ))}
            </div>
          </>
        )}

      </div>
    </MainLayout>
  );
}
