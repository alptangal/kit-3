// select-features-probe.mjs
// Functional + computed-style probe cho 8 tính năng mới của Select
// Chạy: node tests/select-features-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000/ui/select';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
// Dev server giữ connection → networkidle không đạt; dùng domcontentloaded + chờ h1
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

// ── 1. SELECT-ALL ──
console.log('\n=== 1. SELECT-ALL ===');
const saTrigger = page.locator('section:has(h2:text("Select-All (multiple)")) .select-trigger');
await saTrigger.click();
await page.waitForSelector('.select-all-row', { timeout: 3000 });
const saRow = page.locator('.select-all-row');
ok('select-all row render', await saRow.count() === 1);
ok('select-all indicator exists', await saRow.locator('.select-all__indicator').count() === 1);

// Bấm chọn tất cả
await saRow.click();
await page.waitForTimeout(150);
let multiCode = await page.locator('section:has(h2:text("Select-All (multiple)")) code').first().textContent();
ok('select-all chọn đủ 6 (bỏ disabled)', multiCode.includes('apple') && multiCode.includes('orange') && !multiCode.includes('disabled'), multiCode.trim());

// Bỏ một option → indeterminate (dash)
const someOpt = page.locator('.select-option', { hasText: 'Apple' });
await someOpt.click();
await page.waitForTimeout(100);
const dashSvg = await saRow.locator('line[x1="5"]').count();
ok('indeterminate dash khi chọn một phần', dashSvg === 1, `dash=${dashSvg}`);

// Bấm chọn tất cả lần nữa (state "some"/indeterminate → chọn tất cả, đúng chuẩn checkbox indeterminate)
await saRow.click();
await page.waitForTimeout(100);
multiCode = await page.locator('section:has(h2:text("Select-All (multiple)")) code').first().textContent();
ok('select-all từ state "some" → chọn lại tất cả', multiCode.includes('apple') && multiCode.includes('orange') && !multiCode.includes('disabled'), multiCode.trim());

// Giờ ở state "all" → bấm lần nữa bỏ hết khả dụng
await saRow.click();
await page.waitForTimeout(100);
multiCode = await page.locator('section:has(h2:text("Select-All (multiple)")) code').first().textContent();
ok('select-all từ state "all" → bỏ hết', multiCode.trim() === '[]', multiCode.trim());
await page.waitForTimeout(100);
await page.keyboard.press('Escape');

// ── 2/3. LOAD-MORE (scroll / button / pagination) ──
console.log('\n=== 2/3. LOAD-MORE ===');
const lmSection = page.locator('section:has(h2:text("Load-more (scroll / button / pagination)"))');
const lmTrigger = lmSection.locator('.select-trigger');

// mode scroll (default)
await lmTrigger.click();
await page.waitForSelector('.select-option', { timeout: 3000 });
let optCount = await lmSection.locator('.select-option:not(.select-all-row)').count();
ok('scroll: render ≤ cap (6)', optCount <= 6, `optCount=${optCount}`);
const hintVisible = await lmSection.locator('.select-load-more-hint').isVisible();
ok('scroll: hint load-more hiện (hasMore)', hintVisible);
// Scroll tới đáy
await lmSection.locator('.select-option-list').evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(200);
optCount = await lmSection.locator('.select-option:not(.select-all-row)').count();
ok('scroll: load thêm sau scroll', optCount > 6, `optCount=${optCount}`);
await page.keyboard.press('Escape');

// mode button
await lmSection.locator('select').selectOption('button');
await lmTrigger.click();
await page.waitForTimeout(150);
const btnLoadMore = lmSection.locator('.select-load-more');
ok('button: nút load-more render', await btnLoadMore.count() === 1);
const btnText = await btnLoadMore.textContent();
ok('button: hiển thị count (6/40)', btnText.includes('6/40') || btnText.includes('/40'), btnText.trim());
await btnLoadMore.click();
await page.waitForTimeout(100);
const btnText2 = await btnLoadMore.textContent();
ok('button: count tăng sau click', btnText2 !== btnText, `${btnText.trim()} → ${btnText2.trim()}`);
await page.keyboard.press('Escape');

