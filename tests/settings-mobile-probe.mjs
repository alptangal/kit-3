// tests/settings-mobile-probe.mjs
// Probe B5 (Pha 3) — Settings mobile responsive + action bar:
//   M1. Desktop 1280: Tabs HIỆN (display ≠ none), Accordion ẨN
//   M2. Mobile 375: Accordion HIỆN với đủ 5 item, Tabs ẨN
//   M3. Mobile: mở accordion "general" (bind activeTab) → input app-name visible
//   M4. Mobile: sửa appName → action bar HIỆN, sticky bottom (boundingBox.bottom
//       gần viewport height), 2 nút Save + Cancel
//   M5. Click Cancel → value revert về bản gốc, action bar ẨN
//   M6. Desktop: action bar ẨN (Save ở header như cũ)
//   Regression: (C) các check probe cũ — title, save, status-grid, tab security
//   draft, 0 console error.
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
	const usernameInput = page.locator('.auth-input-wrapper input').first();
	await usernameInput.fill('admin');
	await sleep(400);
	const passwordInput = page.locator('.auth-input-wrapper input').nth(1);
	await passwordInput.fill('123123_Qwe');
	await sleep(600);
	await page.locator('.auth-btn-submit').first().click();
	await page.waitForURL((u) => !u.toString().includes('/login'), {
		waitUntil: 'domcontentloaded',
		timeout: 20000
	});
	await sleep(1000);
}

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

await login(page);
await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
// Đợi state ỔN ĐỊNH (bẫy phức tạp nhất B5): loading=$state(false) → SSR render
// nhánh {:else} NGAY (tabs có mặt + input giá trị default) → loadSettings
// onMount → loading=true + loadedOnce=false → nhánh loading CHIẾM CHỖ → tabs
// UNMOUNT tạm → remount khi xong (loadedOnce=true, sau đó không unmount nữa).
// Marker "attached" hay "input có giá trị" đều resolve NGAY trên DOM SSR rồi
// tabs biến mất đúng lúc evaluate. Marker chắc chắn duy nhất: tabs HIỆN LIÊN
// TỤC 3 lần poll cách 400ms (1.2s) — chỉ đạt khi đã remount sau load.
let stableCount = 0;
for (let i = 0; i < 60 && stableCount < 3; i++) {
	const present = (await page.locator('[data-test="settings-tabs"]').count()) > 0;
	stableCount = present ? stableCount + 1 : 0;
	if (stableCount < 3) await sleep(400);
}

// ── M1: Desktop 1280 — Tabs hiện, Accordion ẩn ──
{
	const state = await page.evaluate(() => {
		const tabs = document.querySelector('[data-test="settings-tabs"]');
		const acc = document.querySelector('[data-test="settings-accordion"]');
		return {
			tabsDisplay: tabs ? getComputedStyle(tabs).display : 'missing',
			accDisplay: acc ? getComputedStyle(acc).display : 'missing'
		};
	});
	ok(
		'M1 · Desktop: Tabs hiện + Accordion ẩn',
		state.tabsDisplay !== 'none' && state.tabsDisplay !== 'missing' && state.accDisplay === 'none',
		`tabs=${state.tabsDisplay} acc=${state.accDisplay}`
	);
}

// ── Regression desktop nhanh: title + save + tab security draft ──
{
	const hasTitle = await page.locator('[data-test="settings-title"]').count();
	const hasSave = await page.locator('[data-test="settings-save"]').count();
	ok('R1 · Desktop: title + nút Save header render', hasTitle === 1 && hasSave === 1);
	await page.locator('[data-test="tab-trigger-security"]').click();
	await sleep(400);
	const secInputs = await page.evaluate(() => {
		const content = document.querySelector('[data-test="tab-content-security"]');
		const inputs = content ? content.querySelectorAll('input') : [];
		return [...inputs].map((i) => ({ value: i.value, disabled: i.disabled }));
	});
	ok(
		'R2 · Tab Security: 3 input có giá trị (snippet render)',
		secInputs.length === 3 && secInputs.every((i) => i.value !== ''),
		JSON.stringify(secInputs).slice(0, 120)
	);
}

