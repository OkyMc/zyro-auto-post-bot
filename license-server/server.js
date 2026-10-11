const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.LICENSE_PORT || process.env.LICENSE_SERVER_PORT || 4000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'zyro-super-secret-admin-key-2026';
const DB_PATH = path.join(__dirname, 'data', 'licenses.json');

// Ensure data folder exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// Helper: Read DB
function readLicenses() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
        return [];
    }
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(raw || '[]');
    } catch {
        return [];
    }
}

// Helper: Write DB safely (Atomic Write)
function writeLicenses(licenses) {
    const tempPath = DB_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(licenses, null, 2));
    fs.renameSync(tempPath, DB_PATH);
}

// Helper: Generate Key (Format: ZYRO-XXXX-XXXX-XXXX)
function generateLicenseKey(prefix = 'ZYRO') {
    const p1 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const p2 = crypto.randomBytes(3).toString('hex').toUpperCase();
    const p3 = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${p1}-${p2}-${p3}`;
}

// Middleware: Admin Auth
function adminAuth(req, res, next) {
    const authHeader = req.headers['x-admin-secret'] || req.headers['authorization'];
    if (!authHeader || authHeader !== ADMIN_SECRET) {
        return res.status(401).json({ success: false, message: 'Unauthorized! Invalid Admin Secret.' });
    }
    next();
}

// ==================== PUBLIC CLIENT ENDPOINT ====================

/**
 * Endpoint verifikasi lisensi (Dipanggil oleh bot client saat booting & heartbeat)
 */
app.get(['/api/v1/license/verify', '/api/license/verify', '/license/verify', '/license/status', '/api/v1/license/status'], (req, res) => {
    return res.json({ success: true, ok: true, status: 'RUNNING', service: 'Zyro Tech Central License Server' });
});

app.post(['/api/v1/license/verify', '/api/license/verify', '/license/verify'], (req, res) => {
    const rawKey = req.body.licenseKey || req.body.apiKey || '';
    const licenseKey = String(rawKey).trim();
    const hwid = req.body.hwid || req.body.fingerprint;
    const pteroUuid = req.body.pteroUuid || (req.body.instanceId && req.body.instanceId.startsWith('ptero_') ? req.body.instanceId.replace('ptero_', '') : req.body.instanceId);
    const platform = req.body.platform || (pteroUuid ? 'pterodactyl' : 'vps');
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!licenseKey) {
        return res.status(400).json({
            success: false,
            status: 'INVALID',
            message: 'License Key wajib disertakan!',
            ok: false,
            error: 'License Key wajib disertakan!'
        });
    }

    const licenses = readLicenses();
    const license = licenses.find(l => l.key.trim().toUpperCase() === licenseKey.trim().toUpperCase());

    if (!license) {
        return res.status(404).json({
            success: false,
            status: 'INVALID',
            message: 'License Key tidak ditemukan di database server!',
            ok: false,
            error: 'License Key tidak ditemukan di database server!'
        });
    }

    if (license.status === 'BANNED') {
        return res.status(403).json({
            success: false,
            status: 'BANNED',
            message: 'Lisensi ini telah di-banned/diblokir oleh admin!',
            ok: false,
            error: 'Lisensi ini telah di-banned/diblokir oleh admin!'
        });
    }

    // Check Expiration
    if (license.expiryDate) {
        const expiryTime = new Date(license.expiryDate).getTime();
        const now = Date.now();
        if (now > expiryTime) {
            license.status = 'EXPIRED';
            writeLicenses(licenses);
            return res.status(403).json({
                success: false,
                status: 'EXPIRED',
                message: `Masa aktif lisensi telah kedaluwarsa pada ${new Date(license.expiryDate).toLocaleString('id-ID')}!`
            });
        }
    }

    // HWID & Pterodactyl Binding Check (Anti Multi-Device Sharing)
    if (license.lockHwid && (hwid || pteroUuid)) {
        if (!license.boundHwid && !license.boundPteroUuid) {
            // First time activation -> Lock ke HWID & Pterodactyl UUID
            license.boundHwid = hwid || null;
            if (pteroUuid) {
                license.boundPteroUuid = pteroUuid;
            }
            license.platform = platform || (pteroUuid ? 'pterodactyl' : 'vps');
            license.boundIp = clientIp;
        } else {
            // Verifikasi kecocokan:
            // 1. Jika terdaftar Pterodactyl UUID, UUID server Pterodactyl harus sama persis
            // 2. Jika VPS biasa, boundHwid harus sama persis
            const pteroMatches = Boolean(license.boundPteroUuid && pteroUuid && (license.boundPteroUuid === pteroUuid));
            const hwidMatches = Boolean(license.boundHwid && hwid && (license.boundHwid === hwid));

            if (!pteroMatches && !hwidMatches) {
                return res.status(403).json({
                    success: false,
                    status: 'HWID_MISMATCH',
                    message: 'Lisensi ini sudah terkunci pada hardware/server Pterodactyl lain! Hubungi admin untuk reset HWID.',
                    ok: false,
                    error: 'Lisensi ini sudah terkunci pada hardware/server Pterodactyl lain! Hubungi admin untuk reset HWID.'
                });
            }

            // Sync update: Jika running di Pterodactyl yang valid tapi boundHwid belum terupdate
            if (pteroMatches) {
                if (hwid && license.boundHwid !== hwid) {
                    license.boundHwid = hwid;
                }
                license.platform = 'pterodactyl';
            }
            if (!license.boundPteroUuid && pteroUuid) {
                license.boundPteroUuid = pteroUuid;
                license.platform = 'pterodactyl';
            }
        }
    }

    // Update Activity Stats
    license.lastVerifiedAt = new Date().toISOString();
    license.lastIp = clientIp;
    license.verifyCount = (license.verifyCount || 0) + 1;
    writeLicenses(licenses);

    // Calculate days remaining
    let daysRemaining = 999;
    if (license.expiryDate) {
        const diffMs = new Date(license.expiryDate).getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Cryptographic Anti-Tamper Signature
    const SIGNING_SECRET = process.env.SIGNING_SECRET || 'zyro-license-master-cryptographic-salt-2026-v2';
    const issuedAt = Date.now();
    const expiryStr = license.expiryDate ? new Date(license.expiryDate).toISOString().split('T')[0] : 'Lifetime';
    const canonicalPayload = `${license.key}|${hwid || ''}|${pteroUuid || ''}|ACTIVE|${expiryStr}|${issuedAt}`;
    const signature = crypto.createHmac('sha256', SIGNING_SECRET).update(canonicalPayload).digest('hex');

    return res.json({
        success: true,
        ok: true,
        status: 'ACTIVE',
        buyerName: license.buyerName || 'Valued Customer',
        product: license.product || 'Zyro Post Standard',
        expiryDate: expiryStr,
        daysRemaining,
        issuedAt,
        signature,
        message: 'License verification successful.',
        license: {
            key: license.key,
            status: 'ACTIVE',
            buyerName: license.buyerName || 'Valued Customer',
            product: license.product || 'Zyro Post Standard',
            expiresAt: license.expiryDate || '2099-12-31T23:59:59.000Z',
            daysRemaining
        }
    });
});

// ==================== ADMIN MANAGEMENT ENDPOINTS ====================

/**
 * Buat License Key Baru
 */
app.post('/api/v1/admin/create', adminAuth, (req, res) => {
    const { buyerName, days = 30, product = 'Zyro Post Enterprise', lockHwid = true, customKey } = req.body;

    if (!buyerName) {
        return res.status(400).json({ success: false, message: 'Nama buyer wajib diisi!' });
    }

    const licenses = readLicenses();
    const key = customKey || generateLicenseKey();

    // Check duplicate
    if (licenses.some(l => l.key === key)) {
        return res.status(400).json({ success: false, message: 'License key sudah digunakan!' });
    }

    let expiryDate = null;
    if (days && days > 0) {
        const exp = new Date();
        exp.setDate(exp.getDate() + parseInt(days, 10));
        expiryDate = exp.toISOString();
    }

    const newLicense = {
        key,
        buyerName,
        product,
        status: 'ACTIVE',
        days: days ? parseInt(days, 10) : 0,
        lockHwid: !!lockHwid,
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

    return res.status(201).json({
        success: true,
        message: 'License key berhasil dibuat!',
        license: newLicense
    });
});

/**
 * List Semua License
 */
app.get('/api/v1/admin/list', adminAuth, (req, res) => {
    const licenses = readLicenses();
    return res.json({ success: true, count: licenses.length, licenses });
});

/**
 * Revoke / Ban License
 */
app.post('/api/v1/admin/revoke', adminAuth, (req, res) => {
    const { licenseKey } = req.body;
    const licenses = readLicenses();
    const license = licenses.find(l => l.key === licenseKey);

    if (!license) {
        return res.status(404).json({ success: false, message: 'License key tidak ditemukan!' });
    }

    license.status = 'BANNED';
    writeLicenses(licenses);

    return res.json({ success: true, message: `License ${licenseKey} berhasil di-banned!` });
});

/**
 * Reset HWID Binding (Biar buyer bisa pindah VPS)
 */
app.post('/api/v1/admin/reset-hwid', adminAuth, (req, res) => {
    const { licenseKey } = req.body;
    const licenses = readLicenses();
    const license = licenses.find(l => l.key === licenseKey);

    if (!license) {
        return res.status(404).json({ success: false, message: 'License key tidak ditemukan!' });
    }

    license.boundHwid = null;
    license.boundPteroUuid = null;
    license.platform = null;
    license.boundIp = null;
    writeLicenses(licenses);

    return res.json({ success: true, message: `Binding HWID untuk ${licenseKey} berhasil di-reset!` });
});

/**
 * Extend Masa Aktif
 */
app.post('/api/v1/admin/extend', adminAuth, (req, res) => {
    const { licenseKey, additionalDays = 30 } = req.body;
    const licenses = readLicenses();
    const license = licenses.find(l => l.key === licenseKey);

    if (!license) {
        return res.status(404).json({ success: false, message: 'License key tidak ditemukan!' });
    }

    const currentExp = license.expiryDate ? new Date(license.expiryDate) : new Date();
    const baseTime = currentExp.getTime() > Date.now() ? currentExp : new Date();
    baseTime.setDate(baseTime.getDate() + parseInt(additionalDays, 10));

    license.expiryDate = baseTime.toISOString();
    license.status = 'ACTIVE';
    writeLicenses(licenses);

    return res.json({
        success: true,
        message: `Masa aktif berhasil ditambah ${additionalDays} hari!`,
        expiryDate: license.expiryDate
    });
});

app.listen(PORT, () => {
    console.log(`\n\x1b[32m[License Server] 🚀 Running on port ${PORT}\x1b[0m`);
    console.log(`[License Server] 🔑 Admin Secret: \x1b[33m${ADMIN_SECRET}\x1b[0m\n`);
});
