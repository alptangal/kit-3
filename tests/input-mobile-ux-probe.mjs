// input-mobile-ux-probe.mjs
// Functional probe cho task "B1 — Barcode vibrate + ellipsis touch barcode/file".
// Mobile context 375px:
//   BM1  barcode value dài → card cao hơn (2 dòng, không còn ellipsis 1 dòng).
//   BM2  file quickbar wrap: scrollWidth ≤ clientWidth (nút dài không tràn).
//   BM3  file card tên dài ≥ 2 dòng không tràn (clamp hoạt động).
//   BM4  vibrate: spy navigator.vibrate (Android UA) — scan mock detect 1 mã →
//        vibrate gọi với pattern [80]; iPhone UA → không gọi không lỗi.
//   BM5  0 pageerror.
// PC guard: barcode card PC VẪN ellipsis 1 dòng (media chỉ ≤767px).
// Chạy: node tests/input-mobile-ux-probe.mjs (dev server https://localhost:3000)
import { chromium, devices } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = `${process.env.PROBE_BASE || 'https://localhost:3000'}/ui/input`;
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync('tests/screenshots/input-mobile', { recursive: true });

// Fixtures: 1 tên file RẤT DÀI (test clamp 2 dòng)
const FIX = 'tests/fixtures';
mkdirSync(FIX, { recursive: true });
const pngBase64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
writeFileSync(join(FIX, 'ten-file-cuc-dai-de-test-clamp-hai-dong-tren-man-hinh-nho-mobile-375px.png'), Buffer.from(pngBase64, 'base64'));

const longNamePath = join(FIX, 'ten-file-cuc-dai-de-test-clamp-hai-dong-tren-man-hinh-nho-mobile-375px.png');
const p = (n) => join(FIX, n);

// ── Mobile context: Android UA (has vibrate) + vibrate SPY ──
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextM = await browser.newContext({
	...devices['Pixel 5'],
	ignoreHTTPSErrors: true,
	baseURL: 'https://localhost:3000'
});
await contextM.addInitScript(() => {
	// Spy vibrate — ghi log + giữ native behavior (Android Chrome ChromeOS headless
	// có thể không có native vibrate → tự cài stub ghi log)
	const calls = [];
	try {
		Object.defineProperty(navigator, 'vibrate', {
			configurable: true,
			value: (pattern) => {
				calls.push(pattern);
				return true;
			}
		});
	} catch { /* đã có native — override vẫn chạy */ }
	(window).__vibrateCalls = calls;
});
const pageM = await contextM.newPage();
const pageErrors = [];
pageM.on('pageerror', (e) => {
	pageErrors.push(e.message);
	console.log('PAGEERROR:', e.message);
});
await pageM.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageM.waitForSelector('[data-test="input-demo"]', { timeout: 20000 });
await pageM.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await sleep(400);

const vpW = await pageM.evaluate(() => window.innerWidth);
ok('BM0: mobile viewport ~375', Math.abs(vpW - 375) <= 20, String(vpW));

console.log('\n=== BM1: BARCODE VALUE DÀI → 2 DÒNG (clamp) ===');
// Nhập mã dài thủ công (không phải barcode thật — chỉ string dài)
const longCode = '8938506952141893850695214189385069521418938506952141XYZ';
const bcInput = pageM.locator('[data-test="ib-update"] [data-test="input-barcode-input"]');
await bcInput.click();
await sleep(200);
await bcInput.pressSequentially(longCode);
await sleep(200);
await bcInput.press('Enter');
await sleep(500);
const bm1 = await pageM.evaluate(() => {
	const val = document.querySelector('[data-test="ib-update"] .input-barcode-value');
	if (!val) return null;
	const r = val.getBoundingClientRect();
	return {
		clientH: val.clientHeight,
		lines: Math.round(val.clientHeight / parseFloat(getComputedStyle(val).lineHeight || '16')),
		whiteSpace: getComputedStyle(val).whiteSpace,
		lineClamp: getComputedStyle(val).webkitLineClamp
	};
});
ok('BM1: PC-style nowrap đã off trên mobile', bm1?.whiteSpace === 'normal', bm1?.whiteSpace ?? 'null');
ok('BM1: line-clamp = 2', bm1?.lineClamp === '2', bm1?.lineClamp ?? 'null');
ok('BM1: card value cao ≥ 2 dòng (>30px)', (bm1?.clientH ?? 0) > 30, `clientH=${bm1?.clientH}`);
// mã ngắn vẫn 1 dòng (không vỡ layout thường)
await bcInput.click();
await sleep(150);
await bcInput.pressSequentially('8938506952141');
await bcInput.press('Enter');
await sleep(400);
const bm1b = await pageM.evaluate(() => {
	const vals = document.querySelectorAll('[data-test="ib-update"] .input-barcode-value');
	const short = vals[vals.length - 1];
	return short ? short.clientHeight : 0;
});
ok('BM1b: mã ngắn vẫn 1 dòng (≤22px)', bm1b <= 22, `clientH=${bm1b}`);

