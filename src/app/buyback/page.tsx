'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  collection, getDocs, query, where, Timestamp, orderBy,
} from 'firebase/firestore';
import {
  RefreshCcw, Loader2, Clock, CheckCircle2, XCircle,
  ExternalLink, AlertTriangle,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import {
  createBuybackRequest,
  cancelBuybackRequest,
  completeBuybackRequest,
  disputeBuybackRequest,
  BuybackRequestError,
  RateLimitError,
} from '@/lib/projects';
import { cn } from '@/lib/utils';
import { getPlaceholder } from '@/lib/category-placeholders';
import type { NFTUnit, ProjectCategory } from '@/lib/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

type BuybackReqData = {
  id: string;
  nft_unit_id: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'completed' | 'cancelled' | 'auto_completed' | 'disputed';
  proof_link: string | null;
  rejection_reason: string | null;
  requester_note: string | null;
  harga_buyback: number;
  nilai_selisih: number;
  auto_complete_at: Date | null;
  created_at: Date;
};

type NFTWithReq = {
  nft: NFTUnit;
  request: BuybackReqData | null;
};

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
    buyback_pending: (data.buyback_pending as boolean) ?? false,
    like_count: (data.like_count as number) ?? 0,
    comment_count: (data.comment_count as number) ?? 0,
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
  };
}

function toBuybackReq(id: string, data: Record<string, unknown>): BuybackReqData {
  return {
    id,
    nft_unit_id: data.nft_unit_id as string,
    status: data.status as BuybackReqData['status'],
    proof_link: (data.proof_link as string | null) ?? null,
    rejection_reason: (data.rejection_reason as string | null) ?? null,
    requester_note: (data.requester_note as string | null) ?? null,
    harga_buyback: (data.harga_buyback as number) ?? 0,
    nilai_selisih: (data.nilai_selisih as number) ?? 0,
    auto_complete_at: (data.auto_complete_at as Timestamp)?.toDate?.() ?? null,
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
  };
}

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

