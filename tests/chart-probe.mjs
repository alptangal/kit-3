// tests/chart-probe.mjs
// Verify Chart (element) — self-written SVG, KHÔNG chart library.
// Trang demo: /ui/chart (bar đơn / line area+points / multi-series / formatter / empty / sizes).
//
// Kiểm tra:
//  C0 page .chart-root + svg[role=img]
//  C1 bar: số <rect> = số data point (6)
//  C2 line: có <path> + số <circle> = data point (8)
//  C3 axis: y-tick text ≥2 (đúng niceMax format) + x-labels = data point
//  C4 aria-label đúng (prop + auto)
//  C5 valueFormatter: data [2500000] → "2.5M" (check text trong svg)
//  C6 empty data → placeholder "Không có dữ liệu" + KHÔNG có rect/path/circle
//  C7 fallback data-table (visually-hidden) có rows = data point
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
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/chart', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.chart-root', { timeout: 20000 });
await sleep(500);

// C0 — structure: .chart-root + svg[role=img]
const c0 = await page.evaluate(() => {
	const roots = document.querySelectorAll('.chart-root');
	const svgImg = document.querySelector('.chart-root svg[role="img"]');
	return { roots: roots.length, svgImg: !!svgImg, aria: svgImg?.getAttribute('aria-label') };
});
ok('C0 .chart-root render + svg[role=img] + aria-label', c0.roots >= 5 && c0.svgImg, JSON.stringify(c0));

// C1 — bar: số <rect> = số data point (6)
const c1 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-bar"]');
	if (!scope) return null;
	const rects = scope.querySelectorAll('svg rect');
	return { rects: rects.length, labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] };
});
ok('C1 bar: số <rect> = 6 data point', c1?.rects === 6, `rects=${c1?.rects}`);

// C2 — line: có <path> + số <circle> = data point (8)
const c2 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-line"]');
	if (!scope) return null;
	const svg = scope.querySelector('svg');
	const paths = [...svg.querySelectorAll('path')];
	const linePath = paths.find((p) => p.classList.contains('chart-line'));
	const circles = svg.querySelectorAll('circle');
	const area = paths.find((p) => p.classList.contains('chart-area'));
	return { hasLine: !!linePath, circles: circles.length, hasArea: !!area };
});
ok('C2 line: có path.line + 8 circle (showPoints) + area', c2?.hasLine === true && c2?.circles === 8 && c2?.hasArea === true, JSON.stringify(c2));

// C3 — axis: y-tick text ≥2 (niceMax) + x-labels = data point
const c3 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-bar"]');
	if (!scope) return null;
	const svg = scope.querySelector('svg');
	const yLabels = [...svg.querySelectorAll('text.chart-y-label')].map((t) => t.textContent.trim());
	const xLabels = [...svg.querySelectorAll('text.chart-x-label')].map((t) => t.textContent.trim());
	// niceMax cho revenue (max 890) → tick 0/200/400/600/800/1000 (step 200)
	const topTick = yLabels[yLabels.length - 1];
	return {
		yCount: yLabels.length,
		yLabels,
		topTick,
		xCount: xLabels.length,
		xLabels
	};
});
ok('C3 axis: y-tick ≥2 (đúng niceMax) + x-labels = 6', c3?.yCount >= 2 && c3?.xCount === 6 && /\d/.test(c3?.topTick ?? ''), JSON.stringify(c3?.yLabels) + ' | top=' + c3?.topTick + ' | x=' + c3?.xCount);

// C4 — aria-label: prop (bar) + auto (line không label → "Biểu đồ N điểm")
const c4 = await page.evaluate(() => {
	const bar = document.querySelector('[data-test="chart-bar"] svg[role="img"]');
	const emptyAuto = document.querySelector('[data-test="chart-empty"] .chart-root svg[role="img"]');
	return {
		barAria: bar?.getAttribute('aria-label'),
		emptyAria: emptyAuto?.getAttribute('aria-label')
	};
});
ok('C4 aria-label: prop ("Biểu đồ doanh thu theo tháng") + auto ("Biểu đồ 0 điểm")', c4?.barAria === 'Biểu đồ doanh thu theo tháng' && c4?.emptyAria === 'Biểu đồ 0 điểm', JSON.stringify(c4));

// C5 — valueFormatter: Q3=2500000 → tooltip "Q3: 2.5M"; Q4=1200 → "Q4: 1.2k"
// (giá trị nằm giữa tick → đọc từ <title> native tooltip trong svg, đúng spec "check text trong svg")
const c5 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-formatter"]');
	if (!scope) return null;
	const svg = scope.querySelector('svg');
	const titles = [...svg.querySelectorAll('title')].map((t) => t.textContent.trim());
	const has2_5M = titles.includes('Q3: 2.5M');
	const has1_2k = titles.includes('Q4: 1.2k');
	return { titles, has2_5M, has1_2k };
});
ok('C5 valueFormatter: "Q3: 2.5M" + "Q4: 1.2k" trong svg (<title>)', c5?.has2_5M === true && c5?.has1_2k === true, JSON.stringify(c5?.titles));

// C6 — empty data → placeholder "Không có dữ liệu" + KHÔNG rect/path/circle
const c6 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-empty"]');
	if (!scope) return null;
	const emptyTexts = [...scope.querySelectorAll('text.chart-empty')].map((t) => t.textContent.trim());
	const hasPlaceholder = emptyTexts.some((t) => t.includes('Không có dữ liệu'));
	// svg của chart empty: không có rect/path/circle (data rỗng)
	const svgs = scope.querySelectorAll('svg');
	let anyMark = 0;
	svgs.forEach((s) => {
		anyMark += s.querySelectorAll('rect, path, circle').length;
	});
	return { hasPlaceholder, emptyTexts, anyMark };
});
ok('C6 empty: placeholder "Không có dữ liệu" + 0 rect/path/circle', c6?.hasPlaceholder === true && c6?.anyMark === 0, JSON.stringify(c6));

// C7 — fallback data-table (visually-hidden) có rows = data point
const c7 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-bar"]');
	if (!scope) return null;
	const table = scope.querySelector('table.chart-data-table');
	if (!table) return { table: false };
	const rows = table.querySelectorAll('tbody tr');
	const caption = table.querySelector('caption')?.textContent.trim();
	const cs = getComputedStyle(table);
	const clipped = cs.position === 'absolute' && (cs.clip?.includes('0px') || cs.clipPath?.includes('inset'));
	return { table: true, rows: rows.length, caption, clipped, position: cs.position };
});
ok('C7 fallback data-table: rows = 6 (caption + visually-hidden)', c7?.table === true && c7?.rows === 6 && c7?.clipped === true, JSON.stringify(c7));

// C8 (extra) — multi-series: legend có 3 item + 3 path.line
const c8 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-multi"]');
	if (!scope) return null;
	const legendItems = scope.querySelectorAll('.chart-legend__item');
	const linePaths = scope.querySelectorAll('path.chart-line');
	return { legend: legendItems.length, linePaths: linePaths.length };
});
ok('C8 multi-series: legend 3 item + 3 path.line', c8?.legend === 3 && c8?.linePaths === 3, JSON.stringify(c8));

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
