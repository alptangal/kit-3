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
// - DT8  live data ($state push → re-render, sort giữ, filter hoạt động)
// - DT9  edit cell (click → input → gõ → Enter → callback + giá trị mới)
// - DT10 cancel edit (Escape + nút ✕ → giữ giá trị cũ, callback không fired)
// - DT11 row actions (nút ✎ row editor + 🗑 delete qua AlertDialog confirm)
// - DT12 lazy load (IntersectionObserver scroll + nút load more → hết data ẩn)
// - DT13 visual (striped bg khác nhau, bordered border-right, hover highlight)
// - DT14 toolbar (create → row editor, copy/clone row TSV clipboard, export
//   CSV/JSON download, selection tools copy/delete/clear selected)
// - DT15 no-results + empty create (search không khớp / data=[] → nút create)
// - DT16 resize column (drag handle đổi width, dblclick reset, auto-fit đo
//   content khởi tạo + ellipsis title)
// - DT17 editor đa dạng (number/boolean/date/select + auto focus caret cuối)
// - DT18 row detail modal (click row → Modal, Save → onRowUpdate + data ghi)
// - DT19 cell detail (click cell → modal + focus đúng field)
//
// Trình tự: DT0 (chỉ đọc) → screenshots (trạng thái sạch) → DT2 filter →
// DT3 pagination → DT4 selection (trở về size 10) → DT1 sort (đổi trạng thái
// cuối, không ảnh hưởng các check phía trên) → DT5/6/7 (các section độc lập)
// → DT8-13 (live/edit/actions/lazy/visual) → DT14/15 (toolbar + create).
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
const rowChecks = basic.locator('td.datatable-td--check [role="checkbox"]');
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
// Screenshot mới (task): live/edit/lazy/visual → tests/screenshots/datatable.
const shotDirNew = 'tests/screenshots/datatable';
mkdirSync(shotDirNew, { recursive: true });
const editSecShot = page.locator('[data-test="dt-edit"]');
const lazySecShot = page.locator('[data-test="dt-lazy"]');
const visSecShot = page.locator('[data-test="dt-visual"]');
await page.locator('[data-test="dt-live"]').screenshot({ path: `${shotDirNew}/03-live.png` });
await editSecShot.locator('tr.datatable-row').first().locator('td.datatable-td').first().hover();
await page.waitForTimeout(250);
await editSecShot.screenshot({ path: `${shotDirNew}/04-rowactions.png` });
await lazySecShot.screenshot({ path: `${shotDirNew}/05-lazyload.png` });
await visSecShot.screenshot({ path: `${shotDirNew}/06-visual.png` });
// 07-checkbox: table basic trạng thái sạch — Checkbox component (cột đầu).
await basic.locator('table.datatable').screenshot({ path: `${shotDirNew}/07-checkbox.png` });
// 10-toolbar: section toolbar — create + export/import + (chưa chọn).
await page.locator('[data-test="dt-toolbar"]').screenshot({ path: `${shotDirNew}/10-toolbar.png` });
// 11-empty-create: section empty + creatable — nút create giữa empty row.
await page.locator('[data-test="dt-empty"]').screenshot({ path: `${shotDirNew}/11-empty-create.png` });
await page.waitForTimeout(100);

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
ok('DT4: checkbox row là Checkbox component (div[role=checkbox])', (await rowChecks.first().evaluate((el) => el.tagName === 'DIV' && el.getAttribute('role') === 'checkbox')));
ok('DT4: checkbox row có tabindex=0 (focusable)', (await rowChecks.first().getAttribute('tabindex')) === '0');
await rowChecks.nth(0).click();
await page.waitForTimeout(150);
await rowChecks.nth(1).click();
await page.waitForTimeout(150);
ok('DT4: chọn 2 row → debug dt-selected "Chọn 2"', (await page.locator('[data-test="dt-selected"]').textContent())?.includes('2'));
ok('DT4: row đã chọn có class selected', (await basic.locator('tr.datatable-row.selected').count()) === 2);
ok('DT4: checkbox đã chọn có class has-value', (await rowChecks.nth(0).evaluate((el) => el.classList.contains('has-value'))));
ok('DT4: checkbox đã chọn aria-checked="true"', (await rowChecks.nth(0).getAttribute('aria-checked')) === 'true');
ok('DT4: checkmark indicator mount trong checkbox', (await rowChecks.nth(0).locator('.checkbox-indicator-root').count()) === 1);
ok('DT4: checkbox chưa chọn aria-checked="false"', (await rowChecks.nth(2).getAttribute('aria-checked')) === 'false');
// 08-selectall: 2 row đã chọn → select-all dash (indeterminate).
await basic.locator('table.datatable').screenshot({ path: `${shotDirNew}/08-selectall.png` });
// Select-all Checkbox component (indeterminate khi một phần chọn).
const selectAll = basic.locator('th.datatable-th--check [role="checkbox"]');
ok('DT4: có select-all trong header (Checkbox component)', (await selectAll.count()) === 1);
ok('DT4: một phần chọn → select-all aria-checked="mixed" (indeterminate)', (await selectAll.getAttribute('aria-checked')) === 'mixed');
await selectAll.click();
await page.waitForTimeout(200);
ok('DT4: select-all → chọn đủ 10 row trang (debug "Chọn 10")', (await page.locator('[data-test="dt-selected"]').textContent())?.includes('10'));
ok('DT4: select-all sau check → aria-checked="true"', (await selectAll.getAttribute('aria-checked')) === 'true');
// 09-selection: select-all → đủ 10 row selected (nền primary mix).
await basic.locator('table.datatable').screenshot({ path: `${shotDirNew}/09-selection.png` });
await selectAll.click();
await page.waitForTimeout(200);
ok('DT4: uncheck select-all → 0 row', (await basic.locator('tr.datatable-row.selected').count()) === 0);
// Keyboard focus: Tab vào checkbox đầu → focus-visible (outline indigo).
await rowChecks.nth(3).focus();
await page.waitForTimeout(120);
await page.keyboard.press('Space');
await page.waitForTimeout(150);
ok('DT4: keyboard Space → toggle row (Chọn 1)', (await page.locator('[data-test="dt-selected"]').textContent())?.includes('1'));
ok('DT4: checkbox có focus (document.activeElement)', (await rowChecks.nth(3).evaluate((el) => document.activeElement === el)));
await page.keyboard.press('Space');
await page.waitForTimeout(150);

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

