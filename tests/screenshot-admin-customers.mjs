// tests/screenshot-admin-customers.mjs
// B6.2: chụp Customers page (DataTable migrate) — desktop + mobile expand bar.
// DB đã có customers (probe seed "Nguyen Test") — không cần seed.
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const DIR = 'tests/screenshots/admin-customers';
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
					'[data-test="customers-datatable"] .datatable-row--skeleton, [data-test="customers-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) break;
		await sleep(300);
	}
}

// Poll stats card có số (fetch stats RSA chậm hơn list → "—" nếu chụp sớm)
async function pollStats(p) {
	for (let i = 0; i < 40; i++) {
		const hasValue = await p.evaluate(() => {
			const vals = [...document.querySelectorAll('.admin-stats .stat-value')];
			return vals.length > 0 && vals.some((v) => /^\d+/.test(v.textContent?.trim() ?? ''));
		});
		if (hasValue) return;
		await sleep(400);
	}
}

await page.goto(`${BASE}/admin/customers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await pollStable(page);
await pollStats(page);
await sleep(600);

// 1) Desktop: toàn trang (sidebar + breadcrumb + stats + filters + DataTable + pagination)
await page.screenshot({ path: `${DIR}/01-customers-desktop.png`, fullPage: false });

// 2) Desktop: hover row → actions hiện → chụp khu table
const wrap = page.locator('.admin-table-wrap');
await page
	.locator(
		'[data-test="customers-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.first()
	.hover();
await sleep(400);
await wrap.screenshot({ path: `${DIR}/02-customers-actions-hover.png` });
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
await mpage.goto(`${BASE}/admin/customers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await pollStable(mpage);
await pollStats(mpage);
await sleep(600);

// 3) Mobile: toàn trang (offcanvas trigger + breadcrumb + stats + table)
await mpage.evaluate(() => window.scrollTo(0, 0));
await sleep(300);
await mpage.screenshot({ path: `${DIR}/03-customers-mobile.png`, fullPage: false });

// 5) Mobile: cuộn tới bảng (stats + filters đẩy bảng xuống dưới viewport 700px)
await mpage.locator('[data-test="customers-datatable"]').first().scrollIntoViewIfNeeded();
await sleep(500);
await mpage.screenshot({ path: `${DIR}/05-customers-mobile-table.png`, fullPage: false });

// 4) Mobile: tap row 1 → expand action bar (3 nút Detail/Status/Delete)
await mpage
	.locator(
		'[data-test="customers-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	)
	.first()
	.tap();
await sleep(700);
await mpage.screenshot({ path: `${DIR}/04-customers-mobile-actions.png`, fullPage: false });
await mobileCtx.close();

console.log('DONE 5 screenshots');
await browser.close();
