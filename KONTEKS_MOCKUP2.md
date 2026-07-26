# KONTEKS_MOCKUP.md — Inspira Better World

> Dokumen ini dibuat berdasarkan pembacaan menyeluruh seluruh source code.
> Dibuat: 2026-05-27

---

## 1. GAMBARAN UMUM PROJECT

**Nama:** Inspira Better World  
**Deskripsi:** NFT Marketplace bertemakan lingkungan hidup. Users bisa membeli, menjual, dan membuat NFT yang secara konseptual mendanai proyek lingkungan (penanaman pohon, pembersihan laut, perlindungan satwa liar).  
**Stack:** React 18 + TypeScript + Vite + Supabase + Tailwind CSS + shadcn/ui (Radix)  
**Build tool:** Vite (port 8080)  
**Asal usul:** Dibangun dengan platform **Lovable.dev** (terlihat dari `lovable-tagger` di devDependencies)

---

## 2. DAFTAR SEMUA HALAMAN & FITUR

### `/ (Index)` — **SELESAI**
- Hero section dengan CTA (Get Started / Sign In jika belum login; Explore NFTs / Create NFT jika sudah login)
- Impact stats statis (50.000+ Trees Planted, 25.000kg Ocean Waste Removed, 100+ Species Protected) — **angka hardcoded, bukan dari DB**
- Grid "Recommended NFTs" (diambil dari DB, `is_recommended = true`, maks 3)
- Grid "Top Environmental NFTs" (diambil dari DB, urut by `likes`, `is_recommended = false`)
- Preview kategori lingkungan (statis)

### `/auth` — **SELESAI**
- Form sign in / sign up dengan email & password
- Toggle mode via `?mode=signup` URL param
- Redirect ke `/` jika sudah login
- Menggunakan Supabase Auth (email + password)

### `/dashboard` (Create NFT) — **SELESAI**
- Form buat NFT: Category, Title, Description, Image URL, Environmental Impact
- Preview gambar real-time sebelum submit
- Auto-fill contoh data berdasarkan kategori yang dipilih
- NFT baru masuk ke queue validasi (`is_valid = false`)
- **Khusus Top Developer:** checkbox tambahan "Add to Recommended NFTs"
- **Khusus Top Vendor:** Card terpisah "NFT Recommendation Management" untuk memasukkan/mengeluarkan NFT dari recommendation pool
- Vendor Status Display: progress bar status (NFTs Sold/30, Buyback Rate/50%, Rec Purchase, Top Developer)
- Redirect ke `/validation` setelah create

### `/explore` — **SELESAI**
- Filter NFT: Validated / All / Recommended
- Search by title, description, impact
- Filter by category (6 kategori)
- Sort by likes, newest, oldest
- Quick access buttons ke halaman lain (Validation, Recommendations, Top Developers, Transaction Log)
- Grid display menggunakan `NFTCard`

### `/buyback` — **SELESAI (dengan catatan AI placeholder)**
- Tab "My NFTs": tampilkan NFT yang dimiliki user (`owner = user.id`)
- Tab "Buyback Requests": tampilkan semua request as buyer atau vendor
- Alur: Buyer request → Vendor confirm with proof URL → Buyer complete → NFT kembali ke marketplace
- Status badge: pending / confirmed / rejected / completed
- AI Buyback Score ditampilkan (tapi ini **placeholder**)
- AI Proof URL Validation ditampilkan (tapi ini **placeholder**)

### `/profile` — **SELESAI (dengan catatan bug ranking)**
- Header: nama (dari email prefix), badge rank
- Stats cards: Owned NFTs, Total Likes, Developer Rank
- Grid NFT milik user (owned + created)
- Section "Recommended for You" (NFT for_sale yang bukan milik user sendiri)
- **Bug:** Total Likes dihitung dari `owner = user.id` bukan `created_by = user.id`

### `/validation` — **SELESAI**
- Tampilkan semua NFT pending (`is_valid = false`)
- Hanya **Active Users** (pernah like atau beli NFT) atau **Top Developer** yang bisa vote
- Voting: Approve/Reject, 1 vote per user
- NFT ter-validasi otomatis jika approval rate ≥ 80%
- **Admin panel:** Email `ramawan@live.com` bisa Force Approve/Reject langsung

