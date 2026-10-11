// tests/theme-form-mixins-shots.mjs
// B2 — screenshot 4 tổ hợp OS×theme cho ui-checker: date-picker panel mở (hover ngày)
// + form controls hover. Tổ hợp "lệch" (OS≠app) là 2 ca bug chính.
import { chromium } from '@playwright/test';
import * as fs from 'node:fs';

const PORT = process.env.PORT || 3000;
const BASE = `https://localhost:${PORT}`;
const OUT = 'test-results/ui-check';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

const COMBOS = [
	{ os: 'dark', app: 'light', tag: 'osdark-applight' }, // bug chính user báo
	{ os: 'light', app: 'dark', tag: 'oslight-appdark' },
	{ os: 'dark', app: 'dark', tag: 'osdark-appdark' },
	{ os: 'light', app: 'light', tag: 'oslight-applight' }
];

for (const c of COMBOS) {
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 900, height: 800 },
		colorScheme: c.os
	});
	const page = await context.newPage();
	await page.addInitScript((t) => {
		try {
			localStorage.setItem('theme', t);
		} catch {}
	}, c.app);

	// ── Ảnh 1: date-picker panel mở + hover 1 ngày giữa tháng ──
	await page.goto(`${BASE}/ui/date-picker`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="dp-single"]', { timeout: 30000 });
	await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), c.app);
	await page.waitForTimeout(300);
	await page.locator('[data-test="dp-single"] button').first().click();
	await page.waitForSelector('.date-picker-panel', { timeout: 10000 });
	await page.waitForTimeout(400);
	await page.locator('.date-picker-panel .date-picker-day').nth(10).hover();
	await page.waitForTimeout(400);
	await page.screenshot({ path: `${OUT}/b2-dp-${c.tag}.png`, fullPage: false });

	// ── Ảnh 2: form controls (input + select + toggle pressed + textarea) hover ──
	await page.goto(`${BASE}/ui/input`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="input-email"] .input-root', { timeout: 30000 });
	await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), c.app);
	await page.waitForTimeout(300);
	// ép hover class cho input + chụp section đầu
	await page.evaluate(() => {
		document
			.querySelector('[data-test="input-email"] .input-root')
			?.classList.add('hover');
	});
	await page.locator('[data-test="input-email"]').scrollIntoViewIfNeeded();
	await page.waitForTimeout(400);
	const rect = await page.evaluate(() => {
		const el = document.querySelector('[data-test="input-email"]');
		return el.getBoundingClientRect();
	});
	// chụp vùng quanh input email (chừa tiêu đề section phía trên)
	await page.screenshot({
		path: `${OUT}/b2-input-${c.tag}.png`,
		clip: {
			x: Math.max(0, rect.x - 40),
			y: Math.max(0, rect.y - 90),
			width: Math.min(900, rect.width + 80),
			height: Math.min(400, rect.height + 140)
		}
	});

	await context.close();
	console.log(`OK combo ${c.tag}`);
}

await browser.close();
console.log('DONE');
