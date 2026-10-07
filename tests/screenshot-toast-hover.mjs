// tests/screenshot-toast-hover.mjs
// Chụp 7 screenshot Toast hover-expand (DSF2, light) vào tests/screenshots/toast/:
//   01-stack.png          — 3 toast bottom stack chồng (mặc định, chưa hover)
//   02-hover-expanded.png — hover toast trong group → expand thẳng hàng dọc
//   03-top-stack.png      — 3 toast top stack chồng
//   04-top-expanded.png   — hover → expand thẳng hàng dọc (từ mép trên đi xuống)
//   05-left-stack.png     — 3 toast left stack chồng
//   06-left-expanded.png  — hover → expand hàng ngang
//   07-right-expanded.png — 3 toast right + hover → expand hàng ngang
// Chờ iconify svg load (polling) — bẫy: icon async 1-2s+.
// Toast infinite → không auto-dismiss giữa các shot; clear event xóa sạch.
import { chromium } from '@playwright/test';

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

await page.goto('https://localhost:3000/ui/toast', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 30000 });
await sleep(500);

// Fire N toast infinite cùng position qua custom event (page lắng nghe).
const fireStack = async (n, position = 'bottom') => {
	await page.evaluate(
		({ n, position }) => {
			window.dispatchEvent(new CustomEvent('toast-probe:fire', { detail: { n, position } }));
		},
		{ n, position }
	);
};
// Xóa mọi toast probe + stack.
const clearAll = async () => {
	await page.evaluate(() => {
		window.dispatchEvent(new CustomEvent('toast-probe:clear'));
	});
	await sleep(350);
};

// Chờ iconify mount: poll đến khi đủ N toast có svg (indicator).
async function waitToastIcons(need) {
	for (let i = 0; i < 40; i++) {
		const count = await page.evaluate((n) => {
			const roots = [...document.querySelectorAll('.toast-root')];
			return roots.filter((r) => r.querySelector('svg')).length;
		}, need);
		if (count >= need) return true;
		await sleep(250);
	}
	return false;
}

// ── 01 — stack: 3 toast bottom chồng (chưa hover) ──
await fireStack(3, 'bottom');
await page.locator('.toast-root', { hasText: 'H toast 3' }).waitFor({ state: 'visible', timeout: 10000 });
await waitToastIcons(0); // toast fire không có indicator — skip
await sleep(500); // fly intro + layout ổn định
await page.screenshot({ path: 'tests/screenshots/toast/01-stack.png' });
console.log('01-stack captured');

// ── 02 — hover expanded: hover toast mới nhất → expand thẳng hàng dọc ──
await page.locator('.toast-root', { hasText: 'H toast 3' }).hover();
await sleep(600); // transition 200ms + collapse delay
await page.screenshot({ path: 'tests/screenshots/toast/02-hover-expanded.png' });
console.log('02-hover-expanded captured');

// ── 03/04 — top: stack + expanded ──
await clearAll();
await fireStack(3, 'top');
await page.locator('.toast-root', { hasText: 'H toast 3' }).waitFor({ state: 'visible', timeout: 10000 });
await sleep(500);
await page.screenshot({ path: 'tests/screenshots/toast/03-top-stack.png' });
console.log('03-top-stack captured');
await page.locator('.toast-root', { hasText: 'H toast 3' }).hover();
await sleep(600);
await page.screenshot({ path: 'tests/screenshots/toast/04-top-expanded.png' });
console.log('04-top-expanded captured');

// ── 05/06 — left: stack + expanded ──
await clearAll();
await fireStack(3, 'left');
await page.locator('.toast-root', { hasText: 'H toast 3' }).waitFor({ state: 'visible', timeout: 10000 });
await sleep(500);
await page.screenshot({ path: 'tests/screenshots/toast/05-left-stack.png' });
console.log('05-left-stack captured');
await page.locator('.toast-root', { hasText: 'H toast 3' }).hover();
await sleep(600);
await page.screenshot({ path: 'tests/screenshots/toast/06-left-expanded.png' });
console.log('06-left-expanded captured');

// ── 07 — right: expanded ──
await clearAll();
await fireStack(3, 'right');
await page.locator('.toast-root', { hasText: 'H toast 3' }).waitFor({ state: 'visible', timeout: 10000 });
await sleep(500);
await page.screenshot({ path: 'tests/screenshots/toast/07-right-expanded.png' });
console.log('07-right-expanded captured');
await page.locator('.toast-root', { hasText: 'H toast 3' }).hover();
await sleep(600);
await page.screenshot({ path: 'tests/screenshots/toast/07-right-expanded.png' });
console.log('07-right-expanded captured (hover)');

await clearAll();
await browser.close();
console.log('done');
