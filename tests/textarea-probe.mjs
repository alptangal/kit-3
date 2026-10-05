// textarea-probe.mjs
// Functional probe cho task "Textarea (form field)":
// - TA0  root .textarea-root + native <textarea>
// - TA1  native tag + rows đúng (rows prop, default 3)
// - TA2  value bindable (gõ → page state đổi)
// - TA3  required blank → sau debounce class color-error + FieldMessages hiện
// - TA4  input valid → color-success (showValid ON)
// - TA5  maxLength: fill 150 chars → capped 100
// - TA6  autoResize: fill 20 lines → height grew
// - TA7  form gate: submit disabled until required filled → enabled
// Chạy: node tests/textarea-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/textarea';
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
await page.waitForSelector('[data-test="textarea-demo"]', { timeout: 20000 });
// Chờ SvelteKit hydration xong (client listeners gắn vào DOM) trước khi thao tác —
// tránh race: fill() trước khi hydrate → binding value không đồng bộ.
// SvelteKit 2.x không set window.__sveltekit → dùng networkidle + buffer.
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

const ta = (dataTest) => page.locator(`[data-test="${dataTest}"] textarea`);
const root = (dataTest) => page.locator(`[data-test="${dataTest}"] .textarea-root`).first();

console.log('\n=== TA0: ROOT + NATIVE TEXTAREA ===');
ok('TA0: demo root render', (await page.locator('[data-test="textarea-demo"]').count()) === 1);
ok('TA0: .textarea-root render trong ta-basic', (await page.locator('[data-test="ta-basic"] .textarea-root').count()) === 1);
ok('TA0: root chứa native <textarea>', (await page.locator('[data-test="ta-basic"] .textarea-root > textarea').count()) === 1);

console.log('\n=== TA1: NATIVE TAG + ROWS ===');
ok(
	'TA1: native tag là TEXTAREA (không div giả lập)',
	(await page.locator('[data-test="ta-basic"] .textarea-root > textarea').count()) === 1
);
const rowsBasic = await ta('ta-basic').getAttribute('rows');
ok('TA1: default rows=3 khi không truyền rows', rowsBasic === '3', `rows=${rowsBasic}`);
const rowsAuto = await ta('ta-auto').getAttribute('rows');
ok('TA1: rows prop=3 honour (ta-auto rows=3)', rowsAuto === '3', `rows=${rowsAuto}`);

console.log('\n=== TA2: VALUE BINDABLE ===');
await ta('ta-basic').fill('Hello probe');
await page.waitForTimeout(100);
const hintVal = await page.locator('[data-test="ta-basic"] .demo-hint code').first().textContent();
ok('TA2: gõ → page state bind đồng bộ (hint hiện "Hello probe")', hintVal?.trim() === 'Hello probe', hintVal);

console.log('\n=== TA3: REQUIRED BLANK → COLOR-ERROR + FIELDMESSAGES ===');
// FRESH BLANK STATE: reload để reset pipeline (_justReset=true, messages trống)
// — tránh bị ảnh hưởng bởi các bước trước (probe chạy top-down 1 lần).
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="ta-required"] textarea', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);
const requiredTa = ta('ta-required');
// Trigger pipeline: nhập → blur → xoá sạch (rỗng) → debounce → required fail
await requiredTa.fill('abc');
await requiredTa.blur();
await page.waitForTimeout(400);
await requiredTa.fill('');
await page.waitForTimeout(450); // debounce default 300ms
const clsError = await root('ta-required').getAttribute('class');
ok('TA3: blank + required → root có class color-error', /color-error/.test(clsError ?? ''), clsError);
const msgError = await page
	.locator('[data-test="ta-required"] .fieldMessages-root')
	.textContent()
	.catch(() => '');
ok(
	'TA3: FieldMessages hiển thị message "bắt buộc" (invalid)',
	/(bắt buộc|required)/i.test(msgError ?? ''),
	msgError?.trim()
);

console.log('\n=== TA4: INPUT VALID → COLOR-SUCCESS (showValid ON) ===');
await page.locator('[data-test="ta-showvalid"]').check();
await requiredTa.fill('nội dung hợp lệ');
await page.waitForTimeout(450);
const clsSuccess = await root('ta-required').getAttribute('class');
ok('TA4: giá trị hợp lệ → root có class color-success', /color-success/.test(clsSuccess ?? ''), clsSuccess);
const msgValid = await page
	.locator('[data-test="ta-required"] .fieldMessages-root')
	.textContent()
	.catch(() => '');
