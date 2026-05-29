# TMEP Technical Manifesto
### The Mother Earth Project — Spesifikasi Konsep untuk Developer

> Dokumen ini adalah referensi teknis untuk developer yang ingin memahami logika sistem sebelum berkontribusi pada kode.

---

## Prinsip arsitektur

1. **Tidak ada entitas pemegang dana** — semua nilai tersimpan di neraca user dan pool komunitas
2. **Algoritma membaca neraca, bukan otoritas** — keputusan sistem berdasarkan data transaksi, bukan keputusan admin
3. **Nilai dari tindakan nyata** — NFT hanya valid jika ada bukti tindakan charity yang bisa diverifikasi
4. **Antrian, bukan jaminan** — sistem menjamin antrian likuiditas, bukan return finansial

---

## Entitas utama sistem

### Developer
User yang membuat dan menjual NFT charity. Dibagi dua level:
- **Developer biasa** — semua proses manual, tidak bisa masuk pool rekomendasi
- **Top Developer** — akses ke pool rekomendasi, fitur otomatis, wajib menyisihkan persentase project untuk fee sharing dan dana buyback

### NFT (Sertifikat Charity)
Bukan dibuat per unit, tapi **per project**. Setiap NFT merepresentasikan satu project charity nyata dengan:
- Bukti tindakan (link dokumentasi, foto, video)
- Nilai minimum project (default: Rp 3.000.000)
- Status: `biasa` | `valid` | `invalid`
- History harga pembelian per transaksi

### Pool Rekomendasi
Kolam likuiditas komunitas. Hanya NFT dari Top Developer yang bisa masuk. Pool ini yang menjadi tempat antrian likuiditas dan validasi bergulir.

### Neraca Transaksi
Dashboard per user yang mencatat:
- Poin positif/negatif dari selisih harga jual terhadap patokan
- Status validator (aktif/tidak aktif)
- History semua transaksi
- Fee yang diterima sebagai validator

---

## Logika harga dan neraca

```
Harga patokan komunitas : Rp 100.000
Batas atas              : Rp 150.000
Nilai minimum project   : Rp 3.000.000
```

### Perhitungan poin neraca

Sistem dirancang agar penjual selalu menanggung konsekuensi neraca, sementara pembeli selalu mendapat reward. Ini mendorong penjual untuk tidak menetapkan harga terlalu tinggi, sekaligus memberi insentif kepada pembeli untuk mendukung project charity.

```
PENJUAL                              PEMBELI
──────────────────────────────────────────────────────
Jual Rp 100.000 (patokan) →  0       +0    (netral)
Jual Rp 120.000           → -20.000  +20.000
Jual Rp 150.000 (batas)   → -50.000  +50.000
Jual > Rp 150.000         → DIBLOKIR sistem, tidak bisa didaftarkan
```

**Implikasi untuk penjual:**
Semakin tinggi harga jual, semakin besar minus di neraca. Tidak ada keuntungan neraca dari menjual mahal — justru menambah beban yang harus dinetralisir.

**Implikasi untuk pembeli:**
Semakin mahal NFT yang dibeli, semakin besar poin yang didapat. Poin ini bisa digunakan untuk validasi project charity pilihan pembeli.

Poin positif pembeli bisa digunakan untuk validasi project.
Neraca minus penjual harus dinetralisir agar tidak turun peringkat.

### Cara netralisir neraca minus

1. Beli NFT di pool rekomendasi (setiap pembelian di atas patokan menghasilkan poin positif)
2. Lakukan buyback NFT sendiri — dijual ke pembuat dengan harga beli semula

### Logika buyback

```
Skenario A — buyback ke pembuat (ada history):
  Harga = harga beli awal yang tersimpan di history transaksi

Skenario B — jual ke orang lain / luar sistem:
  Harga = selalu Rp 100.000 (harga patokan komunitas)

Skenario C — gunakan poin untuk validasi:
  Poin positif pembeli digunakan untuk memvalidasi project pilihan
  NFT yang dimiliki → harga buyback direset ke Rp 100.000 (harga dasar)
  karena selisih harganya sudah direlakan ke pool jaminan project
```

### Penting: yang divalidasi adalah PROJECT, bukan NFT satuan

Halaman validasi menampilkan daftar **project NFT charity** milik Top Developer — bukan NFT per unit. Project diurutkan berdasarkan jumlah like dari komunitas.

Ketika sebuah project divalidasi:
- Semua NFT yang terdaftar dalam project tersebut menjadi berstatus `valid`
- Poin validator terkunci di pool jaminan project tersebut
- NFT valid masuk ke pool rekomendasi dan bisa diperdagangkan dengan antrian likuiditas

### Unit validasi adalah NFT, bukan poin

