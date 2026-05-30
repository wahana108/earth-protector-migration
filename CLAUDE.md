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
5. Neraca positif = buffer penjualan, BUKAN uang yang bisa dicairkan langsung

---

## Stack teknologi

- **Frontend:** React / Next.js
- **Backend:** Firebase (Firestore, Auth, Functions)
- **Status:** Fase 2 — fitur lanjutan di atas fondasi Fase 1

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
✓ Admin panel report komentar terflag (/admin/reports)
✓ Email verification + admin role (ramawan@live.com)
✓ link_bukti + project_id di neraca_log
```

---

## Entitas utama dan relasinya

```
User
├── level: 'developer_biasa' | 'top_developer'
├── total_poin: number          // running total, update setiap transaksi
├── soldNfts: number            // jumlah NFT terjual
├── buybackCount: number        // jumlah NFT yang sudah dibuyback
└── validator_aktif: [{ project_id, nft_unit_ids[], nilai_total, fee_diterima }]

Project (dibuat Developer)
├── jumlah_nft = nilai_project / 100000
├── status_project: 'aktif' | 'dalam_invalidasi'
├── pool_jaminan: number        // total nilai validator terkunci
├── jumlah_validator: number
├── like_count: number
└── validator_list: [{ user_id, nft_unit_id, nilai, timestamp }]

NFTUnit (satuan yang diperjualbelikan)
├── owner_id
├── status: 'biasa' | 'valid' | 'invalid'
├── harga_jual: number          // max batas_atas dari community_config
├── harga_beli_terakhir: number // dasar perhitungan buyback
├── nilai_selisih: number       // harga_beli_terakhir - harga_dasar
├── digunakan_validasi: boolean
├── project_validasi_id: string | null
├── for_sale: boolean
├── nama_project: string        // denormalized
└── kategori: ProjectCategory   // denormalized

PoolRekomendasi (metadata saja, tidak duplikasi NFT)
├── is_aktif: boolean
├── jumlah_top_developer: number
├── kapasitas_aktif: number     // dari Fibonacci
└── total_jaminan: number
```

---

## Aturan bisnis kritis — JANGAN PERNAH DILANGGAR

### Aturan harga
```
harga_dasar = dari community_config.harga_dasar (default 100000)
batas_atas  = dari community_config.batas_atas (default 150000)
BLOKIR input jika harga_jual > batas_atas
JANGAN pernah hardcode nilai ini — selalu baca dari community_config
```

### Aturan neraca saat transaksi jual-beli
```
nilai_selisih = harga_jual - harga_dasar

PENJUAL: neraca += -(nilai_selisih)   // selalu minus atau nol
PEMBELI: neraca += +(nilai_selisih)   // selalu plus atau nol

PENTING: neraca positif adalah BUFFER, bukan saldo yang bisa dicairkan
Neraca positif mengurangi efek minus saat penjual menjual NFT berikutnya
```

### Aturan buyback
```
Buyback = user mengembalikan NFT ke developer dengan harga beli semula

Skenario A — buyback ke developer (history ada):
  harga = harga_beli_terakhir dari nft_unit
  developer.neraca += +(nilai_selisih)   // developer dapat kembali poinnya
  user.neraca -= +(nilai_selisih)        // user kehilangan poin yang pernah didapat
  developer.buybackCount += 1
  owner_id kembali ke developer_id

Skenario B — NFT sudah digunakan validasi:
  harga = harga_dasar (100000) — sudah direset saat validasi
  sama seperti Skenario A tapi nilai_selisih = 0

Top Developer tambahan:
  Tombol "Transfer ke Pool" — aktif HANYA jika level == 'top_developer'
  NFT masuk antrian pool rekomendasi, bukan kembali ke developer
```

### Aturan validasi bergulir
```
User memilih NFT (checkbox) dari dashboard untuk memvalidasi project

Saat validasi:
  nft_unit.digunakan_validasi = true
  nft_unit.project_validasi_id = project.id
  nft_unit.harga_beli_terakhir = harga_dasar  // reset
  nft_unit.nilai_selisih = 0
  project.pool_jaminan += nilai_selisih_sebelum_reset
  project.jumlah_validator += 1
  project.validator_list.push({ user_id, nft_unit_id, nilai, timestamp })
  user.validator_aktif.push({ project_id, nft_unit_ids, nilai_total })

