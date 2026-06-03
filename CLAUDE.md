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

- **Frontend:** React / Next.js 15
- **Backend:** Firebase (Firestore, Auth)
- **Hosting:** Vercel
- **Status:** Fase 2C — pembatasan algoritmik

---

## Yang sudah selesai di Fase 1

```
✓ Community Parameters page (/parameters)
✓ Form pendaftaran project NFT + auto-generate units (/create)
✓ Explorer dengan filter kategori, like, beli NFT (/explore)
✓ Transaksi beli NFT — neraca atomik
✓ Dashboard neraca user (/dashboard)
✓ Developer Ranking (/top-developers)
✓ Komentar per kartu NFT (hapus, report, policy)
✓ Admin panel + recalculate developer levels (/admin)
✓ Email verification + multi-admin role
✓ link_bukti + project_id di neraca_log
```

## Yang sudah selesai di Fase 2A

```
✓ Buyback logic — satu arah → diupgrade ke 2 arah di Fase 2B
✓ Index Project halaman publik (/projects)
✓ Halaman detail NFT + Project
✓ Kategori hierarkis (lingkungan, energi, sosial, dll)
✓ Link bukti di dialog pembelian NFT
✓ Top Developer otomatis (checkAndUpdateDeveloperLevel)
✓ Validasi bergulir (/validate) — checkbox NFT, revalidasi
✓ Pool Rekomendasi (/pool) — FIFO antrian
✓ Fee Sharing Opsi A — per project, proporsional ke validator
✓ Kapasitas pool otomatis = jumlah_top_developer × 3
✓ AI monitoring ringan — HTTP check link bukti
✓ Category placeholders untuk gambar yang tidak bisa dimuat
✓ Keterangan opsional + proof link saat beli NFT
```

## Yang sudah selesai di Fase 2B

```
✓ Buyback 2 arah (two-way handshake):
  - createBuybackRequest, confirmBuybackRequest
  - rejectBuybackRequest, completeBuybackRequest
  - cancelBuybackRequest
  - Halaman /buyback-requests untuk seller
  
✓ Holding period validasi:
  - community_config.minimum_holding_days (default 7)
  - NFT harus dipegang X hari sebelum bisa validasi
  - purchased_at tersimpan di NFTUnit
  
✓ Sistem konfirmasi transaksi 3 opsi:
  - Konfirmasi manual oleh seller (instan)
  - Report → purchase_disputes → admin review
  - Auto-complete setelah purchase_autoclose_days (default 7)
  - Poin PENDING sampai seller konfirmasi atau auto-complete
  - Halaman /purchase-confirmations untuk seller
  
✓ Purchase dispute admin panel:
  - resolvePurchaseDispute(approve/reject)
  - Section di /admin
  
✓ Multi-admin hierarki:
  - SuperAdmin: ramawan@live.com (hardcode)
  - Admin: dari community_config.admin_emails
  - Moderator: dari community_config.moderator_emails
  - isSuperAdmin, isAdmin, isModerator di useAuth hook
  - UI kelola tim di /parameters (SuperAdmin only)
  
✓ Admin tools:
  - Soft delete project (status='deleted')
  - max_projects_per_user di community_config (default 5)
  - Section "Manajemen Project" di /admin
  
✓ Personal blocklist:
  - blockUser, unblockUser, isBlocked
  - Efek: tidak bisa bertransaksi + tidak bisa komentar
  - Tombol blokir di /top-developers, /nft/[id], /dashboard
  - Admin review di /admin section "Blokir Aktif"
```

---

## Entitas utama

```
User
├── level: 'developer_biasa' | 'top_developer'
├── total_poin: number           // poin aktif
├── total_poin_pending: number   // poin menunggu konfirmasi seller
├── soldNfts: number
├── buybackCount: number
├── pending_seller_actions: number  // notifikasi untuk seller
└── validator_aktif: ValidatorAktif[]

Project
├── jumlah_nft = nilai_project / harga_dasar
├── status_project: 'aktif' | 'dalam_invalidasi' | 'deleted'
├── deleted_at?: Timestamp
├── deleted_by?: string
├── pool_jaminan: number
├── jumlah_validator: number
├── jumlah_nft_terjual: number
├── fee_project_pct: number
├── like_count: number
└── validator_list: ValidatorEntry[]

NFTUnit
├── owner_id, developer_id
├── status: 'biasa' | 'valid' | 'invalid'
├── purchase_status?: 'pending'|'completed'|'disputed'|'auto_completed'
├── purchased_at?: Timestamp
├── purchase_auto_complete_at?: Timestamp
├── harga_jual, harga_beli_terakhir, nilai_selisih
├── digunakan_validasi: boolean
├── pernah_digunakan_validasi: boolean
├── harga_beli_sebelum_validasi?: number
├── nilai_selisih_sebelum_validasi?: number
├── for_sale: boolean
├── in_pool: boolean
├── transferred_at?: Timestamp
├── buyback_pending: boolean
└── fifo_skip_count: number

BuybackRequest (buyback_requests/{id})
├── status: 'pending'|'confirmed'|'rejected'|'completed'|'cancelled'
├── confirmed_at?: Timestamp
└── auto_complete_at?: Timestamp

PurchaseDispute (purchase_disputes/{id})
├── nft_unit_id, seller_id, buyer_id
├── reason: string
└── status: 'pending_admin'|'resolved_approved'|'resolved_rejected'

UserBlock (user_blocks/{id})
├── blocker_id, blocked_id
├── reason: string
├── reviewed_by_admin: boolean
└── admin_decision: 'pending'|'upheld'|'reversed'|null

FeePool (fee_pool/v1)
├── total_terkumpul, total_infrastruktur, total_validator
└── last_distributed_at: Timestamp
```

