// keyboard-wave9-probe.mjs
// Functional probe cho task "Visual Number Keyboard wave 9 — tối ưu code logic +
// UI/UX": dọn keys map ({ [k in keys]?: events }[]) → mảng cấu hình NUMBER_KEYS
// + keyEvents() dùng chung, FIX phím ':' chết (Button không có events → click
// không dispatch), timeId khởi tạo sớm, processFocus gộp nhánh trùng lặp +
// fix restore height-bu ("${attr}px" → raw string).
// KB-0: input number mobile — readonly + inputmode none (native keyboard không mở).
// KB-1: click input number → keyboard mount ([data-keyboard-host]) đủ 21 phím.
// KB-2: bấm phím số → value input đổi (7 8 . 5 → "78.5").
// KB-3: AC clear → "".
// KB-4: Del xóa ký tự cuối ("99" → "9").
// KB-5: "=" tính calculator (123x4 → 492).
// KB-6: phím ":" dispatch (trước đây chết) + "=" chia (492:3 → 164).
// KB-7: "(" ")" dispatch (value chứa "()").
// KB-8: click ngoài → keyboard unmount.
// KB-9: preventDefault — phím bấm không chiếm focus (activeElement không là BUTTON).
// Chạy: node tests/keyboard-wave9-probe.mjs (dev server ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'https://localhost:3000/ui/input';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

mkdirSync('tests/screenshots/keyboard', { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 812 },
	hasTouch: true,
	isMobile: true,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-number"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

// Đọc state input number + keyboard (querySelector qua data-test / data-keyboard-host)
const state = () =>
	page.evaluate(() => {
		const input = document.querySelector('[data-test="input-number"] input');
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

console.log('\n=== KB-0: BASELINE — KEYBOARD CHƯA MOUNT, INPUT NUMBER MOBILE ===');
const base = await state();
ok(
	'KB-0: input number readonly + inputmode none (native keyboard không mở)',
	base.readonly === true && base.inputmode === 'none',
	`readonly=${base.readonly} inputmode=${base.inputmode}`
);

console.log('\n=== KB-1: CLICK INPUT NUMBER → KEYBOARD MOUNT ===');
// Flow thật (iOS): click input → getVisualKeyboardMeta đợi visualViewport resize
// → resize handler set visualKeyboard → showVisualNumberKb → keyboard mount.
// Playwright: mô phỏng keyboard mở bằng setViewportSize (viewport thu hẹp).
await page.locator('[data-test="input-number"] input').click();
await page.waitForTimeout(300);
await page.setViewportSize({ width: 375, height: 500 });
await page
	.waitForSelector('[data-keyboard-host] .keyboard-number-root', { timeout: 5000 })
	.catch(() => {});
await page.waitForTimeout(600);
const kb1 = await state();
ok('KB-1a: keyboard mount khi click input number', kb1.kbMounted, `kbMounted=${kb1.kbMounted}`);
ok(
	'KB-1b: keyboard đủ 21 phím (5 header + 16 lưới số)',
	kb1.kbButtonCount === 21,
	`count=${kb1.kbButtonCount}`
);

// Bấm 1 phím theo label (locator hasText — mỗi phím label duy nhất)
const pressKey = async (label) => {
	const btn = page
		.locator('[data-keyboard-host] .keyboard-number-root button', { hasText: label })
		.first();
	await btn.click();
	await page.waitForTimeout(120);
};

console.log('\n=== KB-2: BẤM PHÍM SỐ → VALUE INPUT ĐỔI ===');
await pressKey('7');
await pressKey('8');
await pressKey('.');
await pressKey('5');
const kb2 = await state();
ok('KB-2: 7 8 . 5 → "78.5"', kb2.value === '78.5', `value="${kb2.value}"`);

console.log('\n=== KB-3: AC CLEAR ===');
await pressKey('AC');
const kb3 = await state();
ok('KB-3: AC → value rỗng', kb3.value === '', `value="${kb3.value}"`);

console.log('\n=== KB-4: DEL XÓA CUỐI ===');
await pressKey('9');
await pressKey('9');
const kb4a = await state();
ok('KB-4a: 9 9 → "99"', kb4a.value === '99', `value="${kb4a.value}"`);
await pressKey('Del');
const kb4 = await state();
ok('KB-4b: Del → "9"', kb4.value === '9', `value="${kb4.value}"`);

console.log('\n=== KB-5: "=" TÍNH CALCULATOR (123x4 → 492) ===');
await pressKey('AC'); // reset — value '9' còn sót từ KB-4b sẽ nối vào nếu không clear
await pressKey('1');
await pressKey('2');
await pressKey('3');
await pressKey('x');
await pressKey('4');
const kb5a = await state();
ok('KB-5a: 1 2 3 x 4 → "123x4"', kb5a.value === '123x4', `value="${kb5a.value}"`);
await pressKey('=');
await page.waitForTimeout(700);
const kb5 = await state();
ok('KB-5b: "=" → calculator "492"', kb5.value === '492', `value="${kb5.value}"`);

console.log('\n=== KB-6: PHÍM ":" DISPATCH (TRƯỚC ĐÂY CHẾT) + "=" CHIA ===');
await pressKey(':');
const kb6a = await state();
ok(
	'KB-6a: ":" dispatch → value chứa ":"',
	kb6a.value?.includes(':') ?? false,
	`value="${kb6a.value}"`
);
await pressKey('3');
const kb6b = await state();
ok('KB-6b: 492 : 3 → "492:3"', kb6b.value === '492:3', `value="${kb6b.value}"`);
await pressKey('=');
await page.waitForTimeout(700);
const kb6 = await state();
ok('KB-6c: "=" → chia "164"', kb6.value === '164', `value="${kb6.value}"`);

console.log('\n=== KB-7: "(" ")" DISPATCH ===');
await pressKey('(');
await pressKey(')');
const kb7 = await state();
ok(
	'KB-7: "(" ")" dispatch → value chứa "()"',
	kb7.value?.includes('()') ?? false,
	`value="${kb7.value}"`
);

console.log('\n=== KB-9: PREVENTDEFAULT — PHÍM KHÔNG CHIẾM FOCUS NATIVE ===');
const kb9 = await state();
ok(
	'KB-9: sau bấm phím, activeElement không là BUTTON phím (preventDefault mousedown)',
	kb9.activeTag !== 'BUTTON',
	`activeTag=${kb9.activeTag}`
);

console.log('\n=== KB-8: CLICK NGOÀI ĐÓNG KEYBOARD ===');
await page.mouse.click(10, 150);
await page.waitForTimeout(600);
const kb8 = await state();
ok('KB-8: click ngoài → keyboard unmount', !kb8.kbMounted, `kbMounted=${kb8.kbMounted}`);

// ── Screenshot: keyboard mở trên input number (bấm lại để có value hiện) ──
await page.locator('[data-test="input-number"] input').click();
await page.waitForTimeout(300);
await page.setViewportSize({ width: 375, height: 500 });
await page
	.waitForSelector('[data-keyboard-host] .keyboard-number-root', { timeout: 5000 })
	.catch(() => {});
await page.waitForTimeout(600);
await pressKey('1');
await pressKey('2');
await pressKey('.');
await pressKey('5');
await page.waitForTimeout(300);
await page.screenshot({ path: 'tests/screenshots/keyboard/01-wave9.png' });
console.log('Screenshot: tests/screenshots/keyboard/01-wave9.png');

await browser.close();
const passCount = results.filter((r) => r.pass).length;
console.log(`\n=== KẾT QUẢ: ${passCount}/${results.length} PASS ===`);
if (passCount !== results.length) process.exit(1);
