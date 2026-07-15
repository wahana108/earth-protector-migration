# CLAUDE.md — The Mother Earth Project (TMEP)

> Instruksi konteks untuk Claude CLI. Baca seluruh dokumen ini sebelum menyentuh kode.
> Jika ada konflik antara dokumen ini dan kode, tanyakan ke developer sebelum mengubah apapun.

---

## Apa proyek ini?

TMEP adalah platform komunitas open-source untuk mengabadikan tindakan nyata charity melalui sistem NFT berbasis konsensus. Bukan marketplace spekulatif. NFT = sertifikat pengakuan tindakan nyata. Semua nilai adalah poin simbolik reputasi, bukan uang. Platform = "lapisan pencatatan sosial": transaksi nilai nyata terjadi DI LUAR platform (eksternal); platform tidak pernah memegang risiko finansial.

**Visi realistis:** Platform = ETALASE FUNGSIONAL — bukti konsep berjalan, aman diperkenalkan tanpa takut crash/overload/tagihan. Skalabilitas sengaja DIBATASI KETAT (batasan = fitur pelindung free tier). Semua batasan = parameter transparan di /parameters (nilai ≤0 = unlimited) — pengembang berpendanaan yang fork tinggal membukanya TANPA ubah kode.

**Prinsip yang tidak boleh dilanggar:**
1. Tidak ada entitas pemegang dana — nilai di neraca user dan pool
2. Algoritma membaca neraca, bukan admin yang memutuskan
3. Nilai dari tindakan nyata yang bisa diverifikasi
4. Sistem menjamin antrian likuiditas, bukan return finansial
5. Neraca positif = buffer reputasi, BUKAN uang
6. **Konservasi nilai (zero-sum):** setiap pemotongan di satu sisi = penambahan di sisi lain. Total neraca semua entitas = 0.
7. Fibonacci = filosofi eksistensi/penyebaran organik
8. Log publik tidak boleh hilang — koreksi = entri baru, bukan penghapusan. Identitas & alasan tercatat di log tindakan admin (akuntabilitas).

**Kontrak tanggung jawab (lapak aktif):** Lapak ON = user menyatakan "saya memantau" → kelalaian memantau transaksi sendiri = tanggung jawab user (dispute window tersedia). Lapak OFF = lapak tutup, tidak ada transaksi baru → tidak ada celah dimanfaatkan. Sistem menyediakan semua alat; memakainya = pilihan sadar user.

---

## Stack & Deployment

- Next.js 15 (Turbopack) + Firebase (Firestore, Auth, Admin SDK) + Vercel (main → production)
- Repo: github.com/wahana108/earth-protector-migration | Registry federasi: earth-nft-instances
- Super admin: ramawan01@gmail.com (super_admin_email di community_config/v1)
- **Status: SEMUA FASE INTI LIVE + dalam pemantauan produksi.** Level 2 otonom aktif; fase Komunitas & Tata Kelola Mandiri baru saja merge.

### Environment variables (Vercel production SUDAH di-set)
```
NEXT_PUBLIC_SUPER_ADMIN_EMAIL, NEXT_PUBLIC_FIREBASE_*
NEXT_PUBLIC_USE_EMULATOR   → hanya 'true' di .env.local dev. TIDAK ADA di Vercel.
RECALC_SECRET              → /api/recalculate (sama dengan GitHub Secret)
AI_REVIEW_SECRET           → /api/ai-review-auto (sama dengan GitHub Secret)
GEMINI_API_KEY             → key dengan free tier terbukti (key lama/grandfathered;
                             key BARU Google tidak dapat free tier — limit 0)
GEMINI_MODEL               → opsional, override model (format: googleai/nama-model)
FIREBASE_SERVICE_ACCOUNT_KEY → base64(JSON service account) untuk Admin SDK
FIRESTORE_EMULATOR_HOST    → HANYA .env.local dev (127.0.0.1:8082). DILARANG di Vercel!
```
### GitHub Secrets: APP_URL, RECALC_SECRET, AI_REVIEW_SECRET

---

## Status Fase

