// tests/admin-layout-probe.mjs
// Probe B6.1 (Pha 3) — Admin layout sidebar:
//   L1. /admin render sidebar (aside) + brand TeamSwitcher "Kit Admin"
//   L2. Menu đủ 7 mục admin + Settings footer = 8 nút điều hướng
//   L3. Active item đúng route (/admin → "Người dùng" active, others không)
//   L4. Breadcrumb render: "Trang chủ" + "Người dùng"
//   L5. Navigate menu → /admin/brands: breadcrumb đổi "Thương hiệu", active đổi
//   L6. Inset chứa content trang (bảng/table của brands)
//   L7. Trigger collapse hoạt động (click → aside class sidebar-collapsed)
//   L8. 0 pageerror / 0 console error
import { chromium } from 'playwright';

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
	await sleep(400);
	await page.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
	await sleep(600);
	await page.locator('.auth-btn-submit').first().click();
	await page.waitForURL((u) => !u.toString().includes('/login'), {
		waitUntil: 'domcontentloaded',
		timeout: 20000
	});
	await sleep(1000);
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (msg) => {
	if (msg.type() === 'error') consoleErrors.push(msg.text());
});

await login(page);
await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(1500);

// ── L1: sidebar + brand ──
{
	const state = await page.evaluate(() => {
		const aside = document.querySelector('aside');
		const brand = document.querySelector('[data-test="admin-brand-row"]');
		return {
			hasAside: !!aside,
			brandText: brand ? brand.textContent.trim().slice(0, 40) : ''
		};
	});
	ok('L1 · Sidebar render + brand TeamSwitcher', state.hasAside && state.brandText.includes('Kit Admin'), JSON.stringify(state));
}

// ── L2: đủ 8 nút menu ──
{
	const navIds = [
		'admin-nav-products',
		'admin-nav-variants',
		'admin-nav-brands',
		'admin-nav-categories',
		'admin-nav-orders',
		'admin-nav-customers',
		'admin-nav-users',
		'admin-nav-settings'
	];
	const missing = [];
	for (const id of navIds) {
		if (!(await page.locator(`[data-test="${id}"]`).count())) missing.push(id);
	}
	ok('L2 · Menu đủ 7 mục admin + Settings', missing.length === 0, missing.length ? `thiếu: ${missing.join(', ')}` : '8/8');
}

// ── L3: active đúng route /admin ──
{
	const active = await page.evaluate(() => {
		const users = document.querySelector('[data-test="admin-nav-users"]');
		const brands = document.querySelector('[data-test="admin-nav-brands"]');
		return {
			usersActive: users?.getAttribute('data-active') === 'true' || users?.getAttribute('aria-current') === 'page',
			brandsActive: brands?.getAttribute('data-active') === 'true' || brands?.getAttribute('aria-current') === 'page'
		};
	});
	ok('L3 · Active item đúng (/admin → Users)', active.usersActive && !active.brandsActive, JSON.stringify(active));
}

// ── L4: breadcrumb ──
{
	const crumb = await page.evaluate(() => {
		const nav = document.querySelector('[data-test="admin-breadcrumb"]');
		return nav ? nav.textContent.replace(/\s+/g, ' ').trim() : '';
	});
	ok('L4 · Breadcrumb "Trang chủ > Người dùng"', crumb.includes('Trang chủ') && crumb.includes('Người dùng'), `"${crumb}"`);
}

// ── L5: navigate qua menu → brands ──
{
	await page.locator('[data-test="admin-nav-brands"]').click();
	await sleep(1200);
	const after = await page.evaluate(() => {
		const nav = document.querySelector('[data-test="admin-breadcrumb"]');
		const brands = document.querySelector('[data-test="admin-nav-brands"]');
		const users = document.querySelector('[data-test="admin-nav-users"]');
		return {
			url: location.pathname,
			crumb: nav ? nav.textContent.replace(/\s+/g, ' ').trim() : '',
			brandsActive: brands?.getAttribute('data-active') === 'true' || brands?.getAttribute('aria-current') === 'page',
			usersActive: users?.getAttribute('data-active') === 'true' || users?.getAttribute('aria-current') === 'page'
		};
	});
	ok(
		'L5 · Click menu brands → URL + breadcrumb + active đổi',
		after.url === '/admin/brands' && after.crumb.includes('Thương hiệu') && after.brandsActive && !after.usersActive,
		JSON.stringify({ url: after.url, crumb: after.crumb.slice(0, 50) })
	);
}

