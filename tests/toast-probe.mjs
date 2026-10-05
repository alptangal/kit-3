// tests/toast-probe.mjs
// Verify Toast (element) — reactive store `toast.*` + ToastWrapper render + a11y +
// close + action + auto-dismiss.
// Trang demo: /ui/toast (ToastWrapper data-test="toast-wrapper" là owner; wrapper
// global trong root layout nhường chỗ nhờ dedup → toast render MỘT LẦN).
//
// Kiểm tra:
//  T0 .toast-wrapper (owner) render
//  T1 ban đầu: chưa có toast nào
//  T2 click success → đúng 1 toast, title + description THẬT (không "Hello description")
//  T3 success: role=alert + aria-live=assertive + class color-success
//  T4 error: role=alert + class color-error
//  T5 hover toast + click nút đóng (aria-label "Đóng thông báo") → toast biến mất
//  T6 click action "Xem lại" → page state toast-action-log đổi
//  T7 auto-dismiss ~3s (toast mới tự biến mất)
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL' }  ${name}${extra ? '  → ' + extra : ''}`);
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

// ============ /ui/toast ============
await page.goto('https://localhost:3000/ui/toast', { waitUntil: 'domcontentloaded' });

// T0 — wrapper owner render (attached: div rỗng 0×0 khi chưa có toast nên không "visible")
await page.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 20000 });
const wrapperCount = await page.locator('[data-test="toast-wrapper"]').count();
ok('T0 .toast-wrapper (owner) render', wrapperCount === 1, `count=${wrapperCount}`);

// T1 — ban đầu chưa có toast
await sleep(500); // để hết mount + iconify warm-up không tạo toast thừa
const initialCount = await page.locator('.toast-root').count();
ok('T1 ban đầu: chưa có toast nào', initialCount === 0, `count=${initialCount}`);

