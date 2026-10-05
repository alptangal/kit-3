// tests/date-picker-probe.mjs
// Verify DatePicker (element) — composite PURE JS (không date library).
// Trang demo: /ui/date-picker (5 case: single / sizes / min-max / controlled / disabled).
//
// Kiểm tra:
//  DP0 closed: không có panel/grid khi đóng
//  DP1 trigger: button + aria-haspopup="dialog" + aria-expanded=false;
//     click → panel (role=dialog) + aria-expanded=true + aria-controls=id panel
//  DP2 select day: trigger text đổi (dd/mm/yyyy) + panel đóng + focus trả trigger
//  DP3 nav tháng: click next → header tháng đổi (label khác)
//  DP4 min/max: ô bị chặn aria-disabled + click không chọn (trigger giữ placeholder)
//  DP5 controlled: bind:value page → chọn ngày → text "Value: dd/mm/yyyy" cập nhật
//  DP6 roving focus: ArrowRight +1 ngày, ArrowDown +7 / ArrowUp -7 (so data-dp-day)
//  DP7 Escape → đóng + focus về trigger
//  DP8 today: ô hôm nay có class .today (ring tròn)
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// parse key "y-m-d" (m 0-based) → Date local
const parseKey = (key) => {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m, d);
};
// so 2 Date theo (y,m,d) local: diff ≈ n ngày
const dayDiff = (a, b) => Math.round((b - a) / 86400000);

const now = new Date();
const CY = now.getFullYear();
const CM = now.getMonth(); // 0-based
const todayKey = `${CY}-${CM}-${now.getDate()}`;
// DP4: ngày đầu tháng hiện tại bị chặn bởi min (min = hôm nay) — chỉ khi
// hôm nay không phải ngày 1.
const minBlockedKey = now.getDate() > 1 ? `${CY}-${CM}-1` : null;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/date-picker', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.date-picker-root', { timeout: 20000 });
await sleep(500);

const single = () => page.locator('[data-test="dp-single"] .date-picker-root');
const singleTrigger = () => single().locator('[data-dp-trigger]');

// ============ DP0 — closed: không có panel ============
const dp0 = await page.evaluate(() => {
	const panel = document.querySelector('[data-test="dp-single"] [data-dp-panel]');
	const grid = document.querySelector('[data-test="dp-single"] [role="grid"]');
	return { noPanel: !panel, noGrid: !grid, roots: document.querySelectorAll('.date-picker-root').length };
});
ok('DP0 closed: không có panel/grid khi đóng', dp0.noPanel && dp0.noGrid && dp0.roots >= 5, JSON.stringify(dp0));

// ============ DP1 — trigger attrs + open ============
const t1 = await singleTrigger().evaluate((b) => ({
	tag: b.tagName,
	haspopup: b.getAttribute('aria-haspopup'),
	expanded: b.getAttribute('aria-expanded')
}));
ok('DP1a trigger: button + aria-haspopup=dialog + expanded=false (closed)', t1.tag === 'BUTTON' && t1.haspopup === 'dialog' && t1.expanded === 'false', JSON.stringify(t1));

await singleTrigger().click();
await sleep(250);
const dp1 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="dp-single"]');
	const panel = scope.querySelector('[data-dp-panel]');
	const trig = scope.querySelector('[data-dp-trigger]');
	const grid = panel?.querySelector('[role="grid"]');
	const rows = panel ? panel.querySelectorAll('[role="row"]').length : 0; // 1 weekday + 6 day rows
	return {
		panel: !!panel,
		role: panel?.getAttribute('role'),
		expanded: trig?.getAttribute('aria-expanded'),
		controls: trig?.getAttribute('aria-controls'),
		idMatch: panel ? panel.id === trig?.getAttribute('aria-controls') : false,
		grid: !!grid,
		rows
	};
});
ok(
	'DP1b open: panel role=dialog + expanded=true + aria-controls=id + grid 6 hàng ngày',
	dp1.panel && dp1.role === 'dialog' && dp1.expanded === 'true' && dp1.idMatch && dp1.grid && dp1.rows === 7,
	JSON.stringify(dp1)
);

