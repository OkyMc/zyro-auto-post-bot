import { StringSelectMenuInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } from 'discord.js';
import { AccountService } from '../services/account.service';
import { WorkerService } from '../services/worker.service';
import { TaskService } from '../services/task.service';
import { WorkspaceService } from '../services/workspace.service';
import { renderTaskPanel } from '../views/task.view';
import { renderAccountDetail } from '../views/account.view';
import { WorkerGuild, WorkerChannel } from '../interfaces/worker';
import { Logger } from '../utils/logger';
import { validateOwnership } from '../utils/interactionGuard';
import { PRODUCTS, config } from '../config';

export async function handleSelect(interaction: StringSelectMenuInteraction) {
    // Security Check
    const isAuthorized = await validateOwnership(interaction);
    if (!isAuthorized) return;

    const { customId } = interaction;

    try {
        // ==================== ORDER PLAN SELECTION ====================
        if (customId === 'select_order_plan') {
            const planKey = interaction.values[0];
            const product = PRODUCTS[planKey] || PRODUCTS['7_DAYS'];

            await interaction.deferUpdate();

            try {
                const targetGuildId = config.guildId || interaction.guildId;
                if (!targetGuildId) {
                    await interaction.followUp({ content: '❌ `GUILD_ID` belum disetting di `.env`.', flags: MessageFlags.Ephemeral });
                    return;
                }

                const channel = await WorkspaceService.createPendingWorkspace(
                    interaction.client,
                    targetGuildId,
                    interaction.user.id,
                    planKey
                );

                await interaction.editReply({
                    content: `🎉 **Permintaan Workspace Berhasil Dibuat!**\nChannel privat kamu telah disiapkan di <#${channel?.id}> (Paket: **${product.name}**).\nSilakan buka channel tersebut untuk melihat rincian pembayaran & menunggu persetujuan admin! 🔥`,
                    embeds: [],
                    components: []
                });
            } catch (err: any) {
                Logger.error('Failed to create pending workspace from plan selection', err, 'SelectHandler');
                await interaction.editReply({
                    content: `❌ Gagal membuat workspace: ${err.message}`,
                    embeds: [],
                    components: []
                });
            }
            return;
        }

        if (customId === 'select_account_task') {
            const accountId = interaction.values[0];
            
            // Get account info first
            const account = await AccountService.getById(accountId);
            if (!account) {
                await interaction.reply({ content: '❌ Account not found.', flags: MessageFlags.Ephemeral });
                return;
            }
            const accountName = account.name || 'Unknown';

            // Show loading state immediately
            const loadingEmbed = new EmbedBuilder()
                .setDescription(`
## 👑 **TASK SETUP** 👑
\u200b
**PROGRESS**
✅ Account : **${accountName}**
⏳ Server : *Fetching...*
⚪ Channel : *Pending*
⚪ Strategy : *Pending*
`)
                .setColor(0x5865F2)
                .setFooter({ text: 'Zyro Post' })
                .setTimestamp();

            await interaction.update({
                content: '',
                embeds: [loadingEmbed],
                components: []
            });

            try {
                const token = AccountService.getDecryptedToken(account);
                const guilds = await WorkerService.fetchGuilds(token, accountId, interaction.user.id);
                
                const ITEMS_PER_PAGE = 25;
                const slicedGuilds = guilds.slice(0, ITEMS_PER_PAGE);
                
                // Calculate Total Pages
                const totalPages = Math.ceil(guilds.length / ITEMS_PER_PAGE);

                const select = new StringSelectMenuBuilder()
                    .setCustomId(`select_guild_task_${accountId}`)
                    .setPlaceholder(`Select a server (Page 1/${totalPages})`)
                    .addOptions(
                        slicedGuilds.map((g: WorkerGuild) => new StringSelectMenuOptionBuilder()
                            .setLabel(g.name.substring(0, 100))
                            .setValue(g.id)
                            .setDescription(`ID: ${g.id}`)
                        )
                    );

                const buttons: ButtonBuilder[] = [];
                
                // If more than 25, add Next button
                if (guilds.length > ITEMS_PER_PAGE) {
                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`btn_page_guild_${accountId}_1`) // Go to Page 1 (index 1 = 2nd page)
                            .setLabel('Next ➡️')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }

                buttons.push(
                    new ButtonBuilder().setCustomId(`btn_search_guild_${accountId}`).setLabel('Search').setStyle(ButtonStyle.Primary).setEmoji('🔍'),
                    new ButtonBuilder().setCustomId('btn_back_step1').setLabel('Back').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('btn_cancel_setup').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );

                const resultEmbed = new EmbedBuilder()
                    .setDescription(`
## 👑 **TASK SETUP** 👑
\u200b
**PROGRESS**
✅ Account : **${accountName}**
🔹 Server : *Select from dropdown*
⚪ Channel : *Pending*
⚪ Strategy : *Pending*
\u200b
> Found **${guilds.length}** servers (Page 1/${totalPages})
`)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Zyro Post' })
                    .setTimestamp();

                await interaction.editReply({
                    content: '',
                    embeds: [resultEmbed],
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
                        new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
                    ]
                });

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await interaction.editReply({ content: `❌ Failed to fetch servers: ${errorMessage}`, embeds: [], components: [] });
            }
        }

        else if (customId.startsWith('select_guild_task_')) {
            const accountId = customId.replace('select_guild_task_', '');
            const guildId = interaction.values[0];

            // Get account and guild info first
            const account = await AccountService.getById(accountId);
            if (!account) {
                await interaction.reply({ content: '❌ Account not found.', flags: MessageFlags.Ephemeral });
                return;
            }
            const accountName = account.name || 'Unknown';
            
            // Get guild name from the select menu option label
            const selectedOption = interaction.component.options.find(opt => opt.value === guildId);
            const guildName = selectedOption?.label || 'Unknown Server';

            // Show loading state immediately
            const loadingEmbed = new EmbedBuilder()
                .setDescription(`
## 👑 **TASK SETUP** 👑
\u200b
**PROGRESS**
✅ Account : **${accountName}**
✅ Server : **${guildName}**
⏳ Channel : *Fetching...*
⚪ Strategy : *Pending*
`)
                .setColor(0x5865F2)
                .setFooter({ text: 'Zyro Post' })
                .setTimestamp();

            await interaction.update({
                content: '',
                embeds: [loadingEmbed],
                components: []
            });

            try {
                const token = AccountService.getDecryptedToken(account);
                const channels = await WorkerService.fetchChannels(token, guildId, accountId, interaction.user.id);

                if (channels.length === 0) {
                    await interaction.editReply({ content: '❌ No text channels found.', embeds: [], components: [] });
                    return;
                }

                // Pagination: Show first 25
                const ITEMS_PER_PAGE = 25;
                const slicedChannels = channels.slice(0, ITEMS_PER_PAGE);

                // Calculate Total Pages
                const totalPages = Math.ceil(channels.length / ITEMS_PER_PAGE);

                const select = new StringSelectMenuBuilder()
                    .setCustomId(`select_channel_task_${accountId}_${guildId}`)
                    .setPlaceholder(`Choose a channel (Page 1/${totalPages})`)
                    .addOptions(
                        slicedChannels.map((c: WorkerChannel) => new StringSelectMenuOptionBuilder()
                            .setLabel(c.name.substring(0, 50))
                            .setValue(`${c.id}|${c.rateLimitPerUser}`)
                            .setDescription(`Slowmode: ${c.rateLimitPerUser}s`)
                        )
                    );

                const buttons: ButtonBuilder[] = [];

                if (channels.length > ITEMS_PER_PAGE) {
                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`btn_page_channel_${accountId}_${guildId}_1`) // Go to Page 1
                            .setLabel('Next ➡️')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }

                buttons.push(
                    new ButtonBuilder().setCustomId(`btn_back_step2_${accountId}`).setLabel('Back').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('btn_cancel_setup').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );

                const resultEmbed = new EmbedBuilder()
                    .setDescription(`
## 👑 **TASK SETUP** 👑
\u200b
**PROGRESS**
✅ Account : **${accountName}**
✅ Server : **${guildName}**
🔹 Channel : *Select from dropdown*
⚪ Strategy : *Pending*
\u200b
> Found **${channels.length}** channels (Page 1/${totalPages})
`)
                    .setColor(0x5865F2)
                    .setFooter({ text: 'Zyro Post' })
                    .setTimestamp();

                await interaction.editReply({
                    content: '',
                    embeds: [resultEmbed],
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
                        new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
                    ]
                });

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await interaction.editReply({ content: `❌ Failed to fetch channels: ${errorMessage}`, embeds: [], components: [] });
            }
        }

        else if (customId.startsWith('select_channel_task_')) {
            const parts = customId.split('_');
            const accountId = parts[3];
            const guildId = parts[4];
            
            const value = interaction.values[0];
            const [channelId, slowmodeStr] = value.split('|');
            const slowmode = parseInt(slowmodeStr);

            // Get account info
            const account = await AccountService.getById(accountId);
            const accountName = account?.name || 'Unknown';

            // Get channel name from select option
            const selectedOption = interaction.component.options.find(opt => opt.value === value);
            const channelName = selectedOption?.label || 'Unknown Channel';

            // Calculate auto delay preview (same formula as modal.handler.ts)
            const autoMinDelay = slowmode + 60;  // slowmode + 1 min
            const autoMaxDelay = slowmode + 180; // slowmode + 3 min

            const embed = new EmbedBuilder()
                .setDescription(`
## 👑 **CONFIGURE STRATEGY** 👑
\u200b
**PROGRESS**
✅ Account : **${accountName}**
✅ Server : *Selected*
✅ Channel : **#${channelName}**
🔹 Strategy : *Choose below*
\u200b
**MODE OPTIONS**
🔹 **Automatic** → Delay: **${autoMinDelay}s - ${autoMaxDelay}s**
> *Formula: Slowmode + 1~3 minutes buffer*

🔹 **Manual** → Set custom delay range
> *Minimum: ${slowmode > 0 ? slowmode + 's (slowmode)' : '3s'}*
\u200b
🔹 Channel Slowmode : **${slowmode}s**
`)
                .setColor(0x5865F2)
                .setFooter({ text: 'Zyro Post' })
                .setTimestamp();

            const strategyRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`btn_delay_auto_${accountId}_${guildId}_${channelId}_${slowmode}`)
                        .setLabel('Use Automatic')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`btn_delay_manual_${accountId}_${guildId}_${channelId}_${slowmode}`)
                        .setLabel('Configure Manual')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`btn_back_step3_${accountId}_${guildId}`)
                        .setLabel('Back')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('btn_cancel_setup')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.update({
                content: '',
                embeds: [embed],
                components: [strategyRow]
            });
        }

        else if (customId === 'select_manage_task') {
            const taskId = interaction.values[0];
            await interaction.deferUpdate();

            const task = await TaskService.getById(taskId);

            if (!task) {
                await interaction.editReply({ content: 'Task not found.', components: [], embeds: [] });
                return;
            }

            const panel = renderTaskPanel(task);

            await interaction.editReply({
                embeds: [panel.embed],
                components: [panel.row, panel.editRow]
            });
        }

        else if (customId === 'select_manage_account') {
            const accountId = interaction.values[0];
            await interaction.deferUpdate();
            
            const view = await renderAccountDetail(accountId);
            await interaction.editReply({ ...view });
        } else {
            Logger.warn(`Unhandled select customId: ${customId}`, 'SelectHandler');
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Unknown action.', flags: 1 << 6 });
            }
        }

    } catch (error) {
        Logger.error('Select Handler Error', error);
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred. Please try again.', flags: 1 << 6 });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: '❌ An error occurred. Please try again.' });
            }
        } catch (replyError) {
            Logger.warn('Failed to send error feedback to user', 'SelectHandler');
        }
    }
}