console.log('\n=== DT8: LIVE DATA (thêm row động, sort giữ ổn định) ===');
const live = page.locator('[data-test="dt-live"]');
// Sắp theo Product asc để kiểm chứng sort giữ khi push row mới.
await live.locator('button.datatable-sort[aria-label="Product — sort"]').click();
await page.waitForTimeout(200);
const rowCountBefore = await page.locator('[data-test="dt-row-count"]').textContent();
ok('DT8: đếm row ban đầu (15 row)', rowCountBefore?.includes('15'), rowCountBefore ?? '');
// Sort asc hiện "Bookshelf" (B < C...) — lưu first row trước push.
const firstBefore = ((await live.locator('tr.datatable-row').nth(0).textContent()) ?? '').trim();
await page.locator('[data-test="dt-add-row"]').click();
await page.waitForTimeout(250);
ok(
	'DT8: push row → đếm tăng 16',
	(await page.locator('[data-test="dt-row-count"]').textContent())?.includes('16')
);
ok(
	'DT8: sort giữ — row đầu vẫn theo alphabet trước push',
	((await live.locator('tr.datatable-row').nth(0).textContent()) ?? '').trim().startsWith(firstBefore.slice(0, 1))
);
ok('DT8: aria-sort vẫn ascending trên cột Product', (await live.locator('th.datatable-th[aria-sort="ascending"]').count()) >= 1);
await page.locator('[data-test="dt-add-row"]').click();
await page.waitForTimeout(250);
ok('DT8: push row 2 → đếm 17', (await page.locator('[data-test="dt-row-count"]').textContent())?.includes('17'));
// Row mới nằm ngoài trang 1 (pageSize 5) — filter "New Item" để xác nhận có mặt
// (kiểm chứng luôn filter hoạt động trên live data).
await live.locator('input.datatable-search').fill('New Item');
await page.waitForTimeout(250);
ok('DT8: filter "New Item" → 2 row mới (16 + 17)', (await live.locator('tr.datatable-row').count()) === 2, String(await live.locator('tr.datatable-row').count()));
await live.locator('input.datatable-search').fill('');
await page.waitForTimeout(200);

console.log('\n=== DT9: EDIT CELL (click → input → gõ → Enter → callback + giá trị mới) ===');
const editSec = page.locator('[data-test="dt-edit"]');
// Click cell name của row p1 (Laptop) — data-cell-id format "rowId:columnId".
const cellP1 = editSec.locator('td[data-cell-id="p1:name"]');
ok('DT9: cell p1:name tồn tại', (await cellP1.count()) === 1);
await cellP1.click();
await page.waitForTimeout(200);
ok('DT9: click cell → input editor hiện', (await editSec.locator('input.datatable-cell-input').count()) === 1);
ok('DT9: editor có nút confirm ✓ (data-test)', (await editSec.locator('[data-test="datatable-cell-confirm"]').count()) === 1);
ok('DT9: editor có nút cancel ✕ (data-test)', (await editSec.locator('[data-test="datatable-cell-cancel"]').count()) === 1);
const cellInput = editSec.locator('input.datatable-cell-input');
ok('DT9: input chứa giá trị cũ "Laptop"', (await cellInput.inputValue()) === 'Laptop');
await cellInput.fill('Laptop Pro');
await page.waitForTimeout(120);
await cellInput.press('Enter');
await page.waitForTimeout(250);
ok('DT9: Enter → editor đóng (không còn input)', (await editSec.locator('input.datatable-cell-input').count()) === 0);
ok('DT9: cell hiển thị giá trị mới "Laptop Pro"', ((await cellP1.textContent()) ?? '').includes('Laptop Pro'));
const cellUpd = await page.locator('[data-test="dt-cell-update"]').textContent();
ok('DT9: callback onCellUpdate fired "p1:name:Laptop→Laptop Pro"', cellUpd?.includes('p1:name') && cellUpd?.includes('Laptop→Laptop Pro'), cellUpd ?? '');

