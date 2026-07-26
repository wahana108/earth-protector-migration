# Inspira Better World Technical Manifesto
### Spesifikasi Konsep untuk Developer

> Dokumen ini adalah referensi teknis untuk developer yang ingin memahami logika sistem sebelum berkontribusi pada kode.
> Konsep ini tidak berubah dari awal — hanya implementasinya yang menyesuaikan kemampuan realisasi di setiap fase pengembangan.

---

## Prinsip arsitektur

1. **Tidak ada entitas pemegang dana** — semua nilai tersimpan di neraca user dan pool komunitas
2. **Algoritma membaca neraca, bukan otoritas** — keputusan sistem berdasarkan data transaksi, bukan keputusan admin
3. **Nilai dari tindakan nyata** — NFT hanya valid jika ada bukti tindakan charity yang bisa diverifikasi
4. **Antrian, bukan jaminan** — sistem menjamin antrian likuiditas, bukan return finansial
5. **Poin = reputasi, bukan uang** — semua nilai di sistem adalah simbolik, bukan finansial langsung
6. **Fibonacci sebagai filosofi eksistensi** — penyebaran node mengikuti pola alam yang tidak bisa dihancurkan

---

## Filosofi dasar — mengapa ini beda

Inspira Better World bukan platform jual beli NFT. Inspira Better World adalah **infrastruktur pengakuan komunitas** atas tindakan nyata di dunia.

```
NFT = Sertifikat tindakan nyata charity
Nilai NFT = Seberapa besar komunitas mengakuinya
Validator = Komunitas yang memberikan jaminan pengakuan
Pool FIFO = Mekanisme konversi pengakuan ke likuiditas
Poin neraca = Mata uang reputasi, bukan uang tunai
```

Tidak ada uang yang berpindah di dalam sistem. Yang berpindah adalah **pengakuan**. Developer yang neracanya minus bukan berarti rugi uang — mereka "membayar biaya pengakuan" yang akan meningkatkan nilai reputasi komunitasnya jika dikelola dengan baik.

---

## Filosofi Fibonacci — kunci eksistensi sistem

Fibonacci bukan sekadar angka matematika. Ini adalah **pola pertumbuhan alam yang terbukti**: spiral galaxy, koloni semut, struktur DNA, pola daun. Semua creature menggunakan kode ini sebagai mekanisme backup dan penyebaran.

```
Relevansi untuk Inspira Better World:
→ Sistem yang menyebar mengikuti pola Fibonacci
  tidak bisa "dibunuh" dengan menghancurkan satu titik
→ Seperti koloni semut: musnahkan satu koloni,
  ada ribuan koloni lain yang sudah backup
→ Inilah yang membuat Bitcoin bertahan:
  bukan hanya teknologinya, tapi penyebarannya organik

Implementasi di Inspira Better World:
Level 1: 1 node (founder)
Level 2: 1 node tambahan (total 2)
Level 3: 2 node tambahan (total 3) → 1,1,2,3,5,8,13...
...dst

Setiap level = kapasitas komunitas bertambah
Setiap node baru = backup yang semakin kuat
Tidak ada institusi yang bisa menghentikan
karena tidak ada "pusat" yang bisa dihancurkan
```

---

## Entitas utama sistem

### Developer
User yang membuat dan menjual NFT charity. Dibagi dua level:
- **Developer biasa** — semua proses manual, tidak bisa masuk pool rekomendasi
- **Top Developer** — akses ke pool rekomendasi, fitur otomatis, wajib menyisihkan fee

### NFT (Sertifikat Charity)
Bukan dibuat per unit, tapi **per project**. Setiap NFT merepresentasikan satu project charity nyata.

Status NFT:
```
biasa   → default saat diterbitkan
valid   → project-nya sudah tervalidasi oleh komunitas
invalid → developer turun peringkat atau kuota berkurang
```

### Pool Rekomendasi
Kolam likuiditas komunitas. Hanya NFT dari Top Developer yang bisa masuk. Kapasitas = jumlah_top_developer × 3.

### Neraca Transaksi
Dashboard per user yang mencatat semua nilai simbolik. **Neraca positif = buffer reputasi**, bukan saldo yang bisa dicairkan.

