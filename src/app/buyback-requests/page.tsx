'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  collection, getDocs, query, where, Timestamp, orderBy, getDoc, doc,
} from 'firebase/firestore';
import {
  ShoppingBag, Loader2, CheckCircle2, XCircle, ExternalLink,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { confirmBuybackRequest, rejectBuybackRequest, BuybackRequestError } from '@/lib/projects';
import { getCommunityConfig } from '@/lib/community-config';
import { HargaEfektifInfo } from '@/components/harga-efektif';
import { effectiveInflationHistory, type InflationEntry } from '@/lib/inflation';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingRequest = {
  id: string;
  nft_unit_id: string;
  nft_nama: string;
  requester_id: string;
  requester_name: string;
  harga_buyback: number;
  nilai_selisih: number;
  requester_note: string | null;
  created_at: Date;
};

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
  request, sellerId, inflationHistory, onClose, onSuccess,
}: {
  request: PendingRequest;
  sellerId: string;
  inflationHistory: InflationEntry[];
  onClose: () => void;
  onSuccess: (requestId: string) => void;
}) {
  const [proofLink, setProofLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!proofLink.trim()) {
      setError('Proof link wajib diisi untuk mengkonfirmasi buyback.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await confirmBuybackRequest(request.id, sellerId, proofLink.trim());
      onSuccess(request.id);
      onClose();
    } catch (err) {
      setError(err instanceof BuybackRequestError ? err.message : 'Gagal mengkonfirmasi. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Konfirmasi Permintaan Buyback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <p className="font-semibold">{request.nft_nama}</p>
            <p className="text-xs text-muted-foreground">
              Pembeli: {request.requester_name}
            </p>
            <div className="pt-2 border-t space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Harga buyback</span>
                <span className="font-semibold">{formatIDR(request.harga_buyback)}</span>
              </div>
              <HargaEfektifInfo
                harga={request.harga_buyback}
                createdAt={request.created_at}
                inflationHistory={inflationHistory}
                className="text-[11px] text-muted-foreground italic text-right"
              />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kamu terima kembali</span>
                <span className="font-semibold text-green-600">+{formatIDR(request.nilai_selisih)}</span>
              </div>
            </div>
          </div>
          {request.requester_note && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
              <p className="text-muted-foreground mb-0.5">Catatan pembeli:</p>
              <p>{request.requester_note}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Link bukti konfirmasi <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="https://..."
              value={proofLink}
              onChange={(e) => setProofLink(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Isi dengan link bukti bahwa kamu menyetujui buyback ini (foto, dokumen, dll).
            </p>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Konfirmasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reject Dialog ────────────────────────────────────────────────────────────

function RejectDialog({
  request, sellerId, onClose, onSuccess,
}: {
  request: PendingRequest;
  sellerId: string;
  onClose: () => void;
  onSuccess: (requestId: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleReject() {
    if (!reason.trim()) {
      setError('Alasan penolakan wajib diisi.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await rejectBuybackRequest(request.id, sellerId, reason.trim());
      onSuccess(request.id);
      onClose();
    } catch (err) {
      setError(err instanceof BuybackRequestError ? err.message : 'Gagal menolak. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tolak Permintaan Buyback</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <p className="text-sm text-muted-foreground">
            NFT <span className="font-medium text-foreground">{request.nft_nama}</span> dari{' '}
            {request.requester_name} tidak akan dikembalikan.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">
              Alasan penolakan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Berikan alasan mengapa permintaan ini ditolak…"
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
          <Button variant="destructive" onClick={handleReject} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <XCircle className="h-4 w-4 mr-1.5" />
            Tolak Permintaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Request Card ─────────────────────────────────────────────────────────────

function RequestCard({
  request, sellerId, inflationHistory, onHandled,
}: {
  request: PendingRequest;
  sellerId: string;
  inflationHistory: InflationEntry[];
  onHandled: (requestId: string) => void;
}) {
  const [dialog, setDialog] = useState<'confirm' | 'reject' | null>(null);

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-snug truncate">{request.nft_nama}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Dari: <span className="text-foreground font-medium">{request.requester_name}</span>
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(request.created_at)}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-800 border-yellow-300 shrink-0">
            Menunggu
          </Badge>
        </div>

        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Harga buyback</span>
            <span className="font-semibold">{formatIDR(request.harga_buyback)}</span>
          </div>
          <HargaEfektifInfo
            harga={request.harga_buyback}
            createdAt={request.created_at}
            inflationHistory={inflationHistory}
          />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kamu terima kembali</span>
            <span className="font-semibold text-green-600">+{formatIDR(request.nilai_selisih)}</span>
          </div>
        </div>

        {request.requester_note && (
          <div className="rounded-md border px-2.5 py-2 text-xs">
            <p className="text-muted-foreground mb-0.5">Catatan pembeli:</p>
            <p className="italic">"{request.requester_note}"</p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs"
            asChild
          >
            <Link href={`/nft/${request.nft_unit_id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Detail NFT
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setDialog('reject')}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Tolak
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs"
            onClick={() => setDialog('confirm')}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Konfirmasi
          </Button>
        </div>
      </div>

      {dialog === 'confirm' && (
        <ConfirmDialog request={request} sellerId={sellerId} inflationHistory={inflationHistory} onClose={() => setDialog(null)} onSuccess={onHandled} />
      )}
      {dialog === 'reject' && (
        <RejectDialog request={request} sellerId={sellerId} onClose={() => setDialog(null)} onSuccess={onHandled} />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BuybackRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [inflationHistory, setInflationHistory] = useState<InflationEntry[]>([]);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [snap, cfg] = await Promise.all([
        getDocs(query(
          collection(db, 'buyback_requests'),
          where('seller_id', '==', user.id),
          where('status', '==', 'pending'),
          orderBy('created_at', 'asc'),
        )),
        getCommunityConfig(),
      ]);
      setInflationHistory(effectiveInflationHistory(cfg?.inflation_history, cfg?.inflation_enabled));

      if (snap.empty) {
        setRequests([]);
        return;
      }

      // Fetch requester names in batch
      const requesterIds = [...new Set(snap.docs.map(d => d.data().requester_id as string))];
      const userSnaps = await Promise.all(requesterIds.map(uid => getDoc(doc(db, 'users', uid))));
      const nameMap = new Map<string, string>();
      userSnaps.forEach((s, i) => {
        if (s.exists()) {
          const d = s.data();
          nameMap.set(requesterIds[i], (d.displayName as string) || requesterIds[i].slice(0, 8) + '…');
        } else {
          nameMap.set(requesterIds[i], requesterIds[i].slice(0, 8) + '…');
        }
      });

      setRequests(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nft_unit_id: data.nft_unit_id as string,
          nft_nama: (data.nft_nama as string) ?? '',
          requester_id: data.requester_id as string,
          requester_name: nameMap.get(data.requester_id as string) ?? '—',
          harga_buyback: (data.harga_buyback as number) ?? 0,
          nilai_selisih: (data.nilai_selisih as number) ?? 0,
          requester_note: (data.requester_note as string | null) ?? null,
          created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
        };
      }));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  function handleHandled(requestId: string) {
    setRequests(prev => prev.filter(r => r.id !== requestId));
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
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold">Permintaan Buyback</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Daftar permintaan dari pembeli untuk mengembalikan NFT Anda.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-16 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl space-y-3">
            <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="font-semibold text-lg">Tidak ada permintaan pending</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Permintaan buyback dari pembeli NFT Anda akan muncul di sini.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {requests.length} permintaan menunggu respons Anda
            </p>
            <div className="space-y-4">
              {requests.map(req => (
                <RequestCard key={req.id} request={req} sellerId={user.id} inflationHistory={inflationHistory} onHandled={handleHandled} />
              ))}
            </div>
          </>
        )}

      </div>
    </MainLayout>
  );
}
