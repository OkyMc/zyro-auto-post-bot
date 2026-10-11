import dotenv from 'dotenv';

dotenv.config();

export interface PaymentProduct {
    id: string;
    name: string;
    price: number;
    durationDays: number;
    description: string;
}

export const PRODUCTS: Record<string, PaymentProduct> = {
    '7_DAYS': {
        id: '7_DAYS',
        name: 'Weekly Access',
        price: parseInt(process.env.PRICE_7_DAYS || '10000'),
        durationDays: 7,
        description: 'Full access to Selfbot Manager for 7 days.'
    },
    '30_DAYS': {
        id: '30_DAYS',
        name: 'Monthly Access',
        price: parseInt(process.env.PRICE_30_DAYS || '35000'),
        durationDays: 30,
        description: 'Full access to Selfbot Manager for 30 days (Save 12%).'
    }
};

export const config = {
    port: process.env.PORT || 3000,
    databaseUrl: process.env.DATABASE_URL,
    botToken: process.env.BOT_TOKEN,
    encryptionKey: process.env.ENCRYPTION_KEY,
    webhookUrl: process.env.WEBHOOK_URL,
    enablePayment: process.env.ENABLE_PAYMENT === 'true',
    pakasir: {
        apiKey: process.env.PAKASIR_API_KEY,
        projectSlug: process.env.PAKASIR_PROJECT_SLUG,
        apiUrl: process.env.PAKASIR_API_URL || 'https://app.pakasir.com/api',
    },
    guildId: process.env.GUILD_ID,
    adminId: process.env.ADMIN_ID,
    adminRoleId: process.env.ADMIN_ROLE_ID,
    clientId: process.env.CLIENT_ID,
    license: {
        key: process.env.LICENSE_KEY || '',
        serverUrl: process.env.LICENSE_SERVER_URL || 'https://license.yourdomain.com',
        checkIntervalMinutes: parseInt(process.env.LICENSE_CHECK_INTERVAL_MINUTES || '30', 10),
        enabled: process.env.ENABLE_LICENSE_CHECK !== 'false' // default true
    }
};

// Basic Validation
const requiredEnv = ['BOT_TOKEN', 'ENCRYPTION_KEY', 'GUILD_ID', 'ADMIN_ID'];
if (config.enablePayment) {
    requiredEnv.push('PAKASIR_API_KEY', 'PAKASIR_PROJECT_SLUG');
}
if (config.license.enabled) {
    requiredEnv.push('LICENSE_KEY');
}
const missing = requiredEnv.filter(key => !process.env[key]);

if (missing.length > 0) {
    console.warn(`[Config] ⚠️ Missing recommended environment variables: ${missing.join(', ')}`);
}

if (config.encryptionKey && config.encryptionKey.length !== 32) {
    console.error(`[Config] ❌ ENCRYPTION_KEY must be exactly 32 characters long. Current length: ${config.encryptionKey.length}`);
    process.exit(1);
}
