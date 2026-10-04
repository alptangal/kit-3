// Chẩn đoán: blur trên trigger có làm đóng dropdown ở chế độ multiple/searchable không?
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/ui/select`, { waitUntil: 'networkidle' });

const isDropdownOpen = (i) => page.locator('.select-root').nth(i).locator('.select-dropdown').count();

// 1) Single + searchable: mở rồi click vào ô search
const t1 = page.locator('.select-root').first().locator('.select-trigger');
await t1.click();
await page.waitForTimeout(200);
console.log('A. single open sau khi click trigger:', await isDropdownOpen(0));
const search = page.locator('.select-root').first().locator('.select-search-input');
if (await search.count()) {
	await search.click();
	await page.waitForTimeout(200);
	console.log('B. single dropdown còn mở sau khi click search input:', await isDropdownOpen(0));
}

// Chạy thêm keyboard: gõ 'b' trong search, Escape đóng dropdown
await search.fill('b');
await page.waitForTimeout(150);
console.log('B1. single options sau khi gõ "b":', await page.locator('.select-root').first().locator('.select-option').count());
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(100);
console.log('B2. highlighted sau ArrowDown:', await page.locator('.select-root').first().locator('.select-option.highlighted').count());
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
console.log('B3. single dropdown còn mở sau Escape:', await isDropdownOpen(0));

// 2) Multiple: bật multi, mở, click option đầu, kiểm tra dropdown
await page.locator('label', { hasText: 'Enable Multi-Select' }).first().locator('input[type=checkbox]').check();
await page.waitForTimeout(200);
const multi = page.locator('.select-root').nth(1);
await multi.locator('.select-trigger').click();
await page.waitForTimeout(200);
console.log('C. multi open sau khi click trigger:', await isDropdownOpen(1));
const opts = multi.locator('.select-option');
console.log('D. số option visible:', await opts.count());
if (await opts.count() > 0) {
	await opts.nth(0).click();
	await page.waitForTimeout(200);
	console.log('E. multi dropdown còn mở sau khi click option đầu:', await isDropdownOpen(1));
	console.log('F. số option sau khi click:', await multi.locator('.select-option').count());
}

await browser.close();
