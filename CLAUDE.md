# CLAUDE.md — The Mother Earth Project (TMEP)

> Instruksi konteks untuk Claude CLI. Baca seluruh dokumen ini sebelum menyentuh kode.
> Jika ada konflik antara dokumen ini dan kode, tanyakan ke developer sebelum mengubah apapun.

---

## Apa proyek ini?

TMEP adalah platform komunitas open-source untuk mengabadikan tindakan nyata charity melalui sistem NFT berbasis konsensus. Bukan marketplace spekulatif. NFT = sertifikat pengakuan tindakan nyata. Semua nilai adalah poin simbolik reputasi, bukan uang.

**Visi realistis (penting untuk keputusan desain):** Platform ini dirancang sebagai ETALASE FUNGSIONAL — bukti konsep yang bisa berjalan, aman diperkenalkan tanpa takut crash/overload/tagihan. Skalabilitas sengaja DIBATASI KETAT (batasan = fitur pelindung free tier). Batasan bisa dibuka bertahap oleh pengembang berpendanaan yang fork platform ini. Semua batasan = parameter transparan yang bisa diubah/dinonaktifkan di /parameters (nilai 0 atau ≤0 = unlimited).

**Prinsip yang tidak boleh dilanggar:**
1. Tidak ada entitas pemegang dana — nilai ada di neraca user dan pool
2. Algoritma membaca neraca, bukan admin yang memutuskan
3. Nilai dari tindakan nyata yang bisa diverifikasi
4. Sistem menjamin antrian likuiditas, bukan return finansial
5. Neraca positif = buffer reputasi, BUKAN uang yang bisa dicairkan
6. **Konservasi nilai (zero-sum):** setiap pemotongan di satu sisi = penambahan di sisi lain. Total neraca semua entitas (user + sistem) selalu = 0. Tidak ada nilai tercipta/hilang.
7. Fibonacci = filosofi eksistensi/penyebaran organik

---

## Stack & Deployment

- **Frontend:** Next.js 15 (Turbopack) + React
- **Backend:** Firebase (Firestore + Auth)
- **Hosting:** Vercel (production dari branch main)
- **Repo:** github.com/wahana108/earth-protector-migration
- **Registry federasi:** github.com/wahana108/earth-nft-instances
- **Super admin:** ramawan01@gmail.com (email Google login; ada field super_admin_email di community_config/v1)
- **Status:** Fase 1-3 + Rate Limiting + AI Governance Tahap A → LIVE di production. Menuju Fase otonom (Level 2).

### Environment variables
```
NEXT_PUBLIC_SUPER_ADMIN_EMAIL   → ramawan01@gmail.com
NEXT_PUBLIC_USE_EMULATOR        → 'true' HANYA di .env.local dev.
                                  WAJIB tidak di-set/false di Vercel production.
RECALC_SECRET                   → secret untuk /api/recalculate (sama di Vercel + GitHub Secret)
NEXT_PUBLIC_FIREBASE_*          → config Firebase
(masa depan) GEMINI_API_KEY     → untuk AI otonom Level 2 (belum aktif)
```
### GitHub Secrets (untuk cron)
```
APP_URL         → URL Vercel node
RECALC_SECRET   → sama persis dengan Vercel
```

---

## Status Fase (ringkas)

```
FASE 1, 2A, 2B, 2C ✓ Fondasi + inti + keamanan + tata kelola dasar
FASE 3  ✓ LIVE: FIFO-only validation, Fibonacci quota, effective_buyback,
          tiered ranking, batasan stabilitas, otomatisasi recalculate 2 lapis
RATE LIMITING ✓ LIVE: batas harian per-user & global (proteksi biaya free tier)
AI GOVERNANCE TAHAP A ✓ LIVE (default OFF): manual-bridge anomaly review,
          watermark, konservasi nilai, unifikasi fee_pool, reward kontributor
```

---

## FASE 3 — detail (fitur inti reputasi)

