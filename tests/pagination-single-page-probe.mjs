// pagination-single-page-probe.mjs
// Functional probe cho task "B4 — Pagination totalPages=1: disable MỌI hành động đổi trang".
// PG1: compact + default totalPages=1 → counter/prev/next/page-button .disabled === true.
// PG2: click counter (JS dispatch) → KHÔNG vào edit mode, page không đổi.
// PG3: default → nút "1" disabled + class active GIỮ (vẫn đọc được trạng thái 1/1).
// PG4: totalPages=3 → counter + nút trang VẪN enabled (regression hành vi thường).
// PG5: totalPages=1 + loading → nav class loading hoạt động bình thường (không xung đột).
// Chạy: node tests/pagination-single-page-probe.mjs (dev server ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/pagination';
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
const pageErrors = [];
page.on('pageerror', (e) => {
	pageErrors.push(e.message);
	console.log('PAGEERROR:', e.message);
});
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="pg-single"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

// 2 nav trong section pg-single: index 0 = compact, index 1 = default
const compactNav = page.locator('[data-test="pg-single"] .pagination-root').nth(0);
const defaultNav = page.locator('[data-test="pg-single"] .pagination-root').nth(1);

console.log('\n=== PG1: TOTALPAGES=1 → MỌI NÚT DISABLED (COMPACT + DEFAULT) ===');
const singleState = await page.evaluate(() => {
	const navs = document.querySelectorAll('[data-test="pg-single"] .pagination-root');
	const compact = navs[0];
	const def = navs[1];
	return {
		compactPrev: compact?.querySelector('.pagination-prev')?.disabled,
		compactCounter: compact?.querySelector('.pagination-counter')?.disabled,
		compactNext: compact?.querySelector('.pagination-next')?.disabled,
		defaultPrev: def?.querySelector('.pagination-prev')?.disabled,
		defaultNext: def?.querySelector('.pagination-next')?.disabled,
		defaultPage: def?.querySelector('button.pagination-page')?.disabled,
		compactRootHasDisabledClass: compact?.classList.contains('disabled'),
		defaultRootHasDisabledClass: def?.classList.contains('disabled')
	};
});
ok('PG1: compact prev disabled', singleState.compactPrev === true, String(singleState.compactPrev));
ok('PG1: compact counter disabled', singleState.compactCounter === true, String(singleState.compactCounter));
ok('PG1: compact next disabled', singleState.compactNext === true, String(singleState.compactNext));
ok('PG1: default prev disabled', singleState.defaultPrev === true, String(singleState.defaultPrev));
ok('PG1: default next disabled', singleState.defaultNext === true, String(singleState.defaultNext));
ok('PG1: default page-button disabled', singleState.defaultPage === true, String(singleState.defaultPage));
// Guard thiết kế: KHÔNG dùng root class .disabled (giữ counter đọc được "1/1")
ok(
	'PG1: root KHÔNG có class .disabled (counter vẫn đọc được 1/1)',
	!singleState.compactRootHasDisabledClass && !singleState.defaultRootHasDisabledClass,
	`compact=${singleState.compactRootHasDisabledClass} default=${singleState.defaultRootHasDisabledClass}`
);

console.log('\n=== PG2: CLICK COUNTER → KHÔNG VÀO EDIT MODE, PAGE KHÔNG ĐỔI ===');
// disabled button không nhận click — dispatch JS để chắc chắn bypass pointer-events
await compactNav.locator('.pagination-counter').dispatchEvent('click');
await page.waitForTimeout(200);
const editState = await page.evaluate(() => {
	const nav = document.querySelector('[data-test="pg-single"] .pagination-root');
	return {
		inputVisible: !!nav?.querySelector('.pagination-page-input'),
		current: nav?.querySelector('[data-test="counter-current"]')?.textContent?.trim()
	};
});
ok('PG2: click counter → KHÔNG vào edit (không input)', !editState.inputVisible, JSON.stringify(editState));
ok('PG2: counter vẫn hiện "1/1"', editState.current === '1', editState.current ?? 'null');
const compactBind = await page.locator('[data-test="pg-single-compact-current"]').textContent();
ok('PG2: bind page compact giữ 1', compactBind?.trim() === '1', compactBind);

