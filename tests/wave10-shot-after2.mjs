// Wave10 — chụp lại 2 ảnh AFTER collapsed + peek (sau fix avatar switcher)
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

await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('sidebar-width'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await page.waitForLoadState('networkidle');
await sleep(1500);

// 10-after-02: collapsed rail 72px — item square 48×48 căn giữa + avatar switcher căn giữa
await page.click('.sidebar-trigger');
await page.mouse.move(600, 400);
await sleep(450);
await page.screenshot({ path: `${OUT}/10-after-02-collapsed.png`, fullPage: false });
console.log('shot 2 done');

// 10-after-03: rail peek — hover mép phải rail → mở rộng tạm, layout full
await page.mouse.move(72, 400);
await sleep(450);
await page.screenshot({ path: `${OUT}/10-after-03-peek.png`, fullPage: false });
console.log('shot 3 done');

await browser.close();
console.log('AFTER2 shots done');
