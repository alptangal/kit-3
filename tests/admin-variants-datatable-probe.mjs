// tests/admin-variants-datatable-probe.mjs
// Probe B6.2 (Pha 3) — Variants page migrate DataTable + Pagination:
//   B1. DataTable render (root [data-test=variants-datatable]) + thead 7 cột
//       (variant/product/sku/attributes/price/status/updated/actions)
//   B2. tbody có data row — nếu rỗng: tạo variant test qua modal (cần ≥1
//       product; nếu DB hết product → tạo host product qua flow thật)
//   B3. Cột actions: 2 nút (edit/delete)
//   B4. Status pill class datatable-status--*
//   B5. Pagination compact + total-count + page-info
//   B6. Search "zzz-no-match" → 0 data row; xóa search → row trở lại
//   B7. Filter product select render options (fetchProducts OK)
//   B8. Page size 10 → refetch ≤ 10 row
//   B9. Click Edit → modal mở + displayName điền sẵn giá trị variant
//   B10. Toggle showDeleted → refetch OK
//   B11. 0 pageerror / 0 console error
// Mobile (context touch thật):
//   B12. th + td actions ẩn
//   B13. Table không tràn ngang
//   B14. Tap row → expand bar 2 nút, 0 tràn viewport
//   B15. Tap Edit trong bar → modal mở
//   B16. 0 pageerror
// LƯU Ý: tbody tr gồm cả skeleton row (--skeleton) khi loading và empty row
// (--datatable-empty-row) khi rỗng — data row phải loại cả hai.
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Đếm data row thật (loại skeleton + empty row).
async function countRows(page) {
	return page.evaluate(
		() =>
			document.querySelectorAll(
				'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
			).length
	);
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

// Poll fetch xong: PHẢI thấy skeleton xuất hiện rồi biến mất mới tính là
// "1 fetch đã hoàn tất" (empty-row render ngay khi mount trước fetch đầu).
async function waitStable(page, maxMs = 25000) {
	const t0 = Date.now();
	let sawSkeleton = false;
	while (Date.now() - t0 < maxMs) {
		const loading = await page.evaluate(
			() =>
				!!document.querySelector(
					'[data-test="variants-datatable"] .datatable-row--skeleton, [data-test="variants-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) return await countRows(page);
		await sleep(300);
	}
	return sawSkeleton ? await countRows(page) : -1;
}

// Tạo variant qua modal create (flow thật). Select product đầu tiên nếu có.
// Thứ tự input trong modal: sku(0), barcode(1), displayName(2), price(3).
async function createVariant(page, displayName) {
	const modal = page.locator('[role="dialog"]');
	const productSelect = modal.locator('select').first();
	// Poll đợi fetchProducts về (select phải có ≥2 option) — fetchSecure RSA
	// lần đầu có thể chậm; không đợi sẽ submit thiếu product → modal kẹt.
	let optCount = 0;
	for (let i = 0; i < 30; i++) {
		optCount = await productSelect.locator('option').count();
		if (optCount > 1) break;
		await sleep(500);
	}
	if (optCount > 1) {
		const opts = await productSelect.locator('option').all();
		const v = await opts[1].getAttribute('value');
		if (v) await productSelect.selectOption(v);
		await sleep(400);
	} else {
		console.log('[dbg] product select vẫn rỗng sau 15s — submit sẽ fail "Product is required"');
	}
	await modal.locator('input').nth(0).fill(`PROBE-SKU-${Date.now()}`);
	await sleep(400);
	await modal.locator('input').nth(2).fill(displayName);
	await sleep(400);
	await modal.locator('input').nth(3).fill('50000');
	await sleep(400);
	await modal
		.locator('button', { hasText: /Tạo biến thể|Create Variant/ })
		.last()
		.click();
	await sleep(2000);
	const rows = await waitStable(page, 20000);
	// Create fail → modal kẹt mở chặn mọi click sau — đóng an toàn.
	const stillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
	if (stillOpen) {
		console.log('[dbg] modal vẫn mở sau submit — đóng để probe chạy tiếp');
		await page.keyboard.press('Escape');
		await sleep(800);
		const open2 = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
		if (open2) {
			await modal.locator('button', { hasText: /Huỷ|Cancel/ }).last().click();
			await sleep(800);
		}
	}
	return rows;
}

// DB hết product → tạo host product qua flow thật ở /admin/products rồi quay lại.
async function ensureProductExists(page) {
	await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await sleep(1500);
	const hasRow = await page.evaluate(
		() =>
			document.querySelectorAll(
				'[data-test="products-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
			).length > 0
	);
	if (!hasRow) {
		await page.locator('button', { hasText: /Thêm sản phẩm|Add Product/ }).first().click();
		await sleep(900);
		await page.locator('[role="dialog"] input').first().fill('Probe Variant Host Product');
		await sleep(500);
		await page
			.locator('[role="dialog"] button', { hasText: /Tạo sản phẩm|Create Product/ })
			.last()
			.click();
		await sleep(2000);
	}
	await page.goto(`${BASE}/admin/variants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await sleep(1500);
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
// deleteVariant dùng confirm() native
page.on('dialog', (d) => d.accept());

await login(page);
await page.goto(`${BASE}/admin/variants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
let rowCount = await waitStable(page);

// ── B0: dọn variant test sót từ các lần chạy trước.
{
	const testPattern = /Probe Variant \d+|Probe Mobile Variant \d+/;
	const rows = page.locator('[data-test="variants-datatable"] tbody tr', { hasText: testPattern });
	let removed = 0;
	while ((await rows.count()) > 0 && removed < 20) {
		await rows.first().locator('[data-test="variant-action-delete"]').click();
		await sleep(2500);
		removed++;
		await waitStable(page, 15000);
	}
	rowCount = await countRows(page);
	console.log(`[cleanup] removed ${removed} leftover test variants — rows now ${rowCount}`);
}

// ── B1: DataTable root + thead 7 cột ──
{
	const st = await page.evaluate(() => {
		const root = document.querySelector('[data-test="variants-datatable"]');
		const ths = root ? root.querySelectorAll('thead th') : [];
		return {
			hasRoot: !!root,
			thCount: ths.length,
			thText: [...ths].map((t) => t.textContent.trim()).slice(0, 8),
			isDatatable: root ? root.className.includes('datatable') : false
		};
	});
	ok(
		'B1 · DataTable render + thead (7 cột + actions)',
		st.hasRoot && st.isDatatable && st.thCount === 8,
		JSON.stringify(st)
	);
}

// ── B2: nếu bảng rỗng → tạo variant test qua modal ──
const testVariantName = `Probe Variant ${Date.now()}`;
let createdTestVariant = false;
if (rowCount === 0) {
	// Cần ≥1 product cho select trong modal — DB trống thì seed host product.
	const hasProductOption = await page.evaluate(() => {
		const sel = document.querySelector('.admin-filters select.admin-select');
		return sel ? sel.querySelectorAll('option').length > 1 : false;
	});
	if (!hasProductOption) await ensureProductExists(page);
	await page.locator('button', { hasText: /Thêm biến thể|Add Variant/ }).first().click();
	await sleep(900);
	rowCount = await createVariant(page, testVariantName);
	createdTestVariant = true;
}
{
	const st = await page.evaluate(() => {
		const rows = document.querySelectorAll(
			'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		const first = rows[0];
		const tds = first ? [...first.querySelectorAll('td')] : [];
		return {
			rowCount: rows.length,
			firstName: tds[0]?.textContent?.trim().slice(0, 40) ?? ''
		};
	});
	ok(
		'B2 · tbody có data row',
		rowCount > 0 && st.rowCount > 0 && st.firstName.length > 0,
		JSON.stringify(st)
	);
}

// ── B3: 2 nút actions (edit/delete) trong row 1 ──
{
	const st = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		const actionsTd = row?.querySelector('td:last-child');
		const btns = actionsTd ? actionsTd.querySelectorAll('button') : [];
		return {
			btnCount: btns.length,
			labels: [...btns].map((b) => b.textContent.trim())
		};
	});
	ok('B3 · Row actions: 2 nút (Sửa/Xoá)', st.btnCount === 2, JSON.stringify(st));
}

// ── B4: status pill ──
{
	const st = await page.evaluate(() => {
		const pills = document.querySelectorAll('[data-test="variants-datatable"] .datatable-status');
		const classes = [...pills].map((p) => p.className.match(/datatable-status--(\w+)/)?.[1] ?? '?');
		return { pillCount: pills.length, kinds: [...new Set(classes)] };
	});
	ok('B4 · Status pill render (datatable-status--*)', st.pillCount > 0, JSON.stringify(st));
}

// ── B5: Pagination + total-count ──
{
	const st = await page.evaluate(() => {
		const pag = document.querySelector('.admin-pagination');
		const buttons = pag ? [...pag.querySelectorAll('button')] : [];
		const pageInfo = pag?.querySelector('.page-info')?.textContent?.trim() ?? '';
		const total = pag?.querySelector('.total-count')?.textContent?.trim() ?? '';
		return { hasPag: !!pag, btnCount: buttons.length, pageInfo, total };
	});
	ok(
		'B5 · Pagination compact + page info + total',
		st.hasPag && st.btnCount >= 2 && st.pageInfo.length > 0 && st.total.length > 0,
		JSON.stringify(st)
	);
}

// ── B6: search no-match → rỗng; xóa → row trở lại ──
{
	const searchInput = page.locator('.admin-search input');
	await searchInput.fill('zzz-no-match-xyz');
	await sleep(1000);
	const emptyRows = await waitStable(page, 20000);
	await searchInput.fill('');
	await sleep(1000);
	const backRows = await waitStable(page, 20000);
	ok(
		'B6 · Search no-match → 0 row; xóa search → row trở lại',
		emptyRows === 0 && backRows > 0,
		`empty=${emptyRows} back=${backRows}`
	);
}

// ── B7: filter select product có options (fetchProducts OK) ──
{
	const st = await page.evaluate(() => {
		const filters = document.querySelector('.admin-filters');
		const selects = filters ? [...filters.querySelectorAll('select.admin-select')] : [];
		return {
			filterSelectCount: selects.length,
			optionCounts: selects.map((s) => s.querySelectorAll('option').length)
		};
	});
	// 1 select filter (product) — page-size select nằm trong pagination không
	// thuộc .admin-filters. Options ≥ 2 khi DB có product (host product đảm bảo).
	ok(
		'B7 · Filter select product render + có options',
		st.filterSelectCount === 1 && st.optionCounts[0] >= 2,
		JSON.stringify(st)
	);
}

// ── B8: page size 10 ──
{
	const select = page.locator('.admin-pagination select.admin-select');
	await select.selectOption('10');
	const rows = await waitStable(page, 20000);
	const pageInfo = await page.evaluate(
		() => document.querySelector('.page-info')?.textContent?.trim() ?? ''
	);
	ok(
		'B8 · Page size 10 → refetch, ≤ 10 row',
		rows > 0 && rows <= 10 && pageInfo.includes('1'),
		`rows=${rows} pageInfo="${pageInfo}"`
	);
	await select.selectOption('20');
	await waitStable(page, 20000);
}

// ── B10: toggle showDeleted ──
{
	const cb = page
		.locator('.admin-filters input[type="checkbox"], .admin-filters [role="checkbox"]')
		.first();
	await cb.click();
	await waitStable(page, 20000);
	const st = await page.evaluate(() => ({
		hasTable: !!document.querySelector('[data-test="variants-datatable"]'),
		hasError: !!document.querySelector('[data-test="variants-load-error"]')
	}));
	ok(
		'B10 · Toggle showDeleted → refetch OK (không error)',
		st.hasTable && !st.hasError,
		JSON.stringify(st)
	);
	await cb.click();
	await waitStable(page, 20000);
}

// ── B9: click Edit → modal mở + displayName điền sẵn ──
{
	const firstName = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		return row?.querySelector('td')?.textContent?.trim() ?? '';
	});
	await page.locator('[data-test="variant-action-edit"]').first().click();
	await sleep(900);
	const st = await page.evaluate(() => {
		const modal = document.querySelector('[role="dialog"], .modal-container, .modal');
		// displayName input theo placeholder (vi: 'Nhập tên hiển thị' / en:
		// 'Enter display name') — an toàn với input attributes động.
		const nameInput = modal?.querySelector(
			'input[placeholder*="hiển thị"], input[placeholder*="display name"]'
		);
		return {
			hasModal: !!modal,
			nameValue: nameInput?.value ?? ''
		};
	});
	// Cột variant render "displayName · barcode" — so theo prefix trước " · "
	const expectedClean = firstName.split(' · ')[0];
	ok(
		'B9 · Click Sửa → modal mở + displayName điền sẵn',
		st.hasModal && st.nameValue.length > 0 && st.nameValue === expectedClean,
		`expected="${expectedClean}" got="${st.nameValue}"`
	);
	await page.keyboard.press('Escape');
	await sleep(800);
	const stillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
	if (stillOpen) {
		console.log('[dbg] Escape chưa đóng — fallback click Cancel');
		await page.locator('[role="dialog"] button', { hasText: /Huỷ|Cancel/ }).last().click();
		await sleep(800);
	}
}

// Dọn variant test (nếu probe đã tạo)
if (createdTestVariant) {
	const delBtn = page
		.locator('[data-test="variants-datatable"] tbody tr', { hasText: testVariantName })
		.locator('[data-test="variant-action-delete"]')
		.first();
	await delBtn.click();
	await sleep(3500);
	await waitStable(page, 15000);
}

ok('B11 · 0 pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
const hardConsoleErrors = consoleErrors.filter(
	(m) => !m.includes('favicon') && !m.includes('sourcemap') && !m.includes('DevTools') && !m.includes('405')
);
ok('B11 · 0 console error', hardConsoleErrors.length === 0, hardConsoleErrors.join(' | ').slice(0, 200));

await browser.close();

// ── Mobile (context touch thật) ──
const mbrowser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const mctx = await mbrowser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 375, height: 700 },
	hasTouch: true,
	isMobile: true,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
});
const mpage = await mctx.newPage();
const mErrors = [];
mpage.on('pageerror', (e) => mErrors.push(e.message));
mpage.on('dialog', (d) => d.accept());

