// sidebar-collapsed-grid-probe.mjs
// Functional probe cho task "B2 — Sidebar collapsed: header 2-row căn đúng lưới 56px".
// Trước fix: SidebarHeader giữ padding-block 1rem + gap 4px khi collapsed →
// header 96-108px, tâm brand-row 28-34 / trigger-row 62-74 KHÔNG rơi lưới tâm
// item menu (item đầu collapsed cao 55px, tâm cách đầu content 28px).
// Sau fix: header padding-block 0 + gap 0 + 2 row min-height 56px → header 112,
// tâm brand 28 / trigger 84 khớp lưới 56px. Peek (hover) reset về 1 row ngang.
// SB1-SB3: /admin (cần login). SB4: peek. SB5: expanded regression.
// Chạy: node tests/sidebar-collapsed-grid-probe.mjs (dev server https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
	await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
	await sleep(500);
	await page.locator('.auth-input-wrapper input').first().fill('admin');
	await sleep(300);
	await page.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
	await sleep(500);
	await page.locator('.auth-btn-submit').first().click();
	await page.waitForURL((u) => !u.toString().includes('/login'), { waitUntil: 'domcontentloaded', timeout: 20000 });
	await sleep(1000);
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => {
	pageErrors.push(e.message);
	console.log('PAGEERROR:', e.message);
});

await login(page);
await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(1500);

// Collapse qua trigger-row (desktop)
await page.locator('[data-test="admin-trigger-row"] button').first().click();
await page.mouse.move(700, 400);
await sleep(600);

// Đo trong aside (toạ độ tương đối theo aside)
const measure = () =>
	page.evaluate(() => {
		const aside = document.querySelector('.sidebar-aside');
		if (!aside) return null;
		const ar = aside.getBoundingClientRect();
		const header = aside.querySelector('.sidebar-header');
		const hr = header?.getBoundingClientRect();
		const brandRow = aside.querySelector('[data-test="admin-brand-row"], [data-test="sb-brand-row"]');
		const triggerRow = aside.querySelector('[data-test="admin-trigger-row"], [data-test="sb-trigger-row"]');
		const br = brandRow?.getBoundingClientRect();
		const tr = triggerRow?.getBoundingClientRect();
		const firstItem = aside.querySelector('.sidebar-menu-button, .sidebar-menu-group__trigger');
		const ir = firstItem?.getBoundingClientRect();
		return {
			header: hr ? { top: +(hr.top - ar.top).toFixed(1), h: Math.round(hr.height) } : null,
			brand: br ? { centerY: +(br.top - ar.top + br.height / 2).toFixed(1) } : null,
			trigger: tr ? { centerY: +(tr.top - ar.top + tr.height / 2).toFixed(1) } : null,
			firstItem: ir ? { centerY: +(ir.top - ar.top + ir.height / 2).toFixed(1) } : null
		};
	});

console.log('\n=== SB1-SB3: COLLAPSED LƯỚI 56PX (ADMIN) ===');
const m = await measure();
ok('SB2: header offsetHeight ≈112±2', m?.header?.h != null && Math.abs(m.header.h - 112) <= 2, JSON.stringify(m?.header));
ok('SB1: tâm brand-row ≈28±2 (trong aside)', m?.brand != null && Math.abs(m.brand.centerY - 28) <= 2, String(m?.brand?.centerY));
ok('SB1: tâm trigger-row ≈84±2 (trong aside)', m?.trigger != null && Math.abs(m.trigger.centerY - 84) <= 2, String(m?.trigger?.centerY));
ok(
	'SB3: tâm trigger-row lệch tâm brand-row đúng 56 (2 ô lưới liền)',
	m?.brand != null && m?.trigger != null && Math.abs(m.trigger.centerY - m.brand.centerY - 56) <= 2,
	`${m?.brand?.centerY} → ${m?.trigger?.centerY}`
);

// Không có switcher giữa header và menu (admin) → item đầu = header + 28
ok(
	'SB3b: item menu đầu cách mép trên content = 28 (header 112 + content pad 4)',
	m?.firstItem != null && Math.abs(m.firstItem.centerY - 144) <= 3,
	`firstItem.centerY=${m?.firstItem?.centerY}`
);

