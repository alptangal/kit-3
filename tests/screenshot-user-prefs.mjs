// tests/screenshot-user-prefs.mjs
// Chụp 4 ảnh per-user preferences (WIP theme + language persist DB):
//   1. admin desktop LIGHT — theme attr = light, UI tiếng Việt
//   2. admin desktop DARK — sau khi toggle theme qua /ui/theme (client-side)
//   3. admin mobile 375 DARK — reload (theme từ DB, localStorage đã xóa)
//   4. login page LIGHT — đăng xuất, theme reset về mặc định (không prefs layout)
// Ảnh vào test-results/ui-check/ để ui-checker đọc.
import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = 'https://localhost:3000';
const OUT_DIR = 'test-results/ui-check';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
	await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
	await sleep(500);
	await page.locator('.auth-input-wrapper input').first().fill('admin');
	await sleep(400);
	await page.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
	await sleep(600);
	await page.locator('.auth-btn-submit').first().click();
	await page.waitForURL((u) => !u.toString().includes('/login'), {
		waitUntil: 'domcontentloaded',
		timeout: 20000
	});
	await sleep(1000);
}

async function main() {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 900 },
		colorScheme: 'light'
	});
	const page = await context.newPage();
	await login(page);
	await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await sleep(1500);

	// 1. Desktop light (hoặc dark nếu DB đã persist dark từ probe trước —
	// đọc attr rồi ép về light qua localStorage + reload để ảnh deterministic)
	const attr1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
	console.log('theme attr sau login:', attr1);

	// Ép light: localStorage + reload (không xóa DB — chỉ ảnh hiển thị)
	if (attr1 !== 'light') {
		await page.evaluate(() => localStorage.setItem('theme', 'light'));
		await page.reload({ waitUntil: 'domcontentloaded' });
		await sleep(1200);
	}
	await page.screenshot({ path: path.join(OUT_DIR, 'prefs-admin-desktop-light.png') });

	// 2. Desktop dark — client-side sang /ui/theme, bấm toggle, chờ debounce POST
	await page.evaluate(() => {
		const a = document.createElement('a');
		a.href = '/ui/theme';
		a.id = 'probe-nav-link';
		a.textContent = 'probe-nav';
		document.body.appendChild(a);
	});
	await page.locator('#probe-nav-link').click({ force: true });
	await page.waitForURL('**/ui/theme', { timeout: 8000 });
	await sleep(800);
	await page.locator('[data-test="theme-toggle"] button').first().click();
	// Chờ POST update hoàn tất (debounce 500ms) TRƯỚC KHI rời trang —
	// fetch fire-and-forget bị hủy khi goto rời page (bẫy đã gặp: ảnh dark
	// thực ra light vì POST chưa bay).
	const postDone = page
		.waitForResponse(
			(r) =>
				r.url().includes('/api/admin/user-preferences/update') &&
				(r.request().method() === 'POST' || r.request().method() === 'PUT')
			,
			{ timeout: 8000 }
		)
		.catch(() => null);
	await postDone;
	const attr2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
	console.log('theme attr sau toggle:', attr2);

	// Về admin, xóa localStorage, reload → theme phải từ DB (dark)
	await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.evaluate(() => localStorage.removeItem('theme'));
	await page.reload({ waitUntil: 'domcontentloaded' });
	await sleep(1500);
	await page.screenshot({ path: path.join(OUT_DIR, 'prefs-admin-desktop-dark.png') });

	// 3. Mobile 375 dark (theme vẫn từ DB)
	await page.setViewportSize({ width: 375, height: 700 });
	await sleep(1000);
	await page.screenshot({ path: path.join(OUT_DIR, 'prefs-admin-mobile-dark.png') });

	// 4. Login page — không có route logout trực tiếp; goto /login (nếu còn
	// session sẽ redirect về / — chụp login form bằng context mới sạch cookie
	// không cần thiết, chỉ cần ảnh login sau khi đăng xuất thật qua API không
	// khả thi ở probe — dùng context riêng)
	const ctx2 = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 900 },
		colorScheme: 'light'
	});
	const page2 = await ctx2.newPage();
	await page2.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await sleep(1200);
	await page2.screenshot({ path: path.join(OUT_DIR, 'prefs-login-page.png') });

	await browser.close();
	console.log('DONE — 4 ảnh vào', OUT_DIR);
}

main().catch((e) => {
	console.error('FATAL:', e);
	process.exit(1);
});
