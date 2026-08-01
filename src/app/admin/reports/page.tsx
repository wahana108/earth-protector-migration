'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2, Flag, Trash2, ShieldAlert, ArrowLeftRight, Users } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { fetchFlaggedComments, ignoreComment, deleteComment } from '@/lib/comments';
import type { FlaggedComment } from '@/lib/comments';
import { fetchAllReports, resolveReport, getMostReportedSummary, type ReportSummaryEntry } from '@/lib/firestore';
import { getCommunityConfig } from '@/lib/community-config';
import type { Report } from '@/lib/types';

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

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function PageSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="flex justify-end gap-2 pt-1">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-32" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type SummaryRow = ReportSummaryEntry & { displayName: string; soldNfts: number };

export default function AdminReportsPage() {
  const { user, loading: authLoading, isModerator, isAdmin } = useAuth();
  const router = useRouter();

  // ── Komentar terlaporkan (moderator + admin) ──────────────────────────────
  const [comments, setComments] = useState<FlaggedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  // ── Laporan transaksi (admin-only) — koleksi `reports`, sebelumnya orphan ──
  const [reports, setReports] = useState<Report[]>([]);
  const [reportUserNames, setReportUserNames] = useState<Record<string, string>>({});
  const [loadingReports, setLoadingReports] = useState(true);
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);

  // ── Ringkasan "paling sering dilaporkan" (admin-only) ─────────────────────
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [minUniquePublic, setMinUniquePublic] = useState(3);

  useEffect(() => {
    if (authLoading) return;
    if (!isModerator) { router.replace('/'); return; }
    fetchFlaggedComments()
      .then(setComments)
      .finally(() => setLoading(false));
  }, [isModerator, authLoading, router]);

  useEffect(() => {
    if (authLoading || !isModerator) return;
    if (!isAdmin) { setLoadingReports(false); setLoadingSummary(false); return; }
    loadReports();
    loadSummary();
  }, [isAdmin, isModerator, authLoading]);

  async function loadReports() {
    setLoadingReports(true);
    try {
      const list = await fetchAllReports(50);
      setReports(list);
      const ids = [...new Set(
        list.flatMap((r) => [r.userId, r.reported_user_id]).filter((v): v is string => !!v),
      )];
      const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'users', id))));
      const map: Record<string, string> = {};
      snaps.forEach((s, i) => {
        map[ids[i]] = s.exists() ? (s.data().displayName as string) || truncateId(ids[i]) : '—';
      });
      setReportUserNames(map);
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadSummary() {
    setLoadingSummary(true);
    try {
      const [raw, config] = await Promise.all([
        getMostReportedSummary(),
        getCommunityConfig(),
      ]);
      setMinUniquePublic(config?.min_unique_reporters_public ?? 3);
      const top = raw.slice(0, 20);
      const snaps = await Promise.all(top.map((e) => getDoc(doc(db, 'users', e.targetUserId))));
      setSummary(top.map((e, i) => {
        const s = snaps[i];
        const data = s.exists() ? s.data() : undefined;
        return {
          ...e,
          displayName: (data?.displayName as string) || truncateId(e.targetUserId),
          soldNfts: (data?.soldNfts as number) ?? 0,
        };
      }));
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleIgnore(c: FlaggedComment) {
    setActingId(c.id);
    try {
      await ignoreComment(c.nft_unit_id, c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(c: FlaggedComment) {
    setActingId(c.id);
    try {
      await deleteComment(c.nft_unit_id, c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
    } finally {
      setActingId(null);
    }
  }

  async function handleResolveReport(r: Report, status: 'upheld' | 'dismissed') {
    if (!user) return;
    setResolvingReportId(r.id);
    try {
      await resolveReport(r.id, status, user.id);
      setReports((prev) => prev.filter((x) => x.id !== r.id));
    } finally {
      setResolvingReportId(null);
    }
  }

  if (authLoading || !isModerator) {
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

        {isAdmin && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold">Paling Sering Dilaporkan</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Dihitung dari pelapor UNIK yang aktif (bukan jumlah laporan). Admin-only —
                belum tampil publik. Ambang tampil publik: ≥{minUniquePublic} pelapor unik
                (parameter <code>min_unique_reporters_public</code>).
              </p>
            </div>

            {loadingSummary ? (
              <PageSkeleton />
            ) : summary.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-xl">
                <p className="text-sm text-muted-foreground">Belum ada laporan aktif yang tercatat.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {summary.map((s) => (
                  <Card key={s.targetUserId}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.soldNfts} NFT terjual · rasio {s.soldNfts > 0 ? (s.uniqueReporters / s.soldNfts).toFixed(2) : '—'}
                        </p>
                      </div>
                      <Badge
                        variant={s.uniqueReporters >= minUniquePublic ? 'destructive' : 'secondary'}
                        className="shrink-0"
                      >
                        {s.uniqueReporters} pelapor unik
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold">Laporan Transaksi</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Laporan dari halaman Log Transaksi Komunitas, menunggu tinjauan admin.
              </p>
            </div>

            {loadingReports ? (
              <PageSkeleton />
            ) : reports.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-xl">
                <p className="text-sm text-muted-foreground">Tidak ada laporan transaksi menunggu tinjauan.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          Pelapor: <span className="font-medium text-foreground">{reportUserNames[r.userId] ?? truncateId(r.userId)}</span>
                          {' · '}Terlapor: <span className="font-medium text-foreground">{r.reported_user_id ? (reportUserNames[r.reported_user_id] ?? truncateId(r.reported_user_id)) : '—'}</span>
                        </p>
                        <span className="text-xs text-muted-foreground">{relativeTime(r.createdAt)}</span>
                      </div>
                      <p className="text-sm leading-snug break-words">{r.reason}</p>
                      {r.status !== 'pending' && (
                        <Badge variant="outline" className="text-xs">{r.status}</Badge>
                      )}
                      {r.status === 'pending' && (
                        <div className="flex gap-2 justify-end pt-2 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleResolveReport(r, 'dismissed')}
                            disabled={resolvingReportId === r.id}
                          >
                            {resolvingReportId === r.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : 'Abaikan'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => handleResolveReport(r, 'upheld')}
                            disabled={resolvingReportId === r.id}
                          >
                            {resolvingReportId === r.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : 'Tandai Valid'}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">Komentar Terlaporkan</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Komentar yang dilaporkan oleh komunitas dan menunggu tindakan admin.
            </p>
          </div>

          {loading ? (
            <PageSkeleton />
          ) : comments.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed rounded-xl">
              <Flag className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-semibold text-muted-foreground">
                Tidak ada komentar yang dilaporkan
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Semua komentar komunitas bersih.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {comments.map((c) => (
                  <Card
                    key={c.id}
                    className="border-yellow-400/40 bg-yellow-50/30 dark:bg-yellow-950/10"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground uppercase">
                          {c.display_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{c.display_name}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {relativeTime(c.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            NFT:{' '}
                            <span className="font-medium text-foreground">{c.nama_nft}</span>
                          </p>
                          <p className="text-sm leading-snug break-words pt-0.5">{c.text}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => handleIgnore(c)}
                          disabled={actingId === c.id}
                        >
                          {actingId === c.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Flag className="h-3 w-3" />}
                          Abaikan
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => handleDelete(c)}
                          disabled={actingId === c.id}
                        >
                          {actingId === c.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />}
                          Hapus Komentar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {comments.length} komentar dilaporkan
              </p>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