---

## Logika harga dan neraca

```
Harga patokan komunitas : Rp 100.000 (dari community_config)
Batas atas              : Rp 150.000 (dari community_config)
```

### Perhitungan poin neraca

```
PENJUAL selalu mendapat MINUS:
  Jual Rp 120.000 → penjual: -Rp 20.000

PEMBELI selalu mendapat PLUS:
  Beli Rp 120.000 → pembeli: +Rp 20.000

Neraca positif = reward reputasi dari kontribusi komunitas
Neraca negatif = konsekuensi dari penjualan (mendorong buyback)
```

### Poin sebagai reputasi nyata (Fase 3+)
```
Di masa depan:
X poin = Y buyback credit (setara nilai 1 NFT)
Poin positif = buyback credit tambahan (naik peringkat)
Poin negatif = pengurangan buyback credit (turun peringkat)

Contoh: poin minus setara 1 NFT = -1 buyback credit
→ Otomatis turun peringkat
Contoh: poin positif setara 1 NFT = +1 buyback credit
→ Bisa digunakan untuk naik peringkat tanpa buyback fisik
```

---

## Sistem konfirmasi transaksi (3 opsi)

Setiap pembelian NFT tidak langsung selesai:

```
1. KONFIRMASI MANUAL (seller aktif):
   → Poin langsung masuk neraca pembeli
   
2. REPORT (transaksi mencurigakan):
   → Masuk purchase_disputes
   → Admin review → approve/reject
   
3. AUTO-COMPLETE (7 hari tidak ada aksi):
   → Sistem otomatis selesaikan
   → Poin masuk neraca pembeli

Tujuan: mencegah transaksi fiktif, memberi waktu report
Holding period: NFT harus dipegang X hari sebelum bisa validasi
```

---

## Mekanisme validasi bergulir

### Konsep saat ini (Fase 2)
```
User memilih NFT dari dashboard → checkbox → validasi project
Nilai validasi = nilai_selisih NFT tersebut
NFT terkunci selama menjadi validator aktif
Revalidasi → validator lama digantikan → NFT dikembalikan
```

### Konsep target (Fase 3 — FIFO Validation)
```
Validasi project X:
1. User buka /validate → pilih project yang ingin divalidasi
2. Klik "Validasi" → diarahkan ke pool FIFO
3. User beli NFT dari pool (NFT manapun, bukan harus dari project X)
4. Selisih pembelian LANGSUNG menjadi nilai validasi project X
5. NFT masuk dashboard dengan harga dasar
   (selisih sudah dipakai validasi)

Mengapa lebih baik:
→ Validasi = kontribusi nyata ke likuiditas pool
→ Tidak ada "kumpulkan poin dulu, validasi nanti"
→ Menghidupkan pool FIFO secara natural
→ Lebih sulit untuk self-dealing
```

### Status NFT valid di FIFO (Fase 3)
```
NFT valid dijual di Explorer biasa:
→ Status valid dipertahankan
→ Diperjualbelikan normal

NFT valid masuk antrian FIFO:
→ Setelah terbeli → OTOMATIS INVALID
→ Dana validator yang terkunci = yang menanggung antrian
→ Ini adalah "konversi pengakuan ke likuiditas nyata"

Visi: NFT valid yang diakui komunitas bisa jadi alat tukar,
karena ada jaminan antrian likuiditas selama komunitas ada
```

---

## Dedicated Liquidity (Fase 3+)

```
Konsep: siapapun bisa menjual NFT yang mereka miliki
dengan project charity MEREKA SENDIRI

Caranya:
1. Kumpulkan 30 NFT (dari pembelian manapun)
2. Buat project charity sendiri
3. Daftarkan NFT tersebut sebagai bagian project
4. Semua tanggung jawab buyback ada di tangan penjual

Mengapa ini valid:
→ NFT yang sama dijual oleh banyak pihak
  = semakin banyak antrian buyback
  = semakin banyak pengakuan kolektif
→ AI di masa depan akan menilai konsistensi:
  apakah project charity-nya relevan dengan NFT?
→ Log yang tidak konsisten = minus anomali di masa depan

Syarat: harus punya project original sendiri
→ Mencegah pure speculator tanpa kontribusi nyata
```

