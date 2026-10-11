import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';

export interface ThemeConfig {
    branding: {
        name: string;
        logoUrl: string;
        bannerUrl: string;
        footerText: string;
        website?: string;
    };
    colors: {
        primary: string | number;
        success: string | number;
        warning: string | number;
        danger: string | number;
        info: string | number;
        dark: string | number;
    };
    emojis: {
        active: string;
        inactive: string;
        pending: string;
        crown: string;
        bullet: string;
        gear: string;
        add: string;
        stop: string;
        server: string;
        clock: string;
        money: string;
        success: string;
        error: string;
    };
    ui: {
        dashboardTitle: string;
        controlPanelTitle: string;
        storeTitle: string;
        tutorialTitle: string;
        statsTitle: string;
    };
}

const DEFAULT_THEME: ThemeConfig = {
    branding: {
        name: 'Zyro Post',
        logoUrl: 'https://cdn.discordapp.com/attachments/1420156741059874818/1453538221584551936/standard_1.gif?ex=6979fab5&is=6978a935&hm=91e3d4d0ed490273106ddf8b3d55562f4e450074f3afa51e28a61b18d1fe4f05&',
        bannerUrl: 'https://cdn.discordapp.com/attachments/1420156741059874818/1453538221584551936/standard_1.gif?ex=6979fab5&is=6978a935&hm=91e3d4d0ed490273106ddf8b3d55562f4e450074f3afa51e28a61b18d1fe4f05&',
        footerText: 'Zyro Post • Enterprise Discord Auto Post',
        website: 'https://zyro.host'
    },
    colors: {
        primary: 0x5865F2,
        success: 0x57F287,
        warning: 0xFEE75C,
        danger: 0xED4245,
        info: 0x3498DB,
        dark: 0x2B2D31
    },
    emojis: {
        active: '🟢',
        inactive: '🔴',
        pending: '⏳',
        crown: '👑',
        bullet: '🔹',
        gear: '⚙️',
        add: '➕',
        stop: '⏹️',
        server: '🌐',
        clock: '⏱️',
        money: '💳',
        success: '✅',
        error: '❌'
    },
    ui: {
        dashboardTitle: 'TASK MANAGER',
        controlPanelTitle: 'ZYRO POST PANEL',
        storeTitle: 'ZYRO POST STORE',
        tutorialTitle: 'PANDUAN MENGAMBIL USER TOKEN',
        statsTitle: 'SYSTEM LIVE STATISTICS'
    }
};

export class ThemeService {
    private static theme: ThemeConfig = { ...DEFAULT_THEME };
    private static configPath = path.join(process.cwd(), 'theme.config.json');

    public static init(): void {
        this.loadTheme();
        
        // Watch for file modifications in development / self-hosted
        try {
            if (fs.existsSync(this.configPath)) {
                fs.watch(this.configPath, (eventType) => {
                    if (eventType === 'change') {
                        Logger.info('theme.config.json changed, reloading styles...', 'ThemeService');
                        this.loadTheme();
                    }
                });
            }
        } catch {
            // Watch might not be supported in some environments
        }
    }

    public static loadTheme(): ThemeConfig {
        try {
            if (fs.existsSync(this.configPath)) {
                const raw = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(raw);
                this.theme = this.deepMerge(DEFAULT_THEME, parsed);
                Logger.info('Custom theme loaded successfully from theme.config.json', 'ThemeService');
            } else {
                // Buat file template jika belum ada
                this.saveDefaultTheme();
            }
        } catch (error: any) {
            Logger.warn(`Failed to parse theme.config.json (${error.message}). Using default theme.`, 'ThemeService');
            this.theme = { ...DEFAULT_THEME };
        }
        return this.theme;
    }

    public static getTheme(): ThemeConfig {
        return this.theme;
    }

    public static parseColor(color: string | number): number {
        if (typeof color === 'number') return color;
        if (typeof color === 'string') {
            const clean = color.replace('#', '').replace('0x', '');
            const parsed = parseInt(clean, 16);
            if (!isNaN(parsed)) return parsed;
        }
        return 0x5865F2;
    }

    private static saveDefaultTheme(): void {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(DEFAULT_THEME, null, 2), 'utf-8');
            Logger.info('Default theme.config.json created for customization', 'ThemeService');
        } catch {}
    }

    private static deepMerge(target: any, source: any): any {
        const output = Object.assign({}, target);
        if (source && typeof source === 'object' && !Array.isArray(source)) {
            Object.keys(source).forEach(key => {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }
}
