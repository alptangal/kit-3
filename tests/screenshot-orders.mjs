// tests/screenshot-orders.mjs — 3 ảnh B6.2 orders migrate:
// 01: desktop full page (stats + filters + DataTable + Pagination, 2 đơn seed)
// 02: desktop modal chi tiết đơn
// 03: mobile 375px (bảng gọn + tap row → action bar)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const shotDir = 'tests/screenshots/admin-orders';
mkdirSync(shotDir, { recursive: true });
const BASE = 'https://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Seed 2 đơn nếu DB trống (probe orders có thể đã dọn sạch)
async function seedIfNeeded(page) {
	return page.evaluate(async () => {
		const enc = await import('/src/lib/modules/encryption.ts');
		const post = (url, body) => enc.encryption.fetchSecure(url, { method: 'POST', body });
		const list = await post('/api/admin/orders/list', { page: 1, pageSize: 5 });
		const total = list?.data?.total ?? 0;
		if (total > 0) return 'skip';
		const cust = await post('/api/admin/customers/list', { page: 1, pageSize: 5 });
		const customer = cust?.data?.items?.[0] ?? cust?.data?.customers?.[0];
		if (!customer) return 'no-customer';
		const vars = await post('/api/admin/variants/list', { page: 1, pageSize: 20 });
		const variant = (vars?.data?.items ?? []).find((v) => v.status === 'active' && (v.price ?? 0) > 0);
		if (!variant) return 'no-variant';
		for (const quantity of [2, 1]) {
			await post('/api/admin/orders/create', {
				customerId: customer._id ?? customer.documentKey,
				items: [{ variantId: variant._id ?? variant.documentKey, quantity }]
			});
		}
		return 'seeded';
	});
}

// Cleanup toàn bộ đơn ORD-<hôm nay>-* sau khi chụp
async function cleanupAll(page) {
	return page.evaluate(async () => {
		const enc = await import('/src/lib/modules/encryption.ts');
		const post = (url, body) => enc.encryption.fetchSecure(url, { method: 'POST', body });
		const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
		const list = await post('/api/admin/orders/list', { page: 1, pageSize: 50, search: `ORD-${today}` });
		const items = list?.data?.items ?? [];
		let removed = 0;
		for (const o of items) {
			const r = await post('/api/admin/orders/delete', { documentKey: o._id ?? o.documentKey });
			if (r?.ok) removed++;
		}
		return removed;
	});
}

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

async function waitStable(page, maxMs = 25000) {
	const t0 = Date.now();
	let sawSkeleton = false;
	while (Date.now() - t0 < maxMs) {
		const loading = await page.evaluate(
			() =>
				!!document.querySelector(
					'[data-test="orders-datatable"] .datatable-row--skeleton, [data-test="orders-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) return;
		await sleep(300);
	}
}

// ── 01 + 02: desktop ──
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await login(page);
console.log('[seed]', await seedIfNeeded(page));
await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitStable(page);
// stats endpoint chạy 4 query N1QL (~6.6s) — chậm hơn bảng; poll tới khi giá trị
// khác placeholder "—" (tránh chụp hớ như lần đầu: 4 card chỉ thấy "—").
await page.waitForFunction(
	() => {
		const v = document.querySelector('.stat-card .stat-value');
		return v && v.textContent.trim() !== '—';
	},
	{ timeout: 20000 }
);
await page.evaluate(() => document.fonts?.ready);
await sleep(600);

await page.screenshot({ path: `${shotDir}/01-desktop-list.png`, fullPage: true });
console.log('01 done');

// 02: modal chi tiết
await page.locator('[data-test="order-action-detail"]').first().click();
await sleep(1000);
await page.screenshot({ path: `${shotDir}/02-desktop-detail-modal.png` });
console.log('02 done');
await page.keyboard.press('Escape');
await sleep(800);
await browser.close();

// ── 03: mobile ──
const mbrowser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const mctx = await mbrowser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 800 },
	hasTouch: true,
	isMobile: true,
	deviceScaleFactor: 2,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
});
const mpage = await mctx.newPage();
mpage.on('pageerror', (e) => console.log('PAGEERROR-M:', e.message));
await login(mpage);
await mpage.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitStable(mpage);
// stats endpoint chậm hơn bảng — poll tới khi giá trị khác "—" (ảnh 03 lần trước
// bị chụp hớ: 4 card chỉ thấy "—" vì script không chờ stats).
await mpage.waitForFunction(
	() => {
		const v = document.querySelector('.stat-card .stat-value');
		return v && v.textContent.trim() !== '—';
	},
	{ timeout: 20000 }
);
await mpage.evaluate(() => document.fonts?.ready);
await sleep(600);

// tap row → action bar mở
await mpage
	.locator(
		'[data-test="orders-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.first()
	.tap();
await sleep(800);
// fullPage vô dụng ở layout này: scroll container là div.w-full.h-full (content
// 1657px > doc 800px) nên fullPage chỉ chụp đúng viewport → bar actions bị cắt.
// Đo scrollHeight container rồi nở viewport chứa hết (pattern fullPage+fixed bar).
const contentH = await mpage.evaluate(() => {
	const c = [...document.querySelectorAll('div')].find(
		(d) => (d.className || '').toString().includes('h-full') && d.scrollHeight > d.clientHeight
	);
	return c ? c.scrollHeight : document.documentElement.scrollHeight;
});
await mpage.setViewportSize({ width: 375, height: Math.min(contentH, 2400) });
await sleep(900);
const stillBar = await mpage.evaluate(() => !!document.querySelector('[data-role="mobile-actions"]'));
if (!stillBar) {
	await mpage
		.locator(
			'[data-test="orders-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		)
		.first()
		.tap();
	await sleep(700);
}
await mpage.screenshot({ path: `${shotDir}/03-mobile-list.png` });
console.log('03 done');
await mbrowser.close();

// ── Cleanup: xóa hết đơn seed hôm nay ──
const cbrowser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const cctx = await cbrowser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const cpage = await cctx.newPage();
await login(cpage);
const removed = await cleanupAll(cpage);
console.log(`[cleanup] removed ${removed} orders`);
await cbrowser.close();
console.log('all done');
