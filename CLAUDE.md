# CLAUDE.md — The Mother Earth Project (TMEP)

> Dokumen ini adalah instruksi konteks untuk Claude CLI.
> Baca seluruh dokumen ini sebelum menyentuh kode apapun.
> Jika ada konflik antara dokumen ini dan kode yang ada, tanyakan ke developer sebelum mengubah apapun.

---

## Apa proyek ini?

TMEP adalah platform komunitas untuk mengabadikan tindakan nyata charity melalui sistem NFT berbasis konsensus. Bukan marketplace NFT biasa. Bukan DeFi konvensional.

**Prinsip yang tidak boleh dilanggar dalam implementasi:**
1. Tidak ada entitas yang memegang dana — semua nilai ada di neraca user dan pool
2. Algoritma membaca neraca, bukan admin yang memutuskan
3. Nilai berasal dari tindakan nyata yang bisa diverifikasi
4. Sistem menjamin antrian likuiditas, bukan return finansial

---

## Stack teknologi saat ini

- **Frontend:** React (Lovable.dev mockup sebagai referensi UI)
- **Backend:** Firebase (Firestore, Auth, Functions)
- **Status:** Fase 1 — implementasi logika dasar

---

## Entitas utama dan relasinya

```
User
├── level: 'developer_biasa' | 'top_developer'
├── neraca: { total_poin, log[] }
└── validator_aktif: [{ project_id, nft_unit_ids[], nilai_total }]

Project (dibuat Developer)
├── jumlah_nft = nilai_project / 100000  // default 30 NFT jika nilai Rp 3 juta
├── status_project: 'aktif' | 'dalam_invalidasi'
├── pool_jaminan: number
├── jumlah_validator: number
└── nft_units: NFTUnit[]

NFTUnit (satuan yang diperjualbelikan)
├── owner_id
├── status: 'biasa' | 'valid' | 'invalid'
├── harga_jual: number  // max Rp 150.000, sistem blokir jika lebih
├── harga_beli_terakhir: number
├── nilai_selisih: harga_beli_terakhir - 100000
├── digunakan_validasi: boolean
└── project_validasi_id: string | null

PoolRekomendasi
├── hanya NFT dari top_developer
├── kapasitas aktif jika >= 30 top_developer atau 90 NFT
└── nft_valid_list: NFTUnit[]
```

---

## Aturan bisnis kritis — jangan pernah melanggar ini

### Aturan harga
```
harga_dasar = 100000  // Rp 100.000, tidak bisa diubah
batas_atas  = 150000  // Rp 150.000, sistem BLOKIR jika form input melebihi ini
```

### Aturan neraca saat transaksi jual-beli
```
nilai_selisih = harga_jual - harga_dasar

PENJUAL: neraca += -(nilai_selisih)   // selalu minus atau nol
PEMBELI: neraca += +(nilai_selisih)   // selalu plus atau nol

Contoh jual Rp 120.000:
  penjual: -20.000
  pembeli: +20.000

Contoh jual Rp 100.000 (harga dasar):
  penjual: 0
  pembeli: 0
```

**PERHATIAN:** Penjual TIDAK pernah mendapat poin positif dari penjualan. Pembeli TIDAK pernah mendapat poin negatif dari pembelian. Ini fundamental — jangan dibalik.

### Aturan validasi
```
Unit validasi = NFT Unit (bukan poin parsial)
User memilih NFT mana (checkbox) untuk digunakan validasi project tertentu
Setiap NFT yang dipilih = 1 validator dengan nilai = nilai_selisihnya

Setelah digunakan validasi:
  nft_unit.digunakan_validasi = true
  nft_unit.project_validasi_id = project.id
  nft_unit.harga_beli_terakhir = 100000  // reset ke harga dasar untuk buyback
  project.pool_jaminan += nilai_selisih_nft
  project.jumlah_validator += 1

User bisa memvalidasi BANYAK project sekaligus dengan NFT yang berbeda-beda
```

