'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, SlidersHorizontal, Pencil, X, Plus, Users, Loader2 } from 'lucide-react';
import {
  getCommunityConfig,
  seedCommunityConfig,
  updateCommunityConfig,
  DEFAULT_COMMUNITY_CONFIG,
} from '@/lib/community-config';
import { useAuth } from '@/hooks/use-auth';
import type { CommunityConfig, FeePool } from '@/lib/types';

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? '';

// ─── Tipe flat untuk form edit ───────────────────────────────────────────────
type EditValues = {
  harga_dasar: number;
  batas_atas: number;
  nilai_minimum_project: number;
  nilai_maksimum_project: number;
  minimum_buyback_pct: number;
  fee_min: number;
  fee_max: number;
  fee_trigger_per_nft: number;
  fee_infrastruktur_pct: number;
  minimum_top_developer: number;
  minimum_soldNfts_top_developer: number;
  kapasitas_pool_minimum: number;
  max_nft_in_pool_per_developer: number;
  minimum_nft_pool_untuk_validasi: number;
  minimum_holding_days: number;
  purchase_autoclose_days: number;
  max_projects_per_user: number;
  min_realisasi_pct_untuk_create: number;
  fase_aktif: number;
  ai_provider: string;
  anomali_flag: number;
  anomali_invalid: number;
  max_transactions_per_user_per_day: number;
  max_projects_per_user_per_day: number;
  max_comments_per_user_per_day: number;
  max_projects_global_per_day: number;
  max_comments_global_per_day: number;
  ai_governance_enabled: boolean;
  ai_review_history_limit: number;
  ai_review_history_days: number;
  ai_anomali_divisor: number;
  ai_anomali_min_skor: number;
  ai_review_revert_days: number;
  ai_auto_mode_enabled: boolean;
  ai_auto_interval_days: number;
  ai_auto_max_devs_per_run: number;
};

function configToEdit(c: CommunityConfig): EditValues {
  return {
    harga_dasar: c.harga_dasar,
    batas_atas: c.batas_atas,
    nilai_minimum_project: c.nilai_minimum_project,
    nilai_maksimum_project: c.nilai_maksimum_project ?? 10000000,
    minimum_buyback_pct: c.minimum_buyback_pct,
    fee_min: c.fee_project_pct.min,
    fee_max: c.fee_project_pct.max,
    fee_trigger_per_nft: c.fee_trigger_per_nft ?? 10,
    fee_infrastruktur_pct: c.fee_infrastruktur_pct ?? 50,
    minimum_top_developer: c.minimum_top_developer,
    minimum_soldNfts_top_developer: c.minimum_soldNfts_top_developer,
    kapasitas_pool_minimum: c.kapasitas_pool_minimum,
    max_nft_in_pool_per_developer: c.max_nft_in_pool_per_developer ?? 3,
    minimum_nft_pool_untuk_validasi: c.minimum_nft_pool_untuk_validasi ?? 90,
    minimum_holding_days: c.minimum_holding_days ?? 7,
    purchase_autoclose_days: c.purchase_autoclose_days ?? 7,
    max_projects_per_user: c.max_projects_per_user ?? 10,
    min_realisasi_pct_untuk_create: c.min_realisasi_pct_untuk_create ?? 20,
    fase_aktif: c.fase_aktif,
    ai_provider: c.ai_provider,
    anomali_flag: c.ai_anomali_threshold.flag,
    anomali_invalid: c.ai_anomali_threshold.invalid,
    max_transactions_per_user_per_day: c.max_transactions_per_user_per_day ?? 20,
    max_projects_per_user_per_day: c.max_projects_per_user_per_day ?? 2,
    max_comments_per_user_per_day: c.max_comments_per_user_per_day ?? 30,
    max_projects_global_per_day: c.max_projects_global_per_day ?? 20,
    max_comments_global_per_day: c.max_comments_global_per_day ?? 300,
    ai_governance_enabled: c.ai_governance_enabled ?? false,
    ai_review_history_limit: c.ai_review_history_limit ?? 50,
    ai_review_history_days: c.ai_review_history_days ?? 50,
    ai_anomali_divisor: c.ai_anomali_divisor ?? 10,
    ai_anomali_min_skor: c.ai_anomali_min_skor ?? 30,
    ai_review_revert_days: c.ai_review_revert_days ?? 7,
    ai_auto_mode_enabled: c.ai_auto_mode_enabled ?? false,
    ai_auto_interval_days: c.ai_auto_interval_days ?? 30,
    ai_auto_max_devs_per_run: c.ai_auto_max_devs_per_run ?? 10,
  };
}

