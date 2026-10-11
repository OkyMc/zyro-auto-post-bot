import { Client, TextChannel, ThreadChannel, DMChannel, NewsChannel } from 'discord.js-selfbot-v13';
import { parentPort, workerData } from 'worker_threads';
import { smartSplit, parseSpintax, addInvisibleJitter } from '../utils/textSplitter';
import { TaskConfig } from '../interfaces/worker';

// Interface for Worker Data
interface WorkerPayload {
  mode?: 'RUN' | 'FETCH_GUILDS' | 'FETCH_CHANNELS' | 'FETCH_CONTEXT' | 'PREVIEW';
  token: string;
  sessionToken?: string;
  channelId?: string;
  threadId?: string;
  inviteCode?: string;
  guildId?: string;
  message?: string;
  minDelay?: number;
  maxDelay?: number;
  dynamicDelay?: boolean;
}

const payload = workerData as WorkerPayload;
if (!payload || !payload.sessionToken) {
    if (parentPort) {
        parentPort.postMessage({ type: 'error', content: '[Security Trap] Unauthorized worker launch detected without valid session.' });
    }
    process.exit(1);
}

const mode = payload.mode || 'RUN';

// Initialize Client with official selfbot settings (auto-generates authentic Discord Electron Desktop headers & build numbers)
const client = new Client({
  checkUpdate: false
} as any);

let isRunning = true;

// --- FUNCTIONS FOR EPHEMERAL MODES ---

async function fetchGuilds() {
    try {
        const guilds = client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.iconURL()
        }));
        if (parentPort) parentPort.postMessage({ type: 'data', data: guilds });
        process.exit(0);
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        error(`Failed to fetch guilds: ${errorMessage}`);
        process.exit(1);
    }
}

async function fetchChannels() {
    try {
        if (!payload.guildId) throw new Error('Guild ID required');
        const guild = client.guilds.cache.get(payload.guildId) || await client.guilds.fetch(payload.guildId);
        if (!guild) throw new Error('Guild not found');
        await guild.channels.fetch(); 
        const channels = guild.channels.cache
            .filter(c => c.isText() && c.type === 'GUILD_TEXT')
            .map(c => ({
                id: c.id,
                name: c.name,
                rateLimitPerUser: (c as any).rateLimitPerUser || 0
            }));
        if (parentPort) parentPort.postMessage({ type: 'data', data: channels });
        process.exit(0);
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        error(`Failed to fetch channels: ${errorMessage}`);
        process.exit(1);
    }
}

async function fetchContext() {
    try {
        if (!payload.guildId || !payload.channelId) throw new Error('Guild ID and Channel ID required');
        
        let guild = client.guilds.cache.get(payload.guildId);
        if (!guild) {
            try {
                guild = await client.guilds.fetch(payload.guildId);
            } catch (e) {}
        }

        if (!guild) throw new Error('Guild not found');
        
        let channel = guild.channels.cache.get(payload.channelId);
        let channelName = 'Unknown Channel';
        
        if (!channel) {
             try {
                 const fetched = await client.channels.fetch(payload.channelId);
                 if (fetched) {
                    channelName = (fetched as any).name;
                 }
             } catch (e) {}
        } else {
            channelName = channel.name;
        }

        if (parentPort) {
            parentPort.postMessage({
                type: 'data',
                data: { guildName: guild.name, channelName: channelName }
            });
        }
        process.exit(0);
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        error(`Failed to fetch context: ${errorMessage}`);
        process.exit(1);
    }
}

