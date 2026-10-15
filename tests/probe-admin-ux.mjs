// Probe 3 cải tiến UX admin (Agent G):
//  U1: header trang con thu gọn khi cuộn xuống (>80px) — subtitle ẩn (opacity 0,
//      max-height 0), title nhỏ 1.75rem→1.25rem; cuộn về top → trả nguyên.
//  U2: page-info ("Trang X/Y") đã bị xoá khỏi mọi trang admin.
//  U3: DataTable admin: có nút sort trên cột sortable, ô search, resize handle.
// Chạy: node tests/probe-admin-ux.mjs
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = '') {
	if (ok) {
		pass++;
		console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`);
	} else {
		fail++;
		failures.push(name + (detail ? ' — ' + detail : ''));
		console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
	}
}

async function dismissViteOverlay(page) {
	await page
		.waitForFunction(() => !document.querySelector('vite-error-overlay'), { timeout: 15000 })
		.catch(() => {});
}

// Đợi skeleton rows của DataTable biến mất (bẫy đã biết: chụp khi còn skeleton
// → ảnh không có dữ liệu thật). Poll đến khi .datatable-row--skeleton = 0.
async function waitForDataRows(page, timeoutMs = 20000) {
	await page
		.waitForFunction(
			() => {
				const sk = document.querySelectorAll('.datatable-row--skeleton').length;
				const real = document.querySelectorAll('.datatable-row:not(.datatable-row--skeleton)').length;
				return sk === 0 && real > 0;
			},
			{ timeout: timeoutMs }
		)
		.catch(() => {});
}

// Đọc computed style của header trang con (title + subtitle)
function headerStyles(page) {
	return page.evaluate(() => {
		const title = document.querySelector('.admin-header .admin-title');
		const subtitle = document.querySelector('.admin-header .admin-subtitle');
		if (!title || !subtitle) return null;
		const ts = getComputedStyle(title);
		const ss = getComputedStyle(subtitle);
		return {
			titleFontSize: ts.fontSize,
			subtitleOpacity: ss.opacity,
			subtitleMaxHeight: ss.maxHeight,
			subtitleRectH: subtitle.getBoundingClientRect().height
		};
	});
}

async function login(page) {
	await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await page.fill('.auth-input-wrapper input >> nth=0', 'admin');
	await page.fill('.auth-input-wrapper input >> nth=1', '123123_Qwe');
	await page.click('button[type="submit"]');
	await page.waitForURL(BASE + '/');
}

// Tìm container admin thực theo đúng logic findScrollEl của layout:
// từ .admin-inset đi lên, phần tử GẦN NHẤT có overflowY auto/scroll.
// Bẫy: div.w-full.h-full có thể clientHeight=0 tạm thời (layout chưa xong) —
// lọc thêm clientHeight>0; nếu vẫn không có → fallback scrollingElement.
// Gửi sang browser dạng string expression (page.evaluate không thấy scope Node).
const FIND_SCROLL_EL = `(() => {
	const inset = document.querySelector('.admin-inset');
	let cur = inset ? inset.parentElement : null;
	while (cur && cur !== document.body) {
		const s = getComputedStyle(cur);
		if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && cur.clientHeight > 0) return cur;
		cur = cur.parentElement;
	}
	return document.scrollingElement;
})()`;

function scrollCandidates(page) {
	return page.evaluate(`${FIND_SCROLL_EL} && (() => {
		const el = ${FIND_SCROLL_EL};
		return [{
			tag: el.tagName + '.' + String(el.className).split(' ').slice(0, 2).join('.'),
			scrollTop: el.scrollTop,
			scrollHeight: el.scrollHeight,
			clientHeight: el.clientHeight
		}];
	})()`);
}

async function scrollTo(page, y) {
	// Thử tối đa 3 lần: container có thể clientHeight=0 tạm thời (data loading)
	for (let attempt = 0; attempt < 3; attempt++) {
		const ok = await page.evaluate(`(() => {
			const el = ${FIND_SCROLL_EL};
			el.scrollTop = ${y};
			return ${y === 0} ? el.scrollTop === 0 : el.scrollTop > 0;
		})()`);
		if (ok) return true;
		await page.waitForTimeout(400);
	}
	// fallback: wheel chuột giữa vùng nội dung
	await page.mouse.move(960, 500);
	await page.mouse.wheel(0, y);
	await page.waitForTimeout(300);
	return page.evaluate(`(() => {
		const el = ${FIND_SCROLL_EL};
		return ${y === 0} ? el.scrollTop === 0 : el.scrollTop > 0;
	})()`);
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

try {
	await login(page);

	// ════ U1 + U2 + U3: trang payments ════
	console.log('\n== U1/U2/U3: /admin/payments ==');
	await page.goto(BASE + '/admin/payments', { waitUntil: 'domcontentloaded' });
	await dismissViteOverlay(page);
	await page.waitForSelector('.admin-header .admin-title', { timeout: 20000 });
	await page.waitForTimeout(600); // chờ data + transition tĩnh

	const before = await headerStyles(page);
	check('U1a payments có .admin-title + .admin-subtitle', !!before);
	if (before) {
		check(
			'U1b trước scroll: title 1.75rem, subtitle hiện (opacity 1)',
			before.titleFontSize === '28px' && before.subtitleOpacity === '1',
			`title=${before.titleFontSize} subtitleOpacity=${before.subtitleOpacity} maxH=${before.subtitleMaxHeight}`
		);
	}

	const sm0 = (await scrollCandidates(page))[0];
	console.log(`  [scroll candidates: ${JSON.stringify(await scrollCandidates(page))}]`);

	// Cuộn xuống 400px trong scroll container thực
	const scrolledDown = await scrollTo(page, 400);
	await page.waitForTimeout(500); // rAF + transition 200ms

	const after = await headerStyles(page);
	check('U1c probe cuộn được xuống >80px', scrolledDown, 'scrollTop sau lệnh cuộn');
	const sm1 = (await scrollCandidates(page)).find((c) => c.scrollTop > 80);
	check(
		'U1c2 có container đạt scrollTop >80',
		!!sm1,
		sm1 ? `scrollTop=${sm1.scrollTop} el=${sm1.tag}` : 'không container nào >80'
	);
	if (after) {
		check(
			'U1d sau scroll: title 1.25rem, subtitle ẩn (opacity 0)',
			after.titleFontSize === '20px' && after.subtitleOpacity === '0',
			`title=${after.titleFontSize} subtitleOpacity=${after.subtitleOpacity} rectH=${after.subtitleRectH}`
		);
		check('U1e sau scroll: subtitle max-height 0px', after.subtitleMaxHeight === '0px', `maxHeight=${after.subtitleMaxHeight}`);
	}

	// Screenshot sau scroll (đợi dữ liệu thật thay skeleton trước khi chụp)
	await waitForDataRows(page);
	await page.screenshot({ path: 'tests/_ui-shots/admin-ux-payments-scrolled.png' });

	// Cuộn về top
	await scrollTo(page, 0);
	await page.waitForTimeout(500);

	const restored = await headerStyles(page);
	if (restored) {
		check(
			'U1f về top: trả nguyên title 1.75rem + subtitle opacity 1',
			restored.titleFontSize === '28px' && restored.subtitleOpacity === '1',
			`title=${restored.titleFontSize} subtitleOpacity=${restored.subtitleOpacity}`
		);
	}

	// U2: page-info phải vắng mặt (payments)
	const pageInfoCount = await page.evaluate(() => document.querySelectorAll('.page-info').length);
	check('U2a payments không còn .page-info', pageInfoCount === 0, `count=${pageInfoCount}`);

	// U3: DataTable payments — sort button + search input + resize handle
	const dt = await page.evaluate(() => {
		const root = document.querySelector('[data-test="payments-datatable"]');
		if (!root) return null;
		return {
			sortButtons: root.querySelectorAll('.datatable-sort').length,
			searchInput: !!root.querySelector('.datatable-search'),
			searchPlaceholder: document.querySelector('.datatable-search')?.getAttribute('placeholder') ?? '',
			resizeHandles: root.querySelectorAll('.datatable-resize-handle').length
		};
	});
	check('U3a payments DataTable tồn tại', !!dt);
	if (dt) {
		check('U3b payments có nút sort', dt.sortButtons > 0, `sortButtons=${dt.sortButtons}`);
		check('U3c payments có ô search', dt.searchInput, `placeholder="${dt.searchPlaceholder}"`);
		check('U3d payments có resize handle', dt.resizeHandles > 0, `handles=${dt.resizeHandles}`);
	}

	// Screenshot top (trạng thái ban đầu) — chụp sau khi đã quay lại top
	await waitForDataRows(page);
	await page.screenshot({ path: 'tests/_ui-shots/admin-ux-payments-top.png' });

	// ════ U2 cho thêm 2 trang ════
	for (const [route, test] of [
		['customers', 'customers-datatable'],
		['promotions', 'promotions-datatable']
	]) {
		console.log(`\n== ${route} ==`);
		await page.goto(`${BASE}/admin/${route}`, { waitUntil: 'domcontentloaded' });
		await dismissViteOverlay(page);
		await page.waitForSelector('.admin-header .admin-title', { timeout: 20000 });
		await page.waitForTimeout(500);

		const pi = await page.evaluate(() => document.querySelectorAll('.page-info').length);
		check(`U2 ${route} không còn .page-info`, pi === 0, `count=${pi}`);

		const d = await page.evaluate(() => {
			const root = document.querySelector('.datatable-search');
			const sorts = document.querySelectorAll('.datatable-sort');
			const handles = document.querySelectorAll('.datatable-resize-handle');
			return { search: !!root, sorts: sorts.length, handles: handles.length };
		});
		check(`U3 ${route} search + sort + resize`, d.search && d.sorts > 0 && d.handles > 0, JSON.stringify(d));
	}

	// ════ U1 hành vi khi header dài (customers có filters) ════
	console.log('\n== U1 customers scroll ==');
	// Quay lại customers (vòng for phía trên vừa đi qua promotions) rồi mới cuộn
	await page.goto(`${BASE}/admin/customers`, { waitUntil: 'domcontentloaded' });
	await dismissViteOverlay(page);
	await page.waitForSelector('.admin-header .admin-title', { timeout: 20000 });
	await page.waitForTimeout(500);
	await waitForDataRows(page);
	await scrollTo(page, 400);
	await page.waitForTimeout(400);
	const custAfter = await headerStyles(page);
	if (custAfter) {
		check(
			'U1g customers scroll: title thu nhỏ + subtitle ẩn',
			custAfter.titleFontSize === '20px' && custAfter.subtitleOpacity === '0',
			`title=${custAfter.titleFontSize} sub=${custAfter.subtitleOpacity}`
		);
	}
	await page.screenshot({ path: 'tests/_ui-shots/admin-ux-customers-scrolled.png' });
} catch (err) {
	fail++;
	failures.push('FATAL: ' + (err?.message ?? String(err)));
	console.error('FATAL:', err);
} finally {
	await browser.close();
}

console.log(`\n===== KẾT QUẢ: ${pass} PASS / ${fail} FAIL =====`);
if (failures.length) {
	console.log('Thất bại:');
	for (const f of failures) console.log('  - ' + f);
}
process.exit(fail > 0 ? 1 : 0);
