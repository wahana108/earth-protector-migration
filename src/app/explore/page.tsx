'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  collection, query, where, orderBy, limit,
  getDocs, getDoc, doc, Timestamp,
} from 'firebase/firestore';
import {
  Heart, ImageOff, Pencil, Loader2, ShoppingCart, MessageCircle, Trash2, Flag, ExternalLink,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getCommunityConfig } from '@/lib/community-config';
import { toggleNftLike, updateNftUnitGambar, updateProjectGambar, buyNftUnit, BuyError } from '@/lib/projects';
import { fetchComments, addComment, deleteComment, reportComment } from '@/lib/comments';
import {
  KATEGORI_LABELS, KATEGORI_UTAMA, KATEGORI_CHILDREN, KATEGORI_PARENT,
  type NFTUnit, type ProjectCategory, type Comment,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 24;


function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
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
    digunakan_validasi: (data.digunakan_validasi as boolean) ?? false,
    project_validasi_id: (data.project_validasi_id as string | null) ?? null,
    like_count: (data.like_count as number) ?? 0,
    comment_count: (data.comment_count as number) ?? 0,
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
  };
}

// ─── Buy Dialog ──────────────────────────────────────────────────────────────

interface BuyDialogProps {
  unit: NFTUnit;
  buyerId: string;
  hargaDasar: number;
  batasAtas: number;
  onClose: () => void;
  onSuccess: (nftId: string, buyerId: string) => void;
}

