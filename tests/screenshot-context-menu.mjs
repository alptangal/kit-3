// tests/screenshot-context-menu.mjs
// Chụp screenshot demo /ui/context-menu (menu OPEN — right-click row 2).
// Lưu tests/screenshot/context-menu/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'tests/screenshot/context-menu';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();

await page.goto('https://localhost:3000/ui/context-menu', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.context-menu-root', { timeout: 20000 });
await page.waitForTimeout(400);

// 01: menu open (right-click row 2, label "User 2")
const row2 = page.locator('[data-test="cm-users"] .row[data-user="2"]');
const box = await row2.boundingBox();
await page.mouse.click(Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2), { button: 'right' });
await page.waitForSelector('[role="menu"]', { timeout: 5000 });

// Icon render async (Iconify API fetch → cache). Chờ tới khi svg xuất hiện trong menu
// (max 8s) để screenshot chụp ĐỦ icon, không chụp lúc còn rỗng.
try {
	await page.waitForSelector('[role="menu"] svg.iconify', { timeout: 8000 });
} catch {
	console.log('WARN: icon chưa load (offline?) — chụp không icon');
}
await page.waitForTimeout(200); // animation + settle
await page.screenshot({ path: `${OUT}/01-context-menu-open.png` });
console.log('shot: 01-context-menu-open');

await browser.close();
