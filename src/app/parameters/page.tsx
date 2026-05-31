'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, SlidersHorizontal, Pencil } from 'lucide-react';
import {
  getCommunityConfig,
  seedCommunityConfig,
  updateCommunityConfig,
  DEFAULT_COMMUNITY_CONFIG,
} from '@/lib/community-config';
import { useAuth } from '@/hooks/use-auth';
import type { CommunityConfig } from '@/lib/types';

const ADMIN_EMAIL = 'ramawan@live.com';

// ─── Tipe flat untuk form edit ───────────────────────────────────────────────
type EditValues = {
  harga_dasar: number;
  batas_atas: number;
  nilai_minimum_project: number;
  minimum_buyback_pct: number;
  fee_min: number;
  fee_max: number;
  minimum_top_developer: number;
  minimum_soldNfts_top_developer: number;
  kapasitas_pool_minimum: number;
  minimum_nft_pool_untuk_validasi: number;
  fase_aktif: number;
  ai_provider: string;
  anomali_flag: number;
  anomali_invalid: number;
};

function configToEdit(c: CommunityConfig): EditValues {
  return {
    harga_dasar: c.harga_dasar,
    batas_atas: c.batas_atas,
    nilai_minimum_project: c.nilai_minimum_project,
    minimum_buyback_pct: c.minimum_buyback_pct,
    fee_min: c.fee_project_pct.min,
    fee_max: c.fee_project_pct.max,
    minimum_top_developer: c.minimum_top_developer,
    minimum_soldNfts_top_developer: c.minimum_soldNfts_top_developer,
    kapasitas_pool_minimum: c.kapasitas_pool_minimum,
    minimum_nft_pool_untuk_validasi: c.minimum_nft_pool_untuk_validasi ?? 90,
    fase_aktif: c.fase_aktif,
    ai_provider: c.ai_provider,
    anomali_flag: c.ai_anomali_threshold.flag,
    anomali_invalid: c.ai_anomali_threshold.invalid,
  };
}

function editToConfig(e: EditValues): Omit<CommunityConfig, 'updated_at' | 'updated_by'> {
  return {
    harga_dasar: e.harga_dasar,
    batas_atas: e.batas_atas,
    nilai_minimum_project: e.nilai_minimum_project,
    minimum_buyback_pct: e.minimum_buyback_pct,
    fee_project_pct: { min: e.fee_min, max: e.fee_max },
    minimum_top_developer: e.minimum_top_developer,
    minimum_soldNfts_top_developer: e.minimum_soldNfts_top_developer,
    kapasitas_pool_minimum: e.kapasitas_pool_minimum,
    minimum_nft_pool_untuk_validasi: e.minimum_nft_pool_untuk_validasi,
    fase_aktif: e.fase_aktif,
    ai_provider: e.ai_provider,
    ai_anomali_threshold: { flag: e.anomali_flag, invalid: e.anomali_invalid },
  };
}

// ─── Sub-komponen ─────────────────────────────────────────────────────────────
function formatRupiah(v: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(v);
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium font-mono">{value}</span>
    </div>
  );
}

function EditRow({
  label, value, type = 'number', onChange,
}: {
  label: string;
  value: number | string;
  type?: 'number' | 'text';
  onChange: (v: number | string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <label className="text-sm text-muted-foreground shrink-0">{label}</label>
      <Input
        type={type}
        className="w-36 text-right font-mono text-sm h-8"
        value={value}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      />
    </div>
  );
}

function ParamCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2"><Skeleton className="h-5 w-36" /></CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-4 w-full" />)}
      </CardContent>
    </Card>
  );
}