### `/transactions` — **SELESAI**
- Log publik semua transaksi (semua orang bisa lihat)
- Search by transaction ID, NFT title, description
- Setiap transaksi punya link ke "proof" (biasanya URL OpenSea)
- Tombol report transaksi dengan form alasan
- **Admin panel:** Khusus `ramawan@live.com` — bisa lihat semua reports, uphold (kembalikan NFT ke penjual) atau dismiss

### `/top-developers` — **SELESAI**
- Leaderboard developer berdasarkan algoritma Fibonacci
- Info card: total users, max top developers (Fibonacci)
- Kriteria: Buyback ≥ 50%, NFTs Sold ≥ 30, Rec Purchase ≥ 1
- Ranking berdasarkan total likes

### `/recommendations` — **SELESAI**
- Tampilkan NFT di recommendation pool (`is_recommended = true`, `is_valid = true`)
- Purchase button langsung dari halaman ini (tidak perlu ke NFTCard biasa)
- Info card cara menjadi Top Vendor

### `/` * (NotFound) — **SELESAI**
- Halaman 404 standar

---

## 3. STRUKTUR DATA (DATABASE)

### Tabel `nfts`
```
id            UUID PK
title         TEXT
description   TEXT
image_url     TEXT
impact        TEXT
likes         INTEGER DEFAULT 0
owner         UUID → auth.users (nullable = belum ada pemilik / untuk dijual)
for_sale      BOOLEAN DEFAULT true
category      TEXT ('Tree Planting'|'Ocean Cleanup'|'Wildlife Protection'|'Renewable Energy'|'Carbon Reduction'|'Ecosystem Restoration')
is_valid      BOOLEAN DEFAULT false (harus divalidasi dulu sebelum tampil di Explore)
is_recommended BOOLEAN DEFAULT false (di recommendation pool)
created_by    UUID → auth.users (nullable = data dummy lama)
created_at    TIMESTAMP
```

### Tabel `likes`
```
id         UUID PK
user_id    UUID → auth.users
nft_id     UUID → nfts
created_at TIMESTAMP
UNIQUE(user_id, nft_id)
```

### Tabel `votes`
```
id           UUID PK
user_id      UUID → auth.users
nft_id       UUID → nfts
vote_status  TEXT ('approve'|'reject')
created_at   TIMESTAMP
UNIQUE(user_id, nft_id) — satu user satu vote per NFT
```

### Tabel `transactions`
```
id          UUID PK
nft_id      UUID → nfts
buyer_id    UUID → auth.users
seller_id   UUID (nullable, untuk data lama sebelum migration)
description TEXT
proof_link  TEXT (URL ke OpenSea/marketplace)
status      TEXT DEFAULT 'completed' ('completed'|'refunded')
kind        TEXT DEFAULT 'purchase' ('purchase'|'refund')
created_at  TIMESTAMP
```

### Tabel `reports`
```
id                UUID PK
transaction_id    UUID → transactions
user_id           UUID → auth.users
reason            TEXT
status            TEXT DEFAULT 'pending' ('pending'|'upheld'|'dismissed')
resolution_notes  TEXT (nullable)
resolved_by       UUID (nullable)
resolved_at       TIMESTAMP (nullable)
created_at        TIMESTAMP
```

### Tabel `buyback_requests`
```
id         UUID PK
nft_id     UUID → nfts
buyer_id   UUID → auth.users (pemilik NFT yang minta buyback)
vendor_id  UUID → auth.users (kreator NFT = nfts.created_by)
status     TEXT DEFAULT 'pending' ('pending'|'confirmed'|'rejected'|'completed')
proof_url  TEXT (nullable, URL bukti aksi lingkungan dari vendor)
created_at TIMESTAMP
```

---

## 4. LOGIKA BISNIS YANG SUDAH ADA

### A. Autentikasi
- Email + password via Supabase Auth
- AuthProvider context global (`src/hooks/useAuth.tsx`)
- Session persist via localStorage

