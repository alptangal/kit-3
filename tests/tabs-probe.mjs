// tests/tabs-probe.mjs
// Verify Tabs (element composite — shadcn tabs) trên /ui/tabs.
//
// Kiểm tra:
//  T0 tablist: role=tablist + aria-orientation (horizontal / vertical)
//  T1 aria-selected: tab active = true, tab khác = false (+ aria-controls/labelledby)
//  T2 click tab C (automatic) → panel A hidden, panel C hiện, aria-selected flip
//  T3 roving focus: focus A → ArrowRight → SKIP B (disabled) → C; ArrowLeft về A
//  T4 Home/End → đầu/cuối (skip disabled)
//  T5 manual: focus KHÔNG tự chọn (aria-selected giữ), Enter mới chọn
//  T6 disabled: aria-disabled + focus skip (C ArrowLeft → A, không qua B)
//  T7 indicator (underline): click tab 3 → left/width đổi (khác tab 1)
//  T8 controlled: button ngoài (bind:value) → aria-selected theo + panel đổi
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL' }  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/tabs', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="tabs-demo"]', { timeout: 20000 });
// Iconify fetch svg ASYNC → chèn vào trigger "Tổng quan" làm shift layout (~14px).
// Chờ svg về (hoặc timeout) để layout stabil trước khi click (Playwright stability).
await page
	.waitForSelector('[data-test="tb-default"] .tabs-trigger__icon svg', { timeout: 15000 })
	.catch(() => {});
await sleep(500);

// ═══ T0 — tablist + aria-orientation ═══
const t0 = await page.evaluate(() => {
	const h = document.querySelector('[data-test="tb-default"] [role="tablist"]');
	const v = document.querySelector('[data-test="tb-vertical"] [role="tablist"]');
	return {
		listCount: document.querySelectorAll('[role="tablist"]').length,
		h: h?.getAttribute('aria-orientation'),
		v: v?.getAttribute('aria-orientation')
	};
});
ok('T0 role=tablist ×5 + aria-orientation (horizontal/vertical)', t0.listCount === 5 && t0.h === 'horizontal' && t0.v === 'vertical', JSON.stringify(t0));

// ═══ T1 — aria-selected + aria-controls/labelledby ═══
const t1 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="tb-default"]');
	const tabs = [...scope.querySelectorAll('[role="tab"]')];
	const a = tabs.find((t) => t.dataset.tabsValue === 'A');
	const panelA = document.getElementById(a.getAttribute('aria-controls'));
	return {
		count: tabs.length,
		aSelected: a.getAttribute('aria-selected'),
		bSelected: tabs.find((t) => t.dataset.tabsValue === 'B').getAttribute('aria-selected'),
		controls: a.getAttribute('aria-controls') === panelA?.id,
		labelledby: panelA?.getAttribute('aria-labelledby') === a.id,
		panelRole: panelA?.role
	};
});
ok('T1 aria-selected: A=true B/C=false + panel A role=tabpanel, id khớp aria-controls/labelledby', t1.count === 3 && t1.aSelected === 'true' && t1.bSelected === 'false' && t1.controls && t1.labelledby && t1.panelRole === 'tabpanel', JSON.stringify(t1));

// ═══ T2 — click tab C (automatic): panel A hidden, panel C hiện, flip ═══
await page.locator('[data-test="tb-default"] [role="tab"][data-tabs-value="C"]').click();
await sleep(450);
const t2 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="tb-default"]');
	const panel = (v) => {
		const id = scope.querySelector(`[role="tab"][data-tabs-value="${v}"]`).getAttribute('aria-controls');
		const p = document.getElementById(id);
		return p ? { hidden: p.hasAttribute('hidden'), visible: getComputedStyle(p).display !== 'none' } : null;
	};
	const sel = (v) => scope.querySelector(`[role="tab"][data-tabs-value="${v}"]`).getAttribute('aria-selected');
	return { A: panel('A'), C: panel('C'), aSel: sel('A'), cSel: sel('C') };
});
ok('T2 click C → panel A hidden, panel C hiện, aria-selected flip (A=false C=true)', t2.A?.hidden && t2.C?.visible && t2.aSel === 'false' && t2.cSel === 'true', JSON.stringify(t2));

