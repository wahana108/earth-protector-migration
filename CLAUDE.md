# CLAUDE.md — The Mother Earth Protocol (TMEP)
> File ini dibaca otomatis oleh Claude CLI di setiap sesi.
> Diperbarui: 2026-05-26 | Versi: 1.1

---

## 🎯 MISI PROJECT INI

Migrasi platform TMEP dari Lovable (React + Supabase) ke Firebase (Next.js + Firebase Auth + Firestore).

**Tujuan utama:**
1. **Dual Auth** — Google OAuth + Email/Password (tanpa konfirmasi email)
2. **Firestore** sebagai database pengganti Supabase
3. **Siap integrasi AI** (Genkit + Gemini) untuk audit log transaksi ke depan

**Status saat ini (2026-05-26):**
- ✅ Website bisa jalan lokal (npm run dev di port 9002)
- ✅ Firebase emulator aktif (Auth :9099, Firestore :8080)
- ✅ Login email/password — berfungsi penuh, tanpa konfirmasi email
- ✅ Google OAuth — signInWithGoogle() via signInWithPopup, auto-create Firestore user
- ✅ Protected routes middleware — src/middleware.ts
- ✅ Firestore security rules — proper rules (tidak ada expiry)
- ✅ Firestore indexes — 19 composite indexes siap deploy
- ✅ Seed data script — npm run seed (3 user + 7 NFT ke emulator)
- 🔴 Seluruh logika bisnis TMEP belum diport dari mockup Lovable

---

## 📁 STRUKTUR REPOSITORY

| Repo | URL | Keterangan |
|------|-----|------------|
| Mockup referensi | https://github.com/wahana108/earth-nft-sanctuary | Lovable + Supabase. JANGAN diubah. Sumber kebenaran logika bisnis. |
| Project aktif | https://github.com/wahana108/earth-protector-migration | Next.js 15 + Firebase. INI yang dikerjakan. Branch: feature/claude-migration |

---

## 🔥 TECH STACK

```
Framework    : Next.js 15 (App Router)
Language     : TypeScript
Auth         : Firebase Authentication
Database     : Firestore
AI           : Genkit + Google Gemini 2.5 Flash
Styling      : Tailwind CSS + shadcn/ui
Dev Port     : 9002
Firebase ID  : migration-earth-project
```

Emulator ports (development only):
- Auth: 9099 | Firestore: 8080 | Functions: 5001 | UI: 4000

---

## 🔐 AUTH — SPESIFIKASI (PRIORITAS SESI INI)

### Dua Opsi Login yang Harus Ada

**Opsi 1: Email + Password**
- Signup dengan email + password
- TIDAK perlu konfirmasi email — hapus sendEmailVerification() jika ada
- Login langsung setelah signup berhasil
- Hapus semua "check your email" redirect

**Opsi 2: Google OAuth**
- Satu klik "Sign in with Google"
- Jika user baru: otomatis buat dokumen di Firestore users/{uid}
- Redirect ke /explore setelah berhasil

### File yang Perlu Dibuat/Diupdate
```
src/lib/firebase.ts       ← gunakan env vars, emulator jika localhost
src/lib/auth.ts           ← signInWithGoogle(), signInWithEmail(), signUpWithEmail(), signOut()
src/hooks/use-auth.tsx    ← AuthContext + useAuth hook
src/app/login/page.tsx    ← tambah tombol Google
src/app/signup/page.tsx   ← hapus konfirmasi email step
src/middleware.ts         ← protect semua routes kecuali /, /login, /signup
```

### Environment Variables (.env.local — JANGAN commit)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=migration-earth-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
GEMINI_API_KEY=
```

### Firebase Console — Konfigurasi Manual oleh Owner
```
1. Authentication → Sign-in method → Email/Password → Enable
2. Authentication → Sign-in method → Google → Enable
3. Firestore → Create database → production mode
4. Deploy rules: firebase deploy --only firestore:rules
5. Deploy indexes: firebase deploy --only firestore:indexes
```

---

## 🗄️ FIRESTORE SCHEMA

```
users/{userId}
  uid, email, displayName, photoURL, createdAt
  totalLikes (number), soldNfts (number), buybackCount (number), isTopDeveloper (boolean)

nfts/{nftId}
  title, description, imageUrl, impact
  category: 'tree_planting' | 'ocean_cleanup' | 'wildlife_protection'
  likes (number), createdBy (userId), owner (userId|null)
  forSale (boolean), isValid (boolean), isRecommended (boolean), createdAt

nfts/{nftId}/votes/{userId}
  voteStatus: 'approve' | 'reject', createdAt

nfts/{nftId}/likes/{userId}
  createdAt

transactions/{txId}
  nftId, buyerId, sellerId, proofLink, description
  type: 'purchase' | 'buyback', createdAt