function BuyDialog({ unit, buyerId, hargaDasar, batasAtas, onClose, onSuccess }: BuyDialogProps) {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [linkBukti, setLinkBukti] = useState<string | null>(null);

  useEffect(() => {
    if (!unit.project_id) return;
    getDoc(doc(db, 'projects', unit.project_id))
      .then((snap) => {
        if (snap.exists()) setLinkBukti((snap.data().link_bukti as string) || null);
      })
      .catch(() => {});
  }, [unit.project_id]);

  async function handleConfirm() {
    setBuying(true);
    setError('');
    try {
      await buyNftUnit(unit.id, buyerId, hargaDasar, batasAtas);
      onSuccess(unit.id, buyerId);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof BuyError
          ? err.message
          : 'Transaksi gagal. Coba lagi.',
      );
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

          {error && (
            <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={buying}>
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={buying}>
            {buying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Konfirmasi Beli
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Gambar Dialog ───────────────────────────────────────────────────────

interface EditGambarDialogProps {
  unit: NFTUnit;
  onClose: () => void;
  onSaved: (nftId: string, newUrl: string, scope: 'unit' | 'project') => void;
}

function EditGambarDialog({ unit, onClose, onSaved }: EditGambarDialogProps) {
  const [url, setUrl] = useState(unit.gambar_url);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function isValidUrl(s: string) {
    try { new URL(s); return true; } catch { return false; }
  }

  async function handleSave(scope: 'unit' | 'project') {
    if (!isValidUrl(url)) { setError('Harus URL yang valid.'); return; }
    setSaving(true);
    setError('');
    try {
      if (scope === 'project') {
        await updateProjectGambar(unit.project_id, url);
      } else {
        await updateNftUnitGambar(unit.id, url);
      }
      onSaved(unit.id, url, scope);
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
          <DialogTitle>Edit Gambar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground leading-snug">
            <span className="font-medium">{unit.nama_nft}</span>
            <br />Project: {unit.nama_project}
          </p>
          <div className="space-y-2">
            <Label htmlFor="edit-url">URL Gambar Baru</Label>
            <Input
              id="edit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => handleSave('unit')}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update NFT ini saja
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => handleSave('project')}
            disabled={saving}
          >
            Update semua NFT dalam project ini
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Comment Panel ────────────────────────────────────────────────────────────

interface CommentPanelProps {
  nftId: string;
  currentUserId: string | undefined;
  currentUserDisplayName: string | null;
  onCommentAdded: () => void;
  onCommentDeleted: () => void;
}

function CommentPanel({
  nftId, currentUserId, currentUserDisplayName, onCommentAdded, onCommentDeleted,
}: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reportedSet, setReportedSet] = useState<Set<string>>(new Set());
  const reportedInitRef = useRef(false);

  useEffect(() => {
    fetchComments(nftId)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [nftId]);

  // Inisialisasi reportedSet dari localStorage setelah komentar pertama dimuat
  useEffect(() => {
    if (comments.length === 0 || reportedInitRef.current) return;
    reportedInitRef.current = true;
    const reported = new Set<string>(
      comments
        .map((c) => c.id)
        .filter((id) => localStorage.getItem(`tmep_reported_${id}`) === '1'),
    );
    setReportedSet(reported);
  }, [comments]);

  async function handleSubmit() {
    if (!currentUserId || !text.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const displayName = currentUserDisplayName ?? 'User';
      const newComment = await addComment(nftId, currentUserId, displayName, text.trim());
      setComments((prev) => [newComment, ...prev]);
      setText('');
      onCommentAdded();
    } catch {
      setError('Gagal mengirim komentar. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(nftId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentDeleted();
    } catch {
      // silent fail
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReport(commentId: string) {
    try {
      await reportComment(nftId, commentId);
      localStorage.setItem(`tmep_reported_${commentId}`, '1');
      setReportedSet((prev) => new Set(prev).add(commentId));
    } catch {
      // silent fail
    }
  }

  return (
    <div className="border-t bg-muted/30 px-3 pt-3 pb-3 space-y-3">
      {/* Daftar komentar */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2 items-start">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-1">
          Belum ada komentar. Jadilah yang pertama!
        </p>
      ) : (
        <div className="space-y-2.5">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 text-xs">
              <div className="h-6 w-6 rounded-full bg-muted border flex items-center justify-center shrink-0 text-[10px] font-semibold text-muted-foreground uppercase">
                {c.display_name.charAt(0)}
              </div>

              {deletingId === c.id ? (
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-muted-foreground mb-1.5">Hapus komentar ini?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-xs px-2"
                      onClick={() => handleDelete(c.id)}
                    >
                      Ya, hapus
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      onClick={() => setDeletingId(null)}
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-w-0 flex items-start gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-semibold text-foreground">{c.display_name}</span>
                      <span className="text-[10px] text-muted-foreground">{relativeTime(c.timestamp)}</span>
                    </div>
                    <p className="text-foreground/80 leading-snug break-words mt-0.5">{c.text}</p>
                  </div>
                  <div className="shrink-0">
                    {c.user_id === currentUserId ? (
                      <button
                        onClick={() => setDeletingId(c.id)}
                        className="p-0.5 rounded text-destructive/50 hover:text-destructive transition-colors"
                        title="Hapus komentar"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : currentUserId ? (
                      <button
                        onClick={() => !reportedSet.has(c.id) && handleReport(c.id)}
                        disabled={reportedSet.has(c.id)}
                        className={cn(
                          'p-0.5 rounded transition-colors',
                          reportedSet.has(c.id)
                            ? 'text-yellow-500 cursor-default'
                            : 'text-muted-foreground/40 hover:text-yellow-500',
                        )}
                        title={reportedSet.has(c.id) ? 'Sudah dilaporkan' : 'Laporkan komentar'}
                      >
                        <Flag className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Policy text */}
      <p className="text-[10px] text-muted-foreground leading-snug">
        Komentar harus sopan dan relevan dengan project charity ini. Gunakan{' '}
        <Flag className="h-3 w-3 inline align-text-bottom" />{' '}
        untuk melaporkan komentar yang melanggar aturan.
      </p>

      {/* Form input atau prompt login */}
      {currentUserId ? (
        <div className="space-y-1.5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis komentar..."
            maxLength={500}
            rows={2}
            className="text-xs resize-none"
            disabled={submitting}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{text.length}/500</span>
            <Button
              size="sm"
              className="h-7 text-xs px-3"
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Kirim'}
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1">
          <Link href="/login" className="underline underline-offset-2">Login</Link>{' '}
          untuk berkomentar
        </p>
      )}
    </div>
  );
}

// ─── NFT Card ────────────────────────────────────────────────────────────────

interface NftUnitCardProps {
  unit: NFTUnit;
  isLiked: boolean;
  likingId: string | null;
  buyingId: string | null;
  currentUserId: string | undefined;
  currentUserDisplayName: string | null;
  configLoaded: boolean;
  onLike: (unit: NFTUnit) => void;
  onBuy: (unit: NFTUnit) => void;
  onEditGambar: (unit: NFTUnit) => void;
}

function NftUnitCard({
  unit, isLiked, likingId, buyingId, currentUserId, currentUserDisplayName,
  configLoaded, onLike, onBuy, onEditGambar,
}: NftUnitCardProps) {
  const [imgError, setImgError] = useState(false);
  const [isCommentOpen, setIsCommentOpen] = useState(false);
  const [hasCommentPanelMounted, setHasCommentPanelMounted] = useState(false);
  const [localCount, setLocalCount] = useState(unit.comment_count);

  const canEdit = !!currentUserId && currentUserId === unit.developer_id;
  const isOwn = !!currentUserId && currentUserId === unit.owner_id;
  const canBuy = !!currentUserId && !isOwn && unit.for_sale && configLoaded;

  function handleToggleComment() {
    setIsCommentOpen((prev) => !prev);
    setHasCommentPanelMounted(true);
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden group flex flex-col">
      {/* Gambar */}
      <div className="aspect-video bg-muted relative overflow-hidden shrink-0">
        <Link href={`/nft/${unit.id}`} className="absolute inset-0 z-0" aria-label={unit.nama_nft} />
        {unit.gambar_url && !imgError ? (
          <img
            src={unit.gambar_url}
            alt={unit.nama_nft}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-10 w-10" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2 z-10">
          <Badge
            variant={unit.status === 'valid' ? 'default' : 'secondary'}
            className="text-xs capitalize"
          >
            {unit.status}
          </Badge>
        </div>

        {/* Edit button — hanya untuk developer/pemilik asli */}
        {canEdit && (
          <button
            onClick={() => onEditGambar(unit)}
            className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white rounded-md p-1.5"
            title="Edit gambar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Konten */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <Link
            href={`/nft/${unit.id}`}
            className="font-semibold text-sm leading-snug line-clamp-1 hover:underline"
            title={unit.nama_nft}
          >
            {unit.nama_nft}
          </Link>
          <p className="text-xs text-muted-foreground line-clamp-1" title={unit.nama_project}>
            {unit.nama_project}
          </p>
        </div>

        <div className="flex items-center justify-between mt-auto">
          <span className="font-bold text-sm">{formatIDR(unit.harga_jual)}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Heart className="h-3 w-3" />
            {unit.like_count}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs gap-1"
            disabled={!canBuy || buyingId === unit.id}
            onClick={canBuy ? () => onBuy(unit) : undefined}
            title={
              !currentUserId ? 'Login untuk membeli' :
              isOwn ? 'Ini NFT milikmu' :
              !unit.for_sale ? 'NFT ini sudah terjual' :
              !configLoaded ? 'Memuat konfigurasi...' :
              'Beli NFT ini'
            }
          >
            {buyingId === unit.id
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <ShoppingCart className="h-3 w-3" />}
            {isOwn ? 'Milikmu' : !unit.for_sale ? 'Terjual' : 'Beli'}
          </Button>
          <Button
            size="sm"
            variant={isLiked ? 'default' : 'outline'}
            className="h-8 w-9 p-0 shrink-0"
            onClick={() => onLike(unit)}
            disabled={!currentUserId || isOwn || likingId === unit.id}
            title={
              !currentUserId ? 'Login untuk like' :
              isOwn ? 'Tidak bisa like NFT milikmu sendiri' :
              isLiked ? 'Batal like' : 'Like NFT ini'
            }
          >
            {likingId === unit.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Heart className={cn('h-3.5 w-3.5', isLiked && 'fill-current')} />
            )}
          </Button>
          <Button
            size="sm"
            variant={isCommentOpen ? 'secondary' : 'outline'}
            className="h-8 px-2 shrink-0 gap-1 text-xs"
            onClick={handleToggleComment}
            title="Lihat komentar"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {localCount}
          </Button>
        </div>
      </div>

      {/* Comment panel — lazy mount, stays in DOM once opened to preserve state */}
      {hasCommentPanelMounted && (
        <div className={cn(!isCommentOpen && 'hidden')}>
          <CommentPanel
            nftId={unit.id}
            currentUserId={currentUserId}
            currentUserDisplayName={currentUserDisplayName}
            onCommentAdded={() => setLocalCount((prev) => prev + 1)}
            onCommentDeleted={() => setLocalCount((prev) => Math.max(0, prev - 1))}
          />
        </div>
      )}
    </div>
  );
}

// ─── Halaman utama (di dalam Suspense) ───────────────────────────────────────

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const paramKategori = (searchParams.get('kategori') ?? 'semua') as ProjectCategory | 'semua';
  const [kategori, setKategori] = useState<ProjectCategory | 'semua'>(paramKategori);
  const [units, setUnits] = useState<NFTUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [likingId, setLikingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<NFTUnit | null>(null);
  const [buyTarget, setBuyTarget] = useState<NFTUnit | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [config, setConfig] = useState<{ harga_dasar: number; batas_atas: number } | null>(null);

  // Derive parent chip highlight dari kategori aktif
  const effectiveParent: ProjectCategory | 'semua' =
    kategori === 'semua' ? 'semua' :
    (KATEGORI_PARENT[kategori as ProjectCategory] ?? kategori as ProjectCategory);

  // Fetch nft_units — sorted by like_count desc, optionally filtered by kategori
  const loadUnits = useCallback(async (kat: ProjectCategory | 'semua') => {
    setLoading(true);
    try {
      const baseRef = collection(db, 'nft_units');
      const children = kat !== 'semua' ? KATEGORI_CHILDREN[kat as ProjectCategory] : undefined;
      const q = kat === 'semua'
        ? query(baseRef, orderBy('like_count', 'desc'), limit(PAGE_SIZE))
        : children && children.length > 0
          ? query(baseRef, where('kategori', 'in', [kat, ...children]), orderBy('like_count', 'desc'), limit(PAGE_SIZE))
          : query(baseRef, where('kategori', '==', kat), orderBy('like_count', 'desc'), limit(PAGE_SIZE));

      const snap = await getDocs(q);
      setUnits(snap.docs.map((d) => toNFTUnit(d.id, d.data() as Record<string, unknown>)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUnits(kategori); }, [kategori, loadUnits]);

  useEffect(() => {
    getCommunityConfig()
      .then((c) => { if (c) setConfig({ harga_dasar: c.harga_dasar, batas_atas: c.batas_atas }); })
      .catch(() => {});
  }, []);

  // Setelah units dimuat, cek like status untuk user yang login
  useEffect(() => {
    if (!user || units.length === 0) { setLikedSet(new Set()); return; }
    Promise.all(
      units.map((u) => getDoc(doc(db, 'nft_units', u.id, 'likes', user.id)))
    ).then((docs) => {
      const liked = new Set(
        docs
          .filter((d) => d.exists())
          .map((d) => d.ref.parent.parent!.id),
      );
      setLikedSet(liked);
    }).catch(() => { /* non-critical */ });
  }, [units, user]);

  function handleKategori(kat: ProjectCategory | 'semua') {
    setKategori(kat);
    const params = new URLSearchParams(searchParams.toString());
    if (kat === 'semua') params.delete('kategori'); else params.set('kategori', kat);
    router.replace(`/explore?${params.toString()}`, { scroll: false });
  }

  async function handleLike(unit: NFTUnit) {
    if (!user) return;
    const isLiked = likedSet.has(unit.id);
    setLikingId(unit.id);

    // Optimistic update
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(unit.id); else next.add(unit.id);
      return next;
    });
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unit.id
          ? { ...u, like_count: isLiked ? Math.max(0, u.like_count - 1) : u.like_count + 1 }
          : u,
      ),
    );

    try {
      await toggleNftLike(unit.id, user.id, isLiked);
    } catch {
      // Revert on failure
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (isLiked) next.add(unit.id); else next.delete(unit.id);
        return next;
      });
      setUnits((prev) =>
        prev.map((u) =>
          u.id === unit.id
            ? { ...u, like_count: isLiked ? u.like_count + 1 : Math.max(0, u.like_count - 1) }
            : u,
        ),
      );
    } finally {
      setLikingId(null);
    }
  }

  function handleBuySuccess(nftId: string, newOwnerId: string) {
    setBuyingId(null);
    setUnits((prev) =>
      prev.map((u) =>
        u.id === nftId ? { ...u, owner_id: newOwnerId, for_sale: false } : u,
      ),
    );
  }

  function handleGambarSaved(nftId: string, newUrl: string, scope: 'unit' | 'project') {
    setUnits((prev) =>
      prev.map((u) => {
        if (scope === 'project' && u.project_id === editTarget?.project_id) {
          return { ...u, gambar_url: newUrl };
        }
        if (scope === 'unit' && u.id === nftId) {
          return { ...u, gambar_url: newUrl };
        }
        return u;
      }),
    );
  }

  const currentUserDisplayName = user?.displayName ?? user?.email ?? null;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Explorer</h1>
          <p className="text-muted-foreground">
            Temukan NFT dari tindakan nyata yang sudah diverifikasi.
          </p>
        </div>

        {/* Filter chips — row 1: kategori utama */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleKategori('semua')}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              kategori === 'semua'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted',
            )}
          >
            Semua
          </button>
          {KATEGORI_UTAMA.map((kat) => (
            <button
              key={kat}
              onClick={() => handleKategori(kat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                effectiveParent === kat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
            >
              {KATEGORI_LABELS[kat]}
            </button>
          ))}
        </div>

        {/* Filter chips — row 2: subkategori (hanya tampil jika parent punya anak) */}
        {effectiveParent !== 'semua' && KATEGORI_CHILDREN[effectiveParent as ProjectCategory] && (
          <div className="flex flex-wrap gap-2 pl-1 border-l-2 border-primary/30">
            <button
              onClick={() => handleKategori(effectiveParent as ProjectCategory)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                !KATEGORI_PARENT[kategori as ProjectCategory]
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
            >
              Semua {KATEGORI_LABELS[effectiveParent as ProjectCategory]}
            </button>
            {KATEGORI_CHILDREN[effectiveParent as ProjectCategory]!.map((sub) => (
              <button
                key={sub}
                onClick={() => handleKategori(sub)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                  kategori === sub
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted',
                )}
              >
                {KATEGORI_LABELS[sub]}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : units.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <p className="text-lg font-semibold text-muted-foreground">Belum ada NFT</p>
            <p className="text-sm text-muted-foreground mt-1">
              {kategori === 'semua'
                ? 'Jadilah developer pertama yang mendaftarkan project.'
                : `Belum ada project dengan kategori "${KATEGORI_LABELS[kategori as ProjectCategory]}".`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {units.map((unit) => (
              <NftUnitCard
                key={unit.id}
                unit={unit}
                isLiked={likedSet.has(unit.id)}
                likingId={likingId}
                buyingId={buyingId}
                currentUserId={user?.id}
                currentUserDisplayName={currentUserDisplayName}
                configLoaded={!!config}
                onLike={handleLike}
                onBuy={setBuyTarget}
                onEditGambar={setEditTarget}
              />
            ))}
          </div>
        )}

        {!loading && units.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Menampilkan {units.length} NFT · Diurutkan berdasarkan like terbanyak
          </p>
        )}
      </div>

      {/* Edit gambar dialog */}
      {editTarget && (
        <EditGambarDialog
          unit={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleGambarSaved}
        />
      )}

      {/* Buy dialog */}
      {buyTarget && user && config && (
        <BuyDialog
          unit={buyTarget}
          buyerId={user.id}
          hargaDasar={config.harga_dasar}
          batasAtas={config.batas_atas}
          onClose={() => setBuyTarget(null)}
          onSuccess={handleBuySuccess}
        />
      )}
    </MainLayout>
  );
}

// ─── Export default (Suspense wrapper diperlukan untuk useSearchParams) ───────

function ExploreSkeleton() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-40 mb-1" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreSkeleton />}>
      <ExploreContent />
    </Suspense>
  );
}
