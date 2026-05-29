'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  collection, query, where, orderBy, limit,
  getDocs, getDoc, doc, Timestamp,
} from 'firebase/firestore';
import { Heart, ImageOff, Pencil, Loader2, ShoppingCart } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { toggleNftLike, updateNftUnitGambar, updateProjectGambar } from '@/lib/projects';
import type { NFTUnit, ProjectCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 24;

const KATEGORI_LABELS: Record<ProjectCategory | 'semua', string> = {
  semua: 'Semua',
  lingkungan: 'Lingkungan',
  sosial: 'Sosial',
  pendidikan: 'Pendidikan',
  kesehatan: 'Kesehatan',
  lainnya: 'Lainnya',
};

const KATEGORI_LIST = Object.keys(KATEGORI_LABELS) as (ProjectCategory | 'semua')[];

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
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
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
  };
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

// ─── NFT Card ────────────────────────────────────────────────────────────────

interface NftUnitCardProps {
  unit: NFTUnit;
  isLiked: boolean;
  likingId: string | null;
  currentUserId: string | undefined;
  onLike: (unit: NFTUnit) => void;
  onEditGambar: (unit: NFTUnit) => void;
}

function NftUnitCard({ unit, isLiked, likingId, currentUserId, onLike, onEditGambar }: NftUnitCardProps) {
  const [imgError, setImgError] = useState(false);
  const canEdit = !!currentUserId && currentUserId === unit.developer_id;

  return (
    <div className="rounded-xl border bg-card overflow-hidden group flex flex-col">
      {/* Gambar */}
      <div className="aspect-video bg-muted relative overflow-hidden shrink-0">
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
        <div className="absolute top-2 left-2">
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
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white rounded-md p-1.5"
            title="Edit gambar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Konten */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-snug line-clamp-1" title={unit.nama_nft}>
            {unit.nama_nft}
          </p>
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
            disabled
            title="Fitur beli akan tersedia segera"
          >
            <ShoppingCart className="h-3 w-3" />
            Beli
          </Button>
          <Button
            size="sm"
            variant={isLiked ? 'default' : 'outline'}
            className="h-8 w-9 p-0 shrink-0"
            onClick={() => onLike(unit)}
            disabled={!currentUserId || likingId === unit.id}
            title={currentUserId ? (isLiked ? 'Batal like' : 'Like NFT ini') : 'Login untuk like'}
          >
            {likingId === unit.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Heart className={cn('h-3.5 w-3.5', isLiked && 'fill-current')} />
            )}
          </Button>
        </div>
      </div>
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

  // Fetch nft_units — sorted by like_count desc, optionally filtered by kategori
  const loadUnits = useCallback(async (kat: ProjectCategory | 'semua') => {
    setLoading(true);
    try {
      const baseRef = collection(db, 'nft_units');
      const q = kat === 'semua'
        ? query(baseRef, orderBy('like_count', 'desc'), limit(PAGE_SIZE))
        : query(baseRef, where('kategori', '==', kat), orderBy('like_count', 'desc'), limit(PAGE_SIZE));

      const snap = await getDocs(q);
      setUnits(snap.docs.map((d) => toNFTUnit(d.id, d.data() as Record<string, unknown>)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUnits(kategori); }, [kategori, loadUnits]);

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

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Explorer</h1>
          <p className="text-muted-foreground">
            Temukan NFT dari tindakan nyata yang sudah diverifikasi.
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {KATEGORI_LIST.map((kat) => (
            <button
              key={kat}
              onClick={() => handleKategori(kat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                kategori === kat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:bg-muted',
              )}
            >
              {KATEGORI_LABELS[kat]}
            </button>
          ))}
        </div>

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
                : `Belum ada project dengan kategori "${KATEGORI_LABELS[kategori]}".`}
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
                currentUserId={user?.id}
                onLike={handleLike}
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
