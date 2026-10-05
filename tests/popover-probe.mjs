// tests/popover-probe.mjs
// Verify Popover (element composite): /ui/popover.
//
// Kiểm tra:
//  P0 trigger render + content KHÔNG hiện khi closed
//  P1 click trigger → content role=dialog hiện + trigger aria-expanded=true
//  P2 outside-click → đóng + focus trả trigger
//  P3 Escape → đóng
//  P4 trigger click → focusable đầu trong content được focus
//  P5 hover: mouseenter → 300ms → hiện; mouseleave → 300ms → ẩn
//  P6 position start/end/center: computed left/right/transform khác nhau
//  P7 controlled: page set open=true (nút ngoài) → content hiện không cần click
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/popover', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.popover-root', { timeout: 20000 });
await sleep(400);

// ============ P0 — closed: trigger có, content không ============
const p0 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pv-click"]');
	const trig = scope.querySelector('[data-pv-trigger]');
	const panel = scope.querySelector('.popover-content');
	return {
		triggerCount: document.querySelectorAll('.popover-root').length,
		triggerTag: trig?.tagName,
		expanded: trig?.getAttribute('aria-expanded'),
		haspopup: trig?.getAttribute('aria-haspopup'),
		controls: !!trig?.getAttribute('aria-controls'),
		absent: !panel
	};
});
ok(
	'P0 closed: trigger span render + aria-haspopup=dialog + expanded=false + content ABSENT',
	p0.triggerCount >= 4 && p0.triggerTag === 'SPAN' && p0.haspopup === 'dialog' && p0.expanded === 'false' && p0.controls && p0.absent,
	JSON.stringify(p0)
);

// Helper scoped selector (section click)
const clickScope = '[data-test="pv-click"]';
const clickTrigger = () => page.locator(`${clickScope} [data-pv-trigger]`);

// ============ P1 — click open ============
await clickTrigger().click();
await sleep(200);
const p1 = await page.evaluate((scopeSel) => {
	const scope = document.querySelector(scopeSel);
	const panel = scope.querySelector('.popover-content');
	const trig = scope.querySelector('[data-pv-trigger]');
	const cs = panel ? getComputedStyle(panel) : null;
	return {
		role: panel?.getAttribute('role'),
		expanded: trig?.getAttribute('aria-expanded'),
		pos: cs?.position,
		top: cs?.top,
		z: cs?.zIndex,
		idMatch: panel ? panel.id === trig?.getAttribute('aria-controls') : false
	};
}, clickScope);
ok(
	'P1 click → content role=dialog hiện + absolute + expanded=true + aria-controls=id',
	p1.role === 'dialog' && p1.expanded === 'true' && p1.pos === 'absolute' && p1.idMatch,
	JSON.stringify(p1)
);

// ============ P4 — focus first focusable (đo khi vừa mở: input nickname) ============
const p4 = await page.evaluate(() => {
	const active = document.activeElement;
	const input = document.querySelector('#pv-input-nick');
	return {
		kind: active?.tagName,
		isFirstInput: active === input
	};
});
ok(
	'P4 open (click) → focusable đầu trong content (input nickname) được focus',
	p4.isFirstInput === true,
	JSON.stringify(p4)
);

// ============ P2 — outside-click → close + focus trigger ============
await page.mouse.click(20, 500); // điểm ngoài root popover
await sleep(200);
const p2 = await page.evaluate((scopeSel) => {
	const scope = document.querySelector(scopeSel);
	const panel = scope.querySelector('.popover-content');
	const btn = scope.querySelector('[data-pv-trigger] button');
	return {
		closed: !panel,
		focusTriggerBtn: document.activeElement === btn
	};
}, clickScope);
ok('P2 outside mousedown → đóng + focus trả button trigger', p2.closed && p2.focusTriggerBtn, JSON.stringify(p2));

// ============ P3 — Escape → close ============
await clickTrigger().click();
await sleep(200);
await page.keyboard.press('Escape');
await sleep(200);
const p3 = await page.evaluate((scopeSel) => {
	const scope = document.querySelector(scopeSel);
	return !scope.querySelector('.popover-content');
}, clickScope);
ok('P3 Escape → đóng', p3);

// ============ P5 — hover intent ============
const hoverScope = '[data-test="pv-hover"]';
const hoverTrigger = page.locator(`${hoverScope} [data-pv-trigger]`);

// hover → 300ms → hiện (delay show 200ms)
await hoverTrigger.hover();
await sleep(300);
const p5open = await page.evaluate((scopeSel) => {
	const scope = document.querySelector(scopeSel);
	const panel = scope.querySelector('.popover-content');
	return !!panel;
}, hoverScope);
ok('P5a hover trigger → 300ms → panel hiện (delay show)', p5open);

