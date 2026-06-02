'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection, doc, getDocs, getDoc,
  query, where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import {
  ChevronDown, ChevronUp, Loader2,
  ShieldCheck, CheckSquare, Square, AlertTriangle,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { getCommunityConfig } from '@/lib/community-config';
import { validateProject, ValidasiError } from '@/lib/projects';
import type { Project, NFTUnit, ProjectCategory } from '@/lib/types';
import { KATEGORI_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getPlaceholder } from '@/lib/category-placeholders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

function toProject(id: string, data: Record<string, unknown>): Project {
  return {
    id,
    developer_id: data.developer_id as string,
    nama_project: (data.nama_project as string) ?? '',
    deskripsi_project: (data.deskripsi_project as string) ?? '',
    gambar_url: (data.gambar_url as string) ?? '',
    link_bukti: (data.link_bukti as string) ?? '',
    tanggal_tindakan: (data.tanggal_tindakan as string) ?? '',
    kategori: (data.kategori as ProjectCategory) ?? 'lainnya',
    lokasi_tindakan: (data.lokasi_tindakan as string) ?? '',
    nilai_project: (data.nilai_project as number) ?? 0,
    harga_jual: (data.harga_jual as number) ?? 0,
    jumlah_nft: (data.jumlah_nft as number) ?? 0,
    status_project: (data.status_project as Project['status_project']) ?? 'aktif',
    daftar_invalidasi: (data.daftar_invalidasi as boolean) ?? false,
    pool_jaminan: (data.pool_jaminan as number) ?? 0,
    jumlah_validator: (data.jumlah_validator as number) ?? 0,
    validator_list: [],
    like_count: (data.like_count as number) ?? 0,
    anomali_flag: (data.anomali_flag as boolean) ?? false,
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
  };
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
    in_pool: (data.in_pool as boolean) ?? false,
    digunakan_validasi: (data.digunakan_validasi as boolean) ?? false,
    project_validasi_id: (data.project_validasi_id as string | null) ?? null,
    harga_beli_sebelum_validasi: (data.harga_beli_sebelum_validasi as number | null) ?? null,
    nilai_selisih_sebelum_validasi: (data.nilai_selisih_sebelum_validasi as number | null) ?? null,
    pernah_digunakan_validasi: (data.pernah_digunakan_validasi as boolean) ?? false,
    like_count: (data.like_count as number) ?? 0,
    comment_count: (data.comment_count as number) ?? 0,
    created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
  };
}

// ─── Data Fetch ───────────────────────────────────────────────────────────────

type ProjectWithDev = Project & { developer_name: string };

type PoolStatus = {
  jumlahNftValid: number;
  minPool: number;
  poolCukup: boolean;
};

async function fetchPoolStatus(): Promise<PoolStatus> {
  const [poolSnap, config] = await Promise.all([
    getDoc(doc(db, 'pool_rekomendasi', 'v1')),
    getCommunityConfig(),
  ]);
  const jumlahNftValid = poolSnap.exists()
    ? ((poolSnap.data().jumlah_nft_valid as number) ?? 0)
    : 0;
  const minPool = config?.minimum_nft_pool_untuk_validasi ?? 90;
  return { jumlahNftValid, minPool, poolCukup: jumlahNftValid >= minPool };
}

async function fetchTopDeveloperProjects(): Promise<ProjectWithDev[]> {
  // Fetch semua user top_developer
  const topDevsSnap = await getDocs(
    query(collection(db, 'users'), where('level', '==', 'top_developer')),
  );
  if (topDevsSnap.empty) return [];

  const topDevMap: Record<string, string> = {};
  topDevsSnap.docs.forEach(d => {
    topDevMap[d.id] = (d.data().displayName as string) || d.id.slice(0, 8) + '…';
  });
  const topDevIds = Object.keys(topDevMap);

  // Fetch semua project, filter client-side berdasarkan developer level
  const projectsSnap = await getDocs(
    query(collection(db, 'projects'), orderBy('like_count', 'desc'), limit(50)),
  );
  if (projectsSnap.empty) return [];

  const projects = projectsSnap.docs
    .map(d => toProject(d.id, d.data() as Record<string, unknown>))
    .filter(p => topDevIds.includes(p.developer_id));

  return projects.map(p => ({
    ...p,
    developer_name: topDevMap[p.developer_id] ?? 'Developer',
  }));
}

