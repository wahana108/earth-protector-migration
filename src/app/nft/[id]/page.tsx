'use client';

import { use, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, ExternalLink, Heart, Loader2, ShoppingCart, Flag, Trash2, UserX,
} from 'lucide-react';
import {
  collection, doc, getDoc, getDocs, query, orderBy, limit, Timestamp,
} from 'firebase/firestore';

import { MainLayout } from '@/components/layout/main-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getCommunityConfig } from '@/lib/community-config';
import { buyNftUnit, BuyError, toggleNftLike } from '@/lib/projects';
import { fetchComments, addComment, deleteComment, reportComment } from '@/lib/comments';
import { BlockUserDialog } from '@/components/block-user-dialog';
import { KATEGORI_LABELS, type NFTUnit, type ProjectCategory, type Comment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getPlaceholder } from '@/lib/category-placeholders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
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

// ─── Types ────────────────────────────────────────────────────────────────────

type PageData = {
  unit: NFTUnit;
  projectNama: string;
  projectLinkBukti: string;
  ownerName: string;
};

type HistoryItem = {
  id: string;
  dari_name: string;
  ke_name: string;
  harga: number;
  timestamp: Date;
  transaction_description?: string;
  proof_link?: string;
};

// ─── Converter ────────────────────────────────────────────────────────────────

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

// ─── Buy Dialog ───────────────────────────────────────────────────────────────

interface BuyDialogProps {
  unit: NFTUnit;
  linkBukti: string;
  buyerId: string;
  hargaDasar: number;
  batasAtas: number;
  onClose: () => void;
  onSuccess: () => void;
}

