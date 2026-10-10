// input-barcode-probe.mjs
// Functional probe Wave 11 — Input type='barcode':
// - IB0  page render (sections: base, update/delete, select-delete, select-all, required, form, disabled)
// - IB1  nhập tay: gõ mã → Enter/+ → thêm vào list, list hiển thị
// - IB2  updateOn: nút bút chì → input inline sửa → Enter commit, Escape hủy
// - IB3  deleteOn: nút × → xóa mã khỏi list
// - IB4  selectDeleteOn: tick card → thanh "Xóa N mã" → xóa hàng loạt
// - IB5  selectAllOn: nút "Xóa tất cả" header list → codes = []
// - IB6  required + FieldMessages: chưa mã → error; thêm mã → valid (showValid); xóa → error
// - IB7  form serialize: Form KHÔNG serialize barcode (configs không có key value) — payload chỉ email
// - IB8  camera UI structure: nút scanner hiện khi cameraOn, click → overlay render (video/frame/regions)
// - IB9  scan mock (addInitScript mock getUserMedia): detectFrame → addBarcode + beep single → close
// - IB10 multi-detect mock: >1 mã → freeze frame + regions click → pickScanResult + beep single → close
// - IB11 disabled: không nhập/scanner/xóa được
// Chạy: node tests/input-barcode-probe.mjs (dev server https://localhost:3000)

import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = `${process.env.PROBE_BASE || 'https://localhost:3000'}/ui/input`;
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync('tests/screenshots/input-barcode', { recursive: true });

// ── PC context (1280x900) ──
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-demo"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await sleep(400);

const section = (t) => page.locator(`[data-test="${t}"]`);
const input = (t) => section(t).locator('[data-test="input-barcode-input"]');
const listItems = (t) => section(t).locator('[data-test="input-barcode-card"]');
const listCount = (t) => section(t).locator('[data-test="input-barcode-card"]').count();
const scanTrigger = (t) => section(t).locator('[data-test="input-barcode-scan-trigger"]');
const overlay = (t) => section(t).locator('[data-test="input-barcode-overlay"]');
const scanError = (t) => section(t).locator('[data-test="input-barcode-scan-error"]');
const regions = (t) => section(t).locator('[data-test="input-barcode-region"]');
const overlayClose = (t) => section(t).locator('[data-test="input-barcode-overlay-close"]');
const editTrigger = (t, idx) => listItems(t).nth(idx).locator('[data-test="input-barcode-edit-trigger"]');
const editInput = (t, idx) => listItems(t).nth(idx).locator('[data-test="input-barcode-edit"]');
const removeBtn = (t, idx) => listItems(t).nth(idx).locator('[data-test="input-barcode-remove"]');
const checkBtn = (t, idx) => listItems(t).nth(idx).locator('[data-test="input-barcode-check"]');
const quickbarDelete = (t) => section(t).locator('[data-test="input-barcode-quickbar-delete"]');
const clearAllBtn = (t) => section(t).locator('[data-test="input-barcode-clear-all"]');
const addBtn = (t) => section(t).locator('[data-test="input-barcode-add"]');

// ── Helper: đọc danh sách codes hiện tại từ DOM (text của input-barcode-value) ──
const readCodes = async (t) => {
	return page.evaluate((sel) => {
		const wrap = document.querySelector(`[data-test="${sel}"]`);
		if (!wrap) return [];
		const values = wrap.querySelectorAll('.input-barcode-value');
		return Array.from(values).map((v) => v.textContent?.trim() ?? '');
	}, t);
};

// ── Helper: đọc selected count từ header text ──
const readSelectedCount = async (t) => {
	return page.evaluate((sel) => {
		const wrap = document.querySelector(`[data-test="${sel}"]`);
		if (!wrap) return null;
		const el = wrap.querySelector('[data-test="input-barcode-list-head"] .input-file-selected-count');
		return el?.textContent?.trim() ?? null;
	}, t);
};