```
FASE 1-2C ✓ Fondasi, inti, keamanan, tata kelola dasar
FASE 3    ✓ FIFO-only validation, Fibonacci quota, effective_buyback,
            tiered ranking, batasan stabilitas, recalculate 2 lapis
RATE LIMITING ✓ Batas harian per-user & global
AI GOVERNANCE TAHAP A ✓ Manual-bridge, watermark, konservasi nilai,
            unifikasi fee_pool, reward kontributor
AI OTONOM LEVEL 2 ✓ Gemini API bridge + cron bulanan — siklus penuh
            tanpa manusia terbukti (2026-07); dua mode berdampingan
KOMUNITAS & TATA KELOLA MANDIRI ✓ (2026-07, fase terbaru):
            lencana kontributor, lapak on/off, admin suspend,
            dispute auto-cancel, panduan transaksi sehat,
            hardening rules users, atomic increment fee sharing
```

---

## FASE KOMUNITAS & TATA KELOLA MANDIRI (terbaru — detail)

### Lencana Kontributor ("centang biru" TMEP)
```
Collection infrastructure_claims: {user_id, user_nama, nilai, bukti_link
(wajib URL), keterangan, status pending/approved/rejected, admin_uid,
alasan_penolakan, created_at, processed_at}.
User.badge_kontributor (boolean) + total_kontribusi (akumulasi approved).

ALUR: /infrastructure form klaim (guard 1-pending client-side = soft,
verifikasi admin = gerbang keras) → neraca_log 'klaim_lencana' delta 0 →
/admin antrian → SETUJUI (writeContributorRewardTx helper bersama:
cek saldo DI DALAM transaction; user +nilai +badge +total_kontribusi;
fee_pool saldo- dialokasikan+; infrastructure_payments tercatat) atau
TOLAK (alasan wajib, jejak permanen).

BADGE VISUAL: <ContributorBadge> (ShieldCheck emerald + tooltip
"Kontributor Infrastruktur · Rp X") di dashboard, top-developers,
project detail, komentar. Komentar = DENORMALIZED saat addComment
(snapshot seperti display_name, nol read tambahan; komentar lama tanpa
badge = wajar). Parameter: badge_klaim_enabled (default true).

PENTING — RULES HARDENED (temuan kritis fase ini): cabang isMe(userId)
dulu memberi tulis penuh SEMUA field → user bisa self-badge! Kini:
isMe && !affectedKeys().hasAny(['badge_kontributor','total_kontribusi',
'suspended_by_admin']). Konvensi: setiap field admin-only baru WAJIB
masuk daftar hasAny ini.
```

### Lapak Aktif/Nonaktif (kontrak tanggung jawab)
```
User.lapak_aktif?: boolean — undefined/true = AKTIF (default ON, user
lama tanpa field = aktif). Toggle di /dashboard + confirm-off dialog.
Helper: isLapakAktif(data) di ranking.ts =
  lapak_aktif !== false && suspended_by_admin !== true
(SATU helper untuk lapak + suspend — semua filter otomatis berlaku
untuk keduanya.)

IMPLEMENTASI = FILTER DI TITIK BACA (BUKAN menyentuh neraca/data —
saat ON kembali, posisi pulih otomatis karena data tak pernah berubah):
- buyNftUnit: guard keras owner-based (sellerSnap sudah di-fetch) —
  NFT yang SUDAH dimiliki orang lain tetap tradable
- fetchNextFifoNft (pool/page.tsx): skip kandidat teratas ber-owner OFF
  (1 read per kandidat, reason 'lapak_nonaktif')
- /explore + /pool grid: batch documentId() in chunk 10, dedup owner
- /projects: piggyback devSnaps yang sudah di-fetch (0 read)
- /top-developers + recalculateAllDeveloperLevels: filter in-memory
  sebelum tier/kuota — kuota Fibonacci dihitung dari USER AKTIF saja
- AI review (client + Admin): exclude OFF devs
- Kewajiban BERJALAN tetap selesai (OFF hanya blokir transaksi baru)

⚠ JEBAKAN FIRESTORE (pelajaran penting): JANGAN PERNAH
where('lapak_aktif','!=',false) — inequality query MENGECUALIKAN
dokumen tanpa field → user lama terkecualikan → kuota runtuh!
Pola benar: totalAll − totalOff (dua count equality), atau untuk
suspend: or(where('lapak_aktif','==',false),
where('suspended_by_admin','==',true)) — composite or() SDK v11.
```

