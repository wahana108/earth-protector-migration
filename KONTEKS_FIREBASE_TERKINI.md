# KONTEKS_FIREBASE_TERKINI.md — The Mother Earth Protocol

> Dibuat: 2026-05-27 berdasarkan pembacaan menyeluruh seluruh source code.
> Update ini: setelah selesainya migrasi fase 1-3 dari Lovable → Firebase.

---

## 1. STATUS SETIAP HALAMAN

### `/` — Home
**Status:** Berfungsi dengan catatan.
**Queries:** `useNfts()` → `fetchAllNfts()` (`where('forSale','==',true)` + `orderBy('createdAt','desc')`)
**Fitur:** Hero section dengan CTA, grid 4 NFT pertama yang `forSale=true`, preview 3 kategori lingkungan.
**Bug:** Kategori preview hardcoded 3 nama lama (`"Reforestation"`, `"Wildlife Conservation"`) — tidak konsisten dengan 6 kategori baru yang sudah ada.

---

### `/explore`
**Status:** Berfungsi.
**Queries:** `fetchAllNfts()` → `where('forSale','==',true)` + `orderBy('createdAt','desc')`
**Fitur:** Search by title, filter category (6 kategori di dropdown), sort newest/oldest/likes/price asc/desc.
**Logika penting:** Semua NFT `forSale=true` tampil di sini, termasuk `isValid=false` — ini disengaja. Badge "Community Validated" muncul pada NFT `isValid=true`.
**Index Firestore:** `forSale ASC + createdAt DESC` (ada di firestore.indexes.json).

---

### `/nft/[id]`
**Status:** Berfungsi.
**Queries:** `fetchNftById`, `fetchUserById(createdBy)`, `fetchUserById(owner)`, `hasUserLiked`
**Fitur:**
- Badge "Community Validated" (hijau) jika `isValid=true`, "Awaiting Community Endorsement" (muted) jika `isValid=false`
- Tombol Buy Now: muncul jika `forSale=true && authUser && owner !== authUser.id && createdBy !== authUser.id`
- Tombol Request Buyback: muncul jika `!forSale && owner === authUser.id && createdBy !== authUser.id`
- Like/unlike toggle terintegrasi Firestore (init isLiked dari DB, toggle via `likeNft()`)
- Dialog beli: Proof URL (wajib) + Description (opsional)
- `sellerId = nft.owner ?? nft.createdBy` — handle kasus `owner=null` setelah buyback

---

### `/validation` (Community Endorsement)
**Status:** Berfungsi.
**Queries:** `fetchPendingNfts()` → `where('isValid','==',false)` + `orderBy('createdAt','desc')`
**Fitur:** Vote approve/reject, 1 vote per user (bisa diubah via upsert), progress bar %, auto-set `isValid=true` saat ≥ 80% approve.
**Logika penting:** NFT baru (`forSale=true, isValid=false`) muncul di sini DAN di `/explore` sekaligus — ini disengaja. Voting memberi badge endorsement, bukan izin jual.
**Index:** `isValid ASC + createdAt DESC` (ada).

---

### `/validated`
**Status:** Berfungsi.
**Queries:** `fetchValidatedNfts()` → `where('isValid','==',true)` + `orderBy('createdAt','desc')`
**Fitur:** Grid NFT ber-badge community validated, enriched dengan data creator. NFT di sini tetap bisa dibeli jika `forSale=true`.

---

### `/create`
**Status:** Berfungsi.
**Queries:** `createNft(data)` → `addDoc('nfts', { forSale:true, owner:null, isValid:false, isRecommended:false, ... })`
**Fitur:** Form react-hook-form + zod, 6 kategori, preview gambar real-time, redirect ke `/nft/{id}` setelah submit.
**Logika penting:** NFT baru langsung `forSale=true, owner=null` — masuk marketplace pool saat dibuat, tidak perlu menunggu validasi.

---

