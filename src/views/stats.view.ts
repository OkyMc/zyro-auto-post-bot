import { AdminService } from '../services/admin.service';
import { Logger } from '../utils/logger';
import { ThemeService } from '../config/theme.config';
import { PluginService } from '../services/plugin.service';

export async function renderStats() {
    try {
        const customRenderer = PluginService.getViewOverride('stats');
        if (customRenderer) {
            return await customRenderer();
        }

        const theme = ThemeService.getTheme();
        const stats = await AdminService.getStats();
        const now = Math.floor(Date.now() / 1000);

        const contentStats = `- Users : **${stats.totalUsers.toLocaleString()}**\n- Accounts : **${stats.totalAccounts.toLocaleString()}**\n- Workers : **${stats.activeTasks.toLocaleString()}**\n- MSG Sent : **${stats.totalMessagesSent.toLocaleString()}**\n\n-# Last Update [ <t:${now}:R> ]`;

        return {
            flags: 32768,
            embeds: [],
            components: [
                {
                    type: 17,
                    components: [
                        {
                            type: 12,
                            items: [
                                {
                                    media: {
                                        url: theme.branding.bannerUrl || "https://media.discordapp.net/attachments/1467178310210425016/1538633232294088856/standard.gif?ex=6a83635d&is=6a8211dd&hm=a5af81d93cd4d3bfdb5ea3b06f076bccb25300b97b76935b0b41e2f5cb8d1493&="
                                    }
                                }
                            ]
                        },
                        {
                            type: 14,
                            spacing: 1,
                            divider: true
                        },
                        {
                            type: 9,
                            components: [
                                {
                                    type: 10,
                                    content: contentStats
                                }
                            ],
                            accessory: {
                                type: 11,
                                media: {
                                    url: theme.branding.logoUrl || "https://media.discordapp.net/attachments/1467178310210425016/1538630569464963072/imresizer-ChatGPTImage10Mei2026031102-min.png?ex=6a8360e2&is=6a820f62&hm=982c0a5975b9b55d842bead57d22c74d9283919c9034693f2f3fcc44218ea964&=&format=webp&quality=lossless&width=1024&height=1024"
                                }
                            }
                        },
                        {
                            type: 14,
                            spacing: 1,
                            divider: true
                        },
                        {
                            type: 10,
                            content: `\n-# <:zyro:1513003016746176583> ${theme.branding.footerText} [ 2026 ]`
                        }
                    ]
                }
            ]
        };
    } catch (error) {
        Logger.error('Failed to render stats', error, 'StatsView');
        return {
            flags: 0,
            content: '❌ Failed to load statistics.',
            embeds: [],
            components: []
        };
    }
}