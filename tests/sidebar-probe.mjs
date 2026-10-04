// tests/sidebar-probe.mjs
// Verify Sidebar family + Breadcrumb + Separator (shadcn sidebar-07).
// Trang demo: /ui/sidebar (Sidebar.Provider + aside + Inset + Breadcrumb).
//
// Kiểm tra:
//  SB0 trang hiển thị (.sidebar-aside + .sidebar-inset)
//  SB1 Provider context: trigger tồn tại trong header
//  SB2 brand + groups + menu items render (leading/label/badge)
//  SB3 active item: aria-current="page" + class .active (Đashboard)
//  SB4 disabled item: .disabled + pointer-events none
//  SB5 trigger toggle: bấm trigger (desktop icon) → aside collapse (width 72px, class sidebar-collapsed)
//  SB6 trigger toggle lại → mở (width 240px)
//  SB7 Breadcrumb auto: /ui/sidebar → 3 hạng, item cuối aria-current="page" không link
//  SB8 Breadcrumb custom: item external (https) target=_blank
//  SB9 Separator horizontal/vertical + disabled
//  SB10 footer user render
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
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sidebar-aside', { timeout: 20000 });
await sleep(400);

// SB0 — structure
const structure = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const inset = document.querySelector('.sidebar-inset');
	const provider = document.querySelector('.sidebar-provider');
	return {
		aside: !!aside,
		inset: !!inset,
		provider: !!provider,
		asideSticky: aside ? getComputedStyle(aside).position : ''
	};
});
ok('SB0 Sidebar structure (aside + inset + provider)', structure.aside && structure.inset && structure.provider, JSON.stringify(structure));
ok('SB0 aside is sticky', structure.asideSticky === 'sticky', structure.asideSticky);

// SB1 — trigger in header
const trigger = await page.evaluate(() => {
	const btn = document.querySelector('.sidebar-trigger');
	return { found: !!btn, role: btn?.getAttribute('role'), ariaLabel: btn?.getAttribute('aria-label') };
});
ok('SB1 SidebarTrigger present (button)', trigger.found, JSON.stringify(trigger));

// SB2 — brand, groups, menu items, badge
const content = await page.evaluate(() => {
	const brand = document.querySelector('.brand');
	const groups = document.querySelectorAll('.sidebar-group');
	const groupLabels = [...document.querySelectorAll('.sidebar-group-label')].map((e) => e.textContent.trim());
	const items = document.querySelectorAll('.sidebar-menu-button');
	const active = document.querySelector('.sidebar-menu-button.active');
	const badge = document.querySelector('.sidebar-menu-badge');
	const leadingIcons = document.querySelectorAll('.sidebar-menu-button .leading');
	return {
		brand: brand ? brand.textContent.trim() : '',
		groups: groups.length,
		groupLabels,
		items: items.length,
		hasActive: !!active,
		activeText: active?.querySelector('.label')?.textContent.trim(),
		badge: badge ? badge.textContent.trim() : null,
		leading: leadingIcons.length
	};
});
ok('SB2 brand renders', content.brand.includes('RetailApp'), content.brand);
ok('SB2 2 groups with labels', content.groups === 2, JSON.stringify(content.groupLabels));
ok('SB2 5 menu items with leading icons', content.items === 5 && content.leading >= 5, `items=${content.items} leading=${content.leading}`);
ok('SB2 badge "12" on Đơn hàng', content.badge === '12', String(content.badge));

// SB3 — active item
ok('SB3 active item = Đashboard (aria-current + .active)', content.hasActive && content.activeText === 'Đashboard', JSON.stringify({ hasActive: content.hasActive, text: content.activeText }));
const activeAria = await page.evaluate(() => document.querySelector('.sidebar-menu-button.active')?.getAttribute('aria-current'));
ok('SB3 active has aria-current="page"', activeAria === 'page', String(activeAria));

// SB4 — disabled item
const disabled = await page.evaluate(() => {
	const el = document.querySelector('.sidebar-menu-button.disabled');
	if (!el) return { found: false };
	return { found: true, pointerEvents: getComputedStyle(el).pointerEvents, isButton: el.tagName === 'BUTTON', disabledAttr: el.getAttribute('disabled') };
});
ok('SB4 disabled item has .disabled + not-allowed', disabled.found && disabled.pointerEvents === 'none', JSON.stringify(disabled));