function RequestDialog({
  unit, ownerId, onClose, onSuccess,
}: {
  unit: NFTUnit;
  ownerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await createBuybackRequest(unit.id, ownerId, note.trim() || null);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('[createBuybackRequest]', err);
      setError(err instanceof BuybackRequestError ? err.message : 'Gagal membuat permintaan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Request Buyback</DialogTitle>
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
                <span className={cn('font-semibold', unit.nilai_selisih > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {unit.nilai_selisih > 0 ? `−${formatIDR(unit.nilai_selisih)}` : 'Tidak ada perubahan'}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Catatan untuk seller (opsional)</Label>
            <Textarea
              placeholder="Alasan atau pesan untuk developer…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Permintaan ini akan dikirim ke developer. NFT akan dikembalikan setelah developer mengkonfirmasi.
          </p>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Kirim Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  requestId, requesterId, onClose, onSuccess,
}: {
  requestId: string;
  requesterId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await cancelBuybackRequest(requestId, requesterId);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof BuybackRequestError ? err.message : 'Gagal membatalkan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Batalkan Permintaan</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-sm text-muted-foreground">
            Permintaan buyback akan dibatalkan dan NFT bisa di-request lagi nanti.
          </p>
          {error && <p className="mt-3 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Kembali</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ya, Batalkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DisputeDialog({
  requestId, requesterId, onClose, onSuccess,
}: {
  requestId: string;
  requesterId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDispute() {
    if (!reason.trim()) { setError('Alasan keberatan wajib diisi.'); return; }
    setLoading(true);
    setError('');
    try {
      await disputeBuybackRequest(requestId, requesterId, reason.trim());
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof BuybackRequestError ? err.message : 'Gagal mengajukan keberatan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Ajukan Keberatan</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Jelaskan alasan keberatanmu. Kasus ini akan diserahkan ke admin untuk ditinjau.
          </p>
          <Textarea
            placeholder="Alasan keberatan…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={handleDispute} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ajukan Keberatan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({
  unit, request, ownerId, onClose, onSuccess,
}: {
  unit: NFTUnit;
  request: BuybackReqData;
  ownerId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await completeBuybackRequest(request.id, ownerId);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof BuybackRequestError || err instanceof RateLimitError ? (err as Error).message : 'Gagal menyelesaikan buyback. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Selesaikan Buyback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <p className="font-semibold leading-snug">{unit.nama_nft}</p>
            <div className="pt-2 border-t space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga buyback</span>
                <span className="font-bold">{formatIDR(request.harga_buyback)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efek neracamu</span>
                <span className={cn('font-semibold', request.nilai_selisih > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                  {request.nilai_selisih > 0 ? `−${formatIDR(request.nilai_selisih)}` : 'Tidak ada perubahan'}
                </span>
              </div>
            </div>
          </div>
          {request.proof_link && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Bukti dari developer:</p>
              <a
                href={request.proof_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-700 dark:text-green-400 hover:underline flex items-center gap-1 text-xs font-medium break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {request.proof_link}
              </a>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            NFT akan dikembalikan ke developer. Tindakan ini tidak dapat dibatalkan.
          </p>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
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

type DialogType = 'request' | 'cancel' | 'complete' | 'dispute' | null;

function BuybackCard({
  item, ownerId, onSuccess,
}: {
  item: NFTWithReq;
  ownerId: string;
  onSuccess: () => void;
}) {
  const [dialog, setDialog] = useState<DialogType>(null);
  const { nft, request } = item;

  const statusBadge = () => {
    if (!request) return null;
    if (request.status === 'pending') return (
      <Badge variant="secondary" className="text-xs gap-1 bg-yellow-100 text-yellow-800 border-yellow-300">
        <Clock className="h-3 w-3" />
        Menunggu konfirmasi
      </Badge>
    );
    if (request.status === 'confirmed') return (
      <Badge variant="secondary" className="text-xs gap-1 bg-green-100 text-green-800 border-green-300">
        <CheckCircle2 className="h-3 w-3" />
        Developer setuju
      </Badge>
    );
    if (request.status === 'rejected') return (
      <Badge variant="secondary" className="text-xs gap-1 bg-red-100 text-red-800 border-red-300">
        <XCircle className="h-3 w-3" />
        Ditolak
      </Badge>
    );
    return null;
  };

  const actionButtons = () => {
    if (request?.status === 'pending') {
      return (
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => setDialog('cancel')}>
          Batalkan Request
        </Button>
      );
    }
    if (request?.status === 'confirmed') {
      return (
        <div className="flex gap-1.5 w-full">
          <Button size="sm" variant="outline" className="flex-1 text-xs border-red-200 text-red-700 hover:bg-red-50" onClick={() => setDialog('dispute')}>
            Keberatan
          </Button>
          <Button size="sm" variant="default" className="flex-1 text-xs" onClick={() => setDialog('complete')}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Selesaikan
          </Button>
        </div>
      );
    }
    return (
      <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => setDialog('request')}>
        <RefreshCcw className="h-3.5 w-3.5 mr-1" />
        {request?.status === 'rejected' ? 'Request Baru' : 'Request Buyback'}
      </Button>
    );
  };

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden flex flex-col">
        <div className="aspect-video bg-muted relative overflow-hidden shrink-0">
          <img
            src={nft.gambar_url || getPlaceholder(nft.kategori)}
            alt={nft.nama_nft}
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(nft.kategori); }}
          />
          <div className="absolute top-1.5 left-1.5">
            <Badge variant={nft.status === 'valid' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 capitalize">
              {nft.status}
            </Badge>
          </div>
        </div>

        <div className="p-3 flex flex-col gap-2 flex-1">
          <div>
            <p className="font-semibold text-sm leading-snug">{nft.nama_nft}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{nft.nama_project}</p>
          </div>

          {/* Status badge */}
          {statusBadge() && <div>{statusBadge()}</div>}

          {/* Rejection reason */}
          {request?.status === 'rejected' && request.rejection_reason && (
            <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 px-2.5 py-2 text-xs text-red-700 dark:text-red-400 flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span><span className="font-medium">Alasan penolakan:</span> {request.rejection_reason}</span>
            </div>
          )}

          {/* Countdown auto-complete */}
          {request?.status === 'confirmed' && (() => {
            const days = daysUntil(request.auto_complete_at);
            return days !== null ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {days === 0 ? 'Segera auto-complete' : `Auto-complete dalam ${days} hari`}
              </p>
            ) : null;
          })()}

          {/* Confirmed: show proof link */}
          {request?.status === 'confirmed' && request.proof_link && (
            <a
              href={request.proof_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-700 dark:text-green-400 hover:underline flex items-center gap-1 truncate"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              Lihat bukti developer
            </a>
          )}

          <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Harga buyback</span>
              <span className="font-semibold">{formatIDR(nft.harga_beli_terakhir)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efek neraca</span>
              <span className={cn('font-semibold', nft.nilai_selisih > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                {nft.nilai_selisih > 0 ? `−${formatIDR(nft.nilai_selisih)}` : '—'}
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-auto pt-1">
            <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
              <Link href={`/nft/${nft.id}`}>Detail</Link>
            </Button>
            {actionButtons()}
          </div>
        </div>
      </div>

      {dialog === 'request' && (
        <RequestDialog unit={nft} ownerId={ownerId} onClose={() => setDialog(null)} onSuccess={onSuccess} />
      )}
      {dialog === 'cancel' && request && (
        <CancelDialog requestId={request.id} requesterId={ownerId} onClose={() => setDialog(null)} onSuccess={onSuccess} />
      )}
      {dialog === 'complete' && request && (
        <CompleteDialog unit={nft} request={request} ownerId={ownerId} onClose={() => setDialog(null)} onSuccess={onSuccess} />
      )}
      {dialog === 'dispute' && request && (
        <DisputeDialog requestId={request.id} requesterId={ownerId} onClose={() => setDialog(null)} onSuccess={onSuccess} />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuybackPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NFTWithReq[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [nftsSnap, reqsSnap] = await Promise.all([
        getDocs(query(collection(db, 'nft_units'), where('owner_id', '==', user.id))),
        getDocs(query(
          collection(db, 'buyback_requests'),
          where('requester_id', '==', user.id),
          orderBy('created_at', 'desc'),
        )),
      ]);

      const allReqs = reqsSnap.docs.map(d => toBuybackReq(d.id, d.data() as Record<string, unknown>));

      // Lazy eval: auto-complete buyback request yang sudah melewati batas waktu
      const nowMs = Date.now();
      const expiredReqs = allReqs.filter(r =>
        r.status === 'confirmed' &&
        r.auto_complete_at &&
        nowMs > r.auto_complete_at.getTime(),
      );
      if (expiredReqs.length > 0) {
        await Promise.all(
          expiredReqs.map(r => completeBuybackRequest(r.id, user.id, { auto: true }).catch(() => {})),
        );
        // Reload requests setelah auto-complete
        const freshReqsSnap = await getDocs(query(
          collection(db, 'buyback_requests'),
          where('requester_id', '==', user.id),
          orderBy('created_at', 'desc'),
        ));
        allReqs.splice(0, allReqs.length, ...freshReqsSnap.docs.map(d => toBuybackReq(d.id, d.data() as Record<string, unknown>)));
      }

      const buybackableNfts = nftsSnap.docs
        .map(d => toNFTUnit(d.id, d.data() as Record<string, unknown>))
        .filter(u => u.developer_id !== user.id && !u.digunakan_validasi && !u.in_pool);

      // Build map: nft_unit_id -> most recent relevant request (pending, confirmed, rejected)
      const reqMap = new Map<string, BuybackReqData>();
      for (const req of allReqs) {
        if (!['pending', 'confirmed', 'rejected'].includes(req.status)) continue;
        if (!reqMap.has(req.nft_unit_id)) reqMap.set(req.nft_unit_id, req);
      }

      setItems(buybackableNfts.map(nft => ({
        nft,
        request: reqMap.get(nft.id) ?? null,
      })));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

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

  const pendingCount = items.filter(i => i.request?.status === 'pending').length;
  const confirmedCount = items.filter(i => i.request?.status === 'confirmed').length;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        <div>
          <div className="flex items-center gap-2 mb-1">
            <RefreshCcw className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold">Buyback NFT</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Kembalikan NFT yang kamu miliki ke developer asalnya melalui proses konfirmasi dua arah.
          </p>
        </div>

        {/* Summary badges */}
        {(pendingCount > 0 || confirmedCount > 0) && (
          <div className="flex gap-3 flex-wrap">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">
                <Clock className="h-3.5 w-3.5" />
                {pendingCount} menunggu konfirmasi
              </div>
            )}
            {confirmedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-800 border border-green-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {confirmedCount} siap diselesaikan
              </div>
            )}
          </div>
        )}

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
        ) : items.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <RefreshCcw className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-lg">Tidak ada NFT yang bisa di-buyback</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              NFT yang memenuhi syarat buyback adalah NFT yang kamu beli dari developer lain
              dan tidak sedang digunakan validasi atau berada di pool.
            </p>
            <Button variant="outline" asChild className="mt-2">
              <Link href="/explore">Jelajahi NFT</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{items.length} NFT tersedia untuk buyback</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <BuybackCard key={item.nft.id} item={item} ownerId={user.id} onSuccess={loadData} />
              ))}
            </div>
          </>
        )}

      </div>
    </MainLayout>
  );
}
