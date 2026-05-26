'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeftRight, ShoppingBag, RefreshCcw, ExternalLink, Receipt } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { fetchTransactionsByUser, fetchNftById } from '@/lib/firestore';
import type { Transaction, NFT } from '@/lib/types';

type TransactionWithNft = {
  tx: Transaction;
  nft: NFT | null;
};

const TYPE_CONFIG: Record<Transaction['type'], { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' }> = {
  purchase: { label: 'Purchase', icon: <ShoppingBag className="h-3 w-3" />, variant: 'default' },
  buyback:  { label: 'Buyback',  icon: <RefreshCcw className="h-3 w-3" />, variant: 'secondary' },
};

function TxRow({ item, userId }: { item: TransactionWithNft; userId: string }) {
  const { tx, nft } = item;
  const cfg = TYPE_CONFIG[tx.type];
  const role = tx.buyerId === userId ? 'Buyer' : 'Seller';

  return (
    <Card>
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={cfg.variant} className="gap-1 text-xs">
              {cfg.icon}{cfg.label}
            </Badge>
            <Badge variant="outline" className="text-xs">{role}</Badge>
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

        <div className="flex items-center gap-4 flex-shrink-0 text-sm">
          {tx.proofLink && (
            <a href={tx.proofLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline text-xs">
              <ExternalLink className="h-3 w-3" /> Proof
            </a>
          )}
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {format(tx.createdAt, 'dd MMM yyyy')}
          </span>
        </div>
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

export default function TransactionsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<TransactionWithNft[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { load(); }, [load]);

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
          </TabsList>

          {loading ? (
            <div className="mt-6"><LoadingSkeleton /></div>
          ) : (
            <>
              <TabsContent value="all" className="mt-6">
                {items.length === 0 ? <EmptyTransactions /> : (
                  <div className="space-y-3">
                    {items.map(item => (
                      <TxRow key={item.tx.id} item={item} userId={user.id} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="purchases" className="mt-6">
                {purchases.length === 0 ? <EmptyTransactions /> : (
                  <div className="space-y-3">
                    {purchases.map(item => (
                      <TxRow key={item.tx.id} item={item} userId={user.id} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="buybacks" className="mt-6">
                {buybacks.length === 0 ? <EmptyTransactions /> : (
                  <div className="space-y-3">
                    {buybacks.map(item => (
                      <TxRow key={item.tx.id} item={item} userId={user.id} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
