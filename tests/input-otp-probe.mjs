// tests/input-otp-probe.mjs
// Functional probe cho task "Input OTP (form field)":
//  I0  page render: .input-otp-root × 3 (basic/required/form)
//  I1  auto-advance: gõ 1 ký tự → ô index 1 active (document.activeElement)
//  I2  backspace on empty ô 1 → activeElement về ô 0 + ô 0 xóa
//  I3  paste "123456" vào ô 0 → 6 ô đầy + value page state "123456"
//  I4  arrow Right/Left di chuyển focus giữa các ô
//  I5  required: input chưa đủ → ~debounce color-error + FieldMessages message;
//     đủ 6 → color-success (+ message valid khi showValid ON)
//  I6  form gate: submit disabled khi chưa đủ 6 → enabled khi đủ 6 → submit payload
//  I7  a11y: 6 ô, ô đầu focusable, root aria-label, autocomplete="one-time-code"
//  I8  controlled: parent set bind:value "777777" → 6 ô hiện 7
// Chạy: node tests/input-otp-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/input-otp';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	colorScheme: 'light',
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-otp-demo"]', { timeout: 20000 });
// Chờ SvelteKit hydration xong (client listeners gắn vào DOM) trước khi thao tác.
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

const boxes = (dataTest) => page.locator(`[data-test="${dataTest}"] .otp-box`);
const root = (dataTest) => page.locator(`[data-test="${dataTest}"] .input-otp-root`);

// ============ I0 — ROOT RENDER ============
console.log('\n=== I0: ROOT RENDER ===');
ok('I0: demo root render', (await page.locator('[data-test="input-otp-demo"]').count()) === 1);
const rootCount = await page.locator('.input-otp-root').count();
ok('I0: 4 instance .input-otp-root (basic/required/disabled/form)', rootCount === 4, `count=${rootCount}`);
ok('I0: basic có 6 ô .otp-box', (await boxes('otp-basic').count()) === 6);

// ============ I1 — AUTO-ADVANCE ============
console.log('\n=== I1: AUTO-ADVANCE (gõ 1 ký tự → ô index 1 active) ===');
await boxes('otp-basic').first().click();
await page.keyboard.type('4');
await page.waitForTimeout(150);
const activeIdx1 = await page.evaluate(() => {
	const all = [...document.querySelectorAll('[data-test="otp-basic"] .otp-box')];
	return all.indexOf(document.activeElement);
});
ok('I1: gõ "4" → ô 0 chứa 4', (await boxes('otp-basic').first().inputValue()) === '4');
ok('I1: focus tự nhảy sang ô index 1 (auto-advance)', activeIdx1 === 1, `activeIndex=${activeIdx1}`);
await boxes('otp-basic').first().fill(''); // cleanup ô 0 (focus đang ô 1, không đụng)

// ============ I2 — BACKSPACE ON EMPTY ============
console.log('\n=== I2: BACKSPACE ON EMPTY Ô 1 → VÔT Ô 0 + FOCUS Ô 0 ===');
// Ô 0 có "4", focus đang ô 1 (trống) → Backspace: ô 1 trống → xóa ô 0, focus ô 0
await page.keyboard.press('Backspace');
await page.waitForTimeout(100);
const activeIdx2 = await page.evaluate(() => {
	const all = [...document.querySelectorAll('[data-test="otp-basic"] .otp-box')];
	return all.indexOf(document.activeElement);
});
ok('I2: backspace trên ô trống → focus về ô 0', activeIdx2 === 0, `activeIndex=${activeIdx2}`);
ok('I2: ô 0 bị xóa (trống)', (await boxes('otp-basic').first().inputValue()) === '');

// ============ I3 — PASTE DISTRIBUTION ============
console.log('\n=== I3: PASTE "123456" VÀO Ô 0 → 6 Ô ĐẦY ===');
// Synthetic ClipboardEvent mang DataTransfer thật → clipboardData.getData('text') = "123456".
await boxes('otp-basic').first().focus();
await page.evaluate(() => {
	const el = document.querySelector('[data-test="otp-basic"] .otp-box');
	const dt = new DataTransfer();
	dt.setData('text/plain', '123456');
	el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
});
await page.waitForTimeout(200);
const filledVals = [];
for (let i = 0; i < 6; i++) filledVals.push(await boxes('otp-basic').nth(i).inputValue());
ok('I3: paste → 6 ô đầy đủ "123456"', filledVals.join('') === '123456', filledVals.join(''));
const basicHint = await page.locator('[data-test="otp-basic-value"]').textContent();
ok('I3: page state bind:value đồng bộ "123456"', basicHint?.trim() === '123456', basicHint);

