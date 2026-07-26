'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  collectionGroup, query, orderBy, limit, getDocs,
  addDoc, collection, Timestamp,
} from 'firebase/firestore';
import { ArrowLeftRight, Flag, Search } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import type { NeracaLog } from '@/lib/types';
import { getCommunityConfig } from '@/lib/community-config';
import { formatCurrency, type CurrencyConfig } from '@/lib/format-currency';

// ─── Types ────────────────────────────────────────────────────────────────────

type LogEntry = NeracaLog & { userId: string };
type FilterTab = 'semua' | 'beli' | 'jual' | 'validasi' | 'buyback' | 'fee';

const FILTER_TYPES: Record<FilterTab, string[]> = {
  semua:    [],
  beli:     ['beli', 'beli_pool'],
  jual:     ['jual'],
  validasi: ['validasi'],
  buyback:  ['buyback'],
  fee:      ['fee_keluar', 'fee_validator'],
};

const TYPE_LABELS: Record<string, string> = {
  beli: 'Beli', beli_pool: 'Beli Pool', jual: 'Jual',
  validasi: 'Validasi', buyback: 'Buyback', level_change: 'Level',
  transfer_pool: 'Pool', lewati_fifo: 'Lewati',
  fee_keluar: 'Fee Keluar', fee_validator: 'Fee Validator',
  anomali_ai: 'Anomali AI', anomali_ai_revert: 'Pembatalan Anomali AI',
  anomali_ai_bersih: 'AI Review Bersih', kontribusi_infrastruktur: 'Reward Kontribusi',
  dispute_auto_cancel: 'Dispute Dibatalkan Otomatis',
  admin_suspend: 'Suspend Admin', admin_unsuspend: 'Pulihkan Admin',
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'semua',    label: 'Semua' },
  { key: 'beli',     label: 'Beli' },
  { key: 'jual',     label: 'Jual' },
  { key: 'validasi', label: 'Validasi' },
  { key: 'buyback',  label: 'Buyback' },
  { key: 'fee',      label: 'Fee' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function typeBadgeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (['beli', 'beli_pool'].includes(type)) return 'default';
  if (type === 'jual') return 'secondary';
  if (type === 'fee_keluar') return 'destructive';
  return 'outline';
}

// ─── Report Dialog ────────────────────────────────────────────────────────────

