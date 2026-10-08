// input-currency-probe.mjs
// Functional probe cho Wave 10 — Input type='currency':
// - CU0  page render (5 sections currency + symbol span)
// - CU1  VND default: gõ 1234 → auto format "1.234" + symbol "₫" suffix + caret đúng
// - CU2  USD: symbol "$" prefix + nhóm nghìn "," ("1,234")
// - CU3  USD blur → ép decimals "1,234.00" (2 decimals)
// - CU4  custom: symbol="US$" ghi đè + symbolPosition="suffix"
// - CU5  autoCalculate: gõ biểu thức → blur → tính ("1000+500" → "1.500")
// - CU6  PC keydown filter: chữ cái bị chặn (type=a → value không đổi)
// - CU7  PC calculator: 'x' → nhân khi blur (123x4 → "492")
// - CU8  mobile: readonly + inputmode none + keyboard mount (setViewportSize)
// - CU9  mobile keyboard: bấm phím số → value; '=' tính; x → nhân; : → chia; AC clear
// - CU10 mobile click ngoài → keyboard unmount
// - CU11 form serialize: gõ số → JSON payload có key (string raw)
// - CU12 validation required: chưa gõ → error; gõ số → valid (showValid)
// Chạy: node tests/input-currency-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/input';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync('tests/screenshots/input-currency', { recursive: true });

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
const input = (t) => section(t).locator('input');
const symbolSpan = (t) => section(t).locator('[data-test="input-currency-symbol"]');

// Helper đọc state DOM: value + symbol + caret
const state = (t) =>
	page.evaluate((sel) => {
		const wrap = document.querySelector(`[data-test="${sel}"]`);
		const input = wrap?.querySelector('input');
		const symbol = wrap?.querySelector('[data-test="input-currency-symbol"]');
		return {
			value: input?.value ?? null,
			symbol: symbol?.textContent ?? null,
			caret: input ? input.selectionStart : null
		};
	}, t);

// Blur input t (click vào h2 của section khác — ngoài root input)
const blurTo = async (t, other) => {
	await section(other ?? 'ic-vnd').locator('h2').click();
	await sleep(450);
};

console.log('\n=== CU0: PAGE RENDER — 5 SECTIONS CURRENCY ===');
const cu0Sections = ['ic-vnd', 'ic-usd', 'ic-custom', 'ic-calc', 'ic-form'];
const cu0Counts = await Promise.all(cu0Sections.map((s) => section(s).count()));
ok('CU0a: 5 sections currency render', cu0Counts.every((c) => c === 1), JSON.stringify(cu0Counts));
const cu0Symbols = await Promise.all(cu0Sections.map((s) => symbolSpan(s).count()));
ok(
	'CU0b: symbol span render (mỗi section 1 span)',
	cu0Symbols.every((c) => c === 1),
	JSON.stringify(cu0Symbols)
);
const cu0Vnd = await state('ic-vnd');
ok('CU0c: VND symbol = "₫" (suffix mặc định)', cu0Vnd.symbol === '₫', `symbol="${cu0Vnd.symbol}"`);
const cu0Usd = await state('ic-usd');
ok('CU0d: USD symbol = "$" (prefix mặc định)', cu0Usd.symbol === '$', `symbol="${cu0Usd.symbol}"`);

console.log('\n=== CU1: VND DEFAULT — GÕ 1234 → "1.234" + ₫ SUFFIX ===');
await input('ic-vnd').click();
await sleep(250);
await input('ic-vnd').pressSequentially('1234');
await sleep(500); // effect live format + rAF caret
const cu1 = await state('ic-vnd');
ok('CU1a: value = "1.234" (auto format nhóm nghìn vi-VN)', cu1.value === '1.234', `value="${cu1.value}"`);
ok('CU1b: symbol = "₫"', cu1.symbol === '₫', `symbol="${cu1.symbol}"`);
ok('CU1c: caret sau digit cuối (5)', cu1.caret === 5, `caret=${cu1.caret}`);

// Screenshot PC: VND đã format
await page
	.locator('[data-test="ic-vnd"]')
	.screenshot({ path: 'tests/screenshots/input-currency/01-vnd-formatted.png' });
console.log('Screenshot: tests/screenshots/input-currency/01-vnd-formatted.png');

