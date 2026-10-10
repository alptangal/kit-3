// tests/barcode-refine-probe.mjs
// Probe hoàn thiện input barcode — 6 nhóm (BR = Barcode Refine):
//   BR-A: Nút action dùng Button component (button-root/aspect-square) + scale theo size Input
//   BR-B: Tick card = Checkbox component (checkbox-root)
//   BR-C: Clear-all — hiện khi selected ≥2, bấm chỉ xóa phần đã chọn; quickbar ẩn khi ≥2
//   BR-D: Enter → add + flash class ~600ms rồi tự bỏ
//   BR-E: Camera fullscreen + pause/resume + close
//   BR-F: reduced-motion → flash không animate
// Chạy: node tests/barcode-refine-probe.mjs
import { chromium } from '@playwright/test';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000/ui/input';
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

function section(t) {
	return `[data-test="${t}"]`;
}

// ── Helpers ──
async function readCodes(page, t) {
	return page.evaluate((sec) => {
		const wrap = document.querySelector(`[data-test="${sec}"]`);
		if (!wrap) return [];
		const values = wrap.querySelectorAll('.input-barcode-value');
		return Array.from(values).map((v) => v.textContent?.trim() ?? '');
	}, t);
}

async function clearAllState(page, t) {
	return page.evaluate((sec) => {
		const root = document.querySelector(`[data-test="${sec}"] .input-root`);
		const clearAll = root?.querySelector('[data-test="input-barcode-clear-all"]');
		const quickbar = root?.querySelector('[data-test="input-barcode-quickbar"]');
		const head = root?.querySelector('[data-test="input-barcode-list-head"]');
		const sel = head?.querySelector('.input-file-selected-count')?.textContent ?? '';
		return { hasClear: Boolean(clearAll), hasQuickbar: Boolean(quickbar), headText: sel };
	}, t);
}

// ── Browser 1: BR-A..D (không cần camera) ──
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	reducedMotion: 'no-preference'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="ib-update"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await sleep(500);

// ══ BR-A: Nút action dùng Button component + kích thước scale theo size ══
console.log('\n=== BR-A: BUTTON COMPONENT + SIZE SCALE ===');
await page.locator('[data-test="ib-update"] [data-test="input-barcode-input"]').fill('IB-A-1');
await page.keyboard.press('Enter');
await sleep(400);

const aBtn = await page.evaluate(() => {
	const root = document.querySelector('[data-test="ib-update"] .input-root');
	// scan-trigger chỉ render khi cameraOn (ib-base) — ib-update chỉ updateOn+deleteOn
	const scan = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"] button.button-root');
	const add = root?.querySelector('[data-test="input-barcode-add"] button.button-root');
	const edit = root?.querySelector('[data-test="input-barcode-edit-trigger"] button.button-root');
	const remove = root?.querySelector('[data-test="input-barcode-remove"] button.button-root');
	return {
		hasAdd: Boolean(add),
		addIsButton: add?.classList.contains('button-root') ?? false,
		addAspect: add?.classList.contains('aspect-square') ?? false,
		scanIsButton: scan?.classList.contains('button-root') ?? false,
		editIsButton: edit?.classList.contains('button-root') ?? false,
		removeIsButton: remove?.classList.contains('button-root') ?? false
	};
});
ok('BR-A1: nút add dùng Button (button-root)', aBtn.addIsButton && aBtn.hasAdd);
ok('BR-A2: nút add có aspect-square', aBtn.addAspect);
ok('BR-A3: scan-trigger dùng Button', aBtn.scanIsButton);
ok('BR-A4: edit-trigger dùng Button', aBtn.editIsButton);
ok('BR-A5: remove dùng Button', aBtn.removeIsButton);

