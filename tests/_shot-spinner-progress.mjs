// Chụp screenshot Spinner + Progress (light scheme, DSF2). Chạy: node tests/_shot-spinner-progress.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('tests/screenshot/spinner', { recursive: true });
mkdirSync('tests/screenshot/progress', { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// Spinner: viewport cao (2600px) để matrix 4×4 không bị crop.
const contextSpinner = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 2600 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const pageSpinner = await contextSpinner.newPage();
pageSpinner.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await pageSpinner.goto('https://localhost:3000/ui/spinner', { waitUntil: 'domcontentloaded', timeout: 120000 });
await pageSpinner.waitForSelector('.spinner-root', { timeout: 30000 });
await pageSpinner.waitForTimeout(600);
await pageSpinner.screenshot({ path: 'tests/screenshot/spinner/01-spinner-matrix.png', fullPage: true });
console.log('shot spinner OK');
await contextSpinner.close();

// Progress: viewport chuẩn 900px.
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/progress', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.progress-root', { timeout: 30000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'tests/screenshot/progress/01-progress-cases.png', fullPage: true });
console.log('shot progress OK');

await browser.close();