### Admin Suspend (user berbahaya)
```
User.suspended_by_admin?: boolean — HANYA admin (rules hasAny).
Efek = lapak OFF (via isLapakAktif) + guard aktor: isSuspended() helper
terpisah di titik aksi (buy/validate/buyback/comment/create) →
"Akun Anda ditangguhkan administrator." (lapak OFF sendiri TIDAK
memblokir aksi user di tempat lain — hanya suspend yang memblokir.)
Dashboard: toggle lapak disabled client-side saat suspended (keputusan
sadar: tanpa rules tambahan — isLapakAktif tetap menang meski user
paksa via console).
/admin: tool email-lookup Tangguhkan/Pulihkan (alasan WAJIB) + card
"User Ditangguhkan" (query equality suspended==true, pulihkan 1 klik).
AUDIT TRAIL: neraca_log 'admin_suspend'/'admin_unsuspend' delta 0
dengan target_email + target_nama + alasan + counterparty_id adminUid —
siapa pun bisa melihat siapa di-suspend & kenapa dari log, tanpa console.
```

### Dispute Auto-Cancel (anti-menggantung, simetri auto-complete)
```
MASALAH LAMA: reportPurchase set purchase_status 'disputed' →
autoCompletePurchase no-op → menggantung selamanya menunggu admin.
KINI: autoCancelDisputedPurchase() — jika dispute TIDAK ditangani
sampai deadline yang ADA (purchase_auto_complete_at, TANPA delay baru):
NFT kembali ke penjual, total_poin_pending pembeli dikurangi,
purchase_status 'cancelled', dispute 'auto_cancelled', neraca_log
'dispute_auto_cancel' DUA SISI (jejak untuk analisis AI kelak).
Lazy check di 3 titik (dashboard pembeli, purchase-confirmations
penjual, /admin loadDisputes — zero extra reads).
SIMETRI INSENTIF: diam tanpa report = jadi (auto-complete); report +
admin diam = batal (auto-cancel). Penjual ber-reputasi mudah dihukum
bila report palsu (pola report berlebihan = anomali di mata AI).
Admin tetap bisa resolve manual SEBELUM deadline. Scope: purchase
dispute saja (buyback dispute tidak disentuh).
```

### Peran (pembagian tugas)
```
SUPER ADMIN: kendali node, tak bisa dicabut dari dalam platform.
ADMIN = menjaga NILAI: klaim, AI review/revert, dispute, suspend,
parameter, recalculate, angkat moderator. Semua yang menggerakkan
poin/status = admin (akuntabilitas zero-sum).
MODERATOR = menjaga RUANG: moderasi komentar/konten. TIDAK menyentuh
neraca. Hirarki dirancang MENYUSUT: dispute→auto-cancel ✓,
anomali→AI otonom ✓, klaim→AI (roadmap), sanggahan→AI (roadmap).
```

---

## ARSITEKTUR AI OTONOM LEVEL 2

### Endpoint /api/ai-review-auto (POST, x-ai-review-secret)
```
13 langkah: auth → config → guard (ai_governance_enabled &&
ai_auto_mode_enabled && GEMINI_API_KEY) → guard interval
(fee_pool/v1.last_auto_review_at vs ai_auto_interval_days) → fetch devs
(Admin SDK, top_developer+kandidat AKTIF, sort last_ai_review_at tertua/
null-first, limit ai_auto_max_devs_per_run) → logs (watermark) →
aggregate → buildAiReviewPrompt → Gemini (fallback chain) →
parseAiOutput → applyAiReviewAdmin → update timestamp → JSON.
Guard gagal → {ok:true,skipped:true,reason} (cron hijau).
Error → {ok:false,step,error}. Aktor otonom: 'ai-auto' (vs UID admin
manual, 'system' operasi lain). Keputusan FINAL via masa sanggah.
Cron: monthly-ai-review.yml (tanggal 1, 02:00 WITA + dispatch).
```

