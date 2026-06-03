'use client';
import React from 'react';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import { AppHeader } from './header';
import { SidebarNav } from './sidebar-nav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { MailWarning, ShoppingBag, RefreshCcw, X } from 'lucide-react';
import Link from 'next/link';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(!isMobile);
  const { firebaseUser, user, emailVerified, resendVerificationEmail, loading } = useAuth();
  const [resent, setResent] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [purchaseBannerDismissed, setPurchaseBannerDismissed] = React.useState(false);
  const [buybackBannerDismissed, setBuybackBannerDismissed] = React.useState(false);

  React.useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  const showBanner = !loading && !!firebaseUser && !emailVerified && !dismissed;
  const pendingPurchaseActions = user?.pending_seller_actions ?? 0;
  const pendingBuybackActions = user?.pending_buyback_actions ?? 0;
  const showPurchaseBanner = !loading && !!user && pendingPurchaseActions > 0 && !purchaseBannerDismissed;
  const showBuybackBanner = !loading && !!user && pendingBuybackActions > 0 && !buybackBannerDismissed;

  async function handleResend() {
    try {
      await resendVerificationEmail();
      setResent(true);
    } catch {
      // gagal kirim ulang — biarkan user coba lagi
    }
  }

  return (
    <SidebarProvider defaultOpen={true} open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex">
        <Sidebar>
          <SidebarNav />
        </Sidebar>
        <div className="flex flex-col flex-1 min-w-0">
          <AppHeader />

          {/* Banner penjualan tertunda */}
          {showPurchaseBanner && (
            <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-3 text-sm text-orange-800">
              <ShoppingBag className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                Ada {pendingPurchaseActions} penjualan menunggu konfirmasimu.
              </span>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="border-orange-400 text-orange-800 hover:bg-orange-100 h-7 text-xs shrink-0"
              >
                <Link href="/purchase-confirmations">Tinjau →</Link>
              </Button>
              <button
                onClick={() => setPurchaseBannerDismissed(true)}
                className="text-orange-600 hover:text-orange-900 shrink-0"
                aria-label="Tutup banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Banner buyback request tertunda */}
          {showBuybackBanner && (
            <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-3 text-sm text-orange-800">
              <RefreshCcw className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                Ada {pendingBuybackActions} permintaan buyback menunggu responmu.
              </span>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="border-orange-400 text-orange-800 hover:bg-orange-100 h-7 text-xs shrink-0"
              >
                <Link href="/buyback-requests">Tinjau →</Link>
              </Button>
              <button
                onClick={() => setBuybackBannerDismissed(true)}
                className="text-orange-600 hover:text-orange-900 shrink-0"
                aria-label="Tutup banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Banner verifikasi email */}
          {showBanner && (
            <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-3 text-sm text-yellow-800">
              <MailWarning className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                {resent
                  ? 'Email verifikasi sudah dikirim ulang. Cek inbox Anda.'
                  : 'Email Anda belum diverifikasi. Verifikasi diperlukan sebelum melakukan transaksi.'}
              </span>
              {!resent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResend}
                  className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 h-7 text-xs shrink-0"
                >
                  Kirim Ulang
                </Button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="text-yellow-600 hover:text-yellow-900 shrink-0"
                aria-label="Tutup banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
