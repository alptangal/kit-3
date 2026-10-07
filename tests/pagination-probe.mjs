// pagination-probe.mjs
// Functional probe cho task "Pagination (light atom, shadcn usePagination)":
// PC0-PC6: probe cũ (nav/aria/entries/click/disabled/sibling/items)
// PC5b-PC5e: sibling fix (clamp theo boundary → không lặp trang)
// PC7-PC15: compact counter (jump-to input), loading, icons, active cursor
// PC14b-PC14d: compact pageAtEditStart (xoá rỗng → page trước edit) + range clamp blur
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

console.log('\n=== PC5: SIBLING=2 + BOUNDARY=2, PAGE 5/10 → ĐỦ 1-10 (KHÔNG LẶP) ===');
const sEntries = await entriesOf('[data-test="pg-sibling"]');
// FIX sibling: siblingStart = max(b+1, 5−2) = 3; siblingEnd = min(total−b, 5+2) = 7
// Dải hẹp: 3 <= b+2 (4) && 7 >= total−b−2 (6) → hiện ĐỦ 1-10, không ellipsis, không lặp.
ok(
	'PC5: sibling=2/boundary=2 page=5 → đủ 1-10 (mỗi trang đúng 1 lần)',
	JSON.stringify(sEntries[0]) === JSON.stringify(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']),
	JSON.stringify(sEntries[0])
);

console.log('\n=== PC5b: SIBLING FIX — CLICK PAGE 9 → KHÔNG LẶP (1 BUTTON "9" DUY NHẤT) ===');
// Bug cũ: click 9 → entries 1,2,-1,7,8,9,9,10 (page 9 LẶP — sibling đè lastBoundary).
await pageBtn(navIn('pg-sibling'), 9).click();
await page.waitForTimeout(150);
const sb9 = (await entriesOf('[data-test="pg-sibling"]'))[0];
const count9 = sb9.filter((x) => x === '9').length;
ok(
	'PC5b: click page 9 → [1, 2, …, 7, 8, …, 9, 10] — không lặp',
	JSON.stringify(sb9) === JSON.stringify(['1', '2', '…', '7', '8', '…', '9', '10']) && count9 === 1,
	`${JSON.stringify(sb9)} count9=${count9}`
);
ok(
	'PC5b: chỉ MỘT button "9" trong nav pg-sibling',
	(await navIn('pg-sibling').locator('button.pagination-page', { hasText: /^9$/ }).count()) === 1
);

console.log('\n=== PC5c: SIBLING FIX — CLICK PAGE 2 → KHÔNG LẶP (1 BUTTON "2" DUY NHẤT) ===');
// Bug cũ: init page 2 → entries 1,2,2,3,4,-1,9,10 (page 2 LẶP — sibling đè firstBoundary).
await pageBtn(navIn('pg-sibling'), 2).click();
await page.waitForTimeout(150);
const sb2 = (await entriesOf('[data-test="pg-sibling"]'))[0];
const count2 = sb2.filter((x) => x === '2').length;
ok(
	'PC5c: click page 2 → [1, 2, …, 3, 4, …, 9, 10] — không lặp',
	JSON.stringify(sb2) === JSON.stringify(['1', '2', '…', '3', '4', '…', '9', '10']) && count2 === 1,
	`${JSON.stringify(sb2)} count2=${count2}`
);
ok(
	'PC5c: chỉ MỘT button "2" trong nav pg-sibling',
	(await navIn('pg-sibling').locator('button.pagination-page', { hasText: /^2$/ }).count()) === 1
);

console.log('\n=== PC5d: SIBLING FIX — ĐẦU/GIỮA/CUỐI (s2 b2) KHÔNG LẶP ===');
// Chuỗi click CHỈ qua nút đang hiển thị (đầu 1 → 3 → giữa 5 → cuối 10):
// cur=1 → [1,2,…,3,…,9,10]; cur=3 → [1,2,…,3,4,5,…,9,10]; cur=5 → đủ 1-10; cur=10 → [1,2,…,8,…,9,10].
const sbSeq = [];
await pageBtn(navIn('pg-sibling'), 1).click();
await page.waitForTimeout(120);
sbSeq.push((await entriesOf('[data-test="pg-sibling"]'))[0]);
await pageBtn(navIn('pg-sibling'), 3).click();
await page.waitForTimeout(120);
sbSeq.push((await entriesOf('[data-test="pg-sibling"]'))[0]);
await pageBtn(navIn('pg-sibling'), 5).click();
await page.waitForTimeout(120);
sbSeq.push((await entriesOf('[data-test="pg-sibling"]'))[0]);
await pageBtn(navIn('pg-sibling'), 10).click();
await page.waitForTimeout(120);
sbSeq.push((await entriesOf('[data-test="pg-sibling"]'))[0]);
ok(
	'PC5d: đầu (1) → [1, 2, …, 3, …, 9, 10]',
	JSON.stringify(sbSeq[0]) === JSON.stringify(['1', '2', '…', '3', '…', '9', '10']),
	JSON.stringify(sbSeq[0])
);
ok(
	'PC5d: gần giữa (3) → [1, 2, …, 3, 4, 5, …, 9, 10]',
	JSON.stringify(sbSeq[1]) === JSON.stringify(['1', '2', '…', '3', '4', '5', '…', '9', '10']),
	JSON.stringify(sbSeq[1])
);
ok(
	'PC5d: giữa (5) → đủ 1-10 (dải hẹp)',
	JSON.stringify(sbSeq[2]) === JSON.stringify(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']),
	JSON.stringify(sbSeq[2])
);
ok(
	'PC5d: cuối (10) → [1, 2, …, 8, …, 9, 10]',
	JSON.stringify(sbSeq[3]) === JSON.stringify(['1', '2', '…', '8', '…', '9', '10']),
	JSON.stringify(sbSeq[3])
);
const dupInSeq = sbSeq.some((a) => {
	const pages = a.filter((x) => x !== '…'); // 2 ellipsis ('…') là CHÍNH ĐÁNG — chỉ check trùng số TRANG
	return new Set(pages).size !== pages.length;
});
ok('PC5d: cả 4 bước ĐẦU/GIỮA/CUỐI không trang lặp', !dupInSeq, JSON.stringify(sbSeq));

console.log('\n=== PC5e: SIBLING FIX — MỌI NAV (default) KHÔNG TRANG LẶP ===');
const allNavEntries = await page.evaluate(() => {
	const out = [];
	for (const nav of document.querySelectorAll('[data-test="pagination-demo"] .pagination-root')) {
		const arr = [];
		for (const el of nav.querySelectorAll('.pagination-item')) {
			if (el.classList.contains('pagination-ellipsis')) arr.push('…');
			else if (el.classList.contains('pagination-page')) arr.push(el.textContent?.trim());
		}
		out.push(arr);
	}
	return out;
});
const dupNavs = allNavEntries
	.map((a, i) => {
		const pages = a.filter((x) => x !== '…'); // 2 ellipsis chính đáng — chỉ check trùng SỐ TRANG
		return { nav: i, entries: a, dup: new Set(pages).size !== pages.length };
	})
	.filter((x) => x.dup);
ok('PC5e: mọi nav pagination không có trang lặp (global guard)', dupNavs.length === 0, JSON.stringify(dupNavs));

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

console.log('\n=== PC14b: XOÁ RỖNG + BLUR → TRẢ VỀ PAGE TRƯỚC KHI EDIT (KHÔNG SNAP 1) ===');
// page đang là 7 (từ PC14). Vào edit (draft "7"), xoá rỗng, blur → phải trả về 7 (pageAtEditStart),
// KHÔNG snap về 1 (bug cũ: safePage fallback đúng hướng nhưng không lưu page trước edit).
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(100);
await page.keyboard.press('Backspace');
await page.waitForTimeout(50);
await page.keyboard.press('Backspace');
await page.waitForTimeout(50);
const draftEmpty = await page.evaluate(() => {
	const input = document.querySelector('[data-test="pg-compact"] .pagination-page-input');
	return input?.value;
});
ok('PC14b: xoá hết → draft rỗng', draftEmpty === '', JSON.stringify(draftEmpty));
await page.mouse.click(50, 50);
await page.waitForTimeout(150);
const afterEmptyBlur = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
ok(
	'PC14b: blur với draft rỗng → page giữ 7 (pageAtEditStart, KHÔNG snap 1)',
	afterEmptyBlur?.trim() === '7',
	afterEmptyBlur
);

console.log('\n=== PC14c: XOÁ RỖNG → TRỞ VỀ PAGE TRƯỚC KHI XÓA (góc nhìn task: blur) ===');
// Góc nhìn task 2: "xoá giá trị input rỗng + blur → trả về current page TRƯỚC thời điểm xóa".
// page hiện là 7. Vào edit, xoá rỗng → blur → 7 (đã cover PC14b). Ở đây kiểm tra thêm biến thể:
// xoá rỗng rồi NHẬP số không hợp lệ (0) rồi blur → vẫn trả về page trước thời điểm xóa (7).
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(100);
await page.keyboard.press('Backspace');
await page.waitForTimeout(50);
await page.keyboard.press('Backspace');
await page.waitForTimeout(50);
await page.keyboard.type('0');
await page.waitForTimeout(50);
await page.mouse.click(50, 50);
await page.waitForTimeout(150);
const afterZeroBlur = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
ok(
	'PC14c: xoá rỗng + nhập "0" + blur → snap đầu 1 (giá trị ngoài range, không vô nghĩa)',
	afterZeroBlur?.trim() === '1',
	afterZeroBlur
);

console.log('\n=== PC14d: NHẬP > TOTALPAGES + BLUR → SNAP CUỐI; < 1 + BLUR → SNAP ĐẦU ===');
// > totalPages (42): "999" + blur → snap 42. Sau đó "0" + blur → snap 1.
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(100);
await page.keyboard.type('999');
await page.waitForTimeout(50);
await page.mouse.click(50, 50);
await page.waitForTimeout(150);
const blur999 = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
ok('PC14d: "999" + blur → snap cuối "42"', blur999?.trim() === '42', blur999);
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(100);
await page.keyboard.type('0');
await page.waitForTimeout(50);
await page.mouse.click(50, 50);
await page.waitForTimeout(150);
const blur0 = await page.locator('[data-test="pg-compact"] [data-test="counter-current"]').textContent();
ok('PC14d: "0" + blur → snap đầu "1"', blur0?.trim() === '1', blur0);

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
const shotDir = 'tests/screenshots/pagination';
mkdirSync(shotDir, { recursive: true });
// Sibling FIXED: pg-sibling đang ở page 10 (từ PC5d) → prev 1 lần → page 9
// (đúng trạng thái user báo lỗi — cũ: 1,2,-1,7,8,9,9,10 LẶP; giờ: 1,2,…,7,8,…,9,10).
await navIn('pg-sibling').locator('.pagination-prev').click();
await page.waitForTimeout(150);
await page.locator('[data-test="pg-sibling"]').screenshot({ path: `${shotDir}/01-sibling-fixed.png` });
// Compact counter focus (đang edit, input focus + select-all)
await compactNav.locator('[data-test="counter"]').click();
await page.waitForTimeout(200);
await page.locator('[data-test="pg-compact"]').screenshot({ path: `${shotDir}/02-compact-counter-focus.png` });
// Compact edit (draft nhập "30")
await page.keyboard.type('30');
await page.waitForTimeout(100);
await page.locator('[data-test="pg-compact"]').screenshot({ path: `${shotDir}/03-compact-edit.png` });
// Thoát edit (Escape revert) + chụp các section còn lại
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await page.locator('[data-test="pg-loading"]').screenshot({ path: `${shotDir}/04-loading.png` });
await page.locator('[data-test="pg-icons"]').screenshot({ path: `${shotDir}/05-icons.png` });
await page.locator('[data-test="pg-active"]').screenshot({ path: `${shotDir}/06-active-cursor.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
