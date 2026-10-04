// tests/progress-probe.mjs
// Verify Progress (element) — state display (track + bar + indeterminate).
// Trang demo: /ui/progress.
//
// Kiểm tra:
//  PR0 root role=progressbar
//  PR1 aria-valuenow đúng value
//  PR2 bar width % ≈ value (computed width / track width, ±5%)
//  PR3 indeterminate → aria-busy + class is-indeterminate
//  PR4 showValue → text "NN%"
//  PR5 color class
//  PR6 size → --progress-height px
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

await page.goto('https://localhost:3000/ui/progress', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.progress-root', { timeout: 20000 });
await sleep(400);

// PR0 — structure
const rootCount = await page.locator('.progress-root').count();
const allRoles = await page.evaluate(() =>
	[...document.querySelectorAll('.progress-root')].every((el) => el.getAttribute('role') === 'progressbar')
);
ok('PR0 mọi .progress-root có role="progressbar"', rootCount >= 12 && allRoles, `count=${rootCount} rolesOk=${allRoles}`);

// PR1 — aria-valuenow đúng value (section pr-value)
const values = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pr-value"]');
	const els = [...scope.querySelectorAll('.progress-root')];
	const expected = ['0', '25', '50', '75', '100'];
	return els.slice(0, 5).map((el, i) => ({
		expect: expected[i],
		got: el.getAttribute('aria-valuenow'),
		max: el.getAttribute('aria-valuemax'),
		min: el.getAttribute('aria-valuemin')
	}));
});
ok('PR1 aria-valuenow đúng value (0/25/50/75/100, min=0 max=100)', values.every((v) => v.got === v.expect && v.max === '100' && v.min === '0'), JSON.stringify(values));

// PR2 — bar width % ≈ value (section pr-value)
const widths = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pr-value"]');
	const els = [...scope.querySelectorAll('.progress-root')].slice(0, 5);
	const expected = [0, 25, 50, 75, 100];
	return els.map((el, i) => {
		const track = el.querySelector('.progress-track');
		const bar = el.querySelector('.progress-bar');
		const tw = track.getBoundingClientRect().width;
		const bw = bar.getBoundingClientRect().width;
		return { expect: expected[i], got: tw > 0 ? (bw / tw) * 100 : null };
	});
});
ok('PR2 bar width % ≈ value (±5%)', widths.every((w) => w.got != null && Math.abs(w.got - w.expect) <= 5), JSON.stringify(widths));

// PR3 — indeterminate
const indet = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pr-indet"]');
	const el = scope.querySelector('.progress-root.is-indeterminate');
	return {
		class: !!el,
		busy: el?.getAttribute('aria-busy'),
		now: el?.getAttribute('aria-valuenow'),
		trackWidth: el ? getComputedStyle(el.querySelector('.progress-bar')).width : null
	};
});
ok('PR3 indeterminate → aria-busy="true" + class is-indeterminate + không valuenow', indet.class && indet.busy === 'true' && indet.now == null, JSON.stringify(indet));

// PR4 — showValue → text "65%"
const showValue = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pr-showvalue"]');
	const el = scope.querySelector('.progress-root');
	const txt = el?.querySelector('.progress-value')?.textContent?.trim();
	return { txt, label: el?.getAttribute('aria-label') };
});
ok('PR4 showValue → text "65%"', showValue.txt === '65%', JSON.stringify(showValue));

// PR5 — color class
const colorClass = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pr-color"]');
	return {
		primary: !!document.querySelector('[data-test="pr-value"] .progress-root.color-primary'),
		success: !!scope.querySelector('.progress-root.color-success'),
		warning: !!scope.querySelector('.progress-root.color-warning'),
		error: !!scope.querySelector('.progress-root.color-error')
	};
});
ok('PR5 color class (primary/success/warning/error)', Object.values(colorClass).every(Boolean), JSON.stringify(colorClass));

// PR6 — size → --progress-height
const sizes = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="pr-size"]');
	const out = {};
	for (const s of ['xs', 'sm', 'md', 'lg']) {
		const el = scope.querySelector(`.progress-root.size-${s}`);
		out[s] = el ? getComputedStyle(el).getPropertyValue('--progress-height').trim() : null;
	}
	return out;
});
ok('PR6 size → --progress-height (4/6/8/10px)', sizes.xs === '4px' && sizes.sm === '6px' && sizes.md === '8px' && sizes.lg === '10px', JSON.stringify(sizes));

// PR7a — normal: indeterminate animation đang chạy
const normalIndet = await page.evaluate(() => {
	const ibar = document.querySelector('[data-test="pr-indet"] .progress-root.is-indeterminate .progress-bar');
	return { anim: ibar ? getComputedStyle(ibar).animationName : null };
});
ok('PR7a normal: indeterminate animation đang chạy', normalIndet.anim?.includes('progress-slide'), JSON.stringify(normalIndet));

// PR7 — reduced-motion: transition tắt + indeterminate animation none
await page.emulateMedia({ reducedMotion: 'reduce' });
await sleep(200);
const reduced = await page.evaluate(() => {
	const bar = document.querySelector('[data-test="pr-value"] .progress-root .progress-bar');
	const ibar = document.querySelector('[data-test="pr-indet"] .progress-root.is-indeterminate .progress-bar');
	return {
		transition: bar ? getComputedStyle(bar).transitionDuration : null,
		indetAnim: ibar ? getComputedStyle(ibar).animationName : null,
		indetOpacity: ibar ? getComputedStyle(ibar).opacity : null
	};
});
ok('PR7 reduced-motion → transition 0s + indeterminate animation none (opacity 0.6)', reduced.transition === '0s' && reduced.indetAnim === 'none' && reduced.indetOpacity === '0.6', JSON.stringify(reduced));

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
