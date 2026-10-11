/**
 * 🚀 Zyro Post - Sample Custom Plugin
 * User bisa mengedit atau menambah plugin baru di folder ini!
 */

module.exports = {
    name: 'SampleWebhookLogger',
    version: '1.0.0',
    description: 'Contoh plugin untuk logging event scheduler dan integrasi webhook',

    init(context) {
        context.logger.info('SampleWebhookLogger loaded! Kamu bisa edit plugin ini di custom/plugins/', 'Plugin');
    },

    onBotReady(client) {
        // Dipanggil saat bot Discord berhasil login
    },

    onPostSuccess(event) {
        // Dipanggil setiap kali pesan auto post berhasil dikirim
        // console.log(`[Plugin Log] Berhasil kirim pesan ke channel: ${event.channelId}`);
    },

    onPostFailed(event) {
        // Dipanggil saat terjadi error atau rate limit
    }
};
