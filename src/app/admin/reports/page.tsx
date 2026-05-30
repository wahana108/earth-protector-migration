'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Flag, Trash2, ShieldAlert } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { fetchFlaggedComments, ignoreComment, deleteComment } from '@/lib/comments';
import type { FlaggedComment } from '@/lib/comments';

const ADMIN_EMAIL = 'ramawan@live.com';

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

export default function AdminReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [comments, setComments] = useState<FlaggedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const isAdmin = !authLoading && user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) {
      router.replace('/');
      return;
    }
    fetchFlaggedComments()
      .then(setComments)
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

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

  // Tampilkan spinner saat auth loading atau saat redirect non-admin
  if (authLoading || !isAdmin) {
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
      <div className="max-w-3xl mx-auto space-y-6">
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
    </MainLayout>
  );
}