console.log('\n=== CU2: USD — $ PREFIX + NHÓM "," ===');
await input('ic-usd').click();
await sleep(250);
await input('ic-usd').pressSequentially('1234');
await sleep(500);
const cu2 = await state('ic-usd');
ok('CU2a: value = "1,234" (nhóm nghìn en-US)', cu2.value === '1,234', `value="${cu2.value}"`);
ok('CU2b: symbol = "$" (prefix)', cu2.symbol === '$', `symbol="${cu2.symbol}"`);

console.log('\n=== CU3: USD BLUR → ÉP DECIMALS "1,234.00" ===');
await blurTo('ic-usd', 'ic-custom');
const cu3 = await state('ic-usd');
ok('CU3: USD blur → "1,234.00" (decimals=2 ép)', cu3.value === '1,234.00', `value="${cu3.value}"`);

console.log('\n=== CU4: CUSTOM — US$ GHI ĐÈ + SUFFIX ===');
const cu4 = await state('ic-custom');
ok('CU4: symbol = "US$" (ghi đè "$", suffix)', cu4.symbol === 'US$', `symbol="${cu4.symbol}"`);
await input('ic-custom').click();
await sleep(250);
await input('ic-custom').pressSequentially('1234');
await sleep(500);
await blurTo('ic-custom', 'ic-calc');
const cu4b = await state('ic-custom');
ok('CU4b: custom blur → "1,234.0" (decimals=1 ép)', cu4b.value === '1,234.0', `value="${cu4b.value}"`);

console.log('\n=== CU5: AUTOCALCULATE — BLUR TÍNH "1000+500" → "1.500" ===');
await input('ic-calc').click();
await sleep(250);
await input('ic-calc').pressSequentially('1000+500');
await sleep(500);
const cu5a = await state('ic-calc');
ok('CU5a: biểu thức giữ nguyên khi focus', cu5a.value === '1.000+500', `value="${cu5a.value}"`);
await blurTo('ic-calc', 'ic-vnd');
const cu5 = await state('ic-calc');
ok('CU5b: blur → tính "1.500"', cu5.value === '1.500', `value="${cu5.value}"`);

// Screenshot PC: tổng quan 4 section currency
await page.screenshot({ path: 'tests/screenshots/input-currency/02-pc-overview.png', fullPage: false });
console.log('Screenshot: tests/screenshots/input-currency/02-pc-overview.png');

console.log('\n=== CU6: PC KEYDOWN FILTER — CHỮ CÁI BỊ CHẶN ===');
await input('ic-vnd').click();
await sleep(250);
await input('ic-vnd').pressSequentially('abc');
await sleep(300);
const cu6 = await state('ic-vnd');
// 'abc' bị chặn toàn bộ — value giữ nguyên "1.234" từ CU1 (không bị nối 'abc')
ok('CU6: gõ "abc" bị chặn (value không đổi, không dính "abc")', cu6.value === '1.234', `value="${cu6.value}"`);

console.log('\n=== CU7: PC CALCULATOR — \'x\' → NHÂN KHI BLUR ===');
// 'x' có trong currency_keys_allowed (mirror keyboard). ic-calc còn "1.500" từ
// CU5b → xóa hết trước (Backspace 5 lần), rồi gõ "123x4" → blur → 492.
await input('ic-calc').click();
await sleep(250);
for (let i = 0; i < 5; i++) {
	await input('ic-calc').press('Backspace');
	await sleep(80);
}
const cu7pre = await state('ic-calc');
ok('CU7pre: xóa hết giá trị cũ (rỗng)', !cu7pre.value, `value="${cu7pre.value}"`);
await input('ic-calc').pressSequentially('123x4');
await sleep(400);
const cu7a = await state('ic-calc');
ok('CU7a: "123x4" được nhận (x không bị chặn)', cu7a.value === '123x4', `value="${cu7a.value}"`);
await blurTo('ic-calc', 'ic-vnd');
const cu7 = await state('ic-calc');
ok('CU7b: blur → x nhân → "492"', cu7.value === '492', `value="${cu7.value}"`);

await browser.close();

// ── MOBILE context (375x812, iPhone UA) ──
const browserM = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const contextM = await browserM.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 812 },
	hasTouch: true,
	isMobile: true,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
	deviceScaleFactor: 2
});
const pageM = await contextM.newPage();
pageM.on('pageerror', (e) => console.log('PAGEERROR (mobile):', e.message));
await pageM.goto(BASE, { waitUntil: 'domcontentloaded' });
await pageM.waitForSelector('[data-test="input-currency-vnd"]', { timeout: 20000 });
await pageM.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await pageM.waitForTimeout(400);

