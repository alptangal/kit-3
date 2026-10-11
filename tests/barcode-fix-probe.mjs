// tests/barcode-fix-probe.mjs
// Probe batch fix barcode — 3 yêu cầu (BF = Barcode Fix):
//   BF-A: mã TRÙNG (Enter/nút +) → KHÔNG thêm bản sao + toast warning + card animate (class dup-flash ~900ms rồi tự gỡ)
//   BF-B: quét mock mã TRÙNG mã đã có (single detect) → KHÔNG thêm bản sao + toast + animate
//   BF-C: mở camera scan → input text BLUR (activeElement ≠ input, status focus off)
//   BF-D: primeAudio silent-unlock (iOS) — AudioContext có buffer played trong gesture; playBeep state 'interrupted' → resume
//   BF-E: reduced-motion → dup-flash có class cũng KHÔNG animate
// Chạy: node tests/barcode-fix-probe.mjs (dev server https://localhost:3000)

import { chromium } from '@playwright/test';

const BASE = `${process.env.PROBE_BASE || 'https://localhost:3000'}/ui/input`;
let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail = '') {
	if (cond) {
		pass++;
		console.log(`PASS ${name}`);
	} else {
		fail++;
		failures.push(`${name} ${detail}`);
		console.log(`FAIL ${name} ${detail}`);
	}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (t) => `[data-test="${t}"]`;

async function readCodes(page, t) {
	return page.evaluate((sec) => {
		const wrap = document.querySelector(`[data-test="${sec}"]`);
		if (!wrap) return [];
		const values = wrap.querySelectorAll('.input-barcode-value');
		return Array.from(values).map((v) => v.textContent?.trim() ?? '');
	}, t);
}

async function toastCount(page) {
	return page.evaluate(() => {
		const wrap = document.querySelector('.toast-wrapper');
		if (!wrap) return { count: 0, titles: [] };
		const titles = Array.from(wrap.querySelectorAll('.toast-content-title, [class*="title"]')).map(
			(el) => el.textContent?.trim() ?? ''
		);
		return { count: wrap.querySelectorAll('[class*="toast"]').length, titles };
	});
}

// ══ Nhóm BF-A/B/C: 1 browser dùng chung ══
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await sleep(500);

// ── BF-A1: nhập mã trùng qua Enter → KHÔNG thêm bản sao ──
console.log('\n=== BF-A: NHẬP TAY TRÙNG → TOAST + ANIMATE CARD ===');
const inp = page.locator('[data-test="ib-base"] [data-test="input-barcode-input"]');
await inp.fill('BF-DUP-1');
await page.keyboard.press('Enter');
await sleep(500);
let codes = await readCodes(page, 'ib-base');
ok('BF-A0: setup — 1 mã trong list', codes.length === 1 && codes[0] === 'BF-DUP-1', JSON.stringify(codes));

const toastsBefore = await page.evaluate(
	() => document.querySelectorAll('.toast-wrapper > *').length
);
await inp.fill('BF-DUP-1');
await page.keyboard.press('Enter');
await sleep(250);
codes = await readCodes(page, 'ib-base');
ok('BF-A1: trùng → KHÔNG thêm bản sao (vẫn 1 mã)', codes.length === 1, JSON.stringify(codes));

const toastsAfter1 = await page.evaluate(
	() => document.querySelectorAll('.toast-wrapper > *').length
);
ok('BF-A2: trùng → toast warning hiện', toastsAfter1 > toastsBefore, `before=${toastsBefore} after=${toastsAfter1}`);

// Class dup-flash trên card trong ~900ms
const dupClassNow = await page.evaluate(() => {
	const card = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-card"]');
	return {
		hasCard: Boolean(card),
		hasDupClass: card?.classList.contains('input-barcode-dup-flash') ?? false,
		anim: card ? getComputedStyle(card).animationName : ''
	};
});
ok(
	'BF-A3: card có class input-barcode-dup-flash + animation chạy',
	dupClassNow.hasCard && dupClassNow.hasDupClass && dupClassNow.anim !== '' && dupClassNow.anim !== 'none',
	JSON.stringify(dupClassNow)
);
await sleep(1100);
const dupClassGone = await page.evaluate(() => {
	const card = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-card"]');
	return {
		hasDupClass: card?.classList.contains('input-barcode-dup-flash') ?? false,
		anim: card ? getComputedStyle(card).animationName : ''
	};
});
ok('BF-A4: sau ~900ms class tự gỡ + animation none', !dupClassGone.hasDupClass, JSON.stringify(dupClassGone));

// Trùng qua nút + cũng bị chặn (không chỉ Enter)
await inp.fill('BF-DUP-1');
await page.locator('[data-test="ib-base"] [data-test="input-barcode-add"] button').click();
await sleep(250);
codes = await readCodes(page, 'ib-base');
ok('BF-A5: trùng qua nút + → cũng KHÔNG thêm', codes.length === 1, JSON.stringify(codes));

// Mã khác → vẫn thêm bình thường
await inp.fill('BF-NEW-1');
await page.keyboard.press('Enter');
await sleep(400);
codes = await readCodes(page, 'ib-base');
ok('BF-A6: mã MỚI vẫn thêm bình thường (2 mã)', codes.length === 2 && codes.includes('BF-NEW-1'), JSON.stringify(codes));

// ── BF-C: mở camera → input blur ──
console.log('\n=== BF-C: MỞ SCAN → INPUT BLUR ===');
// Browser riêng + mock camera trắng (không detect — giữ overlay mở)
const browserW = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextW = await browserW.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
await contextW.addInitScript(() => {
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, 640, 480);
	const stream = canvas.captureStream(15);
	navigator.mediaDevices.getUserMedia = async () => stream;
});
const pageW = await contextW.newPage();
pageW.on('pageerror', (e) => console.log('PAGEERROR-W:', e.message));
await pageW.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageW.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await sleep(400);

