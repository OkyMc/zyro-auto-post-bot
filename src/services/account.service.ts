import { Account } from '@prisma/client';
import prisma from '../database/client';
import { encrypt, decrypt, sanitizeToken } from '../utils/security';
import { Logger } from '../utils/logger';
import { WorkerService } from './worker.service';

export class AccountService {
    static async create(userId: string, name: string, token: string, avatar: string) {
        try {
            const cleanToken = sanitizeToken(token);
            const encryptedToken = encrypt(cleanToken);
            const account = await prisma.account.create({
                data: {
                    userId,
                    token: encryptedToken,
                    name,
                    avatar
                }
            });
            Logger.info(`Account created for user ${userId}`, 'AccountService');
            return account;
        } catch (error) {
            Logger.error('Failed to create account', error, 'AccountService');
            throw error;
        }
    }

    static async getById(accountId: string) {
        try {
            return await prisma.account.findUnique({ where: { id: accountId } });
        } catch (error) {
            Logger.error('Failed to fetch account by ID', error, 'AccountService');
            throw error;
        }
    }

    static async getByUserId(userId: string) {
        try {
            return await prisma.account.findMany({ where: { userId } });
        } catch (error) {
            Logger.error('Failed to fetch accounts by UserID', error, 'AccountService');
            throw error;
        }
    }

    static getDecryptedToken(account: Account): string {
        return sanitizeToken(decrypt(account.token));
    }

    static async delete(accountId: string) {
        try {
            // Ensure worker is killed before deletion
            await WorkerService.terminateAccount(accountId);
            
            await prisma.account.delete({ where: { id: accountId } });
            Logger.info(`Account ${accountId} deleted`, 'AccountService');
        } catch (error) {
            Logger.error('Failed to delete account', error, 'AccountService');
            throw error;
        }
    }

    static async updateToken(accountId: string, newToken: string, name?: string, avatar?: string) {
        try {
            const cleanToken = sanitizeToken(newToken);
            const encryptedToken = encrypt(cleanToken);
            const account = await prisma.account.update({
                where: { id: accountId },
                data: { 
                    token: encryptedToken,
                    name: name || undefined,
                    avatar: avatar || undefined
                }
            });
            Logger.info(`Token updated for account ${accountId}`, 'AccountService');
            return account;
        } catch (error) {
            Logger.error('Failed to update token', error, 'AccountService');
            throw error;
        }
    }
}
