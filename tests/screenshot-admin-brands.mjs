// tests/screenshot-admin-brands.mjs
// B6.2: chụp Brands page (DataTable migrate) — desktop + mobile expand bar.
// DB test có thể trống — seed 2 brand qua API trước khi chụp để có nội dung đẹp.
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const DIR = 'tests/screenshots/admin-brands';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(400);
await page.locator('.auth-input-wrapper input').first().fill('admin');
await sleep(300);
await page.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
await sleep(500);
await page.locator('.auth-btn-submit').first().click();
await page.waitForURL((u) => !u.toString().includes('/login'), {
	waitUntil: 'domcontentloaded',
	timeout: 20000
});

await page.goto(`${BASE}/admin/brands`, { waitUntil: 'domcontentloaded', timeout: 30000 });
// Poll: skeleton xuất hiện rồi biến mất (waitStable pattern của probe)
let sawSkeleton = false;
for (let i = 0; i < 70; i++) {
	const loading = await page.evaluate(
		() =>
			!!document.querySelector(
				'[data-test="brands-datatable"] .datatable-row--skeleton, [data-test="brands-datatable"] .datatable-loading'
			)
	);
	if (loading) sawSkeleton = true;
	if (sawSkeleton && !loading) break;
	await sleep(300);
}
// Bảng trống → seed 2 brand qua modal create (flow thật, chụp cả UI đẹp hơn)
let rowCount = await page.evaluate(
	() =>
		document.querySelectorAll(
			'[data-test="brands-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		).length
);
if (rowCount === 0) {
	for (const name of ['Aurora Coffee Roasters', 'Nova Tea House']) {
		await page.locator('button', { hasText: /Thêm thương hiệu|Add Brand/ }).first().click();
		await sleep(900);
		await page.locator('[role="dialog"] input').first().fill(name);
		await sleep(600);
		await page.locator('[role="dialog"] button', { hasText: /Tạo thương hiệu|Create Brand/ }).last().click();
		await sleep(1500);
	}
	// Poll lại sau seed
	sawSkeleton = false;
	for (let i = 0; i < 70; i++) {
		const loading = await page.evaluate(
			() =>
				!!document.querySelector(
					'[data-test="brands-datatable"] .datatable-row--skeleton, [data-test="brands-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) break;
		await sleep(300);
	}
}
await sleep(600);

// 1) Desktop: toàn trang (sidebar + breadcrumb + search + DataTable + pagination)
await page.screenshot({ path: `${DIR}/01-brands-desktop.png`, fullPage: false });

// 2) Desktop: hover row 1 → actions hiện → chụp khu table
const wrap = page.locator('.admin-table-wrap');
await page
	.locator(
		'[data-test="brands-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.first()
	.hover();
await sleep(400);
await wrap.screenshot({ path: `${DIR}/02-brands-actions-hover.png` });
await page.mouse.move(640, 200);
await sleep(300);

// 3+4) Mobile: context THẬT (hasTouch) — media query hover:none/pointer:coarse
const mobileCtx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 700 },
	hasTouch: true,
	isMobile: true,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
});
const mpage = await mobileCtx.newPage();
await mpage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await mpage.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(400);
await mpage.locator('.auth-input-wrapper input').first().fill('admin');
await sleep(300);
await mpage.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
await sleep(500);
await mpage.locator('.auth-btn-submit').first().click();
await mpage.waitForURL((u) => !u.toString().includes('/login'), {
	waitUntil: 'domcontentloaded',
	timeout: 20000
});
await mpage.goto(`${BASE}/admin/brands`, { waitUntil: 'domcontentloaded', timeout: 30000 });
sawSkeleton = false;
for (let i = 0; i < 70; i++) {
	const loading = await mpage.evaluate(
		() =>
			!!document.querySelector(
				'[data-test="brands-datatable"] .datatable-row--skeleton, [data-test="brands-datatable"] .datatable-loading'
			)
	);
	if (loading) sawSkeleton = true;
	if (sawSkeleton && !loading) break;
	await sleep(300);
}
await sleep(600);

// 3) Mobile: toàn trang (offcanvas trigger + breadcrumb + table)
await mpage.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await mpage.screenshot({ path: `${DIR}/03-brands-mobile.png`, fullPage: false });

// 4) Mobile: tap row 1 → expand action bar (2 nút Edit/Delete)
await mpage
	.locator(
		'[data-test="brands-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.first()
	.tap();
await sleep(700);
await mpage.screenshot({ path: `${DIR}/04-brands-mobile-actions.png`, fullPage: false });
await mobileCtx.close();

console.log('DONE 4 screenshots');
await browser.close();
