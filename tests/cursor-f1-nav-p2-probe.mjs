// tests/cursor-f1-nav-p2-probe.mjs
// Wave F1-B: P0 disabled `not-allowed` (breadcrumb + sidebar nav) + P2 normalize
// literal → token (var(--cursor-interactive) / var(--cursor-disabled)) + scope 3
// (datatable pagesize span label KHÔNG còn cursor: pointer).
//
// Checks:
//  CF1 accordion trigger disabled → cursor not-allowed; active → pointer
//  CF2 context-menu item disabled (menu mở) → not-allowed; item thường → pointer
//  CF3 tabs trigger disabled → not-allowed; active → pointer
//  CF4 date-picker trigger disabled → not-allowed; trigger thường → pointer
//  CF5 datatable pagination: prev (disabled page 1) → not-allowed; next → pointer;
//     .datatable-pagesize (label wrapper span) ≠ pointer; .datatable-pagesize-select = pointer
//  CF6 breadcrumb root disabled → not-allowed (P0: pointer-events none giữ nguyên);
//     item thường (link) → pointer
//  CF7 sidebar MenuButton disabled → not-allowed (P0); menu button thường → pointer
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

const cursor = async (selector) =>
	page.evaluate((sel) => {
		const el = document.querySelector(sel);
		return el ? getComputedStyle(el).cursor : null;
	}, selector);

// ═══ CF1 — accordion ═══
await page.goto('https://localhost:3000/ui/accordion', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="ac-disabled"] .accordion-trigger', { timeout: 20000 });
await sleep(300);
const cf1disabled = await cursor('[data-test="ac-disabled"] .accordion-trigger.disabled');
ok('CF1a accordion trigger disabled → not-allowed', cf1disabled === 'not-allowed', `cursor=${cf1disabled}`);
const cf1active = await cursor('[data-test="ac-single"] .accordion-trigger');
ok('CF1b accordion trigger thường → pointer', cf1active === 'pointer', `cursor=${cf1active}`);

