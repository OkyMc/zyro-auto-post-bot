import { Client } from 'discord.js';
import { WorkerService } from '../services/worker.service';
import { WorkspaceService } from '../services/workspace.service';
import { StatsService } from '../services/stats.service';
import { SchedulerService } from '../services/scheduler.service';
import { ThemeService } from '../config/theme.config';
import { PluginService } from '../services/plugin.service';
import { Logger } from '../utils/logger';

export async function onReady(client: Client) {
    Logger.info(`Ready! Logged in as ${client.user?.tag}`, 'MainBot');
    
    // Initialize Theme System & Custom Plugins
    ThemeService.init();
    await PluginService.init();
    await PluginService.triggerOnBotReady(client);

    // Register Main Client to WorkerService for reliable log forwarding
    WorkerService.setClient(client);

    // Start Stats Auto-Refresh immediately (Independent)
    StatsService.startAutoRefresh(client);

    // Start Watchdog Scheduler
    SchedulerService.init(client);

    // Run Startup Syncs
    try {
        await WorkerService.syncTasksOnStartup(client);
    } catch (e) {
        Logger.error('Failed to sync tasks on startup', e, 'MainBot');
    }

    try {
        await WorkspaceService.syncPanelsOnStartup(client);
    } catch (e) {
        Logger.error('Failed to sync panels on startup', e, 'MainBot');
    }
}