console.log('\n=== IB0: PAGE RENDER — 7 SECTIONS BARCODE ===');
const ib0Sections = ['ib-base', 'ib-update', 'ib-select-delete', 'ib-select-all', 'ib-required', 'ib-form', 'ib-disabled'];
const ib0Counts = await Promise.all(ib0Sections.map((s) => section(s).count()));
ok('IB0a: 7 sections barcode render', ib0Counts.every((c) => c === 1), JSON.stringify(ib0Counts));

// Mỗi section có input + nút scanner (cameraOn=true) cho base/disabled
const scanCounts = await Promise.all(['ib-base', 'ib-disabled'].map((s) => scanTrigger(s).count()));
ok('IB0b: scanner button render (cameraOn)', scanCounts.every((c) => c === 1), JSON.stringify(scanCounts));

console.log('\n=== IB1: NHẬP TAY — GÕ MÃ + ENTER/+ → THÊM VÀO LIST ===');
await input('ib-base').click();
await sleep(250);
await input('ib-base').pressSequentially('8938506952141');
await sleep(250);
await input('ib-base').press('Enter');
await sleep(500);
const ib1a = await readCodes('ib-base');
ok('IB1a: Enter → mã thêm vào list', ib1a.includes('8938506952141'), `codes=${JSON.stringify(ib1a)}`);
const ib1count = await listCount('ib-base');
ok('IB1b: list có 1 item', ib1count === 1, `count=${ib1count}`);

// Thêm mã 2 bằng nút +
await input('ib-base').click();
await sleep(100);
await input('ib-base').pressSequentially('1234567890123');
await sleep(100);
await addBtn('ib-base').click();
await sleep(500);
const ib1b = await readCodes('ib-base');
ok('IB1c: nút + → mã 2 thêm vào list', ib1b.includes('1234567890123') && ib1b.length === 2, `codes=${JSON.stringify(ib1b)}`);
const ib1count2 = await listCount('ib-base');
ok('IB1d: list có 2 item', ib1count2 === 2, `count=${ib1count2}`);

// Screenshot PC: base section sau nhập 2 mã
await section('ib-base').screenshot({ path: 'tests/screenshots/input-barcode/01-base-two-codes.png' });
console.log('Screenshot: tests/screenshots/input-barcode/01-base-two-codes.png');

console.log('\n=== IB2: UPDATEON — NÚT BÚT CHÌ → INPUT INLINE SỬA ===');
// Thêm 1 mã trước cho section ib-update
await input('ib-update').click();
await sleep(250);
await input('ib-update').pressSequentially('UPDATEME');
await sleep(100);
await addBtn('ib-update').click();
await sleep(500);
await editTrigger('ib-update', 0).click();
await sleep(300);
await editInput('ib-update', 0).fill('NEWCODE123');
await editInput('ib-update', 0).press('Enter');
await sleep(500);
const ib2 = await readCodes('ib-update');
ok('IB2a: Enter commit sửa mã', ib2.includes('NEWCODE123'), `codes=${JSON.stringify(ib2)}`);
// Test Escape hủy
await editTrigger('ib-update', 0).click();
await sleep(200);
await editInput('ib-update', 0).fill('CANCELLED');
await editInput('ib-update', 0).press('Escape');
await sleep(300);
const ib2b = await readCodes('ib-update');
ok('IB2b: Escape → giữ mã cũ (NEWCODE123)', ib2b.includes('NEWCODE123') && !ib2b.includes('CANCELLED'), `codes=${JSON.stringify(ib2b)}`);

console.log('\n=== IB3: DELETEON — NÚT × → XÓA MÃ ===');
await removeBtn('ib-update', 0).click();
await sleep(500);
const ib3 = await readCodes('ib-update');
ok('IB3a: × → xóa mã khỏi list', ib3.length === 0, `codes=${JSON.stringify(ib3)}`);

