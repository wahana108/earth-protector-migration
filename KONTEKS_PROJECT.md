# KONTEKS_PROJECT.md
> Dokumen ini dibuat oleh Claude Code pada 2026-05-26 untuk merangkum status implementasi project Earth Firebase Sanctuary. Dibuat berdasarkan pembacaan seluruh kode, konfigurasi, dan git history.

---

## 1. IDENTITAS PROJECT

| Atribut | Nilai |
|---|---|
| **Nama App** | Earth Firebase Sanctuary |
| **Firebase Project ID** | `migration-earth-project` |
| **Firestore Region** | `nam5` (North America multi-region) |
| **Tech Stack** | Next.js 15, TypeScript, Firebase SDK v11, Genkit AI, Tailwind CSS, Shadcn/UI |
| **AI Model** | Google Gemini 2.5 Flash (via `@genkit-ai/google-genai`) |
| **Dev Server Port** | 9002 |

---

## 2. ARSITEKTUR YANG SUDAH DIPUTUSKAN

### Firebase Collections (yang direncanakan di blueprint)
```
nfts/                     <- Dokumen NFT
  └── {nftId}/likes/      <- Subcollection likes (belum ada di Firestore)
transactions/             <- Histori transaksi
topDevelopers/            <- Hasil ranking AI (ditulis oleh AI flow)
```

### Emulator Ports
```
Auth Emulator:       9099
Firestore Emulator:  8080
Functions Emulator:  5001
Emulator UI:         4000
```

### Auth Flow (yang sudah diimplementasi)
```
signup/login page
  └─> auth-components.tsx (LoginForm / SignUpForm)
        └─> useAuth hook (AuthContext)
              └─> auth.ts (signInWithEmail / signUpWithEmail / signOutUser)
                    └─> Firebase Auth SDK
```

### Dua Codebase Cloud Functions
- `functions/` — codebase `default`
- `mother-earth-core/` — codebase `mother-earth-core`

---

## 3. FITUR YANG SUDAH BERJALAN

### Berjalan (UI bisa dilihat)
| Fitur | File Utama | Status |
|---|---|---|
| Homepage dengan featured NFTs | `src/app/page.tsx` | Berjalan (data placeholder) |
| Explore page (filter, search, sort) | `src/app/explore/page.tsx` | Berjalan (data placeholder) |
| Halaman Login | `src/app/login/page.tsx` | Berjalan (form + validasi Zod) |
| Halaman Sign Up | `src/app/signup/page.tsx` | Berjalan (form + konfirmasi password) |
| Auth State Management | `src/hooks/use-auth.tsx` | Berjalan (AuthContext + onAuthStateChanged) |
| Header dengan user dropdown | `src/components/layout/header.tsx` | Berjalan (login/logout UI) |
| Sidebar navigasi | `src/components/layout/sidebar-nav.tsx` | Berjalan |
| NFT Card component | `src/components/nft-card.tsx` | Berjalan (like lokal, data placeholder) |
| Rankings page | `src/app/rankings/page.tsx` | Berjalan dengan caveat (lihat error) |
| AI Recommendations page | `src/app/recommendations/page.tsx` | Berjalan jika GEMINI_API_KEY di-set |
| Firebase SDK terhubung ke emulator | `src/lib/firebase.ts` | Dikonfigurasi, belum di-commit |

### Firebase SDK Config (uncommitted, sudah dimodifikasi Gemini CLI)
`src/lib/firebase.ts` sekarang mengekspor `functions` dan menghubungkan ke emulator saat localhost:
- `connectAuthEmulator(auth, "http://127.0.0.1:9099")`
- `connectFirestoreEmulator(db, "127.0.0.1", 8080)`
- `connectFunctionsEmulator(functions, "127.0.0.1", 5001)`
- Storage emulator DIKOMENTARI — tidak ada di `firebase.json`

---

## 4. FITUR YANG ERROR / BERMASALAH

### Error Kritis

**1. Rankings page: Server/Client SDK conflict**
- File: `src/app/rankings/page.tsx` + `src/ai/flows/top-developer-ranking.ts`
- Masalah: `top-developer-ranking.ts` memiliki directive `'use server'` tetapi mengimpor `firebase/firestore` (client-side SDK), bukan `firebase-admin`. Ini akan gagal di Next.js server environment karena SDK klien memerlukan browser context.
- Dampak: Halaman rankings kemungkinan besar throw error saat di-deploy ke production.