// Kích thước: aspect-square → width = --min-height Button size-sm (2.5rem=40px).
// .input-root size-md --min-height=2.875rem KHÔNG kế thừa vào Button (Button
// tự define --min-height theo size class của nó).
const aSize = await page.evaluate(() => {
	const root = document.querySelector('[data-test="ib-update"] .input-root');
	const add = root?.querySelector('[data-test="input-barcode-add"] button.button-root');
	const edit = root?.querySelector('[data-test="input-barcode-edit-trigger"] button.button-root');
	if (!add || !root) return null;
	const rootMH = getComputedStyle(root).getPropertyValue('--min-height').trim();
	const btnMH = getComputedStyle(add).getPropertyValue('--min-height').trim();
	const addW = add.getBoundingClientRect().width;
	const addH = add.getBoundingClientRect().height;
	const editW = edit?.getBoundingClientRect().width ?? 0;
	return { rootMH, btnMH, addW, addH, editW };
});
ok(
	'BR-A6: nút add width = 40px (Button size-sm aspect-square)',
	aSize !== null && Math.abs(aSize.addW - 40) < 3,
	`rootMH=${aSize?.rootMH} btnMH=${aSize?.btnMH} addW=${aSize?.addW?.toFixed(1)}`
);
ok(
	'BR-A7: nút add vuông (width≈height)',
	aSize !== null && Math.abs(aSize.addW - aSize.addH) < 2,
	`w=${aSize?.addW?.toFixed(1)} h=${aSize?.addH?.toFixed(1)}`
);
ok(
	'BR-A7b: edit-trigger width ≈ 30px (size-xs aspect-square)',
	aSize !== null && Math.abs(aSize.editW - 30) < 4,
	`editW=${aSize?.editW?.toFixed(1)}`
);

// Scale theo size: set --min-height trực tiếp trên nút (Button CSS
// width: var(--min-height) → nút scale theo token).
await page.evaluate(() => {
	const add = document.querySelector('[data-test="ib-update"] [data-test="input-barcode-add"] button.button-root');
	if (add) add.style.setProperty('--min-height', '3.125rem');
});
await sleep(120);
const aScale = await page.evaluate(() => {
	const add = document.querySelector('[data-test="ib-update"] [data-test="input-barcode-add"] button.button-root');
	return add?.getBoundingClientRect().width ?? 0;
});
ok(
	'BR-A8: đổi --min-height → nút add scale theo (3.125rem=50px)',
	Math.abs(aScale - 50) < 3,
	`addW=${aScale?.toFixed(1)}`
);
await page.evaluate(() => {
	const add = document.querySelector('[data-test="ib-update"] [data-test="input-barcode-add"] button.button-root');
	if (add) add.style.removeProperty('--min-height');
});

// ══ BR-B: tick card = Checkbox component ══
console.log('\n=== BR-B: CHECKBOX COMPONENT REUSE ===');
const bInput = page.locator('[data-test="ib-select-all"] [data-test="input-barcode-input"]');
await bInput.fill('IB-B-1');
await page.keyboard.press('Enter');
await sleep(300);
await bInput.fill('IB-B-2');
await page.keyboard.press('Enter');
await sleep(300);

const bCheck = await page.evaluate(() => {
	const root = document.querySelector('[data-test="ib-select-all"] .input-root');
	const wrap = root?.querySelector('[data-test="input-barcode-check"]');
	const cb = root?.querySelector('.input-barcode-check.checkbox-root');
	const indicator = root?.querySelector('.input-barcode-check.checkbox-root > .checkbox-indicator-root');
	return { hasWrap: Boolean(wrap), isCheckbox: Boolean(cb), hasIndicator: Boolean(indicator) };
});
ok('BR-B1: tick card render Checkbox (checkbox-root)', bCheck.isCheckbox && bCheck.hasWrap);
ok('BR-B2: Checkbox có indicator', bCheck.hasIndicator);

// Tick mã 1 → quickbar hiện + head "Đã chọn 1/2"
const check1 = page.locator('[data-test="ib-select-all"] [data-test="input-barcode-check"]').first();
await check1.click();
await sleep(300);
const bState1 = await clearAllState(page, 'ib-select-all');
ok('BR-B3: tick 1 mã → quickbar hiện', bState1.hasQuickbar && !bState1.hasClear, JSON.stringify(bState1));
ok(
	'BR-B4: head "Đã chọn 1/2"',
	bState1.headText.replace(/\s+/g, ' ').includes('Đã chọn 1/2'),
	bState1.headText
);

