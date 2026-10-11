# 🗄️ Database Architecture & Schema (MySQL Edition)

Project ini menggunakan **MySQL** sebagai database relasional utama yang dikelola melalui **Prisma ORM** (`prisma/schema.prisma`).

---

## 📊 Entity Relationship & Data Flow

```mermaid
erDiagram
    users ||--o{ accounts : "owns (Cascade Delete)"
    users ||--o{ payments : "creates (Cascade Delete)"
    accounts ||--o{ tasks : "executes (Cascade Delete)"

    users {
        varchar id PK "Discord User Snowflake ID"
        varchar username "Discord Username / Tag"
        int balance "User Balance (Default 0)"
        datetime expiryDate "Subscription Expiration"
        varchar workspaceChannelId "Discord TextChannel ID"
        varchar logThreadId "Discord Thread ID for logs"
        varchar controlPanelMessageId "Dashboard Message ID"
        datetime createdAt
        datetime updatedAt
    }

    accounts {
        varchar id PK "CUID Primary Key"
        varchar userId FK "References users.id"
        text token "AES-256 Encrypted Token"
        varchar name "Discord Display Name"
        text avatar "Avatar URL"
        datetime createdAt
        datetime updatedAt
    }

    tasks {
        varchar id PK "CUID Primary Key"
        varchar accountId FK "References accounts.id"
        varchar guildId "Target Discord Server ID"
        varchar guildName "Target Server Name"
        varchar channelId "Target Discord Channel ID"
        varchar channelName "Target Channel Name"
        int channelSlowmode "Slowmode in seconds"
        text message "Message Payload Content"
        int minDelay "Minimum Delay (seconds)"
        int maxDelay "Maximum Delay (seconds)"
        boolean dynamicDelay "Auto adapt to slowmode"
        varchar status "RUNNING | STOPPED | ERROR"
        int totalSent "Sent message counter"
        datetime lastRun "Timestamp of last broadcast"
        datetime nextRun "Timestamp of next broadcast"
        datetime createdAt
        datetime updatedAt
    }

    payments {
        varchar id PK "CUID Primary Key"
        varchar externalId UK "TRX unique transaction code"
        varchar userId FK "References users.id"
        int amount "Nominal Rupiah (IDR)"
        varchar status "PENDING | PAID | FAILED | CANCELLED"
        varchar invoiceMessageId "DM Message ID"
        datetime createdAt
        datetime updatedAt
    }

    system_configs {
        varchar id PK "main"
        varchar statsChannelId "Channel for Live Stats"
        varchar statsMessageId "Message for Live Stats"
    }
```

---

## 📑 Prisma Schema Details (MySQL Engine)

### 1. `users` Table
Menyimpan entitas pelanggan, status langganan, dan pointer Discord channel/thread milik pelanggan.
- **`id`**: String custom (Discord Snowflake ID).
- **`expiryDate`**: Waktu kedaluwarsa langganan. Jika `expiryDate < now()`, user kehilangan hak akses broadcast task.
- **`workspaceChannelId`**: ID channel privat di kategori `Workspaces`.
- **`logThreadId`**: ID thread log aktivitas di dalam channel privat.

### 2. `accounts` Table
Menyimpan kredensial akun selfbot yang didaftarkan oleh user.
- **`token`**: Text terenkripsi menggunakan AES-256 (`iv:encryptedData`).
- Relasi `onDelete: Cascade` memastikan jika User dihapus, seluruh Account miliknya ikut terhapus.

### 3. `tasks` Table
Mendefinisikan jadwal dan aturan pengiriman pesan otomatis.
- **`dynamicDelay`**: Boolean yang menentukan apakah bot otomatis mengikuti slowmode channel target.
- **`status`**: Status eksekusi (`RUNNING` jika worker aktif mengirim, `STOPPED` jika dipause oleh user).
- **`totalSent`**: Metrik kumulatif pesan berhasil dikirim.

### 4. `payments` Table
Menyimpan riwayat transaksi pembayaran QRIS via PaKasir.
- **`externalId`**: ID unik transaksi untuk referensi ke gateway pembayaran.
- **`status`**: Status transaksi (`PENDING`, `PAID`, `CANCELLED`, `FAILED`).

### 5. `system_configs` Table
Menyimpan konfigurasi singleton sistem (seperti pesan embed live stats server).