### FIFO-only validation
```
NFTUnit.purchased_from: 'pool' | 'explorer' (undefined = 'explorer')
Hanya NFT dari ANTRIAN FIFO (buyNftUnit options.via='fifo' → 'pool') bisa validasi.
buyNftUnit via='pick' → 'explorer' (koleksi, tak bisa validasi).
/pool: Section FIFO "Jalur Validasi" (semua user, via fifo) + Grid "Koleksi" (via pick).
Guard server-side di validateProject(). Badge "Pool ✓" di dashboard.
```

### Fibonacci quota + tiered ranking
```
ranking.ts → fibonacciLargestAndSum(N): deret 1,1,2,3,5,8,... berhenti saat sum+next>N.
largest = kuota slot top developer. (N=10→3, N=100→34)
recalculateAllDeveloperLevels() = penentu kuota penuh (writeBatch).
checkAndUpdateDeveloperLevel() = per-transaksi (slot penuh→kandidat menunggu Recalculate).
/top-developers: sort tier-first (1=top dev, 2=kandidat, 3=lainnya), badge, progress syarat.
#1 = top developer sungguhan.
```

### effective_buyback (penalti neraca minus)
```
ranking.ts → calculateEffectiveBuyback(buybackCount, totalPoin, hargaDasar):
  penalty = totalPoin<0 ? floor(|totalPoin|/hargaDasar) : 0
  return max(0, buybackCount - penalty)
Dipakai untuk buyback_pct kualifikasi. Neraca positif = tiebreaker saja.
Anomali AI → minus neraca → penalti buyback → turun peringkat OTOMATIS (tanpa logika baru).
```

### Batasan stabilitas
```
nilai_maksimum_project (default 10jt = 100 NFT): createProject tolak nilai > maks
  (cegah write explosion — menutup bug lama dana besar).
max_nft_in_pool_per_developer (default 3): transferToPool tolak jika sudah >= batas.
```

### Otomatisasi recalculate 2 lapis
```
LAPIS 1 lazy: maybeAutoRecalculate() dipicu register user + buka /top-developers.
  Jalan jika last_recalculated_at >24jam ATAU flag.requested_at > last_recalculated_at.
LAPIS 2 cron: /api/recalculate (POST, x-recalc-secret) tulis recalculate_requests/flag.
  .github/workflows/daily-recalculate.yml curl 1x/hari. Flag=titipan, dieksekusi lazy.
CATATAN: /api dikecualikan dari middleware auth matcher.
  firebase.ts deteksi emulator via NEXT_PUBLIC_USE_EMULATOR (bukan window) agar
  API route server-side bisa akses emulator saat dev.
```

---

## RATE LIMITING (proteksi biaya) — LIVE

```
src/lib/rate-limit.ts: RateLimitError, getTodayString() WITA (Asia/Makassar),
  checkAndIncrementUserUsage (writer-based, 0 read tambahan untuk buy/buyback/validate),
  checkGlobalDailyLimit.
Parameter (≤0 = unlimited):
  max_transactions_per_user_per_day 20, max_projects_per_user_per_day 2,
  max_comments_per_user_per_day 30, max_projects_global_per_day 20,
  max_comments_global_per_day 300.
Tracking: User.daily_usage{date,transactions,projects,comments} (lazy reset) +
  daily_stats/{YYYY-MM-DD}. Charge ke pelaku aksi (buyer/requester/validator).
Kartu "Kuota Harian" di /dashboard (∞ jika unlimited).
UI catch block WAJIB cek instanceof RateLimitError SEBELUM pesan generik
  (regresi: bare catch{} membuang error → pesan generik).
Global limit ada race condition minor yang diterima sadar (proteksi kasar).
```

---

## AI GOVERNANCE TAHAP A (manual-bridge) — LIVE, default OFF

