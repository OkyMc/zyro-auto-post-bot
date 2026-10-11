import { SlashCommandBuilder, MessageFlags, GuildMember } from 'discord.js';
import { Command } from '../interfaces/command';
import { WorkspaceService } from '../services/workspace.service';
import { config } from '../config';
import prisma from '../database/client';
import { Logger } from '../utils/logger';

export const workspaceCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('workspace')
        .setDescription('Manage or access Zyro Post workspaces')
        .addSubcommand(sub =>
            sub.setName('open')
               .setDescription('Buka atau minta pembuatan workspace privat kamu')
        )
        .addSubcommand(sub =>
            sub.setName('approve')
               .setDescription('Admin: Setujui workspace user dan aktifkan durasi langganan')
               .addUserOption(opt => opt.setName('target').setDescription('User yang ingin diapprove').setRequired(true))
               .addIntegerOption(opt => opt.setName('days').setDescription('Jumlah hari aktif (default: 30)').setRequired(false).setMinValue(1))
        ),

    execute: async (interaction) => {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const targetGuildId = config.guildId || interaction.guildId;
            if (!targetGuildId) {
                await interaction.editReply({ content: '❌ `GUILD_ID` belum disetting di `.env`.' });
                return;
            }

            const subcommand = interaction.options.getSubcommand(false) || 'open';

            // ==================== SUBCOMMAND: APPROVE (ADMIN ONLY) ====================
            if (subcommand === 'approve') {
                const member = interaction.member as GuildMember | null;
                const isAdmin = (member && config.adminRoleId && member.roles.cache.has(config.adminRoleId)) || interaction.user.id === config.adminId;

                if (!isAdmin) {
                    await interaction.editReply({ content: '⛔ **Akses Ditolak!** Hanya Admin yang dapat menjalankan command `/workspace approve`.' });
                    return;
                }

                const targetUser = interaction.options.getUser('target', true);
                const days = interaction.options.getInteger('days') || 30;

                const newExpiry = await WorkspaceService.approveWorkspace(
                    interaction.client,
                    targetGuildId,
                    targetUser.id,
                    days,
                    interaction.user.tag
                );

                await interaction.editReply({
                    content: `✅ **Workspace Approved!**\nUser: <@${targetUser.id}> (${targetUser.tag})\nDurasi: **+${days} Hari**\nAktif Hingga: \`${newExpiry.toLocaleString('id-ID')}\` 🚀`
                });
                return;
            }

            // ==================== SUBCOMMAND: OPEN (USER WORKSPACE) ====================
            const userId = interaction.user.id;
            const user = await prisma.user.findUnique({ where: { id: userId } });

            if (user?.workspaceChannelId) {
                const guild = interaction.client.guilds.cache.get(targetGuildId);
                const existingChannel = guild?.channels.cache.get(user.workspaceChannelId);

                if (existingChannel) {
                    await interaction.editReply({
                        content: `✅ **Workspace Kamu:** <#${existingChannel.id}>\nSilakan buka channel privat kamu untuk kontrol akun & task!`
                    });
                    return;
                }
            }

            // Buat pending workspace
            const channel = await WorkspaceService.createPendingWorkspace(
                interaction.client,
                targetGuildId,
                userId,
                '7_DAYS'
            );

            await interaction.editReply({
                content: `🎉 **Workspace Berhasil Disiapkan!**\nChannel privat kamu: <#${channel?.id}>. Silakan buka channel tersebut untuk menyelesaikan pembayaran dan approval admin! 🔥`
            });

        } catch (error: any) {
            Logger.error('Failed to execute /workspace command', error, 'WorkspaceCommand');
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    }
};
