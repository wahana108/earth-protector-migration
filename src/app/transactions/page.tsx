'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeftRight, ShoppingBag, RefreshCcw, ExternalLink, Receipt, TriangleAlert, Loader2, Undo2 } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchTransactionsByUser,
  fetchNftById,
  fetchTransactionById,
  fetchUserById,
  createReport,
  refundTransaction,
  fetchAllReports,
  resolveReport,
} from '@/lib/firestore';
import type { Transaction, NFT, Report, User } from '@/lib/types';

type TransactionWithNft = {
  tx: Transaction;
  nft: NFT | null;
};

type ReportWithMeta = {
  report: Report;
  tx: Transaction | null;
  nft: NFT | null;
  reporter: User | null;
};

const TYPE_CONFIG: Record<'purchase' | 'buyback', { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' }> = {
  purchase: { label: 'Purchase', icon: <ShoppingBag className="h-3 w-3" />, variant: 'default' },
  buyback:  { label: 'Buyback',  icon: <RefreshCcw className="h-3 w-3" />, variant: 'secondary' },
};

const TYPE_CONFIG_EXTENDED: Partial<Record<Transaction['type'], { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' | 'destructive' }>> = {
  refund: { label: 'Refund', icon: <Undo2 className="h-3 w-3" />, variant: 'destructive' },
};

