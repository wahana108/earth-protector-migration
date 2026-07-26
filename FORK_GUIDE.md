# Fork Guide — Inspira Better World

> **English summary:** This guide walks you through standing up your own
> independent "Inspira Better World" community node — a full fork of this
> platform on your own Firebase + Vercel infrastructure, with your own
> currency, admin, and parameters. One node = one independent community
> (no shared backend, no shared funds, no shared admin). Nodes are
> connected only through a public registry (`earth-nft-instances`) that
> lets communities discover each other. All value in the system is
> **symbolic reputation, not money** — the platform never holds financial
> risk. See the numbered steps below (written in Indonesian); commands
> and file names are language-neutral and copy-pasteable regardless of
> which language you read.

---

## 1. Konsep singkat

- **Satu node = satu komunitas independen.** Fork ini bukan multi-tenant
  SaaS — setiap komunitas yang berdiri dari fork ini punya Firebase
  project sendiri, Vercel deployment sendiri, admin sendiri, dan neraca
  poin sendiri. Tidak ada data atau dana yang dibagi antar node.
- **Federasi via registry, bukan backend bersama.** Node-node yang berdiri
  independen dapat saling mengenal lewat registry publik
  [`earth-nft-instances`](https://github.com/wahana108/earth-nft-instances)
  — sebuah file `instances.json` yang didaftar lewat PR (lihat langkah g).
  Halaman `/instances` di setiap node membaca file ini untuk menampilkan
  "Jaringan komunitas".
- **Nilai poin bersifat simbolik, bukan uang.** Neraca user dan pool
  adalah angka reputasi murni. Zero-sum: setiap pemotongan di satu sisi
  = penambahan di sisi lain (lihat prinsip di `CLAUDE.md`). Currency yang
  Anda pilih di langkah f hanya menentukan **label/format tampilan**
  angka tersebut (mis. "$100" vs "Rp100.000") — bukan nilai finansial
  sungguhan yang dipegang platform.

---

## 2. Langkah teknis

### a. Fork repo GitHub

Fork [`wahana108/earth-protector-migration`](https://github.com/wahana108/earth-protector-migration)
ke akun/organisasi GitHub Anda, lalu clone fork Anda secara lokal.

### b. Buat project Firebase baru

1. Buat project baru di [Firebase Console](https://console.firebase.google.com).
2. Aktifkan **Firestore Database** (mode production, pilih lokasi — repo
   ini menggunakan `nam5`, lihat `firebase.json`).
3. Aktifkan **Authentication** dengan dua provider:
   - **Email/Password**
   - **Google**
4. Di Authentication → Templates, pastikan **email verification**
   aktif (default Firebase sudah aktif) — signup di platform ini
   **mensyaratkan** email terverifikasi sebelum dokumen `users/{uid}`
   dibuat (lihat `CLAUDE.md` bagian VERIFIED SIGNUP).
5. Buat **service account key**: Project Settings → Service Accounts →
   *Generate new private key* → simpan file JSON-nya (dipakai di
   langkah c untuk `FIREBASE_SERVICE_ACCOUNT_KEY`).

### c. Salin `.env.example` → isi semua environment variable

```bash
cp .env.example .env.local
```

Isi setiap variabel (kolom "Wajib?" menandai apakah tanpa variabel ini
fitur terkait sama sekali tidak berjalan):

| Variabel | Wajib? | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` | Wajib | Email yang akan otomatis menjadi super admin (isAdmin + isModerator) begitu mendaftar & login dengan email ini — **bukan** dicek dari Firestore, langsung dibandingkan ke variabel ini di client (`src/hooks/use-auth.tsx`). |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Wajib | Dari Firebase Console → Project Settings → General → Your apps (Web app). |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Wajib | idem |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Wajib | idem |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Wajib | idem |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Wajib | idem |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Wajib | idem |
| `RECALC_SECRET` | Opsional | Header rahasia untuk `/api/recalculate` (cron harian recalculate Top Developer). Tanpa ini, Lapis 1 lazy-evaluation tetap jalan otomatis — hanya Lapis 2 (cron) yang tidak aktif. |
| `AI_REVIEW_SECRET` | Opsional | Header rahasia untuk `/api/ai-review-auto` (AI Governance Level 2 otonom). |
| `INFLATION_AUTO_SECRET` | Opsional | Header rahasia untuk `/api/inflation-auto` (cron tahunan info inflasi/deflasi). |
| `GEMINI_API_KEY` | Opsional* | Dari [Google AI Studio](https://aistudio.google.com/app/apikey). Diperlukan HANYA jika mengaktifkan AI Governance/Inflasi mode otonom Level 2. **Catatan penting**: key BARU dari Google saat ini tidak mendapat free tier (limit 0) — gunakan key lama/grandfathered atau siapkan billing. |
| `GEMINI_MODEL` | Opsional | Override model Gemini, format `googleai/nama-model` (default di kode: `googleai/gemini-2.0-flash`). Ganti jika model default tidak tersedia untuk API key Anda. |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Opsional* | base64(JSON) dari service account (langkah b.5). Diperlukan HANYA untuk AI Governance/Inflasi mode otonom Level 2 (Admin SDK dipakai server-to-server tanpa auth user). Encode: `cat service-account.json | base64` (Linux/Mac) atau `[Convert]::ToBase64String([IO.File]::ReadAllBytes('service-account.json'))` (PowerShell). |
| `NEXT_PUBLIC_USE_EMULATOR` | Dev only | `true` HANYA di `.env.local` untuk dev lokal dengan Firebase Emulator. **JANGAN** di-set di Vercel production. |

### d. Deploy `firestore.rules` + `firestore.indexes.json`

```bash
firebase login
firebase use --add   # pilih project Firebase baru Anda
firebase deploy --only firestore
```

Ini men-deploy rules (`firestore.rules`) dan composite index
(`firestore.indexes.json`, 232 baris — dipakai oleh query kategori/harga/
like di `/explore`, `/pool`, dsb.) sekaligus. Karena ini node BARU tanpa
traffic produksi, tidak ada isu urutan deploy rules-vs-kode yang perlu
dikhawatirkan (isu itu hanya relevan untuk fork yang SUDAH live — lihat
`CLAUDE.md` bagian "URUTAN DEPLOY RULES vs KODE").

> Jika mengalami error TLS lokal saat deploy rules dari Windows:
> `$env:NODE_TLS_REJECT_UNAUTHORIZED="0"; firebase deploy --only firestore:rules`
> (workaround lokal, jangan dijadikan setelan permanen). Alternatif:
> paste manual isi `firestore.rules` di Firebase Console → Firestore →
> Rules.

### e. Deploy ke Vercel

1. Import repo fork Anda di [Vercel](https://vercel.com/new).
2. Set semua environment variable dari langkah c di Vercel (Project
   Settings → Environment Variables, scope **Production**). **Jangan**
   set `NEXT_PUBLIC_USE_EMULATOR` maupun `FIRESTORE_EMULATOR_HOST` di
   Vercel.
3. Deploy. Catat URL produksi Anda (mis. `https://komunitas-anda.vercel.app`).
4. Set 4 **GitHub Secrets** di repo fork Anda (Settings → Secrets and
   variables → Actions) — dipakai oleh 3 workflow cron di
   `.github/workflows/`:
   - `APP_URL` — URL Vercel dari langkah e.3
   - `RECALC_SECRET` — sama dengan nilai di Vercel
   - `AI_REVIEW_SECRET` — sama dengan nilai di Vercel
   - `INFLATION_AUTO_SECRET` — sama dengan nilai di Vercel

   Ketiga workflow (`daily-recalculate.yml`, `monthly-ai-review.yml`,
   `yearly-inflation.yml`) otomatis aktif setelah secret ter-set — tidak
   perlu ubah file workflow. Gunakan tombol **Run workflow** di tab
   GitHub Actions untuk test manual pertama kali.

### f. Konfigurasi komunitas via `/parameters` & `/admin`

1. Daftar (signup) dengan email yang SAMA PERSIS dengan
   `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` → verifikasi email → login. Anda
   otomatis menjadi super admin.
2. Buka `/parameters`. Karena `community_config/v1` belum ada di
   Firestore, akan muncul banner kuning **"Dokumen Belum Ada di
   Firestore"** dengan tombol **"Inisialisasi Konfigurasi"** — klik
   untuk menulis nilai default (`DEFAULT_COMMUNITY_CONFIG` di
   `src/lib/community-config.ts`) ke Firestore.
3. **Yang PALING PENTING diubah untuk komunitas non-IDR** (klik "Edit"
   setelah inisialisasi) — ini yang benar-benar membedakan satu node
   dari node lain:
   - **`currency_code`** (mis. `USD`), **`currency_locale`** (mis.
     `en-US`), **`currency_decimals`** (mis. `2` untuk USD — beda dari
     default IDR yang `0`). Field ini mengontrol SELURUH tampilan angka
     di platform (harga, neraca, badge kontributor, pesan error, prompt
     AI inflasi) lewat util `formatCurrency` — tidak perlu ubah kode.
   - **`harga_dasar`** dan **`batas_atas`** — harga dasar 1 NFT dan batas
     atas harga jual, dalam satuan mata uang Anda (default `100000`/
     `150000` adalah asumsi Rupiah — untuk USD, angka wajar jauh lebih
     kecil, mis. `1`–`1.5`).
   - **`nilai_minimum_project`** / **`nilai_maksimum_project`** — rentang
     nilai project charity yang bisa didaftarkan, juga dalam mata uang
     Anda.
   - **`super_admin_email`** — field ini hanya cerminan dari
     `NEXT_PUBLIC_SUPER_ADMIN_EMAIL` untuk ditampilkan; otorisasi
     sesungguhnya tetap dari environment variable (lihat langkah c).
4. Toggle **AI Governance** dan **Inflasi/Deflasi** (master switch +
   mode otonom) di `/parameters` — non-aktif secara default, aktifkan
   hanya jika sudah mengisi `GEMINI_API_KEY` dan
   `FIREBASE_SERVICE_ACCOUNT_KEY` di langkah c.
5. Halaman `/admin` menjadi bisa diakses (Anda sudah admin) untuk
   klaim kontributor, dispute, suspend user, dsb.

### g. Daftarkan node ke registry `earth-nft-instances`

Halaman `/instances` di setiap node membaca
`https://raw.githubusercontent.com/wahana108/earth-nft-instances/main/instances.json`
— sebuah array JSON dengan bentuk (lihat `src/app/instances/page.tsx`):

```json
{
  "name": "Nama Komunitas Anda",
  "url": "https://komunitas-anda.vercel.app",
  "version": "2.3",
  "admin": "username-github-anda",
  "region": "Kota, Negara",
  "registered_at": "2026-08-01"
}
```

Untuk mendaftar: fork `earth-nft-instances`, tambahkan entri Anda ke
`instances.json`, lalu ajukan Pull Request ke repo tersebut. Field
`version` bersifat informasional (dibandingkan ke konstanta
`PLATFORM_VERSION` di kode setiap node untuk badge "✓ Verified" —
tidak wajib sama persis, sesuaikan dengan versi fork Anda).

---

## 3. Known limitations untuk fork

Hal-hal yang SENGAJA belum diparameterkan — bukan bug, dicatat sadar
agar tidak mengejutkan:

- **UI berbahasa Indonesia sepenuhnya** — belum ada lapisan i18n/
  terjemahan. Semua label, tombol, dan pesan tampil dalam Bahasa
  Indonesia terlepas dari `currency_locale` yang dipilih.
- **Locale tanggal tetap `id-ID`** — `toLocaleDateString`/
  `toLocaleString` untuk tanggal (bukan mata uang) di seluruh app masih
  hardcode `id-ID`, terpisah dari `currency_locale` yang hanya
  mengontrol format ANGKA/mata uang (lihat `feat/currency-param`,
  keputusan eksplisit untuk memisahkan scope currency dari locale
  tanggal).
- **Beberapa pesan error admin-only masih format IDR** —
  `src/lib/infrastructure.ts` (`checkSaldoTersediaTx`,
  `migrateOldSisaKeSaldoTersedia`) sengaja dikecualikan dari
  parameterisasi currency: jalur ini jarang terpicu (admin-only, saldo
  kas sistem tidak cukup / migrasi satu kali), sehingga tetap
  menampilkan format Rupiah demi menjaga signature fungsi tetap
  sederhana. Kosmetik saja — tidak memengaruhi neraca atau logika.

---

## 4. Checklist verifikasi node sehat

Setelah semua langkah di atas, verifikasi node Anda dengan urutan ini:

- [ ] **Signup + verifikasi email jalan**: daftar akun test (BUKAN email
      super admin), terima email verifikasi, klik link, login berhasil
      → dokumen `users/{uid}` muncul di Firestore Console.
- [ ] **`/parameters` menampilkan konfigurasi Anda** — bukan lagi
      banner "Belum Ada di Firestore", dan angka harga/mata uang sudah
      sesuai currency yang Anda set (mis. tampil sebagai `$1.00` bukan
      `Rp1`).
- [ ] **Create project jalan**: dari akun test, buka `/create`, isi
      form, submit — project + NFT unit berhasil dibuat, jumlah NFT
      terhitung benar dari `nilai_project ÷ harga_dasar`.
- [ ] **Beli NFT jalan**: dari akun test kedua, beli salah satu NFT di
      `/explore` — neraca kedua akun berubah, `neraca_log` tercatat.
- [ ] **Cron hijau**: buka tab GitHub Actions repo Anda, jalankan
      ketiga workflow manual (*Run workflow*) satu per satu — semuanya
      selesai dengan status sukses (bukan merah). Jika `AI_REVIEW_SECRET`/
      `INFLATION_AUTO_SECRET` belum diisi `GEMINI_API_KEY`, workflow
      tetap "hijau" karena endpoint mengembalikan `{ok:true,
      skipped:true, reason:...}` (guard, bukan error — lihat
      `CLAUDE.md`).
- [ ] **(Opsional) Terdaftar di registry**: `/instances` menampilkan
      node Anda setelah PR ke `earth-nft-instances` di-merge.
