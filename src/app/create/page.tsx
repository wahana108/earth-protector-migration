'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Loader2, ImageOff, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { getCommunityConfig } from '@/lib/community-config';
import { createProject } from '@/lib/projects';
import { checkLinkBukti } from '@/lib/link-checker';
import {
  KATEGORI_LABELS, KATEGORI_UTAMA, KATEGORI_CHILDREN, KATEGORI_PARENT,
  type CommunityConfig, type ProjectCategory,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const TODAY = new Date().toISOString().split('T')[0];

const schema = z.object({
  nama_project: z.string().min(10, 'Min 10 karakter').max(100, 'Max 100 karakter'),
  deskripsi_project: z.string().min(50, 'Min 50 karakter'),
  gambar_url: z.string().url('Harus URL yang valid'),
  link_bukti: z.string().url('Harus URL yang valid'),
  tanggal_tindakan: z
    .string()
    .min(1, 'Tanggal wajib diisi')
    .refine((d) => new Date(d) <= new Date(), { message: 'Tidak boleh tanggal masa depan' }),
  kategori: z.enum([
    'lingkungan', 'tree_planting', 'ocean_cleanup', 'wildlife_protection', 'ecosystem_restoration',
    'energi', 'renewable_energy', 'carbon_reduction',
    'sosial', 'pendidikan', 'kesehatan', 'lainnya',
  ] as const),
  lokasi_tindakan: z.string().min(5, 'Min 5 karakter'),
  nilai_project: z.coerce.number().positive('Harus lebih dari 0'),
  harga_jual: z.coerce.number().positive('Harus lebih dari 0'),
  fee_project_pct: z.coerce.number(),
});

type FormData = z.infer<typeof schema>;


function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CreatePage() {
  const { user, emailVerified } = useAuth();
  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successData, setSuccessData] = useState<{ projectId: string; jumlahNft: number } | null>(null);

  const [previewUrl, setPreviewUrl] = useState('');
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [parentKat, setParentKat] = useState<ProjectCategory | ''>('');
  const [linkCheckStatus, setLinkCheckStatus] = useState<'idle' | 'checking' | 'aktif' | 'tidak_aktif'>('idle');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const watchedNilai = watch('nilai_project');
  const watchedHarga = watch('harga_jual');
  const watchedKategori = watch('kategori');
  const watchedGambar = watch('gambar_url');
  const watchedFee = watch('fee_project_pct');

  useEffect(() => {
    getCommunityConfig()
      .then((cfg) => {
        setConfig(cfg);
        if (cfg) {
          setValue('fee_project_pct', cfg.fee_project_pct.min);
        }
      })
      .catch(() => setConfig(null))
      .finally(() => setConfigLoading(false));
  }, [setValue]);

  // Debounced image preview
  useEffect(() => {
    if (!watchedGambar) {
      setPreviewUrl('');
      setPreviewStatus('idle');
      return;
    }
    try { new URL(watchedGambar); } catch {
      setPreviewUrl('');
      setPreviewStatus('idle');
      return;
    }
    setPreviewStatus('loading');
    const t = setTimeout(() => setPreviewUrl(watchedGambar), 600);
    return () => clearTimeout(t);
  }, [watchedGambar]);

  const jumlahNft =
    config && watchedNilai > 0 ? Math.floor(watchedNilai / config.harga_dasar) : null;
  const nilaiSelisih =
    config && watchedHarga > 0 ? watchedHarga - config.harga_dasar : null;

  async function handleLinkBuktiBlur(url: string) {
    try { new URL(url); } catch { return; }
    setLinkCheckStatus('checking');
    const result = await checkLinkBukti(url);
    setLinkCheckStatus(result);
  }

  const onSubmit = async (data: FormData) => {
    if (!user || !config) return;
    if (!emailVerified) {
      setSubmitError('Verifikasi email Anda terlebih dahulu sebelum melakukan transaksi. Cek inbox email Anda atau klik \'Kirim Ulang\' di banner atas.');
      return;
    }

    // Config-dependent validation (values come from Firestore, not hardcoded)
    if (data.nilai_project < config.nilai_minimum_project) {
      setError('nilai_project', { message: `Minimum ${formatIDR(config.nilai_minimum_project)}` });
      return;
    }
    if (data.harga_jual < config.harga_dasar) {
      setError('harga_jual', { message: `Minimum ${formatIDR(config.harga_dasar)}` });
      return;
    }
    if (data.harga_jual > config.batas_atas) {
      setError('harga_jual', { message: `Maximum ${formatIDR(config.batas_atas)}` });
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const jumlah = Math.floor(data.nilai_project / config.harga_dasar);
      const projectId = await createProject({
        developer_id: user.id,
        nama_project: data.nama_project,
        deskripsi_project: data.deskripsi_project,
        gambar_url: data.gambar_url,
        link_bukti: data.link_bukti,
        tanggal_tindakan: data.tanggal_tindakan,
        kategori: data.kategori as ProjectCategory,
        lokasi_tindakan: data.lokasi_tindakan,
        nilai_project: data.nilai_project,
        harga_jual: data.harga_jual,
        harga_dasar: config.harga_dasar,
        fee_project_pct: data.fee_project_pct,
      });
      setSuccessData({ projectId, jumlahNft: jumlah });
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Gagal membuat project. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16">
          <h2 className="text-2xl font-bold mb-2">Login diperlukan</h2>
          <p className="text-muted-foreground mb-4">Kamu harus login untuk mendaftarkan project NFT.</p>
          <Button asChild><Link href="/login">Login</Link></Button>
        </div>
      </MainLayout>
    );
  }

  if (configLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!config) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-muted-foreground">
            Konfigurasi komunitas belum tersedia. Hubungi administrator.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/parameters">Lihat Parameters</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (successData) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16 space-y-4">
          <div className="text-5xl">🌱</div>
          <h2 className="text-2xl font-bold">Project berhasil didaftarkan!</h2>
          <p className="text-muted-foreground">
            <strong>{successData.jumlahNft} NFT unit</strong> telah dibuat otomatis dan siap dijual.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" asChild>
              <Link href="/explore">Lihat di Explorer</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Dashboard Saya</Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Daftarkan Project NFT</h1>
          <p className="text-muted-foreground">
            Dokumentasikan tindakan nyatamu dan jadikan NFT sebagai bukti kontribusi yang abadi.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Harga dasar: <strong>{formatIDR(config.harga_dasar)}</strong>
            {' · '}
            Batas atas: <strong>{formatIDR(config.batas_atas)}</strong>
            {' · '}
            Nilai min project: <strong>{formatIDR(config.nilai_minimum_project)}</strong>
          </span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Informasi Project ── */}
          <Card>
            <CardHeader>
              <CardTitle>Informasi Project</CardTitle>
              <CardDescription>
                Detail tindakan nyata yang akan diabadikan sebagai NFT.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nama_project">Nama Project *</Label>
                <Input
                  id="nama_project"
                  placeholder="Contoh: Penanaman 100 Pohon Mangrove"
                  {...register('nama_project')}
                />
                {errors.nama_project && (
                  <p className="text-sm text-destructive">{errors.nama_project.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="deskripsi_project">Deskripsi *</Label>
                <Textarea
                  id="deskripsi_project"
                  placeholder="Ceritakan tindakan nyata yang kamu lakukan, dampaknya, dan siapa yang terlibat..."
                  rows={4}
                  {...register('deskripsi_project')}
                />
                {errors.deskripsi_project && (
                  <p className="text-sm text-destructive">{errors.deskripsi_project.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori Utama *</Label>
                  <Select
                    value={parentKat}
                    onValueChange={(v) => {
                      const kat = v as ProjectCategory;
                      setParentKat(kat);
                      setValue('kategori', kat, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORI_UTAMA.map((kat) => (
                        <SelectItem key={kat} value={kat}>
                          {KATEGORI_LABELS[kat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.kategori && !KATEGORI_PARENT[watchedKategori as ProjectCategory] && (
                    <p className="text-sm text-destructive">{errors.kategori.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tanggal_tindakan">Tanggal Tindakan *</Label>
                  <Input
                    id="tanggal_tindakan"
                    type="date"
                    max={TODAY}
                    {...register('tanggal_tindakan')}
                  />
                  {errors.tanggal_tindakan && (
                    <p className="text-sm text-destructive">{errors.tanggal_tindakan.message}</p>
                  )}
                </div>
              </div>

              {parentKat && KATEGORI_CHILDREN[parentKat] && (
                <div className="space-y-2">
                  <Label>
                    Subkategori{' '}
                    <span className="text-muted-foreground text-xs font-normal">(opsional — lebih spesifik)</span>
                  </Label>
                  <Select
                    value={KATEGORI_PARENT[watchedKategori as ProjectCategory] ? watchedKategori : ''}
                    onValueChange={(v) =>
                      setValue('kategori', v as ProjectCategory, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Semua ${KATEGORI_LABELS[parentKat]} (tidak spesifik)`} />
                    </SelectTrigger>
                    <SelectContent>
                      {KATEGORI_CHILDREN[parentKat]!.map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {KATEGORI_LABELS[sub]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="lokasi_tindakan">Lokasi Tindakan *</Label>
                <Input
                  id="lokasi_tindakan"
                  placeholder="Contoh: Parangtritis, Bantul, DIY"
                  {...register('lokasi_tindakan')}
                />
                {errors.lokasi_tindakan && (
                  <p className="text-sm text-destructive">{errors.lokasi_tindakan.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Bukti & Dokumentasi ── */}
          <Card>
            <CardHeader>
              <CardTitle>Bukti &amp; Dokumentasi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gambar_url">URL Gambar Project *</Label>
                <Input
                  id="gambar_url"
                  type="url"
                  placeholder="https://drive.google.com/... atau https://i.imgur.com/..."
                  {...register('gambar_url')}
                />
                {errors.gambar_url && (
                  <p className="text-sm text-destructive">{errors.gambar_url.message}</p>
                )}

                {previewStatus !== 'idle' && (
                  <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                    {previewStatus === 'loading' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {previewStatus === 'error' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <ImageOff className="h-8 w-8" />
                        <p className="text-sm">Gambar tidak bisa dimuat. Periksa URL.</p>
                      </div>
                    )}
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Preview gambar project"
                        className={cn(
                          'h-full w-full object-cover transition-opacity duration-300',
                          previewStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
                        )}
                        onLoad={() => setPreviewStatus('loaded')}
                        onError={() => setPreviewStatus('error')}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="link_bukti">Link Bukti *</Label>
                <Input
                  id="link_bukti"
                  type="url"
                  placeholder="https://drive.google.com/... (foto/video/dokumen)"
                  {...register('link_bukti')}
                  onBlur={(e) => handleLinkBuktiBlur(e.target.value)}
                />
                {errors.link_bukti && (
                  <p className="text-sm text-destructive">{errors.link_bukti.message}</p>
                )}
                {linkCheckStatus === 'checking' && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Memeriksa link...
                  </div>
                )}
                {linkCheckStatus === 'aktif' && (
                  <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Link dapat diakses
                  </div>
                )}
                {linkCheckStatus === 'tidak_aktif' && (
                  <div className="flex items-start gap-1.5 text-xs text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      Link tidak dapat diakses saat ini.
                      Anda tetap bisa melanjutkan pendaftaran.
                    </span>
                  </div>
                )}
                {linkCheckStatus === 'idle' && (
                  <p className="text-xs text-muted-foreground">
                    Link ke dokumentasi tindakan nyata — Google Drive, YouTube, atau platform serupa.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Nilai & Harga NFT ── */}
          <Card>
            <CardHeader>
              <CardTitle>Nilai &amp; Harga NFT</CardTitle>
              <CardDescription>
                Jumlah NFT dihitung otomatis: nilai project ÷ harga dasar ({formatIDR(config.harga_dasar)}).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nilai_project">Nilai Project (Rp) *</Label>
                  <Input
                    id="nilai_project"
                    type="number"
                    step="100000"
                    min={config.nilai_minimum_project}
                    placeholder={String(config.nilai_minimum_project)}
                    {...register('nilai_project')}
                  />
                  {errors.nilai_project && (
                    <p className="text-sm text-destructive">{errors.nilai_project.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="harga_jual">Harga Jual per NFT (Rp) *</Label>
                  <Input
                    id="harga_jual"
                    type="number"
                    step="1000"
                    min={config.harga_dasar}
                    max={config.batas_atas}
                    placeholder={String(config.harga_dasar)}
                    {...register('harga_jual')}
                  />
                  {errors.harga_jual && (
                    <p className="text-sm text-destructive">{errors.harga_jual.message}</p>
                  )}
                </div>
              </div>

              {(jumlahNft !== null || nilaiSelisih !== null) && (
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                  {jumlahNft !== null && jumlahNft > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jumlah NFT yang akan dibuat</span>
                      <span className="font-semibold">{jumlahNft} unit</span>
                    </div>
                  )}
                  {nilaiSelisih !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nilai selisih per NFT</span>
                      <span className="font-semibold">
                        {nilaiSelisih >= 0 ? '+' : ''}
                        {formatIDR(nilaiSelisih)}
                      </span>
                    </div>
                  )}
                  {nilaiSelisih !== null && nilaiSelisih > 0 && (
                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      Saat NFT terjual, neracamu berkurang {formatIDR(nilaiSelisih)}{' '}
                      dan neraca pembeli bertambah {formatIDR(nilaiSelisih)}.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fee_project_pct">
                  Fee kontribusi validator (%)
                  <span className="ml-1 text-muted-foreground font-normal text-xs">
                    — dibagikan ke validator setiap {config.fee_trigger_per_nft ?? 10} NFT terjual
                  </span>
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="fee_project_pct"
                    type="range"
                    min={config.fee_project_pct.min}
                    max={config.fee_project_pct.max}
                    step="0.5"
                    className="flex-1 accent-primary"
                    {...register('fee_project_pct')}
                  />
                  <span className="w-12 text-right font-mono text-sm font-semibold">
                    {watchedFee ?? config.fee_project_pct.min}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rentang: {config.fee_project_pct.min}% – {config.fee_project_pct.max}%
                </p>
                {errors.fee_project_pct && (
                  <p className="text-sm text-destructive">{errors.fee_project_pct.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {submitError && (
            <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-4 py-3">
              {submitError}
            </p>
          )}

          <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Membuat project dan NFT...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4" />
                Daftarkan Project
              </>
            )}
          </Button>
        </form>
      </div>
    </MainLayout>
  );
}
