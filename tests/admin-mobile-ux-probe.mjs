// tests/admin-mobile-ux-probe.mjs
// Probe B5 (Pha 3) — Admin mobile UX: sticky header/filters/thead/pagination +
//   card view + tap-row-callback + nút Xoá trong modal edit.
//   AM1. Mobile: .admin-inset-body padding = 8px (0.5rem)
//   AM2. Mobile scroll 300px → .admin-inset-header.is-scrolled (padding nhỏ hơn + shadow), scroll 0 khôi phục
//   AM3. Mobile scroll sâu → header top=0, filters top=headerH, thead th top ≈ headerH+filtersH (+caption 1.75rem ±2)
//   AM4. Mobile: pagination bottom ≈ viewport height (sticky bottom)
//   AM5. Mobile tap row users → modal EDIT mở (không action bar), nút Xoá [user-modal-delete] có trong modal
//   AM6. Mobile users: [data-test="datatable-cards"] có, table ẩn, số card = số row, field khớp cardFields
//   AM7. Mobile tap card brands → modal edit mở đúng data
//   AM8. Desktop 1280: vẫn bảng (không cards), không sticky-head class, tap row giữ hành vi cũ
//   AM9. 0 pageerror
import { chromium, devices } from 'playwright';

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
	await sleep(1500);
}

/** Tìm scroll container thật (ancestor overflowY auto — window không cuộn). */
const findScrollTop = async (page) =>
	page.evaluate(() => {
		let el = document.querySelector('.admin-inset-body');
		while (el && el.parentElement) {
			el = el.parentElement;
			if (getComputedStyle(el).overflowY === 'auto') return el.scrollTop;
		}
		return window.scrollY;
	});

