import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/use-auth';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { SITE_URL, SITE_NAME } from '@/lib/site-config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Inspira Better World — Open Charity Action Index',
    template: '%s · Inspira Better World',
  },
  description:
    'Inspira Better World: NFT certificates for real-world good deeds. Sebuah charity action index terbuka berbasis community consensus dan AI governance — kredit sosial dari tindakan charity nyata, bukan aset spekulatif.',
  icons: {
    icon: '/tmep-logo.svg',
    shortcut: '/tmep-logo.svg',
  },
  openGraph: {
    title: 'Inspira Better World — Open Charity Action Index',
    description:
      'Inspira Better World: NFT certificates for real-world good deeds. Sebuah charity action index terbuka berbasis community consensus dan AI governance — kredit sosial dari tindakan charity nyata, bukan aset spekulatif.',
    siteName: SITE_NAME,
    type: 'website',
  },
  verification: {
    google: '9GhTNgBH_P5MQtM0cAL5znFaOMepDVOd0jyAjOWJuxs',
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
