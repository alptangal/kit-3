// pagination-wave10-probe.mjs
// Functional probe cho task "Wave 10 — Pagination compact: input chỉ chấp nhận number".
// Fix: onDraftInput set DOM TRỰC TIẾP khi có ký tự bị lọc — Svelte 5 `value={draft}`
// không re-apply khi draft KHÔNG đổi (draft '7' + gõ 'a' → draft vẫn '7' → chữ 'a'
// KẸT hiển thị trong DOM dù draft đã lọc). Sau fix: chữ không bao giờ kẹt.
// W10-0: type="text" + inputmode="numeric" (không spinner number).
// W10-1: gõ "abc" (select-all) → KHÔNG có gì vào draft (chữ bị lọc hết).
// W10-2: gõ "12a3" xen chữ → draft "123" (chữ bị strip).
// W10-3: Enter "123" (> totalPages 42) → snap cuối "42" (clamp giữ nguyên); Escape giữ nguyên.
// W10-4: paste "abc99" → bị lọc "99".
// W10-5: blur draft rỗng → pageAtEditStart (KHÔNG snap 1).
// W10-6: commit "7" trong range → đúng page.
// W10-7: REGRESSION bug kẹt DOM — caret CUỐI draft "7" + gõ "abc" → value "7" (digit giữ, chữ lọc).
// Chạy: node tests/pagination-wave10-probe.mjs (dev server ở https://localhost:3000)
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

// Trạng thái input: value DOM + page hiển thị (counter-current) + attrs
const inputState = () =>
	page.evaluate(() => {
		const scope = document.querySelector('[data-test="pg-compact"] .pagination-root');
		const input = scope?.querySelector('.pagination-page-input');
		const current = scope?.querySelector('[data-test="counter-current"]');
		return {
			inputVisible: !!input,
			inputValue: input?.value ?? null,
			hasLetters: !!input && /[a-zA-Z]/.test(input.value),
			currentText: current?.textContent?.trim() ?? null,
			inputMode: input?.getAttribute('inputmode') ?? null,
			type: input?.getAttribute('type') ?? null
		};
	});

// Vào edit mode (draft = page hiện tại, select-all)
const openEdit = async () => {
	await counter.click();
	await page.waitForTimeout(200);
};

console.log('\n=== W10-0: BASELINE — type="text" + inputmode="numeric" (KHÔNG spinner) ===');
await openEdit();
const attr = await inputState();
ok(
	'W10-0: input type="text" + inputmode="numeric" + draft "1"',
	attr.inputVisible && attr.type === 'text' && attr.inputMode === 'numeric' && attr.inputValue === '1',
	JSON.stringify({ type: attr.type, inputMode: attr.inputMode, value: attr.inputValue })
);

console.log('\n=== W10-1: GÕ "abc" (select-all active) → KHÔNG CÓ GÌ VÀO DRAFT ===');
// startEdit select-all → gõ "abc" thay thế selection ("1" → "abc") → lọc → "" (rỗng).
// Đúng yêu cầu: gõ chữ → không có gì vào draft (chữ bị lọc hết).
await page.keyboard.type('abc');
await page.waitForTimeout(150);
const afterAbc = await inputState();
ok(
	'W10-1: gõ "abc" → draft rỗng (không có gì vào draft, không chữ)',
	afterAbc.inputValue === '' && !afterAbc.hasLetters,
	JSON.stringify(afterAbc)
);

console.log('\n=== W10-2: GÕ "12a3" XEN CHỮ → DRAFT "123" (chữ bị strip từng phím) ===');
await page.keyboard.press('ControlOrMeta+KeyA');
await page.keyboard.type('12a3');
await page.waitForTimeout(150);
const afterMixed = await inputState();
ok(
	'W10-2: gõ "12a3" → draft "123" (chữ strip, digit giữ)',
	afterMixed.inputValue === '123' && !afterMixed.hasLetters,
	JSON.stringify(afterMixed)
);