---

## Peran AI — detector anomali, bukan pengambil keputusan

```
AI BUKAN: pengambil keputusan, hakim, eksekutor
AI ADALAH: detector anomali berbasis log transaksi

Input: log transaksi publik (semua transaksi tercatat)
Output: anomali_percentage (0-100%)

0%    → tidak ada anomali, posisi tidak berubah
1-99% → flag untuk review komunitas/admin
100%  → transaksi dianggap tidak ada

Prinsip:
→ AI tidak pilih kasih — parameternya sama untuk semua
→ Keputusan tetap di algoritma dasar dan komunitas
→ AI semakin pintar = persentase kesalahan semakin kecil
→ Tapi tidak pernah 0% = sistem tetap butuh komunitas

Di masa depan:
→ Log transaksi yang tidak jujur dari masa lalu
  bisa "dihukum" oleh AI yang lebih pintar
→ Anomali lama bisa dideteksi dan diberi minus
→ Ini mendorong kejujuran dari awal
```

---

## Fibonacci Capacity — kapasitas pool

```
Kapasitas pool bukan statis, mengikuti pertumbuhan organik:

kapasitas_aktif = jumlah_top_developer × 3

Ini mencerminkan filosofi Fibonacci:
→ Pertumbuhan komunitas menentukan kapasitas
→ Tidak bisa dipaksakan atau dimanipulasi
→ Natural growth = natural capacity

Untuk validasi bergulir bisa dimulai:
jumlah_nft_valid >= kapasitas_minimum (dari community_config)

Di Fase Advance: kapasitas mengikuti deret Fibonacci murni
berdasarkan jumlah user aktif
```

---

## Fee sharing — infrastruktur otonom

```
Sumber fee: top_developer menyisihkan fee_project_pct (2-5%)
dari setiap project

Distribusi (tidak ada transfer dana fisik):
→ Developer neraca -= fee_total (poin simbolik)
→ fee_pool terkumpul (untuk infrastruktur)
→ Validator neraca += bagian proporsional (poin simbolik)

Di Fase Advance:
→ fee_pool digunakan untuk membiayai infrastruktur secara otonom
→ Ada "vendor infrastruktur" yang project charity-nya
  adalah membiayai server/hosting
→ NFT mereka langsung valid dan masuk pool rekomendasi
→ Sistem membiayai dirinya sendiri
```

---

## Multi-node federation — menuju desentralisasi

```
Setiap instance Inspira Better World:
├── Punya database sendiri (Firebase terpisah)
├── Punya administrator sendiri
├── Setup parameter sendiri
└── Menggunakan kode yang sama (open source)

Yang di-federate antar instance:
├── Index developer global (ranking lintas instance)
├── Index project global
├── NFT valid — bisa dilihat dari instance manapun
└── Reputasi user — bisa dibawa pindah instance

Syarat federasi:
→ Kode tidak dimodifikasi (versi sama = terverifikasi)
→ Mendaftarkan instance ke registry publik (GitHub Pages)
→ Mematuhi parameter minimum komunitas global

Portal komunitas (GitHub Pages):
→ instances.json — daftar semua node
→ Badge "Verified" jika versi sama
→ Badge "Modified" jika kode diubah (keluar federasi)
→ User bisa pindah ke instance yang parameter-nya lebih baik
```

---

## Hierarki administrator (sementara, menuju otonom)

```
Saat ini (terpusat):
SuperAdmin → Admin → Moderator → User

Menuju otonom (Fase Advance):
→ Peran admin berkurang sedikit demi sedikit
→ AI mengambil alih deteksi anomali
→ Komunitas mengambil alih keputusan
→ Pada titik otonom penuh: tidak ada admin

Hirarki akses saat ini:
SuperAdmin: semua akses + kelola tim admin
Admin: semua fitur kecuali kelola tim
Moderator: review komentar + dispute
User: transaksi normal
```

---

## Roadmap implementasi