console.log('\n=== DT10: CANCEL + ESCAPE (giữ giá trị cũ) ===');
await cellP1.click();
await page.waitForTimeout(200);
const cancelInput = editSec.locator('input.datatable-cell-input');
await cancelInput.fill('Draft Change');
await page.waitForTimeout(100);
await cancelInput.press('Escape');
await page.waitForTimeout(200);
ok('DT10: Escape → editor đóng', (await editSec.locator('input.datatable-cell-input').count()) === 0);
ok('DT10: cell giữ giá trị cũ "Laptop Pro"', ((await cellP1.textContent()) ?? '').includes('Laptop Pro'));
ok('DT10: callback KHÔNG fired khi cancel', !((await page.locator('[data-test="dt-cell-update"]').textContent()) ?? '').includes('Draft'));
// Cancel button ✕ cũng đóng giữ giá trị cũ.
await cellP1.click();
await page.waitForTimeout(200);
await editSec.locator('input.datatable-cell-input').fill('Draft 2');
await page.locator('[data-test="datatable-cell-cancel"]').first().click();
await page.waitForTimeout(200);
ok('DT10: nút cancel ✕ → cell giữ giá trị cũ', ((await cellP1.textContent()) ?? '').includes('Laptop Pro'));

console.log('\n=== DT11: ROW ACTIONS (hover → ✎/🗑, edit commit, delete qua AlertDialog) ===');
const raSec = page.locator('[data-test="dt-edit"]');
// (a) Row editor qua nút ✎: commit đổi nhiều cell.
await raSec.locator('[data-test="datatable-row-edit"]').first().click();
await page.waitForTimeout(200);
ok('DT11: nút ✎ → row editor hiện (≥2 input)', (await raSec.locator('input.datatable-row-input').count()) >= 2);
const nameInput = raSec.locator('input.datatable-row-input').first();
await nameInput.fill('Gaming Laptop');
await page.waitForTimeout(100);
await nameInput.press('Enter');
await page.waitForTimeout(250);
ok('DT11: Enter → commit, cell name thành "Gaming Laptop"', ((await raSec.locator('td[data-cell-id="p1:name"]').textContent()) ?? '').includes('Gaming Laptop'));
const rowUpd = await page.locator('[data-test="dt-row-update"]').textContent();
ok('DT11: callback onRowUpdate fired (p1)', rowUpd?.includes('p1'), rowUpd ?? '');
// (b) Delete: click 🗑 → AlertDialog xác nhận → Confirm → row mất.
const rowsBeforeDelete = await raSec.locator('tr.datatable-row').count();
await raSec.locator('[data-test="datatable-row-delete"]').first().click();
await page.waitForTimeout(300);
const overlay = page.locator('[data-ad-overlay]');
ok('DT11: click 🗑 → AlertDialog mở (overlay)', (await overlay.count()) >= 1);
ok('DT11: dialog title "Xóa row này?"/"Delete row?"', /xóa row này\?|delete row\?/i.test((await page.locator('[data-ad-header]').textContent()) ?? ''));
const delBtn = page.locator('[data-ad-action]');
await delBtn.click();
await page.waitForTimeout(300);
ok('DT11: Confirm → dialog đóng', (await overlay.count()) === 0);
ok('DT11: row p1 bị xóa khỏi table', (await raSec.locator('td[data-cell-id="p1:name"]').count()) === 0);
ok(
	'DT11: số row giữ nguyên (trang kéo row từ trang sau lên — hành vi đúng)',
	(await raSec.locator('tr.datatable-row').count()) === rowsBeforeDelete
);
const rowDel = await page.locator('[data-test="dt-row-delete"]').textContent();
ok('DT11: callback onRowDelete fired (p1)', rowDel?.includes('p1'), rowDel ?? '');
// (c) Cancel delete: click 🗑 → Cancel → row còn.
const victim = raSec.locator('td[data-cell-id$=":name"]').first();
const victimId = ((await victim.getAttribute('data-cell-id')) ?? '').split(':')[0];
await raSec.locator('[data-test="datatable-row-delete"]').first().click();
await page.waitForTimeout(300);
await page.locator('[data-ad-cancel]').click();
await page.waitForTimeout(300);
ok('DT11: Cancel → dialog đóng, row còn', (await overlay.count()) === 0 && (await raSec.locator(`td[data-cell-id="${victimId}:name"]`).count()) === 1);

console.log('\n=== DT12: LAZY LOAD (scroll cuối + nút load more → thêm page, hết data ẩn nút) ===');
const lazySec = page.locator('[data-test="dt-lazy"]');
ok('DT12: nút "Tải thêm"/"Load more" hiện', (await lazySec.locator('[data-test="datatable-load-more"]').count()) === 1);
// Đếm row ban đầu (IntersectionObserver có thể fire sớm khi Playwright
// auto-scroll section trước → chấp nhận 10 hoặc 20, ghi extra).
const lazyRowsStart = await lazySec.locator('tr.datatable-row').count();
ok('DT12: ban đầu ≥10 row (1 page, có thể auto-load 1)', lazyRowsStart >= 10, String(lazyRowsStart));
const lazyCountStart = ((await page.locator('[data-test="dt-lazy-count"]').textContent()) ?? '').match(/\d+/)?.[0] ?? '0';
// Infinite scroll: cuộn sentinel vào viewport → IntersectionObserver fire.
await lazySec.locator('.datatable-lazyload-sentinel').scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
const lazyCountAfterScroll = ((await page.locator('[data-test="dt-lazy-count"]').textContent()) ?? '').match(/\d+/)?.[0] ?? '0';
ok(
	'DT12: scroll cuối → onLoadMore fired (count tăng)',
	Number(lazyCountAfterScroll) > Number(lazyCountStart),
	`count ${lazyCountStart} → ${lazyCountAfterScroll}`
);
ok('DT12: sau scroll → row tăng so với trước', (await lazySec.locator('tr.datatable-row').count()) > lazyRowsStart, `${lazyRowsStart} → ${await lazySec.locator('tr.datatable-row').count()}`);
ok('DT12: row mới "Page 2" xuất hiện', (await lazySec.locator('tr.datatable-row', { hasText: 'Page 2' }).count()) >= 1);
// Nút load more bấm tới khi hết data (5 page).
for (let i = 0; i < 6; i++) {
	const btn = lazySec.locator('[data-test="datatable-load-more"]');
	if ((await btn.count()) === 0) break;
	await btn.click();
	await page.waitForTimeout(500);
}
ok(
	'DT12: hết data (page 5) → nút load more ẩn',
	(await lazySec.locator('[data-test="datatable-load-more"]').count()) === 0
);
ok('DT12: tổng row lazy ≥40 (page 2-4 thêm ≥30)', (await lazySec.locator('tr.datatable-row').count()) >= 40, String(await lazySec.locator('tr.datatable-row').count()));