console.log('\n=== IB4: SELECTDELETEON — TICK CARD → XÓA HÀNG LOẠT ===');
// Thêm 2 mã trước cho section ib-select-delete
for (const code of ['SELCODE1', 'SELCODE2']) {
	await input('ib-select-delete').click();
	await sleep(150);
	await input('ib-select-delete').pressSequentially(code);
	await sleep(100);
	await addBtn('ib-select-delete').click();
	await sleep(300);
}
const ib4pre = await listCount('ib-select-delete');
ok('IB4pre: 2 mã sẵn sàng', ib4pre === 2, `count=${ib4pre}`);
await checkBtn('ib-select-delete', 0).click();
await sleep(200);
const ib4a = await readSelectedCount('ib-select-delete');
ok('IB4a: tick 1 card → selected count hiển thị', ib4a?.includes('1/') ?? false, `selected=${ib4a}`);
await checkBtn('ib-select-delete', 1).click();
await sleep(200);
const ib4b = await readSelectedCount('ib-select-delete');
ok('IB4b: tick 2 card → selected count 2', ib4b?.includes('2/') ?? false, `selected=${ib4b}`);
// selectDeleteOn KHÔNG selectAllOn → quickbar giữ nguyên khi selected ≥2
// (clear-all chỉ render khi selectAllOn — không thì mất nút xóa hàng loạt)
await quickbarDelete('ib-select-delete').click();
await sleep(500);
const ib4c = await listCount('ib-select-delete');
ok('IB4c: quickbar Xóa → 2 mã bị xóa', ib4c === 0, `count=${ib4c}`);

console.log('\n=== IB5: SELECTALLON — NÚT XÓA TẤT CẢ HEADER ===');
await input('ib-select-all').click();
await sleep(100);
await input('ib-select-all').pressSequentially('CODE1');
await sleep(100);
await addBtn('ib-select-all').click();
await sleep(300);
await input('ib-select-all').click();
await sleep(100);
await input('ib-select-all').pressSequentially('CODE2');
await sleep(100);
await addBtn('ib-select-all').click();
await sleep(300);
const ib5a = await listCount('ib-select-all');
ok('IB5a: 2 mã trong list', ib5a === 2, `count=${ib5a}`);
// Refinement: clear-all chỉ hiện khi selected ≥2 và CHỈ xóa phần đã chọn →
// tick cả 2 card trước để clear-all render + xóa đúng 2 mã đó
await checkBtn('ib-select-all', 0).click();
await sleep(200);
await checkBtn('ib-select-all', 1).click();
await sleep(200);
await clearAllBtn('ib-select-all').click();
await sleep(500);
const ib5b = await listCount('ib-select-all');
ok('IB5b: clear-all (2 mã đã chọn) → list rỗng', ib5b === 0, `count=${ib5b}`);

console.log('\n=== IB6: REQUIRED + FIELDMESSAGES (SHOWVALID) ===');
// _justReset=true lần đầu → blur KHÔNG validate (discipline: suppress until user interacts)
// Chỉ test case có interaction trước
await input('ib-required').click();  // interaction đầu
await sleep(250);
await section('ib-base').locator('h2').click(); // blur → required error
await sleep(700);
const ib6a = await page.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-required"]');
	const err = wrap?.querySelector('.text-error, [class*="error"]');
	return { hasError: !!err, errText: err?.textContent ?? null };
});
ok('IB6a: interaction trước + blur → required error', ib6a.hasError, ib6a.errText ?? '(không có)');

// Thêm mã → blur → valid (showValid)
await input('ib-required').click();
await sleep(250);
await input('ib-required').pressSequentially('REQUIRED123');
await sleep(300);
	await input('ib-required').press('Enter');  // commit mã vào list
await section('ib-base').locator('h2').click();
await sleep(700);
const ib6b = await page.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-required"]');
	const input = wrap?.querySelector('[data-test="input-barcode-input"]');
	const valid = wrap?.querySelector('[class*="success"], .text-success');
	const all = wrap?.textContent ?? '';
	return { value: input?.value ?? null, hasValid: !!valid, all: all.slice(0, 200) };
});
ok('IB6b: gõ mã + Enter → valid (showValid)', ib6b.hasValid, ib6b.all.slice(0, 80));

