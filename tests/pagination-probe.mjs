// pagination-probe.mjs
// Functional probe cho task "Pagination (light atom, shadcn usePagination)":
// PC0-PC6: probe cũ (nav/aria/entries/click/disabled/sibling/items)
// PC7-PC15: compact counter (jump-to input), loading, icons, active cursor
// Chạy: node tests/pagination-probe.mjs (dev server phải chạy ở https://localhost:3000)
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

// Đọc dải entries (page + ellipsis) theo từng nav (KHÔNG gồm prev/next)
const entriesOf = async (sel) =>
	page.evaluate((s) => {
		const out = [];
		for (const nav of document.querySelectorAll(`${s} .pagination-root`)) {
			const arr = [];
			for (const el of nav.querySelectorAll('.pagination-item')) {
				if (el.classList.contains('pagination-ellipsis')) arr.push('…');
				else if (el.classList.contains('pagination-page')) arr.push(el.textContent?.trim());
			}
			out.push(arr);
		}
		return out;
	}, sel);

// Nav trong section (index 0 = nav đầu tiên của section)
const navIn = (dataTest, i = 0) =>
	page.locator(`[data-test="${dataTest}"] .pagination-root`).nth(i);
// hasText MATCH EXACT (regex ^n$) — hasText chuỗi thường match substring
// (e.g. '1' match cả "1" VÀ "10" → strict mode throw).
const pageBtn = (navLocator, n) =>
	navLocator.locator('button.pagination-page', { hasText: new RegExp(`^${n}$`) });

console.log('\n=== PC0: NAV ARIA-LABEL + BUTTONS ===');
ok('PC0: demo root render', (await page.locator('[data-test="pagination-demo"]').count()) === 1);
const navCount = await page.locator('[data-test="pagination-demo"] nav.pagination-root').count();
ok(
	'PC0: 15 nav.pagination-root (basic×4 + sibling + small + size×3 + items + compact + loading + icons + active + icon-only)',
	navCount === 15,
	String(navCount)
);
const labeled = await page.locator('[data-test="pagination-demo"] nav.pagination-root[aria-label]').count();
ok('PC0: mọi nav có aria-label', labeled === 15, String(labeled));
const basicNav = navIn('pg-basic', 0);
ok('PC0: basic nav có prev + next button', (await basicNav.locator('.pagination-prev, .pagination-next').count()) === 2);

console.log('\n=== PC1: PAGE=5/10 VISIBLE [1, …, 4,5,6, …, 10] ===');
const p5 = navIn('pg-basic', 1);
const p5Entries = await entriesOf('[data-test="pg-basic"]');
// nav thứ 2 (page=5): expected = <, 1, …, 4, 5, 6, …, 10, >
ok(
	'PC1: page=5/10 → visible [1, …, 4, 5, 6, …, 10]',
	JSON.stringify(p5Entries[1]) === JSON.stringify(['1', '…', '4', '5', '6', '…', '10']),
	JSON.stringify(p5Entries[1] ?? p5Entries)
);
ok('PC1: aria-current="page" đúng ở 5', (await p5.locator('button[aria-current="page"]').textContent())?.trim() === '5');

console.log('\n=== PC2: CLICK PAGE 3 → aria-current + BIND ĐỔI ===');
// page=1 → visible [1, …, 2, …, 10]: click next (">") sang page 2 trước,
// sau đó mới thấy nút "3" trong [1, …, 3, …, 10] (tránh hasText substring).
await navIn('pg-basic', 0).locator('.pagination-next').click();
await page.waitForTimeout(120);
await pageBtn(navIn('pg-basic', 0), 3).click();
await page.waitForTimeout(150);
const current3 = await navIn('pg-basic', 0).locator('button[aria-current="page"]').textContent();
ok('PC2: click "3" → aria-current move sang 3', current3?.trim() === '3', current3);
const hint3 = await page.locator('[data-test="pg-basic-current"]').textContent();
ok('PC2: demo "Trang hiện tại" = 3 (bind value đổi)', hint3?.trim() === '3', hint3);

console.log('\n=== PC3: PREV DISABLED AT PAGE 1 ===');
// page=3 → visible [1, …, 2, 3, 4, …, 10]: click "1" (exact regex, tránh "10")
await pageBtn(navIn('pg-basic', 0), 1).click();
await page.waitForTimeout(150);
ok(
	'PC3: page=1 → nút prev disabled (nút "‹")',
	(await navIn('pg-basic', 0).locator('.pagination-prev').isDisabled())
);

