// Wave10 — chụp lại ảnh BEFORE bằng CSS override runtime (không stash file)
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
// chờ đủ lâu để dev-server SSR + hydration + font render xong (ảnh trước trống do chụp sớm)
await page.waitForLoadState('networkidle');
await sleep(1500);

// Hoàn tác các thay đổi "after" bằng CSS override → tái tạo trạng thái "before":
// 1) header/content/footer: trả padding-inline 0.75rem (header: 1rem 0.75rem; content: 0.25rem 0.75rem 1rem; footer: 0.75rem)
// 2) collapsed menu button: bỏ display:flex/width 3rem/margin auto/aspect-ratio (trả inline-flex mặc định)
// 3) peek menu button: bỏ width 100%/margin 0 (trả mặc định)
// 4) .brand + .footer-user: bỏ padding-inline tự thêm
await page.addStyleTag({ content: `
  .sidebar-header { padding: 1rem 0.75rem !important; }
  .sidebar-content { padding: 0.25rem 0.75rem 1rem !important; }
  .sidebar-footer { padding: 0.75rem !important; }
  .brand { padding-inline: 0 !important; }
  .footer-user { padding-inline: 0 !important; }
` });
await sleep(300);

// 10-before-01: expanded (240px) — header/content/footer padding 12px
await page.screenshot({ path: `${OUT}/10-before-01-expanded.png`, fullPage: false });
console.log('shot 1 done');

// 10-before-02: collapsed rail 72px (chuột ra ngoài trước khi chụp)
await page.click('.sidebar-trigger');
await page.mouse.move(600, 400);
await sleep(450);
await page.screenshot({ path: `${OUT}/10-before-02-collapsed.png`, fullPage: false });
console.log('shot 2 done');

// 10-before-03: rail peek (hover mép phải rail → mở rộng tạm)
await page.mouse.move(72, 400);
await sleep(450);
await page.screenshot({ path: `${OUT}/10-before-03-peek.png`, fullPage: false });
console.log('shot 3 done');

await browser.close();
console.log('BEFORE2 shots done');
