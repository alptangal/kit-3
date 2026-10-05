// tests/screenshot/chart/shoot.mjs
// Chụp screenshot Chart demo (DSF2, light scheme).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/chart', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.chart-root', { timeout: 20000 });
// Chờ animation bar-grow/line-draw xong (300ms) + buffer
await page.waitForTimeout(700);

// 01-bar: section bar đơn
await page.locator('[data-test="chart-bar"]').screenshot({ path: `${__dirname}/01-bar.png` });
console.log('shot 01-bar.png');

// 02-line-area: section line (showArea + showPoints)
await page.locator('[data-test="chart-line"]').screenshot({ path: `${__dirname}/02-line-area.png` });
console.log('shot 02-line-area.png');

await browser.close();
console.log('DONE');
