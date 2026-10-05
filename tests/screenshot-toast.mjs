// tests/screenshot-toast.mjs
// Chụp 2 screenshot Toast (DSF2, light): 01-success.png (1 toast success + action),
// 02-multiple.png (3 toast ở 3 position khác nhau: bottom/top/right).
// Chờ icon @iconify load (SVG async từ Iconify API — có thể 1-2s+).
import { chromium } from '@playwright/test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/toast', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 20000 });
await sleep(400);

// Chờ iconify mount: poll đến khi .toast-root có >=1 svg (indicator) hoặc hết timeout.
async function waitToastIcons(page, need) {
	for (let i = 0; i < 40; i++) {
		const count = await page.evaluate((n) => {
			const roots = [...document.querySelectorAll('.toast-root')];
			return roots.filter((r) => r.querySelector('svg')).length;
		}, need);
		if (count >= need) return true;
		await sleep(250);
	}
	return false;
}

// 01 — success: 1 toast có indicator + action "Xem lại".
await page.locator('[data-test="toast-btn-success"]').click();
await page.locator('.toast-root', { hasText: 'Đã lưu thành công' }).waitFor({ state: 'visible', timeout: 5000 });
const icon1 = await waitToastIcons(page, 1);
console.log('01 success icon loaded:', icon1);
await sleep(250);
await page.screenshot({ path: 'tests/screenshot/toast/01-success.png' });

// Đợi toast success tự biến mất (auto-dismiss ~3s) trước khi stack, tránh overlap.
await sleep(3400);

// 02 — multiple: 3 toast ở 3 position KHÁC nhau (bottom=info, top=warning, right=success),
// mỗi cái có indicator + `duration: 'infinite'` (không tự dismiss) → chờ đủ 3 icon load
// rồi chụp; không lo overlap/auto-dismiss.
await page.locator('[data-test="toast-btn-stack"]').click();
await page.locator('.toast-root', { hasText: 'Tin nhắn 3' }).waitFor({ state: 'visible', timeout: 5000 });
const icon2 = await waitToastIcons(page, 3);
const stackCount = await page.locator('.toast-root').count();
console.log('02 multiple icons loaded:', icon2, '· toasts:', stackCount);
await sleep(300);
await page.screenshot({ path: 'tests/screenshot/toast/02-multiple.png' });

await browser.close();
console.log('done');
