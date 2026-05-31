# CLAUDE.md — The Mother Earth Project (TMEP)

> Dokumen ini adalah instruksi konteks untuk Claude CLI.
> Baca seluruh dokumen ini sebelum menyentuh kode apapun.
> Jika ada konflik antara dokumen ini dan kode yang ada, tanyakan ke developer sebelum mengubah apapun.

---

## Apa proyek ini?

TMEP adalah platform komunitas untuk mengabadikan tindakan nyata charity melalui sistem NFT berbasis konsensus. Bukan marketplace NFT biasa. Bukan DeFi konvensional.

**Prinsip yang tidak boleh dilanggar:**
1. Tidak ada entitas yang memegang dana — semua nilai ada di neraca user dan pool
2. Algoritma membaca neraca, bukan admin yang memutuskan
3. Nilai berasal dari tindakan nyata yang bisa diverifikasi
4. Sistem menjamin antrian likuiditas, bukan return finansial
5. Neraca positif = buffer penjualan, BUKAN uang yang bisa dicairkan langsung
6. Tidak ada transfer dana — semua diatur konsep neraca

---

## Stack teknologi

- **Frontend:** React / Next.js
- **Backend:** Firebase (Firestore, Auth, Functions)
- **Status:** Fase 2 — hampir selesai

---

## Yang sudah selesai di Fase 1

```
✓ Community Parameters page (/parameters)
✓ Form pendaftaran project NFT + auto-generate units (/create)
✓ Explorer dengan filter kategori, like, beli NFT (/explore)
✓ Transaksi beli NFT — neraca atomik (penjual minus, pembeli plus)
✓ Dashboard neraca user (/dashboard)
✓ Developer Ranking berdasarkan % buyback (/top-developers)
✓ Komentar per kartu NFT (hapus, report, policy)
✓ Admin panel + recalculate developer levels (/admin)
✓ Email verification + admin role (ramawan@live.com)
✓ link_bukti + project_id di neraca_log
```

## Yang sudah selesai di Fase 2

```
✓ ① Buyback logic — satu arah
✓ ② Index Project halaman publik (/projects)
✓ ③ Kategori hierarkis (lingkungan, energi, sosial, dll)
✓ ④ Link bukti di dialog pembelian NFT
✓ ⑤ Halaman detail NFT (/nft/[id]) + Project (/projects/[id])
✓ ⑥ Top Developer otomatis:
     - minimum_soldNfts_top_developer (default 5 untuk testing)
     - minimum_buyback_pct (default 30% untuk testing)
     - checkAndUpdateDeveloperLevel() setelah buy dan buyback
✓ ⑦ Validasi bergulir (/validate) — checkbox NFT, atomik
✓ ⑧ Pool Rekomendasi (/pool):
     - FIFO antrian untuk top developer
     - Skip otomatis NFT milik sendiri
     - transferred_at reset saat dilewati (NFT geser ke belakang)
     - Beli di pool = buybackCount bertambah (antisipasi top developer)
     - Kapasitas pool otomatis = jumlah_top_developer × 3
✓ ⑨ Fee Sharing Opsi A (sedang diimplementasi):
     - fee_trigger_per_nft: setiap kelipatan X NFT terjual
     - fee_infrastruktur_pct: % fee untuk infrastruktur sistem
     - fee_project_pct per project (diset developer saat buat project)
     - maybeTriggerFee() dipanggil setelah buyNftUnit() jika NFT valid
     - Distribusi: developer neraca -=fee, fee_pool terkumpul,
       validator neraca += bagian proporsional
```

---

## Entitas utama dan relasinya

```
User
├── level: 'developer_biasa' | 'top_developer'
├── total_poin: number
├── soldNfts: number
├── buybackCount: number
└── validator_aktif: ValidatorAktif[]

Project
├── jumlah_nft = nilai_project / harga_dasar
├── status_project: 'aktif' | 'dalam_invalidasi'
├── pool_jaminan: number
├── jumlah_validator: number
├── jumlah_nft_terjual: number      ← untuk trigger fee
├── fee_project_pct: number         ← ditetapkan developer (range dari config)
├── like_count: number
└── validator_list: ValidatorEntry[]

NFTUnit
├── owner_id, developer_id
├── status: 'biasa' | 'valid' | 'invalid'
├── harga_jual: number
├── harga_beli_terakhir: number
├── nilai_selisih: number
├── digunakan_validasi: boolean
├── project_validasi_id: string | null
├── for_sale: boolean
├── in_pool: boolean
├── transferred_at: Timestamp       ← untuk FIFO ordering
├── fifo_skip_count: number
├── last_skipped_by: string
└── last_skip_reason: string

PoolRekomendasi (pool_rekomendasi/v1)
├── is_aktif: boolean
├── jumlah_top_developer: number
├── jumlah_nft_valid: number
├── kapasitas_aktif: number         ← jumlah_top_developer × 3
└── total_jaminan: number

FeePool (fee_pool/v1)
├── total_terkumpul: number
├── total_infrastruktur: number     ← dicatat, tidak dicairkan
├── total_validator: number
└── last_distributed_at: Timestamp
```

---

## Aturan bisnis kritis — JANGAN PERNAH DILANGGAR

### Aturan harga
```
Semua nilai parameter dari community_config — JANGAN hardcode
harga_dasar, batas_atas, minimum_buyback_pct, dll
```

### Aturan neraca
```
PENJUAL: neraca += -(nilai_selisih)   // selalu minus atau nol
PEMBELI: neraca += +(nilai_selisih)   // selalu plus atau nol
Neraca positif = buffer, BUKAN saldo yang bisa dicairkan
```

