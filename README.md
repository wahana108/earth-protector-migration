# Earth Protector Migration

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
![Environmental focus](https://img.shields.io/badge/Focus-Earth%20Protection-green)

**Earth Protector Migration** adalah sebuah perangkat khusus yang dirancang untuk memfasilitasi migrasi data lingkungan dan kerangka kerja perlindungan bumi secara aman dan berkelanjutan. Proyek ini bertujuan untuk memastikan data ekologis kritis tetap dapat diakses dan digunakan di berbagai platform.

## 📜 Manifesto Proyek
Kami percaya bahwa perangkat lunak yang dibangun untuk planet ini harus transparan, etis, dan kolaboratif. Nilai-nilai inti dan visi jangka panjang kami diuraikan dalam manifesto resmi kami.

👉 **[Baca Manifesto Earth Protector](docs/manifesto.md)**

## 🚀 Memulai

### Prasyarat
- Node.js (v18+)
- Git

### Instalasi
1. Clone repositori:
   ```bash
   git clone https://github.com/wahana108/earth-protector-migration.git
   ```
2. Masuk ke direktori:
   ```bash
   cd earth-protector-migration
   ```
3. Instal dependensi:
   ```bash
   npm install
   ```

## ⚙️ Otomatisasi Recalculate Developer Levels

Sistem menggunakan dua lapis untuk menjaga kuota Top Developer (berbasis Fibonacci) selalu akurat:

**Lapis 1 — Lazy Evaluation (otomatis, tanpa setup)**

Recalculate berjalan di background setiap kali halaman `/top-developers` dimuat, jika sudah lebih dari 24 jam sejak recalculate terakhir. Tidak perlu konfigurasi tambahan.

**Lapis 2 — GitHub Actions Cron (opsional, direkomendasikan untuk fork)**

Cron menandai permintaan recalculate setiap pukul 01:00 WITA. Eksekusi aktual terjadi saat user berikutnya membuka `/top-developers` — ini by design, konsisten dengan lazy evaluation.

Setup untuk fork Anda:

1. Set environment variable `RECALC_SECRET` di Vercel (nilai acak, contoh: string 32 karakter)
2. Set dua GitHub Secrets di repository Anda:
   - `APP_URL` — URL Vercel deployment Anda (contoh: `https://my-instance.vercel.app`)
   - `RECALC_SECRET` — nilai yang sama dengan env var di Vercel

Workflow `.github/workflows/daily-recalculate.yml` akan aktif otomatis setelah fork.

## 🤖 AI Review Otonom (Level 2)

Platform mendukung review anomali developer otomatis menggunakan Gemini API, tanpa campur tangan admin. Aktif pada tanggal 1 tiap bulan via GitHub Actions cron.

**Setup untuk fork Anda:**

1. Set environment variables di Vercel:
   - `GEMINI_API_KEY` — dari [Google AI Studio](https://aistudio.google.com/app/apikey)
   - `AI_REVIEW_SECRET` — string acak (sama dengan GitHub Secret di bawah)
   - `FIREBASE_SERVICE_ACCOUNT_KEY` — base64(JSON) dari Firebase console → Project Settings → Service Accounts → *Generate new private key*
2. Set GitHub Secrets di repository Anda:
   - `APP_URL` — URL Vercel deployment Anda (sudah ada jika sudah set recalculate)
   - `AI_REVIEW_SECRET` — sama dengan nilai di Vercel
3. Aktifkan di `/parameters` → card **AI Governance**:
   - Aktifkan **AI Governance** (master switch)
   - Aktifkan **Mode Otonom (Level 2)**

Workflow `.github/workflows/monthly-ai-review.yml` akan aktif otomatis setelah fork. Gunakan tombol *Run workflow* di GitHub Actions tab untuk test manual pertama kali.

## 🌱 Dirikan Komunitas Anda Sendiri

Ingin menjalankan node "Inspira Better World" independen dengan mata
uang dan admin Anda sendiri (bukan berkontribusi ke repo ini)? Baca
[Fork Guide](FORK_GUIDE.md) — panduan lengkap fork → Firebase → Vercel
→ konfigurasi → daftar ke registry komunitas.

## 🤝 Kontribusi
Kami menyambut kontribusi dari para pecinta lingkungan dan pengembang! Silakan baca [Panduan Kontribusi](CONTRIBUTING.md) dan [Kode Etik](CODE_OF_CONDUCT.md) kami untuk memulai.

## 📄 Lisensi
Proyek ini dilisensikan di bawah Lisensi MIT.
