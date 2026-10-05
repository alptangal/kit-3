// take-textarea-shots.mjs — chụp screenshot Textarea theo section + từng state (error/valid/maxlength/disabled/sizes).
// Chạy: node tests/take-textarea-shots.mjs (dev server https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/textarea';
const dir = 'tests/screenshot/textarea';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="textarea-demo"]', { timeout: 30000 });
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(500);

// 1) basic (trống, default)
await page.locator('[data-test="ta-basic"]').screenshot({ path: `${dir}/01-basic.png` });

// 2) required: BLANK → lỗi "bắt buộc" (màu đỏ)
const req = page.locator('[data-test="ta-required"] textarea');
await req.fill('nội dung hợp lệ');
await req.blur();
await page.waitForTimeout(500);
await req.fill('');
await req.blur();
await page.waitForTimeout(500);
await page.locator('[data-test="ta-required"]').screenshot({ path: `${dir}/02-required-error.png` });

// 3) required: fill hợp lệ + showValid ON → success (xanh) + message valid
await req.fill('nội dung hợp lệ');
await req.blur();
await page.waitForTimeout(500);
await page.locator('[data-test="ta-showvalid"]').check();
await page.waitForTimeout(200);
await page.locator('[data-test="ta-required"]').screenshot({ path: `${dir}/02-required-fieldmessages.png` });

// 4) auto-resize: fill nhiều dòng → height giãn (clamp 20rem)
const auto = page.locator('[data-test="ta-auto"] textarea');
await auto.fill(Array.from({ length: 24 }, (_, i) => `dòng ${i + 1}`).join('\n'));
await page.waitForTimeout(300);
await page.locator('[data-test="ta-auto"]').screenshot({ path: `${dir}/03-auto-resize.png` });

// 5) maxlength: fill tới giới hạn + counter
const max = page.locator('[data-test="ta-maxlength"] textarea');
await max.fill('x'.repeat(100));
await page.waitForTimeout(200);
await page.locator('[data-test="ta-maxlength"]').screenshot({ path: `${dir}/05-maxlength.png` });

// 6) disabled + readOnly (đã có sẵn giá trị trong demo)
await page.locator('[data-test="ta-disabled"]').screenshot({ path: `${dir}/06-disabled-readonly.png` });

// 7) sizes (sm/md/lg)
await page.locator('[data-test="ta-sizes"]').screenshot({ path: `${dir}/07-sizes.png` });

// 8) composite: app layout bọc .page trong <Container class="overflow-auto" height=viewport>
// (src/routes/+layout.svelte) → container scroll cao = viewport, clip phần trên khi
// element/fullPage-screenshot. Expand container (height:auto + overflow:visible, tắt
// transition) trong script test, không sửa file code → fullPage bắt trọn từ đầu.
await page.evaluate(() => {
	// Scroll-container = ancestor `div.w-full.h-full.<hash>` (class hash scoped của
	// Container, overflow-y:auto + height=viewport). Duyệt từ .page lên root, expand
	// MỌI ancestor có scroll để fullPage bắt trọn (không sửa file code).
	let el = document.querySelector('[data-test="textarea-demo"]');
	while (el && el !== document.documentElement) {
		if (el instanceof HTMLElement) {
			el.style.transition = 'none';
			el.style.height = 'auto';
			el.style.overflow = 'visible';
			el.scrollTop = 0;
		}
		el = el.parentElement;
	}
	document.documentElement.style.overflow = 'visible';
	document.documentElement.style.height = 'auto';
	document.body.style.overflow = 'visible';
	document.body.style.height = 'auto';
	window.scrollTo(0, 0);
});
await page.waitForTimeout(200);
await page.screenshot({ path: `${dir}/01-textarea-cases.png`, fullPage: true });

await browser.close();
console.log('TEXTAREA SHOTS DONE: 8 files in', dir);
