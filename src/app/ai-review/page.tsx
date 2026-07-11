'use client';

import { useState, useEffect, useCallback } from 'react';
import { Scan, Copy, Check, Loader2, AlertTriangle, ChevronDown, ChevronUp, RotateCcw, ShieldOff } from 'lucide-react';
import Link from 'next/link';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { getCommunityConfig } from '@/lib/community-config';
import {
  getTopDevsForAiReview, fetchDevLogs, aggregateDevData,
  generateDataText, generatePrompt, parseAiOutput,
  applyAiReview, revertAiReview, getAiReviews, maybeFinalizeReviews,
  calcMinusNeraca,
  type DevProfile, type DevAggregate, type ParsedAiEntry, type AiReview,
} from '@/lib/ai-review';
import type { CommunityConfig } from '@/lib/types';

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function CopyButton({ text, label = 'Salin' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Tersalin' : label}
    </Button>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'applied') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Aktif — bisa dibatalkan</Badge>;
  if (status === 'reverted') return <Badge className="bg-gray-100 text-gray-600 border-gray-300">Dibatalkan</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-300">Final</Badge>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AiReviewPage() {
  const { user, isAdmin } = useAuth();

  const [config, setConfig] = useState<CommunityConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Export state
  const [devs, setDevs] = useState<DevProfile[]>([]);
  const [aggregates, setAggregates] = useState<DevAggregate[]>([]);
  const [shortIdToInfo, setShortIdToInfo] = useState<Map<string, { uid: string; displayName: string }>>(new Map());
  const [dataText, setDataText] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loadingExport, setLoadingExport] = useState(false);

  // Parse & preview state
  const [pastedOutput, setPastedOutput] = useState('');
  const [parsedEntries, setParsedEntries] = useState<ParsedAiEntry[] | null>(null);
  const [parseError, setParseError] = useState('');

  // Apply state
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState('');
  const [applyError, setApplyError] = useState('');

  // Reviews history
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [reverting, setReverting] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    const cfg = await getCommunityConfig();
    setConfig(cfg);
    setLoading(false);
  }, []);

  const loadReviews = useCallback(async () => {
    const raw = await getAiReviews();
    const finalized = await maybeFinalizeReviews(raw);
    setReviews(finalized);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (isAdmin && config?.ai_governance_enabled) {
      loadReviews();
    }
  }, [isAdmin, config?.ai_governance_enabled, loadReviews]);

  // ── Guard: non-admin ────────────────────────────────────────────────────────

  if (!loading && !isAdmin) {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto py-16 text-center space-y-3">
          <ShieldOff className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Halaman ini hanya untuk admin.</p>
        </div>
      </MainLayout>
    );
  }

  // ── Guard: fitur dinonaktifkan ──────────────────────────────────────────────

  if (!loading && !config?.ai_governance_enabled) {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto py-16 text-center space-y-4">
          <Scan className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-semibold">AI Governance dinonaktifkan</h1>
          <p className="text-muted-foreground text-sm">
            Aktifkan parameter <code className="bg-muted px-1 rounded">ai_governance_enabled</code> di halaman Parameters untuk menggunakan fitur ini.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/parameters">Ke Parameters</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  // ── Export handler ──────────────────────────────────────────────────────────

  async function handleExport() {
    if (!config || !user) return;
    setLoadingExport(true);
    setDevs([]);
    setAggregates([]);
    setDataText('');
    setPrompt('');
    setParsedEntries(null);
    setParseError('');
    try {
      const fetchedDevs = await getTopDevsForAiReview(config);
      if (fetchedDevs.length === 0) {
        setDataText('Tidak ada developer yang memenuhi syarat untuk ditinjau.');
        return;
      }

      const histLimit = config.ai_review_history_limit ?? 50;
      const histDays = config.ai_review_history_days ?? 50;

      const logsArr = await Promise.all(
        fetchedDevs.map(d => fetchDevLogs(d.uid, histLimit, histDays, d.lastAiReviewAt)),
      );
      const aggs = fetchedDevs.map((d, i) => aggregateDevData(d, logsArr[i]));
      setDevs(fetchedDevs);

      const idMap = new Map<string, { uid: string; displayName: string }>();
      for (const agg of aggs) {
        idMap.set(agg.shortId, { uid: agg.uid, displayName: agg.displayName });
      }


      const dText = generateDataText(aggs);
      const pText = generatePrompt(dText);

      setAggregates(aggs);
      setShortIdToInfo(idMap);
      setDataText(dText);
      setPrompt(pText);
    } finally {
      setLoadingExport(false);
    }
  }

  // ── Parse handler ───────────────────────────────────────────────────────────

  function handleParse() {
    setParseError('');
    setParsedEntries(null);
    const result = parseAiOutput(pastedOutput, shortIdToInfo, config!);
    if (typeof result === 'string') {
      setParseError(result);
    } else {
      setParsedEntries(result);
    }
  }

  // ── Apply handler ───────────────────────────────────────────────────────────

  async function handleApply() {
    if (!parsedEntries || !config || !user) return;
    setApplying(true);
    setApplyError('');
    setApplySuccess('');
    try {
      const reviewId = await applyAiReview(parsedEntries, config, user.id);
      setApplySuccess(`Penilaian diterapkan. Review ID: ${reviewId}`);
      setParsedEntries(null);
      setPastedOutput('');
      await loadReviews();
    } catch (err: unknown) {
      setApplyError(err instanceof Error ? err.message : 'Gagal menerapkan penilaian.');
    } finally {
      setApplying(false);
    }
  }

  // ── Revert handler ──────────────────────────────────────────────────────────

  async function handleRevert(review: AiReview) {
    if (!window.confirm(`Batalkan review ini? Neraca ${review.entries.filter(e => e.minus_diterapkan > 0).length} developer akan dikembalikan.`)) return;
    setReverting(review.id);
    try {
      await revertAiReview(review.id, review, user!.id);
      await loadReviews();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Gagal membatalkan review.');
    } finally {
      setReverting(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const totalMinusPreview = parsedEntries?.reduce((s, e) => s + e.minusNeraca, 0) ?? 0;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Scan className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">AI Review</h1>
            <p className="text-sm text-muted-foreground">Tata kelola AI — deteksi anomali manual-bridge</p>
          </div>
        </div>

        {/* ── A. Export Data ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">A — Export Data Developer</CardTitle>
            <CardDescription className="text-xs">
              Ambil ringkasan log transaksi top developer + kandidat (kuota Fibonacci). Salin hasilnya untuk dikirim ke AI eksternal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleExport} disabled={loadingExport} className="gap-2">
              {loadingExport && <Loader2 className="h-4 w-4 animate-spin" />}
              {loadingExport ? 'Mengambil data…' : 'Ambil & Agregasi Data'}
            </Button>

            {dataText && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{aggregates.length} developer</span>
                  <CopyButton text={dataText} label="Salin Data" />
                </div>
                <div className="rounded-lg border bg-muted/30 px-3 py-2 space-y-1">
                  {devs.map(d => (
                    <div key={d.uid} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono font-medium text-foreground w-16 shrink-0">{d.shortId}</span>
                      <span className="truncate flex-1">{d.displayName}</span>
                      <span className="shrink-0">
                        Log sejak:{' '}
                        <span className="font-medium text-foreground">
                          {d.lastAiReviewAt ? formatDate(d.lastAiReviewAt) : 'awal'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-56 whitespace-pre-wrap font-mono leading-relaxed">
                  {dataText}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── B. Prompt ── */}
        {prompt && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">B — Prompt Baku</CardTitle>
                <CopyButton text={prompt} label="Salin Prompt" />
              </div>
              <CardDescription className="text-xs">
                Kirim prompt ini beserta data developer ke AI eksternal (Gemini, GPT, dll). Prompt sudah mengandung data — cukup salin sekali.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono leading-relaxed">
                {prompt}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* ── C. Input Hasil AI ── */}
        {dataText && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">C — Tempel Hasil AI</CardTitle>
              <CardDescription className="text-xs">
                Tempel output dari AI eksternal. Format yang diharapkan per baris:{' '}
                <code className="bg-muted px-1 rounded">SKOR: [id_6_char] | [0-100] | [alasan]</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder={'SKOR: abc123 | 45 | Self-dealing terdeteksi, counterparty berulang\nSKOR: def456 | 0 | Tidak ada anomali signifikan'}
                value={pastedOutput}
                onChange={e => setPastedOutput(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              {parseError && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <pre className="whitespace-pre-wrap text-xs">{parseError}</pre>
                </div>
              )}
              <Button onClick={handleParse} disabled={!pastedOutput.trim()} variant="outline">
                Parse &amp; Preview
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── D. Preview ── */}
        {parsedEntries && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">D — Preview Penilaian</CardTitle>
              <CardDescription className="text-xs">
                Tinjau sebelum diterapkan. Total minus:{' '}
                <span className="font-semibold text-destructive">{formatIDR(totalMinusPreview)}</span>
                {' '}akan dipindah ke saldo neraca sistem.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Developer</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Skor</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Minus NFT</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Minus Neraca</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {parsedEntries.map(e => (
                      <tr key={e.uid} className="bg-card">
                        <td className="px-3 py-2">
                          <p className="font-medium truncate max-w-[120px]">{e.displayName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{e.shortId}</p>
                          <p className="text-xs text-muted-foreground italic mt-0.5">{e.alasan}</p>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={e.skor >= (config?.ai_anomali_min_skor ?? 30) ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                            {e.skor}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm">
                          {e.minusNft > 0 ? `-${e.minusNft}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm">
                          {e.minusNeraca > 0 ? <span className="text-destructive">{formatIDR(e.minusNeraca)}</span> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {applyError && (
                <p className="text-sm text-destructive">{applyError}</p>
              )}
              {applySuccess && (
                <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3">{applySuccess}</p>
              )}

              <Button
                onClick={handleApply}
                disabled={applying || parsedEntries.length === 0}
                className="w-full gap-2"
              >
                {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                {applying ? 'Menerapkan…' : `Terapkan Penilaian (${parsedEntries.length} developer)`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── E. Riwayat Review ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Riwayat Review</CardTitle>
            <CardDescription className="text-xs">
              Review aktif dapat dibatalkan dalam masa sanggah ({config?.ai_review_revert_days ?? 7} hari). Lewat deadline → otomatis final.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Belum ada review yang pernah diterapkan.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map(review => (
                  <div key={review.id} className="rounded-lg border overflow-hidden">
                    <div className="flex items-start justify-between gap-3 px-4 py-3 bg-card">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={review.status} />
                          <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
                        </div>
                        <p className="text-sm">
                          {review.entries.length} developer ·{' '}
                          <span className="text-destructive font-medium">{formatIDR(review.total_minus)}</span> total minus
                        </p>
                        {review.status === 'applied' && (
                          <p className="text-xs text-muted-foreground">
                            Deadline sanggah: {formatDate(review.revert_deadline)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {review.status === 'applied' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                            disabled={reverting === review.id}
                            onClick={() => handleRevert(review)}
                          >
                            {reverting === review.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            Batalkan
                          </Button>
                        )}
                        <button
                          onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                        >
                          {expandedReview === review.id
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          }
                        </button>
                      </div>
                    </div>
                    {expandedReview === review.id && (
                      <div className="border-t bg-muted/30">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Developer</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Skor</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Minus</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {review.entries.map((entry, i) => (
                              <tr key={i} className="bg-card">
                                <td className="px-3 py-2">
                                  <p className="font-medium">{entry.nama}</p>
                                  <p className="text-muted-foreground font-mono">{entry.dev_id.substring(0, 6)}</p>
                                  <p className="text-muted-foreground italic">{entry.alasan}</p>
                                </td>
                                <td className="px-3 py-2 text-right">{entry.skor}</td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {entry.minus_diterapkan > 0 ? formatIDR(entry.minus_diterapkan) : '—'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={
                                    entry.status === 'applied' ? 'text-yellow-700' :
                                    entry.status === 'reverted' ? 'text-gray-500' : 'text-green-700'
                                  }>
                                    {entry.status === 'applied' ? 'Aktif' : entry.status === 'reverted' ? 'Dibatalkan' : 'Final'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </MainLayout>
  );
}