```
KONSEP: admin export data top developer+kandidat → paste ke AI eksternal
(Claude/GPT) → paste hasil balik → sistem apply ke neraca. Format prompt/output
REUSABLE untuk otomasi API penuh masa depan (ganti copy-paste dengan API call).

Master switch: ai_governance_enabled (default FALSE). OFF → platform jalan normal,
halaman /ai-review pesan "dinonaktifkan", sidebar link tak muncul.

Parameter (community_config):
  ai_review_history_limit 50, ai_review_history_days 50, ai_anomali_divisor 10,
  ai_anomali_min_skor 30, ai_review_revert_days 7 (0 untuk testing final instan).

ALUR (/ai-review, admin-only):
  A. Export: top dev+kandidat (kuota Fibonacci), log per dev (dibatasi limit/days,
     difilter watermark), ID PENDEK 6-char (privasi), tombol Salin.
  B. Prompt baku (format output: "SKOR: [id] | [0-100] | [alasan]").
  C. Input hasil AI → Parse & Preview.
  D. Preview: minus = floor(skor/ai_anomali_divisor) × harga_dasar
     (skor < min_skor → efek lebih kecil floor(skor/divisor/2)).
  E. Apply (writeBatch, ZERO-SUM):
     user.total_poin -= minus; neraca_log 'anomali_ai'.
     fee_pool: total_dari_anomali += total, saldo_tersedia += total.
     ai_reviews/{id} + revert_deadline.
  Efek ke peringkat OTOMATIS via effective_buyback (tanpa logika baru).

WATERMARK anti-penilaian-ganda:
  User.last_ai_review_at. fetchDevLogs ambil log timestamp > last_ai_review_at
  (operator '>' jika ada watermark). applyAiReview set watermark untuk SEMUA dev
  dinilai (termasuk skor 0). revertAiReview TIDAK mundurkan watermark (keputusan
  sadar: koreksi nilai, bukan buka log ulang).
  Rules: last_ai_review_at hanya ditulis admin (branch isAdmin, TIDAK di hasOnly
  user biasa → cegah manipulasi).

REVERT / MASA SANGGAH:
  ai_reviews status 'applied' → tombol Batalkan (kembalikan neraca per-entry +
  fee_pool, log 'anomali_ai_revert', status 'reverted'). Lazy auto-final saat
  lewat revert_deadline (tanpa cron). Melindungi keadilan user + kepastian saldo.
```

---

## NERACA SISTEM (fee_pool/v1) — sumber tunggal terunifikasi

```
saldo_tersedia          = KAS AKTIF (sumber kebenaran, untuk reward/sertifikat)
total_dari_fee          = akumulasi feeInfrastruktur dari fee sharing (audit asal)
total_dari_anomali      = akumulasi dari hukuman AI (audit asal)
total_dari_lain         = sumber lain / migrasi (audit asal)
total_dialokasikan_lencana = pengeluaran ke kontributor (audit)
total_terkumpul, total_terdistribusi = audit trail lama (dipertahankan)

Konsistensi: saldo_tersedia = (dari_fee + dari_anomali + dari_lain) - dialokasikan_lencana
saldo_tersedia BERTAMBAH dari: fee sharing + hukuman anomali.
saldo_tersedia BERKURANG saat: reward kontributor infrastruktur.
```

### Fee sharing (terverifikasi logis & zero-sum)
```
Terpicu di buyNftUnit saat NFT status 'valid' dijual + jumlah_nft_terjual %
fee_trigger_per_nft === 0 (default trigger tiap 10). maybeTriggerFee().
feeTotal = hargaJual × feeProjectPct/100
feeInfrastruktur = feeTotal × fee_infrastruktur_pct/100 (→ saldo_tersedia + total_dari_fee)
feeValidator = feeTotal - feeInfrastruktur (→ neraca validator, proporsional nilai)
PEMBAYAR: developer ASLI project (p.developer_id), bukan penjual saat ini.
Contoh: harga 130rb, fee 5%, infra 50% → feeTotal 6.500, infra 3.250, validator 3.250.
Developer -6.500 = kas +3.250 + validator +3.250. Zero-sum ✓.
```