### Pola Hybrid (dua SDK berdampingan)
```
ai-review.ts (client, manual-bridge — tak disentuh) +
ai-review-server.ts (Admin SDK: getTopDevsForAiReviewAdmin,
fetchDevLogsAdmin, applyAiReviewAdmin) + firebase-admin.ts (init dari
FIREBASE_SERVICE_ACCOUNT_KEY base64). Fungsi PURE dipakai bersama:
aggregateDevData, buildAiReviewPrompt, parseAiOutput, calcMinusNeraca.
firebase-admin di dependencies (bukan dev)!
```

### Prompt baku (satu sumber manual & otonom)
```
Peran → KONTEKS KOMUNITAS (total user N, dev dinilai M — kalibrasi
komunitas kecil) → DATA (id 6-char anonim, jual/buyback/counterparty
top-3 dua arah) → INSTRUKSI: "TANPA aktivitas = WAJIB skor 0, JANGAN
skor kecil karena ragu" + "skor >0 HANYA dengan bukti konkret dirujuk
di alasan" → format: SKOR: [id] | [0-100] | [alasan ≤80 char].
Terbukti: Gemini merujuk ID counterparty di alasan.
```

### AI Governance Tahap A (manual-bridge) — berdampingan
```
/ai-review: export → prompt → paste hasil → preview → apply (zero-sum,
watermark User.last_ai_review_at, log 'anomali_ai'/'anomali_ai_bersih'/
'anomali_ai_revert' dengan alasan + reverted_by). Revert = kebijakan
manual admin; watermark tidak mundur. minus = floor(skor/divisor) ×
harga_dasar; skor<min_skor → dibagi 2.
```

---

## NERACA SISTEM (fee_pool/v1)

```
saldo_tersedia = KAS AKTIF = (dari_fee + dari_anomali + dari_lain) −
dialokasikan_lencana. + last_auto_review_at.

FEE SHARING (zero-sum, kini ATOMIC INCREMENT): terpicu saat NFT 'valid'
terjual & jumlah_nft_terjual % fee_trigger_per_nft == 0. PEMBAYAR:
developer ASLI. feeInfrastruktur → kas; feeValidator → dibagi
PROPORSIONAL nilai validasi, langsung saat terpicu, increment() atomik
(fix race condition — read dipertahankan sebagai existence guard,
write kini increment). NFT valid diperdagangkan terus di explorer =
fee berulang validator; masuk FIFO & terbeli → biasa lagi sampai
revalidasi.

REWARD KONTRIBUTOR: via klaim (di atas) atau langsung admin — helper
writeContributorRewardTx bersama, saldo dicek dalam transaction.
DEPRECATED: sertifikat NFT pool (double-debit; @deprecated, UI hidden).
```

---

## Konvensi kritis
```
- Semua write nilai atomic (tx/batch/increment) → neraca_log. Zero-sum.
- Field baru → WAJIB cek hasOnly()/hasAny() allowlist rules. Field
  admin-only → masuk hasAny larangan isMe (badge, total_kontribusi,
  suspended_by_admin).
- JANGAN where('field','!=',...) untuk field yang bisa undefined —
  inequality mengecualikan dokumen tanpa field! Pakai equality count /
  or() / filter in-memory.
- Log sistem nft_unit_id 'system' → render plain text, BUKAN Link.
- Badge/tooltip (Radix div) JANGAN di dalam <p> → hydration error.
  Wadah: div/span.
- RateLimitError & error domain: cek instanceof SEBELUM pesan generik.
- Emulator: restart setelah ubah rules; FIRESTORE_EMULATOR_HOST untuk
  Admin SDK dev.
- Deploy rules SEBELUM merge kode yang membutuhkannya:
  $env:NODE_TLS_REJECT_UNAUTHORIZED="0"; firebase deploy --only firestore:rules
- Build stuck .next/trace = lingkungan Windows (antivirus/lock), bukan
  kode → rm .next + rebuild; tsc --noEmit sebagai verifikasi cepat.
- Rollback: Vercel → Deployments → Promote.
- Test API: (Invoke-WebRequest -Uri "..." -Method POST -Headers @{"x-...-secret"="..."} -UseBasicParsing).Content
- Workflow: advisor merancang prompt → Claude CLI eksekusi → laporan
  file .txt. Branch: push -u di awal, merge setelah teruji.
```

