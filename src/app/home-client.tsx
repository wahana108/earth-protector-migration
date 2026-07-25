'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  collection, getDocs, getDoc, doc, query,
  orderBy, limit, where, Timestamp,
} from 'firebase/firestore';
import {
  ArrowRight, Leaf, Waves, PawPrint, Zap, CloudOff, Globe,
  FolderOpen, Layers, Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { getPlaceholder } from '@/lib/category-placeholders';
import { db } from '@/lib/firebase';
import { getCommunityConfig } from '@/lib/community-config';
import { KATEGORI_LABELS, type ProjectCategory } from '@/lib/types';
import { HargaEfektifInfo } from '@/components/harga-efektif';
import { effectiveInflationHistory, type InflationEntry } from '@/lib/inflation';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecentProject = {
  id: string;
  nama_project: string;
  gambar_url: string;
  kategori: ProjectCategory;
  jumlah_nft: number;
  harga_jual: number;
  created_at: Date;
};

type CommunityStats = {
  totalProjects: number;
  totalTopDeveloper: number;
  nftDiPool: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

// ─── Konten dinamis halaman depan ──────────────────────────────────────────────

const HERO_SLIDESHOW_IDS = ['hero-background', 'nft-1', 'nft-2', 'nft-6', 'nft-8'];
const HERO_SLIDE_INTERVAL_MS = 5000;

const categories = [
  { value: 'tree_planting',         name: 'Penanaman Pohon',       icon: <Leaf      className="w-8 h-8 text-primary" />, description: 'NFT untuk mendanai project penanaman pohon dan restorasi hutan.' },
  { value: 'ocean_cleanup',         name: 'Kebersihan Laut',       icon: <Waves     className="w-8 h-8 text-primary" />, description: 'Dukung inisiatif membersihkan plastik dan polusi dari lautan.' },
  { value: 'wildlife_protection',   name: 'Perlindungan Satwa',    icon: <PawPrint  className="w-8 h-8 text-primary" />, description: 'Lindungi spesies yang terancam punah dan dukung anti-perburuan.' },
  { value: 'renewable_energy',      name: 'Energi Terbarukan',     icon: <Zap       className="w-8 h-8 text-primary" />, description: 'Danai project surya, angin, dan hidro untuk transisi energi bersih.' },
  { value: 'carbon_reduction',      name: 'Pengurangan Karbon',    icon: <CloudOff  className="w-8 h-8 text-primary" />, description: 'NFT offset karbon terverifikasi untuk program pengurangan emisi.' },
  { value: 'ecosystem_restoration', name: 'Restorasi Ekosistem',   icon: <Globe     className="w-8 h-8 text-primary" />, description: 'Lindungi dan pulihkan lahan basah, hutan, dan habitat alami.' },
];

export function HomeClient() {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [inflationHistory, setInflationHistory] = useState<InflationEntry[]>([]);

  const heroSlides = HERO_SLIDESHOW_IDS
    .map(id => PlaceHolderImages.find(img => img.id === id))
    .filter((img): img is NonNullable<typeof img> => !!img);
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setHeroSlide(i => (i + 1) % heroSlides.length);
    }, HERO_SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    async function load() {
      try {
        const [projectsSnap, topDevSnap, poolSnap, cfg] = await Promise.all([
          getDocs(collection(db, 'projects')),
          getDocs(query(collection(db, 'users'), where('level', '==', 'top_developer'))),
          getDoc(doc(db, 'pool_rekomendasi', 'v1')),
          getCommunityConfig(),
        ]);
        setInflationHistory(effectiveInflationHistory(cfg?.inflation_history, cfg?.inflation_enabled));

        setStats({
          totalProjects: projectsSnap.size,
          totalTopDeveloper: topDevSnap.size,
          nftDiPool: poolSnap.exists() ? ((poolSnap.data().jumlah_nft_valid as number) ?? 0) : 0,
        });

        const recentSnap = await getDocs(
          query(collection(db, 'projects'), orderBy('created_at', 'desc'), limit(4)),
        );
        setProjects(recentSnap.docs.filter(d => (d.data().status as string | undefined) !== 'deleted').map(d => {
          const data = d.data();
          return {
            id: d.id,
            nama_project: (data.nama_project as string) ?? '',
            gambar_url: (data.gambar_url as string) ?? '',
            kategori: (data.kategori as ProjectCategory) ?? 'lainnya',
            jumlah_nft: (data.jumlah_nft as number) ?? 0,
            harga_jual: (data.harga_jual as number) ?? 0,
            created_at: (data.created_at as Timestamp)?.toDate?.() ?? new Date(),
          };
        }));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>

      {/* ── Hero ── */}
      <section className="relative rounded-xl overflow-hidden min-h-[400px] md:min-h-[500px] flex items-center justify-center text-center p-4">
        {heroSlides.map((img, i) => (
          <Image
            key={img.id}
            src={img.imageUrl}
            alt={img.description}
            fill
            className={`object-cover transition-opacity duration-1000 ${i === heroSlide ? 'opacity-100' : 'opacity-0'}`}
            data-ai-hint={img.imageHint}
            priority={i === 0}
          />
        ))}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-white max-w-3xl flex flex-col items-center gap-6">
          <h2 className="text-4xl md:text-6xl font-headline font-bold !leading-tight">
            Abadikan Tindakan Nyata,<br />Satu NFT di Setiap Langkah
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/80">
            Platform komunitas untuk mendokumentasikan aksi charity nyata melalui
            sistem NFT berbasis konsensus. Transparansi penuh, tidak ada perantara.
          </p>
          <div className="flex gap-4">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Link href="/explore">
                Jelajahi NFT
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/create">Daftarkan Project</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section>
        <h2 className="text-2xl font-headline font-semibold mb-6">Komunitas TMEP</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 flex items-center gap-4">
                <FolderOpen className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="text-3xl font-bold">{stats.totalProjects}</p>
                  <p className="text-sm text-muted-foreground">Project Terdaftar</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 flex items-center gap-4">
                <Users className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="text-3xl font-bold">{stats.totalTopDeveloper}</p>
                  <p className="text-sm text-muted-foreground">Top Developer</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 flex items-center gap-4">
                <Layers className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="text-3xl font-bold">{stats.nftDiPool}</p>
                  <p className="text-sm text-muted-foreground">NFT di Pool Rekomendasi</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* ── Project Terbaru ── */}
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-headline font-semibold">Project Terbaru</h2>
          <Button asChild variant="link">
            <Link href="/projects">Lihat Semua <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Belum ada project. <Link href="/create" className="underline">Daftarkan yang pertama!</Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="aspect-video bg-muted overflow-hidden">
                  <img
                    src={project.gambar_url || getPlaceholder(project.kategori)}
                    alt={project.nama_project}
                    className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                    onError={(e) => { (e.target as HTMLImageElement).src = getPlaceholder(project.kategori); }}
                  />
                </div>
                <div className="p-3 space-y-1.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {KATEGORI_LABELS[project.kategori] ?? project.kategori}
                  </Badge>
                  <p className="font-semibold text-sm leading-snug line-clamp-2">
                    {project.nama_project}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {project.jumlah_nft} NFT · {formatIDR(project.harga_jual)}/unit
                  </p>
                  <HargaEfektifInfo
                    harga={project.harga_jual}
                    createdAt={project.created_at}
                    inflationHistory={inflationHistory}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Kategori ── */}
      <section>
        <h2 className="text-2xl font-headline font-semibold text-center mb-8">
          Kategori Dampak
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card
              key={category.value}
              className="bg-card/80 backdrop-blur-sm border-2 border-primary/10 hover:border-primary/30 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-primary/20"
            >
              <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                <div className="p-4 bg-secondary rounded-full">
                  {category.icon}
                </div>
                <h3 className="text-xl font-headline font-semibold">{category.name}</h3>
                <p className="text-muted-foreground text-sm">{category.description}</p>
                <Button variant="outline" className="mt-2" asChild>
                  <Link href={`/explore?kategori=${category.value}`}>Lihat Koleksi</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

    </>
  );
}
