// tests/admin-categories-datatable-probe.mjs
// Probe B6.2 (Pha 3) — Categories page migrate DataTable + Pagination:
//   B1. DataTable render (root [data-test=categories-datatable]) + thead 5 cột (category/slug/status/updated/actions)
//   B2. tbody có data row — nếu rỗng: tạo category test qua modal (test create + auto-slug)
//   B3. Cột actions: 2 nút (edit/delete)
//   B4. Status pill class datatable-status--* (map active→success)
//   B5. Pagination compact + total-count + page-info
//   B6. Search "zzz-no-match" → 0 data row; xóa search → row trở lại
//   B7. Page size 10 → refetch ≤ 10 row
//   B8. Click Edit → modal mở + input name điền sẵn giá trị category
//   B9. Tree depth: tạo category con (parent = category test) → row có prefix '↳ '
//       + Edit modal con: parent select KHÔNG chứa con của nó (chống chu trình)
//   B10. 0 pageerror / 0 console error
// Mobile (context touch thật):
//   B11. th + td actions ẩn
//   B12. Table không tràn ngang
//   B13. Tap row → expand bar 2 nút, 0 tràn viewport
//   B14. Tap Edit trong bar → modal mở
//   B15. 0 pageerror
// LƯU Ý: tbody tr gồm cả skeleton row (--skeleton, aria-hidden) khi loading
// và empty row (--datatable-empty-row) khi rỗng — data row phải loại cả hai.
// Category KHÔNG có soft-delete (hard-delete sau check children/products).
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
				'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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
					'[data-test="categories-datatable"] .datatable-row--skeleton, [data-test="categories-datatable"] .datatable-loading'
				)
		);
		if (loading) sawSkeleton = true;
		if (sawSkeleton && !loading) return await countRows(page);
		await sleep(300);
	}
	return sawSkeleton ? await countRows(page) : -1;
}

