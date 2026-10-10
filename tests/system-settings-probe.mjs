// system-settings-probe.mjs
// Hệ thống quản lý app (app settings + system status) — verify toàn bộ:
//
//   (A) /api/admin/system-settings/get fetch THẲNG không encrypt + không session
//       → status ≠ 200 và ≠ 500 (hooks chặn 401 Session expired TRƯỚC khi decrypt
//       → 400 Decryption failed là bình thường cho request thẳng).
//   (B) /settings unauth → 303 → /login?redirect= (auth guard (authorized) routes).
//   (C) Login thật qua UI (dev server https://localhost:3000, ignoreHTTPSErrors)
//       → /settings → tabs render (4 tab cấu hình + tab status) + status section
//       render + 0 console/page error SSR.
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Fetch thẳng cần rejectUnauthorized=false (self-signed cert dev server) —
// Playwright lo riêng cho phần UI qua ignoreHTTPSErrors. Top-level await cho
// import undici (Node có sẵn undici nội bộ nhưng không expose — dùng NODE_TLS_REJECT_UNAUTHORIZED).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fetchRaw = (url, options = {}) => fetch(url, options);
const apiGet = await fetchRaw(`${BASE}/api/admin/system-settings/get`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', 'Accept-Language': 'vi' },
	body: JSON.stringify({ foo: 1 })
});
ok('(A) /api/admin/system-settings/get unauth ≠ 200', apiGet.status !== 200, `status=${apiGet.status}`);
ok('(A) /api/admin/system-settings/get unauth ≠ 500', apiGet.status !== 500, `status=${apiGet.status}`);

const apiUpdate = await fetchRaw(`${BASE}/api/admin/system-settings/update`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', 'Accept-Language': 'vi' },
	body: JSON.stringify({ patch: {} })
});
ok('(A) /api/admin/system-settings/update unauth ≠ 200', apiUpdate.status !== 200, `status=${apiUpdate.status}`);
ok('(A) /api/admin/system-settings/update unauth ≠ 500', apiUpdate.status !== 500, `status=${apiUpdate.status}`);

const apiStatus = await fetchRaw(`${BASE}/api/admin/system-settings/status`, {
	method: 'POST',
	headers: { 'content-type': 'application/json', 'Accept-Language': 'vi' },
	body: JSON.stringify({})
});
ok('(A) /api/admin/system-settings/status unauth ≠ 200', apiStatus.status !== 200, `status=${apiStatus.status}`);
ok('(A) /api/admin/system-settings/status unauth ≠ 500', apiStatus.status !== 500, `status=${apiStatus.status}`);

// ════════════════ (B) /settings unauth → 303 redirect login ════════════════
const settingsRes = await fetchRaw(`${BASE}/settings`, { redirect: 'manual' });
const loc = settingsRes.headers.get('location') ?? '';
ok('(B) /settings unauth → 303', settingsRes.status === 303, `status=${settingsRes.status}`);
ok('(B) redirect → /login?redirect=', loc.includes('/login?redirect='), `location=${loc}`);

// ════════════════ (C) Login thật qua UI → /settings ════════════════
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (msg) => {
	if (msg.type() === 'error') consoleErrors.push(msg.text());
});

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(500);

// Fill credentials owner (username 'admin' + password từ .env — login bằng username
// KHÔNG @ nên đi đúng đường usernameBlindIndex)
const usernameInput = page.locator('.auth-input-wrapper input').first();
await usernameInput.fill('admin');
await sleep(400);
const passwordInput = page.locator('.auth-input-wrapper input').nth(1);
await passwordInput.fill('123123_Qwe');
await sleep(600);

