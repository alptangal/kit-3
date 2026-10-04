// Chụp screenshot các trạng thái của Select để ui-checker đánh giá
// Chạy: node tests/select-design-screenshot.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000';
const OUT = 'tests/screenshots/select-design';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1200, height: 900 },
	colorScheme: 'light',
	ignoreHTTPSErrors: true
});
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => {
	if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push('PAGEERROR: ' + err.message));

await page.goto(`${BASE}/ui/select`, { waitUntil: 'networkidle' });

async function shot(name) {
	await page.screenshot({ path: `${OUT}/${name}.png` });
}

// 1. Single select — closed
await shot('01-single-closed');

// 2. Single select — focus (click trigger mở dropdown)
const trigger1 = page.locator('.select-root').first().locator('.select-trigger');
await trigger1.click();
await page.waitForTimeout(250);
await shot('02-single-open');

// 3. Highlight một option (arrow down x2) rồi dừng
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(60);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(60);
await shot('03-single-highlight');

// 4. Chọn option → closed, có value
await page.keyboard.press('Enter');
await page.waitForTimeout(250);
await shot('04-single-selected');

// 5. Multi-select — bật checkbox enable, mở, chọn 2 option
const enableMulti = page.locator('label', { hasText: 'Enable Multi-Select' }).first();
await enableMulti.locator('input[type=checkbox]').check();
await page.waitForTimeout(150);
const triggerMulti = page.locator('.select-root').nth(1).locator('.select-trigger');
await triggerMulti.click();
await page.waitForTimeout(250);
const opts = page.locator('.select-root').nth(1).locator('.select-option');
await opts.nth(0).click();
await page.waitForTimeout(80);
await opts.nth(1).click();
await page.waitForTimeout(80);
await shot('05-multi-open-selected');

// 6. Focus ring trên trigger (nhưng không mở dropdown) — dùng select multi, blur dropdown
//    click vào body để đóng dropdown, sau đó focus trigger
await page.mouse.click(10, 850);
await page.waitForTimeout(150);
await triggerMulti.focus();
await page.waitForTimeout(150);
await shot('06-trigger-focus-ring');

await browser.close();

console.log('CONSOLE/PAGE ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : '(none)');
console.log('Screenshots written to', OUT);