console.log('\n=== W10-3: ENTER "123" (NGOÀI RANGE 42) → SNAP CUỐI "42"; ESCAPE GIỮ NGUYÊN ===');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const committed = await inputState();
ok(
	'W10-3a: Enter "123" → clamp ngoài range → snap cuối "42" (logic giữ nguyên)',
	!committed.inputVisible && committed.currentText === '42',
	JSON.stringify(committed)
);
// Escape giữ nguyên: vào edit, gõ chữ rác, Escape → page giữ 42
await openEdit();
await page.keyboard.type('xyz');
await page.waitForTimeout(100);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const afterEsc = await inputState();
ok(
	'W10-3b: Escape sau gõ "xyz" → revert giữ page "42" (không input, không chữ lọt)',
	!afterEsc.inputVisible && afterEsc.currentText === '42',
	JSON.stringify(afterEsc)
);

console.log('\n=== W10-4: PASTE "abc99" (dispatch input) → BỊ LỌC "99" ===');
await openEdit();
await page.evaluate(() => {
	const input = document.querySelector('[data-test="pg-compact"] .pagination-page-input');
	if (input) {
		input.value = 'abc99';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}
});
await page.waitForTimeout(150);
const afterPaste = await inputState();
ok(
	'W10-4: paste "abc99" → bị lọc "99"',
	afterPaste.inputValue === '99' && !afterPaste.hasLetters,
	JSON.stringify(afterPaste)
);

console.log('\n=== W10-5: BLUR VỚI DRAFT RỖNG → pageAtEditStart (KHÔNG snap 1) ===');
await page.keyboard.press('ControlOrMeta+KeyA');
await page.keyboard.press('Delete');
await page.waitForTimeout(100);
const draftEmpty = await inputState();
ok('W10-5a: xoá hết → draft rỗng', draftEmpty.inputVisible && draftEmpty.inputValue === '', JSON.stringify(draftEmpty));
await page.mouse.click(50, 50);
await page.waitForTimeout(200);
const afterEmptyBlur = await inputState();
ok(
	'W10-5b: blur draft rỗng → page giữ "42" (pageAtEditStart, KHÔNG snap 1)',
	!afterEmptyBlur.inputVisible && afterEmptyBlur.currentText === '42',
	JSON.stringify(afterEmptyBlur)
);

console.log('\n=== W10-6: COMMIT SỐ TRONG RANGE → ĐÚNG PAGE ===');
await openEdit();
await page.keyboard.type('7');
await page.waitForTimeout(100);
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
const committed7 = await inputState();
ok(
	'W10-6: gõ "7" + Enter → commit page "7"',
	!committed7.inputVisible && committed7.currentText === '7',
	JSON.stringify(committed7)
);

console.log('\n=== W10-7: REGRESSION BUG KẸT DOM — CARET CUỐI + GÕ "abc" → DIGIT GIỮ, CHỮ LỌC ===');
// Bug cũ: draft '7' + gõ 'a' → draft lọc về '7' (GIỐNG giá trị cũ) → Svelte 5 value={draft}
// KHÔNG re-apply → chữ 'a' kẹt trong DOM ("7a"). Sau fix: set DOM trực tiếp → "7".
await openEdit();
// Bỏ select-all → caret CUỐI draft "7" (End/ArrowRight)
await page.keyboard.press('End');
await page.keyboard.type('abc');
await page.waitForTimeout(150);
const afterCaretEnd = await inputState();
ok(
	'W10-7: caret cuối draft "7" + gõ "abc" → value "7" (chữ strip NGAY, không kẹt DOM)',
	afterCaretEnd.inputValue === '7' && !afterCaretEnd.hasLetters,
	JSON.stringify(afterCaretEnd)
);

console.log('\n=== W10-8: CARET CUỐI + GÕ "a4b2c" → "742" (chữ strip xen kẽ digit) ===');
await page.keyboard.type('a4b2c');
await page.waitForTimeout(150);
const afterCaretMixed = await inputState();
ok(
	'W10-8: caret cuối "7" + gõ "a4b2c" → value "742" (2 digit 4,2 giữ, 3 chữ strip)',
	afterCaretMixed.inputValue === '742' && !afterCaretMixed.hasLetters,
	JSON.stringify(afterCaretMixed)
);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshots/pagination';
mkdirSync(shotDir, { recursive: true });
// W10: đang edit — draft "74" (sau khi gõ chữ bị lọc), sep "/42" bên cạnh
await page.waitForTimeout(200);
await page.locator('[data-test="pg-compact"]').screenshot({
	path: `${shotDir}/10-wave10-numeric-only.png`
});
// Thoát edit (Escape revert) để không ảnh hưởng state khác
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
