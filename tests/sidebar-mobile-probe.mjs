// tests/sidebar-mobile-probe.mjs
// Verify 3 yêu cầu user (2026-10-12) — demo /ui/sidebar + admin layout:
//  S1 inset header mobile (≤767px): padding-inline co về 0.5rem (demo + admin)
//  S2 mobile offcanvas: aside width fit-content (không khoảng trống lãng phí
//     bên phải), cap 85vw, min-width 14rem
//  S3 desktop collapsed: dropdown content (TeamSwitcher) KHÔNG tràn ra rail —
//     display:none khi rail (nhưng vẫn mở khi peek hover/focus-within)
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const app = 'https://localhost:3000';

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// ---- Desktop context (S3) ----
const dctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const dpage = await dctx.newPage();
dpage.on('pageerror', (e) => console.log('PAGEERROR(d):', e.message));
await dpage.goto(`${app}/ui/sidebar`, { waitUntil: 'domcontentloaded' });
await dpage.waitForSelector('.sidebar-aside', { timeout: 20000 });
await dpage.evaluate(() => localStorage.removeItem('sidebar-width'));
await sleep(400);

// S3a — collapsed: mở menu TeamSwitcher rồi RỜI CHUỘT khỏi aside → peek rơi →
// content PHẢI ẨN (không tràn rail). (Click avatar bằng chuột → aside :hover →
// peek mở rộng tạm → menu hiện — đúng thiết kế; case lỗi là khi chuột rời đi.)
await dpage.locator('.sidebar-trigger').first().click();
await dpage.mouse.move(700, 500);
await sleep(500);
await dpage.locator('.switcher .dropdown-menu-trigger').click();
await sleep(400);
// rời chuột khỏi aside (di vào inset) + blur menu (focus-within giữ mở nếu
// vẫn focus → di focus bằng phím Escape trước... Escape đóng menu, nên dùng
// click nền ngoài — click nền cũng đóng menu (outside click) → test đúng
// case: aside không hover không focus mà content còn trong DOM thì phải ẩn.
// Đơn giản hơn: đóng menu bằng Escape, mở lại bằng keyboard Enter trên trigger
// (trigger giữ focus → menu mở, aside vẫn không hover) → content phải ẩn.
await dpage.keyboard.press('Escape');
await sleep(300);
await dpage.locator('.switcher .dropdown-menu-trigger').focus();
await dpage.keyboard.press('Enter');
await sleep(400);
await dpage.mouse.move(700, 500); // chuột ngoài aside (focus vẫn trên trigger trong aside)
await sleep(300);
const s3a = await dpage.evaluate(() => {
	const content = document.querySelector('.dropdown-menu-content');
	const aside = document.querySelector('.sidebar-aside');
	return {
		open: !!content,
		display: content ? getComputedStyle(content).display : 'n/a',
		focusWithin: aside.matches(':focus-within'),
		hover: aside.matches(':hover')
	};
});
// focus-within = true (trigger giữ focus) → rule :not(:focus-within) không áp —
// menu mở bằng keyboard vẫn dùng được NẾU user đang tương tác; case user要求:
// chuột mở menu → rời chuột → focus rời (click nền) → phải ẩn. Test case thật:
await dpage.keyboard.press('Escape');
await sleep(300);
await dpage.locator('.switcher .dropdown-menu-trigger').click(); // mở bằng chuột
await sleep(400);
await dpage.mouse.move(700, 500); // rời chuột khỏi aside
await sleep(400);
const s3a2 = await dpage.evaluate(() => {
	const content = document.querySelector('.dropdown-menu-content');
	return {
		open: !!content,
		display: content ? getComputedStyle(content).display : 'n/a',
		hover: document.querySelector('.sidebar-aside').matches(':hover')
	};
});
ok('S3a collapsed: menu mở bằng chuột → rời chuột → content ẩn (không tràn rail)', s3a2.open && s3a2.display === 'none' && !s3a2.hover, JSON.stringify(s3a2));

// S3b — peek hover: hover aside → content HIỆN LẠI (đổi team được khi peek)
await dpage.mouse.move(28, 300); // vào giữa rail → :hover aside
await sleep(600);
const s3b = await dpage.evaluate(() => {
	const content = document.querySelector('.dropdown-menu-content');
	return { display: content ? getComputedStyle(content).display : 'n/a' };
});
ok('S3b peek hover (aside :hover) → dropdown content hiển thị lại', s3b.display === 'block' || s3b.display === 'flex', JSON.stringify(s3b));
// S1-demo desktop: nút hamburger trong inset header phải ẨN (trigger-row trong
// sidebar header đã đảm nhiệm)
const s3d = await dpage.evaluate(() => {
	const t = document.querySelector('.inset-mobile-trigger');
	return { display: t ? getComputedStyle(t).display : 'n/a' };
});
ok('S1-demo desktop: nút mở sidebar trong inset header ẨN', s3d.display === 'none', JSON.stringify(s3d));
await dpage.keyboard.press('Escape');
await sleep(300);
await dpage.locator('.sidebar-trigger').first().click(); // expand lại
await sleep(500);
await dctx.close();