Validator tidak mengalokasikan poin secara parsial. Yang digunakan adalah **NFT mana yang dipilih** (via checkbox) untuk memvalidasi project tertentu. Setiap NFT yang dipilih dianggap sebagai **1 validator** dengan nilai sesuai selisih harga belinya.

```
NFT "A" dibeli Rp 120.000 → nilai validasi Rp 20.000, jumlah validator +1
NFT "B" dibeli Rp 150.000 → nilai validasi Rp 50.000, jumlah validator +1

Keduanya dicentang untuk project "X":
→ total nilai validasi di pool: Rp 70.000
→ jumlah validator project "X": +2
→ tidak bisa partial — NFT adalah unit utuh, tidak bisa dipecah
```

**Implikasi index:** jumlah validator adalah faktor bobot tersendiri dalam index pool rekomendasi, terpisah dari total nilai. 10 validator kecil lebih bernilai dari 1 validator besar karena mencerminkan konsensus komunitas yang lebih luas.

Setelah NFT digunakan untuk validasi:
- NFT tersebut direset ke harga dasar Rp 100.000 untuk keperluan buyback
- Selisih harganya terkunci di pool jaminan project yang dipilih
- User bisa memvalidasi project berbeda dengan NFT yang berbeda secara bersamaan

### Prosedur invalidasi otomatis

Dipicu ketika developer turun dari status Top Developer:

```
Developer turun peringkat
→ NFT valid miliknya masuk DAFTAR INVALIDASI
→ Status NFT: tetap "valid" selama belum terbeli (pemegang aman)
→ Ketika NFT terbeli di pool rekomendasi:
   → status langsung menjadi NFT biasa
   → tidak kembali ke pool rekomendasi
   → tidak ada lagi jaminan antrian likuiditas
```

Tidak ada eksekusi paksa — pemegang NFT tetap punya kesempatan mencairkan sebelum status berubah. Sistem memberi jeda yang transparan.

---

## Mekanisme validasi bergulir

### Syarat pool rekomendasi aktif (Fibonacci capacity)

```
Kapasitas pool = 3× nilai minimum project
Contoh: min project Rp 3 jt → pool aktif saat kapasitas ≥ Rp 9 jt
        atau minimal 30 Top Developer terdaftar aktif
        atau kapasitas menampung 90 NFT
```

### Siklus validator

```
1. User menggunakan poin neraca → masuk sebagai validator project "A"
2. Poin terkunci di pool jaminan project "A"
3. Status neraca: "Validator aktif — project A"
4. User mendapat fee sharing proporsional dari setiap transaksi project "A"

5. Validator baru datang → validasi ulang project "A"
6. Validator lama digantikan → poin dikembalikan ke neraca (atau dalam bentuk NFT)
7. Status validator lama: selesai

8. Jika tidak ada yang memvalidasi ulang:
   → poin permanen terkunci
   → menjadi dana talangan buyback NFT valid tersebut selamanya
```

### Status NFT

```
biasa   → dibuat developer, bisa diperjualbelikan, tidak ada jaminan
valid   → ada validator aktif, masuk pool rekomendasi, ada antrian likuiditas
invalid → kuota berkurang karena penurunan user aktif, tapi SELALU punya antrian
          selama komunitas ada (karena dana validasi masih terkunci di pool)

Transisi:
  biasa → valid   : melalui proses validasi oleh Top Developer
  valid → biasa   : setelah dibeli dari pool rekomendasi
  valid → invalid : algoritma menyarankan pemotongan kapasitas (ada jeda toleransi)
  invalid → antrian: NFT yang pernah valid SELALU mendapat antrian di pool
```

---

## AI Monitoring

AI bersifat **netral-negatif** — tidak memberi nilai positif, hanya mendeteksi anomali.

```
Tidak ada anomali      → skor 0%, posisi tidak berubah
Terdeteksi anomali     → skor X%, ditandai untuk review komunitas
Kesalahan nyata        → anomali 100%, transaksi dianggap tidak ada
  (link tidak valid, bukti tidak sesuai, data tidak match)
```

### Parameter anomali (transparan dari awal, diketahui user sebelum bergabung)

- Validitas link bukti tindakan charity
- Kesesuaian tanggal transaksi dengan dokumentasi
- Pola transaksi tidak wajar (jual-beli sendiri untuk manipulasi poin)
- Validator berkolusi untuk project fiktif

**AI tidak pilih kasih.** Parameternya sama untuk semua user.

### Profil merah
User dengan anomali tinggi atau neraca minus berkepanjangan akan ditandai (indikator merah di profil) sebagai peringatan bagi user lain. Ada fitur personal blocklist yang bisa digunakan user jika menemukan anomali pada user tertentu — dicatat dalam log transaksi.

---

## Fee sharing — Top Developer

Top Developer wajib menyisihkan dalam setiap project:

