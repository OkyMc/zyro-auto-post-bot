import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuOptionBuilder } from 'discord.js';
import { AccountService } from '../services/account.service';
import { Logger } from '../utils/logger';
import { ThemeService } from '../config/theme.config';

export async function renderAccountList(userId: string) {
    try {
        const theme = ThemeService.getTheme();
        const accounts = await AccountService.getByUserId(userId);

        const embed = new EmbedBuilder()
            .setDescription(`
## ${theme.emojis.crown} **ACCOUNT MANAGER** ${theme.emojis.crown}
\u200b
**OVERVIEW**
> ${theme.emojis.bullet} Connected Accounts : **${accounts.length}**
\u200b
**YOUR ACCOUNTS**
${accounts.length > 0 ? accounts.map(acc => `${theme.emojis.bullet} **${acc.name || 'Unnamed'}** 
   ID: \`${acc.id.substring(0, 18)}...\``).join('\n') : '> *No accounts connected yet.*'}
`)
            .setColor(ThemeService.parseColor(theme.colors.success))
            .setFooter({ text: theme.branding.footerText })
            .setTimestamp();

        if (theme.branding.bannerUrl) {
            embed.setImage(theme.branding.bannerUrl);
        }

        const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

        if (accounts.length > 0) {
            const select = new StringSelectMenuBuilder()
                .setCustomId('select_manage_account')
                .setPlaceholder('Select an account to manage');

            accounts.slice(0, 25).forEach(acc => {
                select.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(acc.name || 'Unnamed Account')
                        .setValue(acc.id)
                        .setDescription(`ID: ${acc.id.substring(0, 10)}...`)
                        .setEmoji('👤')
                );
            });

            components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
        } else {
            embed.setDescription('You have no connected accounts.');
        }

        const buttonRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_back_menu')
                    .setLabel('Back to Menu')
                    .setEmoji('⬅️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('btn_add_account')
                    .setLabel('Add New Account')
                    .setEmoji(theme.emojis.add)
                    .setStyle(ButtonStyle.Primary)
            );

        components.push(buttonRow);

        return { embeds: [embed], components };
    } catch (error) {
        Logger.error('Failed to render account list', error, 'AccountView');
        return {
            content: '❌ Failed to load accounts. Please try again.',
            embeds: [],
            components: []
        };
    }
}

export async function renderAccountDetail(accountId: string, status?: { isValid: boolean, username?: string }) {
    try {
        const theme = ThemeService.getTheme();
        const account = await AccountService.getById(accountId);

        if (!account) {
            return {
                content: 'Account not found.',
                embeds: [],
                components: []
            };
        }

        // Determine status display with emoji
        let statusDisplay = `${theme.emojis.bullet} Status : **Unknown** *(Click Check Status)*`;
        let statusColor = ThemeService.parseColor(theme.colors.primary);

        if (status) {
            if (status.isValid) {
                statusDisplay = `${theme.emojis.success} Status : **Valid** *(Logged in as ${status.username})*`;
                statusColor = ThemeService.parseColor(theme.colors.success);
            } else {
                statusDisplay = `⚠️ Status : **Invalid** *(Token expired or flagged)*`;
                statusColor = ThemeService.parseColor(theme.colors.danger);
            }
        }

        const embed = new EmbedBuilder()
            .setDescription(`
## ${theme.emojis.crown} **MANAGE ACCOUNT** ${theme.emojis.crown}
\u200b
**ACCOUNT INFO**
${theme.emojis.bullet} Name : **${account.name}**
${theme.emojis.bullet} ID : \`${account.id}\`
${theme.emojis.bullet} Added : <t:${Math.floor(account.createdAt.getTime() / 1000)}:R>
\u200b
**TOKEN STATUS**
${statusDisplay}
`)
            .setColor(statusColor)
            .setThumbnail(account.avatar ? `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.png` : null)
            .setFooter({ text: theme.branding.footerText })
            .setTimestamp();

        if (theme.branding.bannerUrl) {
            embed.setImage(theme.branding.bannerUrl);
        }

        // Build buttons dynamically
        const buttons: ButtonBuilder[] = [
            new ButtonBuilder()
                .setCustomId('btn_account_back')
                .setLabel('Back to List')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`btn_check_account_${account.id}`)
                .setLabel('Check Status')
                .setEmoji('🔍')
                .setStyle(ButtonStyle.Primary)
        ];

        // CONDITIONAL: Only show Update Token when token is invalid
        if (status && !status.isValid) {
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`btn_update_token_${account.id}`)
                    .setLabel('Update Token')
                    .setEmoji('🔄')
                    .setStyle(ButtonStyle.Success)
            );
        }

        // Delete always last
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`btn_delete_account_${account.id}`)
                .setLabel('Delete Account')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger)
        );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

        return { embeds: [embed], components: [row] };
    } catch (error) {
        Logger.error('Failed to render account detail', error, 'AccountView');
        return {
            content: '❌ Failed to load account details. Please try again.',
            embeds: [],
            components: []
        };
    }
}
