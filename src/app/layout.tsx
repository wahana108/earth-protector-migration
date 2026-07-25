import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/use-auth';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { SITE_URL, SITE_NAME } from '@/lib/site-config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'The Mother Earth Project (TMEP)',
    template: '%s · TMEP',
  },
  description:
    'Eksperimen terbuka menghasilkan kredit sosial dari tindakan charity nyata — NFT sebagai sertifikat pengakuan yang nilainya dijaga komunitas.',
  icons: {
    icon: '/tmep-logo.svg',
    shortcut: '/tmep-logo.svg',
  },
  openGraph: {
    title: 'The Mother Earth Project (TMEP)',
    description:
      'Eksperimen terbuka menghasilkan kredit sosial dari tindakan charity nyata — NFT sebagai sertifikat pengakuan yang nilainya dijaga komunitas.',
    siteName: SITE_NAME,
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-body antialiased'
        )}
      >
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