function ReportDialog({
  entry, reporterId, onClose,
}: {
  entry: LogEntry;
  reporterId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'reports'), {
        transactionId: entry.id,
        nft_unit_id: entry.nft_unit_id,
        reported_user_id: entry.userId,
        userId: reporterId,
        reason: reason.trim(),
        status: 'pending',
        createdAt: Timestamp.now(),
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Laporkan Transaksi</DialogTitle>
        </DialogHeader>
        {done ? (
          <p className="text-sm text-muted-foreground py-2">
            Laporan terkirim. Tim admin akan meninjau.
          </p>
        ) : (
          <div className="space-y-3 py-1">
            <p className="text-xs text-muted-foreground">
              Transaksi:{' '}
              <span className="font-medium">
                {entry.nama_nft || entry.nft_unit_id.slice(0, 12) + '…'}
              </span>
            </p>
            <div className="space-y-1.5">
              <Label>Alasan pelaporan</Label>
              <Textarea
                rows={3}
                placeholder="Jelaskan kenapa transaksi ini mencurigakan..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Tutup</Button>
          {!done && (
            <Button onClick={handleSubmit} disabled={loading || !reason.trim()}>
              {loading ? 'Mengirim...' : 'Kirim Laporan'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [reporting, setReporting] = useState<LogEntry | null>(null);
  const [currencyCfg, setCurrencyCfg] = useState<CurrencyConfig | undefined>(undefined);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    async function load() {
      try {
        const q = query(
          collectionGroup(db, 'neraca_log'),
          orderBy('timestamp', 'desc'),
          limit(100),
        );
        const [snap, cfg] = await Promise.all([getDocs(q), getCommunityConfig()]);
        setCurrencyCfg(cfg ?? undefined);
        const entries: LogEntry[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            userId: d.ref.parent.parent?.id ?? '',
            type: data.type as NeracaLog['type'],
            nft_unit_id: (data.nft_unit_id as string) ?? '',
            nama_nft: (data.nama_nft as string) ?? '',
            harga_transaksi: (data.harga_transaksi as number) ?? 0,
            nilai_selisih: (data.nilai_selisih as number) ?? 0,
            delta: (data.delta as number) ?? 0,
            counterparty_id: (data.counterparty_id as string) ?? '',
            project_id: (data.project_id as string) ?? '',
            timestamp: (data.timestamp as Timestamp)?.toDate?.() ?? new Date(),
            ...(data.alasan !== undefined ? { alasan: data.alasan as string } : {}),
            ...(data.target_email !== undefined ? { target_email: data.target_email as string } : {}),
            ...(data.target_nama !== undefined ? { target_nama: data.target_nama as string } : {}),
          };
        });
        setLogs(entries);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = logs.filter(l => {
    const matchesTab = filter === 'semua' || FILTER_TYPES[filter].includes(l.type);
    const matchesSearch = !q
      || l.nama_nft.toLowerCase().includes(q)
      || (TYPE_LABELS[l.type] ?? l.type).toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16 space-y-4">
          <h2 className="text-2xl font-bold">Login diperlukan</h2>
          <p className="text-muted-foreground">
            Login untuk melihat log transaksi komunitas.
          </p>
          <Button asChild><Link href="/login">Login</Link></Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-headline font-bold">Log Transaksi Komunitas</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            100 transaksi terbaru dari seluruh anggota. Semua transaksi bersifat publik
            sesuai prinsip transparansi Inspira Better World.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama NFT atau tipe transaksi..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map(tab => (
            <Button
              key={tab.key}
              size="sm"
              variant={filter === tab.key ? 'default' : 'outline'}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              {tab.key !== 'semua' && !loading && (
                <span className="ml-1.5 text-xs opacity-60">
                  {logs.filter(l => FILTER_TYPES[tab.key].includes(l.type)).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Tabel */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            Tidak ada transaksi untuk filter ini.
          </p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Tipe</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">NFT</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">User</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Delta</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Waktu</th>
                  <th className="w-8 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr
                    key={`${entry.userId}-${entry.id}`}
                    className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                  >
                    <td className="px-4 py-2.5 border-t">
                      <Badge
                        variant={typeBadgeVariant(entry.type)}
                        className="text-[10px] px-1.5 py-0 whitespace-nowrap"
                      >
                        {TYPE_LABELS[entry.type] ?? entry.type}
                      </Badge>
                      {['admin_suspend', 'admin_unsuspend'].includes(entry.type) && entry.target_nama && (
                        <p className="text-[10px] text-muted-foreground mt-1 max-w-[180px] truncate">
                          {entry.target_nama}{entry.target_email ? ` (${entry.target_email})` : ''}
                          {entry.alasan ? ` — ${entry.alasan}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 border-t max-w-[160px]">
                      {entry.nft_unit_id && entry.nft_unit_id !== 'system' ? (
                        <Link
                          href={`/nft/${entry.nft_unit_id}`}
                          className="font-medium truncate block hover:underline"
                        >
                          {entry.nama_nft || entry.nft_unit_id.slice(0, 10) + '…'}
                        </Link>
                      ) : (
                        <span className="font-medium truncate block">
                          {entry.nama_nft || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 border-t font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {entry.userId.slice(0, 8)}…
                    </td>
                    <td className={cn(
                      'px-4 py-2.5 border-t text-right font-semibold font-mono text-xs whitespace-nowrap',
                      entry.delta > 0 ? 'text-green-600 dark:text-green-400'
                        : entry.delta < 0 ? 'text-destructive'
                        : 'text-muted-foreground',
                    )}>
                      {entry.delta !== 0
                        ? `${entry.delta > 0 ? '+' : ''}${formatCurrency(entry.delta, currencyCfg)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 border-t text-right text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                      {relativeTime(entry.timestamp)}
                    </td>
                    <td className="px-2 py-2.5 border-t">
                      {entry.userId !== user.id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setReporting(entry)}
                          title="Laporkan"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reporting && user && (
          <ReportDialog
            entry={reporting}
            reporterId={user.id}
            onClose={() => setReporting(null)}
          />
        )}
      </div>
    </MainLayout>
  );
}
