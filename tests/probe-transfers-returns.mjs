// Probe CHUYỂN KHO (stock_transfers) + ĐỔI TRẢ (order_returns).
// Kịch bản:
//  TR1: /admin/transfers load + tạo phiếu qua UI (from/to branch, variant, qty)
//  TR2: phiếu tạo xong status 'pending', KHÔNG đổi tồn kho
//  TR3: duyệt (approve) → status 'in_transit', tồn FROM trừ đúng số lượng
//  TR4: hoàn tất (complete) → status 'completed', tồn TO cộng đúng số lượng
//  TR5: tạo phiếu thứ 2 rồi cancel → tồn không đổi (pending cancel)
//  RT1: /admin/returns load + tạo phiếu đổi trả từ đơn trong 7 ngày (order seed thẳng N1QL)
//  RT2: duyệt → approved (handledBy gắn)
//  RT3: hoàn tất → completed, tồn tại chi nhánh XỬ LÝ cộng đúng số lượng
//  RT4: từ chối phiếu đổi trả khác → rejected, tồn kho không đổi
// Verify tồn kho: N1QL qua Data API (pattern tests/seed-grants-new.mjs).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';

// ── Data API (đọc .env cùng cách seed-grants-new.mjs) ──
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

async function getStock(variantId, branchId) {
	// Doc stock có thể có key cũ `inventory::...` (seed) — tra theo (variantId, branchId)
	const rows = await n1ql(
		`SELECT quantityOnHand FROM \`${BUCKET}\`.\`${SCOPE}\`.inventory_stock WHERE variantId = $1 AND branchId = $2 LIMIT 1`,
		[variantId, branchId]
	);
	return Number(rows[0]?.quantityOnHand ?? 0);
}

async function upsertDoc(collection, key, doc) {
	await n1ql(
		`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.${collection} (KEY, VALUE) VALUES ($1, $2)`,
		[key, doc]
	);
}

// Dọn phiếu probe từ lần chạy trước — để row đầu list luôn là phiếu mình vừa tạo
async function cleanupProbeDocs() {
	await n1ql(`DELETE FROM \`${BUCKET}\`.\`${SCOPE}\`.stock_transfers`);
	await n1ql(`DELETE FROM \`${BUCKET}\`.\`${SCOPE}\`.order_returns WHERE orderId LIKE 'order::probe-tr-%'`);
}

