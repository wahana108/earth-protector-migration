'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  collection, query, where, orderBy, limit,
  getDocs, getDoc, doc, Timestamp,
} from 'firebase/firestore';
import { Search, ExternalLink, Heart, Loader2 } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import {
  KATEGORI_LABELS, KATEGORI_UTAMA, KATEGORI_CHILDREN, KATEGORI_PARENT,
  type Project, type ProjectCategory,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { getPlaceholder } from '@/lib/category-placeholders';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectWithMeta = Project & {
  developer_name: string;
  terjual: number;
};

// ─── Constants ───────────────────────────────────────────────────────────────


// ─── Converter ───────────────────────────────────────────────────────────────

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

// ─── Data Fetch ───────────────────────────────────────────────────────────────

async function fetchProjects(kat: ProjectCategory | 'semua'): Promise<ProjectWithMeta[]> {
  const baseRef = collection(db, 'projects');
  const children = kat !== 'semua' ? KATEGORI_CHILDREN[kat as ProjectCategory] : undefined;
  const q = kat === 'semua'
    ? query(baseRef, orderBy('like_count', 'desc'), limit(30))
    : children && children.length > 0
      ? query(baseRef, where('kategori', 'in', [kat, ...children]), orderBy('like_count', 'desc'), limit(30))
      : query(baseRef, where('kategori', '==', kat), orderBy('like_count', 'desc'), limit(30));

  const snap = await getDocs(q);
  if (snap.empty) return [];

  const projects = snap.docs.map(d => toProject(d.id, d.data() as Record<string, unknown>));
  const projectIds = projects.map(p => p.id);
  const uniqueDevIds = [...new Set(projects.map(p => p.developer_id))];

  // Parallel: hitung terjual dari nft_units + ambil nama developer
  const [unitsSnap, devSnaps] = await Promise.all([
    getDocs(query(collection(db, 'nft_units'), where('project_id', 'in', projectIds))),
    Promise.all(uniqueDevIds.map(id => getDoc(doc(db, 'users', id)))),
  ]);

  // Build developer name map
  const nameMap: Record<string, string> = {};
  devSnaps.forEach(s => {
    if (s.exists()) {
      nameMap[s.id] = (s.data().displayName as string) || s.id.slice(0, 8) + '…';
    }
  });

  // Map project_id → developer_id (untuk deteksi "terjual")
  const projectDevMap: Record<string, string> = {};
  projects.forEach(p => { projectDevMap[p.id] = p.developer_id; });

  // Hitung terjual: unit yang owner-nya bukan developer asli
  const terjualMap: Record<string, number> = {};
  unitsSnap.docs.forEach(d => {
    const data = d.data();
    const pid = data.project_id as string;
    const ownerId = data.owner_id as string;
    if (ownerId !== projectDevMap[pid]) {
      terjualMap[pid] = (terjualMap[pid] ?? 0) + 1;
    }
  });

  return projects.map(p => ({
    ...p,
    developer_name: nameMap[p.developer_id] ?? 'Developer',
    terjual: terjualMap[p.id] ?? 0,
  }));
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: ProjectWithMeta }) {
  const isInvalidasi = project.status_project === 'dalam_invalidasi';

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
      {/* Gambar — link ke detail */}
      <Link href={`/projects/${project.id}`} className="aspect-video bg-muted relative overflow-hidden block shrink-0 group">
        <img
          src={project.gambar_url || getPlaceholder(project.kategori)}
          alt={project.nama_project}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(project.kategori); }}
        />
        <div className="absolute top-2 left-2">
          <Badge
            variant={isInvalidasi ? 'destructive' : 'default'}
            className="text-xs"
          >
            {isInvalidasi ? 'Dalam Invalidasi' : 'Aktif'}
          </Badge>
        </div>
      </Link>

      {/* Konten */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="font-semibold text-sm leading-snug line-clamp-2 hover:underline"
            title={project.nama_project}
          >
            {project.nama_project}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            <span className="capitalize">{KATEGORI_LABELS[project.kategori]}</span>
            {project.lokasi_tindakan && <> · {project.lokasi_tindakan}</>}
          </p>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-1">
          Developer:{' '}
          <span className="font-medium text-foreground">{project.developer_name}</span>
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {project.like_count}
          </span>
          <span className="font-medium text-foreground">
            {project.terjual}/{project.jumlah_nft} terjual
          </span>
        </div>

        {project.link_bukti ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 w-full"
            asChild
          >
            <a href={project.link_bukti} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              Lihat Bukti
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-8 text-xs w-full" disabled>
            Belum ada bukti
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border overflow-hidden">
          <Skeleton className="aspect-video w-full" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex justify-between mt-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-full mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const [kategori, setKategori] = useState<ProjectCategory | 'semua'>('semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<ProjectWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveParent: ProjectCategory | 'semua' =
    kategori === 'semua' ? 'semua' :
    (KATEGORI_PARENT[kategori as ProjectCategory] ?? kategori as ProjectCategory);

  const loadData = useCallback(async (kat: ProjectCategory | 'semua') => {
    setLoading(true);
    try {
      const data = await fetchProjects(kat);
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(kategori); }, [kategori, loadData]);

  function handleKategori(kat: ProjectCategory | 'semua') {
    setSearchQuery('');
    setKategori(kat);
  }

  const filteredProjects = searchQuery
    ? projects.filter(p =>
        p.nama_project.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : projects;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-1">Index Project</h1>
          <p className="text-muted-foreground">
            Semua project charity yang terdaftar di komunitas TMEP, diurutkan berdasarkan like terbanyak.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Cari nama project..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter kategori — row 1: kategori utama */}
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
          {KATEGORI_UTAMA.map(kat => (
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

        {/* Filter kategori — row 2: subkategori */}
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

        {/* Konten */}
        {loading ? (
          <GridSkeleton />
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-xl">
            <p className="text-lg font-semibold text-muted-foreground">
              {searchQuery ? 'Tidak ada project yang cocok' : 'Belum ada project'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? `Tidak ditemukan project dengan nama "${searchQuery}".`
                : 'Jadilah developer pertama yang mendaftarkan project charity.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(p => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}

        {!loading && filteredProjects.length > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            {filteredProjects.length} project
            {searchQuery && ` cocok dengan "${searchQuery}"`}
            {' · '}Diurutkan berdasarkan like terbanyak
          </p>
        )}
      </div>
    </MainLayout>
  );
}
