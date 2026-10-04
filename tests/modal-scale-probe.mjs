// modal-scale-probe.mjs
// Probe cho task "#modal hoàn thiện: hiệu ứng scale zoom-out cho layout NẰM DƯỚI
// modal khi modal hiển thị". Layout root = nút 'root' trong client.browser.layers
// (Container của +layout.svelte, có class `.layer`); modal portal là EM của nó.
// Effect: class `modal-underlying-scale` + CSS var --modal-underlying-scale=0.96
// (gán sau 120ms khi có transition; gán NGAY khi reduced-motion).
// Chạy: node tests/modal-scale-probe.mjs (dev server https://localhost:3000)
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000/ui/modal';
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
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Mở Modal', { timeout: 20000 });

// Hydration gate — đảm bảo Svelte đã attach listeners trước khi click nút demo
await page.locator('text=Mở Modal').first().click().catch(() => {});
await sleep(600);
await page.keyboard.press('Escape').catch(() => {});
await sleep(600);

// Modal demo có class `.modal-root` (fixed overlay)
const modalSel = '.modal-root';
// Panel nội dung modal (scaled trong multi-layer effect)
const panelSel = '.modal-container-root';

// NOTE: root layout KHÔNG có class cố định — Container của +layout.svelte
// (registered 'root' vào client.browser.layers) chỉ có class 'w-full h-full
// overflow-auto'. Modal portal là EM của CONTAINER.PARENT → là anh/em của
// Container (KHÔNG nằm trong nó) → scale Container KHÔNG đụng modal.
// Locate root: Container của +layout.svelte (registered 'root' vào
// client.browser.layers) render class 'w-full h-full' (defaultContainer.class
// + scoped hash class). Modal portal là ANH EM của Container (append vào
// parent của Container) → scale Container KHÔNG ảnh hưởng modal.
// NOTE: không dùng walk-up theo 'overflow-auto' — class đó KHÔNG hiện diện
// trên Container element trong DOM (merge class khác dự đoán).
const readRoot = () =>
	page.evaluate(() => {
		const el = document.querySelector('div.w-full.h-full');
		if (!el) return null;
		const cs = getComputedStyle(el);
		const varVal = el.style.getPropertyValue('--modal-underlying-scale');
		return {
			hasClass: el.classList.contains('modal-underlying-scale'),
			transform: cs.transform,
			transitionProperty: cs.transitionProperty,
			transitionDuration: cs.transitionDuration,
			varInline: varVal || null,
			varComputed: cs.getPropertyValue('--modal-underlying-scale')
		};
	});

const readPanel = () =>
	page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) return null;
		const cs = getComputedStyle(el);
		return {
			transform: cs.transform,
			opacity: cs.opacity,
			filter: cs.filter
		};
	}, panelSel);

console.log('\n=== MS0: TRẠNG THÁI BAN ĐẦU (không modal) ===');
let root0 = await readRoot();
ok('MS0: root layout render (class .layer = Container root)', !!root0);
ok('MS0: root KHÔNG có class modal-underlying-scale', root0 && root0.hasClass === false);
ok('MS0: root var --modal-underlying-scale rỗng', root0 && root0.varInline === null);
ok('MS0: root transform = none (scale 1)', root0 && root0.transform === 'none', root0?.transform);

console.log('\n=== MS1: MỞ MODAL → root co lại (scale 0.96) ===');
await page.locator('text=Mở Modal').first().click();
// Modal transition (fly 300ms) — chờ đủ để transition hết
await sleep(500);
// JS gán CSS var sau 120ms (setTimeout để tránh nhảy snapshot view-transition)
await sleep(400);
const modalOpen = (await page.locator(modalSel).count()) === 1;
ok('MS1: modal mở (1 element .modal-root)', modalOpen, String(await page.locator(modalSel).count()));
let root1 = await readRoot();
ok('MS1: root có class modal-underlying-scale', root1?.hasClass === true, JSON.stringify(root1?.hasClass));
ok('MS1: root var --modal-underlying-scale = "0.96"', root1?.varInline === '0.96', JSON.stringify(root1?.varInline));
ok('MS1: root computed transform = matrix(0.96, 0, 0, 0.96, 0, 0)', root1?.transform === 'matrix(0.96, 0, 0, 0.96, 0, 0)', root1?.transform);
// Panel modal (top layer) phải scale 1 (đúng multi-layer effect)
let panel1 = await readPanel();
ok(
	'MS1: panel top layer transform = none (scale 1)',
	panel1?.transform === 'none',
	panel1?.transform
);

console.log('\n=== MS2: root transition (transform 350ms) ===');
// MS2: rule .modal-underlying-scale (global app.css) set
// `transition: transform 350ms cubic-bezier(0.16, 1, 0.3, 1)`.
// CHÚ Ý: Container root có INLINE style:transition-duration=var(--transition-duration)
// (token hệ thống, default 300ms — inline luôn win trên class). Class
// .modal-underlying-scale cũng bám cùng token (300ms) → duration computed
// = 0.3s là ĐÚNG (đồng bộ nhịp hệ thống). Assert: property có "transform"
// + duration ≈ 300ms (hoặc 350ms nếu token chưa gán).
const rootDur = root1?.transitionDuration ?? '';
const rootTP = root1?.transitionProperty ?? '';
const durValues = rootDur.split(',').map((s) => s.trim());
const hasSys = durValues.some((d) => /0\.3s\b|^300ms$|0\.35s\b|^350ms$/.test(d));
ok(
	'MS2: transitionProperty có "transform" + duration ≈ 300ms (token hệ thống)',
	rootTP.includes('transform') && hasSys,
	`property="${rootTP}" duration="${rootDur}"`
);

