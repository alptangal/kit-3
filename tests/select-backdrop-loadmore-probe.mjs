// select-backdrop-loadmore-probe.mjs
// Functional + computed-style probe cho 2 hoàn thiện Select:
// (1) backdrop: trigger (chứa option đã chọn) KHÔNG bị blur/dim che mất
//     — class 'backdrop' trên root + z-index trigger 45 (40 < 45 < 50)
// (2) load-more (button / pagination / hint) sticky đáy scroll container —
//     user không cần scroll tới cuối list để thao tác
// Chạy: node tests/select-backdrop-loadmore-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/select';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const openViaChevron = async (sec) => {
	await sec.locator('.select-trigger__icon').click();
	await sec.locator('.select-option').first().waitFor({ timeout: 4000 });
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

// ── (1) BACKDROP — trigger không bị che bởi backdrop ──
console.log('\n=== 1. BACKDROP (trigger vẫn thấy khi nền blur) ===');
const bdSection = page.locator('section:has(h2:has-text("Backdrop"))');

// Chọn 1 value để trigger có nội dung (mục đích: user theo dõi option đã chọn)
// Section Backdrop dùng colorOptions (Red/Green/Blue...) — không phải Apple
await openViaChevron(bdSection);
await bdSection.locator('.select-option__label', { hasText: 'Red' }).first().click();
await page.waitForTimeout(200);

// Mở lại → backdrop hiện
await openViaChevron(bdSection);
const bdInfo = await bdSection.evaluate((sec) => {
	const root = sec.querySelector('.select-root');
	const backdrop = sec.querySelector('.select-backdrop');
	const trigger = sec.querySelector('.select-trigger');
	const dropdown = sec.querySelector('.select-dropdown');
	const cs = (el) => (el ? getComputedStyle(el) : null);
	return {
		rootClass: root?.className ?? '',
		bdExists: !!backdrop,
		bdZ: cs(backdrop)?.zIndex,
		bdFilter: cs(backdrop)?.backdropFilter || cs(backdrop)?.webkitBackdropFilter,
		trigZ: cs(trigger)?.zIndex,
		trigPos: cs(trigger)?.position,
		ddZ: cs(dropdown)?.zIndex
	};
});
ok('backdrop: class "backdrop" trên root khi mở', /(^|\s)backdrop(\s|$)/.test(bdInfo.rootClass), bdInfo.rootClass);
ok('backdrop: element render (z=40, blur nền)', bdInfo.bdExists && bdInfo.bdZ === '40', `z=${bdInfo.bdZ} filter=${bdInfo.bdFilter}`);
ok('backdrop: trigger z-index = 45 (nổi trên backdrop)', bdInfo.trigZ === '45', `z=${bdInfo.trigZ} pos=${bdInfo.trigPos}`);
ok('backdrop: dropdown z=50 vẫn cao nhất (40 < 45 < 50)', bdInfo.ddZ === '50', `z=${bdInfo.ddZ}`);

// Đếm element có z-index lớn hơn trigger (45) mà KHÔNG nằm trong root
// → trigger chỉ bị che bởi dropdown (đúng mục đích, dropdown là panel option)
const stacking = await bdSection.evaluate((sec) => {
	const root = sec.querySelector('.select-root');
	const out = [];
	const walk = (el) => {
		const cs = getComputedStyle(el);
		if (cs.zIndex && cs.zIndex !== 'auto' && cs.position !== 'static') {
			out.push({ tag: el.tagName + (el.className ? '.' + String(el.className).split(/\s+/).slice(0, 2).join('.') : ''), z: cs.zIndex, inRoot: root.contains(el) });
		}
		for (const c of el.children) walk(c);
	};
	walk(sec);
	return out;
});
const aboveTrigger = stacking.filter((s) => parseInt(s.z, 10) > 45 && !s.inRoot);
ok('backdrop: không element NÀO ngoài root che trigger (z>45 ngoài root = 0)', aboveTrigger.length === 0,
	aboveTrigger.map((s) => `${s.tag}@${s.z}`).join(', ') || 'none');

