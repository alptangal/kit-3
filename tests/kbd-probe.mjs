// tests/kbd-probe.mjs
// Verify Kbd (element) — phím tắt (<kbd>) + Kbd.Combo (separator "&" CSS ::before).
// Trang demo: /ui/kbd
//
// Kiểm tra:
//  K0 trang hiển thị + .kbd-root
//  K1 render tag <kbd> (semantic)
//  K2 combo: 3 <kbd> con + separator "&" (::before, CSS-only) + aria-label tổng hợp
//  K3 variant outline → class variant-outline (nền trong suốt, chỉ viền)
//  K4 size → class size-*
//  K5 single → class is-single (trong .kbd-combo)
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

await page.goto('https://localhost:3000/ui/kbd', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.kbd-root', { timeout: 20000 });
await sleep(400);

// K0 — structure
const kbdCount = await page.locator('.kbd-root').count();
ok('K0 trang /ui/kbd render + nhiều .kbd-root', kbdCount >= 10, `count=${kbdCount}`);

// K1 — <kbd> tag
const k1 = await page.locator('[data-test="kb-single"] .kbd-root').first().evaluate((el) => ({
	tag: el.tagName,
	cls: el.className,
	text: el.textContent?.trim()
}));
ok('K1 render <kbd> (tag KBD) + class kbd-root', k1.tag === 'KBD' && k1.cls.includes('kbd-root') && k1.cls.includes('variant-default'), JSON.stringify(k1));

// K2 — combo: 3 kbd + separator "&" (::before) + aria-label
const k2 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="kb-combo-mac"]');
	if (!scope) return null;
	const keys = [...scope.querySelectorAll('.kbd-root')];
	const cs = (el) => getComputedStyle(el, '::before');
	return {
		ariaLabel: scope.getAttribute('aria-label'),
		keys: keys.length,
		sep2: cs(keys[1])?.content,
		sep3: cs(keys[2])?.content,
		sep1: cs(keys[0])?.content,
		keysText: keys.map((k) => k.textContent?.trim())
	};
});
ok(
	'K2 combo: 3 <kbd> + separator "&" trên key 2,3 (không có trên key 1) + aria-label "Command Shift K"',
	k2 &&
		k2.keys === 3 &&
		k2.sep2 === '"&"' &&
		k2.sep3 === '"&"' &&
		['none', '""', "''"].includes(k2.sep1) &&
		k2.ariaLabel === 'Command Shift K' &&
		k2.keysText.join(' ') === '⌘ ⇧ K',
	JSON.stringify(k2)
);

// K3 — variant outline
const k3 = await page.evaluate(() => {
	const el = document.querySelector('[data-test="kb-variant"] .variant-outline');
	if (!el) return { found: false };
	const cs = getComputedStyle(el);
	return { found: true, cls: el.className, bg: cs.backgroundColor, border: cs.borderColor };
});
ok(
	'K3 variant-outline: class variant-outline + nền trong suốt + có viền',
	k3.found && k3.bg === 'rgba(0, 0, 0, 0)' && k3.border !== 'rgba(0, 0, 0, 0)',
	JSON.stringify(k3)
);

// K4 — size
const k4 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="kb-size"]');
	if (!scope) return null;
	const sizes = [...scope.querySelectorAll('.kbd-root')].map((el) =>
		[...el.classList].find((c) => c.startsWith('size-'))
	);
	return { sizes };
});
ok(
	'K4 size: class size-xs / size-sm / size-md theo prop',
	k4 && k4.sizes.includes('size-xs') && k4.sizes.includes('size-sm') && k4.sizes.includes('size-md'),
	JSON.stringify(k4)
);

// K5 — single → is-single (trong .kbd-combo)
const k5 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="kb-combo"]');
	if (!scope) return null;
	const keys = [...scope.querySelectorAll('.kbd-root')];
	return {
		allSingle: keys.length > 0 && keys.every((k) => k.classList.contains('is-single')),
		count: keys.length
	};
});
ok('K5 single: mọi <kbd> trong .kbd-combo đều có class is-single', k5 && k5.allSingle && k5.count >= 5, JSON.stringify(k5));

// default single key (không combo) KHÔNG được có is-single
const k5b = await page.evaluate(() => {
	const el = document.querySelector('[data-test="kb-single"] .kbd-root');
	return { found: !!el, cls: el?.className ?? '' };
});
ok('K5b phím đơn (không single prop) không có is-single', k5b.found && !k5b.cls.includes('is-single'), JSON.stringify(k5b));

// Screenshot
await sleep(400);
const shotDir = 'tests/screenshot/kbd';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="kbd-demo"]').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${shotDir}/01-kbd-combo.png` });
console.log(`Screenshot: ${shotDir}/01-kbd-combo.png`);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