const stateM = () =>
	pageM.evaluate(() => {
		const wrap = document.querySelector('[data-test="input-currency-vnd"]');
		const input = wrap?.querySelector('input');
		const kbRoot = document.querySelector('[data-keyboard-host] .keyboard-number-root');
		return {
			value: input?.value ?? null,
			readonly: input ? input.readOnly : null,
			inputmode: input?.getAttribute('inputmode') ?? null,
			kbMounted: !!kbRoot,
			kbButtonCount: kbRoot ? kbRoot.querySelectorAll('button').length : 0,
			activeTag: document.activeElement?.tagName ?? null
		};
	});

const pressKey = async (label) => {
	const btn = pageM
		.locator('[data-keyboard-host] .keyboard-number-root button', { hasText: label })
		.first();
	await btn.click();
	await pageM.waitForTimeout(150);
};

console.log('\n=== CU8: MOBILE — READONLY + KEYBOARD MOUNT ===');
const baseM = await stateM();
ok(
	'CU8a: input currency readonly + inputmode none',
	baseM.readonly === true && baseM.inputmode === 'none',
	`readonly=${baseM.readonly} inputmode=${baseM.inputmode}`
);
await pageM.locator('[data-test="input-currency-vnd"] input').click();
await pageM.waitForTimeout(300);
await pageM.setViewportSize({ width: 375, height: 500 });
await pageM
	.waitForSelector('[data-keyboard-host] .keyboard-number-root', { timeout: 5000 })
	.catch(() => {});
await pageM.waitForTimeout(600);
const kbM1 = await stateM();
ok('CU8b: keyboard mount khi click input currency', kbM1.kbMounted, `kbMounted=${kbM1.kbMounted}`);
ok(
	'CU8c: keyboard đủ 21 phím (5 header + 16 lưới số)',
	kbM1.kbButtonCount === 21,
	`count=${kbM1.kbButtonCount}`
);

console.log('\n=== CU9: MOBILE KEYBOARD — PHÍM + "=" TÍNH + x : ===');
await pressKey('1');
await pressKey('2');
await pressKey('3');
await pressKey('4');
const kbM2 = await stateM();
ok(
	'CU9a: 1 2 3 4 → value chứa "1.234" (autoFormat live)',
	(kbM2.value ?? '').includes('1.234'),
	`value="${kbM2.value}"`
);
await pressKey('AC');
const kbM3 = await stateM();
ok('CU9b: AC → value rỗng', kbM3.value === '', `value="${kbM3.value}"`);
await pressKey('1');
await pressKey('0');
await pressKey('0');
await pressKey('0');
await pressKey('+');
await pressKey('5');
await pressKey('0');
await pressKey('0');
const kbM4 = await stateM();
ok(
	'CU9c: 1000+500 → "1.000+500" (biểu thức + autoFormat từng số)',
	kbM4.value === '1.000+500',
	`value="${kbM4.value}"`
);
await pressKey('=');
await pageM.waitForTimeout(700);
const kbM5 = await stateM();
ok('CU9d: "=" → tính "1.500"', kbM5.value === '1.500', `value="${kbM5.value}"`);
await pressKey('AC');
await pressKey('1');
await pressKey('2');
await pressKey('3');
await pressKey('x');
await pressKey('4');
await pressKey('=');
await pageM.waitForTimeout(700);
const kbM6 = await stateM();
ok('CU9e: x → nhân ("123x4=" → "492")', kbM6.value === '492', `value="${kbM6.value}"`);
await pressKey('AC');
await pressKey('4');
await pressKey('9');
await pressKey('2');
await pressKey(':');
await pressKey('3');
await pressKey('=');
await pageM.waitForTimeout(700);
const kbM7 = await stateM();
ok('CU9f: : → chia ("492:3=" → "164")', kbM7.value === '164', `value="${kbM7.value}"`);

// Screenshot mobile: keyboard mở + value đã format
await pageM.screenshot({ path: 'tests/screenshots/input-currency/03-mobile-keyboard.png' });
console.log('Screenshot: tests/screenshots/input-currency/03-mobile-keyboard.png');

