'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft, ExternalLink, ImageOff, Heart, MapPin, Calendar, Users, ShieldCheck,
} from 'lucide-react';
import {
  collection, doc, getDoc, getDocs, query, where, Timestamp,
} from 'firebase/firestore';

import { MainLayout } from '@/components/layout/main-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import {
  KATEGORI_LABELS,
  type Project, type NFTUnit, type ProjectCategory,
} from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Converters ───────────────────────────────────────────────────────────────

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
    validator_list: (data.validator_list as string[]) ?? [],
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
    nama_nft: (data.nama_nft as string) ?? '',
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

// ─── Types ────────────────────────────────────────────────────────────────────

type DeveloperInfo = {
  displayName: string;
  level: string;
  soldNfts: number;
  buybackCount: number;
};

type PageData = {
  project: Project;
  units: NFTUnit[];
  terjual: number;
  developer: DeveloperInfo;
};

// ─── Mini NFT Card ────────────────────────────────────────────────────────────

function MiniNftCard({ unit }: { unit: NFTUnit }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Link
      href={`/nft/${unit.id}`}
      className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="aspect-video bg-muted relative overflow-hidden shrink-0">
        {unit.gambar_url && !imgError ? (
          <img
            src={unit.gambar_url}
            alt={unit.nama_nft}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <Badge
            variant={unit.status === 'valid' ? 'default' : 'secondary'}
            className="text-[10px] px-1.5 py-0 capitalize"
          >
            {unit.status}
          </Badge>
        </div>
        {!unit.for_sale && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="text-white text-xs font-semibold bg-black/50 px-2 py-0.5 rounded">
              Terjual
            </span>
          </div>
        )}
      </div>
      <div className="p-2 space-y-0.5">
        <p className="text-xs font-semibold leading-snug line-clamp-1">{unit.nama_nft}</p>
        <p className="text-xs text-muted-foreground font-medium">{formatIDR(unit.harga_jual)}</p>
      </div>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="aspect-video w-full rounded-xl" />
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </MainLayout>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const projectSnap = await getDoc(doc(db, 'projects', projectId));
        if (!projectSnap.exists()) { setMissing(true); return; }

        const project = toProject(projectSnap.id, projectSnap.data() as Record<string, unknown>);

        const [unitsSnap, devSnap] = await Promise.all([
          getDocs(query(collection(db, 'nft_units'), where('project_id', '==', projectId))),
          getDoc(doc(db, 'users', project.developer_id)),
        ]);

        const units = unitsSnap.docs.map(d =>
          toNFTUnit(d.id, d.data() as Record<string, unknown>),
        );
        const terjual = units.filter(u => u.owner_id !== project.developer_id).length;

        const devData = devSnap.exists() ? devSnap.data() : {};
        const developer: DeveloperInfo = {
          displayName: (devData.displayName as string) || 'Developer',
          level: (devData.level as string) || 'developer_biasa',
          soldNfts: (devData.soldNfts as number) ?? 0,
          buybackCount: (devData.buybackCount as number) ?? 0,
        };

        setData({ project, units, terjual, developer });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  if (loading) return <PageSkeleton />;
  if (missing) return notFound();
  if (!data) return null;

  const { project, units, terjual, developer } = data;

  const isInvalidasi = project.status_project === 'dalam_invalidasi';
  const progressPct = project.jumlah_nft > 0
    ? Math.round((terjual / project.jumlah_nft) * 100)
    : 0;
  const buybackPct = developer.soldNfts > 0
    ? Math.round((developer.buybackCount / developer.soldNfts) * 100)
    : 0;
  const kategoriLabel = KATEGORI_LABELS[project.kategori] ?? project.kategori;

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Back */}
        <Button variant="ghost" asChild className="gap-2 -ml-2 h-8">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Projects
          </Link>
        </Button>

        {/* Hero image */}
        {project.gambar_url ? (
          <div className="aspect-video rounded-xl overflow-hidden bg-muted">
            <img
              src={project.gambar_url}
              alt={project.nama_project}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-video rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-16 w-16" />
          </div>
        )}

        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant={isInvalidasi ? 'destructive' : 'default'}>
              {isInvalidasi ? 'Dalam Invalidasi' : 'Aktif'}
            </Badge>
            <Badge variant="outline">{kategoriLabel}</Badge>
          </div>

          <h1 className="text-2xl font-bold leading-snug">{project.nama_project}</h1>
          <p className="text-muted-foreground leading-relaxed">{project.deskripsi_project}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {project.lokasi_tindakan && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {project.lokasi_tindakan}
              </span>
            )}
            {project.tanggal_tindakan && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {formatDate(project.tanggal_tindakan)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 shrink-0" />
              {project.like_count} like
            </span>
          </div>

          {project.link_bukti && (
            <Button variant="outline" size="sm" asChild className="gap-1.5 mt-1">
              <a href={project.link_bukti} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Lihat Bukti Project
              </a>
            </Button>
          )}
        </div>

        {/* Developer */}
        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Developer
          </h2>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 border flex items-center justify-center text-sm font-bold text-primary uppercase shrink-0">
              {developer.displayName.charAt(0)}
            </div>
            <div>
              <p className="font-semibold leading-snug">{developer.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {developer.level === 'top_developer' ? '⭐ Top Developer' : 'Developer Biasa'}
                {developer.soldNfts > 0 && (
                  <>
                    {' · '}Buyback {developer.buybackCount}/{developer.soldNfts}{' '}
                    ({buybackPct}%)
                  </>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Progress NFT */}
        <section className="rounded-xl border p-4 space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Progress NFT
          </h2>
          <Progress value={progressPct} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {terjual} terjual dari {project.jumlah_nft} unit
            </span>
            <span className="font-medium">{formatIDR(project.harga_jual)}/NFT</span>
          </div>
        </section>

        {/* Validator */}
        {(project.jumlah_validator > 0 || project.pool_jaminan > 0) && (
          <section className="rounded-xl border p-4 space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Validator &amp; Pool Jaminan
            </h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                {project.jumlah_validator} validator
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Pool: {formatIDR(project.pool_jaminan)}
              </span>
            </div>
          </section>
        )}

        {/* NFT Grid */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            NFT dalam Project ini ({units.length} unit)
          </h2>
          {units.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada NFT unit.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {units.map(u => <MiniNftCard key={u.id} unit={u} />)}
            </div>
          )}
        </section>

      </div>
    </MainLayout>
  );
}