// ═══ CF2 — context-menu (mở menu disabled-demo, đọc item) ═══
await page.goto('https://localhost:3000/ui/context-menu', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="cm-disabled"] .disabled-box', { timeout: 20000 });
await sleep(300);
await page.locator('[data-test="cm-disabled"] .disabled-box').click({ button: 'right' });
await sleep(500);
const cf2disabled = await cursor('[role="menuitem"][aria-disabled="true"]');
ok('CF2a context-menu item disabled → not-allowed', cf2disabled === 'not-allowed', `cursor=${cf2disabled}`);
const cf2normal = await page.evaluate(() => {
	const items = [...document.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
	const el = items.find((i) => i.textContent?.includes('Sao chép link')) ?? items[0];
	return el ? getComputedStyle(el).cursor : null;
});
ok('CF2b context-menu item thường → pointer', cf2normal === 'pointer', `cursor=${cf2normal}`);
// Đóng menu để không ảnh hưởng page sau.
await page.keyboard.press('Escape');
await sleep(200);

// ═══ CF3 — tabs ═══
await page.goto('https://localhost:3000/ui/tabs', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[role="tab"][disabled]', { timeout: 20000 });
await sleep(300);
const cf3disabled = await page.evaluate(() => {
	const el = document.querySelector('[role="tab"][disabled]');
	return el ? getComputedStyle(el).cursor : null;
});
ok('CF3a tabs trigger disabled → not-allowed', cf3disabled === 'not-allowed', `cursor=${cf3disabled}`);
const cf3active = await page.evaluate(() => {
	const el = document.querySelector('[role="tab"][aria-selected="true"]');
	return el ? getComputedStyle(el).cursor : null;
});
ok('CF3b tabs trigger active → pointer', cf3active === 'pointer', `cursor=${cf3active}`);

// ═══ CF4 — date-picker ═══
await page.goto('https://localhost:3000/ui/date-picker', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="dp-disabled"] .date-picker-trigger', { timeout: 20000 });
await sleep(300);
const cf4disabled = await cursor('[data-test="dp-disabled"] .date-picker-trigger.disabled');
ok('CF4a date-picker trigger disabled → not-allowed', cf4disabled === 'not-allowed', `cursor=${cf4disabled}`);
const cf4normal = await page.evaluate(() => {
	const el = [...document.querySelectorAll('.date-picker-trigger')].find((t) => !t.classList.contains('disabled'));
	return el ? getComputedStyle(el).cursor : null;
});
ok('CF4b date-picker trigger thường → pointer', cf4normal === 'pointer', `cursor=${cf4normal}`);

// ═══ CF5 — datatable pagination ═══
await page.goto('https://localhost:3000/ui/datatable', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="dt-basic"] .datatable-pagination', { timeout: 20000 });
await sleep(300);
// dt-basic: 15 row, pageSize 10 → 2 trang, page 1 → prev disabled.
const cf5prevDisabled = await page.evaluate(() => {
	const btns = [...document.querySelectorAll('[data-test="dt-basic"] .datatable-pg-btn')];
	const prev = btns[0];
	return prev ? { disabled: prev.disabled, cursor: getComputedStyle(prev).cursor } : null;
});
ok('CF5a datatable prev (disabled) → not-allowed', cf5prevDisabled?.disabled === true && cf5prevDisabled?.cursor === 'not-allowed', JSON.stringify(cf5prevDisabled));
const cf5next = await page.evaluate(() => {
	const btns = [...document.querySelectorAll('[data-test="dt-basic"] .datatable-pg-btn')];
	const next = btns[1];
	return next ? getComputedStyle(next).cursor : null;
});
ok('CF5b datatable next (enabled) → pointer', cf5next === 'pointer', `cursor=${cf5next}`);
// Scope 3: .datatable-pagesize (label wrapper) KHÔNG pointer; select thì pointer.
const cf5label = await cursor('[data-test="dt-basic"] .datatable-pagesize');
ok('CF5c .datatable-pagesize (span label) ≠ pointer', cf5label !== 'pointer', `cursor=${cf5label}`);
const cf5select = await cursor('[data-test="dt-basic"] .datatable-pagesize-select');
ok('CF5d .datatable-pagesize-select → pointer', cf5select === 'pointer', `cursor=${cf5select}`);

// ═══ CF6 — breadcrumb (P0) ═══
await page.goto('https://localhost:3000/ui/breadcrumb', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="breadcrumb-demo"]', { timeout: 20000 });
await sleep(300);
const cf6disabled = await cursor('[data-test="bc-disabled"] .breadcrumb-root.disabled');
const cf6pe = await page.evaluate(() => {
	const el = document.querySelector('[data-test="bc-disabled"] .breadcrumb-root.disabled');
	return el ? getComputedStyle(el).pointerEvents : null;
});
ok('CF6a breadcrumb root disabled → not-allowed (P0)', cf6disabled === 'not-allowed', `cursor=${cf6disabled}`);
ok('CF6b breadcrumb root disabled → pointer-events: none giữ nguyên', cf6pe === 'none', `pointerEvents=${cf6pe}`);
const cf6normal = await cursor('[data-test="bc-custom"] .breadcrumb-link');
ok('CF6c breadcrumb item thường (link) → pointer', cf6normal === 'pointer', `cursor=${cf6normal}`);

// ═══ CF7 — sidebar MenuButton (P0) ═══
await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-menu-button', { timeout: 20000 });
await sleep(300);
const cf7disabled = await cursor('.sidebar-menu-button.disabled');
const cf7pe = await page.evaluate(() => {
	const el = document.querySelector('.sidebar-menu-button.disabled');
	return el ? getComputedStyle(el).pointerEvents : null;
});
ok('CF7a sidebar MenuButton disabled → not-allowed (P0)', cf7disabled === 'not-allowed', `cursor=${cf7disabled}`);
ok('CF7b sidebar MenuButton disabled → pointer-events: none giữ nguyên', cf7pe === 'none', `pointerEvents=${cf7pe}`);
const cf7normal = await cursor('.sidebar-menu-button:not(.disabled)');
ok('CF7c sidebar MenuButton thường → pointer', cf7normal === 'pointer', `cursor=${cf7normal}`);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