### Fase 1 (selesai) — Fondasi logika dasar
```
✓ Auth, community_config, explorer, beli NFT
✓ Dashboard neraca, developer ranking
✓ Komentar, admin panel
```

### Fase 2 (hampir selesai) — Keamanan dan tata kelola
```
✓ Buyback 2 arah
✓ Sistem konfirmasi 3 opsi + auto-complete
✓ Holding period validasi
✓ Multi-admin hierarki
✓ Personal blocklist
✓ Soft delete project
✓ Pembatasan algoritmik (realisasi transaksi)
○ GitHub Pages portal komunitas
```

### Fase 3 (branch baru) — Mendekati konsep asli
```
○ FIFO validation: validasi via pembelian di pool
○ NFT valid invalid setelah terbeli di FIFO
○ Poin sebagai reputasi dengan efek peringkat nyata
○ Dedicated liquidity implementation
○ Fibonacci capacity calculation dinamis
```

### Fase Advance — Infrastruktur otonom
```
○ Multi-node federation aktif
○ AI anomali detection (Gemini API atau setara)
○ Vendor infrastruktur otonom
○ State snapshot / backup ke GitHub
○ Fibonacci node spreading
```

### Fase Otonom — DAPP atau near-DAPP
```
○ Tidak ada administrator
○ AI mengelola anomali detection
○ Komunitas global mengatur parameter
○ Lazy minting NFT di platform eksternal
○ Custodian kartu NFT fisik
```

---

## Catatan untuk kontributor

Sistem ini sengaja tidak memiliki otoritas pusat. Setiap implementasi harus mengikuti prinsip ini:

- Jangan buat fungsi yang memindahkan dana secara langsung antar user
- Semua perubahan nilai harus melalui neraca transaksi
- AI monitoring harus transparan dan parameternya terdokumentasi
- Setiap keputusan algoritma harus bisa di-audit dari log transaksi
- Fibonacci adalah pola target, bukan sekedar angka

**Pesan untuk developer masa depan dan AI yang akan mengembangkan ini:**

Konsep ini tidak berubah dari awal. Yang berubah hanya implementasinya, menyesuaikan kemampuan teknologi dan komunitas yang ada. Bacalah log transaksi — di situlah semua kebenaran tersimpan. Sistem yang jujur akan selalu bisa dipertahankan, sistem yang tidak jujur akan dihukum oleh AI yang semakin pintar dari waktu ke waktu.

---

> Versi dokumen: 2.0
> Status project: Fase 2 hampir selesai, menuju Fase 3
> GitHub: github.com/wahana108/earth-protector-migration
> Open source — siapapun bisa fork, jalankan, dan berkontribusi

---

## Implementasi Fibonacci — kode dan penerapan

### Logika yang digunakan

Untuk suatu angka N (User Aktif), kita **menjumlahkan deret Fibonacci dari awal** dan berhenti pada Fibonacci terbesar yang membuat total sum masih ≤ N.

```
Aturan:
→ Deret: 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ...
→ Jumlahkan dari awal terus menerus
→ Berhenti saat menambahkan angka berikutnya akan melebihi N
→ Fibonacci terbesar = angka terakhir yang masih bisa masuk
→ Total sum = kapasitas organik komunitas

Contoh N=100:
1+1+2+3+5+8+13+21+34 = 88 ✓
88 + 55 = 143 > 100 ✗ → berhenti
Fibonacci terbesar = 34, total sum = 88
```

### Algoritma dasar (Python — referensi)

```python
def fibonacci_largest_and_sum(N):
    if N < 1:
        return 0, 0, []
    
    sequence = [1, 1]      # Deret Fibonacci
    total = 2              # 1 + 1
    
    while True:
        next_fib = sequence[-1] + sequence[-2]
        
        # Berhenti jika menambahkan next_fib akan melebihi N
        if total + next_fib > N:
            break
            
        sequence.append(next_fib)
        total += next_fib
    
    largest_fib = sequence[-1]
    return largest_fib, total, sequence

# Contoh N=50:
# Deret: [1, 1, 2, 3, 5, 8, 13]
# Total sum: 33
# Fibonacci terbesar: 13
```

