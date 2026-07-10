'use client';

import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  Building2, TrendingUp, Server, Award, Loader2, Info, Users,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getInfrastructureFundStatus,
  getLatestContributorCertificates,
  getInfrastructurePayments,
  type InfrastructureFundStatus,
} from '@/lib/infrastructure';
import type { InfrastructurePayment } from '@/lib/types';
import { getCommunityConfig } from '@/lib/community-config';
import type { ContributorCertificate } from '@/lib/types';

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
  const [contributors, setContributors] = useState<ContributorCertificate[]>([]);
  const [payments, setPayments] = useState<InfrastructurePayment[]>([]);
  const [infraCosts, setInfraCosts] = useState<Array<{ nama: string; jumlah: number; periode: 'bulan' | 'tahun' | 'sekali' | 'gratis'; info?: string }>>([]);
  const [expandedInfo, setExpandedInfo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fundStatus, certs, pmts, config] = await Promise.all([
          getInfrastructureFundStatus(),
          getLatestContributorCertificates(10),
          getInfrastructurePayments(20),
          getCommunityConfig(),
        ]);
        setStatus(fundStatus);
        setContributors(certs);
        setPayments(pmts);
        setInfraCosts(
          (config?.infrastructure_costs ?? []).map(c => ({
            ...c,
            info: (c.info ?? (c as Record<string, unknown>).link as string | undefined) || undefined,
          })),
        );
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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
            {/* ── 1. Neraca Sistem (terpadu) ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  Neraca Sistem
                </CardTitle>
                <CardDescription className="text-xs">
                  Sumber dan alokasi kas sistem — transparan untuk semua anggota komunitas.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y text-sm">
                {status ? (
                  <>
                    <div className="flex justify-between py-2">
                      <span className="font-semibold">Saldo Tersedia</span>
                      <span className="font-mono font-bold text-green-600">{formatIDR(status.saldo_tersedia)}</span>
                    </div>
                    <p className="py-2 text-xs text-muted-foreground font-medium">── Rincian Asal ──</p>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Dari Fee Sharing</span>
                      <span className="font-mono">{formatIDR(status.total_dari_fee)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Dari Hukuman Anomali</span>
                      <span className="font-mono">{formatIDR(status.total_dari_anomali)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Dari Sumber Lain</span>
                      <span className="font-mono">{formatIDR(status.total_dari_lain)}</span>
                    </div>
                    <p className="py-2 text-xs text-muted-foreground font-medium">── Pengeluaran ──</p>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Reward ke Kontributor</span>
                      <span className="font-mono text-orange-600">{formatIDR(status.total_dialokasikan_lencana)}</span>
                    </div>
                    <p className="pt-3 pb-1 text-xs text-muted-foreground leading-relaxed">
                      Neraca sistem selalu seimbang — setiap poin yang masuk berasal dari mekanisme transparan
                      (fee sukarela, hukuman anomali) dan hanya dipakai untuk mendukung operasional komunitas.
                    </p>
                  </>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">Dana sistem belum memiliki catatan.</p>
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

            {/* ── 3. Reward Kontributor Infrastruktur ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Reward Kontributor Infrastruktur
                  {payments.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({payments.length} terbaru)
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Anggota yang membayar biaya infrastruktur nyata (hosting, domain, API, dsb.) dapat
                  diverifikasi admin dan menerima poin kontribusi, tercatat transparan di bawah.
                  Poin diambil dari kas sistem (saldo tersedia). Jika saldo belum cukup,
                  reward menunggu hingga kas terkumpul.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Belum ada pembayaran infrastruktur yang tercatat.
                  </p>
                ) : (
                  <div className="divide-y rounded-lg border overflow-hidden">
                    {payments.map(p => (
                      <div key={p.id} className="flex items-start gap-3 px-4 py-3 bg-card text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{p.kontributor_nama}</p>
                          {p.keterangan && (
                            <p className="text-xs text-muted-foreground truncate">{p.keterangan}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{formatDate(p.created_at)}</p>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="font-mono font-medium text-green-600">+{formatIDR(p.nilai)}</p>
                          {p.bukti_link && (
                            <a
                              href={p.bukti_link.startsWith('http') ? p.bukti_link : `https://${p.bukti_link}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              Bukti
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 4. Kontributor Historis (read-only, sembunyi jika kosong) ── */}
            {contributors.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Kontributor Historis
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({contributors.length})
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Data dari mekanisme sertifikat sebelumnya, dipertahankan untuk transparansi.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="divide-y rounded-lg border overflow-hidden">
                    {contributors.map(cert => (
                      <div key={cert.id} className="flex items-center gap-3 px-4 py-3 bg-card text-sm">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Award className="h-4 w-4 text-muted-foreground" />
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
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
