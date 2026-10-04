// select-sort-probe.mjs
// Functional probe cho task "sort by (alpha / date)" của Select:
// - sortField='alpha': theo label, locale-aware (tiếng Việt), tie-breaker value
// - sortField='date': theo option.date; option KHÔNG có date luôn ở CUỐI
// - sortDirection asc/desc (control đảo chiều trong dropdown)
// - sort/sortDirection bindable → state page đồng bộ + onSortChange log
// - control .select-sort-bar render khi showSort
// Chạy: node tests/select-sort-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/select';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const openViaChevron = async (sec) => {
	await sec.locator('.select-trigger__icon').click();
	await sec.locator('.select-option').first().waitFor({ timeout: 4000 });
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
await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

const sec = page.locator('section:has(h2:has-text("Sort options"))');

// Nguồn data (6 option, thứ tự NGUỒN):
// [Release Q2, Không có ngày, Release Q1 2025, Release Q4, Release Q3 2025, Release Q1]
const labelOrder = async () =>
	(await sec.locator('.select-option-list .select-option__label').allTextContents()).map((t) => t.trim());

console.log('\n=== 1. SORT CONTROL RENDER ===');
await openViaChevron(sec);
const barVisible = await sec.locator('.select-sort-bar').isVisible();
ok('sort-bar: render khi showSort', barVisible);
const selectVal = await sec.locator('.select-sort-bar__select').inputValue();
ok('sort-bar: default field = "alpha" (đặt từ prop sort="alpha")', selectVal === 'alpha', selectVal);
const dirLabel = await sec.locator('.select-sort-bar__direction').getAttribute('aria-label');
ok('sort-bar: nút chiều default aria-label = "Giảm dần" (đang asc → click để đổi sang desc)',
	/Giảm|Descending/i.test(dirLabel ?? ''), dirLabel);

console.log('\n=== 2. SORT ALPHA ASC (điểm khởi đầu) ===');
const alphaAsc = await labelOrder();
const expectedAlphaAsc = ['Không có ngày', 'Release Q1', 'Release Q1 2025', 'Release Q2', 'Release Q3 2025', 'Release Q4'];
ok('alpha/asc: thứ tự label đúng locale', JSON.stringify(alphaAsc) === JSON.stringify(expectedAlphaAsc),
	alphaAsc.join(' | '));

console.log('\n=== 3. CHỌN TRƯỜNG DATE (native select) ===');
await sec.locator('.select-sort-bar__select').selectOption('date');
await page.waitForTimeout(200);
const dateAsc = await labelOrder();
const expectedDateAsc = ['Release Q1', 'Release Q2', 'Release Q4', 'Release Q1 2025', 'Release Q3 2025', 'Không có ngày'];
ok('date/asc: thứ tự theo date (option không-date ở CUỐI)', JSON.stringify(dateAsc) === JSON.stringify(expectedDateAsc),
	dateAsc.join(' | '));

// Page state đồng bộ (bindable) — code chứa " / " là phần "field / dir"
const pageState = await sec.locator('p:has-text("sort:") code:has-text("/")').first().textContent();
ok('bindable: page state = "date / asc"', pageState?.trim() === 'date / asc', pageState);

// onSortChange log hiện ra (đã có ít nhất 1 lần đổi)
const logText = await sec.locator('p:has-text("onSortChange") code').first().textContent().catch(() => '');
ok('onSortChange: log ghi nhận sự kiện đổi sort', /date\/asc/.test(logText ?? ''), logText?.slice(0, 80));

console.log('\n=== 4. ĐẢO CHIỀU (desc) ===');
await sec.locator('.select-sort-bar__direction').click();
await page.waitForTimeout(200);
const dateDesc = await labelOrder();
const expectedDateDesc = ['Release Q3 2025', 'Release Q1 2025', 'Release Q4', 'Release Q2', 'Release Q1', 'Không có ngày'];
ok('date/desc: đảo chiều, option không-date VẪN ở cuối', JSON.stringify(dateDesc) === JSON.stringify(expectedDateDesc),
	dateDesc.join(' | '));
const dirLabel2 = await sec.locator('.select-sort-bar__direction').getAttribute('aria-label');
ok('sort-bar: aria-label đổi thành "Tăng dần" (đang desc)', /Tăng|Ascending/i.test(dirLabel2 ?? ''), dirLabel2);
const pageState2 = await sec.locator('p:has-text("sort:") code:has-text("/")').first().textContent();
ok('bindable: page state = "date / desc"', pageState2?.trim() === 'date / desc', pageState2);

console.log('\n=== 5. ALPHA DESC (setSortField giữ chiều hiện tại = desc) ===');
await sec.locator('.select-sort-bar__select').selectOption('alpha');
await page.waitForTimeout(200);
const alphaDesc = await labelOrder();
const expectedAlphaDesc = ['Release Q4', 'Release Q3 2025', 'Release Q2', 'Release Q1 2025', 'Release Q1', 'Không có ngày'];
ok('alpha/desc: thứ tự ngược đúng', JSON.stringify(alphaDesc) === JSON.stringify(expectedAlphaDesc),
	alphaDesc.join(' | '));

// Chọn option hoạt động bình thường sau khi sort
await sec.locator('.select-option__label', { hasText: 'Release Q2' }).first().click();
await page.waitForTimeout(200);
const triggerText = await sec.locator('.select-trigger__value').textContent();
ok('chọn option sau sort: trigger hiển thị label đúng', triggerText?.trim() === 'Release Q2', triggerText?.trim());

// ── Screenshot cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
mkdirSync('tests/screenshot/select-extra', { recursive: true });
const shotDir = 'tests/screenshot/select-extra';
// Union bbox {h2, trigger, dropdown} + pad — auto-flip có thể đặt panel TRÊN trigger
await sec.locator('.select-trigger').click(); // mở lại
await sec.locator('.select-option').first().waitFor({ timeout: 4000 });
await sec.locator('.select-sort-bar__select').selectOption('date');
await page.waitForTimeout(300);
const parts = [sec.locator('h2'), sec.locator('.select-trigger'), sec.locator('.select-dropdown')];
const rects = [];
for (const p of parts) {
	const r = await p.boundingBox().catch(() => null);
	if (r) rects.push(r);
}
const vp = await page.viewportSize();
const pad = 10;
const x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad);
const y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
const x1 = Math.min(vp.width, Math.max(...rects.map((r) => r.x + r.width)) + pad);
const y1 = Math.min(vp.height, Math.max(...rects.map((r) => r.y + r.height)) + pad);
await page.screenshot({ path: `${shotDir}/10-sort-bar.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
