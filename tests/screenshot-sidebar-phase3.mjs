// tests/screenshot-sidebar-phase3.mjs
// Chụp 3 ảnh B3 (Pha 3): expanded (brand+trigger CÙNG 1 ROW), collapsed (2 row
// dọc), peek hover (về layout full). Ảnh vào test-results/ui-check/b3-* để
// ui-checker đọc (không commit).
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
	await page.goto(`${BASE_URL}/ui/sidebar`, { waitUntil: 'networkidle', timeout: 30000 });

	// Settle animation (label stream / transition width) trước khi chụp
	await page.waitForTimeout(600);

	// 1. EXPANDED — brand + trigger cùng 1 row
	await page.screenshot({ path: path.join(OUT_DIR, 'b3-sidebar-expanded.png') });

	// 2. COLLAPSED — click trigger, move chuột ra ngoài aside (tắt peek hover)
	const triggerBtn = page.locator('[data-test="sb-trigger-row"] button.sidebar-trigger');
	await triggerBtn.waitFor({ state: 'visible', timeout: 10000 });
	await triggerBtn.click();
	await page.mouse.move(900, 450);
	await page.waitForFunction(
		() => {
			const el = document.querySelector('.sidebar-aside');
			return el && el.getBoundingClientRect().width < 100;
		},
		{ timeout: 5000 }
	).catch(() => {});
	await page.waitForTimeout(300);
	await page.screenshot({ path: path.join(OUT_DIR, 'b3-sidebar-collapsed.png') });

	// 3. PEEK — hover aside → mở rộng tạm + name hiện lại
	await page.locator('.sidebar-aside').hover();
	await page.waitForTimeout(300);
	await page.screenshot({ path: path.join(OUT_DIR, 'b3-sidebar-peek-hover.png') });

	await browser.close();
	console.log('DONE — 3 ảnh vào', OUT_DIR);
}

main().catch(err => {
	console.error('Screenshot error:', err);
	process.exitCode = 1;
});
