// Modal "hoàn thiện" probe — request 2026-10-03:
//  M1  Header "nổi khối": nền riêng (--default-300) + border-bottom + flush full-width
//  M2  Nút close ratio square (aspect-square: width ≈ height)
//  M3  preventOutsideClose: click backdrop KHÔNG đóng, ESC VẪN đóng
//  M4  Multi-layer: 3 modal lồng → panel phía dưới scale < 1 + blur (hiệu ứng iOS)
// Chạy: node tests/modal-refinements-probe.mjs (dev: https://localhost:3000)
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

// ─────────────────────────── M2 + M1: header + nút close ───────────────────────────
await page.getByRole('button', { name: 'Mở Modal', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400); // để transition fly + layer effect chạy

// Scroll lock: body overflow bị khóa
const overflow = await page.evaluate(() => document.body.style.overflow);
ok('M0  body scroll-lock khi modal mở', overflow === 'hidden', `overflow=${overflow}`);

// Header "nổi khối": background khác container + có border-bottom
const headerInfo = await page.evaluate(() => {
	const h = document.querySelector('.modal-header-root');
	const cs = getComputedStyle(h);
	const cont = document.querySelector('.modal-container-root');
	const csCont = getComputedStyle(cont);
	return {
		headerBg: cs.backgroundColor,
		containerBg: csCont.backgroundColor,
		borderBottom: cs.borderBottomWidth,
		// flush: header padding-left phải bằng container padding-left (title align mép)
		headerPadL: parseFloat(cs.paddingLeft),
		containerPadL: parseFloat(csCont.paddingLeft)
	};
});
ok(
	'M1  header nền riêng ≠ container (nổi khối)',
	headerInfo.headerBg !== headerInfo.containerBg,
	`header=${headerInfo.headerBg} cont=${headerInfo.containerBg}`
);
ok('M1b header có border-bottom (vách phân tách)', parseFloat(headerInfo.borderBottom) > 0, `bw=${headerInfo.borderBottom}`);
ok(
	'M1c header flush full-width (padL = container padL)',
	Math.abs(headerInfo.headerPadL - headerInfo.containerPadL) < 0.5,
	`header=${headerInfo.headerPadL} cont=${headerInfo.containerPadL}`
);

// Nút close ratio square
const closeInfo = await page.evaluate(() => {
	const btn = document.querySelector('.modal-close-button');
	if (!btn) return null;
	const r = btn.getBoundingClientRect();
	return { w: r.width, h: r.height, cls: btn.className };
});
ok('M2  nút close tồn tại (class button-root)', closeInfo?.cls?.includes('button-root'), closeInfo?.cls ?? 'null');
ok(
	'M2b nút close ratio square (|w-h| < 2px)',
	closeInfo && Math.abs(closeInfo.w - closeInfo.h) < 2,
	`w=${closeInfo?.w?.toFixed(1)} h=${closeInfo?.h?.toFixed(1)}`
);

await page.screenshot({ path: `${OUT}/01-header-close.png` });

// ─────────────────────────── M4: multi-layer 3 lớp ───────────────────────────
// Mở modal lồng (lớp 2)
await page.getByRole('button', { name: 'Mở Modal lồng', exact: true }).click();
await page.waitForTimeout(500);
// Mở modal lồng sâu (lớp 3)
await page.getByRole('button', { name: 'Mở Modal lồng sâu hơn (lớp 3)', exact: true }).click();
await page.waitForTimeout(600);

// Multi-layer giờ dùng CSS variables + class `.has-motion` (không inline style).
// Đọc COMPUTED style để lấy transform (matrix) / filter / opacity thực tế.
const layers = await page.evaluate(() => {
	const panels = [...document.querySelectorAll('.modal-container-root')];
	return panels.map((p) => {
		const cs = getComputedStyle(p);
		return { scale: cs.transform, blur: cs.filter, opacity: cs.opacity, motion: p.classList.contains('has-motion') };
	});
});
console.log('   panels (thứ tự DOM, trên cùng cuối):', JSON.stringify(layers));
// 3 panel đang mở. Panel trên cùng (index cuối, DOM order = open order) không transform;
// panel dưới có style.transform = "scale(<1)" + blur.
const parseScale = (t) => {
	const m = (t || '').match(/scale\(([-\d.]+)/);
	if (m) return parseFloat(m[1]);
	// computed style trả về matrix(a, b, c, d, tx, ty) → a = scale
	const mm = (t || '').match(/matrix\(([-\d.]+),/);
	return mm ? parseFloat(mm[1]) : 1;
};
const top = layers[layers.length - 1];
const under = layers.slice(0, -1);
ok('M4  có 3 panel đồng thời', layers.length === 3, `count=${layers.length}`);
ok(
	'M4b panel trên cùng scale=1 (không co)',
	parseScale(top.scale) >= 0.99,
	`top=${top.scale}`
);
ok(
	'M4c panel dưới BỊ scale nhỏ (scale < 1)',
	under.length > 0 && under.every((p) => parseScale(p.scale) < 0.99),
	`under=${JSON.stringify(under.map((u) => parseScale(u.scale)))}`
);
ok(
	'M4d panel dưới có blur (filter blur)',
	under.some((p) => p.blur.includes('blur')),
	`blur=${JSON.stringify(under.map((u) => u.blur))}`
);

await page.screenshot({ path: `${OUT}/02-multilayer-3.png` });

// Đóng từng lớp (nút ×) — layer effect phải reverse lại
await page.locator('.modal-close-button').last().click(); // đóng lớp 3
await page.waitForTimeout(500);
await page.locator('.modal-close-button').last().click(); // đóng lớp 2
await page.waitForTimeout(500);
await page.locator('.modal-close-button').last().click(); // đóng lớp 1
await page.waitForTimeout(400);
const overflowAfter = await page.evaluate(() => document.body.style.overflow);
const panelsAfter = await page.evaluate(() => document.querySelectorAll('.modal-container-root').length);
ok('M5  body unlock khi đóng hết', overflowAfter === '' || overflowAfter === 'visible', `overflow=${overflowAfter}`);
ok('M5b không còn panel modal', panelsAfter === 0, `panels=${panelsAfter}`);

// ─────────────────────────── A1: prefers-reduced-motion ───────────────────────────
// Emulate reduced-motion → Svelte transition = none + panel KHÔNG scale/blur
// (chỉ giảm opacity). Kiểm chứng bằng computed style (không phải inline).
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.getByRole('button', { name: 'Mở Modal', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.getByRole('button', { name: 'Mở Modal lồng', exact: true }).click();
await page.waitForTimeout(400);
const reduced = await page.evaluate(() => {
	const panels = [...document.querySelectorAll('.modal-container-root')];
	const cs = getComputedStyle(panels[0]); // panel dưới cùng (DOM đầu = mở trước)
	const m = cs.transform.match(/matrix\(([-\d.]+)/);
	const scale = m ? parseFloat(m[1]) : 1;
	return { scale, blur: cs.filter, opacity: cs.opacity, motion: panels[0].classList.contains('has-motion') };
});
ok('A1  reduced-motion: panel dưới KHÔNG scale (scale=1)', reduced.scale >= 0.99, `scale=${reduced.scale}`);
ok('A1b reduced-motion: panel dưới KHÔNG blur', reduced.blur === 'none', `blur=${reduced.blur}`);
ok('A1c reduced-motion: panel dưới giảm opacity (<1)', parseFloat(reduced.opacity) < 1, `opacity=${reduced.opacity}`);
ok('A1d reduced-motion: không có class has-motion', reduced.motion === false, `motion=${reduced.motion}`);
// Đóng hết TỪ TRÊN XUỐNG (nút × của modal trên cùng không bị che → click được).
// Dùng .last() vì modal sau (trên cùng) nằm cuối DOM. .first() là modal dưới
// bị che bởi panel trên → Playwright "intercepts pointer events" → không tắt.
for (let i = 0; i < 3; i++) {
	const btn = page.locator('.modal-close-button').last();
	if ((await btn.count()) === 0) break;
	await btn.click({ timeout: 4000 }).catch(() => {});
	await page.waitForTimeout(250);
}
await page.emulateMedia({ reducedMotion: null });

// ─────────────────────────── M3: preventOutsideClose ───────────────────────────
await page.getByRole('button', { name: 'Mở Modal đóng cứng', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);

// Click backdrop (nền .modal-root, ngoài container) → KHÔNG đóng
await page.mouse.click(60, 400); // điểm rìa, ngoài panel md (panel ~32rem ở giữa)
await page.waitForTimeout(400);
const stillOpen = await page.evaluate(() => !!document.querySelector('.modal-container-root'));
ok('M3  preventOutsideClose: click backdrop KHÔNG đóng', stillOpen, `stillOpen=${stillOpen}`);

// C1 visual cue: hint ESC hiện + cursor backdrop = default (không pointer)
const cue = await page.evaluate(() => {
	const hint = document.querySelector('.modal-esc-hint');
	const root = document.querySelector('.modal-root');
	const cs = getComputedStyle(root);
	return { hint: hint?.textContent?.trim() ?? null, cursor: cs.cursor };
});
ok('M3c preventOutsideClose: có hint "Esc" (visual cue)', cue.hint?.includes('Esc'), `hint=${cue.hint}`);
ok('M3d preventOutsideClose: cursor backdrop = default', cue.cursor === 'default', `cursor=${cue.cursor}`);

await page.screenshot({ path: `${OUT}/03-prevent-outside.png` });

// ESC vẫn đóng
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const escClosed = await page.evaluate(() => !document.querySelector('.modal-container-root'));
ok('M3b preventOutsideClose: ESC VẪN đóng', escClosed, `closed=${escClosed}`);

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
