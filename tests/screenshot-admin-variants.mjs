// tests/screenshot-admin-variants.mjs
// B6.2: chụp Variants page (DataTable migrate) — desktop + mobile expand bar.
// DB test có thể trống — seed 1 variant qua modal để ảnh có row.
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const DIR = 'tests/screenshots/admin-variants';
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
					'[data-test="variants-datatable"] .datatable-row--skeleton, [data-test="variants-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) break;
		await sleep(300);
	}
}

await page.goto(`${BASE}/admin/variants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await pollStable(page);

// Bảng trống → seed 1 variant (flow thật) để ảnh có nội dung
let rowCount = await page.evaluate(
	() =>
		document.querySelectorAll(
			'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		).length
);
if (rowCount === 0) {
	await page.locator('button', { hasText: /Thêm biến thể|Add Variant/ }).first().click();
	await sleep(900);
	const modal = page.locator('[role="dialog"]');
	const productSelect = modal.locator('select').first();
	// Đợi fetchProducts về (select ≥2 option)
	for (let i = 0; i < 30; i++) {
		if ((await productSelect.locator('option').count()) > 1) break;
		await sleep(500);
	}
	const opts = await productSelect.locator('option').all();
	if (opts.length > 1) {
		const v = await opts[1].getAttribute('value');
		if (v) await productSelect.selectOption(v);
		await sleep(400);
	}
	await modal.locator('input').nth(0).fill('Arabica 250g Whole Bean');
	await sleep(400);
	await modal.locator('input').nth(2).fill('Arabica Whole Bean 250g');
	await sleep(400);
	await modal.locator('input').nth(3).fill('185000');
	await sleep(400);
	await modal
		.locator('button', { hasText: /Tạo biến thể|Create Variant/ })
		.last()
		.click();
	await sleep(2000);
	await pollStable(page);
}
await sleep(600);

// 1) Desktop: toàn trang (sidebar + breadcrumb + filters + DataTable + pagination)
await page.screenshot({ path: `${DIR}/01-variants-desktop.png`, fullPage: false });

// 2) Desktop: hover row → actions hiện → chụp khu table
const wrap = page.locator('.admin-table-wrap');
await page
	.locator(
		'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.first()
	.hover();
await sleep(400);
await wrap.screenshot({ path: `${DIR}/02-variants-actions-hover.png` });
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
await mpage.goto(`${BASE}/admin/variants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await pollStable(mpage);
await sleep(600);

// 3) Mobile: toàn trang (offcanvas trigger + breadcrumb + table)
await mpage.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await mpage.screenshot({ path: `${DIR}/03-variants-mobile.png`, fullPage: false });

// 4) Mobile: tap row 1 → expand action bar (2 nút Edit/Delete)
await mpage
	.locator(
		'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.first()
	.tap();
await sleep(700);
await mpage.screenshot({ path: `${DIR}/04-variants-mobile-actions.png`, fullPage: false });
await mobileCtx.close();

console.log('DONE 4 screenshots');
await browser.close();
