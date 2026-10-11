import { Interaction, MessageFlags, GuildMember, PermissionFlagsBits } from 'discord.js';
import prisma from '../database/client';
import { Logger } from './logger';
import { config } from '../config';

export async function validateOwnership(interaction: Interaction): Promise<boolean> {
    if (!interaction.isRepliable()) return false;

    // 1. Allow Public Interactions & Admin Action Buttons
    // We check customId if available (Buttons, Modals, Selects)
    const customId = (interaction as any).customId;
    if (customId && (
        customId.startsWith('btn_buy_') || 
        customId === 'btn_view_terms' || 
        customId === 'btn_view_tutorial' || 
        customId.startsWith('btn_tutorial_') ||
        customId.startsWith('btn_admin_') ||
        customId === 'btn_order' ||
        customId.startsWith('btn_confirm_buy_') ||
        customId === 'select_order_plan' ||
        customId.startsWith('btn_check_payment_') ||
        customId.startsWith('btn_cancel_payment_')
    )) {
        return true;
    }

    // 2. Check if current channel is a Workspace
    const channelId = interaction.channelId;
    if (!channelId) return false; // Fail-closed: deny access if channelId is missing

    try {
        // Find user who owns this workspace channel
        const workspaceOwner = await prisma.user.findFirst({
            where: { workspaceChannelId: channelId }
        });

        // If this is NOT a workspace channel, block dashboard buttons
        if (!workspaceOwner) {
            if (customId && (customId.startsWith('btn_add_') || customId.startsWith('btn_setup_') || customId.startsWith('btn_view_') || customId.startsWith('btn_manage_') || customId.startsWith('btn_stop_'))) {
                await interaction.reply({ content: '❌ This command can only be used inside a Workspace.', flags: MessageFlags.Ephemeral });
                return false;
            }
            return true; // Allow other interactions in public channels
        }

        // 3. Verify Ownership or Admin Override
        const member = interaction.member as GuildMember | null;
        const isAdmin = interaction.user.id === config.adminId || 
                        (member && config.adminRoleId && member.roles.cache?.has(config.adminRoleId)) ||
                        (member && member.permissions?.has(PermissionFlagsBits.Administrator));

        if (isAdmin) {
            return true; // Admin has full access to manage or interact
        }

        if (workspaceOwner.id !== interaction.user.id) {
            Logger.warn(`Access Denied: User ${interaction.user.id} tried to use workspace of ${workspaceOwner.id}`);
            await interaction.reply({ 
                content: '⛔ **Access Denied**\nThis dashboard belongs to another user.\nYou cannot interact with it.', 
                flags: MessageFlags.Ephemeral 
            });
            return false;
        }

        return true;

    } catch (error) {
        Logger.error('Interaction Guard Error', error);
        return false; // Fail safe
    }
}

export async function validateActiveSubscription(userId: string): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return false;
        
        // If expiryDate is present and in the past, return false (Expired)
        if (user.expiryDate && new Date() > user.expiryDate) {
            return false;
        }
        
        return true;
    } catch (error) {
        Logger.error('Subscription Validation Error', error);
        return false; // Fail safe
    }
}
