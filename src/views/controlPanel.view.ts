import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { AdminService } from '../services/admin.service';
import { Logger } from '../utils/logger';
import { ThemeService } from '../config/theme.config';
import { PluginService } from '../services/plugin.service';

export async function renderControlPanel(userId: string) {
    try {
        const customRenderer = PluginService.getViewOverride('controlPanel');
        if (customRenderer) {
            return await customRenderer(userId);
        }

        const theme = ThemeService.getTheme();
        const data = await AdminService.getUserControlPanelData(userId);
        const { user, accountCount, activeTaskCount, totalMessagesSent } = data;

        // Calculate Duration & Status
        let durationDisplay = 'Pending Approval';
        let isExpired = false;
        let isPending = false;
        let embedColor = ThemeService.parseColor(theme.colors.success);

        if (!user?.expiryDate) {
            isPending = true;
            durationDisplay = 'Menunggu Konfirmasi Admin';
            embedColor = ThemeService.parseColor(theme.colors.warning);
        } else {
            const now = new Date();
            const expiry = new Date(user.expiryDate);
            const diffMs = expiry.getTime() - now.getTime();

            if (diffMs > 0) {
                const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                
                if (days === 0 && hours === 0) {
                    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                    if (minutes === 0) {
                        durationDisplay = '< 1m remaining';
                    } else {
                        durationDisplay = `${minutes}m remaining`;
                    }
                } else {
                    durationDisplay = `${days}d ${hours}h remaining`;
                }
                embedColor = ThemeService.parseColor(theme.colors.success);
            } else {
                durationDisplay = 'Expired';
                isExpired = true;
                embedColor = ThemeService.parseColor(theme.colors.danger);
            }
        }

        const isDisabled = isPending || isExpired;

        let statusDescription = '';
        if (isPending) {
            statusDescription = `\n${theme.emojis.pending} **WORKSPACE TERKUNCI (PENDING APPROVAL)**\nSilakan selesaikan pembayaran sesuai instruksi di atas, lalu tunggu admin melakukan approve workspace.`;
        } else if (isExpired) {
            statusDescription = `\n${theme.emojis.error} **SUBSCRIPTION EXPIRED (LOCKED)**\nMasa aktif telah habis. Silakan perpanjang paket untuk membuka kembali akses.`;
        }

        const embed = new EmbedBuilder()
            .setDescription(`
## ${theme.emojis.crown} **${theme.ui.controlPanelTitle}** ${theme.emojis.crown}
\u200b
**SUBSCRIPTION STATUS**
${theme.emojis.bullet} Status Access : **${isPending ? '🔒 Locked (Pending)' : isExpired ? '❌ Expired' : '✅ Active'}**
${theme.emojis.bullet} Expires in    : **${durationDisplay}**${statusDescription}

**INFRASTRUCTURE**
${theme.emojis.bullet} Connected Accounts : **${accountCount}**
${theme.emojis.bullet} Active Workers     : **${activeTaskCount}**
${theme.emojis.bullet} Total Messages Sent : **${totalMessagesSent.toLocaleString()}**
`)
            .setColor(embedColor)
            .setFooter({ text: theme.branding.footerText })
            .setTimestamp();

        if (theme.branding.bannerUrl) {
            embed.setImage(theme.branding.bannerUrl);
        }

        const row1 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_add_account')
                    .setLabel('Add Account')
                    .setEmoji(theme.emojis.add)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(isDisabled),
                new ButtonBuilder()
                    .setCustomId('btn_setup_task')
                    .setLabel('New Task')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(isDisabled),
                new ButtonBuilder()
                    .setCustomId('btn_view_tasks')
                    .setLabel('Manage Tasks')
                    .setEmoji(theme.emojis.gear)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(isDisabled)
            );

        const row2 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_manage_accounts')
                    .setLabel('Manage Accounts')
                    .setEmoji('👥')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(isDisabled),
                new ButtonBuilder()
                    .setCustomId('btn_stop_all')
                    .setLabel('Stop All')
                    .setEmoji(theme.emojis.stop)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(isDisabled)
            );

        return { content: null, embeds: [embed], components: [row1, row2] };
    } catch (error) {
        Logger.error('Failed to render control panel', error, 'ControlPanelView');
        return {
            content: '❌ Failed to load control panel. Please try again.',
            embeds: [],
            components: []
        };
    }
}