```
Dana charity   : persentase untuk tindakan nyata di lapangan
Dana buyback   : cadangan untuk antrian likuiditas
Dana fee       : 2–5% dari nilai project, dibagi ke:
                 → validator aktif (proporsional)
                 → infrastruktur platform (server, hosting)
                 → di fase DAPP: biaya infrastruktur blockchain
```

Tidak ada transfer manual. Sistem mencatat distribusi sebagai **nilai minus di neraca transaksi** secara otomatis — ini yang disebut "membayar fee sharing" tanpa ada otoritas yang menerima atau mengirim uang.

---

## Ranking developer

```
Top Developer : akses pool rekomendasi, fitur otomatis, kewajiban fee sharing
Developer biasa: semua manual, 100% dana bisa ke charity (tapi peringkat rendah)
```

Developer biasa bisa naik peringkat melalui buyback bertahap. Tidak ada paksaan — tapi hirarki selalu ditampilkan dan peringkat rendah adalah konsekuensi pilihan.

---

## Fase pengembangan

### Fase 1 — Saat ini (infrastruktur terpusat)
- Auth login
- Struktur database: neraca, pool, history transaksi
- Logika harga dan poin
- AI monitoring dasar
- Dashboard developer dan ranking
- Pool rekomendasi manual

### Fase 2 — Optimasi
- Validasi bergulir otomatis
- Fee sharing otomatis
- Kapasitas Fibonacci dinamis
- Profil merah dan blocklist

### Fase 3 — DAPP
- Algoritma mengatur infrastrukturnya sendiri
- Desentralisasi penuh
- NFT bisa di-mint di platform manapun (lazy minting)
- Tidak ada ketergantungan pada founder atau server terpusat

---

## Struktur data — referensi implementasi

### User / Developer
```
id, nama, email
level: 'biasa' | 'top_developer'
neraca_poin: number  // bisa minus
anomali_score: number  // 0–100%
status_profil: 'normal' | 'merah'
history_transaksi: []
validator_aktif: project_id | null
```

### Project Charity
```
id, developer_id
judul, deskripsi
link_bukti: string          // URL dokumentasi charity
nilai_project: number       // min Rp 3.000.000
jumlah_nft: number          // otomatis: nilai_project / 100.000 (default 30)
harga_dasar: 100000         // tetap, ditetapkan komunitas
batas_atas: 150000          // tetap, sistem blokir jika melebihi
status_project: 'aktif' | 'dalam_invalidasi'
daftar_invalidasi: boolean
pool_jaminan: number        // total nilai terkunci dari semua validator
jumlah_validator: number
validator_list: { user_id, nft_unit_id, nilai, timestamp }[]
like_count: number          // untuk index di halaman validasi
```

### NFT Unit (setiap satuan yang bisa diperjualbelikan)
```
id, project_id, developer_id
owner_id: string            // pemilik saat ini
status: 'biasa' | 'valid' | 'invalid'
harga_jual: number          // ditetapkan penjual, max Rp 150.000
harga_beli_terakhir: number // dasar perhitungan buyback
nilai_selisih: number       // harga_beli_terakhir - 100.000
digunakan_validasi: boolean // jika true → harga buyback reset ke Rp 100.000
project_validasi_id: string | null
history_kepemilikan: { from, to, harga, timestamp }[]
```

### Neraca User
```
user_id
total_poin: number          // akumulasi selisih dari semua NFT yang dimiliki
                            // (hanya NFT yang belum digunakan validasi)
status_validator: { project_id, nft_unit_ids[], nilai_total, fee_diterima }[]
                            // bisa validator di banyak project sekaligus
log: { tipe, nilai, timestamp, anomali_score }[]
```

### Pool Rekomendasi
```
kapasitas_aktif: number  // dihitung Fibonacci dari jumlah top developer
nft_valid: NFT[]
total_jaminan: number
```

### Neraca Transaksi (per user)
```
user_id
poin: number
status_validator: null | { project_id, poin_terkunci, fee_diterima }
log: { tipe, nilai, timestamp, anomali_score }[]
```

---

## Catatan untuk kontributor

Sistem ini sengaja tidak memiliki otoritas pusat. Setiap implementasi harus mengikuti prinsip ini:

- Jangan buat fungsi yang memindahkan dana secara langsung antar user
- Semua perubahan nilai harus melalui neraca transaksi
- AI monitoring harus transparan dan parameternya terdokumentasi
- Setiap keputusan algoritma harus bisa di-audit dari log transaksi

Project ini open source dan manifesto ini adalah kontrak sosial antar kontributor.

---

> Versi dokumen: 1.0 — Disusun berdasarkan diskusi founder  
> Status project: Open source, fase pengembangan logika dasar  
> GitHub: [github.com/TMEP]