// SB5/6 — trigger toggle (desktop icon collapsible)
const widthBefore = await page.evaluate(() => document.querySelector('.sidebar-aside').getBoundingClientRect().width);
const triggerBtn = await page.$('.sidebar-trigger');
await triggerBtn.click();
// Sau click, chuột "nằm" trên trigger (trong sidebar) → CSS :hover peek giữ
// sidebar mở 240px (đúng design: hover sidebar collapsed → peek). Di chuột
// ra vùng content để peek rơi, về đúng width collapsed 72px trước khi assert.
await page.mouse.move(600, 400);
await sleep(450); // chờ transition 300ms
const afterToggle = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	return { width: aside.getBoundingClientRect().width, collapsed: aside.classList.contains('sidebar-collapsed') };
});
ok('SB5 trigger collapses to rail (~72px) + .sidebar-collapsed', afterToggle.collapsed && afterToggle.width < 100, JSON.stringify({ widthBefore, after: afterToggle }));

// label ẩn khi collapsed
const labelHiddenWhenCollapsed = await page.evaluate(() => {
	const label = document.querySelector('.sidebar-menu-button .label');
	return label ? getComputedStyle(label).display === 'none' : false;
});
ok('SB5 labels hidden when collapsed', labelHiddenWhenCollapsed === true);

// expand lại
await triggerBtn.click();
await sleep(450);
const afterExpand = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	return { width: aside.getBoundingClientRect().width, collapsed: aside.classList.contains('sidebar-collapsed') };
});
ok('SB6 trigger expands back (~240px) + no .sidebar-collapsed', !afterExpand.collapsed && afterExpand.width > 200, JSON.stringify({ after: afterExpand }));

// SB7 — Breadcrumb auto (từ /ui/sidebar)
const bcAuto = await page.evaluate(() => {
	// Breadcrumb auto = breadcrumb đầu tiên trong .sidebar-inset (trên .inset-header)
	const bc = document.querySelector('.sidebar-inset .breadcrumb-root');
	if (!bc) return { found: false };
	const items = [...bc.querySelectorAll('.breadcrumb-item')];
	const current = bc.querySelector('.breadcrumb-item--current');
	const currentLabel = current?.textContent.trim();
	const currentIsLink = current?.querySelector('a');
	return {
		found: true,
		count: items.length,
		currentLabel,
		currentIsLink: !!currentIsLink,
		currentAria: current?.getAttribute('aria-current')
	};
});
ok('SB7 Breadcrumb auto: 3 hạng (Home › UI › Sidebar)', bcAuto.found && bcAuto.count === 3, JSON.stringify(bcAuto));
ok('SB7 current "Sidebar" aria-current, not a link', bcAuto.currentLabel === 'Sidebar' && !bcAuto.currentIsLink && bcAuto.currentAria === 'page', JSON.stringify({ label: bcAuto.currentLabel, link: bcAuto.currentIsLink, aria: bcAuto.currentAria }));

// SB8 — Breadcrumb custom (external link)
const bcCustom = await page.evaluate(() => {
	// Breadcrumb custom (items truyền sẵn, có external link) = .breadcrumb-root thứ 3
	// (1: group trong sidebar content, 2: auto trong inset-header, 3: custom trong .demo-block)
	const all = document.querySelectorAll('.breadcrumb-root');
	const bc = all[all.length - 1];
	if (!bc) return { found: false };
	const ext = bc.querySelector('a[href^="https"]');
	return {
		found: true,
		extFound: !!ext,
		target: ext?.getAttribute('target'),
		rel: ext?.getAttribute('rel')
	};
});
ok('SB8 external item target=_blank + rel=noopener', bcCustom.found && bcCustom.extFound && bcCustom.target === '_blank' && /noopener/.test(bcCustom.rel || ''), JSON.stringify(bcCustom));

