// tests/screenshot-datetime-minmax.mjs
// Chụp 3 ảnh B4 (Pha 3): dt-minmax invalid (ngày trước minDate), valid (trong
// khoảng), picker tháng 7/2024 (cell ngoài khoảng disabled). Ảnh vào
// test-results/ui-check/ để ui-checker đọc.
import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = 'https://localhost:3000';
const OUT_DIR = 'test-results/ui-check';

async function main() {
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const browser = await chromium.launch({
		headless: true,
		args: ['--ignore-certificate-errors']
	});
	const context = await browser.newContext({
		viewport: { width: 1280, height: 900 },
		colorScheme: 'light'
	});
	const page = await context.newPage();
	await page.goto(`${BASE_URL}/ui/datetime`, { waitUntil: 'networkidle', timeout: 30000 });

	const section = page.locator('[data-test="dt-minmax"]');
	await section.scrollIntoViewIfNeeded();

	// 1. INVALID — gõ 15/05/2024 (< minDate) → error màu + message
	const root = section.locator('.input-datetime-root');
	await root.locator('.dt-box').first().click();
	for (const ch of '15052024') await page.keyboard.type(ch, { delay: 30 });
	await page.waitForTimeout(900); // debounce 300 + animation
	await section.screenshot({ path: path.join(OUT_DIR, 'b4-minmax-invalid.png') });

	// Clear rồi gõ ngày valid 15/06/2024
	const clearBtn = section.locator('.dt-clear');
	if (await clearBtn.count()) await clearBtn.click();
	await page.waitForTimeout(100);
	await root.locator('.dt-box').first().click();
	for (const ch of '15062024') await page.keyboard.type(ch, { delay: 30 });
	await page.waitForTimeout(900);
	await section.screenshot({ path: path.join(OUT_DIR, 'b4-minmax-valid.png') });

	// 3. PICKER — clear, mở panel, navigate tới Tháng 7, 2024
	if (await clearBtn.count()) await clearBtn.click();
	await page.waitForTimeout(100);
	await section.locator('.dt-picker').click();
	await page.waitForTimeout(300);
	const labelLoc = section.locator('[data-dp-month-label]');
	let monthLabel = ((await labelLoc.textContent()) ?? '').trim();
	for (let i = 0; i < 36 && monthLabel !== 'Tháng 7, 2024'; i++) {
		const m = monthLabel.match(/Tháng (\d+), (\d+)/);
		if (!m) break;
		const cur = Number(m[2]) * 12 + (Number(m[1]) - 1);
		const target = 2024 * 12 + 6;
		await section.locator(cur > target ? '[data-dp-prev]' : '[data-dp-next]').click();
		await page.waitForTimeout(100);
		monthLabel = ((await labelLoc.textContent()) ?? '').trim();
	}
	await page.waitForTimeout(200);
	// BẪY (memory): section.screenshot clip CHỈ chụp trong bounds section —
	// panel absolute tràn XUỐNG dưới section sẽ bị cắt. Dùng page.screenshot với
	// clip TỌA ĐỘ VIEWPORT của union rect (section ∪ panel) + margin 16px.
	const rects = await section.evaluate((sec) => {
		const panel = sec.querySelector('[data-dp-panel]');
		const s = sec.getBoundingClientRect();
		const p = panel ? panel.getBoundingClientRect() : null;
		return { s, p };
	});
	const x = Math.min(rects.s.left, rects.p?.left ?? Infinity) - 16;
	const y = rects.s.top - 16;
	const right = Math.max(rects.s.right, (rects.p ? rects.p.right : 0)) + 16;
	const bottom = Math.max(rects.s.bottom, rects.p ? rects.p.bottom : 0) + 16;
	await page.screenshot({
		path: path.join(OUT_DIR, 'b4-minmax-picker.png'),
		clip: { x: Math.max(0, x), y: Math.max(0, y), width: right - x, height: bottom - y }
	});

	await browser.close();
	console.log('DONE — 3 ảnh vào', OUT_DIR);
}

main().catch(err => {
	console.error('Screenshot error:', err);
	process.exitCode = 1;
});