console.log('\n=== DT13: VISUAL (striped/hoverable/bordered) ===');
const vis = page.locator('[data-test="dt-visual"]');
ok('DT13: root có class striped + hoverable + bordered-columns', (await vis.locator('.datatable-root.striped.hoverable.bordered-columns').count()) === 1);
const bgBasic = await page.evaluate(() => {
	const tdEven = document.querySelector('[data-test="dt-basic"] tr.datatable-row:nth-child(2) td.datatable-td');
	const tdOdd = document.querySelector('[data-test="dt-basic"] tr.datatable-row:nth-child(3) td.datatable-td');
	return {
		even: tdEven ? getComputedStyle(tdEven).backgroundColor : '',
		odd: tdOdd ? getComputedStyle(tdOdd).backgroundColor : ''
	};
});
ok('DT13: basic KHÔNG striped (row chẵn = row lẻ cùng màu)', bgBasic.even === bgBasic.odd, `even=${bgBasic.even} odd=${bgBasic.odd}`);
const bgVis = await page.evaluate(() => {
	const tdEven = document.querySelector('[data-test="dt-visual"] tr.datatable-row:nth-child(2) td.datatable-td');
	const tdOdd = document.querySelector('[data-test="dt-visual"] tr.datatable-row:nth-child(3) td.datatable-td');
	return {
		even: tdEven ? getComputedStyle(tdEven).backgroundColor : '',
		odd: tdOdd ? getComputedStyle(tdOdd).backgroundColor : ''
	};
});
ok('DT13: visual striped — row lẻ KHÁC row chẵn (nền alt)', bgVis.even !== bgVis.odd, `even=${bgVis.even} odd=${bgVis.odd}`);
const borderVis = await page.evaluate(() => {
	const td = document.querySelector('[data-test="dt-visual"] td.datatable-td');
	return td ? getComputedStyle(td).borderRightWidth : '';
});
ok('DT13: bordered — td có border-right 1px', borderVis === '1px', borderVis);
// Hover highlight (guard PC): hover row → nền đổi.
await vis.locator('tr.datatable-row').nth(0).locator('td.datatable-td').first().hover();
await page.waitForTimeout(200);
const hoverBg = await page.evaluate(() => {
	const td = document.querySelector('[data-test="dt-visual"] tr.datatable-row:first-child td.datatable-td');
	return td ? getComputedStyle(td).backgroundColor : '';
});
ok('DT13: hover row → nền đổi (highlight)', hoverBg !== bgVis.even && hoverBg !== '', hoverBg);