### Reward kontributor infrastruktur (zero-sum) — jalur AKTIF
```
Kontributor bayar infrastruktur NYATA (uang asli, di luar sistem) → submit bukti →
admin verifikasi (/admin form) → rewardInfrastructureContributor():
  users/{kontributor}: total_poin += nilai
  neraca_log 'kontribusi_infrastruktur' +nilai + bukti_link
  fee_pool: saldo_tersedia -= nilai, total_dialokasikan_lencana += nilai
  infrastructure_payments/{id} (catatan publik: siapa, berapa, kapan, bukti)
Jika saldo_tersedia < nilai → reward ditolak (menunggu kas terkumpul).
/infrastructure: Neraca Sistem + Reward Kontributor + Riwayat Pembayaran.

DEPRECATED: konsep sertifikat NFT infrastruktur di pool (checkAndIssueCertificate)
dinonaktifkan (bug double-debit + redundan). Fungsi tetap ada @deprecated, tidak
dipanggil. UI penerbitan disembunyikan. Digantikan reward kontributor di atas.
```

---

## Aturan neraca & konvensi (kritis)
```
Semua write nilai atomic (transaction/batch) → neraca_log.
Cek isBlocked sebelum transaksi antar user. Cek purchase_status di display NFT.
SETIAP field baru ke dokumen → WAJIB tambah ke hasOnly() allowlist rules
  (regresi terkenal: pending_buyback_actions terlupa → buyback gagal senyap).
Log sistem (anomali_ai, kontribusi_infrastruktur) pakai nft_unit_id: 'system' —
  JANGAN render sebagai Link ke /nft/[id] (halaman kosong); render plain text.
```

---

## Community Config (parameter aktif — semua transparan di /parameters)
```
harga_dasar 100000, batas_atas 150000, nilai_minimum_project 3000000,
nilai_maksimum_project 10000000, minimum_buyback_pct 50,
minimum_soldNfts_top_developer 24, purchase_autoclose_days 7, minimum_holding_days 7,
max_projects_per_user 10, min_realisasi_pct_untuk_create 20,
max_nft_in_pool_per_developer 3, kapasitas_pool_minimum, minimum_nft_pool_untuk_validasi,
fee_project_pct{2-5}, fee_trigger_per_nft 10, fee_infrastruktur_pct 50,
rate limits (20/2/30/20/300), AI params (enabled FALSE, divisor 10, min_skor 30,
revert_days 7, history_limit 50, history_days 50).
> TESTING emulator: turunkan holding 0, minimum_soldNfts 5-8, kapasitas/min pool 3-5,
> revert_days 0. PRODUCTION: nilai riil.
```

---

## Workflow pengembangan
```
1. Perubahan LOGIKA INTI → WAJIB test emulator dulu:
   firebase emulators:start --import=./emulator-data --export-on-exit  (Firestore port 8082)
   npm run dev  (.env.local: NEXT_PUBLIC_USE_EMULATOR=true)
   → RESTART emulator setelah ubah firestore.rules (rules dibaca saat start).
2. Branch per fase besar → test → merge main → Vercel auto-deploy.
3. Deploy rules: $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; firebase deploy --only firestore:rules
4. Rollback instan: Vercel Dashboard → Deployments → Promote deployment lama.
5. Test API PowerShell: (Invoke-WebRequest -Uri "..." -Method POST -Headers @{"x-recalc-secret"="..."} -UseBasicParsing).Content
6. Advisor-executor: developer (visioner) → advisor (rancang prompt) → Claude CLI (eksekusi).
   Laporan CLI panjang dikirim sebagai file .txt (lampiran inline sering terkirim kosong).
```

---

## ROADMAP — untuk pengembang berikutnya (fitur ditunda, logika siap)

