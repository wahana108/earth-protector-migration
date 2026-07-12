# CLAUDE.md — The Mother Earth Project (TMEP)

> Instruksi konteks untuk Claude CLI. Baca seluruh dokumen ini sebelum menyentuh kode.
> Jika ada konflik antara dokumen ini dan kode, tanyakan ke developer sebelum mengubah apapun.

---

## Apa proyek ini?

TMEP adalah platform komunitas open-source untuk mengabadikan tindakan nyata charity melalui sistem NFT berbasis konsensus. Bukan marketplace spekulatif. NFT = sertifikat pengakuan tindakan nyata. Semua nilai adalah poin simbolik reputasi, bukan uang.

**Visi realistis:** Platform = ETALASE FUNGSIONAL — bukti konsep berjalan, aman diperkenalkan tanpa takut crash/overload/tagihan. Skalabilitas sengaja DIBATASI KETAT (batasan = fitur pelindung free tier). Semua batasan = parameter transparan di /parameters (nilai ≤0 = unlimited) — pengembang berpendanaan yang fork tinggal membukanya TANPA ubah kode.

**Prinsip yang tidak boleh dilanggar:**
1. Tidak ada entitas pemegang dana — nilai di neraca user dan pool
2. Algoritma membaca neraca, bukan admin yang memutuskan
3. Nilai dari tindakan nyata yang bisa diverifikasi
4. Sistem menjamin antrian likuiditas, bukan return finansial
5. Neraca positif = buffer reputasi, BUKAN uang
6. **Konservasi nilai (zero-sum):** setiap pemotongan di satu sisi = penambahan di sisi lain. Total neraca semua entitas = 0.
7. Fibonacci = filosofi eksistensi/penyebaran organik
8. Log publik tidak boleh hilang — koreksi = entri baru, bukan penghapusan

---

## Stack & Deployment

- Next.js 15 (Turbopack) + Firebase (Firestore, Auth) + Vercel (main → production)
- Repo: github.com/wahana108/earth-protector-migration | Registry federasi: earth-nft-instances
- Super admin: ramawan01@gmail.com (super_admin_email di community_config/v1)
- **Status: LEVEL 2 OTONOM TERCAPAI & LIVE.** Semua fitur AI aktif di production, dalam pemantauan.

### Environment variables (Vercel production SUDAH di-set)
```
NEXT_PUBLIC_SUPER_ADMIN_EMAIL, NEXT_PUBLIC_FIREBASE_*
NEXT_PUBLIC_USE_EMULATOR   → hanya 'true' di .env.local dev. TIDAK ADA di Vercel.
RECALC_SECRET              → /api/recalculate (sama dengan GitHub Secret)
AI_REVIEW_SECRET           → /api/ai-review-auto (sama dengan GitHub Secret)
GEMINI_API_KEY             → key dengan akses free tier terbukti (key lama; key BARU
                             Google tidak dapat free tier — limit 0. Lihat Known Issues)
GEMINI_MODEL               → opsional, override model (format: googleai/nama-model)
FIREBASE_SERVICE_ACCOUNT_KEY → base64(JSON service account) untuk Admin SDK
FIRESTORE_EMULATOR_HOST    → HANYA di .env.local dev (127.0.0.1:8082) agar Admin SDK
                             menulis ke emulator. TIDAK BOLEH ada di Vercel!
```
### GitHub Secrets: APP_URL, RECALC_SECRET, AI_REVIEW_SECRET

---

## Status Fase

```
FASE 1-2C ✓ Fondasi, inti, keamanan, tata kelola dasar
FASE 3    ✓ FIFO-only validation, Fibonacci quota, effective_buyback,
            tiered ranking, batasan stabilitas, recalculate 2 lapis
RATE LIMITING ✓ Batas harian per-user & global (proteksi biaya)
AI GOVERNANCE TAHAP A ✓ Manual-bridge, watermark, konservasi nilai,
            unifikasi fee_pool, reward kontributor
AI OTONOM LEVEL 2 ✓ TERCAPAI: Gemini API bridge + cron bulanan —
            siklus penuh TANPA manusia terbukti (2026-07):
            deteksi self-dealing berbasis bukti → vonis → minus →
            zero-sum → efek peringkat. Dua mode berdampingan
            (manual-bridge & otonom).
```

