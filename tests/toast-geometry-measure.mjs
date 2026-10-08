// tests/toast-geometry-measure.mjs
// Đo hình học DOM hiện tại của toast: align-items của .toast-root, vị trí
// icon (Indicator) vs title (Title) theo trục dọc, và kích thước close button.
// Chạy TRƯỚC và SAU khi sửa để verify nguyên nhân + kết quả.
import { chromium } from '@playwright/test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = process.env.PORT || 3000;
const BASE = `https://localhost:${PORT}`;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(`${BASE}/ui/toast`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 30000 });
await sleep(500);

// Bấm nút Success demo → toast có icon + title + description + action
await page.locator('[data-test="toast-btn-success"]').click();
await page
	.locator('.toast-root', { hasText: 'Đã lưu thành công' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(400);

const measure = await page.evaluate(() => {
	const root = [...document.querySelectorAll('.toast-root')].find((r) =>
		r.textContent?.includes('Đã lưu thành công')
	);
	if (!root) return null;
	const rs = getComputedStyle(root);
	const rootRect = root.getBoundingClientRect();

	// Indicator: div rỗng bọc Icon (span.icon) bọc iconify svg
	const indicator = root.querySelector('.toast-root > div[aria-hidden="true"]');
	const iconSpan = root.querySelector('.icon');
	const svg = root.querySelector('svg');
	const iconRect = (svg ?? iconSpan ?? indicator)?.getBoundingClientRect();

	// Content + Title + Description
	const content = root.querySelector('.toast-content-root');
	const title = root.querySelector('.toast-content-title-root');
	const desc = root.querySelector('.description-root');
	const contentRect = content?.getBoundingClientRect();
	const titleRect = title?.getBoundingClientRect();
	const descRect = desc?.getBoundingClientRect();

	// Action button (Xem lại)
	const actionBtn = [...root.querySelectorAll('button')].find((b) =>
		b.textContent?.includes('Xem lại')
	);
	const actionRect = actionBtn?.getBoundingClientRect();

	return {
		root: {
			display: rs.display,
			alignItems: rs.alignItems,
			rect: { x: Math.round(rootRect.x), y: Math.round(rootRect.y), w: Math.round(rootRect.width), h: Math.round(rootRect.height) }
		},
		icon: iconRect
			? { y: Math.round(iconRect.y), cy: Math.round(iconRect.y + iconRect.height / 2), h: Math.round(iconRect.height), w: Math.round(iconRect.width) }
			: null,
		content: contentRect
			? { y: Math.round(contentRect.y), cy: Math.round(contentRect.y + contentRect.height / 2), h: Math.round(contentRect.height) }
			: null,
		title: titleRect
			? { y: Math.round(titleRect.y), cy: Math.round(titleRect.y + titleRect.height / 2), h: Math.round(titleRect.height) }
			: null,
		desc: descRect
			? { y: Math.round(descRect.y), cy: Math.round(descRect.y + descRect.height / 2), h: Math.round(descRect.height) }
			: null,
		action: actionRect
			? { y: Math.round(actionRect.y), cy: Math.round(actionRect.y + actionRect.height / 2), h: Math.round(actionRect.height), w: Math.round(actionRect.width) }
			: null
	};
});

console.log('== Measure (Success toast) ==');
console.log(JSON.stringify(measure, null, 2));

// ── Close button: hover toast để nút hiện ──
await page.locator('.toast-root', { hasText: 'Đã lưu thành công' }).hover();
await sleep(300);
const closeMeasure = await page.evaluate(() => {
	const root = [...document.querySelectorAll('.toast-root')].find((r) =>
		r.textContent?.includes('Đã lưu thành công')
	);
	if (!root) return null;
	const btn = root.querySelector('button[aria-label="Đóng thông báo"]');
	if (!btn) return { found: false };
	const rect = btn.getBoundingClientRect();
	const s = getComputedStyle(btn);
	return {
		found: true,
		w: Math.round(rect.width),
		h: Math.round(rect.height),
		aspectRatio: s.aspectRatio,
		padding: s.padding,
		cls: btn.className
	};
});
console.log('== Close button (hover) ==');
console.log(JSON.stringify(closeMeasure, null, 2));

await browser.close();
console.log('done');