**2. Firestore masih kosong — tidak ada data nyata**
- AI flow rankings membaca dari Firestore (`nfts`, `transactions`) tapi tidak ada data di sana.
- Seluruh UI berjalan dari `src/lib/placeholder-data.ts` (data hardcoded), bukan dari Firestore.

**3. Firestore Security Rules akan kadaluarsa**
- File: `firestore.rules`
- Rules saat ini membuka akses penuh ke semua dokumen hingga: **2026-06-04** (9 hari dari sekarang!)
- Setelah tanggal itu, SEMUA request klien akan ditolak.

**4. Like system tidak menulis ke Firestore**
- File: `src/components/nft-card.tsx`
- `handleLike` hanya update local state. Komentar di kode: `// In a real app, this would call a server action`
- Likes tidak persisten.

**5. User profile tidak dibuat di Firestore saat signup**
- File: `src/lib/auth.ts`
- Komentar di kode: `// In a real app, you would also create a user profile document in Firestore here.`

### Halaman yang Di-link tapi Tidak Exist (404)
| URL | Di-link dari |
|---|---|
| `/nft/[id]` | NftCard — setiap card NFT link ke sini |
| `/create` | Header — tombol "Create" |
| `/profile` | Header dropdown — menu "Profile" |
| `/settings` | Sidebar nav |
| `/help` | Sidebar nav |

---

## 5. FILE YANG DIBUAT/DIMODIFIKASI OLEH GEMINI CLI (SESI SEBELUMNYA)

### File Baru (Untracked — belum di-commit ke git)
| File | Keterangan |
|---|---|
| `.firebaserc` | Menghubungkan project ke `migration-earth-project` |
| `firebase.json` | Konfigurasi Firestore, emulators, dua codebase Functions |
| `firestore.rules` | Security rules sementara (expires 2026-06-04) |
| `firestore.indexes.json` | File kosong — tidak ada index yang didefinisikan |
| `functions/` | Codebase Cloud Functions `default` — isi index.ts KOSONG (template) |
| `mother-earth-core/` | Codebase Cloud Functions kedua — isi index.ts KOSONG (template) |
| `skills-lock.json` | File konfigurasi Gemini CLI skills |
| `.agents/` | Direktori skills Gemini CLI (firebase-auth, genkit, firestore, dll.) |

### File yang Dimodifikasi (Staged/Unstaged — belum di-commit)
| File | Perubahan |
|---|---|
| `src/lib/firebase.ts` | Ditambahkan: emulator connections (Auth/Firestore/Functions), export `functions` |
| `src/ai/flows/top-developer-ranking.ts` | Direfactor: gunakan `writeBatch` (lebih efisien), sederhanakan perhitungan likes, hapus fetch subcollection likes |

### File yang Dibuat di Sesi Lama (Sudah di-commit, oleh Firebase Studio)
- `src/components/auth-components.tsx` — LoginForm + SignUpForm
- `src/hooks/use-auth.tsx` — AuthProvider + useAuth hook
- `src/lib/auth.ts` — signIn/signUp/signOut functions
- `src/components/layout/` — header, sidebar, main-layout, auth-layout
- `src/ai/flows/` — kedua AI flows
- `src/ai/genkit.ts` — konfigurasi Genkit

---

## 6. TASK YANG DIKERJAKAN GEMINI CLI (SESI 05 MEI 2026)

Berdasarkan git log dan file yang dimodifikasi, Gemini CLI di sesi terakhir mengerjakan:

1. **Setup Firebase project** — membuat `.firebaserc`, `firebase.json`
2. **Setup Firestore** — membuat `firestore.rules` (sementara) dan `firestore.indexes.json`
3. **Setup Cloud Functions** — membuat dua codebase (`functions/`, `mother-earth-core/`) dengan `npm install`
4. **Konfigurasi emulator** — menambahkan emulator config di `firebase.json` dan menghubungkan SDK di `firebase.ts`
5. **Refactor ranking flow** — optimasi `top-developer-ranking.ts` dengan `writeBatch`
6. **Install Gemini skills** — skills untuk firebase-auth, firebase-firestore, genkit-js, dll.

