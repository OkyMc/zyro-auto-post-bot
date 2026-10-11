# ✨ Fitur Unggulan (Features Breakdown)

Discord SelfBot Message Scheduler hadir dengan segudang fitur canggih yang dirancang khusus buat otomasi Discord tanpa ribet, aman, dan scalable. Cekidot list fitur lengkapnya di bawah ini! 👇

---

## 1. 🛡️ Multi-Account Selfbot Management (AES-256 Encrypted)
- **Unlimited Accounts**: User bisa nambahin banyak akun Discord selfbot sekaligus dalam satu subscription.
- **Top-Tier Security**: Token akun Discord disimpan di database dalam bentuk terenkripsi menggunakan algoritma **AES-256**. Token didekripsi *hanya* saat worker thread dijalankan dan gak pernah di-log sembarangan.
- **Auto Validation**: Saat user input token melalui Discord Modal, sistem langsung validasi token, fetch username, avatar, dan guild list akun tersebut.

---

## 2. ⏱️ Smart Message Scheduler & Dynamic Delay
- **Targeting Fleksibel**: Broadcast pesan otomatis ke channel tertentu di server Discord mana pun yang akun selfbot punya akses.
- **Anti-Rate Limit (Dynamic Delay)**: Sistem membaca slowmode channel target secara otomatis dan menyesuaikan interval pengiriman agar tidak terkena rate limit Discord.
- **Custom Delay Range**: User juga bisa set manual delay (contoh: min 60 detik - max 120 detik) untuk randomisasi jeda pengiriman pesan.
- **Task Controls**: Start, Stop, Edit Pesan, Edit Delay, dan Hapus Task langsung dari Dashboard interaktif.
- **Unlimited Channel Workers / Tasks**: Tidak ada lagi limit maksimal channel worker (unlimited active tasks). User bebas menjalankan berapa pun task auto post secara serentak tanpa batasan kuota task.

---

## 3. 🧵 Isolated Worker Threads Architecture
- **No Freezing Main Process**: Operasi selfbot (`discord.js-selfbot-v13`) berjalan di background thread terpisah (Worker Threads) sehingga bot manager utama tetap responsif dan anti lag.
- **Live Logging**: Setiap aksi, pengiriman pesan, atau error dari worker langsung di-stream ke Discord thread channel privat user (`📜-live-logs`).
- **Auto Recovery & Watchdog**: Scheduler Service bertindak sebagai watchdog yang memantau task aktif dan otomatis me-restart worker jika terjadi crash tak terduga.

---

## 4. 💳 SaaS Automated Payment System (PaKasir QRIS)
- **Instant QRIS**: Generate kode QRIS dinamis secara instan melalui integrasi API PaKasir.
- **Realtime Webhook Processing**: Pembayaran terdeteksi otomatis via HTTP Webhook dari PaKasir, langsung mengaktifkan masa langganan dan membuka private workspace tanpa perlu konfirmasi manual admin.
- **Fallback Polling**: Tombol "Check Status" interaktif di invoice DM untuk verifikasi status transaksi jika webhook mengalami delay jaringan.
- **Multiple Tier Plans**: Paket langganan 7 hari (Weekly) & 30 hari (Monthly) dengan konfigurasi harga via environment variables.

---

## 5. 🏢 Automated Private Workspace Creation
- **Dedicated Private Channel**: Begitu langganan aktif, bot otomatis membuat category `Workspaces` dan text channel privat khusus untuk user (`workspace-<username>`).
- **Interactive Control Panel**: Dashboard kontrol interaktif yang selalu ter-update (Pin/Persistent message) di channel tersebut.
- **Dedicated Live Logs Thread**: Thread privat khusus log pengiriman pesan selfbot.
- **Auto Sync on Startup**: Bot otomatis mensinkronkan dan memperbarui panel kontrol semua user saat bot restart.

---