### Aturan Top Developer
```
Syarat SEMUA harus terpenuhi:
① soldNfts >= config.minimum_soldNfts_top_developer
② Math.floor(buybackCount/soldNfts*100) >= config.minimum_buyback_pct

checkAndUpdateDeveloperLevel() dipanggil setelah:
- buyNftUnit() → cek developer_id NFT (BUKAN owner_id)
- buybackNftUnit() → cek developer_id

Kapasitas pool update setelah level berubah:
kapasitas_aktif = jumlah_top_developer × 3
is_aktif = kapasitas_aktif >= config.kapasitas_pool_minimum
```

### Aturan Beli di Pool
```
Jika nft.in_pool == true saat dibeli:
- buyer.buybackCount += 1
- nft.in_pool = false
- pool.jumlah_nft_valid -= 1
- neraca_log tipe 'beli_pool'
- checkAndUpdateDeveloperLevel(buyerId) dipanggil
```

### Aturan Fee Sharing
```
Trigger: setiap jumlah_nft_terjual % fee_trigger_per_nft == 0
         DAN nft.status == 'valid'

feeTotal = hargaJual × (project.fee_project_pct / 100)
  fallback: config.fee_project_pct.min jika project belum punya field ini

feeInfrastruktur = feeTotal × (config.fee_infrastruktur_pct / 100)
feeValidator = feeTotal × (1 - fee_infrastruktur_pct/100)

Distribusi (writeBatch):
- developer.neraca -= feeTotal (neraca_log: 'fee_keluar')
- fee_pool/v1: total_terkumpul += feeTotal (setDoc merge:true)
- Setiap validator: neraca += (nilai/pool_jaminan) × feeValidator
  (neraca_log: 'fee_validator')
```

### Aturan FIFO Pool
```
Top developer: hanya bisa beli NFT urutan pertama (orderBy transferred_at asc)
User biasa: bebas beli NFT manapun di pool

Skip FIFO:
- transferred_at direset ke serverTimestamp() → NFT geser ke belakang
- fifo_skip_count bertambah (audit trail)
- NFT milik sendiri: skip otomatis tanpa dialog

Antrian FIFO: fetchNextFifoNft() loop max 20x
```

### Aturan Validasi Bergulir
```
Syarat pool untuk mulai validasi:
jumlah_nft_valid >= config.minimum_nft_pool_untuk_validasi

User pilih NFT (checkbox) → nilai = nilai_selisih NFT tersebut
Setelah validasi: nft.digunakan_validasi=true, nilai_selisih=0,
harga_beli_terakhir=harga_dasar, project.pool_jaminan += nilai
```

---

## Community Config — semua parameter

```
harga_dasar: 100000
batas_atas: 150000
nilai_minimum_project: 1000000        // testing: 1 juta
minimum_buyback_pct: 30               // testing: 30%
minimum_soldNfts_top_developer: 5     // testing: 5
kapasitas_pool_minimum: 5             // testing: 5
minimum_nft_pool_untuk_validasi: 5    // testing: 5
fee_project_pct: { min: 2, max: 5 }
fee_trigger_per_nft: 10
fee_infrastruktur_pct: 50
fase_aktif: 1
ai_provider: 'gemini'
ai_anomali_threshold: { flag: 1, invalid: 100 }
```

---

## Halaman yang sudah ada

```
/          → Home
/explore   → Explorer NFT (semua user)
/projects  → Index Project publik
/projects/[id] → Detail project
/nft/[id]  → Detail NFT
/validate  → Validasi bergulir (login required)
/pool      → Pool Rekomendasi
/create    → Buat project NFT (login required)
/dashboard → Neraca user (login required)
/parameters → Community parameters (publik, edit: admin only)
/top-developers → Developer ranking
/admin     → Admin hub (admin only)
/admin/reports → Komentar terflag
/buyback   → Halaman buyback (ada di sidebar)
/validation → Ada di sidebar
/validated → Ada di sidebar
/transactions → Ada di sidebar
```

---

## Urutan implementasi Fase 2 — status

```
✓ ①–⑨ Selesai
  ✓ ⑧ Pool capacity auto-sync: kapasitas_aktif = jumlah_top_developer × 3
  ✓ ⑨ Fee sharing Opsi A: per project, proporsional ke validator
○ ⑩ AI monitoring ringan — HTTP check link bukti
○ Buyback 2 arah (two-way handshake) — Fase 2B
○ FIFO report system — Fase 2B
```

---

## Yang BELUM diimplementasi (Fase 3)

- Fibonacci capacity calculation dinamis
- DAPP / blockchain integration
- Lazy minting NFT di platform eksternal
- Personal blocklist
- AI monitoring penuh (analisis pola transaksi)
- Reply/thread komentar
- Notifikasi real-time
- Custodian kartu NFT fisik

---

## Cara kerja dengan codebase ini

1. Baca dokumen ini penuh sebelum menyentuh kode
2. Jika ada ambiguitas — tanyakan ke developer
3. Jangan ubah aturan neraca tanpa konfirmasi eksplisit
4. Semua operasi write harus atomic (transaction atau batch)
5. Semua perubahan nilai harus tercatat di neraca_log
6. JANGAN hardcode nilai dari community_config
7. Tombol top developer — render tapi disabled untuk non-top-developer
8. Pool metadata: pool_rekomendasi/v1
9. Fee pool: fee_pool/v1

---

## Referensi dokumen lain

- `MANIFESTO.md` — penjelasan untuk komunitas umum
- `TECHNICAL_MANIFESTO.md` — spesifikasi konsep lengkap
- `CLAUDE.md` — dokumen ini

---

> Versi: 2.2 | Status: Fase 2 hampir selesai
> Open source — github.com/TMEP
