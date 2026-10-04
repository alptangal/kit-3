// Kiểm tra trigger khi dropdown MỞ + highlight bằng keyboard (ảnh 03)
// + kiểm tra thuộc tính --duration trên .select-root
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
const page = await context.newPage();
await page.goto(`${BASE}/ui/select`, { waitUntil: 'networkidle' });

const t1 = page.locator('.select-root').first().locator('.select-trigger');
await t1.click();
await page.waitForTimeout(200);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(100);

const state = await page.locator('.select-root').first().evaluate((el) => ({
	classes: el.className,
	triggerBorder: getComputedStyle(el.querySelector('.select-trigger')).borderColor,
	triggerShadow: getComputedStyle(el.querySelector('.select-trigger')).boxShadow,
	rootDuration: el.style.getPropertyValue('--duration'),
	rootMaxHeight: el.style.getPropertyValue('--max-height')
}));
console.log(JSON.stringify(state, null, 2));
await browser.close();