### `/dashboard`
**Status:** Berfungsi dengan catatan.
**Queries:**
- `fetchUserById(user.id)` untuk stats
- `fetchNftsByCreator(user.id)` → `where('createdBy','==',uid)` untuk "My NFTs"
- `fetchNftsByOwner(user.id)` → `where('owner','==',uid)` untuk "My Collection"
**Fitur:**
- Stats: Total Likes, NFTs Sold, Buybacks, Status (Top Dev badge)
- `VendorStatusCard`: progress bar soldNfts/30, buyback%/50%, Rec Purchase indicator
- `RecommendationManagement` card (hanya jika `isTopDeveloper=true`): toggle `isRecommended` pada valid NFT, enforced max 3 pool dan 1-per-vendor
- My NFTs tab: NFT yang dibuat user, tombol delete visible hanya dalam 30 menit pertama (`createdAt + 30min > now`)
- My Collection tab: NFT yang dimiliki user (`owner == user.id`) — muncul setelah user membeli NFT
**Bug diketahui:** `totalLikes` di user doc tidak auto-update (lihat Bagian 5 B1).

---

### `/profile`
**Status:** Berfungsi.
**Queries:** Sama dengan dashboard (fetchUserById, fetchNftsByCreator, fetchNftsByOwner).
**Fitur:** Avatar, inline name edit (update Firestore + Firebase Auth `updateProfile`), stats (totalLikes/soldNfts/buybackCount/createdNfts.length), Top Dev badge, tabs My NFTs / My Collection.

---

### `/buyback`
**Status:** Berfungsi.
**Queries:**
- `fetchBuybackRequestsByVendor(user.id)` → `where('vendorId','==',uid)` — tab "Sent by Me"
- `fetchBuybackRequestsByBuyer(user.id)` → `where('buyerId','==',uid)` — tab "Received"
**Fitur:** Alur 4-status (pending → confirmed/rejected; confirmed → completed). Vendor: Confirm + upload proof URL, Reject. Buyer: Mark Complete. `completeBuybackRequest()` increments vendor's `buybackCount` via batch dan set `nft.owner=null, forSale=true`.

---

### `/transactions`
**Status:** Berfungsi.
**Queries:** `fetchTransactionsByUser(user.id)` → union dari `where('buyerId','==',uid)` dan `where('sellerId','==',uid)`
**Fitur:** Tabs All/Purchases/Buybacks, badge Role (Buyer/Seller) dan Type (Purchase/Buyback/Refund), proof link, Report Anomaly dialog (tulis ke `reports/`), tombol Admin Refund (visible hanya `ramawan@live.com`, hanya pada type='purchase').

---

### `/top-developers`
**Status:** Berfungsi (tapi butuh data).
**Queries:** `fetchTopDevelopers(20)` → `orderBy('contributionScore','desc')` dari collection `topDevelopers`
**Fitur:** Leaderboard dengan rank 1-3 icon Trophy/Medal, score display, Top Dev badge, tombol "Recalculate" (admin only) yang memanggil `recalculateTopDevelopers()`.
**Catatan:** Collection `topDevelopers` kosong di fresh install — perlu admin klik Recalculate sekali.

---

### `/recommendations` (For You)
**Status:** Berfungsi.
**Queries:** `fetchRecommendedNfts()` → `where('isRecommended','==',true)` + `orderBy('createdAt','desc')`
**Fitur:** Grid max 3 NFT dari recommendation pool, 1 per vendor/kreator.

---

### `/login`, `/signup`
**Status:** Berfungsi. Email+password (tanpa verifikasi), Google OAuth via `signInWithPopup`. Auto-create user doc di Firestore. Race condition ditangani di `fetchUserProfile()` (creates doc jika missing).

### `/settings`, `/help`
**Status:** Route ada di sidebar nav tapi belum ada halaman — akan mengembalikan 404 atau blank.

---

## 2. STATUS LOGIKA BISNIS

