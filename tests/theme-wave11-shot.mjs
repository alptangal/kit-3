// tests/theme-wave11-shot.mjs
// Screenshot minh họa Wave 11 — Theme toggle animate chuyển màu lan dần:
//  01 — Light theme (trước khi đổi)
//  02 — Dark theme (sau khi đổi — circle lan từ nút góc trái)
//  03 — Dark theme (circle lan từ nút ThemeToggle — vị trí giữa)
//  04 — Light theme trở lại (toggle lần 2)
// Tuần tự (KHÔNG chạy 2 script song song — bẫy 2 script đè cùng tên file → ảnh xé).
import { chromium } from '@playwright/test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

await page.goto(`${BASE}/ui/theme`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="theme-demo"]', { state: 'attached', timeout: 30000 });
await sleep(500);

// Reset theme về light
await page.evaluate(() => localStorage.setItem('theme', 'light'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="theme-demo"]', { state: 'attached', timeout: 30000 });
await sleep(1500); // iconify load xong

// ── 01 — Light theme (trước) ──
await page.screenshot({ path: 'tests/screenshots/theme/01-light.png' });
console.log('01-light captured');

// ── 02 — Dark theme (circle lan từ nút góc trái) ──
await page.locator('[data-test="theme-corner-tl"]').click();
await sleep(300); // giữa transition (450ms) — chụp lúc circle lan ~2/3
await page.screenshot({ path: 'tests/screenshots/theme/02-dark-corner.png' });
console.log('02-dark-corner captured');
await sleep(600); // transition xong
const theme2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
console.log('data-theme sau đổi:', theme2);

// ── 03 — Dark theme (circle lan từ ThemeToggle giữa trang) ──
// Đang dark → bấm ThemeToggle → light. Muốn chụp dark → dùng nút set-dark rồi
// bấm ThemeToggle khi đang light... Thực hiện: set dark (từ góc phải) rồi chụp
// circle light từ ThemeToggle.
await page.locator('[data-test="theme-set-dark"]').click();
await sleep(800);
const theme3 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
console.log('data-theme trước 03:', theme3);
await page.locator('[data-test="theme-toggle"]').click();
await sleep(300);
await page.screenshot({ path: 'tests/screenshots/theme/03-light-toggle-center.png' });
console.log('03-light-toggle-center captured');
await sleep(600);

// ── 04 — Light theme ổn định (sau cùng) ──
await page.screenshot({ path: 'tests/screenshots/theme/04-light-final.png' });
console.log('04-light-final captured');

await browser.close();
console.log('done');