// Không có class backdrop khi dropdown đóng
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.mouse.move(5, 5);
const rootClassClosed = (await bdSection.locator('.select-root').getAttribute('class')) ?? '';
ok('backdrop: class "backdrop" gỡ khi dropdown đóng', !/(^|\s)backdrop(\s|$)/.test(rootClassClosed), rootClassClosed);

// ── (2) LOAD-MORE STICKY ──
console.log('\n=== 2. LOAD-MORE STICKY (đáy panel, không cần scroll) ===');
const lmSection = page.locator('section:has(h2:has-text("Load-more"))');
const nativeSwitch = lmSection.locator('select'); // native <select> đổi loadMoreMode

// ── mode button ──
await nativeSwitch.selectOption('button');
await page.waitForTimeout(300);
await openViaChevron(lmSection);
const listInfo = await lmSection.locator('.select-option-list').evaluate((el) => {
	const r = el.getBoundingClientRect();
	return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, canScroll: el.scrollHeight > el.clientHeight + 4, top: r.top, bottom: r.bottom };
});
ok('load-more(button): list scroll được (nhiều option)', listInfo.canScroll, `sh=${listInfo.scrollHeight} ch=${listInfo.clientHeight}`);

const btnInfo = await lmSection.locator('.select-load-more').evaluate((el) => {
	const cs = getComputedStyle(el);
	const r = el.getBoundingClientRect();
	return { position: cs.position, bottom: cs.bottom, z: cs.zIndex, bg: cs.backgroundColor, y: r.y, h: r.height };
});
ok('load-more(button): position sticky, bottom=0', btnInfo.position === 'sticky' && btnInfo.bottom === '0px', `pos=${btnInfo.position} bottom=${btnInfo.bottom}`);
ok('load-more(button): nền opaque (che option scroll qua)',
	!btnInfo.bg.startsWith('rgba(0, 0, 0, 0)') && btnInfo.bg !== 'transparent', btnInfo.bg);

// Button nằm ở đáy panel MÀ không cần scroll (list đang scrollTop=0)
const listScroll0 = await lmSection.locator('.select-option-list').evaluate((el) => el.scrollTop);
const btnAtBottom = btnInfo.y + btnInfo.h <= listInfo.bottom + 1;
ok('load-more(button): button dính đáy panel khi chưa scroll (thao tác ngắn nhất)',
	listScroll0 === 0 && btnAtBottom, `scrollTop=${listScroll0} btnY=${Math.round(btnInfo.y)} panelBottom=${Math.round(listInfo.bottom)}`);

// Scroll list (đến đáy — max scroll) → button vẫn dính đáy (không trôi lên cùng
// nội dung), sai số cho phép 6px (padding-block list 4px + subpixel DPR=2)
await lmSection.locator('.select-option-list').evaluate((el) => (el.scrollTop = el.scrollHeight / 2));
await page.waitForTimeout(150);
const btnAfterScroll = await lmSection.locator('.select-load-more').evaluate((el) => Math.round(el.getBoundingClientRect().y));
ok('load-more(button): đã scroll → button vẫn dính đáy panel (không trôi lên)',
	Math.abs(btnAfterScroll - btnInfo.y) <= 6, `y0=${Math.round(btnInfo.y)} y1=${btnAfterScroll}`);
await lmSection.locator('.select-option-list').evaluate((el) => (el.scrollTop = 0));

// ── mode pagination ──
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.mouse.move(5, 5);
await nativeSwitch.selectOption('pagination');
await page.waitForTimeout(300);
await openViaChevron(lmSection);
const pgInfo = await lmSection.locator('.select-pagination').evaluate((el) => {
	const cs = getComputedStyle(el);
	return { position: cs.position, bottom: cs.bottom, bg: cs.backgroundColor };
});
ok('load-more(pagination): position sticky, bottom=0, nền opaque',
	pgInfo.position === 'sticky' && pgInfo.bottom === '0px' && !pgInfo.bg.startsWith('rgba(0, 0, 0, 0)'),
	`pos=${pgInfo.position} bg=${pgInfo.bg}`);
// Next page hoạt động được dù không scroll tới cuối
const infoBefore = (await lmSection.locator('.select-pagination__info').textContent())?.trim();
await lmSection.locator('.select-pagination__btn').last().click();
await page.waitForTimeout(200);
const infoAfter = (await lmSection.locator('.select-pagination__info').textContent())?.trim();
ok('load-more(pagination): click Next (đích trong sticky) chuyển page', infoBefore !== infoAfter, `${infoBefore} → ${infoAfter}`);

