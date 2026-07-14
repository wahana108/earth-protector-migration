import Link from 'next/link';
import { ExternalLink, Github } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const GITHUB_PLATFORM = 'https://github.com/wahana108/earth-protector-migration';
const GITHUB_INSTANCES = 'https://github.com/wahana108/earth-nft-instances';
const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? '';

export default function HelpPage() {
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8 pb-12">

        <div>
          <h1 className="text-3xl font-bold mb-1">Bantuan</h1>
          <p className="text-muted-foreground">Panduan platform dan tanya jawab umum</p>
        </div>

        {/* ── Tentang Platform ── */}
        <Card>
          <CardHeader>
            <CardTitle>Tentang Platform</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <p>
              <strong>The Mother Earth Project (TMEP)</strong> adalah platform komunitas untuk
              mengabadikan tindakan nyata charity melalui sistem NFT berbasis konsensus.
              Nilai berasal dari tindakan nyata yang dapat diverifikasi — bukan spekulasi aset digital.
            </p>
            <p>
              Setiap NFT merepresentasikan satu unit kontribusi dari sebuah project lingkungan,
              sosial, atau energi. Komunitas memvalidasi keaslian project secara kolektif melalui
              mekanisme Pool Rekomendasi dan validasi bergulir.
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <a
                href={GITHUB_PLATFORM}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Github className="h-4 w-4 shrink-0" />
                Source code platform — wahana108/earth-protector-migration
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              <a
                href={GITHUB_INSTANCES}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Github className="h-4 w-4 shrink-0" />
                Registry komunitas — wahana108/earth-nft-instances
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* ── Daftarkan Komunitas ── */}
        <Card>
          <CardHeader>
            <CardTitle>Cara Mendaftarkan Komunitas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed space-y-4">
            <p>
              Setiap instansi platform yang berjalan di domain berbeda dapat didaftarkan
              sebagai komunitas resmi di{' '}
              <Link href="/instances" className="text-primary hover:underline">
                halaman Komunitas
              </Link>
              .
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">Fork repo instances</span>
                {' '}di{' '}
                <a
                  href={GITHUB_INSTANCES}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  wahana108/earth-nft-instances
                  <ExternalLink className="h-3 w-3 inline ml-0.5" />
                </a>
              </li>
              <li>
                <span className="text-foreground font-medium">Tambahkan entri komunitas Anda</span>
                {' '}ke file <code className="bg-muted px-1 rounded text-xs">instances.json</code>{' '}
                dengan field: <code className="bg-muted px-1 rounded text-xs">name</code>,{' '}
                <code className="bg-muted px-1 rounded text-xs">url</code>,{' '}
                <code className="bg-muted px-1 rounded text-xs">version</code>,{' '}
                <code className="bg-muted px-1 rounded text-xs">admin</code>,{' '}
                <code className="bg-muted px-1 rounded text-xs">region</code>,{' '}
                <code className="bg-muted px-1 rounded text-xs">registered_at</code>
              </li>
              <li>
                <span className="text-foreground font-medium">Buat Pull Request</span>
                {' '}ke repo utama — tim akan mereview dan merge
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* ── Q&A ── */}
        <Card>
          <CardHeader>
            <CardTitle>Q&amp;A Umum</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">

              <AccordionItem value="nft">
                <AccordionTrigger className="text-sm text-left">
                  Apa itu NFT di platform ini?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  NFT di TMEP adalah sertifikat digital yang merepresentasikan tindakan charity
                  nyata. Setiap unit NFT terikat pada satu project yang bisa diverifikasi buktinya.
                  Nilainya berasal dari kontribusi nyata, bukan spekulasi pasar.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="beli">
                <AccordionTrigger className="text-sm text-left">
                  Bagaimana cara membeli NFT?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Buka halaman{' '}
                  <Link href="/explore" className="text-primary hover:underline">/explore</Link>,
                  pilih NFT yang tersedia, klik tombol <strong>Beli</strong>, dan konfirmasi
                  transaksi. Poin akan masuk ke neraca Anda setelah seller mengkonfirmasi
                  atau setelah periode auto-complete berakhir.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="validasi">
                <AccordionTrigger className="text-sm text-left">
                  Apa itu validasi?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Validasi adalah proses komunitas mengakui keaslian sebuah project. Top Developer
                  yang memegang NFT dari suatu project dapat memvalidasinya melalui halaman{' '}
                  <Link href="/validate" className="text-primary hover:underline">/validate</Link>.
                  NFT yang tervalidasi meningkatkan kepercayaan komunitas terhadap project tersebut.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pool">
                <AccordionTrigger className="text-sm text-left">
                  Apa itu Pool Rekomendasi?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Pool Rekomendasi adalah antrian likuiditas berurutan (FIFO) untuk Top Developer.
                  NFT dalam pool mendapat prioritas ditampilkan kepada pembeli. Kapasitas pool
                  ditentukan oleh jumlah Top Developer aktif dikalikan 3.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="top-developer">
                <AccordionTrigger className="text-sm text-left">
                  Bagaimana cara menjadi Top Developer?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Penuhi dua syarat berdasarkan parameter komunitas: (1) jumlah NFT terjual
                  mencapai minimum yang ditetapkan, dan (2) persentase buyback terhadap penjualan
                  memenuhi threshold minimum. Cek parameter aktif di halaman{' '}
                  <Link href="/parameters" className="text-primary hover:underline">/parameters</Link>.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="fork">
                <AccordionTrigger className="text-sm text-left">
                  Bagaimana cara fork platform ini?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
                  <p>Platform ini open source dan dapat di-fork untuk komunitas baru:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Fork repo di{' '}
                      <a href={GITHUB_PLATFORM} target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline">
                        wahana108/earth-protector-migration
                        <ExternalLink className="h-3 w-3 inline ml-0.5" />
                      </a>
                    </li>
                    <li>Setup Firebase project baru (Firestore + Auth)</li>
                    <li>Isi environment variables di <code className="bg-muted px-1 rounded text-xs">.env.local</code> (lihat <code className="bg-muted px-1 rounded text-xs">.env.example</code>)</li>
                    <li>Set <code className="bg-muted px-1 rounded text-xs">NEXT_PUBLIC_SUPER_ADMIN_EMAIL</code> dengan email admin Anda</li>
                    <li>Deploy ke Vercel</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="daftar-komunitas">
                <AccordionTrigger className="text-sm text-left">
                  Bagaimana cara mendaftarkan komunitas baru?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Buat Pull Request ke instances registry:{' '}
                  <a
                    href={GITHUB_INSTANCES}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    wahana108/earth-nft-instances
                    <ExternalLink className="h-3 w-3 inline ml-0.5" />
                  </a>
                  . Tambahkan data komunitas Anda ke{' '}
                  <code className="bg-muted px-1 rounded text-xs">instances.json</code>{' '}
                  dan buat PR — lihat panduan lengkap di bagian &ldquo;Cara Mendaftarkan Komunitas&rdquo; di atas.
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </CardContent>
        </Card>

        {/* ── Panduan Transaksi Sehat ── */}
        <Card>
          <CardHeader>
            <CardTitle>Panduan Transaksi Sehat (Tata Kelola AI)</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">

              <AccordionItem value="cara-menilai">
                <AccordionTrigger className="text-sm text-left">
                  Bagaimana sistem menilai transaksi saya?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Saat tata kelola AI aktif, log transaksi developer papan atas dinilai berkala
                  untuk mendeteksi anomali. Penilaian berdasarkan POLA perilaku dari log publik —
                  bukan identitas, bukan isi tulisan. Developer tanpa aktivitas dinilai bersih
                  (skor 0).
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pola-sehat">
                <AccordionTrigger className="text-sm text-left">
                  Pola apa yang dinilai SEHAT?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Bertransaksi dengan banyak pihak berbeda (counterparty beragam)</li>
                    <li>Jeda waktu wajar antar transaksi</li>
                    <li>Buyback proporsional dari pembeli asli</li>
                    <li>Menyertakan link bukti dan keterangan transaksi</li>
                    <li>Aktivitas mencerminkan tindakan charity nyata</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pola-anomali">
                <AccordionTrigger className="text-sm text-left">
                  Pola apa yang berpotensi dinilai ANOMALI?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      Transaksi berulang dua arah dengan pihak yang sama (jual ke X berulang DAN
                      buyback dari X berulang — indikasi self-dealing)
                    </li>
                    <li>Banyak transaksi dalam waktu sangat singkat</li>
                    <li>Membeli/memvalidasi project sendiri lewat akun lain</li>
                    <li>Transaksi bernilai besar tanpa bukti</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="akibat-anomali">
                <AccordionTrigger className="text-sm text-left">
                  Apa akibat dinilai anomali?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Skor anomali menghasilkan pengurangan poin neraca proporsional (dengan bukti
                  yang dirujuk dalam alasan). Neraca negatif menurunkan buyback efektif — dapat
                  menurunkan peringkat. Nilai yang dipotong masuk ke kas sistem secara transparan
                  (lihat halaman{' '}
                  <Link href="/infrastructure" className="text-primary hover:underline">
                    Dana Sistem
                  </Link>
                  ) — tidak ada nilai yang hilang.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="penilaian-keliru">
                <AccordionTrigger className="text-sm text-left">
                  Bagaimana jika saya merasa penilaian keliru?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Setiap penilaian memiliki masa tenggang. Hubungi administrator dengan bukti
                  kronologi transaksi Anda. Di pengembangan mendatang, tersedia mekanisme
                  klarifikasi yang dinilai ulang otomatis pada siklus berikutnya.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="lencana-kontributor">
                <AccordionTrigger className="text-sm text-left">
                  Apa itu lencana kontributor?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  Lencana (badge) diberikan kepada anggota yang terbukti membayar biaya
                  infrastruktur nyata platform. Ajukan klaim dengan bukti di halaman{' '}
                  <Link href="/infrastructure" className="text-primary hover:underline">
                    Dana Sistem
                  </Link>
                  {' '}— setelah diverifikasi, Anda menerima poin kontribusi dan lencana yang
                  tampil di profil serta karya Anda.
                </AccordionContent>
              </AccordionItem>

            </Accordion>
            <p className="text-xs text-muted-foreground/80 leading-relaxed pt-4 mt-4 border-t">
              Panduan ini transparan agar setiap anggota memahami cara menjaga reputasi
              transaksinya. Sistem menilai perilaku berdasarkan bukti, bukan menghukum kesalahan
              jujur.
            </p>
          </CardContent>
        </Card>

        {/* ── Credits ── */}
        <Card>
          <CardHeader>
            <CardTitle>Credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Dibangun dengan</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>Next.js — React Framework</li>
                <li>Firebase — Backend &amp; Database</li>
                <li>Vercel — Hosting</li>
                <li>Tailwind CSS + shadcn/ui — UI Components</li>
                <li>Claude AI by Anthropic — AI Development Assistant</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Ekosistem</h3>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <a
                    href={GITHUB_PLATFORM}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    GitHub — Open Source Repository
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={GITHUB_INSTANCES}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    earth-nft-instances — Community Registry
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              </ul>
            </div>

            {SUPER_ADMIN_EMAIL && (
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Visi Pengembang</h3>
                <p className="text-muted-foreground/80 text-xs">{SUPER_ADMIN_EMAIL}</p>
                <blockquote className="border-l-2 border-primary pl-3 text-muted-foreground leading-relaxed italic">
                  &ldquo;Platform ini adalah lapisan media sosial yang mengindex tindakan charity.
                  Visi jangka panjang adalah sistem otonom berbasis konsensus komunitas dengan
                  tata kelola AI dan arsitektur yang mendekati DAPP.&rdquo;
                </blockquote>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Roadmap</h3>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold shrink-0">✓</span>
                  <span>Fase 1–2: Fondasi, keamanan, dan mekanisme konsensus komunitas (selesai)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">→</span>
                  <span>Fase 3: FIFO Validation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">→</span>
                  <span>Fase Advance: Fibonacci Capacity + AI Anomali</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold shrink-0">→</span>
                  <span>Fase Otonom: Near-DAPP Architecture</span>
                </li>
              </ul>
            </div>

          </CardContent>
        </Card>

      </div>
    </MainLayout>
  );
}
