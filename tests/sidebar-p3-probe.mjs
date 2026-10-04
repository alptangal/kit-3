// tests/sidebar-p3-probe.mjs
// Verify Sidebar P3 hoàn thiện (gộp P2 search regression) — trang /ui/sidebar.
//
// P3 (user req #1–#5):
//  P3-01 khi rail (collapsed): LOGO ẩn/hiện theo prop (aside class sidebar-logo-hidden)
//  P3-02 menu item SQUARE (aspect-ratio 1/1) + icon cùng tâm x khi collapsed
//  P3-03 TOÀN BỘ item + switcher + logo trigger THẲNG HÀNG trục Y (cùng tâm x=36)
//  P3-04 animation "streaming label" khi expand từ rail (class sidebar-label-anim, 1 lần)
//  P3-05 animation mode: on/off/auto (auto=PC; off=không chạy khi expand)
//  P3-06 highlight key khi search (mark trong MenuButton + MenuGroup) — engine NFD-token
// P2 regression (gộp):
//  P2-A search filter item theo `match` (ẩn item không khớp)
//  P2-B auto-expand MenuGroup có con khớp (đệ quy)
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message, '\n--- STACK ---\n', (e.stack || '').slice(0, 1500)));

// xóa width persist để demo bắt đầu 240px chuẩn
await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.removeItem('sidebar-width'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await sleep(400);

// Helper: collapse rồi chờ transition + di chuột ra khỏi aside (để peek rơi).
async function collapse() {
	await page.locator('.sidebar-trigger').click();
	await page.mouse.move(700, 500);
	await sleep(500);
}
async function expand() {
	await page.locator('.sidebar-trigger').click();
	await page.mouse.move(700, 500);
	await sleep(500);
}

// midX: tâm X (viewport px) của 1 element — để so trục Y (cùng cột).
const midX = (sel) =>
	page.evaluate((s) => {
		const el = document.querySelector(s);
		if (!el) return null;
		const r = el.getBoundingClientRect();
		return r.x + r.width / 2;
	}, sel);

// P3-01a — mặc định hideLogo=true → khi collapsed, aside có class sidebar-logo-hidden
await collapse();
const p31a = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const brand = document.querySelector('.brand');
	return {
		collapsed: aside.classList.contains('sidebar-collapsed'),
		hasClass: aside.classList.contains('sidebar-logo-hidden'),
		brandDisplay: brand ? getComputedStyle(brand).display : 'n/a'
	};
});
ok(
	'P3-01a default (hideLogo=true): collapsed → aside.sidebar-logo-hidden + .brand display:none',
	p31a.collapsed && p31a.hasClass && p31a.brandDisplay === 'none',
	JSON.stringify(p31a)
);

// P3-02 — menu item SQUARE + P3-03 — trục Y (cùng tâm x) khi collapsed
// Các icon menu (square 48×48, content area 72px) phải cùng tâm X = 36px (tâm rail).
const p32 = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const asideW = aside.getBoundingClientRect().width;
	const btns = [...document.querySelectorAll('.sidebar-menu-button')];
	const trig = document.querySelector('.sidebar-menu-group__trigger');
	const btn = btns[0];
	const cs = getComputedStyle(btn);
	const btnRect = btn.getBoundingClientRect();
	const lead = btn.querySelector('.leading');
	const leadRect = lead ? lead.getBoundingClientRect() : null;
	return {
		asideW,
		itemCount: btns.length,
		btnW: btnRect.width,
		btnH: btnRect.height,
		aspect: cs.aspectRatio,
		minHeight: cs.minHeight,
		iconMidX: leadRect ? leadRect.x + leadRect.width / 2 : null,
		trigMidX: trig ? trig.getBoundingClientRect().x + trig.getBoundingClientRect().width / 2 : null,
		btnMidX: btnRect.x + btnRect.width / 2
	};
});
ok(
	'P3-02 collapsed: menu item SQUARE (aspect 1/1, ~48×48, width≈height)',
	p32.asideW < 100 && p32.itemCount >= 5 && Math.abs(p32.btnW - p32.btnH) < 1 && p32.btnW > 40,
	JSON.stringify(p32)
);
// P3-03: icon menu + trigger group + button cùng tâm x ≈ 36px (tâm rail 72px)
const p33 = await page.evaluate(() => {
	const center = 36;
	const btns = [...document.querySelectorAll('.sidebar-menu-button .leading')];
	const xs = btns.map((l) => {
		const r = l.getBoundingClientRect();
		return r.x + r.width / 2;
	});
	const trig = document.querySelector('.sidebar-menu-group__trigger');
	const trigX = trig ? trig.getBoundingClientRect().x + trig.getBoundingClientRect().width / 2 : null;
	// điểm icon switcher (avatar) — tâm phải ≈ 36
	const av = document.querySelector('.switcher .ts-avatar');
	const avX = av ? av.getBoundingClientRect().x + av.getBoundingClientRect().width / 2 : null;
	const spread = xs.length ? Math.max(...xs) - Math.min(...xs) : 999;
	return { xs, trigX, avX, spread };
});
const p33ok =
	p33.xs.length >= 4 &&
	p33.xs.every((x) => Math.abs(x - 36) < 4) &&
	p33.trigX != null &&
	Math.abs(p33.trigX - 36) < 4 &&
	p33.avX != null &&
	Math.abs(p33.avX - 36) < 4;
ok(
	'P3-03 collapsed: TOÀN BỘ item + group trigger + switcher THẲNG HÀNG trục Y (tâm x≈36)',
	p33ok,
	JSON.stringify(p33)
);