---

## Aturan bisnis kritis

### Aturan neraca
```
PENJUAL: neraca += -(nilai_selisih) saat confirmPurchase/auto-complete
PEMBELI: total_poin_pending += +(nilai_selisih) saat beli
         total_poin += nilai_selisih saat confirmed/auto-complete
Neraca positif = buffer, BUKAN saldo yang bisa dicairkan
```

### Aturan pembelian (3 opsi konfirmasi)
```
Beli → poin PENDING, seller dapat notifikasi
Seller konfirmasi → poin masuk aktif (instan)
Seller report → purchase_disputes, admin review
Auto-complete → setelah purchase_autoclose_days (default 7)
```

### Aturan buyback 2 arah
```
Pembeli request → seller konfirmasi + proof_link →
pembeli complete ATAU auto-complete setelah auto_complete_at
```

### Aturan Top Developer
```
soldNfts >= minimum_soldNfts_top_developer
Math.floor(buybackCount/soldNfts*100) >= minimum_buyback_pct
kapasitas_aktif = jumlah_top_developer × 3
```

### Aturan validasi bergulir
```
NFT harus dipegang >= minimum_holding_days sebelum validasi
Project valid bisa direvalidasi (validator lama digantikan)
NFT pernah_digunakan_validasi = true tidak bisa validasi lagi
```

### Aturan blokir
```
isBlocked(uid1, uid2) = ada block aktif di kedua arah
  DAN admin_decision !== 'reversed'
Efek: tidak bisa bertransaksi + tidak bisa komentar
```

### Aturan project (akan diupdate di Fase 2C)
```
SAAT INI: max_projects_per_user (statis, default 5)

FASE 2C (akan diimplementasi):
realisasi_pct = (total_terjual + total_buyback) / 
                total_nft_diterbitkan × 100
Jika realisasi_pct < min_realisasi_pct_untuk_create:
  → Tombol Create disabled
Parameter baru: min_realisasi_pct_untuk_create (default 20)
```

---

## Community Config — semua parameter

```
harga_dasar: 100000
batas_atas: 150000
nilai_minimum_project: 1000000
minimum_buyback_pct: 30
minimum_soldNfts_top_developer: 5
kapasitas_pool_minimum: 5
minimum_nft_pool_untuk_validasi: 5
fee_project_pct: { min: 2, max: 5 }
fee_trigger_per_nft: 10
fee_infrastruktur_pct: 50
purchase_autoclose_days: 7
minimum_holding_days: 7
max_projects_per_user: 5          ← akan digantikan logika algoritmik
min_realisasi_pct_untuk_create: 20  ← BARU (Fase 2C)
admin_emails: []
moderator_emails: []
fase_aktif: 2
```

---

## Halaman yang sudah ada

```
/              → Home
/explore       → Explorer NFT
/projects      → Index Project
/projects/[id] → Detail project
/nft/[id]      → Detail NFT
/validate      → Validasi bergulir
/pool          → Pool Rekomendasi + FIFO
/create        → Buat project NFT
/dashboard     → Neraca user
/buyback       → Buyback NFT (request-based)
/buyback-requests      → Seller: konfirmasi/tolak buyback
/purchase-confirmations → Seller: konfirmasi/laporkan penjualan
/transactions  → Log transaksi publik
/parameters    → Community parameters
/top-developers → Developer ranking
/admin         → Admin hub
/admin/reports → Komentar terflag
```

---

## Urutan implementasi Fase 2C

```
○ ① Pembatasan project algoritmik:
     - Tambah min_realisasi_pct_untuk_create ke community_config
     - Hitung realisasi_pct saat user buka /create
     - Tombol Create disabled jika di bawah threshold
     - Tampilkan progress realisasi di /dashboard dan /create

○ ② GitHub Pages portal komunitas:
     - instances.json di repo publik
     - Halaman /instances di website
     
○ ③ State snapshot / backup (Fase advance)
```

---

## Yang BELUM diimplementasi (Fase 3)

- Fibonacci capacity calculation dinamis
- DAPP / blockchain integration
- Lazy minting NFT di platform eksternal
- AI monitoring penuh (analisis pola transaksi)
- Reply/thread komentar
- Notifikasi real-time
- Custodian kartu NFT fisik
- State snapshot / backup ke GitHub

---

## Cara kerja dengan codebase ini

1. Baca dokumen ini penuh sebelum menyentuh kode
2. Jika ada ambiguitas — tanyakan ke developer
3. Jangan ubah aturan neraca tanpa konfirmasi eksplisit
4. Semua operasi write harus atomic (transaction atau batch)
5. Semua perubahan nilai harus tercatat di neraca_log
6. JANGAN hardcode nilai dari community_config
7. Cek isBlocked sebelum semua transaksi antar user
8. purchase_status harus dicek di semua query NFT display

---

> Versi: 2.3 | Status: Fase 2C
> Open source — github.com/TMEP
