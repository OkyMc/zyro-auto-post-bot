# 🔑 Central License Server & Manager (Zyro Post)

Central API Server untuk mengelola dan memvalidasi **License API Key** pembeli bot **Zyro Post** secara tersentralisasi, aman, dan anti-tamper.

---

## ⚡ Fitur Utama Server Lisensi

1. **HWID Auto-Binding**: Saat pembeli pertama kali menjalankan bot di VPS mereka, sistem otomatis mengunci lisensi ke spesifikasi hardware & IP VPS tersebut. Jika lisensi dibagikan ke orang lain di VPS berbeda, bot akan otomatis menolak akses (`HWID_MISMATCH`).
2. **Auto Expiry & Countdown**: Bot otomatis menghitung sisa hari masa aktif dan menolak akses jika masa langganan habis.
3. **Instant Ban / Revoke**: Admin dapat memblokir buyer nakal seketika melalui CLI atau API.
4. **Heartbeat Verification Support**: Mendukung verifikasi berkala setiap 30–60 menit dari bot client.
5. **No Heavy Database**: Menggunakan file database JSON ringan yang otomatis dibuat (`data/licenses.json`), tanpa perlu install MongoDB atau MySQL di VPS lisensi.

---

## 🚀 Cara Menjalankan di VPS Admin

### 1. Masuk ke Folder License Server
```bash
cd license-server
npm install
```

### 2. Konfigurasi `.env`
```bash
cp .env.example .env
```
Edit `.env` dan ganti `ADMIN_SECRET` dengan password acak kamu.

### 3. Jalankan Server
- Menggunakan PM2 (Disarankan untuk production):
  ```bash
  pm2 start server.js --name "zyro-license-server"
  ```
- Atau langsung dengan node:
  ```bash
  npm start
  ```

---

## 🛠️ Panduan CLI Admin (Generate & Manage License)

Kamu bisa langsung membuat dan mengelola lisensi pembeli langsung lewat terminal:

```bash
# 1. Buat lisensi baru untuk pembeli (contoh: 30 hari)
node cli.js create "NamaBuyer" 30 "Zyro Post Enterprise"

# 2. Buat lisensi Lifetime
node cli.js create "NamaBuyerVIP" 0 "Zyro Post Lifetime"

# 3. Lihat seluruh daftar lisensi aktif & expired
node cli.js list

# 4. Tambah masa aktif lisensi (contoh: tambah 15 hari)
node cli.js extend ZYRO-XXXX-XXXX-XXXX 15

# 5. Reset binding HWID (jika buyer minta izin pindah ke VPS baru)
node cli.js reset-hwid ZYRO-XXXX-XXXX-XXXX

# 6. Blokir / Banned lisensi
node cli.js revoke ZYRO-XXXX-XXXX-XXXX
```
