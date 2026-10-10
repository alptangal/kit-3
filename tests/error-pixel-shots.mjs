// tests/error-pixel-shots.mjs — screenshot ErrorPage pixel-digit (404/500) full viewport
// Chạy: node tests/error-pixel-shots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000';
const OUT = 'tests/screenshots/error-pixel';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

for (const status of [404, 500]) {
	const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
	const page = await context.newPage();
	await page.goto(`${BASE}/ui/error?status=${status}`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(1200);
	// page.screenshot full viewport (tránh clip element bị xé — bẫy đã biết)
	await page.screenshot({ path: `${OUT}/error-${status}.png` });
	console.log(`shot: ${OUT}/error-${status}.png`);
	await context.close();
}

await browser.close();
console.log('DONE');