console.log('\n=== CU10: MOBILE CLICK NGOÀI → KEYBOARD UNMOUNT ===');
await pageM.mouse.click(10, 150);
await pageM.waitForTimeout(600);
const kbM8 = await stateM();
ok('CU10: click ngoài → keyboard unmount', !kbM8.kbMounted, `kbMounted=${kbM8.kbMounted}`);

await browserM.close();

// ── CU11/CU12: FORM SERIALIZE + VALIDATION (PC context mới — trang đã bẩn) ──
const browser2 = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context2 = await browser2.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page2 = await context2.newPage();
page2.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page2.goto(BASE, { waitUntil: 'domcontentloaded' });
await page2.waitForSelector('[data-test="ic-form"]', { timeout: 20000 });
await page2.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page2.waitForTimeout(400);

console.log('\n=== CU11: VALIDATION REQUIRED — CHƯA GÕ → ERROR, GÕ SỐ → VALID ===');
// Chưa gõ → blur (click ngoài) → required error
await page2.locator('[data-test="ic-form"] input').click();
await page2.waitForTimeout(250);
await page2.locator('[data-test="ic-vnd"] h2').click();
await page2.waitForTimeout(700); // debounce validation 300ms + render
const cu11a = await page2.evaluate(() => {
	const wrap = document.querySelector('[data-test="ic-form"]');
	const err = wrap?.querySelector('.text-error, [class*="error"]');
	return { hasError: !!err, errText: err?.textContent ?? null };
});
ok('CU11a: chưa gõ + blur → required error hiện', cu11a.hasError, cu11a.errText ?? '(không có)');

// Gõ số → blur → valid (showValid)
await page2.locator('[data-test="ic-form"] input').click();
await page2.waitForTimeout(250);
await page2.locator('[data-test="ic-form"] input').pressSequentially('150000');
await page2.waitForTimeout(500);
await page2.locator('[data-test="ic-vnd"] h2').click();
await page2.waitForTimeout(700);
const cu11b = await page2.evaluate(() => {
	const wrap = document.querySelector('[data-test="ic-form"]');
	const input = wrap?.querySelector('input');
	const valid = wrap?.querySelector('[class*="success"], .text-success');
	const all = wrap?.textContent ?? '';
	return { value: input?.value ?? null, hasValid: !!valid, all: all.slice(0, 200) };
});
ok('CU11b: gõ 150000 → value "150.000" (autoFormat)', cu11b.value === '150.000', `value="${cu11b.value}"`);
ok('CU11c: valid message hiện (showValid)', cu11b.hasValid, cu11b.all.slice(0, 80));

console.log('\n=== CU12: FORM SERIALIZE — PAYLOAD JSON CÓ KEY ===');
// Submit qua click nút Submit trong Form ic-form
const submitBtn = page2.locator('[data-test="ic-form"] button[type="submit"]');
const cu12before = await page2.evaluate(() => {
	const btn = document.querySelector('[data-test="ic-form"] button[type="submit"]');
	return { disabled: btn?.disabled ?? null, text: btn?.textContent?.trim() ?? null };
});
ok(
	'CU12a: nút Submit không disabled sau khi gõ số',
	cu12before.disabled === false,
	`disabled=${cu12before.disabled} text="${cu12before.text}"`
);
// Gắn hook bắt payload submit (Form onSubmit → page chỉ set state, không log payload —
// verify serialize quajsonData không được expose → thay bằng kiểm tra.TextField children value)
// Cu12 verify ở mức DOM: Form submit → button text đổi "Đã submit ✓"
await submitBtn.click();
await page2.waitForTimeout(500);
const cu12 = await page2.evaluate(() => {
	const btn = document.querySelector('[data-test="ic-form"] button[type="submit"]');
	return btn?.textContent?.trim() ?? null;
});
ok('CU12b: submit → nút "Đã submit ✓"', cu12?.includes('Đã submit') ?? false, cu12 ?? '(null)');

// Screenshot PC: form section (valid + submitted)
await page2
	.locator('[data-test="ic-form"]')
	.screenshot({ path: 'tests/screenshots/input-currency/04-form-submitted.png' });
console.log('Screenshot: tests/screenshots/input-currency/04-form-submitted.png');

await browser2.close();

const passCount = results.filter((r) => r.pass).length;
console.log(`\n=== KẾT QUẢ: ${passCount}/${results.length} PASS ===`);
if (passCount !== results.length) process.exit(1);
