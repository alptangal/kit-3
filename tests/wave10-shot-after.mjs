// Wave10 — screenshot SAU when bỏ padding-inline (temp script)
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

// 10-after-01: expanded — padding 0px, nội dung con tự mang padding 12px
await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('sidebar-width'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await sleep(1200);
await page.screenshot({ path: `${OUT}/10-after-01-expanded.png`, fullPage: false });

// 10-after-02: collapsed rail 72px — item square 48×48 căn giữa
await page.click('.sidebar-trigger');
await page.mouse.move(600, 400);
await sleep(450);
await page.screenshot({ path: `${OUT}/10-after-02-collapsed.png`, fullPage: false });

// 10-after-03: rail peek — hover mép phải rail → mở rộng tạm, layout full
await page.mouse.move(72, 400);
await sleep(450);
await page.screenshot({ path: `${OUT}/10-after-03-peek.png`, fullPage: false });

await browser.close();
console.log('AFTER shots done');