### NFT Lifecycle ✅
```
createNft()
  → forSale=true, owner=null, isValid=false
  → Langsung tampil di /explore (bisa dibeli)
  → Langsung tampil di /validation (voting bisa dimulai)

castVote() → approvals/total ≥ 80%
  → isValid=true
  → NFT dapat badge "Community Validated"
  → Masih di /explore, masih bisa dibeli

buyNft(nftId, buyerId, sellerId)
  → owner=buyerId, forSale=false
  → Hilang dari /explore
  → Muncul di dashboard buyer "My Collection"
  → sellerId (owner ?? createdBy) dapat soldNfts +1

createBuybackRequest() → confirmBuybackRequest() → completeBuybackRequest()
  → owner=null, forSale=true (kembali ke marketplace)
  → vendorId dapat buybackCount +1

refundTransaction() [admin only]
  → Buat record type='refund'
  → owner=originalSeller, forSale=true
  → originalSeller soldNfts -1
```

### Validation/Endorsement Flow ✅
- Semua NFT tampil di `/validation` saat `isValid=false` (termasuk yang forSale=true)
- Auto-validate saat approve >= 80%
- Tidak ada admin override UI (hanya via Firestore Console langsung)

### Top Developer Algorithm ✅
```
1. Fetch: users, nfts, transactions, buybackRequests(status=completed)
2. Score: 1pt/NFT created + 0.5pt/like + 0.2pt/sold transaction
3. Eligible: soldNfts≥30 AND completedBuybacks/soldNfts≥50% AND recPurchases≥1
4. Cap: Fibonacci(totalUsers) — batas maksimum Top Developer
5. Ranked: sort by score, slice(0, cap)
6. Auto isRecommended: 1 valid NFT per top dev (highest likes), max 3
7. Update: topDevelopers collection, users.isTopDeveloper flags
```
**Trigger:** Manual oleh admin via `/top-developers`. Tidak ada scheduled job.

### Recommendation Pool ✅
- Max 3 NFT total, 1 vendor per pool
- Toggle via `setNftRecommended()` — validasi pool limit dan 1-per-vendor
- Juga di-set otomatis saat `recalculateTopDevelopers()`

### Delete Window (30 menit) ✅
- Firestore rules: `request.time < resource.data.createdAt + duration.time(30, "m")`
- Client: tombol delete hanya visible jika `nft.createdAt + 30min > Date.now()`
- `deleteNft()`: hard delete saja, tidak ada soft-delete fallback
- Setelah 30 menit: hanya admin bisa delete

### Report & Admin Refund ⚠️ Partial
- Report: user bisa buat via `/transactions` → tulis ke `reports/` ✅
- Refund: admin bisa trigger via `/transactions` tombol Undo ✅
- **Belum ada:** UI untuk admin membaca/mengelola daftar reports

---

## 3. FIRESTORE COLLECTIONS

### `users/{userId}`
| Field | Tipe | Deskripsi |
|---|---|---|
| `uid` | string | Firebase Auth UID |
| `email` | string\|null | Email login |
| `displayName` | string\|null | Nama tampilan |
| `photoURL` | string\|null | URL foto profil |
| `createdAt` | Timestamp | Waktu registrasi |
| `totalLikes` | number | **Tidak auto-update (bug B1)** |
| `soldNfts` | number | Di-increment saat buyNft, decrement saat refund |
| `buybackCount` | number | Di-increment saat completeBuybackRequest |
| `isTopDeveloper` | boolean | Di-update saat recalculateTopDevelopers |

### `nfts/{nftId}`
| Field | Tipe | Deskripsi |
|---|---|---|
| `title` | string | Judul NFT |
| `description` | string | Deskripsi |
| `imageUrl` | string | URL gambar |
| `impact` | string | Pernyataan dampak lingkungan |
| `category` | NFTCategory | 6 nilai (lihat types.ts) |
| `likes` | number | Counter like (di-update saat likeNft) |
| `owner` | string\|null | null = di pool marketplace |
| `forSale` | boolean | true = bisa dibeli |
| `isValid` | boolean | true = community validated |
| `isRecommended` | boolean | true = di recommendation pool |
| `createdBy` | string | UID kreator, immutable |
| `price` | number | Harga ETH (display only, tidak ada pembayaran nyata) |
| `createdAt` | Timestamp | Waktu dibuat |