### B. Siklus Hidup NFT
1. User create NFT → masuk DB dengan `is_valid = false`
2. Community vote di `/validation` → jika approval ≥ 80%, auto-set `is_valid = true`
3. NFT valid tampil di Explore dengan `for_sale = true, owner = null`
4. User beli NFT → `owner = buyer_id, for_sale = false`
5. NFT yang sudah dibeli tidak tampil di Explore lagi (hanya milik pembeli)
6. Buyback selesai → `owner = null, for_sale = true` (kembali ke marketplace)

### C. Pembelian NFT (ATOMIC)
Menggunakan SQL function `purchase_nft()` di Supabase:
- Validasi user login
- Lock row NFT (`FOR UPDATE`)
- Cek `for_sale = true`
- Cek pembeli bukan pemilik saat ini
- Insert ke `transactions` (dengan `seller_id`, `kind='purchase'`, `status='completed'`)
- Update NFT: `owner = buyer_id, for_sale = false`
- Return `transaction_id`

### D. Sistem Validasi
- Siapa yang bisa vote: `isActiveUser()` (pernah like ATAU pernah beli) ATAU `isTopDeveloper()`
- Threshold validasi: 80% approve dari total votes
- Admin (`ramawan@live.com`) bisa bypass voting

### E. Algoritma Top Developer (Fibonacci)
```
1. Hitung total unique users dari NFT creators + transaction buyers
2. maxTopDevs = fibonacciSequence(totalUsers)
   (Fibonacci: [1,1,2,3,5,8,13,...], ambil bilangan terbesar yang jumlahnya <= N)
3. Filter user dengan: soldNFTs >= 30 AND buybackPercentage >= 50% AND recPurchases >= 1
4. Sort by total_likes, ambil maks maxTopDevs orang
```

### F. Sistem Recommendation Pool
- Hanya **Top Vendor** yang bisa memasukkan NFT (Top Vendor = Top Developer + syarat tambahan)
- Syarat Top Vendor: Top Developer AND soldNFTs ≥ 30 AND buyback% ≥ 50% AND ≥1 rec purchase
- Maks 3 NFT di pool sekaligus
- 1 vendor hanya boleh punya 1 NFT di pool
- Ketika NFT di pool dibeli, `is_recommended = false` secara otomatis

### G. Sistem Buyback Request
Alur dua arah:
1. Buyer klik "Request Buyback" → insert `buyback_requests` (status: pending)
2. Vendor lihat di tab "Buyback Requests" → bisa Confirm (perlu proof URL) atau Reject
3. Buyer lihat request confirmed → klik "Complete Buyback" → NFT kembali ke marketplace

### H. Report & Dispute Resolution
1. User report transaksi → insert ke `reports` (status: pending)
2. Admin lihat semua pending reports di `/transactions`
3. Admin bisa **Uphold**: jalankan SQL function `resolve_report_upheld()`:
   - Mark transaksi lama sebagai `status='refunded'`
   - Insert refund transaction (kind='refund')
   - Kembalikan NFT ke seller asli
4. Admin bisa **Dismiss**: hanya update `reports.status = 'dismissed'`

### I. Delete NFT
- Hanya kreator bisa delete (`created_by = user.id`)
- **UI menampilkan window 3 hari** (countdown timer)
- **DB RLS hanya mengizinkan 30 menit** — INKONSISTENSI!
- Fallback: jika delete gagal (RLS), update title ke `[DELETED]`, `is_valid = false`
- NFT dengan title `[DELETED]` difilter dari semua query

---

## 5. APA YANG BELUM DIIMPLEMENTASIKAN (TAPI ADA DI UI)

### A. AI Validation (PLACEHOLDER)
File: `src/lib/supabase.ts` fungsi `validateProofUrl()`
- **Yang ada:** Cek ekstensi file URL (jpg, png, pdf) atau domain (drive.google.com, dropbox.com)
- **Yang belum:** Integrasi nyata dengan xAI API atau Gemini API
- **Dampak:** AI confidence score yang ditampilkan di Buyback.tsx tidak bermakna

