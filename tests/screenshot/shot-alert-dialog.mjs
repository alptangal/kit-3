// tests/screenshot/shot-alert-dialog.mjs (temp)
// Chụp 2 screenshot alert-dialog: 01-open (danger), 02-info.
// Chờ icon @iconify load (SVG async từ Iconify API — có thể 1-2s+).
import { chromium } from '@playwright/test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitIcon(page, section) {
	// Poll cho tới khi span.icon trong header chứa <svg> (iconify mount xong).
	for (let i = 0; i < 40; i++) {
		const has = await page.evaluate((sel) => {
			const header = document.querySelector(sel);
			return !!header && !!header.querySelector('.leading svg');
		}, section);
		if (has) return true;
		await sleep(250);
	}
	return false;
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();

await page.goto('https://localhost:3000/ui/alert-dialog', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="alertdialog-demo"]', { timeout: 20000 });
await sleep(400);

// 01 — danger: mở dialog "Xóa sản phẩm", chờ icon, chụp.
await page.locator('[data-test="ad-danger"] [data-ad-trigger] button').click();
await sleep(350);
const dangerSection = '[data-test="ad-danger"] [data-ad-header]';
const icon1 = await waitIcon(page, dangerSection);
console.log('01 icon loaded:', icon1);
await page.screenshot({ path: 'tests/screenshot/alert-dialog/01-alert-dialog-open.png' });
await page.keyboard.press('Escape');
await sleep(250);

// 02 — info: mở dialog info (primary action), chờ icon, chụp.
await page.locator('[data-test="ad-info"] [data-ad-trigger] button').click();
await sleep(350);
const infoSection = '[data-test="ad-info"] [data-ad-header]';
const icon2 = await waitIcon(page, infoSection);
console.log('02 icon loaded:', icon2);
await page.screenshot({ path: 'tests/screenshot/alert-dialog/02-alert-dialog-info.png' });

await browser.close();
console.log('done');
