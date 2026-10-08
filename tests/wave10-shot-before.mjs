// Wave10 — screenshot TRƯỚC khi bỏ padding-inline (temp script)
import { chromium } from '@playwright/test';

const OUT = 'tests/screenshots/sidebar';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'light'
});
const page = await context.newPage();

// 10-before-01: expanded (240px) — header/content/footer padding 12px
await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('sidebar-width'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await sleep(500);
await page.screenshot({ path: `${OUT}/10-before-01-expanded.png`, fullPage: false });

// 10-before-02: collapsed rail 72px (chuột ra ngoài trước khi chụp)
await page.click('.sidebar-trigger');
await page.mouse.move(600, 400);
await sleep(450);
await page.screenshot({ path: `${OUT}/10-before-02-collapsed.png`, fullPage: false });

// 10-before-03: rail peek (hover mép phải rail → mở rộng tạm)
await page.mouse.move(72, 400);
await sleep(450);
await page.screenshot({ path: `${OUT}/10-before-03-peek.png`, fullPage: false });

await browser.close();
console.log('BEFORE shots done');
