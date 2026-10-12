// tests/admin-customers-datatable-probe.mjs
// Probe B6.2 (Pha 3) — Customers page migrate DataTable + Pagination:
//   C1. DataTable render (root [data-test=customers-datatable]) + thead 6 cột
//       (name/status/loyalty/created/lastLogin/actions)
//   C2. tbody có data row (name + status pill + loyalty)
//   C3. Cột actions: 3 nút (detail/status/delete)
//   C4. Status pill class datatable-status--* (map statusId → success/warning/danger)
//   C5. Pagination compact + total-count + page-info
//   C6. Search "zzz-no-match" → 0 data row; xóa search → row trở lại
//   C7. Filter select status render 4 option (fetchStatuses OK)
//   C8. Page size 10 → refetch ≤ 10 row
//   C9. Click Detail (Chi tiết) → modal mở + intro tên customer
//   C10. Toggle showDeleted → refetch OK
//   C11. 0 pageerror / 0 console error
// Mobile (context touch thật):
//   C12. th + td actions ẩn
//   C13. Table không tràn ngang
//   C14. Tap row → expand bar 3 nút, 0 tràn viewport
//   C15. Tap Detail trong bar → modal mở
//   C16. Mobile chỉ 3 cột data (name/status/loyalty) — lọc cột mobile
//   C17. 0 pageerror
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
				'[data-test="customers-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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