// ---- Mobile context (S1 + S2) — demo /ui/sidebar ----
const mctx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 700 },
	hasTouch: true,
	isMobile: true
});
const mpage = await mctx.newPage();
mpage.on('pageerror', (e) => console.log('PAGEERROR(m):', e.message));
await mpage.goto(`${app}/ui/sidebar`, { waitUntil: 'domcontentloaded' });
await mpage.waitForSelector('.sidebar-aside', { timeout: 20000 });
await sleep(500);

// S1-demo — inset header padding-inline ≤ 8px trên mobile + có nút mở sidebar
// (aside offcanvas ẩn → trigger trong Sidebar.Header không bấm được trên mobile;
// dùng evaluate click vì aside translateX(-100%) đưa trigger ngoài viewport)
const s1demo = await mpage.evaluate(() => {
	const h = document.querySelector('.inset-header');
	const cs = getComputedStyle(h);
	return { pl: cs.paddingLeft, pr: cs.paddingRight };
});
ok('S1-demo mobile: .inset-header padding-inline = 8px', s1demo.pl === '8px' && s1demo.pr === '8px', JSON.stringify(s1demo));

const s1demoTrig = await mpage.evaluate(() => {
	const t = document.querySelector('.inset-mobile-trigger .sidebar-trigger');
	if (!t) return null;
	const r = t.getBoundingClientRect();
	return { display: getComputedStyle(t.closest('.inset-mobile-trigger')).display, w: r.width, h: r.height };
});
ok('S1-demo mobile: nút mở sidebar HIỆN trong inset header (hamburger)', s1demoTrig && s1demoTrig.display !== 'none' && s1demoTrig.w > 20, JSON.stringify(s1demoTrig));

// S2a — mobile: aside offcanvas ẨN ban đầu (translateX(-100%)) nhưng width
// nội tại đã fit-content (đo qua getBoundingClientRect khi chưa mở vẫn đúng
// vì transform không đổi layout width)
const s2a = await mpage.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const r = aside.getBoundingClientRect();
	const cs = getComputedStyle(aside);
	return {
		isMobileClass: aside.classList.contains('sidebar-mobile'),
		offsetWidth: aside.offsetWidth,
		vw: window.innerWidth,
		position: cs.position
	};
});
ok(
	'S2a mobile: aside.sidebar-mobile, width nội tại fit-content (≤85vw=318px, ≥224px)',
	s2a.isMobileClass && s2a.offsetWidth <= 318 && s2a.offsetWidth >= 224 && s2a.position === 'fixed',
	JSON.stringify(s2a)
);

// S2b — mobile: aside mặc định ĐÓNG (defaultOpen false). Trigger trong sidebar
// header nằm TRONG aside ẩn (translateX(-100%) → ngoài viewport — "outside of
// the viewport"). Mở bằng nút trong inset header (S1-demo vừa thêm — đúng flow
// user mobile thật), invoke click qua JS (không cần trong viewport).
await mpage.locator('.inset-mobile-trigger .sidebar-trigger').first().evaluate((el) => el.click());
await sleep(600);
const s2b = await mpage.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const r = aside.getBoundingClientRect();
	return { open: aside.classList.contains('sidebar-open'), left: r.left, right: r.right, width: r.width };
});
ok(
	'S2b mobile offcanvas mở: aside.sidebar-open, mép phải = width (không dư)',
	s2b.open && Math.abs(s2b.right - s2b.width) < 1,
	JSON.stringify(s2b)
);
// S2c — item menu button width khớp aside (không lệch tạo khoảng trắng)
const s2c = await mpage.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const btn = document.querySelector('.sidebar-menu-button');
	if (!btn) return null;
	const br = btn.getBoundingClientRect();
	const ar = aside.getBoundingClientRect();
	return { btnRight: br.right, asideRight: ar.right };
});
ok('S2c mobile: menu button right ≈ aside right (nội dung lấp đầy)', Math.abs(s2c.btnRight - s2c.asideRight) < 2, JSON.stringify(s2c));
await mctx.close();

// ---- Mobile — admin layout (S1-admin) ----
// Gate users:manage — đăng nhập qua form /login (credential như probe settings).
const actx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 700 },
	hasTouch: true,
	isMobile: true
});
const apage = await actx.newPage();
apage.on('pageerror', (e) => console.log('PAGEERROR(a):', e.message));
await apage.goto(`${app}/login`, { waitUntil: 'domcontentloaded' });
await apage.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(500);
await apage.locator('.auth-input-wrapper input').first().fill('admin');
await sleep(400);
await apage.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
await sleep(600);
await apage.locator('.auth-btn-submit').first().click();
await apage.waitForURL((u) => !u.toString().includes('/login'), { waitUntil: 'domcontentloaded', timeout: 20000 });
await apage.goto(`${app}/admin`, { waitUntil: 'domcontentloaded' });
await apage.waitForSelector('.admin-inset-header', { timeout: 20000 });
await sleep(400);
const s1admin = await apage.evaluate(() => {
	const h = document.querySelector('.admin-inset-header');
	const cs = getComputedStyle(h);
	return { pl: cs.paddingLeft, pr: cs.paddingRight };
});
ok('S1-admin mobile: .admin-inset-header padding-inline = 8px', s1admin.pl === '8px' && s1admin.pr === '8px', JSON.stringify(s1admin));
await actx.close();

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
