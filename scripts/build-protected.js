const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

if (!fs.existsSync(DIST_DIR)) {
    console.error('\x1b[31m❌ Error: Folder dist/ tidak ditemukan! Jalankan npm run build terlebih dahulu.\x1b[0m');
    process.exit(1);
}

// File Core yang WAJIB diproteksi ketat (Anti-Bypass & Anti-Tamper)
const PROTECTED_CORE_FILES = [
    'services/license.service.js',
    'services/worker.service.js',
    'workers/bot.worker.js',
    'utils/security.js',
    'services/scheduler.service.js'
];

function getAllJsFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllJsFiles(fullPath, arrayOfFiles);
        } else if (file.endsWith('.js')) {
            arrayOfFiles.push(fullPath);
        }
    });

    return arrayOfFiles;
}

console.log('\n\x1b[36m==============================================================\x1b[0m');
console.log('\x1b[1m\x1b[32m       🔒 ZYRO POST - SELECTIVE CORE PROTECTION PIPELINE       \x1b[0m');
console.log('\x1b[36m==============================================================\x1b[0m');
console.log('\x1b[33m💡 Arsitektur: "Protected Core Engine + Open Customization Layer"\x1b[0m');
console.log('   - Core License & Worker Engine : \x1b[31mTERKUNCI & TER-OBFUSCATE\x1b[0m');
console.log('   - Views, Themes, Plugins & UI : \x1b[32mTERBUKA & BEBAS DIEDIT USER\x1b[0m\n');

const jsFiles = getAllJsFiles(DIST_DIR);
let protectedCount = 0;
let openCount = 0;

jsFiles.forEach((filePath) => {
    const relativePath = path.relative(DIST_DIR, filePath).replace(/\\/g, '/');
    const isProtected = PROTECTED_CORE_FILES.some(pattern => relativePath.endsWith(pattern));

    if (isProtected) {
        try {
            const code = fs.readFileSync(filePath, 'utf-8');

            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.8,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.4,
                debugProtection: false,
                disableConsoleOutput: false,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: true,
                renameGlobals: false,
                selfDefending: false,
                simplify: true,
                splitStrings: true,
                splitStringsChunkLength: 5,
                stringArray: true,
                stringArrayCallsTransform: true,
                stringArrayEncoding: ['base64', 'rc4'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 2,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 4,
                stringArrayWrappersType: 'function',
                stringArrayThreshold: 0.8,
                target: 'node',
                transformObjectKeys: true,
                unicodeEscapeSequence: false
            });

            fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode(), 'utf-8');
            console.log(` \x1b[31m🔒 [PROTECTED CORE]:\x1b[0m ${relativePath}`);
            protectedCount++;
        } catch (err) {
            console.error(` \x1b[31m✖ Failed to protect:\x1b[0m ${relativePath} (${err.message})`);
        }
    } else {
        console.log(` \x1b[32m🔓 [OPEN CUSTOMIZABLE]:\x1b[0m ${relativePath}`);
        openCount++;
    }
});

// Pastikan theme.config.json & custom/ ada di root
const themeJsonPath = path.join(ROOT_DIR, 'theme.config.json');
if (!fs.existsSync(themeJsonPath)) {
    console.log('[Theme] 🎨 Membuat theme.config.json default...');
    // Akan di-generate otomatis saat boot
}

console.log(`\n\x1b[32m🎉 BUILD SELESAI!\x1b[0m`);
console.log(` \x1b[31m🔒 ${protectedCount} Core files ter-enkripsi & ter-obfuscate.\x1b[0m`);
console.log(` \x1b[32m🔓 ${openCount} UI/Customization files dibiarkan terbuka untuk diedit buyer.\x1b[0m`);
console.log('\x1b[33m💡 Sekarang user bisa ubah tampilan & system sesuka dia tanpa bisa bypass lisensi!\x1b[0m\n');
