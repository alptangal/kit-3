// tests/admin-brands-datatable-probe.mjs
// Probe B6.2 (Pha 3) — Brands page migrate DataTable + Pagination:
//   B1. DataTable render (root [data-test=brands-datatable]) + thead 5 cột (brand/slug/status/updated/actions)
//   B2. tbody có data row (name + slug) — nếu rỗng: tạo brand test qua modal
//       (test luôn flow create + auto-slug)
//   B3. Cột actions: 2 nút (edit/delete)
//   B4. Status pill class datatable-status--* (map active→success)
//   B5. Pagination compact + total-count + page-info
//   B6. Search "zzz-no-match" → 0 data row; xóa search → row trở lại
//   B7. Toggle showDeleted → refetch OK (table/empty, không crash)
//   B8. Đổi page size 10 → refetch ≤ 10 row
//   B9. Click Edit → modal mở + input name điền sẵn giá trị brand
//   B10. 0 pageerror / 0 console error
// Mobile (context touch thật):
//   B11. th + td actions ẩn (media query hover:none/pointer:coarse)
//   B12. Table không tràn ngang
//   B13. Tap row → expand bar 2 nút, 0 tràn viewport
//   B14. Tap Edit trong bar → modal mở
//   B15. 0 pageerror
// LƯU Ý: tbody tr gồm cả skeleton row (--skeleton, aria-hidden) khi loading
// và empty row (--datatable-empty-row) khi rỗng — data row phải loại cả hai.
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
				'[data-test="brands-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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
