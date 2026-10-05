// slider-probe.mjs
// Functional probe cho task "Slider (form field)":
// - SL0 page `.slider-root` render
// - SL1 native input[type=range] present + value + aria-valuenow
// - SL2 set value (keyboard) → bindable value đổi + showValue text đổi
// - SL3 clamp: value > max → clamped max
// - SL4 arrow Right +step, Home→min, End→max (keyboard native)
// - SL5 min/max/step attribute đúng
// - SL6 disabled → input.disabled + không thay đổi
// - SL7 a11y aria-label + focus ring (:focus-visible)
// - SL8 form gate + validation minValue/maxValue sau debounce
// Chạy: node tests/slider-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/slider';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="slider-demo"]', { timeout: 20000 });
// Chờ SvelteKit hydration xong (client listeners + binding gắn vào DOM)
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

const input = (dataTest) => page.locator(`[data-test="${dataTest}"] input[type="range"]`).first();
const root = (dataTest) => page.locator(`[data-test="${dataTest}"] .slider-root`).first();

console.log('\n=== SL0: PAGE + .slider-root ===');
ok('SL0: demo root render', (await page.locator('[data-test="slider-demo"]').count()) === 1);
ok(
	'SL0: .slider-root render trong sl-basic',
	(await page.locator('[data-test="sl-basic"] .slider-root').count()) === 1
);
// 9 roots: basic(1) + ticks(1) + sizes(3) + disabled(1) + clamp(1) + minmax(1) + form(1)
ok(
	'SL0: đúng 9 slider-root trên page',
	(await page.locator('.slider-root').count()) === 9,
	`count=${await page.locator('.slider-root').count()}`
);

console.log('\n=== SL1: NATIVE input[type=range] + VALUE + ARIA ===');
ok(
	'SL1: sl-basic chứa native input[type=range]',
	(await page.locator('[data-test="sl-basic"] input[type="range"]').count()) === 1
);
const sl1Val = await input('sl-basic').inputValue();
ok('SL1: default value=30 đúng', sl1Val === '30', `value=${sl1Val}`);
// Implicit role=slider + value: Chrome KHÔNG expose aria-valuenow trên DOM
// (getAttribute & el.ariaValueNow = null) — chỉ có trong a11y tree.
// ariaSnapshot trả về: `- slider "Basic slider": "30"` (role + name + value).
const sl1Snap = await input('sl-basic').ariaSnapshot();
ok(
	'SL1: implicit role=slider + value 30 trong a11y tree',
	/- slider "Basic slider": "30"/.test(sl1Snap ?? ''),
	`snapshot=${sl1Snap}`
);

console.log('\n=== SL2: KEYBOARD SET VALUE → BINDABLE + SHOWVALUE ĐỔI ===');
await input('sl-basic').focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(150);
const sl2Val = await input('sl-basic').inputValue();
const sl2Hint = await page.locator('[data-test="sl-basic-value"]').textContent();
ok('SL2: ArrowRight → value 31 (bindable đổi)', sl2Val === '31', `value=${sl2Val}`);
ok('SL2: showValue text đổi thành 31', sl2Hint?.trim() === '31', `hint=${sl2Hint}`);

console.log('\n=== SL3: CLAMP (value > max → clamped max) ===');
await page.locator('[data-test="sl-clamp-set"]').click();
await page.waitForTimeout(250);
const sl3Val = await input('sl-clamp').inputValue();
const sl3Hint = await page.locator('[data-test="sl-clamp-value"]').textContent();
ok('SL3: page state 500 → input clamp về 100 (max)', sl3Val === '100', `value=${sl3Val}`);
ok('SL3: showValue hiện 100 (state đồng bộ)', sl3Hint?.trim() === '100', `hint=${sl3Hint}`);

console.log('\n=== SL4: KEYBOARD NATIVE (Arrow/Home/End) ===');
await input('sl-basic').focus();
const sl4Before = Number(await input('sl-basic').inputValue());
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(100);
const sl4Arrow = Number(await input('sl-basic').inputValue());
ok('SL4: ArrowRight → +step (1)', sl4Arrow === sl4Before + 1, `before=${sl4Before} after=${sl4Arrow}`);
await page.keyboard.press('Home');
await page.waitForTimeout(100);
const sl4Home = await input('sl-basic').inputValue();
ok('SL4: Home → min (0)', sl4Home === '0', `value=${sl4Home}`);
await page.keyboard.press('End');
await page.waitForTimeout(100);
const sl4End = await input('sl-basic').inputValue();
ok('SL4: End → max (100)', sl4End === '100', `value=${sl4End}`);

console.log('\n=== SL5: MIN/MAX/STEP ATTRIBUTE ===');
ok('SL5: sl-basic min=0', (await input('sl-basic').getAttribute('min')) === '0');
ok('SL5: sl-basic max=100', (await input('sl-basic').getAttribute('max')) === '100');
ok('SL5: sl-basic step=1', (await input('sl-basic').getAttribute('step')) === '1');
ok('SL5: sl-ticks step=5', (await input('sl-ticks').getAttribute('step')) === '5', `step=${await input('sl-ticks').getAttribute('step')}`);
ok('SL5: sl-form (in-form) max=100', (await input('sl-form').getAttribute('max')) === '100');