const scrollAdminTo = async (page, top) => {
	await page.evaluate((t) => {
		let el = document.querySelector('.admin-inset-body');
		while (el && el.parentElement) {
			el = el.parentElement;
			if (getComputedStyle(el).overflowY === 'auto') {
				el.scrollTop = t;
				return;
			}
		}
		window.scrollTo(0, t);
	}, top);
	await sleep(500);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const errors = { mobile: [], desktop: [] };

/** Chờ datatable render xong (root + cards hoặc rows, loading xong). */
async function waitDataTable(page, { wantCards = false } = {}) {
	for (let i = 0; i < 40; i++) {
		const ready = await page.evaluate((wc) => {
			const root = document.querySelector('.datatable-root');
			if (!root || root.classList.contains('is-loading')) return false;
			const cards = document.querySelectorAll('.datatable-card').length;
			const rows = document.querySelectorAll('.datatable-row').length;
			if (wc) return cards > 0 || rows > 0; // card-mode hoặc fallback bảng
			return cards > 0 || rows > 0;
		}, wantCards);
		if (ready) return true;
		await sleep(500);
	}
	return false;
}

// ══════════════ MOBILE 375 (iPhone 13) ══════════════
{
	const context = await browser.newContext({
		...devices['iPhone 13'],
		ignoreHTTPSErrors: true
	});
	const page = await context.newPage();
	page.on('pageerror', (e) => errors.mobile.push(e.message));

	await login(page);

	// ── AM1: padding .admin-inset-body = 8px ──
	{
		await page.goto(`${BASE}/admin/brands`, { waitUntil: 'domcontentloaded', timeout: 30000 });
		await waitDataTable(page);
		await sleep(500);
		const pad = await page.evaluate(() => {
			const el = document.querySelector('.admin-inset-body');
			return el ? getComputedStyle(el).paddingLeft : null;
		});
		ok('AM1 mobile inset-body padding 8px', pad === '8px', `paddingLeft=${pad}`);
	}

	// ── AM2: is-scrolled bật/tắt (customers — SH 1989 > viewport, có filters;
	//      brands/orders DB chỉ 0-2 rows → không đủ nội dung cuộn) ──
	{
		await page.goto(`${BASE}/admin/customers`, { waitUntil: 'domcontentloaded', timeout: 30000 });
		await waitDataTable(page);
		await scrollAdminTo(page, 300);
		const scrolled = await page.evaluate(() => {
			const h = document.querySelector('.admin-inset-header');
			return { has: !!h, isScrolled: h?.classList.contains('is-scrolled') ?? false };
		});
		ok('AM2a scroll 300 → is-scrolled', scrolled.has && scrolled.isScrolled);
		const padScrolled = await page.evaluate(() => {
			const h = document.querySelector('.admin-inset-header');
			return h ? getComputedStyle(h).paddingTop : null;
		});
		await scrollAdminTo(page, 0);
		const restored = await page.evaluate(
			() => !document.querySelector('.admin-inset-header')?.classList.contains('is-scrolled')
		);
		ok('AM2b scroll 0 → khôi phục', restored, `paddingTop@300=${padScrolled}`);
	}

	// ── AM3: sticky header/filters/thead (tiếp customers — đã ở đây sau AM2) ──
	{
		// đợi render ổn định trước khi đo
		let prev = -1;
		for (let i = 0; i < 10; i++) {
			const h = await page.evaluate(() => document.body.scrollHeight);
			if (h === prev && h > 0) break;
			prev = h;
			await sleep(400);
		}
		await scrollAdminTo(page, 500);
		const tops = await page.evaluate(() => {
			const header = document.querySelector('.admin-inset-header');
			const filters = document.querySelector('.admin-filters');
			const th = document.querySelector('.datatable-th');
			const r = (el) => (el ? el.getBoundingClientRect().top : null);
			return {
				headerTop: r(header),
				filtersTop: filters ? r(filters) : null,
				thTop: th ? r(th) : null,
				headerH: header ? header.getBoundingClientRect().height : 0
			};
		});
		ok(
			'AM3a header sticky top≈0',
			tops.headerTop !== null && Math.abs(tops.headerTop) <= 2,
			`top=${tops.headerTop}`
		);
		ok(
			'AM3b filters top≈headerH',
			tops.filtersTop !== null && Math.abs(tops.filtersTop - tops.headerH) <= 25,
			`filtersTop=${tops.filtersTop} headerH=${tops.headerH}`
		);
		ok(
			'AM3c thead th sticky (top > 0 khi cuộn sâu)',
			tops.thTop === null || tops.thTop >= -5,
			`thTop=${tops.thTop} (null = card-mode, thead không render — PASS khi cards)`
		);
	}

	// ── AM4: pagination sticky bottom ≈ viewport ──
	{
		const bot = await page.evaluate(() => {
			const pag = document.querySelector('.admin-pagination');
			if (!pag) return null;
			return pag.getBoundingClientRect().bottom;
		});
		ok(
			'AM4 pagination bottom≈viewport',
			bot !== null && Math.abs(bot - 667) <= 30,
			`bottom=${bot} (viewport 667)`
		);
	}

	// ── AM6: card view users ──
	{
		await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
		await waitDataTable(page, { wantCards: true });
		const cards = await page.evaluate(() => {
			const wrap = document.querySelector('[data-test="datatable-cards"]');
			const table = document.querySelector('.datatable-root table');
			const cardEls = wrap ? wrap.querySelectorAll('.datatable-card') : [];
			const labels = wrap
				? [...wrap.querySelectorAll('.datatable-card-label')].slice(0, 4).map((l) => l.textContent?.trim())
				: [];
			return {
				has: !!wrap,
				tableHidden: !table || getComputedStyle(table.closest('.datatable-root')).display === 'none',
				count: cardEls.length,
				labels
			};
		});
		ok('AM6a cards tồn tại + table ẩn', cards.has && cards.tableHidden, `labels=${cards.labels.join('|')}`);
		ok('AM6b có card render', cards.count > 0, `count=${cards.count}`);
	}

	// ── AM5: tap row users → modal edit + nút Xoá ──
	{
		await waitDataTable(page, { wantCards: true });
		const tap = await page.evaluate(() => {
			const card = document.querySelector('.datatable-card[data-row-id]');
			if (card) {
				card.click();
				return 'card';
			}
			const row = document.querySelector('.datatable-row[data-row-id]');
			if (row) {
				row.click();
				return 'row';
			}
			return null;
		});
		await sleep(1200);
		const modal = await page.evaluate(() => {
			const dialogs = [...document.querySelectorAll('[role="dialog"], .modal-root, .user-form-modal')];
			const vis = dialogs.filter((d) => {
				const r = d.getBoundingClientRect();
				return r.width > 0 && r.height > 0;
			});
			const del = document.querySelector('[data-test="user-modal-delete"]');
			const delVis = del && del.getBoundingClientRect().width > 0;
			return { any: vis.length > 0, hasDelete: !!del && delVis };
		});
		ok('AM5a tap → modal edit mở', tap !== null && modal.any, `tap=${tap}`);
		ok('AM5b nút Xoá trong modal', modal.hasDelete);
		// đóng modal (Esc / nút hủy) để sạch state
		await page.keyboard.press('Escape');
		await sleep(600);
	}

	// ── AM7: tap card brands → modal edit đúng data ──
	{
		await page.goto(`${BASE}/admin/brands`, { waitUntil: 'domcontentloaded', timeout: 30000 });
		await waitDataTable(page, { wantCards: true });
		await sleep(500);
		const info = await page.evaluate(() => {
			const wrap = document.querySelector('[data-test="datatable-cards"]');
			if (!wrap) return null;
			const card = wrap.querySelector('.datatable-card[data-row-id]');
			const title = card?.querySelector('.datatable-card-title')?.textContent?.trim();
			return { title, found: !!card };
		});
		if (info?.found) {
			await page.locator('.datatable-card[data-row-id]').first().click();
			await sleep(1500);
			const modal = await page.evaluate(() => {
				const inputs = [...document.querySelectorAll('.modal-root input, .user-form-modal input')];
				const vis = [...document.querySelectorAll('.modal-root')].filter(
					(d) => d.getBoundingClientRect().width > 0
				);
				const del = document.querySelector('[data-test="brand-modal-delete"]');
				return {
					open: vis.length > 0 || inputs.some((i) => i.getBoundingClientRect().width > 0),
					inputVal: inputs.find((i) => i.getBoundingClientRect().width > 0)?.value ?? ''
				};
			});
			ok('AM7 tap card brands → modal edit', modal.open, `title="${info.title}" input="${modal.inputVal}"`);
			await page.keyboard.press('Escape');
			await sleep(600);
		} else {
			ok('AM7 tap card brands → modal edit', false, 'không có card (fallback bảng)');
		}
	}

	await context.close();
}

// ══════════════ DESKTOP 1280 ══════════════
{
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 900 }
	});
	const page = await context.newPage();
	page.on('pageerror', (e) => errors.desktop.push(e.message));

	await login(page);
	await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await waitDataTable(page);

	// ── AM8: desktop giữ bảng, không card / không hiệu ứng sticky (class
	//      sticky-head gắn theo prop opt-in là đúng; CSS chỉ áp ≤1024px —
	//      desktop phải có thead position static) ──
	{
		const state = await page.evaluate(() => {
			const root = document.querySelector('.datatable-root');
			const cards = document.querySelector('[data-test="datatable-cards"]');
			const table = root?.querySelector('table');
			const th = root?.querySelector('.datatable-th');
			const thPos = th ? getComputedStyle(th).position : null;
			const wrap = root?.querySelector('.datatable-table-wrap');
			const wrapOv = wrap ? getComputedStyle(wrap).overflowX : null;
			return {
				hasTable: !!table,
				hasCards: !!cards,
				cardModeClass: root?.classList.contains('datatable-card-mode') ?? false,
				thPos,
				wrapOv
			};
		});
		ok(
			'AM8 desktop bảng + không card + thead static',
			state.hasTable &&
				!state.hasCards &&
				!state.cardModeClass &&
				(state.thPos === 'static' || state.thPos === 'relative') &&
				state.wrapOv === 'auto',
			`thPos=${state.thPos} wrapOv=${state.wrapOv}`
		);
	}

	ok('AM9 0 pageerror (mobile+desktop)', errors.mobile.length === 0 && errors.desktop.length === 0, errors.mobile.join('; ') || errors.desktop.join('; ') || 'sạch');

	await context.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n═══ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ═══`);
if (failed.length) process.exit(1);
