// tests/toast-shot-verify.mjs
// Verify NGAY kịch bản 05/06/07 (left/right): đo DOM (rect + transform + count)
// rồi chụp NGAY — xác nhận toast có khung đầy đủ hay chỉ render text.
// Root cause check cho hiện tượng ui-checker 0/3 ĐẠT (05/06/07).
import { chromium } from '@playwright/test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Base URL: biến môi trường PORT (mặc định 3000 — server dev có thể chạy 3001).
const PORT = process.env.PORT || 3000;
const BASE = `https://localhost:${PORT}`;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(`${BASE}/ui/toast`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 30000 });
await sleep(500);

const fireStack = async (n, position = 'bottom') => {
	await page.evaluate(
		({ n, position }) => {
			window.dispatchEvent(new CustomEvent('toast-probe:fire', { detail: { n, position } }));
		},
		{ n, position }
	);
};
const clearAll = async () => {
	await page.evaluate(() => {
		window.dispatchEvent(new CustomEvent('toast-probe:clear'));
	});
	await sleep(350);
};
const snapshot = () =>
	page.evaluate(() =>
		[...document.querySelectorAll('.toast-root')].map((r) => {
			const rect = r.getBoundingClientRect();
			const s = getComputedStyle(r);
			return {
				title: (r.textContent || '').trim().slice(0, 24),
				position: r.getAttribute('data-position'),
				transform: r.style.transform,
				background: s.backgroundColor,
				border: s.borderTopWidth + ' ' + s.borderTopColor,
				hasShadow: s.boxShadow !== 'none',
				rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
			};
		})
	);

// ── 05 — left STACK: đo + chụp NGAY ──
await clearAll();
await fireStack(3, 'left');
await page.locator('.toast-root', { hasText: 'H toast 3' }).waitFor({ state: 'visible', timeout: 10000 });
await sleep(500);
const leftStackSnap = (await snapshot()).filter((t) => t.position === 'left');
console.log('== 05 left STACK (đo NGAY) ==');
leftStackSnap.forEach((t) =>
	console.log(
		`  ${t.title} · bg=${t.background} · border=${t.border} · shadow=${t.hasShadow} · rect=x${t.rect.x},y${t.rect.y},${t.rect.w}x${t.rect.h} · tf=${t.transform}`
	)
);
await page.screenshot({ path: 'tests/screenshots/toast/05-left-stack.png' });
console.log('05-left-stack captured');

// ── 06 — left EXPAND: hover → đo + chụp ──
await page.locator('.toast-root', { hasText: 'H toast 3' }).hover();
await sleep(600);
const leftExpandSnap = (await snapshot()).filter((t) => t.position === 'left');
console.log('== 06 left EXPAND (đo NGAY) ==');
leftExpandSnap.forEach((t) =>
	console.log(
		`  ${t.title} · bg=${t.background} · border=${t.border} · shadow=${t.hasShadow} · rect=x${t.rect.x},y${t.rect.y},${t.rect.w}x${t.rect.h} · tf=${t.transform}`
	)
);
await page.screenshot({ path: 'tests/screenshots/toast/06-left-expanded.png' });
console.log('06-left-expanded captured');

// ── 07 — right EXPAND: hover → đo + chụp ──
await clearAll();
await fireStack(3, 'right');
await page.locator('.toast-root', { hasText: 'H toast 3' }).waitFor({ state: 'visible', timeout: 10000 });
await sleep(500);
await page.locator('.toast-root', { hasText: 'H toast 3' }).hover();
await sleep(600);
const rightExpandSnap = (await snapshot()).filter((t) => t.position === 'right');
console.log('== 07 right EXPAND (đo NGAY) ==');
rightExpandSnap.forEach((t) =>
	console.log(
		`  ${t.title} · bg=${t.background} · border=${t.border} · shadow=${t.hasShadow} · rect=x${t.rect.x},y${t.rect.y},${t.rect.w}x${t.rect.h} · tf=${t.transform}`
	)
);
await page.screenshot({ path: 'tests/screenshots/toast/07-right-expanded.png' });
console.log('07-right-expanded captured');

await clearAll();
await browser.close();
console.log('done');
