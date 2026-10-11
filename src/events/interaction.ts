import { Interaction, Collection, MessageFlags } from 'discord.js';
import { handleButton } from '../handlers/button.handler';
import { handleModal } from '../handlers/modal.handler';
import { handleSelect } from '../handlers/select.handler';
import { PluginService } from '../services/plugin.service';
import fs from 'fs';
import path from 'path';
import { Command } from '../interfaces/command';
import { Logger } from '../utils/logger';

// Load Commands into Memory
const commands = new Collection<string, Command>();
const commandsPath = path.join(__dirname, '../commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const commandModule = require(filePath);
        for (const key in commandModule) {
            const cmd = commandModule[key];
            if (cmd && 'data' in cmd && 'execute' in cmd) {
                commands.set(cmd.data.name, cmd);
            }
        }
    }
}

export async function onInteractionCreate(interaction: Interaction) {
    try {
        // Trigger custom plugin hooks for interactions
        await PluginService.triggerOnInteraction(interaction);

        if (interaction.isChatInputCommand()) {
            const command = commands.get(interaction.commandName);
            if (!command) {
                Logger.warn(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            await command.execute(interaction);
            return;
        }

        if (!interaction.isRepliable()) return;

        if (interaction.isButton()) {
            await handleButton(interaction);
        } 
        else if (interaction.isModalSubmit()) {
            await handleModal(interaction);
        } 
        else if (interaction.isStringSelectMenu()) {
            await handleSelect(interaction);
        }
    } catch (error) {
        Logger.error('Interaction Error', error);
        // Avoid double reply
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ content: '❌ An error occurred.', flags: MessageFlags.Ephemeral });
            } catch (ignored) {}
        }
    }
}
