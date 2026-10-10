// business-routes-probe.mjs
// Business routes probe — verify orders + customers admin API + pages
// Pattern theo tests/auth-wave11-probe.mjs
// Yêu cầu server chạy tại https://localhost:3000 (HTTPS dev cert)
import { chromium } from '@playwright/test';
import https from 'https';

const BASE_URL = 'https://localhost:3000';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// HELPER: fetch with ignore HTTPS
async function fetchJson(url, options = {}) {
	const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
	const res = await fetch(fullUrl, {
		...options,
		agent: httpsAgent,
		headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
	});
	const text = await res.text();
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		data = { raw: text };
	}
	return { status: res.status, ok: res.ok, data };
}

// 1. API ROUTES — unauth -> 401
async function testApiUnauth() {
	console.log('\n=== API UNAUTH TESTS ===');

	const endpoints = [
		'/api/admin/orders/list',
		'/api/admin/orders/detail',
		'/api/admin/orders/create',
		'/api/admin/orders/update',
		'/api/admin/orders/delete',
		'/api/admin/orders/status',
		'/api/admin/orders/stats',
		'/api/admin/customers/list',
		'/api/admin/customers/detail',
		'/api/admin/customers/create',
		'/api/admin/customers/update',
		'/api/admin/customers/delete',
		'/api/admin/customers/set-status',
		'/api/admin/customers/stats'
	];

	for (const ep of endpoints) {
		const res = await fetchJson(ep, {
			method: 'POST',
			body: JSON.stringify({})
		});
		ok(
			`API ${ep} unauth -> 401`,
			res.status === 401,
			`status=${res.status} body=${JSON.stringify(res.data).slice(0, 100)}`
		);
	}
}

// 2. ADMIN PAGES — unauth -> 303 redirect /login
async function testAdminPagesUnauth(page) {
	console.log('\n=== ADMIN PAGES UNAUTH TESTS ===');

	const pages = [
		'/admin/orders',
		'/admin/customers'
	];

	for (const p of pages) {
		const res = await page.goto(`${BASE_URL}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
		const finalUrl = page.url();
		const redirected = finalUrl.includes('/login') || res?.status() === 303;
		ok(
			`Page ${p} unauth -> redirect /login`,
			redirected,
			`finalUrl=${finalUrl} status=${res?.status()}`
		);
	}
}

// 3. LOGIN QUA UI FORM (admin/123123_Qwe)
async function testLogin(page) {
	console.log('\n=== LOGIN TEST ===');

	await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	// Form root class is on the Form component, auth-input-wrapper is inside TextField
	// Input renders inside .input-highlight-wrapper > input
	await page.waitForSelector('.form-root .auth-input-wrapper input', { timeout: 20000 });
	await sleep(400);

	const usernameInput = page.locator('.form-root .auth-input-wrapper input').first();
	const passInput = page.locator('.form-root .auth-input-wrapper input').nth(1);
	const submitBtn = page.locator('.auth-btn-submit').first();

	await usernameInput.fill('admin');
	await passInput.fill('123123_Qwe');
	await sleep(400);

	await submitBtn.click();
	// Wait for navigation away from login page - could be to / or to the redirect target
	await page.waitForURL((url) => !url.toString().includes('/login'), { waitUntil: 'domcontentloaded', timeout: 20000 });
	await sleep(1000);

	const loggedIn = !page.url().includes('/login');
	ok('Login admin/123123_Qwe -> redirect home', loggedIn, `url=${page.url()}`);
}

// 4. ADMIN PAGES — authed -> stats bar render + 0 console error
async function testAdminPagesAuthed(page) {
	console.log('\n=== ADMIN PAGES AUTHED TESTS ===');

	const pages = [
		{ path: '/admin/orders', statsKeys: ['totalOrders', 'todayOrders', 'deliveredRevenue'] },
		{ path: '/admin/customers', statsKeys: ['totalCustomers', 'todayCustomers', 'activeCustomers'] }
	];

	for (const p of pages) {
		const pageErrors = [];
		page.on('pageerror', (e) => pageErrors.push(e.message));

		await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('.admin-page', { timeout: 20000 });
		// Đợi TRẠNG THÁI CUỐI (bảng có rows HOẶC empty-state KHÔNG phải loading)
		// — "Loading..." cũng là .admin-state nên phải chờ loading biến mất hẳn,
		// nếu không sẽ ẩn lỗi treo fetch (bẫy: customers từng treo loading vĩnh viễn).
		await page.waitForFunction(
			() => {
				const hasTable = !!document.querySelector('.admin-table-wrap .admin-table');
				const stateEl = document.querySelector('.admin-state');
				const isStillLoading = stateEl?.textContent?.toLowerCase().includes('loading') ?? false;
				return hasTable || (stateEl && !isStillLoading);
			},
			{ timeout: 30000 }
		);
		await sleep(800); // cho stats fetch settle

		// Verify stats bar co 4 card render
		const statCards = await page.locator('.admin-stats .stat-card').count();
		ok(`${p.path} stats bar co 4 card`, statCards === 4, `count=${statCards}`);

		// Verify khong co pageerror
		ok(`${p.path} khong co console error`, pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

		// Verify table render (co thead + tbody) — HOẶC empty-state khi DB trống
		// (dev DB chưa có dữ liệu orders/customers → trang hợp lệ hiển thị
		// empty-state, không phải lỗi render)
		const hasTable = await page.locator('.admin-table-wrap .admin-table').count() > 0;
		const hasEmptyState = await page.locator('.admin-state').count() > 0;
		ok(`${p.path} bang render`, hasTable || hasEmptyState, `table=${hasTable} emptyState=${hasEmptyState}`);

		// Verify pagination render — chỉ bắt buộc khi bảng có dữ liệu
		// (DB trống → pagination không render là đúng hành vi tiết kiệm UI)
		const hasPagination = await page.locator('.admin-pagination').count() > 0;
		ok(`${p.path} phan trang render`, hasPagination || hasEmptyState, `pagination=${hasPagination} emptyState=${hasEmptyState}`);
	}
}

// MAIN
async function main() {
	const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 900 },
	});

	const page = await context.newPage();

	try {
		await testApiUnauth();
		await testAdminPagesUnauth(page);
		await testLogin(page);
		await testAdminPagesAuthed(page);
	} finally {
		await browser.close();
	}

	// Summary
	const pass = results.filter(r => r.pass).length;
	const fail = results.filter(r => !r.pass).length;
	console.log(`\n=== SUMMARY: ${pass}/${pass + fail} PASS ===`);
	if (fail > 0) {
		console.log('FAILURES:');
		results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.name}: ${r.extra}`));
		process.exit(1);
	}
}

main().catch(e => {
	console.error('Probe crashed:', e);
	process.exit(1);
});