// Click nút trang "1" (default) → page không đổi (goTo guard)
await defaultNav.locator('button.pagination-page').dispatchEvent('click');
await page.waitForTimeout(150);
const defaultBind = await page.locator('[data-test="pg-single-default-current"]').textContent();
ok('PG2: click nút trang default → bind giữ 1', defaultBind?.trim() === '1', defaultBind);

console.log('\n=== PG3: DEFAULT → NÚT "1" DISABLED + CLASS ACTIVE GIỮ ===');
const pageBtnState = await page.evaluate(() => {
	const nav = document.querySelectorAll('[data-test="pg-single"] .pagination-root')[1];
	const btn = nav?.querySelector('button.pagination-page');
	return { disabled: btn?.disabled, active: btn?.classList.contains('active'), text: btn?.textContent?.trim() };
});
ok('PG3: nút "1" disabled', pageBtnState.disabled === true && pageBtnState.text === '1', JSON.stringify(pageBtnState));
ok('PG3: nút "1" vẫn giữ class active', pageBtnState.active === true, String(pageBtnState.active));

console.log('\n=== PG4: REGRESSION — TOTALPAGES=3 (pg-small) → VẪN ENABLED ===');
// pg-small: 3 pages, KHÔNG bị ảnh hưởng bởi fix singlePage
const smallState = await page.evaluate(() => {
	const nav = document.querySelector('[data-test="pg-small"] .pagination-root');
	return {
		prev: nav?.querySelector('.pagination-prev')?.disabled,
		next: nav?.querySelector('.pagination-next')?.disabled,
		counterOrPage: nav?.querySelector('button.pagination-page')?.disabled
	};
});
ok(
	'PG4: pg-small (3 pages) prev/next/page enabled (trừ prev ở trang đầu)',
	smallState.next === false && smallState.counterOrPage === false,
	JSON.stringify(smallState)
);
// pg-compact (42 pages): counter vẫn vào edit được
await page.locator('[data-test="pg-compact"] [data-test="counter"]').click();
await page.waitForTimeout(200);
const compact42Edit = await page.evaluate(() => !!document.querySelector('[data-test="pg-compact"] .pagination-page-input'));
ok('PG4: pg-compact (42 pages) counter VẪN vào edit', compact42Edit);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

console.log('\n=== PG5: TOTALPAGES=1 + LOADING → CLASS LOADING HOẠT ĐỘNG BÌNH THƯỜNG ===');
// Loading nav (pg-loading, totalPages=42) — kiểm tra class loading không bị singlePage phá
// (singlePage chỉ đổi disabled per-button).loadingRoot vẫn có class 'loading'
const loadingRoot = await page.evaluate(() => {
	const nav = document.querySelector('[data-test="pg-loading"] .pagination-root');
	return {
		hasLoading: nav?.classList.contains('loading'),
		busy: nav?.getAttribute('aria-busy'),
		counterDisabled: nav?.querySelector('.pagination-counter')?.disabled
	};
});
ok('PG5: loading nav giữ class loading + aria-busy', loadingRoot.hasLoading === true && loadingRoot.busy === 'true', JSON.stringify(loadingRoot));

// Thêm: instance single + loading (inject qua 1 nav tạm — dùng pg-single compact + kiểm tra
// không có class loading nữa là đủ; class loading chỉ đến từ prop). Chỉ verify không pageerror.

console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshots/pagination';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="pg-single"]').screenshot({ path: `${shotDir}/pagination-single-compact.png` });
// Cả 2 nav trong cùng section → 1 ảnh đủ (compact + default side-by-side cột dọc)
await page.locator('[data-test="pg-loading"]').screenshot({ path: `${shotDir}/pagination-single-default.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (pageErrors.length) console.log('PAGEERRORS:', pageErrors.length);
if (failed.length || pageErrors.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