// ============ I4 — ARROW KEYS ============
console.log('\n=== I4: ARROW RIGHT/LEFT DI CHUYỂN FOCUS ===');
// Clear basic bằng fill từng ô (bắt từ ô 0)
await boxes('otp-basic').first().click();
for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
await page.waitForTimeout(100);
await boxes('otp-basic').first().focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(100);
let activeIdx4 = await page.evaluate(() => {
	const all = [...document.querySelectorAll('[data-test="otp-basic"] .otp-box')];
	return all.indexOf(document.activeElement);
});
ok('I4: ArrowRight từ ô 0 → ô 1', activeIdx4 === 1, `activeIndex=${activeIdx4}`);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(100);
activeIdx4 = await page.evaluate(() => {
	const all = [...document.querySelectorAll('[data-test="otp-basic"] .otp-box')];
	return all.indexOf(document.activeElement);
});
ok('I4: ArrowLeft từ ô 1 → ô 0', activeIdx4 === 0, `activeIndex=${activeIdx4}`);
// ArrowRight ở ô cuối → clamp ô 5 (không overflow)
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
await page.waitForTimeout(100);
activeIdx4 = await page.evaluate(() => {
	const all = [...document.querySelectorAll('[data-test="otp-basic"] .otp-box')];
	return all.indexOf(document.activeElement);
});
ok('I4: ArrowRight ở ô 5 → clamp (vẫn ô 5)', activeIdx4 === 5, `activeIndex=${activeIdx4}`);

// ============ I5 — REQUIRED VALIDATION (fresh reload) ============
console.log('\n=== I5: REQUIRED → COLOR-ERROR + COLOR-SUCCESS ===');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="otp-required"] .otp-box', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);
const reqBoxes = boxes('otp-required');
// Gõ chưa đủ (4 số) → debounce (default 300ms) → required fail
await reqBoxes.first().click();
await page.keyboard.type('1234');
await page.waitForTimeout(450);
const clsError = await root('otp-required').getAttribute('class');
ok('I5: 4/6 số + required → root có class color-error', /color-error/.test(clsError ?? ''), clsError);
const msgError = await page.locator('[data-test="otp-required"] .fieldMessages-root').textContent().catch(() => '');
ok(
	'I5: FieldMessages hiện message required (vi "mã xác nhận" / en "verification code")',
	/(mã xác nhận|6 ký tự|verification code|6-digit)/i.test(msgError ?? ''),
	msgError?.trim()
);
// Đủ 6 → success
await page.keyboard.type('56');
await page.waitForTimeout(450);
const clsSuccess = await root('otp-required').getAttribute('class');
ok('I5: đủ 6 số → root có class color-success', /color-success/.test(clsSuccess ?? ''), clsSuccess);
// showValid ON → message valid hiển thị
await page.locator('[data-test="otp-showvalid"]').check();
await page.waitForTimeout(150);
const msgValid = await page.locator('[data-test="otp-required"] .fieldMessages-root').textContent().catch(() => '');
ok(
	'I5: showValid ON → FieldMessages hiện "hợp lệ"',
	/(hợp lệ|valid)/i.test(msgValid ?? ''),
	msgValid?.trim()
);

// ============ I6 — FORM GATE ============
console.log('\n=== I6: FORM GATE (SUBMIT DISABLED → ENABLED) ===');
const submitBtn = page.locator('[data-test="otp-form"] .button-root').filter({ hasText: 'Submit' }).first();
ok('I6: ban đầu submit DISABLED (chưa đủ 6)', await submitBtn.isDisabled());
const formBoxes = boxes('otp-form');
await formBoxes.first().click();
await page.keyboard.type('246801');
await page.waitForTimeout(500); // debounce validation
ok('I6: đủ 6 số → submit ENABLED', !(await submitBtn.isDisabled()));
await submitBtn.click();
await page.waitForTimeout(200);
const payload = await page.locator('[data-test="otp-form-payload"]').textContent().catch(() => '');
ok(
	'I6: submit → payload JSON chứa otp (form serialize value)',
	/(otp|"246801")/.test(payload ?? '') && payload.includes('246801'),
	payload?.trim()
);