### Aturan buyback
```
Skenario A — buyback ke pembuat (ada history transaksi):
  harga = harga_beli_terakhir yang tersimpan di history

Skenario B — jual ke user lain atau keluar sistem:
  harga = selalu 100.000 (harga dasar)

Skenario C — NFT sudah digunakan validasi:
  harga = 100.000 (sudah direset saat validasi)
```

### Aturan status NFT
```
biasa   → default saat diterbitkan
valid   → ketika project-nya divalidasi oleh top_developer
invalid → ketika kuota berkurang atau developer turun peringkat

Transisi valid → invalid:
  TIDAK langsung — ada jeda toleransi waktu
  NFT masuk daftar_invalidasi = true
  Status tetap 'valid' sampai terbeli
  Setelah terbeli → status = 'biasa' (bukan 'valid', tidak kembali ke pool)
```

### Aturan AI monitoring
```
Anomali 0%    → tidak ada tindakan, posisi tidak berubah
Anomali 1-99% → flag untuk review, dicatat di log
Anomali 100%  → transaksi dianggap tidak ada (dihapus dari perhitungan)

AI tidak memberi nilai positif — hanya mendeteksi anomali
Parameter anomali harus transparan dan terdokumentasi
```

---

## Halaman utama yang perlu diimplementasi

### 0. Community Parameters (publik, read-only)
Halaman pertama yang di-setup administrator saat komunitas dibentuk. Menampilkan semua variabel sistem secara transparan — harga dasar, batas atas, nilai minimum project, syarat top developer, formula Fibonacci, threshold AI monitoring, dan status fase pengembangan. Semua orang bisa melihat ini sebelum bertransaksi. Hanya administrator yang bisa mengubah nilainya. Ini adalah "kontrak sosial" komunitas yang dipublikasikan.

Data yang disimpan di Firestore collection `community_config` (single document):
```
harga_dasar: 100000
batas_atas: 150000
nilai_minimum_project: 3000000
minimum_buyback_pct: 50
fee_project_pct: { min: 2, max: 5 }
minimum_top_developer: 30
kapasitas_pool_minimum: 90
fase_aktif: 1
ai_provider: string
ai_anomali_threshold: { flag: 1, invalid: 100 }
```

### 1. Explorer (publik)
Semua NFT dari semua developer bisa ditemukan di sini. Tidak ada filter khusus top developer. User bebas membeli NFT berdasarkan kepercayaan mereka sendiri.

### 2. Pool Rekomendasi
Hanya NFT valid dari top developer. Ada antrian likuiditas. Hanya aktif jika kapasitas Fibonacci terpenuhi.

### 3. Halaman Validasi
Menampilkan daftar **project** (bukan NFT satuan) milik top developer. Diurutkan berdasarkan `like_count`. User memilih project yang ingin divalidasi, lalu memilih NFT mana (checkbox) dari dashboard mereka yang akan digunakan.

### 4. Dashboard Neraca
Menampilkan:
- Total poin neraca
- Daftar NFT yang dimiliki (dengan harga beli, nilai selisih, status validasi)
- Status validator aktif (project mana, nilai terkunci, fee diterima)
- Log transaksi

### 5. Ranking Developer
Semua user/developer ditampilkan. Profil dengan anomali tinggi atau neraca minus berkepanjangan ditandai merah.

---

## Form pendaftaran NFT project — field wajib

```
FIELD WAJIB (sistem tolak jika kosong):
├── nama_project       : string   — untuk listing index project
├── nama_nft           : string   — identitas satuan NFT
├── link_bukti         : string   — URL dokumentasi nyata (foto/video/dokumen)
├── tanggal_tindakan   : date     — AI gunakan untuk deteksi anomali waktu
├── kategori           : enum     — lingkungan/sosial/pendidikan/kesehatan/lainnya
├── nilai_project      : number   — min Rp 3.000.000
└── harga_jual         : number   — Rp 100.000–150.000, sistem blokir jika lebih

FIELD DISARANKAN:
├── lokasi_tindakan    : string   — nama tempat atau koordinat
├── deskripsi_project  : string   — narasi singkat, AI cek konsistensi dengan kategori
└── jumlah_nft         : number   — otomatis: nilai_project / 100.000 (tidak perlu diisi user)
```

