import { 
  Client, 
  ChannelType, 
  PermissionFlagsBits, 
  TextChannel, 
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import prisma from '../database/client';
import { renderControlPanel } from '../views/controlPanel.view';
import { Logger } from '../utils/logger';
import { PRODUCTS } from '../config';

export class WorkspaceService {

  /**
   * Membuat Workspace Baru dalam status PENDING / LOCKED
   */
  static async createPendingWorkspace(client: Client, guildId: string, userId: string, planId: string) {
    const guild = client.guilds.cache.get(guildId.toString());
    if (!guild) throw new Error('Guild not found');

    const botMember = guild.members.cache.get(client.user!.id);
    if (!botMember) throw new Error('Bot is not in the guild');

    const requiredPerms = [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.SendMessages
    ];

    const missingPerms = requiredPerms.filter(p => !botMember.permissions.has(p));
    if (missingPerms.length > 0) {
      throw new Error('Bot is missing required permissions: ManageChannels, CreatePublicThreads, SendMessages');
    }

    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    const product = PRODUCTS[planId] || PRODUCTS['7_DAYS'];
    const priceFormatted = `Rp ${product.price.toLocaleString('id-ID')}`;

    // 1. Cek apakah user sudah punya workspace channel yang aktif
    let dbUser = await prisma.user.findUnique({ where: { id: userId } });
    let existingChannel = dbUser?.workspaceChannelId ? guild.channels.cache.get(dbUser.workspaceChannelId) : null;

    if (existingChannel) {
        const channel = existingChannel as TextChannel;
        
        // Kirim tagihan order baru di channel yang sudah ada
        const reorderEmbed = new EmbedBuilder()
            .setTitle('🛒 PERMINTAAN ORDER BARU')
            .setDescription(`
Halo <@${userId}>! Kamu mengajukan perpanjangan/order paket:
📦 **Paket:** ${product.name} (${product.durationDays} Hari)
💰 **Harga:** \`${priceFormatted}\`

⏳ *Silakan lakukan pembayaran dan tunggu admin untuk meng-approve permintaan kamu.*
`)
            .setColor(0xFEE75C)
            .setFooter({ text: 'Zyro Post • Order Pending' })
            .setTimestamp();

        const adminRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_admin_approve_${userId}_${planId}`)
                    .setLabel(`Approve ${product.durationDays} Hari`)
                    .setEmoji('👑')
                    .setStyle(ButtonStyle.Success)
            );

        await channel.send({ embeds: [reorderEmbed], components: [adminRow] });
        await this.refreshControlPanel(client, userId);
        return channel;
    }

    // 2. Pastikan Category Workspaces ada
    let category = guild.channels.cache.find(c => c.name === 'Workspaces' && c.type === ChannelType.GuildCategory);
    if (!category) {
        category = await guild.channels.create({
            name: 'Workspaces',
            type: ChannelType.GuildCategory
        });
    }

    // 3. Buat Private Channel
    const channelName = `workspace-${user.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    let channel: TextChannel | undefined;
    let thread;

    try {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: client.user!.id, // Bot
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages],
          },
          {
            id: userId, // The Customer
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
        ],
        topic: `Private Workspace for ${user.tag} • Status: PENDING APPROVAL`,
      }) as TextChannel;

      // 4. Create Log Thread
      thread = await channel.threads.create({
        name: '📜-live-logs',
        autoArchiveDuration: 1440,
        reason: 'Logs for selfbot activity',
      });

      // 5. Update Database dengan status belum aktif (expiryDate: null)
      await prisma.user.upsert({
        where: { id: userId },
        update: {
          workspaceChannelId: channel.id,
          logThreadId: thread.id,
          username: user.tag
        },
        create: {
          id: userId,
          workspaceChannelId: channel.id,
          logThreadId: thread.id,
          expiryDate: null, // PENDING!
          username: user.tag
        }
      });

      // 6. Kirim Welcome & Pending Payment Embed
      const invoiceEmbed = new EmbedBuilder()
        .setTitle('🛒 DETAIL ORDER & INSTRUKSI PEMBAYARAN')
        .setDescription(`
Halo <@${userId}>! Workspace privat kamu telah berhasil dibuat dalam mode **Locked (Pending)**.

📋 **RINCIAN PESANAN:**
• **Pelanggan** : <@${userId}> (${user.tag})
• **Paket**     : **${product.name}** (${product.durationDays} Hari)
• **Total Biaya**: \`${priceFormatted}\`

---

💳 **CARA PEMBAYARAN:**
1. Silakan lakukan pembayaran senilai **${priceFormatted}** via metode yang ditentukan oleh Seller / Admin server.
2. Kirim bukti transfer di channel ini.
3. Tunggu Admin / Owner memverifikasi dan mengklik tombol **Approve** di bawah ini.

*Setelah diapprove, kontrol panel di bawah akan otomatis terbuka dan kamu bisa langsung menggunakannya!* 🔥
`)
        .setColor(0xFEE75C) // Yellow/Gold
        .setFooter({ text: 'Zyro Post • Order Pending Approval' })
        .setTimestamp();

      const adminRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_admin_approve_${userId}_${planId}`)
                .setLabel(`Approve Access (${product.durationDays} Hari)`)
                .setEmoji('👑')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`btn_admin_reject_${userId}`)
                .setLabel('Tolak / Hapus Workspace')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger)
        );

      await channel.send({ content: `<@${userId}>`, embeds: [invoiceEmbed], components: [adminRow] });

    } catch (error) {
      if (channel) {
        try {
          await channel.delete('Rollback: Database update failed');
        } catch (deleteError) {
          Logger.error(`Failed to rollback channel ${channel.id}`, deleteError, 'WorkspaceService');
        }
      }
      throw error;
    }

    // 7. Send Control Panel (Status Pending)
    await this.refreshControlPanel(client, user.id);

    return channel;
  }

  /**
   * Menyetujui (Approve) Workspace dan Mengaktifkan Masa Aktif
   */
  static async approveWorkspace(client: Client, guildId: string, userId: string, durationDays: number, approvedByTag: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found in database');

    const now = new Date();
    const baseDate = user.expiryDate && user.expiryDate > now ? user.expiryDate : now;
    const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await prisma.user.update({
        where: { id: userId },
        data: { expiryDate: newExpiry }
    });

    // 1. Refresh Control Panel di Workspace
    await this.refreshControlPanel(client, userId);

    // 2. Kirim Pesan Konfirmasi di Workspace Channel
    if (user.workspaceChannelId) {
        const guild = client.guilds.cache.get(guildId);
        const channel = guild?.channels.cache.get(user.workspaceChannelId) as TextChannel | undefined;
        if (channel) {
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 WORKSPACE TELAH DI-APPROVE & AKTIF!')
                .setDescription(`
Masa aktif kamu telah berhasil diaktifkan selama **${durationDays} Hari** oleh **${approvedByTag}**.

📅 **Aktif Sampai :** \`${newExpiry.toLocaleString('id-ID')}\`
🚀 **Status       :** \`ACTIVE (UNLOCKED)\`

Silakan gunakan tombol **Add Account** dan **New Task** pada panel di bawah untuk mulai broadcast! 🔥
`)
                .setColor(0x57F287) // Green
                .setFooter({ text: 'Zyro Post' })
                .setTimestamp();

            await channel.send({ content: `<@${userId}>`, embeds: [successEmbed] });
        }
    }

    // 3. Kirim Notifikasi ke DM Buyer
    try {
        const discordUser = await client.users.fetch(userId);
        if (discordUser) {
            const dmEmbed = new EmbedBuilder()
                .setTitle('✅ WORKSPACE ZYRO POST AKTIF!')
                .setDescription(`
Halo **${discordUser.username}**! Pembayaran kamu telah diverifikasi dan workspace kamu sudah **AKTIF**!

• **Durasi Ditambahkan** : **+${durationDays} Hari**
• **Masa Aktif Hingga**   : \`${newExpiry.toLocaleString('id-ID')}\`
• **Workspace Channel**   : <#${user.workspaceChannelId}>

Selamat menggunakan layanan Zyro Post Auto Broadcast! 🚀
`)
                .setColor(0x57F287)
                .setFooter({ text: 'Zyro Post' })
                .setTimestamp();

            await discordUser.send({ embeds: [dmEmbed] });
        }
    } catch {
        // Abaikan jika DM ditutup oleh user
    }

    return newExpiry;
  }
  
  static async createWorkspace(client: Client, guildId: String, userId: string) {
    // Backward compatibility wrapper
    return this.createPendingWorkspace(client, guildId.toString(), userId, '30_DAYS');
  }

  static async refreshControlPanel(client: Client, userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.workspaceChannelId) return;

    const channel = client.channels.cache.get(user.workspaceChannelId) as TextChannel;
    if (!channel) return;

    const dashboard = await renderControlPanel(userId);
    const content = dashboard.content || `Welcome to your workspace!`;
    const payload = { 
        content: content,
        embeds: dashboard.embeds, 
        components: dashboard.components 
    };

    try {
        if (user.controlPanelMessageId) {
            try {
                const msg = await channel.messages.fetch(user.controlPanelMessageId);
                if (msg) {
                    await msg.edit(payload);
                    return;
                }
            } catch (e) {
                // Message likely deleted, send new one
            }
        } else {
            // Smart Discovery: Try to find existing panel
            try {
                const messages = await channel.messages.fetch({ limit: 20 });
                const existingPanel = messages.find(m => 
                    m.author.id === client.user?.id && 
                    m.embeds.length > 0 && 
                    m.embeds[0].description?.includes('ZYRO POST PANEL')
                );

                if (existingPanel) {
                    await existingPanel.edit(payload);
                    await prisma.user.update({
                        where: { id: userId },
                        data: { controlPanelMessageId: existingPanel.id }
                    });
                    return;
                }
            } catch (e) {
                // Ignore fetch error, proceed to send new
            }
        }
        
        // If no message or fetch failed, send new one
        const newMsg = await channel.send(payload);
        
        await prisma.user.update({
            where: { id: userId },
            data: { controlPanelMessageId: newMsg.id }
        });

    } catch (e) {
        Logger.error('Failed to refresh panel', e, 'WorkspaceService');
    }
  }

  static async sendDashboard(channel: TextChannel, userId: string) {
     await this.refreshControlPanel(channel.client as Client, userId);
  }

  static async syncPanelsOnStartup(client: Client) {
      Logger.info('Syncing control panels...', 'WorkspaceService');
      const users = await prisma.user.findMany({
          where: {
              workspaceChannelId: { not: null }
          }
      });

      for (const user of users) {
          await this.refreshControlPanel(client, user.id);
          // Small delay to avoid rate limits
          await new Promise(r => setTimeout(r, 1000));
      }
      Logger.info(`Synced panels for ${users.length} users.`, 'WorkspaceService');
  }
}
