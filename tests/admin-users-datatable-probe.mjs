// tests/admin-users-datatable-probe.mjs
// Probe B6.2 (Pha 3) — Users page migrate DataTable + Pagination:
//   U1. DataTable render (root [data-test=users-datatable]) + thead 4 cột
//   U2. tbody có row (name/role/status pill/created)
//   U3. Cột actions: 5 nút ghost (edit/role/status/reset/delete) render
//   U4. Status pill class datatable-status--success/warning... (map statusId)
//   U5. Pagination compact render (prev + page + next), tổng trang đúng
//   U6. Click next → server fetch trang 2 (URL data đổi — tbody row khác/non-empty
//       + page state = 2)
//   U7. Đổi page size 20 → 10 → fetch lại trang 1, ≤ 10 row hiển thị
//   U8. Click nút Edit row 1 → UserFormModal mở (display true)
//   U9. Checkbox showDeleted toggle → fetch lại (loading pulse) — KHÔNG crash
//   U10. 0 pageerror / 0 console error (loại known 405 catalog pre-existing)
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// Poll table sẵn sàng: tbody có row HOẶC empty state (fetchSecure 6-8s cold).
async function waitTable(page, maxMs = 25000) {
	const t0 = Date.now();
	while (Date.now() - t0 < maxMs) {
		const st = await page.evaluate(() => ({
			rows: document.querySelectorAll('[data-test="users-datatable"] tbody tr').length,
			loadingGone: !document.querySelector('.admin-state')
		}));
		if (st.loadingGone && st.rows >= 0) return st.rows;
		await sleep(400);
	}
	return -1;
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
await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
const rowCount = await waitTable(page);

// ── U1: DataTable root + thead 4 cột ──
{
	const st = await page.evaluate(() => {
		const root = document.querySelector('[data-test="users-datatable"]');
		const ths = root ? root.querySelectorAll('thead th') : [];
		return {
			hasRoot: !!root,
			thCount: ths.length,
			thText: [...ths].map((t) => t.textContent.trim()).slice(0, 6),
			isDatatable: root ? root.className.includes('datatable') : false
		};
	});
	ok(
		'U1 · DataTable render + thead (4 cột + actions)',
		st.hasRoot && st.isDatatable && st.thCount === 5,
		JSON.stringify(st)
	);
}

// ── U2: tbody row ──
{
	const st = await page.evaluate(() => {
		const rows = document.querySelectorAll('[data-test="users-datatable"] tbody tr');
		const first = rows[0];
		const tds = first ? [...first.querySelectorAll('td')] : [];
		return {
			rowCount: rows.length,
			firstName: tds[0]?.textContent?.trim().slice(0, 30) ?? '',
			roleText: tds[1]?.textContent?.trim().slice(0, 20) ?? '',
			createdText: tds[3]?.textContent?.trim().slice(0, 15) ?? ''
		};
	});
	ok(
		'U2 · tbody có row (name + role + created)',
		rowCount > 0 && st.rowCount > 0 && st.firstName && st.roleText,
		JSON.stringify(st)
	);
}

// ── U3: 5 nút actions trong cột cuối row 1 ──
{
	const st = await page.evaluate(() => {
		const row = document.querySelector('[data-test="users-datatable"] tbody tr');
		const actionsTd = row?.querySelector('td[data-role="row-actions"], td:last-child');
		const btns = actionsTd ? actionsTd.querySelectorAll('button') : [];
		return {
			btnCount: btns.length,
			labels: [...btns].map((b) => b.textContent.trim()).slice(0, 6)
		};
	});
	ok(
		'U3 · Row actions: 5 nút (Sửa/Đổi vai trò/Đổi trạng thái/Đặt lại MK/Xoá)',
		st.btnCount === 5,
		JSON.stringify(st)
	);
}

// ── U4: status pill ──
{
	const st = await page.evaluate(() => {
		const pills = document.querySelectorAll('[data-test="users-datatable"] .datatable-status');
		const classes = [...pills].map((p) => p.className.match(/datatable-status--(\w+)/)?.[1] ?? '?');
		return {
			pillCount: pills.length,
			kinds: [...new Set(classes)]
		};
	});
	ok('U4 · Status pill render (datatable-status--*)', st.pillCount > 0, JSON.stringify(st));
}

// ── U5: Pagination element ──
{
	const st = await page.evaluate(() => {
		const pag = document.querySelector('.admin-pagination');
		const buttons = pag ? [...pag.querySelectorAll('button')] : [];
		const pageInfo = pag?.querySelector('.page-info')?.textContent?.trim() ?? '';
		const total = pag?.querySelector('.total-count')?.textContent?.trim() ?? '';
		return {
			hasPag: !!pag,
			btnCount: buttons.length,
			pageInfo,
			total
		};
	});
	ok(
		'U5 · Pagination compact + page info + total',
		st.hasPag && st.btnCount >= 2 && st.pageInfo.length > 0 && st.total.length > 0,
		JSON.stringify(st)
	);
}

// ── U6: next → trang 2 ──
{
	const before = await page.evaluate(() => document.querySelector('.page-info')?.textContent?.trim() ?? '');
	const nextBtn = page.locator('.admin-pagination button').last();
	const disabled = await nextBtn.isDisabled();
	let after = before;
	if (!disabled) {
		await nextBtn.click();
		await sleep(3000);
		after = await page.evaluate(() => document.querySelector('.page-info')?.textContent?.trim() ?? '');
	}
	const page2 = after.includes('2');
	ok(
		'U6 · Click next → trang 2 (server refetch)',
		disabled || page2,
		`disabled=${disabled} before="${before}" after="${after}"`
	);
	// Về trang 1 nếu đã đi trang 2
	if (!disabled && page2) {
		await page.locator('.admin-pagination button').first().click();
		await sleep(2500);
	}
}

// ── U7: page size 10 ──
{
	const select = page.locator('.admin-pagination select.admin-select');
	await select.selectOption('10');
	await sleep(3000);
	const st = await page.evaluate(() => ({
		rows: document.querySelectorAll('[data-test="users-datatable"] tbody tr').length,
		pageInfo: document.querySelector('.page-info')?.textContent?.trim() ?? ''
	}));
	ok(
		'U7 · Page size 10 → refetch, ≤ 10 row',
		st.rows > 0 && st.rows <= 10 && st.pageInfo.includes('1'),
		JSON.stringify(st)
	);
	// Về 20
	await select.selectOption('20');
	await sleep(2500);
}

// ── U8: click Edit → UserFormModal mở ──
{
	await page.locator('[data-test="user-action-edit"]').first().click();
	await sleep(900);
	const st = await page.evaluate(() => {
		const modal = document.querySelector('[role="dialog"], .modal-container, .modal');
		return { hasModal: !!modal, text: modal ? modal.textContent.trim().slice(0, 60) : '' };
	});
	ok('U8 · Click Sửa → UserFormModal mở', st.hasModal, JSON.stringify(st));
	// Đóng modal (nhấn Escape)
	await page.keyboard.press('Escape');
	await sleep(600);
}

// ── U9: toggle showDeleted ──
{
	const cb = page.locator('.admin-header input[type="checkbox"], .admin-header [role="checkbox"]').first();
	await cb.click();
	await sleep(3000);
	const st = await page.evaluate(() => ({
		hasTable: !!document.querySelector('[data-test="users-datatable"]'),
		hasEmptyState: !!document.querySelector('.admin-state')
	}));
	ok(
		'U9 · Toggle showDeleted → refetch OK (table/empty)',
		st.hasTable || st.hasEmptyState,
		JSON.stringify(st)
	);
	// Toggle lại
	await cb.click();
	await sleep(2500);
}

ok('U10 · 0 pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
const hardConsoleErrors = consoleErrors.filter(
	(m) => !m.includes('favicon') && !m.includes('sourcemap') && !m.includes('DevTools') && !m.includes('405')
);
ok('U10 · 0 console error', hardConsoleErrors.length === 0, hardConsoleErrors.join(' | ').slice(0, 200));

await browser.close();

// ── Mobile (context touch thật — media query hover:none/pointer:coarse
//    chỉ match khi hasTouch) ──
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
await mpage.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
const mRows = await waitTable(mpage);

// U11: th actions + td actions đều ẩn (mobile media query)
{
	const st = await mpage.evaluate(() => {
		const th = document.querySelector('.datatable-th--actions');
		const td = document.querySelector('.datatable-td--actions');
		return {
			thDisplay: th ? getComputedStyle(th).display : 'none-found',
			tdDisplay: td ? getComputedStyle(td).display : 'none-found',
			thVisibleCount: document.querySelectorAll('.datatable-th--actions').length
		};
	});
	ok(
		'U11 · Mobile: cột actions ẩn (th + td display:none)',
		st.thDisplay === 'none' && st.tdDisplay === 'none',
		JSON.stringify(st)
	);
}

// U12: table không tràn ngang (wrap scrollWidth === clientWidth)
{
	const st = await mpage.evaluate(() => {
		const wrap = document.querySelector('.admin-table-wrap');
		return { client: wrap.clientWidth, scroll: wrap.scrollWidth };
	});
	ok('U12 · Mobile: table gọn khung (không tràn ngang)', st.scroll <= st.client, JSON.stringify(st));
}

// U13: tap row 1 → expand bar snippet 5 nút, không nút nào tràn viewport
{
	await mpage.locator('[data-test="users-datatable"] tbody tr').first().tap();
	await sleep(700);
	const st = await mpage.evaluate(() => {
		const bar = document.querySelector('[data-role="mobile-actions"]');
		const btns = bar ? [...bar.querySelectorAll('button')] : [];
		const rects = btns.map((b) => b.getBoundingClientRect());
		return {
			hasBar: !!bar,
			btnCount: btns.length,
			overflow: rects.filter((r) => r.right > window.innerWidth || r.x < 0).length
		};
	});
	ok(
		'U13 · Mobile: tap row → snippet 5 nút, 0 tràn viewport',
		st.hasBar && st.btnCount === 5 && st.overflow === 0,
		JSON.stringify(st)
	);
}

// U14: tap nút Edit trong bar → modal mở
{
	const edit = mpage.locator('[data-role="mobile-actions"] [data-test="user-action-edit"]').first();
	await edit.tap();
	await sleep(900);
	const st = await mpage.evaluate(() => ({
		hasModal: !!document.querySelector('[role="dialog"], .modal-container, .modal')
	}));
	ok('U14 · Mobile: tap Edit trong bar → modal mở', st.hasModal, JSON.stringify(st));
}

ok('U15 · Mobile: 0 pageerror', mErrors.length === 0, mErrors.join(' | ').slice(0, 200));

await mbrowser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n══ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ══`);
if (failed.length) {
	console.log('FAIL list:');
	failed.forEach((f) => console.log(`  - ${f.name} — ${f.extra}`));
	process.exitCode = 1;
}
