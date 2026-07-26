'use client';

import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  Building2, TrendingUp, Server, Award, Loader2, Info, Users, HandCoins,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import {
  getInfrastructureFundStatus,
  getLatestContributorCertificates,
  getInfrastructurePayments,
  getUserClaims,
  submitInfrastructureClaim,
  type InfrastructureFundStatus,
} from '@/lib/infrastructure';
import type { CommunityConfig, InfrastructureClaim, InfrastructurePayment } from '@/lib/types';
import { getCommunityConfig } from '@/lib/community-config';
import type { ContributorCertificate } from '@/lib/types';
import { formatCurrency } from '@/lib/format-currency';

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(d);
}

export default function InfrastructurePage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<InfrastructureFundStatus | null>(null);
  const [contributors, setContributors] = useState<ContributorCertificate[]>([]);
  const [payments, setPayments] = useState<InfrastructurePayment[]>([]);
  const [infraCosts, setInfraCosts] = useState<Array<{ nama: string; jumlah: number; periode: 'bulan' | 'tahun' | 'sekali' | 'gratis'; info?: string }>>([]);
  const [expandedInfo, setExpandedInfo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<CommunityConfig | null>(null);

  const [userClaims, setUserClaims] = useState<InfrastructureClaim[]>([]);
  const [claimNilai, setClaimNilai] = useState('');
  const [claimBuktiLink, setClaimBuktiLink] = useState('');
  const [claimKeterangan, setClaimKeterangan] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fundStatus, certs, pmts, cfg] = await Promise.all([
          getInfrastructureFundStatus(),
          getLatestContributorCertificates(10),
          getInfrastructurePayments(20),
          getCommunityConfig(),
        ]);
        setStatus(fundStatus);
        setContributors(certs);
        setPayments(pmts);
        setConfig(cfg);
        setInfraCosts(
          (cfg?.infrastructure_costs ?? []).map(c => ({
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

  useEffect(() => {
    if (!user) { setUserClaims([]); return; }
    getUserClaims(user.id).then(setUserClaims).catch(() => {});
  }, [user]);

  // Guard "1 klaim pending" — client-side saja (lihat komentar di firestore.rules).
  // Gerbang keras tetap verifikasi admin, bukan proteksi ini.
  const hasPendingClaim = userClaims.some(c => c.status === 'pending');

  async function handleSubmitClaim() {
    if (!user) return;
    const nilaiNum = parseInt(claimNilai.replace(/\D/g, ''), 10);
    if (!nilaiNum || nilaiNum <= 0) {
      setClaimResult('Nilai klaim wajib diisi dan lebih dari 0.');
      return;
    }
    if (!/^https?:\/\/.+/.test(claimBuktiLink.trim())) {
      setClaimResult('Bukti link wajib diisi dengan format URL (dimulai http:// atau https://).');
      return;
    }
    setClaimSubmitting(true);
    setClaimResult(null);
    try {
      await submitInfrastructureClaim(
        user.id,
        user.displayName ?? user.email ?? 'User',
        nilaiNum,
        claimBuktiLink.trim(),
        claimKeterangan.trim(),
      );
      setClaimResult('Klaim berhasil diajukan. Menunggu verifikasi admin.');
      setClaimNilai('');
      setClaimBuktiLink('');
      setClaimKeterangan('');
      setUserClaims(await getUserClaims(user.id));
    } catch (e) {
      setClaimResult(`Gagal: ${e instanceof Error ? e.message : 'Terjadi kesalahan.'}`);
    } finally {
      setClaimSubmitting(false);
    }
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Dana Sistem</h1>
            <p className="text-sm text-muted-foreground">Transparansi infrastruktur jaringan Inspira Better World</p>
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
                      <span className="font-mono font-bold text-green-600">{formatCurrency(status.saldo_tersedia, config)}</span>
                    </div>
                    <p className="py-2 text-xs text-muted-foreground font-medium">── Rincian Asal ──</p>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Dari Fee Sharing</span>
                      <span className="font-mono">{formatCurrency(status.total_dari_fee, config)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Dari Hukuman Anomali</span>
                      <span className="font-mono">{formatCurrency(status.total_dari_anomali, config)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Dari Sumber Lain</span>
                      <span className="font-mono">{formatCurrency(status.total_dari_lain, config)}</span>
                    </div>
                    <p className="py-2 text-xs text-muted-foreground font-medium">── Pengeluaran ──</p>
                    <div className="flex justify-between py-2">
                      <span className="text-muted-foreground">Reward ke Kontributor</span>
                      <span className="font-mono text-orange-600">{formatCurrency(status.total_dialokasikan_lencana, config)}</span>
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
                                `${formatCurrency(item.jumlah, config)} (sekali)`
                              ) : (
                                `${formatCurrency(item.jumlah, config)}/${item.periode}`
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
                          <p className="font-mono font-medium text-green-600">+{formatCurrency(p.nilai, config)}</p>
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

            {/* ── 3b. Klaim Kontribusi (hanya user login) ── */}
            {user && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-emerald-600" />
                    Klaim Kontribusi
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Sudah membayar biaya infrastruktur nyata (hosting, domain, API)? Ajukan klaim
                    dengan bukti. Setelah diverifikasi, Anda menerima poin kontribusi + lencana
                    kontributor. Poin diambil dari kas sistem — jika kas belum cukup, persetujuan
                    menunggu hingga kas terkumpul.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(config?.badge_klaim_enabled ?? true) ? (
                    <>
                      {hasPendingClaim ? (
                        <p className="text-sm text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
                          Anda masih memiliki klaim yang menunggu verifikasi admin. Klaim baru bisa
                          diajukan setelah klaim ini diproses.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder={`Nilai (${config?.currency_code ?? 'IDR'})`}
                            value={claimNilai}
                            onChange={e => setClaimNilai(e.target.value.replace(/\D/g, ''))}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Link bukti pembayaran (https://...)"
                            value={claimBuktiLink}
                            onChange={e => setClaimBuktiLink(e.target.value)}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Keterangan (opsional)"
                            value={claimKeterangan}
                            onChange={e => setClaimKeterangan(e.target.value)}
                            className="w-full rounded-md border px-3 py-2 text-sm"
                          />
                          <button
                            onClick={handleSubmitClaim}
                            disabled={claimSubmitting}
                            className="w-full rounded-md bg-emerald-600 text-white text-sm font-medium py-2 disabled:opacity-50"
                          >
                            {claimSubmitting ? 'Mengirim...' : 'Ajukan Klaim'}
                          </button>
                          {claimResult && (
                            <p className={`text-xs ${claimResult.startsWith('Gagal') ? 'text-red-600' : 'text-green-600'}`}>
                              {claimResult}
                            </p>
                          )}
                        </div>
                      )}

                      {userClaims.length > 0 && (
                        <div className="divide-y rounded-lg border overflow-hidden">
                          {userClaims.map(c => (
                            <div key={c.id} className="flex items-start gap-3 px-4 py-3 bg-card text-sm">
                              <div className="flex-1 min-w-0">
                                <p className="font-mono font-medium">{formatCurrency(c.nilai, config)}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(c.created_at)}</p>
                                {c.status === 'rejected' && c.alasan_penolakan && (
                                  <p className="text-xs text-red-600 mt-1">Ditolak: {c.alasan_penolakan}</p>
                                )}
                              </div>
                              <Badge
                                variant={c.status === 'approved' ? 'default' : c.status === 'rejected' ? 'destructive' : 'secondary'}
                                className="text-xs shrink-0"
                              >
                                {c.status === 'pending' ? 'Menunggu' : c.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Fitur klaim kontribusi sedang dinonaktifkan sementara oleh admin. Lencana
                      kontributor yang sudah ada tetap berlaku.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

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
                          {formatCurrency(cert.nilai, config)}
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
