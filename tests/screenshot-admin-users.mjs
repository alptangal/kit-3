// tests/screenshot-admin-users.mjs
// B6.2: chụp Users page (DataTable migrate) — desktop + mobile expand bar.
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const DIR = 'tests/screenshots/admin-users';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(400);
await page.locator('.auth-input-wrapper input').first().fill('admin');
await sleep(300);
await page.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
await sleep(500);
await page.locator('.auth-btn-submit').first().click();
await page.waitForURL((u) => !u.toString().includes('/login'), {
	waitUntil: 'domcontentloaded',
	timeout: 20000
});

await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
// Poll table (fetchSecure 6-8s cold)
for (let i = 0; i < 50; i++) {
	const rows = await page.evaluate(
		() => document.querySelectorAll('[data-test="users-datatable"] tbody tr').length
	);
	if (rows > 0) break;
	await sleep(400);
}
await sleep(600);

// 1) Desktop: toàn trang inset (sidebar + breadcrumb + DataTable + pagination)
await page.screenshot({ path: `${DIR}/01-users-desktop.png`, fullPage: false });

// 2) Desktop: hover row 1 → actions hiện (rowActions opacity CSS) → chụp khu table
const wrap = page.locator('.admin-table-wrap');
await page.locator('[data-test="users-datatable"] tbody tr').first().hover();
await sleep(400);
await wrap.screenshot({ path: `${DIR}/02-users-actions-hover.png` });
await page.mouse.move(640, 200);
await sleep(300);

// 3+4) Mobile: phải dùng context THẬT (hasTouch) — media query
// (hover:none)(pointer:coarse) chỉ match khi có touch; context desktop
// thu viewport không đổi pointer → cột actions không ẩn.
const mobileCtx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 700 },
	hasTouch: true,
	isMobile: true,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
});
const mpage = await mobileCtx.newPage();
await mpage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await mpage.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(400);
await mpage.locator('.auth-input-wrapper input').first().fill('admin');
await sleep(300);
await mpage.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
await sleep(500);
await mpage.locator('.auth-btn-submit').first().click();
await mpage.waitForURL((u) => !u.toString().includes('/login'), {
	waitUntil: 'domcontentloaded',
	timeout: 20000
});
await mpage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
for (let i = 0; i < 50; i++) {
	const rows = await mpage.evaluate(
		() => document.querySelectorAll('[data-test="users-datatable"] tbody tr').length
	);
	if (rows > 0) break;
	await sleep(400);
}
await sleep(600);

// 3) Mobile: toàn trang (header hamburger + breadcrumb + table + pagination)
await mpage.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await mpage.screenshot({ path: `${DIR}/03-users-mobile.png`, fullPage: false });

// 4) Mobile: tap row 1 → expand action bar (snippet 5 nút)
await mpage.locator('[data-test="users-datatable"] tbody tr').first().tap();
await sleep(700);
await mpage.screenshot({ path: `${DIR}/04-users-mobile-actions.png`, fullPage: false });
await mobileCtx.close();

console.log('DONE 4 screenshots');
await browser.close();