// T2 — click success → đúng 1 toast, title + description thật
await page.locator('[data-test="toast-btn-success"]').click();
await page
	.locator('.toast-root', { hasText: 'Đã lưu thành công' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(200);
const successState = await page.evaluate(() => {
	const roots = [...document.querySelectorAll('.toast-root')];
	const s = roots.find((r) => r.textContent?.includes('Đã lưu thành công'));
	return {
		total: roots.length,
		found: !!s,
		title: s ? s.querySelector('.toast-content-title-root')?.textContent : null,
		description: s ? s.querySelector('.description-root')?.textContent : null,
		hasHello: s ? s.textContent?.includes('Hello description') : false
	};
});
ok(
	'T2 success → đúng 1 toast + title/description thật (không "Hello description")',
	successState.total === 1 &&
		successState.found &&
		successState.title === 'Đã lưu thành công' &&
		successState.description === 'Dữ liệu đã được ghi vào cơ sở dữ liệu.' &&
		!successState.hasHello,
	JSON.stringify(successState)
);

// T3 — a11y success: role=alert + assertive + color-success
const a11ySuccess = await page.evaluate(() => {
	const s = [...document.querySelectorAll('.toast-root')].find((r) =>
		r.textContent?.includes('Đã lưu thành công')
	);
	if (!s) return null;
	const cls = s.className ?? '';
	return {
		role: s.getAttribute('role'),
		ariaLive: s.getAttribute('aria-live'),
		colorSuccess: cls.includes('color-success'),
		position: s.getAttribute('data-position')
	};
});
ok(
	'T3 success: role=alert + aria-live=assertive + class color-success',
	a11ySuccess?.role === 'alert' &&
		a11ySuccess?.ariaLive === 'assertive' &&
		a11ySuccess?.colorSuccess === true,
	JSON.stringify(a11ySuccess)
);

// T4 — error: role=alert + color-error (toast success vẫn sống song song trong 3s)
await page.locator('[data-test="toast-btn-error"]').click();
await page
	.locator('.toast-root', { hasText: 'Lưu thất bại' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(200);
const a11yError = await page.evaluate(() => {
	const roots = [...document.querySelectorAll('.toast-root')];
	const e = roots.find((r) => r.textContent?.includes('Lưu thất bại'));
	if (!e) return null;
	const cls = e.className ?? '';
	return {
		total: roots.length,
		role: e.getAttribute('role'),
		ariaLive: e.getAttribute('aria-live'),
		colorError: cls.includes('color-error')
	};
});
ok(
	'T4 error: role=alert + aria-live=assertive + class color-error (2 toast song song)',
	a11yError?.total === 2 &&
		a11yError?.role === 'alert' &&
		a11yError?.ariaLive === 'assertive' &&
		a11yError?.colorError === true,
	JSON.stringify(a11yError)
);

// T5 — hover toast + click nút đóng (aria-label "Đóng thông báo") → toast biến mất.
// Bẫy stacking: 2 toast cùng position bottom → overlap, pointer event có thể rơi
// vào toast nằm dưới (DOM after) khi hover toast trên. Để hover 1 cách sạch, dùng
// nút "Xóa (last)" (toast.remove(lastToast)) xóa toast cuối (error, vì triggerError
// set lastToast sau cùng) → chỉ còn success (1 toast, không overlap) → hover +
// click close (aria-label) → success biến mất.
await page.locator('[data-test="toast-btn-remove"]').click();
await page
	.locator('.toast-root', { hasText: 'Lưu thất bại' })
	.waitFor({ state: 'detached', timeout: 5000 });
const successToast = page.locator('.toast-root', { hasText: 'Đã lưu thành công' });
await successToast.hover();
await sleep(150); // nút đóng chỉ render khi hover
const closeButton = successToast.locator('button[aria-label="Đóng thông báo"]');
await closeButton.waitFor({ state: 'visible', timeout: 5000 });
await closeButton.click();
await sleep(400);
const afterClose = await page.evaluate(() => {
	const roots = [...document.querySelectorAll('.toast-root')];
	return {
		successGone: !roots.some((r) => r.textContent?.includes('Đã lưu thành công')),
		total: roots.length
	};
});
ok(
	'T5 click nút đóng (aria-label "Đóng thông báo") → toast success biến mất',
	afterClose.successGone && afterClose.total === 0,
	JSON.stringify(afterClose)
);

// T6 — action button "Xem lại" → toast-action-log đổi
await page.mouse.move(10, 10);
await sleep(100);
await page.locator('[data-test="toast-btn-success"]').click();
const newSuccess = page.locator('.toast-root', { hasText: 'Đã lưu thành công' });
await newSuccess.waitFor({ state: 'visible', timeout: 5000 });
await sleep(200);
const logBefore = await page.locator('[data-test="toast-action-log"]').textContent();
// Action button = Button component; target trong toast bằng text "Xem lại"
await newSuccess.locator('button', { hasText: 'Xem lại' }).click();
await sleep(200);
const logAfter = await page.locator('[data-test="toast-action-log"]').textContent();
ok(
	'T6 click action "Xem lại" → page state toast-action-log đổi',
	!!logBefore && !!logAfter && logBefore !== logAfter && logAfter.includes('Đã mở mục xem lại'),
	`${logBefore?.trim()} → ${logAfter?.trim()}`
);

// T7 — auto-dismiss ~3s: toast mới (default) tự biến mất, không hover
await page.mouse.move(10, 10);
await sleep(100);
const beforeDismiss = await page.evaluate(() =>
	[...document.querySelectorAll('.toast-root')].map((r) => r.textContent?.trim())
);
await page.locator('[data-test="toast-btn-default"]').click();
const defaultToast = page.locator('.toast-root', { hasText: 'Thông báo chung' });
await defaultToast.waitFor({ state: 'visible', timeout: 5000 });
const visibleNow = await page.evaluate(() =>
	[...document.querySelectorAll('.toast-root')].map((r) => r.textContent?.trim())
);
ok(
	'T7a toast default hiện (auto-dismiss timer chạy)',
	visibleNow.some((t) => t?.includes('Thông báo chung')),
	JSON.stringify({ beforeDismiss, visibleNow })
);
await sleep(3400); // chờ qua 3s
const afterDismiss = await page.evaluate(() =>
	[...document.querySelectorAll('.toast-root')].map((r) => r.textContent?.trim())
);
ok(
	'T7b auto-dismiss: toast default tự biến mất sau ~3s',
	!afterDismiss.some((t) => t?.includes('Thông báo chung')),
	JSON.stringify(afterDismiss)
);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