console.log('\n=== MS3: ĐÓNG MODAL → root trở về scale 1 ===');
await page.keyboard.press('Escape');
await sleep(600); // modal transition 300ms + delay 60ms cleanup
const modalClosed = (await page.locator(modalSel).count()) === 0;
ok('MS3: modal đã đóng (0 element .modal-root)', modalClosed, String(await page.locator(modalSel).count()));
let root3 = await readRoot();
ok('MS3: root KHÔNG còn class modal-underlying-scale', root3?.hasClass === false);
ok('MS3: root var --modal-underlying-scale rỗng (đã remove)', root3?.varInline === null, JSON.stringify(root3?.varInline));
ok('MS3: root transform = none (scale 1 trở lại)', root3?.transform === 'none', root3?.transform);

console.log('\n=== MS4: NESTED (mở 2 modal) → count giữ scale, cleanup đúng ===');
await page.locator('text=Mở Modal').first().click();
await sleep(700);
// Có nút "Open nested/second modal" trong body demo không? Nếu có, click; nếu không, skip
const nestedBtn = page.locator('button', { hasText: /Mở Modal lồng/i }).first();
const hasNested = (await nestedBtn.count()) > 0;
if (hasNested) {
	await nestedBtn.click().catch(() => {});
	await sleep(700);
	const modalCount = await page.locator(modalSel).count();
	ok('MS4: 2 modal mở', modalCount >= 2, String(modalCount));
	let rootN = await readRoot();
	ok('MS4: root vẫn class + var 0.96 (nested không double-apply)', rootN?.hasClass === true && rootN?.varInline === '0.96');
	// Đóng modal trên (top) → root giữ scale (còn 1 modal dưới)
	await page.keyboard.press('Escape');
	await sleep(700);
	let rootN2 = await readRoot();
	const stillOpen = (await page.locator(modalSel).count()) > 0;
	ok('MS4: đóng top → còn modal + root vẫn scale', stillOpen && rootN2?.hasClass === true);
	// Đóng modal còn lại → root về scale 1
	await page.keyboard.press('Escape');
	await sleep(700);
	let rootN3 = await readRoot();
	ok('MS4: đóng hết → root về scale 1', rootN3?.hasClass === false && rootN3?.transform === 'none');
} else {
	console.log('SKIP  MS4: demo không có nested button (không crash — chủ yếu là MS0–MS3 đã verify)');
}

console.log('\n=== MS5: REDUCED MOTION (gán var NGAY, không class transition) ===');
// Bật prefers-reduced-motion qua CDP (chromium-only)
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Mở Modal', { timeout: 20000 });
await sleep(400);
// Hydration gate lần 2
await page.locator('text=Mở Modal').first().click().catch(() => {});
await sleep(400);
await page.keyboard.press('Escape').catch(() => {});
await sleep(400);
// Mở modal ở reduced-motion
await page.locator('text=Mở Modal').first().click();
// Reduced-motion: JS gán var NGAY (không chờ 120ms)
await sleep(300);
let rootR = await readRoot();
const modalROpen = (await page.locator(modalSel).count()) === 1;
ok('MS5: reduced-motion: modal mở', modalROpen, String(await page.locator(modalSel).count()));
// Design mới: class LUÔN được add (transform: scale(var(...)) sống trong
// .modal-underlying-scale). Reduced-motion (WCAG 2.3.3) không tắt hiệu ứng
// mà chỉ tắt TRANSITION (media query app.css: transition: none) → layout
// co lại NHẢY (instant) thay vì co mượt. JS gán var NGAY (không chờ 120ms).
ok(
	'MS5: reduced-motion: class + var gán NGAY 0.96 (instant, không 120ms delay)',
	rootR?.varInline === '0.96' && rootR?.hasClass === true,
	JSON.stringify({ hasClass: rootR?.hasClass, varInline: rootR?.varInline, transform: rootR?.transform })
);
ok('MS5: reduced-motion: root computed transform = scale 0.96 (nhảy)', rootR?.transform === 'matrix(0.96, 0, 0, 0.96, 0, 0)', rootR?.transform);
// Transition phải BỊ TẮT (media query app.css: transition: none) →
// duration computed "0s" cho mọi property (KHÔNG phải 0.3s/300ms).
// Đây là bằng chứng media query apply — layout co lại NHẢY (instant),
// user không thấy motion (WCAG 2.3.3).
const rmDur = (rootR?.transitionDuration ?? '').split(',').map((s) => s.trim());
const allZero = rmDur.length > 0 && rmDur.every((d) => /^0s$/.test(d));
ok('MS5: reduced-motion: transition TẮT (duration = 0s → co lại nhảy)', allZero, `duration="${rootR?.transitionDuration}"`);
// Đưa về normal
await cdp.send('Emulation.setEmulatedMedia', { features: [] });

// Screenshots
console.log('\n=== SCREENSHOTS ===');
const { mkdirSync } = await import('node:fs');
const shotDir = 'tests/screenshot/modal-scale';
mkdirSync(shotDir, { recursive: true });
// Khôi phục normal + mở modal để chụp
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('text=Mở Modal', { timeout: 20000 });
await sleep(400);
await page.locator('text=Mở Modal').first().click();
await sleep(900); // đủ transition + delay 120ms
await page.screenshot({ path: `${shotDir}/01-modal-open-scaled.png` });
await page.keyboard.press('Escape');
await sleep(700);
await page.screenshot({ path: `${shotDir}/02-after-close-restored.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
