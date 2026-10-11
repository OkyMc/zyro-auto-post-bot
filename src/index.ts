import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { config } from './config';
import { startServer } from './api/server';
import { onReady } from './events/ready';
import { onInteractionCreate } from './events/interaction';
import { onMessageCreate } from './events/message';
import { WorkerService } from './services/worker.service';
import { StatsService } from './services/stats.service';
import { SchedulerService } from './services/scheduler.service';
import { LicenseService } from './services/license.service';
import { Logger } from './utils/logger';
import prisma from './database/client';
import type { Server } from 'http';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
    rest: {
        timeout: 60000,
        retries: 5
    }
});

// HTTP Server instance for graceful shutdown
let httpServer: Server | null = null;

// Shutdown function - exposed for global exception handlers
let shutdown: ((signal: string) => Promise<void>) | null = null;

// Register Events
client.once(Events.ClientReady, onReady);
client.on(Events.InteractionCreate, onInteractionCreate);
client.on(Events.MessageCreate, onMessageCreate);

// ==================== GLOBAL EXCEPTION HANDLERS ====================

// Unhandled Promise Rejection - Log tapi jangan crash
process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled Promise Rejection', { reason, promise }, 'System');
    // Tidak exit - biarkan process tetap jalan, tapi log untuk debugging
});

// Uncaught Exception - Log dan graceful shutdown karena state mungkin corrupted
process.on('uncaughtException', async (error) => {
    Logger.error('Uncaught Exception - Initiating graceful shutdown', error, 'System');
    
    // Coba graceful shutdown jika sudah tersedia
    if (shutdown) {
        try {
            await shutdown('UNCAUGHT_EXCEPTION');
        } catch (e) {
            Logger.error('Failed to graceful shutdown after uncaught exception', e, 'System');
            process.exit(1);
        }
    } else {
        // Belum ready, langsung exit
        process.exit(1);
    }
});

// Process Warning - Log untuk memory leak detection dll
process.on('warning', (warning) => {
    Logger.warn(`Process Warning: ${warning.name} - ${warning.message}`, 'System');
    if (warning.stack) {
        Logger.debug(`Warning Stack: ${warning.stack}`, 'System');
    }
});

// ==================== MAIN FUNCTION ====================

async function main() {
    try {
        // 1. Verifikasi License API Key sebelum menyalakan bot & service
        await LicenseService.verifyOnStartup();

        // 2. Hubungkan callback jika lisensi direvoke saat runtime
        LicenseService.setOnRevokeCallback(async () => {
            if (shutdown) {
                await shutdown('LICENSE_REVOKED');
            }
        });

        // 3. Start HTTP Server and store instance
        httpServer = startServer(client);

        if (!config.botToken) {
            Logger.error('BOT_TOKEN is missing in .env', null, 'System');
            return;
        }

        await client.login(config.botToken);

        // Graceful Shutdown Handler - assign ke global untuk exception handlers
        shutdown = async (signal: string) => {
            Logger.info(`Received ${signal}. Shutting down gracefully...`, 'System');

            try {
                // 0. Stop License Heartbeat
                LicenseService.stopHeartbeat();

                // 1. Stop Stats Auto-Refresh
                StatsService.stopAutoRefresh();

                // 2. Stop Scheduler Service
                SchedulerService.stop();

                // 3. Stop all workers
                await WorkerService.shutdownAll();

                // 4. Close HTTP Server
                if (httpServer) {
                    await new Promise<void>((resolve, reject) => {
                        httpServer!.close((err) => {
                            if (err) {
                                Logger.error('Error closing HTTP server', err, 'System');
                                reject(err);
                            } else {
                                Logger.info('HTTP server closed.', 'System');
                                resolve();
                            }
                        });
                    });
                }

                // 5. Disconnect Prisma
                await prisma.$disconnect();

                // 6. Destroy Discord client
                client.destroy();

                Logger.info('Shutdown complete.', 'System');
                process.exit(0);
            } catch (error) {
                Logger.error('Error during shutdown', error, 'System');
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown!('SIGINT'));
        process.on('SIGTERM', () => shutdown!('SIGTERM'));

    } catch (error) {
        Logger.error('Fatal Error during startup', error, 'System');
        process.exit(1);
    }
}

main();
