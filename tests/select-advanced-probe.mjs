// select-advanced-probe.mjs
// Functional + computed-style probe cho 5 tính năng nâng cao Select:
// (1) chip overflow (2) padding option (3) fullscreen (4) backdrop (5) auto-flip
// Chạy: node tests/select-advanced-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000/ui/select';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
// Mở dropdown bằng chevron (tránh click trúng chip ×) + chờ option render
const openViaChevron = async (sec) => {
	await sec.locator('.select-trigger__icon').click();
	await sec.locator('.select-option').first().waitFor({ timeout: 4000 });
};
// Đọc value thật (paragraph "Selected: <code>..."), tránh bắt nhầm <code> trong mô tả
const valueCode = (sec) => sec.locator('p:has-text("Selected") code');

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2 // ảnh nét hơn cho ui-checker
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

// ── (1) CHIP OVERFLOW (multiple, trigger full-width) ──
console.log('\n=== 1. CHIP OVERFLOW ===');
const chipSection = page.locator('section:has(h2:text("Chip Overflow (multiple)"))');

// Chọn 6 option (mở dropdown, click lần lượt)
await openViaChevron(chipSection);
for (const name of ['Vue.js Framework', 'React Ecosystem', 'SvelteKit Advanced', 'Angular Universal', 'SolidUI Core', 'Qwik Astro']) {
	await chipSection.locator('.select-option__label', { hasText: name }).first().click();
	await page.waitForTimeout(60);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
await page.waitForSelector('.select-chips .tag-root', { timeout: 3000 });
await page.waitForTimeout(150);

const chipCount = await chipSection.locator('.select-chips .tag-root').count();
ok('chips render trong trigger', chipCount >= 1, `chipCount=${chipCount}`);
const chipTexts = await chipSection.locator('.select-chips .tag-text').allTextContents();
const hasPlus = chipTexts.some((t) => /^\+\d+$/.test(t.trim()));
ok('chip +N hiện khi overflow (trigger hẹp)', hasPlus, `chips=[${chipTexts.join(' | ')}]`);
const chipCode = await valueCode(chipSection).textContent();
ok('value giữ đủ 6 option (chỉ hiển thị thu gọn)', chipCode.includes('vuejs') && chipCode.includes('qtafw') && chipCode.includes('solidui'), chipCode.trim());

// Bấm × trên chip (visible) → value ngắn lại + onChipRemove emit
const beforeRemove = (await valueCode(chipSection).textContent()).trim();
const firstChipRemove = chipSection.locator('.select-chips .tag-remove').last();
await firstChipRemove.click();
await page.waitForTimeout(200);
const afterRemove = (await valueCode(chipSection).textContent()).trim();
ok('bấm × chip → value ngắn lại', afterRemove.length < beforeRemove.length, `${beforeRemove} → ${afterRemove}`);
ok('onChipRemove emit (log hiện)', (await chipSection.locator('p', { hasText: 'onChipRemove' }).count()) >= 1);

// Single-mode: không render tag (chỉ text)
const singleSec = page.locator('section:has(h2:text("Single Select"))');
await openViaChevron(singleSec);
await singleSec.locator('.select-option__label', { hasText: 'Apple' }).first().click();
await page.waitForTimeout(150);
ok('single-mode: không có chip (text thường)', (await singleSec.locator('.select-chips .tag-root').count()) === 0 && (await singleSec.locator('.select-trigger__value').textContent()).trim() === 'Apple');

// ── (2) PADDING OPTION ĐẦU/CUỐI ──
console.log('\n=== 2. PADDING OPTION-LIST ===');
await openViaChevron(singleSec);
await page.waitForSelector('.select-option-list', { timeout: 3000 });
const listPad = await singleSec.locator('.select-option-list').evaluate((el) => {
	const cs = getComputedStyle(el);
	return { block: cs.paddingTop, inline: cs.paddingLeft };
});
ok('list có padding-block (top) ≠ 0', listPad.block !== '0px', `padding-top=${listPad.block}`);
ok('list có padding-inline (left) ≠ 0', listPad.inline !== '0px', `padding-left=${listPad.inline}`);
await singleSec.locator('.select-option-list').evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(100);
const lastOk = await singleSec.locator('.select-option-list').evaluate((el) => {
	const opts = el.querySelectorAll('.select-option');
	const last = opts[opts.length - 1];
	if (!last) return -1;
	return el.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom;
});
ok('option cuối không clip khi scroll đáy', lastOk >= 0, `bottom-margin=${lastOk}px`);

// ── (5) AUTO-FLIP ──
console.log('\n=== 5. AUTO-FLIP ===');
const flipSection = page.locator('section:has(h2:text("Auto-Flip Position"))');
const flipBottom = flipSection.locator('.select-trigger').last();
const flipTop = flipSection.locator('.select-trigger').first();

// Đưa select đáy tới đáy viewport (block:'end') → không gian phía dưới cực nhỏ → phải flip UP
await flipBottom.evaluate((el) => el.scrollIntoView({ block: 'end', inline: 'center' }));
await page.waitForTimeout(100);
await flipBottom.click();
await page.waitForSelector('.select-dropdown', { timeout: 3000 });
await page.waitForTimeout(250); // rAF computePlacement
const upCount = await flipSection.locator('.select-dropdown--up').count();
ok('select đáy → panel UP (--up)', upCount === 1, `upCount=${upCount}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// Đưa select top tới đầu viewport (block:'start') → nhiều không gian dưới → DOWN
await flipTop.evaluate((el) => el.scrollIntoView({ block: 'start', inline: 'center' }));
await page.waitForTimeout(100);
await flipTop.click();
await page.waitForSelector('.select-dropdown', { timeout: 3000 });
await page.waitForTimeout(250);
ok('select top → panel DOWN (không --up)', (await flipSection.locator('.select-dropdown--up').count()) === 0);
await page.keyboard.press('Escape');

// ── (3) FULLSCREEN ──
console.log('\n=== 3. FULLSCREEN ===');
const fsSection = page.locator('section:has(h2:text("Fullscreen"))');
await fsSection.locator('.select-trigger').click();
await page.waitForSelector('.select-dropdown--fullscreen', { timeout: 3000 });
await page.waitForTimeout(200);
const fsInfo = await fsSection.locator('.select-dropdown--fullscreen').evaluate((el) => {
	const cs = getComputedStyle(el);
	return {
		pos: cs.position,
		z: parseInt(cs.zIndex, 10),
		w: el.getBoundingClientRect().width,
		bodyOverflow: document.body.style.overflow
	};
});
const vw = await page.evaluate(() => window.innerWidth);
ok('fullscreen: position fixed', fsInfo.pos === 'fixed', fsInfo.pos);
ok('fullscreen: z-index ≥ 9000', fsInfo.z >= 9000, `z=${fsInfo.z}`);
ok('fullscreen: width ≈ viewport', Math.abs(fsInfo.w - vw) <= 2, `w=${fsInfo.w} vw=${vw}`);
ok('fullscreen: header + nút close hiện', (await fsSection.locator('.select-fullscreen-header').count()) === 1 && (await fsSection.locator('.select-fullscreen-close').count()) === 1);
ok('fullscreen: body overflow=hidden (khóa scroll)', fsInfo.bodyOverflow === 'hidden', fsInfo.bodyOverflow);
await fsSection.locator('.select-option', { hasText: 'Red' }).click();
await page.waitForTimeout(150);
ok('fullscreen: chọn option → value cập nhật', (await fsSection.locator('p:has-text("Selected") code').textContent()).trim() === 'red');
await fsSection.locator('.select-trigger').click();
await page.waitForSelector('.select-dropdown--fullscreen', { timeout: 3000 });
await fsSection.locator('.select-fullscreen-close').click();
await page.waitForTimeout(150);
ok('fullscreen: nút close → panel đóng', (await fsSection.locator('.select-dropdown--fullscreen').count()) === 0);
const bodyRestored = await page.evaluate(() => document.body.style.overflow);
ok('fullscreen: body overflow restore sau khi đóng', bodyRestored !== 'hidden', `overflow=${bodyRestored || '(empty)'}`);

// ── (4) BACKDROP ──
console.log('\n=== 4. BACKDROP ===');
const bdSection = page.locator('section:has(h2:text("Backdrop (blur nền)"))');
await bdSection.locator('.select-trigger').click();
await page.waitForSelector('.select-backdrop', { timeout: 3000 });
await page.waitForTimeout(200);
const bdInfo = await bdSection.locator('.select-backdrop').evaluate((el) => {
	const cs = getComputedStyle(el);
	return { z: parseInt(cs.zIndex, 10), blur: cs.backdropFilter, pos: cs.position };
});
ok('backdrop: render khi mở', (await bdSection.locator('.select-backdrop').count()) === 1);
ok('backdrop: z-index = 40', bdInfo.z === 40, `z=${bdInfo.z}`);
ok('backdrop: backdrop-filter ≠ none', bdInfo.blur !== 'none', bdInfo.blur);
ok('backdrop: position fixed', bdInfo.pos === 'fixed', bdInfo.pos);
await page.mouse.down({ x: 30, y: 30 });
await page.mouse.up({ x: 30, y: 30 });
await page.waitForTimeout(200);
ok('backdrop: click nền → panel đóng', (await bdSection.locator('.select-dropdown').count()) === 0);
const noBdSec = page.locator('section:has(h2:text("Single Select"))');
await openViaChevron(noBdSec);
ok('mặc định: không render backdrop', (await page.locator('.select-backdrop').count()) === 0);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/select-advanced';
const fresh = async () => {
	await page.goto(BASE, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });
};
// Chụp theo union bounding box (section + dropdown đang mở) → không bị clip phần dropdown
// Clamp vào viewport vì dropdown có thể vươn ra ngoài section (position:absolute)
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

// 01: chips fit (3 option, trigger full-width → đủ chỗ, không +N)
await fresh();
let cSec = page.locator('section:has(h2:text("Chip Overflow (multiple)"))');
await cSec.locator('.select-trigger__icon').click();
await cSec.locator('.select-option').first().waitFor({ timeout: 4000 });
for (const name of ['Vue.js Framework', 'React Ecosystem', 'SvelteKit Advanced']) {
	await cSec.locator('.select-option__label', { hasText: name }).first().click();
	await page.waitForTimeout(50);
}
await page.keyboard.press('Escape');
await page.waitForSelector('.select-chips .tag-root', { timeout: 3000 });
await page.waitForTimeout(250);
await shot('01-chips-fit', cSec);

// 02: chips overflow (thêm 3 → 6 option chọn → +N + nút ×)
// (Preact/Lit là option 7-8 — ngoài maxOptions(6), không render khi chưa scroll)
await cSec.locator('.select-trigger__icon').click();
await cSec.locator('.select-option').first().waitFor({ timeout: 4000 });
for (const name of ['Angular Universal', 'SolidUI Core', 'Qwik Astro']) {
	await cSec.locator('.select-option__label', { hasText: name }).first().click();
	await page.waitForTimeout(50);
}
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await shot('02-chips-overflow', cSec);

// 03: option đầu/cuối (mở list, không clip) — clip theo union section+dropdown
await fresh();
const sSec = page.locator('section:has(h2:text("Single Select"))');
await sSec.locator('.select-trigger__icon').click();
await sSec.locator('.select-option').first().waitFor({ timeout: 3000 });
await page.waitForTimeout(200);
await shot('03-option-padding', sSec, sSec.locator('.select-dropdown'));

// 04: auto-flip UP (select đáy)
await fresh();
const fSec = page.locator('section:has(h2:text("Auto-Flip Position"))');
const fBottom = fSec.locator('.select-trigger').last();
await fBottom.evaluate((el) => el.scrollIntoView({ block: 'end', inline: 'center' }));
await page.waitForTimeout(100);
await fBottom.click();
await page.waitForSelector('.select-dropdown', { timeout: 3000 });
await page.waitForTimeout(250);
await shot('04-auto-flip-up', fSec, fSec.locator('.select-dropdown').first());

// 05: auto-flip DOWN (select top)
await fresh();
const fTop = page.locator('section:has(h2:text("Auto-Flip Position")) .select-trigger').first();
await fTop.evaluate((el) => el.scrollIntoView({ block: 'start', inline: 'center' }));
await page.waitForTimeout(100);
await fTop.click();
await page.waitForSelector('.select-dropdown', { timeout: 3000 });
await page.waitForTimeout(250);
await shot('05-auto-flip-down', fSec, fSec.locator('.select-dropdown').first());

// 06: fullscreen
await fresh();
const fsSec = page.locator('section:has(h2:text("Fullscreen"))');
await fsSec.locator('.select-trigger').click();
await page.waitForSelector('.select-dropdown--fullscreen', { timeout: 3000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/06-fullscreen.png` });

// 07: backdrop (mở, nền mờ+blur)
await fresh();
const bdSec = page.locator('section:has(h2:text("Backdrop (blur nền)"))');
await bdSec.locator('.select-trigger').click();
await page.waitForSelector('.select-backdrop', { timeout: 3000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/07-backdrop.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
