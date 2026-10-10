// business-routes-shots.mjs — screenshot admin orders + customers (authed)
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE_URL = 'https://localhost:3000';
const OUT_DIR = 'test-results/business-routes';

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
const page = await context.newPage();

// Login
await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.form-root .auth-input-wrapper input', { timeout: 20000 });
await page.locator('.form-root .auth-input-wrapper input').first().fill('admin');
await page.locator('.form-root .auth-input-wrapper input').nth(1).fill('123123_Qwe');
await page.locator('.auth-btn-submit').first().click();
await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 });
console.log('logged in');

for (const p of ['orders', 'customers']) {
	await page.goto(`${BASE_URL}/admin/${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector('.admin-page', { timeout: 20000 });
	// Đợi stats fetch settle — 3 stat-value số (TOTAL/TODAY/REVENUE|ACTIVE) hết "—".
	// KHÔNG đòi STATUS card ≠ "—": breakdown rỗng (DB trống) hiển thị chip "—" cố định.
	try {
		await page.waitForFunction(
			() => {
				const values = Array.from(document.querySelectorAll('.admin-stats .stat-value'));
				return values.length >= 3 && values.every((el) => el.textContent?.trim() !== '—');
			},
			{ timeout: 20000 }
		);
	} catch {
		console.log(`warn: ${p} stats chưa settle sau 20s — chụp với placeholder`);
	}
	await page.waitForTimeout(400); // paint settle
	await page.screenshot({ path: `${OUT_DIR}/admin-${p}.png`, fullPage: false });
	console.log(`shot: admin-${p}.png`);
}

await browser.close();
console.log('DONE');
