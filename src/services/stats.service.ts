import { Client, TextChannel } from 'discord.js';
import prisma from '../database/client';
import { renderStats } from '../views/stats.view';
import { Logger } from '../utils/logger';

export class StatsService {
    private static interval: NodeJS.Timeout | null = null;

    static startAutoRefresh(client: Client) {
        // Prevent multiple intervals
        if (this.interval) clearInterval(this.interval);

        Logger.info('Starting Global Stats Auto-Refresh (15s)', 'StatsService');

        this.interval = setInterval(async () => {
            await this.refreshStats(client);
        }, 15000); // 15 seconds
    }

    /**
     * Stop auto-refresh interval (untuk graceful shutdown)
     */
    static stopAutoRefresh(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            Logger.info('Stopped Global Stats Auto-Refresh', 'StatsService');
        }
    }

    static async refreshStats(client: Client) {
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'main' } });
            
            if (!config || !config.statsChannelId || !config.statsMessageId) return;

            const channel = await client.channels.fetch(config.statsChannelId) as TextChannel;
            if (!channel) return;

            const message = await channel.messages.fetch(config.statsMessageId);
            if (!message) return;

            const view = await renderStats();
            
            // Only edit if content changed (though timestamp always changes, so it will edit)
            await message.edit({
                flags: (view as any).flags,
                components: (view as any).components,
                embeds: []
            } as any);

        } catch (error) {
            Logger.error('Failed to auto-refresh Global Stats', error, 'StatsService');
        }
    }
}