console.log('\n=== PC4: NEXT DISABLED AT LAST PAGE ===');
const p10 = navIn('pg-basic', 3);
ok(
	'PC4: page=10 → nút next disabled (nút "›")',
	(await p10.locator('.pagination-next').isDisabled())
);

console.log('\n=== PC5: SIBLING=2 + BOUNDARY=2, PAGE 5/10 ===');
const sEntries = await entriesOf('[data-test="pg-sibling"]');
// shadcn: siblingStart = max(2, 5−2) = 3; siblingEnd = min(9, 5+2) = 7
// → firstBoundary 1,2 + middle 3–7 + lastBoundary 9,10 (2 ellipsis)
ok(
	'PC5: sibling=2/boundary=2 page=5 → [1, 2, …, 3, 4, 5, 6, 7, …, 9, 10]',
	JSON.stringify(sEntries[0]) === JSON.stringify(['1', '2', '…', '3', '4', '5', '6', '7', '…', '9', '10']),
	JSON.stringify(sEntries[0])
);

console.log('\n=== PC6: TOTAL ITEMS 95/10 → 10 PAGES, NEXT DISABLED AT 10 ===');
const iEntries = await entriesOf('[data-test="pg-items"]');
// page=3, total=10: siblingStart=max(2,3−1)=2, siblingEnd=min(9,3+1)=4
// → firstBoundary 1 + middle 2–4 + lastBoundary 10, xen 2 ellipsis
ok(
	'PC6: totalItems=95/pageSize=10 page=3 → [1, …, 2, 3, 4, …, 10] (10 pages)',
	JSON.stringify(iEntries[0]) === JSON.stringify(['1', '…', '2', '3', '4', '…', '10']),
	JSON.stringify(iEntries[0])
);
// Click đến page 10 → next disabled (exact regex tránh "1" match "10")
for (let p = 4; p <= 10; p++) {
	const btn = page.locator('[data-test="pg-items"] button.pagination-page', {
		hasText: new RegExp(`^${p}$`)
	});
	if ((await btn.count()) > 0) {
		await btn.first().click();
		await page.waitForTimeout(80);
	} else break;
}
ok(
	'PC6: ở trang cuối (10) → next disabled',
	(await page.locator('[data-test="pg-items"] .pagination-next').isDisabled())
);
const itemsCurrent = await page.locator('[data-test="pg-items"] .demo-hint code').first().textContent();
ok('PC6: bind page ở trang cuối = 10', itemsCurrent?.trim() === '10', itemsCurrent);

console.log('\n=== PC7: COMPACT → COUNTER HIỆN "1 / 42" ===');
const compactNav = navIn('pg-compact');
const counterText = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pg-compact"] .pagination-root');
	const cur = scope.querySelector('[data-test="counter-current"]')?.textContent?.trim();
	const tot = scope.querySelector('[data-test="counter-total"]')?.textContent?.trim();
	return { current: cur, total: tot };
});
ok('PC7: compact counter hiện "1 / 42"', counterText.current === '1' && counterText.total === '42', JSON.stringify(counterText));

console.log('\n=== PC8: COMPACT CLICK COUNTER → INPUT HIỆN + FOCUS + SELECT-ALL ===');
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(150);
const inputState = await page.evaluate(() => {
	const input = document.querySelector('[data-test="pg-compact"] .pagination-page-input');
	return {
		visible: !!input,
		focused: document.activeElement === input,
		value: input?.value,
		selected: input?.selectionStart === 0 && input?.selectionEnd === input?.value.length
	};
});
ok('PC8: click counter → input hiện + focus + select-all', inputState.visible && inputState.focused && inputState.value === '1' && inputState.selected, JSON.stringify(inputState));

console.log('\n=== PC9: INPUT "999" + ENTER → SNAP "42" (totalPages) ===');
await page.keyboard.type('999');
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
const snap999 = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
ok('PC9: input "999" + Enter → snap cuối "42"', snap999?.trim() === '42', snap999);

console.log('\n=== PC10: INPUT "0" + ENTER → SNAP "1" ===');
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(100);
await page.keyboard.type('0');
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
const snap0 = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
ok('PC10: input "0" + Enter → snap đầu "1"', snap0?.trim() === '1', snap0);

console.log('\n=== PC11: PASTE/ĐẬP "abc12" → VALUE CHỈ "12" (filter [0-9]) ===');
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(100);
await page.keyboard.type('abc12def34');
await page.waitForTimeout(100);
const filtered = await page.evaluate(() => {
	const input = document.querySelector('[data-test="pg-compact"] .pagination-page-input');
	return input?.value;
});
ok('PC11: input "abc12def34" → filter chỉ "1234"', filtered === '1234', filtered);

