import axios from 'axios';
import crypto from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { Logger } from '../utils/logger';

export interface LicenseInfo {
    valid: boolean;
    status: 'ACTIVE' | 'EXPIRED' | 'BANNED' | 'INVALID' | 'IP_MISMATCH' | 'ERROR';
    buyerName?: string;
    product?: string;
    expiryDate?: string;
    daysRemaining?: number;
    message?: string;
}

export class LicenseService {
    private static heartbeatTimer: NodeJS.Timeout | null = null;
    private static cachedHWID: string | null = null;
    private static onRevokeCallback: (() => Promise<void>) | null = null;
    private static isAuthorized: boolean = false;
    private static sessionToken: string | null = null;

    /**
     * Cek apakah sesi runtime bot telah diotorisasi secara kriptografis oleh License Server
     */
    public static isSessionAuthorized(): boolean {
        if (!config.license.enabled) return true;
        return this.isAuthorized;
    }

    /**
     * Dapatkan cryptographic runtime session token untuk verifikasi Worker Thread
     */
    public static getSessionToken(): string {
        if (!config.license.enabled) return 'DEV_BYPASS_TOKEN';
        return this.sessionToken || '';
    }

    /**
     * Set callback yang akan dipanggil saat heartbeat mendeteksi lisensi dicabut
     */
    public static setOnRevokeCallback(callback: () => Promise<void>): void {
        this.onRevokeCallback = callback;
    }

