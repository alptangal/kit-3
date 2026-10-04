// Modal sticky + body-scroll probe (request 2026-10-03, item 1 + 2):
//  S1  Body content quá cao → BODY scroll được (scrollHeight > clientHeight,
//      overflow-y auto) — kiến trúc mới: `.modal-body-root` là scroll-container
//      (container là flex column, không tự scroll).
//  S1b container KHÔNG còn là scroll-container (overflow-y = hidden)
//  S2  Header sticky: position=sticky, top=0 (prop sticky giữ API, giờ là
//      no-op vì flex layout đã ghim header/footer tự nhiên)
//  S3  Footer sticky: position=sticky, bottom=0 (như S2)
//  S4  Header KHÔNG sticky khi không set prop (default false → position relative)
//  S5  Body scroll: cuộn BODY, header/footer giữ nguyên vị trí (ghim)
//  S6  Scrollbar height: body (scroll viewport) nhỏ hơn container (body chỉ
//      chiếm cạnh dưới header → cạnh trên footer, không lan qua header/footer)
// Chạy: node tests/modal-sticky-probe.mjs (dev: https://localhost:3000)
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

// ── Mở modal scroll (demo "sticky" — header/footer đứng yên, body cuộn) ──
await page.getByRole('button', { name: 'Mở Modal scroll', exact: true }).click();
await page.waitForSelector('.modal-container-root', { state: 'visible' });
await page.waitForTimeout(400);

// S1: body content scroll được — KIẾN TRÚC MỚI: `.modal-body-root` là
// scroll-container (container là flex column, không tự scroll).
const scroll = await page.evaluate(() => {
	const body = document.querySelector('.modal-body-root');
	const cont = document.querySelector('.modal-container-root');
	const cs = getComputedStyle(body);
	const ccs = getComputedStyle(cont);
	return {
		scrollH: body.scrollHeight,
		clientH: body.clientHeight,
		overflowY: cs.overflowY,
		contOverflowY: ccs.overflowY,
		contDisplay: ccs.display
	};
});
ok(
	'S1  body content tràn → scroll được (scrollH > clientH)',
	scroll.scrollH > scroll.clientH,
	`scrollH=${scroll.scrollH} clientH=${scroll.clientH} overflowY=${scroll.overflowY}`
);
ok('S1b body overflow-y = auto (body là scroll-container)', scroll.overflowY === 'auto', `overflowY=${scroll.overflowY}`);
ok(
	'S1c container KHÔNG còn tự scroll (overflow-y = hidden, flex column)',
	scroll.contOverflowY === 'hidden' && scroll.contDisplay === 'flex',
	`contOverflowY=${scroll.contOverflowY} display=${scroll.contDisplay}`
);

// S2/S3: header + footer sticky
const sticky = await page.evaluate(() => {
	const h = document.querySelector('.modal-header-root');
	const f = document.querySelector('.modal-footer-root');
	const hcs = h ? getComputedStyle(h) : null;
	const fcs = f ? getComputedStyle(f) : null;
	return {
		headerPos: hcs?.position,
		headerTop: hcs?.top,
		headerCls: h?.className,
		footerPos: fcs?.position,
		footerBottom: fcs?.bottom,
		footerCls: f?.className
	};
});
ok('S2  header sticky (position=sticky)', sticky.headerPos === 'sticky', `pos=${sticky.headerPos}`);
ok('S2b header top=0', sticky.headerTop === '0px', `top=${sticky.headerTop}`);
ok('S3  footer sticky (position=sticky)', sticky.footerPos === 'sticky', `pos=${sticky.footerPos}`);
ok('S3b footer bottom=0', sticky.footerBottom === '0px', `bottom=${sticky.footerBottom}`);

// S5: độ BẤT BIẾN khi cuộn — header/footer phải đứng yên (vị trí
// bounding-box không đổi) dù body content cuộn qua. Cuộn `.modal-body-root`
// (scroll-container mới), đo ở 3 mức scroll.
const snap = () =>
	page.evaluate(() => {
		const h = document.querySelector('.modal-header-root');
		const f = document.querySelector('.modal-footer-root');
		const body = document.querySelector('.modal-body-root');
		return {
			scrollTop: body.scrollTop,
			headerTop: h.getBoundingClientRect().top,
			footerBottom: f.getBoundingClientRect().bottom
		};
	});

