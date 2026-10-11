import { Client, EmbedBuilder } from 'discord.js';
import prisma from '../database/client';
import { WorkerService } from './worker.service';
import { WorkspaceService } from './workspace.service';
import { Logger } from '../utils/logger';

export class SchedulerService {
    private static INTERVAL_MS = 60 * 1000; // Check every 1 minute
    private static intervals: NodeJS.Timeout[] = [];
    private static isRunning = false;
    private static notifiedExpiredUserIds = new Set<string>();

    static init(client: Client) {
        if (this.isRunning) {
            Logger.warn('[Scheduler] Service already running. Ignoring duplicate init().', 'SchedulerService');
            return;
        }
        
        Logger.info('[Scheduler] Service started. Watchdog active.', 'SchedulerService');
        this.isRunning = true;
        
        // Initial check on startup
        this.checkExpiredSubscriptions(client);
        
        // Periodic check
        const interval = setInterval(() => {
            this.checkExpiredSubscriptions(client);
            this.syncActiveUserStats(client);
        }, this.INTERVAL_MS);
        
        this.intervals.push(interval);
    }

    static stop() {
        if (!this.isRunning) {
            Logger.warn('[Scheduler] Service not running.', 'SchedulerService');
            return;
        }
        
        Logger.info('[Scheduler] Stopping service...', 'SchedulerService');
        this.isRunning = false;
        
        for (const interval of this.intervals) {
            clearInterval(interval);
        }
        this.intervals = [];
    }

    static async syncActiveUserStats(client: Client) {
        try {
            const activeUsers = await prisma.user.findMany({
                where: {
                    accounts: {
                        some: {
                            tasks: {
                                some: { status: 'RUNNING' }
                            }
                        }
                    },
                    workspaceChannelId: { not: null }
                },
                select: { id: true }
            });

            if (activeUsers.length > 0) {
                for (const user of activeUsers) {
                    await WorkspaceService.refreshControlPanel(client, user.id);
                }
            }
        } catch (error) {
            Logger.error('[Scheduler] Failed to sync active user stats', error, 'SchedulerService');
        }
    }

    static async checkExpiredSubscriptions(client: Client) {
        try {
            const now = new Date();

            // 1. Find Running Tasks for Expired Users
            const illegalTasks = await prisma.task.findMany({
                where: {
                    status: 'RUNNING',
                    account: {
                        user: {
                            expiryDate: { lt: now }
                        }
                    }
                },
                include: {
                    account: { include: { user: true } }
                }
            });

            if (illegalTasks.length > 0) {
                Logger.info(`[Scheduler] Found ${illegalTasks.length} tasks from expired users. Stopping...`, 'SchedulerService');
                
                for (const task of illegalTasks) {
                    try {
                        const expiryStr = task.account.user.expiryDate ? new Date(task.account.user.expiryDate).toLocaleString('id-ID') : 'Unknown';
                        Logger.info(`[Scheduler] Stopping Task ${task.id} (User ${task.account.user.username} expired at ${expiryStr})`, 'SchedulerService');
                        await WorkerService.stopTask(client, task.id, 'Subscription Expired');
                    } catch (err) {
                        Logger.error(`[Scheduler] Failed to stop task ${task.id}`, err, 'SchedulerService');
                    }
                }
            }

            // 2. Visual Update & DM Notification for Expired Users
            const checkWindow = new Date(now.getTime() - this.INTERVAL_MS - 10000); // 1m 10s lookback

            const recentlyExpiredUsers = await prisma.user.findMany({
                where: {
                    expiryDate: {
                        lt: now,
                        gt: checkWindow
                    },
                    workspaceChannelId: { not: null }
                }
            });

            for (const user of recentlyExpiredUsers) {
                // Refresh Panel to Red (Locked)
                await WorkspaceService.refreshControlPanel(client, user.id);

                // Send DM Notification to Buyer if not notified recently
                if (!this.notifiedExpiredUserIds.has(user.id)) {
                    this.notifiedExpiredUserIds.add(user.id);

                    try {
                        const discordUser = await client.users.fetch(user.id);
                        if (discordUser) {
                            const expiredDmEmbed = new EmbedBuilder()
                                .setTitle('⚠️ MASA AKTIF ZYRO POST TELAH BERAKHIR')
                                .setDescription(`
Halo **${discordUser.username}**! Masa aktif langganan Zyro Post kamu telah habis pada \`${new Date(user.expiryDate!).toLocaleString('id-ID')}\`.

⛔ **Dampak:**
• Seluruh jadwal auto post telah dihentikan (PAUSED).
• Workspace privat kamu telah dikunci (LOCKED).

💡 **Cara Mengaktifkan Kembali:**
Silakan hubungi Seller / Admin atau gunakan tombol **Order** di channel Store untuk melakukan perpanjangan paket.
`)
                                .setColor(0xED4245)
                                .setFooter({ text: 'Zyro Post • Subscription Watchdog' })
                                .setTimestamp();

                            await discordUser.send({ embeds: [expiredDmEmbed] });
                            Logger.info(`[Scheduler] Sent expired DM notification to ${discordUser.tag}`, 'SchedulerService');
                        }
                    } catch {
                        // Abaikan jika user menutup DM
                    }
                }
            }

        } catch (error) {
            Logger.error('[Scheduler] Error in watchdog loop', error, 'SchedulerService');
        }
    }
}
