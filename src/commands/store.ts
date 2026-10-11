import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { Command } from '../interfaces/command';
import { config } from '../config';
import { renderStore } from '../views/store.view';

export const storeCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('deploy-store')
        .setDescription('Deploy the Premium Store Panel (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: async (interaction) => {
        if (interaction.user.id !== config.adminId) {
            await interaction.reply({ content: '⛔ Admin only.', flags: MessageFlags.Ephemeral });
            return;
        }
    
        const storeView = renderStore();
        
        // We send to channel, not reply, so it stays
        if (interaction.channel && interaction.channel.isSendable()) {
            await interaction.channel.send({
                flags: (storeView as any).flags,
                components: (storeView as any).components,
                embeds: []
            } as any);
            await interaction.reply({ content: '✅ Store Deployed!', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: '❌ Cannot send messages here.', flags: MessageFlags.Ephemeral });
        }
    }
};
