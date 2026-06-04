'use client';
import React from 'react';
import { SidebarProvider, Sidebar } from '@/components/ui/sidebar';
import { AppHeader } from './header';
import { SidebarNav } from './sidebar-nav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { MailWarning, ShoppingBag, RefreshCcw, X, Github, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const GITHUB_PLATFORM = 'https://github.com/wahana108/earth-protector-migration';
const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? '';

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

          <footer className="border-t bg-muted/20 px-6 py-6 text-xs text-muted-foreground">
            <div className="max-w-2xl mx-auto flex flex-col items-center gap-3 text-center">
              <div>
                <span className="text-sm font-medium text-foreground">🌿 The Mother Earth Project</span>
                <p className="mt-0.5">Platform NFT Charity Open Source</p>
              </div>
              <p className="text-muted-foreground/70">Built with Next.js · Firebase · Vercel</p>
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <a
                  href={GITHUB_PLATFORM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <Github className="h-3 w-3" />
                  GitHub
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <Link href="/instances" className="hover:text-foreground transition-colors">
                  Komunitas
                </Link>
                <Link href="/help" className="hover:text-foreground transition-colors">
                  Bantuan
                </Link>
              </div>
              <p className="text-muted-foreground/60">Open Source · MIT License</p>
              {SUPER_ADMIN_EMAIL && (
                <p className="text-muted-foreground/60">Vision by {SUPER_ADMIN_EMAIL}</p>
              )}
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