```
FASE BERIKUTNYA — AI OTONOM LEVEL 2 (target: bukti platform bisa otonom):
  Endpoint /api/ai-review-auto: sambungkan komponen manual-bridge yang SUDAH ADA
  (getTopDevsForAiReview, prompt baku, parser, applyAiReview) ke Gemini API.
  Pemicu: GitHub Actions cron (gratis, seperti recalculate) 1 bulan sekali;
  cadangan Firebase Cloud Functions scheduled (hemat untuk trigger bulanan).
  Parameter kendali biaya EKSTREM: ai_auto_mode_enabled (default OFF),
  ai_auto_interval_days 30, ai_auto_max_devs_per_run, GEMINI_API_KEY (node tanpa
  key → auto mode mati, manual tetap jalan). Mode dual: semi-otonom (manual) ATAU
  full-otonom (API + masa sanggah, admin hanya pantau). Pola identik algotrading
  MT4/5 (jembatan JSON + scheduler): logika keputusan sudah jalan, tinggal jembatan.

SANGGAHAN OTONOM (menyempurnakan keadilan tanpa admin):
  Vonis AI final saat sesi penilaian. User keberatan → ajukan klarifikasi FORMAT
  WAJIB (data valid tertentu yang dibaca AI) → masuk antrian → dinilai di AI review
  BERIKUTNYA sebagai "log khusus". AI nilai valid/alibi: valid → minus berkurang
  (tidak penuh, krn kesalahan user membuat log tak jelas + biaya komputasi); tidak
  valid → minus BERTAMBAH (disinsentif alami). Admin hanya mempercepat siklus;
  tanpa admin, siklus API tetap memproses → OTONOM. Log asli + log koreksi keduanya
  permanen (tidak ada yang hilang).

INFRASTRUCTURE FUND LENGKAP:
  Tombol "Saya Sudah Berkontribusi" dari sisi USER (klaim mandiri → antrian →
  verifikasi admin/AI). Badge/lencana VISUAL di profil & NFT (struktur
  infrastructure_payments sudah siap ditambah). Halaman detail log (saat ini log
  sistem tidak punya halaman detail).

PANDUAN & DATA:
  Panduan Transaksi Sehat di /help (AI menilai POLA bukan tulisan: anomali =
  self-dealing/counterparty berulang 2 arah, kecepatan tak wajar, tanpa bukti;
  sehat = counterparty beragam, jeda wajar, ada proof_link).
  Perkaya data AI preview: tambah proof_link, transaction_description, timestamp
  detail, jeda antar-transaksi ke export (field sudah ada, makin kaya makin akurat
  tapi makin banyak reads → diparameterkan).
  Format log standar + aturan jeda transaksi (pekerjaan besar tersendiri).

KNOWN ISSUES (pre-existing, tidak mendesak):
  - Fee sharing (maybeTriggerFee): neraca developer & validator ditulis dengan
    nilai ABSOLUT (read di luar transaksi lalu write), bukan increment atomik →
    race condition teoretis jika ada transaksi concurrent. Jarang terpicu (fee
    non-critical post-buy). Perbaikan: gunakan increment() atau pindah ke transaction.
  - Global rate limit: race condition minor (read-then-write di luar transaksi) →
    bisa terlewati beberapa unit. Diterima sadar sebagai proteksi kasar.
  - Fee sharing edge: totalNilai===0 → feeValidator tak terdistribusi. Tak terjadi
    di operasi normal (NFT valid pasti punya validator bernilai).

FASE JAUH: multi-node federation aktif, state snapshot/backup ke GitHub,
  Fibonacci node spreading, near-DAPP, fully decentralized (DAO, no admin).
```

---

## Halaman
```
/, /explore, /projects, /projects/[id], /nft/[id], /validate, /pool, /create,
/dashboard, /buyback, /buyback-requests, /purchase-confirmations, /transactions,
/parameters, /top-developers, /admin, /admin/reports, /instances, /infrastructure,
/help, /ai-review, /api/recalculate
```

---

> Versi: 3.1 | Status: Fase 1-3 + Rate Limiting + AI Governance Tahap A live di production
> Menuju Fase AI Otonom Level 2. Open source — fork-friendly, batasan parametrik transparan,
> setiap node mewarisi otomatisasi via GitHub Actions.
