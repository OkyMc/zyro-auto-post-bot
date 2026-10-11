import fs from 'fs';
import path from 'path';
import { Client, Message, Interaction } from 'discord.js';
import { Logger } from '../utils/logger';

export interface PostSuccessEvent {
    task: any;
    account: any;
    channelId: string;
    messageContent: string;
    sentAt: Date;
}

export interface PostFailedEvent {
    task: any;
    account: any;
    channelId: string;
    error: any;
    failedAt: Date;
}

export interface PaymentApprovedEvent {
    payment: any;
    user: any;
}

export interface ZyroPlugin {
    name: string;
    version?: string;
    author?: string;
    description?: string;
    init?(context: PluginContext): Promise<void> | void;
    onBotReady?(client: Client): Promise<void> | void;
    onPostSuccess?(event: PostSuccessEvent): Promise<void> | void;
    onPostFailed?(event: PostFailedEvent): Promise<void> | void;
    onPaymentApproved?(event: PaymentApprovedEvent): Promise<void> | void;
    onMessageCreate?(message: Message): Promise<void> | void;
    onInteractionCreate?(interaction: Interaction): Promise<void> | void;
}

export interface PluginContext {
    logger: typeof Logger;
    registerViewOverride: (viewName: string, renderer: Function) => void;
}

export class PluginService {
    private static plugins: ZyroPlugin[] = [];
    private static viewOverrides: Map<string, Function> = new Map();
    private static customDir = path.join(process.cwd(), 'custom');
    private static pluginsDir = path.join(process.cwd(), 'custom', 'plugins');

    public static async init(): Promise<void> {
        this.ensureCustomFolders();
        await this.loadPlugins();
    }

    private static ensureCustomFolders(): void {
        try {
            if (!fs.existsSync(this.customDir)) {
                fs.mkdirSync(this.customDir, { recursive: true });
            }
            if (!fs.existsSync(this.pluginsDir)) {
                fs.mkdirSync(this.pluginsDir, { recursive: true });
            }

            // Buat sample plugin jika kosong
            const samplePluginPath = path.join(this.pluginsDir, 'sample-webhook-logger.plugin.js');
            if (!fs.existsSync(samplePluginPath)) {
                const sampleContent = `/**
 * 🚀 Zyro Post - Custom Plugin Example
 * User can modify or add their own custom logic here!
 */

module.exports = {
    name: 'SampleLoggerPlugin',
    version: '1.0.0',
    description: 'Example plugin to hook into bot auto-post events',

    init(context) {
        context.logger.info('SampleLoggerPlugin initialized! You can customize this plugin in custom/plugins/', 'Plugin');
    },

    onBotReady(client) {
        // Called when bot successfully connects to Discord
        // context.logger.info(\`Bot is ready as \${client.user.tag}\`, 'Plugin');
    },

    onPostSuccess(event) {
        // Called whenever a selfbot successfully broadcasts a message
        // You can send a webhook to your own Discord or Telegram here!
        // console.log('[Plugin Hook] Message sent to channel:', event.channelId);
    },

    onPostFailed(event) {
        // Called when a post encounters an error or rate limit
    }
};
`;
                fs.writeFileSync(samplePluginPath, sampleContent, 'utf-8');
            }
        } catch (err: any) {
            Logger.warn(`Failed to initialize custom plugins directory: ${err.message}`, 'PluginService');
        }
    }

    public static async loadPlugins(): Promise<void> {
        this.plugins = [];
        try {
            if (!fs.existsSync(this.pluginsDir)) return;

            const files = fs.readdirSync(this.pluginsDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));

            for (const file of files) {
                const pluginPath = path.join(this.pluginsDir, file);
                try {
                    delete require.cache[require.resolve(pluginPath)];
                    const pluginModule = require(pluginPath);
                    const plugin: ZyroPlugin = pluginModule.default || pluginModule;

                    if (plugin && plugin.name) {
                        if (typeof plugin.init === 'function') {
                            await plugin.init({
                                logger: Logger,
                                registerViewOverride: this.registerViewOverride.bind(this)
                            });
                        }
                        this.plugins.push(plugin);
                        Logger.info(`Loaded custom plugin: ${plugin.name} v${plugin.version || '1.0'} (${file})`, 'PluginService');
                    }
                } catch (err: any) {
                    Logger.error(`Failed to load plugin ${file}`, err, 'PluginService');
                }
            }
        } catch (err: any) {
            Logger.error('Error reading plugins directory', err, 'PluginService');
        }
    }

    public static registerViewOverride(viewName: string, renderer: Function): void {
        this.viewOverrides.set(viewName, renderer);
        Logger.info(`View override registered for: ${viewName}`, 'PluginService');
    }

    public static getViewOverride(viewName: string): Function | undefined {
        return this.viewOverrides.get(viewName);
    }

    // Lifecycle triggers
    public static async triggerOnBotReady(client: Client): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.onBotReady === 'function') {
                try {
                    await plugin.onBotReady(client);
                } catch (e: any) {
                    Logger.error(`Error in plugin ${plugin.name}.onBotReady`, e, 'PluginService');
                }
            }
        }
    }

    public static async triggerOnPostSuccess(event: PostSuccessEvent): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.onPostSuccess === 'function') {
                try {
                    await plugin.onPostSuccess(event);
                } catch (e: any) {
                    Logger.error(`Error in plugin ${plugin.name}.onPostSuccess`, e, 'PluginService');
                }
            }
        }
    }

    public static async triggerOnPostFailed(event: PostFailedEvent): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.onPostFailed === 'function') {
                try {
                    await plugin.onPostFailed(event);
                } catch (e: any) {
                    Logger.error(`Error in plugin ${plugin.name}.onPostFailed`, e, 'PluginService');
                }
            }
        }
    }

    public static async triggerOnPaymentApproved(event: PaymentApprovedEvent): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.onPaymentApproved === 'function') {
                try {
                    await plugin.onPaymentApproved(event);
                } catch (e: any) {
                    Logger.error(`Error in plugin ${plugin.name}.onPaymentApproved`, e, 'PluginService');
                }
            }
        }
    }

    public static async triggerOnMessage(message: Message): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.onMessageCreate === 'function') {
                try {
                    await plugin.onMessageCreate(message);
                } catch (e: any) {
                    Logger.error(`Error in plugin ${plugin.name}.onMessageCreate`, e, 'PluginService');
                }
            }
        }
    }

    public static async triggerOnInteraction(interaction: Interaction): Promise<void> {
        for (const plugin of this.plugins) {
            if (typeof plugin.onInteractionCreate === 'function') {
                try {
                    await plugin.onInteractionCreate(interaction);
                } catch (e: any) {
                    Logger.error(`Error in plugin ${plugin.name}.onInteractionCreate`, e, 'PluginService');
                }
            }
        }
    }
}