function editToConfig(e: EditValues): Partial<Omit<CommunityConfig, 'updated_at' | 'updated_by'>> {
  return {
    harga_dasar: e.harga_dasar,
    batas_atas: e.batas_atas,
    nilai_minimum_project: e.nilai_minimum_project,
    nilai_maksimum_project: e.nilai_maksimum_project,
    minimum_buyback_pct: e.minimum_buyback_pct,
    fee_project_pct: { min: e.fee_min, max: e.fee_max },
    fee_trigger_per_nft: e.fee_trigger_per_nft,
    fee_infrastruktur_pct: e.fee_infrastruktur_pct,
    minimum_top_developer: e.minimum_top_developer,
    minimum_soldNfts_top_developer: e.minimum_soldNfts_top_developer,
    kapasitas_pool_minimum: e.kapasitas_pool_minimum,
    max_nft_in_pool_per_developer: e.max_nft_in_pool_per_developer,
    minimum_nft_pool_untuk_validasi: e.minimum_nft_pool_untuk_validasi,
    minimum_holding_days: e.minimum_holding_days,
    purchase_autoclose_days: e.purchase_autoclose_days,
    max_projects_per_user: e.max_projects_per_user,
    min_realisasi_pct_untuk_create: e.min_realisasi_pct_untuk_create,
    fase_aktif: e.fase_aktif,
    ai_provider: e.ai_provider,
    ai_anomali_threshold: { flag: e.anomali_flag, invalid: e.anomali_invalid },
    max_transactions_per_user_per_day: e.max_transactions_per_user_per_day,
    max_projects_per_user_per_day: e.max_projects_per_user_per_day,
    max_comments_per_user_per_day: e.max_comments_per_user_per_day,
    max_projects_global_per_day: e.max_projects_global_per_day,
    max_comments_global_per_day: e.max_comments_global_per_day,
    ai_governance_enabled: e.ai_governance_enabled,
    ai_review_history_limit: e.ai_review_history_limit,
    ai_review_history_days: e.ai_review_history_days,
    ai_anomali_divisor: e.ai_anomali_divisor,
    ai_anomali_min_skor: e.ai_anomali_min_skor,
    ai_review_revert_days: e.ai_review_revert_days,
    ai_auto_mode_enabled: e.ai_auto_mode_enabled,
    ai_auto_interval_days: e.ai_auto_interval_days,
    ai_auto_max_devs_per_run: e.ai_auto_max_devs_per_run,
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
  const { user, isAdmin, isSuperAdmin } = useAuth();

  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feePool, setFeePool] = useState<FeePool | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  function setField<K extends keyof EditValues>(key: K, value: EditValues[K]) {
    setEditValues(prev => prev ? { ...prev, [key]: value } : null);
  }

  useEffect(() => {
    Promise.all([
      getCommunityConfig(),
      getDoc(doc(db, 'fee_pool', 'v1')),
    ])
      .then(([data, feeSnap]) => {
        if (data) {
          setConfig(data);
        } else {
          setConfig({ ...DEFAULT_COMMUNITY_CONFIG, updated_at: new Date(), updated_by: '' });
          setIsDefault(true);
        }
        if (feeSnap.exists()) {
          const fd = feeSnap.data();
          setFeePool({
            total_terkumpul: (fd.total_terkumpul as number) ?? 0,
            total_terdistribusi: (fd.total_terdistribusi as number) ?? 0,
            total_digunakan: (fd.total_digunakan as number) ?? 0,
            sertifikat_aktif_id: null,
            total_sertifikat_diterbitkan: 0,
            updated_at: (fd.updated_at as Timestamp)?.toDate?.() ?? new Date(),
            total_dari_fee: (fd.total_dari_fee as number) ?? 0,
            total_dari_anomali: (fd.total_dari_anomali as number) ?? 0,
            saldo_tersedia: (fd.saldo_tersedia as number) ?? 0,
          });
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
                  <EditRow label="Maks. Project (Rp)" value={editValues.nilai_maksimum_project}
                    onChange={v => setField('nilai_maksimum_project', v as number)} />
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
                  <EditRow label="Maks. NFT di Pool per Developer" value={editValues.max_nft_in_pool_per_developer}
                    onChange={v => setField('max_nft_in_pool_per_developer', v as number)} />
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
                  <EditRow label="Min. Holding (hari)" value={editValues.minimum_holding_days}
                    onChange={v => setField('minimum_holding_days', v as number)} />
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Durasi Auto-Complete Transaksi
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="Auto-close (hari)" value={editValues.purchase_autoclose_days}
                    onChange={v => setField('purchase_autoclose_days', v as number)} />
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Batas Project
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="Maks. project per user" value={editValues.max_projects_per_user}
                    onChange={v => setField('max_projects_per_user', v as number)} />
                  <EditRow label="Min. Realisasi untuk Buat Project (%)" value={editValues.min_realisasi_pct_untuk_create}
                    onChange={v => setField('min_realisasi_pct_untuk_create', v as number)} />
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Batas Harian (Rate Limit)
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="Transaksi per user/hari" value={editValues.max_transactions_per_user_per_day}
                    onChange={v => setField('max_transactions_per_user_per_day', v as number)} />
                  <EditRow label="Project per user/hari" value={editValues.max_projects_per_user_per_day}
                    onChange={v => setField('max_projects_per_user_per_day', v as number)} />
                  <EditRow label="Komentar per user/hari" value={editValues.max_comments_per_user_per_day}
                    onChange={v => setField('max_comments_per_user_per_day', v as number)} />
                  <EditRow label="Project global/hari" value={editValues.max_projects_global_per_day}
                    onChange={v => setField('max_projects_global_per_day', v as number)} />
                  <EditRow label="Komentar global/hari" value={editValues.max_comments_global_per_day}
                    onChange={v => setField('max_comments_global_per_day', v as number)} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Nilai 0 = tak terbatas. Batasan melindungi node dari overload.
                      Node berpendanaan dapat menaikkan atau menonaktifkan.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    AI Governance
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-muted-foreground">Aktifkan AI Governance</span>
                    <select
                      className="text-sm border rounded px-2 py-1 bg-background"
                      value={editValues.ai_governance_enabled ? 'true' : 'false'}
                      onChange={e => setField('ai_governance_enabled', e.target.value === 'true')}
                    >
                      <option value="false">Nonaktif (default)</option>
                      <option value="true">Aktif</option>
                    </select>
                  </div>
                  <EditRow label="Maks. log per developer" value={editValues.ai_review_history_limit}
                    onChange={v => setField('ai_review_history_limit', v as number)} />
                  <EditRow label="Jangkauan hari log" value={editValues.ai_review_history_days}
                    onChange={v => setField('ai_review_history_days', v as number)} />
                  <EditRow label="Pembagi skor → NFT minus" value={editValues.ai_anomali_divisor}
                    onChange={v => setField('ai_anomali_divisor', v as number)} />
                  <EditRow label="Skor efek proporsional kecil (<)" value={editValues.ai_anomali_min_skor}
                    onChange={v => setField('ai_anomali_min_skor', v as number)} />
                  <EditRow label="Masa sanggah (hari)" value={editValues.ai_review_revert_days}
                    onChange={v => setField('ai_review_revert_days', v as number)} />
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-muted-foreground">Mode Otonom (Level 2)</span>
                    <select
                      className="text-sm border rounded px-2 py-1 bg-background"
                      value={editValues.ai_auto_mode_enabled ? 'true' : 'false'}
                      onChange={e => setField('ai_auto_mode_enabled', e.target.value === 'true')}
                    >
                      <option value="false">Nonaktif (default)</option>
                      <option value="true">Aktif</option>
                    </select>
                  </div>
                  <EditRow label="Interval antar run (hari)" value={editValues.ai_auto_interval_days}
                    onChange={v => setField('ai_auto_interval_days', v as number)} />
                  <EditRow label="Maks. developer per run" value={editValues.ai_auto_max_devs_per_run}
                    onChange={v => setField('ai_auto_max_devs_per_run', v as number)} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Fitur opsional. Saat nonaktif, platform berjalan penuh tanpa penilaian AI.
                      Mode Otonom membutuhkan GEMINI_API_KEY dan FIREBASE_SERVICE_ACCOUNT_KEY di environment.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="ring-2 ring-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fee Sharing
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <EditRow label="Trigger per NFT terjual" value={editValues.fee_trigger_per_nft}
                    onChange={v => setField('fee_trigger_per_nft', v as number)} />
                  <EditRow label="Porsi infrastruktur (%)" value={editValues.fee_infrastruktur_pct}
                    onChange={v => setField('fee_infrastruktur_pct', v as number)} />
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
                  <ParamRow label="Nilai Maks. Project" value={formatRupiah(config.nilai_maksimum_project ?? 10000000)} />
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
                  <ParamRow label="Maks. NFT di Pool/Developer"
                    value={`${config.max_nft_in_pool_per_developer ?? 3} NFT`} />
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
                  <ParamRow label="Holding Period NFT"
                    value={`${config.minimum_holding_days ?? 7} hari`} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Validasi bergulir hanya bisa dimulai jika pool rekomendasi
                      sudah terisi minimal sejumlah NFT ini.
                      NFT harus dipegang minimal sejumlah hari setelah pembelian
                      sebelum bisa digunakan validasi.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Durasi Auto-Complete Transaksi
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Auto-close Pembelian & Buyback"
                    value={`${config.purchase_autoclose_days ?? 7} hari`} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Jika seller tidak mengkonfirmasi atau pembeli tidak menyelesaikan buyback
                      dalam batas waktu ini, sistem akan menyelesaikan transaksi secara otomatis.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Batas Project
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Maks. Project per User"
                    value={`${config.max_projects_per_user ?? 10} project`} />
                  <ParamRow label="Min. Realisasi untuk Buat Project"
                    value={`${config.min_realisasi_pct_untuk_create ?? 20}%`} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Project baru hanya bisa dibuat jika realisasi transaksi
                      (terjual + buyback / total diterbitkan) memenuhi minimum ini.
                      Project pertama selalu diizinkan.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Batas Harian (Rate Limit)
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Transaksi per user/hari"
                    value={(config.max_transactions_per_user_per_day ?? 20) <= 0 ? 'Tak terbatas' : `${config.max_transactions_per_user_per_day ?? 20}/hari`} />
                  <ParamRow label="Project per user/hari"
                    value={(config.max_projects_per_user_per_day ?? 2) <= 0 ? 'Tak terbatas' : `${config.max_projects_per_user_per_day ?? 2}/hari`} />
                  <ParamRow label="Komentar per user/hari"
                    value={(config.max_comments_per_user_per_day ?? 30) <= 0 ? 'Tak terbatas' : `${config.max_comments_per_user_per_day ?? 30}/hari`} />
                  <ParamRow label="Project global/hari"
                    value={(config.max_projects_global_per_day ?? 20) <= 0 ? 'Tak terbatas' : `${config.max_projects_global_per_day ?? 20}/hari`} />
                  <ParamRow label="Komentar global/hari"
                    value={(config.max_comments_global_per_day ?? 300) <= 0 ? 'Tak terbatas' : `${config.max_comments_global_per_day ?? 300}/hari`} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Nilai 0 = tak terbatas. Batasan melindungi node dari overload.
                      Node berpendanaan dapat menaikkan atau menonaktifkan.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    AI Governance
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Status" value={(config.ai_governance_enabled ?? false) ? 'Aktif' : 'Nonaktif (default)'} />
                  <ParamRow label="Maks. log per developer" value={`${config.ai_review_history_limit ?? 50} log`} />
                  <ParamRow label="Jangkauan hari log" value={`${config.ai_review_history_days ?? 50} hari`} />
                  <ParamRow label="Pembagi skor → NFT minus" value={`÷ ${config.ai_anomali_divisor ?? 10}`} />
                  <ParamRow label="Skor efek kecil (<)" value={`< ${config.ai_anomali_min_skor ?? 30}`} />
                  <ParamRow label="Masa sanggah" value={`${config.ai_review_revert_days ?? 7} hari`} />
                  <ParamRow label="Mode Otonom (Level 2)" value={(config.ai_auto_mode_enabled ?? false) ? 'Aktif' : 'Nonaktif (default)'} />
                  <ParamRow label="Interval antar run" value={`${config.ai_auto_interval_days ?? 30} hari`} />
                  <ParamRow label="Maks. developer per run" value={`${config.ai_auto_max_devs_per_run ?? 10} developer`} />
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Fitur opsional. Saat nonaktif, platform berjalan penuh tanpa penilaian AI.
                      Mode Otonom membutuhkan GEMINI_API_KEY dan FIREBASE_SERVICE_ACCOUNT_KEY di environment.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fee Sharing
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Trigger fee"
                    value={`Setiap ${config.fee_trigger_per_nft ?? 10} NFT terjual`} />
                  <ParamRow label="Porsi infrastruktur"
                    value={`${config.fee_infrastruktur_pct ?? 50}%`} />
                  <ParamRow label="Porsi validator"
                    value={`${100 - (config.fee_infrastruktur_pct ?? 50)}%`} />
                  {feePool && (
                    <>
                      <ParamRow label="Saldo kas sistem"
                        value={formatRupiah(feePool.saldo_tersedia ?? 0)} />
                      <ParamRow label="Dari fee sharing (kas)"
                        value={formatRupiah(feePool.total_dari_fee ?? 0)} />
                      <ParamRow label="Dari hukuman anomali"
                        value={formatRupiah(feePool.total_dari_anomali ?? 0)} />
                      <ParamRow label="Terdistribusi ke validator"
                        value={formatRupiah(feePool.total_terdistribusi)} />
                    </>
                  )}
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Fee diambil dari neraca developer dan dibagikan proporsional
                      ke semua validator aktif project.
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

        {/* Tim Administrator — hanya Super Admin */}
        {isSuperAdmin && config && (
          <TeamManagementSection
            config={config}
            userId={user!.id}
            onSaved={(updated) => setConfig(prev => prev ? { ...prev, ...updated } : prev)}
          />
        )}

      </div>
    </MainLayout>
  );
}

// ─── Team Management Section ──────────────────────────────────────────────────

function TeamManagementSection({
  config, userId, onSaved,
}: {
  config: CommunityConfig;
  userId: string;
  onSaved: (updated: Partial<CommunityConfig>) => void;
}) {
  const [adminEmails, setAdminEmails] = useState<string[]>(config.admin_emails ?? []);
  const [moderatorEmails, setModeratorEmails] = useState<string[]>(config.moderator_emails ?? []);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newModEmail, setNewModEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function addAdmin() {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || adminEmails.includes(email)) return;
    setAdminEmails(prev => [...prev, email]);
    setNewAdminEmail('');
  }

  function addModerator() {
    const email = newModEmail.trim().toLowerCase();
    if (!email || moderatorEmails.includes(email)) return;
    setModeratorEmails(prev => [...prev, email]);
    setNewModEmail('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateCommunityConfig(userId, { admin_emails: adminEmails, moderator_emails: moderatorEmails });
      onSaved({ admin_emails: adminEmails, moderator_emails: moderatorEmails });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Tim Administrator
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Hanya Super Admin yang dapat mengelola bagian ini.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Admin */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1">
              {SUPER_ADMIN_EMAIL}
              <span className="text-[10px] opacity-60">Super Admin</span>
            </span>
            {adminEmails.map(email => (
              <span key={email} className="inline-flex items-center gap-1 text-xs bg-muted border rounded-full px-2.5 py-1">
                {email}
                <button onClick={() => setAdminEmails(prev => prev.filter(e => e !== email))} className="text-muted-foreground hover:text-destructive ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="email@baru.com"
              value={newAdminEmail}
              onChange={e => setNewAdminEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAdmin()}
            />
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 shrink-0" onClick={addAdmin}>
              <Plus className="h-3 w-3" /> Tambah
            </Button>
          </div>
        </div>

        {/* Moderator */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moderator</p>
          <div className="flex flex-wrap gap-2">
            {moderatorEmails.length === 0 && (
              <span className="text-xs text-muted-foreground italic">Belum ada moderator.</span>
            )}
            {moderatorEmails.map(email => (
              <span key={email} className="inline-flex items-center gap-1 text-xs bg-muted border rounded-full px-2.5 py-1">
                {email}
                <button onClick={() => setModeratorEmails(prev => prev.filter(e => e !== email))} className="text-muted-foreground hover:text-destructive ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="email@baru.com"
              value={newModEmail}
              onChange={e => setNewModEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addModerator()}
            />
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 shrink-0" onClick={addModerator}>
              <Plus className="h-3 w-3" /> Tambah
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-green-600">Tersimpan.</p>}

        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Simpan Perubahan Tim
        </Button>
      </CardContent>
    </Card>
  );
}