## Index halaman — Fase 1

```
Index NFT      → urut berdasarkan like_count per NFT unit
                 filter berdasarkan kategori charity

Index Project  → urut berdasarkan akumulasi like semua NFT-nya
                 tampilkan jumlah NFT terjual vs total

Index Developer→ urut berdasarkan persentase buyback (transparan dari awal)
                 tandai merah jika anomali_score tinggi
                 (belum ada badge Top Developer — syarat belum bisa terpenuhi Fase 1)
```

## Komentar per NFT — Fase 1

Komentar ditempatkan di kartu NFT, bukan di halaman project.

```
Struktur Firestore:
nft_units/{nftId}/comments/{commentId}
  ├── user_id       : string
  ├── display_name  : string
  ├── text          : string (max 500 karakter)
  ├── timestamp     : Timestamp
  └── anomali_flag  : boolean (default false)

Fase 1: teks + user + timestamp saja
Fase 2: reply/thread, like komentar, report komentar, AI moderasi
```

## AI Monitoring — Fase 1 (ringan)

```
Yang diimplementasi Fase 1:
→ HTTP check: apakah link_bukti URL masih aktif saat project didaftarkan
→ Tandai project dengan anomali_flag jika link mati setelah diterbitkan
→ Cek berkala (tidak real-time)

Yang ditunda Fase 2:
→ Analisis pola transaksi anomali
→ Konsistensi deskripsi vs kategori
→ Deteksi jual-beli sendiri untuk manipulasi poin
```

## Urutan implementasi Fase 1

```
① Form pendaftaran project NFT (dengan semua field wajib)
② Logika transaksi beli NFT (neraca penjual minus, pembeli plus)
③ Dashboard neraca user (total poin, daftar NFT, log transaksi)
④ Index NFT + Project + Developer (explorer dengan sorting/filter)
⑤ Komentar per kartu NFT (sederhana, tanpa thread)
⑥ AI ringan — validasi link bukti (HTTP check)
```

## Yang BELUM diimplementasi (jangan sentuh dulu)

- Fibonacci capacity calculation yang dinamis
- Fee sharing otomatis ke validator
- Validasi bergulir otomatis
- DAPP / blockchain integration
- Lazy minting NFT
- Personal blocklist
- AI monitoring penuh (analisis anomali transaksi)
- Reply/thread komentar
- Badge Top Developer

Fitur-fitur ini masuk **Fase 2 dan Fase 3**. Fokus Fase 1 adalah logika dasar transaksi, neraca, struktur data, index, dan komentar sederhana.

---

## Cara kerja dengan codebase ini

1. **Sebelum membuat fitur baru** — cek apakah logika bisnisnya ada di dokumen ini
2. **Jika ada ambiguitas** — tanyakan ke developer, jangan asumsikan sendiri
3. **Jangan ubah aturan harga atau neraca** tanpa konfirmasi eksplisit
4. **Semua perubahan nilai** harus melalui log transaksi — tidak ada update nilai yang tidak tercatat
5. **Firebase Functions** adalah tempat semua logika bisnis — jangan taruh di client side

---

## Referensi dokumen lain

- `MANIFESTO.md` — penjelasan untuk komunitas umum
- `TECHNICAL_MANIFESTO.md` — spesifikasi konsep lengkap
- `CLAUDE.md` — dokumen ini, instruksi untuk Claude CLI

---

> Versi: 1.0 | Status project: Fase 1 — logika dasar
> Open source — github.com/TMEP
