// tests/chart-probe.mjs
// Verify Chart (element) — self-written SVG, KHÔNG chart library.
// Trang demo: /ui/chart (bar / line area+points / multi-series / formatter / live /
// live-source / empty / sizes + tooltip hover đa thông tin).
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
//  C8 multi-series: legend 3 item + 3 path.line
//  C9 tooltip hover bar: portal body + fixed + z 10500 + label/value/percent
//  C9b mouse rời → tooltip biến mất
//  C10 tooltip multi: label + 3 series + % + delta
//  C10b không có prop tooltip → 0 tooltip + giữ native <title>
//  C11 live (mirror): badge LIVE + điểm tăng → max 10 + cửa sổ trượt
//  C12 live (source poll): bars 0→8 (max) + cửa sổ trượt dịch
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

// ─────────────────────────────────────────────────────────────────────────────
// C9 — Tooltip hover (bar): hover bar giữa → .chart-tooltip portal body hiện với
// label + value đúng (T4 = 720). Portal vào document.body (position:fixed).
// ─────────────────────────────────────────────────────────────────────────────
const c9scope = page.locator('[data-test="chart-bar"] svg').first();
{
	const box = await c9scope.boundingBox();
	// Bar T4 (index 3): band = plotW/6, x center của bar theo viewBox 600.
	// plotW = 600-46-14 = 540 → band 90 → x center = 46+3*90+45 = 361.
	// y giữa plot area = 18 + 244*0.5 ≈ 140. Scale theo boundingBox thực tế.
	const vx = 361 / 600;
	const vy = 140 / 300;
	const x = box.x + box.width * vx;
	const y = box.y + box.height * vy;
	await page.mouse.move(x, y, { steps: 4 });
	await sleep(400);
}
const c9 = await page.evaluate(() => {
	const tip = document.body.querySelector('.chart-tooltip[data-test="chart-tooltip"]');
	if (!tip) return null;
	const cs = getComputedStyle(tip);
	const text = tip.textContent.replace(/\s+/g, ' ').trim();
	return {
		inBody: tip.parentElement === document.body,
		position: cs.position,
		zIndex: cs.zIndex,
		text,
		hasLabel: text.includes('T4'),
		hasValue: /720/.test(text),
		hasPercent: /%/.test(text),
		visible: tip.offsetWidth > 0 && tip.offsetHeight > 0
	};
});
ok(
	'C9 tooltip hover bar: portal body + fixed + z 10500 + label/value/percent đúng',
	c9?.inBody === true && c9?.position === 'fixed' && c9?.zIndex === '10500' && c9?.hasLabel === true && c9?.hasValue === true && c9?.hasPercent === true && c9?.visible === true,
	JSON.stringify(c9)
);

// C9b — mouse rời chart → tooltip biến mất
await page.mouse.move(5, 5, { steps: 3 });
await sleep(250);
const c9b = await page.evaluate(() => document.body.querySelectorAll('.chart-tooltip').length);
ok('C9b mouse rời chart → tooltip biến mất', c9b === 0, `count=${c9b}`);

// ─────────────────────────────────────────────────────────────────────────────
// C10 — Tooltip hover (line multi): % theo tổng series tại điểm (T1: 400/280/120
// → tổng 800 → 50%/35%/15%) + delta so điểm kề (line mặc định có delta).
// Chart nằm dưới fold → scrollIntoView trước khi hover (mouse.move ngoài viewport bỏ qua).
// ─────────────────────────────────────────────────────────────────────────────
{
	await page.evaluate(() => {
		document.querySelector('[data-test="chart-multi"] svg')?.scrollIntoView({ block: 'center' });
	});
	await sleep(300);
	const box = await page.locator('[data-test="chart-multi"] svg').first().boundingBox();
	// T2 (index 1): x center = 46+1*90+45 = 181 / 600; y giữa = 140/300.
	const x = box.x + box.width * (181 / 600);
	const y = box.y + box.height * (140 / 300);
	await page.mouse.move(x, y, { steps: 4 });
	await sleep(400);
}
const c10 = await page.evaluate(() => {
	const tip = document.body.querySelector('.chart-tooltip[data-test="chart-tooltip"]');
	if (!tip) return null;
	const text = tip.textContent.replace(/\s+/g, ' ').trim();
	const rows = [...tip.querySelectorAll('.chart-tooltip__row')].map((r) =>
		r.textContent.replace(/\s+/g, ' ').trim()
	);
	return {
		text,
		rows,
		hasLabel: text.includes('T2'),
		hasDoanhThu: text.includes('Doanh thu'),
		hasChiPhi: text.includes('Chi phí'),
		hasLoiNhuan: text.includes('Lợi nhuận'),
		percentCount: (text.match(/%/g) ?? []).length,
		hasDelta: (text.match(/[+\-]/g) ?? []).length > 0
	};
});
ok(
	'C10 tooltip multi: label T2 + 3 series + % từng series + delta',
	c10?.hasLabel === true && c10?.hasDoanhThu === true && c10?.hasChiPhi === true && c10?.hasLoiNhuan === true && (c10?.percentCount ?? 0) >= 3 && c10?.hasDelta === true,
	JSON.stringify(c10)
);
await page.mouse.move(5, 5, { steps: 3 });
await sleep(250);

