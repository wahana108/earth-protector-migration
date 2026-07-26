'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, RefreshCcw, ShieldAlert, ArrowUpRight, ArrowDownRight,
  Minus, Flag, AlertTriangle, CheckCircle2, XCircle, Trash2, Search, UserX, ShieldOff,
  Building2, Plus, X, HandCoins, Ban, Percent, Copy, Check,
} from 'lucide-react';
import Link from 'next/link';
import {
  collection, getDocs, query, where, orderBy, getDoc, doc, Timestamp, limit,
} from 'firebase/firestore';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { recalculateAllDeveloperLevels, resolvePurchaseDispute, autoCancelDisputedPurchase, deleteProject, suspendUser, unsuspendUser, PurchaseError, type RecalcStats } from '@/lib/projects';
import { getPendingBlocks, adminResolveBlock } from '@/lib/blocks';
import {
  getInfrastructureFundStatus,
  migrateFeePoolIfNeeded, rewardInfrastructureContributor,
  getPendingInfrastructureClaims, approveInfrastructureClaim, rejectInfrastructureClaim,
  type InfrastructureFundStatus,
} from '@/lib/infrastructure';
import { updateCommunityConfig } from '@/lib/community-config';
import { recordInflation, buildInflationPrompt, parseInflationOutput } from '@/lib/inflation';
import { formatCurrency, type CurrencyConfig } from '@/lib/format-currency';
import type { InfrastructureClaim, UserBlock } from '@/lib/types';
import { db } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockAdminItem = UserBlock & {
  blocker_name: string;
  blocked_name: string;
};

type ProjectAdminItem = {
  id: string;
  nama_project: string;
  developer_id: string;
  developer_name: string;
  jumlah_nft: number;
  status_project: string;
  is_deleted: boolean;
  created_at: Date;
  deleted_at?: Date;
};

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
  auto_complete_at: Date | null;
};

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

// ─── Resolve Dialog ───────────────────────────────────────────────────────────

// ─── Delete Project Dialog ────────────────────────────────────────────────────