// "1 fetch đã hoàn tất" (empty-row render ngay khi mount trước fetch đầu —
// nếu chỉ check "hết skeleton" sẽ nhầm empty-trước-fetch là kết quả fetch).
async function waitStable(page, maxMs = 25000) {
	const t0 = Date.now();
	let sawSkeleton = false;
	while (Date.now() - t0 < maxMs) {
		const loading = await page.evaluate(
			() =>
				!!document.querySelector('[data-test="brands-datatable"] .datatable-row--skeleton, [data-test="brands-datatable"] .datatable-loading')
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
// deleteBrand dùng confirm() native
page.on('dialog', (d) => d.accept());

await login(page);
await page.goto(`${BASE}/admin/brands`, { waitUntil: 'domcontentloaded', timeout: 30000 });
let rowCount = await waitStable(page);

// ── B0: dọn brand test sót từ các lần chạy trước (slug unique constraint
//      sẽ chặn create nếu còn rác). Confirm dialog đã auto-accept.
{
	// hasText regex test trên toàn bộ textContent tr (name+slug+status+date)
	// — không anchor ^$ (text trồi các cell khác).
	const testPattern = /Probe Test Brand|Probe Brand \d+|Probe Mobile \d+|Debug Modal Brand/;
	const rows = page.locator('[data-test="brands-datatable"] tbody tr', { hasText: testPattern });
	let removed = 0;
	while ((await rows.count()) > 0) {
		await rows.first().locator('[data-test="brand-action-delete"]').click();
		await sleep(2500);
		removed++;
		await waitStable(page, 15000);
	}
	rowCount = await countRows(page);
	console.log(`[cleanup] removed ${removed} leftover test brands — rows now ${rowCount}`);
}

// ── B1: DataTable root + thead 5 cột ──
{
	const st = await page.evaluate(() => {
		const root = document.querySelector('[data-test="brands-datatable"]');
		const ths = root ? root.querySelectorAll('thead th') : [];
		return {
			hasRoot: !!root,
			thCount: ths.length,
			thText: [...ths].map((t) => t.textContent.trim()).slice(0, 6),
			isDatatable: root ? root.className.includes('datatable') : false
		};
	});
	ok(
		'B1 · DataTable render + thead (4 cột + actions)',
		st.hasRoot && st.isDatatable && st.thCount === 5,
		JSON.stringify(st)
	);
}

// ── B2: nếu bảng rỗng → tạo brand test qua modal (test create + auto-slug) ──
const testBrandName = `Probe Brand ${Date.now()}`;
const testBrandSlug = `probe-brand-${Date.now()}`;
let createdTestBrand = false;
if (rowCount === 0) {
	await page.locator('button', { hasText: /Thêm thương hiệu|Add Brand/ }).first().click();
	await sleep(900);
	const nameInput = page.locator('[role="dialog"] input').first();
	await nameInput.fill(testBrandName);
	await sleep(600);
	const slugValue = await page.locator('[role="dialog"] input').nth(1).inputValue();
	ok('B2a · Modal create mở + auto-slug theo name', slugValue === testBrandSlug, `slug="${slugValue}"`);
	await page.locator('[role="dialog"] button', { hasText: /Tạo thương hiệu|Create Brand/ }).last().click();
	await sleep(1500);
	rowCount = await waitStable(page, 20000);
	createdTestBrand = true;
}
{
	const st = await page.evaluate(() => {
		const rows = document.querySelectorAll(
			'[data-test="brands-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		const first = rows[0];
		const tds = first ? [...first.querySelectorAll('td')] : [];
		return {
			rowCount: rows.length,
			firstName: tds[0]?.textContent?.trim().slice(0, 30) ?? '',
			firstSlug: tds[1]?.textContent?.trim().slice(0, 30) ?? ''
		};
	});
	ok(
		'B2 · tbody có data row (name + slug)',
		rowCount > 0 && st.rowCount > 0 && st.firstName && st.firstSlug,
		JSON.stringify(st)
	);
}

// ── B3: 2 nút actions (edit/delete) trong row 1 ──
{
	const st = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="brands-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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
		const pills = document.querySelectorAll('[data-test="brands-datatable"] .datatable-status');
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
	await sleep(1000); // debounce 300ms + fetch
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

// ── B7: toggle showDeleted ──
{
	const cb = page.locator('.admin-filters input[type="checkbox"], .admin-filters [role="checkbox"]').first();
	await cb.click();
	await waitStable(page, 20000);
	const st = await page.evaluate(() => ({
		hasTable: !!document.querySelector('[data-test="brands-datatable"]'),
		hasError: !!document.querySelector('[data-test="brands-load-error"]')
	}));
	ok('B7 · Toggle showDeleted → refetch OK (không error)', st.hasTable && !st.hasError, JSON.stringify(st));
	await cb.click();
	await waitStable(page, 20000);
}

// ── B8: page size 10 ──
{
	const select = page.locator('.admin-pagination select.admin-select');
	await select.selectOption('10');
	// Không sleep trước waitStable — skeleton ngắn có thể qua trước khi poll
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

// ── B9: click Edit → modal mở + name điền sẵn ──
{
	const firstName = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="brands-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		return row?.querySelector('td')?.textContent?.trim() ?? '';
	});
	await page.locator('[data-test="brand-action-edit"]').first().click();
	await sleep(900);
	const st = await page.evaluate(() => {
		const modal = document.querySelector('[role="dialog"], .modal-container, .modal');
		const nameInput = modal?.querySelector('input');
		return {
			hasModal: !!modal,
			nameValue: nameInput?.value ?? ''
		};
	});
	ok(
		'B9 · Click Sửa → modal mở + name điền sẵn',
		st.hasModal && st.nameValue.length > 0 && st.nameValue === firstName,
		`expected="${firstName}" got="${st.nameValue}"`
	);
	await page.keyboard.press('Escape');
	await sleep(800);
	// Nếu Escape chưa đóng (focus/animation race) → click nút Cancel trong modal
	const stillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
	if (stillOpen) {
		console.log('[dbg] Escape chưa đóng — fallback click Cancel');
		await page.locator('[role="dialog"] button', { hasText: /Huỷ|Cancel/ }).last().click();
		await sleep(800);
	}
}

// Dọn brand test (nếu probe đã tạo)
if (createdTestBrand) {
	const delBtn = page.locator(
		'[data-test="brands-datatable"] tbody tr',
		{ hasText: testBrandName }
	).locator('[data-test="brand-action-delete"]').first();
	await delBtn.click();
	await sleep(3500);
	await waitStable(page, 15000);
}

ok('B10 · 0 pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
const hardConsoleErrors = consoleErrors.filter(
	(m) => !m.includes('favicon') && !m.includes('sourcemap') && !m.includes('DevTools') && !m.includes('405')
);
ok('B10 · 0 console error', hardConsoleErrors.length === 0, hardConsoleErrors.join(' | ').slice(0, 200));

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
// deleteBrand dùng confirm() native — không có handler thì Playwright
// auto-dismiss → confirm trả false → brand không bao giờ bị xóa.
mpage.on('dialog', (d) => d.accept());

await login(mpage);
await mpage.goto(`${BASE}/admin/brands`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitStable(mpage);

// Chuẩn bị: mobile cần ít nhất 1 data row để kiểm chứng td actions —
// tạo brand tạm nếu bảng trống (desktop đã dọn brand test trước đó).
const mobileBrandName = `Probe Mobile ${Date.now()}`;
let mobileBrandCreated = false;
{
	const row = mpage.locator(
		'[data-test="brands-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	).first();
	if ((await row.count()) === 0) {
		await mpage.locator('button', { hasText: /Thêm thương hiệu|Add Brand/ }).first().click();
		await sleep(900);
		await mpage.locator('[role="dialog"] input').first().fill(mobileBrandName);
		await sleep(500);
		await mpage.locator('[role="dialog"] button', { hasText: /Tạo thương hiệu|Create Brand/ }).last().click();
		await sleep(1500);
		await waitStable(mpage, 20000);
		mobileBrandCreated = true;
	}
}

// B11: th + td actions ẩn — B5 card-mode thay bảng, thead không render
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
	ok('B11 · Mobile: cột actions ẩn (th + td / card-mode)', hiddenOk, JSON.stringify(st));
}

// B12: không tràn ngang
{
	const st = await mpage.evaluate(() => {
		const wrap = document.querySelector('.admin-table-wrap');
		return { client: wrap.clientWidth, scroll: wrap.scrollWidth };
	});
	ok('B12 · Mobile: table gọn khung', st.scroll <= st.client, JSON.stringify(st));
}

// B13: tap row → B5 mobileTapMode="callback" — modal EDIT mở trực tiếp.
{
	await mpage.evaluate(() => document.querySelector('.datatable-card[data-row-id]')?.click());
	await sleep(1000);
	const st = await mpage.evaluate(() => {
		const modal = [...document.querySelectorAll('.modal-root')].find(
			(d) => d.getBoundingClientRect().width > 0
		);
		const del = document.querySelector('[data-test="brand-modal-delete"]');
		return { hasModal: !!modal, hasDelete: !!del && del.getBoundingClientRect().width > 0 };
	});
	ok('B13 · Mobile: tap row → modal EDIT mở (B5 callback)', st.hasModal, JSON.stringify(st));
}

// B14: modal edit có nút Xoá (B5 — thay expand bar)
{
	const st = await mpage.evaluate(() => {
		const del = document.querySelector('[data-test="brand-modal-delete"]');
		return { hasDelete: !!del && del.getBoundingClientRect().width > 0 };
	});
	ok('B14 · Mobile: modal edit có nút Xoá (B5)', st.hasDelete);
	await mpage.keyboard.press('Escape');
	await sleep(700);
}

ok('B15 · Mobile: 0 pageerror', mErrors.length === 0, mErrors.join(' | ').slice(0, 200));

// Dọn brand test mobile (nếu đã tạo) — qua nút Delete trong bar expand.
// Modal B14 phải đóng thật (tap bị overlay Modal chặn → timeout), bar phải
// render thật (tap row lần nữa sẽ toggle đóng) — verify từng bước.
if (mobileBrandCreated) {
	// 1. Đóng modal Edit của B14 (Escape + fallback Cancel như B9 desktop)
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

	// B5: mobile là card-mode + tap → modal edit. Xóa brand test: tap card →
	// modal edit → nút Xoá footer (confirm() auto-accept).
	const cards = mpage.locator('.datatable-card', { hasText: mobileBrandName });
	let guard = 0;
	while ((await cards.count()) > 0 && guard++ < 6) {
		await cards.first().click();
		await sleep(1000);
		// modal edit mở — nút Xoá trong footer
		const del = mpage.locator('[data-test="brand-modal-delete"]').first();
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
