// datatable-probe.mjs
// Functional probe cho task "DataTable (data-driven, Svelte 5)":
// - DT0  demo root render + a11y CONTRACT §6 (table, caption, th scope, aria-label)
// - DT1  sort click header asc/desc + aria-sort + reset page=1 (debug dt-sort)
// - DT2  filter client-side (search mọi cột, nhạy dấu) + count "n kết quả" + clear
// - DT3  pagination page-size 5/10/20 + prev/next + page info
// - DT4  row selection checkbox + select-all + onSelectionChange (debug dt-selected)
// - DT5  density compact (padding cell hẹp hơn default)
// - DT6  empty state (data rỗng → full-span muted row)
// - DT7  loading state (skeleton rows)
//
// Trình tự: DT0 (chỉ đọc) → screenshots (trạng thái sạch) → DT2 filter →
// DT3 pagination → DT4 selection (trở về size 10) → DT1 sort (đổi trạng thái
// cuối, không ảnh hưởng các check phía trên) → DT5/6/7 (các section độc lập).
// Chạy: node tests/datatable-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/datatable';
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
await page.waitForSelector('[data-test="datatable-demo"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

// Section "Full" (case 1): bảng chính cho sort/filter/pagination/selection.
const basic = page.locator('[data-test="dt-basic"]');
// Sort button cho 1 cột theo label (aria-label "LABEL — sort").
const sortBtn = (label) => basic.locator(`button.datatable-sort[aria-label="${label} — sort"]`);
// Header th theo label (substring — th còn chứa icon sort ↕/▲/▼ nên không exact).
const thByLabel = (label) => basic.locator('th.datatable-th', { hasText: label });
const rowChecks = basic.locator('input.datatable-checkbox:not(.datatable-checkbox--all)');
const pageSizeSelect = basic.locator('select.datatable-pagesize-select');

console.log('\n=== DT0: DEMO ROOT + A11Y CONTRACT §6 ===');
ok('DT0: demo root render (data-test="datatable-demo")', (await page.locator('[data-test="datatable-demo"]').count()) === 1);
ok('DT0: basic có <table>', (await basic.locator('table.datatable').count()) === 1);
ok('DT0: basic có <caption>', (await basic.locator('caption.datatable-caption').count()) === 1);
const scopeCount = await basic.locator('th[scope="col"]').count();
ok('DT0: mọi th có scope="col" (≥5 cột)', scopeCount >= 5, String(scopeCount));
ok('DT0: ô search có aria-label', (await basic.locator('input.datatable-search[aria-label]').count()) === 1);
ok('DT0: prev/next có aria-label', (await basic.locator('button.datatable-pg-btn[aria-label]').count()) === 2);

// ── Screenshots ở trạng thái sạch (trước mọi thao tác) ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/datatable';
mkdirSync(shotDir, { recursive: true });
await basic.screenshot({ path: `${shotDir}/01-full.png` });
await basic.locator('input.datatable-search').fill('cable');
await page.waitForTimeout(250);
await basic.screenshot({ path: `${shotDir}/02-filtered.png` });
await basic.locator('input.datatable-search').fill('');
await page.waitForTimeout(250);

console.log('\n=== DT2: FILTER (search mọi cột, nhạy dấu) + COUNT + CLEAR ===');
await basic.locator('input.datatable-search').fill('cable');
await page.waitForTimeout(200);
// "cable" khớp: USB Cable, HDMI Cable, Cable Organizer → 3 row.
ok('DT2: filter "cable" → 3 kết quả (USB + HDMI + Cable Organizer)', (await basic.locator('tr.datatable-row').count()) === 3);
const resultsText = await basic.locator('[data-role="results"]').textContent();
ok('DT2: count "3 kết quả"/"3 results"', resultsText?.match(/\d+/)?.[0] === '3', resultsText);
ok('DT2: match highlight (mark) hiện trong cell', (await basic.locator('mark.datatable-mark').count()) > 0);
await basic.locator('button.datatable-search-clear').click();
await page.waitForTimeout(150);
ok('DT2: clear → trả về 10 row (pageSize)', (await basic.locator('tr.datatable-row').count()) === 10);
await basic.locator('input.datatable-search').fill('monit');
await page.waitForTimeout(200);
ok('DT2: filter nhạy dấu + prefix "monit" → 1 (Monitor)', (await basic.locator('tr.datatable-row').count()) === 1);
await basic.locator('input.datatable-search').fill('');
await page.waitForTimeout(150);

console.log('\n=== DT3: PAGINATION page-size + prev/next + page info ===');
ok('DT3: có select page-size (options 5/10/20)', (await pageSizeSelect.count()) === 1);
const pageInfo = await basic.locator('.datatable-pageinfo').textContent();
ok('DT3: page info "Page 1 of 2"/"Trang 1 / 2" (15 row, size 10)', /Page 1 of 2|Trang 1 \/ 2/.test(pageInfo ?? ''), pageInfo);
await basic.locator('button.datatable-pg-btn[aria-label="Sau"], button.datatable-pg-btn[aria-label="Next"]').first().click();
await page.waitForTimeout(150);
ok('DT3: next → trang 2 (row thứ 11 "Speaker")', ((await basic.locator('tr.datatable-row').nth(0).textContent()) ?? '').includes('Speaker'));
ok(
	'DT3: ở trang 2 → prev enabled',
	!(await basic.locator('button.datatable-pg-btn[aria-label="Trước"], button.datatable-pg-btn[aria-label="Previous"]').first().isDisabled())
);
await pageSizeSelect.selectOption('5');
await page.waitForTimeout(150);
ok(
	'DT3: đổi size=5 → 5 row + debug dt-size "Size 5"',
	(await basic.locator('tr.datatable-row').count()) === 5 && (await page.locator('[data-test="dt-size"]').textContent())?.includes('5')
);

console.log('\n=== DT4: ROW SELECTION + SELECT-ALL + CALLBACK ===');
await pageSizeSelect.selectOption('10'); // trở về 10 row / trang
await page.waitForTimeout(150);
ok('DT4: có 10 checkbox row (pageSize 10, không tính select-all)', (await rowChecks.count()) === 10);
await rowChecks.nth(0).check();
await page.waitForTimeout(120);
await rowChecks.nth(1).check();
await page.waitForTimeout(120);
ok('DT4: chọn 2 row → debug dt-selected "Chọn 2"', (await page.locator('[data-test="dt-selected"]').textContent())?.includes('2'));
ok('DT4: row đã chọn có class selected', (await basic.locator('tr.datatable-row.selected').count()) === 2);
const selectAll = basic.locator('input.datatable-checkbox--all');
ok('DT4: có select-all trong header', (await selectAll.count()) === 1);
await selectAll.check();
await page.waitForTimeout(150);
ok('DT4: select-all → chọn đủ 10 row trang (debug "Chọn 10")', (await page.locator('[data-test="dt-selected"]').textContent())?.includes('10'));
await selectAll.uncheck();
await page.waitForTimeout(150);
ok('DT4: uncheck select-all → 0 row', (await basic.locator('tr.datatable-row.selected').count()) === 0);

console.log('\n=== DT1: SORT ASC/DESC + ARIA-SORT + RESET PAGE (chạy sau, đổi trạng thái) ===');
await sortBtn('Price').click();
await page.waitForTimeout(150);
ok('DT1: click Price → aria-sort="ascending"', (await thByLabel('Price').getAttribute('aria-sort')) === 'ascending');
ok('DT1: debug dt-sort = "price"', (await page.locator('[data-test="dt-sort"]').textContent())?.trim() === 'price');
ok(
	'DT1: asc → row đầu là giá thấp nhất ($9 USB Cable)',
	((await basic.locator('tr.datatable-row').nth(0).textContent()) ?? '').includes('USB Cable')
);
await sortBtn('Price').click();
await page.waitForTimeout(150);
ok('DT1: click lại → aria-sort="descending"', (await thByLabel('Price').getAttribute('aria-sort')) === 'descending');
ok('DT1: desc → row đầu là giá cao nhất ($999 Laptop)', ((await basic.locator('tr.datatable-row').nth(0).textContent()) ?? '').includes('Laptop'));
ok('DT1: sort reset page=1 (debug dt-page "Trang 1")', (await page.locator('[data-test="dt-page"]').textContent())?.includes('Trang 1'));

console.log('\n=== DT5: DENSITY COMPACT (padding hẹp) ===');
const compact = page.locator('[data-test="dt-compact"]');
const pads = await page.evaluate(() => {
	const def = document.querySelector('[data-test="dt-basic"] td.datatable-td');
	const comp = document.querySelector('[data-test="dt-compact"] td.datatable-td');
	return {
		def: def ? getComputedStyle(def).paddingTop : '',
		comp: comp ? getComputedStyle(comp).paddingTop : ''
	};
});
const toPx = (v) => parseFloat(v) || 0;
ok('DT5: compact padding-top < default', toPx(pads.comp) < toPx(pads.def), `compact=${pads.comp} default=${pads.def}`);
ok('DT5: compact có class density-compact', (await compact.locator('.datatable-root.density-compact').count()) === 1);

console.log('\n=== DT6: EMPTY STATE ===');
const empty = page.locator('[data-test="dt-empty"]');
ok('DT6: empty có row full-span (colspan)', (await empty.locator('td.datatable-empty[colspan]').count()) === 1);
ok(
	'DT6: empty text "Không có dữ liệu"/"No data"',
	/không có dữ liệu|no data/i.test((await empty.locator('td.datatable-empty').textContent()) ?? '')
);

console.log('\n=== DT7: LOADING STATE (skeleton) ===');
const loading = page.locator('[data-test="dt-loading"]');
ok('DT7: loading có skeleton rows (≥3)', (await loading.locator('tr.datatable-row--skeleton').count()) >= 3);
ok('DT7: loading có class is-loading trên root', (await loading.locator('.datatable-root.is-loading').count()) === 1);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