const submitBtn = page.locator('.auth-btn-submit').first();
const submitDisabled = await submitBtn.isDisabled();
if (submitDisabled) {
	ok('(C) submit login KHÔNG disabled', false, 'submit disabled — không login được để check /settings');
} else {
	await submitBtn.click();
	// Đợi rời /login thật sự (login API: RSA decrypt + JWT sign + blind index
	// có thể lâu hơn 1.5s — sleep cứng gây race mất cookie, giống business probe
	// phải waitForURL đổi hẳn trong 20s)
	await page.waitForURL((u) => !u.toString().includes('/login'), {
		waitUntil: 'domcontentloaded',
		timeout: 20000
	});
	await sleep(1000);
	const afterLoginUrl = page.url();
	ok('(C) login thành công (rời /login)', !afterLoginUrl.includes('/login'), `url=${afterLoginUrl}`);

	// Vào /settings
	await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await sleep(2500);
	const settingsUrl = page.url();
	ok('(C) /settings KHÔNG bị redirect ngược login (session hợp lệ)', !settingsUrl.includes('/login'), `url=${settingsUrl}`);

	// Tabs render — 4 tab cấu hình + tab status (≥ 4 trigger)
	const tabCount = await page.locator('[data-test^="tab-trigger-"]').count();
	const tabNames = await page.locator('[data-test^="tab-trigger-"]').allTextContents();
	ok('(C) /settings render ≥ 4 tab trigger', tabCount >= 4, `tabs=${tabCount} ${JSON.stringify(tabNames.slice(0, 5))}`);

	// Status section render (grid uptime/memory/node/db + audit)
	const statusState = await page.evaluate(() => {
		const grid = document.querySelector('[data-test="status-grid"]');
		const audit = document.querySelector('[data-test="audit-section"]');
		const title = document.querySelector('[data-test="settings-title"]');
		const save = document.querySelector('[data-test="settings-save"]');
		const tags = grid ? grid.querySelectorAll('.status-card').length : 0;
		return {
			hasTitle: !!title,
			titleText: title ? title.textContent.trim() : '',
			hasSave: !!save,
			hasStatusGrid: !!grid,
			statusCards: tags,
			hasAuditSection: !!audit,
			uptime: document.querySelector('[data-test="status-uptime"]')?.textContent?.trim() ?? null,
			memory: document.querySelector('[data-test="status-memory"]')?.textContent?.trim() ?? null,
			node: document.querySelector('[data-test="status-node"]')?.textContent?.trim() ?? null,
			dbBadgeOk: !!document.querySelector('[data-test="db-badge-ok"]'),
			dbBadgeError: !!document.querySelector('[data-test="db-badge-error"]')
		};
	});
	ok('(C) settings title + nút Save render', statusState.hasTitle && statusState.hasSave, `title="${statusState.titleText}"`);
	ok('(C) status section render (status-grid + ≥ 4 card)', statusState.hasStatusGrid && statusState.statusCards >= 4, `cards=${statusState.statusCards}`);
	ok('(C) audit section render', statusState.hasAuditSection === true);
	ok(
		'(C) status dashboard có dữ liệu thật (uptime + node + db badge)',
		(statusState.uptime !== null && statusState.uptime !== '—' && statusState.uptime.length > 0) &&
			(statusState.node ?? '').startsWith('v') &&
			(statusState.dbBadgeOk || statusState.dbBadgeError),
		`uptime=${statusState.uptime} node=${statusState.node} dbOk=${statusState.dbBadgeOk} dbErr=${statusState.dbBadgeError}`
	);

	// Chuyển tab Security → 3 input number render (draft string states)
	// Bẫy check yếu: content tồn tại trong DOM dù hidden — phải khẳng định
	// aria-selected + !hidden (tab switching từng bị revert về General do
	// Tabs.Root select() không ghi prop value, hidden:true vẫn PASS mù).
	const assertTabActive = async (tab) => {
		await page.locator(`[data-test="tab-trigger-${tab}"]`).click();
		await page.waitForFunction(
			(t) => {
				const trigger = document.querySelector(`[data-test="tab-trigger-${t}"]`);
				const content = document.querySelector(`[data-test="tab-content-${t}"]`);
				return (
					trigger?.getAttribute('aria-selected') === 'true' && !!content && !content.hidden
				);
			},
			tab,
			{ timeout: 5000 }
		);
	};
	await assertTabActive('security');
	await sleep(300);
	const secInputs = await page.evaluate(() => {
		const content = document.querySelector('[data-test="tab-content-security"]');
		const inputs = content ? content.querySelectorAll('input') : [];
		return [...inputs].map((i) => ({ type: i.type, value: i.value, disabled: i.disabled }));
	});
	ok(
		'(C) tab Security: 3 input number có giá trị (draft string sync)',
		secInputs.length === 3 && secInputs.every((i) => i.value !== ''),
		JSON.stringify(secInputs).slice(0, 160)
	);

	// Chuyển tab Status (tab thứ 5) → status-grid nằm trong tab content, VISIBLE
	await assertTabActive('status');
	await sleep(300);
	const statusInTab = await page.evaluate(() => {
		const content = document.querySelector('[data-test="tab-content-status"]');
		const grid = content ? content.querySelector('[data-test="status-grid"]') : null;
		return { hasGrid: !!grid, hidden: content ? content.hidden : null };
	});
	ok(
		'(C) tab Status render status-grid bên trong (visible)',
		statusInTab.hasGrid === true && statusInTab.hidden === false,
		JSON.stringify(statusInTab)
	);
}

ok('(C) 0 pageerror (SSR + client)', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
const hardConsoleErrors = consoleErrors.filter(
	(m) => !m.includes('favicon') && !m.includes('sourcemap') && !m.includes('DevTools')
);
ok('(C) 0 console error', hardConsoleErrors.length === 0, hardConsoleErrors.join(' | ').slice(0, 200));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
