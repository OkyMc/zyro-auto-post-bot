import { ModalSubmitInteraction, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { validateToken } from '../utils/discordHelper';
import { WorkerService } from '../services/worker.service';
import { AccountService } from '../services/account.service';
import { TaskService } from '../services/task.service';
import { Logger } from '../utils/logger';
import { validateOwnership } from '../utils/interactionGuard';
import { renderTaskPanel } from '../views/task.view';
import { renderAccountDetail } from '../views/account.view';
import { decrypt, sanitizeToken } from '../utils/security';
import { WorkerGuild } from '../interfaces/worker';

// Konstanta validasi delay
const MAX_DELAY_MS = 86400000; // 24 hours in milliseconds
const MIN_DELAY_MS = 30000; // 30 seconds minimum safe delay

export async function handleModal(interaction: ModalSubmitInteraction) {
    // Security Check
    const isAuthorized = await validateOwnership(interaction);
    if (!isAuthorized) return;

    const { customId } = interaction;

    try {
        // ==================== ADD ACCOUNT MODAL ====================
        if (customId === 'modal_add_account') {
            const rawToken = interaction.fields.getTextInputValue('token_input');
            const cleanToken = sanitizeToken(rawToken);
            const name = interaction.fields.getTextInputValue('name_input');
            
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const discordUser = await validateToken(cleanToken);
            
            if (!discordUser) {
                await interaction.editReply({ content: '❌ Invalid Discord Token. Please check and try again.' });
                return;
            }

            await AccountService.create(interaction.user.id, name, cleanToken, discordUser.avatar);
            await interaction.editReply({ content: `✅ Account **${name}** (Connected as ${discordUser.username}) added successfully!` });
        }

        // ==================== SEARCH GUILD MODAL ====================
        else if (customId.startsWith('modal_search_guild_')) {
            const accountId = customId.replace('modal_search_guild_', '');
            const query = interaction.fields.getTextInputValue('search_query').toLowerCase();

            // Get account name for display
            const account = await AccountService.getById(accountId);
            if (!account) {
                await interaction.reply({ content: '❌ Account not found.', flags: MessageFlags.Ephemeral });
                return;
            }
            const accountName = account.name || 'Unknown';

            // Use deferUpdate to edit the SAME message instead of creating new one
            await interaction.deferUpdate();

            // Show loading embed on the SAME message
            const loadingEmbed = new EmbedBuilder()
                .setDescription(`
## 👑 **TASK SETUP** 👑
\u200b
**PROGRESS**
✅ Account : **${accountName}**
⏳ Server : *Searching "${query}"...*
⚪ Channel : *Pending*
⚪ Strategy : *Pending*
`)
                .setColor(0x5865F2)
                .setFooter({ text: 'Zyro Post' })
                .setTimestamp();

            await interaction.editReply({ embeds: [loadingEmbed], components: [] });

            try {
                const token = AccountService.getDecryptedToken(account);
                const guilds = await WorkerService.fetchGuilds(token, accountId, interaction.user.id);
                
                const filtered = guilds.filter((g: WorkerGuild) => g.name.toLowerCase().includes(query)).slice(0, 25);

                if (filtered.length === 0) {
                    const noResultEmbed = new EmbedBuilder()
                        .setDescription(`
## 👑 **TASK SETUP** 👑
\u200b
**PROGRESS**
✅ Account : **${accountName}**
⚠️ Server : *No results for "${query}"*
⚪ Channel : *Pending*
⚪ Strategy : *Pending*
\u200b
> No servers found. Try a different search term.
`)
                        .setColor(0xED4245)
                        .setFooter({ text: 'Zyro Post' })
                        .setTimestamp();

                    // Add back the search button so user can try again
                    const retryRow = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            new ButtonBuilder().setCustomId(`btn_search_guild_${accountId}`).setLabel('Search Again').setStyle(ButtonStyle.Primary).setEmoji('🔍'),
                            new ButtonBuilder().setCustomId('btn_cancel_setup').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                        );

                    await interaction.editReply({ embeds: [noResultEmbed], components: [retryRow] });
                    return;
                }

                const select = new StringSelectMenuBuilder()
                    .setCustomId(`select_guild_task_${accountId}`)
                    .setPlaceholder('Select a server')
                    .addOptions(
                        filtered.map((g: WorkerGuild) => new StringSelectMenuOptionBuilder()
                            .setLabel(g.name.substring(0, 100))
                            .setValue(g.id)
                            .setDescription(`ID: ${g.id}`)
                        )
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
🔹 Search : **"${query}"** → Found **${filtered.length}** server${filtered.length > 1 ? 's' : ''}
`)
                    .setColor(0x57F287)
                    .setFooter({ text: 'Zyro Post' })
                    .setTimestamp();

                const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder().setCustomId(`btn_search_guild_${accountId}`).setLabel('Search Again').setStyle(ButtonStyle.Primary).setEmoji('🔍'),
                        new ButtonBuilder().setCustomId('btn_cancel_setup').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                    );

                await interaction.editReply({
                    embeds: [resultEmbed],
                    components: [
                        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
                        buttonRow
                    ]
                });

            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                await interaction.editReply({ content: `❌ Error fetching guilds: ${errorMessage}`, embeds: [], components: [] });
            }
        }

        // ==================== CREATE TASK MODAL (AUTO/MANUAL) ====================
        else if (customId.startsWith('modal_final_auto_') || customId.startsWith('modal_final_manual_')) {
            await interaction.deferUpdate();

            const isAuto = customId.startsWith('modal_final_auto_');
            const parts = customId.split('_');
            const accountId = parts[3];
            const guildId = parts[4];
            const channelId = parts[5];
            const slowmode = parseInt(parts[6]);

            const message = interaction.fields.getTextInputValue('message_content');
            let minDelay: number, maxDelay: number;

            if (isAuto) {
                // Auto delay: slowmode + 1-3 menit tambahan
                minDelay = (slowmode * 1000) + 60000; 
                maxDelay = (slowmode * 1000) + 180000;
            } else {
                // Manual delay: parse dari input user
                const delayRaw = interaction.fields.getTextInputValue('delay_range');
                const [minStr, maxStr] = delayRaw.split('-').map(s => s.trim());
                minDelay = parseInt(minStr) * 1000;
                maxDelay = parseInt(maxStr) * 1000;

                // Validasi format
                if (isNaN(minDelay) || isNaN(maxDelay)) {
                    await interaction.followUp({ content: '❌ Invalid delay format. Use format: min-max (e.g., 10-30)', flags: MessageFlags.Ephemeral });
                    return;
                }

                // Validasi: minimum delay 30 detik
                if (minDelay < MIN_DELAY_MS) {
                    await interaction.followUp({ content: '❌ **Invalid!** Min delay must be at least 30 seconds for account safety.', flags: MessageFlags.Ephemeral });
                    return;
                }

                // Validasi: minDelay harus >= slowmode
                if (minDelay < slowmode * 1000) {
                    await interaction.followUp({ content: `❌ **Unsafe!** Min delay must be >= ${slowmode}s (channel slowmode).`, flags: MessageFlags.Ephemeral });
                    return;
                }

                // Validasi: minDelay tidak boleh > maxDelay
                if (minDelay > maxDelay) {
                    await interaction.followUp({ content: '❌ **Invalid!** Min delay cannot be greater than max delay.', flags: MessageFlags.Ephemeral });
                    return;
                }

                // Validasi: maxDelay tidak boleh melebihi 24 jam
                if (maxDelay > MAX_DELAY_MS) {
                    await interaction.followUp({ content: '❌ **Invalid!** Max delay cannot exceed 24 hours (86400 seconds).', flags: MessageFlags.Ephemeral });
                    return;
                }
            }

            // Validation for Max Length
            if (message.length > 4000) {
                await interaction.editReply({ content: `❌ **Message Too Long!**\nMax limit is 4000 characters.`, components: [], embeds: [] });
                return;
            }

            // Warning for Raw Emoji Aliases
            const emojiAliasRegex = /(?<!<a?):[\w]+:(?!(\d+>))/g;
            const potentialRawEmojis = message.match(emojiAliasRegex);
            let warningMsg = '';
            
            if (potentialRawEmojis && potentialRawEmojis.length > 0) {
                warningMsg = `\n\n⚠️ **Warning:** I detected potential raw emoji names (e.g. ${potentialRawEmojis[0]}).\nMake sure to use the full emoji code \`<:name:id>\` if you want them to appear as images!`;
            }

            // Fetch Real Names for DB
            let guildName = 'Unknown Server';
            let channelName = 'Unknown Channel';
            
            try {
                const account = await AccountService.getById(accountId);
                if (account) {
                    const token = decrypt(account.token);
                    const context = await WorkerService.fetchContext(token, guildId, channelId, accountId, interaction.user.id);
                    guildName = context.guildName;
                    channelName = context.channelName;
                }
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                Logger.warn('Failed to fetch context for DB save', errorMessage);
            }

            const newTask = await TaskService.create({
                accountId,
                guildId,
                guildName,
                channelId,
                channelName,
                channelSlowmode: slowmode,
                message,
                minDelay,
                maxDelay,
                dynamicDelay: isAuto
            });

            const panel = renderTaskPanel(newTask);
            await interaction.editReply({ 
                content: `✅ **Task Configured!**\nUse the buttons below to start the process.${warningMsg}`, 
                embeds: [panel.embed],
                components: [panel.row, panel.editRow]
            });
        }

        // ==================== EDIT MESSAGE MODAL ====================
        else if (customId.startsWith('modal_edit_msg_')) {
            const taskId = customId.replace('modal_edit_msg_', '');
            await interaction.deferUpdate();

            const newMessage = interaction.fields.getTextInputValue('new_message');
            
            // Check for raw emojis in edit too
            const emojiAliasRegex = /(?<!<a?):[\w]+:(?!(\d+>))/g;
            const potentialRawEmojis = newMessage.match(emojiAliasRegex);
            let warningMsg = '';
            
            if (potentialRawEmojis && potentialRawEmojis.length > 0) {
                warningMsg = `\n\n⚠️ **Warning:** Raw emoji names detected. Use \`<:name:id>\` for images.`;
            }

            // Update DB
            await TaskService.update(taskId, { message: newMessage });

            // Restart Worker if running
            const task = await TaskService.getById(taskId);
            if (task && task.status === 'RUNNING') {
                await WorkerService.stopTask(interaction.client, taskId);
                await WorkerService.startTask(interaction.client, taskId);
            }

            if (task) {
                const panel = renderTaskPanel({ ...task, message: newMessage });
                await interaction.editReply({ 
                    content: `✅ **Message Updated!**${warningMsg}`, 
                    components: [panel.row, panel.editRow], 
                    embeds: [panel.embed] 
                });
            }
        }

        // ==================== EDIT DELAY MODAL ====================
        else if (customId.startsWith('modal_edit_delay_')) {
            const taskId = customId.replace('modal_edit_delay_', '');
            await interaction.deferUpdate();

            const delayRaw = interaction.fields.getTextInputValue('new_delay');
            const [minStr, maxStr] = delayRaw.split('-').map(s => s.trim());
            const minDelay = parseInt(minStr) * 1000;
            const maxDelay = parseInt(maxStr) * 1000;

            // Validasi format
            if (isNaN(minDelay) || isNaN(maxDelay)) {
                await interaction.followUp({ content: '❌ Invalid delay format. Use format: min-max (e.g., 10-30)', flags: MessageFlags.Ephemeral });
                return;
            }

            // Validasi: minDelay tidak boleh > maxDelay
            if (minDelay > maxDelay) {
                await interaction.followUp({ content: '❌ **Invalid!** Min delay cannot be greater than max delay.', flags: MessageFlags.Ephemeral });
                return;
            }

            // Validasi: maxDelay tidak boleh melebihi 24 jam
            if (maxDelay > MAX_DELAY_MS) {
                await interaction.followUp({ content: '❌ **Invalid!** Max delay cannot exceed 24 hours (86400 seconds).', flags: MessageFlags.Ephemeral });
                return;
            }

            // Validasi: minimum delay 30 detik
            if (minDelay < MIN_DELAY_MS) {
                await interaction.followUp({ content: '❌ **Invalid!** Min delay must be at least 30 seconds.', flags: MessageFlags.Ephemeral });
                return;
            }

            // Get task to check channel slowmode
            const existingTask = await TaskService.getById(taskId);
            if (existingTask && existingTask.channelSlowmode) {
                const slowmodeMs = existingTask.channelSlowmode * 1000;
                if (minDelay < slowmodeMs) {
                    await interaction.followUp({ 
                        content: `❌ **Unsafe!** Min delay must be >= ${existingTask.channelSlowmode}s (channel slowmode).`, 
                        flags: MessageFlags.Ephemeral 
                    });
                    return;
                }
            }

            // Update DB
            await TaskService.update(taskId, { minDelay, maxDelay, dynamicDelay: false });

            // Restart Worker if running
            const task = await TaskService.getById(taskId);
            if (task && task.status === 'RUNNING') {
                await WorkerService.stopTask(interaction.client, taskId);
                await WorkerService.startTask(interaction.client, taskId);
            }

            if (task) {
                const updatedTask = { ...task, minDelay, maxDelay };
                const panel = renderTaskPanel(updatedTask);
                await interaction.editReply({ 
                    content: `✅ **Delay Updated!** (${minStr}-${maxStr}s)`, 
                    components: [panel.row, panel.editRow], 
                    embeds: [panel.embed] 
                });
            }
        } 
        
        // ==================== UPDATE TOKEN MODAL ====================
        else if (customId.startsWith('modal_update_token_')) {
            const accountId = customId.replace('modal_update_token_', '');
            const rawNewToken = interaction.fields.getTextInputValue('new_token_input');
            const cleanNewToken = sanitizeToken(rawNewToken);
            
            await interaction.deferUpdate();
            
            // Validate new token
            const discordUser = await validateToken(cleanNewToken);
            if (!discordUser) {
                await interaction.followUp({ 
                    content: '❌ Invalid token. Please check and try again.', 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }
            
            // Update in database (encrypted)
            await AccountService.updateToken(accountId, cleanNewToken, discordUser.username, discordUser.avatar);
            
            // Refresh embed in SAME message with new status
            const view = await renderAccountDetail(accountId, { 
                isValid: true, 
                username: discordUser.username 
            });
            
            await interaction.editReply({ ...view } as any);
        }
        
        // ==================== UNKNOWN MODAL ====================
        else {
            Logger.warn(`Unhandled modal customId: ${customId}`, 'ModalHandler');
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ Unknown action.', flags: MessageFlags.Ephemeral });
            }
        }

    } catch (error) {
        Logger.error('Modal Handler Error', error, 'ModalHandler');
        
        // Fallback error response
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred while processing your request.', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.followUp({ content: '❌ An error occurred while processing your request.', flags: MessageFlags.Ephemeral });
            }
        } catch (e) {
            // Ignore if we can't send error message
        }
    }
}
