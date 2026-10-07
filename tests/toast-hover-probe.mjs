// tests/toast-hover-probe.mjs
// Verify Toast hover-expand group — hover vào vùng có toast → toàn bộ toast cùng
// position EXPAND thẳng hàng (column với top/bottom, row với left/right), mỗi toast
// full nguyên bản (scale 1, không chồng, gap 10px); mouse rời → trả về stack chồng
// (scale step 5% + peek 10px); hover toast riêng → auto-dismiss timer PAUSE.
// Trang demo: /ui/toast (ToastWrapper data-test="toast-wrapper" là owner).
//
// Kiểm tra:
//  H0  3 toast cùng position bottom → stack chồng: scale nhỏ dần + peek offset
//  H1  hover toast trong group → TOÀB group expanded: scale 1, xếp thẳng hàng dọc
//      (top tăng dần theo rank * (height + gap)), gap >= 8px giữa các toast
//  H2  mouse rời → trả về stack chồng (scale nhỏ dần như H0)
//  H3  hover toast riêng → status.hover=true + auto-dismiss PAUSE (elapsed không chạy)
//  H4  mouse rời toast → timer chạy tiếp (toast tự biến mất sau duration)
//  H5  position left → expand xếp hàng NGANG (left tăng dần theo rank * (width + gap))
//  H6  position right → expand xếp hàng NGANG (right chung, transform dịch -X)
//  H7  position top → expand xếp hàng DỌC (top chung, transform dịch +Y)
//  H8  transform thuần: KHÔNG set inline top/right/bottom/left khi đang stack
//      (chỉ khi expand anchor chung = offset) — transition không bị px nhảy
//  H9  reduced-motion → transition: none (CSS)
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

// Fire N toast infinite cùng position (mặc định bottom) — mỗi toast 1 title riêng.
const fireStack = async (n, position = 'bottom') => {
	await page.evaluate(
		({ n, position }) => {
			// @ts-expect-error expose qua window cho probe
			window.__fireStack(n, position);
		},
		{ n, position }
	);
};

// State snapshot: mỗi .toast-root → position anchor (top/bottom/left/right), transform,
// scale, rect (x, y, width, height).
const snapshot = () =>
	page.evaluate(() => {
		return [...document.querySelectorAll('.toast-root')].map((r) => {
			const s = getComputedStyle(r);
			const rect = r.getBoundingClientRect();
			const anchorProp = ['top', 'bottom', 'left', 'right'].find((side) => r.style[side] !== '');
			return {
				title: (r.textContent || '').trim().slice(0, 24),
				position: r.getAttribute('data-position'),
				anchor: anchorProp ? `${anchorProp}=${r.style[anchorProp]}` : null,
				transform: r.style.transform,
				scale: s.scale || null,
				transformProp: s.transform,
				transition: s.transitionDuration,
				rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
			};
		});
	});
const bottomToasts = (snap) => snap.filter((t) => t.position === 'bottom');

// ============ /ui/toast ============
await page.goto('https://localhost:3000/ui/toast', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 20000 });
await sleep(500);

// Expose fire helper trên window (dùng toast.* API thật qua module import).
await page.evaluate(() => {
	// @ts-expect-error probe-only
	window.__fireStack = (n, position = 'bottom') => {
		// dispatch qua nút demo KHÔNG hỗ trợ position — dùng custom event để page lắng nghe?
		// Không: page không expose toast API. Thay thế: gọi store trực tiếp qua event của
		// wrapper? Không thể từ console. Cách sạch: click N lần nút "Nhiều cùng lúc" chỉ
		// cho 1 nhóm bottom; với position khác dùng toast data của page.
		// → Probe dùng CustomEvent 'toast-probe:fire' mà page LẮNG NGHE (đã thêm vào demo).
		window.dispatchEvent(new CustomEvent('toast-probe:fire', { detail: { n, position } }));
	};
});