function BuyDialog({
  unit, linkBukti, buyerId, hargaDasar, batasAtas, onClose, onSuccess,
}: BuyDialogProps) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [proofLink, setProofLink] = useState('');

  async function handleConfirm() {
    setBuying(true);
    setError('');
    try {
      await buyNftUnit(unit.id, buyerId, hargaDasar, batasAtas, {
        transaction_description: txDescription.trim() || undefined,
        proof_link: proofLink.trim() || undefined,
      });
      onSuccess();
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
                <span className="font-semibold text-green-600">
                  +{formatIDR(unit.nilai_selisih)}
                </span>
              </div>
            </div>
          </div>

          {linkBukti && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 p-3">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1.5">
                Verifikasi project sebelum membeli:
              </p>
              <a
                href={linkBukti}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                Lihat Bukti Project
              </a>
            </div>
          )}

          {unit.nilai_selisih === 0 && (
            <p className="text-xs text-muted-foreground">
              NFT ini dijual di harga dasar — neraca tidak berubah untuk kedua pihak.
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Keterangan (opsional)</p>
            <Textarea
              placeholder="Deskripsi singkat alasan pembelian..."
              value={txDescription}
              onChange={(e) => setTxDescription(e.target.value)}
              rows={2}
              className="text-sm resize-none"
              disabled={buying}
            />
            <Input
              placeholder="Link bukti transaksi (opsional)"
              value={proofLink}
              onChange={(e) => setProofLink(e.target.value)}
              className="text-sm"
              disabled={buying}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
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

// ─── Comment Section ──────────────────────────────────────────────────────────

interface CommentSectionProps {
  nftId: string;
  nftOwnerId?: string;
  currentUserId: string | undefined;
  currentUserDisplayName: string | null;
}

function CommentSection({ nftId, nftOwnerId, currentUserId, currentUserDisplayName }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reportedSet, setReportedSet] = useState<Set<string>>(new Set());
  const reportedInitRef = useRef(false);
  const [blockTarget, setBlockTarget] = useState<{ userId: string; name: string } | null>(null);

  useEffect(() => {
    fetchComments(nftId).then(setComments).finally(() => setLoading(false));
  }, [nftId]);

  useEffect(() => {
    if (comments.length === 0 || reportedInitRef.current) return;
    reportedInitRef.current = true;
    const reported = new Set<string>(
      comments
        .map(c => c.id)
        .filter(id => localStorage.getItem(`tmep_reported_${id}`) === '1'),
    );
    setReportedSet(reported);
  }, [comments]);

  async function handleSubmit() {
    if (!currentUserId || !text.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const name = currentUserDisplayName ?? 'User';
      const newComment = await addComment(nftId, currentUserId, name, text.trim(), nftOwnerId);
      setComments(prev => [newComment, ...prev]);
      setText('');
    } catch {
      setError('Gagal mengirim komentar. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(nftId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReport(commentId: string) {
    try {
      await reportComment(nftId, commentId);
      localStorage.setItem(`tmep_reported_${commentId}`, '1');
      setReportedSet(prev => new Set(prev).add(commentId));
    } catch { /* silent */ }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Komentar{!loading && ` (${comments.length})`}
      </h2>

      {/* Input form */}
      {currentUserId ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Tulis komentar..."
            maxLength={500}
            rows={3}
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{text.length}/500</span>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !text.trim()}>
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Kirim'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-2">Login</Link>{' '}
          untuk berkomentar
        </p>
      )}

      {/* Policy */}
      <p className="text-xs text-muted-foreground leading-snug">
        Komentar harus sopan dan relevan dengan project charity ini. Gunakan{' '}
        <Flag className="h-3 w-3 inline align-text-bottom" />{' '}
        untuk melaporkan komentar yang melanggar aturan.
      </p>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-lg">
          Belum ada komentar. Jadilah yang pertama!
        </p>
      ) : (
        <div className="space-y-5">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground uppercase">
                {c.display_name.charAt(0)}
              </div>

              {deletingId === c.id ? (
                <div className="flex-1 py-1">
                  <p className="text-muted-foreground mb-2">Hapus komentar ini?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs px-2"
                      onClick={() => handleDelete(c.id)}
                    >
                      Ya, hapus
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2"
                      onClick={() => setDeletingId(null)}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold">{c.display_name}</span>
                    <span className="text-xs text-muted-foreground">{relativeTime(c.timestamp)}</span>
                    <div className="ml-auto shrink-0">
                      {c.user_id === currentUserId ? (
                        <button
                          onClick={() => setDeletingId(c.id)}
                          className="p-0.5 text-destructive/50 hover:text-destructive transition-colors"
                          title="Hapus komentar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : currentUserId ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => !reportedSet.has(c.id) && handleReport(c.id)}
                            disabled={reportedSet.has(c.id)}
                            className={cn(
                              'p-0.5 transition-colors',
                              reportedSet.has(c.id)
                                ? 'text-yellow-500 cursor-default'
                                : 'text-muted-foreground/40 hover:text-yellow-500',
                            )}
                            title={reportedSet.has(c.id) ? 'Sudah dilaporkan' : 'Laporkan komentar'}
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setBlockTarget({ userId: c.user_id, name: c.display_name })}
                            className="p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors"
                            title="Blokir pengguna ini"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-muted-foreground/80 leading-snug break-words mt-0.5">
                    {c.text}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {blockTarget && currentUserId && (
        <BlockUserDialog
          targetUserId={blockTarget.userId}
          targetName={blockTarget.name}
          currentUserId={currentUserId}
          onClose={() => setBlockTarget(null)}
          onBlocked={() => setBlockTarget(null)}
        />
      )}
    </section>
  );
}

// ─── Page Skeleton ─────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </MainLayout>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function NftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [isLiked, setIsLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const [buyOpen, setBuyOpen] = useState(false);
  const [config, setConfig] = useState<{ harga_dasar: number; batas_atas: number } | null>(null);

  // Main data
  useEffect(() => {
    async function load() {
      try {
        const unitSnap = await getDoc(doc(db, 'nft_units', id));
        if (!unitSnap.exists()) { setMissing(true); return; }
        const unit = toNFTUnit(unitSnap.id, unitSnap.data() as Record<string, unknown>);

        const [projectSnap, ownerSnap] = await Promise.all([
          getDoc(doc(db, 'projects', unit.project_id)),
          getDoc(doc(db, 'users', unit.owner_id)),
        ]);

        const projectData = projectSnap.exists() ? projectSnap.data() : {};
        const ownerData = ownerSnap.exists() ? ownerSnap.data() : {};

        setData({
          unit,
          projectNama: (projectData.nama_project as string) || unit.nama_project,
          projectLinkBukti: (projectData.link_bukti as string) || '',
          ownerName: (ownerData.displayName as string) || 'User',
        });
        setLikeCount(unit.like_count);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Like status
  useEffect(() => {
    if (!user || !data) return;
    getDoc(doc(db, 'nft_units', id, 'likes', user.id))
      .then(snap => setIsLiked(snap.exists()))
      .catch(() => {});
  }, [id, user, data]);

  // History kepemilikan
  useEffect(() => {
    getDocs(
      query(
        collection(db, 'nft_units', id, 'history_kepemilikan'),
        orderBy('timestamp', 'desc'),
        limit(10),
      ),
    )
      .then(async snap => {
        if (snap.empty) return;

        const raw = snap.docs.map(d => ({
          id: d.id,
          dari: d.data().dari as string,
          ke: d.data().ke as string,
          harga: (d.data().harga as number) ?? 0,
          timestamp: (d.data().timestamp as Timestamp)?.toDate() ?? new Date(),
          transaction_description: (d.data().transaction_description as string) || undefined,
          proof_link: (d.data().proof_link as string) || undefined,
        }));

        const uniqueIds = [...new Set(raw.flatMap(h => [h.dari, h.ke]))];
        const userSnaps = await Promise.all(
          uniqueIds.map(uid => getDoc(doc(db, 'users', uid))),
        );
        const nameMap: Record<string, string> = {};
        userSnaps.forEach(s => {
          if (s.exists()) {
            nameMap[s.id] = (s.data().displayName as string) || s.id.slice(0, 8) + '…';
          }
        });

        setHistory(
          raw.map(h => ({
            id: h.id,
            dari_name: nameMap[h.dari] ?? h.dari.slice(0, 8) + '…',
            ke_name: nameMap[h.ke] ?? h.ke.slice(0, 8) + '…',
            harga: h.harga,
            timestamp: h.timestamp,
            transaction_description: h.transaction_description,
            proof_link: h.proof_link,
          })),
        );
      })
      .finally(() => setHistoryLoading(false));
  }, [id]);

  // Community config
  useEffect(() => {
    getCommunityConfig()
      .then(c => { if (c) setConfig({ harga_dasar: c.harga_dasar, batas_atas: c.batas_atas }); })
      .catch(() => {});
  }, []);

  async function handleLike() {
    if (!user || !data || liking) return;
    const wasLiked = isLiked;
    setLiking(true);
    setIsLiked(!wasLiked);
    setLikeCount(n => wasLiked ? Math.max(0, n - 1) : n + 1);
    try {
      await toggleNftLike(id, user.id, wasLiked);
    } catch {
      setIsLiked(wasLiked);
      setLikeCount(n => wasLiked ? n + 1 : Math.max(0, n - 1));
    } finally {
      setLiking(false);
    }
  }

  if (loading) return <PageSkeleton />;
  if (missing) return notFound();
  if (!data) return null;

  const { unit, projectNama, projectLinkBukti, ownerName } = data;
  const isOwn = !!user && user.id === unit.owner_id;
  const canBuy = !!user && !isOwn && unit.for_sale && !!config;
  const kategoriLabel = KATEGORI_LABELS[unit.kategori] ?? unit.kategori;
  const currentUserDisplayName = user?.displayName ?? user?.email ?? null;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Back ke project */}
        <Button variant="ghost" asChild className="gap-2 -ml-2 h-8">
          <Link href={`/projects/${unit.project_id}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="line-clamp-1">{projectNama}</span>
          </Link>
        </Button>

        {/* Gambar */}
        <div className="aspect-video rounded-xl overflow-hidden bg-muted">
          <img
            src={unit.gambar_url || getPlaceholder(unit.kategori)}
            alt={unit.nama_nft}
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(unit.kategori); }}
          />
        </div>

        {/* Info utama */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={unit.status === 'valid' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {unit.status}
            </Badge>
            <Badge variant="outline">{kategoriLabel}</Badge>
          </div>

          <h1 className="text-2xl font-bold leading-snug">{unit.nama_nft}</h1>

          <p className="text-sm text-muted-foreground">
            Project:{' '}
            <Link
              href={`/projects/${unit.project_id}`}
              className="font-medium text-foreground hover:underline"
            >
              {projectNama}
            </Link>
          </p>

          {/* Harga, selisih, owner */}
          <div className="rounded-lg border p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Harga Jual</span>
              <span className="font-bold text-base">{formatIDR(unit.harga_jual)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Neracamu bertambah jika beli</span>
              <span
                className={cn(
                  'font-semibold',
                  unit.nilai_selisih > 0 ? 'text-green-600' : 'text-muted-foreground',
                )}
              >
                {unit.nilai_selisih > 0 ? '+' : ''}{formatIDR(unit.nilai_selisih)}
              </span>
            </div>
            <div className="flex justify-between pt-1.5 border-t">
              <span className="text-muted-foreground">Dimiliki</span>
              <span className="font-medium">{isOwn ? 'Kamu' : ownerName}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-1.5"
              disabled={!canBuy}
              onClick={canBuy ? () => setBuyOpen(true) : undefined}
              title={
                !user ? 'Login untuk membeli' :
                isOwn ? 'Ini NFT milikmu' :
                !unit.for_sale ? 'NFT ini sudah terjual' :
                !config ? 'Memuat konfigurasi...' : 'Beli NFT ini'
              }
            >
              <ShoppingCart className="h-4 w-4" />
              {isOwn ? 'Milikmu' : !unit.for_sale ? 'Sudah Terjual' : 'Beli NFT Ini'}
            </Button>

            <Button
              variant={isLiked ? 'default' : 'outline'}
              className="gap-1.5"
              onClick={handleLike}
              disabled={!user || isOwn || liking}
              title={
                !user ? 'Login untuk like' :
                isOwn ? 'Tidak bisa like NFT milikmu sendiri' :
                isLiked ? 'Batal like' : 'Like NFT ini'
              }
            >
              {liking
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} />}
              {likeCount}
            </Button>

            {projectLinkBukti && (
              <Button variant="outline" className="gap-1.5" asChild>
                <a href={projectLinkBukti} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Bukti Project
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* History Kepemilikan */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            History Kepemilikan
          </h2>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat transaksi.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Dari</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Ke</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Harga</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <>
                      <tr
                        key={h.id}
                        className={cn('border-t', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}
                      >
                        <td className="px-3 py-2 font-medium">{h.dari_name}</td>
                        <td className="px-3 py-2 font-medium">{h.ke_name}</td>
                        <td className="px-3 py-2 text-right">{formatIDR(h.harga)}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                          {relativeTime(h.timestamp)}
                        </td>
                      </tr>
                      {(h.transaction_description || h.proof_link) && (
                        <tr
                          key={`${h.id}-note`}
                          className={cn('border-t border-dashed', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}
                        >
                          <td colSpan={4} className="px-3 pb-2 pt-0.5">
                            {h.transaction_description && (
                              <p className="text-xs text-muted-foreground italic">
                                {h.transaction_description}
                              </p>
                            )}
                            {h.proof_link && (
                              <a
                                href={h.proof_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                Bukti transaksi
                              </a>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Komentar */}
        <CommentSection
          nftId={id}
          nftOwnerId={unit.owner_id}
          currentUserId={user?.id}
          currentUserDisplayName={currentUserDisplayName}
        />

      </div>

      {/* Buy Dialog */}
      {buyOpen && user && config && (
        <BuyDialog
          unit={unit}
          linkBukti={projectLinkBukti}
          buyerId={user.id}
          hargaDasar={config.harga_dasar}
          batasAtas={config.batas_atas}
          onClose={() => setBuyOpen(false)}
          onSuccess={() => {
            setData(prev =>
              prev
                ? { ...prev, unit: { ...prev.unit, owner_id: user.id, for_sale: false }, ownerName: user.displayName ?? 'Kamu' }
                : prev,
            );
          }}
        />
      )}
    </MainLayout>
  );
}