### `nfts/{nftId}/votes/{userId}`
`voteStatus: 'approve'|'reject'`, `createdAt: Timestamp`

### `nfts/{nftId}/likes/{userId}`
`userId: string`, `createdAt: Timestamp`

### `transactions/{txId}`
| Field | Tipe | Deskripsi |
|---|---|---|
| `nftId` | string | ID NFT |
| `buyerId` | string | UID pembeli |
| `sellerId` | string | UID penjual (owner ?? createdBy saat beli) |
| `proofLink` | string | URL bukti transaksi eksternal |
| `description` | string | Keterangan opsional |
| `price` | number | Selalu 0 (tidak ada pembayaran nyata) |
| `type` | string | `'purchase'|'buyback'|'refund'` |
| `createdAt` | Timestamp | |

### `buybackRequests/{requestId}`
`nftId`, `buyerId` (pemilik NFT), `vendorId` (kreator), `status`, `proofUrl`, `createdAt`

### `reports/{reportId}`
`transactionId`, `userId`, `reason`, `createdAt`
*Catatan: tidak ada field `status`/`resolvedBy` (berbeda dari mockup Supabase)*

### `topDevelopers/{userId}`
`contributionScore: number`
*Hanya ada setelah admin klik Recalculate. Kosong di fresh install.*

---

## 4. FIRESTORE RULES RINGKASAN

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| `users/{id}` | Auth | isMe(id) | isMe OR isAdmin OR hanya `soldNfts` field | isAdmin |
| `nfts/{id}` | Public | Auth | createdBy OR owner OR buy-exception OR likes-exception OR isAdmin | isAdmin OR (createdBy + dalam 30 menit) |
| `nfts/.../votes/{voterId}` | Auth | isMe(voterId) | isMe(voterId) | isAdmin |
| `nfts/.../likes/{likerId}` | Public | isMe(likerId) | NEVER | isMe OR isAdmin |
| `transactions/{id}` | buyerId OR sellerId OR isAdmin | (auth + buyerId==uid) OR isAdmin | isAdmin | isAdmin |
| `buybackRequests/{id}` | buyerId OR vendorId OR isAdmin | Auth | vendorId OR buyerId OR isAdmin | isAdmin |
| `reports/{id}` | isAdmin | Auth | isAdmin | isAdmin |
| `topDevelopers/{id}` | Public | isAdmin | isAdmin | isAdmin |

**Admin:** `ramawan@live.com` — diverifikasi via `request.auth.token.email` di rules.

---

## 5. BUG YANG DIKETAHUI

### B1 — `totalLikes` tidak pernah di-update [MEDIUM]
`users.totalLikes` diinisialisasi di seed/fetchUserProfile tapi TIDAK di-increment saat user like NFT.
`likeNft()` hanya update `nfts.likes` counter dan subcollection. Stats "Total Likes" di dashboard/profile selalu stale.
**Fix yang diperlukan:** Increment `users/{createdBy}.totalLikes` di `likeNft()` saat like ditambah, decrement saat unlike.

### B2 — Home page kategori hardcoded 3 nilai lama [LOW]
`src/app/page.tsx` menampilkan 3 kategori dengan nama lama ("Reforestation", "Wildlife Conservation").
Perlu update ke 6 kategori dengan nama yang konsisten dengan `CATEGORY_LABELS`.

### B3 — `src/ai/flows/top-developer-ranking.ts` duplikat tidak terpakai [LOW]
File ini mengimplementasikan versi sederhana algoritma ranking (tanpa Fibonacci cap, tanpa eligibility).
Tidak dipanggil dari manapun di UI. UI menggunakan `recalculateTopDevelopers()` dari `firestore.ts`.

