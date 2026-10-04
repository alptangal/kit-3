// Modal container padding block — request 2026-10-03:
//  padding top/bottom của .modal-container-root phụ thuộc Header/Footer:
//   P1  Modal có Header (không Footer): container padding-top === 0,
//       padding-bottom > 0, padding-left > 0 (horizontal giữ nguyên);
//       header bounding-top ≈ container top (≤2px, flush mép).
//   P2  Modal sticky (Header + Footer): padding-top === 0 VÀ padding-bottom === 0;
//       footer bounding-bottom ≈ container bottom (≤2px); header margin-top === 0px.
//   P3  Modal trần (không header/footer, demo mới): padding-top > 0 VÀ
//       padding-bottom > 0 (= var --padding của size-sm).
// Chạy: node tests/modal-padding-probe.mjs (dev: https://localhost:3000)
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

// ── P1: modal cơ bản (Header, không Footer) ──
await page.getByRole('button', { name: 'Mở Modal', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);

const p1 = await page.evaluate(() => {
	const cont = document.querySelector('.modal-container-root');
	const h = document.querySelector('.modal-header-root');
	const cs = getComputedStyle(cont);
	const hb = h?.getBoundingClientRect();
	const cb = cont.getBoundingClientRect();
	return {
		padTop: cs.paddingTop,
		padBottom: cs.paddingBottom,
		padLeft: cs.paddingLeft,
		flushTop: cont.classList.contains('flush-top'),
		flushBottom: cont.classList.contains('flush-bottom'),
		headerCls: h?.className ?? '',
		headerMarginTop: h ? getComputedStyle(h).marginTop : null,
		gapTop: hb ? hb.top - cb.top : null,
		gapBottom: h ? cb.bottom - h.getBoundingClientRect().bottom : null
	};
});
ok('P1  container có header: class flush-top', p1.flushTop, `cls=${JSON.stringify(p1.flushTop)}`);
ok('P1  container có header: KHÔNG flush-bottom', !p1.flushBottom, `cls=${JSON.stringify(p1.flushBottom)}`);
ok('P1  container padding-top === 0px', p1.padTop === '0px', `padTop=${p1.padTop}`);
ok('P1  container padding-bottom > 0 (không footer)', p1.padBottom !== '0px' && parseFloat(p1.padBottom) > 0, `padBottom=${p1.padBottom}`);
ok('P1  container padding-left > 0 (horizontal giữ nguyên)', parseFloat(p1.padLeft) > 0, `padLeft=${p1.padLeft}`);
ok('P1  header có class modal-header-flush-top', p1.headerCls.includes('modal-header-flush-top'), `cls=${p1.headerCls}`);
ok('P1b header margin-top === 0px', p1.headerMarginTop === '0px', `marginTop=${p1.headerMarginTop}`);
ok('P1c header flush mép trên (bounding-top ≈ container top ≤2px)', p1.gapTop !== null && Math.abs(p1.gapTop) <= 2, `gap=${p1.gapTop?.toFixed(2)}px`);

await page.screenshot({ path: `${OUT}/05-padding-flush-top.png` });

// Đóng modal cơ bản
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// ── P2: modal scroll (Header + Footer đứng yên, body cuộn) ──
await page.getByRole('button', { name: 'Mở Modal scroll', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);

const p2 = await page.evaluate(() => {
	const cont = document.querySelector('.modal-container-root');
	const h = document.querySelector('.modal-header-root');
	const f = document.querySelector('.modal-footer-root');
	const cs = getComputedStyle(cont);
	const hb = h?.getBoundingClientRect();
	const fb = f?.getBoundingClientRect();
	const cb = cont.getBoundingClientRect();
	return {
		padTop: cs.paddingTop,
		padBottom: cs.paddingBottom,
		flushTop: cont.classList.contains('flush-top'),
		flushBottom: cont.classList.contains('flush-bottom'),
		headerMarginTop: h ? getComputedStyle(h).marginTop : null,
		headerCls: h?.className ?? '',
		gapTop: hb ? hb.top - cb.top : null,
		gapBottom: fb ? cb.bottom - fb.bottom : null
	};
});
ok('P2  container có header+footer: flush-top + flush-bottom', p2.flushTop && p2.flushBottom, `top=${p2.flushTop} bottom=${p2.flushBottom}`);
ok('P2  container padding-top === 0px', p2.padTop === '0px', `padTop=${p2.padTop}`);
ok('P2  container padding-bottom === 0px (footer flush mép dưới)', p2.padBottom === '0px', `padBottom=${p2.padBottom}`);
ok('P2  header margin-top === 0px', p2.headerMarginTop === '0px', `marginTop=${p2.headerMarginTop}`);
ok('P2b header flush mép trên (≤2px)', p2.gapTop !== null && Math.abs(p2.gapTop) <= 2, `gap=${p2.gapTop?.toFixed(2)}px`);
ok('P2c footer flush mép dưới (≤2px, không dải nền thừa)', p2.gapBottom !== null && Math.abs(p2.gapBottom) <= 2, `gap=${p2.gapBottom?.toFixed(2)}px`);

// P2f: footer có padding block "thickness" tương xứng header (0.875rem = 14px).
// Header dùng `padding: 0.875rem var(--padding)`; footer không full-width
// (nằm trong horizontal padding container) → chỉ `padding-block: 0.875rem`.
const footerPad = await page.evaluate(() => {
	const f = document.querySelector('.modal-footer-root');
	if (!f) return null;
	const cs = getComputedStyle(f);
	return { top: cs.paddingTop, bottom: cs.paddingBottom };
});
ok('P2f footer padding-block > 0 (không còn bám sát mép)', footerPad && parseFloat(footerPad.top) > 0 && parseFloat(footerPad.bottom) > 0, footerPad ? `top=${footerPad.top} bottom=${footerPad.bottom}` : 'no footer');
// Độ "thickness" dọc footer ≈ header vertical (0.875rem = 14px mỗi cạnh).
ok('P2g footer padding-top ≈ 14px (thickness 0.875rem, tương xứng header)', footerPad && Math.abs(parseFloat(footerPad.top) - 14) < 1, `top=${footerPad?.top}`);

// Cuộn BODY xuống giữa để kiểm chứng footer ghim sát mép (không lộ
// padding). Kiến trúc mới: body là scroll-container (container là flex
// column, không tự scroll) → scrollTop của `.modal-body-root`.
await page.evaluate(() => {
	const body = document.querySelector('.modal-body-root');
	body.scrollTop = body.scrollHeight / 2;
});
await page.waitForTimeout(200);
const p2scrolled = await page.evaluate(() => {
	const cont = document.querySelector('.modal-container-root');
	const h = document.querySelector('.modal-header-root');
	const f = document.querySelector('.modal-footer-root');
	const cb = cont.getBoundingClientRect();
	const hb = h?.getBoundingClientRect();
	const fb = f?.getBoundingClientRect();
	return {
		gapTop: hb ? hb.top - cb.top : null,
		gapBottom: fb ? cb.bottom - fb.bottom : null
	};
});
ok('P2d khi cuộn: header vẫn flush mép trên (≤2px)', p2scrolled.gapTop !== null && Math.abs(p2scrolled.gapTop) <= 2, `gap=${p2scrolled.gapTop?.toFixed(2)}px`);
ok('P2e khi cuộn: footer vẫn flush mép dưới (≤2px)', p2scrolled.gapBottom !== null && Math.abs(p2scrolled.gapBottom) <= 2, `gap=${p2scrolled.gapBottom?.toFixed(2)}px`);

await page.screenshot({ path: `${OUT}/06-padding-flush-both-scrolled.png` });

await page.getByRole('button', { name: 'Close modal', exact: true }).click();
await page.waitForTimeout(400);

// ── P3: modal trần (không header/footer — demo mới) ──
await page.getByRole('button', { name: 'Mở Modal trần', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);

const p3 = await page.evaluate(() => {
	const cont = document.querySelector('.modal-container-root');
	const cs = getComputedStyle(cont);
	return {
		padTop: cs.paddingTop,
		padBottom: cs.paddingBottom,
		padLeft: cs.paddingLeft,
		flushTop: cont.classList.contains('flush-top'),
		flushBottom: cont.classList.contains('flush-bottom'),
		hasHeader: !!cont.querySelector('.modal-header-root'),
		hasFooter: !!cont.querySelector('.modal-footer-root')
	};
});
ok('P3  modal trần: KHÔNG có header/footer', !p3.hasHeader && !p3.hasFooter, `h=${p3.hasHeader} f=${p3.hasFooter}`);
ok('P3  modal trần: KHÔNG flush-top / flush-bottom', !p3.flushTop && !p3.flushBottom, `top=${p3.flushTop} bottom=${p3.flushBottom}`);
ok('P3  modal trần: padding-top > 0 (giữ nguyên)', parseFloat(p3.padTop) > 0, `padTop=${p3.padTop}`);
ok('P3  modal trần: padding-bottom > 0 (giữ nguyên)', parseFloat(p3.padBottom) > 0, `padBottom=${p3.padBottom}`);
ok('P3b padding block = padding horizontal (cùng var --padding size-sm)', Math.abs(parseFloat(p3.padTop) - parseFloat(p3.padLeft)) < 0.5, `top=${p3.padTop} left=${p3.padLeft}`);

await page.screenshot({ path: `${OUT}/07-padding-bare.png` });

await browser.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