// ── H0 — 3 toast bottom → stack chồng (scale nhỏ dần + peek) ──
await fireStack(3, 'bottom');
await page
	.locator('.toast-root', { hasText: 'H toast 3' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(400); // fly intro + layout ổn định
const stackSnap = bottomToasts(await snapshot());
ok('H0a 3 toast bottom render', stackSnap.length === 3, `count=${stackSnap.length}`);
const scales = stackSnap.map((t) => {
	const m = t.transformProp.match(/scale\(([\d.]+)\)/) || t.transformProp.match(/matrix\(([\d.]+),/);
	return m ? parseFloat(m[1]) : 1;
});
// Stack chồng: toast MỚI NHẤT (index DOM cuối) scale 1, cũ hơn nhỏ dần (0.95, 0.9).
const newest = stackSnap.find((t) => t.title.includes('H toast 3'));
const newestScale = scales[stackSnap.indexOf(newest)];
ok(
	'H0b stack chồng: scale nhỏ dần (1, 0.95, 0.9)',
	newestScale === 1 && scales.filter((s) => s < 1).length === 2 && Math.min(...scales) <= 0.9,
	`scales=${scales.join(',')}`
);
const peekOffsets = stackSnap.map((t) => {
	const m = t.transform.match(/translate[XY]\((-?[\d.]+)px\)/);
	return m ? parseFloat(m[1]) : 0;
});
ok(
	'H0c stack chồng: peek 0/10/20px theo rank (bottom dịch lên → âm)',
	peekOffsets.includes(0) && peekOffsets.includes(-10) && peekOffsets.includes(-20),
	`peeks=${peekOffsets.join(',')}`
);
// Transition transform 200ms được set (transitionDuration = 0.2s)
ok(
	'H0d transition transform 200ms',
	stackSnap.every((t) => t.transition === '0.2s'),
	`durations=${stackSnap.map((t) => t.transition).join(',')}`
);

// ── H1 — hover toast trong group → group expanded: scale 1, xếp thẳng hàng dọc ──
// Hover toast MỚI NHẤT ("H toast 3" — ở mép). Wrapper 0×0 không nhận hover; hover
// phải vào chính toast element.
const hoverTarget = page.locator('.toast-root', { hasText: 'H toast 3' });
await hoverTarget.hover();
await sleep(500); // transition 200ms + collapse delay chống flicker
const expandSnap = bottomToasts(await snapshot());
ok('H1a hover group: 3 toast vẫn render', expandSnap.length === 3, `count=${expandSnap.length}`);
const expandScales = expandSnap.map((t) => {
	const m = t.transformProp.match(/scale\(([\d.]+)\)/) || t.transformProp.match(/matrix\(([\d.]+),/);
	return m ? parseFloat(m[1]) : 1;
});
ok(
	'H1b hover group: mỗi toast full size (scale 1)',
	expandScales.every((s) => s === 1),
	`scales=${expandScales.join(',')}`
);
// Xếp thẳng hàng dọc: cùng anchor (bottom), y GIẢM dần theo rank (toast cũ hơn nằm
// trên), khoảng cách giữa 2 rect liên tiếp = height + gap (>= height + 8).
const ys = expandSnap.map((t) => t.rect.y);
const heights = expandSnap.map((t) => t.rect.h);
const sortedYs = [...ys].sort((a, b) => b - a); // cao nhất (y nhỏ nhất) lên đầu? — y nhỏ = trên
const uniqHeights = [...new Set(heights)];
const gaps = [];
const ySorted = [...ys].sort((a, b) => a - b);
for (let i = 1; i < ySorted.length; i++) {
	gaps.push(ySorted[i] - ySorted[i - 1]);
}
const expectedGap = (uniqHeights[0] ?? 0) + 10;
ok(
	'H1c expand: xếp thẳng hàng dọc, gap = height + 10px',
	gaps.length === 2 && gaps.every((g) => Math.abs(g - expectedGap) <= 2) && uniqHeights.length === 1,
	`gaps=${gaps.join(',')} heights=${heights.join(',')} expectedGap=${expectedGap}`
);
// Rect KHÔNG chồng nhau (không overlap): các toast phân biệt rõ.
const noOverlap =
	ySorted[0] + (uniqHeights[0] ?? 0) <= ySorted[1] + 1 && ySorted[1] + (uniqHeights[0] ?? 0) <= ySorted[2] + 1;
ok('H1d expand: không overlap', noOverlap, `ys=${ys.join(',')}`);

// ── H2 — mouse rời → trả về stack chồng ──
await page.mouse.move(400, 400);
await sleep(600); // collapse delay 150ms + transition 200ms
const restoreSnap = bottomToasts(await snapshot());
const restoreScales = restoreSnap.map((t) => {
	const m = t.transformProp.match(/scale\(([\d.]+)\)/) || t.transformProp.match(/matrix\(([\d.]+),/);
	return m ? parseFloat(m[1]) : 1;
});
ok(
	'H2 mouse rời → trả về stack chồng (scale 1/0.95/0.9)',
	restoreScales.every((s) => s === 1 || s < 1) && Math.min(...restoreScales) <= 0.9 && restoreScales.includes(1),
	`scales=${restoreScales.join(',')}`
);

// ── H3/H4 — hover toast riêng → auto-dismiss PAUSE, rời → chạy tiếp ──
// Xóa stack, fire 1 toast duration 2.5s (ngắn hơn để probe nhanh).
await page.evaluate(() => {
	window.dispatchEvent(new CustomEvent('toast-probe:clear'));
});
await sleep(300);
await page.evaluate(() => {
	window.dispatchEvent(new CustomEvent('toast-probe:fire-pause', { detail: { duration: 2500 } }));
});
await page
	.locator('.toast-root', { hasText: 'H pause toast' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(200);
// Hover 3s (QUÁ duration 2.5s) → timer PAUSE khi hover → toast VẪN SỐNG.
const pauseTarget = page.locator('.toast-root', { hasText: 'H pause toast' });
await pauseTarget.hover();
await sleep(3000);
const stillAlive = await page.evaluate(
	() => !![...document.querySelectorAll('.toast-root')].find((r) => r.textContent?.includes('H pause toast'))
);
ok('H3 hover toast riêng: auto-dismiss PAUSE (sống quá duration)', stillAlive);
// Mouse rời → timer chạy tiếp → toast biến mất trong ~2.5s.
await page.mouse.move(400, 400);
await sleep(2900);
const goneAfterLeave = await page.evaluate(
	() => ![...document.querySelectorAll('.toast-root')].find((r) => r.textContent?.includes('H pause toast'))
);
ok('H4 mouse rời: timer chạy tiếp (biến mất sau duration)', goneAfterLeave);

// ── H5 — position left → expand xếp hàng NGANG ──
await fireStack(3, 'left');
await page
	.locator('.toast-root', { hasText: 'H toast 3' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(400);
const leftHover = page.locator('.toast-root', { hasText: 'H toast 3' });
await leftHover.hover();
await sleep(500);
const leftSnap = (await snapshot()).filter((t) => t.position === 'left');
ok('H5a 3 toast left render', leftSnap.length === 3, `count=${leftSnap.length}`);
const leftScales = leftSnap.map((t) => {
	const m = t.transformProp.match(/scale\(([\d.]+)\)/) || t.transformProp.match(/matrix\(([\d.]+),/);
	return m ? parseFloat(m[1]) : 1;
});
ok('H5b left expand: scale 1 (full size)', leftScales.every((s) => s === 1), `scales=${leftScales.join(',')}`);
// Xếp hàng ngang: x tăng dần, khoảng cách = width + 10.
const xs = leftSnap.map((t) => t.rect.x);
const widths = leftSnap.map((t) => t.rect.w);
const xSorted = [...xs].sort((a, b) => a - b);
const leftGaps = [];
for (let i = 1; i < xSorted.length; i++) leftGaps.push(xSorted[i] - xSorted[i - 1]);
const uniqWidths = [...new Set(widths)];
const expectedLeftGap = (uniqWidths[0] ?? 0) + 10;
ok(
	'H5c left expand: xếp hàng ngang, gap = width + 10px',
	leftGaps.length === 2 && leftGaps.every((g) => Math.abs(g - expectedLeftGap) <= 2) && uniqWidths.length === 1,
	`gaps=${leftGaps.join(',')} widths=${widths.join(',')} expectedGap=${expectedLeftGap}`
);

// ── H6 — position right → expand xếp hàng NGANG (dịch -X) ──
await page.evaluate(() => {
	window.dispatchEvent(new CustomEvent('toast-probe:clear'));
});
await sleep(300);
await fireStack(3, 'right');
await page
	.locator('.toast-root', { hasText: 'H toast 3' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(400);
const rightHover = page.locator('.toast-root', { hasText: 'H toast 3' });
await rightHover.hover();
await sleep(500);
const rightSnap = (await snapshot()).filter((t) => t.position === 'right');
const rightScales = rightSnap.map((t) => {
	const m = t.transformProp.match(/scale\(([\d.]+)\)/) || t.transformProp.match(/matrix\(([\d.]+),/);
	return m ? parseFloat(m[1]) : 1;
});
ok('H6 right expand: scale 1, 3 toast render', rightSnap.length === 3 && rightScales.every((s) => s === 1), `scales=${rightScales.join(',')}`);
// Anchor right CHUNG (cùng giá trị) khi expand.
const rightAnchors = [...new Set(rightSnap.map((t) => t.anchor))];
ok('H6b right expand: anchor right chung', rightAnchors.length === 1, `anchors=${rightAnchors.join(',')}`);

// ── H7 — position top → expand xếp hàng DỌC (dịch +Y) ──
await page.evaluate(() => {
	window.dispatchEvent(new CustomEvent('toast-probe:clear'));
});
await sleep(300);
await fireStack(3, 'top');
await page
	.locator('.toast-root', { hasText: 'H toast 3' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(400);
const topHover = page.locator('.toast-root', { hasText: 'H toast 3' });
await topHover.hover();
await sleep(500);
const topSnap = (await snapshot()).filter((t) => t.position === 'top');
const topScales = topSnap.map((t) => {
	const m = t.transformProp.match(/scale\(([\d.]+)\)/) || t.transformProp.match(/matrix\(([\d.]+),/);
	return m ? parseFloat(m[1]) : 1;
});
ok('H7 top expand: scale 1, 3 toast render', topSnap.length === 3 && topScales.every((s) => s === 1), `scales=${topScales.join(',')}`);
const topAnchors = [...new Set(topSnap.map((t) => t.anchor))];
ok('H7b top expand: anchor top chung', topAnchors.length === 1, `anchors=${topAnchors.join(',')}`);

// ── H8 — stack (không hover): KHÔNG set inline top/bottom/left/right sai — anchor
// chung = offset cho cả nhóm (thuần transform stagger) ──
await page.evaluate(() => {
	window.dispatchEvent(new CustomEvent('toast-probe:clear'));
});
await sleep(300);
await fireStack(3, 'bottom');
await page
	.locator('.toast-root', { hasText: 'H toast 3' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(400);
const stackAnchors = bottomToasts(await snapshot()).map((t) => t.anchor);
const uniqAnchors = [...new Set(stackAnchors)];
ok(
	'H8 stack: anchor CHUNG (offset) cho cả nhóm — stagger qua transform',
	uniqAnchors.length === 1 && uniqAnchors[0]?.startsWith('bottom='),
	`anchors=${stackAnchors.join(',')}`
);

// ── H9 — reduced-motion → transition none ──
const rmPage = await context.newPage();
await rmPage.emulateMedia({ reducedMotion: 'reduce' });
await rmPage.goto('https://localhost:3000/ui/toast', { waitUntil: 'domcontentloaded' });
await rmPage.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 30000 });
await sleep(500);
await rmPage.evaluate(() => {
	window.dispatchEvent(new CustomEvent('toast-probe:fire', { detail: { n: 2, position: 'bottom' } }));
});
await rmPage
	.locator('.toast-root', { hasText: 'H toast 1' })
	.waitFor({ state: 'visible', timeout: 10000 });
await sleep(300);
const rmTransition = await rmPage.evaluate(() => {
	const r = document.querySelector('.toast-root');
	return r ? getComputedStyle(r).transitionDuration : null;
});
ok('H9 reduced-motion: transition none', rmTransition === '0s', `duration=${rmTransition}`);
await rmPage.close();

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
