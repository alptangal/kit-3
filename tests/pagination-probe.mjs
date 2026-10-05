// pagination-probe.mjs
// Functional probe cho task "Pagination (light atom, shadcn usePagination)":
// - PG0  nav aria-label + buttons
// - PG1  page=5/10 (sibling=1) → visible [1, …, 4,5,6, …, 10]
// - PG2  click page 3 → aria-current move + bind value đổi ("Trang hiện tại: 3")
// - PG3  prev disabled at page 1
// - PG4  next disabled at last page
// - PG5  siblingCount=2 + boundary=2, page 5/10 → [1, 2, …, 3,4,5,6,7, …, 9, 10]
// - PG6  totalItems=95/pageSize=10 → 10 pages, next disabled at 10
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

console.log('\n=== PG0: NAV ARIA-LABEL + BUTTONS ===');
ok('PG0: demo root render', (await page.locator('[data-test="pagination-demo"]').count()) === 1);
const navCount = await page.locator('[data-test="pagination-demo"] nav.pagination-root').count();
ok(
	'PG0: 10 nav.pagination-root (basic x4 + sibling + small + size x3 + items)',
	navCount === 10,
	String(navCount)
);
const labeled = await page.locator('[data-test="pagination-demo"] nav.pagination-root[aria-label]').count();
ok('PG0: mọi nav có aria-label', labeled === 10, String(labeled));
const basicNav = navIn('pg-basic', 0);
ok('PG0: basic nav có prev + next button', (await basicNav.locator('.pagination-prev, .pagination-next').count()) === 2);

console.log('\n=== PG1: PAGE=5/10 VISIBLE [1, …, 4,5,6, …, 10] ===');
const p5 = navIn('pg-basic', 1);
const p5Entries = await entriesOf('[data-test="pg-basic"]');
// nav thứ 2 (page=5): expected = <, 1, …, 4, 5, 6, …, 10, >
ok(
	'PG1: page=5/10 → visible [1, …, 4, 5, 6, …, 10]',
	JSON.stringify(p5Entries[1]) === JSON.stringify(['1', '…', '4', '5', '6', '…', '10']),
	JSON.stringify(p5Entries[1] ?? p5Entries)
);
ok('PG1: aria-current="page" đúng ở 5', (await p5.locator('button[aria-current="page"]').textContent())?.trim() === '5');

console.log('\n=== PG2: CLICK PAGE 3 → aria-current + BIND ĐỔI ===');
// page=1 → visible [1, …, 2, …, 10]: click next (">") sang page 2 trước,
// sau đó mới thấy nút "3" trong [1, …, 3, …, 10] (tránh hasText substring).
await navIn('pg-basic', 0).locator('.pagination-next').click();
await page.waitForTimeout(120);
await pageBtn(navIn('pg-basic', 0), 3).click();
await page.waitForTimeout(150);
const current3 = await navIn('pg-basic', 0).locator('button[aria-current="page"]').textContent();
ok('PG2: click "3" → aria-current move sang 3', current3?.trim() === '3', current3);
const hint3 = await page.locator('[data-test="pg-basic-current"]').textContent();
ok('PG2: demo "Trang hiện tại" = 3 (bind value đổi)', hint3?.trim() === '3', hint3);

console.log('\n=== PG3: PREV DISABLED AT PAGE 1 ===');
// page=3 → visible [1, …, 2, 3, 4, …, 10]: click "1" (exact regex, tránh "10")
await pageBtn(navIn('pg-basic', 0), 1).click();
await page.waitForTimeout(150);
ok(
	'PG3: page=1 → nút prev disabled (nút "‹")',
	(await navIn('pg-basic', 0).locator('.pagination-prev').isDisabled())
);

console.log('\n=== PG4: NEXT DISABLED AT LAST PAGE ===');
const p10 = navIn('pg-basic', 3);
ok(
	'PG4: page=10 → nút next disabled (nút "›")',
	(await p10.locator('.pagination-next').isDisabled())
);

console.log('\n=== PG5: SIBLING=2 + BOUNDARY=2, PAGE 5/10 ===');
const sEntries = await entriesOf('[data-test="pg-sibling"]');
// shadcn: siblingStart = max(2, 5−2) = 3; siblingEnd = min(9, 5+2) = 7
// → firstBoundary 1,2 + middle 3–7 + lastBoundary 9,10 (2 ellipsis)
ok(
	'PG5: sibling=2/boundary=2 page=5 → [1, 2, …, 3, 4, 5, 6, 7, …, 9, 10]',
	JSON.stringify(sEntries[0]) === JSON.stringify(['1', '2', '…', '3', '4', '5', '6', '7', '…', '9', '10']),
	JSON.stringify(sEntries[0])
);

console.log('\n=== PG6: TOTAL ITEMS 95/10 → 10 PAGES, NEXT DISABLED AT 10 ===');
const iEntries = await entriesOf('[data-test="pg-items"]');
// page=3, total=10: siblingStart=max(2,3−1)=2, siblingEnd=min(9,3+1)=4
// → firstBoundary 1 + middle 2–4 + lastBoundary 10, xen 2 ellipsis
ok(
	'PG6: totalItems=95/pageSize=10 page=3 → [1, …, 2, 3, 4, …, 10] (10 pages)',
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
	'PG6: ở trang cuối (10) → next disabled',
	(await page.locator('[data-test="pg-items"] .pagination-next').isDisabled())
);
const itemsCurrent = await page.locator('[data-test="pg-items"] .demo-hint code').first().textContent();
ok('PG6: bind page ở trang cuối = 10', itemsCurrent?.trim() === '10', itemsCurrent);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/pagination';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="pg-basic"]').screenshot({ path: `${shotDir}/01-basic.png` });
await page.locator('[data-test="pg-sibling"]').screenshot({ path: `${shotDir}/02-sibling.png` });
await page.locator('[data-test="pg-small"]').screenshot({ path: `${shotDir}/03-small.png` });
await page.locator('[data-test="pg-size"]').screenshot({ path: `${shotDir}/04-sizes.png` });
await page.locator('[data-test="pg-items"]').screenshot({ path: `${shotDir}/05-items.png` });
await page.locator('[data-test="pagination-demo"]').screenshot({ path: `${shotDir}/01-pagination-cases.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
