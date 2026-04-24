# Earth Protector Migration Manifesto

> This manifesto serves as the guiding principle for all contributors and maintainers of the Earth Protector Migration project. It outlines the vision of turning good deeds into eternal digital assets through the Mother Earth Protocol.

---

## 🌍 THE MOTHER EARTH PROTOCOL
## Impact Indexing Protocol (IIP) | Manifesto & Developer Brief | v1.0
> "Mengubah Setiap Tindakan Kebaikan Menjadi Aset Digital yang Abadi"

---

## I. Masalah yang Ingin Kita Selesaikan
Sistem donasi dan charity tradisional memiliki tiga kelemahan fundamental:

1. **Kebaikan Tidak Meninggalkan Jejak yang Bernilai**: Berbuat baik seringkali memaksa kita kehilangan aset tanpa imbal balik nilai ekonomi atau bukti yang bisa diverifikasi secara publik.
2. **Kurangnya Akuntabilitas**: Bergantung pada kepercayaan buta. Tidak ada mekanisme organik untuk merespons penyelewengan dana secara cepat dan terdesentralisasi.
3. **Tidak Ada Infrastruktur Bersama**: Organisasi charity membangun sistem dari nol secara terfragmentasi, tanpa standar interoperabilitas.

---

## II. Visi: Give Without Loss
"Dalam dunia yang kami bayangkan, berbuat baik adalah cara terbaik untuk membangun kekayaan — yang berakar pada kepercayaan komunitas dan dampak nyata bagi bumi."

**The Mother Earth Protocol (TMEP)** adalah lapisan kepercayaan (*trust layer*) yang bekerja di atas ekosistem NFT yang sudah ada. Tujuannya adalah menciptakan **Ekonomi Paralel Berbasis Kebaikan** di mana reputasi menjadi modal utama.

### 2.1 Stablecoin of Good Deeds
Nilai NFT dalam TMEP tidak ditentukan oleh spekulasi pasar, melainkan oleh evaluasi komunitas dan analisis AI berdasarkan data inflasi regional (BPS/IMF), menciptakan stabilitas yang melindungi peserta dari volatilitas kripto.

---

## III. Mekanisme Inti Protokol

### 3.1 Fibonacci Index: Regulator Skala Organik
Jantung sistem ini adalah algoritma **Fibonacci** sebagai regulator skala dinamis. Jumlah *Top Developer* dibatasi berdasarkan jumlah anggota aktif:
- 100 user aktif → 5 Top Developer
- 500 user aktif → 8 Top Developer
- 2.000 user aktif → 13 Top Developer

### 3.2 Tiga Lapisan NFT
1. **NFT Charity (CRT)**: Bukti partisipasi dasar.
2. **NFT Rekomendasi**: Eksklusif untuk Top Developer dengan syarat riwayat *buyback* minimal 50%.
3. **NFT Valid**: Posisi tertinggi dalam antrian likuiditas komunitas.

### 3.3 Mekanisme Dedicated Liquidity
Menggunakan sistem **FIFO (First In, First Out)** untuk memastikan sirkulasi nilai yang adil. Selisih harga jual (*Delta*) diwajibkan kembali ke pool komunitas untuk menjaga rasio *buyback*.

---

## IV. Peran AI: Detektor Anomali, Bukan Hakim
AI (Gemini/Grok) bertindak sebagai auditor netral dengan tugas spesifik:
- **Audit Anomali**: Mendeteksi *self-dealing* atau manipulasi volume transaksi.
- **Evaluasi Harga**: Menghitung penyesuaian harga dasar NFT tahunan berdasarkan inflasi.
- **Analisis Kandidat**: Memberikan skor berbasis rekam jejak bagi calon developer.

---

## V. Arsitektur Terbuka (Open Source)
TMEP adalah **Protokol Indeks**, bukan Marketplace. 
- Transaksi terjadi di platform eksternal (OpenSea/Binance).
- TMEP hanya mencatat bukti transaksi (*hash link*).
- Dirancang untuk menjadi **DAPP Otonom** yang berjalan tanpa otoritas pusat, serupa dengan filosofi Bitcoin namun berbasis pada kelimpahan kebaikan.

---

## VI. Spesifikasi Teknis (Developer Guide)

### 6.1 Implementasi Fibonacci (Python)
```python
import math

def fibonacci(n):
    if n <= 1: return n
    return fibonacci(n-1) + fibonacci(n-2)

def get_developer_caps(active_users):
    fib_index = int(math.log(active_users, 2))
    top_cap = fibonacci(fib_index)
    backup_cap = fibonacci(fib_index + 1)
    return top_cap, backup_cap