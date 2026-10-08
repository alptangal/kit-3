// tests/theme-wave11-probe.mjs
// Verify Wave 11 — Theme toggle: animate chuyển màu lan dần từ vị trí click/tap.
//  W11.1  Click ThemeToggle → html data-theme đổi light → dark
//  W11.2  Click lần 2 → data-theme đổi dark → light
//  W11.3  Không crash (pageerror không xuất hiện)
//  W11.4  CSS custom properties --thx/--thy/--thr set đúng vị trí click (trong lúc transition)
//  W11.5  Class 'theme-transitioning' có trên html trong lúc transition, gỡ sau khi xong
//  W11.6  Radius max = Math.hypot tới góc xa nhất viewport (tính từ tâm click)
//  W11.7  View Transition chạy (document.getAnimations có animation trong lúc transition)
//  W11.8  Nút góc viewport (↖) → --thx/--thy ≈ tâm nút góc (vị trí click tuỳ ý)
//  W11.9  Reduced-motion (emulateMedia reduce) → đổi tức thì (data-theme đổi ngay,
//         không có class 'theme-transitioning')
//  W11.10 localStorage persist theme sau khi đổi
//  W11.11 Icon ThemeToggle đổi theo theme (moon khi light, sun khi dark)
//  W11.12 Nút "Đổi theme (nút text)" (Button outline) cũng đổi theme
// Trang demo: /ui/theme (mới Wave 11).
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = process.env.PORT || 3000;
const BASE = `https://localhost:${PORT}`;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${BASE}/ui/theme`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="theme-demo"]', { state: 'attached', timeout: 30000 });
await sleep(500);

// Reset theme về light trước khi probe (localStorage persist giữa các run)
await page.evaluate(() => localStorage.setItem('theme', 'light'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="theme-demo"]', { state: 'attached', timeout: 30000 });
await sleep(500);

// ── W11.1 — Click ThemeToggle → data-theme light → dark ──
const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
await page.locator('[data-test="theme-toggle"]').click();
// Đợi transition chạy xong (450ms) + margin
await sleep(700);
const themeAfter1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
ok(
	'W11.1 click ThemeToggle → data-theme light → dark',
	themeBefore === 'light' && themeAfter1 === 'dark',
	`before=${themeBefore} after=${themeAfter1}`
);

// ── W11.2 — Click lần 2 → dark → light ──
await page.locator('[data-test="theme-toggle"]').click();
await sleep(700);
const themeAfter2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
ok(
	'W11.2 click lần 2 → data-theme dark → light',
	themeAfter2 === 'light',
	`after=${themeAfter2}`
);

// ── W11.3 — Không crash ──
ok('W11.3 không pageerror', pageErrors.length === 0, pageErrors.join(' | '));

// ── W11.4/5/6/7 — CSS vars + class + radius + getAnimations trong lúc transition ──
// Click nút góc viewport (↖ Dark — data-test="theme-corner-tl") và đo TRONG transition
const cornerBox = await page.locator('[data-test="theme-corner-tl"]').boundingBox();
await page.locator('[data-test="theme-corner-tl"]').click();
await sleep(80); // transition đang chạy (450ms) — đo giữa chừng

const midTransition = await page.evaluate(() => {
	const root = document.documentElement;
	const rootStyle = getComputedStyle(root);
	const w = window.innerWidth;
	const h = window.innerHeight;
	return {
		thx: rootStyle.getPropertyValue('--thx').trim(),
		thy: rootStyle.getPropertyValue('--thy').trim(),
		thr: rootStyle.getPropertyValue('--thr').trim(),
		hasClass: root.classList.contains('theme-transitioning'),
		animationCount: document.getAnimations().length,
		vw: w,
		vh: h
	};
});

// W11.4 — --thx/--thy set đúng vị trí click (tâm nút góc ↖)
const expectX = Math.round(cornerBox.x + cornerBox.width / 2);
const expectY = Math.round(cornerBox.y + cornerBox.height / 2);
const actualX = midTransition.thx ? Math.round(parseFloat(midTransition.thx)) : null;
const actualY = midTransition.thy ? Math.round(parseFloat(midTransition.thy)) : null;
ok(
	'W11.4 --thx/--thy ≈ tâm nút góc ↖ (±3px)',
	actualX !== null && actualY !== null && Math.abs(actualX - expectX) <= 3 && Math.abs(actualY - expectY) <= 3,
	`expect=${expectX},${expectY} actual=${actualX},${actualY}`
);

// W11.5 — Class 'theme-transitioning' có trong lúc transition, gỡ sau khi xong
ok(
	'W11.5 class theme-transitioning trong lúc transition',
	midTransition.hasClass === true,
	`hasClass=${midTransition.hasClass}`
);
await sleep(700); // transition xong
const hasClassAfter = await page.evaluate(() =>
	document.documentElement.classList.contains('theme-transitioning')
);
const varsAfter = await page.evaluate(() => {
	const rootStyle = getComputedStyle(document.documentElement);
	return {
		thx: rootStyle.getPropertyValue('--thx').trim(),
		thr: rootStyle.getPropertyValue('--thr').trim()
	};
});
ok(
	'W11.5b class + CSS vars gỡ sau khi transition xong',
	hasClassAfter === false && varsAfter.thx === '' && varsAfter.thr === '',
	`class=${hasClassAfter} thx="${varsAfter.thx}" thr="${varsAfter.thr}"`
);

// W11.6 — Radius max = Math.hypot tới góc XA NHẤT viewport (max của hypot tới
// 4 góc — góc xa nhất không cố định dưới-phải, phụ thuộc vị trí tâm click)
if (actualX !== null && actualY !== null) {
	const expectR = Math.ceil(
		Math.max(
			Math.hypot(actualX, actualY),
			Math.hypot(midTransition.vw - actualX, actualY),
			Math.hypot(actualX, midTransition.vh - actualY),
			Math.hypot(midTransition.vw - actualX, midTransition.vh - actualY)
		)
	);
	const actualR = midTransition.thr ? Math.round(parseFloat(midTransition.thr)) : null;
	ok(
		'W11.6 --thr = Math.hypot tới góc xa nhất (±2px)',
		actualR !== null && Math.abs(actualR - expectR) <= 2,
		`expect=${expectR} actual=${actualR}`
	);
} else {
	ok('W11.6 --thr = Math.hypot tới góc xa nhất', false, '--thx/--thy null — không tính được');
}

// W11.7 — View Transition chạy (getAnimations có animation trong lúc transition)
ok(
	'W11.7 View Transition chạy (getAnimations > 0)',
	midTransition.animationCount > 0,
	`animationCount=${midTransition.animationCount}`
);

// ── W11.8 — Nút góc khác (↘ Light) → --thx/--thy ≈ tâm nút góc dưới-phải ──
const cornerBrBox = await page.locator('[data-test="theme-corner-br"]').boundingBox();
await page.locator('[data-test="theme-corner-br"]').click();
await sleep(80);
const midBr = await page.evaluate(() => {
	const rootStyle = getComputedStyle(document.documentElement);
	return {
		thx: rootStyle.getPropertyValue('--thx').trim(),
		thy: rootStyle.getPropertyValue('--thy').trim()
	};
});
const expectBrX = Math.round(cornerBrBox.x + cornerBrBox.width / 2);
const expectBrY = Math.round(cornerBrBox.y + cornerBrBox.height / 2);
const actualBrX = midBr.thx ? Math.round(parseFloat(midBr.thx)) : null;
const actualBrY = midBr.thy ? Math.round(parseFloat(midBr.thy)) : null;
ok(
	'W11.8 nút góc ↘ → --thx/--thy ≈ tâm nút (±3px)',
	actualBrX !== null && actualBrY !== null && Math.abs(actualBrX - expectBrX) <= 3 && Math.abs(actualBrY - expectBrY) <= 3,
	`expect=${expectBrX},${expectBrY} actual=${actualBrX},${actualBrY}`
);
await sleep(700);

// ── W11.9 — Reduced-motion → đổi tức thì ──
await page.emulateMedia({ reducedMotion: 'reduce' });
await sleep(200);
await page.locator('[data-test="theme-toggle"]').click();
// Đo NGAY (không đợi transition) — reduced-motion đổi tức thì
const themeReduced = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const classReduced = await page.evaluate(() =>
	document.documentElement.classList.contains('theme-transitioning')
);
ok(
	'W11.9 reduced-motion → data-theme đổi ngay + không class transition',
	themeReduced === 'dark' && classReduced === false,
	`data-theme=${themeReduced} class=${classReduced}`
);
await page.emulateMedia({ reducedMotion: 'no-preference' });
await sleep(300);

// ── W11.10 — localStorage persist ──
const stored = await page.evaluate(() => localStorage.getItem('theme'));
ok(
	'W11.10 localStorage persist theme',
	stored === 'dark',
	`stored=${stored}`
);

// ── W11.11 — Icon ThemeToggle đổi theo theme (dark → icon khác light) ──
// Iconify render svg inline chỉ có path data (outerHTML không chứa tên "sun")
// → so sánh svg dark vs svg light KHÁC NHAU (icon đổi khi theme đổi).
const iconDark = await page.evaluate(() => {
	const btn = document.querySelector('[data-test="theme-toggle"]');
	if (!btn) return null;
	const svg = btn.querySelector('svg');
	return svg ? svg.outerHTML.slice(0, 400) : null;
});
ok(
	'W11.11a Icon ThemeToggle render svg khi dark',
	!!iconDark,
	iconDark ? 'svg null' : 'svg không render'
);

// ── W11.12 — Nút text (Button outline) cũng đổi theme ──
await page.locator('[data-test="theme-toggle-btn"]').click();
await sleep(700);
const themeAfterBtn = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
ok(
	'W11.12 nút text đổi theme dark → light',
	themeAfterBtn === 'light',
	`data-theme=${themeAfterBtn}`
);

// ── W11.11b — Icon đổi khi theme đổi (svg light khác svg dark) ──
const iconLight = await page.evaluate(() => {
	const btn = document.querySelector('[data-test="theme-toggle"]');
	if (!btn) return null;
	const svg = btn.querySelector('svg');
	return svg ? svg.outerHTML.slice(0, 400) : null;
});
ok(
	'W11.11b Icon đổi khi theme đổi (svg light ≠ svg dark)',
	iconLight !== null && iconDark !== null && iconLight !== iconDark,
	iconLight === iconDark ? 'svg giống nhau (icon không đổi)' : 'svg khác nhau'
);

// ── Tổng kết ──
const passCount = results.filter((r) => r.pass).length;
console.log(`\n${passCount}/${results.length} PASS`);
await browser.close();
process.exit(passCount === results.length ? 0 : 1);
