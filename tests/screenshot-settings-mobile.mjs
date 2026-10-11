// tests/screenshot-settings-mobile.mjs
// Chụp 3 ảnh B5 (Pha 3): mobile 375 accordion (mở general + action bar sau
// khi sửa), desktop 1280 tabs, mobile accordion mở item security. Ảnh vào
// test-results/ui-check/ để ui-checker đọc.
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

// Đợi tabs ổn định sau load (mirror probe: SSR render nhánh else → loadSettings
// → loading=true → tabs unmount → remount; poll 3 lần liên tiếp mới算 ổn định).
async function waitStableTabs(page) {
	let stableCount = 0;
	for (let i = 0; i < 60 && stableCount < 3; i++) {
		const present = (await page.locator('[data-test="settings-tabs"]').count()) > 0;
		stableCount = present ? stableCount + 1 : 0;
		if (stableCount < 3) await sleep(400);
	}
}

async function main() {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const browser = await chromium.launch({
		headless: true,
		args: ['--ignore-certificate-errors']
	});
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 375, height: 700 },
		colorScheme: 'light'
	});
	const page = await context.newPage();
	await login(page);
	await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await waitStableTabs(page);
	await sleep(600);

	// 1. MOBILE 375 — accordion mở general, sửa appName → action bar hiện.
	// Chụp VIEWPORT (KHÔNG fullPage): bar position:fixed — fullPage ghép tile
	// theo scroll khiến fixed bar render 1 lần ở tile cuối, sai vị trí thật.
	await page.locator('[data-test="acc-trigger-general"]').click();
	await sleep(500);
	const appNameInput = page.locator('[data-test="acc-content-general"] input').first();
	const original = await appNameInput.inputValue();
	await appNameInput.fill(original + '_x');
	await sleep(500); // action bar hiện khi modified
	await page.screenshot({ path: path.join(OUT_DIR, 'b5-settings-mobile-action-bar.png') });

	// 2. MOBILE — hủy thay đổi (bar ẩn + toast), chụp viewport security mở.
	// Đợi toast tắt (5s mặc định) để không che item — bẫy ảnh cũ.
	await page.locator('[data-test="settings-cancel"]').click();
	await sleep(5000);
	await page.locator('[data-test="acc-trigger-security"]').click();
	await sleep(500);
	await page.screenshot({ path: path.join(OUT_DIR, 'b5-settings-mobile-security.png') });

	// 3. DESKTOP 1280 — tabs như cũ, action bar ẨN, Save ở header
	await page.setViewportSize({ width: 1280, height: 900 });
	await sleep(600);
	// Mở tab security để chụp cả snippet render trong Tabs.Content
	await page.locator('[data-test="tab-trigger-security"]').click();
	await sleep(500);
	await page.screenshot({ path: path.join(OUT_DIR, 'b5-settings-desktop-tabs.png'), fullPage: true });

	await browser.close();
	console.log('DONE — 3 ảnh vào', OUT_DIR);
}

main().catch((err) => {
	console.error('Screenshot error:', err);
	process.exitCode = 1;
});