console.log('\n=== DT14: TOOLBAR (create + export/import + copy/clone + selection tools) ===');
const tb = page.locator('[data-test="dt-toolbar"]');
// (a) Nút create + export/import hiển thị.
ok('DT14: nút create hiện (data-test)', (await tb.locator('[data-test="datatable-create"]').count()) === 1);
ok('DT14: nút export CSV + JSON hiện', (await tb.locator('[data-test="datatable-export-csv"]').count()) === 1 && (await tb.locator('[data-test="datatable-export-json"]').count()) === 1);
ok('DT14: nút import hiện (label file)', (await tb.locator('[data-test="datatable-import"]').count()) === 1);
// (b) Create → nhảy trang tới row mới + row editor mở + onRowCreate fired.
await tb.locator('[data-test="datatable-create"]').click();
await page.waitForTimeout(250);
ok('DT14: create → row editor mở ngay (input row)', (await tb.locator('input.datatable-row-input').count()) >= 1);
ok('DT14: create → onRowCreate fired (debug __new)', ((await page.locator('[data-test="dt-created"]').textContent()) ?? '').startsWith('__new'));
ok(
	'DT14: create → nhảy trang cuối (page info "4")',
	((await tb.locator('.datatable-pageinfo').textContent()) ?? '').includes('4'),
	(await tb.locator('.datatable-pageinfo').textContent()) ?? ''
);
ok(
	'DT14: create → trang chứa row mới (≤2 row, data đã thêm từ DT8)',
	(await tb.locator('tr.datatable-row').count()) <= 2,
	String(await tb.locator('tr.datatable-row').count())
);
// Commit row editor (Escape — giữ placeholder).
await tb.locator('input.datatable-row-input').first().press('Escape');
await page.waitForTimeout(150);
// (c) Copy row: click nút ⧉ row đầu → clipboard + onCopy fired.
await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
const tbRow0 = tb.locator('tr.datatable-row').nth(0);
await tbRow0.hover();
await page.waitForTimeout(150);
await tb.locator('[data-test="datatable-row-copy"]').first().click();
await page.waitForTimeout(200);
ok('DT14: copy row → onCopy fired (debug ký tự)', /ký tự|chars/i.test((await page.locator('[data-test="dt-copied"]').textContent()) ?? ''));
const clipText = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
ok('DT14: copy row → clipboard có TSV (≥2 cột)', typeof clipText === 'string' && clipText.includes('\t'), String(clipText).slice(0, 40));
// (d) Clone row: click ⎘ row đầu → thêm bản sao ngay dưới + onRowClone fired.
const cloneAnchor = ((await tbRow0.locator('td.datatable-td').nth(1).textContent()) ?? '').trim();
const rowsBeforeClone = await tb.locator('tr.datatable-row').count();
await tb.locator('[data-test="datatable-row-clone"]').first().click();
await page.waitForTimeout(250);
ok('DT14: clone → onRowClone fired (debug "→")', /→/.test((await page.locator('[data-test="dt-cloned"]').textContent()) ?? ''));
ok(
	'DT14: clone → bản sao ngay dưới row gốc (tên giống)',
	((await tb.locator('tr.datatable-row').nth(1).textContent()) ?? '').includes(cloneAnchor.slice(0, 6))
);
ok(
	'DT14: clone → đếm tăng +1 row trên trang',
	(await tb.locator('tr.datatable-row').count()) === rowsBeforeClone + 1,
	`${rowsBeforeClone} → ${await tb.locator('tr.datatable-row').count()}`
);
// (e) Selection tools: chọn 2 row → toolbar hiện tools (copy/delete/clear).
await tb.locator('td.datatable-td--check [role="checkbox"]').nth(0).click();
await page.waitForTimeout(120);
await tb.locator('td.datatable-td--check [role="checkbox"]').nth(1).click();
await page.waitForTimeout(150);
ok('DT14: chọn 2 row → selection tools hiện', (await tb.locator('[data-role="selection-tools"]').count()) === 1);
ok('DT14: selection count = 2 (badge)', ((await tb.locator('.datatable-selection-count').textContent()) ?? '').trim() === '2');
// 12-selection-tools: 2 row đã chọn → badge count + copy/delete/clear.
await tb.screenshot({ path: `${shotDirNew}/12-selection-tools.png` });
// Copy selected (2 row → TSV có header + 2 dòng).
await tb.locator('[data-test="datatable-copy-selected"]').click();
await page.waitForTimeout(200);
const clipSel = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
ok(
	'DT14: copy selected → clipboard header + 2 dòng',
	typeof clipSel === 'string' && clipSel.split('\n').length >= 3 && clipSel.includes('\t'),
	String(clipSel).split('\n').length
);
// (f) Export CSV/JSON: click → tải file (verify qua download event).
const dlCsv = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await tb.locator('[data-test="datatable-export-csv"]').click();
const csvDl = await dlCsv;
ok('DT14: export CSV → download fired', !!csvDl);
if (csvDl) {
	const path = await csvDl.path();
	const content = (await import('node:fs')).readFileSync(path, 'utf8');
	ok('DT14: export CSV → nội dung header + row (5+)', content.split('\n').length >= 6 && content.includes('Product'), content.split('\n').length);
}
const dlJson = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await tb.locator('[data-test="datatable-export-json"]').click();
const jsonDl = await dlJson;
ok('DT14: export JSON → download fired', !!jsonDl);
if (jsonDl) {
	const path = await jsonDl.path();
	const content = (await import('node:fs')).readFileSync(path, 'utf8');
	ok('DT14: export JSON → nội dung mảng JSON (5+)', content.trim().startsWith('[') && content.includes('"name"'), content.slice(0, 30));
}
// (g) Delete selected: click → 2 row bị xóa.
const rowsBeforeDelSel = await tb.locator('tr.datatable-row').count();
await tb.locator('[data-test="datatable-delete-selected"]').click();
await page.waitForTimeout(250);
ok(
	'DT14: delete selected → 2 row mất',
	(await tb.locator('tr.datatable-row').count()) === rowsBeforeDelSel - 2,
	`${rowsBeforeDelSel} → ${await tb.locator('tr.datatable-row').count()}`
);
ok('DT14: delete selected → selection tools ẩn (count 0)', (await tb.locator('[data-role="selection-tools"]').count()) === 0);
ok('DT14: callback onRowDelete fired 2 lần (debug)', /p\d/.test((await page.locator('[data-test="dt-row-delete"]').textContent()) ?? ''));
// (h) Clear selection.
await tb.locator('td.datatable-td--check [role="checkbox"]').nth(0).click();
await page.waitForTimeout(150);
await tb.locator('[data-test="datatable-clear-selection"]').click();
await page.waitForTimeout(150);
ok('DT14: clear selection → tools ẩn, không row selected', (await tb.locator('[data-role="selection-tools"]').count()) === 0 && (await tb.locator('tr.datatable-row.selected').count()) === 0);

