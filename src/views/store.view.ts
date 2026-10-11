import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } from 'discord.js';
import { PRODUCTS, config } from '../config';
import { ThemeService } from '../config/theme.config';
import { PluginService } from '../services/plugin.service';

export function renderTerms(targetProductId?: string) {
    const theme = ThemeService.getTheme();

    // Embed 1: English
    const embedEnglish = new EmbedBuilder()
        .setTitle('⚠️ TERMS & DISCLAIMER (ENGLISH) ⚠️')
        .setDescription(`
1. **Strictly Against ToS**
Automating user accounts (Self-botting) is a direct violation of Discord Terms of Service.

2. **Your Risk, Your Responsibility**
We provide the tool, but **YOU** control how it's used. We are **NOT** responsible for account locks, bans, or phone verification requests.

3. **Usage Limits**
Sending messages too fast (spamming) drastically increases ban risk. We recommend using safe intervals (slowmode).

4. **Data Privacy**
Your tokens are encrypted. However, you are responsible for your own account security.

5. **No Refunds**
All sales are final. We cannot refund subscriptions if your account gets banned or if Discord patches this method.

6. **Support Scope**
We only provide technical support for the bot itself. We cannot help unban your account.

7. **Use Alt Accounts**
We strongly recommend using secondary/burner accounts. Never run this tool on your main personal account.
`)
        .setColor(ThemeService.parseColor(theme.colors.danger));

    // Embed 2: Indonesia
    const embedIndo = new EmbedBuilder()
        .setTitle('⚠️ SYARAT & RISIKO (INDONESIA) ⚠️')
        .setDescription(`
1. **Melanggar ToS**
Mengotomatisasi akun user (Self-bot) adalah pelanggaran keras terhadap Ketentuan Layanan Discord.

2. **Risiko Anda Sendiri**
Kami menyediakan alat, tapi **ANDA** yang mengendalikannya. Kami **TIDAK** bertanggung jawab atas akun yang terkunci, terbanned, atau minta verifikasi nomor HP.

3. **Batas Penggunaan**
Mengirim pesan terlalu cepat (spam) meningkatkan risiko banned. Gunakan interval yang aman (jangan terlalu brutal).

4. **Privasi Data**
Token Anda dienkripsi. Namun, keamanan akun Anda tetap menjadi tanggung jawab Anda pribadi.

5. **Tidak Ada Refund**
Semua pembayaran bersifat final. Tidak ada pengembalian dana jika akun Anda terbanned atau jika Discord memblokir metode ini.

6. **Lingkup Bantuan**
Kami hanya membantu masalah teknis bot. Kami tidak bisa membantu mengurus akun yang kena banned.

7. **Gunakan Akun Cadangan**
Sangat disarankan menggunakan akun kedua/tumbal. Jangan pernah menjalankan alat ini di akun utama Anda.
`)
        .setColor(ThemeService.parseColor(theme.colors.danger))
        .setFooter({ text: 'By clicking "I Understand", you fully accept these risks.' });

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    // If purchasing / activating, show "I Understand" button
    if (targetProductId) {
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`btn_confirm_buy_${targetProductId}`)
                    .setLabel('✅ I Understand & Create Workspace')
                    .setStyle(ButtonStyle.Success)
            );
        components.push(row);
    }

    return { embeds: [embedEnglish, embedIndo], components, flags: MessageFlags.Ephemeral };
}

export function renderStore() {
    const customRenderer = PluginService.getViewOverride('store');
    if (customRenderer) {
        return customRenderer();
    }

    const theme = ThemeService.getTheme();
    const weeklyPrice = `Rp ${PRODUCTS['7_DAYS'].price.toLocaleString('id-ID')}`;
    const monthlyPrice = `Rp ${PRODUCTS['30_DAYS'].price.toLocaleString('id-ID')}`;

    const storeContainer = {
        type: 17,
        components: [
            {
                type: 10,
                content: `# <:webicon:1511727910560469073>  Make your Workspace\n-# Gunakan panel ini untuk membuat workspace untuk melakukan auto post`
            },
            {
                type: 14,
                spacing: 1,
                divider: true
            },
            {
                type: 10,
                content: `> <:hashtag:1529936590325940284> Full Auto-Post System (Message Scheduler)\n> <:hashtag:1529936590325940284> Auto Fetch System (Fetch Server & Channel)\n> <:hashtag:1529936590325940284> Dynamic Cooldown Detection\n> <:hashtag:1529936590325940284> Multi-Account Support (Independent Workers)\n> <:hashtag:1529936590325940284> 24/7 Cloud Stability (No PC needed)\n\n### <:blankimage:1518625715766165614><:blankimage:1518625715766165614><:blankimage:1518625715766165614> <:folder:1511272912450093157> PRICING PLANS\n\n-# - Weekly Access : ${weeklyPrice} (7 Hari)\n-# - Monthly Access : ${monthlyPrice} (30 Hari)`
            },
            {
                type: 14,
                spacing: 1,
                divider: true
            },
            {
                type: 10,
                content: "<:jasp_support:1513013899048386701>     Please read **Terms And Risk** before you use auto post"
            }
        ]
    };

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('btn_order')
                .setLabel('Order')
                .setEmoji('🛒')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('btn_view_terms')
                .setLabel('Terms & Risks')
                .setEmoji('📜')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('btn_view_tutorial')
                .setLabel('How to get Token')
                .setEmoji('📚')
                .setStyle(ButtonStyle.Secondary)
        );

    return {
        flags: 32768,
        embeds: [],
        components: [storeContainer, row]
    };
}

export function renderOrderPlanSelection() {
    const theme = ThemeService.getTheme();
    const weeklyPrice = `Rp ${PRODUCTS['7_DAYS'].price.toLocaleString('id-ID')}`;
    const monthlyPrice = `Rp ${PRODUCTS['30_DAYS'].price.toLocaleString('id-ID')}`;

    const embed = new EmbedBuilder()
        .setTitle('🛒 PILIH PAKET LANGGANAN AUTO POST')
        .setDescription(`
Silakan pilih paket langganan yang kamu inginkan di bawah ini.
Setelah memilih paket, workspace privat akan otomatis dibuatkan dan kamu dapat menyelesaikan pembayaran.

**PILIHAN PAKET TERSEDIA:**
⚡ **Weekly Pass (7 Hari)** — \`${weeklyPrice}\`
💎 **Monthly Pass (30 Hari)** — \`${monthlyPrice}\`

*Catatan: Workspace baru akan berstatus Locked/Pending hingga pembayaran dikonfirmasi & diapprove oleh admin.*
`)
        .setColor(ThemeService.parseColor(theme.colors.primary))
        .setFooter({ text: `${theme.branding.name} • Order Selection` })
        .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_order_plan')
        .setPlaceholder('Pilih paket auto post kamu...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Weekly Pass (7 Hari)')
                .setDescription(`Harga: ${weeklyPrice} • Masa aktif 7 hari`)
                .setValue('7_DAYS')
                .setEmoji('⚡'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Monthly Pass (30 Hari)')
                .setDescription(`Harga: ${monthlyPrice} • Masa aktif 30 hari (Best Value!)`)
                .setValue('30_DAYS')
                .setEmoji('💎')
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    return {
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral
    };
}
