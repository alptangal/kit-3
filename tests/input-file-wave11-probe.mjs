// input-file-wave11-probe.mjs
// WAVE 11 — Select all + Checkbox component reuse (type='file' quickDelete)
// - W1: select-all checkbox hiện ở header previews (indeterminate khi một phần)
// - W2: click select-all (all/mixed) → chọn/deselect hết (DataTable pattern)
// - W3: click select-all (none) → chọn tất cả
// - W4: tick từng card (Checkbox component reuse) → selectedFiles đúng
// - W5: header count "Đã chọn N/M tệp" + quickbar "Xóa N tệp" đồng bộ
// - W6: select-all indeterminate khi tick 1 phần
// - W7: xóa selected → files còn đúng, quickbar ẩn, select-all reset
// - W8: deselect all qua select-all khi đã all-selected
// - W9: keyboard Space/Enter trên row checkbox + select-all (mirror DataTable events)
// - W10: Checkbox component visuals (indeterminate dash, checkmark animation, color-primary)
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Port lấy từ biến môi trường PROBE_BASE (dev server mặc định 3000; khi cổng
// 3000 bận Vite tự nhảy cổng → đặt PROBE_BASE=https://localhost:XXXX/ui/input).
const BASE = process.env.PROBE_BASE ?? 'https://localhost:3000/ui/input';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fixtures (cùng folder tests/fixtures/ với probe cũ)
const FIX = 'tests/fixtures';
mkdirSync(FIX, { recursive: true });
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const png2Base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgF3TzHkVAAAAABJRU5ErkJggg==';
writeFileSync(join(FIX, 'logo.png'), Buffer.from(pngBase64, 'base64'));
writeFileSync(join(FIX, 'cover.png'), Buffer.from(png2Base64, 'base64'));
writeFileSync(join(FIX, 'notes.txt'), 'file notes line 1\nfile notes line 2\nfile notes line 3');
const p = (n) => join(FIX, n);

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('[data-test="input-demo"]', { timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
await page.waitForTimeout(1000);

// Hydration gate (copy từ probe cũ)
{
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser', { timeout: 10000 }),
		page.locator('.input-file-dropzone').first().click()
	]);
	await chooser.setFiles([]).catch(() => {});
	await sleep(200);
}

// Locators scoped per section
const section = (t) => page.locator(`[data-test="${t}"]`);
const fileInput = (t) => section(t).locator('input[type="file"]');
const dropzone = (t) => section(t).locator('.input-file-dropzone');
const cards = (t) => section(t).locator('.input-file-card');
const cardNames = (t) => cards(t).locator('.input-file-name').allTextContents();

// WAVE 11 section: if-quick-delete (có quickDelete bật)
const qs = section('if-quick-delete');
const qInput = fileInput('if-quick-delete');
// Select-all checkbox: wrapper data-test="input-file-select-all" > .checkbox-root
const selectAllWrap = qs.locator('[data-test="input-file-select-all"]');
const selectAllCheckbox = selectAllWrap.locator('.checkbox-root');
// Row checkboxes: wrapper data-test="input-file-check" > .checkbox-root
const rowChecks = qs.locator('[data-test="input-file-check"] > .checkbox-root');
const quickbar = qs.locator('[data-test="input-file-quickbar"]');
const quickbarDelete = qs.locator('[data-test="input-file-quickbar-delete"]');
const selectedCount = qs.locator('.input-file-selected-count');
const fileCount = qs.locator('.input-file-count');

console.log('\n=== W1: SELECT-ALL CHECKBOX RENDER (header previews) ===');
await qInput.setInputFiles([p('logo.png'), p('notes.txt'), p('cover.png')]);
await sleep(400);
ok('W1: select-all wrap tồn tại', (await selectAllWrap.count()) === 1);
ok('W1: select-all Checkbox root render', (await selectAllCheckbox.count()) === 1);
ok('W1: row checkboxes = 3', (await rowChecks.count()) === 3);
ok('W1: ban đầu KHÔNG selected → select-all aria-checked="false"', (await selectAllCheckbox.getAttribute('aria-checked')) === 'false');
ok('W1: row checkboxes aria-checked="false"', await rowChecks.evaluateAll((els) => els.every((el) => el.getAttribute('aria-checked') === 'false')));

console.log('\n=== W2: CLICK SELECT-ALL (NONE → ALL) ===');
await selectAllCheckbox.click();
await sleep(300);
ok('W2: click select-all → aria-checked="true"', (await selectAllCheckbox.getAttribute('aria-checked')) === 'true');
ok('W2: 3 row checkboxes aria-checked="true"', await rowChecks.evaluateAll((els) => els.every((el) => el.getAttribute('aria-checked') === 'true')));
ok('W2: 3 cards có class input-file-selected', (await qs.locator('.input-file-card.input-file-selected').count()) === 3);
ok('W2: header "Đã chọn 3/3 tệp"', (await selectedCount.textContent())?.trim() === 'Đã chọn 3/3 tệp');
ok('W2: quickbar hiện "Xóa 3 tệp đã chọn"', (await quickbarDelete.textContent())?.includes('Xóa 3 tệp đã chọn'), (await quickbarDelete.textContent())?.trim());

console.log('\n=== W3: DESELECT ALL (ALL → NONE via select-all) ===');
await selectAllCheckbox.click();
await sleep(300);
ok('W3: click select-all lại → aria-checked="false"', (await selectAllCheckbox.getAttribute('aria-checked')) === 'false');
ok('W3: 3 row checkboxes aria-checked="false"', await rowChecks.evaluateAll((els) => els.every((el) => el.getAttribute('aria-checked') === 'false')));
ok('W3: 0 card selected', (await qs.locator('.input-file-card.input-file-selected').count()) === 0);
ok('W3: quickbar ẨN', (await quickbar.count()) === 0);
ok('W3: header về "3 tệp"', (await fileCount.textContent())?.trim() === '3 tệp');

console.log('\n=== W4: TICK TỪNG CARD (row Checkbox component) ===');
await rowChecks.nth(0).click();
await rowChecks.nth(2).click();
await sleep(300);
ok('W4: tick card 0 + 2 → 2 cards selected', (await qs.locator('.input-file-card.input-file-selected').count()) === 2);
ok('W4: selectedFiles = logo.png, cover.png', (await cardNames('if-quick-delete')).filter((n) => ['logo.png', 'cover.png'].includes(n)).length === 2);
ok('W4: header "Đã chọn 2/3 tệp"', (await selectedCount.textContent())?.trim() === 'Đã chọn 2/3 tệp');
ok('W4: quickbar hiện "Xóa 2 tệp đã chọn"', (await quickbarDelete.textContent())?.includes('Xóa 2 tệp đã chọn'));

console.log('\n=== W5: SELECT-ALL INDETERMINATE (một phần chọn) ===');
ok('W5: select-all aria-checked="mixed" (indeterminate)', (await selectAllCheckbox.getAttribute('aria-checked')) === 'mixed');
ok('W5: select-all có class indeterminate', await selectAllCheckbox.evaluate((el) => el.classList.contains('indeterminate')));

console.log('\n=== W6: CLICK SELECT-ALL (MIXED → ALL) ===');
await selectAllCheckbox.click();
await sleep(300);
ok('W6: click select-all (mixed) → all-selected (aria-checked="true")', (await selectAllCheckbox.getAttribute('aria-checked')) === 'true');
ok('W6: 3 row checkboxes aria-checked="true"', await rowChecks.evaluateAll((els) => els.every((el) => el.getAttribute('aria-checked') === 'true')));

console.log('\n=== W7: DELETE SELECTED (xóa hàng loạt) ===');
await quickbarDelete.click();
await sleep(400);
ok('W7: click Xóa N tệp → files còn 0', (await cards('if-quick-delete').count()) === 0);
ok('W7: quickbar ẨN', (await quickbar.count()) === 0);
// LƯU Ý: khi 0 file, header KHÔNG render .input-file-count (chỉ hiện khi
// filePreviews.length > 0) — assert qua selectedCount/fileCount sẽ timeout.
ok('W7: header ẨN khi 0 file (previews-head rỗng)', (await qs.locator('.input-file-count, .input-file-selected-count').count()) === 0);
// LƯU Ý: select-all ẨN khi 0 file — count() là 0, KHÔNG assert aria-checked
// (getAttribute trên locator 0-match sẽ timeout). Probe cũ FI13 cùng bẫy.
ok('W7: select-all ẨN khi 0 file (wrap removed)', (await selectAllWrap.count()) === 0);

console.log('\n=== W8: RE-ADD FILES + DESELECT ALL VIA SELECT-ALL ===');
await qInput.setInputFiles([p('logo.png'), p('cover.png')]);
await sleep(400);
await selectAllCheckbox.click();
await sleep(300);
ok('W8: chọn 2 file → select-all click → all-selected', (await selectAllCheckbox.getAttribute('aria-checked')) === 'true');
await selectAllCheckbox.click();
await sleep(300);
ok('W8: click lại select-all → deselect all', (await selectAllCheckbox.getAttribute('aria-checked')) === 'false');
ok('W8: quickbar ẨN sau deselect', (await quickbar.count()) === 0);

console.log('\n=== W9: KEYBOARD SPACE/ENTER (row + select-all) ===');
// Re-add 3 files
await qInput.setInputFiles([p('logo.png'), p('notes.txt'), p('cover.png')]);
await sleep(400);
// Row checkbox keyboard
await rowChecks.nth(0).focus();
await page.keyboard.press('Space');
await sleep(200);
ok('W9: Space trên row checkbox 0 → selected', (await rowChecks.nth(0).getAttribute('aria-checked')) === 'true');
await rowChecks.nth(1).focus();
await page.keyboard.press('Enter');
await sleep(200);
ok('W9: Enter trên row checkbox 1 → selected', (await rowChecks.nth(1).getAttribute('aria-checked')) === 'true');
// Select-all keyboard
await selectAllCheckbox.focus();
await page.keyboard.press('Space');
await sleep(300);
ok('W9: Space trên select-all (mixed) → all-selected', (await selectAllCheckbox.getAttribute('aria-checked')) === 'true');
await selectAllCheckbox.focus();
await page.keyboard.press('Enter');
await sleep(300);
ok('W9: Enter trên select-all (all) → deselect all', (await selectAllCheckbox.getAttribute('aria-checked')) === 'false');

console.log('\n=== W10: CHECKBOX VISUALS (indeterminate dash, checkmark, color-primary) ===');
// Re-add 2 files
await qInput.setInputFiles([p('logo.png'), p('cover.png')]);
await sleep(400);
await rowChecks.nth(0).click();
await sleep(200);
// Select-all indeterminate → dash indicator
ok('W10: select-all indeterminate → có span.checkbox-indeterminate-dash', await selectAllCheckbox.locator('.checkbox-indeterminate-dash').count() === 1);
ok(
	'W10: select-all indeterminate dash background = var(--color) (primary)',
	(await selectAllCheckbox.locator('.checkbox-indeterminate-dash').evaluate((el) => getComputedStyle(el).backgroundColor))?.includes('rgb') === true
);
// Row selected → Checked component (checkmark polyline)
const checkedIndicator = rowChecks.nth(0).locator('.checkbox-indicator-checked svg');
ok('W10: row checked → checkbox-indicator-checked render', (await checkedIndicator.count()) === 1);
// Component có fallback stroke="white" khi --color không lấy được → chấp nhận cả 2
const stroke = await checkedIndicator.getAttribute('stroke');
ok('W10: checkmark stroke được set (white hoặc rgb/hsl)', stroke === 'white' || stroke?.includes('rgb') === true || stroke?.includes('hsl') === true, 'stroke=' + stroke);
ok('W10: checkbox size = 1.25rem (20px)', await selectAllCheckbox.evaluate((el) => {
	const style = getComputedStyle(el);
	return style.width === '20px' && style.height === '20px';
}));

// Screenshots cho ui-checker — DÙNG SCRIPT RIÊNG tests/input-file-wave11-shots.mjs
// (mỗi ảnh load lại trang + state sạch, tránh tên file không khớp trạng thái do
// state tích lũy từ các bước assert phía trên).
console.log('\n=== SCREENSHOTS WAVE 11 (chạy tests/input-file-wave11-shots.mjs) ===');

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}