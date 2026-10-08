// pagination-wave9-probe.mjs
// Functional probe cho task "Pagination wave 9 — edit mode: CHỈ currentPage thành
// input, phần '/N' (separator + total) VẪN HIỆN bên cạnh (không ẩn khi edit)".
// W9-1: trước sửa — edit → input hiện + sep/total vẫn hiện (data-test="counter-total").
// W9-2: edit → input focus + select-all (giữ nguyên rAF focus).
// W9-3: commit (Enter) → cả 3 span quay lại (counter-current + sep + total).
// W9-4: Escape revert → input biến mất, cả 3 span quay lại.
// W9-5: total nhiều chữ số (42) — input width 5ch đủ chứa, không vỡ layout.
// Chạy: node tests/pagination-wave9-probe.mjs (dev server ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/pagination';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="pagination-demo"]', { timeout: 20000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

// Section demo variant compact (data-test="pg-compact")
const compactNav = page.locator('[data-test="pg-compact"] .pagination-root').first();
const counter = compactNav.locator('[data-test="counter"]');

// Đọc trạng thái counter: input + sep + total (querySelector qua data-test)
const counterState = () =>
	page.evaluate(() => {
		const scope = document.querySelector('[data-test="pg-compact"] .pagination-root');
		const input = scope?.querySelector('.pagination-page-input');
		const sep = scope?.querySelector('[data-test="counter"] .counter-sep');
		const total = scope?.querySelector('[data-test="counter-total"]');
		const current = scope?.querySelector('[data-test="counter-current"]');
		return {
			inputVisible: !!input,
			inputFocused: !!input && document.activeElement === input,
			inputSelected:
				!!input && input.selectionStart === 0 && input.selectionEnd === input.value.length,
			inputValue: input?.value ?? null,
			sepVisible: !!sep,
			sepText: sep?.textContent?.trim() ?? null,
			totalVisible: !!total,
			totalText: total?.textContent?.trim() ?? null,
			currentText: current?.textContent?.trim() ?? null
		};
	});

console.log('\n=== W9-0: BASELINE — CHƯA EDIT → CẢ 3 SPAN HIỆN, KHÔNG INPUT ===');
const base = await counterState();
ok(
	'W9-0: chưa edit → counter-current + sep + total hiện (không input)',
	!base.inputVisible && base.currentText === '1' && base.sepVisible && base.sepText === '/' && base.totalVisible && base.totalText === '42',
	JSON.stringify(base)
);

console.log('\n=== W9-1: EDIT MODE — INPUT HIỆN + SEP "/N" VẪN HIỆN (KHÔNG ẨN) ===');
await counter.click();
await page.waitForTimeout(200);
const edit = await counterState();
ok(
	'W9-1: edit → input hiện + sep "/" + total "42" VẪN HIỆN bên cạnh',
	edit.inputVisible && edit.sepVisible && edit.sepText === '/' && edit.totalVisible && edit.totalText === '42',
	JSON.stringify(edit)
);
ok(
	'W9-1b: edit → counter-current KHÔNG render (chỉ currentPage thành input)',
	!edit.currentText,
	`current="${edit.currentText}"`
);

console.log('\n=== W9-2: EDIT → FOCUS + SELECT-ALL (rAF focus giữ nguyên) ===');
ok(
	'W9-2: edit → input focus + select-all (draft = "1")',
	edit.inputFocused && edit.inputSelected && edit.inputValue === '1',
	`focused=${edit.inputFocused} selected=${edit.inputSelected} value=${edit.inputValue}`
);

console.log('\n=== W9-3: COMMIT (ENTER) → CẢ 3 SPAN QUAY LẠI ===');
await page.keyboard.type('15');
await page.waitForTimeout(100);
const editDraft = await counterState();
ok(
	'W9-3a: draft "15" — sep + total vẫn hiện khi đang nhập',
	editDraft.inputValue === '15' && editDraft.sepVisible && editDraft.totalVisible,
	JSON.stringify(editDraft)
);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const committed = await counterState();
ok(
	'W9-3b: Enter commit → counter-current "15" + sep + total quay lại (không input)',
	!committed.inputVisible && committed.currentText === '15' && committed.sepVisible && committed.sepText === '/' && committed.totalVisible && committed.totalText === '42',
	JSON.stringify(committed)
);

console.log('\n=== W9-4: ESCAPE REVERT → INPUT BIẾN MẤT, CẢ 3 SPAN QUAY LẠI ===');
await counter.click();
await page.waitForTimeout(150);
await page.keyboard.type('99');
await page.waitForTimeout(100);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const reverted = await counterState();
ok(
	'W9-4: Escape → revert về page trước edit ("15") + cả 3 span quay lại',
	!reverted.inputVisible && reverted.currentText === '15' && reverted.sepVisible && reverted.totalVisible && reverted.totalText === '42',
	JSON.stringify(reverted)
);

console.log('\n=== W9-5: TOTAL NHIỀU CHỮ SỐ (42) — LAYOUT KHÔNG VỠ KHI EDIT ===');
// page đang là 15. Vào edit → đo width counter khi chưa edit vs đang edit:
// input 5ch + sep + total → counter có thể rộng hơn chút nhưng KHÔNG vỡ (vẫn inline-flex, không wrap).
const beforeWidth = await page.evaluate(() => {
	const c = document.querySelector('[data-test="pg-compact"] .pagination-counter');
	return c ? Math.round(c.getBoundingClientRect().width) : null;
});
await counter.click();
await page.waitForTimeout(200);
const widthState = await page.evaluate(() => {
	const c = document.querySelector('[data-test="pg-compact"] .pagination-counter');
	const input = c?.querySelector('.pagination-page-input');
	return {
		width: c ? Math.round(c.getBoundingClientRect().width) : null,
		height: c ? Math.round(c.getBoundingClientRect().height) : null,
		inputWidth: input ? Math.round(input.getBoundingClientRect().width) : null,
		flexWrap: c ? getComputedStyle(c).flexWrap : null,
		totalVisible: !!c?.querySelector('[data-test="counter-total"]')
	};
});
ok(
	'W9-5: edit → counter không vỡ (flex nowrap, height ổn định, total vẫn hiện)',
	widthState.flexWrap === 'nowrap' && widthState.totalVisible && widthState.height && widthState.height >= 28,
	JSON.stringify({ ...widthState, beforeWidth })
);
ok(
	'W9-5b: input width 5ch (≈ 40-80px, không co cụm về 0)',
	widthState.inputWidth >= 30 && widthState.inputWidth <= 90,
	`inputWidth=${widthState.inputWidth}`
);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshots/pagination';
mkdirSync(shotDir, { recursive: true });
// W9: đang edit — counter hiện input (focus + select-all) + "/42" bên cạnh
await page.waitForTimeout(200);
await page.locator('[data-test="pg-compact"]').screenshot({
	path: `${shotDir}/09-wave9-edit-total.png`
});
// Thoát edit (Escape revert) để không ảnh hưởng các probe khác
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
