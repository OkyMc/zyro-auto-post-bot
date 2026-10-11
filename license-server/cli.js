#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'licenses.json');

function readLicenses() {
    if (!fs.existsSync(DB_PATH)) {
        if (!fs.existsSync(path.dirname(DB_PATH))) {
            fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        }
        fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8') || '[]');
    } catch {
        return [];
    }
}

function writeLicenses(licenses) {
    const tempPath = DB_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(licenses, null, 2));
    fs.renameSync(tempPath, DB_PATH);
}

function generateLicenseKey(prefix = 'ZYRO') {
    const p1 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const p3 = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${p1}-${p2}-${p3}`;
}

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
    console.log('\n\x1b[36m===================================================\x1b[0m');
    console.log('\x1b[1m\x1b[32m         ZYRO POST - LICENSE MANAGER CLI          \x1b[0m');
    console.log('\x1b[36m===================================================\x1b[0m');
    console.log('Commands:');
    console.log('  \x1b[33mcreate <buyer_name> [days] [product]\x1b[0m : Generate license key baru');
    console.log('  \x1b[33mlist\x1b[0m                                 : Lihat semua lisensi');
    console.log('  \x1b[33mrevoke <license_key>\x1b[0m                 : Ban / Cabut lisensi');
    console.log('  \x1b[33mextend <license_key> <days>\x1b[0m          : Tambah masa aktif lisensi');
    console.log('  \x1b[33mreset-hwid <license_key>\x1b[0m             : Reset HWID binding (pindah VPS)');
    console.log('\nContoh:');
    console.log('  node cli.js create "Gioxaa" 30 "Zyro Enterprise"');
    console.log('  node cli.js list');
    console.log('  node cli.js revoke ZYRO-A1B2-C3D4-E5F6\n');
}

if (!command || command === 'help' || command === '--help') {
    printHelp();
    process.exit(0);
}

const licenses = readLicenses();

if (command === 'create') {
    const buyerName = args[1];
    const days = parseInt(args[2] || '30', 10);
    const product = args[3] || 'Zyro Post Standard';

    if (!buyerName) {
        console.error('\x1b[31m❌ Error: Nama buyer wajib diisi!\x1b[0m');
        process.exit(1);
    }

    const key = generateLicenseKey();
    let expiryDate = null;
    if (days > 0) {
        const exp = new Date();
        exp.setDate(exp.getDate() + days);
        expiryDate = exp.toISOString();
    }

    const newLicense = {
        key,
        buyerName,
        product,
        status: 'ACTIVE',
        days,
        lockHwid: true,
        boundHwid: null,
        boundPteroUuid: null,
        platform: null,
        boundIp: null,
        createdAt: new Date().toISOString(),
        expiryDate,
        lastVerifiedAt: null,
        verifyCount: 0
    };

    licenses.push(newLicense);
    writeLicenses(licenses);

    console.log('\n\x1b[32m✅ LICENSE KEY BERHASIL DIBUAT!\x1b[0m');
    console.log(`\x1b[33m🔑 Key       :\x1b[0m \x1b[1m${key}\x1b[0m`);
    console.log(`\x1b[33m👤 Buyer     :\x1b[0m ${buyerName}`);
    console.log(`\x1b[33m📦 Product   :\x1b[0m ${product}`);
    console.log(`\x1b[33m⏳ Durasi    :\x1b[0m ${days > 0 ? days + ' Hari (' + expiryDate.split('T')[0] + ')' : 'Lifetime'}`);
    console.log(`\x1b[33m🔒 HWID Lock :\x1b[0m Active (Auto-binds on first run)\n`);
} else if (command === 'list') {
    if (licenses.length === 0) {
        console.log('\n\x1b[33m⚠️ Belum ada license key yang terdaftar.\x1b[0m\n');
        process.exit(0);
    }

    console.log('\n\x1b[36m========================================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[32m                               DAFTAR LICENSE ZYRO POST                                 \x1b[0m');
    console.log('\x1b[36m========================================================================================\x1b[0m');
    console.table(licenses.map(l => ({
        Key: l.key,
        Buyer: l.buyerName,
        Status: l.status,
        Expiry: l.expiryDate ? l.expiryDate.split('T')[0] : 'Lifetime',
        BoundHWID: l.boundPteroUuid ? 'Ptero: ' + l.boundPteroUuid.slice(0, 8) + '...' : (l.boundHwid ? l.boundHwid.slice(0, 12) + '...' : 'None (Unbound)'),
        Verifications: l.verifyCount || 0
    })));
    console.log(`Total: ${licenses.length} lisensi.\n`);
} else if (command === 'revoke') {
    const key = args[1];
    const item = licenses.find(l => l.key.toUpperCase() === key?.toUpperCase());
    if (!item) {
        console.error(`\x1b[31m❌ License Key ${key} tidak ditemukan!\x1b[0m`);
        process.exit(1);
    }
    item.status = 'BANNED';
    writeLicenses(licenses);
    console.log(`\n\x1b[32m✅ License ${key} milik ${item.buyerName} berhasil di-BANNED!\x1b[0m\n`);
} else if (command === 'extend') {
    const key = args[1];
    const additionalDays = parseInt(args[2] || '30', 10);
    const item = licenses.find(l => l.key.toUpperCase() === key?.toUpperCase());
    if (!item) {
        console.error(`\x1b[31m❌ License Key ${key} tidak ditemukan!\x1b[0m`);
        process.exit(1);
    }
    const currentExp = item.expiryDate ? new Date(item.expiryDate) : new Date();
    const baseTime = currentExp.getTime() > Date.now() ? currentExp : new Date();
    baseTime.setDate(baseTime.getDate() + additionalDays);
    item.expiryDate = baseTime.toISOString();
    item.status = 'ACTIVE';
    writeLicenses(licenses);
    console.log(`\n\x1b[32m✅ Masa aktif lisensi ${key} berhasil ditambah ${additionalDays} hari!\x1b[0m`);
    console.log(`New Expiry: ${item.expiryDate.split('T')[0]}\n`);
} else if (command === 'reset-hwid') {
    const key = args[1];
    const item = licenses.find(l => l.key.toUpperCase() === key?.toUpperCase());
    if (!item) {
        console.error(`\x1b[31m❌ License Key ${key} tidak ditemukan!\x1b[0m`);
        process.exit(1);
    }
    item.boundHwid = null;
    item.boundPteroUuid = null;
    item.platform = null;
    item.boundIp = null;
    writeLicenses(licenses);
    console.log(`\n\x1b[32m✅ HWID Binding untuk ${key} berhasil di-reset! Buyer sekarang bisa konek dari VPS baru.\x1b[0m\n`);
} else {
    console.log(`\x1b[31mUnknown command: ${command}\x1b[0m`);
    printHelp();
}
