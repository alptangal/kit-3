// tests/screenshot-sidebar-mobile.mjs — screenshots cho batch Sidebar S1/S2/S3
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const shotDir = 'tests/screenshot/sidebar';
mkdirSync(shotDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = 'https://localhost:3000';

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// ---- Desktop collapsed + dropdown bị ẩn (S3) ----
const dctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const dpage = await dctx.newPage();
await dpage.goto(`${app}/ui/sidebar`, { waitUntil: 'domcontentloaded' });
await dpage.waitForSelector('.sidebar-aside', { timeout: 20000 });
await dpage.evaluate(() => localStorage.removeItem('sidebar-width'));
// Bẫy đã gặp (settings batch): ảnh ĐẦU TIÊN sau goto hay trắng vì hydration/
// font chưa xong → ép fonts.ready + 2 rAF + mouse move (repaint) + settle.
await dpage.evaluate(() => document.fonts?.ready);
await dpage.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await dpage.mouse.move(640, 450);
await sleep(1200);
// 01: expanded 240px
await dpage.screenshot({ path: `${shotDir}/01-desktop-expanded.png` });
// 02: collapsed rail 56px
// .first(): demo có 2 trigger (sidebar header + inset mobile-trigger — desktop
// inset trigger display:none nhưng vẫn trong DOM → strict mode fail).
await dpage.locator('.sidebar-trigger').first().click();
await dpage.mouse.move(700, 500);
await sleep(600);
await dpage.screenshot({ path: `${shotDir}/02-desktop-collapsed.png` });
// 03: collapsed + menu TeamSwitcher MỞ nhưng chuột rời aside → content ẨN
// (menu không tràn ra rail — content display:none)
await dpage.locator('.switcher .dropdown-menu-trigger').click();
await sleep(400);
await dpage.mouse.move(700, 500);
await sleep(400);
await dpage.screenshot({ path: `${shotDir}/03-collapsed-dropdown-hidden.png` });
// 04: peek hover → rail mở rộng 240px tạm
await dpage.mouse.move(28, 300);
await sleep(700);
await dpage.screenshot({ path: `${shotDir}/04-collapsed-peek-hover.png` });
await dctx.close();

// ---- Mobile (S1 + S2) ----
const mctx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 700 },
	hasTouch: true,
	isMobile: true,
	deviceScaleFactor: 2
});
const mpage = await mctx.newPage();
await mpage.goto(`${app}/ui/sidebar`, { waitUntil: 'domcontentloaded' });
await mpage.waitForSelector('.sidebar-aside', { timeout: 20000 });
await mpage.evaluate(() => document.fonts?.ready);
await mpage.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await mpage.mouse.move(180, 350);
await sleep(1200);
// scroll lên ĐỈNH trước khi chụp — ảnh 05 từng lệch (trang giữ scroll cũ từ
// phiên trước, hamburger nằm ngoài khung trên) → đảm bảo header trong khung.
await mpage.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
// 05: mobile offcanvas ĐÓNG — inset header (hamburger + breadcrumb, padding 8px)
await mpage.screenshot({ path: `${shotDir}/05-mobile-closed-inset-header.png` });
// 06: mobile offcanvas MỞ — aside width fit-content (không khoảng trống phải)
await mpage.locator('.inset-mobile-trigger .sidebar-trigger').first().evaluate((el) => el.click());
await sleep(700);
await mpage.screenshot({ path: `${shotDir}/06-mobile-open-fit-content.png` });
await mctx.close();

await browser.close();
console.log('done: 6 screenshots');