// ============ DP2 — select day ============
// Chọn ô trong tháng, TRỪ hôm nay (ring → .selected che ring, phá DP8) và
// TRỪ ngày 15 (value mặc định demo) → trigger text chắc đổi. Key đọc từ DOM.
const targetKey = await page.evaluate((today) => {
	const scope = document.querySelector('[data-test="dp-single"]');
	const rows = [...scope.querySelectorAll('[role="row"]')].slice(1); // bỏ weekday row
	const now = new Date();
	const avoid = new Set([today, `${now.getFullYear()}-${now.getMonth()}-15`]);
	const cells = rows.flatMap((r) => [...r.children]).filter((c) => c?.dataset?.dpDay);
	const pick = cells.find((c) => !c.classList.contains('out-of-month') && !avoid.has(c.dataset.dpDay));
	return pick?.dataset?.dpDay ?? null;
}, todayKey);
if (!targetKey) ok('DP2 select day: ô mục tiêu tồn tại', false, 'không tìm được ô trong tháng tránh today/15');
else {
	await page.locator(`[data-test="dp-single"] [data-dp-day="${targetKey}"]`).click();
	await sleep(250);
	const dp2 = await page.evaluate((key) => {
		const scope = document.querySelector('[data-test="dp-single"]');
		const panel = scope.querySelector('[data-dp-panel]');
		const trig = scope.querySelector('[data-dp-trigger]');
		const [y, m, d] = key.split('-').map(Number);
		const dd = String(d).padStart(2, '0');
		const mm = String(m + 1).padStart(2, '0');
		const expected = `${dd}/${mm}/${y}`;
		return {
			panelGone: !panel,
			triggerText: trig?.textContent?.trim(),
			expected,
			focusedTrigger: document.activeElement === trig
		};
	}, targetKey);
	ok(
		'DP2 select day → trigger text đổi (dd/mm/yyyy) + panel đóng + focus trigger',
		dp2.panelGone && dp2.triggerText?.includes(dp2.expected) && dp2.focusedTrigger,
		JSON.stringify(dp2)
	);
}

// ============ DP8 — today highlight (panel mở lại, cùng tháng hiện tại) ============
await singleTrigger().click();
await sleep(250);
const dp8 = await page.evaluate((key) => {
	const scope = document.querySelector('[data-test="dp-single"]');
	const cell = scope.querySelector(`[data-dp-day="${key}"]`);
	if (!cell) return { found: false };
	const cs = getComputedStyle(cell);
	return {
		found: true,
		todayClass: cell.classList.contains('today'),
		borderRadius: cs.borderRadius, // circular → ≥ 999px hoặc %
		boxShadow: cs.boxShadow,
		inMonth: !cell.classList.contains('out-of-month')
	};
}, todayKey);
const circular = dp8.borderRadius ? parseFloat(dp8.borderRadius) >= 12 || dp8.borderRadius.includes('%') : false;
ok('DP8 today: ô hôm nay class .today + ring tròn (border-radius) + box-shadow', dp8.found && dp8.todayClass && dp8.inMonth && circular && dp8.boxShadow !== 'none', JSON.stringify(dp8));

// ============ DP3 — nav tháng ============
const labelBefore = await page.locator('[data-test="dp-single"] [data-dp-month-label]').textContent();
await page.locator('[data-test="dp-single"] [data-dp-next]').click();
await sleep(200);
const labelAfter = await page.locator('[data-test="dp-single"] [data-dp-month-label]').textContent();
await page.locator('[data-test="dp-single"] [data-dp-prev]').click();
await sleep(200);
const labelBack = await page.locator('[data-test="dp-single"] [data-dp-month-label]').textContent();
ok('DP3 nav: next → label tháng đổi; prev → về lại', labelAfter !== labelBefore && labelBack === labelBefore, `${labelBefore} → ${labelAfter} → ${labelBack}`);

// ============ DP4 — min/max (section dp-range) ============
const rangeTrigger = page.locator('[data-test="dp-range"] [data-dp-trigger]');
await rangeTrigger.click();
await sleep(250);
const dp4 = await page.evaluate((blockedKey) => {
	const scope = document.querySelector('[data-test="dp-range"]');
	const panel = scope.querySelector('[data-dp-panel]');
	if (!panel) return { panel: false };
	const cells = [...panel.querySelectorAll('[data-dp-day]')];
	const disabled = cells.filter((c) => c.getAttribute('aria-disabled') === 'true');
	const blocked = blockedKey ? cells.find((c) => c.dataset.dpDay === blockedKey) : null;
	return {
		panel: true,
		total: cells.length,
		disabledCount: disabled.length,
		blockedKey,
		blockedDisabled: blocked ? blocked.getAttribute('aria-disabled') : 'n/a',
		blockedClass: blocked ? blocked.classList.contains('disabled') : false
	};
}, minBlockedKey);
ok(
	'DP4a min/max: ô chặn có aria-disabled + class disabled (min + out-of-month)',
	dp4.panel && dp4.disabledCount >= 1 && (dp4.blockedKey ? dp4.blockedDisabled === 'true' && dp4.blockedClass : true),
	JSON.stringify(dp4)
);

