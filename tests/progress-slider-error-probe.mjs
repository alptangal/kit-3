// Probe: Progress (sizes 2xs-full + 4 variants + valueInside) + Slider (sizes + 4 variants)
// + ErrorPage (matrix cells + status color + message + route demo /ui/error?status=).
// CSS-driven visual → probe verify class gán đúng + DOM measurement (height/matrix count).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const BASE = process.env.PROBE_BASE ?? 'https://localhost:3000';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync('tests/screenshots/progress-slider-error', { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	viewport: { width: 1280, height: 900 },
	ignoreHTTPSErrors: true
});
const page = await context.newPage();

// ═══════════════════════════════════════════════════════════════
// PROGRESS — /ui/progress
// ═══════════════════════════════════════════════════════════════
await page.goto(`${BASE}/ui/progress`, { waitUntil: 'domcontentloaded' });
await sleep(1200);

// ── PG1: Section sizes — 8 size class gán đúng + height scale ──
const pgSizes = await page.evaluate(() => {
	const section = document.querySelector('[data-test="pr-size"]');
	const roots = [...section.querySelectorAll('.progress-root')];
	return roots.map((r) => ({
		class: r.className,
		trackH: r.querySelector('.progress-track')?.getBoundingClientRect().height ?? 0
	}));
});
ok('PG1a: pr-size có 8 progress-root', pgSizes.length === 8, `count=${pgSizes.length}`);
const expectedSizes = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
let allSizeCls = true;
for (const s of expectedSizes) {
	if (!pgSizes.some((r) => r.class.includes(`size-${s}`))) allSizeCls = false;
}
ok('PG1b: đủ 8 size class (2xs→3xl)', allSizeCls, pgSizes.map((r) => r.class.split(' ').find((c) => c.startsWith('size-'))).join(','));
// Height tăng dần theo size (2xs=2px < 3xl=16px)
const h2xs = pgSizes.find((r) => r.class.includes('size-2xs'))?.trackH ?? 0;
const h3xl = pgSizes.find((r) => r.class.includes('size-3xl'))?.trackH ?? 0;
ok('PG1c: track height 2xs < 3xl (scale)', h2xs < h3xl, `2xs=${h2xs.toFixed(1)}px 3xl=${h3xl.toFixed(1)}px`);
ok('PG1d: track height tăng đều (sm>2xs, lg>md)',
	(pgSizes.find((r) => r.class.includes('size-sm'))?.trackH ?? 0) > h2xs &&
	(pgSizes.find((r) => r.class.includes('size-lg'))?.trackH ?? 0) > (pgSizes.find((r) => r.class.includes('size-md'))?.trackH ?? 0));

// ── PG1.5: Section color — 4 màu khác nhau (bẫy regression: thiếu @use colors.scss
//    → class color-warning/color-primary không set --color → bar fallback --primary,
//    warning trông y hệt primary. ui-checker bắt được, probe khóa lại.) ──
const pgColors = await page.evaluate(() => {
	const section = document.querySelector('[data-test="pr-color"]');
	const roots = [...section.querySelectorAll('.progress-root')];
	// Đọc computed --color trên root (hsl) + rgb resolve qua probe element
	const probe = document.createElement('span');
	probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--color)';
	return roots.map((r) => {
		probe.style.cssText = `position:absolute;visibility:hidden;color:var(--color)`;
		r.appendChild(probe);
		const rgb = getComputedStyle(probe).color;
		probe.remove();
		const barBg = getComputedStyle(r.querySelector('.progress-bar')).backgroundColor;
		return { cls: r.className.split(' ').find((c) => c.startsWith('color-')), rgb, barBg };
	});
});
ok('PG1.5a: 4 thanh color có class color-*', pgColors.every((c) => c.cls), pgColors.map((c) => c.cls).join(','));
ok('PG1.5b: 4 màu bar khác nhau (không dedup)', new Set(pgColors.map((c) => c.barBg)).size === 4, pgColors.map((c) => c.barBg).join(' | '));
const warn = pgColors.find((c) => c.cls === 'color-warning');
const prim = pgColors.find((c) => c.cls === 'color-primary');
ok('PG1.5c: color-warning ≠ color-primary (bẫy fallback --primary)', warn?.rgb && prim?.rgb && warn.rgb !== prim.rgb, `warning=${warn?.rgb} primary=${prim?.rgb}`);

