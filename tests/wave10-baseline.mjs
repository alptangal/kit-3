// Wave10 baseline — đo padding header/content/footer TRƯỚC khi sửa (temp script)
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 400));

// Đo padding header/content/footer (expanded mode) + menu button left offset
const expanded = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { pl: cs.paddingLeft, pr: cs.paddingRight, pt: cs.paddingTop, pb: cs.paddingBottom, w: Math.round(r.width), left: Math.round(r.left) };
  };
  return {
    header: pick('.sidebar-header'),
    content: pick('.sidebar-content'),
    footer: pick('.sidebar-footer'),
    groupLabel: pick('.sidebar-group-label'),
    menuButton: pick('.sidebar-menu-button')
  };
});
console.log('EXPANDED:', JSON.stringify(expanded, null, 2));

// Collapsed mode (icon rail) — click trigger rồi di chuột ra ngoài
await page.click('.sidebar-trigger');
await page.mouse.move(600, 400);
await new Promise((r) => setTimeout(r, 450));

const collapsed = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector('.sidebar-header');
    const cs = getComputedStyle(document.querySelector(sel));
    return { pl: cs.paddingLeft, pr: cs.paddingRight };
  };
  const header = document.querySelector('.sidebar-header');
  const hcs = header ? getComputedStyle(header) : null;
  const content = document.querySelector('.sidebar-content');
  const ccs = content ? getComputedStyle(content) : null;
  const footer = document.querySelector('.sidebar-footer');
  const fcs = footer ? getComputedStyle(footer) : null;
  const btn = document.querySelector('.sidebar-menu-button');
  const bcs = btn ? getComputedStyle(btn) : null;
  return {
    header: hcs ? { pl: hcs.paddingLeft, pr: hcs.paddingRight } : null,
    content: ccs ? { pl: ccs.paddingLeft, pr: ccs.paddingRight } : null,
    footer: fcs ? { pl: fcs.paddingLeft, pr: fcs.paddingRight } : null,
    menuButton: bcs ? { pl: bcs.paddingLeft, pr: bcs.paddingRight, w: Math.round(btn.getBoundingClientRect().width), h: Math.round(btn.getBoundingClientRect().height) } : null
  };
});
console.log('COLLAPSED:', JSON.stringify(collapsed, null, 2));

await browser.close();