// ── mode scroll (hint) ──
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.mouse.move(5, 5);
await nativeSwitch.selectOption('scroll');
await page.waitForTimeout(300);
await openViaChevron(lmSection);
const hintInfo = await lmSection.locator('.select-load-more-hint').evaluate((el) => {
	const cs = getComputedStyle(el);
	return { position: cs.position, bottom: cs.bottom };
});
ok('load-more(scroll hint): position sticky, bottom=0 (nhất quán)',
	hintInfo.position === 'sticky' && hintInfo.bottom === '0px', `pos=${hintInfo.position} bottom=${hintInfo.bottom}`);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
mkdirSync('tests/screenshot/select-extra', { recursive: true });
const shotDir = 'tests/screenshot/select-extra';
const fresh = async () => {
	await page.goto(BASE, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });
};
// Chụp theo union bounding box (section + dropdown đang mở) → không bị clip
const shot = async (name, sec, extra) => {
	const rects = [await sec.boundingBox()];
	if (extra) {
		const r = await extra.boundingBox();
		if (r) rects.push(r);
	}
	const vp = await page.viewportSize();
	const pad = 12;
	const x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad);
	const y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
	const x1 = Math.min(vp.width, Math.max(...rects.map((r) => r.x + r.width)) + pad);
	const y1 = Math.min(vp.height, Math.max(...rects.map((r) => r.y + r.height)) + pad);
	if (x1 - x0 < 50 || y1 - y0 < 50) {
		await sec.screenshot({ path: `${shotDir}/${name}.png` });
		return;
	}
	await page.screenshot({ path: `${shotDir}/${name}.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
};

// Ảnh 07-09: union bbox theo {h2, trigger, dropdown} — vì auto-flip có thể đặt
// panel TRÊN trigger, clip theo section + dropdown (mở) vẫn luôn bao trọn cả hai
const shotFull = async (name, sec) => {
	const parts = [
		sec.locator('h2'),
		sec.locator('.select-trigger'),
		sec.locator('.select-dropdown')
	];
	const rects = [];
	for (const p of parts) {
		const r = await p.boundingBox().catch(() => null);
		if (r) rects.push(r);
	}
	const vp = await page.viewportSize();
	const pad = 10;
	const x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad);
	const y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
	const x1 = Math.min(vp.width, Math.max(...rects.map((r) => r.x + r.width)) + pad);
	const y1 = Math.min(vp.height, Math.max(...rects.map((r) => r.y + r.height)) + pad);
	await page.screenshot({ path: `${shotDir}/${name}.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
};

// 07: backdrop mở + trigger có value (Red) — trigger phải NÉT, không bị blur/dim
await fresh();
const bdSec2 = page.locator('section:has(h2:has-text("Backdrop"))');
await openViaChevron(bdSec2);
await bdSec2.locator('.select-option__label', { hasText: 'Red' }).first().click();
await page.waitForTimeout(200);
await openViaChevron(bdSec2); // mở lại để backdrop hiện, trigger đã có value
await page.waitForTimeout(200);
await shotFull('07-backdrop-trigger', bdSec2);

// 08: load-more button — list đã scroll (button vẫn dính đáy panel)
await fresh();
const lmSec2 = page.locator('section:has(h2:has-text("Load-more"))');
await lmSec2.locator('select').selectOption('button');
await page.waitForTimeout(300);
await openViaChevron(lmSec2);
await lmSec2.locator('.select-option-list').evaluate((el) => (el.scrollTop = 64));
await page.waitForTimeout(200);
await shotFull('08-loadmore-button-sticky', lmSec2);

// 09: pagination sticky
await fresh();
const lmSec3 = page.locator('section:has(h2:has-text("Load-more"))');
await lmSec3.locator('select').selectOption('pagination');
await page.waitForTimeout(300);
await openViaChevron(lmSec3);
await lmSec3.locator('.select-option-list').evaluate((el) => (el.scrollTop = 40));
await page.waitForTimeout(200);
await shotFull('09-pagination-sticky', lmSec3);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
