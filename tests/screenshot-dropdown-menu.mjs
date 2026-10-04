// tests/screenshot-dropdown-menu.mjs
// Chụp screenshot demo /ui/dropdown-menu + /ui/sidebar (TeamSwitcher).
// Lưu tests/screenshot/dropdown-menu/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'tests/screenshot/dropdown-menu';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();

async function shot(name, clip) {
	// clip rỗng → full page; chỉ truyền clip khi đủ 4 cạnh (Playwright reject clip thiếu cạnh).
	await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
	console.log('shot:', name);
}

// ============ /ui/dropdown-menu ============
await page.goto('https://localhost:3000/ui/dropdown-menu', { waitUntil: 'networkidle' });
await page.waitForSelector('.dropdown-menu-root', { timeout: 20000 });
await page.waitForTimeout(500);

// 01: trang đóng (all closed)
await shot('01-page-closed');

// 02: menu cơ bản mở (label + items + kbd + disabled)
const basicTrigger = page.locator('[data-test="dm-basic"] [data-dm-trigger]');
await basicTrigger.click();
await page.waitForTimeout(300);
await shot('02-basic-open');

// 03: align (mở menu căn giữa)
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const centerRow = page.locator('h2:has-text("Align")').locator('..').locator('.row');
await centerRow.locator('[data-dm-trigger]').nth(1).click();
await page.waitForTimeout(300);
const centerMenu = await page.locator('h2:has-text("Align")').locator('..').locator('[role="menu"]').boundingBox();
if (centerMenu) {
	await shot('03-align-center', { x: Math.max(0, centerMenu.x - 60), y: Math.max(0, centerMenu.y - 120), width: 360, height: 260 });
}

// 04: destructive + inset (mở menu "Hành động")
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const actionMenu = page.locator('h2:has-text("Variant destructive")').locator('..').locator('[data-dm-trigger]').first();
await actionMenu.click();
await page.waitForTimeout(300);
const actionBox = await page.locator('h2:has-text("Variant destructive")').locator('..').locator('[role="menu"]').boundingBox();
if (actionBox) {
	await shot('04-destructive-inset', { x: Math.max(0, actionBox.x - 80), y: Math.max(0, actionBox.y - 140), width: 420, height: 320 });
}

// 05: switcher mở (team list + nhóm + checkmark + Tạo team)
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const swSection = page.locator('[data-test="dm-switcher-section"]');
await swSection.locator('[data-dm-trigger]').click();
await page.waitForTimeout(300);
const swBox = await swSection.locator('[role="menu"]').boundingBox();
if (swBox) {
	await shot('05-team-switcher', { x: Math.max(0, swBox.x - 60), y: Math.max(0, swBox.y - 130), width: 400, height: 380 });
}

// ============ /ui/sidebar ============
await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'networkidle' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await page.waitForTimeout(500);

// 06: sidebar + switcher đóng (toàn cảnh)
await shot('06-sidebar-closed');

// 07: switcher mở trong sidebar (clip vùng sidebar)
const swTrigger = page.locator('.switcher [data-dm-trigger]');
await swTrigger.click();
await page.waitForTimeout(300);
const sidebarBox = await page.locator('.sidebar-aside').boundingBox();
if (sidebarBox) {
	await shot('07-sidebar-switcher-open', { x: 0, y: 0, width: Math.min(520, sidebarBox.width + 320), height: 520 });
}

await browser.close();
console.log('DONE →', OUT);
