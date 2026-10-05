// tests/screenshot-card.mjs — chụp screenshot demo Card composite.
// Output: tests/screenshot/card/01-card-cases.png
// App layout dùng container fixed height (overflow-auto) → fullPage không capture được
// hết. Giải pháp (theo convention project): đo chiều cao content → resize viewport
// đủ cao → chụp viewport.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join('tests', 'screenshot', 'card');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto('https://127.0.0.1:3000/ui/card', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.card-root', { timeout: 30000 });

// Ổn định layout (đợi CSS scoped + hydration apply; reload nếu page render hẹp).
for (let i = 0; i < 5; i++) {
	const w = await page.evaluate(() => document.querySelector('[data-test="card-demo"]')?.getBoundingClientRect().width ?? 0);
	if (w > 500) break;
	if (i === 2) {
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.waitForSelector('.card-root', { timeout: 30000 });
	}
	await sleep(400);
}

// Đo chiều cao content → resize viewport đủ cao để chụp 1 lần full.
const contentH = await page.evaluate(
	() => Math.ceil(document.querySelector('[data-test="card-demo"]')?.scrollHeight ?? 900) + 60
);
await page.setViewportSize({ width: 1280, height: contentH });
await sleep(400);

await page.screenshot({ path: join(OUT, '01-card-cases.png') });
console.log('captured', join(OUT, '01-card-cases.png'), 'viewport h=', contentH);

await browser.close();
console.log('done');
