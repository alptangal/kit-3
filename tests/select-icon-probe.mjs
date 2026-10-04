// tests/select-icon-probe.mjs
// Functional probe cho task "icon (iconify) + description cho mỗi option Select":
//  IC0 section demo tồn tại (data-test="select-icon-options")
//  IC1 option render: .select-option__media có <svg> (iconify async) + .select-option__description
//  IC2 trigger sau khi chọn: hiển thị icon (svg trong .select-trigger__avatar) + label
//  IC3 disabled option (Legacy): icon vẫn render nhưng click không chọn
//  IC4 description filter: search "streaming" → chỉ hiện option "Data Pipeline" (mô tả khớp)
//  IC5 không có regression: chevron trigger (.select-trigger__icon) vẫn là 1, không bị đổi
// Chạy: node tests/select-icon-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/select';
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
await page.waitForSelector('h1', { timeout: 20000 });

const sec = page.locator('[data-test="select-icon-options"]');

// IC0 — section demo tồn tại
ok('IC0 section "Icon Options" render', (await sec.count()) === 1);

// IC1 — option render: icon (iconify async → svg) + description bên dưới label.
// Mở dropdown trước (option chỉ render khi panel mở). Iconify fetch async → chờ svg.
await sec.locator('.select-trigger').click();
await sec.locator('.select-option').first().waitFor({ timeout: 4000 });
await sec.locator('.select-option__media svg').first().waitFor({ timeout: 8000 });
const ic1 = await sec.evaluate((root) => {
	const options = [...root.querySelectorAll('.select-option')].filter((o) => !o.classList.contains('create-option'));
	const withMedia = options.filter((o) => o.querySelector('.select-option__media svg'));
	const withDesc = options.filter((o) => o.querySelector('.select-option__description'));
	return {
		total: options.length,
		withMedia: withMedia.length,
		withDesc: withDesc.length,
		labels: options.map((o) => o.querySelector('.select-option__label')?.textContent.trim() ?? ''),
		descs: options.map((o) => o.querySelector('.select-option__description')?.textContent.trim() ?? '')
	};
});
ok('IC1 mỗi option có icon svg trong .select-option__media', ic1.withMedia === ic1.total && ic1.total === 5, JSON.stringify(ic1));
ok('IC1 description render bên dưới label (5 option)', ic1.withDesc === 5, ic1.descs.join(' | '));

// IC2 — chọn option "API Service" → trigger hiện icon + label
// (dropdown đã mở từ IC1 — chỉ click option, không click trigger (tránh đóng panel))
await sec.locator('.select-option__label', { hasText: 'API Service' }).click();
await sleep(300);
const ic2 = await sec.evaluate((root) => {
	const trigger = root.querySelector('.select-trigger');
	const avatar = trigger?.querySelector('.select-trigger__avatar');
	const svg = avatar?.querySelector('svg');
	const fs = svg ? getComputedStyle(svg).fontSize : '';
	const label = trigger?.querySelector('.select-trigger__selected-label')?.textContent.trim();
	return { hasAvatar: !!avatar, hasSvg: !!svg, svgFontSize: fs, label };
});
ok('IC2 trigger hiện icon (svg) sau khi chọn', ic2.hasAvatar && ic2.hasSvg, JSON.stringify(ic2));
ok('IC2 trigger label = "API Service"', ic2.label === 'API Service', ic2.label);
ok('IC2 svg trigger cỡ 16px (font-size 1rem)', ic2.svgFontSize === '16px', ic2.svgFontSize);

// IC3 — disabled option "Legacy": icon render, click không chọn
await sec.locator('.select-trigger').click();
await sec.locator('.select-option').first().waitFor({ timeout: 4000 });
const legacy = sec.locator('.select-option', { hasText: 'Legacy' });
const legacyDisabled = (await legacy.getAttribute('aria-disabled')) === 'true';
await legacy.click().catch(() => {});
await sleep(300);
// đóng dropdown (click trigger)
await sec.locator('.select-trigger').click();
await sleep(200);
const ic3 = await sec.evaluate((root) => {
	const label = root.querySelector('.select-trigger__selected-label')?.textContent.trim();
	return { stillApi: label === 'API Service' };
});
ok('IC3 option disabled có aria-disabled=true', legacyDisabled);
ok('IC3 click option disabled không đổi value (vẫn "API Service")', ic3.stillApi, ic3.stillApi ? '' : JSON.stringify(ic3));

// IC4 — filter theo description: gõ "streaming" → chỉ còn "Data Pipeline"
await sec.locator('.select-trigger').click();
await sec.locator('.select-option').first().waitFor({ timeout: 4000 });
await sec.locator('.select-search-input').first().waitFor({ timeout: 4000 });
const searchInput = sec.locator('.select-search-input').first();
await searchInput.fill('streaming');
await sleep(400);
const ic4 = await sec.evaluate((root) => {
	const options = [...root.querySelectorAll('.select-option')].filter((o) => !o.classList.contains('create-option') && !o.classList.contains('select-all-row'));
	return { labels: options.map((o) => o.querySelector('.select-option__label')?.textContent.trim() ?? '') };
});
ok('IC4 search "streaming" khớp description → chỉ "Data Pipeline"', ic4.labels.length === 1 && ic4.labels[0] === 'Data Pipeline', JSON.stringify(ic4));

// IC5 — regression: chevron trigger (đóng/mở) không bị ảnh hưởng
const ic5 = await sec.evaluate((root) => {
	const trigger = root.querySelector('.select-trigger');
	const chevron = trigger?.querySelector(':scope > .select-trigger__icon, .select-trigger__icon');
	// chevron là inline svg trực tiếp trong Main (không nằm trong .select-trigger__avatar)
	const chevronsOutsideAvatar = [...trigger.querySelectorAll('.select-trigger__icon')].filter((c) => !c.closest('.select-trigger__avatar'));
	return { chevronCount: chevronsOutsideAvatar.length };
});
ok('IC5 chevron trigger vẫn render (không bị rich-icon ghi đè)', ic5.chevronCount >= 1, JSON.stringify(ic5));

// ---- Screenshot (cho ui-checker) ----
const shotDir = 'tests/screenshot/select-icon';
mkdirSync(shotDir, { recursive: true });
// mở dropdown (clear search trước để hiện đủ option)
await searchInput.fill('');
await sleep(300);
// union bbox h2 + trigger + dropdown (auto-flip có thể đặt panel trên trigger)
const parts = [sec.locator('h2'), sec.locator('.select-trigger'), sec.locator('.select-dropdown')];
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
await page.screenshot({ path: `${shotDir}/01-icon-options-open.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });

// đóng dropdown → chụp trigger đã chọn (icon + label)
await sec.locator('.select-trigger').click();
await sleep(300);
await sec.locator('.select-trigger').screenshot({ path: `${shotDir}/02-trigger-selected.png` });

// ---- Tổng kết ----
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
