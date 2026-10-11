import prisma from '../database/client';
import { WorkspaceService } from './workspace.service';
import { Logger } from '../utils/logger';
import { Client } from 'discord.js';
import { config } from '../config';

export class AdminService {
    
    static async getStats() {
        const totalUsers = await prisma.user.count();
        const totalAccounts = await prisma.account.count();
        const activeTasks = await prisma.task.count({ where: { status: 'RUNNING' } });
        const totalPayments = await prisma.payment.count({ where: { status: 'PAID' } });
        
        // Aggregate Total Messages
        const msgStats = await prisma.task.aggregate({ _sum: { totalSent: true } });
        const totalMessagesSent = msgStats._sum.totalSent || 0;

        // Calculate total revenue (Assuming amount is in Payment table)
        const payments = await prisma.payment.findMany({ where: { status: 'PAID' } });
        const revenue = payments.reduce((acc, curr) => acc + curr.amount, 0);

        return {
            totalUsers,
            totalAccounts,
            activeTasks,
            totalMessagesSent,
            totalPayments,
            revenue
        };
    }

    static async getUserInfo(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            include: {
                accounts: true,
                _count: {
                    select: { accounts: true, payments: true }
                }
            }
        });
    }

    static async getUserControlPanelData(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                accounts: true
            }
        });

        if (!user) throw new Error('User not found');

        const accountCount = user.accounts.length;
        const activeTaskCount = await prisma.task.count({
            where: {
                account: { userId },
                status: 'RUNNING'
            }
        });

        // Aggregate Total Messages for this user
        const msgStats = await prisma.task.aggregate({
            where: { account: { userId } },
            _sum: { totalSent: true }
        });
        const totalMessagesSent = msgStats._sum.totalSent || 0;

        return {
            user,
            accountCount,
            activeTaskCount,
            totalMessagesSent
        };
    }

    static async addTime(userId: string, days: number, hours: number = 0, minutes: number = 0, client?: Client) {
        let user = await prisma.user.findUnique({ where: { id: userId } });
        const now = new Date();
        let newExpiry = user?.expiryDate && user.expiryDate > now ? new Date(user.expiryDate) : new Date(now);
        
        const durationMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
        newExpiry.setTime(newExpiry.getTime() + durationMs);

        const updatedUser = await prisma.user.upsert({
            where: { id: userId },
            update: { expiryDate: newExpiry },
            create: {
                id: userId,
                expiryDate: newExpiry
            }
        });

        if (client && config.guildId) {
            if (!updatedUser.workspaceChannelId) {
                try {
                    await WorkspaceService.createWorkspace(client, config.guildId, userId);
                } catch (wsErr) {
                    Logger.error('Failed to auto create workspace on addTime', wsErr, 'AdminService');
                }
            } else {
                await WorkspaceService.refreshControlPanel(client, userId);
            }
        }

        return updatedUser;
    }

    static async removeTime(userId: string, days: number, hours: number = 0, minutes: number = 0, client?: Client) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.expiryDate) throw new Error('User has no active subscription');

        const newExpiry = new Date(user.expiryDate);
        const durationMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
        newExpiry.setTime(newExpiry.getTime() - durationMs);

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { expiryDate: newExpiry }
        });

        if (client) {
            await WorkspaceService.refreshControlPanel(client, userId);
        }

        return updatedUser;
    }

    static async deleteWorkspace(userId: string, client: any) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.workspaceChannelId) throw new Error('User has no workspace');

        // 1. Delete Channel
        try {
            const channel = await client.channels.fetch(user.workspaceChannelId);
            if (channel) await channel.delete();
        } catch (e) {
            Logger.warn('Failed to delete channel (might already be deleted)', 'AdminService');
        }

        // 2. Update DB
        return prisma.user.update({
            where: { id: userId },
            data: {
                workspaceChannelId: null,
                logThreadId: null
            }
        });
    }
}