// ══ BR-C: clear-all — hiện khi ≥2, chỉ xóa phần đã chọn ══
console.log('\n=== BR-C: CLEAR-ALL (SELECTED >= 2, CHI XOA PHAN DA CHON) ===');
// Tick mã 2 → selected = 2 → clear-all hiện, quickbar ẩn
const check2 = page.locator('[data-test="ib-select-all"] [data-test="input-barcode-check"]').nth(1);
await check2.click();
await sleep(300);

// Thêm mã thứ 3 KHÔNG tick trước khi bấm clear-all → verify giữ phần chưa tick
const bInput2 = page.locator('[data-test="ib-select-all"] [data-test="input-barcode-input"]');
await bInput2.fill('IB-B-3');
await page.keyboard.press('Enter');
await sleep(300);

const cState2 = await clearAllState(page, 'ib-select-all');
ok('BR-C1: selected ≥2 → clear-all hiện', cState2.hasClear, JSON.stringify(cState2));
ok('BR-C2: selected ≥2 → quickbar ẨN (không trùng nút)', !cState2.hasQuickbar, JSON.stringify(cState2));

// Bấm clear-all → CHỈ 2 mã đã tick xóa, mã chưa tick giữ
await page.locator('[data-test="ib-select-all"] [data-test="input-barcode-clear-all"]').click();
await sleep(400);
const cCodes = await readCodes(page, 'ib-select-all');
const cState3 = await clearAllState(page, 'ib-select-all');
ok(
	'BR-C3: clear-all chỉ xóa 2 mã đã chọn (giữ IB-B-3)',
	cCodes.length === 1 && cCodes[0] === 'IB-B-3',
	JSON.stringify(cCodes)
);
ok(
	'BR-C4: sau clear-all → clear-all ẩn (selection rỗng)',
	!cState3.hasClear && !cState3.hasQuickbar,
	JSON.stringify(cState3)
);

// ══ BR-D: Enter → add flash ~600ms rồi tự gỡ ══
console.log('\n=== BR-D: ENTER → ADD FLASH ANIMATION ===');
const dInput = page.locator('[data-test="ib-update"] [data-test="input-barcode-input"]');
await dInput.fill('IB-D-1');
await page.keyboard.press('Enter');
await sleep(120); // rAF + attach class
const dFlash = await page.evaluate(() => {
	const root = document.querySelector('[data-test="ib-update"] .input-root');
	const add = root?.querySelector('[data-test="input-barcode-add"] button.button-root');
	return { hasBtn: Boolean(add), hasFlash: add?.classList.contains('barcode-add-flash') ?? false };
});
ok('BR-D1: Enter → nút add có class barcode-add-flash', dFlash.hasBtn && dFlash.hasFlash, JSON.stringify(dFlash));
await sleep(750); // 600ms timer + buffer
const dFlashGone = await page.evaluate(() => {
	const root = document.querySelector('[data-test="ib-update"] .input-root');
	const add = root?.querySelector('[data-test="input-barcode-add"] button.button-root');
	return add?.classList.contains('barcode-add-flash') ?? false;
});
ok('BR-D2: sau ~600ms class tự gỡ', !dFlashGone);

// Guard gõ liên tiếp: 2 Enter nhanh → không chồng timer (class vẫn gỡ đúng 1 lần)
await dInput.fill('IB-D-2');
await page.keyboard.press('Enter');
await sleep(80);
await dInput.fill('IB-D-3');
await page.keyboard.press('Enter');
await sleep(800);
const dRapid = await page.evaluate(() => {
	const root = document.querySelector('[data-test="ib-update"] .input-root');
	const add = root?.querySelector('[data-test="input-barcode-add"] button.button-root');
	return add?.classList.contains('barcode-add-flash') ?? false;
});
ok('BR-D3: gõ liên tiếp → class vẫn tự gỡ (guard timer)', !dRapid);

