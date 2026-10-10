// radiogroup-audit-screenshot.mjs
// Chụp section sizes (14 group, tổng cao ~3.4k CSS px). 2 bẫy đã gặp:
// 1) element.screenshot scroll-stitch → TRẮNG đoạn trên;
// 2) page.screenshot + clip CAO HƠN viewport → vẫn phải stitch → hụt tương tự.
// Fix: viewport height 2800 > clip cao nhất (2660) → không bao giờ stitch,
// page.screenshot + clip theo union boundingBox.
// Ảnh: 01a 2xs→xl (~666px) / 01b 2xl→9xl (~2640px) + colors + required + disabled.
// Chạy: node tests/radiogroup-audit-screenshot.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const shotDir = 'tests/screenshot/radiogroup';
mkdirSync(shotDir, { recursive: true });
// Xóa ảnh cũ lỗi (scroll-stitch trắng / hụt)
for (const f of [
	'audit-01-sizes.png',
	'audit-01a-sizes-small.png',
	'audit-01b-sizes-large.png',
	'audit-01b-sizes-2xl-4xl.png',
	'audit-01c-sizes-5xl-7xl.png',
	'audit-01d-sizes-8xl-9xl.png'
]) {
	rmSync(`${shotDir}/${f}`, { force: true });
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 2800 }, // > clip cao nhất → không stitch
	deviceScaleFactor: 2
});
const page = await context.newPage();
await page.goto(`${BASE}/ui/radiogroup`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="rg-sizes"] .radiogroup-root.size-9xl', { timeout: 20000 });
await page.waitForTimeout(400); // iconify + layout settle

// Union boundingBox các group từ first..last (selector) — page.screenshot clip
const clipUnion = async (firstSel, lastSel) => {
	const a = await page.locator(firstSel).boundingBox();
	const b = await page.locator(lastSel).boundingBox();
	if (!a || !b) throw new Error(`missing box: ${firstSel} / ${lastSel}`);
	return {
		x: Math.min(a.x, b.x),
		y: Math.min(a.y, b.y),
		width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
		height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y)
	};
};

const sizesBatch = async (name, first, last) => {
	const clip = await clipUnion(
		`[data-test="rg-sizes"] .radiogroup-root.size-${first}`,
		`[data-test="rg-sizes"] .radiogroup-root.size-${last}`
	);
	if (clip.height > 2800)
		throw new Error(`${name}: clip ${clip.height}px vượt viewport → stitch trắng`);
	await page.screenshot({ path: `${shotDir}/${name}.png`, clip });
	console.log(name, JSON.stringify(clip));
};

await sizesBatch('audit-01a-sizes-small', '2xs', 'xl'); // ~666px
await sizesBatch('audit-01b-sizes-large', '2xl', '9xl'); // ~2640px

// Colors + required + disabled (section thấp — element.screenshot ổn, chụp lại
// ở context sạch để tránh state dính hover từ probe)
await page.locator('[data-test="rg-colors"]').screenshot({ path: `${shotDir}/audit-02-colors.png` });
await page.locator('[data-test="rg-required"]').screenshot({ path: `${shotDir}/audit-03-required.png` });
await page.locator('[data-test="rg-disabled"]').screenshot({ path: `${shotDir}/audit-04-disabled.png` });

await browser.close();
console.log('DONE — shots in', shotDir);