console.log('\n=== SL6: DISABLED ===');
ok('SL6: disabled input có .disabled', await input('sl-disabled').isDisabled());
const sl6Before = await input('sl-disabled').inputValue();
await input('sl-disabled').focus();
await page.keyboard.press('End');
await page.waitForTimeout(100);
const sl6After = await input('sl-disabled').inputValue();
ok('SL6: disabled → không đổi value khi keyboard', sl6After === sl6Before, `before=${sl6Before} after=${sl6After}`);

console.log('\n=== SL7: A11Y (aria-label + FOCUS RING) ===');
const sl7Label = await input('sl-basic').getAttribute('aria-label');
ok('SL7: aria-label="Basic slider"', sl7Label === 'Basic slider', `aria-label=${sl7Label}`);
// Focus bằng evaluate sau chuỗi keyboard → :focus-visible match; outline indigo-500
const sl7Focus = await input('sl-basic').evaluate((el) => {
	el.focus();
	const cs = getComputedStyle(el);
	return el.matches(':focus-visible') && cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px';
});
ok('SL7: focus → input :focus-visible + outline (focus ring)', sl7Focus);

console.log('\n=== SL8: FORM GATE + VALIDATION MIN/MAX (sau debounce) ===');
const submitBtn = page.locator('[data-test="sl-form"] .button-root').filter({ hasText: 'Submit' }).first();
ok('SL8: ban đầu submit DISABLED (slider=0 < minValue 10 + email trống)', await submitBtn.isDisabled());
// Kéo slider lên (End) + nhập email → hợp lệ → enabled
await input('sl-form').focus();
await page.keyboard.press('End');
await page.locator('[data-test="sl-form"] input[type="email"]').fill('probe@example.com');
await page.waitForTimeout(500); // debounce delay=150ms + buffer
ok('SL8: slider=100 (≥10) + email hợp lệ → submit ENABLED', !(await submitBtn.isDisabled()));
// Kéo về 0 (Home) → minValue 10 invalid → gate disabled
// (focus đang ở email sau fill() → phải focus lại input slider)
await input('sl-form').focus();
await page.keyboard.press('Home');
await page.waitForTimeout(500);
ok('SL8: slider=0 (< minValue 10) → submit DISABLED (form validation gate)', await submitBtn.isDisabled());
// Hợp lệ lại + submit → payload JSON
await page.keyboard.press('End');
await page.waitForTimeout(500);
await submitBtn.click();
await page.waitForTimeout(250);
const payload = await page.locator('[data-test="sl-payload"]').textContent().catch(() => '');
ok(
	'SL8: submit → payload JSON chứa score + email (form serialize "value" in children)',
	payload?.includes('"score"') && payload?.includes('probe@example.com'),
	payload?.trim()
);

// ── sl-minmax: minValue/maxValue pipeline (chạy khi value CHANGE) ──
const mmInput = input('sl-minmax');
await mmInput.focus();
await page.keyboard.press('End'); // 100 > maxValue 50 → invalid
await page.waitForTimeout(500);
const sl8minmaxCls = await root('sl-minmax').getAttribute('class');
ok(
	'SL8: sl-minmax End (100 > maxValue 50) → root có class color-error',
	/color-error/.test(sl8minmaxCls ?? ''),
	sl8minmaxCls
);
const sl8msg = await page
	.locator('[data-test="sl-minmax"] .fieldMessages-root')
	.textContent()
	.catch(() => '');
ok('SL8: FieldMessages hiện message "tối đa 50" (invalid)', /(tối đa|max|50)/i.test(sl8msg ?? ''), sl8msg?.trim());
// Kéo về 40 (∈ [20,50]) → valid → success (step=5: 12 lần ArrowLeft từ 100)
for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(500);
const sl8okCls = await root('sl-minmax').getAttribute('class');
ok('SL8: sl-minmax value 40 ∈ [20,50] → root có class color-success', /color-success/.test(sl8okCls ?? ''), sl8okCls);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/slider';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="sl-basic"]').screenshot({ path: `${shotDir}/01-default-showvalue.png` });
await page.locator('[data-test="sl-ticks"]').screenshot({ path: `${shotDir}/02-ticks.png` });
await page.locator('[data-test="sl-sizes"]').screenshot({ path: `${shotDir}/03-sizes.png` });
await page.locator('[data-test="sl-disabled"]').screenshot({ path: `${shotDir}/04-disabled.png` });
await page.locator('[data-test="sl-minmax"]').screenshot({ path: `${shotDir}/05-validation.png` });
await page.locator('[data-test="sl-form"]').screenshot({ path: `${shotDir}/06-form-gating.png` });
await page.locator('[data-test="slider-demo"]').screenshot({ path: `${shotDir}/01-slider-cases.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