buybackRequests/{requestId}
  nftId, buyerId, vendorId
  status: 'pending' | 'confirmed' | 'rejected' | 'completed'
  proofUrl (string|null), createdAt

reports/{reportId}
  transactionId, userId, reason, createdAt
```

---

## 🗺️ STATUS FITUR

### FASE 1 — AUTH (SEKARANG)
- ✅ Email/Password login — berfungsi, tanpa konfirmasi email
- ✅ Google OAuth — signInWithGoogle() via signInWithPopup
- ✅ Protected routes middleware — src/middleware.ts (cookie-based)
- ✅ Auto-create user di Firestore saat login pertama — createUserDocumentIfNotExists()

### FASE 2 — FIRESTORE SCHEMA
- ✅ Security rules — firestore.rules proper (tidak ada expiry, berbasis auth + ownership)
- ✅ Composite indexes — firestore.indexes.json (19 index untuk Explore, Profile, Buyback, dll.)
- ✅ Seed data — scripts/seed-firestore.ts (3 user + 7 NFT, jalankan: npm run seed)

### FASE 3 — PORT HALAMAN (setelah Fase 1&2)
- 🔴 Homepage `/`
- 🔴 Explore `/explore`
- 🔴 Dashboard `/dashboard`
- 🔴 Validation `/validation`
- 🔴 Top Developers `/top-developers`
- 🔴 Buyback `/buyback`
- 🔴 Profile `/profile`
- 🔴 Recommendations `/recommendations`
- 🔴 Transaction Log `/transactions`
- 🔴 NFT Detail `/nft/[id]`

### FASE 4 — AI (masa depan)
- 🔵 Anomali detector transaksi (Genkit + Gemini)
- 🔵 Evaluasi harga tahunan
- 🔵 Scoring developer otomatis

---

## ⚙️ LOGIKA BISNIS INTI (port dari mockup, JANGAN modifikasi)

**Fibonacci Cap untuk Top Developer:**
```typescript
function getFibonacciCap(activeUsers: number): number {
  const fibs = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  let cap = 1;
  for (const f of fibs) {
    if (f <= activeUsers) cap = f;
    else break;
  }
  return cap;
}
// Kriteria Top Developer: soldNfts>=30, buybackPercentage>=50%, pernah beli isRecommended NFT
```

**Siklus NFT:**
```
Buat (isValid=false) → Voting → approval>=80% → isValid=true
→ Beli (proofLink) → owner=buyerId, forSale=false
→ Buyback request → Vendor confirm → Buyer complete → owner=null, forSale=true
```

**Validasi:** Active User/Top Developer bisa vote, 1 vote per user (updatable), 
auto-validate jika approve>=80%, admin override: ramawan@live.com

**Pool Rekomendasi:** maks 3 NFT, 1 vendor=1 NFT, harus isValid=true

---

## ⚠️ ATURAN WAJIB

1. Baca file ini di awal setiap sesi sebelum menulis kode
2. Cek .env.local ada sebelum npm run dev
3. Jangan ubah logika bisnis inti
4. Jangan commit .env.local atau secrets
5. Gunakan env vars untuk Firebase config, jangan hardcode
6. Referensi mockup: https://github.com/wahana108/earth-nft-sanctuary
7. Satu sesi = satu fitur yang tuntas
8. Update status tabel di atas setiap fitur selesai (🔴 → ✅)
9. Firestore rules HARUS diupdate sebelum 2026-06-04

---

## 📋 TASK SESI PERTAMA

Tujuan: Auth berfungsi penuh (tanpa konfirmasi email + ada Google Login)

```
[ ] 1. git status — pastikan di branch feature/claude-migration
[ ] 2. Cek .env.local, buat dari template jika belum ada
[ ] 3. Baca src/lib/auth.ts — identifikasi konfirmasi email yang perlu dihapus
[ ] 4. Hapus/disable email verification flow dari signup
[ ] 5. Tambah signInWithGoogle() di src/lib/auth.ts
[ ] 6. Update login/page.tsx — tambah tombol "Sign in with Google"
[ ] 7. Update signup/page.tsx — hapus konfirmasi email step
[ ] 8. Pastikan useAuth hook handle kedua provider
[ ] 9. Buat middleware.ts — protect routes
[ ] 10. Test: signup email → langsung masuk tanpa cek email
[ ] 11. Test: login Google → redirect ke /explore
[ ] 12. Test: akses protected route tanpa login → redirect /login
[ ] 13. Commit: "feat: dual auth (email + Google OAuth, no email verification)"
```

---

*TMEP — The Mother Earth Protocol | Impact Indexing Protocol v1.0*
*"Mengubah Setiap Tindakan Kebaikan Menjadi Aset Digital yang Abadi"*
