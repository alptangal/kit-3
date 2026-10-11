// tests/screenshot-admin-layout.mjs
// Chụp 3 ảnh B6.1 (Pha 3): admin layout desktop 1280 (sidebar mở + breadcrumb +
// bảng users), collapsed (icon rail), mobile 375 (offcanvas sau khi mở qua
// trigger). Ảnh vào test-results/ui-check/ để ui-checker đọc.
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

// Users list fetchSecure chậm 6-8s (Couchbase cold) → poll tbody xuất hiện.
async function waitTable(page) {
	for (let i = 0; i < 50; i++) {
		const n = await page.locator('tbody tr').count();
		if (n > 0) return;
		await sleep(400);
	}
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
	await waitTable(page);
	await sleep(500);

	// 1. Desktop expanded — sidebar + breadcrumb + bảng users
	await page.screenshot({ path: path.join(OUT_DIR, 'b61-admin-desktop.png') });

	// 2. Desktop collapsed (icon rail) — click trigger trong header sidebar.
	// Bẫy peek: sau click chuột vẫn ở trong aside → CSS :hover mở rộng tạm
	// (peek P2) → ảnh trông expanded. Di chuột ra giữa content trước khi chụp.
	await page.locator('[data-test="admin-trigger-row"] button').first().click();
	await sleep(400);
	await page.mouse.move(900, 450);
	await sleep(700);
	await page.screenshot({ path: path.join(OUT_DIR, 'b61-admin-collapsed.png') });

	// 3. Mobile 375 — offcanvas: nút trigger trong inset header (.admin-mobile-
	// trigger chỉ hiện mobile) mở overlay sidebar.
	await page.setViewportSize({ width: 375, height: 700 });
	await sleep(800);
	await page.locator('.admin-mobile-trigger button').first().click();
	await sleep(900);
	await page.screenshot({ path: path.join(OUT_DIR, 'b61-admin-mobile-offcanvas.png') });

	await browser.close();
	console.log('DONE — 3 ảnh vào', OUT_DIR);
}

main().catch((err) => {
	console.error('Screenshot error:', err);
	process.exitCode = 1;
});
