import { SlashCommandBuilder, PermissionFlagsBits, GuildMember, MessageFlags } from 'discord.js';
import { Command } from '../interfaces/command';
import { AdminService } from '../services/admin.service';
import { config } from '../config';
import { EmbedBuilder } from 'discord.js';
import { renderStats } from '../views/stats.view';
import { renderTutorialMenu } from '../views/tutorial.view';
import { Logger } from '../utils/logger';

export const adminCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Administrator Tools')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => 
            sub.setName('tutorial')
               .setDescription('Deploy How-to-Get-Token Tutorial')
        )
        .addSubcommand(sub => 
            sub.setName('stats')
               .setDescription('View system statistics')
        )
        .addSubcommand(sub => 
            sub.setName('user_info')
               .setDescription('Get detailed user information')
               .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('add_time')
               .setDescription('Add subscription time to a user')
               .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
               .addIntegerOption(opt => opt.setName('days').setDescription('Days to add').setRequired(false).setMinValue(0))
               .addIntegerOption(opt => opt.setName('hours').setDescription('Hours to add').setRequired(false).setMinValue(0))
               .addIntegerOption(opt => opt.setName('minutes').setDescription('Minutes to add').setRequired(false).setMinValue(0))
        )
        .addSubcommand(sub => 
            sub.setName('remove_time')
               .setDescription('Remove subscription time from a user')
               .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
               .addIntegerOption(opt => opt.setName('days').setDescription('Days to remove').setRequired(false).setMinValue(0))
               .addIntegerOption(opt => opt.setName('hours').setDescription('Hours to remove').setRequired(false).setMinValue(0))
               .addIntegerOption(opt => opt.setName('minutes').setDescription('Minutes to remove').setRequired(false).setMinValue(0))
        )
        .addSubcommand(sub => 
            sub.setName('approve')
               .setDescription('Setujui workspace user dan aktifkan durasi langganan')
               .addUserOption(opt => opt.setName('target').setDescription('User yang ingin diapprove').setRequired(true))
               .addIntegerOption(opt => opt.setName('days').setDescription('Jumlah hari aktif (default: 30)').setRequired(false).setMinValue(1))
        )
        .addSubcommand(sub => 
            sub.setName('delete_workspace')
               .setDescription('Force delete a user workspace')
               .addUserOption(opt => opt.setName('target').setDescription('The user').setRequired(true))
        ),

    execute: async (interaction) => {
        // 1. Verify Role
        const member = interaction.member as GuildMember | null;
        const isAdmin = member && config.adminRoleId && member.roles.cache.has(config.adminRoleId);
        
        // Allow Owner (ADMIN_ID) or Role
        if (interaction.user.id !== config.adminId && !isAdmin) {
            await interaction.reply({ content: '⛔ Access Denied.', flags: MessageFlags.Ephemeral });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'tutorial') {
                const view = renderTutorialMenu();
                // Send to channel so it stays
                if (interaction.channel && interaction.channel.isSendable()) {
                    await interaction.channel.send({ embeds: view.embeds, components: view.components });
                    await interaction.reply({ content: '✅ Tutorial Deployed!', flags: MessageFlags.Ephemeral });
                } else {
                    await interaction.reply({ content: '❌ Cannot send messages here.', flags: MessageFlags.Ephemeral });
                }
            }

            else if (subcommand === 'stats') {
                const statsView = await renderStats();
                await interaction.reply({
                    flags: (statsView as any).flags || MessageFlags.Ephemeral,
                    components: (statsView as any).components,
                    embeds: []
                } as any);
            }

            else if (subcommand === 'user_info') {
                const targetUser = interaction.options.getUser('target', true);
                const userInfo = await AdminService.getUserInfo(targetUser.id);

                if (!userInfo) {
                    await interaction.reply({ content: 'User not found in database.', flags: MessageFlags.Ephemeral });
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle(`User Info: ${userInfo.username || 'Unknown'}`)
                    .addFields(
                        { name: 'ID', value: userInfo.id, inline: true },
                        { name: 'Expiry', value: userInfo.expiryDate ? userInfo.expiryDate.toLocaleString() : 'Expired/None', inline: true },
                        { name: 'Accounts', value: userInfo._count.accounts.toString(), inline: true }
                    );
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            else if (subcommand === 'add_time') {
                const targetUser = interaction.options.getUser('target', true);
                const days = interaction.options.getInteger('days') || 0;
                const hours = interaction.options.getInteger('hours') || 0;
                const minutes = interaction.options.getInteger('minutes') || 0;

                if (days === 0 && hours === 0 && minutes === 0) {
                    await interaction.reply({ content: '❌ Please specify at least days, hours, or minutes.', flags: MessageFlags.Ephemeral });
                    return;
                }
                
                await AdminService.addTime(targetUser.id, days, hours, minutes, interaction.client);
                await interaction.reply({ content: `✅ Added **${days}d ${hours}h ${minutes}m** to ${targetUser.username}. Workspace updated.`, flags: MessageFlags.Ephemeral });
            }

            else if (subcommand === 'remove_time') {
                const targetUser = interaction.options.getUser('target', true);
                const days = interaction.options.getInteger('days') || 0;
                const hours = interaction.options.getInteger('hours') || 0;
                const minutes = interaction.options.getInteger('minutes') || 0;
                
                if (days === 0 && hours === 0 && minutes === 0) {
                    await interaction.reply({ content: '❌ Please specify at least days, hours, or minutes.', flags: MessageFlags.Ephemeral });
                    return;
                }

                await AdminService.removeTime(targetUser.id, days, hours, minutes, interaction.client);
                await interaction.reply({ content: `✅ Removed **${days}d ${hours}h ${minutes}m** from ${targetUser.username}. Workspace updated.`, flags: MessageFlags.Ephemeral });
            }

            else if (subcommand === 'approve') {
                const targetUser = interaction.options.getUser('target', true);
                const days = interaction.options.getInteger('days') || 30;

                const { WorkspaceService } = require('../services/workspace.service');
                const newExpiry = await WorkspaceService.approveWorkspace(
                    interaction.client,
                    config.guildId || interaction.guildId || '',
                    targetUser.id,
                    days,
                    interaction.user.tag
                );

                await interaction.reply({
                    content: `✅ **Workspace Approved!**\nUser: <@${targetUser.id}> (${targetUser.tag})\nDurasi: **+${days} Hari**\nAktif Hingga: \`${newExpiry.toLocaleString('id-ID')}\` 🚀`,
                    flags: MessageFlags.Ephemeral
                });
            }

            else if (subcommand === 'delete_workspace') {
                const targetUser = interaction.options.getUser('target', true);
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                
                await AdminService.deleteWorkspace(targetUser.id, interaction.client);
                
                try {
                    await interaction.editReply(`🗑️ Workspace for ${targetUser.username} has been deleted.`);
                } catch (e) {
                    // Channel likely deleted, ignore error
                }
            }

        } catch (error: any) {
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply({ content: `❌ Error: ${error.message}` });
                } else {
                    await interaction.reply({ content: `❌ Error: ${error.message}`, flags: MessageFlags.Ephemeral });
                }
            } catch (e) {
                Logger.error('Failed to send error response', e, 'AdminCommand');
            }
        }
    }
};