// ============ I7 — A11Y ============
console.log('\n=== I7: A11Y ===');
const a11y = await page.evaluate(() => {
	const rootEl = document.querySelector('[data-test="otp-basic"] .input-otp-root');
	const boxesAll = [...rootEl.querySelectorAll('.otp-box')];
	const first = boxesAll[0];
	return {
		boxCount: boxesAll.length,
		role: rootEl.getAttribute('role'),
		rootAriaLabel: rootEl.getAttribute('aria-label'),
		firstFocusable: !first.disabled && first.tabIndex >= 0,
		firstAutocomplete: first.getAttribute('autocomplete'),
		firstAriaLabel: first.getAttribute('aria-label'),
		inputmode: first.getAttribute('inputmode')
	};
});
ok('I7: 6 ô native <input>', a11y.boxCount === 6, `count=${a11y.boxCount}`);
ok('I7: root role="group"', a11y.role === 'group', a11y.role);
ok('I7: root aria-label đúng', a11y.rootAriaLabel === 'Mã OTP cơ bản', a11y.rootAriaLabel);
ok('I7: ô đầu focusable (không disabled)', a11y.firstFocusable);
ok('I7: autocomplete="one-time-code" (numeric)', a11y.firstAutocomplete === 'one-time-code', a11y.firstAutocomplete);
ok(
	'I7: ô đầu aria-label "Mã OTP cơ bản, ô 1"',
	/Mã OTP cơ bản, ô 1/.test(a11y.firstAriaLabel ?? ''),
	a11y.firstAriaLabel
);
ok('I7: inputmode="numeric"', a11y.inputmode === 'numeric', a11y.inputmode);
// Disabled case: ô disabled + root aria-disabled
const disState = await page.evaluate(() => {
	const rootEl = document.querySelector('[data-test="otp-disabled"] .input-otp-root');
	const first = rootEl.querySelector('.otp-box');
	return { disabled: first.disabled, rootClass: rootEl.getAttribute('class'), ariaDisabled: rootEl.getAttribute('aria-disabled') };
});
ok('I7 (disabled): ô native disabled', disState.disabled === true);
ok('I7 (disabled): root có class disabled', /disabled/.test(disState.rootClass ?? ''), disState.rootClass);

// ============ I8 — CONTROLLED BIND:VALUE ============
console.log('\n=== I8: CONTROLLED (PARENT SET "777777" → 6 Ô HIỆN 7) ===');
await page.locator('[data-test="otp-set777"]').click();
await page.waitForTimeout(250);
const vals8 = [];
for (let i = 0; i < 6; i++) vals8.push(await boxes('otp-basic').nth(i).inputValue());
ok('I8: set "777777" → 6 ô hiện "7"', vals8.every((v) => v === '7'), vals8.join(''));
const hint8 = await page.locator('[data-test="otp-basic-value"]').textContent();
ok('I8: hint page state đồng bộ "777777"', hint8?.trim() === '777777', hint8);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/input-otp';
mkdirSync(shotDir, { recursive: true });
// 01-basic: basic với giá trị 777777 (ô filled) + hint
await page.locator('[data-test="otp-basic"]').screenshot({ path: `${shotDir}/01-basic.png` });
// 02-error: required case (hiện tại đang success + showValid) → gây error để chụp:
// Xóa bằng fill('') từng ô (Backspace×6 từ ô 0 chỉ xóa được ô 0 — ô trống index 0
// không có ô trước để xóa; fill('') trigger input → boxes[i]='' + syncValue).
await page.locator('[data-test="otp-showvalid"]').uncheck().catch(() => {});
const reqBoxesShot = boxes('otp-required');
for (let i = 0; i < 6; i++) await reqBoxesShot.nth(i).fill('');
await reqBoxesShot.first().click();
await page.keyboard.type('1');
await page.waitForTimeout(450);
await page.locator('[data-test="otp-required"]').screenshot({ path: `${shotDir}/02-error.png` });
// 03-form: form case đang có payload (submitted)
await page.locator('[data-test="otp-form"]').screenshot({ path: `${shotDir}/03-form.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
