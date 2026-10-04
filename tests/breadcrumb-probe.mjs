// tests/breadcrumb-probe.mjs
// Verify Breadcrumb P2 (demo /ui/breadcrumb):
//  BC0 trang hiển thị + nav breadcrumb
//  BC1 auto-derive từ URL: 3 hạng (Home › UI › Breadcrumb)
//  BC2 item current: aria-current="page", KHÔNG phải link + có separator TRƯỚC (fix bug P1)
//  BC3 item có icon (iconify → svg)
//  BC4 description → Tooltip (hover → .tooltip-content hiện trong body)
//  BC5 separator string global ('/')
//  BC6 separator per-item (snippet icon chevron) ghi đè global
//  BC7 ellipsis: maxItems → nút "…", bấm mở menu, item giữa hiện trong dropdown
//  BC8 item external target=_blank rel=noopener
//  BC9 nav aria-label mặc định "Breadcrumb"
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

await page.goto('https://localhost:3000/ui/breadcrumb', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.breadcrumb-root', { timeout: 20000 });
await sleep(500);

// BC0 — structure
const bc0 = await page.evaluate(() => {
	const nav = document.querySelector('nav.breadcrumb-root');
	return { nav: !!nav, list: !!document.querySelector('.breadcrumb-list') };
});
ok('BC0 nav breadcrumb + list', bc0.nav && bc0.list, JSON.stringify(bc0));

// BC9 — default aria-label
const bc9 = await page.evaluate(() => document.querySelector('nav.breadcrumb-root')?.getAttribute('aria-label'));
ok('BC9 nav aria-label mặc định "Breadcrumb"', bc9 === 'Breadcrumb', bc9);

// BC1 + BC2 — auto-derive 3 hạng, current item (BC2a: 3 hạng; BC2b: separator trước current; BC2c: current không link)
const auto = await page.evaluate(() => {
	const nav = document.querySelector('nav.breadcrumb-root');
	const items = [...nav.querySelectorAll('.breadcrumb-item')];
	const current = items[items.length - 1];
	// separator TRƯỚC current = phần tử con đầu tiên của li current có class breadcrumb-sep
	const sepBeforeCurrent = current ? current.querySelector(':scope > .breadcrumb-sep') : null;
	const currentLink = current ? current.querySelector('a') : null;
	return {
		count: items.length,
		currentLabel: current ? current.textContent.trim() : '',
		aria: current?.getAttribute('aria-current'),
		sepBeforeCurrent: !!sepBeforeCurrent,
		sepCount: nav.querySelectorAll('.breadcrumb-sep').length,
		currentIsLink: !!currentLink,
		currentIsSpan: !!current.querySelector('.breadcrumb-label')
	};
});
ok('BC1 auto-derive 3 hạng', auto.count === 3, JSON.stringify(auto));
ok('BC2 current = "Breadcrumb" aria-current=page, không link', auto.currentLabel === 'Breadcrumb' && auto.aria === 'page' && !auto.currentIsLink && auto.currentIsSpan);
ok('BC2 FIX: separator render TRƯỚC item current', auto.sepBeforeCurrent && auto.sepCount === auto.count - 1, `sepBeforeCurrent=${auto.sepBeforeCurrent} sepCount=${auto.sepCount}/${auto.count - 1}`);

// BC3 — icon (section bc-icon: item có icon iconify → <svg> trong .breadcrumb-item-icon).
// Iconify fetch data async → chờ svg render (tối đa 8s).
await page.waitForSelector('[data-test="bc-icon"] .breadcrumb-item-icon svg', { timeout: 8000 });
const icon = await page.evaluate(() => {
	const sec = document.querySelector('[data-test="bc-icon"]');
	return {
		roots: sec.querySelectorAll('.breadcrumb-item-icon').length,
		svgs: sec.querySelectorAll('.breadcrumb-item-icon svg').length
	};
});
ok('BC3 items có icon (iconify → svg)', icon.roots >= 3 && icon.svgs >= 3, JSON.stringify(icon));

// BC4 — description → Tooltip: hover item "Dự án" (có description) → .tooltip-content hiện trong body
const bc4 = await (async () => {
	const sec = page.locator('[data-test="bc-icon"]');
	const proj = sec.locator('.breadcrumb-link', { hasText: 'Dự án' });
	await proj.hover();
	await sleep(700); // delay tooltip
	const content = await page.evaluate(() => {
		const c = document.querySelector('.tooltip-content');
		return { found: !!c, text: c ? c.textContent.trim() : '', inBody: c ? c.parentElement === document.body : false };
	});
	return content;
})();
ok('BC4 description → Tooltip hover', bc4.found && bc4.text.includes('dự án'), JSON.stringify(bc4));

// BC5 — separator string global '/' (section bc-sep, Breadcrumb thứ nhất)
const sep5 = await page.evaluate(() => {
	const sec = document.querySelector('[data-test="bc-separator"]');
	const first = sec.querySelector('.breadcrumb-root');
	const textSeps = [...first.querySelectorAll('.breadcrumb-sep--text')].map((e) => e.textContent.trim());
	return { textSeps };
});
ok('BC5 separator string global "/"', sep5.textSeps.every((s) => s === '/') && sep5.textSeps.length >= 2, JSON.stringify(sep5));

// BC6 — separator per-item (item "Hồ sơ" chevron icon, các item khác "→").
// Chevron là Icon iconify (async) → chờ svg render.
await page.waitForSelector('[data-test="bc-separator"] .bc-cust-sep svg', { timeout: 8000 });
const sep6 = await page.evaluate(() => {
	const sec = document.querySelector('[data-test="bc-separator"]');
	const roots = sec.querySelectorAll('.breadcrumb-root');
	const second = roots[roots.length - 1];
	const items = [...second.querySelectorAll('.breadcrumb-item')];
	// item "Hồ sơ" = index 1 → separator của nó là chevron icon (svg trong .breadcrumb-sep), không phải text
	const profileSep = items[1]?.querySelector(':scope > .breadcrumb-sep');
	const hasSvg = !!profileSep?.querySelector('svg');
	const textSeps = [...second.querySelectorAll('.breadcrumb-sep--text')].map((e) => e.textContent.trim());
	return { profileSepSvg: hasSvg, textSeps };
});
ok('BC6 separator per-item chevron icon (ghi đè global "→")', sep6.profileSepSvg && sep6.textSeps.includes('→'), JSON.stringify(sep6));

// BC7 — ellipsis: section bc-ellipsis, maxItems=3 → 7 hạng.
// maxItems không đếm "…": giữ item đầu + (maxItems-1)=2 item cuối → DOM = 1 + 1 "…" + 2 = 4 entry.
const bc7 = await (async () => {
	const sec = page.locator('[data-test="bc-ellipsis"]');
	const items = sec.locator('.breadcrumb-item');
	const count = await items.count();
	const trig = sec.locator('.breadcrumb-ellipsis-trigger');
	const trigFound = (await trig.count()) === 1;
	// số item DOM: 1 đầu + 1 "…" + 2 cuối = 4 (hạng "…" gộp 4 hạng giữa)
	const hasEllipsis = trigFound;
	// bấm mở menu
	if (trigFound) {
		await trig.click();
		await sleep(300);
	}
	const menu = await page.evaluate(() => {
		const content = document.querySelector('.dropdown-menu-content');
		const menuItems = content ? [...content.querySelectorAll('[data-dm-item]')].map((e) => e.textContent.trim()) : [];
		return { contentFound: !!content, menuItems };
	});
	return { visibleCount: count, hasEllipsis, menu };
})();
ok('BC7 ellipsis: nút "…" thay 4 hạng giữa (DOM = 4 entry)', bc7.hasEllipsis && bc7.visibleCount === 4, JSON.stringify({ n: bc7.visibleCount, hasEllipsis: bc7.hasEllipsis }));
ok('BC7 menu "…" chứa hạng trung gian (Khu vực..Lượt chạy)', bc7.menu.contentFound && bc7.menu.menuItems.length === 4, JSON.stringify(bc7.menu.menuItems));

// BC8 — external link (section bc-custom, item "API" https)
const bc8 = await page.evaluate(() => {
	const sec = document.querySelector('[data-test="bc-custom"]');
	const link = [...sec.querySelectorAll('a')].find((a) => a.textContent.trim() === 'API');
	return { found: !!link, target: link?.getAttribute('target'), rel: link?.getAttribute('rel') };
});
ok('BC8 external target=_blank rel=noopener', bc8.found && bc8.target === '_blank' && (bc8.rel ?? '').includes('noopener'), JSON.stringify(bc8));

// ---- Screenshots (cho ui-checker) ----
import { mkdirSync } from 'node:fs';
const shotDir = 'tests/screenshot/breadcrumb';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="breadcrumb-demo"] section.demo').nth(0).screenshot({ path: `${shotDir}/01-auto.png` });
await page.locator('[data-test="bc-icon"]').screenshot({ path: `${shotDir}/02-icon-description.png` });
await page.locator('[data-test="bc-separator"]').screenshot({ path: `${shotDir}/03-separator.png` });
await page.locator('[data-test="bc-ellipsis"]').screenshot({ path: `${shotDir}/04-ellipsis.png` });

// ---- Tổng kết ----
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed`);
await browser.close();
process.exit(passed === results.length ? 0 : 1);
