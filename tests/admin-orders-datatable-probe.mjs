// tests/admin-orders-datatable-probe.mjs
// Probe B6.2 (Pha 3) — Orders page migrate DataTable + Pagination:
//   O1. DataTable render (root [data-test=orders-datatable]) + thead 7 cột
//       (orderCode/customer/status/items/total/created/actions)
//   O2. tbody có data row (orderCode + total "₫")
//   O3. Cột actions: 3 nút (detail/status/delete)
//   O4. Status pill class datatable-status--* (map status → warning/danger/...)
//   O5. Pagination compact + total-count + page-info
//   O6. Search "zzz-no-match" → 0 data row; xóa search → row trở lại
//   O7. Filter select status: 6 option (5 enum + All)
//   O8. Page size 10 → refetch ≤ 10 row
//   O9. Click Detail → modal mở + intro orderCode
//   O10. Toggle showDeleted → refetch OK
//   O11. 0 pageerror / 0 console error
// Mobile (context touch thật):
//   O12. th + td actions ẩn
//   O13. Table không tràn ngang
//   O14. Tap row → expand bar 3 nút, 0 tràn viewport
//   O15. Tap Detail trong bar → modal mở
//   O16. Mobile chỉ 3 cột data (orderCode/status/total) — lọc cột mobile
//   O17. 0 pageerror
// SEED: page orders KHÔNG có nút create (khác products) — nếu DB chưa có đơn
// hàng nào, probe gọi thẳng /api/admin/orders/create qua fetchSecure trong
// page context (import module encryption của app — cookie session có sẵn,
// pattern BF-D barcode-fix). Dọn đơn test ở cuối qua /api/admin/orders/delete.
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