ok('TA4: FieldMessages (showValid) hiện message "hợp lệ"', /(hợp lệ|valid)/i.test(msgValid ?? ''), msgValid?.trim());

console.log('\n=== TA5: MAXLENGTH CAPPED ===');
const longInput = 'x'.repeat(150);
await ta('ta-maxlength').fill(longInput);
await page.waitForTimeout(100);
const capVal = await ta('ta-maxlength').inputValue();
ok('TA5: fill 150 chars với maxLength=100 → capped 100', capVal.length === 100, `len=${capVal.length}`);
const counter = await page.locator('[data-test="ta-counter"]').textContent();
ok('TA5: counter demo hiện "100/100"', counter?.trim() === '100/100', counter);

console.log('\n=== TA6: AUTO-RESIZE ===');
const autoTa = ta('ta-auto');
const hBefore = await autoTa.evaluate((el) => el.getBoundingClientRect().height);
await autoTa.fill(Array.from({ length: 20 }, (_, i) => `dòng số ${i + 1}`).join('\n'));
await page.waitForTimeout(200);
const hAfter = await autoTa.evaluate((el) => el.getBoundingClientRect().height);
ok('TA6: fill 20 dòng → height giãn theo nội dung', hAfter > hBefore + 50, `before=${Math.round(hBefore)} after=${Math.round(hAfter)}`);
// Max-height clamp 20rem: fill 100 dòng → height không vượt ~20rem (320px @16px root + tolerance)
await autoTa.fill(Array.from({ length: 100 }, (_, i) => `dòng dài ${i + 1}`).join('\n'));
await page.waitForTimeout(200);
const hClamped = await autoTa.evaluate((el) => el.getBoundingClientRect().height);
const maxH = 20 * 16 + 12; // 320px + border/padding tolerance
ok('TA6: 100 dòng → height clamp ≤ 20rem (~320px)', hClamped <= maxH, `h=${Math.round(hClamped)} (limit ${maxH})`);

console.log('\n=== TA7: FORM GATE ===');
const submitBtn = page.locator('[data-test="ta-form"] .button-root').filter({ hasText: 'Submit' }).first();
ok('TA7: ban đầu submit DISABLED (chưa có comment + email)', await submitBtn.isDisabled());
await page.locator('[data-test="ta-form"] textarea').first().fill('Comment probe');
const emailInput = page.locator('[data-test="ta-form"] input[type="email"]');
await emailInput.fill('probe@example.com');
await emailInput.blur();
await page.waitForTimeout(600); // debounce validation (textarea + input)
ok('TA7: comment + email hợp lệ → submit ENABLED', !(await submitBtn.isDisabled()));
// Email sai → form gate → disabled lại
await emailInput.fill('sai-dinh-dang');
await emailInput.blur();
await page.waitForTimeout(600);
ok('TA7: email sai → submit DISABLED (form validation gate)', await submitBtn.isDisabled());
// Restore + submit → payload JSON
await emailInput.fill('probe@example.com');
await emailInput.blur();
await page.waitForTimeout(600);
await submitBtn.click();
await page.waitForTimeout(150);
const payload = await page.locator('[data-test="ta-payload"]').textContent().catch(() => '');
ok(
	'TA7: submit → payload JSON chứa comment (form serialize "value" in children)',
	payload?.includes('Comment probe') && /"comment"/.test(payload ?? ''),
	payload?.trim()
);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/textarea';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="ta-basic"]').screenshot({ path: `${shotDir}/01-basic.png` });
await page.locator('[data-test="ta-required"]').screenshot({ path: `${shotDir}/02-required-fieldmessages.png` });
await page.locator('[data-test="ta-auto"]').screenshot({ path: `${shotDir}/03-auto-resize.png` });
await page.locator('[data-test="ta-form"]').screenshot({ path: `${shotDir}/04-form-gating.png` });
// Full page (các section còn lại: maxlength, disabled, sizes)
await page.locator('[data-test="textarea-demo"]').screenshot({ path: `${shotDir}/01-textarea-cases.png`, fullPage: false });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
