// tests/cursor-f1-element-probe.mjs
// Wave F1-A — verify `cursor: not-allowed` cho state disabled (PC/desktop)
// trên 7 component ELEMENT + cursor đúng hành vi cho phần tử mọc.
//
// Component (demo pages):
//  AD  /ui/alert-dialog — Trigger/Action/Cancel disabled + trigger/button mọc
//  PV  /ui/popover      — Trigger disabled + button mọc
//  KB  /ui/kbd          — key disabled + key mọc (cursor default)
//  AL  /ui/alert        — alert disabled + alert mọc (cursor default)
//  BD  /ui/badge        — badge disabled + badge button/a mọc (pointer)
//  TS  /ui/toast        — toast disabled (infinite) + toast mọc (cursor default)
//  TP  /ui/tooltip      — root disabled + trigger mọc (pointer), disabled không hiện
//
// Rule (COMPONENT_CONTRACT §5b): disabled → var(--cursor-disabled);
// part tử chứa action → pointer; vùng edit → text.
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cursorOf = (page, selector) =>
	page.evaluate((sel) => {
		const el = document.querySelector(sel);
		return el ? getComputedStyle(el).cursor : null;
	}, selector);

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

// ─────────────────────────── 1. ALERT DIALOG ───────────────────────────
await page.goto('https://localhost:3000/ui/alert-dialog', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="ad-danger"]', { timeout: 20000 });
await sleep(300);

// AD1 — trigger disabled (span .disabled) → not-allowed
const adTrigDis = await cursorOf(page, '[data-test="ad-disabled"] .alert-dialog-trigger.disabled');
ok('AD1 alert-dialog Trigger disabled → cursor not-allowed', adTrigDis === 'not-allowed', `cursor=${adTrigDis}`);

// AD2 — trigger mọc: button bên trong = pointer (span trigger inherit default)
const adTrigActive = await cursorOf(page, '[data-test="ad-danger"] .alert-dialog-trigger .demo-btn');
ok('AD2 alert-dialog trigger mọc (button) → cursor pointer', adTrigActive === 'pointer', `cursor=${adTrigActive}`);

// AD3/AD4 — Action + Cancel disabled trong dialog (mở dialog có 2 nút disabled)
await page.locator('[data-test="ad-disabled-open"]').click();
await page.waitForSelector('[data-test="ad-disabled-action"]', { timeout: 5000 });
await sleep(300);
const adActionDis = await cursorOf(page, '[data-test="ad-disabled-action"]');
const adCancelDis = await cursorOf(page, '[data-test="ad-disabled-cancel"]');
ok('AD3 alert-dialog Action disabled → cursor not-allowed', adActionDis === 'not-allowed', `cursor=${adActionDis}`);
ok('AD4 alert-dialog Cancel disabled → cursor not-allowed', adCancelDis === 'not-allowed', `cursor=${adCancelDis}`);
// Both dialog buttons are disabled in this fixture → close via the demo control.
// It sits behind the fixed overlay, so a real Playwright click is intercepted;
// dispatch a DOM click instead (JS clicks skip hit-testing) and wait for unmount.
await page.evaluate(() => {
	const btn = document.querySelector('[data-test="ad-disabled-close"]');
	btn instanceof HTMLButtonElement && btn.click();
});
await page.waitForTimeout(300);
const dialogClosed = !(await page.locator('[data-test="ad-disabled-action"]').isVisible());
ok('AD4b alert-dialog demo-close unmounts the dialog', dialogClosed === true, `closed=${dialogClosed}`);
await sleep(200);

// AD5 — Action MỌC (dialog (a), enabled) = pointer: mở dialog danger rồi đo.
await page.locator('[data-test="ad-danger"] .demo-btn').click();
await page.waitForSelector('[data-ad-action]:not([disabled])', { timeout: 5000 });
const adActionActive = await cursorOf(page, '[data-ad-action]:not([disabled])');
ok('AD5 alert-dialog Action mọc → cursor pointer', adActionActive === 'pointer', `cursor=${adActionActive}`);
// Escape đóng dialog (Content xử lý, cả 2 nút dialog (a) đều enabled).
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ─────────────────────────── 2. POPOVER ───────────────────────────
await page.goto('https://localhost:3000/ui/popover', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="pv-disabled"]', { timeout: 20000 });
await sleep(300);

// PV1 — trigger disabled → not-allowed
const pvTrigDis = await cursorOf(page, '[data-test="pv-disabled"] .popover-trigger.disabled');
ok('PV1 popover Trigger disabled → cursor not-allowed', pvTrigDis === 'not-allowed', `cursor=${pvTrigDis}`);

// PV2 — trigger mọc: button bên trong = pointer
const pvTrigActive = await cursorOf(page, '[data-test="pv-click"] .popover-trigger .demo-btn');
ok('PV2 popover trigger mọc (button) → cursor pointer', pvTrigActive === 'pointer', `cursor=${pvTrigActive}`);

// PV3 — trigger disabled KHÔNG mở panel khi click (span pointer-events:none →
// click không tới control con; guard JS cũng chặn). force click để bypass hit-testing.
await page.locator('[data-test="pv-disabled-trigger-btn"]').click({ force: true }).catch(() => {});
await sleep(400);
const pvDisOpen = await page.evaluate(
	() => document.querySelector('[data-test="pv-disabled"] .popover-trigger')?.classList.contains('open')
);
ok('PV3 popover trigger disabled: click không mở (class open = false)', pvDisOpen === false, `open=${pvDisOpen}`);