const before = await snap();
// Cuộn body xuống giữa
await page.evaluate(() => {
	const body = document.querySelector('.modal-body-root');
	body.scrollTop = body.scrollHeight / 2;
});
await page.waitForTimeout(200);
const mid = await snap();
// Cuộn tới đáy
await page.evaluate(() => {
	const body = document.querySelector('.modal-body-root');
	body.scrollTop = body.scrollHeight;
});
await page.waitForTimeout(200);
const end = await snap();

ok('S5  body đã cuộn (scrollTop tăng dần)', mid.scrollTop > before.scrollTop && end.scrollTop >= mid.scrollTop, `top=${before.scrollTop} mid=${mid.scrollTop} end=${end.scrollTop}`);
ok(
	'S5b header GHIN khi cuộn (top không đổi giữa 3 mức scroll)',
	Math.abs(mid.headerTop - before.headerTop) < 4 && Math.abs(end.headerTop - before.headerTop) < 4,
	`top=${before.headerTop?.toFixed(1)} mid=${mid.headerTop?.toFixed(1)} end=${end.headerTop?.toFixed(1)}`
);
ok(
	'S5c footer GHIN khi cuộn (bottom không đổi giữa 3 mức scroll)',
	Math.abs(mid.footerBottom - before.footerBottom) < 4 && Math.abs(end.footerBottom - before.footerBottom) < 4,
	`bottom=${before.footerBottom?.toFixed(1)} mid=${mid.footerBottom?.toFixed(1)} end=${end.footerBottom?.toFixed(1)}`
);

// S6: scroll viewport (body) cao đúng vùng body — nhỏ hơn container vì
// header/footer chiếm các hai đầu (body nằm giữa cạnh dưới header và
// cạnh trên footer). Bounding-box body không đổi khi scroll nội bộ.
const s6 = await page.evaluate(() => {
	const body = document.querySelector('.modal-body-root');
	const cont = document.querySelector('.modal-container-root');
	const h = document.querySelector('.modal-header-root');
	const f = document.querySelector('.modal-footer-root');
	const bb = body.getBoundingClientRect();
	const cb = cont.getBoundingClientRect();
	return {
		bodyH: body.clientHeight,
		contH: cont.clientHeight,
		bodyOverflows: body.scrollHeight > body.clientHeight,
		gapHeader: bb.top - h.getBoundingClientRect().bottom,
		gapFooter: f.getBoundingClientRect().top - bb.bottom
	};
});
ok('S6  body scroll viewport < container (scrollbar chỉ cao bằng body)', s6.bodyH < s6.contH, `body=${s6.bodyH}px cont=${s6.contH}px`);
ok('S6b body overflows (content dài → có scrollbar thật)', s6.bodyOverflows, `scrollH>clientH=${s6.bodyOverflows}`);
ok('S6c body giáp header (gap ≤ 2px) + giáp footer (gap ≤ 2px)', s6.gapHeader <= 2 && s6.gapFooter <= 2, `gapH=${s6.gapHeader.toFixed(2)}px gapF=${s6.gapFooter.toFixed(2)}px`);

await page.screenshot({ path: `${OUT}/04-sticky-scrolled.png` });

// S4: modal KHi default (không sticky) → header position relative (khung cơ bản)
// Đóng modal sticky, mở modal cơ bản để verify default header không sticky
await page.getByRole('button', { name: 'Close modal', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Mở Modal', exact: true }).click();
await page.waitForTimeout(400);
const defHeader = await page.evaluate(() => {
	const h = document.querySelector('.modal-header-root');
	return { pos: h ? getComputedStyle(h).position : null };
});
ok(
	'S4  header mặc định KHÔNG sticky (default false → relative)',
	defHeader.pos === 'relative',
	`pos=${defHeader.pos}`
);

await browser.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n=== ${passed}/${results.length} PASS ===`);
process.exit(passed === results.length ? 0 : 1);