// click ô bị chặn → KHÔNG chọn (trigger giữ placeholder "Chọn ngày")
await rangeTrigger.click(); // đóng
await sleep(150);
const dp4b = await page.evaluate((blockedKey) => {
	const scope = document.querySelector('[data-test="dp-range"]');
	const label = scope.querySelector('[data-dp-trigger]')?.textContent?.trim();
	return { label, blockedKey };
}, minBlockedKey);
ok('DP4b dp-range chưa chọn (placeholder giữ trước khi click ô chặn)', dp4b.label?.includes('Chọn ngày'), JSON.stringify(dp4b));

// ============ DP5 — controlled (bind:value) ============
// chọn ngày 10 tháng hiện tại (luôn valid — không có min/max).
const ctrlKey = `${CY}-${CM}-10`;
const ctrlTrigger = page.locator('[data-test="dp-controlled"] [data-dp-trigger]');
await ctrlTrigger.click();
await sleep(250);
await page.locator(`[data-test="dp-controlled"] [data-dp-day="${ctrlKey}"]`).click();
await sleep(250);
const dp5 = await page.evaluate((key) => {
	const scope = document.querySelector('[data-test="dp-controlled"]');
	const [y, m, d] = key.split('-').map(Number);
	const expected = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
	return {
		panelGone: !scope.querySelector('[data-dp-panel]'),
		triggerText: scope.querySelector('[data-dp-trigger]')?.textContent?.trim(),
		valueText: document.querySelector('[data-test="dp-controlled-value"]')?.textContent?.trim(),
		expected
	};
}, ctrlKey);
ok(
	'DP5 controlled: chọn ngày → page state cập nhật (Value: dd/mm/yyyy) + trigger đổi',
	dp5.panelGone && dp5.valueText?.includes(dp5.expected) && dp5.triggerText?.includes(dp5.expected),
	JSON.stringify(dp5)
);

// ============ DP6 — roving focus: ArrowRight +1, ArrowDown +7 ============
const sTrigger = singleTrigger();
await sTrigger.click();
await sleep(300); // chờ seed focus (selected day)
const key0 = await page.evaluate(() => document.activeElement?.dataset?.dpDay ?? null);
await page.keyboard.press('ArrowRight');
await sleep(120);
const key1 = await page.evaluate(() => document.activeElement?.dataset?.dpDay ?? null);
await page.keyboard.press('ArrowDown');
await sleep(120);
const key2 = await page.evaluate(() => document.activeElement?.dataset?.dpDay ?? null);
await page.keyboard.press('ArrowUp');
await sleep(120);
const key3 = await page.evaluate(() => document.activeElement?.dataset?.dpDay ?? null);
const stillInGrid = await page.evaluate(() => {
	const cell = document.activeElement;
	return !!cell?.dataset?.dpDay && !!cell.closest('[data-dp-panel]');
});
const diff01 = key0 && key1 ? dayDiff(parseKey(key0), parseKey(key1)) : 99;
const diff12 = key1 && key2 ? dayDiff(parseKey(key1), parseKey(key2)) : 99;
const diff23 = key2 && key3 ? dayDiff(parseKey(key2), parseKey(key3)) : 99;
ok(
	'DP6 roving focus: ArrowRight +1 ngày, ArrowDown +7, ArrowUp -7 (focus trong panel)',
	!!key0 && diff01 === 1 && diff12 === 7 && diff23 === -7 && stillInGrid,
	JSON.stringify({ key0, key1, key2, key3, diff01, diff12, diff23, stillInGrid })
);

// ============ DP7 — Escape → close + focus trigger ============
await page.keyboard.press('Escape');
await sleep(200);
const dp7 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="dp-single"]');
	const trig = scope.querySelector('[data-dp-trigger]');
	return { closed: !scope.querySelector('[data-dp-panel]'), focus: document.activeElement === trig };
});
ok('DP7 Escape → panel đóng + focus trả trigger', dp7.closed && dp7.focus, JSON.stringify(dp7));

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