---

## ARSITEKTUR AI OTONOM LEVEL 2 (fase terbaru)

### Endpoint /api/ai-review-auto (POST, header x-ai-review-secret)
```
13 langkah: auth → load config → guard (ai_governance_enabled &&
ai_auto_mode_enabled && GEMINI_API_KEY) → guard interval
(fee_pool/v1.last_auto_review_at vs ai_auto_interval_days) →
fetch devs (Admin SDK, top_developer+kandidat, sort last_ai_review_at
TERTUA dulu/null-first, limit ai_auto_max_devs_per_run) →
fetch logs (hormati watermark) → aggregate → buildAiReviewPrompt →
Gemini (fallback chain) → parseAiOutput → applyAiReviewAdmin →
update last_auto_review_at → response JSON.

Guard yang tidak lolos → { ok:true, skipped:true, reason } (cron tetap hijau).
Error per langkah → { ok:false, step:'...', error } (mudah debug).
created_by/counterparty_id run otonom = 'ai-auto' (vs UID admin di manual,
'system' di operasi sistem lain — tiga aktor, tiga penanda).
Keputusan otonom = FINAL via masa sanggah (ai_review_revert_days;
revert manual admin tetap ada sebagai kebijakan).
```

### Pola Hybrid (Opsi C) — dua SDK berdampingan
```
src/lib/ai-review.ts        → client SDK, manual-bridge (TIDAK disentuh)
src/lib/ai-review-server.ts → Admin SDK: getTopDevsForAiReviewAdmin,
                              fetchDevLogsAdmin, applyAiReviewAdmin
src/lib/firebase-admin.ts   → init dari FIREBASE_SERVICE_ACCOUNT_KEY
                              (base64→JSON), HMR-safe guard
Fungsi PURE dipakai bersama (satu sumber kebenaran, zero duplikasi):
aggregateDevData, buildAiReviewPrompt, parseAiOutput, calcMinusNeraca.
firebase-admin WAJIB di dependencies (bukan devDependencies) untuk Vercel.
```

### Gemini fallback chain (pelajaran dari lineup model Google yang berubah-ubah)
```
MODEL_CANDIDATES = [GEMINI_MODEL env, gemini-2.5-flash-lite,
  gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash-lite, gemini-2.0-flash]
Coba berurutan; error /404|429|not available|quota|no longer|retired/i
→ lanjut kandidat berikutnya. Sukses → response menyertakan model_used.
Konfigurasi genkit.ts (plugin @genkit-ai/google-genai, temperature 0.15).
```

### Prompt baku (buildAiReviewPrompt — SATU sumber untuk manual & otonom)
```
Struktur: peran → KONTEKS KOMUNITAS (total user N, dev dinilai M —
kalibrasi ukuran komunitas, cegah false positive komunitas kecil) →
DATA (id 6-char anonim, jual/buyback/counterparty top-3 dua arah) →
INSTRUKSI: fokus self-dealing/volume/sirkular; ATURAN KRITIS:
"tanpa aktivitas = WAJIB skor 0" + "skor >0 HANYA dengan bukti konkret
yang dirujuk di alasan" → format output PERSIS:
SKOR: [id_6char] | [0-100] | [alasan maks 80 char]
Terbukti: Gemini merujuk ID counterparty di alasan (mis.
"Counterparty jual & buyback berulang (bUhVWb)").
```

### Cron: .github/workflows/monthly-ai-review.yml
```
Tanggal 1 tiap bulan 02:00 WITA + workflow_dispatch (test manual).
curl POST + header secret. Node fork: set 3 env Vercel + 1 GitHub Secret
+ nyalakan parameter → otonom aktif.
```

### Parameter AI otonom (community_config)
```
ai_auto_mode_enabled (master switch otonom), ai_auto_interval_days 30,
ai_auto_max_devs_per_run 10 (pelindung biaya; fork tinggal naikkan).
Prioritas run: top developer + kandidat SAAT INI (yang turun peringkat
tidak direview — posisi teratas = posisi yang diawasi), urut watermark
tertua (yang paling lama belum dinilai duluan; kembali ke puncak =
langsung prioritas).
```

---

## AI GOVERNANCE TAHAP A (manual-bridge) — tetap aktif berdampingan

