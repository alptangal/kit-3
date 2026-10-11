// tests/screenshot-barcode-fix.mjs — 4 ảnh batch fix barcode vào tests/screenshot/barcode-fix/
// 01: duplicate Enter → toast warning + card animate (chụp NGAY khi animate chạy)
// 02: duplicate toast + card sau animate (trạng thái cuối)
// 03: quét mock trùng → overlay auto-close + toast + card animate
// 04: mobile mở camera scan → input blur, keyboard ẩn, overlay fullscreen
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const shotDir = 'tests/screenshot/barcode-fix';
mkdirSync(shotDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = 'https://localhost:3000';

// ── Ảnh 01+02: duplicate qua Enter (desktop) ──
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(`${app}/ui/input`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await page.evaluate(() => document.fonts?.ready);
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await sleep(1200);

const inp = page.locator('[data-test="ib-base"] [data-test="input-barcode-input"]');
await inp.fill('8938506952141');
await page.keyboard.press('Enter');
await sleep(600);

// Chụp NGAY sau khi Enter trùng — toast + card đang animate
await inp.fill('8938506952141');
await page.keyboard.press('Enter');
await sleep(180); // giữa animation (bounce/rung phase sớm, toast vừa hiện)
await page.screenshot({ path: `${shotDir}/01-duplicate-toast-animate.png` });
console.log('01 done');

// Sau animate xong — toast vẫn còn, card về trạng thái thường
await sleep(1200);
await page.screenshot({ path: `${shotDir}/02-duplicate-toast-settled.png` });
console.log('02 done');

// ── Ảnh 03: quét mock QR trùng → toast + card animate ──
const browserM = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextM = await browserM.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await contextM.addInitScript(() => {
	const QR =
		'111111100011101111111100000101110101000001101110100011101011101101110101100101011101101110100100101011101100000101001001000001111111101010101111111000000000100000000000111110111001010101010011111011101111001110110001100010101100111111000000111111001101011111110010100100001000000001000100100000111111101001010010111100000100000000110011101110101101010011100101110101001111101100101110101110101101100100000101011111001001111111101010100100100';
	const N = 21;
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, 640, 480);
	const mod = 20;
	const ox = Math.floor((640 - N * mod) / 2);
	const oy = Math.floor((480 - N * mod) / 2);
	ctx.fillStyle = '#000000';
	for (let r = 0; r < N; r++) {
		for (let c = 0; c < N; c++) {
			if (QR[r * N + c] === '1') ctx.fillRect(ox + c * mod, oy + r * mod, mod, mod);
		}
	}
	const stream = canvas.captureStream(15);
	navigator.mediaDevices.getUserMedia = async () => stream;
});
const pageM = await contextM.newPage();
pageM.on('pageerror', (e) => console.log('PAGEERROR-M:', e.message));
await pageM.goto(`${app}/ui/input`, { waitUntil: 'domcontentloaded' });
await pageM.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await pageM.evaluate(() => document.fonts?.ready);
await sleep(1200);

await pageM.locator('[data-test="ib-base"] [data-test="input-barcode-input"]').fill('QRCODE1');
await pageM.keyboard.press('Enter');
await sleep(600);
await pageM.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"]').click();
await pageM
	.locator('[data-test="ib-base"] [data-test="input-barcode-overlay"]')
	.waitFor({ state: 'detached', timeout: 15000 });
await sleep(200); // toast + card animate vừa bắt đầu
await pageM.screenshot({ path: `${shotDir}/03-scan-duplicate-toast.png` });
console.log('03 done');
await browserM.close();

// ── Ảnh 04: mobile mở camera → input blur (keyboard ẩn) ──
const browserMob = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextMob = await browserMob.newContext({ ...devices['Pixel 5'], ignoreHTTPSErrors: true, deviceScaleFactor: 2 });
const pageMob = await contextMob.newPage();
pageMob.on('pageerror', (e) => console.log('PAGEERROR-MOB:', e.message));
await pageMob.goto(`${app}/ui/input`, { waitUntil: 'domcontentloaded' });
await pageMob.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await pageMob.evaluate(() => document.fonts?.ready);
await sleep(1200);

// Focus input trước (giả lập đang gõ), rồi mở scan → phải blur
await pageMob.locator('[data-test="ib-base"] [data-test="input-barcode-input"]').click();
await sleep(400);
await pageMob.locator('[data-test="ib-base"] [data-test="input-barcode-input"]').fill('MOB-1');
await sleep(300);
await pageMob.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"]').click();
await pageMob.waitForSelector('[data-test="ib-base"] [data-test="input-barcode-overlay"]', { timeout: 10000 });
await sleep(900); // fullscreen transition + video mount
await pageMob.screenshot({ path: `${shotDir}/04-mobile-scan-blur.png` });
console.log('04 done');
await browserMob.close();
await browser.close();
console.log('all done');
