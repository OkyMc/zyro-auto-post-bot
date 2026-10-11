# 📜 Developer Rules & Guidelines

Aturan baku (rules & best practices) yang **wajib dipatuhi** oleh seluruh developer / AI agent saat memodifikasi codebase ini.

---

## 🔒 1. Security & Token Handling Rules

1. **JANGAN PERNAH LOG TOKEN MENTAH**:
   - Dilarang keras menggunakan `console.log` atau `Logger.info/debug/error` dengan payload string token akun pengguna.
   - Gunakan `maskToken()` dari `src/utils/security.ts` jika ingin menampilkan representasi token (misal: `MTIz...****`).
2. **PANJANG ENCRYPTION_KEY HARUS 32 KARAKTER**:
   - Variabel lingkungan `ENCRYPTION_KEY` wajib berupa string tepat 32 karakter (256-bit key) untuk keperluan AES-256 cipher.
3. **EPHEMERAL RESPONSES FOR SENSITIVE DATA**:
   - Seluruh interaksi Discord yang menyangkut input token, pembuatan invoice, atau data akun wajib menggunakan flag `{ ephemeral: true }`.

---

## 💻 2. Coding & Architecture Standards

1. **TypeScript Strict Type Safety**:
   - Hindari penggunaan type `any` jika memungkinkan. Definisikan interface di `src/interfaces/`.
2. **Database Operations**:
   - Operasi yang melibatkan transaksi krusial (seperti pembayaran, penambahan saldo/durasi) **wajib** menggunakan `prisma.$transaction()` untuk mencegah race condition.
   - Hindari query database langsung tanpa Prisma Client.
3. **Thread Safety & Process Isolation**:
   - Logic eksekusi selfbot dilarang dijalankan langsung di main thread. Wajib menggunakan `WorkerService` dan script di `src/workers/`.
   - Pastikan Worker Thread selalu menangani event `error` dan `exit` agar tidak terjadi memory leak (orphan worker process).
4. **Graceful Error Handling**:
   - Gunakan blok `try...catch` pada seluruh handler Discord interaction dan endpoint Express.
   - Pastikan error response dikirim ke user dengan pesan yang ramah dan jelas.

---

## ⚡ 3. Discord Rate Limit & Anti-Spam Guidelines

1. **Slowmode Respect**:
   - Bot scheduler harus selalu menghormati slowmode channel target. Delay minimum tidak boleh lebih kecil dari durasi slowmode channel.
2. **Anti-Spam Guard on Button / Modal**:
   - Gunakan `InteractionGuard` untuk mencegah user melakukan spam clicking pada tombol deploy, pembayaran, atau task toggle.
3. **Graceful Shutdown**:
   - Saat proses utama menerima sinyal `SIGINT` / `SIGTERM`, seluruh worker thread aktif harus dipanggil method `terminate()` secara bersih sebelum koneksi database dan Discord client diputus.

---

## 🛡️ 4. Code Distribution & Commercial Obfuscation Rules

1. **SEPARATION OF CORE VS CUSTOMIZATION**:
   - Core Security & Worker Engine (`license.service.ts`, `worker.service.ts`, `bot.worker.ts`, `security.ts`, `scheduler.service.ts`) **WAJIB** terenkripsi dan ter-obfuscate dalam pipeline `npm run build:protected`.
   - File tampilan (`views/`), konfigurasi tema (`theme.config.json`), dan folder plugin (`custom/`) **HARUS** dibiarkan terbuka agar pembeli/user bisa mengubah tampilan dan menambahkan fitur sesuka hati.
2. **CENTRAL LICENSE SERVER HOSTING**:
   - Central License Server (`license-server/`) **HANYA** di-host di VPS pribadi milik penjual/developer.
   - Jangan pernah menyertakan folder `license-server/` atau file database lisensi ke pembeli.
3. **RAHASIAKAN `ADMIN_SECRET` & `SIGNING_SECRET`**:
   - Nilai `ADMIN_SECRET` dan `SIGNING_SECRET` pada license server wajib dirahasiakan dan tidak boleh dibocorkan ke buyer.

---

## 🎨 5. Theme & Plugin System Guidelines

1. **Gunakan `ThemeService` untuk Seluruh UI Element**:
   - Dilarang hardcode warna hex atau nama branding langsung di view. Gunakan `ThemeService.getTheme()`.
2. **Non-Blocking Plugin Execution**:
   - Eksekusi custom plugin di `PluginService` harus selalu dibungkus `try...catch` agar error pada plugin kustom buatan buyer tidak merusak alur bot inti.