---

## 7. TASK YANG TERHENTI / BELUM SELESAI

Berdasarkan `docs/blueprint.md`, fitur-fitur ini belum diimplementasi sama sekali:

| Fitur | Status | Lokasi yang direncanakan |
|---|---|---|
| NFT Detail Page | Belum ada | `/nft/[id]` |
| Create NFT Page | Belum ada | `/create` |
| User Profile Page | Belum ada | `/profile` |
| NFT Like System (real) | Hanya lokal state | Cloud Function trigger |
| Community Validation (voting) | Belum ada | Cloud Function |
| Buyback System | Belum ada | Cloud Function (kompleks) |
| Firestore seed data | Belum ada | Script terpisah |
| Proper Firestore Security Rules | Rules sementara | `firestore.rules` |
| Firestore indexes | Kosong | `firestore.indexes.json` |
| Auth protection/middleware | Belum ada | Next.js middleware |
| Cloud Functions deployment | Template kosong | `functions/src/index.ts` |

---

## 8. MASALAH YANG DIKETAHUI

### Security
- **URGENT**: Firestore rules kadaluarsa **2026-06-04** (9 hari lagi)
- Tidak ada auth guard — semua halaman bisa diakses tanpa login
- API key Firebase ter-hardcode di `src/lib/firebase.ts` (ini normal untuk client-side Firebase, tapi perlu diperhatikan)
- `GEMINI_API_KEY` perlu di-set di environment variable untuk AI features

### Arsitektur
- `top-developer-ranking.ts` menggunakan `'use server'` + client Firebase SDK — kombinasi yang salah
- `personalizedNftRecommendationsFlow` dipanggil langsung dari client component (`recommendations/page.tsx`) — perlu Server Action yang benar
- Storage emulator tidak dikonfigurasi di `firebase.json`, tapi `getStorage` diimpor di `firebase.ts`

### Pengembangan
- Dua codebase Functions (`functions/` dan `mother-earth-core/`) — purpose `mother-earth-core` tidak jelas dari kodenya
- Tidak ada environment variables di `.env` (perlu `GEMINI_API_KEY`)
- Tidak ada data di Firestore — seluruh app masih pakai placeholder data

---

## 9. COMMIT HISTORY RINGKAS

| Commit | Tanggal | Deskripsi |
|---|---|---|
| `ef8427e` | 24 Apr 2026 | Open source setup: manifesto, contributing guide |
| `52ea581` | 24 Apr 2026 | Open source setup + MIT license |
| `f800aa8` | 24 Apr 2026 | Firebase Studio: fix layout issues |
| `48b5bbd` | 24 Apr 2026 | Firebase Studio: fix sidebar/content overlap |
| `9c2a8b1` | 24 Apr 2026 | Firebase Studio: fix interface |
| `971d5e5` | 26 Okt 2025 | Fix legacyBehavior deprecated error (sidebar-nav) |
| `738c1a3` | 26 Okt 2025 | Input Firebase SDK config |
| `88f3cc8` | — | Initial prototype |
| `dd6cf03` | — | Firebase Studio workspace init |

> Catatan: Ada gap waktu aneh — commit Oktober 2025 tampak lebih lama dari April 2026, kemungkinan karena perbedaan zona waktu atau system clock saat commit.

---

## 10. LANGKAH SELANJUTNYA YANG DISARANKAN (PRIORITAS)

1. **SEGERA** — Update `firestore.rules` sebelum 2026-06-04 atau data akan terkunci
2. Commit perubahan Gemini CLI yang pending (`firebase.ts` + `top-developer-ranking.ts`)
3. Buat file `.env.local` dengan `GEMINI_API_KEY` untuk AI features
4. Buat Firestore seed script untuk mengisi data awal
5. Fix `top-developer-ranking.ts` — gunakan Firebase Admin SDK atau pindahkan logika ke API route
6. Buat halaman `/nft/[id]` agar link dari NftCard tidak 404
7. Implementasi auth middleware untuk melindungi halaman yang memerlukan login
8. Tulis Firestore security rules yang proper (replace aturan sementara)