// ═══ T3 — roving focus: A → ArrowRight → skip B (disabled) → C; ArrowLeft → A ═══
await page.evaluate(() => document.querySelector('[data-test="tb-default"] [role="tab"][data-tabs-value="A"]').focus());
await page.keyboard.press('ArrowRight');
await sleep(120);
const t3a = await page.evaluate(() => document.activeElement?.dataset?.tabsValue);
await page.keyboard.press('ArrowRight');
await sleep(120);
const t3b = await page.evaluate(() => document.activeElement?.dataset?.tabsValue);
await page.keyboard.press('ArrowLeft');
await sleep(120);
const t3c = await page.evaluate(() => document.activeElement?.dataset?.tabsValue);
ok('T3 focus A → ArrowRight skip B (disabled) → C; ArrowRight wrap → A; ArrowLeft wrap → C', t3a === 'C' && t3b === 'A' && t3c === 'C', JSON.stringify({ t3a, t3b, t3c }));

// ═══ T4 — Home/End ═══
await page.keyboard.press('Home');
await sleep(100);
const t4home = await page.evaluate(() => document.activeElement?.dataset?.tabsValue);
await page.keyboard.press('End');
await sleep(100);
const t4end = await page.evaluate(() => document.activeElement?.dataset?.tabsValue);
ok('T4 Home → A; End → C (skip disabled B)', t4home === 'A' && t4end === 'C', JSON.stringify({ t4home, t4end }));

// ═══ T5 — manual: focus KHÔNG tự chọn; Enter mới chọn ═══
await page.evaluate(() => document.querySelector('[data-test="tb-manual"] [role="tab"][data-tabs-value="m1"]').focus());
await page.keyboard.press('ArrowRight'); // focus m2 (manual → KHÔNG chọn)
await sleep(150);
const t5focus = await page.evaluate(() => ({
	focus: document.activeElement?.dataset?.tabsValue,
	sel: [...document.querySelectorAll('[data-test="tb-manual"] [role="tab"]')]
		.filter((t) => t.getAttribute('aria-selected') === 'true')
		.map((t) => t.dataset.tabsValue)
}));
await page.keyboard.press('Enter'); // chọn m2
await sleep(150);
const t5enter = await page.evaluate(() =>
	[...document.querySelectorAll('[data-test="tb-manual"] [role="tab"]')]
		.filter((t) => t.getAttribute('aria-selected') === 'true')
		.map((t) => t.dataset.tabsValue)
);
ok('T5 manual: focus m2 không đổi aria-selected (m1); Enter → chọn m2', t5focus.focus === 'm2' && JSON.stringify(t5focus.sel) === JSON.stringify(['m1']) && JSON.stringify(t5enter) === JSON.stringify(['m2']), JSON.stringify({ t5focus, t5enter }));

// ═══ T6 — disabled: aria-disabled + focus skip (C ArrowLeft → A) ═══
const t6 = await page.evaluate(() => {
	const b = document.querySelector('[data-test="tb-default"] [role="tab"][data-tabs-value="B"]');
	return {
		ariaDisabled: b.getAttribute('aria-disabled'),
		disabledAttr: b.hasAttribute('disabled'),
		tabindex: b.getAttribute('tabindex')
	};
});
await page.evaluate(() => document.querySelector('[data-test="tb-default"] [role="tab"][data-tabs-value="C"]').focus());
await page.keyboard.press('ArrowLeft');
await sleep(120);
const t6skip = await page.evaluate(() => document.activeElement?.dataset?.tabsValue);
ok('T6 disabled B: aria-disabled=true + tabindex=-1; focus C ArrowLeft skip B → A', t6.ariaDisabled === 'true' && t6.tabindex === '-1' && t6skip === 'A', JSON.stringify({ t6, t6skip }));

