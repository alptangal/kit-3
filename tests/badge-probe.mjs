// tests/badge-probe.mjs
// Verify Badge (element) — pill/chip: variant × color, dot, icon, size, as="a"/"button".
// Trang demo: /ui/badge
//
// Kiểm tra:
//  B0 trang hiển thị + .badge-root
//  B1 class variant-soft + color-primary (default) + size-sm
//  B2 dot → có element .badge-dot (visible, ~6px, nền = màu --color)
//  B3 as="a" → render <a> với href
//  B4 class prop: thêm class riêng + giữ default (styleSynced)
//  B5 size-sm → class size-sm
//  B6 as="button" → <button type="button">
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

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
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/badge', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.badge-root', { timeout: 20000 });
await sleep(400);

// B0 — structure
const badgeCount = await page.locator('.badge-root').count();
ok('B0 trang /ui/badge render + nhiều .badge-root', badgeCount >= 10, `count=${badgeCount}`);

// B1 — default classes (soft / primary / sm)
const b1 = await page.locator('[data-test="bd-default"] .badge-root').first().evaluate((el) => ({
	cls: el.className,
	tag: el.tagName
}));
ok(
	'B1 default: span + variant-soft + color-primary + size-sm',
	b1.tag === 'SPAN' && b1.cls.includes('variant-soft') && b1.cls.includes('color-primary') && b1.cls.includes('size-sm'),
	JSON.stringify(b1)
);

// B2 — dot
const b2 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="bd-dot"]');
	if (!scope) return null;
	const withDot = [...scope.querySelectorAll('.badge-root.has-dot')];
	const first = withDot[0];
	const dot = first?.querySelector('.badge-dot');
	if (!first || !dot) return { withDotCount: withDot.length, dot: false };
	const cs = getComputedStyle(dot);
	const rootCs = getComputedStyle(first);
	return {
		withDotCount: withDot.length,
		dot: true,
		dotBg: cs.backgroundColor,
		rootColor: rootCs.color,
		dotVisible: cs.display !== 'none' && cs.width !== '0px'
	};
});
ok(
	'B2 dot: element .badge-dot hiện, nền = currentColor (--color)',
	b2 && b2.withDotCount >= 3 && b2.dot && b2.dotVisible && b2.dotBg === b2.rootColor,
	JSON.stringify(b2)
);

// B3 — as="a" → <a href>
const b3 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="bd-link"]');
	if (!scope) return null;
	const a = scope.querySelector('.badge-root[href]');
	if (!a) return { found: false };
	return { found: true, tag: a.tagName, href: a.getAttribute('href') };
});
ok('B3 as="a" → <a> với href', b3 && b3.found && b3.tag === 'A' && !!b3.href, JSON.stringify(b3));

// B6 — as="button" → <button type="button">
const b6 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="bd-link"]');
	if (!scope) return null;
	const btn = scope.querySelector('button.badge-root');
	if (!btn) return { found: false };
	return { found: true, tag: btn.tagName, type: btn.getAttribute('type') };
});
ok('B6 as="button" → <button type="button">', b6 && b6.found && b6.tag === 'BUTTON' && b6.type === 'button', JSON.stringify(b6));

// B4 — class prop (styleSynced: class riêng + default vẫn giữ)
const b4 = await page.evaluate(() => {
	const el = document.querySelector('[data-test="bd-class"]');
	if (!el) return { found: false };
	return { found: true, cls: el.className };
});
ok(
	'B4 class prop: "bd-custom" + default (badge-root variant-soft color-info size-sm) giữ nguyên',
	b4.found && b4.cls.includes('bd-custom') && b4.cls.includes('badge-root') && b4.cls.includes('variant-soft') && b4.cls.includes('color-info') && b4.cls.includes('size-sm'),
	JSON.stringify(b4)
);

// B5 — size
const b5 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="bd-size"]');
	if (!scope) return null;
	const sizes = [...scope.querySelectorAll('.badge-root')].map((el) =>
		[...el.classList].find((c) => c.startsWith('size-'))
	);
	const xs = scope.querySelector('.size-xs');
	const md = scope.querySelector('.size-md');
	return { sizes, xs: !!xs, md: !!md };
});
ok('B5 size: class size-xs / size-sm / size-md theo prop', b5 && b5.xs && b5.md && b5.sizes.every((s) => s), JSON.stringify(b5));

// icon (iconify fetch async ~1-4s; guard try/catch, offline → WARN không FAIL giả)
try {
	await page.waitForSelector('[data-test="bd-dot"] .badge-icon svg', { timeout: 15000 });
	const iconCount = await page.locator('[data-test="bd-dot"] .badge-icon svg').count();
	ok('B7 icon: iconify render svg trong .badge-icon', iconCount >= 2, `count=${iconCount}`);
} catch {
	console.log('WARN  B7 icon: iconify chưa fetch được (offline?) — bỏ qua, không FAIL giả');
}

// Screenshot
await page.waitForSelector('[data-test="bd-dot"] .badge-icon svg', { timeout: 5000 }).catch(() => {});
await sleep(400);
const shotDir = 'tests/screenshot/badge';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="badge-demo"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${shotDir}/01-badge-matrix.png` });
console.log(`Screenshot: ${shotDir}/01-badge-matrix.png`);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