async function fetchEligibleNFTs(userId: string): Promise<NFTUnit[]> {
  const snap = await getDocs(
    query(collection(db, 'nft_units'), where('owner_id', '==', userId)),
  );
  return snap.docs
    .map(d => toNFTUnit(d.id, d.data() as Record<string, unknown>))
    .filter(u =>
      !u.for_sale &&
      !u.digunakan_validasi &&
      !u.pernah_digunakan_validasi &&
      u.nilai_selisih > 0,
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border overflow-hidden">
          <div className="flex gap-4 p-4">
            <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-8 w-40 mt-2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Validation Panel ─────────────────────────────────────────────────────────

interface ValidationPanelProps {
  project: ProjectWithDev;
  userId: string;
  isRevalidasi: boolean;
  onValidated: (projectId: string, totalSelisih: number, count: number) => void;
}

function ValidationPanel({ project, userId, isRevalidasi, onValidated }: ValidationPanelProps) {
  const { emailVerified } = useAuth();
  const [loadingNfts, setLoadingNfts] = useState(true);
  const [eligibleNfts, setEligibleNfts] = useState<NFTUnit[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEligibleNFTs(userId)
      .then(setEligibleNfts)
      .finally(() => setLoadingNfts(false));
  }, [userId]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === eligibleNfts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleNfts.map(u => u.id)));
    }
  }

  const totalSelisih = eligibleNfts
    .filter(u => selectedIds.has(u.id))
    .reduce((sum, u) => sum + u.nilai_selisih, 0);

  async function handleConfirm() {
    if (selectedIds.size === 0) return;
    if (!emailVerified) {
      setError('Verifikasi email Anda terlebih dahulu sebelum melakukan transaksi. Cek inbox email Anda atau klik \'Kirim Ulang\' di banner atas.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const config = await getCommunityConfig();
      const harga_dasar = config?.harga_dasar ?? 100000;
      await validateProject(project.id, userId, [...selectedIds], harga_dasar);
      onValidated(project.id, totalSelisih, selectedIds.size);
    } catch (err: unknown) {
      setError(
        err instanceof ValidasiError
          ? err.message
          : 'Validasi gagal. Coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingNfts) {
    return (
      <div className="border-t px-4 py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat NFT yang bisa digunakan…
      </div>
    );
  }

  if (eligibleNfts.length === 0) {
    return (
      <div className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
        <p className="font-medium">Tidak ada NFT yang bisa digunakan validasi.</p>
        <p className="mt-1 text-xs">
          NFT harus: tidak dijual, belum dipakai validasi, dan memiliki nilai selisih &gt; 0.
        </p>
      </div>
    );
  }

  const allSelected = selectedIds.size === eligibleNfts.length;

  return (
    <div className="border-t">
      {/* Info revalidasi */}
      {isRevalidasi && (
        <div className="mx-4 mt-4 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/30 px-3 py-2.5 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          <span className="font-semibold">Mode Revalidasi aktif.</span>{' '}
          Project ini sudah valid. Dengan memvalidasi, kamu menggantikan validator terlama
          dan NFT mereka dikembalikan ke kondisi semula.
        </div>
      )}

      {/* Header panel */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Pilih NFT untuk validasi</p>
        <button
          onClick={toggleAll}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {allSelected
            ? <CheckSquare className="h-3.5 w-3.5" />
            : <Square className="h-3.5 w-3.5" />
          }
          {allSelected ? 'Batal pilih semua' : 'Pilih semua'}
        </button>
      </div>

      {/* NFT list */}
      <div className="divide-y border-y mx-4 rounded-lg overflow-hidden">
        {eligibleNfts.map(unit => {
          const isSelected = selectedIds.has(unit.id);
          return (
            <label
              key={unit.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm',
                isSelected ? 'bg-primary/5' : 'bg-card hover:bg-muted/40',
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelect(unit.id)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{unit.nama_nft}</p>
                <p className="text-xs text-muted-foreground truncate">{unit.nama_project}</p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Beli: {formatIDR(unit.harga_beli_terakhir)}
                </p>
                <p className="text-xs font-semibold text-green-600">
                  +{formatIDR(unit.nilai_selisih)}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {/* Footer: total + konfirmasi */}
      <div className="px-4 pt-3 pb-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {selectedIds.size} NFT dipilih · Total nilai validasi
          </span>
          <span className={cn(
            'font-bold',
            totalSelisih > 0 ? 'text-green-600' : 'text-muted-foreground',
          )}>
            {formatIDR(totalSelisih)}
          </span>
        </div>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}

        <Button
          className="w-full"
          disabled={selectedIds.size === 0 || submitting}
          onClick={handleConfirm}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Konfirmasi Validasi
          {selectedIds.size > 0 && ` (${selectedIds.size} NFT)`}
        </Button>
      </div>
    </div>
  );
}

// ─── Project Validasi Card ────────────────────────────────────────────────────

interface ProjectValidasiCardProps {
  project: ProjectWithDev;
  userId: string;
  poolCukup: boolean;
  onValidated: (projectId: string, totalSelisih: number, count: number) => void;
}

function ProjectValidasiCard({ project, userId, poolCukup, onValidated }: ProjectValidasiCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [justValidated, setJustValidated] = useState(false);

  const isRevalidasi = project.nilai_project > 0
    && project.pool_jaminan >= project.nilai_project;

  const progressPct = project.nilai_project > 0
    ? Math.min(100, Math.round((project.pool_jaminan / project.nilai_project) * 100))
    : 0;

  function handleValidated(projectId: string, totalSelisih: number, count: number) {
    setJustValidated(true);
    setExpanded(false);
    onValidated(projectId, totalSelisih, count);
  }

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden transition-all',
      justValidated && 'opacity-75',
    )}>
      {/* Card utama */}
      <div className="flex gap-4 p-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden shrink-0">
          <img
            src={project.gambar_url || getPlaceholder(project.kategori)}
            alt={project.nama_project}
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(project.kategori); }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="font-semibold text-sm leading-snug">{project.nama_project}</p>
            {isRevalidasi && (
              <Badge variant="default" className="text-xs gap-1 shrink-0 bg-green-600 hover:bg-green-600">
                <ShieldCheck className="h-3 w-3" />
                Valid ✓ Revalidasi Tersedia
              </Badge>
            )}
            {justValidated && (
              <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                <ShieldCheck className="h-3 w-3" />
                Baru Divalidasi
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {KATEGORI_LABELS[project.kategori]}
            {project.lokasi_tindakan && <> · {project.lokasi_tindakan}</>}
          </p>
          <p className="text-xs text-muted-foreground">
            Developer: <span className="font-medium text-foreground">{project.developer_name}</span>
          </p>

          {/* Stats */}
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>
              Validator: <span className="font-medium text-foreground">{project.jumlah_validator}</span>
            </span>
            <span>
              Pool: <span className="font-medium text-foreground">{formatIDR(project.pool_jaminan)}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <Progress value={progressPct} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              {progressPct}% dari target pool ({formatIDR(project.nilai_project)})
            </p>
          </div>

          {/* Tombol expand — disabled hanya jika pool belum cukup */}
          <Button
            size="sm"
            variant={expanded ? 'secondary' : 'default'}
            className="h-7 text-xs gap-1.5 mt-1"
            disabled={!poolCukup}
            onClick={() => poolCukup && setExpanded(v => !v)}
            title={!poolCukup ? 'Pool belum mencapai kapasitas minimum' : undefined}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {isRevalidasi ? 'Revalidasi Project ini' : 'Validasi Project ini'}
            {expanded
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />
            }
          </Button>
        </div>
      </div>

      {/* Panel validasi — expand di bawah card */}
      {expanded && (
        <ValidationPanel
          project={project}
          userId={userId}
          isRevalidasi={isRevalidasi}
          onValidated={handleValidated}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ValidatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectWithDev[]>([]);
  const [poolStatus, setPoolStatus] = useState<PoolStatus>({ jumlahNftValid: 0, minPool: 90, poolCukup: false });

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, status] = await Promise.all([
        fetchTopDeveloperProjects(),
        fetchPoolStatus(),
      ]);
      setProjects(data);
      setPoolStatus(status);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  // Setelah validasi berhasil: update pool_jaminan dan jumlah_validator lokal
  function handleValidated(projectId: string, totalSelisih: number, count: number) {
    setProjects(prev =>
      prev.map(p =>
        p.id === projectId
          ? { ...p, pool_jaminan: p.pool_jaminan + totalSelisih, jumlah_validator: p.jumlah_validator + count }
          : p,
      ),
    );
  }

  if (authLoading || (!user && !authLoading)) {
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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-1">Validasi Bergulir</h1>
          <p className="text-muted-foreground text-sm">
            Serahkan nilai selisih NFT milikmu sebagai jaminan untuk project yang dipercaya.
            NFT yang divalidasi akan dikunci dan nilai selisihnya masuk ke pool jaminan project.
          </p>
        </div>

        {/* Banner pool belum cukup */}
        {!loading && !poolStatus.poolCukup && (
          <div className="flex items-start gap-3 rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">
                Pool belum mencapai kapasitas minimum untuk validasi.
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                Saat ini: {poolStatus.jumlahNftValid} NFT · Dibutuhkan: {poolStatus.minPool} NFT
              </p>
            </div>
          </div>
        )}

        {/* Konten */}
        {loading ? (
          <PageSkeleton />
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-lg font-semibold text-muted-foreground">
              Belum ada project untuk divalidasi
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Project dari Top Developer akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map(p => (
              <ProjectValidasiCard
                key={p.id}
                project={p}
                userId={user!.id}
                poolCukup={poolStatus.poolCukup}
                onValidated={handleValidated}
              />
            ))}
            <p className="text-center text-xs text-muted-foreground pt-2">
              {projects.length} project dari Top Developer · Diurutkan berdasarkan like terbanyak
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