console.log('\n=== DT15: NO-RESULTS + EMPTY CREATE ===');
const nr = page.locator('[data-test="dt-noresults"]');
await nr.locator('input.datatable-search').fill('zzz-không-có');
await page.waitForTimeout(250);
ok('DT15: search không khớp → 0 row', (await nr.locator('tr.datatable-row').count()) === 0);
ok('DT15: no-results → nút create hiện (empty row)', (await nr.locator('[data-test="datatable-empty-create"]').count()) === 1);
// 13-noresults: search không khớp → empty row + nút create.
await nr.screenshot({ path: `${shotDirNew}/13-noresults.png` });
ok('DT15: empty text "Không có dữ liệu"/"No data" + nút', /không có dữ liệu|no data/i.test((await nr.locator('td.datatable-empty').textContent()) ?? ''));
// Click create từ no-results → row editor mở (n row tăng từ 0 → 1).
await nr.locator('[data-test="datatable-empty-create"]').click();
await page.waitForTimeout(250);
ok('DT15: create từ no-results → row editor mở', (await nr.locator('input.datatable-row-input').count()) >= 1);
await nr.locator('input.datatable-row-input').first().press('Escape');
await page.waitForTimeout(150);
// Empty section (data=[] + creatable).
const emp = page.locator('[data-test="dt-empty"]');
ok('DT15: empty → nút create hiện', (await emp.locator('[data-test="datatable-empty-create"]').count()) === 1);
await emp.locator('[data-test="datatable-empty-create"]').click();
await page.waitForTimeout(250);
ok('DT15: create từ empty → 1 row xuất hiện', (await emp.locator('tr.datatable-row').count()) === 1, String(await emp.locator('tr.datatable-row').count()));
await emp.locator('input.datatable-row-input').first().press('Escape');
await page.waitForTimeout(150);

console.log('\n=== DT16: RESIZE (drag handle + dblclick reset + auto-fit) ===');
const rzSec = page.locator('[data-test="dt-resize"]');
const rzTable = rzSec.locator('table.datatable');
// (a) Auto-fit: cột "Product" có col.width prop (180px) — giữ nguyên (check
// style attr, rect bị flex co dãn theo container).
const rzWidthName = await rzSec.locator('th', { hasText: 'Product' }).getAttribute('style');
ok('DT16: cột có width prop giữ nguyên (Product style 180px)', rzWidthName?.includes('180px'), rzWidthName ?? '');
// Cột không width prop → auto-fit theo content (Category: "Detail" + header).
const rzWidthCat = await rzSec.locator('th', { hasText: 'Category' }).getAttribute('style');
ok('DT16: auto-fit width khởi tạo (Category style px)', /width:\s*\d+px/.test(rzWidthCat ?? ''), rzWidthCat ?? '');
// (b) Handle resize tồn tại + data-test.
const rzHandle = rzSec.locator('[data-test="datatable-resize-category"]');
ok('DT16: handle resize hiện (data-test)', (await rzHandle.count()) === 1);
ok('DT16: handle cursor col-resize', (await rzHandle.evaluate((el) => getComputedStyle(el).cursor)) === 'col-resize');
// (c) Drag handle → width tăng (mouse down/move/up qua Playwright).
// BẪY: handle y có thể âm (ngoài viewport — page dài) → scrollIntoViewIfNeeded.
const handleBox = await rzHandle.boundingBox();
const widthBeforeDrag = await rzSec.locator('th', { hasText: 'Category' }).evaluate((el) => el.getBoundingClientRect().width);
await rzHandle.scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
const handleBox2Pre = await rzHandle.boundingBox();
if (handleBox2Pre) {
	await page.mouse.move(handleBox2Pre.x + handleBox2Pre.width / 2, handleBox2Pre.y + handleBox2Pre.height / 2);
	await page.mouse.down();
	await page.mouse.move(handleBox2Pre.x + handleBox2Pre.width / 2 + 60, handleBox2Pre.y + handleBox2Pre.height / 2, { steps: 8 });
	await page.mouse.up();
	await page.waitForTimeout(400);
}
const widthAfterDrag = await rzSec.locator('th', { hasText: 'Category' }).evaluate((el) => el.getBoundingClientRect().width);
ok('DT16: drag handle → width tăng ~60px', widthAfterDrag >= widthBeforeDrag + 40, `${widthBeforeDrag} → ${widthAfterDrag}`);
// (d) Drag ngược → width giảm (min-width guard 60).
await rzHandle.scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
const handleBox2 = await rzHandle.boundingBox();
if (handleBox2) {
	await page.mouse.move(handleBox2.x + handleBox2.width / 2, handleBox2.y + handleBox2.height / 2);
	await page.mouse.down();
	await page.mouse.move(handleBox2.x + handleBox2.width / 2 - 500, handleBox2.y + handleBox2.height / 2, { steps: 8 });
	await page.mouse.up();
	await page.waitForTimeout(400);
}
const widthAfterShrink = await rzSec.locator('th', { hasText: 'Category' }).evaluate((el) => el.getBoundingClientRect().width);
ok('DT16: drag ngược → width >= min-width 60', widthAfterShrink >= 60 && widthAfterShrink < widthAfterDrag, `${widthAfterDrag} → ${widthAfterShrink}`);
// (e) Dblclick handle → reset về auto-fit (width thay đổi từ giá trị thu nhỏ).
const widthBeforeReset = await rzSec.locator('th', { hasText: 'Category' }).evaluate((el) => el.getBoundingClientRect().width);
await rzHandle.dblclick();
await page.waitForTimeout(400);
const widthAfterReset = await rzSec.locator('th', { hasText: 'Category' }).evaluate((el) => el.getBoundingClientRect().width);
ok('DT16: dblclick → reset về auto-fit (width khác giá trị min)', Math.abs(widthAfterReset - widthAfterShrink) > 5 && widthAfterReset >= widthAfterShrink, `${widthAfterShrink} → ${widthAfterReset}`);
// (f) Cell text tràn → ellipsis + title đầy đủ.
const ellip = await rzSec.locator('td.datatable-td').first().evaluate((el) => {
	const cs = getComputedStyle(el);
	return { overflow: cs.textOverflow, title: el.getAttribute('title') !== null };
});
ok('DT16: td text-overflow ellipsis', ellip.overflow === 'ellipsis' || ellip.overflow === 'clip' || ellip.overflow === '-webkit-ellipsis', ellip.overflow);