async function runPreview() {
    try {
        let targetId = payload.threadId || payload.channelId;
        if (!targetId) throw new Error('Target ID required for preview');
        
        let target: TextChannel | ThreadChannel | DMChannel | NewsChannel | null = null;

        try {
            const fetched = await client.channels.fetch(targetId);
            if (fetched && fetched.isText()) {
                target = fetched as TextChannel | ThreadChannel | DMChannel | NewsChannel;
            }
        } catch (e) {}

        if (!target && payload.inviteCode) {
            log(`[Preview] Target not found. Attempting to join via invite...`);
            try {
                const invite = await client.fetchInvite(payload.inviteCode);
                // @ts-ignore
                if (invite.acceptInvite) await invite.acceptInvite();
                // @ts-ignore
                else if (client.acceptInvite) await client.acceptInvite(payload.inviteCode);

                await new Promise(r => setTimeout(r, 3000));
                
                const refetched = await client.channels.fetch(targetId);
                if (refetched && refetched.isText()) {
                    target = refetched as TextChannel | ThreadChannel | DMChannel | NewsChannel;
                }
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                error(`[Preview] Failed to join server: ${errorMessage}`);
                process.exit(1);
            }
        }

        if (!target || !target.isText()) {
            error('[Preview] Could not access the target thread/channel. Is the selfbot in the server?');
            process.exit(1);
        }

        const msgToSend = payload.message || 'Zyro Post Preview Message';
        const chunks = smartSplit(msgToSend);
        
        for (const chunk of chunks) {
            if (target.sendTyping) {
                try {
                    await target.sendTyping();
                } catch (e) {}
                await new Promise(r => setTimeout(r, 2000));
            }
            await target.send(chunk);
            if (chunks.length > 1) await new Promise(r => setTimeout(r, 1000));
        }

        log(`[Preview] Sent preview successfully to ${targetId}`);
        if (parentPort) parentPort.postMessage({ type: 'data', data: { success: true } });
        process.exit(0);

    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        error(`[Preview] Failed: ${errorMessage}`);
        process.exit(1);
    }
}

// --- HELPER FUNCTIONS ---

const MAX_DELAY_MS = 86400000; // 24 hours max
const MIN_SAFE_DELAY_MS = 30000; // 30 seconds minimum safe delay
const MAX_CHANNEL_FETCH_RETRIES = 5;