```
/ai-review (admin): export data → salin ke AI eksternal → paste hasil →
parse → preview → apply. Parameter: ai_governance_enabled (master),
ai_review_history_limit 50, ai_review_history_days 50,
ai_anomali_divisor 10, ai_anomali_min_skor 30, ai_review_revert_days 7.
minus_nft = floor(skor/divisor); skor<min_skor → floor(skor/divisor/2).
minus = minus_nft × harga_dasar. Efek peringkat OTOMATIS via
effective_buyback (tanpa logika hukuman baru).

WATERMARK: User.last_ai_review_at — log yang sudah dinilai TERSEGEL
(fetchDevLogs pakai '>'). applyAiReview set watermark SEMUA dev dinilai
(termasuk skor 0 → log 'anomali_ai_bersih' delta 0 sebagai audit).
Revert TIDAK memundurkan watermark. Rules: hanya admin (di luar hasOnly).

KONSERVASI: user -X → fee_pool total_dari_anomali +X, saldo_tersedia +X.
Revert simetris per-entry. Log revert menyertakan alasan
("Pembatalan: [alasan asli]") + reverted_by (UID admin).

MASA SANGGAH: window mencatat keberatan, BUKAN pembalikan otomatis.
Keputusan AI final; revert admin = kebijakan manual meringankan.
Log gugatan/report akan masuk agregasi AI di masa depan (roadmap).
```

---

## NERACA SISTEM (fee_pool/v1) — sumber tunggal

```
saldo_tersedia = KAS AKTIF = (total_dari_fee + total_dari_anomali +
total_dari_lain) - total_dialokasikan_lencana.
+ last_auto_review_at (penanda run otonom terakhir).
total_terkumpul/terdistribusi = audit lama (dipertahankan).

FEE SHARING (terverifikasi zero-sum): terpicu saat NFT 'valid' terjual &
jumlah_nft_terjual % fee_trigger_per_nft == 0. feeTotal = harga ×
feeProjectPct%. PEMBAYAR: developer ASLI project. feeInfrastruktur
(fee_infrastruktur_pct%) → saldo_tersedia + total_dari_fee.
feeValidator (sisa) → dibagi PROPORSIONAL nilai validasi:
share = (nilai_validator / total_nilai) × feeValidator, langsung ke
neraca tiap validator saat fee terpicu (tidak menunggu akumulasi).
NFT valid yang terus diperdagangkan di explorer = fee berulang bagi
validator (insentif memvalidasi project berkualitas). NFT valid masuk
FIFO & terbeli → jadi biasa lagi sampai revalidasi.

REWARD KONTRIBUTOR (jalur aktif): bayar infrastruktur NYATA → bukti →
admin verifikasi (/admin) → kontributor +nilai, saldo_tersedia -nilai,
total_dialokasikan_lencana +nilai, tercatat infrastructure_payments
(publik). Saldo kurang → reward menunggu. DEPRECATED: sertifikat NFT
pool (double-debit bug; fungsi @deprecated, UI disembunyikan).
```

---

## Konvensi kritis
```
- Semua write nilai atomic (tx/batch) → neraca_log. Zero-sum selalu.
- SETIAP field baru → WAJIB cek hasOnly() allowlist rules (regresi:
  pending_buyback_actions dulu terlupa → gagal senyap).
- Log sistem nft_unit_id: 'system' → render plain text, BUKAN Link.
- RateLimitError & domain error: cek instanceof SEBELUM pesan generik.
- Emulator: restart setelah ubah rules; NEXT_PUBLIC_USE_EMULATOR untuk
  client+server; FIRESTORE_EMULATOR_HOST untuk Admin SDK.
- Deploy rules: $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; firebase deploy --only firestore:rules
- Rollback: Vercel → Deployments → Promote deployment lama.
- Test API PowerShell: (Invoke-WebRequest -Uri "..." -Method POST -Headers @{"x-...-secret"="..."} -UseBasicParsing).Content
- Workflow: advisor merancang prompt → Claude CLI eksekusi → laporan
  via file .txt (lampiran inline sering kosong).
- Branch fitur: push di awal (git push -u origin feat/...), merge ke
  main setelah teruji.
```

---