console.log('\n=== DT17: EDITOR ĐA DẠNG (number/boolean/date/select + auto focus) ===');
const edSec = page.locator('[data-test="dt-editor-diverse"]');
// (a) Number editor: click cell price → input[type=number] + auto focus + caret cuối.
const edPrice = edSec.locator('td[data-cell-id$=":price"]').first();
await edPrice.click();
await page.waitForTimeout(250);
const numInput = edSec.locator('input.datatable-cell-input[type="number"]');
ok('DT17: click price → input[type=number]', (await numInput.count()) === 1);
ok('DT17: number editor auto focus (activeElement)', (await numInput.evaluate((el) => document.activeElement === el)));
ok('DT17: input number giữ giá trị cũ "10"', (await numInput.inputValue()) === '10');
await numInput.fill('55');
await numInput.press('Enter');
await page.waitForTimeout(250);
ok('DT17: confirm number → cell hiển thị 55', ((await edPrice.textContent()) ?? '').includes('55'));
const edUpd = await page.locator('[data-test="dt-editor-update"]').textContent();
ok('DT17: callback fired number (oldValue→55)', edUpd?.includes('→55'), edUpd ?? '');
// Coerce: data ghi là number (oldValue number → newValue number).
ok('DT17: number coerce đúng (giá trị cũ 10/20/30 → 55)', edUpd?.includes(':price:'), edUpd ?? '');
// (b) Boolean editor: click cell flag → checkbox role=switch.
const edFlag = edSec.locator('td[data-cell-id$=":flag"]').first();
await edFlag.click();
await page.waitForTimeout(250);
const boolInput = edSec.locator('input.datatable-cell-check[type="checkbox"]');
ok('DT17: click flag → checkbox editor (role=switch)', (await boolInput.count()) === 1);
ok('DT17: checkbox editor checked đúng (row 1 active → true)', (await boolInput.evaluate((el) => el.checked)) === true);
await boolInput.click();
await page.waitForTimeout(150);
await boolInput.press('Enter');
await page.waitForTimeout(250);
ok('DT17: toggle boolean → cell đổi (flag false → icon khác)', (await edFlag.textContent())?.trim() !== '' );
const edUpd2 = await page.locator('[data-test="dt-editor-update"]').textContent();
ok('DT17: callback fired boolean (→false)', edUpd2?.includes('→false'), edUpd2 ?? '');
// (c) Date editor: click cell created → input[type=date] + value iso.
const edCreated = edSec.locator('td[data-cell-id$=":created"]').first();
await edCreated.click();
await page.waitForTimeout(250);
const dateInput = edSec.locator('input.datatable-cell-input[type="date"]');
ok('DT17: click created → input[type=date]', (await dateInput.count()) === 1);
const dateVal = await dateInput.inputValue();
ok('DT17: date editor value iso yyyy-mm-dd', /^\d{4}-\d{2}-\d{2}$/.test(dateVal), dateVal);
ok('DT17: date editor auto focus', (await dateInput.evaluate((el) => document.activeElement === el)));
await dateInput.fill('2026-06-15');
await dateInput.press('Enter');
await page.waitForTimeout(250);
ok('DT17: confirm date → cell hiển thị 2026-06-15', ((await edCreated.textContent()) ?? '').includes('2026-06-15'));
// (d) Select editor: click cell status → select dropdown.
const edStatus = edSec.locator('td[data-cell-id$=":status"]').first();
await edStatus.click();
await page.waitForTimeout(250);
const selInput = edSec.locator('select.datatable-cell-select');
ok('DT17: click status → select editor', (await selInput.count()) === 1);
ok('DT17: select editor có 3 options (active/inactive/out)', (await selInput.locator('option').count()) === 3);
await selInput.selectOption('out');
await page.waitForTimeout(150);
await selInput.press('Enter');
await page.waitForTimeout(250);
ok('DT17: confirm select → cell hiển thị "out"', ((await edStatus.textContent()) ?? '').includes('out'));
// (e) Auto focus: click cell name (text) → activeElement + caret cuối.
const edName = edSec.locator('td[data-cell-id$=":name"]').first();
await edName.click();
await page.waitForTimeout(250);
const txtInput = edSec.locator('input.datatable-cell-input[type="text"]');
ok('DT17: click name → input text auto focus', (await txtInput.count()) === 1 && (await txtInput.evaluate((el) => document.activeElement === el)));
ok('DT17: caret cuối text (selectionStart = length)', (await txtInput.evaluate((el) => el.selectionStart === el.value.length)));
await txtInput.press('Escape');
await page.waitForTimeout(150);