---

## Community Config production (aktif)
```
harga_dasar 100000, batas_atas 150000, nilai_min/maks_project 3jt/10jt,
minimum_buyback_pct 50, minimum_soldNfts_top_developer 24,
purchase_autoclose_days 7, minimum_holding_days 7, max_projects 10,
min_realisasi_pct 20, max_nft_in_pool_per_developer 3, fee 2-5%,
fee_trigger_per_nft 10, fee_infrastruktur_pct 50, rate limits
20/2/30/20/300, badge_klaim_enabled true, AI: governance & auto AKTIF
(dipantau), divisor 10, min_skor 30, revert_days 7, interval 30,
max_devs_per_run 10.
> TESTING emulator: holding 0, min_soldNfts 5-8, pool 3-5, revert_days 0,
> mundurkan last_auto_review_at / purchase_auto_complete_at manual.
```

---

## ROADMAP — pengembangan berikutnya

```
SANGGAHAN OTONOM: vonis final; keberatan → klarifikasi FORMAT WAJIB →
  antrian → dinilai AI review berikutnya sebagai log khusus (valid →
  minus berkurang sebagian; alibi → minus BERTAMBAH). Report memberatkan,
  gugatan meringankan — masuk agregasi prompt AI. Log dispute_auto_cancel
  & klaim sudah dirancang sebagai bahan analisis ini.

VERIFIKASI KLAIM LENCANA OLEH AI: antrian klaim dibaca AI (bukti link
  dianalisis) → pola manual→otonom yang sama dengan AI review.

PERKAYA DATA AI: proof_link, transaction_description, timestamp detail,
  jeda antar-transaksi ke export (diparameterkan krn reads). Format log
  standar + aturan jeda.

BADGE BERTINGKAT (perak/emas berdasar total_kontribusi) — fondasi siap.

USER AKTIF LANJUTAN: pruning paksa TERGANTIKAN lapak on/off sukarela.
  Tersisa jika perlu: auto-OFF setelah tidak aktif periode sangat lama.

UPDATE ROADMAP PUBLIK di /help (manual, ringan): 4 fase tercapai.

KNOWN ISSUES (terdokumentasi sadar):
- Gemini key BARU tanpa free tier → pakai key lama/billing; fallback
  chain + GEMINI_MODEL env = mitigasi lineup model berubah.
- Global rate limit: race minor (proteksi kasar, diterima).
- Fee edge totalNilai==0 (tak terjadi normal).
- Guard 1-pending klaim client-side saja (admin = gerbang keras).
- Build lokal kadang stuck .next lock (lingkungan Windows, bukan kode).

FASE JAUH: multi-node federation aktif, snapshot/backup GitHub,
  Fibonacci node spreading, near-DAPP, Level 3 (DAO, no admin).
```

---

## Halaman
```
/, /explore, /projects, /projects/[id], /nft/[id], /validate, /pool,
/create, /dashboard, /buyback, /buyback-requests, /purchase-confirmations,
/transactions, /parameters, /top-developers, /admin, /admin/reports,
/instances, /infrastructure, /help, /ai-review, /profile,
/recommendations, /api/recalculate, /api/ai-review-auto
```

---

> Versi: 3.3 | Fase Komunitas & Tata Kelola Mandiri LIVE (2026-07):
> lencana kontributor, lapak on/off, admin suspend, dispute auto-cancel,
> panduan transaksi sehat, hardening rules, atomic increment.
> Platform kini berakuntabilitas: setiap tindakan admin tercatat publik,
> setiap sengketa terselesaikan otomatis, setiap kontribusi berlencana.
> Menuju: sanggahan otonom & verifikasi klaim AI.
