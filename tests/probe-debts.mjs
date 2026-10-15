// Probe CÔNG NỢ 2 CHIỀU (debts + debt_payments).
// Kịch bản:
//  DB1: /admin/debts load không lỗi console + tab AR hiện diện
//  DB2: tạo khoản phải thu (receivable) qua UI (chọn khách hàng + số tiền)
//  DB3: record payment 1 phần qua UI modal → status 'partial', paid/remaining đúng
//  DB4: record đủ phần còn lại → status 'settled', remaining=0
//  DB5: summary card cập nhật (outstanding > 0 hoặc = 0 sau settled)
//  DB6: tạo khoản phải trả (payable) qua UI (NCC) + API record đủ → settled
//  DB7: lịch sử payment (debt_payments) ghi đúng số lần trả
//  DB8: delete khoản chưa có payment OK; khoản có payment bị chặn (hasPayments)
//  DB9: API create verify party không tồn tại → lỗi invalidParty
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';

// ── Data API (đọc .env cùng cách probe-transfers) ──
const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
	const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]?([^'"]*?)['"]?\s*$/);
	if (m) env[m[1]] = m[2].trim();
}
const CLUSTER = env.cb_clusterId;
const USER = env.cb_username;
const PASS = env.cb_password;
const BUCKET = env.cb_bucketName;
const SCOPE = env.cb_scopeName;
const BASIC = Buffer.from(`${USER}:${PASS}`).toString('base64');

async function n1ql(statement, args = []) {
	const r = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
		method: 'POST',
		headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
		body: JSON.stringify({ statement, args })
	});
	const j = await r.json().catch(() => ({}));
	if (r.status !== 200 || (j.errors && j.errors.length)) {
		throw new Error(`N1QL failed: ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
	}
	return j.results ?? [];
}

async function upsertDoc(collection, key, doc) {
	await n1ql(`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.${collection} (KEY, VALUE) VALUES ($1, $2)`, [
		key,
		doc
	]);
}

// Dọn khoản nợ probe từ lần chạy trước
async function cleanupProbeDocs() {
	await n1ql(`DELETE FROM \`${BUCKET}\`.\`${SCOPE}\`.debts WHERE debtCode LIKE 'DR-%' OR debtCode LIKE 'DP-%'`);
	await n1ql(`DELETE FROM \`${BUCKET}\`.\`${SCOPE}\`.debt_payments`);
}