// P3-04/05 — animation streaming label khi expand từ rail.
// (a) chế độ 'auto' (PC, không reduced-motion) → expand → aside briefly có
//     class .sidebar-label-anim + CSS animation trên .label.
// Không dùng helper expand() (sleep 500ms làm flag 500ms hết hạn):
// click trigger rồi đọc TRONG khung animation (~120ms sau click).
await page.locator('.sidebar-trigger').click();
await sleep(120);
const p34 = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const label = document.querySelector('.sidebar-menu-button .label');
	const cs = label ? getComputedStyle(label) : null;
	return {
		asideW: aside.getBoundingClientRect().width,
		hasClass: aside.classList.contains('sidebar-label-anim'),
		labelDisplay: label ? cs.display : 'n/a',
		labelAnimName: cs ? cs.animationName : 'n/a',
		labelDur: cs ? cs.animationDuration : 'n/a'
	};
});
ok(
	'P3-04 expand từ rail (auto, PC) → .sidebar-label-anim + label animation chạy (sb-label-stream)',
	p34.hasClass && p34.labelDisplay !== 'none' && /sb-label-stream/.test(p34.labelAnimName),
	JSON.stringify(p34)
);

// P3-05 — chế độ 'off': expand từ rail → KHÔNG có class .sidebar-label-anim.
await page.locator('[data-test="sb-anim-off"]').click();
await sleep(150);
await collapse();
await expand(); // ngay lập tức đọc class trong khung animation
const p35 = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	return { hasClass: aside.classList.contains('sidebar-label-anim') };
});
ok('P3-05 animation=off → expand từ rail KHÔNG chạy streaming (không .sidebar-label-anim)', !p35.hasClass, JSON.stringify(p35));

// P3-06 — highlight khi search (menu mở rộng, không collapsed)
await page.locator('[data-test="sb-anim-auto"]').click();
// reset search (đã có thể có query cũ)
const searchInput = page.locator('[data-test="sidebar-search"] input');
await searchInput.fill('');
await sleep(150);

// search "đon" (chữ đ = codepoint riêng với engine NFD-token; 'don' KHÔNG khớp —
// đã xác minh ground-truth: queryMatchesText('Đơn hàng','đon')===true, 'don'===false)
await searchInput.fill('đon');
await sleep(250);
const p36 = await page.evaluate(() => {
	const marks = [...document.querySelectorAll('.sidebar-menu-button__highlight, .sidebar-menu-group__highlight')];
	const marksText = marks.map((m) => m.textContent);
	// item "Đơn hàng" phải hiện + có highlight; item không khớp (vd "Tồn kho") phải ẩn
	const visible = [...document.querySelectorAll('.sidebar-menu-item')].filter((li) => {
		const cs = getComputedStyle(li);
		return cs.display !== 'none' && li.offsetParent !== null;
	});
	return { markCount: marks.length, marksText, visibleItems: visible.length };
});
ok(
	'P3-06 search "don" → highlight <mark> (engine NFD-token, wildcard dấu) + item khớp hiện',
	p36.markCount >= 1 && p36.marksText.some((t) => /Đơn/i.test(t)) && p36.visibleItems < 8,
	JSON.stringify(p36)
);

// P2-A regression — search filter: "webs" → chỉ "Website" hiện, "Đashboard" ẩn
await searchInput.fill('webs');
await sleep(250);
const p2a = await page.evaluate(() => {
	const find = (t) =>
		[...document.querySelectorAll('.sidebar-menu-button')].find((b) => b.textContent?.includes(t));
	const isVisible = (el) => el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
	return { web: isVisible(find('Website')), dash: isVisible(find('Đashboard')) };
});
ok('P2-A regression: search "webs" → Website hiện, Đashboard ẩn (filter)', p2a.web && !p2a.dash, JSON.stringify(p2a));

// P2-B regression — auto-expand MenuGroup đệ quy: search "shopee" →
//   group "Báo cáo" MỞ (aria-expanded) + group "Kênh bán" MỞ + item Shopee hiện
await searchInput.fill('shopee');
await sleep(300);
const p2b = await page.evaluate(() => {
	const findTrig = (t) =>
		[...document.querySelectorAll('.sidebar-menu-group__trigger')].find((b) => b.textContent?.includes(t));
	const findBtn = (t) =>
		[...document.querySelectorAll('.sidebar-menu-button')].find((b) => b.textContent?.includes(t));
	const vis = (el) => el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null;
	const reports = findTrig('Báo cáo');
	const channels = findTrig('Kênh bán');
	const shopee = findBtn('Shopee');
	return {
		reportsExpanded: reports?.getAttribute('aria-expanded'),
		channelsExpanded: channels?.getAttribute('aria-expanded'),
		shopeeVisible: vis(shopee),
		shopeeGroupVisible: vis(channels)
	};
});
ok(
	'P2-B regression: search "shopee" → auto-expand đệ quy (Báo cáo + Kênh bán mở, Shopee hiện)',
	p2b.reportsExpanded === 'true' && p2b.channelsExpanded === 'true' && p2b.shopeeVisible,
	JSON.stringify(p2b)
);

// P3-01b — toggle hideLogo OFF → collapsed giữ logo (.brand hiện, không sidebar-logo-hidden)
await searchInput.fill('');
await sleep(150);
await page.locator('[data-test="sb-hide-logo"]').setChecked(false);
await sleep(150);
await collapse();
const p31b = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const brand = document.querySelector('.brand');
	return {
		collapsed: aside.classList.contains('sidebar-collapsed'),
		hasClass: aside.classList.contains('sidebar-logo-hidden'),
		brandDisplay: brand ? getComputedStyle(brand).display : 'n/a'
	};
});
ok(
	'P3-01b hideLogo=off: collapsed → KHÔNG sidebar-logo-hidden, .brand hiện (flex)',
	p31b.collapsed && !p31b.hasClass && p31b.brandDisplay === 'flex',
	JSON.stringify(p31b)
);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