// mode pagination
await lmSection.locator('select').selectOption('pagination');
await lmTrigger.click();
await page.waitForTimeout(150);
const pagInfo = lmSection.locator('.select-pagination__info');
ok('pagination: info render', await pagInfo.count() === 1, (await pagInfo.textContent() ?? '').trim());
const prevDisabled = await lmSection.locator('.select-pagination__btn[disabled]').first().isDisabled().catch(() => false);
await lmSection.locator('.select-pagination__btn').last().click(); // next
await page.waitForTimeout(100);
ok('pagination: next tăng trang', (await pagInfo.textContent()).trim() === '2/10', (await pagInfo.textContent()).trim());
await page.keyboard.press('Escape');

// ── 4. REMOTE SEARCH + LOADING SPINNER + CLEAR SEARCH ──
console.log('\n=== 4. REMOTE SEARCH ===');
const rsSection = page.locator('section:has(h2:text("Remote Search (loading indicator)"))');
await rsSection.locator('.select-trigger').click();
await page.waitForSelector('.select-search-input', { timeout: 3000 });
// Chờ ban đầu loadOptions() resolve (mock delay 600ms)
await page.waitForTimeout(800);
// Gõ để remote search
const searchInput = rsSection.locator('.select-search-input');
await searchInput.fill('ha');
// Spinner phải hiện khi remote đang chạy (trước khi mock resolve ~600+300ms)
const spinnerVisible = await rsSection.locator('.select-search-spinner').first().isVisible().catch(() => false);
ok('remote: spinner hiện khi đang search', spinnerVisible, `spinner=${spinnerVisible}`);
await page.waitForTimeout(900); // chờ mock resolve
const optCountRs = await rsSection.locator('.select-option:not(.select-all-row)').count();
// "ha" (không dấu) chỉ khớp "Nha Trang" — "Hà Nội"/"Hải Phòng" dùng dấu (à/ả) nên không khớp
ok('remote: results khớp "ha" (Nha Trang)', optCountRs === 1, `optCount=${optCountRs}`);
// Clear button trong ô search
const clearSearch = rsSection.locator('.select-search-clear');
ok('clear search: nút X hiện khi có query', await clearSearch.count() === 1);
await clearSearch.click();
// Clear → loadOptions('') debounce 300 + mock 600 = ~900ms → chờ 1300ms để đủ resolve
await page.waitForTimeout(1300);
ok('clear search: query về rỗng', (await searchInput.inputValue()) === '');
const optCountAfterClear = await rsSection.locator('.select-option:not(.select-all-row)').count();
ok('clear search: list gốc hiện lại (10)', optCountAfterClear === 10, `optCount=${optCountAfterClear}`);
await page.keyboard.press('Escape');

// ── 5. UPDATE / DELETE OPTION ──
console.log('\n=== 5. UPDATE/DELETE ===');
const edSection = page.locator('section:has(h2:text("Update / Delete Option"))');
await edSection.locator('.select-trigger').click();
await page.waitForSelector('.select-option', { timeout: 3000 });
// Hover option Alpha → hiện nút edit
const alphaRow = edSection.locator('.select-option', { hasText: 'Alpha' });
await alphaRow.hover();
const editBtn = alphaRow.locator('.select-option__action--edit');
const delBtn = alphaRow.locator('.select-option__action--delete');
ok('edit: nút pencil render', await editBtn.count() === 1);
ok('delete: nút trash render', await delBtn.count() === 1);
const actionsOpacity = await alphaRow.locator('.select-option__actions').evaluate((el) => getComputedStyle(el).opacity);
ok('edit: actions opacity=1 khi hover', actionsOpacity === '1', `opacity=${actionsOpacity}`);
// Edit: bấm pencil → input inline
await editBtn.click();
await page.waitForTimeout(100);
const editInput = edSection.locator('.select-option__edit-input');
ok('edit: input inline hiện', await editInput.count() === 1);
await editInput.fill('Alpha NGUYEN');
await editInput.press('Enter');
await page.waitForTimeout(100);
ok('edit: label cập nhật trong source', (await edSection.locator('.select-option', { hasText: 'Alpha NGUYEN' }).count()) === 1);
// Delete: hover option "Bravo" → bấm trash
const bravoRow = edSection.locator('.select-option', { hasText: 'Bravo' });
await bravoRow.hover();
await bravoRow.locator('.select-option__action--delete').click();
await page.waitForTimeout(100);
ok('delete: option biến mất khỏi list', await edSection.locator('.select-option', { hasText: 'Bravo' }).count() === 0);
await page.keyboard.press('Escape');

