import crypto from 'crypto';
import { config } from '../config';
import { Logger } from './logger';

// Validasi encryption key saat module load - WAJIB ada di environment
if (!config.encryptionKey) {
    throw new Error(
        '[SECURITY FATAL] ENCRYPTION_KEY is not configured in environment variables. ' +
        'This is required for token encryption. Application cannot start without it.'
    );
}

if (config.encryptionKey.length !== 32) {
    throw new Error(
        `[SECURITY FATAL] ENCRYPTION_KEY must be exactly 32 characters long. ` +
        `Current length: ${config.encryptionKey.length}. Application cannot start.`
    );
}

const ENCRYPTION_KEY = config.encryptionKey;
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16; // GCM auth tag length
const ALGORITHM = 'aes-256-gcm';

/**
 * Membersihkan token dari karakter asing, quotes, newlines, tabs, dll.
 * 
 * @param token - String token yang akan dibersihkan
 * @returns Token yang sudah bersih
 */
export function sanitizeToken(token: string): string {
    if (!token || typeof token !== 'string') return '';
    return token
        .replace(/^["'`]|["'`]$/g, '') // Hapus quotes di awal & akhir
        .replace(/[\r\n\t\s]/g, '')    // Hapus whitespace, carriage return, newline, tab
        .trim();
}

/**
 * Encrypt text menggunakan AES-256-GCM (Authenticated Encryption)
 * Format output: iv:authTag:encryptedData (semua dalam hex)
 * 
 * @param text - Plaintext yang akan dienkripsi
 * @returns Encrypted string dalam format iv:authTag:ciphertext
 */
export function encrypt(text: string): string {
    if (!text || typeof text !== 'string') {
        throw new Error('Encrypt: Input must be a non-empty string');
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt text yang dienkripsi dengan AES-256-GCM
 * Mendukung format baru (GCM) dan legacy format (CBC) untuk backward compatibility
 * 
 * @param text - Encrypted string dalam format iv:authTag:ciphertext atau iv:ciphertext (legacy)
 * @returns Decrypted plaintext
 */
export function decrypt(text: string): string {
    // Validasi input
    if (!text || typeof text !== 'string') {
        throw new Error('Decrypt: Input must be a non-empty string');
    }

    const parts = text.split(':');
    
    // Validasi format minimal
    if (parts.length < 2) {
        throw new Error('Decrypt: Invalid encrypted data format - missing separator');
    }

    // Deteksi format: 3 parts = GCM (new), 2 parts = CBC (legacy)
    if (parts.length >= 3) {
        // Format baru: AES-256-GCM
        return decryptGCM(parts);
    } else {
        // Format legacy: AES-256-CBC (backward compatibility)
        Logger.warn('Decrypting legacy CBC format - consider re-encrypting with new format', 'Security');
        return decryptLegacyCBC(parts);
    }
}

/**
 * Decrypt menggunakan AES-256-GCM (format baru)
 */
function decryptGCM(parts: string[]): string {
    const [ivHex, authTagHex, ...encryptedParts] = parts;
    const encryptedHex = encryptedParts.join(':'); // Handle jika ada ':' di encrypted data

    // Validasi hex format
    if (!isValidHex(ivHex) || !isValidHex(authTagHex) || !isValidHex(encryptedHex)) {
        throw new Error('Decrypt: Invalid hex encoding in encrypted data');
    }

    // Validasi panjang IV dan auth tag
    if (ivHex.length !== IV_LENGTH * 2) {
        throw new Error(`Decrypt: Invalid IV length. Expected ${IV_LENGTH * 2} hex chars, got ${ivHex.length}`);
    }

    if (authTagHex.length !== AUTH_TAG_LENGTH * 2) {
        throw new Error(`Decrypt: Invalid auth tag length. Expected ${AUTH_TAG_LENGTH * 2} hex chars, got ${authTagHex.length}`);
    }

    try {
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encryptedText, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // GCM akan throw error jika auth tag tidak cocok (data corrupted/tampered)
        if (errorMessage.includes('Unsupported state') || errorMessage.includes('auth')) {
            throw new Error('Decrypt: Authentication failed - data may be corrupted or tampered');
        }
        throw new Error(`Decrypt: Failed to decrypt - ${errorMessage}`);
    }
}

/**
 * Decrypt menggunakan AES-256-CBC (format legacy untuk backward compatibility)
 * DEPRECATED: Gunakan format GCM untuk data baru
 */
function decryptLegacyCBC(parts: string[]): string {
    const [ivHex, encryptedHex] = parts;

    // Validasi hex format
    if (!isValidHex(ivHex) || !isValidHex(encryptedHex)) {
        throw new Error('Decrypt: Invalid hex encoding in legacy encrypted data');
    }

    // Legacy CBC menggunakan 16-byte IV
    if (ivHex.length !== 32) {
        throw new Error(`Decrypt: Invalid legacy IV length. Expected 32 hex chars, got ${ivHex.length}`);
    }

    try {
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(encryptedHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);

        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Decrypt (Legacy): Failed to decrypt - ${errorMessage}`);
    }
}

/**
 * Validasi apakah string adalah valid hexadecimal
 */
function isValidHex(str: string): boolean {
    if (!str || str.length === 0) return false;
    return /^[0-9a-fA-F]+$/.test(str);
}

/**
 * Cek apakah encrypted token menggunakan format lama (CBC)
 * Format lama: iv:encryptedData (2 parts)
 * Format baru: iv:authTag:encryptedData (3 parts)
 * 
 * @param encryptedToken - Token yang sudah terenkripsi
 * @returns true jika menggunakan format lama (CBC)
 */
export function isLegacyFormat(encryptedToken: string): boolean {
    if (!encryptedToken || typeof encryptedToken !== 'string') {
        return false;
    }
    const parts = encryptedToken.split(':');
    return parts.length === 2;
}

/**
 * Re-encrypt token dari format lama (CBC) ke format baru (GCM)
 * 
 * @param encryptedToken - Token dengan format lama
 * @returns Encrypted string dengan format baru, atau null jika sudah format baru
 */
export function reEncrypt(encryptedToken: string): string | null {
    if (!isLegacyFormat(encryptedToken)) {
        return null; // Sudah format baru, tidak perlu migrasi
    }
    
    // Decrypt dengan format lama, lalu encrypt dengan format baru
    const decrypted = decrypt(encryptedToken);
    return encrypt(decrypted);
}


/**
 * Generate secure hash untuk digunakan sebagai cache key
 * Menghindari exposing token secara langsung di memory/logs
 * 
 * @param input - String yang akan di-hash (misal: token)
 * @returns SHA256 hash dalam format hex (first 16 chars untuk brevity)
 */
export function generateSecureHash(input: string): string {
    if (!input || typeof input !== 'string') {
        throw new Error('generateSecureHash: Input must be a non-empty string');
    }
    
    return crypto
        .createHash('sha256')
        .update(input)
        .digest('hex')
        .substring(0, 16);
}

/**
 * Verify HMAC signature untuk webhook authentication
 * 
 * @param payload - Raw request body
 * @param signature - Signature dari header
 * @param secret - Webhook secret key
 * @returns true jika signature valid
 */
export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!payload || !signature || !secret) {
        return false;
    }

    try {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        // Gunakan timingSafeEqual untuk mencegah timing attack
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);

        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
        return false;
    }
}
