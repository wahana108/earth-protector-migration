'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCcw, ShieldAlert, ArrowUpRight, ArrowDownRight, Minus, Flag } from 'lucide-react';
import Link from 'next/link';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth';
import { recalculateAllDeveloperLevels, type RecalcStats } from '@/lib/projects';

const ADMIN_EMAIL = 'ramawan@live.com';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<RecalcStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !authLoading && user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.email !== ADMIN_EMAIL) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  async function handleRecalculate() {
    setRunning(true);
    setResult(null);
    setError(null);
    setProgress(null);

    try {
      const stats = await recalculateAllDeveloperLevels((processed, total) => {
        setProgress({ current: processed, total });
      });
      setResult(stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  if (authLoading || !isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Admin Tools</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Alat bantu untuk koreksi data dan operasi massal.
          </p>
        </div>

        {/* Recalculate card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Recalculate Developer Levels
            </CardTitle>
            <CardDescription className="text-xs leading-snug">
              Evaluasi ulang level semua user berdasarkan parameter{' '}
              <span className="font-mono">minimum_buyback_pct</span> dan{' '}
              <span className="font-mono">minimum_soldNfts_top_developer</span> yang aktif saat ini.
              Berguna setelah mengubah parameter di halaman{' '}
              <Link href="/parameters" className="underline underline-offset-2">
                Parameters
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleRecalculate}
              disabled={running}
              size="sm"
              className="gap-2"
            >
              {running
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCcw className="h-4 w-4" />}
              {running ? 'Memproses...' : 'Jalankan'}
            </Button>

            {/* Progress */}
            {running && progress && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Memproses {progress.current} dari {progress.total} user...
                </p>
                <Progress value={pct} className="h-1.5" />
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Result */}
            {result && !running && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-semibold">
                  Selesai — {result.total} user dievaluasi
                </p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md border bg-background p-3 space-y-1">
                    <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                      <ArrowUpRight className="h-4 w-4" />
                      <span className="text-xl font-bold">{result.upgraded}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight">
                      naik ke<br />top_developer
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3 space-y-1">
                    <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                      <ArrowDownRight className="h-4 w-4" />
                      <span className="text-xl font-bold">{result.downgraded}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight">
                      turun ke<br />developer_biasa
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3 space-y-1">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Minus className="h-4 w-4" />
                      <span className="text-xl font-bold">{result.unchanged}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-tight">
                      tidak<br />berubah
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Link ke admin reports */}
        <Link
          href="/admin/reports"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Flag className="h-4 w-4" />
          Komentar Terlaporkan
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </MainLayout>
  );
}