// Xóa mã: ib-required KHÔNG có selectDeleteOn (không tick card) → clear-all
// giữ nghĩa đen "Xóa tất cả" (hành vi prop gốc, luôn hiện khi có mã)
await clearAllBtn('ib-required').click();
await sleep(500);
// Blur lại
await input('ib-required').click();
await sleep(100);
await section('ib-base').locator('h2').click();
await sleep(700);
const ib6c = await page.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-required"]');
	const err = wrap?.querySelector('.text-error, [class*="error"]');
	return { hasError: !!err };
});
ok('IB6c: xóa hết → error lại', ib6c.hasError);

console.log('\n=== IB7: FORM SERIALIZE — BARCODE KHÔNG SERIẾL (KHÔNG CÓ KEY VALUE) ===');
// Form ib-form: chỉ có barcode field (required). Submit gate chỉ check codes.length > 0.
const ib7btn = section('ib-form').locator('button[type="submit"]');
const ib7before = await ib7btn.evaluate((el) => ({ disabled: el.disabled, text: el.textContent?.trim() }));
ok('IB7a: nút Submit disabled khi chưa có mã', ib7before.disabled === true, `disabled=${ib7before.disabled}`);

// Thêm mã vào form
await input('ib-form').click();
await sleep(250);
await input('ib-form').pressSequentially('FORMCODE123');
await sleep(300);
await addBtn('ib-form').click();
await sleep(500);
const ib7after = await ib7btn.evaluate((el) => ({ disabled: el.disabled, text: el.textContent?.trim() }));
ok('IB7b: có mã → nút Submit enabled', ib7after.disabled === false, `disabled=${ib7after.disabled}`);

// Click submit → button text đổi
await ib7btn.click();
await sleep(500);
const ib7submit = await ib7btn.textContent();
ok('IB7c: submit → nút "Đã submit ✓"', ib7submit?.includes('Đã submit') ?? false, ib7submit ?? '(null)');

console.log('\n=== IB8: CAMERA UI STRUCTURE — NÚT SCANNER + OVERLAY RENDER ===');
await scanTrigger('ib-base').click();
await sleep(800); // overlay mount + getUserMedia (có thể fail headless)
const ib8overlay = await overlay('ib-base').count();
ok('IB8a: overlay render (video/canvas/close)', ib8overlay === 1, `overlay count=${ib8overlay}`);
const ib8video = await page.locator('[data-test="ib-base"] .input-barcode-video').count();
ok('IB8b: video element có trong overlay', ib8video === 1);
const ib8close = await overlayClose('ib-base').count();
ok('IB8c: nút close overlay có', ib8close === 1);

// Screenshot: overlay mở
await section('ib-base').screenshot({ path: 'tests/screenshots/input-barcode/02-overlay-open.png' });
console.log('Screenshot: tests/screenshots/input-barcode/02-overlay-open.png');

// Đóng overlay
await overlayClose('ib-base').click();
await sleep(300);
const ib8closed = await overlay('ib-base').count();
ok('IB8d: close → overlay biến mất', ib8closed === 0);