// ── PG2: Section variants — 4 variant class gán đúng ──
const pgVariants = await page.evaluate(() => {
	const section = document.querySelector('[data-test="pr-variant"]');
	return [...section.querySelectorAll('.progress-root')].map((r) => r.className);
});
ok('PG2a: pr-variant có 4 progress-root', pgVariants.length === 4, `count=${pgVariants.length}`);
for (const v of ['solid', 'soft', 'outline', 'ghost']) {
	ok(`PG2: variant-${v} class gán đúng`, pgVariants.some((c) => c.includes(`variant-${v}`)));
}
// outline: track có border 1px (border-width khác solid)
const pgOutlineBorder = await page.evaluate(() => {
	const section = document.querySelector('[data-test="pr-variant"]');
	const outline = [...section.querySelectorAll('.progress-root')].find((r) => r.className.includes('variant-outline'));
	return getComputedStyle(outline.querySelector('.progress-track')).borderTopWidth;
});
ok('PG2e: outline track có border (>=1px)', parseFloat(pgOutlineBorder) >= 1, `border=${pgOutlineBorder}`);

// ── PG3: Section value-inside — text nằm trong track, right-align theo bar ──
const pgInside = await page.evaluate(() => {
	const section = document.querySelector('[data-test="pr-value-inside"]');
	const roots = [...section.querySelectorAll('.progress-root')];
	return roots.map((r) => {
		const inside = r.querySelector('.progress-value-inside');
		const track = r.querySelector('.progress-track');
		const bar = r.querySelector('.progress-bar');
		const trackRect = track.getBoundingClientRect();
		const insideRect = inside.getBoundingClientRect();
		const barRect = bar.getBoundingClientRect();
		return {
			hasInside: !!inside,
			insideInTrack: insideRect.left >= trackRect.left - 1 && insideRect.right <= trackRect.right + 2,
			// text nằm cạnh mép phải bar (right của text ≈ right của bar, tolerance 20px)
			rightAlignBar: Math.abs(insideRect.right - barRect.right) < 24,
			text: inside?.textContent ?? ''
		};
	});
});
ok('PG3a: pr-value-inside có 4 root', pgInside.length === 4, `count=${pgInside.length}`);
ok('PG3b: tất cả có .progress-value-inside', pgInside.every((r) => r.hasInside));
ok('PG3c: text inside nằm TRONG track', pgInside.every((r) => r.insideInTrack), JSON.stringify(pgInside.map((r) => r.insideInTrack)));
ok('PG3d: text canh phải mép bar', pgInside.every((r) => r.rightAlignBar), JSON.stringify(pgInside.map((r) => r.rightAlignBar)));
// root có class has-value-inside
const pgInsideCls = await page.evaluate(() => {
	const section = document.querySelector('[data-test="pr-value-inside"]');
	return [...section.querySelectorAll('.progress-root')].every((r) => r.className.includes('has-value-inside'));
});
ok('PG3e: root có class has-value-inside', pgInsideCls);

// Screenshot progress
await page.locator('[data-test="progress-demo"]').screenshot({ path: 'tests/screenshots/progress-slider-error/progress-full.png' });
console.log('Screenshot: progress-full.png');

// ═══════════════════════════════════════════════════════════════
// SLIDER — /ui/slider
// ═══════════════════════════════════════════════════════════════
await page.goto(`${BASE}/ui/slider`, { waitUntil: 'domcontentloaded' });
await sleep(1200);

// ── SL1: Section sizes — 5 size (2xs/sm/md/lg/2xl) + track height scale ──
const slSizes = await page.evaluate(() => {
	const section = document.querySelector('[data-test="sl-sizes"]');
	const roots = [...section.querySelectorAll('.slider-root')];
	return roots.map((r) => ({
		class: r.className,
		trackH: r.querySelector('.slider-track')?.getBoundingClientRect().height ?? 0
	}));
});
ok('SL1a: sl-sizes có 5 slider-root', slSizes.length === 5, `count=${slSizes.length}`);
for (const s of ['2xs', 'sm', 'md', 'lg', '2xl']) {
	ok(`SL1: size-${s} class gán đúng`, slSizes.some((r) => r.class.includes(`size-${s}`)));
}
const slH2xs = slSizes.find((r) => r.class.includes('size-2xs'))?.trackH ?? 0;
const slH2xl = slSizes.find((r) => r.class.includes('size-2xl'))?.trackH ?? 0;
ok('SL1e: track height 2xs < 2xl (scale)', slH2xs < slH2xl, `2xs=${slH2xs.toFixed(1)}px 2xl=${slH2xl.toFixed(1)}px`);