// PC11 để counter ở edit mode (draft "1234") → counter-current chưa render.
// Escape để REVERT + thoát edit mode (page giữ 1 từ PC10) — giữ state cho PC12/PC13.
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
const afterEscInput = await page.evaluate(() => !document.querySelector('[data-test="pg-compact"] .pagination-page-input'));
ok('PC11b: Escape → revert, thoát edit mode (input biến mất, page giữ 1)', afterEscInput && (await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent())?.trim() === '1', `inputGone=${afterEscInput}`);

console.log('\n=== PC12: ESCAPE → REVERT (counter giữ page cũ) ===');
const beforeEsc = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(150);
await page.keyboard.press('Escape');
await page.waitForTimeout(250);
const afterEsc = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
const noInput = await page.evaluate(() => !document.querySelector('[data-test="pg-compact"] .pagination-page-input'));
ok('PC12: Escape → revert (counter giữ page cũ, không input nữa)', afterEsc === beforeEsc && noInput, `before=${beforeEsc} after=${afterEsc}`);

console.log('\n=== PC13: ARROWDOWN TỪ PAGE 5 → COMMIT "4" (hoặc ARROWUP "6") ===');
// Set page về 5 trước (click next 4 lần từ page 1)
for (let i = 0; i < 4; i++) {
	await compactNav.locator('.pagination-next').click();
	await page.waitForTimeout(80);
}
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(100);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
const afterArrow = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
ok('PC13: ArrowDown từ page 5 → commit "4"', afterArrow?.trim() === '4', afterArrow);

console.log('\n=== PC14: BLUR (CLICK CHỖ KHÁC) COMMIT GIÁ TRỊ HỢP LỆ ===');
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(100);
await page.keyboard.type('7');
await page.waitForTimeout(100);
// Click chỗ khác (ngoài input) → blur → commit
await page.mouse.click(50, 50);
await page.waitForTimeout(150);
const afterBlur = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
ok('PC14: blur (click chỗ khác) commit "7"', afterBlur?.trim() === '7', afterBlur);

console.log('\n=== PC15: LOADING → nav[aria-busy="true"] + COUNTER/PREV/NEXT DISABLED + CURSOR NOT-ALLOWED ===');
const loadingState = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pg-loading"] .pagination-root');
	const busy = scope?.getAttribute('aria-busy');
	const counter = scope?.querySelector('.pagination-counter');
	const prev = scope?.querySelector('.pagination-prev');
	const next = scope?.querySelector('.pagination-next');
	return {
		busy,
		counterDisabled: counter?.disabled,
		prevDisabled: prev?.disabled,
		nextDisabled: next?.disabled,
		counterCursor: counter ? getComputedStyle(counter).cursor : null
	};
});
ok('PC15: loading → aria-busy="true" + mọi item disabled + cursor not-allowed', loadingState.busy === 'true' && loadingState.counterDisabled && loadingState.prevDisabled && loadingState.nextDisabled && loadingState.counterCursor === 'not-allowed', JSON.stringify(loadingState));

console.log('\n=== PC16: ICONS → 2 SVG HIỆN (GUARD ICONIFY ASYNC 15s) ===');
// GUARD iconify async: svg fetch 1-4s (offline → 0 svg, không FAIL giả)
let iconCount = 0;
try {
	await page.waitForSelector('[data-test="pg-icons"] svg', { timeout: 15000 });
	iconCount = await page.locator('[data-test="pg-icons"] svg').count();
} catch (e) {
	console.log('WARN: iconify timeout (offline?) — không FAIL giả');
}
ok('PC16: icons → 2 svg hiện (prev + next, guard iconify async)', iconCount === 2, `count=${iconCount}`);

console.log('\n=== PC17: ACTIVE CURSOR → TRANG 5 ACTIVE = NOT-ALLOWED (PC) ===');
const activeCursor = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pg-active"] .pagination-root');
	const active = scope?.querySelector('.pagination-page.active');
	return active ? getComputedStyle(active).cursor : null;
});
ok('PC17: active cursor → trang active = not-allowed (PC)', activeCursor === 'not-allowed', activeCursor);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/pagination';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="pg-compact"]').screenshot({ path: `${shotDir}/01-compact.png` });
await page.locator('[data-test="pg-loading"]').screenshot({ path: `${shotDir}/02-loading.png` });
await page.locator('[data-test="pg-icons"]').screenshot({ path: `${shotDir}/03-icons.png` });
await page.locator('[data-test="pg-active"]').screenshot({ path: `${shotDir}/04-active-cursor.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