### B. AI Buyback Recommendation (PLACEHOLDER)
File: `src/lib/supabase.ts` fungsi `getAIBuybackRecommendation()`
- **Yang ada:** Score sederhana = (likes × 2) + (is_valid ? 30 : 0)
- **Yang belum:** Analisis real AI terhadap dampak lingkungan NFT
- **Dampak:** "AI Buyback Score" di halaman Buyback hanya heuristik sederhana

### C. Sistem Harga/Nilai NFT
- **Belum ada** field harga di tabel `nfts`
- UI tidak menampilkan harga apapun
- Pembelian tidak melibatkan pembayaran nyata

### D. Blockchain Integration
- Ini bukan platform blockchain sungguhan
- `proof_link` hanya URL teks (ke OpenSea, dll) yang tidak diverifikasi
- Tidak ada wallet connection, tidak ada smart contract

### E. Email Notification
- Tidak ada notifikasi email untuk status buyback request, report resolved, NFT validated, dll

### F. User Profile Lengkap
- Tidak ada field username, avatar, bio, dll
- Nama ditampilkan dari email prefix saja

### G. Profil User di Leaderboard
- `TopDeveloper.tsx` menampilkan `User {id.slice(0,8)}...` bukan nama nyata
- Tidak ada cara mengambil email/nama user lain karena `auth.users` tidak public

---

## 6. INKONSISTENSI & BUGS YANG DITEMUKAN

### 1. Window Delete NFT: 3 Hari vs 30 Menit
- `NFTCard.tsx:35` → UI logic menggunakan 3 hari
- `20250708_fix_nft_delete_rls.sql` → DB RLS policy hanya 30 menit
- Hasil: Tombol delete muncul di UI sampai 3 hari, tapi database akan reject operasi setelah 30 menit, dan fallback ke title=[DELETED]

### 2. Dua Supabase Client
- `src/lib/supabase.ts` → client tanpa type safety, digunakan di semua komponen
- `src/integrations/supabase/client.ts` → client dengan TypeScript Database types, tapi **tidak digunakan oleh aplikasi**

### 3. Perhitungan Total Likes di Profile
- `Profile.tsx:46` mengambil likes dari NFT di mana `owner = user.id`
- Seharusnya dari `created_by = user.id` (NFT yang dibuat user)
- Mengakibatkan total likes yang tidak akurat

### 4. Like Count Desync
- `NFTCard.tsx` update `nfts.likes` counter secara langsung
- Tapi tabel `likes` adalah source of truth yang sesungguhnya
- Tidak ada cek apakah sudah pernah like saat pertama render (isLiked selalu false)

### 5. checkTopVendorStatus Buyback Counting
- `supabase.ts:709` menghitung buyback via `description.ilike('%buyback%')` di tabel transactions
- Tapi `purchase_nft()` SQL function tidak menulis "buyback" ke description — murni dari user input
- Buyback sebenarnya ditrack di tabel `buyback_requests`, bukan transactions
- Ini menyebabkan `buybackPercentage` di Top Vendor status selalu 0 kecuali user manually menulis "buyback" di description pembelian

### 6. Admin Hardcoded
- `Validation.tsx:56` → `user.email === 'ramawan@live.com'`
- `TransactionLog.tsx:17` → `user?.email === 'ramawan@live.com'`
- Tidak menggunakan `is_admin()` SQL function yang sudah dibuat di DB

---

## 7. DEPENDENCIES PENTING

| Package | Versi | Kegunaan |
|---------|-------|----------|
| `@supabase/supabase-js` | ^2.103.0 | Backend (auth, database) |
| `react-router-dom` | ^6.26.2 | Client-side routing |
| `@tanstack/react-query` | ^5.56.2 | Di-setup di App.tsx tapi **belum digunakan** di komponen manapun |
| `react-hook-form` | ^7.53.0 | Di-install tapi **belum digunakan** (form masih pakai useState) |
| `zod` | ^3.23.8 | Di-install tapi **belum digunakan** |
| `recharts` | ^2.12.7 | Di-install tapi **belum digunakan** |
| `lucide-react` | ^0.462.0 | Ikon seluruh aplikasi |
| `tailwindcss` | ^3.4.11 | Styling |
| `shadcn/ui` (via radix-ui) | berbagai versi | Komponen UI (Card, Button, Dialog, dll) |
| `sonner` | ^1.5.0 | Toast notifications |
| `lovable-tagger` | ^1.1.7 | Dev tool Lovable.dev |