// ── L6: Inset chứa content trang — quay về /admin (Users) check bảng ──
// KHÔNG check bảng trên /admin/brands: page brands đang fetch GET /list trong
// khi endpoint chỉ nhận POST mã hoá (bug pre-existing, B6.2 migrate sẽ sửa —
// response shape cũng khác hẳn nên bảng không bao giờ render).
// Users list qua fetchSecure có thể chậm 6-8s (Couchbase Capella cold start)
// → POLL table xuất hiện (tối đa 20s), không sleep cứng.
{
	await page.locator('[data-test="admin-nav-users"]').click();
	let hasTable = false;
	let url = '';
	let crumb = '';
	// B6.2 brands page (775fd889) render loading skeleton <table> 20 row TRƯỚC khi
	// data về → hasTable=true ngay trên /admin/brands → poll thoát sớm sai.
	// FIX: poll yêu cầu CẢ url === '/admin' (không chỉ hasTable).
	let urlOk = false;
	for (let i = 0; i < 50 && !urlOk; i++) {
		const state = await page.evaluate(() => {
			const inset =
				document.querySelector('[data-test="admin-breadcrumb"]')?.closest('.sidebar-inset, main') ??
				document.body;
			const nav = document.querySelector('[data-test="admin-breadcrumb"]');
			return {
				hasTable: !!inset.querySelector('table, [role="table"]'),
				crumb: nav ? nav.textContent.replace(/\s+/g, ' ').trim() : '',
				url: location.pathname
			};
		});
		hasTable = state.hasTable;
		url = state.url;
		crumb = state.crumb;
		urlOk = hasTable && url === '/admin';
		if (!urlOk) await sleep(400);
	}
	ok(
		'L6 · Inset render bảng Users (/admin) + breadcrumb đổi lại',
		hasTable && url === '/admin' && crumb.includes('Người dùng'),
		JSON.stringify({ url, crumb: crumb.slice(0, 40) })
	);
}

// ── L7: Trigger collapse ──
{
	await page.locator('[data-test="admin-trigger-row"] button').first().click();
	await sleep(800);
	const collapsed = await page.evaluate(() => {
		const aside = document.querySelector('aside');
		return aside ? aside.className : '';
	});
	ok('L7 · Trigger collapse → aside collapsed', collapsed.includes('collapsed'), `class="${String(collapsed).slice(0, 60)}"`);
	// Expand lại ngay — nếu không, sang L9 (mobile) overlay đè mọi click.
	await page.locator('[data-test="admin-trigger-row"] button').first().click();
	await sleep(600);
}

// ── L9: Mobile 375 — offcanvas: nút trigger trong inset header mở overlay ──
{
	await page.setViewportSize({ width: 375, height: 700 });
	await sleep(800);
	const before = await page.evaluate(() => {
		const aside = document.querySelector('aside');
		return {
			asideClass: aside ? aside.className : '',
			mobileTriggerVisible:
				!!document.querySelector('.admin-mobile-trigger') &&
				getComputedStyle(document.querySelector('.admin-mobile-trigger')).display !== 'none'
		};
	});
	await page.locator('.admin-mobile-trigger button').first().click();
	await sleep(900);
	const after = await page.evaluate(() => {
		const aside = document.querySelector('aside');
		return { asideClass: aside ? aside.className : '' };
	});
	ok(
		'L9 · Mobile: trigger inset mở offcanvas (aside.sidebar-open)',
		before.mobileTriggerVisible &&
			before.asideClass.includes('sidebar-mobile') &&
			!before.asideClass.includes('sidebar-open') &&
			after.asideClass.includes('sidebar-open'),
		JSON.stringify({ before: before.asideClass.slice(0, 60), after: after.asideClass.slice(0, 60) })
	);
}

ok('L8 · 0 pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
// Loại known-bug pre-existing của pages catalog (fetch GET /list vs endpoint
// POST mã hoá — B6.2 sửa khi migrate): chỉ còn lỗi khác mới tính fail.
const knownCatalog405 = (m) =>
	(m.includes('405') || m.includes('GET method') || m.includes('[brands] fetch error')) && !m.includes('/admin"');
const hardConsoleErrors = consoleErrors.filter(
	(m) => !m.includes('favicon') && !m.includes('sourcemap') && !m.includes('DevTools') && !knownCatalog405(m)
);
ok('L8 · 0 console error', hardConsoleErrors.length === 0, hardConsoleErrors.join(' | ').slice(0, 200));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n══ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ══`);
if (failed.length) {
	console.log('FAIL list:');
	failed.forEach((f) => console.log(`  - ${f.name} — ${f.extra}`));
	process.exitCode = 1;
}