console.log('\n=== BM2: QUICKBAR WRAP (file + quickDelete) ===');
await pageM.locator('[data-test="if-quick-delete"] input[type="file"]').setInputFiles([longNamePath, p('notes.txt')]);
await sleep(500);
// tick card 1 → quickbar hiện
await pageM.locator('[data-test="if-quick-delete"] [data-test="input-file-check"] > .checkbox-root').first().click();
await sleep(300);
const bm2 = await pageM.evaluate(() => {
	const qb = document.querySelector('[data-test="if-quick-delete"] .input-file-quickbar');
	if (!qb) return null;
	return {
		scrollW: qb.scrollWidth,
		clientW: qb.clientWidth,
		display: getComputedStyle(qb).display,
		wrap: getComputedStyle(qb).flexWrap
	};
});
ok('BM2: quickbar hiện (flex)', bm2 != null, JSON.stringify(bm2));
ok('BM2: flex-wrap = wrap', bm2?.wrap === 'wrap', bm2?.wrap ?? 'null');
ok(
	'BM2: scrollWidth ≤ clientWidth + 1 (không tràn ngang)',
	bm2 ? bm2.scrollW <= bm2.clientW + 1 : false,
	`scrollW=${bm2?.scrollW} clientW=${bm2?.clientW}`
);

console.log('\n=== BM3: FILE TÊN DÀI → CLAMP 2 DÒNG KHÔNG TRÀN ===');
const bm3 = await pageM.evaluate(() => {
	const name = document.querySelector('[data-test="if-quick-delete"] .input-file-name');
	if (!name) return null;
	const card = name.closest('.input-file-card');
	const cardR = card?.getBoundingClientRect();
	const r = name.getBoundingClientRect();
	return {
		clientH: name.clientHeight,
		whiteSpace: getComputedStyle(name).whiteSpace,
		lineClamp: getComputedStyle(name).webkitLineClamp,
		cardOverflow: cardR ? r.right <= cardR.right + 1 : null,
		scrollable: name.scrollWidth > name.clientWidth
	};
});
ok('BM3: file-name white-space normal', bm3?.whiteSpace === 'normal', bm3?.whiteSpace ?? 'null');
ok('BM3: file-name line-clamp 2', bm3?.lineClamp === '2', bm3?.lineClamp ?? 'null');
ok('BM3: tên dài clamp 2 dòng (clientH > 26)', (bm3?.clientH ?? 0) > 26, `clientH=${bm3?.clientH}`);
ok('BM3: text không tràn card (right ≤ card right)', bm3?.cardOverflow === true, JSON.stringify(bm3));

// ── Ảnh mobile ──
const ibSection = pageM.locator('[data-test="ib-update"]');
await ibSection.scrollIntoViewIfNeeded();
await sleep(300);
await ibSection.screenshot({ path: 'tests/screenshots/input-mobile/barcode-card-2lines-375.png' });
const qdSection = pageM.locator('[data-test="if-quick-delete"]');
await qdSection.scrollIntoViewIfNeeded();
await sleep(300);
await qdSection.screenshot({ path: 'tests/screenshots/input-mobile/file-quickbar-wrap-375.png' });

