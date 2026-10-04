// tests/screenshot-sidebar.mjs
// Chụp screenshot demo Sidebar/Breadcrumb/Separator (light) vào tests/screenshot/sidebar/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'tests/screenshot/sidebar';
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();

// 01: sidebar mở (default desktop icon)
await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await sleep(500);
await page.screenshot({ path: `${OUT}/01-sidebar-open.png`, fullPage: false });

// 02: collapsed (bấm trigger)
await page.click('.sidebar-trigger');
await sleep(450);
await page.screenshot({ path: `${OUT}/02-sidebar-collapsed.png`, fullPage: false });

// 03: mobile offcanvas (viewport 375, trigger mở)
await page.setViewportSize({ width: 375, height: 812 });
await sleep(600); // matchMedia đổi → isMobile, aside translateX(-100%)
await page.screenshot({ path: `${OUT}/03-mobile-closed.png`, fullPage: false });
// Trigger nằm trong aside (off-canvas, ngoài viewport khi đóng) → gọi .click() trực tiếp
// qua DOM (bỏ qua hit-test toạ độ) để mở offcanvas + overlay.
await page.evaluate(() => document.querySelector('.sidebar-trigger')?.click());
await sleep(450);
await page.screenshot({ path: `${OUT}/04-mobile-open-overlay.png`, fullPage: false });

// 05: breadcrumb page
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('https://localhost:3000/ui/breadcrumb', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.breadcrumb-root', { timeout: 20000 });
await sleep(300);
await page.screenshot({ path: `${OUT}/05-breadcrumb.png`, fullPage: true });

// 06: separator page
await page.goto('https://localhost:3000/ui/separator', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.separator-root', { timeout: 20000 });
await sleep(300);
await page.screenshot({ path: `${OUT}/06-separator.png`, fullPage: true });

await browser.close();
console.log('Screenshots →', OUT);