// ── SL2: Section variants — 4 variant class gán đúng + fill opacity ──
const slVariants = await page.evaluate(() => {
	const section = document.querySelector('[data-test="sl-variants"]');
	return [...section.querySelectorAll('.slider-root')].map((r) => r.className);
});
ok('SL2a: sl-variants có 4 slider-root', slVariants.length === 4, `count=${slVariants.length}`);
for (const v of ['solid', 'soft', 'outline', 'ghost']) {
	ok(`SL2: variant-${v} class gán đúng`, slVariants.some((c) => c.includes(`variant-${v}`)));
}
// soft: fill opacity < 1; outline: track có border
const slSoftOpacity = await page.evaluate(() => {
	const section = document.querySelector('[data-test="sl-variants"]');
	const soft = [...section.querySelectorAll('.slider-root')].find((r) => r.className.includes('variant-soft'));
	return getComputedStyle(soft.querySelector('.slider-fill')).opacity;
});
ok('SL2e: soft fill opacity < 1 (nền nhạt)', parseFloat(slSoftOpacity) < 1, `opacity=${slSoftOpacity}`);
const slOutlineBorder = await page.evaluate(() => {
	const section = document.querySelector('[data-test="sl-variants"]');
	const outline = [...section.querySelectorAll('.slider-root')].find((r) => r.className.includes('variant-outline'));
	return getComputedStyle(outline.querySelector('.slider-track')).borderTopWidth;
});
ok('SL2f: outline track có border (>=1px)', parseFloat(slOutlineBorder) >= 1, `border=${slOutlineBorder}`);

// ── SL3: Validation override variant — sl-minmax kéo ra error → class color-error (variant ép solid) ──
const sl3root = page.locator('[data-test="sl-minmax"] .slider-root');
await sl3root.locator('input[type="range"]').click();
await page.keyboard.press('Home'); // value → min (0) < minValue 20 → error
await sleep(500);
const sl3cls = await sl3root.first().getAttribute('class');
ok('SL3a: kéo Home → color-error (validation auto)', (sl3cls ?? '').includes('color-error'), sl3cls?.split(' ').filter((c) => c.startsWith('color-')).join(','));
ok('SL3b: validation ép variant-solid (màu trạng thái ưu tiên)', (sl3cls ?? '').includes('variant-solid'));

// Screenshot slider
await page.locator('[data-test="slider-demo"]').screenshot({ path: 'tests/screenshots/progress-slider-error/slider-full.png' });
console.log('Screenshot: slider-full.png');

// ═══════════════════════════════════════════════════════════════
// ERROR PAGE — /ui/error?status=404 + 500
// ═══════════════════════════════════════════════════════════════
await page.goto(`${BASE}/ui/error?status=404`, { waitUntil: 'domcontentloaded' });
await sleep(1200);

// ── EP1: 404 — matrix cells + status text + message + color warning ──
const ep404 = await page.evaluate(() => {
	const root = document.querySelector('.error-root');
	const matrix = root?.querySelector('.error-matrix');
	const cells = matrix ? matrix.querySelectorAll('.error-matrix-cell').length : 0;
	const status = root?.querySelector('[data-test="error-status"]')?.textContent ?? '';
	const message = root?.querySelector('[data-test="error-message"]')?.textContent ?? '';
	const statusColor = getComputedStyle(root.querySelector('[data-test="error-status"]')).color;
	// Token --warning là hsl (raw) — computed color trả rgb → KHÔNG so trực tiếp.
	// Probe element gán color: var(--warning) rồi đọc computed → CÙNG hệ rgb để so sánh.
	const probe = document.createElement('span');
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:var(--warning)';
	root.appendChild(probe);
	const expectedWarning = getComputedStyle(probe).color;
	probe.remove();
	return { hasRoot: !!root, cells, status, message, statusColor, expectedWarning };
});
ok('EP1a: error-root render', ep404.hasRoot);
ok('EP1b: matrix có cells (>= 40×14=560)', ep404.cells >= 500, `cells=${ep404.cells}`);
ok('EP1c: status text "404"', ep404.status === '404', `status=${ep404.status}`);
ok('EP1d: message hiển thị (404 vi)', ep404.message.length > 5, `msg="${ep404.message.slice(0, 40)}"`);
ok('EP1e: 4xx màu warning', ep404.statusColor === ep404.expectedWarning, `color=${ep404.statusColor} warning=${ep404.expectedWarning}`);
ok('EP1f: root có class status-warning', await page.evaluate(() => document.querySelector('.error-root').className.includes('status-warning')));

