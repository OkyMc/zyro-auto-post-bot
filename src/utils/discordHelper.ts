import { Client } from 'discord.js-selfbot-v13';
import { sanitizeToken } from './security';

interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
}

/**
 * Safely validates a Discord User Token using authentic discord.js-selfbot-v13 client
 * without stripped properties or custom overrides.
 */
export async function validateToken(token: string): Promise<DiscordUser | null> {
    const cleanToken = sanitizeToken(token);
    if (!cleanToken || cleanToken.length < 20) {
        return null;
    }

    const client = new Client({
        checkUpdate: false
    } as any);

    return new Promise((resolve) => {
        let isResolved = false;

        const cleanup = () => {
            try {
                client.destroy();
            } catch (e) {}
        };

        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                cleanup();
                resolve(null);
            }
        }, 15000);

        client.once('ready', () => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                const user = client.user ? {
                    id: client.user.id,
                    username: client.user.username,
                    discriminator: client.user.discriminator || '0',
                    avatar: client.user.displayAvatarURL() || ''
                } : null;
                cleanup();
                resolve(user);
            }
        });

        client.login(cleanToken).catch(() => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                cleanup();
                resolve(null);
            }
        });
    });
}