// ═══ T7 — indicator (underline): position đổi theo tab active ═══
const t7before = await page.evaluate(() => {
	const ind = document.querySelector('[data-test="tb-underline"] .tabs-indicator');
	if (!ind) return null;
	return { left: parseFloat(ind.style.left), width: parseFloat(ind.style.width) };
});
await page.locator('[data-test="tb-underline"] [role="tab"][data-tabs-value="u3"]').click();
await sleep(500); // transition 300ms
const t7after = await page.evaluate(() => {
	const ind = document.querySelector('[data-test="tb-underline"] .tabs-indicator');
	if (!ind) return null;
	const u3 = document.querySelector('[data-test="tb-underline"] [role="tab"][data-tabs-value="u3"]');
	return {
		left: parseFloat(ind.style.left),
		width: parseFloat(ind.style.width),
		u3OffsetLeft: u3.offsetLeft,
		u3OffsetWidth: u3.offsetWidth,
		bg: getComputedStyle(ind).backgroundColor,
		ariaHidden: ind.getAttribute('aria-hidden')
	};
});
ok(
	'T7 indicator: click u3 → left/width ≠ u1 (khớp offsetLeft/Width u3, aria-hidden)',
	t7before && t7after && t7after.left !== t7before.left && Math.abs(t7after.left - t7after.u3OffsetLeft) < 1 && Math.abs(t7after.width - t7after.u3OffsetWidth) < 1 && t7after.ariaHidden === 'true',
	JSON.stringify({ t7before, t7after })
);

// ═══ T8 — controlled: button ngoài đổi value → aria-selected theo ═══
const t8initial = await page.evaluate(() => document.querySelector('[data-test="tb-controlled"] [role="tab"][data-tabs-value="a"]').getAttribute('aria-selected'));
await page.locator('[data-test="tb-controlled-set-b"]').click();
await sleep(300);
const t8b = await page.evaluate(() => ({
	b: document.querySelector('[data-test="tb-controlled"] [role="tab"][data-tabs-value="b"]').getAttribute('aria-selected'),
	a: document.querySelector('[data-test="tb-controlled"] [role="tab"][data-tabs-value="a"]').getAttribute('aria-selected'),
	valueText: document.querySelector('[data-test="tb-controlled-value"]')?.textContent?.trim()
}));
await page.locator('[data-test="tb-controlled-set-c"]').click();
await sleep(300);
const t8c = await page.evaluate(() => ({
	c: document.querySelector('[data-test="tb-controlled"] [role="tab"][data-tabs-value="c"]').getAttribute('aria-selected'),
	panelBVisible: (() => {
		const id = document.querySelector('[data-test="tb-controlled"] [role="tab"][data-tabs-value="b"]').getAttribute('aria-controls');
		return getComputedStyle(document.getElementById(id)).display !== 'none';
	})()
}));
ok('T8 controlled: ban đầu a=true; "Đặt Beta" → b=true (a=false, value text=b); "Đặt Gamma" → c=true, panel B ẩn', t8initial === 'true' && t8b.b === 'true' && t8b.a === 'false' && t8b.valueText === 'value = b' && t8c.c === 'true' && !t8c.panelBVisible, JSON.stringify({ t8initial, t8b, t8c }));

// ═══ Screenshot (light, DSF2) ═══
// Reload → chụp trạng thái BAN ĐẦU (defaultValue) thay vì state sau khi test.
await page.goto('https://localhost:3000/ui/tabs', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="tabs-demo"]', { timeout: 20000 });
await page.waitForSelector('[data-test="tb-default"] .tabs-trigger__icon svg', { timeout: 15000 }).catch(() => {});
await sleep(500);
// Layout Container là 100dvh overflow-auto → fullPage chỉ chụp viewport. Mở
// container (height auto, overflow visible) để fullPage chụp TOÀN B content.
await page.evaluate(() => {
	document.querySelectorAll('div').forEach((d) => {
		const cs = getComputedStyle(d);
		if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 50) {
			d.style.height = 'auto';
			d.style.overflow = 'visible';
			d.style.maxHeight = 'none';
		}
	});
});
await page.screenshot({ path: 'tests/screenshot/tabs/01-tabs-cases.png', fullPage: true });
console.log('\nScreenshot → tests/screenshot/tabs/01-tabs-cases.png');

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