// ── Kết quả ──
const results = [];
function ok(name, pass, detail = '') {
	results.push({ name, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Playwright helpers (pattern probe-transfers) ──
async function login(page) {
	await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await page.fill('.auth-input-wrapper input >> nth=0', 'admin');
	await page.fill('.auth-input-wrapper input >> nth=1', '123123_Qwe');
	await page.click('button[type="submit"]');
	await page.waitForURL(BASE + '/');
}

async function dismissViteOverlay(page) {
	await page
		.waitForFunction(() => !document.querySelector('vite-error-overlay'), { timeout: 20000 })
		.catch(() => {});
}

async function clickRowAction(page, rowLocator, buttonText) {
	await dismissViteOverlay(page);
	// Actions ẩn trong cột sticky/overflow — hover row trước để buttons render
	const row = page.locator(rowLocator).first();
	await row.hover().catch(() => {});
	// Playwright hasText match button VÀ text lồng nhau; nút actions chỉ hiện khi
	// row hover (DataTable actionsContent) — poll chờ button xuất hiện
	let btn = null;
	for (let i = 0; i < 10; i++) {
		btn = page.locator(`${rowLocator} button`, { hasText: buttonText }).first();
		if (await btn.count()) break;
		await row.hover().catch(() => {});
		await sleep(400);
	}
	if (!btn || !(await btn.count())) throw new Error(`Row action "${buttonText}" not found`);
	await btn.click();
}

async function submitConfirmModal(page, submitLabel) {
	await sleep(400);
	const footerBtn = page.locator('.modal-footer-root button', { hasText: submitLabel }).first();
	if (await footerBtn.count()) {
		await footerBtn.click();
	} else {
		const anyBtn = page.locator('[class*="modal"] button', { hasText: submitLabel }).first();
		if (await anyBtn.count()) {
			await anyBtn.click();
		} else {
			throw new Error(`Confirm button "${submitLabel}" not found`);
		}
	}
}

// Đợi response API mới + modal đóng
async function waitForListRefresh(page, listUrlPart) {
	await page
		.waitForResponse((r) => r.url().includes(listUrlPart) && r.request().method() === 'POST', { timeout: 15000 })
		.catch(() => {});
	await sleep(1200);
}

// Status badge của row đầu (row đầu = khoản mới nhất — list sort createdAt DESC)
async function firstRowStatus(page, rowTest) {
	return page.evaluate((rt) => {
		const row = document.querySelector(`${rt}`);
		if (!row) return null;
		if (row.className.includes('skeleton')) return 'skeleton';
		// status pill trong DataTable — ô có class chứa 'status'
		const pill = row.querySelector('[class*="status"], .datatable-status');
		return pill ? pill.textContent.trim() : null;
	}, rowTest);
}

async function waitForRowStatus(page, rowTest, expected, timeoutMs = 30000) {
	const start = Date.now();
	let last = null;
	while (Date.now() - start < timeoutMs) {
		last = await firstRowStatus(page, rowTest);
		if (last && expected.includes(last)) return last;
		await sleep(500);
	}
	return last;
}

// Đợi row thật (không skeleton) render — table giữ skeleton rows ~6-8s sau reload
// (debts reload gộp Promise.all summary + list; skeleton hiện cho tới cả 2 xong)
async function waitForRealRow(page, timeoutMs = 30000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const ready = await page.evaluate(() => {
			const row = document.querySelector('[data-test="debts-table"] tbody tr');
			return row
				? !row.className.includes('skeleton') && row.querySelectorAll('button').length > 0
				: false;
		});
		if (ready) return true;
		await sleep(500);
	}
	return false;
}

// ── MAIN ──
async function main() {
	await cleanupProbeDocs();

	// 0. Dữ liệu: 1 customer + 1 supplier thật trong DB (lấy từ list users/suppliers)
	const customerDoc = (
		await n1ql(
			`SELECT RAW META().id FROM \`${BUCKET}\`.\`${SCOPE}\`.users WHERE roleName = 'customer' LIMIT 1`
		)
	)[0];
	const supplierDoc = (
		await n1ql(`SELECT RAW META().id FROM \`${BUCKET}\`.\`${SCOPE}\`.suppliers LIMIT 1`)
	)[0];
	if (!customerDoc) {
		// Fallback: seed 1 customer probe (roleName customer) — users collection
		const probeCustKey = 'user_probe_debt_customer';
		await upsertDoc('users', probeCustKey, {
			username: 'probe_debt_customer',
			firstname: 'Probe',
			lastname: 'Debt Customer',
			roleName: 'customer',
			status: 'active',
			createdAt: new Date().toISOString()
		});
	}
	const customerId = customerDoc || 'user_probe_debt_customer';
	if (!supplierDoc) throw new Error('Cần ít nhất 1 supplier trong DB (đã seed)');

	// Chọn branch đầu tiên cho actor admin (actor.branchId dùng khi tạo debt)
	const adminBranch = (
		await n1ql(`SELECT RAW branchId FROM \`${BUCKET}\`.\`${SCOPE}\`.users WHERE META().id = 'user_admin' OR username = 'admin' LIMIT 1`)
	)[0];

	const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
	const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'vi-VN' });
	const page = await ctx.newPage();
	const pageErrors = [];
	page.on('pageerror', (e) => pageErrors.push(String(e)));
	await login(page);

	// API helper trong page context (pattern admin-orders-datatable-probe)
	const apiPost = async (url, body) =>
		page.evaluate(
			async ({ url, body }) => {
				const enc = await import('/src/lib/modules/encryption.ts');
				return enc.encryption.fetchSecure(url, { method: 'POST', body });
			},
			{ url, body }
		);

	// ================= DB1: Trang load =================
	await page.goto(BASE + '/admin/debts', { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="debts-table"], .admin-state', { timeout: 15000 }).catch(() => {});
	await dismissViteOverlay(page);
	await sleep(800);
	ok(
		'DB1 trang /admin/debts load không lỗi console + tab receivable active',
		pageErrors.length === 0 &&
			(await page.locator('[data-test="debts-tab-receivable"]').count()) === 1 &&
			(await page.locator('[data-test="debts-tab-payable"]').count()) === 1,
		`pageErrors=${pageErrors.length}`
	);

	// ================= DB2: Tạo khoản phải thu qua UI =================
	await dismissViteOverlay(page);
	await page.click('[data-test="debts-create-btn"]');
	await page.waitForSelector('[data-test="debts-create-party"]', { timeout: 10000 });
	// chờ party options populate (onMount loadParties)
	await page.waitForFunction(
		() => document.querySelectorAll('[data-test="debts-create-party"] option').length > 1,
		{ timeout: 15000 }
	);
	// chọn customer đầu tiên
	await page.evaluate(() => {
		const sel = document.querySelector('[data-test="debts-create-party"]');
		sel.selectedIndex = 1;
		sel.dispatchEvent(new Event('change', { bubbles: true }));
	});
	await page.fill('[data-test="debts-create-amount"]', '500000');
	await page.fill('#create-due', '2026-12-31');
	await page.click('.modal-footer-root button', { hasText: 'Ghi nhận' });
	// nút submit create là btnSave 'Ghi nhận'
	await waitForListRefresh(page, '/api/admin/debts/list');
	const createErr1 = await page.evaluate(() => document.querySelector('.form-error-banner')?.textContent.trim() ?? null);
	if (createErr1) console.log(`  [DB2] formError sau create: ${createErr1}`);

	// Đợi row khoản nợ xuất hiện (render sau reload gộp — response list có thể về
	// trước khi bảng kịp re-render)
	let row0Text = '';
	for (let i = 0; i < 20; i++) {
		row0Text = await page.evaluate(() => {
			const row = document.querySelector('[data-test="debts-table"] tbody tr');
			return row ? row.textContent.trim() : '';
		});
		if (row0Text.includes('DR-') || row0Text.includes('500')) break;
		await sleep(500);
	}
	ok(
		'DB2 tạo khoản phải thu (receivable) qua UI thành công (row xuất hiện)',
		row0Text.includes('500') || row0Text.includes('DR-'),
		`row0="${row0Text.slice(0, 120)}"`
	);

	// ================= DB3: Trả 1 phần qua UI modal =================
	await waitForRealRow(page);
	await clickRowAction(page, '[data-test="debts-table"] tbody tr', 'Ghi nhận trả');
	await page.waitForSelector('[data-test="debts-pay-amount"]', { timeout: 10000 });
	await page.fill('[data-test="debts-pay-amount"]', '200000');
	await page.selectOption('[data-test="debts-pay-method"]', 'cash');
	await submitConfirmModal(page, 'Ghi nhận');
	await waitForListRefresh(page, '/api/admin/debts/list');

	// Xác nhận qua N1QL: debt đầu tiên partial 200000/500000
	const debtAfterPartial = (
		await n1ql(
			`SELECT debtCode, amount, paidAmount, remainingAmount, status FROM \`${BUCKET}\`.\`${SCOPE}\`.debts WHERE debtCode LIKE 'DR-%' ORDER BY createdAt DESC LIMIT 1`
		)
	)[0];
	ok(
		'DB3 trả 1 phần → status partial + paid/remaining đúng',
		debtAfterPartial &&
			debtAfterPartial.status === 'partial' &&
			Number(debtAfterPartial.paidAmount) === 200000 &&
			Number(debtAfterPartial.remainingAmount) === 300000,
		JSON.stringify(debtAfterPartial)
	);

	// ================= DB4: Trả đủ phần còn lại qua API =================
	const debtId = (
		await n1ql(
			`SELECT RAW META().id FROM \`${BUCKET}\`.\`${SCOPE}\`.debts WHERE debtCode LIKE 'DR-%' ORDER BY createdAt DESC LIMIT 1`
		)
	)[0];
	const payFull = await apiPost('/api/admin/debts/record-payment', {
		id: debtId,
		amount: 300000,
		method: 'bank_transfer'
	});
	ok(
		'DB4 trả đủ phần còn lại qua API → settled + remaining 0',
		payFull?.ok === true && payFull?.data?.debt?.status === 'settled' && Number(payFull?.data?.debt?.remainingAmount) === 0,
		JSON.stringify(payFull?.data?.debt ?? payFull)
	);

	// ================= DB5: Summary sau settled =================
	const summary = await apiPost('/api/admin/debts/summary', { type: 'receivable' });
	ok(
		'DB5 summary receivable: outstanding=0, totalPaid=500000',
		summary?.ok === true &&
			Number(summary?.data?.totalOutstanding) === 0 &&
			Number(summary?.data?.totalPaid) === 500000,
		JSON.stringify(summary?.data ?? summary)
	);

	// ================= DB6: Khoản phải trả (payable) qua API + trả đủ =================
	const createPayable = await apiPost('/api/admin/debts/create', {
		type: 'payable',
		partyId: supplierDoc,
		amount: 750000,
		dueDate: '2026-11-30'
	});
	ok(
		'DB6 tạo khoản phải trả (payable) qua API thành công (DP-, open)',
		createPayable?.ok === true &&
			String(createPayable?.data?.debtCode ?? '').startsWith('DP-') &&
			createPayable?.data?.status === 'open',
		JSON.stringify(createPayable?.data ?? createPayable)
	);

	const payableId = createPayable?.data?._id;
	const payPayable = await apiPost('/api/admin/debts/record-payment', {
		id: payableId,
		amount: 750000,
		method: 'card'
	});
	ok(
		'DB7 trả đủ payable qua API → settled',
		payPayable?.ok === true && payPayable?.data?.debt?.status === 'settled',
		JSON.stringify(payPayable?.data?.debt ?? payPayable)
	);

	// ================= DB8: Lịch sử payment ghi đúng =================
	const paymentCount = (
		await n1ql(`SELECT RAW COUNT(*) FROM \`${BUCKET}\`.\`${SCOPE}\`.debt_payments`)
	)[0];
	ok(
		'DB8 debt_payments ghi đủ 3 lần trả (200k + 300k + 750k)',
		Number(paymentCount) === 3,
		`count=${paymentCount}`
	);

	// ================= DB9: delete có/không payment =================
	// 9a: tạo 1 khoản mới chưa trả → delete OK
	const del1 = await apiPost('/api/admin/debts/create', {
		type: 'receivable',
		partyId: customerId,
		amount: 100000
	});
	const del1Id = del1?.data?._id;
	const delRes = await apiPost('/api/admin/debts/delete', { id: del1Id });
	ok(
		'DB9a delete khoản chưa có payment → OK',
		delRes?.ok === true,
		JSON.stringify(delRes)
	);

	// 9b: delete khoản đã có payment → bị chặn hasPayments
	const delBlocked = await apiPost('/api/admin/debts/delete', { id: debtId });
	ok(
		'DB9b delete khoản có payment → bị chặn',
		delBlocked?.ok === false,
		JSON.stringify(delBlocked?.message ?? delBlocked)
	);

	// ================= DB10: create party không tồn tại → lỗi =================
	const badParty = await apiPost('/api/admin/debts/create', {
		type: 'receivable',
		partyId: 'user_khong_ton_tai_xyz',
		amount: 50000
	});
	ok(
		'DB10 create party không tồn tại → lỗi invalidParty',
		badParty?.ok === false,
		JSON.stringify(badParty?.message ?? badParty)
	);

	// ================= DB11: Tab payable UI hiển thị DP =================
	await page.click('[data-test="debts-tab-payable"]');
	await waitForListRefresh(page, '/api/admin/debts/list');
	// Tab switch trigger reload gộp — đợi row thật thay skeleton
	let payableRowText = '';
	for (let i = 0; i < 24; i++) {
		payableRowText = await page.evaluate(() => {
			const row = document.querySelector('[data-test="debts-table"] tbody tr');
			if (!row || row.className.includes('skeleton')) return '';
			return row.textContent;
		});
		if (payableRowText.includes('DP-')) break;
		await sleep(500);
	}
	ok(
		'DB11 tab payable hiển thị khoản DP',
		payableRowText.includes('DP-'),
		`row="${payableRowText.slice(0, 120)}"`
	);

	await browser.close();

	const pass = results.filter((r) => r.pass).length;
	console.log(`\nKết quả: ${pass}/${results.length} PASS`);
	if (pageErrors.length) console.log('Page errors:', pageErrors.join('\n'));
	process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => {
	console.error('PROBE CRASH:', e);
	console.log(`\nKết quả: ${results.filter((r) => r.pass).length}/${results.length} PASS`);
	process.exit(1);
});