console.log('\n=== SB4: PEEK HOVER — HEADER VỀ 1 ROW NGANG, KHÔNG CHỒNG ===');
const asideBox = await page.locator('.sidebar-aside').boundingBox();
await page.mouse.move(asideBox.x + 28, asideBox.y + 30);
await sleep(700);
const peek = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const ar = aside.getBoundingClientRect();
	const header = aside.querySelector('.sidebar-header');
	const hr = header?.getBoundingClientRect();
	const br = aside.querySelector('[data-test="admin-brand-row"], [data-test="sb-brand-row"]')?.getBoundingClientRect();
	const tr = aside.querySelector('[data-test="admin-trigger-row"], [data-test="sb-trigger-row"]')?.getBoundingClientRect();
	return {
		expanded: ar.width > 100,
		headerH: hr ? Math.round(hr.height) : null,
		brandTop: br ? Math.round(br.top - ar.top) : null,
		triggerTop: tr ? Math.round(tr.top - ar.top) : null,
		sameRow: br && tr ? Math.abs(br.top - tr.top) < 2 : null,
		xOverlap: br && tr ? tr.left < br.right : null,
		xGap: br && tr ? Math.round(tr.left - br.right) : null
	};
});
ok('SB4: peek mở rộng (aside width > 100)', peek.expanded, `w>100=${peek.expanded}`);
ok('SB4: header peek 1 row (top brand = top trigger)', peek.sameRow === true, JSON.stringify({ brandTop: peek.brandTop, triggerTop: peek.triggerTop }));
ok('SB4: brand + trigger KHÔNG chồng X (gap ≥ 8)', peek.xOverlap === false && peek.xGap >= 8, `gap=${peek.xGap}`);
ok('SB4: header peek ≈68±3 (1 row 36 + padding 16×2)', peek.headerH != null && Math.abs(peek.headerH - 68) <= 3, String(peek.headerH));

// Rời hover → collapsed trở lại
await page.mouse.move(700, 400);
await sleep(600);

console.log('\n=== SB5: EXPANDED REGRESSION — HEADER 1 ROW NGANG (KHÔNG COLLAPSED) ===');
await page.locator('[data-test="admin-trigger-row"] button').first().click();
await page.mouse.move(700, 400);
await sleep(600);
const expanded = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const ar = aside.getBoundingClientRect();
	const header = aside.querySelector('.sidebar-header');
	const cs = header ? getComputedStyle(header) : null;
	const br = aside.querySelector('[data-test="admin-brand-row"], [data-test="sb-brand-row"]')?.getBoundingClientRect();
	const tr = aside.querySelector('[data-test="admin-trigger-row"], [data-test="sb-trigger-row"]')?.getBoundingClientRect();
	return {
		width: Math.round(ar.width),
		flexDir: cs?.flexDirection,
		padBlock: cs ? cs.paddingTop : null,
		brandTop: br ? Math.round(br.top - ar.top) : null,
		triggerTop: tr ? Math.round(tr.top - ar.top) : null,
		sameRow: br && tr ? Math.abs(br.top - tr.top) < 2 : null
	};
});
ok('SB5: expanded width 240', expanded.width === 240, String(expanded.width));
ok('SB5: expanded header padding-block giữ 1rem (16px)', expanded.padBlock === '16px', String(expanded.padBlock));
ok('SB5: expanded brand + trigger cùng row', expanded.sameRow === true, JSON.stringify({ brandTop: expanded.brandTop, triggerTop: expanded.triggerTop }));

// ── /ui/sidebar demo: same grid (collapsed, có switcher giữa header + menu) ──
console.log('\n=== SB6: DEMO /ui/sidebar — CÙNG LƯỚI 56PX (header) ===');
await page.goto(`${BASE}/ui/sidebar`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(1200);
await page.click('.sidebar-trigger');
await page.mouse.move(700, 400);
await sleep(600);
const demo = await page.evaluate(() => {
	const aside = document.querySelector('.sidebar-aside');
	const ar = aside.getBoundingClientRect();
	const header = aside.querySelector('.sidebar-header');
	const hr = header?.getBoundingClientRect();
	const br = aside.querySelector('[data-test="sb-brand-row"]')?.getBoundingClientRect();
	const tr = aside.querySelector('[data-test="sb-trigger-row"]')?.getBoundingClientRect();
	return {
		headerH: hr ? Math.round(hr.height) : null,
		brandCenterY: br ? +(br.top - ar.top + br.height / 2).toFixed(1) : null,
		triggerCenterY: tr ? +(tr.top - ar.top + tr.height / 2).toFixed(1) : null
	};
});
ok('SB6: demo header ≈112±2', demo.headerH != null && Math.abs(demo.headerH - 112) <= 2, String(demo.headerH));
ok('SB6: demo tâm brand ≈28±2', demo.brandCenterY != null && Math.abs(demo.brandCenterY - 28) <= 2, String(demo.brandCenterY));
ok('SB6: demo tâm trigger ≈84±2', demo.triggerCenterY != null && Math.abs(demo.triggerCenterY - 84) <= 2, String(demo.triggerCenterY));

// ── Screenshots ──
const shotDir = 'tests/screenshots/sidebar';
mkdirSync(shotDir, { recursive: true });
await page.locator('.sidebar-aside').screenshot({ path: `${shotDir}/sidebar-collapsed-grid.png` });
const box = await page.locator('.sidebar-aside').boundingBox();
await page.mouse.move(box.x + 28, box.y + 30);
await sleep(700);
await page.locator('.sidebar-aside').screenshot({ path: `${shotDir}/sidebar-collapsed-peek.png` });
await page.mouse.move(700, 400);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (pageErrors.length) console.log('PAGEERRORS:', pageErrors.length);
if (failed.length || pageErrors.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
