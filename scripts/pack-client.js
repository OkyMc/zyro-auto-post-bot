const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_ZIP = path.join(ROOT_DIR, 'zyro-post-client.zip');

console.log('\n\x1b[36m==============================================================\x1b[0m');
console.log('\x1b[1m\x1b[32m         📦 ZYRO POST - CLIENT EXPORT & PACKAGER              \x1b[0m');
console.log('\x1b[36m==============================================================\x1b[0m');

// 1. Hapus zip lama jika ada
if (fs.existsSync(OUTPUT_ZIP)) {
    fs.unlinkSync(OUTPUT_ZIP);
    console.log('[Packager] 🗑️ File ZIP lama dihapus.');
}

// 2. Pastikan folder dist ada
if (!fs.existsSync(path.join(ROOT_DIR, 'dist'))) {
    console.error('\x1b[31m❌ Folder dist/ tidak ditemukan! Jalankan npm run build:protected terlebih dahulu.\x1b[0m');
    process.exit(1);
}

// Pastikan theme.config.json & custom/ ada
if (!fs.existsSync(path.join(ROOT_DIR, 'theme.config.json'))) {
    console.error('\x1b[31m❌ theme.config.json tidak ditemukan!\x1b[0m');
    process.exit(1);
}

// 3. Buat README khusus buyer
const buyerReadmeContent = `# 🤖 Zyro Post - Setup, Customization & Installation Guide

Selamat datang di **Zyro Post**! Ikuti langkah singkat di bawah ini untuk menjalankan dan mengkustomisasi bot di VPS kamu:

---

## 🎨 Kustomisasi Tampilan & Fitur (Bebas Diubah Suka-suka!)

Kamu memiliki kebebasan penuh untuk mengubah tampilan, branding, dan menambahkan plugin kustom:

### 1. Ubah Tampilan & Warna (\`theme.config.json\`)
Buka file \`theme.config.json\` di root bot. Kamu bisa bebas mengubah:
- **Branding**: Ganti nama bot, link website, avatar/logo URL, banner GIF.
- **Warna Embed**: Ganti warna hex (\`primary\`, \`success\`, \`warning\`, \`danger\`, \`info\`).
- **Emojis**: Ganti emoji status running, stopped, gear, crown, dsb.
- **Judul UI**: Ubah judul panel kontrol, store, tutorial, dan stats.
*(Bot otomatis me-reload tampilan saat file ini disimpan!)*

### 2. Kustomisasi Logika & Plugin (\`custom/plugins/\`)
Di folder \`custom/plugins/\`, kamu bisa menambahkan skrip plugin JavaScript sendiri:
- Hook pengiriman pesan sukses (\`onPostSuccess\`) untuk forward notifikasi ke Telegram atau Webhook Discord pribadi.
- Hook error (\`onPostFailed\`).
- Hook saat bot menyala (\`onBotReady\`).

---

## 🚀 Langkah Instalasi:

### 1. Install Dependencies
Buka terminal di folder bot ini, lalu jalankan:
\`\`\`bash
npm install --omit=dev
\`\`\`

### 2. Konfigurasi Environment (\`.env\`)
Salin file \`.env.example\` menjadi \`.env\`:
\`\`\`bash
cp .env.example .env
\`\`\`

Buka file \`.env\` dan isi parameter wajib:
- **LICENSE_KEY** : Masukkan License Key yang diberikan seller.
- **LICENSE_SERVER_URL** : URL License Server seller.
- **DATABASE_URL** : URL koneksi database MySQL kamu (contoh: \`mysql://user:password@localhost:3306/discord_saas\`).
- **BOT_TOKEN** : Token Bot Discord kamu dari Discord Developer Portal.
- **CLIENT_ID** : Client / Application ID Bot Discord kamu.
- **GUILD_ID** : Server Discord utama kamu.
- **ENCRYPTION_KEY** : Kunci acak 32 karakter pas untuk enkripsi token selfbot.

### 3. Setup Database MySQL
Buat database MySQL baru, lalu jalankan sinkronisasi tabel:
\`\`\`bash
npx prisma db push
\`\`\`

### 4. Deploy Slash Commands & Jalankan Bot
Deploy command ke Discord:
\`\`\`bash
npm run deploy
\`\`\`

Jalankan Bot:
\`\`\`bash
npm run pm2:start
\`\`\`
*(Bot akan berjalan di background 24/7 dengan auto-restart jika crash atau reboot)*.

Perintah Manajemen PM2:
- Cek status: \`npm run pm2:status\`
- Cek log realtime: \`npm run pm2:logs\`
- Restart bot: \`npm run pm2:restart\`
- Stop bot: \`npm run pm2:stop\`

---
© 2026 Zyro Post. All rights reserved.
`;

fs.writeFileSync(path.join(ROOT_DIR, 'BUYER_README.md'), buyerReadmeContent, 'utf-8');

// 4. Jalankan zip command
try {
    console.log('[Packager] 🗜️ Mengompresi file ke zyro-post-client.zip...');
    
    const zipCommand = `zip -r zyro-post-client.zip dist prisma docs custom theme.config.json package.json package-lock.json ecosystem.config.js .env.example BUYER_README.md LICENSE -x "dist/**/*.map"`;
    execSync(zipCommand, { cwd: ROOT_DIR, stdio: 'inherit' });
    
    // Hapus temporary BUYER_README.md
    if (fs.existsSync(path.join(ROOT_DIR, 'BUYER_README.md'))) {
        fs.unlinkSync(path.join(ROOT_DIR, 'BUYER_README.md'));
    }

    const stats = fs.statSync(OUTPUT_ZIP);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log('\n\x1b[32m🎉 BUNDLE SIAP JUAL BERHASIL DIBUAT!\x1b[0m');
    console.log(`\x1b[33m📦 File Path :\x1b[0m \x1b[1m${OUTPUT_ZIP}\x1b[0m`);
    console.log(`\x1b[33m📊 Ukuran    :\x1b[0m ${sizeMB} MB`);
    console.log('\n\x1b[36m💡 File ini 100% aman dikirimkan ke pembeli/buyer (User bisa edit theme & plugin tapi core terproteksi!).\x1b[0m\n');
} catch (err) {
    console.error('\x1b[31m❌ Gagal membuat zip:\x1b[0m', err.message);
    process.exit(1);
}
