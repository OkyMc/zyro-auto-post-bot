# 🤖 Zyro Post - Enterprise Discord Auto Post & Scheduler

Selamat datang di repository resmi **Zyro Post**! Platform bot Discord enterprise-grade yang didesain untuk otomasi broadcast pesan multi-akun dengan keamanan tinggi, integrasi pembayaran QRIS instan, dan arsitektur modular **Dual-Layer** (Protected Core + Open Customization Layer).

---

## ⚡ Fitur Utama

- 🧵 **Isolated Worker Threads**: Setiap akun selfbot berjalan pada thread mandiri anti-freeze.
- 🎨 **Config-Driven Theme (`theme.config.json`)**: Kustomisasi nama bot, logo, banner GIF, warna embed, dan emoji tanpa perlu coding.
- 🧩 **Modular Plugin & Hooks System (`custom/plugins/`)**: Pengguna bebas menambahkan plugin dan webhook pribadi (`onBotReady`, `onPostSuccess`, `onPostFailed`).
- 🔐 **Cryptographic Security & License Lock**: Enkripsi AES-256 untuk token Discord, HWID auto-binding, dan verifikasi lisensi berbasis tanda tangan HMAC-SHA256 dari Central License Server.
- 💳 **Otomasi Pembayaran QRIS (PaKasir)**: Webhook realtime untuk aktivasi workspace otomatis.
- 👑 **Admin Command Suite**: `/admin`, `/deploy-store`, dan `/stats`.

---

## 🚀 Panduan Memulai Cepat

### 1. Install Dependencies
```bash
npm install
```

### 2. Konfigurasi `.env`
Salin `.env.example` ke `.env` lalu sesuaikan kredensial bot Discord, database MySQL, dan kunci enkripsi 32-karakter.

### 3. Sinkronisasi Database
```bash
npx prisma generate
npx prisma db push
```

### 4. Build & Run
- **Development**: `npm run dev`
- **Production**: `npm run build && npm start`
- **Protected Commercial Release**:
  ```bash
  npm run build:protected
  node scripts/pack-client.js
  ```
  *(Menghasilkan bundle zip siap jual `zyro-post-client.zip` dengan core terenkripsi namun UI & tema terbuka untuk diedit buyer).*

---

## 📖 Dokumentasi Lengkap

Dokumentasi arsitektur, database, aturan developer, dan roadmap tersedia lengkap di folder [`docs/`](docs/):
- [README.md](docs/README.md) - Panduan umum
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Arsitektur sistem & diagram alur
- [FEATURES.md](docs/FEATURES.md) - Rincian fitur
- [DATABASE.md](docs/DATABASE.md) - Schema Prisma MySQL
- [RULES.md](docs/RULES.md) - Panduan dan standar keamanan kode
- [ROADMAP.md](docs/ROADMAP.md) - Roadmap pengembangan

---
© 2026 Zyro Post. All rights reserved.