console.log('\n=== IB9: SCAN MOCK — CANVAS CAPTURESTREAM (QR SYNTH) → DETECT → ADD + CLOSE ===');
// Mock getUserMedia ĐỒNG BỘ (không fetch/async — race trước đây: init script
// async chưa xong khi openScan gọi getUserMedia → mediaDevices undefined):
// canvas 640×480 vẽ QR matrix synth "QRCODE1" (nhúng cứng, 21×21) → captureStream
// → video element nhận frame → polyfill zbar detect(videoEl) đọc rawValue.
const browserM = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextM = await browserM.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
await contextM.addInitScript(() => {
	// QR matrix "QRCODE1" 21×21 (border=0, ECC=L) — từ python qrcode
	const QR = '111111100011101111111100000101110101000001101110100011101011101101110101100101011101101110100100101011101100000101001001000001111111101010101111111000000000100000000000111110111001010101010011111011101111001110110001100010101100111111000000111111001101011111110010100100001000000001000100100000111111101001010010111100000100000000110011101110101101010011100101110101001111101100101110101110101101100100000101011111001001111111101010100100100';
	const N = 21;
	const canvas = document.createElement('canvas');
	canvas.width = 640;
	canvas.height = 480;
	const ctx = canvas.getContext('2d');
	// Nền trắng + module 20px giữa canvas (210px QR khối, đúng tỉ lệ 1:1)
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
pageM.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await pageM.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageM.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await sleep(400);

await pageM.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"]').click();
// Fullscreen transition làm detect loop start muộn → đợi overlay tự đóng
// (single detect → addBarcode + close) theo điều kiện thay vì sleep cứng
await pageM
	.locator('[data-test="ib-base"] [data-test="input-barcode-overlay"]')
	.waitFor({ state: 'detached', timeout: 15000 });
const ib9codes = await pageM.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-base"]');
	if (!wrap) return [];
	const values = wrap.querySelectorAll('.input-barcode-value');
	return Array.from(values).map((v) => v.textContent?.trim() ?? '');
});
ok('IB9a: mock scan QR synth → addBarcode QRCODE1 + close', ib9codes.includes('QRCODE1'), `codes=${JSON.stringify(ib9codes)}`);
const ib9overlay = await pageM.locator('[data-test="ib-base"] [data-test="input-barcode-overlay"]').count();
ok('IB9b: overlay tự đóng sau single detect', ib9overlay === 0);

await browserM.close();

console.log('\n=== IB10: MULTI-DETECT — QR + EAN-13 SYNTH CẠNH NHAU → FREEZE + REGIONS → PICK ===');
const browserM2 = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextM2 = await browserM2.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
await contextM2.addInitScript(() => {
	// Canvas 900×480: QR "QRCODE1" (trái, 21×21 module 16px) + EAN-13
	// "8938506952146" (phải, 95 modules rộng 5px) cạnh nhau → detect 2 mã →
	// freeze frame + regions render → click region chọn
	const QR = '111111100011101111111100000101110101000001101110100011101011101101110101100101011101101110100100101011101100000101001001000001111111101010101111111000000000100000000000111110111001010101010011111011101111001110110001100010101100111111000000111111001101011111110010100100001000000001000100100000111111101001010010111100000100000000110011101110101101010011100101110101001111101100101110101110101101100100000101011111001001111111101010100100100';
	const EAN = '10100010110100001011011101110010100111010111101010111010010011101101100110011010111001010000101';
	const canvas = document.createElement('canvas');
	canvas.width = 900;
	canvas.height = 480;
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, 900, 480);
	// QR trái: 21×21 module 16 → 336px, đặt (40, 60)
	ctx.fillStyle = '#000000';
	const qm = 16;
	const qx = 40, qy = 60;
	for (let r = 0; r < 21; r++) {
		for (let c = 0; c < 21; c++) {
			if (QR[r * 21 + c] === '1') ctx.fillRect(qx + c * qm, qy + r * qm, qm, qm);
		}
	}
	// EAN-13 phải: 95 modules rộng 5px cao ~180 (module 5×36), đặt (420, 150)
	const em = 5, eh = 36;
	const ex = 420, ey = 150;
	for (let i = 0; i < 95; i++) {
		if (EAN[i] === '1') ctx.fillRect(ex + i * em, ey, em, eh);
	}
	const stream = canvas.captureStream(15);
	navigator.mediaDevices.getUserMedia = async () => stream;
});

const pageM2 = await contextM2.newPage();
pageM2.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await pageM2.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageM2.waitForSelector('[data-test="ib-base"]', { timeout: 20000 });
await sleep(400);

await pageM2.locator('[data-test="ib-base"] [data-test="input-barcode-scan-trigger"]').click();
// Fullscreen transition làm detect loop start muộn (freeze có thể >2500ms) →
// đợi theo điều kiện DOM thay vì sleep cứng
await pageM2
	.locator('[data-test="ib-base"] .input-barcode-freeze-on')
	.waitFor({ timeout: 15000 });