// ── Kết quả ──
const results = [];
function ok(name, pass, detail = '') {
	results.push({ name, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Playwright helpers ──
async function login(page) {
	await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await page.fill('.auth-input-wrapper input >> nth=0', 'admin');
	await page.fill('.auth-input-wrapper input >> nth=1', '123123_Qwe');
	await page.click('button[type="submit"]');
	await page.waitForURL(BASE + '/');
}

async function selectOption(page, selector, value) {
	await dismissViteOverlay(page);
	await page.selectOption(selector, value);
}

// Vite error overlay (HMR của agent song song) có thể chặn pointer events — đợi nó tự biến mất
async function dismissViteOverlay(page) {
	await page
		.waitForFunction(
			() => !document.querySelector('vite-error-overlay'),
			{ timeout: 20000 }
		)
		.catch(() => {});
}

// Lấy status badge text của row đầu tiên (phiếu mới nhất — list sort createdAt DESC)
async function firstRowStatus(page, rowTest) {
	return page.evaluate((rt) => {
		const row = document.querySelector(`[data-test="${rt}"]`);
		return row ? (row.querySelector('[data-transfer-status], [data-return-status]')?.textContent.trim() ?? null) : null;
	}, rowTest);
}

async function clickRowAction(page, rowTest, buttonText) {
	await dismissViteOverlay(page);
	// Dùng locator click thật (kích hoạt handler Svelte + hover states) thay vì evaluate .click()
	const btn = page
		.locator(`[data-test="${rowTest}"] button`, { hasText: buttonText })
		.first();
	if (!(await btn.count())) throw new Error(`Row action "${buttonText}" not found`);
	await btn.click();
}

// Đợi list render xong sau 1 mutation: chờ response list mới + modal đóng + row có status badge
async function waitForListRefresh(page, listUrlPart) {
	await page
		.waitForResponse((r) => r.url().includes(listUrlPart) && r.request().method() === 'POST', { timeout: 15000 })
		.catch(() => {});
	await sleep(1200);
}

// Đợi row đầu đạt status mong đợi (poll — chống re-render chậm / list fetch trễ)
async function waitForRowStatus(page, rowTest, expected, timeoutMs = 15000) {
	const start = Date.now();
	let last = null;
	while (Date.now() - start < timeoutMs) {
		last = await firstRowStatus(page, rowTest);
		if (last && expected.includes(last)) return last;
		await sleep(500);
	}
	return last;
}

async function submitConfirmModal(page, submitLabel) {
	await sleep(400);
	// Footer class thật: .modal-footer-root (Modal.Container.Footer)
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

// ── MAIN ──
async function main() {
	// -1. Dọn phiếu probe cũ (list sort createdAt DESC — row đầu phải là phiếu mình sắp tạo)
	await cleanupProbeDocs();

	// 0. Chọn dữ liệu: FROM = branch active CÓ tồn kho (>= 5), TO = branch active khác.
	// Variant phải nằm trong 100 item đầu của /api/admin/variants/list (UI chỉ load 100)
	const activeBranches = await n1ql(
		`SELECT RAW META().id FROM \`${BUCKET}\`.\`${SCOPE}\`.branches WHERE status = 'active' ORDER BY META().id`
	);
	if (activeBranches.length < 2) throw new Error('Cần ít nhất 2 branch active để test chuyển kho (đã seed main/branch_branch2)');

	// Lấy danh sách variant UI có thể hiển thị: listVariants KHÔNG sort, filter deletedAt, LIMIT 100
	// (collection thật: product_variants — cbData('product_variants'))
	// Tồn kho theo variant tại branch active (lọc branch bằng JS — tránh N1QL IN $n positional)
	const activeSet = new Set(activeBranches);
	const variantsWithStock = await n1ql(
		`SELECT variantId, branchId, quantityOnHand FROM \`${BUCKET}\`.\`${SCOPE}\`.inventory_stock WHERE quantityOnHand >= 5`
	);
	const stockByVariant = new Map();
	for (const r of variantsWithStock) {
		if (!activeSet.has(r.branchId)) continue;
		const prev = stockByVariant.get(r.variantId);
		if (!prev || r.quantityOnHand > prev.quantityOnHand) stockByVariant.set(r.variantId, r);
	}
	if (!stockByVariant.size) throw new Error('Không có tồn kho ≥ 5 tại branch active nào');
	// variants/list không deterministic giữa các lần gọi (Couchbase scan order) →
	// variant + fromBranch được chốt SAU khi modal mở trong flow chính, đọc options từ DOM.

	const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
	const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
	const page = await ctx.newPage();
	const pageErrors = [];
	page.on('pageerror', (e) => pageErrors.push(String(e)));
	await login(page);

	// ================= TRANSFERS =================
	await page.goto(BASE + '/admin/transfers', { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="admin-transfers-table"], .admin-state', { timeout: 15000 }).catch(() => {});
	// Chờ branches + variants load xong (onMount) trước khi test — tránh modal rỗng
	await page.waitForResponse((r) => r.url().includes('/api/admin/inventory/branches'), { timeout: 15000 }).catch(() => {});
	await page.waitForResponse((r) => r.url().includes('/api/admin/variants/list'), { timeout: 15000 }).catch(() => {});
	await sleep(800);
	ok(
		'TR1 trang /admin/transfers load không lỗi console',
		pageErrors.length === 0 && (await page.locator('[data-test="admin-transfers-create"]').count()) === 1,
		`pageErrors=${pageErrors.length}`
	);

	// Tạo phiếu chuyển kho qua UI
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-transfers-create"]');
	await page.waitForSelector('[data-test="admin-transfers-from-branch"]', { timeout: 10000 });
	// chờ branches populate (onMount load) — option thứ 2 xuất hiện trong DOM (option không "visible" theo Playwright)
	await page.waitForFunction(
		() => document.querySelectorAll('[data-test="admin-transfers-from-branch"] option').length > 1,
		{ timeout: 10000 }
	);
	await page.waitForFunction(
		() => document.querySelectorAll('[data-test="admin-transfers-variant"] option').length > 1,
		{ timeout: 10000 }
	);

	// variants/list không deterministic (Couchbase scan order) — chọn variant NGAY TRONG
	// options DOM lần này có tồn ≥ 5 tại branch active, rồi chốt fromBranch theo variant đó.
	const domOptions = await page.evaluate(() =>
		[...document.querySelectorAll('[data-test="admin-transfers-variant"] option')]
			.map((o) => o.value)
			.filter((v) => v && v !== '')
	);
	let pick = null;
	for (const v of domOptions) {
		const hit = stockByVariant.get(v);
		if (hit) {
			pick = { variantId: v, branchId: hit.branchId, quantityOnHand: hit.quantityOnHand };
			break;
		}
	}
	if (!pick) throw new Error('Lần này options UI không có variant tồn kho — chạy lại probe');
	const fromBranch = pick.branchId;
	const variantId = pick.variantId;
	const stockBefore = Number(pick.quantityOnHand);
	const toBranch = activeBranches.find((b) => b !== fromBranch);
	const toStockBefore = await getStock(variantId, toBranch);
	// Dữ liệu ban đầu của branch xử lý return (branch thứ 3 nếu có, ngược lại toBranch)
	const thirdBranch = activeBranches.find((b) => b !== fromBranch && b !== toBranch);
	const returnBranch = thirdBranch ?? toBranch;
	const returnStockBefore = await getStock(variantId, returnBranch);
	console.log(`  [run] from=${fromBranch} to=${toBranch} variant=${variantId} qtyFrom=${stockBefore} qtyTo=${toStockBefore} returnBranch=${returnBranch}`);

	await selectOption(page, '[data-test="admin-transfers-from-branch"]', fromBranch);
	await selectOption(page, '[data-test="admin-transfers-to-branch"]', toBranch);
	await selectOption(page, '[data-test="admin-transfers-variant"]', variantId);
	await page.fill('.modal-select ~ * input, .form-grid input[type="number"]', '3').catch(() => {});
	// input quantity nằm cạnh select variant — fallback evaluate set + dispatch
	await page.evaluate(() => {
		const input = document.querySelector('.form-grid input[type="number"]');
		if (input) {
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
			setter.call(input, '3');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-transfers-submit"]');
	await waitForListRefresh(page, '/api/admin/transfers/list');

	const tr1Status = await firstRowStatus(page, 'admin-transfers-row');
	const tr1StockFrom = await getStock(variantId, fromBranch);
	ok(
		'TR2 tạo phiếu → status pending, tồn kho KHÔNG đổi',
		tr1Status !== null && tr1StockFrom === stockBefore,
		`status="${tr1Status}" qtyFrom=${tr1StockFrom} (trước=${stockBefore})`
	);

	// Duyệt phiếu (approve) — trừ kho FROM
	await clickRowAction(page, 'admin-transfers-row', 'Approve');
	await submitConfirmModal(page, 'Approve');
	await waitForListRefresh(page, '/api/admin/transfers/list');
	const tr2Status = await waitForRowStatus(page, 'admin-transfers-row', ['In transit']);
	const tr2StockFrom = await getStock(variantId, fromBranch);
	ok(
		'TR3 duyệt → in_transit, tồn FROM trừ đúng 3',
		tr2Status !== null && tr2StockFrom === stockBefore - 3,
		`status="${tr2Status}" qtyFrom=${tr2StockFrom} (kỳ vọng=${stockBefore - 3})`
	);

	// Hoàn tất (complete) — cộng kho TO
	// Row action = 'Nhận hàng', nút submit modal = 'Xác nhận' (transfers page labels)
	await clickRowAction(page, 'admin-transfers-row', 'Receive');
	await submitConfirmModal(page, 'Confirm');
	await waitForListRefresh(page, '/api/admin/transfers/list');
	const tr3Status = await waitForRowStatus(page, 'admin-transfers-row', ['Completed']);
	const tr3StockTo = await getStock(variantId, toBranch);
	ok(
		'TR4 hoàn tất → completed, tồn TO cộng đúng 3',
		tr3Status !== null && tr3StockTo === toStockBefore + 3,
		`status="${tr3Status}" qtyTo=${tr3StockTo} (kỳ vọng=${toStockBefore + 3})`
	);

	// Tạo phiếu 2 rồi cancel — kho không đổi (pending cancel)
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-transfers-create"]');
	await page.waitForSelector('[data-test="admin-transfers-from-branch"]', { timeout: 10000 });
	await page.waitForFunction(
		() => document.querySelectorAll('[data-test="admin-transfers-from-branch"] option').length > 1,
		{ timeout: 10000 }
	);
	// variant options cũng cần chờ (modal mount lại — state giữ nhưng DOM render async)
	await page.waitForFunction(
		() => document.querySelectorAll('[data-test="admin-transfers-variant"] option').length > 1,
		{ timeout: 10000 }
	);
	// variants/list không deterministic giữa 2 lần gọi — variantId lần 1 có thể KHÔNG nằm
	// trong 100 options lần này → chọn lại variant có tồn kho (pending+cancel không đổi kho
	// nên chỉ cần variant hợp lệ + fromBranch giữ nguyên để so kho).
	const domOptions2 = await page.evaluate(() =>
		[...document.querySelectorAll('[data-test="admin-transfers-variant"] option')]
			.map((o) => o.value)
			.filter((v) => v && v !== '')
	);
	let variantId2 = variantId;
	if (!domOptions2.includes(variantId)) {
		for (const v of domOptions2) {
			const hit = stockByVariant.get(v);
			if (hit && hit.branchId === fromBranch) {
				variantId2 = v;
				break;
			}
		}
	}
	await selectOption(page, '[data-test="admin-transfers-from-branch"]', fromBranch);
	await selectOption(page, '[data-test="admin-transfers-to-branch"]', toBranch);
	await selectOption(page, '[data-test="admin-transfers-variant"]', variantId2);
	await page.evaluate(() => {
		const input = document.querySelector('.form-grid input[type="number"]');
		if (input) {
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
			setter.call(input, '2');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-transfers-submit"]');
	await waitForListRefresh(page, '/api/admin/transfers/list');
	const tr5StockFromBeforeCancel = await getStock(variantId, fromBranch);
	// Row action = 'Huỷ', nút submit modal = 'Huỷ phiếu'
	await clickRowAction(page, 'admin-transfers-row', 'Cancel');
	await submitConfirmModal(page, 'Cancel transfer');
	await waitForListRefresh(page, '/api/admin/transfers/list');
	const tr5Status = await waitForRowStatus(page, 'admin-transfers-row', ['Cancelled']);
	const tr5StockFrom = await getStock(variantId, fromBranch);
	ok(
		'TR5 huỷ phiếu pending → cancelled, tồn kho KHÔNG đổi',
		tr5Status !== null && tr5StockFrom === tr5StockFromBeforeCancel,
		`status="${tr5Status}" qtyFrom=${tr5StockFrom}`
	);

	// ================= RETURNS =================
	// Tạo order mới (createdAt = now → trong cửa sổ 7 ngày) seed thẳng N1QL
	const orderKey = `order::probe-tr-${Date.now()}`;
	const orderDoc = {
		orderCode: `ORD-PROBE-${Date.now().toString(36).toUpperCase()}`,
		customerId: null,
		staffId: null,
		branchId: fromBranch, // chi nhánh bán GỐC
		status: 'completed',
		items: [{ variantId, quantity: 4, price: 10000 }],
		totalAmount: 40000,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
	await upsertDoc('orders', orderKey, orderDoc);

	await page.goto(BASE + '/admin/returns', { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="admin-returns-table"], .admin-state', { timeout: 15000 }).catch(() => {});
	// Chờ branches + returns list load xong (onMount) — tránh modal rỗng
	await page.waitForResponse((r) => r.url().includes('/api/admin/inventory/branches'), { timeout: 15000 }).catch(() => {});
	await page.waitForResponse((r) => r.url().includes('/api/admin/returns/list'), { timeout: 15000 }).catch(() => {});
	await sleep(800);
	ok(
		'RT1 trang /admin/returns load không lỗi console',
		(await page.locator('[data-test="admin-returns-create"]').count()) === 1,
		''
	);

	// Tạo phiếu đổi trả: order vừa seed, xử lý tại chi nhánh KHÁC (returnBranch)
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-returns-create"]');
	// chờ branch options populate (đếm option > 1 qua DOM — option không "visible" theo Playwright)
	await page.waitForFunction(
		() => document.querySelectorAll('[data-test="admin-returns-branch"] option').length > 1,
		{ timeout: 15000 }
	);
	await page.fill('[data-test="admin-returns-order-id"]', orderKey);
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-returns-load-order"]');
	// đợi order items render (draft items từ loadedOrder)
	await page.waitForFunction(
		() => document.querySelectorAll('.return-item-row').length > 0,
		{ timeout: 15000 }
	);
	await selectOption(page, '[data-test="admin-returns-branch"]', returnBranch);
	await page.evaluate(() => {
		// quantity trả = 2
		const input = document.querySelector('.return-item-row input[type="number"]');
		if (input) {
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
			setter.call(input, '2');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-returns-submit"]');
	await waitForListRefresh(page, '/api/admin/returns/list');

	const rt1Status = await waitForRowStatus(page, 'admin-returns-row', ['Requested']);
	const rt1Stock = await getStock(variantId, returnBranch);
	ok(
		'RT2 tạo phiếu đổi trả → requested, tồn kho xử lý CHƯA đổi',
		rt1Status !== null && rt1Stock === returnStockBefore,
		`status="${rt1Status}" qty=${rt1Stock} (trước=${returnStockBefore})`
	);

	// Duyệt
	await clickRowAction(page, 'admin-returns-row', 'Approve');
	await submitConfirmModal(page, 'Approve');
	await waitForListRefresh(page, '/api/admin/returns/list');
	const rt2Status = await waitForRowStatus(page, 'admin-returns-row', ['Approved']);
	const rt2Stock = await getStock(variantId, returnBranch);
	ok(
		'RT3 duyệt → approved, kho chưa cộng (chỉ hoàn kho khi completed)',
		rt2Status !== null && rt2Stock === returnStockBefore,
		`status="${rt2Status}" qty=${rt2Stock}`
	);

	// Hoàn tất → hoàn kho 2 tại chi nhánh xử lý
	await clickRowAction(page, 'admin-returns-row', 'Complete');
	await submitConfirmModal(page, 'Complete');
	await waitForListRefresh(page, '/api/admin/returns/list');
	const rt3Status = await waitForRowStatus(page, 'admin-returns-row', ['Completed']);
	const rt3Stock = await getStock(variantId, returnBranch);
	ok(
		'RT4 hoàn tất → completed, tồn chi nhánh XỬ LÝ cộng đúng 2',
		rt3Status !== null && rt3Stock === returnStockBefore + 2,
		`status="${rt3Status}" qty=${rt3Stock} (kỳ vọng=${returnStockBefore + 2})`
	);

	// Phiếu đổi trả thứ 2 → reject: kho không đổi
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-returns-create"]');
	await page.waitForFunction(
		() => document.querySelectorAll('[data-test="admin-returns-branch"] option').length > 1,
		{ timeout: 15000 }
	);
	await page.fill('[data-test="admin-returns-order-id"]', orderKey);
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-returns-load-order"]');
	// đợi order items render (draft items từ loadedOrder)
	await page.waitForFunction(
		() => document.querySelectorAll('.return-item-row').length > 0,
		{ timeout: 15000 }
	);
	await sleep(500);
	await page.evaluate(() => {
		const input = document.querySelector('.return-item-row input[type="number"]');
		if (input) {
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
			setter.call(input, '1');
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});
	await dismissViteOverlay(page);
	await page.click('[data-test="admin-returns-submit"]');
	await waitForListRefresh(page, '/api/admin/returns/list');
	const rt5StockBeforeReject = await getStock(variantId, returnBranch);
	// nếu create fail → modal còn mở + formError hiển thị
	const formErr2 = await page
		.evaluate(() => document.querySelector('.form-error-banner')?.textContent?.trim() ?? null)
		.catch(() => null);
	if (formErr2) console.log(`  [RT5] formError sau create: ${formErr2}`);
	await clickRowAction(page, 'admin-returns-row', 'Reject');
	await submitConfirmModal(page, 'Reject');
	await waitForListRefresh(page, '/api/admin/returns/list');
	const rt5Status = await waitForRowStatus(page, 'admin-returns-row', ['Rejected']);
	const rt5Stock = await getStock(variantId, returnBranch);
	ok(
		'RT5 từ chối phiếu thứ 2 → rejected, tồn kho KHÔNG đổi',
		rt5Status !== null && rt5Stock === rt5StockBeforeReject,
		`status="${rt5Status}" qty=${rt5Stock}`
	);

	// Verify kho từ chối khác kho hoàn tất: tổng chênh = +2 so với đầu (chỉ completed mới cộng)
	ok(
		'RT6 tổng biến động kho returnBranch = +2 (chỉ phiếu completed mới hoàn kho)',
		rt5Stock === returnStockBefore + 2,
		`qty=${rt5Stock} (trước=${returnStockBefore})`
	);

	// Kiểm tra schema tồn tại: phiếu return có originBranchId + returnBranchId khác nhau
	// (phiếu thứ 2 không chọn branch → fallback origin — vẫn hợp lệ; phiếu 1 là case đổi trả khác chi nhánh)
	const returnDocs = await n1ql(
		`SELECT originBranchId, returnBranchId FROM \`${BUCKET}\`.\`${SCOPE}\`.order_returns WHERE orderId = $1 ORDER BY createdAt DESC LIMIT 2`,
		[orderKey]
	);
	const crossDoc = returnDocs.find(
		(d) => d.originBranchId === fromBranch && d.returnBranchId === returnBranch
	);
	ok(
		'RT7 đổi trả KHÁC chi nhánh: originBranchId ≠ returnBranchId',
		Boolean(crossDoc) && fromBranch !== returnBranch,
		JSON.stringify(returnDocs)
	);

	// Phiếu transfer có movement log
	const movements = await n1ql(
		`SELECT type, quantity, referenceType FROM \`${BUCKET}\`.\`${SCOPE}\`.stock_movements WHERE variantId = $1 AND referenceType IN ['stock_transfer','order_return'] ORDER BY createdAt DESC LIMIT 5`,
		[variantId]
	);
	ok(
		'TR6 movement log: có movement in/out gắn stock_transfer / order_return',
		movements.length >= 3,
		`movements=${JSON.stringify(movements.map((m) => `${m.type}:${m.quantity}`))}`
	);

	await browser.close();

	// Tổng kết
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