### Implementasi JavaScript untuk platform Inspira Better World

```javascript
function fibonacciLargestAndSum(N) {
  if (N < 1) return { largest: 0, totalSum: 0, sequence: [] };
  
  const sequence = [1, 1];
  let total = 2;
  
  while (true) {
    const nextFib = sequence[sequence.length-1] + sequence[sequence.length-2];
    if (total + nextFib > N) break;
    sequence.push(nextFib);
    total += nextFib;
  }
  
  return {
    largest: sequence[sequence.length-1],
    totalSum: total,
    sequence: sequence
  };
}

// Penerapan utama di Inspira Better World:
function calculateInspiraCapacity(userAktif) {
  const { largest, totalSum, sequence } = fibonacciLargestAndSum(userAktif);
  const prevFib = sequence[sequence.length-2] || 1;
  const nextMilestone = largest + prevFib;
  
  return {
    // Batas atas top developer = Fibonacci terbesar
    max_top_developer: largest,
    
    // Kapasitas total NFT valid = total sum (kapasitas organik)
    kapasitas_nft_valid: totalSum,
    
    // Kapasitas pool rekomendasi = max_top_developer × 3
    kapasitas_pool: largest * 3,
    
    // Minimum pool untuk mulai validasi = Fibonacci sebelumnya
    min_pool_validasi: prevFib,
    
    // Deret lengkap untuk referensi
    fibonacci_sequence: sequence,
    
    // Milestone berikutnya (seperti "halving" Bitcoin)
    next_node_milestone: nextMilestone
  };
}
```

### Tabel referensi untuk berbagai skala komunitas

```
User Aktif (N) | Fib Terbesar | Total Sum | Kapasitas Pool | Min Validasi
---------------|--------------|-----------|----------------|-------------
10             | 3            | 7         | 9              | 2
21             | 8            | 20        | 24             | 5
50             | 13           | 33        | 39             | 8
100            | 34           | 88        | 102            | 21
250            | 89           | 232       | 267            | 55
500            | 144          | 376       | 432            | 89
1000           | 377          | 986       | 1131           | 233
2500           | 610          | 1596      | 1830           | 377
5000           | 1597         | 4180      | 4791           | 987
10000          | 2584         | 6764      | 7752           | 1597
```

### Penerapan di 5 area platform

#### 1. Kapasitas dinamis berdasarkan user aktif

```javascript
async function recalculateFibonacciCapacity() {
  // user aktif = yang bertransaksi 30 hari terakhir
  const userAktif = await countActiveUsers();
  const capacity = calculateInspiraCapacity(userAktif);
  
  await updateCommunityConfig({
    kapasitas_pool_minimum: capacity.kapasitas_nft_valid,
    minimum_nft_pool_untuk_validasi: capacity.min_pool_validasi
  });
  
  return capacity;
}
// N=100: max_top_dev=34, kapasitas_nft=88, min_validasi=21
```

#### 2. Batch AI monitoring — hemat energi komputasi

```javascript
function getBatchForAIMonitoring(allUsers, userAktif) {
  const { largest } = fibonacciLargestAndSum(userAktif);
  
  // Urutkan berdasarkan peringkat (buyback%, neraca, dll)
  const sorted = allUsers.sort((a, b) => b.rank_score - a.rank_score);
  
  // AI hanya menganalisis sejumlah Fibonacci terbesar user teratas
  // Contoh: 100 user aktif → AI hanya analisis 34 user teratas
  const priorityForAI = sorted.slice(0, largest);
  const regularAlgorithm = sorted.slice(largest);
  
  return { priorityForAI, regularAlgorithm };
}
// Keuntungan: AI tidak menganalisis semua user
// Hemat energi komputasi, fokus pada yang berpengaruh
```

#### 3. Node spreading — milestone seperti "halving" Bitcoin

