// barcode-import-screenshot.mjs — chụp 2 ảnh tính năng import photo (IB12):
//   1. ib-import: row có nút import (indigo) + 1 mã đã detect thẳng
//   2. ib-import: overlay mode import (canvas freeze + regions + hint, KHÔNG video/pause)
// Stub BarcodeDetector (giống probe IB12) — không cần decode thật.
// Chạy: node tests/barcode-import-screenshot.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
await context.addInitScript(() => {
	window.__stubResults = [];
	class FakeDetector {
		async detect() {
			return window.__stubResults.shift() ?? [];
		}
		async getSupportedFormats() {
			return ['qr_code', 'ean_13'];
		}
	}
	window.BarcodeDetector = FakeDetector;
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-demo"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await sleep(400);

// ── Fixture PNG 640×480 trắng (canvas Chromium — decode chắc chắn) ──
const canvasPage = await context.newPage();
await canvasPage.goto('about:blank');
const fixtureDataUrl = await canvasPage.evaluate(() => {
	const c = document.createElement('canvas');
	c.width = 640;
	c.height = 480;
	const x = c.getContext('2d');
	x.fillStyle = '#ffffff';
	x.fillRect(0, 0, 640, 480);
	return c.toDataURL('image/png');
});
await canvasPage.close();
const FIX = 'tests/fixtures';
mkdirSync(FIX, { recursive: true });
const fixturePng = join(FIX, 'barcode-import-640x480.png');
writeFileSync(fixturePng, Buffer.from(fixtureDataUrl.split(',')[1], 'base64'));

// ── Ảnh 1: row + nút import + 1 mã detect thẳng (không overlay) ──
await page.evaluate(() => {
	window.__stubResults = [
		[{ format: 'qr_code', rawValue: 'IMPORTQRCODE', boundingBox: new DOMRect(50, 50, 200, 200), cornerPoints: [] }]
	];
});
await page.locator('[data-test="ib-import"] input[type="file"]').setInputFiles([fixturePng]);
await sleep(800);
const state1 = await page.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-import"]');
	return {
		codes: Array.from(wrap?.querySelectorAll('.input-barcode-value') ?? []).map((v) => v.textContent?.trim()),
		importBtn: Boolean(wrap?.querySelector('[data-test="input-barcode-import-trigger"]')),
		scanBtn: Boolean(wrap?.querySelector('[data-test="input-barcode-scan-trigger"]')),
		overlay: Boolean(wrap?.querySelector('[data-test="input-barcode-overlay"]'))
	};
});
console.log('IMG1 state:', JSON.stringify(state1));
await page.locator('[data-test="ib-import"]').screenshot({ path: `${OUT}/import-1-row-single-code.png` });

// ── Ảnh 2: overlay mode import — canvas freeze + 2 regions + hint ──
await page.evaluate(() => {
	window.__stubResults = [
		[
			{ format: 'qr_code', rawValue: 'MULTIA', boundingBox: new DOMRect(60, 80, 180, 180), cornerPoints: [] },
			{ format: 'ean_13', rawValue: '8938506952146', boundingBox: new DOMRect(400, 160, 200, 90), cornerPoints: [] }
		]
	];
});
await page.locator('[data-test="ib-import"] input[type="file"]').setInputFiles([fixturePng]);
await page.locator('[data-test="ib-import"] .input-barcode-freeze-on').waitFor({ timeout: 8000 });
// Icon lucide:x (iconify) fetch async — đợi icon render trước khi chụp
await page.locator('[data-test="input-barcode-overlay-close"] svg').waitFor({ timeout: 8000 });
await sleep(400);
const state2 = await page.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-import"]');
	return {
		regions: wrap?.querySelectorAll('[data-test="input-barcode-region"]').length ?? 0,
		video: wrap?.querySelectorAll('.input-barcode-overlay video').length ?? 0,
		pause: wrap?.querySelectorAll('[data-test="input-barcode-overlay-pause"]').length ?? 0,
		hint: wrap?.querySelector('[data-test="input-barcode-hint"]')?.textContent?.trim() ?? ''
	};
});
console.log('IMG2 state:', JSON.stringify(state2));
// Bẫy element-screenshot: overlay fixed inset-0 tràn khỏi section box → hint/close/regions
// ngoài section bị clip. Chụp full viewport (idiom từ radiogroup-audit memory).
await page.screenshot({ path: `${OUT}/import-2-overlay-regions.png` });

await browser.close();
console.log('Done: import-1-row-single-code.png, import-2-overlay-regions.png');
