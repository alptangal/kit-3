// tests/screenshot-date-picker.mjs — chụp DatePicker (DSF2, light scheme).
// 01-closed.png: page toàn bộ, panel đóng.
// 02-open.png: case single mở panel calendar (hôm nay ring + ngày chọn primary).
// 03-range.png: case min/max mở (ô chặn faded).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const DIR = 'tests/screenshot/date-picker';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();

await page.goto('https://localhost:3000/ui/date-picker', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.date-picker-root', { timeout: 20000 });
await page.waitForTimeout(500);

// 01 — closed
await page.screenshot({ path: `${DIR}/01-closed.png` });

// 02 — single open
await page.locator('[data-test="dp-single"] [data-dp-trigger]').click();
await page.waitForSelector('[data-test="dp-single"] [data-dp-panel]', { timeout: 10000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${DIR}/02-open.png` });

// đóng (Escape)
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// 03 — min/max open
await page.locator('[data-test="dp-range"] [data-dp-trigger]').click();
await page.waitForSelector('[data-test="dp-range"] [data-dp-panel]', { timeout: 10000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${DIR}/03-range.png` });

await browser.close();
console.log('screenshots done:', DIR);
