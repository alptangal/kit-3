// Wave10 — đo aside width + kiểm tra peek (temp)
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 400));
const m1 = await page.evaluate(() => {
  const aside = document.querySelector('.sidebar-aside');
  const cs = getComputedStyle(aside);
  const provider = document.querySelector('.sidebar-provider');
  return {
    asideW: Math.round(aside.getBoundingClientRect().width),
    asideStyleW: cs.width,
    providerW: Math.round(provider.getBoundingClientRect().width),
    innerW: window.innerWidth,
    ls: localStorage.getItem('sidebar-width')
  };
});
console.log('OPEN:', JSON.stringify(m1));
// peek
await page.click('.sidebar-trigger');
await page.mouse.move(600, 400);
await new Promise((r) => setTimeout(r, 450));
await page.mouse.move(72, 400);
await new Promise((r) => setTimeout(r, 500));
const m2 = await page.evaluate(() => {
  const aside = document.querySelector('.sidebar-aside');
  return { peekW: Math.round(aside.getBoundingClientRect().width), collapsed: aside.classList.contains('sidebar-collapsed') };
});
console.log('PEEK:', JSON.stringify(m2));
await browser.close();
