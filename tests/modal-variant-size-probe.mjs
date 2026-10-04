// Modal variant (backdrop) + size (width panel) — request 2026-10-03:
//   V1  variant-blur (modal chính xl): .modal-root class variant-blur +
//       computed backdropFilter chứa blur(8px).
//   V2  variant-opaque (bottom-sheet): .modal-root backgroundColor
//       = rgba(0, 0, 0, 0.8), KHÔNG có backdrop-filter.
//   V3  variant-transparent (modal lồng): .modal-root.backgroundColor
//       = rgba(0, 0, 0, 0) (nền trong suốt).
//   Z   size → width panel đúng map (Container/Main.svelte):
//       sm 24rem · md 32rem · lg 40rem · xl 48rem · full 100vw−2rem
//       (border-radius 0, height = 100dvh−2rem).
// "Color" của modal = variant (Modal không có prop color riêng).
// Chạy: node tests/modal-variant-size-probe.mjs (dev: https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/modal';
const OUT = 'tests/screenshot/modal-refinements';
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const ctx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 800 },
	deviceScaleFactor: 1
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
// 1rem trong viewport probe (thường 16px) — dùng để quy đổi rem → px.
const remPx = await page.evaluate(
	() => parseFloat(getComputedStyle(document.documentElement).fontSize)
);
const VW = 1280;
const Dvh = 800;
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

// ── V1 + Z(xl): modal chính — variant blur, size xl ──
await page.getByRole('button', { name: 'Mở Modal', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);

const v1 = await page.evaluate(() => {
	const root = document.querySelector('.modal-root');
	const cont = document.querySelector('.modal-container-root.size-xl');
	const cs = getComputedStyle(root);
	return {
		variantCls: root?.classList.contains('variant-blur') ?? false,
		backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
		classes: root?.className ?? '',
		w: cont?.getBoundingClientRect().width ?? 0
	};
});
ok('V1  variant-blur: .modal-root có class variant-blur', v1.variantCls, `cls=${v1.classes}`);
ok('V1b variant-blur: backdropFilter = blur(8px)', /blur\(\s*8px\s*\)/.test(v1.backdropFilter), `bf=${v1.backdropFilter}`);
ok(
	'Z1  size-xl: width panel ≈ 48rem',
	near(v1.w, 48 * remPx),
	`w=${v1.w.toFixed(1)} expect≈${(48 * remPx).toFixed(1)}px`
);
await page.keyboard.press('Escape');
await page.waitForSelector('.modal-root', { state: 'detached', timeout: 5000 });
await page.waitForTimeout(300);

// ── V2 + Z(md): bottom-sheet — variant opaque, size md ──
await page.getByRole('button', { name: 'Mở Modal bottom', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);

const v2 = await page.evaluate(() => {
	const root = document.querySelector('.modal-root.variant-opaque');
	const cont = document.querySelector('.modal-container-root.size-md');
	const cs = getComputedStyle(root);
	return {
		found: !!root,
		bg: cs.backgroundColor,
		backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter,
		w: cont?.getBoundingClientRect().width ?? 0
	};
});
ok('V2  variant-opaque: .modal-root.backgroundColor = rgba(0,0,0,0.8)', v2.found && v2.bg === 'rgba(0, 0, 0, 0.8)', `bg=${v2.bg}`);
ok('V2b variant-opaque: KHÔNG có backdrop-filter', v2.found && /none/.test(v2.backdropFilter), `bf=${v2.backdropFilter}`);
ok('Z2  size-md: width panel ≈ 32rem', near(v2.w, 32 * remPx), `w=${v2.w.toFixed(1)} expect≈${(32 * remPx).toFixed(1)}px`);

await page.screenshot({ path: `${OUT}/08-variant-opaque.png` });
await page.keyboard.press('Escape');
await page.waitForSelector('.modal-root', { state: 'detached', timeout: 5000 });
await page.waitForTimeout(300);

// ── V3 + Z(lg): modal lồng — variant transparent (lớp top), size lg ──
await page.getByRole('button', { name: 'Mở Modal', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Mở Modal lồng', exact: true }).click();
await page.waitForTimeout(600); // chờ layer 2 (lg/transparent) portal mount

const v3 = await page.evaluate(() => {
	const roots = document.querySelectorAll('.modal-root');
	const transparent = [...roots].find((r) => r.classList.contains('variant-transparent'));
	const cont = document.querySelector('.modal-container-root.size-lg');
	const cs = transparent ? getComputedStyle(transparent) : null;
	return {
		rootCount: roots.length,
		found: !!transparent,
		bg: cs?.backgroundColor,
		w: cont?.getBoundingClientRect().width ?? 0
	};
});
ok('V3  modal lồng: 2 .modal-root đồng thời', v3.rootCount === 2, `count=${v3.rootCount}`);
ok(
	'V3b variant-transparent: .modal-root (lớp top) backgroundColor = rgba(0,0,0,0)',
	v3.found && v3.bg === 'rgba(0, 0, 0, 0)',
	`bg=${v3.bg}`
);
ok('Z3  size-lg: width panel ≈ 40rem', near(v3.w, 40 * remPx), `w=${v3.w.toFixed(1)} expect≈${(40 * remPx).toFixed(1)}px`);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await page.keyboard.press('Escape'); // đóng lớp 1 (xl)
await page.waitForSelector('.modal-root', { state: 'detached', timeout: 5000 });
await page.waitForTimeout(300);

// ── Z(sm): modal trần — size sm ──
await page.getByRole('button', { name: 'Mở Modal trần', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);
const v4 = await page.evaluate(() => {
	const cont = document.querySelector('.modal-container-root.size-sm');
	return { w: cont?.getBoundingClientRect().width ?? 0 };
});
ok('Z4  size-sm: width panel ≈ 24rem', near(v4.w, 24 * remPx), `w=${v4.w.toFixed(1)} expect≈${(24 * remPx).toFixed(1)}px`);
await page.keyboard.press('Escape');
await page.waitForSelector('.modal-root', { state: 'detached', timeout: 5000 });
await page.waitForTimeout(300);

// ── Z(full): size full — 100vw−2rem × 100dvh−2rem, border-radius 0 ──
await page.getByRole('button', { name: 'Mở Modal full', exact: true }).click();
await page.waitForSelector('.modal-container-root.size-full', { state: 'visible' });
await page.waitForTimeout(400);
const v5 = await page.evaluate(() => {
	const cont = document.querySelector('.modal-container-root.size-full');
	const cs = getComputedStyle(cont);
	const b = cont?.getBoundingClientRect();
	return { w: b?.width ?? 0, h: b?.height ?? 0, radius: cs.borderRadius, cls: cont?.classList.contains('size-full') ?? false };
});
ok('Z5  size-full: class size-full trên panel', v5.cls);
ok(
	'Z5b size-full: width ≈ 100vw − 2rem (padding backdrop)',
	near(v5.w, VW - 2 * remPx, 4),
	`w=${v5.w.toFixed(1)} expect≈${(VW - 2 * remPx).toFixed(1)}px`
);
ok(
	'Z5c size-full: height ≈ 100dvh − 2rem',
	near(v5.h, Dvh - 2 * remPx, 4),
	`h=${v5.h.toFixed(1)} expect≈${(Dvh - 2 * remPx).toFixed(1)}px`
);
ok('Z5d size-full: border-radius = 0', v5.radius === '0px', `radius=${v5.radius}`);

await page.screenshot({ path: `${OUT}/09-size-full.png` });
await page.keyboard.press('Escape');
await page.waitForSelector('.modal-root', { state: 'detached', timeout: 5000 });

await browser.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