## 6. 👑 Comprehensive Admin Management Tools
- `/admin tutorial`: Mengirim embed panduan cara mengambil Discord User Token secara aman.
- `/admin stats`: Memantau metrik performa sistem (total user, task aktif, total pesan terkirim, memory usage).
- `/admin user_info`: Cek detail akun user, sisa durasi masa aktif, dan jumlah akun terhubung.
- `/admin add_time` & `/admin remove_time`: Menambah atau mengurangi masa aktif langganan user secara manual.
- `/admin delete_workspace`: Menghapus workspace dan memberhentikan seluruh worker user tertentu secara paksa.
- `/deploy-store`: Memasang panel store premium di channel publik agar member server bisa langsung membeli akses.

---

## 7. 🔑 Central License API Key & Cryptographic Protection (Self-Hosted Model)
- **Central API Verification**: Bot wajib lolos otentikasi lisensi ke Central License Server sebelum menginisialisasi Discord client dan database.
- **HMAC-SHA256 Cryptographic Signature**: Server lisensi menandatangani payload respons otentikasi secara kriptografis. Core bot memvalidasi signature sebelum mengizinkan worker berjalan. Bypass mock object lokal dipastikan gagal total (`TAMPER_DETECTED`).
- **Hardware ID (HWID) Auto-Lock & Pterodactyl-Native Binding**:
  - **Pterodactyl Container Support**: Lisensi secara otomatis mengenali environment Pterodactyl melalui `P_SERVER_UUID` permanen dari Wings daemon. HWID dihitung secara deterministik sehingga **TIDAK AKAN BERUBAH** saat restart server di panel, reboot VPS, ataupun install ulang file bot di container.
  - **Linux VPS / Bare-Metal**: Menggunakan machine-id / MAC address deterministik mesin tanpa random string acak.
  - **Dual-Layer Anti-Sharing**: Mengunci lisensi berdasarkan `boundPteroUuid` & `boundHwid`. Buyer tetap tidak bisa menduplikasi atau membagikan lisensi ke server Pterodactyl lain maupun VPS lain.
- **Periodic Heartbeat Watchdog**: Pengecekan status lisensi secara berkala di background (tiap 30-60 menit). Jika lisensi dicabut/expired saat bot running, bot otomatis graceful shutdown.
- **Selective Core Obfuscation Pipeline**: Script `npm run build:protected` yang mengkompilasi dan mengunci file core penting (Core License, Worker Engine, Security Crypto) dengan Control Flow Flattening & String Array RC4, sementara membiarkan layer kustomisasi terbuka.
- **Stand-alone Admin CLI Manager**: Tool command-line untuk seller (`license-server/cli.js`) untuk generate key baru, list pembeli, ban user nakal, extend durasi, dan reset HWID secara instan.

---

## 8. 🎨 Open Customization Layer & Modular Plugin Engine (Baru! 🔥)
- **Config-Driven Theme (`theme.config.json`)**:
  - Buyer/user bebas mengubah identitas visual bot: nama brand, link website, avatar URL, banner GIF.
  - Pilihan palet warna Embed kustom via kode hex (`primary`, `success`, `warning`, `danger`, `info`).
  - Kustomisasi emoji status (`active`, `inactive`, `pending`, `crown`, dsb.).
  - Kustomisasi judul tampilan UI (`dashboardTitle`, `controlPanelTitle`, `storeTitle`, `tutorialTitle`, `statsTitle`).
  - **Hot-Reload Ready**: Perubahan pada file `theme.config.json` langsung terbaca otomatis tanpa harus restart bot.
- **Modular Plugin & Lifecycle Hooks (`custom/plugins/`)**:
  - User dapat membuat script `.plugin.js` sendiri di folder `custom/plugins/`.
  - Hook event yang didukung:
    - `onBotReady(client)`: Terpanggil saat bot Discord sukses online.
    - `onPostSuccess(event)`: Terpanggil saat auto post pesan berhasil dikirim (bisa untuk integrasi webhook notif Discord/Telegram pribadi).
    - `onPostFailed(event)`: Terpanggil saat pesan gagal atau terkena rate limit.
    - `onMessageCreate(message)`: Mencegat dan memproses pesan masuk Discord kustom.
    - `onInteractionCreate(interaction)`: Menangani interaksi kustom.
- **Open Views & Layout Template**: Seluruh file view di `src/views/` (atau `dist/views/`) dibiarkan terbaca sehingga user yang paham coding Discord.js dapat mengubah struktur tombol, field embed, dan alur interaction handler secara bebas.