### B4 — Tidak ada admin UI untuk membaca reports [MEDIUM]
Reports bisa dibuat oleh user, tapi tidak ada halaman admin untuk membacanya.
`reports/` collection hanya bisa diakses via Firestore Console atau script.

### B5 — Tab label `/buyback` membingungkan [LOW]
"Sent by Me" = vendor/kreator yang menunggu request, "Received" = buyer yang submit request.
Labelnya berkebalikan dari intuisi natural. Sebaiknya: "As Vendor" / "As Buyer".

### B6 — `transactions.price` selalu 0 [INFO]
`buyNft()` hardcode `price: 0`. Harga dari `nft.price` tidak disimpan di transaksi.
Tidak ada pembayaran nyata, tapi perlu diperhatikan jika integrasi harga diimplementasikan.

---

## 6. YANG BELUM DIIMPLEMENTASI

### Dari CLAUDE.md Fase 4 (AI)
- Anomali detector transaksi via Genkit + Gemini
- Evaluasi harga NFT tahunan otomatis
- Scoring developer otomatis / scheduled recalculation

### Halaman yang Belum Ada
- `/settings` — route ada di sidebar tapi page kosong/404
- `/help` — route ada di sidebar tapi page kosong/404

### Fitur UI yang Belum Ada
- Admin panel untuk membaca dan mengelola `reports/` collection
- Home page: update 3 kategori hardcoded ke 6 kategori + nama yang benar
- Notifikasi in-app atau email (NFT divalidasi, buyback dikonfirmasi, dll)
- Scheduled trigger untuk `recalculateTopDevelopers()` (saat ini manual)

### Inkonsistensi yang Belum Diselesaikan
- `users.totalLikes` tidak sinkron dengan subcollection likes (Bug B1)
- `reports/` tidak punya field `status`/`resolvedBy`/`resolution_notes` (ada di mockup Supabase)
- `transactions.price` selalu 0 (Bug B6)

---

## 7. VERIFIKASI FIX 1 DAN FIX 2

### FIX 1 — My Collection menampilkan NFT yang dibeli ✅ BENAR
`src/app/dashboard/page.tsx` tab "My Collection" menggunakan `fetchNftsByOwner(user.id)`.
`fetchNftsByOwner` query: `where('owner', '==', owner)` + `orderBy('createdAt', 'desc')`.
Setelah `buyNft()`, Firestore di-update: `{ owner: buyerId, forSale: false }`.
Saat user navigasi ke `/dashboard`, component mount → `useEffect([user])` → `load()` → query berjalan.
Composite index `owner ASC + createdAt DESC` tersedia di firestore.indexes.json.
**Tidak ada bug. Flow sudah benar.**

### FIX 2 — NFT baru muncul di /explore DAN /validation ✅ BENAR
Saat `createNft()` dipanggil, NFT dibuat dengan `forSale=true, isValid=false`.
- `/explore` → `fetchAllNfts()` → `where('forSale','==',true)` → NFT baru masuk ✅
- `/validation` → `fetchPendingNfts()` → `where('isValid','==',false)` → NFT baru masuk ✅

Kedua halaman menampilkan NFT yang sama dari sudut pandang berbeda — ini benar dan disengaja.
Tidak ada filter yang saling menghalangi. Tidak ada bug.

---

## 8. COMPOSITE INDEXES YANG ADA (firestore.indexes.json)

**Collection `nfts`:** forSale+createdAt, forSale+likes, category+createdAt, category+likes, category+price(asc/desc), isValid+createdAt, createdBy+createdAt, owner+createdAt, isRecommended+createdAt, category+isValid+createdAt

**Collection `transactions`:** buyerId+createdAt, sellerId+createdAt, nftId+createdAt

**Collection `buybackRequests`:** buyerId+createdAt, vendorId+createdAt, nftId+status, status+createdAt

**Collection `topDevelopers`:** contributionScore DESC + `__name__` DESC

---

*TMEP — The Mother Earth Protocol | Status: 2026-05-27*
*Stack: Next.js 15 + Firebase Auth + Firestore + Genkit (AI belum aktif)*
