// tests/screenshot-avatar.mjs — chụp screenshot demo Avatar composite.
// Output: tests/screenshot/avatar/01-avatar-cases.png
// App layout dùng container fixed height (overflow-auto) → fullPage không capture
// được hết. Giải pháp (theo convention project): đo chiều cao content → resize
// viewport đủ cao → chụp viewport.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join('tests', 'screenshot', 'avatar');
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

await page.goto('https://127.0.0.1:3000/ui/avatar', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.avatar-root', { timeout: 30000 });

// Ổn định layout (đợi CSS scoped + hydration apply; reload nếu page render hẹp).
for (let i = 0; i < 5; i++) {
	const w = await page.evaluate(() => document.querySelector('[data-test="avatar-demo"]')?.getBoundingClientRect().width ?? 0);
	if (w > 500) break;
	if (i === 2) {
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.waitForSelector('.avatar-root', { timeout: 30000 });
	}
	await sleep(400);
}
// Chờ onload data-URI + fade-out fallback ổn định.
await sleep(500);

// Đo chiều cao content → resize viewport đủ cao để chụp 1 lần full.
const contentH = await page.evaluate(
	() => Math.ceil(document.querySelector('[data-test="avatar-demo"]')?.scrollHeight ?? 900) + 60
);
await page.setViewportSize({ width: 1280, height: contentH });
await sleep(400);

await page.screenshot({ path: join(OUT, '01-avatar-cases.png') });
console.log('captured', join(OUT, '01-avatar-cases.png'), 'viewport h=', contentH);

await browser.close();
console.log('done');