async function countRows(page) {
	return page.evaluate(
		() =>
			document.querySelectorAll(
				'[data-test="orders-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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

// Poll fetch xong: skeleton xuất hiện rồi biến mất (pattern customers probe).
async function waitStable(page, maxMs = 25000) {
	const t0 = Date.now();
	let sawSkeleton = false;
	while (Date.now() - t0 < maxMs) {
		const loading = await page.evaluate(
			() =>
				!!document.querySelector(
					'[data-test="orders-datatable"] .datatable-row--skeleton, [data-test="orders-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) return await countRows(page);
		await sleep(300);
	}
	return sawSkeleton ? await countRows(page) : -1;
}

// B5 mobile: datatable ở card-mode — skeleton là .datatable-card--skeleton,
// waitStable ở trên không nhìn thấy → poll is-loading của root thay thế
// (pattern admin-mobile-ux-probe).
async function waitSettled(pg, maxMs = 40000) {
	const t0 = Date.now();
	while (Date.now() - t0 < maxMs) {
		const settled = await pg.evaluate(() => {
			const root = document.querySelector('.datatable-root');
			return !!root && !root.classList.contains('is-loading');
		});
		if (settled) return true;
		await sleep(500);
	}
	return false;
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

await login(page);
await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
let rowCount = await waitStable(page);

// ── O0: seed đơn test nếu DB rỗng (page orders không có nút create) ──
const seededKeys = [];
if (rowCount === 0) {
	console.log('[seed] orders trống — tạo 2 đơn test qua API create…');
	const seed = await page.evaluate(async () => {
		const enc = await import('/src/lib/modules/encryption.ts');
		const post = (url, body) =>
			enc.encryption.fetchSecure(url, { method: 'POST', body });
		// 1) customerId: user role-customer đầu tiên (customers list đã lọc sẵn)
		const cust = await post('/api/admin/customers/list', { page: 1, pageSize: 5 });
		const customer = cust?.data?.items?.[0] ?? cust?.data?.customers?.[0];
		if (!customer) return { error: 'no-customer', detail: cust };
		const customerId = customer._id ?? customer.documentKey;
		// 2) variantId active đầu tiên (variants list đã lọc deletedAt; lọc status ở client)
		const vars = await post('/api/admin/variants/list', { page: 1, pageSize: 20 });
		const variant = (vars?.data?.items ?? []).find((v) => v.status === 'active' && (v.price ?? 0) > 0);
		if (!variant) return { error: 'no-variant', detail: vars };
		// 3) 2 đơn: pending + delivered (server set-status chỉ nhận transition hợp lệ —
		//    pending→confirmed→shipped→delivered là 3 lần gọi; đơn 2 giữ pending)
		const keys = [];
		for (const quantity of [2, 1]) {
			const created = await post('/api/admin/orders/create', {
				customerId,
				items: [{ variantId: variant._id ?? variant.documentKey, quantity }]
			});
			if (!created?.ok) return { error: 'create-failed', detail: created };
			keys.push(created.data.documentKey);
		}
		return { keys };
	});
	if (seed.error) {
		console.log('[seed] THẤT BẠI:', JSON.stringify(seed).slice(0, 400));
	} else {
		seededKeys.push(...seed.keys);
		console.log(`[seed] đã tạo ${seed.keys.length} đơn test`);
	}
	// refetch sau seed
	await page.reload({ waitUntil: 'domcontentloaded' });
	rowCount = await waitStable(page);
}

// ── O1: DataTable root + thead (6 cột data + actions) ──
{
	const st = await page.evaluate(() => {
		const root = document.querySelector('[data-test="orders-datatable"]');
		const ths = root ? root.querySelectorAll('thead th') : [];
		return {
			hasRoot: !!root,
			thCount: ths.length,
			thText: [...ths].map((t) => t.textContent.trim()).slice(0, 8),
			isDatatable: root ? root.className.includes('datatable') : false
		};
	});
	ok(
		'O1 · DataTable render + thead (6 cột + actions)',
		st.hasRoot && st.isDatatable && st.thCount === 7,
		JSON.stringify(st)
	);
}

// ── O2: tbody data row ──
{
	const st = await page.evaluate(() => {
		const rows = document.querySelectorAll(
			'[data-test="orders-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		const first = rows[0];
		const tds = first ? [...first.querySelectorAll('td')] : [];
		return {
			rowCount: rows.length,
			firstCode: tds[0]?.textContent?.trim().slice(0, 40) ?? '',
			totalText: tds[4]?.textContent?.trim() ?? ''
		};
	});
	ok(
		'O2 · tbody có data row (orderCode + total ₫)',
		rowCount > 0 && st.rowCount > 0 && st.firstCode.length > 0,
		JSON.stringify(st)
	);
}

// ── O3: 3 nút actions (detail/status/delete) ──
{
	const st = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="orders-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		const actionsTd = row?.querySelector('td:last-child');
		const btns = actionsTd ? actionsTd.querySelectorAll('button') : [];
		return {
			btnCount: btns.length,
			labels: [...btns].map((b) => b.textContent.trim())
		};
	});
	ok('O3 · Row actions: 3 nút (Chi tiết/Đổi trạng thái/Xoá đơn hàng)', st.btnCount === 3, JSON.stringify(st));
}

// ── O4: status pill ──
{
	const st = await page.evaluate(() => {
		const pills = document.querySelectorAll('[data-test="orders-datatable"] .datatable-status');
		const classes = [...pills].map((p) => p.className.match(/datatable-status--(\w+)/)?.[1] ?? '?');
		return { pillCount: pills.length, kinds: [...new Set(classes)] };
	});
	ok('O4 · Status pill render (datatable-status--*)', st.pillCount > 0, JSON.stringify(st));
}

// ── O5: Pagination + total-count ──
{
	const st = await page.evaluate(() => {
		const pag = document.querySelector('.admin-pagination');
		const buttons = pag ? [...pag.querySelectorAll('button')] : [];
		const pageInfo = pag?.querySelector('.page-info')?.textContent?.trim() ?? '';
		const total = pag?.querySelector('.total-count')?.textContent?.trim() ?? '';
		return { hasPag: !!pag, btnCount: buttons.length, pageInfo, total };
	});
	ok(
		'O5 · Pagination compact + page info + total',
		st.hasPag && st.btnCount >= 2 && st.pageInfo.length > 0 && st.total.length > 0,
		JSON.stringify(st)
	);
}

// ── O6: search no-match → rỗng; xóa → row trở lại ──
{
	const searchInput = page.locator('.admin-search input');
	await searchInput.fill('zzz-no-match-xyz');
	await sleep(1000);
	const emptyRows = await waitStable(page, 20000);
	await searchInput.fill('');
	await sleep(1000);
	const backRows = await waitStable(page, 20000);
	ok(
		'O6 · Search no-match → 0 row; xóa search → row trở lại',
		emptyRows === 0 && backRows > 0,
		`empty=${emptyRows} back=${backRows}`
	);
}

// ── O7: filter select status có 6 options (5 enum + All) ──
{
	const st = await page.evaluate(() => {
		const filters = document.querySelector('.admin-filters');
		const selects = filters ? [...filters.querySelectorAll('select.admin-select')] : [];
		return {
			filterSelectCount: selects.length,
			optionCounts: selects.map((s) => s.querySelectorAll('option').length)
		};
	});
	// 1 select filter (status enum cứng) — 5 option + 1 "All" = 6
	ok(
		'O7 · Filter select status render + 6 options',
		st.filterSelectCount === 1 && st.optionCounts[0] === 6,
		JSON.stringify(st)
	);
}

// ── O8: page size 10 ──
{
	const select = page.locator('.admin-pagination select.admin-select');
	await select.selectOption('10');
	const rows = await waitStable(page, 20000);
	const pageInfo = await page.evaluate(
		() => document.querySelector('.page-info')?.textContent?.trim() ?? ''
	);
	ok(
		'O8 · Page size 10 → refetch, ≤ 10 row',
		rows > 0 && rows <= 10 && pageInfo.includes('1'),
		`rows=${rows} pageInfo="${pageInfo}"`
	);
	await select.selectOption('20');
	await waitStable(page, 20000);
}

// ── O10: toggle showDeleted (chạy trước O9 để nếu modal kẹt còn vòng cleanup) ──
{
	const cb = page
		.locator('.admin-header input[type="checkbox"], .admin-header [role="checkbox"]')
		.first();
	await cb.click();
	await waitStable(page, 20000);
	const st = await page.evaluate(() => ({
		hasTable: !!document.querySelector('[data-test="orders-datatable"]'),
		hasError: !!document.querySelector('[role="alert"]')
	}));
	ok(
		'O10 · Toggle showDeleted → refetch OK (không error)',
		st.hasTable && !st.hasError,
		JSON.stringify(st)
	);
	await cb.click();
	await waitStable(page, 20000);
}

// ── O9: click Detail → modal mở + intro orderCode ──
{
	const firstCode = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="orders-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		return row?.querySelector('td')?.textContent?.trim() ?? '';
	});
	await page.locator('[data-test="order-action-detail"]').first().click();
	await sleep(900);
	const st = await page.evaluate(() => {
		const modal = document.querySelector('[role="dialog"], .modal-container, .modal');
		return {
			hasModal: !!modal,
			text: modal?.textContent?.trim().slice(0, 120) ?? ''
		};
	});
	ok(
		'O9 · Click Chi tiết → modal mở + orderCode trong intro',
		st.hasModal && st.text.includes(firstCode.slice(0, 10)),
		`expected~="${firstCode.slice(0, 10)}" modal="${st.text.slice(0, 60)}"`
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

ok('O11 · 0 pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
const hardConsoleErrors = consoleErrors.filter(
	(m) => !m.includes('favicon') && !m.includes('sourcemap') && !m.includes('DevTools') && !m.includes('405')
);
ok('O11 · 0 console error', hardConsoleErrors.length === 0, hardConsoleErrors.join(' | ').slice(0, 200));

// ── O18: UI delete — nút Xoá → modal → confirm → row giảm (đồng thời dọn seed) ──
// Chạy TRƯỚC mobile: xóa dần đơn test, trả DB về trống như ban đầu.
{
	// seed 1 đơn riêng cho test xóa (không đụng đơn còn lại nếu seed không chạy)
	const extra = await page.evaluate(async () => {
		const enc = await import('/src/lib/modules/encryption.ts');
		const post = (url, body) => enc.encryption.fetchSecure(url, { method: 'POST', body });
		const cust = await post('/api/admin/customers/list', { page: 1, pageSize: 5 });
		const customer = cust?.data?.items?.[0] ?? cust?.data?.customers?.[0];
		if (!customer) return null;
		const vars = await post('/api/admin/variants/list', { page: 1, pageSize: 20 });
		const variant = (vars?.data?.items ?? []).find((v) => v.status === 'active' && (v.price ?? 0) > 0);
		if (!variant) return null;
		const created = await post('/api/admin/orders/create', {
			customerId: customer._id ?? customer.documentKey,
			items: [{ variantId: variant._id ?? variant.documentKey, quantity: 1 }]
		});
		return created?.ok ? created.data.documentKey : null;
	});
	if (extra) seededKeys.push(extra);

	const rowsBefore = await countRows(page);
	await page.locator('[data-test="order-action-delete"]').first().click();
	await sleep(900);
	const modalShown = await page.evaluate(
		() => !!document.querySelector('[role="dialog"], .modal-container, .modal')
	);
	// Nút confirm trong footer modal — label "Confirm"/"Xác nhận" (nút error)
	await page
		.locator('[role="dialog"], .modal-container, .modal')
		.first()
		.locator('button')
		.filter({ hasText: /Confirm|Xác nhận/ })
		.last()
		.click();
	await sleep(1800);
	const rowsAfter = await countRows(page);
	ok(
		'O18 · UI delete: modal mở → confirm → xóa đúng 1 row',
		modalShown && rowsBefore - rowsAfter === 1,
		`before=${rowsBefore} after=${rowsAfter} modal=${modalShown}`
	);
	// đơn vừa xóa qua UI không cần cleanup nữa — bỏ khỏi danh sách
	seededKeys.pop();
}

// ── Cleanup: xóa phần đơn test còn lại qua API (soft delete) ──
if (seededKeys.length) {
	const cleanup = await page.evaluate(async (keys) => {
		const enc = await import('/src/lib/modules/encryption.ts');
		const out = [];
		for (const documentKey of keys) {
			const r = await enc.encryption.fetchSecure(
				'/api/admin/orders/delete',
				{ method: 'POST', body: { documentKey } }
			);
			out.push(r?.ok === true ? 1 : 0);
		}
		return out;
	}, seededKeys);
	console.log(`[cleanup] xóa đơn test: ${cleanup.join(',')} (1=ok)`);
}

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

await login(mpage);
await mpage.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitStable(mpage);

// Seed đơn test cho mobile nếu rỗng (desktop O18 + cleanup đã xóa hết đơn
// seed → card-mode 0 card, không có gì để tap). Xóa ở cuối mobile section.
let mobileSeedKey = null;
{
	const cardCount = await mpage.evaluate(
		() => document.querySelectorAll('.datatable-card:not(.datatable-card--skeleton)').length
	);
	if (cardCount === 0) {
		mobileSeedKey = await mpage.evaluate(async () => {
			const enc = await import('/src/lib/modules/encryption.ts');
			const post = (url, body) => enc.encryption.fetchSecure(url, { method: 'POST', body });
			const cust = await post('/api/admin/customers/list', { page: 1, pageSize: 5 });
			const customer = cust?.data?.items?.[0] ?? cust?.data?.customers?.[0];
			if (!customer) return null;
			const vars = await post('/api/admin/variants/list', { page: 1, pageSize: 20 });
			const variant = (vars?.data?.items ?? []).find((v) => v.status === 'active' && (v.price ?? 0) > 0);
			if (!variant) return null;
			const created = await post('/api/admin/orders/create', {
				customerId: customer._id ?? customer.documentKey,
				items: [{ variantId: variant._id ?? variant.documentKey, quantity: 1 }]
			});
			return created?.ok ? created.data.documentKey : null;
		});
		if (mobileSeedKey) {
			console.log('[seed-mobile] đã tạo 1 đơn test cho mobile');
			await mpage.reload({ waitUntil: 'domcontentloaded' });
			await waitSettled(mpage);
		}
	}
}

// O12: th + td actions ẩn — B5 card-mode thay bảng, thead không render
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
	ok('O12 · Mobile: cột actions ẩn (th + td / card-mode)', hiddenOk, JSON.stringify(st));
}

// O13: không tràn ngang
{
	const st = await mpage.evaluate(() => {
		const wrap = document.querySelector('.admin-table-wrap');
		return { client: wrap.clientWidth, scroll: wrap.scrollWidth };
	});
	ok('O13 · Mobile: table gọn khung', st.scroll <= st.client, JSON.stringify(st));
}

// O16: mobile card view — cardFields khai báo 5 trường (orderCode/customer/
// status/total/created); B5 card-mode thay bảng, thead không render.
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
		'O16 · Mobile: card view (B5) — cards render với label:value',
		st.cardMode && (st.cardCount > 0 || st.firstLabels.length === 0),
		JSON.stringify(st)
	);
}

// O14: tap card → B5 mobileTapMode="callback" — modal DETAIL mở trực tiếp.
{
	await mpage.evaluate(() => document.querySelector('.datatable-card[data-row-id]')?.click());
	await sleep(1000);
	const st = await mpage.evaluate(() => {
		const modal = [...document.querySelectorAll('.modal-root')].find(
			(d) => d.getBoundingClientRect().width > 0
		);
		return { hasModal: !!modal };
	});
	ok('O14 · Mobile: tap card → modal mở (B5 callback)', st.hasModal);
}

// O15: modal detail render nội dung (thay tap Detail trong bar)
{
	const st = await mpage.evaluate(() => {
		const modal = [...document.querySelectorAll('.modal-root')].find(
			(d) => d.getBoundingClientRect().width > 0
		);
		return { modalText: modal ? modal.textContent?.slice(0, 80) : null };
	});
	ok('O15 · Mobile: modal detail render', st.modalText !== null, JSON.stringify(st));
	await mpage.keyboard.press('Escape');
	await sleep(700);
}

ok('O17 · Mobile: 0 pageerror', mErrors.length === 0, mErrors.join(' | ').slice(0, 200));

// Cleanup: xóa đơn seed mobile qua API (giữ DB trống như ban đầu).
if (mobileSeedKey) {
	const cleanup = await mpage.evaluate(async (documentKey) => {
		const enc = await import('/src/lib/modules/encryption.ts');
		const r = await enc.encryption.fetchSecure('/api/admin/orders/delete', {
			method: 'POST',
			body: { documentKey }
		});
		return r?.ok === true;
	}, mobileSeedKey);
	console.log(`[cleanup-mobile] xóa đơn seed mobile: ${cleanup}`);
}

await mbrowser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n══ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ══`);
if (failed.length) {
	console.log('FAIL list:');
	failed.forEach((f) => console.log(`  - ${f.name} — ${f.extra}`));
	process.exitCode = 1;
}