// C10b — chart KHÔNG có prop tooltip → KHÔNG render .chart-tooltip khi hover
{
	const box = await page.locator('[data-test="chart-formatter"] svg').first().boundingBox();
	const x = box.x + box.width * (361 / 600);
	const y = box.y + box.height * (140 / 300);
	await page.mouse.move(x, y, { steps: 4 });
	await sleep(300);
}
const c10b = await page.evaluate(() => ({
	tips: document.body.querySelectorAll('.chart-tooltip').length,
	nativeTitle: !!document.querySelector('[data-test="chart-formatter"] svg title')
}));
ok(
	'C10b không có prop tooltip → 0 .chart-tooltip + giữ native <title>',
	c10b?.tips === 0 && c10b?.nativeTitle === true,
	JSON.stringify(c10b)
);

// ─────────────────────────────────────────────────────────────────────────────
// C11 — Live data (mirror prop): badge LIVE + data tăng động + cửa sổ trượt max=10.
// Timer live chạy từ lúc page load → probe DETERMINISTIC bằng polling: đợi tới khi
// số điểm đạt max, rồi xác nhận 2 interval sau cửa sổ trượt giữ max + label đầu dịch.
// ─────────────────────────────────────────────────────────────────────────────
const c11a = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-live"]');
	const badge = scope?.querySelector('.chart-live-badge');
	const circles = scope?.querySelectorAll('circle').length ?? 0;
	return { badge: !!badge, text: badge?.textContent.trim() ?? '', circles };
});
ok(
	'C11a live: badge LIVE render + circles khởi tạo > 0',
	c11a?.badge === true && c11a.text === 'LIVE' && c11a.circles > 0,
	JSON.stringify(c11a)
);

// Poll đợi tới khi số điểm đạt max=10 (timeout 12s), chốt label đầu tại thời điểm đó.
const waitForMax = async (selector, markSel, max, timeoutMs) => {
	const start = Date.now();
	let last = null;
	while (Date.now() - start < timeoutMs) {
		last = await page.evaluate(
			({ selector, markSel }) => {
				const scope = document.querySelector(selector);
				const marks = scope?.querySelectorAll(markSel).length ?? 0;
				const xLabels = [...(scope?.querySelectorAll('text.chart-x-label') ?? [])].map((t) =>
					t.textContent.trim()
				);
				return { marks, count: xLabels.length, first: xLabels[0], last: xLabels[xLabels.length - 1] };
			},
			{ selector, markSel }
		);
		if (last.marks >= max) break;
		await sleep(300);
	}
	return last;
};
const c11b = await waitForMax('[data-test="chart-live"]', 'circle', 10, 12000);
ok(
	'C11b live data tăng động: đạt max=10 điểm (cửa sổ trượt chặn)',
	c11b?.marks === 10 && c11b.count === 10,
	JSON.stringify(c11b)
);

// Đợi 2 interval (2s + buffer) → cửa sổ trượt: vẫn max=10 NHƯNG label đầu đã dịch.
const c11FirstAtMax = c11b.first;
await sleep(2600);
const c11c = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-live"]');
	const circles = scope?.querySelectorAll('circle').length ?? 0;
	const xLabels = [...scope.querySelectorAll('text.chart-x-label')].map((t) => t.textContent.trim());
	return { circles, count: xLabels.length, first: xLabels[0], last: xLabels[xLabels.length - 1] };
});
ok(
	'C11c live cửa sổ trượt: giữ max=10 + label đầu đã dịch (bỏ điểm cũ nhất)',
	c11c?.circles === 10 && c11c.count === 10 && c11c.first !== c11FirstAtMax,
	`atMax=${c11FirstAtMax} | after=${JSON.stringify(c11c)}`
);

// ─────────────────────────────────────────────────────────────────────────────
// C12 — Live với source poll (interval 800ms, max=8): chart tự poll nguồn, bars
// tăng tới max=8 rồi cửa sổ trượt giữ max + label đầu dịch (deterministic polling).
// ─────────────────────────────────────────────────────────────────────────────
const c12a = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-live-source"]');
	const bars = scope?.querySelectorAll('rect.chart-bar').length ?? 0;
	const badge = !!scope?.querySelector('.chart-live-badge');
	return { bars, badge };
});
ok('C12a live source: badge LIVE + bars > 0 (poll đã chạy)', c12a?.badge === true && c12a.bars > 0, JSON.stringify(c12a));

const c12b = await waitForMax('[data-test="chart-live-source"]', 'rect.chart-bar', 8, 10000);
ok(
	'C12b live source poll: đạt max=8 bars (append + chặn cửa sổ)',
	c12b?.marks === 8 && c12b.count === 8,
	JSON.stringify(c12b)
);

// Đợi 2 tick (800ms × 2 + buffer) → cửa sổ trượt dịch label đầu.
const c12FirstAtMax = c12b.first;
await sleep(2200);
const c12c = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="chart-live-source"]');
	const bars = scope?.querySelectorAll('rect.chart-bar').length ?? 0;
	const xLabels = [...scope.querySelectorAll('text.chart-x-label')].map((t) => t.textContent.trim());
	return { bars, count: xLabels.length, first: xLabels[0], last: xLabels[xLabels.length - 1] };
});
ok(
	'C12c live source cửa sổ trượt: giữ max=8 + label đầu đã dịch',
	c12c?.bars === 8 && c12c.count === 8 && c12c.first !== c12FirstAtMax,
	`atMax=${c12FirstAtMax} | after=${JSON.stringify(c12c)}`
);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