// ── M2: Mobile 375 — Accordion hiện 5 item, Tabs ẩn ──
await page.setViewportSize({ width: 375, height: 700 });
await sleep(400);
{
	const state = await page.evaluate(() => {
		const tabs = document.querySelector('[data-test="settings-tabs"]');
		const acc = document.querySelector('[data-test="settings-accordion"]');
		const items = document.querySelectorAll('[data-test="settings-accordion"] [data-test^="acc-trigger-"]');
		return {
			tabsDisplay: tabs ? getComputedStyle(tabs).display : 'missing',
			accDisplay: acc ? getComputedStyle(acc).display : 'missing',
		 itemCount: items.length
		};
	});
	ok(
		'M2 · Mobile: Accordion hiện 5 item + Tabs ẩn',
		state.accDisplay !== 'none' && state.accDisplay !== 'missing' && state.tabsDisplay === 'none' && state.itemCount === 5,
		`tabs=${state.tabsDisplay} acc=${state.accDisplay} items=${state.itemCount}`
	);
}

// ── M3: mở accordion general → input app-name VISIBLE ──
// Bẫy: data-test KHÔNG render từ form components (BasicProps không spread)
// → hook input app-name qua vị trí: input đầu trong acc-content-general.
const appNameInput = page.locator('[data-test="acc-content-general"] input').first();
{
	await page.locator('[data-test="acc-trigger-general"]').click();
	await sleep(500);
	const visible = await appNameInput.isVisible();
	const originalName = await appNameInput.inputValue();
	ok('M3 · Accordion general mở → input app-name visible', visible, `value="${originalName}"`);
}

// ── M4: sửa appName → action bar hiện + fixed bottom + 2 nút + KHÔNG đè ──
{
	const original = await appNameInput.inputValue();
	await appNameInput.fill(original + '_x');
	await sleep(400);
	const bar = page.locator('[data-test="settings-action-bar"]');
	const barVisible = await bar.isVisible();
	const barBox = await bar.boundingBox();
	// boundingBox trả {x,y,width,height} — KHÔNG có .bottom → tính y + height
	const vh = 700;
	const barBottom = barBox ? barBox.y + barBox.height : null;
	const cancelBtn = page.locator('[data-test="settings-cancel"]');
	const saveBtn = page.locator('[data-test="settings-save-bar"]');
	const nearBottom = barBottom !== null ? vh - barBottom < 60 : false;
	// Bẫy fixed đè content: scroll xuống ĐÁY — scroll container là
	// div.w-full.h-full (overflow:auto) của app shell, KHÔNG phải window
	// (window.scrollTo vô tác dụng — phát hiện qua ancestor-chain debug).
	// Item accordion cuối phải NẰM TRÊN bar (bottom item < top bar) nhờ
	// padding-bottom + min-height :has() tạo chỗ scroll.
	await page.evaluate(() => {
		let node = document.querySelector('.settings-page')?.parentElement;
		while (node) {
			const cs = getComputedStyle(node);
			if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
				node.scrollTop = node.scrollHeight;
				return;
			}
			node = node.parentElement;
		}
		window.scrollTo(0, document.body.scrollHeight);
	});
	await sleep(400);
	const geo = await page.evaluate(() => {
		const bar = document.querySelector('[data-test="settings-action-bar"]');
		const last = document.querySelectorAll('[data-test^="acc-trigger-"]')[4];
		if (!bar || !last) return { ok: false };
		return { ok: true, barTop: bar.getBoundingClientRect().top, lastBottom: last.getBoundingClientRect().bottom };
	});
	const noOverlap = geo.ok && geo.lastBottom <= geo.barTop + 1;
	ok(
		'M4 · Action bar hiện + fixed bottom + Save/Cancel',
		barVisible && nearBottom && (await cancelBtn.isVisible()) && (await saveBtn.isVisible()),
		`visible=${barVisible} barBottom=${barBottom !== null ? Math.round(barBottom) : 'null'} vh=${vh}`
	);
	ok(
		'M4b · Scroll đáy: action bar KHÔNG đè item accordion cuối',
		noOverlap,
		geo.ok ? `lastBottom=${Math.round(geo.lastBottom)} barTop=${Math.round(geo.barTop)}` : 'missing'
	);
	// M4c: mobile header-actions ẨN (bar đủ Save+Cancel — không trùng 2 nút Lưu)
	const mobileHeader = await page.evaluate(() => {
		const el = document.querySelector('.settings-header-actions');
		return el ? getComputedStyle(el).display : 'missing';
	});
	ok('M4c · Mobile: header Save ẨN (action bar đã đủ)', mobileHeader === 'none', `display=${mobileHeader}`);
	// Scroll về đầu cho M5 — cùng scroll container tùy
	await page.evaluate(() => {
		let node = document.querySelector('.settings-page')?.parentElement;
		while (node) {
			const cs = getComputedStyle(node);
			if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
				node.scrollTop = 0;
				return;
			}
			node = node.parentElement;
		}
		window.scrollTo(0, 0);
	});
	await sleep(200);
}

