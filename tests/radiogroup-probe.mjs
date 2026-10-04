// radiogroup-probe.mjs
// Functional probe cho task "hoàn thiện #radio (viết lại theo mẫu Checkbox)":
// - RG0  page render (data-test=radiogroup-demo, role=radiogroup)
// - RG1  unique native name + không collision giữa 2 group (regression R6)
// - RG2  click chọn option
// - RG3  roving focus ArrowDown/ArrowRight
// - RG4  Space chọn option đang focus
// - RG5  focus KHÔNG tràn ra group khác (regression R7: bỏ svelte:window)
// - RG6  Home/End
// - RG7  required + FieldMessages (showValid) sau debounce
// - RG8  form gating (submit disabled tới khi radio + email hợp lệ)
// - RG9  a11y: role=radiogroup, đúng MỘT input tabindex=0, phần còn lại -1
// Chạy: node tests/radiogroup-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/radiogroup';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="radiogroup-demo"]', { timeout: 20000 });

const group = (dataTest) => page.locator(`[data-test="${dataTest}"] .radiogroup-root`);
const radios = (dataTest) => group(dataTest).locator('input[type="radio"]');
const checkedValues = (dataTest) =>
	radios(dataTest).evaluateAll((els) => els.filter((el) => el.checked).map((el) => el.value));
const allNames = (dataTest) =>
	radios(dataTest).evaluateAll((els) => [...new Set(els.map((el) => el.name))]);
const activeInfo = async () =>
	page.evaluate(() => {
		const a = document.activeElement;
		return a instanceof HTMLInputElement && a.type === 'radio'
			? { value: a.value, section: a.closest('[data-test]')?.getAttribute('data-test') ?? '' }
			: { value: null, section: a?.closest('[data-test]')?.getAttribute('data-test') ?? '' };
	});

console.log('\n=== RG0: PAGE RENDER ===');
ok('RG0: demo root render', (await page.locator('[data-test="radiogroup-demo"]').count()) === 1);
const groupCount = await page.locator('[role="radiogroup"]').count();
ok('RG0: 7 RadioGroup role=radiogroup', groupCount === 7, String(groupCount));

console.log('\n=== RG1: UNIQUE NAME + KHÔNG COLLISION (regression R6) ===');
const nameH = await allNames('rg-horizontal'); // group KHÔNG có prop name → auto-unique
const nameK = await allNames('rg-keyboard');
ok(
	'RG1: 2 group không-name tự sinh native name unique (khác nhau, không rỗng)',
	nameH.length === 1 && nameK.length === 1 && nameH[0] && nameK[0] && nameH[0] !== nameK[0],
	`${nameH[0] ?? ''} vs ${nameK[0] ?? ''}`
);
// Collision: chọn 1 group không làm mất check của group khác
await page.locator('[data-test="rg-horizontal"] .radio-item', { hasText: 'Red' }).click();
await page.locator('[data-test="rg-keyboard"] .radio-item', { hasText: 'Option 1' }).click();
await page.waitForTimeout(150);
ok(
	'RG1: chọn group khác không xóa check của group trước (collision)',
	JSON.stringify(await checkedValues('rg-horizontal')) === JSON.stringify(['red']) &&
		JSON.stringify(await checkedValues('rg-keyboard')) === JSON.stringify(['k1']),
	`h=${(await checkedValues('rg-horizontal')).join(',')} k=${(await checkedValues('rg-keyboard')).join(',')}`
);

console.log('\n=== RG2: CLICK CHỌN ===');
await page.locator('[data-test="rg-required"] .radio-item', { hasText: 'Pro' }).click();
await page.waitForTimeout(150);
ok('RG2: click "Pro" → checked + page state đồng bộ', (await checkedValues('rg-required')).join(',') === 'pro');
const hint2 = await page.locator('[data-test="rg-required"] code').first().textContent();
ok('RG2: demo hint hiển thị giá trị "pro"', hint2?.trim() === 'pro', hint2);

console.log('\n=== RG3: ROVING FOCUS ArrowDown/ArrowRight ===');
// rg-keyboard đang có k1 checked (từ RG1) → activeId = k1 (tabindex=0)
await radios('rg-keyboard').first().focus();
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(80);
let act = await activeInfo();
ok('RG3: ArrowDown → focus chuyển sang option kế tiếp (k2)', act.value === 'k2', `active=${act.value} @${act.section}`);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(80);
act = await activeInfo();
ok('RG3: ArrowRight (horizontal nav) → option kế tiếp (k3)', act.value === 'k3', `active=${act.value}`);

console.log('\n=== RG4: SPACE CHỌN OPTION ĐANG FOCUS ===');
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(80);
await page.keyboard.press(' ');
await page.waitForTimeout(150);
ok('RG4: Space chọn option đang focus (k2)', (await checkedValues('rg-keyboard')).join(',') === 'k2');
// Roving tabindex: sau khi chọn k2, activeId = k2 → input k2 nhận tabindex=0
const tabindex0 = await radios('rg-keyboard').evaluateAll((els) =>
	els.filter((el) => el.tabIndex === 0).map((el) => el.value)
);
ok('RG4: roving tabindex — chỉ input k2 có tabindex=0 (theo value đã chọn)', JSON.stringify(tabindex0) === JSON.stringify(['k2']), JSON.stringify(tabindex0));