// Screenshot 404 (viewport — error page full, KHÔNG section screenshot clip)
await page.screenshot({ path: 'tests/screenshots/progress-slider-error/error-404.png' });
console.log('Screenshot: error-404.png');

// ── EP2: 500 — color danger ──
await page.goto(`${BASE}/ui/error?status=500`, { waitUntil: 'domcontentloaded' });
await sleep(1200);
const ep500 = await page.evaluate(() => {
	const root = document.querySelector('.error-root');
	const status = root?.querySelector('[data-test="error-status"]')?.textContent ?? '';
	const statusColor = getComputedStyle(root.querySelector('[data-test="error-status"]')).color;
	const probe = document.createElement('span');
	probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:var(--danger)';
	root.appendChild(probe);
	const expectedDanger = getComputedStyle(probe).color;
	probe.remove();
	const message = root?.querySelector('[data-test="error-message"]')?.textContent ?? '';
	return { status, statusColor, expectedDanger, message };
});
ok('EP2a: status text "500"', ep500.status === '500', `status=${ep500.status}`);
ok('EP2b: 5xx màu danger', ep500.statusColor === ep500.expectedDanger, `color=${ep500.statusColor} danger=${ep500.expectedDanger}`);
ok('EP2c: 500 message (vi)', ep500.message.length > 5, `msg="${ep500.message.slice(0, 40)}"`);
await page.screenshot({ path: 'tests/screenshots/progress-slider-error/error-500.png' });
console.log('Screenshot: error-500.png');

// ── EP3: 403 — color warning (4xx) + message ──
await page.goto(`${BASE}/ui/error?status=403`, { waitUntil: 'domcontentloaded' });
await sleep(1200);
const ep403 = await page.evaluate(() => {
	const root = document.querySelector('.error-root');
	return {
		status: root?.querySelector('[data-test="error-status"]')?.textContent ?? '',
		message: root?.querySelector('[data-test="error-message"]')?.textContent ?? ''
	};
});
ok('EP3a: 403 status text', ep403.status === '403');
ok('EP3b: 403 message "Không có quyền"', ep403.message.includes('quyền'), `msg="${ep403.message.slice(0, 40)}"`);

// ── EP4: Real 404 (route không tồn tại) — +error.svelte render ErrorPage ──
// Dùng /ui/khong-ton-tai-test: /ui* là public path (không bị auth guard 303 → /login),
// route không tồn tại → SvelteKit trả 404 thật → +error.svelte render ErrorPage.
const resp404 = await page.goto(`${BASE}/ui/khong-ton-tai-test`, { waitUntil: 'domcontentloaded' });
await sleep(1200);
const epReal = await page.evaluate(() => {
	const status = document.querySelector('[data-test="error-status"]')?.textContent ?? '';
	const root = document.querySelector('.error-root');
	return { status, hasRoot: !!root };
});
ok('EP4a: real 404 response status', resp404?.status() === 404, `resp=${resp404?.status()}`);
ok('EP4b: +error.svelte render ErrorPage (matrix)', epReal.hasRoot && epReal.status === '404', `status=${epReal.status} root=${epReal.hasRoot}`);

// ── EP5: custom message override (?message=) + reduced-motion CSS ──
await page.goto(`${BASE}/ui/error?status=404&message=Trang%20demo%20bị%20xóa`, { waitUntil: 'domcontentloaded' });
await sleep(800);
const epMsg = await page.evaluate(() => {
	const message = document.querySelector('.error-root')?.querySelector('[data-test="error-message"]')?.textContent ?? '';
	return { message };
});
ok('EP5a: message prop override map mặc định', epMsg.message === 'Trang demo bị xóa', `msg="${epMsg.message}"`);

await browser.close();

const passCount = results.filter((r) => r.pass).length;
console.log(`\n=== KẾT QUẢ: ${passCount}/${results.length} PASS ===`);
if (passCount !== results.length) {
	console.log('FAILs:');
	for (const r of results) if (!r.pass) console.log(`  FAIL ${r.name} ${r.extra}`);
}