// keep-alive: đưa chuột VÀO panel → panel vẫn mở sau delay hide (150ms)
if (p5open) {
	const panelBox = await page.locator(`${hoverScope} .popover-content`).boundingBox();
	if (panelBox) {
		await page.mouse.move(panelBox.x + panelBox.width / 2, panelBox.y + panelBox.height / 2, {
			steps: 8
		});
		await sleep(300);
	}
}
const p5keep = await page.evaluate((scopeSel) => {
	const scope = document.querySelector(scopeSel);
	return !!scope.querySelector('.popover-content');
}, hoverScope);
ok('P5b chuột vào panel → panel giữ mở (intent keep-alive)', p5keep);

// mouseleave khỏi cả panel + trigger → 300ms → ẩn (delay hide 150ms).
// (10, 700): xa trigger + panel, path không cắt trigger (tránh hoverEnter lại).
await page.mouse.move(10, 700, { steps: 8 });
await sleep(300);
const p5close = await page.evaluate((scopeSel) => {
	const scope = document.querySelector(scopeSel);
	return !scope.querySelector('.popover-content');
}, hoverScope);
ok('P5c chuột ra ngoài panel + trigger → 300ms → panel ẩn (delay hide)', p5close);

// ============ P6 — position start/end/center ============
// LƯU Ý: getComputedStyle giải ra left/right/margin-inline (18.75px, -18.75px...)
// khi width được ràng buộc — KHÔNG trả 'auto'. Assert qua classList + geometry
// (bounding box) là ổn định.
async function posSnapshot(label) {
	// Root không có data-position; tìm trigger bằng text button con
	const trigger = page.locator(`[data-test="pv-position"] [data-pv-trigger]`, { hasText: label });
	await trigger.click();
	await sleep(200);
	const snap = await trigger.evaluate((trig) => {
		const root = trig.closest('.popover-root');
		const panel = root?.querySelector('.popover-content');
		if (!panel) return { err: 'no panel' };
		const cs = getComputedStyle(panel);
		const pb = panel.getBoundingClientRect();
		const rb = root.getBoundingClientRect();
		return {
			classes: panel.className,
			transform: cs.transform,
			// panel flush cạnh root?
			panelLeftInRoot: Math.round(pb.left - rb.left),
			panelRightInRoot: Math.round(rb.right - pb.right), // 0 nếu flush phải
			rootW: Math.round(rb.width),
			panelW: Math.round(pb.width)
		};
	});
	await trigger.click(); // close
	await sleep(150);
	return snap;
}
const p6a = await posSnapshot('Start');
const p6b = await posSnapshot('End');
const p6c = await posSnapshot('Center');

ok(
	'P6a position=start → class position-start + panel flush CẠNH TRÁI root',
	p6a.classes.includes('position-start') && p6a.panelLeftInRoot === 0,
	JSON.stringify(p6a)
);
ok(
	'P6b position=end → class position-end + panel flush CẠNH PHẢI root',
	p6b.classes.includes('position-end') && p6b.panelRightInRoot === 0,
	JSON.stringify(p6b)
);
// center: margin-inline auto (không transform) → panel ở giữa root (delta ~0)
const centerDelta = Math.abs((p6c.rootW - p6c.panelW) / 2 - p6c.panelLeftInRoot);
ok(
	'P6c position=center → class position-center + KHÔNG translate + panel giữa trigger',
	p6c.classes.includes('position-center') &&
		(p6c.transform === 'none' || p6c.transform === '') &&
		centerDelta < 6,
	`${JSON.stringify(p6c)} delta=${centerDelta}px`
);
// start ≠ end: vị trí panel khác nhau
ok('P6e start ≠ end (panelLeftInRoot khác nhau)', p6a.panelLeftInRoot !== p6b.panelLeftInRoot, `${p6a.panelLeftInRoot} vs ${p6b.panelLeftInRoot}`);

// ============ P7 — controlled ============
// Trạng thái ban đầu: closed (không có panel)
const p7initial = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pv-controlled"]');
	return !scope.querySelector('.popover-content');
});
ok('P7a controlled: closed ban đầu (không panel)', p7initial);

// Nút ngoài set open=true → panel hiện mà KHÔNG click trigger
await page.locator('[data-test="pv-controlled-toggle"]').click();
await sleep(200);
const p7open = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pv-controlled"]');
	const panel = scope.querySelector('.popover-content');
	const trig = scope.querySelector('[data-pv-trigger]');
	return {
		opened: !!panel,
		expanded: trig?.getAttribute('aria-expanded'),
		role: panel?.getAttribute('role')
	};
});
ok('P7b controlled: "Mở bằng state" → panel hiện + expanded=true (không click trigger)', p7open.opened && p7open.expanded === 'true' && p7open.role === 'dialog', JSON.stringify(p7open));

// Nút "Đóng" trong panel → đóng (state false)
await page.locator('[data-test="pv-controlled-close"]').click();
await sleep(200);
const p7close = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pv-controlled"]');
	return !scope.querySelector('.popover-content');
});
ok('P7c controlled: "Đóng" trong panel → panel ẩn', p7close);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