function getRandomDelay(min: number, max: number): number {
    if (min < MIN_SAFE_DELAY_MS) min = MIN_SAFE_DELAY_MS;
    if (max < min) max = min + 30000;
    if (max > MAX_DELAY_MS) max = MAX_DELAY_MS;
    if (min > MAX_DELAY_MS) min = MAX_DELAY_MS;
    
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function log(msg: string) {
  if (parentPort) parentPort.postMessage({ type: 'debug', content: msg });
  else console.log(msg);
}

function error(msg: string) {
  if (parentPort) parentPort.postMessage({ type: 'error', content: msg });
  else console.error(msg);
}

// --- MULTI-TASK & RPC LOGIC ---

const activeTasks = new Map<string, { 
    timeout: NodeJS.Timeout | null, 
    config: TaskConfig, 
    channelFetchRetries: number
}>();

if (parentPort) {
    parentPort.on('message', async (msg) => {
        if (!msg) return;

        if (msg === 'STOP') {
            isRunning = false;
            for (const [id, task] of activeTasks) {
                if (task.timeout) clearTimeout(task.timeout);
            }
            activeTasks.clear();
            try { client.destroy(); } catch (e) {}
            process.exit(0);
        }
        else if (msg.type === 'START_TASK') {
            const { taskId, config, initialDelay } = msg;
            if (!taskId || !config || !config.channelId) {
                error('[Worker] Invalid START_TASK payload');
                return;
            }

            if (activeTasks.has(taskId)) {
                stopTask(taskId);
            }
            
            const taskState = { timeout: null as NodeJS.Timeout | null, config, channelFetchRetries: 0 };
            activeTasks.set(taskId, taskState);

            if (initialDelay && initialDelay > 0) {
                log(`[Worker] Resuming Task ${taskId} on #${config.channelId} with remaining delay: ${(initialDelay / 1000).toFixed(1)}s`);
                taskState.timeout = setTimeout(() => processTask(taskId), initialDelay);
            } else {
                log(`[Worker] Starting Task ${taskId} on #${config.channelId}`);
                processTask(taskId);
            }
        }
        else if (msg.type === 'STOP_TASK') {
            if (msg.taskId) stopTask(msg.taskId);
        }
        else if (msg.type === 'RPC_FETCH_GUILDS') {
            try {
                const guilds = client.guilds.cache.map(g => ({
                    id: g.id,
                    name: g.name,
                    icon: g.iconURL()
                }));
                parentPort?.postMessage({ type: 'rpc_data', reqId: msg.reqId, data: guilds });
            } catch (e: any) {
                parentPort?.postMessage({ type: 'rpc_error', reqId: msg.reqId, content: e.message });
            }
        }
        else if (msg.type === 'RPC_FETCH_CHANNELS') {
            try {
                const guild = client.guilds.cache.get(msg.guildId) || await client.guilds.fetch(msg.guildId);
                if (!guild) {
                    parentPort?.postMessage({ type: 'rpc_error', reqId: msg.reqId, content: 'Guild not found' });
                    return;
                }
                await guild.channels.fetch();
                const channels = guild.channels.cache
                    .filter(c => c.isText() && c.type === 'GUILD_TEXT')
                    .map(c => ({
                        id: c.id,
                        name: c.name,
                        rateLimitPerUser: (c as any).rateLimitPerUser || 0
                    }));
                parentPort?.postMessage({ type: 'rpc_data', reqId: msg.reqId, data: channels });
            } catch (e: any) {
                parentPort?.postMessage({ type: 'rpc_error', reqId: msg.reqId, content: e.message });
            }
        }
        else if (msg.type === 'RPC_FETCH_CONTEXT') {
            try {
                let guild = client.guilds.cache.get(msg.guildId);
                if (!guild) {
                    try { guild = await client.guilds.fetch(msg.guildId); } catch (e) {}
                }
                let channelName = 'Unknown Channel';
                if (guild) {
                    let channel = guild.channels.cache.get(msg.channelId);
                    if (!channel) {
                        try {
                            const fetched = await client.channels.fetch(msg.channelId);
                            if (fetched) channelName = (fetched as any).name;
                        } catch (e) {}
                    } else {
                        channelName = channel.name;
                    }
                    parentPort?.postMessage({
                        type: 'rpc_data',
                        reqId: msg.reqId,
                        data: { guildName: guild.name, channelName }
                    });
                } else {
                    parentPort?.postMessage({
                        type: 'rpc_data',
                        reqId: msg.reqId,
                        data: { guildName: 'Unknown Server', channelName }
                    });
                }
            } catch (e: any) {
                parentPort?.postMessage({ type: 'rpc_error', reqId: msg.reqId, content: e.message });
            }
        }
    });
}

function stopTask(taskId: string) {
    const task = activeTasks.get(taskId);
    if (task) {
        if (task.timeout) clearTimeout(task.timeout);
        activeTasks.delete(taskId);
        log(`[Worker] Stopped Task ${taskId}`);
    }
}

async function processTask(taskId: string) {
    const task = activeTasks.get(taskId);
    if (!task) return;

    const { config } = task;
    let channel: TextChannel | ThreadChannel | null = client.channels.cache.get(config.channelId) as TextChannel | ThreadChannel | undefined ?? null;

    if (!channel) {
        try {
            const fetched = await client.channels.fetch(config.channelId);
            if (fetched && fetched.isText()) {
                channel = fetched as TextChannel | ThreadChannel;
            }
            task.channelFetchRetries = 0;
        } catch (e) {
            task.channelFetchRetries++;
            if (task.channelFetchRetries >= MAX_CHANNEL_FETCH_RETRIES) {
                error(`[Task ${taskId}] Channel fetch failed after ${MAX_CHANNEL_FETCH_RETRIES} retries. Stopping task.`);
                if (parentPort) {
                    parentPort.postMessage({
                        type: 'log',
                        taskId,
                        status: 'error',
                        content: `Channel ${config.channelId} not accessible`,
                        url: null,
                        nextDelay: 0
                    });
                }
                stopTask(taskId);
                return;
            }
            task.timeout = setTimeout(() => processTask(taskId), 30000);
            return;
        }
    }

    if (!channel || !channel.isText()) {
        task.channelFetchRetries++;
        if (task.channelFetchRetries >= MAX_CHANNEL_FETCH_RETRIES) {
            error(`[Task ${taskId}] Invalid channel after ${MAX_CHANNEL_FETCH_RETRIES} retries. Stopping task.`);
            stopTask(taskId);
            return;
        }
        task.timeout = setTimeout(() => processTask(taskId), 30000);
        return; 
    }
    
    task.channelFetchRetries = 0;

    // Metadata Self-Healing
    if (parentPort && (channel.type === 'GUILD_TEXT' || channel.isThread())) {
        try {
            const guildName = channel.guild?.name || 'Unknown Server';
            const channelName = channel.name;
            parentPort.postMessage({ 
                type: 'metadata_update', 
                taskId, 
                data: { guildName, channelName } 
            });
        } catch (e) { }
    }

    try {
        let delay = getRandomDelay(config.minDelay || 60000, config.maxDelay || 120000);
        
        // Dynamic Slowmode Handling
        if (config.dynamicDelay && channel.rateLimitPerUser) {
            const slowmodeMs = channel.rateLimitPerUser * 1000;
            if (delay < slowmodeMs) {
                const jitter = 5000 + Math.floor(Math.random() * 5000); 
                delay = slowmodeMs + jitter; 
            }
        }

        if (config.message) {
            // Apply Spintax and zero-width invisible character jitter
            const resolvedMessage = addInvisibleJitter(parseSpintax(config.message));
            const chunks = smartSplit(resolvedMessage);
            
            for (const chunk of chunks) {
                if (!activeTasks.has(taskId)) {
                    log(`[Task ${taskId}] Stopped before typing`);
                    return;
                }

                // Natural human typing speed simulation (2s - 5s)
                const typingDuration = Math.min(Math.max(chunk.length * 35, 2000), 5000); 
                if (channel.sendTyping) {
                    try {
                        await channel.sendTyping();
                    } catch (e) {}
                    
                    if (!activeTasks.has(taskId)) {
                        log(`[Task ${taskId}] Stopped after typing`);
                        return;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, typingDuration));
                }
                
                if (!activeTasks.has(taskId)) {
                    log(`[Task ${taskId}] Stopped before send`);
                    return;
                }

                const sentMsg = await channel.send(chunk);
                
                if (!activeTasks.has(taskId)) {
                    log(`[Task ${taskId}] Stopped after send`);
                    return;
                }
                
                if (parentPort && chunk === chunks[chunks.length - 1]) {
                    parentPort.postMessage({
                        type: 'log',
                        taskId,
                        status: 'success',
                        content: `Sent to #${channel.name}`,
                        url: sentMsg.url,
                        nextDelay: delay
                    });
                }
                
                if (chunks.length > 1) {
                    if (!activeTasks.has(taskId)) return;
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        }
        
        // Schedule Next Post
        if (activeTasks.has(taskId)) {
            task.timeout = setTimeout(() => processTask(taskId), delay);
        }

    } catch (err: unknown) {
        const discordError = err as { code?: number; retryAfter?: number; message?: string };
        if (discordError.code === 429) {
            const retryAfter = discordError.retryAfter || 5000;
            error(`[Task ${taskId}] Rate Limit. Waiting ${retryAfter}ms...`);
            if (activeTasks.has(taskId)) {
                task.timeout = setTimeout(() => processTask(taskId), retryAfter + 5000);
            }
            return;
        }
        const errorMessage = err instanceof Error ? err.message : String(err);
        error(`[Task ${taskId}] Failed to send: ${errorMessage}`);
        if (activeTasks.has(taskId)) {
            task.timeout = setTimeout(() => processTask(taskId), 30000); 
        }
    }
}

// MAIN EXECUTION
client.on('ready', async () => {
  log(`[Worker] Logged in as ${client.user?.tag} (Mode: ${mode})`);

  if (mode === 'FETCH_GUILDS') {
      await fetchGuilds();
  } else if (mode === 'FETCH_CHANNELS') {
      await fetchChannels();
  } else if (mode === 'FETCH_CONTEXT') {
      await fetchContext();
  } else if (mode === 'PREVIEW') {
      await runPreview();
  } else if (mode === 'RUN') {
      log('[Worker] Ready for tasks. Persistent connection active.');
      if (parentPort) parentPort.postMessage('READY');
  }
});

const cleanToken = (payload.token || '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/[\r\n\t\s]/g, '')
    .trim();

client.login(cleanToken).catch(err => {
    error(`Login Failed: ${err.message}`);
    const isInvalidToken = err.message?.toLowerCase().includes('invalid token') ||
                           err.message?.toLowerCase().includes('unauthorized') ||
                           err.code === 'TOKEN_INVALID' ||
                           err.code === 'DISALLOWED_INTENTS';
    process.exit(isInvalidToken ? 2 : 1);
});
