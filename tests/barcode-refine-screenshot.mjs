// barcode-refine-screenshot.mjs — chụp 3 ảnh section refinement:
//   1. ib-select-all: tick 2 mã → clear-all "Xóa 2 mã đã chọn" (quickbar ẩn)
//   2. ib-select-delete: tick 2 mã → quickbar GIỮ NGUYÊN (fix regression IB4)
//   3. ib-base: camera overlay fullscreen (video + nút pause + close)
// Chạy: node tests/barcode-refine-screenshot.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = `${process.env.PROBE_BASE || 'https://localhost:3000'}/ui/input`;
const OUT = 'tests/screenshots/input-barcode';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-demo"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await sleep(400);

// ── Ảnh 1: ib-select-all — 2 mã tick → clear-all hiện "Xóa 2 mã đã chọn" ──
const inputAll = page.locator('[data-test="ib-select-all"] [data-test="input-barcode-input"]');
for (const code of ['8938506952141', '1234567890123']) {
	await inputAll.click();
	await sleep(100);
	await inputAll.fill(code);
	await page.keyboard.press('Enter');
	await sleep(300);
}
await page.locator('[data-test="ib-select-all"] [data-test="input-barcode-check"]').nth(0).click();
await sleep(200);
await page.locator('[data-test="ib-select-all"] [data-test="input-barcode-check"]').nth(1).click();
await sleep(300);
// DOM verify trước khi chụp: clear-all hiện + quickbar ẩn
const state1 = await page.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-select-all"]');
	return {
		clear: Boolean(wrap?.querySelector('[data-test="input-barcode-clear-all"]')),
		quickbar: Boolean(wrap?.querySelector('[data-test="input-barcode-quickbar"]')),
		label: wrap?.querySelector('[data-test="input-barcode-clear-all"]')?.textContent?.trim() ?? ''
	};
});
console.log('IMG1 state:', JSON.stringify(state1));
await page.locator('[data-test="ib-select-all"]').screenshot({ path: `${OUT}/refine-1-clear-all-selected.png` });

// ── Ảnh 2: ib-select-delete — 2 mã tick → quickbar GIỮ NGUYÊN (không selectAllOn) ──
const inputDel = page.locator('[data-test="ib-select-delete"] [data-test="input-barcode-input"]');
for (const code of ['SELCODE1', 'SELCODE2']) {
	await inputDel.click();
	await sleep(100);
	await inputDel.fill(code);
	await page.keyboard.press('Enter');
	await sleep(300);
}
await page.locator('[data-test="ib-select-delete"] [data-test="input-barcode-check"]').nth(0).click();
await sleep(200);
await page.locator('[data-test="ib-select-delete"] [data-test="input-barcode-check"]').nth(1).click();
await sleep(300);
const state2 = await page.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-select-delete"]');
	return {
		clear: Boolean(wrap?.querySelector('[data-test="input-barcode-clear-all"]')),
		quickbar: Boolean(wrap?.querySelector('[data-test="input-barcode-quickbar"]')),
		quickbarLabel: wrap
		?.querySelector('[data-test="input-barcode-quickbar"]')
		?.textContent?.trim() ?? ''
	};
});
console.log('IMG2 state:', JSON.stringify(state2));
await page.locator('[data-test="ib-select-delete"]').screenshot({ path: `${OUT}/refine-2-quickbar-multi.png` });

// ── Ảnh 3: ib-base — camera overlay fullscreen (mock stream nền trắng + QR) ──
await context.addInitScript(() => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, 640, 480);
	const stream = canvas.captureStream(15);
	navigator.mediaDevices.getUserMedia = async () => stream;
});
// addInitScript chạy cho page MỚI — mở page riêng cho ảnh 3
const page3 = await context.newPage();
await page3.goto(BASE, { waitUntil: 'domcontentloaded' });
await page3.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await sleep(400);
await page3.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"]').click();
await page3
	.locator('[data-test="ib-base"] [data-test="input-barcode-overlay"]')
	.waitFor({ timeout: 15000 });
await sleep(800); // fullscreen transition + video attach
const state3 = await page3.evaluate(() => ({
	fsIsOverlay: document.fullscreenElement?.getAttribute('data-test') === 'input-barcode-overlay',
	hasVideo: Boolean(document.querySelector('[data-test="ib-base"] video')),
	hasPause: Boolean(
		document.querySelector('[data-test="ib-base"] [aria-label="Tạm dừng quét"]')
	),
	hasClose: Boolean(
		document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay-close"]')
	)
}));
console.log('IMG3 state:', JSON.stringify(state3));
// Fullscreen element = overlay → chụp toàn màn hình trang
await page3.screenshot({ path: `${OUT}/refine-3-camera-fullscreen.png` });
await page3.keyboard.press('Escape');
await sleep(400);

await browser.close();
console.log('DONE — 3 ảnh trong', OUT);