// ── 7. VALIDATION ──
// Validator demo: label phải chứa chữ "a" → "Cherry" là option duy nhất invalid
console.log('\n=== 7. VALIDATION ===');
const valSection = page.locator('section:has(h2:text("Validation (required + custom)"))');
const valTrigger = valSection.locator('.select-trigger');
await valTrigger.click();
await page.waitForSelector('.select-option', { timeout: 3000 });
// Chọn "Cherry" (invalid per custom validator — label không chứa chữ "a")
await valSection.locator('.select-option', { hasText: 'Cherry' }).click();
await page.waitForTimeout(700); // debounce validation 300ms
let rootClasses = await valSection.locator('.select-root').getAttribute('class');
ok('validation: invalid → class color-error', rootClasses.includes('color-error'), rootClasses);
// Chọn "Apple" (valid)
await valTrigger.click();
await valSection.locator('.select-option', { hasText: 'Apple' }).click();
await page.waitForTimeout(700);
rootClasses = await valSection.locator('.select-root').getAttribute('class');
ok('validation: valid → class color-success', rootClasses.includes('color-success'), rootClasses);

// ── 8. AUTOFOCUS SEARCH INPUT ──
console.log('\n=== 8. AUTOFOUS SEARCH ===');
const afSection = page.locator('section:has(h2:text("Single Select"))');
await afSection.locator('.select-trigger').click();
await page.waitForSelector('.select-search-input', { timeout: 3000 });
await page.waitForTimeout(100); // rAF
const activeTag = await page.evaluate(() => document.activeElement?.tagName);
const activeClass = await page.evaluate(() => document.activeElement?.className ?? '');
ok('autofocus: search input active sau khi mở', activeTag === 'INPUT' && activeClass.includes('select-search-input'), `${activeTag}.${activeClass}`);

// ── Screenshots cho ui-checker ──
// Mỗi bước: reload để có state sạch (tránh dropdown mở che trigger phía sau, z-index 50).
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/select-features';
const fresh = async () => {
	await page.goto(BASE, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });
};

// Bước 01: reload sạch — state functional test (dropdown mở, value cũ) không còn
await fresh();
await page.screenshot({ path: `${shotDir}/01-initial.png`, fullPage: true });

// (1) select-all mở (chọn sẵn 1 option để hiện indeterminate)
await fresh();
await page.locator('section:has(h2:text("Select-All (multiple)")) .select-trigger').click();
await page.waitForSelector('.select-all-row', { timeout: 3000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/02-select-all-open.png` });
await page.keyboard.press('Escape');

// (2)+(3) load-more — mode button
await fresh();
await page.locator('section:has(h2:text("Load-more (scroll / button / pagination)")) select').selectOption('button');
await page.locator('section:has(h2:text("Load-more (scroll / button / pagination)")) .select-trigger').click();
await page.waitForSelector('.select-load-more', { timeout: 3000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/03-load-more-button.png` });
await page.keyboard.press('Escape');

// (4) remote search đang loading (gõ rồi chụp ngay khi spinner hiện)
await fresh();
await page.locator('section:has(h2:text("Remote Search (loading indicator)")) .select-trigger').click();
await page.waitForSelector('.select-search-input', { timeout: 3000 });
await page.locator('section:has(h2:text("Remote Search (loading indicator)")) .select-search-input').fill('ho');
await page.waitForTimeout(150);
await page.screenshot({ path: `${shotDir}/04-remote-search-loading.png` });
await page.waitForTimeout(900);
await page.screenshot({ path: `${shotDir}/05-remote-search-results.png` });
await page.keyboard.press('Escape');

// (5) edit option inline (nút pencil)
await fresh();
await page.locator('section:has(h2:text("Update / Delete Option")) .select-trigger').click();
await page.waitForSelector('.select-option', { timeout: 3000 });
const aRow = page.locator('section:has(h2:text("Update / Delete Option")) .select-option').first();
await aRow.hover();
await page.waitForTimeout(100);
await aRow.locator('.select-option__action--edit').click();
await page.waitForSelector('.select-option__edit-input', { timeout: 3000 });
await page.waitForTimeout(200);
await page.screenshot({ path: `${shotDir}/06-option-edit-mode.png` });

// (7) validation invalid (color-error border)
await fresh();
const vSec = page.locator('section:has(h2:text("Validation (required + custom)"))');
await vSec.locator('.select-trigger').click();
await page.waitForSelector('.select-option', { timeout: 3000 });
await vSec.locator('.select-option', { hasText: 'Cherry' }).click(); // invalid (label không có chữ "a")
await page.waitForTimeout(700);
await page.screenshot({ path: `${shotDir}/07-validation-error.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
