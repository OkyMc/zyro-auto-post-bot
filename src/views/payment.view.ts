import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function renderPaymentInvoice(productName: string, price: number, qrUrl: string, transactionId: string) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'ZYRO POST PAYMENT' })
        .setDescription(`
**Invoice Details**
» Product : **${productName}**
» Price   : **Rp ${price.toLocaleString('id-ID')}**
» TRX ID  : \`${transactionId}\`

**Payment Instructions**
🔹 Scan the QRIS using E-Wallet or Banking.
🔹 Status will update automatically (1-2 mins).
🔹 Check subscription status in Control Panel.

\u200b
*QRIS is valid for 15 minutes.*
`)
        .setColor(0x57F287) // Discord Green
        .setImage(qrUrl)
        .setFooter({ text: 'Zyro Post Payment System' })
        .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`btn_check_payment_${transactionId}`)
                .setLabel('Check Status')
                .setEmoji('🔍')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`btn_cancel_payment_${transactionId}`)
                .setLabel('Cancel Transaction')
                .setEmoji('🗑️')
                .setStyle(ButtonStyle.Danger)
        );

    return { embeds: [embed], components: [row] };
}

export function renderPaymentSuccess(productName: string = 'Premium Plan', price: number = 0, transactionId: string) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: 'ZYRO POST PAYMENT' })
        .setTitle('✅ PAYMENT SUCCESSFUL')
        .setDescription(`
**Thank You!**
Your payment has been received and your subscription is active.

**Transaction Details**
» Product : **${productName}**
» Price   : **Rp ${price.toLocaleString('id-ID')}**
» TRX ID  : \`${transactionId}\`

**Next Steps**
1. Check your new private workspace.
2. Go to your **Control Panel** to manage tasks.
`)
        .setColor(0x57F287) // Green
        .setFooter({ text: 'Zyro Post Payment System' })
        .setTimestamp();

    return { embeds: [embed], components: [] };
}