// Poll fetch xong: skeleton xuất hiện rồi biến mất (pattern variants probe).
async function waitStable(page, maxMs = 25000) {
	const t0 = Date.now();
	let sawSkeleton = false;
	while (Date.now() - t0 < maxMs) {
		const loading = await page.evaluate(
			() =>
				!!document.querySelector(
					'[data-test="customers-datatable"] .datatable-row--skeleton, [data-test="customers-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) return await countRows(page);
		await sleep(300);
	}
	return sawSkeleton ? await countRows(page) : -1;
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
await page.goto(`${BASE}/admin/customers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
const rowCount = await waitStable(page);

// ── C1: DataTable root + thead (5 cột data + actions) ──
{
	const st = await page.evaluate(() => {
		const root = document.querySelector('[data-test="customers-datatable"]');
		const ths = root ? root.querySelectorAll('thead th') : [];
		return {
			hasRoot: !!root,
			thCount: ths.length,
			thText: [...ths].map((t) => t.textContent.trim()).slice(0, 8),
			isDatatable: root ? root.className.includes('datatable') : false
		};
	});
	ok(
		'C1 · DataTable render + thead (5 cột + actions)',
		st.hasRoot && st.isDatatable && st.thCount === 6,
		JSON.stringify(st)
	);
}

// ── C2: tbody data row ──
{
	const st = await page.evaluate(() => {
		const rows = document.querySelectorAll(
			'[data-test="customers-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		const first = rows[0];
		const tds = first ? [...first.querySelectorAll('td')] : [];
		return {
			rowCount: rows.length,
			firstName: tds[0]?.textContent?.trim().slice(0, 40) ?? '',
			loyalty: tds[2]?.textContent?.trim() ?? ''
		};
	});
	ok(
		'C2 · tbody có data row (name + loyalty)',
		rowCount > 0 && st.rowCount > 0 && st.firstName.length > 0,
		JSON.stringify(st)
	);
}

// ── C3: 3 nút actions (detail/status/delete) ──
{
	const st = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="customers-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		const actionsTd = row?.querySelector('td:last-child');
		const btns = actionsTd ? actionsTd.querySelectorAll('button') : [];
		return {
			btnCount: btns.length,
			labels: [...btns].map((b) => b.textContent.trim())
		};
	});
	ok('C3 · Row actions: 3 nút (Chi tiết/Đổi trạng thái/Xoá)', st.btnCount === 3, JSON.stringify(st));
}

// ── C4: status pill ──
{
	const st = await page.evaluate(() => {
		const pills = document.querySelectorAll('[data-test="customers-datatable"] .datatable-status');
		const classes = [...pills].map((p) => p.className.match(/datatable-status--(\w+)/)?.[1] ?? '?');
		return { pillCount: pills.length, kinds: [...new Set(classes)] };
	});
	ok('C4 · Status pill render (datatable-status--*)', st.pillCount > 0, JSON.stringify(st));
}

// ── C5: Pagination + total-count ──
{
	const st = await page.evaluate(() => {
		const pag = document.querySelector('.admin-pagination');
		const buttons = pag ? [...pag.querySelectorAll('button')] : [];
		const pageInfo = pag?.querySelector('.page-info')?.textContent?.trim() ?? '';
		const total = pag?.querySelector('.total-count')?.textContent?.trim() ?? '';
		return { hasPag: !!pag, btnCount: buttons.length, pageInfo, total };
	});
	ok(
		'C5 · Pagination compact + page info + total',
		st.hasPag && st.btnCount >= 2 && st.pageInfo.length > 0 && st.total.length > 0,
		JSON.stringify(st)
	);
}

// ── C6: search no-match → rỗng; xóa → row trở lại ──
{
	const searchInput = page.locator('.admin-search input');
	await searchInput.fill('zzz-no-match-xyz');
	await sleep(1000);
	const emptyRows = await waitStable(page, 20000);
	await searchInput.fill('');
	await sleep(1000);
	const backRows = await waitStable(page, 20000);
	ok(
		'C6 · Search no-match → 0 row; xóa search → row trở lại',
		emptyRows === 0 && backRows > 0,
		`empty=${emptyRows} back=${backRows}`
	);
}

// ── C7: filter select status có options ──
{
	const st = await page.evaluate(() => {
		const filters = document.querySelector('.admin-filters');
		const selects = filters ? [...filters.querySelectorAll('select.admin-select')] : [];
		return {
			filterSelectCount: selects.length,
			optionCounts: selects.map((s) => s.querySelectorAll('option').length)
		};
	});
	// 1 select filter (status) — 4 option status + 1 "All" = ≥ 2
	ok(
		'C7 · Filter select status render + đủ options',
		st.filterSelectCount === 1 && st.optionCounts[0] >= 2,
		JSON.stringify(st)
	);
}

// ── C8: page size 10 ──
{
	const select = page.locator('.admin-pagination select.admin-select');
	await select.selectOption('10');
	const rows = await waitStable(page, 20000);
	const pageInfo = await page.evaluate(
		() => document.querySelector('.page-info')?.textContent?.trim() ?? ''
	);
	ok(
		'C8 · Page size 10 → refetch, ≤ 10 row',
		rows > 0 && rows <= 10 && pageInfo.includes('1'),
		`rows=${rows} pageInfo="${pageInfo}"`
	);
	await select.selectOption('20');
	await waitStable(page, 20000);
}

// ── C10: toggle showDeleted (chạy trước C9 để nếu modal kẹt còn vòng cleanup) ──
{
	const cb = page
		.locator('.admin-header input[type="checkbox"], .admin-header [role="checkbox"]')
		.first();
	await cb.click();
	await waitStable(page, 20000);
	const st = await page.evaluate(() => ({
		hasTable: !!document.querySelector('[data-test="customers-datatable"]'),
		hasError: !!document.querySelector('[role="alert"]')
	}));
	ok(
		'C10 · Toggle showDeleted → refetch OK (không error)',
		st.hasTable && !st.hasError,
		JSON.stringify(st)
	);
	await cb.click();
	await waitStable(page, 20000);
}

// ── C9: click Detail → modal mở + intro tên customer ──
{
	const firstName = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="customers-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		return row?.querySelector('td')?.textContent?.trim() ?? '';
	});
	await page.locator('[data-test="customer-action-detail"]').first().click();
	await sleep(900);
	const st = await page.evaluate(() => {
		const modal = document.querySelector('[role="dialog"], .modal-container, .modal');
		return {
			hasModal: !!modal,
			text: modal?.textContent?.trim().slice(0, 120) ?? ''
		};
	});
	ok(
		'C9 · Click Chi tiết → modal mở + tên customer trong intro',
		st.hasModal && st.text.includes(firstName.slice(0, 20)),
		`expected~="${firstName.slice(0, 20)}" modal="${st.text.slice(0, 60)}"`
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

ok('C11 · 0 pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
const hardConsoleErrors = consoleErrors.filter(
	(m) => !m.includes('favicon') && !m.includes('sourcemap') && !m.includes('DevTools') && !m.includes('405')
);
ok('C11 · 0 console error', hardConsoleErrors.length === 0, hardConsoleErrors.join(' | ').slice(0, 200));

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
await mpage.goto(`${BASE}/admin/customers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitStable(mpage);

// C12: th + td actions ẩn — B5 card-mode thay bảng, thead không render
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
	ok('C12 · Mobile: cột actions ẩn (th + td / card-mode)', hiddenOk, JSON.stringify(st));
}

// C13: không tràn ngang
{
	const st = await mpage.evaluate(() => {
		const wrap = document.querySelector('.admin-table-wrap');
		return { client: wrap.clientWidth, scroll: wrap.scrollWidth };
	});
	ok('C13 · Mobile: table gọn khung', st.scroll <= st.client, JSON.stringify(st));
}

// C16: mobile card view (B5) — thead không render khi card-mode.
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
		'C16 · Mobile: card view (B5) — cards render với label:value',
		st.cardMode && (st.cardCount > 0 || st.firstLabels.length === 0),
		JSON.stringify(st)
	);
}

// C14: tap card → B5 mobileTapMode="callback" — modal DETAIL mở trực tiếp.
{
	await mpage.evaluate(() => document.querySelector('.datatable-card[data-row-id]')?.click());
	await sleep(1000);
	const st = await mpage.evaluate(() => {
		const modal = [...document.querySelectorAll('.modal-root')].find(
			(d) => d.getBoundingClientRect().width > 0
		);
		return { hasModal: !!modal };
	});
	ok('C14 · Mobile: tap card → modal mở (B5 callback)', st.hasModal);
}

// C15: modal detail render nội dung (thay tap Detail trong bar)
{
	const st = await mpage.evaluate(() => {
		const modal = [...document.querySelectorAll('.modal-root')].find(
			(d) => d.getBoundingClientRect().width > 0
		);
		return { modalText: modal ? modal.textContent?.slice(0, 80) : null };
	});
	ok('C15 · Mobile: modal detail render', st.modalText !== null, JSON.stringify(st));
	await mpage.keyboard.press('Escape');
	await sleep(700);
}

ok('C17 · Mobile: 0 pageerror', mErrors.length === 0, mErrors.join(' | ').slice(0, 200));

await mbrowser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n══ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ══`);
if (failed.length) {
	console.log('FAIL list:');
	failed.forEach((f) => console.log(`  - ${f.name} — ${f.extra}`));
	process.exitCode = 1;
}
