'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  collection, getDocs, query, where, Timestamp, getDoc, doc,
} from 'firebase/firestore';
import { ClipboardCheck, Loader2, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

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
  confirmPurchase, reportPurchase, autoCompletePurchase, PurchaseError,
} from '@/lib/projects';
import type { ProjectCategory } from '@/lib/types';
import { getPlaceholder } from '@/lib/category-placeholders';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingPurchase = {
  nft_unit_id: string;
  nama_nft: string;
  nama_project: string;
  gambar_url: string;
  kategori: ProjectCategory;
  buyer_id: string;
  buyer_name: string;
  harga_beli: number;
  nilai_selisih: number;
  purchased_at: Date | null;
  purchase_auto_complete_at: Date | null;
};

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86400000);
}

function formatDate(d: Date | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmPurchaseDialog({
  purchase, developerId, onClose, onSuccess,
}: {
  purchase: PendingPurchase;
  developerId: string;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      await confirmPurchase(purchase.nft_unit_id, developerId);
      onSuccess(purchase.nft_unit_id);
      onClose();
    } catch (err) {
      setError(err instanceof PurchaseError ? err.message : 'Gagal mengkonfirmasi. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Konfirmasi Penjualan Sah</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <p className="font-semibold">{purchase.nama_nft}</p>
            <p className="text-xs text-muted-foreground">Pembeli: {purchase.buyer_name}</p>
            <div className="pt-2 border-t space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga terjual</span>
                <span className="font-semibold">{formatIDR(purchase.harga_beli)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Efek neracamu</span>
                <span className="font-semibold text-destructive">−{formatIDR(purchase.nilai_selisih)}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Dengan mengkonfirmasi, poin pembeli akan aktif dan neracamu akan berkurang.
            Tindakan ini tidak dapat dibatalkan.
          </p>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Konfirmasi Sah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Dialog ────────────────────────────────────────────────────────────

function ReportPurchaseDialog({
  purchase, developerId, onClose, onSuccess,
}: {
  purchase: PendingPurchase;
  developerId: string;
  onClose: () => void;
  onSuccess: (id: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleReport() {
    if (!reason.trim()) { setError('Alasan laporan wajib diisi.'); return; }
    setLoading(true);
    setError('');
    try {
      await reportPurchase(purchase.nft_unit_id, developerId, reason.trim());
      onSuccess(purchase.nft_unit_id);
      onClose();
    } catch (err) {
      setError(err instanceof PurchaseError ? err.message : 'Gagal melaporkan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Laporkan Pembelian Fiktif</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            Laporkan jika pembelian NFT <span className="font-medium text-foreground">{purchase.nama_nft}</span>{' '}
            oleh <span className="font-medium text-foreground">{purchase.buyer_name}</span> tidak sah atau mencurigakan.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Alasan laporan <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Jelaskan mengapa transaksi ini mencurigakan…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={handleReport} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Laporkan Fiktif
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Purchase Card ────────────────────────────────────────────────────────────

function PurchaseCard({
  purchase, developerId, onHandled,
}: {
  purchase: PendingPurchase;
  developerId: string;
  onHandled: (id: string) => void;
}) {
  const [dialog, setDialog] = useState<'confirm' | 'report' | null>(null);
  const days = daysUntil(purchase.purchase_auto_complete_at);

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
            <img
              src={purchase.gambar_url || getPlaceholder(purchase.kategori)}
              alt={purchase.nama_nft}
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(purchase.kategori); }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug truncate">{purchase.nama_nft}</p>
            <p className="text-xs text-muted-foreground truncate">{purchase.nama_project}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pembeli: <span className="font-medium text-foreground">{purchase.buyer_name}</span>
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-300 shrink-0 self-start">
            Pending
          </Badge>
        </div>

        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tanggal beli</span>
            <span>{formatDate(purchase.purchased_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Harga terjual</span>
            <span className="font-semibold">{formatIDR(purchase.harga_beli)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Efek neracamu jika konfirmasi</span>
            <span className="font-semibold text-destructive">−{formatIDR(purchase.nilai_selisih)}</span>
          </div>
        </div>

        {days !== null && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {days === 0
              ? 'Segera auto-complete otomatis jika tidak ada aksi'
              : `Auto-complete dalam ${days} hari jika tidak ada aksi`}
          </p>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
            <Link href={`/nft/${purchase.nft_unit_id}`}>Detail NFT</Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setDialog('report')}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            Laporkan
          </Button>
          <Button size="sm" className="flex-1 text-xs" onClick={() => setDialog('confirm')}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Konfirmasi
          </Button>
        </div>
      </div>

      {dialog === 'confirm' && (
        <ConfirmPurchaseDialog purchase={purchase} developerId={developerId} onClose={() => setDialog(null)} onSuccess={onHandled} />
      )}
      {dialog === 'report' && (
        <ReportPurchaseDialog purchase={purchase} developerId={developerId} onClose={() => setDialog(null)} onSuccess={onHandled} />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PurchaseConfirmationsPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<PendingPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'nft_units'),
        where('developer_id', '==', user.id),
        where('purchase_status', '==', 'pending'),
      ));

      if (snap.empty) { setPurchases([]); return; }

      // Lazy eval: auto-complete yang sudah expired
      const nowMs = Date.now();
      const expired = snap.docs.filter(d => {
        const at = (d.data().purchase_auto_complete_at as Timestamp)?.toDate?.();
        return at && nowMs > at.getTime();
      });
      if (expired.length > 0) {
        await Promise.all(expired.map(d => autoCompletePurchase(d.id).catch(() => {})));
        // Reload setelah auto-complete
        const freshSnap = await getDocs(query(
          collection(db, 'nft_units'),
          where('developer_id', '==', user.id),
          where('purchase_status', '==', 'pending'),
        ));
        snap.docs.splice(0, snap.docs.length, ...freshSnap.docs);
      }

      // Fetch buyer names
      const buyerIds = [...new Set(snap.docs.map(d => d.data().owner_id as string))];
      const buyerSnaps = await Promise.all(buyerIds.map(id => getDoc(doc(db, 'users', id))));
      const nameMap = new Map<string, string>();
      buyerSnaps.forEach((s, i) => {
        nameMap.set(buyerIds[i], s.exists() ? (s.data().displayName as string) || buyerIds[i].slice(0, 8) + '…' : '—');
      });

      setPurchases(snap.docs.map(d => {
        const data = d.data();
        const buyerId = data.owner_id as string;
        return {
          nft_unit_id: d.id,
          nama_nft: (data.nama_nft as string) ?? '',
          nama_project: (data.nama_project as string) ?? '',
          gambar_url: (data.gambar_url as string) ?? '',
          kategori: (data.kategori as ProjectCategory) ?? 'lainnya',
          buyer_id: buyerId,
          buyer_name: nameMap.get(buyerId) ?? '—',
          harga_beli: (data.harga_beli_terakhir as number) ?? 0,
          nilai_selisih: (data.nilai_selisih as number) ?? 0,
          purchased_at: (data.purchased_at as Timestamp)?.toDate?.() ?? null,
          purchase_auto_complete_at: (data.purchase_auto_complete_at as Timestamp)?.toDate?.() ?? null,
        };
      }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  function handleHandled(nftUnitId: string) {
    setPurchases(prev => prev.filter(p => p.nft_unit_id !== nftUnitId));
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16 space-y-4">
          <h2 className="text-2xl font-bold">Login diperlukan</h2>
          <Button asChild><Link href="/login">Login</Link></Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">

        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold">Konfirmasi Penjualan</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Konfirmasi pembelian NFT Anda atau laporkan jika transaksi mencurigakan.
            Poin pembeli akan aktif setelah Anda konfirmasi atau setelah batas waktu.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3">
                <div className="flex gap-3">
                  <Skeleton className="w-14 h-14 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </div>
            ))}
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl space-y-3">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-lg">Tidak ada penjualan yang perlu dikonfirmasi</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Pembelian NFT yang Anda buat akan muncul di sini untuk dikonfirmasi.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {purchases.length} penjualan menunggu konfirmasi Anda
            </p>
            <div className="space-y-4">
              {purchases.map(p => (
                <PurchaseCard key={p.nft_unit_id} purchase={p} developerId={user.id} onHandled={handleHandled} />
              ))}
            </div>
          </>
        )}

      </div>
    </MainLayout>
  );
}
