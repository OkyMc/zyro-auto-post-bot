import { Message } from 'discord.js';
import { config } from '../config';
import { renderStore } from '../views/store.view';
import { PluginService } from '../services/plugin.service';
import { Logger } from '../utils/logger';

export async function onMessageCreate(message: Message) {
    try {
        if (message.content === '!deploy-store' && message.author.id === config.adminId) {
            if (message.channel.isSendable()) {
                const storeView = renderStore();
                await message.channel.send({
                    flags: (storeView as any).flags,
                    components: (storeView as any).components,
                    embeds: []
                } as any);
                await message.delete();
            }
        }

        // Trigger custom plugin message hooks
        await PluginService.triggerOnMessage(message);
    } catch (error) {
        Logger.error('Message Handler Error', error, 'MessageHandler');
    }
}
