// tests/_shot-date-picker.mjs
// Chụp screenshot demo date-picker. Panel absolute nằm NGOÀI bounding box
// root (top: calc(100% + 0.5rem)) → chụp theo VIEWPORT (scroll section vào
// view), KHÔNG element-screenshot (bị clip). deviceScaleFactor 1 cho full
// page (ảnh quá cao scale 2 bị nén → đọc thiếu section).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const outDir = 'tests/screenshots/date-picker';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 1
});
const page = await context.newPage();

await page.goto('https://localhost:3000/ui/date-picker', { waitUntil: 'networkidle' });
await page.waitForSelector('.date-picker-root', { timeout: 20000 });
await page.waitForTimeout(1000);

// 1. Full page (deviceScaleFactor 1 — đủ chiều cao 6 section)
await page.screenshot({ path: `${outDir}/01-full-page.png`, fullPage: true });

// 2. Range mode: mở panel + click from (ngày 8) → pending state.
// Chụp VIEWPORT (panel absolute tràn ra ngoài root — element shot bị clip).
await page.locator('[data-test="dp-range-mode"] [data-dp-trigger]').click();
await page.waitForTimeout(300);
const fromKey = await page.evaluate(() => {
	const now = new Date();
	return `${now.getFullYear()}-${now.getMonth()}-8`;
});
await page.locator(`[data-test="dp-range-mode"] [data-dp-day="${fromKey}"]`).click();
await page.waitForTimeout(300);
await page
	.locator('[data-test="dp-range-mode"]')
	.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outDir}/02-range-pending.png` });

// 3. Range mode: hover ngày 14 → preview band từ from → 14
const hoverKey = await page.evaluate(() => {
	const now = new Date();
	return `${now.getFullYear()}-${now.getMonth()}-14`;
});
await page.locator(`[data-test="dp-range-mode"] [data-dp-day="${hoverKey}"]`).hover();
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/03-range-hover-preview.png` });

// 4. Range mode: click to (ngày 14) → band from→to chốt, panel đóng → trigger text
await page.locator(`[data-test="dp-range-mode"] [data-dp-day="${hoverKey}"]`).click();
await page.waitForTimeout(300);
const section = page.locator('[data-test="dp-range-mode"]');
await section.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${outDir}/04-range-selected.png` });

await browser.close();
console.log('DONE: 4 screenshots saved to', outDir);