// Gõ mã trước để input focused
const inpW = pageW.locator('[data-test="ib-base"] [data-test="input-barcode-input"]');
await inpW.click();
await inpW.fill('BF-BLUR-1');
await sleep(200);
const focusedBefore = await pageW.evaluate(() => document.activeElement?.tagName ?? '');
await pageW.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"] button').click();
await pageW.waitForSelector('[data-test="ib-base"] [data-test="input-barcode-overlay"]', { timeout: 10000 });
await sleep(400);
const blurState = await pageW.evaluate(() => {
	const input = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-input"]');
	return {
		activeTag: document.activeElement?.tagName ?? '',
		activeIsInput: document.activeElement === input,
		inputValue: input?.value ?? ''
	};
});
ok(
	'BF-C1: mở scan → input text blur (activeElement ≠ input)',
	focusedBefore === 'INPUT' && !blurState.activeIsInput,
	`before=${focusedBefore} after=${blurState.activeTag}`
);
ok('BF-C2: overlay mở bình thường sau blur', blurState.activeTag !== '', JSON.stringify(blurState));

// Đóng overlay dọn state
await pageW.evaluate(() => {
	const btn = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay-close"] button');
	btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await sleep(300);
await browserW.close();

// ── BF-B: quét mock mã trùng (single detect) → KHÔNG thêm + toast ──
console.log('\n=== BF-B: QUÉT MOCK MÃ TRÙNG → KHÔNG THÊM BẢN SAO ===');
const browserM = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextM = await browserM.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
await contextM.addInitScript(() => {
	// QR matrix "QRCODE1" 21×21 — cùng matrix probe IB9
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
await pageM.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageM.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await sleep(400);

// Thêm QRCODE1 trước bằng tay
await pageM.locator('[data-test="ib-base"] [data-test="input-barcode-input"]').fill('QRCODE1');
await pageM.keyboard.press('Enter');
await sleep(400);
const mCodesBefore = await readCodes(pageM, 'ib-base');
const mToastsBefore = await pageM.evaluate(
	() => document.querySelectorAll('.toast-wrapper > *').length
);
ok('BF-B0: setup — QRCODE1 có sẵn trong list', mCodesBefore.includes('QRCODE1'), JSON.stringify(mCodesBefore));

// Quét QR trùng → detectFrame → addBarcode trả về không thêm
await pageM.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"]').click();
await pageM
	.locator('[data-test="ib-base"] [data-test="input-barcode-overlay"]')
	.waitFor({ state: 'detached', timeout: 15000 });
const mCodes = await readCodes(pageM, 'ib-base');
ok('BF-B1: quét trùng → KHÔNG thêm bản sao (vẫn 1 mã)', mCodes.length === 1 && mCodes[0] === 'QRCODE1', JSON.stringify(mCodes));
const mToastsAfter = await pageM.evaluate(
	() => document.querySelectorAll('.toast-wrapper > *').length
);
ok('BF-B2: quét trùng → toast warning hiện', mToastsAfter > mToastsBefore, `before=${mToastsBefore} after=${mToastsAfter}`);
const mDupFlash = await pageM.evaluate(() => {
	const card = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-card"]');
	return card?.classList.contains('input-barcode-dup-flash') ?? false;
});
ok('BF-B3: quét trùng → card dup-flash animate', mDupFlash, `dupFlash=${mDupFlash}`);

await browserM.close();

// ── BF-D: primeAudio silent-unlock + playBeep 'interrupted' (behavioral) ──
console.log('\n=== BF-D: AUDIO UNLOCK iOS (mock AudioContext + gọi hàm thật) ===');
const browserA = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextA = await browserA.newContext({ ignoreHTTPSErrors: true });
await contextA.addInitScript(() => {
	// Mock AudioContext GHI LOG — trước khi import module (module đọc ctor lúc gọi hàm)
	window.__audioCalls = { resume: 0, bufferStart: 0, oscStart: 0 };
	window.__mockState = 'suspended';
	class MockCtx {
		sampleRate = 44100;
		currentTime = 0;
		destination = {};
		get state() {
			return window.__mockState;
		}
		set state(v) {
			window.__mockState = v;
		}
		resume() {
			window.__audioCalls.resume++;
			window.__mockState = 'running';
			return Promise.resolve();
		}
		createBuffer(ch, len, rate) {
			return { length: len, sampleRate: rate };
		}
		createBufferSource() {
			return { buffer: null, connect() {}, start() { window.__audioCalls.bufferStart++; } };
		}
		createOscillator() {
			return {
				type: '',
				frequency: { value: 0 },
				connect() {},
				start() {
					window.__audioCalls.oscStart++;
				},
				stop() {}
			};
		}
		createGain() {
			return {
				gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
				connect() {}
			};
		}
	}
	window.AudioContext = MockCtx;
	window.webkitAudioContext = MockCtx;
});
const pageA = await contextA.newPage();
await pageA.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageA.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });

const audioDiag = await pageA.evaluate(async () => {
	// Import module thật (Vite transform) — MockCtx đã ở trên window trước đó
	const mod = await import('/src/lib/modules/barcode.ts');
	// 1) primeAudio: state suspended → resume + silent buffer START trong gesture
	mod.primeAudio();
	const afterPrime = { ...window.__audioCalls };
	// 2) giả lập iOS 15.4: luồng audio bị ngắt → state 'interrupted' (KHÔNG phải 'suspended')
	window.__mockState = 'interrupted';
	mod.playBeep('single');
	const afterBeep = { ...window.__audioCalls };
	return { afterPrime, afterBeep };
});
ok(
	'BF-D1: primeAudio → resume + silent buffer start trong gesture (iOS unlock)',
	audioDiag.afterPrime.bufferStart === 1 && audioDiag.afterPrime.resume >= 1,
	JSON.stringify(audioDiag.afterPrime)
);
ok(
	"BF-D2: playBeep khi state 'interrupted' → vẫn gọi resume (guard !== 'running')",
	audioDiag.afterBeep.resume >= 2 && audioDiag.afterBeep.oscStart >= 1,
	JSON.stringify(audioDiag.afterBeep)
);
await browserA.close();

// ── BF-E: reduced-motion → dup-flash KHÔNG animate ──
console.log('\n=== BF-E: REDUCED MOTION ===');
const browserR = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextR = await browserR.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	reducedMotion: 'reduce'
});
const pageR = await contextR.newPage();
pageR.on('pageerror', (e) => console.log('PAGEERROR-R:', e.message));
await pageR.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageR.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await sleep(500);
const rInp = pageR.locator('[data-test="ib-base"] [data-test="input-barcode-input"]');
await rInp.fill('BF-RM-1');
await pageR.keyboard.press('Enter');
await sleep(400);
await rInp.fill('BF-RM-1');
await pageR.keyboard.press('Enter');
await sleep(150);
const rDup = await pageR.evaluate(() => {
	const card = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-card"]');
	if (!card) return { hasCard: false, anim: '', hasFlashClass: false };
	return {
		hasCard: true,
		anim: getComputedStyle(card).animationName,
		hasFlashClass: card.classList.contains('input-barcode-dup-flash')
	};
});
ok(
	'BF-E1: reduced-motion → dup-flash animation none (class có gắn cũng không animate)',
	rDup.hasCard && (rDup.anim === 'none' || !rDup.hasFlashClass),
	JSON.stringify(rDup)
);
await browserR.close();

await browser.close();

console.log('\n══════════════════════════════════');
console.log(`KẾT QUẢ: ${pass} PASS / ${fail} FAIL`);
if (failures.length) {
	console.log('Thất bại:');
	failures.forEach((f) => console.log(`  - ${f}`));
	process.exit(1);
}