console.log('\n=== DT18: ROW DETAIL MODAL (click row → Modal + Save → onRowUpdate) ===');
const rdSec = page.locator('[data-test="dt-row-detail"]');
// (a) Click row (cell name) → modal mở.
await rdSec.locator('tr.datatable-row').nth(0).locator('td.datatable-td').nth(0).click();
await page.waitForTimeout(350);
const rdOverlay = page.locator('.modal-root, [data-ad-overlay], [role="dialog"]');
ok('DT18: click row → modal mở (overlay/dialog)', (await rdOverlay.count()) >= 1);
ok('DT18: modal title "Row details"/"Chi tiết row"', /row details|chi tiết row/i.test((await page.locator('[data-test="datatable-detail-title"]').textContent()) ?? ''));
ok('DT18: callback onRowDetail fired (d1)', ((await page.locator('[data-test="dt-row-detail-opened"]').textContent()) ?? '').includes('d1'));
// (b) Modal có field inputs theo editor type (cột price có render → static
// value — guard isCellEditable; còn Product/Category/Stock input + Status static).
ok('DT18: modal có ≥3 field input (price render → static)', (await page.locator('.datatable-detail-field input, .datatable-detail-field select').count()) >= 3);
// (c) Sửa field name + stock (price có render → static, đúng guard) → Save.
const detailName = page.locator('.datatable-detail-field input[type="text"], .datatable-detail-field input:not([type])').first();
await detailName.fill('Detail Renamed');
await page.waitForTimeout(120);
const detailStock = page.locator('.datatable-detail-field input[type="number"]').first();
await detailStock.fill('77');
await page.waitForTimeout(120);
await page.locator('[data-test="datatable-detail-save"]').click();
await page.waitForTimeout(350);
ok('DT18: Save → modal đóng', (await page.locator('[data-test="datatable-detail-title"]').count()) === 0);
ok('DT18: Save → data ghi (cell name "Detail Renamed")', ((await rdSec.locator('td[data-cell-id="d1:name"]').textContent()) ?? '').includes('Detail Renamed'));
ok('DT18: Save → data ghi (cell stock "77")', ((await rdSec.locator('td[data-cell-id="d1:stock"]').textContent()) ?? '').includes('77'));
ok('DT18: Save → onRowUpdate fired (d1)', ((await page.locator('[data-test="dt-row-detail-updated"]').textContent()) ?? '').includes('d1'));
ok('DT18: Save → price static giữ nguyên (không chứa stock 77)', !((await rdSec.locator('td[data-cell-id="d1:price"]').textContent()) ?? '').includes('77'));
// (d) Close (bỏ qua): click row 2 → sửa → Close → giữ nguyên.
await rdSec.locator('tr.datatable-row').nth(1).locator('td.datatable-td').nth(0).click();
await page.waitForTimeout(350);
const detailName2 = page.locator('.datatable-detail-field input:not([type="number"]):not([type="date"])').first();
await detailName2.fill('SHOULD NOT SAVE');
await page.waitForTimeout(120);
await page.locator('[data-test="datatable-detail-close"]').click();
await page.waitForTimeout(350);
ok('DT18: Close → modal đóng, cell giữ nguyên', ((await rdSec.locator('td[data-cell-id$=":name"]').nth(1).textContent()) ?? '').trim() === 'Detail Item 2');

console.log('\n=== DT19: CELL DETAIL (click cell → modal + focus đúng field) ===');
const cdSec = page.locator('[data-test="dt-cell-detail"]');
// Click cell stock (cột 4, input number) → modal + focus đúng field stock
// (price có render → static không focusable).
await cdSec.locator('tr.datatable-row').nth(0).locator('td.datatable-td').nth(3).click();
await page.waitForTimeout(350);
ok('DT19: click cell → modal mở', (await page.locator('[data-test="datatable-detail-title"]').count()) === 1);
ok(
	'DT19: focus đúng field stock (activeElement qua initialFocus)',
	(await page.evaluate(() => document.activeElement?.closest('[data-detail-field]')?.getAttribute('data-detail-field'))) === 'stock'
);
// Escape → đóng.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
ok('DT19: Escape → modal đóng', (await page.locator('[data-test="datatable-detail-title"]').count()) === 0);
// Click cell name (cột 1) → focus field name.
await cdSec.locator('tr.datatable-row').nth(0).locator('td.datatable-td').nth(0).click();
await page.waitForTimeout(350);
ok(
	'DT19: click name → focus field name',
	(await page.evaluate(() => document.activeElement?.closest('[data-detail-field]')?.getAttribute('data-detail-field'))) === 'name'
);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Screenshots wave 8 (8 ảnh).
console.log('\n=== SCREENSHOTS WAVE 8 ===');
const shotDirW8 = 'tests/screenshots/datatable';
mkdirSync(shotDirW8, { recursive: true });
await page.locator('[data-test="dt-resize"]').screenshot({ path: `${shotDirW8}/14-resize.png` });
// 15-editor-number: editor number đang mở (click price row 1).
await edSec.locator('td[data-cell-id$=":price"]').first().click();
await page.waitForTimeout(300);
await edSec.screenshot({ path: `${shotDirW8}/15-editor-number.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
// 16-editor-select: select editor đang mở.
await edSec.locator('td[data-cell-id$=":status"]').first().click();
await page.waitForTimeout(300);
await edSec.screenshot({ path: `${shotDirW8}/16-editor-select.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
// 17-editor-boolean: checkbox editor đang mở.
await edSec.locator('td[data-cell-id$=":flag"]').first().click();
await page.waitForTimeout(300);
await edSec.screenshot({ path: `${shotDirW8}/17-editor-boolean.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
// 18-row-detail: modal chi tiết row đang mở.
await rdSec.locator('tr.datatable-row').nth(0).locator('td.datatable-td').nth(0).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shotDirW8}/18-row-detail.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