console.log('\n=== RG5: FOCUS KHÔNG TRÀN RA GROUP KHÁC (regression R7) ===');
// Sau RG4: focus = k2 (rg-keyboard). ArrowDown → k3 (vẫn trong group).
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(80);
act = await activeInfo();
ok('RG5: ArrowDown vẫn focus TRONG group (k2 → k3), không tràn group khác', act.value === 'k3' && act.section === 'rg-keyboard', `active=${act.value} @${act.section}`);
// Wrap ở cuối: ArrowDown từ k3 → k1
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(80);
act = await activeInfo();
ok('RG5: ArrowDown wrap cuối → option đầu (k1)', act.value === 'k1' && act.section === 'rg-keyboard', `active=${act.value} @${act.section}`);
// Wrap ở đầu: ArrowLeft từ k1 → k3
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(80);
act = await activeInfo();
ok('RG5: ArrowLeft wrap đầu → option cuối (k3)', act.value === 'k3' && act.section === 'rg-keyboard', `active=${act.value} @${act.section}`);
// Group khác không bị ảnh hưởng
ok('RG5: state group khác nguyên vẹn (rg-horizontal vẫn "red")', (await checkedValues('rg-horizontal')).join(',') === 'red');

console.log('\n=== RG6: HOME / END ===');
await page.keyboard.press('Home');
await page.waitForTimeout(80);
act = await activeInfo();
ok('RG6: Home → focus option đầu (k1)', act.value === 'k1', `active=${act.value}`);
await page.keyboard.press('End');
await page.waitForTimeout(80);
act = await activeInfo();
ok('RG6: End → focus option cuối (k3)', act.value === 'k3', `active=${act.value}`);

console.log('\n=== RG7: REQUIRED + FIELDMESSAGES (showValid, debounce) ===');
// rg-required đang có "pro" checked (RG2) + message valid từ RG2; đổi sang "free"
await page.locator('[data-test="rg-required"] .radio-item', { hasText: 'Free' }).click();
await page.waitForTimeout(700); // debounce default 300ms
const msgText = await page
	.locator('[data-test="rg-required"] .fieldMessages-root')
	.textContent()
	.catch(() => '');
ok(
	'RG7: sau khi chọn option, FieldMessages (showValid) hiển thị message hợp lệ',
	/valid|hợp lệ/i.test(msgText ?? ''),
	msgText?.trim()
);

console.log('\n=== RG8: FORM GATING (radio required + email) ===');
const submitBtn = page.locator('[data-test="rg-form"] .button-root').filter({ hasText: 'Submit' }).first();
ok('RG8: ban đầu submit DISABLED (chưa chọn plan + chưa có email)', await submitBtn.isDisabled());
await page.locator('[data-test="rg-form"] .radio-item', { hasText: 'Premium' }).click();
const emailInput = page.locator('[data-test="rg-form"] input[type="email"]');
await emailInput.fill('probe@example.com');
await emailInput.blur();
await page.waitForTimeout(600); // debounce validation input
ok('RG8: chọn plan + email hợp lệ → submit ENABLED', !(await submitBtn.isDisabled()));
// Email sai → input validation fail → form isValid false → disabled
await emailInput.fill('sai-dinh-dang');
await emailInput.blur();
await page.waitForTimeout(600);
ok('RG8: email sai → submit DISABLED (form validation gate)', await submitBtn.isDisabled());

console.log('\n=== RG9: A11Y (role=radiogroup, roving tabindex) ===');
const a11y = await page.evaluate(() => {
	const out = {};
	for (const g of document.querySelectorAll('[role="radiogroup"]')) {
		const inputs = [...g.querySelectorAll('input[type="radio"]')];
		out[g.getAttribute('aria-label') ?? '(no-label)'] = {
			total: inputs.length,
			tab0: inputs.filter((el) => el.tabIndex === 0).length,
			tabMinus1: inputs.filter((el) => el.tabIndex === -1).length,
			labels: inputs.every((el) => (el.getAttribute('aria-label') ?? '').trim().length > 0)
		};
	}
	return out;
});
const allGroupsOk = Object.values(a11y).every((g) => g.total > 0 && g.tab0 === 1 && g.tabMinus1 === g.total - 1 && g.labels);
ok(
	'RG9: mọi group: đúng 1 input tabindex=0, còn lại tabindex=-1, input có aria-label',
	allGroupsOk,
	JSON.stringify(a11y)
);
ok('RG9: root có role=radiogroup + aria-label', (await page.locator('[role="radiogroup"][aria-label]').count()) >= 7);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/radiogroup';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="rg-sizes"]').screenshot({ path: `${shotDir}/01-sizes.png` });
await page.locator('[data-test="rg-horizontal"]').screenshot({ path: `${shotDir}/02-horizontal-description.png` });
await page.locator('[data-test="rg-required"]').screenshot({ path: `${shotDir}/03-required-fieldmessages.png` });
// rg-form: restore state valid trước khi chụp
await emailInput.fill('probe@example.com');
await emailInput.blur();
await page.waitForTimeout(600);
await page.locator('[data-test="rg-form"]').screenshot({ path: `${shotDir}/04-form-gating.png` });
await page.locator('[data-test="rg-disabled"]').screenshot({ path: `${shotDir}/05-disabled.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