User bisa validasi BANYAK project dengan NFT berbeda sekaligus
NFT yang digunakan validasi: for_sale = false, tidak bisa dijual
```

### Aturan Top Developer
```
Syarat otomatis (dari community_config.minimum_buyback_pct):
  buybackCount / soldNfts * 100 >= minimum_buyback_pct (default 50%)
  DAN soldNfts >= 1

Ketika syarat terpenuhi:
  user.level = 'top_developer' (otomatis oleh sistem)
  Akses: tombol "Transfer ke Pool" aktif
  Akses: bisa taruh NFT di pool rekomendasi
  Kewajiban: sisihkan fee_project_pct dari setiap project

Ketika syarat tidak lagi terpenuhi:
  user.level = 'developer_biasa'
  NFT valid miliknya masuk daftar_invalidasi = true
```

### Aturan status NFT
```
biasa   → default saat diterbitkan
valid   → project-nya sudah tervalidasi penuh
invalid → developer turun peringkat atau kuota berkurang

Transisi valid → invalid:
  TIDAK langsung — ada jeda toleransi
  NFT masuk daftar_invalidasi = true, status tetap 'valid'
  Setelah terbeli → status = 'biasa', tidak kembali ke pool
  Dana validator tetap terkunci sebagai antrian likuiditas
```

### Aturan fee sharing
```
Sumber fee: developer top_developer menyisihkan fee_project_pct dari project
Distribusi: proporsional berdasarkan nilai validator di project tersebut
  validator_fee = (nilai_validator / total_pool_jaminan) * total_fee
Cara distribusi: tambahkan langsung ke neraca validator (tidak transfer uang)
Tercatat di: neraca_log dengan tipe 'fee_validator'
```

---

## Urutan implementasi Fase 2

```
① Buyback logic (semua user + tombol Transfer ke Pool untuk top developer)
② Index Project — halaman publik /projects
   (urut akumulasi like, tampilkan NFT terjual, link bukti)
③ Sinkronisasi kategori dengan mockup
   (Tree Planting, Ocean Cleanup, Wildlife Protection, dll)
④ Link bukti di dialog pembelian NFT
⑤ Halaman detail NFT + Project
⑥ Syarat Top Developer — upgrade otomatis oleh sistem
⑦ Validasi bergulir — halaman /validate + checkbox NFT
⑧ Pool rekomendasi — aktif jika kapasitas Fibonacci terpenuhi
⑨ Fee sharing otomatis ke neraca validator
⑩ AI monitoring ringan — HTTP check link bukti berkala
```

---

## Yang BELUM diimplementasi (Fase 3)

- Fibonacci capacity calculation yang dinamis
- DAPP / blockchain integration
- Lazy minting NFT di platform eksternal
- Personal blocklist
- AI monitoring penuh (analisis pola transaksi)
- Reply/thread komentar
- Notifikasi real-time
- Custodian kartu NFT fisik

---

## Cara kerja dengan codebase ini

1. **Baca dokumen ini penuh** sebelum menyentuh kode apapun
2. **Jika ada ambiguitas** — tanyakan ke developer, jangan asumsikan
3. **Jangan ubah aturan neraca** tanpa konfirmasi eksplisit
4. **Semua operasi write** harus atomic (Firestore transaction atau batch)
5. **Semua perubahan nilai** harus tercatat di neraca_log
6. **Jangan hardcode** harga_dasar atau batas_atas — selalu baca dari community_config
7. **Tombol top developer** (Transfer ke Pool, dll) — render tapi disabled untuk non-top-developer

---

## Referensi dokumen lain

- `MANIFESTO.md` — penjelasan untuk komunitas umum
- `TECHNICAL_MANIFESTO.md` — spesifikasi konsep lengkap
- `CLAUDE.md` — dokumen ini, instruksi untuk Claude CLI

---

> Versi: 2.0 | Status project: Fase 2 — fitur lanjutan
> Open source — github.com/TMEP
