// tests/toast-wave9-shot.mjs
// Screenshot minh họa Wave 9 Toast:
//  09 — toast Success (icon + title + description + action) căn giữa trục X
//  10 — toast với close button SQUARE RATIO (hover toast → nút hiện)
// Tuần tự (KHÔNG chạy 2 script song song — bẫy 2 script đè cùng tên file → ảnh xé).
import { chromium } from '@playwright/test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = process.env.PORT || 3000;
const BASE = `https://localhost:${PORT}`;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(`${BASE}/ui/toast`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 30000 });
await sleep(500);

// ── 09 — toast Success (icon + title + description + action) ──
await page.locator('[data-test="toast-btn-success"]').click();
await page
	.locator('.toast-root', { hasText: 'Đã lưu thành công' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(1500); // iconify load xong (svg icon hiện đủ)

// Crop vùng toast (clip element screenshot) — toast ở bottom center
const toast09 = page.locator('.toast-root', { hasText: 'Đã lưu thành công' });
const box09 = await toast09.boundingBox();
if (box09) {
	// Pad 20px mỗi phía để ló close button (translate 50%) + shadow
	await page.screenshot({
		path: 'tests/screenshots/toast/09-wave9-align.png',
		clip: {
			x: Math.max(0, box09.x - 30),
			y: Math.max(0, box09.y - 30),
			width: box09.width + 60,
			height: box09.height + 60
		}
	});
	console.log('09-wave9-align captured');
} else {
	await page.screenshot({ path: 'tests/screenshots/toast/09-wave9-align.png' });
	console.log('09-wave9-align captured (full page — no bounding box)');
}

// ── 10 — toast với close button SQUARE (hover) ──
// Vẫn dùng toast Success đang hiện: hover → close button hiện.
await toast09.hover();
await sleep(400); // nút close render khi hover + aspect-square áp dụng

const toast10 = page.locator('.toast-root', { hasText: 'Đã lưu thành công' });
const box10 = await toast10.boundingBox();
// Chuột đang hover toast → close button hiện + KHÔNG biến mất (toast là infinite?
// không — success 3s: đo nhanh trước khi tự dismiss; nếu mất thì fire lại)
const closeVisible = await toast10.locator('button[aria-label="Đóng thông báo"]').isVisible();
if (!closeVisible) {
	console.log('close not visible — refire');
	await page.locator('[data-test="toast-btn-remove"]').click();
	await sleep(400);
	await page.locator('[data-test="toast-btn-success"]').click();
	await sleep(1200);
	await toast09.hover();
	await sleep(400);
}
const box10b = await toast10.boundingBox();
if (box10b) {
	await page.screenshot({
		path: 'tests/screenshots/toast/10-wave9-close-square.png',
		clip: {
			x: Math.max(0, box10b.x - 30),
			y: Math.max(0, box10b.y - 30),
			width: box10b.width + 60,
			height: box10b.height + 60
		}
	});
	console.log('10-wave9-close-square captured');
} else {
	await page.screenshot({ path: 'tests/screenshots/toast/10-wave9-close-square.png' });
	console.log('10-wave9-close-square captured (full page)');
}

await browser.close();
console.log('done');
