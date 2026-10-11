import { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { TaskService } from '../services/task.service';
import { formatDuration } from '../utils/timeHelper';
import { Logger } from '../utils/logger';
import { ThemeService } from '../config/theme.config';
import { PluginService } from '../services/plugin.service';

export async function renderDashboard(userId: string) {
    try {
        // 1. Check if user has registered a custom view override in custom/
        const customRenderer = PluginService.getViewOverride('dashboard');
        if (customRenderer) {
            return await customRenderer(userId);
        }

        const theme = ThemeService.getTheme();

        // 2. Fetch User's Tasks dengan account details via Service
        const tasks = await TaskService.getTasksByUserWithDetails(userId);

        if (tasks.length === 0) {
            const emptyRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_back_menu')
                        .setLabel('Back to Menu')
                        .setEmoji('⬅️')
                        .setStyle(ButtonStyle.Secondary)
                );

            return {
                content: '📭 No tasks found. Create one first!',
                embeds: [],
                components: [emptyRow]
            };
        }

        // 3. Build Embed using Theme
        const activeCount = tasks.filter(t => t.status === 'RUNNING').length;
        const inactiveCount = tasks.length - activeCount;

        const embed = new EmbedBuilder()
            .setDescription(`
## ${theme.emojis.crown} **${theme.ui.dashboardTitle}** ${theme.emojis.crown}
\u200b
**PROCESS OVERVIEW**
> ${theme.emojis.active} Active Workers : **${activeCount}**
> ${theme.emojis.inactive} Inactive Workers : **${inactiveCount}**
> ${theme.emojis.bullet} Total Workers  : **${tasks.length}**
\u200b
`)
            .setColor(ThemeService.parseColor(theme.colors.success))
            .setFooter({ text: theme.branding.footerText })
            .setTimestamp();

        if (theme.branding.bannerUrl) {
            embed.setImage(theme.branding.bannerUrl);
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_manage_task')
            .setPlaceholder('Select a task to configure');

        // Limit to 10 tasks (25 fields limit)
        const displayTasks = tasks.slice(0, 10);

        displayTasks.forEach((task) => {
            const isRunning = task.status === 'RUNNING';
            const statusIcon = isRunning ? theme.emojis.active : theme.emojis.inactive;
            const accountName = task.account?.name || 'Unnamed';
            const guildDisplay = task.guildName || 'Unknown Server';
            const channelDisplay = task.channelName ? `#${task.channelName}` : `<#${task.channelId}>`;
            const slowmodeDisplay = task.channelSlowmode ? `(${task.channelSlowmode}s)` : '';

            // Format Interval
            const intervalDisplay = `${formatDuration(task.minDelay / 1000)} - ${formatDuration(task.maxDelay / 1000)}`;

            // Countdown Next Post (Live Discord Relative Timestamp)
            let nextRunDisplay = '`Stopped`';
            if (isRunning) {
                const effectiveInterval = (task.dynamicDelay && task.channelSlowmode && task.channelSlowmode > 0)
                    ? task.channelSlowmode * 1000
                    : task.minDelay;

                const targetTime = (task as any).nextRun 
                    ? new Date((task as any).nextRun).getTime() 
                    : (task.lastRun ? new Date(task.lastRun).getTime() + effectiveInterval : null);

                if (targetTime) {
                    if (targetTime > Date.now()) {
                        nextRunDisplay = `<t:${Math.floor(targetTime / 1000)}:R>`;
                    } else {
                        nextRunDisplay = '`Sending soon...`';
                    }
                } else {
                    nextRunDisplay = '`Sending soon...`';
                }
            }

            // Single Field per Task
            embed.addFields({
                name: `${statusIcon} **${accountName}**`,
                value: `${theme.emojis.bullet} Server : **${guildDisplay}**\n${theme.emojis.bullet} Channel : ${channelDisplay} ${slowmodeDisplay}\n${theme.emojis.bullet} Interval : \`${intervalDisplay}\`\n${theme.emojis.bullet} Next Post : ${nextRunDisplay}\n${theme.emojis.bullet} Sent : **${(task.totalSent ?? 0).toLocaleString()}**`,
                inline: false
            });

            selectMenu.addOptions({
                label: `${accountName} -> ${task.guildName?.substring(0, 20) || 'Server'}`,
                description: `Status: ${task.status}`,
                value: task.id,
                emoji: isRunning ? theme.emojis.active : theme.emojis.inactive
            });
        });

        if (tasks.length > 10) {
            embed.setFooter({ text: `${theme.branding.footerText} • ...and ${tasks.length - 10} more tasks.` });
        }

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        return {
            content: null,
            embeds: [embed],
            components: [row]
        };
    } catch (error) {
        Logger.error('Failed to render dashboard', error, 'DashboardView');
        return {
            content: '❌ Failed to load dashboard. Please try again.',
            embeds: [],
            components: []
        };
    }
}
