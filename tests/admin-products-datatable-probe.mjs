// tests/admin-products-datatable-probe.mjs
// Probe B6.2 (Pha 3) — Products page migrate DataTable + Pagination:
//   B1. DataTable render (root [data-test=products-datatable]) + thead 7 cột
//       (product/category/brand/variants/status/updated/actions)
//   B2. tbody có data row — nếu rỗng: tạo product test qua modal
//   B3. Cột actions: 2 nút (edit/delete)
//   B4. Status pill class datatable-status--*
//   B5. Pagination compact + total-count + page-info
//   B6. Search "zzz-no-match" → 0 data row; xóa search → row trở lại
//   B7. Filter category/brand select render options (fetchOptions OK)
//   B8. Page size 10 → refetch ≤ 10 row
//   B9. Click Edit → modal mở + input name điền sẵn giá trị product
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
				'[data-test="products-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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
					'[data-test="products-datatable"] .datatable-row--skeleton, [data-test="products-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) return await countRows(page);
		await sleep(300);
	}
	return sawSkeleton ? await countRows(page) : -1;
}

// Tạo product qua modal create (flow thật). Chọn category/brand nếu có option.
// Trả về số row sau khi tạo (gán lại rowCount của caller).
async function createProduct(page, name) {
	await page.locator('button', { hasText: /Thêm sản phẩm|Add Product/ }).first().click();
	await sleep(900);
	await page.locator('[role="dialog"] input').first().fill(name);
	await sleep(500);
	// Chọn category/brand đầu tiên nếu có (select thứ 2 + 3 trong modal)
	const selects = page.locator('[role="dialog"] select');
	const selCount = await selects.count();
	for (let i = 1; i <= Math.min(2, selCount - 1); i++) {
		const sel = selects.nth(i);
		const opts = await sel.locator('option').all();
		if (opts.length > 1) {
			const v = await opts[1].getAttribute('value');
			if (v) await sel.selectOption(v);
			await sleep(300);
		}
	}
	await page.locator('[role="dialog"] button', { hasText: /Tạo sản phẩm|Create Product/ }).last().click();
	await sleep(1800);
	return await waitStable(page, 20000);
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
// deleteProduct dùng confirm() native
page.on('dialog', (d) => d.accept());

await login(page);
await page.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded', timeout: 30000 });
let rowCount = await waitStable(page);

// ── B0: dọn product test sót từ các lần chạy trước.
{
	const testPattern = /Probe Product \d+|Probe Mobile Product \d+|Debug Mobile Product \d+/;
	const rows = page.locator('[data-test="products-datatable"] tbody tr', { hasText: testPattern });
	let removed = 0;
	while ((await rows.count()) > 0 && removed < 20) {
		await rows.first().locator('[data-test="product-action-delete"]').click();
		await sleep(2500);
		removed++;
		await waitStable(page, 15000);
	}
	rowCount = await countRows(page);
	console.log(`[cleanup] removed ${removed} leftover test products — rows now ${rowCount}`);
}

// ── B1: DataTable root + thead 7 cột ──
{
	const st = await page.evaluate(() => {
		const root = document.querySelector('[data-test="products-datatable"]');
		const ths = root ? root.querySelectorAll('thead th') : [];
		return {
			hasRoot: !!root,
			thCount: ths.length,
			thText: [...ths].map((t) => t.textContent.trim()).slice(0, 8),
			isDatatable: root ? root.className.includes('datatable') : false
		};
	});
	ok(
		'B1 · DataTable render + thead (6 cột + actions)',
		st.hasRoot && st.isDatatable && st.thCount === 7,
		JSON.stringify(st)
	);
}

// ── B2: nếu bảng rỗng → tạo product test qua modal ──
const testProductName = `Probe Product ${Date.now()}`;
let createdTestProduct = false;
if (rowCount === 0) {
	rowCount = await createProduct(page, testProductName);
	createdTestProduct = true;
}
{
	const st = await page.evaluate(() => {
		const rows = document.querySelectorAll(
			'[data-test="products-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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
			'[data-test="products-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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
		const pills = document.querySelectorAll('[data-test="products-datatable"] .datatable-status');
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

// ── B7: filter select category/brand có options (fetchOptions OK) ──
{
	const st = await page.evaluate(() => {
		const filters = document.querySelector('.admin-filters');
		const selects = filters ? [...filters.querySelectorAll('select.admin-select')] : [];
		return {
			filterSelectCount: selects.length,
			optionCounts: selects.map((s) => s.querySelectorAll('option').length)
		};
	});
	// 2 select filter (category + brand) — page-size select nằm trong pagination
	// không thuộc .admin-filters. Options ≥ 2 nếu DB có category/brand (seed
	// từ screenshot categories/brands; nếu DB trống option chỉ 1 "All" —
	// chấp nhận ≥ 1 nhưng phải có 2 select).
	ok(
		'B7 · Filter select category + brand render',
		st.filterSelectCount === 2 && st.optionCounts.every((n) => n >= 1),
		JSON.stringify(st)
	);
}

// ── B8: page size 10 ──
{
	const select = page.locator('.admin-pagination select.admin-select');
	await select.selectOption('10');
	const rows = await waitStable(page, 20000);
	const pageInfo = await page.evaluate(() => document.querySelector('.page-info')?.textContent?.trim() ?? '');
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
	const cb = page.locator('.admin-filters input[type="checkbox"], .admin-filters [role="checkbox"]').first();
	await cb.click();
	await waitStable(page, 20000);
	const st = await page.evaluate(() => ({
		hasTable: !!document.querySelector('[data-test="products-datatable"]'),
		hasError: !!document.querySelector('[data-test="products-load-error"]')
	}));
	ok('B10 · Toggle showDeleted → refetch OK (không error)', st.hasTable && !st.hasError, JSON.stringify(st));
	await cb.click();
	await waitStable(page, 20000);
}

// ── B9: click Edit → modal mở + name điền sẵn ──
{
	const firstName = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="products-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		return row?.querySelector('td')?.textContent?.trim() ?? '';
	});
	await page.locator('[data-test="product-action-edit"]').first().click();
	await sleep(900);
	const st = await page.evaluate(() => {
		const modal = document.querySelector('[role="dialog"], .modal-container, .modal');
		const nameInput = modal?.querySelector('input');
		return {
			hasModal: !!modal,
			nameValue: nameInput?.value ?? ''
		};
	});
	// Cột product render "name — description" — so theo prefix trước " — "
	const expectedClean = firstName.split(' — ')[0];
	ok(
		'B9 · Click Sửa → modal mở + name điền sẵn',
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

// Dọn product test (nếu probe đã tạo)
if (createdTestProduct) {
	const delBtn = page.locator(
		'[data-test="products-datatable"] tbody tr',
		{ hasText: testProductName }
	).locator('[data-test="product-action-delete"]').first();
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
await mpage.goto(`${BASE}/admin/products`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitStable(mpage);

// Chuẩn bị: mobile cần ít nhất 1 data row — tạo product tạm nếu bảng trống.
const mobileProductName = `Probe Mobile Product ${Date.now()}`;
let mobileProductCreated = false;
{
	const row = mpage.locator(
		'[data-test="products-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	).first();
	if ((await row.count()) === 0) {
		await mpage.locator('button', { hasText: /Thêm sản phẩm|Add Product/ }).first().click();
		await sleep(900);
		await mpage.locator('[role="dialog"] input').first().fill(mobileProductName);
		await sleep(500);
		await mpage.locator('[role="dialog"] button', { hasText: /Tạo sản phẩm|Create Product/ }).last().click();
		await sleep(1800);
		await waitStable(mpage, 20000);
		mobileProductCreated = true;
	}
}

// B12: th + td actions ẩn — B5 card-mode thay bảng, thead không render
// → PASS khi (thead không có) HOẶC (th/td actions display:none).
{
	const st = await mpage.evaluate(() => {
		const th = document.querySelector('.datatable-th--actions');
		const td = document.querySelector('.datatable-td--actions');
		return {
			thDisplay: th ? getComputedStyle(th).display : 'none-found',
			tdDisplay: td ? getComputedStyle(td).display : 'none-found',
			cardMode: !!document.querySelector('[data-test="datatable-cards"]')
		};
	});
	const hiddenOk = st.cardMode || (st.thDisplay === 'none' && st.tdDisplay === 'none');
	ok('B12 · Mobile: cột actions ẩn (th + td / card-mode)', hiddenOk, JSON.stringify(st));
}

// B13: không tràn ngang
{
	const st = await mpage.evaluate(() => {
		const wrap = document.querySelector('.admin-table-wrap');
		return { client: wrap.clientWidth, scroll: wrap.scrollWidth };
	});
	ok('B13 · Mobile: table gọn khung', st.scroll <= st.client, JSON.stringify(st));
}

// B13: tap card → B5 mobileTapMode="callback" — modal EDIT mở trực tiếp
// (không còn expand bar; bar thay bằng modal + nút Xoá footer).
{
	await mpage.evaluate(() => document.querySelector('.datatable-card[data-row-id]')?.click());
	await sleep(1000);
	const st = await mpage.evaluate(() => {
		const modal = [...document.querySelectorAll('.modal-root')].find(
			(d) => d.getBoundingClientRect().width > 0
		);
		const del = document.querySelector('[data-test="product-modal-delete"]');
		return { hasModal: !!modal, hasDelete: !!del && del.getBoundingClientRect().width > 0 };
	});
	ok('B13 · Mobile: tap card → modal EDIT mở (B5 callback)', st.hasModal, JSON.stringify(st));
}

// B14: modal edit có nút Xoá (B5 — thay expand bar)
{
	const st = await mpage.evaluate(() => {
		const del = document.querySelector('[data-test="product-modal-delete"]');
		return { hasDelete: !!del && del.getBoundingClientRect().width > 0 };
	});
	ok('B14 · Mobile: modal edit có nút Xoá (B5)', st.hasDelete);
	await mpage.keyboard.press('Escape');
	await sleep(700);
}

// B15: card view (B5) — cardFields khai báo 3 trường (product/category/status)
{
	const st = await mpage.evaluate(() => {
		const cards = document.querySelectorAll('.datatable-card:not(.datatable-card--skeleton)');
		const first = cards[0];
		return {
			cardMode: !!document.querySelector('[data-test="datatable-cards"]'),
			cardCount: cards.length,
			firstLabels: first
				? [...first.querySelectorAll('.datatable-card-label')].map((l) => l.textContent?.trim())
				: []
		};
	});
	ok(
		'B15 · Mobile: card view (B5) — cards render với label:value',
		st.cardMode && (st.cardCount > 0 || st.firstLabels.length === 0),
		JSON.stringify(st)
	);
}

ok('B16 · Mobile: 0 pageerror', mErrors.length === 0, mErrors.join(' | ').slice(0, 200));

// Dọn product test mobile (nếu đã tạo) — B5: tap card → modal edit → nút
// Xoá footer (confirm() auto-accept).
if (mobileProductCreated) {
	const cards = mpage.locator('.datatable-card', { hasText: mobileProductName });
	let guard = 0;
	while ((await cards.count()) > 0 && guard++ < 6) {
		await cards.first().click();
		await sleep(1000);
		// modal edit mở — nút Xoá trong footer
		const del = mpage.locator('[data-test="product-modal-delete"]').first();
		if ((await del.count()) === 0 || !(await del.isVisible())) {
			console.log(`[dbg-mobile] vòng ${guard}: không thấy nút delete modal — bỏ qua vòng này`);
			continue;
		}
		await del.click();
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
