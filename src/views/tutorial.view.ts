import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { ThemeService } from '../config/theme.config';
import { PluginService } from '../services/plugin.service';

const GET_TOKEN_SCRIPT = `window.webpackChunkdiscord_app.push([[Symbol()],{},o=>{for(let e of Object.values(o.c))try{if(!e.exports||e.exports===window)continue;e.exports?.getToken&&(token=e.exports.getToken());for(let o in e.exports)e.exports?.[o]?.getToken&&"IntlMessagesProxy"!==e.exports[o][Symbol.toStringTag]&&(token=e.exports[o].getToken())}catch{}}]),window.webpackChunkdiscord_app.pop(),token;`;

export function renderTutorialMenu() {
    const customRenderer = PluginService.getViewOverride('tutorial');
    if (customRenderer) {
        return customRenderer();
    }

    const theme = ThemeService.getTheme();

    const embed = new EmbedBuilder()
        .setTitle(`🔑 **${theme.ui.tutorialTitle}** 🔑`)
        .setDescription(`
**Pilih panduan sesuai device lu:**

${theme.emojis.bullet} **PC / Laptop (Chrome / Edge)**
Metode tercepat menggunakan Developer Console atau Network Tab.

${theme.emojis.bullet} **Android / Mobile (Kiwi Browser)**
Menggunakan Kiwi Browser atau Yandex Browser yang support Developer Tools.

⚠️ **PENTING (WAJIB DIBACA):**
1. **Wajib LOGIN DULU** sampai masuk ke dalam Discord (halaman chat/server).
2. **JANGAN** jalankan script di halaman login (\`discord.com/login\`), karena token yang keluar adalah token mati/expired!
`)
        .setColor(ThemeService.parseColor(theme.colors.primary))
        .setFooter({ text: theme.branding.footerText })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('btn_tutorial_pc')
                .setLabel('PC / Laptop')
                .setEmoji('💻')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('btn_tutorial_android')
                .setLabel('Android')
                .setEmoji('📱')
                .setStyle(ButtonStyle.Success)
        );

    return { content: null, embeds: [embed], components: [row] };
}

export function renderTutorialPC() {
    const theme = ThemeService.getTheme();

    const embed = new EmbedBuilder()
        .setTitle('👑 **PC: Panduan Ambil Token Discord** 👑')
        .setDescription(`
1. Buka **Discord Web** di Chrome/Edge (\`discord.com/app\`).
2. **LOGIN** pake Email & Password lu sampai bener-bener **MASUK KE DALAM CHAT/SERVER**.
3. Tekan \`Ctrl + Shift + I\` untuk membuka Developer Tools.
4. Klik tab **"Console"**.
5. **Paste** script di bawah dan tekan **Enter**.
6. Token baru lu yang valid bakal muncul (teks di dalam tanda kutip \`"..."\`).
`)
        .setColor(ThemeService.parseColor(theme.colors.primary));

    return { 
        content: `\`\`\`js\n${GET_TOKEN_SCRIPT}\n\`\`\``, 
        embeds: [embed], 
        components: [],
        flags: MessageFlags.Ephemeral 
    };
}

export function renderTutorialAndroid() {
    const theme = ThemeService.getTheme();

    const embed = new EmbedBuilder()
        .setTitle('👑 **Android: Panduan Ambil Token Discord** 👑')
        .setDescription(`
1. Install & Buka **Kiwi Browser** dari PlayStore.
2. Buka **Discord Web** (\`discord.com/login\`) dan **LOGIN** sampai masuk ke halaman chat.
3. Klik tombol **Titik 3** (Menu) -> Pilih **Developer Tools**.
4. Masuk ke tab **Console**.
5. **Paste** script di bawah dan tekan **Enter**.
6. Salin token aktif yang muncul.
`)
        .setColor(ThemeService.parseColor(theme.colors.success));

    return { 
        content: `\`\`\`js\n${GET_TOKEN_SCRIPT}\n\`\`\``, 
        embeds: [embed], 
        components: [],
        flags: MessageFlags.Ephemeral 
    };
}
