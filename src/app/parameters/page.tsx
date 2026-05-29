'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import {
  getCommunityConfig,
  seedCommunityConfig,
  DEFAULT_COMMUNITY_CONFIG,
} from '@/lib/community-config';
import { useAuth } from '@/hooks/use-auth';
import type { CommunityConfig } from '@/lib/types';

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium font-mono">{value}</span>
    </div>
  );
}

function ParamCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export default function ParametersPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCommunityConfig()
      .then((data) => {
        if (data) {
          setConfig(data);
        } else {
          setConfig({
            ...DEFAULT_COMMUNITY_CONFIG,
            updated_at: new Date(),
            updated_by: '',
          });
          setIsDefault(true);
        }
      })
      .catch(() => setError('Gagal memuat konfigurasi dari Firestore.'))
      .finally(() => setLoading(false));
  }, []);

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
              Hanya administrator yang dapat mengubah nilai ini.
            </p>
          </div>
          {!loading && (
            <Badge variant={isDefault ? 'outline' : 'secondary'} className="shrink-0 mt-1">
              {isDefault ? 'Belum Aktif' : `Fase ${config?.fase_aktif}`}
            </Badge>
          )}
        </div>

        {/* Banner: belum diinisialisasi */}
        {!loading && isDefault && (
          <Alert className="border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-400">
              Menampilkan Nilai Default
            </AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300 flex items-center justify-between flex-wrap gap-2">
              <span>
                Dokumen <code className="font-mono text-xs">community_config/v1</code> belum ada di
                Firestore. Inisialisasi diperlukan sebelum platform aktif.
              </span>
              {user && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSeed}
                  disabled={seeding}
                  className="border-yellow-500 text-yellow-800 hover:bg-yellow-100"
                >
                  {seeding ? 'Menyimpan...' : 'Inisialisasi Sekarang'}
                </Button>
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
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Parameter cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <>
              <ParamCardSkeleton />
              <ParamCardSkeleton />
              <ParamCardSkeleton />
            </>
          ) : config ? (
            <>
              {/* Card 1: Harga & Transaksi */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Harga & Transaksi
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="Harga Dasar" value={formatRupiah(config.harga_dasar)} />
                  <ParamRow label="Batas Atas" value={formatRupiah(config.batas_atas)} />
                  <ParamRow
                    label="Nilai Min. Project"
                    value={formatRupiah(config.nilai_minimum_project)}
                  />
                  <ParamRow
                    label="Min. Buyback"
                    value={`${config.minimum_buyback_pct}%`}
                  />
                  <ParamRow
                    label="Fee Project"
                    value={`${config.fee_project_pct.min}% – ${config.fee_project_pct.max}%`}
                  />
                </CardContent>
              </Card>

              {/* Card 2: Komunitas & Pool */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Komunitas & Pool
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow
                    label="Min. Top Developer"
                    value={`${config.minimum_top_developer} developer`}
                  />
                  <ParamRow
                    label="Min. Kapasitas Pool"
                    value={`${config.kapasitas_pool_minimum} NFT`}
                  />
                  <ParamRow
                    label="Fase Aktif"
                    value={`Fase ${config.fase_aktif} — Infrastruktur Terpusat`}
                  />
                </CardContent>
              </Card>

              {/* Card 3: AI Monitoring */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    AI Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  <ParamRow label="AI Provider" value={config.ai_provider} />
                  <ParamRow
                    label="Threshold Flag"
                    value={`≥ ${config.ai_anomali_threshold.flag}% anomali`}
                  />
                  <ParamRow
                    label="Threshold Invalid"
                    value={`= ${config.ai_anomali_threshold.invalid}% anomali`}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        {/* Aturan fixed */}
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
            ].map((rule) => (
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
