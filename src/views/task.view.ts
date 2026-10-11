import { Task, Account } from '@prisma/client';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ThemeService } from '../config/theme.config';

export function renderTaskPanel(task: Task & { account?: Account | null }, overrideStatus?: string) {
    const theme = ThemeService.getTheme();
    const status = overrideStatus || task.status;
    
    // Sanitize Inputs
    const accountName = (task.account && task.account.name) ? task.account.name : 'Unknown Account';
    const minDelay = Math.floor(task.minDelay / 1000);
    const maxDelay = Math.floor(task.maxDelay / 1000);
    
    // Truncate message to avoid Embed limit (1024 chars)
    let msgPreview = task.message || '';
    if (msgPreview.length > 1000) {
        msgPreview = msgPreview.substring(0, 997) + '...';
    }
    if (!msgPreview) msgPreview = '(No Content)';

    let statusIcon = theme.emojis.inactive;
    if (status === 'RUNNING') statusIcon = theme.emojis.active;
    else if (status === 'PROCESSING') statusIcon = theme.emojis.pending;
    else if (status === 'SUBSCRIPTION_EXPIRED') statusIcon = theme.emojis.error;

    const displayStatus = status === 'SUBSCRIPTION_EXPIRED' ? 'SUBSCRIPTION EXPIRED' : status;

    const isRunning = status === 'RUNNING';
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

    const embed = new EmbedBuilder()
        .setDescription(`
## ${theme.emojis.crown} **TASK CONFIGURATION** ${theme.emojis.crown}
\u200b
**PROCESS STATUS**
${theme.emojis.bullet} Status    : ${statusIcon} **${displayStatus}**
${theme.emojis.bullet} Account   : **${accountName}**

**TARGET & TIMING**
${theme.emojis.bullet} Target    : <#${task.channelId}>
${theme.emojis.bullet} Interval  : **${minDelay}s - ${maxDelay}s**
${theme.emojis.bullet} Next Post : ${nextRunDisplay}
${theme.emojis.bullet} Sent      : **${task.totalSent.toLocaleString()}**

**MESSAGE CONTENT**
\`\`\`
${msgPreview}
\`\`\`
`)
        .setColor(ThemeService.parseColor(theme.colors.success))
        .setFooter({ text: theme.branding.footerText })
        .setTimestamp();

    if (theme.branding.bannerUrl) {
        embed.setImage(theme.branding.bannerUrl);
    }

    const row = new ActionRowBuilder<ButtonBuilder>();
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId('btn_back_menu')
            .setLabel('Back to Menu')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
    );
    
    if (status === 'RUNNING') {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_stop_task_${task.id}`)
                .setLabel('Stop Process')
                .setEmoji(theme.emojis.stop)
                .setStyle(ButtonStyle.Danger)
        );
    } else if (status === 'PROCESSING') {
         row.addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_processing_${task.id}`)
                .setLabel('Processing...')
                .setEmoji(theme.emojis.pending)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_resume_task_${task.id}`)
                .setLabel('Start Process')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Success)
        );
    }

    // Edit Buttons Row
    const editRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_edit_msg_${task.id}`)
                .setLabel('Edit Message')
                .setEmoji('✏️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`btn_edit_delay_${task.id}`)
                .setLabel('Edit Delay')
                .setEmoji(theme.emojis.clock)
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`btn_preview_task_${task.id}`)
                .setLabel('Preview Message')
                .setEmoji('👁️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`btn_delete_task_${task.id}`)
                .setLabel('Delete')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embed, row, editRow };
}
