// tests/screenshot-popover.mjs — chụp Popover + HoverCard với panel MỞ.
// Popover: mở bằng nút controlled "Mở bằng state" (nằm NGOÀI root → click không
// kích hoạt outside-close). HoverCard: hover trigger user-1, giữ chuột tại chỗ.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'screenshot');

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

// --- Popover (panel controlled mở) ---
await page.goto('https://localhost:3000/ui/popover', { waitUntil: 'networkidle' });
await page.waitForSelector('.popover-root');
// Mở panel controlled (P7b — nút toggle nằm ngoài root nên không tự đóng).
await page.click('[data-test="pv-controlled-toggle"]');
await page.waitForSelector('.popover-content.open, [role="dialog"]', { timeout: 5000 });
await page.waitForTimeout(300);
fs.mkdirSync(path.join(OUT, 'popover'), { recursive: true });
await page.screenshot({ path: path.join(OUT, 'popover/01-popover-cases.png') });
console.log('Screenshot popover OK');

// --- HoverCard (hover user-1, card mở) ---
await page.goto('https://localhost:3000/ui/hover-card', { waitUntil: 'networkidle' });
await page.waitForSelector('.hover-card-root');
await page.hover('[data-test="hc-user-u1"]');
await page.waitForSelector('[role="tooltip"]', { timeout: 5000 });
await page.waitForTimeout(300);
fs.mkdirSync(path.join(OUT, 'hover-card'), { recursive: true });
await page.screenshot({ path: path.join(OUT, 'hover-card/01-hover-card.png') });
console.log('Screenshot hover-card OK');

await browser.close();