await browser.close();

// ══ BR-E: Camera fullscreen + pause/resume + close ══
console.log('\n=== BR-E: CAMERA FULLSCREEN + PAUSE/RESUME ===');
// Browser riêng + mock camera ĐỒNG BỘ qua addInitScript (bẫy đã biết: mock
// async chưa xong khi openScan gọi getUserMedia → mediaDevices undefined).
const browserM = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextM = await browserM.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
await contextM.addInitScript(() => {
	// Canvas trắng (không vẽ QR) để detector KHÔNG tìm thấy mã
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, 640, 480);
	const stream = canvas.captureStream(15);
	navigator.mediaDevices.getUserMedia = async () => stream;
});
const pageM = await contextM.newPage();
pageM.on('pageerror', (e) => console.log('PAGEERROR-M:', e.message));
pageM.on('console', (msg) => console.log('BROWSER:', msg.text()));
await pageM.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageM.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await pageM.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await sleep(500);

// Mở scan → overlay render + requestFullscreen
const scanTriggerBtn = pageM.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"] button');
await scanTriggerBtn.click();
// Đợi overlay render (DOM) thay vì sleep cứng
await pageM.waitForSelector('[data-test="ib-base"] [data-test="input-barcode-overlay"]', { timeout: 10000 });
await sleep(500); // rAF fullscreen sau overlay render
// Debug: check DOM
const debug = await pageM.evaluate(() => {
	const section = document.querySelector('[data-test="ib-base"]');
	const overlay = section?.querySelector('[data-test="input-barcode-overlay"]');
	const scanBtn = section?.querySelector('[data-test="input-barcode-scan-trigger"] button');
	const root = section?.querySelector('.input-root');
	return {
		hasSection: Boolean(section),
		hasRoot: Boolean(root),
		scanBtnExists: Boolean(scanBtn),
		overlayExists: Boolean(overlay),
		fsElement: document.fullscreenElement
	};
});
console.log('DEBUG openScan:', JSON.stringify(debug));
const eFs = await pageM.evaluate(() => {
	const overlay = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay"]');
	return {
		hasOverlay: Boolean(overlay),
		fsElement: document.fullscreenElement,
		fsIsOverlay: document.fullscreenElement === overlay,
		hasVideo: Boolean(document.querySelector('[data-test="ib-base"] .input-barcode-video'))
	};
});
ok('BR-E1: overlay render + video', eFs.hasOverlay && eFs.hasVideo, JSON.stringify(eFs));
ok(
	'BR-E2: mở scan → fullscreenElement là overlay',
	eFs.fsIsOverlay,
	`fsElement=${eFs.fsElement ? 'set' : 'null'}`
);

// Pause → aria-label đổi "Tiếp tục quét" (detect loop dừng)
const pauseBtn = pageM.locator('[data-test="ib-base"] [data-test="input-barcode-overlay-pause"] button');
const ePauseLabel1 = await pauseBtn.getAttribute('aria-label');
ok('BR-E3: nút pause render, label "Tạm dừng quét"', ePauseLabel1 === 'Tạm dừng quét', ePauseLabel1 ?? '(null)');
// Overlay re-render khi scanPaused đổi → button element bị replace
// Dùng evaluate dispatchEvent (bubbles) để trigger Svelte handler
await pageM.evaluate(() => {
	const btn = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay-pause"] button');
	if (btn) {
		console.log('[test] clicking pause button, overlay before:', document.querySelector('[data-test="input-barcode-overlay"]')?.outerHTML?.slice(0, 100));
		console.log('[test] btn onClick:', btn.onclick);
		btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		console.log('[test] after dispatch, overlay:', document.querySelector('[data-test="input-barcode-overlay"]')?.outerHTML?.slice(0, 100));
	}
});
await sleep(800);
// Debug: kiểm tra scanPaused state + aria-label
const debugPause = await pageM.evaluate(() => {
	const section = document.querySelector('[data-test="ib-base"]');
	const overlay = section?.querySelector('[data-test="input-barcode-overlay"]');
	const btn = section?.querySelector('[data-test="input-barcode-overlay-pause"] button');
	// Reactivity check: scanPaused global không có — chỉ DOM
	return {
		overlayExists: Boolean(overlay),
		btnExists: Boolean(btn),
		btnAriaLabel: btn?.getAttribute('aria-label') ?? '',
		btnOuterHTML: btn?.outerHTML?.slice(0, 300)
	};
});
console.log('DEBUG pause after click:', JSON.stringify(debugPause));
const ePauseLabel2 = await pageM.evaluate(() => {
	const btn = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay-pause"] button');
	return btn?.getAttribute('aria-label') ?? '';
});
ok('BR-E4: pause → label đổi "Tiếp tục quét" (detect dừng)', ePauseLabel2 === 'Tiếp tục quét', ePauseLabel2);

