// probe-storefront-v2.mjs — storefront v2: detail/account/search/home-featured
// Run: node tests/probe-storefront-v2.mjs
// Requires dev server on https://localhost:3000.
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://localhost:3000';
const SHOTS = 'tests/_ui-shots';
const ADMIN = { username: 'admin', password: '123123_Qwe' };

let pass = 0, fail = 0;
const failures = [];
const results = {};

function check(name, cond, extra = '') {
	if (results[name] === 'pass') return; // tránh double-log cùng check
	if (cond) { pass++; results[name] = 'pass'; console.log(`PASS ${name}`); }
	else { fail++; results[name] = 'fail'; failures.push(name); console.log(`FAIL ${name} ${extra}`); }
}

const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
fs.mkdirSync(SHOTS, { recursive: true });

async function shot(file) {
	await page.screenshot({ path: `${SHOTS}/${file}`, fullPage: false });
	console.log(`SHOT ${file}`);
}

// ── P0: home featured (anonymous) ────────────────────────────────────────────
try {
	await page.goto(`${BASE}/store`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector('[data-test="home-featured"]', { timeout: 30000 });
	// poll until featured grid has >= 1 card (client fetch + decrypt cần thời gian)
	await page.waitForFunction(
		() => {
			const grid = document.querySelector('[data-test="featured-grid"]');
			return !!grid && grid.querySelectorAll('a').length > 0;
		},
		null,
		{ timeout: 30000 }
	);
	const nCards = await page.locator('[data-test="featured-grid"] a').count();
	check('P0.1 home featured section renders', true);
	check('P0.2 featured >= 1 card', nCards >= 1, `cards=${nCards}`);
	check('P0.3 featured <= 8 cards', nCards <= 8, `cards=${nCards}`);
	await shot('store-home-v2.png');
} catch (e) {
	check('P0.1 home featured section renders', false, String(e).slice(0, 150));
	check('P0.2 featured >= 1 card', false, 'section/grid missing');
	check('P0.3 featured <= 8 cards', false, 'n/a');
	await shot('store-home-v2.png').catch(() => {});
}

// ── P1: products list → click product → detail ──────────────────────────────
let LAST_DETAIL_URL = '/store/products';
try {
	await page.goto(`${BASE}/store/products`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForFunction(
		() => {
			const grid = document.querySelector('.products-grid');
			return !!grid && grid.querySelectorAll('a').length > 0;
		},
		null,
		{ timeout: 30000 }
	);
	check('P1.1 products list renders cards', true);
	// click product name link đầu tiên
	const firstLink = page.locator('.product-card a[href*="/store/products/"]').first();
	LAST_DETAIL_URL = (await firstLink.getAttribute('href')) ?? '/store/products';
	check('P1.2 product card has detail link', !!LAST_DETAIL_URL && LAST_DETAIL_URL !== '/store/products', 'no href');
	await firstLink.click();
	await page.waitForSelector('[data-test="product-detail"]', { timeout: 30000 });
	check('P1.3 detail page renders (data-test=product-detail)', true);
	// poll h1 tên sản phẩm (client fetch mã hoá cần thời gian — không check ngay)
	await page
		.locator('.detail-info h1')
		.first()
		.waitFor({ state: 'visible', timeout: 45000 })
		.catch(() => {});
	const nameVisible = await page.locator('.detail-info h1').first().isVisible().catch(() => false);
	check('P1.4 detail shows product name', nameVisible);
	await shot('store-product-detail.png');
} catch (e) {
	check('P1.3 detail page renders (data-test=product-detail)', false, String(e).slice(0, 150));
	await shot('store-product-detail.png').catch(() => {});
}

// ── P2: chọn variant → add to cart → cart có item ───────────────────────────
// Cart API yêu cầu login (anonymous → page redirect /login, không gọi API).
// Login admin TRƯỚC rồi mới thử add-to-cart.
try {
	await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.fill('input[name="username"], input[type="text"]', ADMIN.username);
	await page.fill('input[type="password"]', ADMIN.password);
	await Promise.all([
		page.waitForResponse((r) => r.url().includes('/api/login'), { timeout: 30000 }).catch(() => null),
		page.locator('button[type="submit"]').first().click()
	]);
	// P2 bắt đầu từ detail page (P1 mới goto xong có thể đã ở detail)
	await page.goto(`${BASE}${LAST_DETAIL_URL}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
	// chờ variants load (fetch encrypted)
	await page.waitForFunction(
		() => {
			const single = document.querySelector('[data-test="variant-single"]');
			const picker = document.querySelector('[data-test="variant-picker"]');
			const out = document.querySelector('.detail-state--stock');
			return !!single || !!picker || !!out;
		},
		null,
		{ timeout: 30000 }
	);
	const hasPicker = await page.locator('[data-test="variant-picker"]').count();
	if (hasPicker) {
		// chọn option đầu của nhóm đầu (nếu chưa active)
		const option = page.locator('[data-test="variant-picker"] button').first();
		await option.click();
		await page.waitForTimeout(400);
	}
	check('P2.1 variant area renders (picker or single)', true);
	// add to cart — chờ nút enabled (selectedVariantId set sau khi product load)
	const addBtn = page.locator('[data-test="product-detail"] button', { hasText: /add|giỏ|cart/i }).first();
	const addBtnVisible = await addBtn.isVisible().catch(() => false);
	check('P2.2 add-to-cart button visible', addBtnVisible);
	if (addBtnVisible) {
		// poll đến khi nút không disabled (fetch product xong → selectedVariantId)
		await page
			.locator('[data-test="product-detail"] button:not([disabled])', { hasText: /add|giỏ|cart/i })
			.first()
			.waitFor({ state: 'visible', timeout: 45000 })
			.catch(() => {});
		const [resp] = await Promise.all([
			page.waitForResponse((r) => r.url().includes('/api/storefront/cart/add'), { timeout: 45000 }).catch(() => null),
			addBtn.click()
		]);
		check('P2.3 cart/add API called', !!resp, 'no request captured');
		const okBody = resp ? resp.ok() : false;
		check('P2.4 cart/add returns ok', okBody, resp ? `status=${resp.status()}` : 'no resp');
		// vào /store/cart verify item
		await page.goto(`${BASE}/store/cart`, { waitUntil: 'domcontentloaded', timeout: 30000 });
		await page.waitForFunction(
			() => {
				const body = document.body?.innerText ?? '';
				return !/loading/i.test(body.slice(0, 400));
			},
			null,
			{ timeout: 30000 }
		).catch(() => {});
		const cartText = (await page.locator('body').innerText()).slice(0, 2000);
		const cartHasItem = /qty|quantity|số lượng|item/i.test(cartText) && !/empty|trống/i.test(cartText.slice(0, 600));
		check('P2.5 cart shows the added item', cartHasItem, cartText.slice(0, 120).replace(/\n/g, ' | '));
	}
} catch (e) {
	check('P2.1 variant area renders (picker or single)', false, String(e).slice(0, 150));
}

// ── P3: search page ──────────────────────────────────────────────────────────
try {
	await page.goto(`${BASE}/store/search?q=a`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector('[data-test="store-search"]', { timeout: 30000 });
	check('P3.1 search page renders', true);
	// chạy search với từ khóa phổ biến — lấy q=a (fragment match) hoặc nhập lại
	await page.waitForFunction(
		() => {
			const res = document.querySelector('[data-test="search-results"]');
			// empty state trên trang search là .search-state (không có data-test riêng)
			const states = [...document.querySelectorAll('.search-state')];
			const empty = states.some((s) => /no results|không tìm thấy|no products/i.test(s.textContent ?? ''));
			return !!res || !!empty;
		},
		null,
		{ timeout: 30000 }
	);
	const hasResults = await page.locator('[data-test="search-results"]').count();
	check('P3.2 search q=a has results or valid empty state', true);
	if (hasResults) {
		const nRes = await page.locator('[data-test="search-results"] a').count();
		check('P3.3 search results >= 1 card', nRes >= 1, `results=${nRes}`);
	} else {
		check('P3.3 search results >= 1 card', false, 'empty state shown instead');
	}
	await shot('store-search.png');
} catch (e) {
	// P3.1 đã PASS trước đó thì không re-FAIL (trước đây catch đè làm sai số đếm)
	if (!failures.includes('P3.1 search page renders') && !results['P3.1 search page renders']) {
		check('P3.1 search page renders', false, String(e).slice(0, 150));
	}
	check('P3.2 search q=a has results or valid empty state', false, 'timeout: ' + String(e).slice(0, 100));
	check('P3.3 search results >= 1 card', false, 'timeout');
	await shot('store-search.png').catch(() => {});
}

// ── P4: account page (login admin) ──────────────────────────────────────────
try {
	// P2 đã login ở trên (login 2 lần bị reverse-guard redirect /admin).
	// Check nốt layout: link Account phải hiện khi login
	const navAccount = await page.locator('header a[href="/store/account"], nav a[href="/store/account"]').count();
	check('P4.1 layout shows Account link when logged in', navAccount >= 1, `navAccount=${navAccount}`);
	// vào account
	await page.goto(`${BASE}/store/account`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector('[data-test="store-account"]', { timeout: 30000 });
	check('P4.2 account page renders (logged in)', true);
	await page.waitForFunction(
		() => {
			const orders = document.querySelector('[data-test="account-orders"]');
			const empty = document.querySelector('[data-test="account-empty"]');
			return !!orders || !!empty;
		},
		null,
		{ timeout: 30000 }
	);
	const hasOrders = await page.locator('[data-test="account-orders"]').count();
	if (hasOrders) {
		const nOrders = await page.locator('[data-test="account-orders"] .order-card, [data-test="account-orders"] article, [data-test="account-orders"] li').count();
		check('P4.3 account orders section (list or valid empty)', nOrders >= 1, `orders=${nOrders}`);
	} else {
		// Tài khoản admin không có đơn → empty state hợp lệ (yêu cầu: đơn có thể empty)
		const emptyText = await page.locator('[data-test="account-empty"]').innerText().catch(() => '');
		check('P4.3 account orders section (list or valid empty)', !!emptyText, `empty state: ${emptyText.slice(0, 60)}`);
	}
	await shot('store-account.png');
} catch (e) {
	check('P4.2 account page renders (logged in)', false, String(e).slice(0, 150));
	await shot('store-account.png').catch(() => {});
}

await browser.close();

console.log(`\n=== RESULT: ${pass} PASS / ${fail} FAIL ===`);
if (failures.length) console.log(`FAILED: ${failures.join(' | ')}`);
process.exit(fail === 0 ? 0 : 1);