    /**
     * Menghasilkan unique HWID (Hardware Identifier) yang persisten & stabil di VPS maupun Container Pterodactyl/Docker
     */
    public static getHWID(): string {
        if (this.cachedHWID) return this.cachedHWID;

        const hwidFile = path.join(process.cwd(), '.zyro-hwid');

        // 1. Jika running di Pterodactyl Panel (terdeteksi P_SERVER_UUID),
        // gunakan Server UUID unik Pterodactyl sebagai Hardware Anchor permanen.
        // Server UUID ini permanen di wings daemon & panel, sehingga TIDAK AKAN PERNAH BERUBAH saat restart server/reboot VPS!
        const pteroUuid = process.env.P_SERVER_UUID?.trim();
        if (pteroUuid) {
            const pteroHWID = crypto.createHash('sha256').update(`PTERODACTYL:${pteroUuid}`).digest('hex');
            try {
                fs.writeFileSync(hwidFile, pteroHWID, 'utf-8');
            } catch {}
            this.cachedHWID = pteroHWID;
            return this.cachedHWID;
        }

        // 2. Jika sudah ada file HWID tersimpan di disk, baca & gunakan (Stabil across restart di Linux VPS)
        if (fs.existsSync(hwidFile)) {
            try {
                const savedHWID = fs.readFileSync(hwidFile, 'utf-8').trim();
                if (savedHWID && savedHWID.length >= 32) {
                    this.cachedHWID = savedHWID;
                    return this.cachedHWID;
                }
            } catch {}
        }

        // 3. VPS Biasa / Bare Metal: Buat HWID deterministik berdasarkan identitas mesin
        try {
            let machineId = '';
            if (fs.existsSync('/etc/machine-id')) {
                machineId = fs.readFileSync('/etc/machine-id', 'utf-8').trim();
            } else if (fs.existsSync('/var/lib/dbus/machine-id')) {
                machineId = fs.readFileSync('/var/lib/dbus/machine-id', 'utf-8').trim();
            }

            // Dapatkan MAC address non-internal pertama sebagai hardware anchor fallback
            let macAddress = '';
            try {
                const networkInterfaces = os.networkInterfaces();
                for (const iface of Object.values(networkInterfaces)) {
                    if (!iface) continue;
                    for (const net of iface) {
                        if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
                            macAddress = net.mac;
                            break;
                        }
                    }
                    if (macAddress) break;
                }
            } catch {}

            const rawFingerprint = [
                machineId || macAddress || 'zyro-vps-node',
                os.platform(),
                os.arch(),
                os.cpus()[0]?.model || 'cpu',
                os.homedir()
            ].join('|');

            const generatedHWID = crypto.createHash('sha256').update(rawFingerprint).digest('hex');

            // Simpan ke disk agar pada restart berikutnya selalu membaca HWID yang SAMA
            try {
                fs.writeFileSync(hwidFile, generatedHWID, 'utf-8');
            } catch {}

            this.cachedHWID = generatedHWID;
            return this.cachedHWID;
        } catch {
            const fallbackHWID = crypto.createHash('sha256').update(os.platform() + '-' + os.arch() + '-' + os.homedir()).digest('hex');
            try {
                fs.writeFileSync(hwidFile, fallbackHWID, 'utf-8');
            } catch {}
            this.cachedHWID = fallbackHWID;
            return this.cachedHWID;
        }
    }

    /**
     * Verifikasi lisensi ke Central License Server
     */
    public static async verifyLicense(isHeartbeat = false): Promise<LicenseInfo> {
        if (!config.license.enabled) {
            return {
                valid: true,
                status: 'ACTIVE',
                buyerName: 'Development Bypass',
                product: 'Developer Edition',
                daysRemaining: 999
            };
        }

        const licenseKey = config.license.key?.trim();
        const serverUrl = config.license.serverUrl?.replace(/\/+$/, '');

        if (!licenseKey) {
            return {
                valid: false,
                status: 'INVALID',
                message: 'LICENSE_KEY belum diisi di file .env!'
            };
        }

        try {
            const hwid = this.getHWID();
            const pteroUuid = process.env.P_SERVER_UUID?.trim() || undefined;
            const platform = pteroUuid ? 'pterodactyl' : 'vps';

            const response = await axios.post(
                `${serverUrl}/api/v1/license/verify`,
                {
                    licenseKey,
                    hwid,
                    pteroUuid,
                    platform,
                    timestamp: Date.now()
                },
                {
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'ZyroPost-Client-Core/1.0.0',
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = response.data;

            if (data && data.success && data.status === 'ACTIVE') {
                // Cryptographic Anti-Tamper Signature Verification
                const SIGNING_SECRET = 'zyro-license-master-cryptographic-salt-2026-v2';
                const expiryStr = data.expiryDate || 'Lifetime';
                const canonicalPayload = `${licenseKey}|${hwid || ''}|${pteroUuid || ''}|ACTIVE|${expiryStr}|${data.issuedAt}`;
                const expectedSignature = crypto.createHmac('sha256', SIGNING_SECRET).update(canonicalPayload).digest('hex');

                if (data.signature && data.signature === expectedSignature) {
                    this.isAuthorized = true;
                    this.sessionToken = data.signature;
                    return {
                        valid: true,
                        status: 'ACTIVE',
                        buyerName: data.buyerName || 'Valued Customer',
                        product: data.product || 'Zyro Post Standard',
                        expiryDate: data.expiryDate,
                        daysRemaining: data.daysRemaining !== undefined ? data.daysRemaining : 999,
                        message: data.message
                    };
                } else {
                    this.isAuthorized = false;
                    this.sessionToken = null;
                    return {
                        valid: false,
                        status: 'TAMPER_DETECTED' as any,
                        message: 'Cryptographic signature mismatch! Respon verifikasi lisensi tidak sah atau dimanipulasi.'
                    };
                }
            }

            this.isAuthorized = false;
            this.sessionToken = null;
            return {
                valid: false,
                status: data?.status || 'INVALID',
                message: data?.message || 'Lisensi tidak valid atau telah kedaluwarsa.'
            };
        } catch (error: any) {
            if (error.response && error.response.data) {
                const errData = error.response.data;
                return {
                    valid: false,
                    status: errData.status || 'INVALID',
                    message: errData.message || 'Lisensi ditolak oleh server.'
                };
            }

            // Jika server lisensi offline
            if (!isHeartbeat) {
                return {
                    valid: false,
                    status: 'ERROR',
                    message: `Gagal menghubungi License Server (${serverUrl}). Pastikan koneksi internet & URL server benar.`
                };
            } else {
                // Saat heartbeat, beri toleransi temporary network hiccup
                Logger.warn('Heartbeat: License server temporary unreachable. Will retry on next tick.', 'License');
                return { valid: true, status: 'ACTIVE' };
            }
        }
    }

    /**
     * Tampilkan Banner Lisensi Valid
     */
    public static printValidBanner(info: LicenseInfo): void {
        const pteroUuid = process.env.P_SERVER_UUID?.trim();
        console.log('\n\x1b[36m=================================================================\x1b[0m');
        console.log('\x1b[1m\x1b[32m       🚀 ZYRO POST - LICENSE AUTHENTICATED SUCCESSFULLY!       \x1b[0m');
        console.log('\x1b[36m=================================================================\x1b[0m');
        console.log(` \x1b[33m🔑 License Key   :\x1b[0m ${config.license.key.slice(0, 8)}...${config.license.key.slice(-4)}`);
        console.log(` \x1b[33m👤 Licensed To   :\x1b[0m \x1b[1m${info.buyerName}\x1b[0m`);
        console.log(` \x1b[33m📦 Product Tier  :\x1b[0m ${info.product}`);
        console.log(` \x1b[33m⏳ Expiry Date   :\x1b[0m ${info.expiryDate || 'Lifetime'}`);
        console.log(` \x1b[33m📅 Days Left     :\x1b[0m \x1b[32m${info.daysRemaining} Hari\x1b[0m`);
        if (pteroUuid) {
            console.log(` \x1b[33m�� Environment   :\x1b[0m \x1b[32mPterodactyl Container (${pteroUuid.slice(0, 8)}...)\x1b[0m`);
        } else {
            console.log(` \x1b[33m🖥️ Environment   :\x1b[0m \x1b[36mLinux VPS / Standalone Host\x1b[0m`);
        }
        console.log(` \x1b[33m💻 HWID Binding  :\x1b[0m \x1b[90m${this.getHWID().slice(0, 16)}...\x1b[0m`);
        console.log('\x1b[36m=================================================================\x1b[0m\n');
    }

    /**
     * Tampilkan Banner Lisensi Ditolak & Matikan Program
     */
    public static printDeniedBanner(info: LicenseInfo): void {
        const pteroUuid = process.env.P_SERVER_UUID?.trim();
        console.log('\n\x1b[41m\x1b[37m\x1b[1m                                                                 \x1b[0m');
        console.log('\x1b[41m\x1b[37m\x1b[1m               ❌ ACCESS DENIED - INVALID LICENSE                \x1b[0m');
        console.log('\x1b[41m\x1b[37m\x1b[1m                                                                 \x1b[0m');
        console.log(`\n\x1b[31m[Alasan Penolakan]\x1b[0m: \x1b[1m${info.message || info.status}\x1b[0m`);
        if (pteroUuid) {
            console.log(`\x1b[33m[Pterodactyl UUID]\x1b[0m: ${pteroUuid}`);
        }
        console.log(`\x1b[33m[Hardware ID]\x1b[0m    : ${this.getHWID()}`);
        console.log('\x1b[36m\n💡 Silakan hubungi seller untuk membeli atau memperpanjang License API Key kamu.\x1b[0m\n');
    }

    /**
     * Verifikasi saat bot booting
     */
    public static async verifyOnStartup(): Promise<void> {
        if (!config.license.enabled) {
            Logger.warn('License verification is DISABLED via config (ENABLE_LICENSE_CHECK=false).', 'License');
            return;
        }

        Logger.info('Memverifikasi API Key Lisensi ke Central License Server...', 'License');
        const info = await this.verifyLicense(false);

        if (!info.valid) {
            this.printDeniedBanner(info);
            process.exit(1);
        }

        this.printValidBanner(info);
        this.startHeartbeat();
    }

    /**
     * Memulai loop background heartbeat
     */
    public static startHeartbeat(): void {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

        const intervalMs = Math.max(config.license.checkIntervalMinutes, 5) * 60 * 1000;

        this.heartbeatTimer = setInterval(async () => {
            try {
                const info = await this.verifyLicense(true);
                if (!info.valid) {
                    Logger.error(`[License] ❌ Heartbeat failed: ${info.message}. Shutting down bot immediately!`, null, 'License');
                    this.printDeniedBanner(info);

                    if (this.onRevokeCallback) {
                        await this.onRevokeCallback();
                    }
                    process.exit(1);
                } else {
                    Logger.debug('License Heartbeat OK. Subscription active.', 'License');
                }
            } catch (err: any) {
                Logger.error('Heartbeat check error', err, 'License');
            }
        }, intervalMs);

        // Jangan tahan node process dari exit karena timer ini
        this.heartbeatTimer.unref();
    }

    /**
     * Stop background heartbeat loop
     */
    public static stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}
