# 🗺️ Project Roadmap & Future Enhancements

Rencana pengembangan dan roadmap fitur untuk **Discord SelfBot Message Scheduler (SaaS Edition)**.

---

## 📌 Phase 1: Core Setup, Stabilization & Commercial License Protection (Completed)
- [x] Konversi arsitektur ke Worker Threads terisolasi.
- [x] Sistem penyimpanan token aman dengan enkripsi AES-256.
- [x] Integrasi Payment Gateway PaKasir QRIS dengan Webhook handler.
- [x] Dynamic Delay & slowmode adaptation untuk auto scheduler.
- [x] Dedicated Private Workspace & Live Log Thread per user.
- [x] Admin tool command suite (`/admin`, `/deploy-store`, `/stats`).
- [x] Central License API Key System with HWID Auto-Binding & Heartbeat Daemon.
- [x] Commercial Code Obfuscation Pipeline (`npm run build:protected`).
- [x] Validasi setup environment (`.env`), Prisma client generation, dan TypeScript compilation check.
- [x] Unlock Unlimited Channel Workers (Menghilangkan batasan maksimal 5 active tasks per user).
- [x] **Dual-Layer Modular Architecture**: Pemisahan Protected Core Engine vs Open Customization Layer.
- [x] **Config-Driven Theme Engine (`theme.config.json`)**: Kustomisasi branding, warna embed hex, dan emoji dengan auto hot-reload.
- [x] **Modular Plugin & Lifecycle Hooks (`custom/plugins/`)**: Pengguna bebas menyematkan skrip event handler (`onBotReady`, `onPostSuccess`, `onPostFailed`).
- [x] **HMAC-SHA256 Cryptographic License Signing**: Anti-tamper & anti-crack token validation yang menjamin proteksi lisensi tetap kokoh meski UI/sistem dibuka untuk kustomisasi pengguna.

---

## 🚀 Phase 2: Anti-Detection & Proxy Integration (Upcoming)
- [ ] **HTTP / SOCKS5 Proxy Support**: Dukungan setting custom proxy per akun selfbot untuk mencegah Discord IP ban / flag saat multiple akun jalan bersamaan.
- [ ] **Custom Device & User-Agent Spoofing**: Opsi kustomisasi client signature (Discord Desktop, Web, Mobile iOS/Android) pada `discord.js-selfbot-v13`.
- [ ] **Spintax & AI Message Variations**: Integrasi template pesan dengan spintax (contoh: `{Halo|Hai|Hey} bro!`) atau variasi AI prompt agar isi broadcast tidak monoton dan anti deteksi spam filter.

---

## 🌐 Phase 3: Web Dashboard UI & Extended Analytics
- [ ] **Web Dashboard**: Aplikasi frontend berbasis Next.js / Vite untuk monitoring akun, task scheduler, analitik statistik, dan riwayat broadcast secara visual di browser.
- [ ] **OAuth2 Discord Login**: Autentikasi user via Discord OAuth2 di web dashboard.
- [ ] **Advanced Analytics & Charts**: Grafik total broadcast per hari, success/failure rate, dan peak broadcast hours.

---

## 💳 Phase 4: Multi-Payment Gateway & Affiliate System
- [ ] **Alternative Payment Gateways**: Dukungan Midtrans, Xendit, dan Tripay (Virtual Account, E-Wallet, Retail Outlet).
- [ ] **Affiliate / Referral System**: Sistem komisi referral bagi user yang mengajak member lain untuk berlangganan.
- [ ] **Custom Coupon Codes**: Sistem promo diskon atau voucher masa aktif langganan.
