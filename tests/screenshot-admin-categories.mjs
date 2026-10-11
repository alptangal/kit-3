// tests/screenshot-admin-categories.mjs
// B6.2: chụp Categories page (DataTable migrate) — desktop + mobile expand bar.
// DB test có thể trống — seed 1 parent + 1 child qua modal để thấy tree prefix.
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const DIR = 'tests/screenshots/admin-categories';
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

// Poll skeleton xuất hiện rồi biến mất
async function pollStable(p) {
	let sawSkeleton = false;
	for (let i = 0; i < 70; i++) {
		const loading = await p.evaluate(
			() =>
				!!document.querySelector(
					'[data-test="categories-datatable"] .datatable-row--skeleton, [data-test="categories-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) break;
		await sleep(300);
	}
}

await page.goto(`${BASE}/admin/categories`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await pollStable(page);

// Bảng trống → seed 1 cha + 1 con (flow thật, có tree prefix trong ảnh)
let rowCount = await page.evaluate(
	() =>
		document.querySelectorAll(
			'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		).length
);
if (rowCount === 0) {
	// Cha: "Coffee" (trên cùng)
	await page.locator('button', { hasText: /Thêm danh mục|Add Category/ }).first().click();
	await sleep(900);
	await page.locator('[role="dialog"] input').first().fill('Coffee Beans');
	await sleep(600);
	await page.locator('[role="dialog"] button', { hasText: /Tạo danh mục|Create Category/ }).last().click();
	await sleep(1500);
	await pollStable(page);

	// Con: parent = "Coffee Beans"
	await page.locator('button', { hasText: /Thêm danh mục|Add Category/ }).first().click();
	await sleep(900);
	await page.locator('[role="dialog"] input').first().fill('Espresso');
	await sleep(600);
	await page.locator('[role="dialog"] select').first().selectOption({ label: 'Coffee Beans' });
	await sleep(400);
	await page.locator('[role="dialog"] button', { hasText: /Tạo danh mục|Create Category/ }).last().click();
	await sleep(1500);
	await pollStable(page);
}
await sleep(600);

// 1) Desktop: toàn trang (sidebar + breadcrumb + search + DataTable + pagination)
await page.screenshot({ path: `${DIR}/01-categories-desktop.png`, fullPage: false });

// 2) Desktop: hover row con (có prefix ↳) → actions hiện → chụp khu table
const wrap = page.locator('.admin-table-wrap');
await page
	.locator(
		'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.nth(1)
	.hover();
await sleep(400);
await wrap.screenshot({ path: `${DIR}/02-categories-actions-hover.png` });
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
await mpage.goto(`${BASE}/admin/categories`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await pollStable(mpage);
await sleep(600);

// 3) Mobile: toàn trang (offcanvas trigger + breadcrumb + table)
await mpage.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await mpage.screenshot({ path: `${DIR}/03-categories-mobile.png`, fullPage: false });

// 4) Mobile: tap row 1 → expand action bar (2 nút Edit/Delete)
await mpage
	.locator(
		'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.first()
	.tap();
await sleep(700);
await mpage.screenshot({ path: `${DIR}/04-categories-mobile-actions.png`, fullPage: false });
await mobileCtx.close();

console.log('DONE 4 screenshots');
await browser.close();
