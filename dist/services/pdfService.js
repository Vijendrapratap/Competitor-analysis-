// =============================================================================
// PDF Service — HTML → PDF via Puppeteer (headless Chromium)
//
// Maintains a singleton browser instance. PDF is returned as a Buffer and
// streamed directly to the HTTP response — never written to disk.
// =============================================================================
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ── Singleton browser instance (reused across requests) ──
let _browser = null;
async function getBrowser() {
    if (!_browser || !_browser.connected) {
        _browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--font-render-hinting=none', // Better Thai font rendering
                '--disable-web-security',
            ],
        });
    }
    return _browser;
}
// ── Read base CSS once at module load ────────────────────
const CSS_PATH = path.join(__dirname, '../templates/base_styles.css');
const BASE_CSS = fs.existsSync(CSS_PATH)
    ? fs.readFileSync(CSS_PATH, 'utf8')
    : '';
// ── Inject CSS into HTML if no <style> or <link> found ──
function injectCss(html) {
    if (html.includes('<style') || html.includes('<link'))
        return html;
    return html.replace('</head>', `<style>${BASE_CSS}</style></head>`);
}
/**
 * Convert full report HTML to a PDF Buffer.
 */
export async function htmlToPdfBuffer(htmlContent) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(injectCss(htmlContent), {
            waitUntil: 'networkidle0', // Let Google Fonts load
            timeout: 45_000,
        });
        // Ensure all fonts (incl. Noto Sans Thai) are rendered
        await page.evaluateHandle('document.fonts.ready');
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true, // Required for colored section headers
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });
        return Buffer.from(pdf);
    }
    finally {
        await page.close();
    }
}
/**
 * Single competitor page → standalone PDF.
 */
export async function competitorToPdfBuffer(competitorHtml, reportTitle) {
    const wrapped = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${reportTitle}</title>
</head>
<body>${competitorHtml}</body>
</html>`;
    return htmlToPdfBuffer(wrapped);
}
/**
 * Cleanup — call on graceful server shutdown.
 */
export async function closeBrowser() {
    if (_browser) {
        await _browser.close();
        _browser = null;
    }
}
//# sourceMappingURL=pdfService.js.map