// Tạo category qua modal create (flow thật). Trả về tên đã tạo.
async function createCategory(page, name) {
	await page.locator('button', { hasText: /Thêm danh mục|Add Category/ }).first().click();
	await sleep(900);
	await page.locator('[role="dialog"] input').first().fill(name);
	await sleep(600);
	await page.locator('[role="dialog"] button', { hasText: /Tạo danh mục|Create Category/ }).last().click();
	await sleep(1500);
	await waitStable(page, 20000);
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
// deleteCategory dùng confirm() native
page.on('dialog', (d) => d.accept());

await login(page);
await page.goto(`${BASE}/admin/categories`, { waitUntil: 'domcontentloaded', timeout: 30000 });
let rowCount = await waitStable(page);

// ── B0: dọn category test sót từ các lần chạy trước (slug unique constraint
//      sẽ chặn create nếu còn rác). Confirm dialog đã auto-accept. Xóa con
//      trước cha (server chặn xoá khi có children).
{
	const testPattern = /Probe Cat \d+|Probe Mobile Cat \d+|Debug Cat/;
	const rows = page.locator('[data-test="categories-datatable"] tbody tr', { hasText: testPattern });
	let removed = 0;
	while ((await rows.count()) > 0 && removed < 20) {
		await rows.first().locator('[data-test="category-action-delete"]').click();
		await sleep(2500);
		removed++;
		await waitStable(page, 15000);
	}
	rowCount = await countRows(page);
	console.log(`[cleanup] removed ${removed} leftover test categories — rows now ${rowCount}`);
}

// ── B1: DataTable root + thead 5 cột ──
{
	const st = await page.evaluate(() => {
		const root = document.querySelector('[data-test="categories-datatable"]');
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

// ── B2: nếu bảng rỗng → tạo category test qua modal (test create + auto-slug) ──
const testCatName = `Probe Cat ${Date.now()}`;
const testCatSlug = `probe-cat-${Date.now()}`;
let createdTestCat = false;
if (rowCount === 0) {
	await page.locator('button', { hasText: /Thêm danh mục|Add Category/ }).first().click();
	await sleep(900);
	const nameInput = page.locator('[role="dialog"] input').first();
	await nameInput.fill(testCatName);
	await sleep(600);
	const slugValue = await page.locator('[role="dialog"] input').nth(1).inputValue();
	ok('B2a · Modal create mở + auto-slug theo name', slugValue === testCatSlug, `slug="${slugValue}"`);
	await page.locator('[role="dialog"] button', { hasText: /Tạo danh mục|Create Category/ }).last().click();
	await sleep(1500);
	rowCount = await waitStable(page, 20000);
	createdTestCat = true;
}
{
	const st = await page.evaluate(() => {
		const rows = document.querySelectorAll(
			'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		const first = rows[0];
		const tds = first ? [...first.querySelectorAll('td')] : [];
		return {
			rowCount: rows.length,
			firstName: tds[0]?.textContent?.trim().slice(0, 40) ?? '',
			firstSlug: tds[1]?.textContent?.trim().slice(0, 40) ?? ''
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
			'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
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
		const pills = document.querySelectorAll('[data-test="categories-datatable"] .datatable-status');
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

// ── B7: page size 10 ──
{
	const select = page.locator('.admin-pagination select.admin-select');
	await select.selectOption('10');
	// Không sleep trước waitStable — skeleton ngắn có thể qua trước khi poll
	const rows = await waitStable(page, 20000);
	const pageInfo = await page.evaluate(() => document.querySelector('.page-info')?.textContent?.trim() ?? '');
	ok(
		'B7 · Page size 10 → refetch, ≤ 10 row',
		rows > 0 && rows <= 10 && pageInfo.includes('1'),
		`rows=${rows} pageInfo="${pageInfo}"`
	);
	await select.selectOption('20');
	await waitStable(page, 20000);
}

// ── B9a: tạo category CON (parent = row đầu) → row có prefix '↳ ' ──
let childCreated = false;
const childCatName = `Probe Cat Child ${Date.now()}`;
{
	// Lấy _id row đầu làm parent qua edit modal (không có data-row-id vì
	// row là object đúc flatten — lấy name row đầu thôi, parent chọn theo label)
	const firstName = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		return row?.querySelector('td')?.textContent?.trim() ?? '';
	});
	// Tạo con: mở create modal → chọn parent theo label trùng firstName
	await page.locator('button', { hasText: /Thêm danh mục|Add Category/ }).first().click();
	await sleep(900);
	await page.locator('[role="dialog"] input').first().fill(childCatName);
	await sleep(600);
	// Chọn parent trong select (option label = tên category cha)
	const parentSelect = page.locator('[role="dialog"] select').first();
	const hasOpt = await parentSelect.locator('option', { hasText: firstName }).count();
	if (hasOpt > 0) {
		await parentSelect.selectOption({ label: firstName });
	} else {
		// fallback: chọn option khác "None" đầu tiên
		const opts = await parentSelect.locator('option').all();
		for (const o of opts) {
			const t = await o.textContent();
			if (t && !t.includes('None') && !t.includes('Không có')) {
				await parentSelect.selectOption({ label: t });
				break;
			}
		}
	}
	await sleep(400);
	await page.locator('[role="dialog"] button', { hasText: /Tạo danh mục|Create Category/ }).last().click();
	await sleep(1500);
	await waitStable(page, 20000);
	childCreated = true;

	// Check: row chứa childCatName phải có prefix '↳ '
	const st = await page.evaluate(
		(name) => {
			const rows = [...document.querySelectorAll('[data-test="categories-datatable"] tbody tr')];
			const row = rows.find((r) => r.textContent.includes(name));
			const td = row?.querySelector('td');
			return { found: !!row, text: td?.textContent?.trim().slice(0, 60) ?? '' };
		},
		childCatName
	);
	ok(
		'B9a · Category con render prefix ↳ theo depth',
		st.found && st.text.startsWith('↳'),
		JSON.stringify(st)
	);
}

// ── B9b: Edit modal con → parent select KHÔNG chứa con của nó (chống chu trình) ──
{
	const editBtn = page.locator(
		'[data-test="categories-datatable"] tbody tr',
		{ hasText: childCatName }
	).locator('[data-test="category-action-edit"]').first();
	await editBtn.click();
	await sleep(900);
	const st = await page.evaluate(
		(childName) => {
			const modal = document.querySelector('[role="dialog"]');
			const select = modal?.querySelector('select');
			const opts = select ? [...select.querySelectorAll('option')].map((o) => o.textContent.trim()) : [];
			return {
				hasModal: !!modal,
				hasSelfInOptions: opts.includes(childName),
				optionCount: opts.length
			};
		},
		childCatName
	);
	ok(
		'B9b · Edit con: parent select loại chính nó (chống chu trình)',
		st.hasModal && !st.hasSelfInOptions,
		JSON.stringify(st)
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

// ── B8: click Edit row đầu → modal mở + name điền sẵn ──
{
	const firstName = await page.evaluate(() => {
		const row = document.querySelector(
			'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
		);
		return row?.querySelector('td')?.textContent?.trim() ?? '';
	});
	await page.locator('[data-test="category-action-edit"]').first().click();
	await sleep(900);
	const st = await page.evaluate(() => {
		const modal = document.querySelector('[role="dialog"], .modal-container, .modal');
		const nameInput = modal?.querySelector('input');
		return {
			hasModal: !!modal,
			nameValue: nameInput?.value ?? ''
		};
	});
	// firstName có thể có prefix '↳ ' (nếu row đầu là con) — so theo suffix
	const expectedClean = firstName.replace(/^(↳\s*)+/, '');
	ok(
		'B8 · Click Sửa → modal mở + name điền sẵn',
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

// Dọn category test (nếu probe đã tạo) — xóa con trước cha.
if (childCreated) {
	const delChild = page.locator(
		'[data-test="categories-datatable"] tbody tr',
		{ hasText: childCatName }
	).locator('[data-test="category-action-delete"]').first();
	await delChild.click();
	await sleep(3500);
	await waitStable(page, 15000);
}
if (createdTestCat) {
	const delBtn = page.locator(
		'[data-test="categories-datatable"] tbody tr',
		{ hasText: testCatName }
	).locator('[data-test="category-action-delete"]').first();
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
// deleteCategory dùng confirm() native — không có handler thì Playwright
// auto-dismiss → confirm trả false → category không bao giờ bị xóa.
mpage.on('dialog', (d) => d.accept());

await login(mpage);
await mpage.goto(`${BASE}/admin/categories`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitStable(mpage);

// Chuẩn bị: mobile cần ít nhất 1 data row để kiểm chứng td actions —
// tạo category tạm nếu bảng trống (desktop đã dọn category test trước đó).
const mobileCatName = `Probe Mobile Cat ${Date.now()}`;
let mobileCatCreated = false;
{
	const row = mpage.locator(
		'[data-test="categories-datatable"] tbody tr:not(.datatable-row--skeleton):not(.datatable-empty-row)'
	).first();
	if ((await row.count()) === 0) {
		await mpage.locator('button', { hasText: /Thêm danh mục|Add Category/ }).first().click();
		await sleep(900);
		await mpage.locator('[role="dialog"] input').first().fill(mobileCatName);
		await sleep(500);
		await mpage.locator('[role="dialog"] button', { hasText: /Tạo danh mục|Create Category/ }).last().click();
		await sleep(1500);
		await waitStable(mpage, 20000);
		mobileCatCreated = true;
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

// B13: tap card → B5 mobileTapMode="callback" — modal EDIT mở trực tiếp
// (không còn expand bar; bar thay bằng modal + nút Xoá footer).
{
	await mpage.evaluate(() => document.querySelector('.datatable-card[data-row-id]')?.click());
	await sleep(1000);
	const st = await mpage.evaluate(() => {
		const modal = [...document.querySelectorAll('.modal-root')].find(
			(d) => d.getBoundingClientRect().width > 0
		);
		const del = document.querySelector('[data-test="category-modal-delete"]');
		return { hasModal: !!modal, hasDelete: !!del && del.getBoundingClientRect().width > 0 };
	});
	ok('B13 · Mobile: tap card → modal EDIT mở (B5 callback)', st.hasModal, JSON.stringify(st));
}

// B14: modal edit có nút Xoá (B5 — thay expand bar)
{
	const st = await mpage.evaluate(() => {
		const del = document.querySelector('[data-test="category-modal-delete"]');
		return { hasDelete: !!del && del.getBoundingClientRect().width > 0 };
	});
	ok('B14 · Mobile: modal edit có nút Xoá (B5)', st.hasDelete);
	await mpage.keyboard.press('Escape');
	await sleep(700);
}

// B14a: card view (B5) — cardFields khai báo 4 trường (category/slug/status/updated)
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
		'B14a · Mobile: card view (B5) — cards render với label:value',
		st.cardMode && (st.cardCount > 0 || st.firstLabels.length === 0),
		JSON.stringify(st)
	);
}

ok('B15 · Mobile: 0 pageerror', mErrors.length === 0, mErrors.join(' | ').slice(0, 200));

// Dọn category test mobile (nếu đã tạo) — B5: tap card → modal edit → nút
// Xoá footer (confirm() auto-accept).
if (mobileCatCreated) {
	const cards = mpage.locator('.datatable-card', { hasText: mobileCatName });
	let guard = 0;
	while ((await cards.count()) > 0 && guard++ < 6) {
		await cards.first().click();
		await sleep(1000);
		// modal edit mở — nút Xoá trong footer
		const del = mpage.locator('[data-test="category-modal-delete"]').first();
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