const ib10frozen = await pageM2.locator('[data-test="ib-base"] .input-barcode-freeze-on').count();
ok('IB10a: multiple detect → freeze canvas render', ib10frozen === 1);
const ib10regions = await pageM2.locator('[data-test="ib-base"] [data-test="input-barcode-region"]').count();
ok('IB10b: 2 regions render (click chọn)', ib10regions === 2, `regions=${ib10regions}`);
const ib10hint = await pageM2.locator('[data-test="ib-base"] [data-test="input-barcode-hint"]').count();
ok('IB10c: hint "Phát hiện N mã" hiện', ib10hint === 1);

// Screenshot: multi-detect freeze + regions (TRƯỚC khi click — state đúng)
await pageM2.locator('[data-test="ib-base"]').screenshot({ path: 'tests/screenshots/input-barcode/03-multi-detect-regions.png' });
console.log('Screenshot: tests/screenshots/input-barcode/03-multi-detect-regions.png');

// Click region đầu tiên
await pageM2.locator('[data-test="ib-base"] [data-test="input-barcode-region"]').first().click();
await sleep(500);
const ib10codes = await pageM2.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-base"]');
	if (!wrap) return [];
	const values = wrap.querySelectorAll('.input-barcode-value');
	return Array.from(values).map((v) => v.textContent?.trim() ?? '');
});
ok('IB10d: click region 1 → addBarcode 1 mã + close', ib10codes.length === 1, `codes=${JSON.stringify(ib10codes)}`);
const ib10overlay = await pageM2.locator('[data-test="ib-base"] [data-test="input-barcode-overlay"]').count();
ok('IB10e: overlay tự đóng sau pick', ib10overlay === 0);

await browserM2.close();

console.log('\n=== IB11: DISABLED — KHÔNG NHẬP/SCANNER/XÓA ĐƯỢC ===');
// Component disabled KHÔNG dùng native disabled attr trên barcode input/scanner:
// root có class .disabled (opacity + ::before overlay z-index 99 chặn click) +
// openScan guard (configs.disabled → return) + addBarcode guard. Assert qua
// behavior thực tế (mirror debug _dbg-ib11e).
await page.locator('[data-test="ib-disabled"]').scrollIntoViewIfNeeded();
await sleep(200);
const ib11disabled = await page.evaluate(() => {
	const wrap = document.querySelector('[data-test="ib-disabled"]');
	const input = wrap?.querySelector('[data-test="input-barcode-input"]');
	const root = input?.closest('.input-root');
	return root?.classList.contains('disabled') ?? false;
});
ok('IB11a: root class disabled (overlay ::before chặn click)', ib11disabled === true);
// Click scanner (force qua ::before) → openScan guard → KHÔNG overlay
await scanTrigger('ib-disabled').click({ force: true });
await sleep(800);
const ib11overlay = await overlay('ib-disabled').count();
ok('IB11b: scanner click → KHÔNG mở overlay (guard disabled)', ib11overlay === 0);
// Typing → addBarcode guard disabled → codes rỗng
await input('ib-disabled').focus();
await page.keyboard.type('TEST123');
await page.keyboard.press('Enter');
await sleep(500);
const ib11codes = await readCodes('ib-disabled');
ok('IB11c: typing + Enter → KHÔNG thêm mã (guard disabled)', ib11codes.length === 0, `codes=${JSON.stringify(ib11codes)}`);

// Screenshot: disabled section
await section('ib-disabled').screenshot({ path: 'tests/screenshots/input-barcode/04-disabled.png' });
console.log('Screenshot: tests/screenshots/input-barcode/04-disabled.png');

await browser.close();

const passCount = results.filter((r) => r.pass).length;
console.log(`\n=== KẾT QUẢ: ${passCount}/${results.length} PASS ===`);
if (passCount !== results.length) process.exit(1);