### Env Variables yang Dibutuhkan
```
VITE_SUPABASE_URL=https://wgakhupahyqlpzixwjfl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
VITE_SUPABASE_PROJECT_ID=wgakhupahyqlpzixwjfl
```

---

## 8. SUPABASE SQL FUNCTIONS (SERVER-SIDE)

| Function | Keterangan | Status |
|----------|-----------|--------|
| `purchase_nft(p_nft_id, p_description, p_proof_link)` | Atomic purchase dengan row lock | **AKTIF, DIGUNAKAN** |
| `resolve_report_upheld(p_report_id, p_notes)` | Admin uphold report + refund NFT | **AKTIF, DIGUNAKAN** |
| `resolve_report_dismissed(p_report_id, p_notes)` | Admin dismiss report | **AKTIF, DIGUNAKAN** |
| `is_admin()` | Cek email = ramawan@live.com | **AKTIF, belum digunakan di client** |

---

## 9. RLS (ROW LEVEL SECURITY) POLICIES AKTIF

### `nfts`
- SELECT: semua boleh baca
- INSERT: authenticated, `created_by = auth.uid()`
- UPDATE: `owner = auth.uid()` OR `created_by = auth.uid()`
- DELETE: `created_by = auth.uid()` AND `created_at > NOW() - 30 menit`

### `likes`
- SELECT: semua
- INSERT: authenticated, `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

### `votes`
- SELECT: semua
- INSERT/UPDATE: `user_id = auth.uid()`

### `transactions`
- SELECT: semua (log publik)
- INSERT: authenticated, `buyer_id = auth.uid()`

### `reports`
- SELECT: `user_id = auth.uid()` (reporter) OR `is_admin()`
- INSERT: authenticated, `user_id = auth.uid()`

### `buyback_requests`
- SELECT/ALL: `buyer_id = auth.uid()` OR `vendor_id = auth.uid()`

---

## 10. KOMPONEN REUSABLE

| Komponen | File | Props Utama |
|----------|------|-------------|
| `Layout` | `src/components/Layout.tsx` | Navigation header + mobile bottom nav |
| `NFTCard` | `src/components/NFTCard.tsx` | `nft`, `onLike`, `onBuy`, `showBuyButton`, `showEditButton` |
| `TransactionForm` | `src/components/TransactionForm.tsx` | Dialog pembelian NFT (description + proof_link) |

---

## 11. RINGKASAN STATUS PER FITUR

| Fitur | Status | Catatan |
|-------|--------|---------|
| Auth (Sign in/up) | ✅ Selesai | - |
| Buat NFT | ✅ Selesai | Auto-fill example, image preview |
| Browse/Explore NFT | ✅ Selesai | Search, filter, sort |
| Beli NFT (atomic) | ✅ Selesai | SQL function, proof link wajib |
| Validasi NFT (voting) | ✅ Selesai | 80% threshold, admin override |
| Like/Unlike NFT | ✅ Selesai (ada desync bug) | isLiked tidak init dari DB |
| Delete NFT | ⚠️ Partial | UI 3 hari vs DB 30 menit |
| Buyback Request | ✅ Selesai | 4-state workflow |
| Report Transaksi | ✅ Selesai | Admin uphold/dismiss |
| Top Developer Leaderboard | ✅ Selesai | Fibonacci algorithm |
| Recommendation Pool | ✅ Selesai | Max 3 NFT, Top Vendor only |
| AI Proof Validation | ❌ Placeholder | Regex check saja |
| AI Buyback Score | ❌ Placeholder | Heuristik sederhana |
| Harga NFT | ❌ Belum ada | Tidak ada field price |
| Blockchain/Wallet | ❌ Belum ada | Hanya simulasi |
| Email Notifikasi | ❌ Belum ada | - |
| React Query usage | ❌ Belum ada | Installed tapi tidak dipakai |
| react-hook-form | ❌ Belum ada | Installed tapi tidak dipakai |
| recharts | ❌ Belum ada | Installed tapi tidak dipakai |