function TxRow({ item, userId, isAdmin, onRefundDone }: { item: TransactionWithNft; userId: string; isAdmin: boolean; onRefundDone: () => void }) {
  const { tx, nft } = item;
  const cfg = TYPE_CONFIG_EXTENDED[tx.type] ?? TYPE_CONFIG[tx.type as 'purchase' | 'buyback'];
  const role = tx.buyerId === userId ? 'Buyer' : 'Seller';

  const handleRefund = async () => {
    if (!window.confirm(`Refund this transaction and return the NFT to the original seller?`)) return;
    setRefunding(true);
    try { await refundTransaction(tx.id); onRefundDone(); } finally { setRefunding(false); }
  };

  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const handleReport = async () => {
    if (!reason.trim() || reporting) return;
    setReporting(true);
    try {
      await createReport(tx.id, userId, reason.trim());
      setReported(true);
      setReportOpen(false);
      setReason('');
    } finally {
      setReporting(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={cfg.variant} className="gap-1 text-xs">
                {cfg.icon}{cfg.label}
              </Badge>
              <Badge variant="outline" className="text-xs">{role}</Badge>
              {reported && (
                <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/40">
                  Reported
                </Badge>
              )}
            </div>
            <p className="font-medium truncate">
              {nft ? (
                <Link href={`/nft/${nft.id}`} className="hover:text-primary transition-colors">
                  {nft.title}
                </Link>
              ) : tx.nftId}
            </p>
            {tx.description && (
              <p className="text-xs text-muted-foreground truncate">{tx.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {tx.proofLink && (
              <a href={tx.proofLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline text-xs">
                <ExternalLink className="h-3 w-3" /> View Proof
              </a>
            )}
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {format(tx.createdAt, 'dd MMM yyyy')}
            </span>
            {!reported && (
              <button
                title="Report anomaly"
                onClick={() => setReportOpen(true)}
                className="text-muted-foreground hover:text-yellow-500 transition-colors p-1 rounded"
              >
                <TriangleAlert className="h-4 w-4" />
              </button>
            )}
            {isAdmin && tx.type === 'purchase' && (
              <button
                title="Admin refund"
                disabled={refunding}
                onClick={handleRefund}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded disabled:opacity-50"
              >
                {refunding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={reportOpen} onOpenChange={open => { if (!reporting) setReportOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-yellow-500" />
              Report Anomaly
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Describe why this transaction looks suspicious. The admin will review your report.
            </p>
            <div className="space-y-2">
              <Label htmlFor={`reason-${tx.id}`}>Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id={`reason-${tx.id}`}
                placeholder="e.g. Proof link is invalid, price mismatch, duplicate transaction..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                disabled={reporting}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReportOpen(false)} disabled={reporting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReport}
              disabled={!reason.trim() || reporting}
              className="gap-2"
            >
              {reporting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const REPORT_STATUS_STYLES: Record<Report['status'], string> = {
  pending:   'text-yellow-600 border-yellow-500/40 bg-yellow-500/10',
  upheld:    'text-green-600 border-green-500/40 bg-green-500/10',
  dismissed: 'text-muted-foreground border-border bg-muted/40',
};

function ReportCard({ item, adminId, onResolved }: { item: ReportWithMeta; adminId: string; onResolved: () => void }) {
  const { report, tx, nft, reporter } = item;
  const [upholding, setUpholding] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleUphold = async () => {
    if (!window.confirm('Uphold this report? The transaction will be refunded.')) return;
    setUpholding(true);
    setErr(null);
    try {
      if (tx) await refundTransaction(report.transactionId);
      await resolveReport(report.id, 'upheld', adminId);
      onResolved();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to uphold report.');
    } finally {
      setUpholding(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    setErr(null);
    try {
      await resolveReport(report.id, 'dismissed', adminId);
      onResolved();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to dismiss report.');
    } finally {
      setDismissing(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium truncate">
              {nft ? (
                <Link href={`/nft/${nft.id}`} className="hover:text-primary transition-colors">{nft.title}</Link>
              ) : report.transactionId}
            </p>
            <p className="text-xs text-muted-foreground">
              by {reporter?.displayName || report.userId} · {format(report.createdAt, 'dd MMM yyyy')}
            </p>
          </div>
          <Badge variant="outline" className={`text-xs flex-shrink-0 ${REPORT_STATUS_STYLES[report.status]}`}>
            {report.status}
          </Badge>
        </div>

        <p className="text-sm bg-muted/40 rounded p-2 text-muted-foreground leading-relaxed">{report.reason}</p>

        {tx?.proofLink && (
          <a href={tx.proofLink} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline text-xs">
            <ExternalLink className="h-3 w-3" /> View transaction proof
          </a>
        )}

        {err && <p className="text-xs text-destructive">{err}</p>}

        {report.status === 'pending' && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="destructive" className="gap-1.5" disabled={upholding || dismissing} onClick={handleUphold}>
              {upholding && <Loader2 className="h-3 w-3 animate-spin" />}
              Uphold (Refund)
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={upholding || dismissing} onClick={handleDismiss}>
              {dismissing && <Loader2 className="h-3 w-3 animate-spin" />}
              Dismiss
            </Button>
          </div>
        )}
        {report.status !== 'pending' && report.resolvedAt && (
          <p className="text-xs text-muted-foreground">
            Resolved {format(report.resolvedAt, 'dd MMM yyyy')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyTransactions() {
  return (
    <div className="text-center py-20 border-2 border-dashed rounded-lg">
      <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-1">No transactions yet</h3>
      <p className="text-muted-foreground text-sm">Your purchase and buyback history will appear here.</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-4 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const ADMIN_EMAIL = 'ramawan@live.com';

export default function TransactionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const [items, setItems] = useState<TransactionWithNft[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportItems, setReportItems] = useState<ReportWithMeta[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const txs = await fetchTransactionsByUser(user.id);
      const enriched = await Promise.all(
        txs.map(async tx => ({ tx, nft: await fetchNftById(tx.nftId) }))
      );
      setItems(enriched);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadReports = useCallback(async () => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    setLoadingReports(true);
    try {
      const reports = await fetchAllReports();
      const enriched = await Promise.all(
        reports.map(async (report) => {
          const tx = await fetchTransactionById(report.transactionId);
          const [nft, reporter] = await Promise.all([
            tx ? fetchNftById(tx.nftId) : Promise.resolve(null),
            fetchUserById(report.userId),
          ]);
          return { report, tx, nft, reporter };
        })
      );
      setReportItems(enriched);
    } finally {
      setLoadingReports(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    loadReports();
  }, [load, loadReports]);

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-muted-foreground mb-4">Sign in to view your transactions.</p>
          <Button asChild><Link href="/login">Sign In</Link></Button>
        </div>
      </MainLayout>
    );
  }

  const purchases = items.filter(i => i.tx.type === 'purchase');
  const buybacks  = items.filter(i => i.tx.type === 'buyback');

  return (
    <MainLayout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">Transactions</h1>
          <p className="text-muted-foreground">
            History of all your purchases and buybacks.
          </p>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              All {!loading && `(${items.length})`}
            </TabsTrigger>
            <TabsTrigger value="purchases">
              Purchases {!loading && `(${purchases.length})`}
            </TabsTrigger>
            <TabsTrigger value="buybacks">
              Buybacks {!loading && `(${buybacks.length})`}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="reports">
                Reports {!loadingReports && reportItems.length > 0 && `(${reportItems.filter(r => r.report.status === 'pending').length} pending)`}
              </TabsTrigger>
            )}
          </TabsList>

          {loading ? (
            <div className="mt-6"><LoadingSkeleton /></div>
          ) : (
            <>
              <TabsContent value="all" className="mt-6">
                {items.length === 0 ? <EmptyTransactions /> : (
                  <div className="space-y-3">
                    {items.map(item => (
                      <TxRow key={item.tx.id} item={item} userId={user.id} isAdmin={isAdmin} onRefundDone={load} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="purchases" className="mt-6">
                {purchases.length === 0 ? <EmptyTransactions /> : (
                  <div className="space-y-3">
                    {purchases.map(item => (
                      <TxRow key={item.tx.id} item={item} userId={user.id} isAdmin={isAdmin} onRefundDone={load} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="buybacks" className="mt-6">
                {buybacks.length === 0 ? <EmptyTransactions /> : (
                  <div className="space-y-3">
                    {buybacks.map(item => (
                      <TxRow key={item.tx.id} item={item} userId={user.id} isAdmin={isAdmin} onRefundDone={load} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {isAdmin && (
                <TabsContent value="reports" className="mt-6">
                  {loadingReports ? (
                    <LoadingSkeleton />
                  ) : reportItems.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed rounded-lg">
                      <TriangleAlert className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-1">No reports</h3>
                      <p className="text-muted-foreground text-sm">No anomaly reports from users.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reportItems.map(item => (
                        <ReportCard
                          key={item.report.id}
                          item={item}
                          adminId={user.id}
                          onResolved={() => { load(); loadReports(); }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              )}
            </>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
