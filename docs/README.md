# 🤖 Zyro Post - Enterprise Discord Auto Post & Scheduler

Yo gengs! 👋 Selamat datang di dokumentasi resmi **Zyro Post**. Ini adalah platform bot Discord enterprise-grade yang udah disulap jadi SaaS (Software as a Service) modern. Sistem ini bisa nge-manage multiple akun selfbot Discord, scheduling broadcast pesan otomatis dengan dynamic delay, integrasi payment gateway QRIS otomatis (PaKasir), arsitektur isolated Worker Threads, dan kini hadir dengan **Dual-Layer Architecture** (Protected Core + Open Customization Layer) sehingga user/buyer bebas mengubah tampilan & sistem sesuka hati namun tetap terproteksi lisensi dengan sistem keamanan kriptografis yang ketat! 🔥

---

## ⚡ Quick Specs

| Item | Tech / Detail |
|---|---|
| **Runtime** | Node.js (v18+) & TypeScript |
| **Main Bot Framework** | Discord.js v14 |
| **Selfbot Engine** | `discord.js-selfbot-v13` |
| **Database** | MySQL via Prisma ORM |
| **Process Isolation** | Node.js Worker Threads (`piscina` style / native worker) |
| **Security** | AES-256 Encryption & HMAC-SHA256 Cryptographic License |
| **UI Customization** | Config-Driven Theme (`theme.config.json`) with Hot-Reload |
| **System Extensibility** | Modular Plugin & Lifecycle Hooks (`custom/plugins/`) |
| **Payment Gateway** | PaKasir API (QRIS Realtime Webhook) |
| **Web Server** | Express.js (Webhook & Healthcheck) |

---

## 🎨 Panduan Kustomisasi Tampilan & Sistem (Buyer Friendly)

### 1. Kustomisasi Tampilan & Tema (`theme.config.json`)
Cukup edit file `theme.config.json` di root folder bot. Kamu bisa mengubah:
- **Branding**: Ganti nama bot, avatar/logo URL, banner GIF, dan link website.
- **Warna Embed**: Ganti warna tema dengan kode hex (`#5865F2`, `#57F287`, `#ED4245`, dsb.).
- **Emojis**: Kustomisasi icon status running, stopped, gear, pending.
- **Judul UI**: Ubah judul Task Manager, Panel Kontrol, Store, Tutorial, dsb.

### 2. Kustomisasi Fitur & Webhook (`custom/plugins/`)
Ingin mengirim notifikasi ke Telegram atau Webhook Discord pribadi setiap kali bot berhasil posting?
Cukup buat file baru di `custom/plugins/my-plugin.plugin.js`:
```javascript
module.exports = {
    name: 'MyNotifier',
    onPostSuccess(event) {
        // Kirim event.task & event.channelId ke webhook pribadi kamu!
    }
};
```

---

## 🚀 Panduan Setup Singkat (How to Run)

### 1. Prasyarat (Prerequisites)
Pastikan kamu udah install:
- **Node.js**: v18.x atau v20.x+
- **NPM** atau **PNPM / Yarn**
- **MySQL Database**: MySQL Server 8.0+ atau MariaDB.

### 2. Clone & Install Dependencies
```bash
# Clone repo
git clone https://github.com/Gioxaa/Discord-SelfBot-MessageScheduler.git
cd Discord-SelfBot-MessageScheduler

# Install dependencies
npm install
```

### 3. Setup Environment Variables (`.env`)
Salin atau buat file `.env` di root project:
```env
# Server
PORT=3000

# MySQL Database URL
DATABASE_URL="mysql://root:password@127.0.0.1:3306/discord_saas"

# Discord Bot Manager Credentials
BOT_TOKEN="your_discord_bot_token_here"
CLIENT_ID="your_discord_application_client_id"
GUILD_ID="your_discord_server_id"

# Security (Wajib 32 Karakter Pas!)
ENCRYPTION_KEY="12345678901234567890123456789012"

# License API Key (Wajib jika dijual ke buyer)
LICENSE_KEY="ZYRO-XXXX-XXXX-XXXX"
LICENSE_SERVER_URL="https://license.domainlu.com"
LICENSE_CHECK_INTERVAL_MINUTES="30"
ENABLE_LICENSE_CHECK="true"

# Administration
ADMIN_ID="your_discord_user_id"
ADMIN_ROLE_ID="your_admin_role_id"
```

### 4. Sinkronisasi Database Prisma
```bash
npx prisma generate
npx prisma db push
```

### 5. Deploy Slash Commands ke Discord
```bash
npm run deploy
```

### 6. Jalankan Aplikasi
- **Development Mode** (Hot-reload dengan Nodemon):
  ```bash
  npm run dev
  ```
- **Production Mode** (Compile & Run):
  ```bash
  npm run build
  npm start
  ```
- **Commercial Protected Build** (Selective Obfuscation untuk Dijual ke Buyer):
  ```bash
  npm run build:protected
  node scripts/pack-client.js
  ```

---

## 📂 Struktur Direktori

```text
├── custom/               # Modular Plugin & Custom Lifecycle Hooks (Buyer Editable)
│   └── plugins/          # File Plugin JavaScript kustom (.plugin.js)
├── docs/                 # Dokumentasi Lengkap Sistem
├── license-server/       # Standalone Central License Server & CLI Manager
├── prisma/               # Schema Prisma & Database definitions
├── scripts/              # Helper Build & Selective Obfuscation Scripts
├── src/
│   ├── api/              # Express HTTP Server & Webhook Controller
│   ├── commands/         # Slash Commands (/admin, /deploy-store, /stats)
│   ├── config/           # App Configuration & Theme Service
│   ├── database/         # Prisma Client Instance
│   ├── events/           # Discord Client Event Listeners (ready, interaction, message)
│   ├── handlers/         # Button, Modal, and Select Menu Handlers
│   ├── interfaces/       # TypeScript Interface & Type Definitions
│   ├── scripts/          # Migration & Command Deployment Scripts
│   ├── services/         # Business Logic (Workspace, Worker, License, Plugin, dll.)
│   ├── utils/            # Helper Enkripsi, Logger, Rate-limiting Guard, Time Helper
│   ├── views/            # Embed UI & Discord Component Builders (Customizable)
│   └── workers/          # Worker Thread Scripts untuk Akun Selfbot (Protected)
├── theme.config.json     # Konfigurasi Tampilan, Branding, Warna & Emoji (Open)
└── tsconfig.json         # TypeScript Compiler Configuration
```