```javascript
const NODE_FIBONACCI = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

function checkNodeMilestone(currentNodes) {
  const currentIdx = NODE_FIBONACCI.lastIndexOf(
    Math.max(...NODE_FIBONACCI.filter(f => f <= currentNodes))
  );
  const nextMilestone = NODE_FIBONACCI[currentIdx + 1];
  const prevMilestone = NODE_FIBONACCI[currentIdx];
  
  return {
    milestone_tercapai: prevMilestone,
    milestone_berikutnya: nextMilestone,
    progress_pct: Math.round(currentNodes / nextMilestone * 100),
    // Insentif bertambah semakin dekat ke milestone
    // Mendorong pertumbuhan organik
    insentif_level: currentIdx + 1
  };
}
// Contoh: 8 node → milestone=8 tercapai, berikutnya=13
// progress=61%, insentif_level=6
```

#### 4. Cross-community NFT validation

```javascript
function calculateCrossNodeWeight(nftId, allNodes) {
  // Berapa node yang mengakui NFT ini
  const recognizingNodes = allNodes.filter(n => 
    n.validatedNFTs.includes(nftId)
  ).length;
  
  // Bobot = Fibonacci terbesar dari total sum <= recognizingNodes
  const { largest } = fibonacciLargestAndSum(recognizingNodes);
  
  return {
    node_count: recognizingNodes,
    // Semakin banyak node mengakui = bobot antrian likuiditas makin besar
    // 1 node = bobot 1x, 5 node = bobot 5x, 8 node = bobot 8x
    fibonacci_weight: largest,
    // NFT diakui lintas komunitas = kepercayaan global lebih besar
    cross_community_trusted: recognizingNodes >= 3
  };
}
```

#### 5. Anomali detection — alokasi AI proporsional

```javascript
function allocateAIResources(userAktif, totalTransactions) {
  const { largest, totalSum, sequence } = fibonacciLargestAndSum(userAktif);
  
  return {
    // Top developer: analisis penuh oleh AI API
    ai_full_analysis: largest,
    
    // Calon top developer (Fibonacci range berikutnya): analisis parsial
    ai_partial_analysis: totalSum - largest,
    
    // User biasa: algoritma dasar saja
    basic_algorithm_only: userAktif - totalSum,
    
    // Transaksi yang dianalisis AI = proporsional Fibonacci
    // Bukan semua transaksi — hemat energi
    transactions_for_ai: Math.round(totalTransactions * (largest / userAktif))
  };
}
// N=100:
// ai_full_analysis = 34 user (top developer)
// ai_partial = 54 user (calon top developer)
// basic_only = 12 user (user biasa)
// Hanya 34% transaksi yang dikirim ke AI
```

---

### Filosofi implementasi Fibonacci di Inspira Better World

```
Mengapa total_sum sebagai kapasitas organik:
→ Bukan angka arbitrary yang ditentukan admin
→ Mencerminkan kemampuan komunitas secara natural
→ Tidak bisa dimanipulasi — mengikuti matematika alam

Mengapa Fibonacci terbesar sebagai batas top developer:
→ Seimbang: tidak terlalu sedikit (bottleneck)
  dan tidak terlalu banyak (monopoli)
→ Tumbuh seiring komunitas bertumbuh
→ Setiap pertumbuhan signifikan → threshold naik otomatis

Node milestone seperti "halving" Bitcoin:
→ Setiap kali node mencapai angka Fibonacci berikutnya
→ Ada evaluasi, reward, atau peningkatan kapasitas
→ Mendorong pertumbuhan organik dan berkelanjutan

Hemat energi AI:
→ AI hanya menganalisis sejumlah Fibonacci terbesar user
→ Di komunitas 1000 user → hanya 377 yang dianalisis AI
→ 62% lebih hemat dibanding analisis semua user
→ Fokus pada yang paling berpengaruh di komunitas

Cross-community trust:
→ NFT diakui 1 node → bobot 1
→ NFT diakui 3 node → bobot 2 (Fibonacci ke-3)
→ NFT diakui 5 node → bobot 5
→ Pertumbuhan kepercayaan mengikuti deret alam
```

---

> Catatan: Semua angka adalah parameter yang bisa disesuaikan.
> Yang tidak berubah adalah filosofinya: pertumbuhan organik mengikuti alam.
> Kode di atas adalah referensi implementasi — bukan kode production final.