// ─── Halaman utama ────────────────────────────────────────────────────────────
export default function ParametersPage() {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  function setField<K extends keyof EditValues>(key: K, value: EditValues[K]) {
    setEditValues(prev => prev ? { ...prev, [key]: value } : null);
  }

  useEffect(() => {
    getCommunityConfig()
      .then((data) => {
        if (data) {
          setConfig(data);
        } else {
          setConfig({ ...DEFAULT_COMMUNITY_CONFIG, updated_at: new Date(), updated_by: '' });
          setIsDefault(true);
        }
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : String(err);
        console.error('getCommunityConfig error:', detail);
        setConfig({ ...DEFAULT_COMMUNITY_CONFIG, updated_at: new Date(), updated_by: '' });
        setIsDefault(true);
        setError(
          detail.toLowerCase().includes('permission')
            ? 'Firestore security rules memblokir read. Pastikan rules mengizinkan akses publik ke community_config.'
            : 'Tidak dapat terhubung ke Firestore. Pastikan emulator berjalan (firebase emulators:start).'
        );
      })
      .finally(() => setLoading(false));
  }, []);

  function handleEdit() {
    if (!config) return;
    setEditValues(configToEdit(config));
    setIsEditing(true);
    setError(null);
  }

  function handleCancel() {
    setIsEditing(false);
    setEditValues(null);
    setError(null);
  }

  async function handleSave() {
    if (!editValues || !user) return;
    setSaving(true);
    setError(null);
    try {
      await updateCommunityConfig(user.id, editToConfig(editValues));
      const data = await getCommunityConfig();
      setConfig(data);
      setIsEditing(false);
      setEditValues(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSeed() {
    if (!user) return;
    setSeeding(true);
    setError(null);
    try {
      await seedCommunityConfig(user.id);
      const data = await getCommunityConfig();
      setConfig(data);
      setIsDefault(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-headline font-bold">Parameter Komunitas</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Kontrak sosial TMEP — variabel sistem yang berlaku untuk seluruh transaksi.
              {isAdmin
                ? ' Mode admin aktif — kamu dapat mengubah nilai ini.'
                : ' Hanya administrator yang dapat mengubah nilai ini.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {!loading && (
              <Badge variant={isDefault ? 'outline' : 'secondary'}>
                {isDefault ? 'Belum Aktif' : `Fase ${config!.fase_aktif}`}
              </Badge>
            )}
            {isAdmin && !isDefault && !isEditing && !loading && (
              <Button size="sm" variant="outline" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Ubah Parameter
              </Button>
            )}
            {isAdmin && isEditing && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                  Batal
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Banner: belum diinisialisasi */}
        {!loading && isDefault && (
          <Alert className="border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-400">
              Dokumen Belum Ada di Firestore
            </AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300 space-y-3">
              <p>
                <code className="font-mono text-xs bg-yellow-100 px-1 rounded">
                  community_config/v1
                </code>{' '}
                belum diinisialisasi. Nilai default ditampilkan di bawah.
              </p>
              {error && <p className="text-xs opacity-80">Detail: {error}</p>}
              {isAdmin ? (
                <Button
                  size="sm"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  {seeding ? 'Menyimpan ke Firestore...' : 'Inisialisasi Konfigurasi'}
                </Button>
              ) : (
                <p className="text-xs italic">
                  Hanya administrator yang dapat menginisialisasi.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Banner: sudah aktif */}
        {!loading && !isDefault && config && (
          <Alert className="border-primary/30 bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              Konfigurasi aktif. Terakhir diperbarui:{' '}
              <span className="font-medium">
                {config.updated_at.toLocaleString('id-ID')}
              </span>
              {config.updated_by && (
                <span className="text-muted-foreground"> · oleh {config.updated_by}</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Error saat save gagal */}
        {!isDefault && error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Gagal Menyimpan</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Cards — edit mode atau read-only */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <><ParamCardSkeleton /><ParamCardSkeleton /><ParamCardSkeleton /></>
          ) : config && isEditing && editValues ? (
            // ── EDIT MODE (admin only) ──────────────────────────────────────
            <>
              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Harga & Transaksi
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="Harga Dasar (Rp)" value={editValues.harga_dasar}
                    onChange={v => setField('harga_dasar', v as number)} />
                  <EditRow label="Batas Atas (Rp)" value={editValues.batas_atas}
                    onChange={v => setField('batas_atas', v as number)} />
                  <EditRow label="Min. Project (Rp)" value={editValues.nilai_minimum_project}
                    onChange={v => setField('nilai_minimum_project', v as number)} />
                  <EditRow label="Min. Buyback (%)" value={editValues.minimum_buyback_pct}
                    onChange={v => setField('minimum_buyback_pct', v as number)} />
                  <EditRow label="Fee Min (%)" value={editValues.fee_min}
                    onChange={v => setField('fee_min', v as number)} />
                  <EditRow label="Fee Max (%)" value={editValues.fee_max}
                    onChange={v => setField('fee_max', v as number)} />
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Komunitas & Pool
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="Min. Top Developer" value={editValues.minimum_top_developer}
                    onChange={v => setField('minimum_top_developer', v as number)} />
                  <EditRow label="Min. Kapasitas Pool" value={editValues.kapasitas_pool_minimum}
                    onChange={v => setField('kapasitas_pool_minimum', v as number)} />
                  <EditRow label="Fase Aktif" value={editValues.fase_aktif}
                    onChange={v => setField('fase_aktif', v as number)} />
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    AI Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="AI Provider" type="text" value={editValues.ai_provider}
                    onChange={v => setField('ai_provider', v as string)} />
                  <EditRow label="Threshold Flag (%)" value={editValues.anomali_flag}
                    onChange={v => setField('anomali_flag', v as number)} />
                  <EditRow label="Threshold Invalid (%)" value={editValues.anomali_invalid}
                    onChange={v => setField('anomali_invalid', v as number)} />
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Syarat Top Developer
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="Min. NFT Terjual" value={editValues.minimum_soldNfts_top_developer}
                    onChange={v => setField('minimum_soldNfts_top_developer', v as number)} />
                  <EditRow label="Min. Buyback (%)" value={editValues.minimum_buyback_pct}
                    onChange={v => setField('minimum_buyback_pct', v as number)} />
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Syarat Validasi
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="Min. NFT di Pool" value={editValues.minimum_nft_pool_untuk_validasi}
                    onChange={v => setField('minimum_nft_pool_untuk_validasi', v as number)} />
                </CardContent>
              </Card>
            </>
          ) : config ? (
            // ── READ-ONLY MODE ──────────────────────────────────────────────
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Harga & Transaksi
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Harga Dasar" value={formatRupiah(config.harga_dasar)} />
                  <ParamRow label="Batas Atas" value={formatRupiah(config.batas_atas)} />
                  <ParamRow label="Nilai Min. Project" value={formatRupiah(config.nilai_minimum_project)} />
                  <ParamRow label="Min. Buyback" value={`${config.minimum_buyback_pct}%`} />
                  <ParamRow label="Fee Project"
                    value={`${config.fee_project_pct.min}% – ${config.fee_project_pct.max}%`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Komunitas & Pool
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Min. Top Developer"
                    value={`${config.minimum_top_developer} developer`} />
                  <ParamRow label="Min. Kapasitas Pool"
                    value={`${config.kapasitas_pool_minimum} NFT`} />
                  <ParamRow label="Fase Aktif"
                    value={`Fase ${config.fase_aktif} — Infrastruktur Terpusat`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    AI Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="AI Provider" value={config.ai_provider} />
                  <ParamRow label="Threshold Flag"
                    value={`≥ ${config.ai_anomali_threshold.flag}% anomali`} />
                  <ParamRow label="Threshold Invalid"
                    value={`= ${config.ai_anomali_threshold.invalid}% anomali`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Syarat Top Developer
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Min. NFT Terjual"
                    value={`${config.minimum_soldNfts_top_developer} NFT`} />
                  <ParamRow label="Min. Buyback"
                    value={`${config.minimum_buyback_pct}%`} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Dievaluasi otomatis setiap kali terjadi penjualan atau buyback.
                      Semua syarat harus terpenuhi sekaligus.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Syarat Validasi
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Min. NFT di Pool"
                    value={`${config.minimum_nft_pool_untuk_validasi ?? 90} NFT`} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Validasi bergulir hanya bisa dimulai jika pool rekomendasi
                      sudah terisi minimal sejumlah NFT ini.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Aturan fixed — selalu tampil */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Aturan Sistem — Tidak Dapat Diubah
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {[
              'Penjual tidak pernah mendapat poin positif dari penjualan',
              'Pembeli tidak pernah mendapat poin negatif dari pembelian',
              'Input harga di atas batas atas diblokir sistem',
              'Semua perubahan nilai wajib tercatat di log transaksi',
              'Tidak ada entitas yang memegang dana komunitas',
              'Algoritma membaca neraca, bukan keputusan admin',
            ].map(rule => (
              <div key={rule} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{rule}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Aturan komentar — hardcoded, selalu tampil */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Aturan Komentar Komunitas
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            {[
              'Komentar harus relevan dengan project charity yang ditampilkan',
              'Dilarang: spam, kata kasar, informasi palsu, promosi tidak relevan',
              'Komentar melanggar dapat dilaporkan dan akan ditinjau administrator',
              'Pembuat komentar dapat menghapus komentarnya sendiri kapan saja',
              'Administrator berhak menghapus komentar yang melanggar tanpa pemberitahuan',
            ].map(rule => (
              <div key={rule} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{rule}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
