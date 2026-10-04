// tests/spinner-probe.mjs
// Verify Spinner (element) — state display thuần CSS, 4 pattern.
// Trang demo: /ui/spinner.
//
// Kiểm tra:
//  SP0 trang hiển thị + .spinner-root
//  SP1 mỗi pattern có class pattern-* + element con đúng (dots → 3 dots)
//  SP2 size → --spinner-size computed đúng px
//  SP3 có label → role="status" + text sr-only
//  SP4 không label → aria-hidden="true"
//  SP5 color class
//  SP6 reduced-motion: computed animation-name = 'none'
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

await page.goto('https://localhost:3000/ui/spinner', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.spinner-root', { timeout: 20000 });
await sleep(400);

// SP0 — structure
const rootCount = await page.locator('.spinner-root').count();
ok('SP0 .spinner-root render (>= 20)', rootCount >= 20, `count=${rootCount}`);

// SP1 — pattern class + children
const patterns = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="sp-pattern"]');
	const specs = [
		{ p: 'circle', child: '.spinner-ring', n: 1 },
		{ p: 'dots', child: '.spinner-dot', n: 3 },
		{ p: 'bars', child: '.spinner-bar', n: 3 },
		{ p: 'square', child: '.spinner-square', n: 1 }
	];
	return specs.map((s) => {
		const el = scope.querySelector(`.spinner-root.pattern-${s.p}`);
		const children = el ? el.querySelectorAll(s.child).length : -1;
		const arc = s.p === 'circle' ? (el ? el.querySelectorAll('.spinner-arc').length : -1) : null;
		return { p: s.p, hasClass: !!el, children, arc };
	});
});
ok('SP1 mỗi pattern có class pattern-* + đúng số element con', patterns.every((x) => x.hasClass && x.children >= 1), JSON.stringify(patterns));
const dots = patterns.find((x) => x.p === 'dots');
ok('SP1a dots → đúng 3 .spinner-dot', dots?.children === 3, `dots=${dots?.children}`);

// SP2 — size → --spinner-size
const sizes = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="sp-size"]');
	const out = {};
	for (const s of ['xs', 'sm', 'md', 'lg']) {
		const el = scope.querySelector(`.spinner-root.size-${s}`);
		out[s] = el ? getComputedStyle(el).getPropertyValue('--spinner-size').trim() : null;
	}
	return out;
});
ok('SP2 size → --spinner-size (14/18/24/32px)', sizes.xs === '14px' && sizes.sm === '18px' && sizes.md === '24px' && sizes.lg === '32px', JSON.stringify(sizes));

// SP3 — label → role=status + sr-only
const labeled = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="sp-label"]');
	const el = scope.querySelector('.spinner-root[role="status"]');
	const sr = el?.querySelector('.spinner-sr');
	return {
		role: !!el,
		srText: sr?.textContent?.trim() ?? null
	};
});
ok('SP3 có label → role="status" + text sr-only', labeled.role && !!labeled.srText, JSON.stringify(labeled));

// SP4 — không label → aria-hidden
const btnSpinner = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="sp-button"]');
	const el = scope.querySelector('.spinner-root');
	return {
		hidden: el?.getAttribute('aria-hidden'),
		role: el?.getAttribute('role')
	};
});
ok('SP4 trong button (không label) → aria-hidden="true" + không role', btnSpinner.hidden === 'true' && !btnSpinner.role, JSON.stringify(btnSpinner));

// SP5 — color class
const colorClass = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="sp-color"]');
	const found = {
		success: !!scope.querySelector('.spinner-root.color-success'),
		warning: !!scope.querySelector('.spinner-root.color-warning'),
		error: !!scope.querySelector('.spinner-root.color-error')
	};
	const primary = !!document.querySelector('[data-test="sp-pattern"] .spinner-root.color-primary');
	return { ...found, primary };
});
ok('SP5 color class (primary/success/warning/error)', Object.values(colorClass).every(Boolean), JSON.stringify(colorClass));

// SP6a — normal: animation đang chạy (animation-name khác none)
const normal = await page.evaluate(() => {
	const arc = document.querySelector('[data-test="sp-pattern"] .spinner-root.pattern-circle .spinner-arc');
	const dot = document.querySelector('[data-test="sp-pattern"] .spinner-root.pattern-dots .spinner-dot');
	const bar = document.querySelector('[data-test="sp-pattern"] .spinner-root.pattern-bars .spinner-bar');
	const sq = document.querySelector('[data-test="sp-pattern"] .spinner-root.pattern-square .spinner-square');
	return {
		arc: arc ? getComputedStyle(arc).animationName : null,
		dot: dot ? getComputedStyle(dot).animationName : null,
		bar: bar ? getComputedStyle(bar).animationName : null,
		sq: sq ? getComputedStyle(sq).animationName : null
	};
});
// Svelte hash keyframes (prefix s-xxx-), nên assert contains
ok('SP6a normal: animation-name đang chạy (arc/dot/bar/square)', normal.arc?.includes('spinner-rotate') && normal.dot?.includes('spinner-pulse') && normal.bar?.includes('spinner-bar-grow') && normal.sq?.includes('spinner-rotate') && normal.sq?.includes('spinner-fade'), JSON.stringify(normal));

// SP6 — reduced-motion → animation-name = none
await page.emulateMedia({ reducedMotion: 'reduce' });
await sleep(200);
const reduced = await page.evaluate(() => {
	const arc = document.querySelector('[data-test="sp-pattern"] .spinner-root.pattern-circle .spinner-arc');
	const square = document.querySelector('[data-test="sp-pattern"] .spinner-root.pattern-square .spinner-square');
	const dot = document.querySelector('[data-test="sp-pattern"] .spinner-root.pattern-dots .spinner-dot');
	const bar = document.querySelector('[data-test="sp-pattern"] .spinner-root.pattern-bars .spinner-bar');
	return {
		arc: arc ? getComputedStyle(arc).animationName : null,
		square: square ? getComputedStyle(square).animationName : null,
		dot: dot ? getComputedStyle(dot).animationName : null,
		bar: bar ? getComputedStyle(bar).animationName : null
	};
});
const noneAll = (v) => v === 'none';
ok("SP6 reduced-motion → animation-name='none' (arc/square/dot/bar)", noneAll(reduced.arc) && noneAll(reduced.square) && noneAll(reduced.dot) && noneAll(reduced.bar), JSON.stringify(reduced));
await page.emulateMedia({ reducedMotion: 'no-preference' });

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