function DeleteProjectDialog({
  project, adminId, onClose, onDeleted,
}: {
  project: ProjectAdminItem;
  adminId: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    setError('');
    try {
      await deleteProject(project.id, adminId);
      onDeleted(project.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus project.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Hapus Project</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="rounded-lg border p-3 text-sm space-y-1">
            <p className="font-semibold">{project.nama_project}</p>
            <p className="text-xs text-muted-foreground">Developer: {project.developer_name}</p>
            <p className="text-xs text-muted-foreground">{project.jumlah_nft} NFT unit</p>
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-400 space-y-1">
            <p className="font-semibold">Tindakan ini akan:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Menandai project sebagai deleted</li>
              <li>Semua NFT dalam project diset invalid</li>
              <li>NFT di pool dikeluarkan dari pool</li>
              <li>NFT dalam validasi dikembalikan ke pemilik</li>
              <li>Pembelian pending dibatalkan</li>
            </ul>
          </div>
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Trash2 className="h-4 w-4 mr-1.5" />
            Hapus Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectAdminCard({
  project, adminId, onDeleted,
}: {
  project: ProjectAdminItem;
  adminId: string;
  onDeleted: (id: string) => void;
}) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <div className={`rounded-lg border p-3 flex gap-3 items-start ${project.is_deleted ? 'opacity-60 bg-muted/30' : 'bg-card'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm truncate">{project.nama_project}</p>
            {project.is_deleted
              ? <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-800 border-red-300 shrink-0">Deleted</Badge>
              : <Badge variant="secondary" className="text-[10px] shrink-0">{project.status_project}</Badge>
            }
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Developer: <span className="font-medium text-foreground">{project.developer_name}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {project.jumlah_nft} NFT · {formatDate(project.created_at)}
            {project.deleted_at && <> · Dihapus {formatDate(project.deleted_at)}</>}
          </p>
        </div>
        {!project.is_deleted && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 shrink-0"
            onClick={() => setShowDialog(true)}
          >
            <Trash2 className="h-3 w-3" />
            Hapus
          </Button>
        )}
      </div>
      {showDialog && (
        <DeleteProjectDialog
          project={project}
          adminId={adminId}
          onClose={() => setShowDialog(false)}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}

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

        {dispute.type !== 'buyback' && dispute.auto_complete_at && (
          <p className="text-xs text-muted-foreground italic">
            Jika tidak ditangani hingga {formatDate(dispute.auto_complete_at)}, transaksi dibatalkan otomatis.
          </p>
        )}

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

// ─── Suspend / Pulihkan User Dialog ───────────────────────────────────────────

function SuspendUserDialog({
  targetId, targetName, targetEmail, adminUid, willSuspend, onClose, onDone,
}: {
  targetId: string;
  targetName: string;
  targetEmail: string;
  adminUid: string;
  willSuspend: boolean; // true = akan menangguhkan, false = akan memulihkan
  onClose: () => void;
  onDone: (nowSuspended: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!reason.trim()) { setError('Alasan wajib diisi.'); return; }
    setLoading(true);
    setError('');
    try {
      if (willSuspend) {
        await suspendUser(targetId, targetEmail, targetName, adminUid, reason.trim());
      } else {
        await unsuspendUser(targetId, targetEmail, targetName, adminUid, reason.trim());
      }
      onDone(willSuspend);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{willSuspend ? 'Tangguhkan Akun?' : 'Pulihkan Akun?'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <p className="text-sm text-muted-foreground">
            {willSuspend ? (
              <>Akun <span className="font-medium text-foreground">{targetName}</span> akan
                ditangguhkan — tidak bisa bertransaksi apapun (beli, validasi, buyback,
                komentar, buat project) dan lapaknya otomatis tersembunyi hingga dipulihkan.</>
            ) : (
              <>Akun <span className="font-medium text-foreground">{targetName}</span> akan
                dipulihkan — dapat bertransaksi kembali seperti biasa.</>
            )}
          </p>
          <Textarea
            placeholder="Alasan (wajib)…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant={willSuspend ? 'destructive' : 'default'} onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {willSuspend ? 'Tangguhkan' : 'Pulihkan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Klaim Kontribusi Card ──────────────────────────────────────────────────

function ClaimAdminCard({
  claim, adminId, currency, onProcessed,
}: {
  claim: InfrastructureClaim;
  adminId: string;
  currency: CurrencyConfig | undefined;
  onProcessed: (id: string) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  async function handleApprove() {
    setApproving(true);
    setApproveError('');
    try {
      await approveInfrastructureClaim(claim.id, adminId);
      onProcessed(claim.id);
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : 'Gagal memproses. Coba lagi.');
    } finally {
      setApproving(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-snug">{claim.user_nama}</p>
            <p className="text-xs text-muted-foreground">{formatDate(claim.created_at)}</p>
          </div>
          <p className="font-mono font-bold text-sm shrink-0">
            {formatCurrency(claim.nilai, currency)}
          </p>
        </div>

        {claim.keterangan && (
          <p className="text-xs text-muted-foreground italic">"{claim.keterangan}"</p>
        )}

        <a
          href={claim.bukti_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-block"
        >
          Lihat Bukti
        </a>

        {approveError && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{approveError}</p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs border-red-200 text-red-700 hover:bg-red-50"
            onClick={() => setRejectOpen(true)}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Tolak
          </Button>
          <Button size="sm" className="flex-1 text-xs" disabled={approving} onClick={handleApprove}>
            {approving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Setujui
          </Button>
        </div>
      </div>

      {rejectOpen && (
        <RejectClaimDialog
          claim={claim}
          adminId={adminId}
          currency={currency}
          onClose={() => setRejectOpen(false)}
          onRejected={onProcessed}
        />
      )}
    </>
  );
}

function RejectClaimDialog({
  claim, adminId, currency, onClose, onRejected,
}: {
  claim: InfrastructureClaim;
  adminId: string;
  currency: CurrencyConfig | undefined;
  onClose: () => void;
  onRejected: (id: string) => void;
}) {
  const [alasan, setAlasan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!alasan.trim()) { setError('Alasan penolakan wajib diisi.'); return; }
    setLoading(true);
    setError('');
    try {
      await rejectInfrastructureClaim(claim.id, alasan.trim(), adminId);
      onRejected(claim.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tolak Klaim Kontribusi</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="rounded-lg border p-3 space-y-1.5 text-sm">
            <p className="font-semibold">{claim.user_nama}</p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(claim.nilai, currency)}
            </p>
          </div>
          <Textarea
            placeholder="Alasan penolakan (wajib)"
            value={alasan}
            onChange={e => setAlasan(e.target.value)}
            rows={3}
          />
          {error && <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <XCircle className="h-4 w-4 mr-1.5" />
            Tolak Klaim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Copy button (pola sama dengan /ai-review) ────────────────────────────────

function CopyButton({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 text-xs gap-1.5">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Tersalin' : label}
    </Button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading, isAdmin, isModerator } = useAuth();
  const router = useRouter();

  // Recalculate state
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<RecalcStats | null>(null);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  // Disputes state
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [loadingDisputes, setLoadingDisputes] = useState(true);

  // Blocks state
  const [blocks, setBlocks] = useState<BlockAdminItem[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  // Projects state
  const [projects, setProjects] = useState<ProjectAdminItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectFilter, setProjectFilter] = useState<'semua' | 'aktif' | 'deleted'>('aktif');
  const [projectSearch, setProjectSearch] = useState('');

  // Infrastructure Fund state
  const [infraStatus, setInfraStatus] = useState<InfrastructureFundStatus | null>(null);
  const [loadingInfra, setLoadingInfra] = useState(true);
  const [infraCosts, setInfraCosts] = useState<Array<{ nama: string; jumlah: number; periode: 'bulan' | 'tahun' | 'sekali' | 'gratis'; info?: string }>>([]);
  const [migrateLoading, setMigrateLoading] = useState(false);
  const [migrateResult, setMigrateResult] = useState<string | null>(null);
  const [rewardEmail, setRewardEmail] = useState('');
  const [rewardNilai, setRewardNilai] = useState('');
  const [rewardBuktiLink, setRewardBuktiLink] = useState('');
  const [rewardKeterangan, setRewardKeterangan] = useState('');
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardResult, setRewardResult] = useState<string | null>(null);
  const [savingCosts, setSavingCosts] = useState(false);
  const [inflationHistory, setInflationHistory] = useState<Array<{ tahun: number; pct: number }>>([]);
  const [savingInflation, setSavingInflation] = useState(false);
  const [inflationEnabled, setInflationEnabled] = useState(true);
  const [currencyCfg, setCurrencyCfg] = useState<CurrencyConfig | undefined>(undefined);
  const [recordPct, setRecordPct] = useState('');
  const [recordAlasan, setRecordAlasan] = useState('');
  const [recordingInflation, setRecordingInflation] = useState(false);
  const [recordResult, setRecordResult] = useState<string | null>(null);
  const [pastedInflationOutput, setPastedInflationOutput] = useState('');
  const [inflationParseError, setInflationParseError] = useState('');

  // Antrian Klaim Kontribusi
  const [pendingClaims, setPendingClaims] = useState<InfrastructureClaim[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);

  // Suspend User
  const [suspendEmail, setSuspendEmail] = useState('');
  const [suspendLookupLoading, setSuspendLookupLoading] = useState(false);
  const [suspendLookupError, setSuspendLookupError] = useState('');
  const [foundUser, setFoundUser] = useState<{ id: string; displayName: string; email: string; suspended: boolean } | null>(null);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendedUsers, setSuspendedUsers] = useState<{ id: string; displayName: string; email: string }[]>([]);
  const [loadingSuspended, setLoadingSuspended] = useState(true);
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; displayName: string; email: string } | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isModerator) router.replace('/');
  }, [isModerator, authLoading, router]);

  useEffect(() => {
    if (!isModerator) return;
    loadDisputes();
    loadProjects();
    loadBlocks();
    loadInfra();
    loadClaims();
    loadSuspendedUsers();
  }, [isModerator]);

  async function loadSuspendedUsers() {
    setLoadingSuspended(true);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('suspended_by_admin', '==', true)));
      setSuspendedUsers(snap.docs.map(d => ({
        id: d.id,
        displayName: (d.data().displayName as string) ?? 'User',
        email: (d.data().email as string) ?? '',
      })));
    } finally {
      setLoadingSuspended(false);
    }
  }

  async function loadClaims() {
    setLoadingClaims(true);
    try {
      setPendingClaims(await getPendingInfrastructureClaims());
    } finally {
      setLoadingClaims(false);
    }
  }

  function handleClaimProcessed(id: string) {
    setPendingClaims(prev => prev.filter(c => c.id !== id));
  }

  async function handleLookupUser() {
    if (!suspendEmail.trim()) { setSuspendLookupError('Email wajib diisi.'); return; }
    setSuspendLookupLoading(true);
    setSuspendLookupError('');
    setFoundUser(null);
    try {
      const usersSnap = await getDocs(query(
        collection(db, 'users'),
        where('email', '==', suspendEmail.trim()),
        limit(1),
      ));
      if (usersSnap.empty) throw new Error(`User dengan email "${suspendEmail.trim()}" tidak ditemukan.`);
      const d = usersSnap.docs[0];
      setFoundUser({
        id: d.id,
        displayName: (d.data().displayName as string) ?? 'User',
        email: (d.data().email as string) ?? suspendEmail.trim(),
        suspended: (d.data().suspended_by_admin as boolean) ?? false,
      });
    } catch (e) {
      setSuspendLookupError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSuspendLookupLoading(false);
    }
  }

  function handleSuspendDone(nowSuspended: boolean) {
    setFoundUser(prev => prev ? { ...prev, suspended: nowSuspended } : null);
    setSuspendedUsers(prev => {
      if (!foundUser) return prev;
      if (nowSuspended) {
        return prev.some(u => u.id === foundUser.id) ? prev : [...prev, { id: foundUser.id, displayName: foundUser.displayName, email: foundUser.email }];
      }
      return prev.filter(u => u.id !== foundUser.id);
    });
  }

  function handleRestoreDone() {
    if (!restoreTarget) return;
    setSuspendedUsers(prev => prev.filter(u => u.id !== restoreTarget.id));
    setRestoreTarget(null);
  }

  async function loadInfra() {
    setLoadingInfra(true);
    try {
      const [status, config] = await Promise.all([
        getInfrastructureFundStatus(),
        import('@/lib/community-config').then(m => m.getCommunityConfig()),
      ]);
      setInfraStatus(status);
      setInfraCosts(
        (config?.infrastructure_costs ?? []).map(c => ({
          ...c,
          info: (c.info ?? (c as Record<string, unknown>).link as string | undefined) || undefined,
        })),
      );
      setInflationHistory(config?.inflation_history ?? []);
      setInflationEnabled(config?.inflation_enabled ?? true);
      setCurrencyCfg(config ?? undefined);
    } finally {
      setLoadingInfra(false);
    }
  }

  async function handleMigrate() {
    setMigrateLoading(true);
    setMigrateResult(null);
    try {
      const msg = await migrateFeePoolIfNeeded();
      setMigrateResult(msg);
      await loadInfra();
    } catch (e) {
      setMigrateResult(`Gagal: ${e instanceof Error ? e.message : 'Terjadi kesalahan.'}`);
    } finally {
      setMigrateLoading(false);
    }
  }

  async function handleRewardContributor() {
    if (!user) return;
    const nilaiNum = parseInt(rewardNilai.replace(/\D/g, ''), 10);
    if (!rewardEmail.trim() || !nilaiNum || nilaiNum <= 0 || !rewardBuktiLink.trim()) {
      setRewardResult('Email, nilai, dan bukti link wajib diisi.');
      return;
    }
    setRewardLoading(true);
    setRewardResult(null);
    try {
      // Lookup user by email
      const usersSnap = await getDocs(query(
        collection(db, 'users'),
        where('email', '==', rewardEmail.trim()),
        limit(1),
      ));
      if (usersSnap.empty) throw new Error(`User dengan email "${rewardEmail.trim()}" tidak ditemukan.`);
      const kontributorId = usersSnap.docs[0].id;
      const kontributorNama = (usersSnap.docs[0].data().displayName as string) ?? 'User';

      await rewardInfrastructureContributor(
        kontributorId, kontributorNama, nilaiNum,
        rewardBuktiLink.trim(), rewardKeterangan.trim(), user.id,
      );
      setRewardResult(`Reward ${formatCurrency(nilaiNum, currencyCfg)} berhasil diberikan ke ${kontributorNama}.`);
      setRewardEmail(''); setRewardNilai(''); setRewardBuktiLink(''); setRewardKeterangan('');
      await loadInfra();
    } catch (e) {
      setRewardResult(`Gagal: ${e instanceof Error ? e.message : 'Terjadi kesalahan.'}`);
    } finally {
      setRewardLoading(false);
    }
  }

  async function handleSaveCosts() {
    if (!user) return;
    setSavingCosts(true);
    try {
      const cleanedCosts = infraCosts.map(item => ({
        nama: item.nama || '',
        jumlah: item.jumlah || 0,
        periode: item.periode || 'bulan' as const,
        ...(item.info ? { info: item.info } : {}),
      }));
      await updateCommunityConfig(user.id, { infrastructure_costs: cleanedCosts });
    } finally {
      setSavingCosts(false);
    }
  }

  function handleParseInflation() {
    setInflationParseError('');
    const result = parseInflationOutput(pastedInflationOutput);
    if (typeof result === 'string') {
      setInflationParseError(result);
    } else {
      setRecordPct(String(result.pct));
      setRecordAlasan(result.alasan);
    }
  }

  async function handleRecordInflation() {
    if (!user) return;
    const pctNum = parseFloat(recordPct.replace(',', '.'));
    if (isNaN(pctNum) || !recordAlasan.trim()) {
      setRecordResult('Persentase dan alasan wajib diisi.');
      return;
    }
    setRecordingInflation(true);
    setRecordResult(null);
    try {
      const tahunBerjalan = new Date().getFullYear();
      await recordInflation(tahunBerjalan, pctNum, user.id, user.displayName ?? 'Admin', recordAlasan.trim());
      setRecordResult(`Tercatat: ${tahunBerjalan} → ${pctNum > 0 ? '+' : ''}${pctNum}%.`);
      setRecordPct(''); setRecordAlasan(''); setPastedInflationOutput(''); setInflationParseError('');
      await loadInfra();
    } catch (e) {
      setRecordResult(`Gagal: ${e instanceof Error ? e.message : 'Terjadi kesalahan.'}`);
    } finally {
      setRecordingInflation(false);
    }
  }

  async function handleSaveInflation() {
    if (!user) return;
    setSavingInflation(true);
    try {
      // pct BOLEH negatif (deflasi) — jangan clamp. Ini murni info tampilan,
      // tidak pernah dipakai untuk menulis neraca.
      const cleanedHistory = inflationHistory.map(item => ({
        tahun: item.tahun || new Date().getFullYear(),
        pct: item.pct || 0,
      }));
      await updateCommunityConfig(user.id, { inflation_history: cleanedHistory });
    } finally {
      setSavingInflation(false);
    }
  }

  async function loadDisputes() {
    setLoadingDisputes(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'purchase_disputes'),
        where('status', '==', 'pending_admin'),
        orderBy('created_at', 'desc'),
      ));

      if (snap.empty) { setDisputes([]); return; }

      // Batch-fetch NFT names + deadline + seller/buyer names
      const nftIds = [...new Set(snap.docs.map(d => d.data().nft_unit_id as string))];
      const sellerIds = [...new Set(snap.docs.map(d => d.data().seller_id as string))];
      const buyerIds = [...new Set(snap.docs.map(d => d.data().buyer_id as string))];
      const allUserIds = [...new Set([...sellerIds, ...buyerIds])];

      const [nftSnaps, userSnaps] = await Promise.all([
        Promise.all(nftIds.map(id => getDoc(doc(db, 'nft_units', id)))),
        Promise.all(allUserIds.map(id => getDoc(doc(db, 'users', id)))),
      ]);

      const nftNameMap = new Map<string, string>();
      const nftDeadlineMap = new Map<string, Date | null>();
      nftSnaps.forEach((s, i) => {
        nftNameMap.set(nftIds[i], s.exists() ? (s.data().nama_nft as string) ?? '—' : '—');
        const at = s.exists() ? (s.data().purchase_auto_complete_at as Timestamp | undefined)?.toDate?.() : undefined;
        nftDeadlineMap.set(nftIds[i], at ?? null);
      });

      const userNameMap = new Map<string, string>();
      userSnaps.forEach((s, i) => {
        userNameMap.set(
          allUserIds[i],
          s.exists() ? (s.data().displayName as string) || allUserIds[i].slice(0, 8) + '…' : '—',
        );
      });

      // Lazy sweep: dispute 'purchase' yang deadline-nya (purchase_auto_complete_at,
      // TIDAK berubah sejak dispute diajukan) sudah lewat → auto-cancel, tidak
      // ditampilkan lagi di antrian (lihat autoCancelDisputedPurchase).
      const nowMs = Date.now();
      const stillPending: typeof snap.docs = [];
      const toAutoCancel: string[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const nftUnitId = data.nft_unit_id as string;
        const deadline = nftDeadlineMap.get(nftUnitId) ?? null;
        const isExpiredPurchaseDispute =
          (data.type as string) === 'purchase' && !!deadline && nowMs > deadline.getTime();
        if (isExpiredPurchaseDispute) toAutoCancel.push(nftUnitId);
        else stillPending.push(d);
      }
      if (toAutoCancel.length > 0) {
        await Promise.all(toAutoCancel.map(id => autoCancelDisputedPurchase(id).catch(() => {})));
      }

      setDisputes(stillPending.map(d => {
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
          auto_complete_at: nftDeadlineMap.get(data.nft_unit_id as string) ?? null,
        };
      }));
    } finally {
      setLoadingDisputes(false);
    }
  }

  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'projects'),
        orderBy('created_at', 'desc'),
        limit(50),
      ));
      if (snap.empty) { setProjects([]); return; }

      const devIds = [...new Set(snap.docs.map(d => d.data().developer_id as string))];
      const devSnaps = await Promise.all(devIds.map(id => getDoc(doc(db, 'users', id))));
      const devMap = new Map<string, string>();
      devSnaps.forEach((s, i) => {
        devMap.set(devIds[i], s.exists() ? (s.data().displayName as string) || devIds[i].slice(0, 8) + '…' : '—');
      });

      setProjects(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          nama_project: (data.nama_project as string) ?? '',
          developer_id: data.developer_id as string,
          developer_name: devMap.get(data.developer_id as string) ?? '—',
          jumlah_nft: (data.jumlah_nft as number) ?? 0,
          status_project: (data.status_project as string) ?? 'aktif',
          is_deleted: (data.status as string) === 'deleted',
          created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
          deleted_at: (data.deleted_at as Timestamp)?.toDate?.() ?? undefined,
        };
      }));
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadBlocks() {
    setLoadingBlocks(true);
    try {
      const rawBlocks = await getPendingBlocks();
      if (rawBlocks.length === 0) { setBlocks([]); return; }

      const allUserIds = [...new Set(rawBlocks.flatMap(b => [b.blocker_id, b.blocked_id]))];
      const userSnaps = await Promise.all(allUserIds.map(id => getDoc(doc(db, 'users', id))));
      const nameMap = new Map<string, string>();
      userSnaps.forEach((s, i) => {
        nameMap.set(allUserIds[i], s.exists() ? (s.data().displayName as string) || allUserIds[i].slice(0, 8) + '…' : '—');
      });

      setBlocks(rawBlocks.map(b => ({
        ...b,
        blocker_name: nameMap.get(b.blocker_id) ?? '—',
        blocked_name: nameMap.get(b.blocked_id) ?? '—',
      })));
    } finally {
      setLoadingBlocks(false);
    }
  }

  function handleResolved(id: string) {
    setDisputes(prev => prev.filter(d => d.id !== id));
  }

  function handleProjectDeleted(id: string) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, is_deleted: true } : p));
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

  const filteredProjects = projects
    .filter(p => projectFilter === 'semua' ? true : projectFilter === 'aktif' ? !p.is_deleted : p.is_deleted)
    .filter(p => !projectSearch || p.nama_project.toLowerCase().includes(projectSearch.toLowerCase()) || p.developer_name.toLowerCase().includes(projectSearch.toLowerCase()));

  if (authLoading || !isModerator) {
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

        {/* Blokir Aktif */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Blokir Aktif — Belum Ditinjau
              {blocks.length > 0 && (
                <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs ml-auto font-normal">
                  {blocks.length} pending
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs leading-snug">
              Blokir baru yang belum ditinjau. Admin bisa mengesahkan atau membatalkannya.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBlocks ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat data blokir…
              </div>
            ) : blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Tidak ada blokir yang perlu ditinjau.</p>
            ) : (
              <div className="space-y-3">
                {blocks.map(b => (
                  <div key={b.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm min-w-0">
                        <p className="font-medium">
                          <span className="text-foreground">{b.blocker_name}</span>
                          <span className="text-muted-foreground mx-1.5">memblokir</span>
                          <span className="text-foreground">{b.blocked_name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{b.reason}"</p>
                        <p className="text-xs text-muted-foreground">{formatDate(b.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={async () => {
                          await adminResolveBlock(b.id, 'upheld');
                          setBlocks(prev => prev.filter(x => x.id !== b.id));
                        }}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Sahkan Blokir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          await adminResolveBlock(b.id, 'reversed');
                          setBlocks(prev => prev.filter(x => x.id !== b.id));
                        }}
                      >
                        <ShieldOff className="h-3 w-3" />
                        Batalkan Blokir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manajemen Project */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Manajemen Project
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Lihat dan hapus project. Penghapusan bersifat soft-delete.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {(['aktif', 'semua', 'deleted'] as const).map(f => (
                  <Button key={f} size="sm" variant={projectFilter === f ? 'default' : 'outline'} className="h-7 text-xs capitalize" onClick={() => setProjectFilter(f)}>
                    {f === 'aktif' ? 'Aktif' : f === 'deleted' ? 'Deleted' : 'Semua'}
                  </Button>
                ))}
                <div className="relative flex-1 min-w-40">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    className="w-full h-7 pl-8 pr-3 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Cari nama atau developer…"
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                  />
                </div>
              </div>

              {loadingProjects ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat project…
                </div>
              ) : filteredProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Tidak ada project ditemukan.</p>
              ) : (
                <div className="space-y-2">
                  {filteredProjects.map(p => (
                    <ProjectAdminCard key={p.id} project={p} adminId={user!.id} onDeleted={handleProjectDeleted} />
                  ))}
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    {filteredProjects.length} project ditampilkan (maks 50)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Infrastructure Fund */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Infrastructure Fund
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Kelola dana sistem dari fee sharing. Verifikasi dan beri reward kontributor infrastruktur.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingInfra ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat data…
                </div>
              ) : infraStatus ? (
                <>
                  {/* Status ringkasan — field baru sebagai sumber kebenaran */}
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Total Masuk</p>
                      <p className="font-bold">{formatCurrency(infraStatus.total_terkumpul, currencyCfg)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Reward Diberikan</p>
                      <p className="font-bold text-orange-600">{formatCurrency(infraStatus.total_digunakan, currencyCfg)}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">Saldo Tersedia</p>
                      <p className="font-bold text-green-600">{formatCurrency(Math.max(0, infraStatus.sisa), currencyCfg)}</p>
                    </div>
                  </div>
                  {/* Dinonaktifkan — digantikan reward kontributor (rewardInfrastructureContributor).
                      Kode dipertahankan untuk referensi.
                  {infraStatus.total_sertifikat_diterbitkan > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Sertifikat historis diterbitkan: {infraStatus.total_sertifikat_diterbitkan}
                    </div>
                  )}
                  */}

                  {/* Migrasi saldo lama — sekali pakai, tampil jika belum migrated */}
                  {!infraStatus.migrated_at && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-amber-700">Migrasi Saldo Lama</p>
                      <p className="text-xs text-muted-foreground">
                        Pindahkan saldo dari sistem lama (total_terkumpul − total_terdistribusi − total_digunakan)
                        ke saldo_tersedia. Hanya berjalan jika saldo_tersedia masih 0. Idempoten — aman dijalankan sekali.
                      </p>
                      <Button size="sm" variant="outline" disabled={migrateLoading} onClick={handleMigrate} className="gap-2">
                        {migrateLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Jalankan Migrasi
                      </Button>
                      {migrateResult && (
                        <p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">{migrateResult}</p>
                      )}
                    </div>
                  )}

                  {/* Reward kontributor infrastruktur */}
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-xs font-medium">Beri Reward Kontributor</p>
                    <p className="text-xs text-muted-foreground">
                      Verifikasi pembayaran infrastruktur nyata → beri reward poin ke kontributor.
                      Zero-sum: saldo sistem berkurang, poin kontributor bertambah.
                    </p>
                    <div className="space-y-2">
                      <input
                        className="w-full h-8 px-3 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Email kontributor"
                        value={rewardEmail}
                        onChange={e => setRewardEmail(e.target.value)}
                      />
                      <input
                        type="number"
                        className="w-full h-8 px-3 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder={`Nilai reward (${currencyCfg?.currency_code ?? 'IDR'}) — saldo tersedia: ${formatCurrency(infraStatus.saldo_tersedia, currencyCfg)}`}
                        value={rewardNilai}
                        onChange={e => setRewardNilai(e.target.value)}
                      />
                      <input
                        className="w-full h-8 px-3 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Bukti link (wajib) — URL atau referensi pembayaran"
                        value={rewardBuktiLink}
                        onChange={e => setRewardBuktiLink(e.target.value)}
                      />
                      <input
                        className="w-full h-8 px-3 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Keterangan (opsional)"
                        value={rewardKeterangan}
                        onChange={e => setRewardKeterangan(e.target.value)}
                      />
                      <Button size="sm" disabled={rewardLoading} onClick={handleRewardContributor} className="gap-2">
                        {rewardLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Verifikasi &amp; Beri Reward
                      </Button>
                      {rewardResult && (
                        <p className={`text-xs rounded-md px-3 py-2 ${rewardResult.startsWith('Gagal') || rewardResult.startsWith('Kas') || rewardResult.startsWith('Email') ? 'bg-destructive/10 text-destructive' : 'bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-400'}`}>
                          {rewardResult}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Dana sistem belum memiliki catatan.</p>
              )}

              {/* Form kebutuhan biaya */}
              <div className="space-y-3 pt-2 border-t">
                <p className="text-xs font-medium">Kebutuhan Operasional Node</p>
                <div className="space-y-2">
                  {infraCosts.map((item, i) => (
                    <div key={i} className="space-y-1.5 rounded-md border bg-muted/20 p-2">
                      <div className="flex gap-2 items-center">
                        <input
                          className="flex-1 h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Nama (contoh: Vercel Hosting)"
                          value={item.nama}
                          onChange={e => setInfraCosts(prev => prev.map((c, idx) => idx === i ? { ...c, nama: e.target.value } : c))}
                        />
                        <input
                          type="number"
                          className="w-20 h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Jumlah"
                          value={item.jumlah}
                          onChange={e => setInfraCosts(prev => prev.map((c, idx) => idx === i ? { ...c, jumlah: Number(e.target.value) } : c))}
                        />
                        <select
                          className="h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          value={item.periode}
                          onChange={e => setInfraCosts(prev => prev.map((c, idx) => idx === i ? { ...c, periode: e.target.value as typeof item.periode } : c))}
                        >
                          <option value="bulan">/bulan</option>
                          <option value="tahun">/tahun</option>
                          <option value="sekali">sekali</option>
                          <option value="gratis">gratis</option>
                        </select>
                        <button
                          className="h-7 w-7 flex items-center justify-center rounded-md border text-muted-foreground hover:text-destructive hover:border-red-300 transition-colors shrink-0"
                          onClick={() => setInfraCosts(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <input
                        className="w-full h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                        placeholder="Info Pembayaran (opsional) — contoh: Transfer ke BCA 1234567890 a/n Ramawan, atau https://vercel.com/billing"
                        value={item.info ?? ''}
                        onChange={e => setInfraCosts(prev => prev.map((c, idx) => idx === i ? { ...c, info: e.target.value || undefined } : c))}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setInfraCosts(prev => [...prev, { nama: '', jumlah: 0, periode: 'bulan' as const }])}
                  >
                    <Plus className="h-3 w-3" />
                    Tambah Baris
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={savingCosts}
                    onClick={handleSaveCosts}
                  >
                    {savingCosts ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Simpan
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Inflasi/Deflasi — lapisan tampilan */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                Info Inflasi/Deflasi (Tampilan)
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Figur tahunan murni informasi — ditampilkan sebagai &quot;≈ nilai hari ini&quot;
                di samping harga tercatat. TIDAK pernah menulis/mengubah neraca. pct BOLEH
                negatif untuk deflasi (compounding simetris).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 pb-4 border-b">
                <p className="text-xs font-medium text-muted-foreground">
                  Catat Peristiwa Resmi Tahun Ini
                </p>
                {!inflationEnabled ? (
                  <p className="text-xs text-muted-foreground italic">
                    Fitur inflasi/deflasi nonaktif (lihat /parameters) — aksi pencatatan resmi disembunyikan.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Prompt untuk AI eksternal (Gemini, GPT, dll)
                        </span>
                        <CopyButton text={buildInflationPrompt(new Date().getFullYear(), currencyCfg?.currency_code ?? 'Rupiah Indonesia')} label="Salin Prompt" />
                      </div>
                      <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap font-mono leading-relaxed">
                        {buildInflationPrompt(new Date().getFullYear(), currencyCfg?.currency_code ?? 'Rupiah Indonesia')}
                      </pre>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">
                        Tempel hasil AI — format: <code className="bg-muted px-1 rounded">INFLASI: [n] | [alasan]</code>
                      </span>
                      <Textarea
                        className="text-xs min-h-[50px] font-mono"
                        placeholder={'INFLASI: 4 | Estimasi BPS Q3 2026'}
                        value={pastedInflationOutput}
                        onChange={e => setPastedInflationOutput(e.target.value)}
                      />
                      {inflationParseError && (
                        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1.5">{inflationParseError}</p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!pastedInflationOutput.trim()}
                        onClick={handleParseInflation}
                      >
                        Parse &amp; Isi Otomatis
                      </Button>
                    </div>

                    <div className="pt-2 border-t space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Tinjau/koreksi sebelum mencatat (boleh diisi manual tanpa AI):
                      </p>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="0.1"
                          className="w-32 h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder={`pct ${new Date().getFullYear()} (mis. -3 utk deflasi)`}
                          value={recordPct}
                          onChange={e => setRecordPct(e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">%/tahun {new Date().getFullYear()}</span>
                      </div>
                      <Textarea
                        className="text-xs min-h-[60px]"
                        placeholder="Alasan/rujukan resmi (wajib) — mis. sumber data inflasi BPS"
                        value={recordAlasan}
                        onChange={e => setRecordAlasan(e.target.value)}
                      />
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={recordingInflation}
                        onClick={handleRecordInflation}
                      >
                        {recordingInflation ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Catat Peristiwa Resmi
                      </Button>
                      {recordResult && (
                        <p className="text-xs text-muted-foreground">{recordResult}</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <p className="text-xs font-medium text-muted-foreground">
                Koreksi Data Historis
              </p>
              <div className="space-y-2">
                {inflationHistory.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="number"
                      className="w-24 h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Tahun"
                      value={item.tahun}
                      onChange={e => setInflationHistory(prev => prev.map((c, idx) => idx === i ? { ...c, tahun: Number(e.target.value) } : c))}
                    />
                    <input
                      type="number"
                      className="w-24 h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="pct (mis. -3 utk deflasi)"
                      value={item.pct}
                      onChange={e => setInflationHistory(prev => prev.map((c, idx) => idx === i ? { ...c, pct: Number(e.target.value) } : c))}
                    />
                    <span className="text-xs text-muted-foreground">%/tahun</span>
                    <button
                      className="h-7 w-7 flex items-center justify-center rounded-md border text-muted-foreground hover:text-destructive hover:border-red-300 transition-colors shrink-0"
                      onClick={() => setInflationHistory(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setInflationHistory(prev => [...prev, { tahun: new Date().getFullYear(), pct: 0 }])}
                >
                  <Plus className="h-3 w-3" />
                  Tambah Tahun
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={savingInflation}
                  onClick={handleSaveInflation}
                >
                  {savingInflation ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Simpan
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Antrian Klaim Kontribusi */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-emerald-600" />
                Antrian Klaim Kontribusi
                {pendingClaims.length > 0 && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs ml-auto font-normal">
                    {pendingClaims.length} pending
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Klaim kontribusi infrastruktur yang diajukan user, menunggu verifikasi.
                Setujui hanya jika bukti valid — persetujuan memberi poin + lencana kontributor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClaims ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat klaim…
                </div>
              ) : pendingClaims.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Tidak ada klaim kontribusi yang menunggu verifikasi.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingClaims.map(c => (
                    <ClaimAdminCard key={c.id} claim={c} adminId={user!.id} currency={currencyCfg} onProcessed={handleClaimProcessed} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Suspend User */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-600" />
                Suspend User
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Tangguhkan akun yang melanggar — user yang ditangguhkan tidak bisa
                bertransaksi apapun (beli, validasi, buyback, komentar, buat project)
                dan lapaknya otomatis tersembunyi dari marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 h-8 px-3 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Email user"
                  value={suspendEmail}
                  onChange={e => { setSuspendEmail(e.target.value); setFoundUser(null); }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1"
                  disabled={suspendLookupLoading}
                  onClick={handleLookupUser}
                >
                  {suspendLookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Cari
                </Button>
              </div>
              {suspendLookupError && (
                <p className="text-xs rounded-md px-3 py-2 bg-destructive/10 text-destructive">{suspendLookupError}</p>
              )}
              {foundUser && (
                <div className="rounded-lg border p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{foundUser.displayName}</p>
                    <Badge
                      variant={foundUser.suspended ? 'destructive' : 'secondary'}
                      className="text-[10px] mt-1"
                    >
                      {foundUser.suspended ? 'Ditangguhkan' : 'Aktif'}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant={foundUser.suspended ? 'default' : 'destructive'}
                    className="text-xs shrink-0"
                    onClick={() => setSuspendDialogOpen(true)}
                  >
                    {foundUser.suspended ? 'Pulihkan' : 'Tangguhkan'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* User Ditangguhkan */}
        {isAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-600" />
                User Ditangguhkan
                {suspendedUsers.length > 0 && (
                  <Badge className="bg-red-100 text-red-800 border-red-300 text-xs ml-auto font-normal">
                    {suspendedUsers.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs leading-snug">
                Semua akun yang sedang ditangguhkan admin, dalam satu tempat — pulihkan
                langsung tanpa perlu mencari lewat log atau console.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSuspended ? (
                <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat…
                </div>
              ) : suspendedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Tidak ada user yang sedang ditangguhkan.
                </p>
              ) : (
                <div className="space-y-2">
                  {suspendedUsers.map(u => (
                    <div key={u.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Button
                        size="sm"
                        className="text-xs shrink-0"
                        onClick={() => setRestoreTarget(u)}
                      >
                        Pulihkan
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {restoreTarget && (
          <SuspendUserDialog
            targetId={restoreTarget.id}
            targetName={restoreTarget.displayName}
            targetEmail={restoreTarget.email}
            adminUid={user!.id}
            willSuspend={false}
            onClose={() => setRestoreTarget(null)}
            onDone={handleRestoreDone}
          />
        )}

        {suspendDialogOpen && foundUser && (
          <SuspendUserDialog
            targetId={foundUser.id}
            targetName={foundUser.displayName}
            targetEmail={foundUser.email}
            adminUid={user!.id}
            willSuspend={!foundUser.suspended}
            onClose={() => setSuspendDialogOpen(false)}
            onDone={handleSuspendDone}
          />
        )}

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
                <div className="rounded-md bg-muted/50 border px-4 py-2.5 text-sm text-muted-foreground">
                  Kuota Fibonacci:{' '}
                  <strong className="text-foreground">{result.kuota}</strong> slot
                  (dari {result.total} user) — Terisi:{' '}
                  <strong className="text-foreground">{result.terisi}</strong>,
                  Kandidat menunggu:{' '}
                  <strong className="text-foreground">{result.waiting}</strong>
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
