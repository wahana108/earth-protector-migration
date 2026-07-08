'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import {
  Building2, TrendingUp, Server, Award, Loader2, ExternalLink, Info,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { db } from '@/lib/firebase';
import {
  getInfrastructureFundStatus,
  getLatestContributorCertificates,
  type InfrastructureFundStatus,
} from '@/lib/infrastructure';
import { getCommunityConfig } from '@/lib/community-config';
import type { ContributorCertificate, NFTUnit } from '@/lib/types';

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
}

export default function InfrastructurePage() {
  const [status, setStatus] = useState<InfrastructureFundStatus | null>(null);
  const [activeNft, setActiveNft] = useState<NFTUnit | null>(null);
  const [contributors, setContributors] = useState<ContributorCertificate[]>([]);
  const [infraCosts, setInfraCosts] = useState<Array<{ nama: string; jumlah: number; periode: 'bulan' | 'tahun' | 'sekali' | 'gratis'; info?: string }>>([]);
  const [expandedInfo, setExpandedInfo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fundStatus, certs, config] = await Promise.all([
          getInfrastructureFundStatus(),
          getLatestContributorCertificates(10),
          getCommunityConfig(),
        ]);
        setStatus(fundStatus);
        setContributors(certs);
        setInfraCosts(
          (config?.infrastructure_costs ?? []).map(c => ({
            ...c,
            info: (c.info ?? (c as Record<string, unknown>).link as string | undefined) || undefined,
          })),
        );

        if (fundStatus?.sertifikat_aktif_id) {
          const nftSnap = await getDoc(doc(db, 'nft_units', fundStatus.sertifikat_aktif_id));
          if (nftSnap.exists()) {
            const d = nftSnap.data();
            setActiveNft({
              id: nftSnap.id,
              project_id: d.project_id as string,
              developer_id: d.developer_id as string,
              owner_id: d.owner_id as string,
              nama_nft: (d.nama_nft as string) ?? '',
              nama_project: (d.nama_project as string) ?? '',
              gambar_url: (d.gambar_url as string) ?? '',
              kategori: (d.kategori as NFTUnit['kategori']) ?? 'lainnya',
              status: (d.status as NFTUnit['status']) ?? 'valid',
              harga_jual: (d.harga_jual as number) ?? 0,
              harga_beli_terakhir: (d.harga_beli_terakhir as number) ?? 0,
              nilai_selisih: (d.nilai_selisih as number) ?? 0,
              for_sale: (d.for_sale as boolean) ?? true,
              in_pool: (d.in_pool as boolean) ?? true,
              digunakan_validasi: false,
              project_validasi_id: null,
              like_count: (d.like_count as number) ?? 0,
              comment_count: (d.comment_count as number) ?? 0,
              created_at: (d.created_at as Timestamp)?.toDate?.() ?? new Date(),
              is_infrastructure: true,
              certificate_code: (d.certificate_code as string) ?? '',
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const sisaPct = status && status.harga_dasar > 0
    ? Math.min(100, Math.round((status.sisa / status.harga_dasar) * 100))
    : 0;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Dana Sistem</h1>
            <p className="text-sm text-muted-foreground">Transparansi infrastruktur jaringan TMEP</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── 1. Status Dana Sistem ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Status Dana Sistem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {status ? (
                  <>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Total Terkumpul</p>
                        <p className="font-bold text-sm">{formatIDR(status.total_terkumpul)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Total Digunakan</p>
                        <p className="font-bold text-sm text-orange-600">{formatIDR(status.total_digunakan)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Sisa Tersedia</p>
                        <p className="font-bold text-sm text-green-600">{formatIDR(Math.max(0, status.sisa))}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {status.cukup_untuk > 0
                        ? `Cukup untuk ${status.cukup_untuk} sertifikat lagi`
                        : `Butuh ${formatIDR(status.harga_dasar - Math.max(0, status.sisa))} lagi untuk sertifikat berikutnya`
                      }
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Total sertifikat diterbitkan:{' '}
                      <span className="font-medium text-foreground">{status.total_sertifikat_diterbitkan}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Dana sistem belum memiliki catatan.</p>
                )}
              </CardContent>
            </Card>

            {/* ── 2. Kebutuhan Operasional Node ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Kebutuhan Operasional Node
                </CardTitle>
                <CardDescription className="text-xs">
                  Rincian biaya infrastruktur yang dikelola transparan oleh komunitas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {infraCosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Belum ada data kebutuhan operasional. Admin dapat mengisi di halaman Admin.
                  </p>
                ) : (
                  <div className="divide-y rounded-lg border overflow-hidden">
                    {infraCosts.map((item, i) => {
                      const infoText = item.info || (item as Record<string, unknown>).link as string | undefined;
                      const isExpanded = expandedInfo === i;
                      return (
                        <div key={i} className="bg-card">
                          <div className="flex items-center justify-between px-4 py-3 text-sm gap-3">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate">{item.nama}</span>
                              {infoText && (
                                <button
                                  onClick={() => setExpandedInfo(isExpanded ? null : i)}
                                  className="shrink-0 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                                  title="Tampilkan info pembayaran"
                                >
                                  <Info className="h-3.5 w-3.5" />
                                  <span>Info</span>
                                </button>
                              )}
                            </div>
                            <span className="font-medium shrink-0">
                              {item.periode === 'gratis' || item.jumlah === 0 ? (
                                <Badge variant="secondary" className="text-xs">Gratis</Badge>
                              ) : item.periode === 'sekali' ? (
                                `${formatIDR(item.jumlah)} (sekali)`
                              ) : (
                                `${formatIDR(item.jumlah)}/${item.periode}`
                              )}
                            </span>
                          </div>
                          {isExpanded && infoText && (
                            <div className="px-4 pb-3 text-xs text-muted-foreground bg-muted/30 border-t">
                              <p className="pt-2 leading-relaxed">{infoText}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 3. Sertifikat Tersedia ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Sertifikat Tersedia
                </CardTitle>
                <CardDescription className="text-xs">
                  Kontribusi untuk infrastruktur mendapatkan certificate NFT eksklusif.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeNft ? (
                  <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-sm">{activeNft.nama_nft}</p>
                        {activeNft.certificate_code && (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            {activeNft.certificate_code}
                          </p>
                        )}
                      </div>
                      <Badge className="text-xs bg-green-100 text-green-800 border-green-300 shrink-0">
                        Tersedia
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Harga kontribusi</span>
                      <span className="font-bold">{formatIDR(activeNft.harga_jual)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sertifikat tersedia di Pool Rekomendasi.
                      Beli untuk mendukung infrastruktur jaringan TMEP.
                    </p>
                    <Button size="sm" asChild className="w-full">
                      <Link href="/pool">
                        Beli di Pool Rekomendasi
                        <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                      </Link>
                    </Button>
                  </div>
                ) : status ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {status.sisa < status.harga_dasar
                        ? 'Dana sistem belum mencukupi untuk menerbitkan sertifikat berikutnya.'
                        : 'Sertifikat sedang menunggu penerbitan oleh admin.'}
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatIDR(Math.max(0, status.sisa))}</span>
                        <span>target {formatIDR(status.harga_dasar)}</span>
                      </div>
                      <Progress value={sisaPct} className="h-2" />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Dana sistem belum aktif.</p>
                )}
              </CardContent>
            </Card>

            {/* ── 4. Neraca Sistem ── */}
            {status && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Neraca Sistem
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Sumber dan alokasi saldo pool sistem — transparan untuk semua anggota komunitas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y text-sm">
                  {[
                    { label: 'Saldo tersedia', value: (status as unknown as Record<string, unknown>).saldo_tersedia as number ?? 0, highlight: true },
                    { label: 'Dari fee sharing', value: (status as unknown as Record<string, unknown>).total_dari_fee as number ?? 0 },
                    { label: 'Dari sanksi anomali AI', value: (status as unknown as Record<string, unknown>).total_dari_anomali as number ?? 0 },
                    { label: 'Dari sumber lain', value: (status as unknown as Record<string, unknown>).total_dari_lain as number ?? 0 },
                    { label: 'Dialokasikan ke lencana', value: (status as unknown as Record<string, unknown>).total_dialokasikan_lencana as number ?? 0 },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="flex justify-between py-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-mono font-medium ${highlight ? 'text-green-600' : ''}`}>
                        {formatIDR(value ?? 0)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* ── 5. Kontributor ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-500" />
                  Kontributor
                  {contributors.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({contributors.length} terbaru)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contributors.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Belum ada kontributor. Jadilah yang pertama!
                  </p>
                ) : (
                  <div className="divide-y rounded-lg border overflow-hidden">
                    {contributors.map(cert => (
                      <div key={cert.id} className="flex items-center gap-3 px-4 py-3 bg-card text-sm">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                          <Award className="h-4 w-4 text-yellow-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-medium">{cert.certificate_code}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(cert.purchased_at)}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatIDR(cert.nilai)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