// Resume → dispatchEvent
await pageM.evaluate(() => {
	const btn = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay-pause"] button');
	btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await sleep(800);
const debugResume = await pageM.evaluate(() => {
	const section = document.querySelector('[data-test="ib-base"]');
	const btn = section?.querySelector('[data-test="input-barcode-overlay-pause"] button');
	return {
		btnExists: Boolean(btn),
		btnAriaLabel: btn?.getAttribute('aria-label') ?? ''
	};
});
console.log('DEBUG resume after click:', JSON.stringify(debugResume));
const eResumeLabel = await pageM.evaluate(() => {
	const btn = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay-pause"] button');
	return btn?.getAttribute('aria-label') ?? '';
});
ok('BR-E5: resume → label về "Tạm dừng quét" (detect chạy lại)', eResumeLabel === 'Tạm dừng quét', eResumeLabel);

// Đóng → dispatchEvent
await pageM.evaluate(() => {
	const btn = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay-close"] button');
	btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await sleep(400);
await sleep(400);
const eClose = await pageM.evaluate(() => {
	const overlay = document.querySelector('[data-test="ib-base"] [data-test="input-barcode-overlay"]');
	return { overlayGone: !overlay, fsNull: document.fullscreenElement === null };
});
ok('BR-E6: close → overlay biến mất + exit fullscreen', eClose.overlayGone && eClose.fsNull, JSON.stringify(eClose));

await browserM.close();

// ══ BR-F: reduced-motion → flash KHÔNG animate ══
console.log('\n=== BR-F: REDUCED MOTION ===');
const browserR = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextR = await browserR.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	reducedMotion: 'reduce'
});
const pageR = await contextR.newPage();
pageR.on('pageerror', (e) => console.log('PAGEERROR-R:', e.message));
await pageR.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageR.waitForSelector('[data-test="ib-update"]', { timeout: 20000 });
await sleep(500);
const rInput = pageR.locator('[data-test="ib-update"] [data-test="input-barcode-input"]');
await rInput.fill('IB-R-1');
await pageR.keyboard.press('Enter');
await sleep(120);
const rFlash = await pageR.evaluate(() => {
	const root = document.querySelector('[data-test="ib-update"] .input-root');
	const add = root?.querySelector('[data-test="input-barcode-add"] button.button-root');
	if (!add) return { hasBtn: false, anim: '' };
	const anim = getComputedStyle(add).animationName;
	return { hasBtn: true, anim, hasFlashClass: add.classList.contains('barcode-add-flash') };
});
ok(
	'BR-F1: reduced-motion → animation none (class có gắn cũng không animate)',
	rFlash.hasBtn && (rFlash.anim === 'none' || !rFlash.hasFlashClass),
	JSON.stringify(rFlash)
);

await browserR.close();

console.log('\n══════════════════════════════════');
console.log(`KẾT QUẢ: ${pass} PASS / ${fail} FAIL`);
if (failures.length) {
	console.log('Thất bại:');
	failures.forEach((f) => console.log(`  - ${f}`));
	process.exit(1);
}