// tests/screenshot-keyboard.mjs — screenshots cho batch keyboard mobile
// Mock soft keyboard: MutationObserver bắt visualInput append → co visualViewport
// + dispatch resize (getVisualKeyboardMeta chờ resize đo height keyboard).
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const shotDir = 'tests/screenshot/keyboard';
mkdirSync(shotDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = 'https://localhost:3000';

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ...devices['Pixel 5'], ignoreHTTPSErrors: true, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.addInitScript(() => {
	const vv = window.visualViewport;
	if (!vv) return;
	const mo = new MutationObserver((muts) => {
		for (const m of muts) {
			for (const n of m.addedNodes) {
				if (n instanceof HTMLInputElement && n.style.zIndex === '-1') {
					Object.defineProperty(vv, 'height', {
						value: Math.round(window.innerHeight * 0.6),
						configurable: true
					});
					setTimeout(() => vv.dispatchEvent(new Event('resize')), 30);
				}
			}
		}
	});
	new Promise((res) => {
		if (document.body) return res();
		const iv = setInterval(() => {
			if (document.body) {
				clearInterval(iv);
				res();
			}
		}, 5);
	}).then(() => mo.observe(document.body, { childList: true }));
});

await page.goto(`${app}/ui/input`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-number"] input', { timeout: 20000 });
await page.evaluate(() => document.fonts?.ready);
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.mouse.move(180, 300);
await sleep(1200);

// 01: đóng — trạng thái nền (đối chiếu)
await page.screenshot({ path: `${shotDir}/01-mobile-closed.png` });

// 02: mở keyboard ở input number — rỗng
await page.locator('[data-test="input-number"] input').click();
await sleep(900); // mount + load handler margin/scroll settle
await page.screenshot({ path: `${shotDir}/02-mobile-open-empty.png` });

// 03: gõ 12+3 → caret giữa biểu thức + value
// Bẫy probe: label '+' là regex special → escape
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const press = async (label) => {
	await page.locator('.keyboard-number-root button', { hasText: new RegExp(`^\\s*${escapeRe(label)}\\s*$`) }).click();
	await sleep(130);
};
await press('1');
await press('2');
await press('+');
await press('3');
await sleep(500); // caret effect + scroll settle
await page.screenshot({ path: `${shotDir}/03-mobile-typing-caret.png` });

// 04: nhấn '=' → tính 15
await press('=');
await sleep(600);
await page.screenshot({ path: `${shotDir}/04-mobile-calculated.png` });

// 05: đóng (click ngoài) → currency mở + gõ 1234 → autoFormat 1.234 + caret
await page.locator('h2').first().click();
await sleep(400);
await page.locator('[data-test="input-currency-vnd"] input').click();
await sleep(900);
await press('1');
await press('2');
await press('3');
await press('4');
await sleep(500);
await page.screenshot({ path: `${shotDir}/05-mobile-currency-format.png` });

await context.close();
await browser.close();
console.log('done: 5 screenshots');
