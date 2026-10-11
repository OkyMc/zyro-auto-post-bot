/**
 * Smartly splits a message into chunks of <2000 characters.
 * Respects Code Blocks (```) and Custom Emojis (<:name:id>).
 */
export function smartSplit(text: string, maxLength: number = 2000): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let currentText = text;

    while (currentText.length > maxLength) {
        let splitIndex = maxLength;

        // 1. Safety Check: Don't cut inside a Custom Emoji (<:name:id>)
        const lastOpenBracket = currentText.lastIndexOf('<', splitIndex);
        if (lastOpenBracket !== -1 && lastOpenBracket > splitIndex - 60) {
            const closingBracket = currentText.indexOf('>', lastOpenBracket);
            if (closingBracket > splitIndex) {
                splitIndex = lastOpenBracket;
            }
        }

        // 2. Safety Check: Don't cut inside a Code Block (```)
        const chunk = currentText.substring(0, splitIndex);
        const backtickCount = (chunk.match(/```/g) || []).length;
        if (backtickCount % 2 !== 0) {
            const lastBackticks = chunk.lastIndexOf('```');
            if (lastBackticks !== -1) {
                splitIndex = lastBackticks;
            }
        }

        // 3. Preference: Cut at a newline or space
        const lastNewline = currentText.lastIndexOf('\n', splitIndex);
        if (lastNewline !== -1 && lastNewline > splitIndex * 0.7) {
            splitIndex = lastNewline;
        } else {
            const lastSpace = currentText.lastIndexOf(' ', splitIndex);
            if (lastSpace !== -1 && lastSpace > splitIndex * 0.7) {
                splitIndex = lastSpace;
            }
        }

        // Final Push
        chunks.push(currentText.substring(0, splitIndex));
        currentText = currentText.substring(splitIndex).trim();
    }

    if (currentText.length > 0) {
        chunks.push(currentText);
    }

    return chunks;
}

/**
 * Parses Spintax formatted text (e.g. "{Hello|Hi|Hey} there!").
 * Randomly picks one variation to prevent spam detection.
 */
export function parseSpintax(text: string): string {
    const spintaxRegex = /\{([^{}]+)\}/g;
    let result = text;
    let match;
    while ((match = spintaxRegex.exec(result)) !== null) {
        const options = match[1].split('|');
        const randomOption = options[Math.floor(Math.random() * options.length)];
        result = result.substring(0, match.index) + randomOption + result.substring(match.index + match[0].length);
        spintaxRegex.lastIndex = 0; // Reset regex
    }
    return result;
}

/**
 * Appends randomized invisible unicode characters (\u200B, \u200C, \u200D, \uFEFF)
 * to make every message payload have a distinct hash, evading Discord duplicate message filters.
 */
export function addInvisibleJitter(text: string): string {
    const invisibleChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    const count = Math.floor(Math.random() * 3) + 1;
    let jitter = '';
    for (let i = 0; i < count; i++) {
        jitter += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
    }
    return text + jitter;
}