// SB9 — Separator (horizontal/vertical/disabled)
const sep = await page.evaluate(() => {
	const all = document.querySelectorAll('.separator-root');
	const vertical = all.length ? [...all].some((s) => s.classList.contains('vertical')) : false;
	const horizontal = all.length ? [...all].some((s) => s.classList.contains('horizontal')) : false;
	return { count: all.length, hasVertical: vertical, hasHorizontal: horizontal };
});
// Demo separator nằm ở trang /ui/separator; ở đây kiểm tra trong sidebar demo
ok('SB9 Separator renders in sidebar (decorative)', sep.count >= 1, JSON.stringify(sep));

// SB11 — SidebarRail: sidebar MỞ → rail ẩn (visibility hidden + pointer-events none)
const rail1 = await page.evaluate(() => {
	const rail = document.querySelector('[data-sb-rail]');
	if (!rail) return { found: false };
	const cs = getComputedStyle(rail);
	return { found: true, visibility: cs.visibility, pointerEvents: cs.pointerEvents, tag: rail.tagName, tabindex: rail.getAttribute('tabindex') };
});
ok('SB11 rail present, hidden when sidebar open (visibility hidden)', rail1.found && rail1.tag === 'BUTTON' && rail1.visibility === 'hidden', JSON.stringify(rail1));

// SB12 — collapse bằng trigger → rail hiện
await triggerBtn.click();
await sleep(450);
const rail2 = await page.evaluate(() => {
	const rail = document.querySelector('[data-sb-rail]');
	if (!rail) return { found: false };
	const cs = getComputedStyle(rail);
	const aside = document.querySelector('.sidebar-aside');
	return { found: true, visibility: cs.visibility, pointerEvents: cs.pointerEvents, asideWidth: aside.getBoundingClientRect().width };
});
ok('SB12 collapsed → rail visible (visibility visible)', rail2.found && rail2.visibility === 'visible', JSON.stringify(rail2));

// SB13 — hover rail (→ hover aside) → peek: aside mở rộng tạm + labels hiện lại.
// Peek giờ là CSS :hover trên .sidebar-aside (không qua class .sidebar-peek).
await page.evaluate(() => {
	const rail = document.querySelector('[data-sb-rail]');
	const r = rail.getBoundingClientRect();
	// điểm giữa rail (nửa lòi ra ngoài content) — nằm trong box aside (mở rộng)
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}).then(async (pt) => {
	await page.mouse.move(pt.x, pt.y);
});
await sleep(450); // transition 300ms
const peek = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const label = document.querySelector('.sidebar-menu-button .label');
	return {
		width: aside.getBoundingClientRect().width,
		collapsed: aside.classList.contains('sidebar-collapsed'),
		labelDisplay: label ? getComputedStyle(label).display : 'n/a'
	};
});
ok('SB13 hover rail → peek: aside mở rộng (~240px) + labels hiện', peek.collapsed && peek.width > 200 && peek.labelDisplay !== 'none', JSON.stringify(peek));

// SB14 — chuột rời aside → thu về rail (72px, labels ẩn)
await page.mouse.move(600, 400);
await sleep(450);
const unpeek = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const label = document.querySelector('.sidebar-menu-button .label');
	return {
		width: aside.getBoundingClientRect().width,
		labelDisplay: label ? getComputedStyle(label).display : 'n/a'
	};
});
ok('SB14 chuột rời rail → thu về collapsed (72px, labels ẩn)', unpeek.width < 100 && unpeek.labelDisplay === 'none', JSON.stringify(unpeek));

// SB15 — click rail → expand (không còn collapsed)
const railEl = await page.$('[data-sb-rail]');
await railEl.click({ force: true });
await sleep(450);
const railToggled = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	return { width: aside.getBoundingClientRect().width, collapsed: aside.classList.contains('sidebar-collapsed') };
});
ok('SB15 click rail → sidebar mở (240px, không collapsed)', !railToggled.collapsed && railToggled.width > 200, JSON.stringify(railToggled));

// SB10 — footer user
const footer = await page.evaluate(() => {
	const name = document.querySelector('.sidebar-footer .footer-name');
	const avatar = document.querySelector('.sidebar-footer .footer-avatar');
	return { name: name?.textContent.trim(), avatar: !!avatar };
});
ok('SB10 footer user (name + avatar)', footer.name === 'User' && footer.avatar, JSON.stringify(footer));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