await login(mpage);
await mpage.goto(`${BASE}/admin/variants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitStable(mpage);

// Chuẩn bị: mobile cần ít nhất 1 data row — tạo variant tạm nếu bảng trống.
const mobileVariantName = `Probe Mobile Variant ${Date.now()}`;
let mobileVariantCreated = false;
{
	const row = mpage.locator(
		'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	).first();
	if ((await row.count()) === 0) {
		await ensureProductExists(mpage);
		await mpage.locator('button', { hasText: /Thêm biến thể|Add Variant/ }).first().click();
		await sleep(900);
		const modal = mpage.locator('[role="dialog"]');
		const productSelect = modal.locator('select').first();
		// Poll đợi fetchProducts về (select ≥2 option) — mobile fetchSecure RSA
		// lần đầu chậm; không đợi sẽ submit thiếu product → modal kẹt.
		let optCount = 0;
		for (let i = 0; i < 30; i++) {
			optCount = await productSelect.locator('option').count();
			if (optCount > 1) break;
			await sleep(500);
		}
		if (optCount > 1) {
			const opts = await productSelect.locator('option').all();
			const v = await opts[1].getAttribute('value');
			if (v) await productSelect.selectOption(v);
			await sleep(400);
		} else {
			console.log('[dbg-mobile] product select vẫn rỗng sau 15s — bỏ qua tạo');
		}
		await modal.locator('input').nth(0).fill(`PROBE-SKU-M-${Date.now()}`);
		await sleep(400);
		await modal.locator('input').nth(2).fill(mobileVariantName);
		await sleep(400);
		// NOTE: KHÔNG fill price trên mobile — Input type=number mobile render
		// readonly + width auto-resize (ô rỗng ~4px, "not visible", không fill
		// được; gõ phải qua visual keyboard component). Price trống → submit
		// parse '' → 0, vẫn hợp lệ — đủ cho mục đích probe (cần 1 data row).
		await modal
			.locator('button', { hasText: /Tạo biến thể|Create Variant/ })
			.last()
			.click();
		await sleep(2000);
		await waitStable(mpage, 20000);
		// Create fail → modal kẹt mở chặn tap sau — đóng an toàn.
		const stillOpen = await mpage.evaluate(() => !!document.querySelector('[role="dialog"]'));
		if (stillOpen) {
			console.log('[dbg-mobile] modal vẫn mở sau submit — đóng để probe chạy tiếp');
			await mpage.keyboard.press('Escape');
			await sleep(800);
			const open2 = await mpage.evaluate(() => !!document.querySelector('[role="dialog"]'));
			if (open2) {
				await modal.locator('button', { hasText: /Huỷ|Cancel/ }).last().tap();
				await sleep(800);
			}
		}
		mobileVariantCreated = true;
	}
}

// B12: th + td actions ẩn
{
	const st = await mpage.evaluate(() => {
		const th = document.querySelector('.datatable-th--actions');
		const td = document.querySelector('.datatable-td--actions');
		return {
			thDisplay: th ? getComputedStyle(th).display : 'none-found',
			tdDisplay: td ? getComputedStyle(td).display : 'none-found'
		};
	});
	ok(
		'B12 · Mobile: cột actions ẩn (th + td)',
		st.thDisplay === 'none' && st.tdDisplay === 'none',
		JSON.stringify(st)
	);
}

// B13: không tràn ngang
{
	const st = await mpage.evaluate(() => {
		const wrap = document.querySelector('.admin-table-wrap');
		return { client: wrap.clientWidth, scroll: wrap.scrollWidth };
	});
	ok('B13 · Mobile: table gọn khung', st.scroll <= st.client, JSON.stringify(st));
}

// B14: tap row → expand bar 2 nút, 0 tràn
{
	await mpage
		.locator(
			'[data-test="variants-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		)
		.first()
		.tap();
	await sleep(700);
	const st = await mpage.evaluate(() => {
		const bar = document.querySelector('[data-role="mobile-actions"]');
		const btns = bar ? [...bar.querySelectorAll('button')] : [];
		const rects = btns.map((b) => b.getBoundingClientRect());
		return {
			hasBar: !!bar,
			btnCount: btns.length,
			overflow: rects.filter((r) => r.right > window.innerWidth || r.x < 0).length,
			innerWidth: window.innerWidth,
			rects: rects.map((r) => ({ x: Math.round(r.x), right: Math.round(r.right), top: Math.round(r.top) }))
		};
	});
	ok(
		'B14 · Mobile: tap row → 2 nút, 0 tràn viewport',
		st.hasBar && st.btnCount === 2 && st.overflow === 0,
		JSON.stringify(st)
	);
}

// B15: tap Edit trong bar → modal mở
{
	const edit = mpage
		.locator('[data-role="mobile-actions"] [data-test="variant-action-edit"]')
		.first();
	await edit.tap();
	await sleep(900);
	const st = await mpage.evaluate(() => ({
		hasModal: !!document.querySelector('[role="dialog"], .modal-container, .modal')
	}));
	ok('B15 · Mobile: tap Edit → modal mở', st.hasModal, JSON.stringify(st));
}

ok('B16 · Mobile: 0 pageerror', mErrors.length === 0, mErrors.join(' | ').slice(0, 200));

// Dọn variant test mobile (nếu đã tạo) — qua nút Delete trong bar expand.
if (mobileVariantCreated) {
	await mpage.keyboard.press('Escape');
	await sleep(900);
	let modalStill = await mpage.evaluate(() => !!document.querySelector('[role="dialog"]'));
	if (modalStill) {
		console.log('[dbg-mobile] Escape chưa đóng modal — fallback Cancel');
		await mpage.locator('[role="dialog"] button', { hasText: /Huỷ|Cancel/ }).last().tap();
		await sleep(900);
		modalStill = await mpage.evaluate(() => !!document.querySelector('[role="dialog"]'));
	}
	if (modalStill) console.log('[dbg-mobile] modal vẫn mở — thử tiếp, delete có thể vẫn chặn');

	const rows = mpage.locator('[data-test="variants-datatable"] tbody tr', {
		hasText: mobileVariantName
	});
	let guard = 0;
	while ((await rows.count()) > 0 && guard++ < 6) {
		await rows.first().tap();
		await sleep(800);
		const hasBar = await mpage.evaluate(() => !!document.querySelector('[data-role="mobile-actions"]'));
		if (!hasBar) {
			await rows.first().tap();
			await sleep(800);
		}
		const del = mpage
			.locator('[data-role="mobile-actions"] [data-test="variant-action-delete"]')
			.first();
		if ((await del.count()) === 0) {
			console.log(`[dbg-mobile] vòng ${guard}: không thấy nút delete — bỏ qua vòng này`);
			continue;
		}
		await del.tap();
		await sleep(2500);
		await waitStable(mpage, 15000);
	}
}

await mbrowser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n══ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ══`);
if (failed.length) {
	console.log('FAIL list:');
	failed.forEach((f) => console.log(`  - ${f.name} — ${f.extra}`));
	process.exitCode = 1;
}
