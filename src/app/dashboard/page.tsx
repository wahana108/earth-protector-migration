'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection, doc, getDoc, getDocs,
  query, where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import {
  PlusCircle, Loader2, Lock, Pencil, ImageOff,
  RefreshCcw, TrendingDown, TrendingUp, Minus, Upload,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { toggleForSale, updateProjectGambar, buybackNftUnit, BuybackError, transferToPool, TransferPoolError } from '@/lib/projects';
import type { NFTUnit, NeracaLog, Project, ProjectCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

function formatDelta(delta: number) {
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${formatIDR(delta)}`;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (h < 24) return `${h} jam lalu`;
  if (d < 30) return `${d} hari lalu`;
  return date.toLocaleDateString('id-ID');
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
  };
}

function toNeracaLog(id: string, data: Record<string, unknown>): NeracaLog {
  return {
    id,
    type: (data.type as NeracaLog['type']) ?? 'beli',
    nft_unit_id: data.nft_unit_id as string,
    nama_nft: (data.nama_nft as string) ?? '',
    harga_transaksi: (data.harga_transaksi as number) ?? 0,
    nilai_selisih: (data.nilai_selisih as number) ?? 0,
    delta: (data.delta as number) ?? 0,
    counterparty_id: (data.counterparty_id as string) ?? '',
    timestamp: (data.timestamp as Timestamp)?.toDate?.() ?? new Date(),
  };
}

function toProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    developer_id: data.developer_id as string,
    nama_project: (data.nama_project as string) ?? '',
    deskripsi_project: (data.deskripsi_project as string) ?? '',
    gambar_url: (data.gambar_url as string) ?? '',
    link_bukti: (data.link_bukti as string) ?? '',
    tanggal_tindakan: (data.tanggal_tindakan as string) ?? '',
    kategori: (data.kategori as ProjectCategory) ?? 'lainnya',
    lokasi_tindakan: (data.lokasi_tindakan as string) ?? '',
    nilai_project: (data.nilai_project as number) ?? 0,
    harga_jual: (data.harga_jual as number) ?? 0,
    jumlah_nft: (data.jumlah_nft as number) ?? 0,
    status_project: (data.status_project as Project['status_project']) ?? 'aktif',
    daftar_invalidasi: (data.daftar_invalidasi as boolean) ?? false,
    pool_jaminan: (data.pool_jaminan as number) ?? 0,
    jumlah_validator: (data.jumlah_validator as number) ?? 0,
    validator_list: [],
    like_count: (data.like_count as number) ?? 0,
    anomali_flag: (data.anomali_flag as boolean) ?? false,
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
  };
}

const LOG_TYPE_LABELS: Record<NeracaLog['type'], string> = {
  beli: 'Beli', beli_pool: 'Beli Pool', jual: 'Jual', validasi: 'Validasi', buyback: 'Buyback',
  level_change: 'Level', transfer_pool: 'Pool', lewati_fifo: 'Lewati',
  fee_keluar: 'Fee Keluar', fee_validator: 'Fee Validator',
  revalidasi_keluar: 'Revalidasi Keluar', revalidasi_masuk: 'Revalidasi Masuk',
};

// ─── Buyback Dialog ───────────────────────────────────────────────────────────

interface BuybackDialogProps {
  unit: NFTUnit;
  ownerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function BuybackDialog({ unit, ownerId, onClose, onSuccess }: BuybackDialogProps) {
  const { emailVerified } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!emailVerified) {
      setError('Verifikasi email Anda terlebih dahulu sebelum melakukan transaksi. Cek inbox email Anda atau klik \'Kirim Ulang\' di banner atas.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await buybackNftUnit(unit.id, ownerId);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof BuybackError
          ? err.message
          : 'Gagal melakukan buyback. Coba lagi.',
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
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Konfirmasi Buyback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Transfer ke Pool Dialog ──────────────────────────────────────────────────

interface TransferPoolDialogProps {
  unit: NFTUnit;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function TransferPoolDialog({ unit, userId, onClose, onSuccess }: TransferPoolDialogProps) {
  const { emailVerified } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!emailVerified) {
      setError('Verifikasi email Anda terlebih dahulu sebelum melakukan transaksi. Cek inbox email Anda atau klik \'Kirim Ulang\' di banner atas.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await transferToPool(unit.id, userId);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof TransferPoolError
          ? err.message
          : 'Gagal transfer ke pool. Coba lagi.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Transfer ke Pool Rekomendasi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <p className="font-semibold leading-snug">{unit.nama_nft}</p>
            <p className="text-muted-foreground text-xs">{unit.nama_project}</p>
            <div className="pt-2 border-t">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga jual</span>
                <span className="font-bold">{formatIDR(unit.harga_jual)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            NFT akan otomatis dipasang untuk dijual{' '}
            <span className="font-medium text-foreground">(for_sale = true)</span>{' '}
            dan masuk antrian pool rekomendasi komunitas.
          </p>

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Transfer ke Pool
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Gambar Project Dialog ───────────────────────────────────────────────

interface EditProjectGambarDialogProps {
  project: Project;
  onClose: () => void;
  onSaved: (projectId: string, newUrl: string) => void;
}

function EditProjectGambarDialog({ project, onClose, onSaved }: EditProjectGambarDialogProps) {
  const [url, setUrl] = useState(project.gambar_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    try { new URL(url); } catch { setError('Harus URL yang valid.'); return; }
    setSaving(true);
    setError('');
    try {
      await updateProjectGambar(project.id, url);
      onSaved(project.id, url);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Gambar Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm font-medium">{project.nama_project}</p>
          <div className="space-y-2">
            <Label htmlFor="proj-gambar-url">URL Gambar Baru</Label>
            <Input
              id="proj-gambar-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Akan mengupdate gambar di semua {project.jumlah_nft} NFT dalam project ini.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section: Ringkasan Neraca ────────────────────────────────────────────────

interface RingkasanProps {
  totalPoin: number;
  nftDimiliki: number;
  soldNfts: number;
  buybackCount: number;
}

function RingkasanNeraca({ totalPoin, nftDimiliki, soldNfts, buybackCount }: RingkasanProps) {
  const buybackPct = soldNfts > 0 ? Math.round((buybackCount / soldNfts) * 100) : 0;
  const isPositif = totalPoin >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Total Poin Neraca</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn('text-2xl font-bold', isPositif ? 'text-green-600' : 'text-destructive')}>
            {totalPoin >= 0 ? '+' : ''}{formatIDR(totalPoin)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isPositif ? 'akumulasi dari pembelian' : 'akumulasi dari penjualan'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">NFT Dimiliki</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{nftDimiliki}</p>
          <p className="text-xs text-muted-foreground mt-0.5">unit saat ini</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">NFT Terjual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{soldNfts}</p>
          <p className="text-xs text-muted-foreground mt-0.5">total semua transaksi jual</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Persentase Buyback</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={cn('text-2xl font-bold', buybackPct >= 50 ? 'text-green-600' : '')}>
            {buybackPct}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {soldNfts > 0 ? `${buybackCount} dari ${soldNfts} terjual` : 'belum ada penjualan'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Section: Daftar NFT Dimiliki ────────────────────────────────────────────

interface DaftarNFTProps {
  units: NFTUnit[];
  toggling: string | null;
  isTopDeveloper: boolean;
  onToggleForSale: (unit: NFTUnit) => void;
  onBuyback: (unit: NFTUnit) => void;
  onTransferPool: (unit: NFTUnit) => void;
}

function DaftarNFT({ units, toggling, isTopDeveloper, onToggleForSale, onBuyback, onTransferPool }: DaftarNFTProps) {
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  if (units.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground">
        <p>Belum ada NFT yang kamu miliki.</p>
        <Button variant="outline" className="mt-3" asChild>
          <Link href="/explore">Beli NFT di Explorer</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {units.map((unit) => {
        const imgErr = imgErrors.has(unit.id);
        const locked = unit.digunakan_validasi;
        const canBuyback = !locked && unit.owner_id !== unit.developer_id;

        return (
          <div
            key={unit.id}
            className="flex gap-3 rounded-xl border bg-card p-3 items-start"
          >
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
              {unit.gambar_url && !imgErr ? (
                <img
                  src={unit.gambar_url}
                  alt={unit.nama_nft}
                  className="w-full h-full object-cover"
                  onError={() => setImgErrors((prev) => new Set(prev).add(unit.id))}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageOff className="h-5 w-5" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-start gap-2 flex-wrap">
                <p className="font-semibold text-sm leading-snug">{unit.nama_nft}</p>
                {locked && (
                  <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                    <Lock className="h-2.5 w-2.5" />
                    Dipakai Validasi
                  </Badge>
                )}
                {unit.for_sale && !locked && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-300 shrink-0">
                    Dijual
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{unit.nama_project}</p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>Beli: <span className="text-foreground font-medium">{formatIDR(unit.harga_beli_terakhir)}</span></span>
                <span>Selisih: <span className={cn('font-medium', unit.nilai_selisih > 0 ? 'text-green-600' : unit.nilai_selisih < 0 ? 'text-destructive' : 'text-foreground')}>
                  {unit.nilai_selisih >= 0 ? '+' : ''}{formatIDR(unit.nilai_selisih)}
                </span></span>
              </div>
            </div>

            {/* Tombol */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <Button
                size="sm"
                variant={unit.for_sale ? 'outline' : 'default'}
                className="h-7 text-xs px-3"
                disabled={locked || toggling === unit.id}
                onClick={() => onToggleForSale(unit)}
                title={locked ? 'Sedang dipakai validasi' : unit.for_sale ? 'Stop menjual' : 'Pasang untuk dijual'}
              >
                {toggling === unit.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : unit.for_sale ? 'Stop Jual' : 'Jual'
                }
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-3"
                disabled={!canBuyback}
                onClick={() => canBuyback && onBuyback(unit)}
                title={
                  locked ? 'NFT sedang dipakai validasi' :
                  !canBuyback ? 'NFT masih di tangan developer' :
                  'Kembalikan NFT ke developer'
                }
              >
                <RefreshCcw className="h-3 w-3 mr-1" />
                Buyback
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-3"
                disabled={!isTopDeveloper || locked || unit.in_pool}
                onClick={() => isTopDeveloper && !locked && !unit.in_pool && onTransferPool(unit)}
                title={
                  !isTopDeveloper ? 'Hanya untuk Top Developer' :
                  unit.in_pool ? 'NFT sudah di pool' :
                  locked ? 'NFT sedang dipakai validasi' :
                  'Transfer ke Pool Rekomendasi'
                }
              >
                <Upload className="h-3 w-3 mr-1" />
                {unit.in_pool ? 'Di Pool' : 'Ke Pool'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section: Log Transaksi ───────────────────────────────────────────────────

function LogTransaksi({ logs }: { logs: NeracaLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Belum ada transaksi.
      </p>
    );
  }

  return (
    <div className="divide-y rounded-xl border overflow-hidden">
      {logs.map((log) => {
        const isPos = log.delta > 0;
        const isNeg = log.delta < 0;

        return (
          <div key={log.id} className="flex items-center gap-3 px-4 py-3 bg-card text-sm">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
              isPos ? 'bg-green-50 text-green-600' : isNeg ? 'bg-red-50 text-destructive' : 'bg-muted text-muted-foreground',
            )}>
              {isPos ? <TrendingUp className="h-4 w-4" /> : isNeg ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-medium leading-snug truncate">{log.nama_nft}</p>
              <p className="text-xs text-muted-foreground">
                {LOG_TYPE_LABELS[log.type]} · {relativeTime(log.timestamp)}
              </p>
            </div>

            <span className={cn(
              'font-bold shrink-0',
              isPos ? 'text-green-600' : isNeg ? 'text-destructive' : 'text-muted-foreground',
            )}>
              {formatDelta(log.delta)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section: Project Saya ────────────────────────────────────────────────────

interface ProjectSayaProps {
  projects: Project[];
  ownedCountByProject: Record<string, number>;
  onEditGambar: (project: Project) => void;
}

function ProjectSaya({ projects, ownedCountByProject, onEditGambar }: ProjectSayaProps) {
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const stillOwned = ownedCountByProject[project.id] ?? 0;
        const terjual = project.jumlah_nft - stillOwned;
        const imgErr = imgErrors.has(project.id);

        return (
          <div key={project.id} className="flex gap-3 rounded-xl border bg-card p-3 items-start">
            <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0 relative group/img">
              {project.gambar_url && !imgErr ? (
                <img
                  src={project.gambar_url}
                  alt={project.nama_project}
                  className="w-full h-full object-cover"
                  onError={() => setImgErrors((prev) => new Set(prev).add(project.id))}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageOff className="h-5 w-5" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-semibold text-sm leading-snug">{project.nama_project}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {project.kategori} · {project.lokasi_tindakan}
              </p>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>
                  Terjual:
                  <span className="text-foreground font-medium ml-1">{terjual}/{project.jumlah_nft}</span>
                </span>
                <span>
                  ♥
                  <span className="text-foreground font-medium ml-1">{project.like_count}</span>
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2 shrink-0 gap-1"
              onClick={() => onEditGambar(project)}
            >
              <Pencil className="h-3 w-3" />
              Gambar
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-1"><Skeleton className="h-3 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-28" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [totalPoin, setTotalPoin] = useState(0);
  const [soldNfts, setSoldNfts] = useState(0);
  const [buybackCount, setBuybackCount] = useState(0);
  const [ownedUnits, setOwnedUnits] = useState<NFTUnit[]>([]);
  const [logs, setLogs] = useState<NeracaLog[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [isTopDeveloper, setIsTopDeveloper] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editProjectTarget, setEditProjectTarget] = useState<Project | null>(null);
  const [buybackTarget, setBuybackTarget] = useState<NFTUnit | null>(null);
  const [transferPoolTarget, setTransferPoolTarget] = useState<NFTUnit | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [userSnap, unitsSnap, logsSnap, projectsSnap] = await Promise.all([
        getDoc(doc(db, 'users', user.id)),
        getDocs(query(collection(db, 'nft_units'), where('owner_id', '==', user.id))),
        getDocs(query(
          collection(db, 'users', user.id, 'neraca_log'),
          orderBy('timestamp', 'desc'),
          limit(20),
        )),
        getDocs(query(collection(db, 'projects'), where('developer_id', '==', user.id))),
      ]);

      if (userSnap.exists()) {
        const d = userSnap.data();
        setTotalPoin((d.total_poin as number) ?? 0);
        setSoldNfts((d.soldNfts as number) ?? 0);
        setBuybackCount((d.buybackCount as number) ?? 0);
        setIsTopDeveloper((d.level as string) === 'top_developer');
      }

      setOwnedUnits(
        unitsSnap.docs.map((d) => toNFTUnit(d.id, d.data() as Record<string, unknown>)),
      );
      setLogs(
        logsSnap.docs.map((d) => toNeracaLog(d.id, d.data() as Record<string, unknown>)),
      );
      setMyProjects(
        projectsSnap.docs.map((d) => toProject(d.id, d.data() as Record<string, unknown>)),
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggleForSale(unit: NFTUnit) {
    const newVal = !unit.for_sale;
    setToggling(unit.id);
    setOwnedUnits((prev) =>
      prev.map((u) => (u.id === unit.id ? { ...u, for_sale: newVal } : u)),
    );
    try {
      await toggleForSale(unit.id, newVal);
    } catch {
      setOwnedUnits((prev) =>
        prev.map((u) => (u.id === unit.id ? { ...u, for_sale: !newVal } : u)),
      );
    } finally {
      setToggling(null);
    }
  }

  function handleProjectGambarSaved(projectId: string, newUrl: string) {
    setMyProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, gambar_url: newUrl } : p)),
    );
    setOwnedUnits((prev) =>
      prev.map((u) => (u.project_id === projectId ? { ...u, gambar_url: newUrl } : u)),
    );
  }

  function handleBuybackSuccess() {
    setBuybackTarget(null);
    loadData();
  }

  function handleTransferPoolSuccess(unitId: string) {
    setTransferPoolTarget(null);
    setOwnedUnits(prev =>
      prev.map(u => u.id === unitId ? { ...u, in_pool: true, for_sale: true } : u),
    );
  }

  const ownedCountByProject = ownedUnits.reduce<Record<string, number>>((acc, u) => {
    acc[u.project_id] = (acc[u.project_id] ?? 0) + 1;
    return acc;
  }, {});

  if (authLoading || (!user && !authLoading)) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-0.5">Dashboard</h1>
            <p className="text-muted-foreground text-sm">{user?.displayName ?? user?.email}</p>
          </div>
          <Button asChild>
            <Link href="/create" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              Project Baru
            </Link>
          </Button>
        </div>

        {loading ? <DashboardSkeleton /> : (
          <>
            {/* ── 1. Ringkasan Neraca ── */}
            <section className="space-y-3">
              <h2 className="font-semibold text-lg">Ringkasan Neraca</h2>
              <RingkasanNeraca
                totalPoin={totalPoin}
                nftDimiliki={ownedUnits.length}
                soldNfts={soldNfts}
                buybackCount={buybackCount}
              />
            </section>

            {/* ── 2. NFT Dimiliki ── */}
            <section className="space-y-3">
              <h2 className="font-semibold text-lg">
                NFT Dimiliki
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({ownedUnits.length} unit)
                </span>
              </h2>
              <DaftarNFT
                units={ownedUnits}
                toggling={toggling}
                isTopDeveloper={isTopDeveloper}
                onToggleForSale={handleToggleForSale}
                onBuyback={setBuybackTarget}
                onTransferPool={setTransferPoolTarget}
              />
            </section>

            {/* ── 3. Log Transaksi ── */}
            <section className="space-y-3">
              <h2 className="font-semibold text-lg">
                Log Transaksi
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  (20 terakhir)
                </span>
              </h2>
              <LogTransaksi logs={logs} />
            </section>

            {/* ── 4. Project Saya ── */}
            {myProjects.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-semibold text-lg">
                  Project Saya
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({myProjects.length} project)
                  </span>
                </h2>
                <ProjectSaya
                  projects={myProjects}
                  ownedCountByProject={ownedCountByProject}
                  onEditGambar={setEditProjectTarget}
                />
              </section>
            )}
          </>
        )}
      </div>

      {/* Edit gambar project dialog */}
      {editProjectTarget && (
        <EditProjectGambarDialog
          project={editProjectTarget}
          onClose={() => setEditProjectTarget(null)}
          onSaved={handleProjectGambarSaved}
        />
      )}

      {/* Buyback dialog */}
      {buybackTarget && user && (
        <BuybackDialog
          unit={buybackTarget}
          ownerId={user.id}
          onClose={() => setBuybackTarget(null)}
          onSuccess={handleBuybackSuccess}
        />
      )}

      {/* Transfer ke Pool dialog */}
      {transferPoolTarget && user && (
        <TransferPoolDialog
          unit={transferPoolTarget}
          userId={user.id}
          onClose={() => setTransferPoolTarget(null)}
          onSuccess={() => handleTransferPoolSuccess(transferPoolTarget.id)}
        />
      )}
    </MainLayout>
  );
}
