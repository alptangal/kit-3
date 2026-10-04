// Modal close events — request 2026-10-03:
//  onClose(reason) + onCloseByEscape / onCloseByBackdrop / onCloseByButton /
//  onCloseByProgrammatic. Demo page /ui/modal (modal chính size xl) ghi
//  reason + đếm từng loại qua data-test:
//   data-test=close-count / last-reason / escape-count / backdrop-count /
//   button-count / programmatic-count.
//   E1  ESC  → reason 'escape',       escapeCount++
//   E2  click nền (backdrop) → reason 'backdrop', backdropCount++
//   E3  nút × → reason 'close-button', buttonCount++
//   E4  code set display=false (nút "Đóng (code)" trong modal chính)
//       → reason 'programmatic', programmaticCount++
//  Mỗi bước: modal đóng hẳn (detached) + onClose chung (closeCount) luôn fire.
// Chạy: node tests/modal-events-probe.mjs (dev: https://localhost:3000)
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000/ui/modal';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const ctx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 800 },
	deviceScaleFactor: 1
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);

async function openMain() {
	await page.getByRole('button', { name: 'Mở Modal', exact: true }).click();
	await page.waitForSelector('.modal-container-root', { state: 'visible' });
	await page.waitForTimeout(400);
}
async function closeToDetached() {
	await page.waitForSelector('.modal-root', { state: 'detached', timeout: 5000 });
	await page.waitForTimeout(300);
}
function readCounters() {
	return page.evaluate(() => {
		const read = (t) => document.querySelector(`[data-test="${t}"]`)?.textContent?.trim() ?? '';
		return {
			closeCount: read('close-count'),
			lastReason: read('last-reason'),
			escape: read('escape-count'),
			backdrop: read('backdrop-count'),
			button: read('button-count'),
			programmatic: read('programmatic-count')
		};
	});
}

// ── E1: ESC → reason 'escape' ──
await openMain();
await page.keyboard.press('Escape');
await closeToDetached();
let c1 = await readCounters();
ok('E1a ESC: modal đóng hẳn (detached)', true);
ok('E1b ESC: onClose chung fire (closeCount = 1)', c1.closeCount === '1', `count=${c1.closeCount}`);
ok("E1c ESC: lastReason = 'escape'", c1.lastReason === 'escape', `reason=${c1.lastReason}`);
ok('E1d ESC: onCloseByEscape fire (escapeCount = 1)', c1.escape === '1', `n=${c1.escape}`);

// ── E2: click backdrop → reason 'backdrop' ──
await openMain();
// Click góc backdrop — ngoài panel xl (panel 768px, viewport 1280 → x=40 an toàn)
await page.mouse.click(40, 400);
await closeToDetached();
const c2 = await readCounters();
ok('E2a click nền: modal đóng hẳn', true);
ok('E2b click nền: onClose chung fire (closeCount = 2)', c2.closeCount === '2', `count=${c2.closeCount}`);
ok("E2c click nền: lastReason = 'backdrop'", c2.lastReason === 'backdrop', `reason=${c2.lastReason}`);
ok('E2d click nền: onCloseByBackdrop fire (backdropCount = 1)', c2.backdrop === '1', `n=${c2.backdrop}`);

// ── E3: nút × → reason 'close-button' ──
await openMain();
await page.getByRole('button', { name: 'Close modal' }).click();
await closeToDetached();
const c3 = await readCounters();
ok('E3a nút ×: modal đóng hẳn', true);
ok('E3b nút ×: onClose chung fire (closeCount = 3)', c3.closeCount === '3', `count=${c3.closeCount}`);
ok("E3c nút ×: lastReason = 'close-button'", c3.lastReason === 'close-button', `reason=${c3.lastReason}`);
ok('E3d nút ×: onCloseByButton fire (buttonCount = 1)', c3.button === '1', `n=${c3.button}`);

// ── E4: code (nút "Đóng (code)" set showMain=false trong modal chính) → reason 'programmatic' ──
// Modal chính truyền onOpen/onClose + 4 callback riêng → test programmatic
// trên đúng modal có callback (khác E1–E3 vì code đóng, không ESC/backdrop/×).
await openMain();
await page.getByRole('button', { name: 'Đóng (code)', exact: true }).click();
await closeToDetached();
const c4 = await readCounters();
ok('E4a code close: modal đóng hẳn', true);
ok('E4b code close: onClose chung fire (closeCount = 4)', c4.closeCount === '4', `count=${c4.closeCount}`);
ok("E4c code close: lastReason = 'programmatic'", c4.lastReason === 'programmatic', `reason=${c4.lastReason}`);
ok('E4d code close: onCloseByProgrammatic fire (programmaticCount = 1)', c4.programmatic === '1', `n=${c4.programmatic}`);

await browser.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
