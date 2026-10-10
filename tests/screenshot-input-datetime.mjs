// tests/screenshot-input-datetime.mjs
// Chụp sections demo datetime cho ui-checker (Pha 2 — 5 tính năng).
// Bẫy đã học: viewport height > clip cao nhất; ảnh đầu sau goto trắng → ép
// repaint + settle animations; page.screenshot + clip boundingBox.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const OUT = 'test-results/ui-check/datetime';

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const page = await browser.newPage({
	viewport: { width: 1280, height: 2800 },
	ignoreHTTPSErrors: true
});
await page.goto(`${BASE}/ui/datetime`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

fs.mkdirSync(OUT, { recursive: true });

// Shot helper: clip = union boundingBox của section (an toàn page.screenshot)
async function shot(testId, name) {
	const el = page.locator(`[data-test="${testId}"]`);
	const box = await el.boundingBox();
	if (!box) {
		console.error(`MISSING section ${testId}`);
		return;
	}
	await page.screenshot({
		path: path.join(OUT, `${name}.png`),
		clip: { x: box.x, y: box.y, width: Math.max(box.width, 400), height: Math.min(box.height, 2600) }
	});
	console.log(`SHOT ${name}.png (${Math.round(box.width)}x${Math.round(box.height)})`);
}

// 1) Format đa ngôn ngữ — tab dmy active + field điền sẵn
await shot('dt-format', 'dt-format');
// 2) Picker đang MỞ (panel + field) — click nút lịch trước khi chụp
await page.locator('[data-test="dt-picker"] .dt-picker').click();
await page.waitForTimeout(400);
await shot('dt-picker', 'dt-picker-open');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
// 3) Clamp section
await shot('dt-clamp', 'dt-clamp');
// 4) Toàn trang (scroll lớn) — giá trị tổng quan
await page.screenshot({ path: path.join(OUT, 'dt-full-page.png'), fullPage: true });
console.log('SHOT dt-full-page.png (fullPage)');

await browser.close();
console.log('DONE');
