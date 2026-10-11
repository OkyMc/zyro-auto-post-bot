# 🧩 Custom Plugins & System Extensions

Folder ini disediakan bagi pengguna untuk menambahkan fitur, logika kustom, atau webhook tanpa perlu menyentuh core bot.

## 🚀 Cara Menambahkan Plugin:
1. Buat file baru berekstensi `.plugin.js` di dalam folder `custom/plugins/` (contoh: `my-webhook.plugin.js`).
2. Tuliskan handler hook sesuai format berikut:

```javascript
module.exports = {
    name: 'MyCustomPlugin',
    version: '1.0.0',
    description: 'Plugin kustom untuk auto-forward ke webhook Discord pribadi',

    init(context) {
        context.logger.info('MyCustomPlugin berhasil dimuat!', 'CustomPlugin');
    },

    onBotReady(client) {
        console.log('Bot aktif dengan tag:', client.user.tag);
    },

    onPostSuccess(event) {
        // Dipanggil setiap kali pesan auto post berhasil dikirim
        // event.task, event.account, event.channelId, event.messageContent, event.sentAt
    },

    onPostFailed(event) {
        // Dipanggil saat pengiriman pesan gagal atau terkena rate limit
    }
};
```
3. Restart bot atau biarkan bot me-reload plugin.