console.log('\n=== BM4: VIBRATE SPY — SCAN MOCK DETECT 1 MÃ → vibrate [80] ===');
// Mock camera: QR synth "QRCODE1" (mẫu IB9 input-barcode-probe)
const contextV = await browser.newContext({
	...devices['Pixel 5'],
	ignoreHTTPSErrors: true,
	baseURL: 'https://localhost:3000'
});
await contextV.addInitScript(() => {
	const calls = [];
	Object.defineProperty(navigator, 'vibrate', {
		configurable: true,
		value: (pattern) => {
			calls.push(pattern);
			return true;
		}
	});
	(window).__vibrateCalls = calls;
	const QR = '111111100011101111111100000101110101000001101110100011101011101101110101100101011101101110100100101011101100000101001001000001111111101010101111111000000000100000000000111110111001010101010011111011101111001110110001100010101100111111000000111111001101011111110010100100001000000001000100100000111111101001010010111100000100000000110011101110101101010011100101110101001111101100101110101110101101100100000101011111001001111111101010100100100';
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
const pageV = await contextV.newPage();
const pageVErrors = [];
pageV.on('pageerror', (e) => pageVErrors.push(e.message));
await pageV.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageV.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await sleep(400);
await pageV.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"]').click();
await pageV
	.locator('[data-test="ib-base"] [data-test="input-barcode-overlay"]')
	.waitFor({ state: 'detached', timeout: 15000 });
await sleep(300);
const vibrateCalls = await pageV.evaluate(() => (window).__vibrateCalls ?? []);
ok('BM4: vibrate được gọi khi detect single', vibrateCalls.length >= 1, JSON.stringify(vibrateCalls));
ok('BM4: pattern = 80 (single)', vibrateCalls.some((c) => c === 80 || (Array.isArray(c) && c[0] === 80)), JSON.stringify(vibrateCalls));
ok('BM4: 0 pageerror (context vibrate)', pageVErrors.length === 0, pageVErrors.join(' | ').slice(0, 150));

// ── BM4b: iPhone UA — thêm mã bằng tay KHÔNG trigger vibrate (vibrate chỉ ở
// detect/pick; iOS Safari thật không có navigator.vibrate → helper no-op; ở
// đây Chromium spoof UA nên vibrate CÓ — nhưng không được GỌI khi add manual) ──
const contextI = await browser.newContext({
	...devices['iPhone 13'],
	ignoreHTTPSErrors: true,
	baseURL: 'https://localhost:3000'
});
await contextI.addInitScript(() => {
	const calls = [];
	Object.defineProperty(navigator, 'vibrate', {
		configurable: true,
		value: (pattern) => {
			calls.push(pattern);
			return true;
		}
	});
	(window).__vibrateCalls = calls;
});
const pageI = await contextI.newPage();
const pageIErrors = [];
pageI.on('pageerror', (e) => pageIErrors.push(e.message));
await pageI.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageI.waitForSelector('[data-test="ib-update"]', { timeout: 20000 });
await sleep(400);
await pageI.locator('[data-test="ib-update"] [data-test="input-barcode-input"]').click();
await sleep(200);
await pageI.locator('[data-test="ib-update"] [data-test="input-barcode-input"]').pressSequentially('8938506952141');
await pageI.locator('[data-test="ib-update"] [data-test="input-barcode-input"]').press('Enter');
await sleep(400);
const iosCalls = await pageI.evaluate(() => (window).__vibrateCalls ?? []);
ok('BM4b: iPhone UA — add tay không trigger vibrate (helper chỉ ở detect/pick)', iosCalls.length === 0, JSON.stringify(iosCalls));
ok('BM4b: iPhone — thêm mã vẫn OK (không crash)', (await pageI.evaluate(() => document.querySelectorAll('[data-test="ib-update"] .input-barcode-value').length)) >= 1);
ok('BM4b: 0 pageerror (iOS)', pageIErrors.length === 0, pageIErrors.join(' | ').slice(0, 150));

console.log('\n=== BM5: PC GUARD — BARCODE VALUE VẪN ELLIPSIS 1 DÒNG (PC) ===');
const contextPC = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const pagePC = await contextPC.newPage();
await pagePC.goto(BASE, { waitUntil: 'domcontentloaded' });
await pagePC.waitForSelector('[data-test="ib-update"]', { timeout: 20000 });
await sleep(400);
await pagePC.locator('[data-test="ib-update"] [data-test="input-barcode-input"]').click();
await pagePC.locator('[data-test="ib-update"] [data-test="input-barcode-input"]').pressSequentially(longCode);
await pagePC.locator('[data-test="ib-update"] [data-test="input-barcode-input"]').press('Enter');
await sleep(400);
const pcState = await pagePC.evaluate(() => {
	const val = document.querySelector('[data-test="ib-update"] .input-barcode-value');
	return {
		ws: getComputedStyle(val).whiteSpace,
		clientH: val.clientHeight
	};
});
ok('BM5: PC giữ white-space nowrap', pcState.ws === 'nowrap', pcState.ws);
ok('BM5: PC value 1 dòng (clientH ≤ 22)', pcState.clientH <= 22, `clientH=${pcState.clientH}`);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (pageErrors.length || pageVErrors.length) console.log('PAGEERRORS (main/vibrate):', pageErrors.length, pageVErrors.length);
if (failed.length || pageErrors.length || pageVErrors.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