// ─────────────────────────── 3. KBD ───────────────────────────
await page.goto('https://localhost:3000/ui/kbd', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="kbd-demo"]', { timeout: 20000 });
await sleep(300);

// KB1 — key disabled → not-allowed
const kbDis = await cursorOf(page, '[data-test="kb-disabled-key"]');
ok('KB1 kbd disabled → cursor not-allowed', kbDis === 'not-allowed', `cursor=${kbDis}`);

// KB2 — key mọc (text, không action) → default. Browser trả `auto` (initial
// value của `cursor`) cho phần tử không-interactive — render đúng mũi tên,
// tương đương `default`. Chấp nhận cả hai.
const kbActive = await cursorOf(page, '[data-test="kb-single"] .kbd-root');
ok('KB2 kbd mọc (text) → cursor default', ['default', 'auto'].includes(kbActive), `cursor=${kbActive}`);

// ─────────────────────────── 4. ALERT ───────────────────────────
await page.goto('https://localhost:3000/ui/alert', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="alert-demo"]', { timeout: 20000 });
await sleep(300);

// AL1 — alert disabled → not-allowed
const alDis = await cursorOf(page, '[data-test="al-disabled"] .alert-root.disabled');
ok('AL1 alert disabled → cursor not-allowed', alDis === 'not-allowed', `cursor=${alDis}`);

// AL2 — alert mọc (text, không action) → default (browser trả `auto` =
// initial value của cursor cho phần tử không-interactive; render giống default).
const alActive = await cursorOf(page, '[data-test="al-default"] .alert-root');
ok('AL2 alert mọc (text) → cursor default', ['default', 'auto'].includes(alActive), `cursor=${alActive}`);

// ─────────────────────────── 5. BADGE ───────────────────────────
await page.goto('https://localhost:3000/ui/badge', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="badge-demo"]', { timeout: 20000 });
await sleep(300);

// BD1 — badge disabled → not-allowed
const bdDis = await cursorOf(page, '[data-test="bd-default"] .badge-root.disabled');
ok('BD1 badge disabled → cursor not-allowed', bdDis === 'not-allowed', `cursor=${bdDis}`);

// BD2 — badge as="button" mọc → pointer
const bdBtn = await cursorOf(page, '[data-test="bd-link"] button.badge-root');
ok('BD2 badge as="button" mọc → cursor pointer', bdBtn === 'pointer', `cursor=${bdBtn}`);

// BD3 — badge as="a" mọc → pointer
const bdLink = await cursorOf(page, '[data-test="bd-link"] a.badge-root');
ok('BD3 badge as="a" mọc → cursor pointer', bdLink === 'pointer', `cursor=${bdLink}`);

// ─────────────────────────── 6. TOAST ───────────────────────────
await page.goto('https://localhost:3000/ui/toast', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toast-demo"]', { timeout: 20000 });
await sleep(300);

// TS0 — dọn toast còn lại (nếu có)
await page.locator('[data-test="toast-btn-remove"]').click();
await sleep(300);

// TS1 — toast disabled (infinite) → not-allowed
await page.locator('[data-test="toast-btn-disabled"]').click();
await page.waitForSelector('.toast-root.disabled', { timeout: 5000 });
await sleep(400);
const tsDis = await cursorOf(page, '.toast-root.disabled');
ok('TS1 toast disabled → cursor not-allowed', tsDis === 'not-allowed', `cursor=${tsDis}`);

// TS2 — toast mọc → default (base `cursor: var(--cursor)` undefined → auto;
// render không-interactive, tương đương default). Chấp nhận cả hai.
await page.locator('[data-test="toast-btn-default"]').click();
await page.waitForSelector('.toast-root:not(.disabled)', { timeout: 5000 });
const tsActive = await cursorOf(page, '.toast-root:not(.disabled)');
ok('TS2 toast mọc → cursor default', ['default', 'auto'].includes(tsActive), `cursor=${tsActive}`);
// dọn: xóa cả 2 (remove last xóa từng cái)
await page.locator('[data-test="toast-btn-remove"]').click();
await sleep(200);
await page.locator('[data-test="toast-btn-remove"]').click();
await sleep(200);

// ─────────────────────────── 7. TOOLTIP ───────────────────────────
await page.goto('https://localhost:3000/ui/tooltip', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="tooltip-demo"]', { timeout: 20000 });
await sleep(300);

// TP1 — root disabled (div.tooltip-root.disabled, display:contents) → not-allowed.
// Tooltip không spread `data-test` ra DOM → chọn bằng class thật trong section.
const tpDis = await cursorOf(page, '[data-test="tp-disabled"] .tooltip-root.disabled');
ok('TP1 tooltip root disabled → cursor not-allowed', tpDis === 'not-allowed', `cursor=${tpDis}`);

// TP2 — trigger mọc (button) → pointer
const tpActive = await cursorOf(page, '[data-test="tp-enabled-trigger"]');
ok('TP2 tooltip trigger mọc (button) → cursor pointer', tpActive === 'pointer', `cursor=${tpActive}`);

// TP3 — disabled: hover trigger KHÔNG hiện tooltip (events tắt)
await page.locator('[data-test="tp-disabled-trigger"]').hover();
await sleep(900);
const tpContentCount = await page.locator('.tooltip-content').count();
ok('TP3 tooltip disabled: hover không hiện content', tpContentCount === 0, `count=${tpContentCount}`);

// ─────────────────────────── Kết quả ───────────────────────────
await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
