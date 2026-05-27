'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { RefreshCcw, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchBuybackRequestsByVendor,
  fetchBuybackRequestsByBuyer,
  confirmBuybackRequest,
  rejectBuybackRequest,
  completeBuybackRequest,
  fetchNftById,
  fetchUserById,
} from '@/lib/firestore';
import type { BuybackRequest, NFT, User } from '@/lib/types';

type RequestWithMeta = {
  req: BuybackRequest;
  nft: NFT | null;
  otherParty: User | null;
};

const STATUS_CONFIG: Record<BuybackRequest['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   variant: 'secondary',  icon: <Clock className="h-3 w-3" /> },
  confirmed: { label: 'Confirmed', variant: 'default',    icon: <CheckCircle className="h-3 w-3" /> },
  rejected:  { label: 'Rejected',  variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
  completed: { label: 'Completed', variant: 'outline',    icon: <CheckCircle className="h-3 w-3" /> },
};

function RequestCard({
  item,
  role,
  onAction,
}: {
  item: RequestWithMeta;
  role: 'vendor' | 'buyer';
  onAction: () => void;
}) {
  const { req, nft, otherParty } = item;
  const [proofUrl, setProofUrl] = useState('');
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const cfg = STATUS_CONFIG[req.status];

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); onAction(); } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle className="text-base truncate">
            {nft ? (
              <Link href={`/nft/${nft.id}`} className="hover:text-primary transition-colors">
                {nft.title}
              </Link>
            ) : req.nftId}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {role === 'vendor' ? 'Current owner: ' : 'Requested by: '}
            <span className="font-medium">{otherParty?.displayName || 'Unknown'}</span>
          </p>
        </div>
        <Badge variant={cfg.variant} className="gap-1 flex-shrink-0 text-xs">
          {cfg.icon}{cfg.label}
        </Badge>
      </CardHeader>

      <CardContent className="pb-2 text-sm text-muted-foreground">
        <p>Requested: {format(req.createdAt, 'dd MMM yyyy')}</p>
        {req.proofUrl && (
          <a href={req.proofUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline mt-1">
            <ExternalLink className="h-3 w-3" /> View proof
          </a>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {/* Vendor actions */}
        {role === 'vendor' && req.status === 'pending' && (
          <>
            {showConfirmForm ? (
              <div className="w-full space-y-2">
                <Label htmlFor={`proof-${req.id}`} className="text-xs">Proof URL (payment / transfer)</Label>
                <Input
                  id={`proof-${req.id}`}
                  placeholder="https://..."
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy || !proofUrl}
                    onClick={() => act(() => confirmBuybackRequest(req.id, proofUrl))}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowConfirmForm(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <Button size="sm" className="gap-1" onClick={() => setShowConfirmForm(true)}>
                  <CheckCircle className="h-4 w-4" /> Confirm
                </Button>
                <Button size="sm" variant="destructive" className="gap-1" disabled={busy}
                  onClick={() => act(() => rejectBuybackRequest(req.id))}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </>
            )}
          </>
        )}

        {/* Buyer actions */}
        {role === 'buyer' && req.status === 'confirmed' && (
          <Button size="sm" className="gap-1" disabled={busy}
            onClick={() => act(() => completeBuybackRequest(req.id, req.nftId))}>
            <CheckCircle className="h-4 w-4" /> Mark Complete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function RequestList({ items, role, onAction }: { items: RequestWithMeta[]; role: 'vendor' | 'buyer'; onAction: () => void }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-lg">
        <RefreshCcw className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm">No buyback requests here.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map(item => (
        <RequestCard key={item.req.id} item={item} role={role} onAction={onAction} />
      ))}
    </div>
  );
}

export default function BuybackPage() {
  const { user } = useAuth();
  const [vendorItems, setVendorItems] = useState<RequestWithMeta[]>([]);
  const [buyerItems, setBuyerItems] = useState<RequestWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const enrich = async (reqs: BuybackRequest[], otherPartyField: 'buyerId' | 'vendorId'): Promise<RequestWithMeta[]> =>
    Promise.all(
      reqs.map(async req => {
        const [nft, otherParty] = await Promise.all([
          fetchNftById(req.nftId),
          fetchUserById(req[otherPartyField]),
        ]);
        return { req, nft, otherParty };
      })
    );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [asVendor, asBuyer] = await Promise.all([
        fetchBuybackRequestsByVendor(user.id),
        fetchBuybackRequestsByBuyer(user.id),
      ]);
      const [vItems, bItems] = await Promise.all([
        enrich(asVendor, 'buyerId'),
        enrich(asBuyer, 'vendorId'),
      ]);
      setVendorItems(vItems);
      setBuyerItems(bItems);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-muted-foreground mb-4">Sign in to view buyback requests.</p>
          <Button asChild><Link href="/login">Sign In</Link></Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">Buyback</h1>
          <p className="text-muted-foreground">
            Manage NFT buyback requests — reclaim NFTs you sold or complete incoming requests.
          </p>
        </div>

        <Tabs defaultValue="sent">
          <TabsList>
            <TabsTrigger value="sent">
              As Vendor {!loading && `(${vendorItems.length})`}
            </TabsTrigger>
            <TabsTrigger value="received">
              As Buyer {!loading && `(${buyerItems.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sent" className="mt-6">
            {loading ? <LoadingSkeleton /> : (
              <RequestList items={vendorItems} role="vendor" onAction={load} />
            )}
          </TabsContent>

          <TabsContent value="received" className="mt-6">
            {loading ? <LoadingSkeleton /> : (
              <RequestList items={buyerItems} role="buyer" onAction={load} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
