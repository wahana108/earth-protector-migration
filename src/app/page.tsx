import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { SITE_URL } from '@/lib/site-config';
import { HomeClient } from './home-client';

export const metadata: Metadata = {
  title: {
    absolute: 'The Mother Earth Project (TMEP) — Kredit Sosial dari Tindakan Charity Nyata',
  },
  description:
    'TMEP mengubah tindakan charity nyata menjadi kredit sosial yang tercatat lewat NFT — sertifikat pengakuan komunitas, bukan aset spekulatif. Dijaga oleh buyback, validasi konsensus, dan tata kelola AI.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'The Mother Earth Project (TMEP)',
    description:
      'Kredit sosial dari tindakan charity nyata — NFT sebagai sertifikat pengakuan yang nilainya dijaga komunitas, bukan marketplace spekulatif.',
    url: SITE_URL,
    type: 'website',
  },
};

// ─── Halaman ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <MainLayout>
      <div className="flex flex-col gap-16">

        <HomeClient />

        {/* ── Intro statis (server-rendered, selalu ada di HTML awal) ── */}
        <section className="max-w-3xl mx-auto text-center space-y-4 pt-4">
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-[#0f5c56]">
            Kredit Sosial dari Tindakan Charity Nyata
          </h1>
          <p className="text-[#35433f] leading-relaxed">
            The Mother Earth Project (TMEP) mengubah aksi charity nyata — tanam pohon,
            bersihkan laut, lindungi satwa — menjadi{' '}
            <strong className="text-[#1f7a72]">kredit sosial</strong> yang tercatat lewat NFT.
            Bukan marketplace spekulatif: setiap NFT adalah sertifikat pengakuan atas
            kontribusi yang bisa diverifikasi, dan nilainya dijaga bersama lewat mekanisme
            buyback serta kepercayaan publik komunitas — bukan oleh admin atau penerbit.
          </p>
          <p className="text-[#35433f] leading-relaxed">
            Peringkat Top Developer adalah manifestasi{' '}
            <strong className="text-[#1f7a72]">kehendak kolektif komunitas</strong>, dan
            setiap project divalidasi lewat{' '}
            <strong className="text-[#1f7a72]">konsensus bersama</strong> — bukan keputusan
            sepihak. Semuanya diatur oleh algoritma transparan berpola Fibonacci dan lapisan
            tata kelola AI yang membaca pola perilaku, bukan menghakimi identitas.
          </p>
          <p className="text-[#35433f] leading-relaxed">
            Ini adalah eksperimen terbuka menuju sistem reputasi komunitas yang berjalan
            sendiri — kode <strong className="text-[#1f7a72]">sumber terbuka</strong>, setiap
            keputusan tercatat di log publik.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-2">
            <Button asChild size="lg">
              <Link href="/help">
                Baca Manifesto Lengkap
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/instances">Lihat Komunitas</Link>
            </Button>
          </div>
        </section>

      </div>
    </MainLayout>
  );
}