## Community Config production (nilai riil aktif)
```
harga_dasar 100000, batas_atas 150000, nilai_min/maks_project 3jt/10jt,
minimum_buyback_pct 50, minimum_soldNfts_top_developer 24,
purchase_autoclose_days 7, minimum_holding_days 7, max_projects_per_user 10,
min_realisasi_pct 20, max_nft_in_pool_per_developer 3, fee 2-5%,
fee_trigger_per_nft 10, fee_infrastruktur_pct 50, rate limits 20/2/30/20/300,
AI: governance & auto AKTIF (dipantau), divisor 10, min_skor 30,
revert_days 7, interval 30 hari, max_devs_per_run 10.
> TESTING emulator: holding 0, min_soldNfts 5-8, pool 3-5, revert_days 0,
> mundurkan last_auto_review_at manual untuk lolos guard interval.
```

---

## ROADMAP — pengembangan berikutnya

```
PRIORITAS BERIKUT — BADGE/LENCANA KONTRIBUTOR (dibahas sesi depan):
  Badge visual = "centang biru" TMEP: label kontributor di profil & NFT
  (seperti verified X/Telegram) — user merasa spesial, insentif mudah
  untuk mendukung eksistensi & update platform. Idealnya menyertakan
  NILAI kontribusi pada badge. Komponen: tombol "Saya Sudah Berkontribusi"
  (klaim user → antrian → verifikasi admin/AI), badge visual di profil +
  disematkan di NFT, tampilan nilai kontribusi. Data infrastructure_payments
  sudah siap sebagai fondasi.

SANGGAHAN OTONOM: vonis final; keberatan → klarifikasi FORMAT WAJIB →
  antrian → dinilai AI review berikutnya sebagai log khusus (valid →
  minus berkurang sebagian; alibi → minus BERTAMBAH sbg disinsentif +
  biaya komputasi). Report user memberatkan, gugatan meringankan —
  keduanya masuk agregasi prompt AI masa depan.

USER AKTIF & PRUNING: nonaktifkan/sembunyikan developer terbawah tanpa
  aktivitas periodik → total user berubah → kuota Fibonacci menyesuaikan
  (recalculate). Menjaga slot top developer relevan dengan komunitas hidup.

PERKAYA DATA AI: proof_link, transaction_description, timestamp detail,
  jeda antar-transaksi ke export (field sudah ada; makin kaya makin akurat,
  diparameterkan krn reads). Format log standar + aturan jeda transaksi.

PANDUAN /help: "Transaksi Sehat" — AI menilai POLA: anomali = self-dealing/
  kecepatan tak wajar/tanpa bukti; sehat = counterparty beragam, jeda wajar,
  ada proof_link. (Draft prompt pernah dibuat, belum diterapkan.)

KNOWN ISSUES (pre-existing, terdokumentasi sadar):
- Gemini API key BARU Google tidak dapat free tier (limit 0) — pakai key
  lama/grandfathered atau aktifkan billing. Fallback chain + GEMINI_MODEL
  env = mitigasi lineup model yang berubah.
- Fee sharing: neraca developer/validator ditulis nilai ABSOLUT (bukan
  increment) → race teoretis. Perbaikan: increment()/transaction.
- Global rate limit: race minor (diterima sebagai proteksi kasar).
- Fee edge: totalNilai==0 → feeValidator tak terdistribusi (tak terjadi
  di operasi normal).

FASE JAUH: multi-node federation aktif, snapshot/backup GitHub, Fibonacci
  node spreading, near-DAPP, fully decentralized (Level 3: DAO, no admin).
```

---

## Halaman
```
/, /explore, /projects, /projects/[id], /nft/[id], /validate, /pool,
/create, /dashboard, /buyback, /buyback-requests, /purchase-confirmations,
/transactions, /parameters, /top-developers, /admin, /admin/reports,
/instances, /infrastructure, /help, /ai-review,
/api/recalculate, /api/ai-review-auto
```

---

> Versi: 3.2 | LEVEL 2 OTONOM TERCAPAI — siklus AI penuh tanpa manusia
> terbukti di production (2026-07). Dua mode berdampingan: manual-bridge
> (admin) & otonom (Gemini + cron). Open source, fork-friendly: 3 env +
> 1 secret + 1 parameter = node otonom baru.