// ── M5: Cancel → revert + action bar ẩn ──
{
	const before = await appNameInput.inputValue();
	await page.locator('[data-test="settings-cancel"]').click();
	await sleep(500);
	const after = await appNameInput.inputValue();
	const barGone = !(await page.locator('[data-test="settings-action-bar"]').isVisible());
	ok(
		'M5 · Cancel revert value + action bar ẩn',
		after === before.replace('_x', '') && barGone,
		`before="${before}" after="${after}" barGone=${barGone}`
	);
}

// ── M6: quay lại Desktop 1280 → action bar ẩn (khi modified) ──
await page.setViewportSize({ width: 1280, height: 900 });
await sleep(400);
{
	// Ở desktop input nằm trong Tabs.Content general — hook input đầu của
	// tab-content-general (data-test Tabs.Content render được — là div riêng).
	const desktopInput = page.locator('[data-test="tab-content-general"] input').first();
	const original = await desktopInput.inputValue();
	await desktopInput.fill(original + '_y');
	await sleep(400);
	const barVisible = await page.locator('[data-test="settings-action-bar"]').isVisible();
	const headerSaveVisible = await page.locator('[data-test="settings-save"]').isVisible();
	ok(
		'M6 · Desktop: action bar ẨN + Save header HIỆN (modified)',
		!barVisible && headerSaveVisible,
		`bar=${barVisible} headerSave=${headerSaveVisible}`
	);
	// M6b: mobile → header Save ẨN (bar đã đủ — tránh 2 nút Lưu trùng).
	// Desktop ≥768 → header Save HIỆN.
	const headerActions = await page.evaluate(() => {
		const el = document.querySelector('.settings-header-actions');
		return el ? getComputedStyle(el).display : 'missing';
	});
	ok(
		'M6b · Desktop: header Save HIỆN (≥768px) — mobile ẩn check ở M4',
		headerActions !== 'none' && headerActions !== 'missing',
		`display=${headerActions}`
	);
	// Dọn: desktop không có nút Cancel (action bar ẩn) → reload reset state
	// local (KHÔNG save — server không bị ghi nháp).
}

// ── Console/page error ──
ok('E1 · 0 pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));
const hardConsoleErrors = consoleErrors.filter(
	(m) => !m.includes('favicon') && !m.includes('sourcemap') && !m.includes('DevTools')
);
ok('E2 · 0 console error', hardConsoleErrors.length === 0, hardConsoleErrors.join(' | ').slice(0, 200));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n══ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ══`);
if (failed.length) {
	console.log('FAIL list:');
	failed.forEach((f) => console.log(`  - ${f.name} — ${f.extra}`));
	process.exitCode = 1;
}
