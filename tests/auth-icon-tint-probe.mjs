// auth-icon-tint-probe.mjs
// Verify fix "Safari 15-safe icon tint" (bỏ `:has()`, dùng general-sibling `~`).
// AuthLayout: `.auth-input-wrapper .input-root.color-error ~ .auth-input-icon { color: #dc2626 }`
// (icon đứng SAU input trong DOM; position:absolute nên vị trí hiển thị không đổi).
//
// Playwright (Chromium) vốn hỗ trợ `:has()` nên KHÔNG thể "bắt bẻ" trình duyệt
// thiếu `:has()`. Thay vào đó verify ĐIỀU CẦN THỰC SỰ:
//   (A) DOM: icon `.auth-input-icon` là sibling ĐỨNG SAU `.input-root` trong
//       `.auth-input-wrapper` (điều kiện tiên quyết để `~` match).
//   (B) Rule `~` THỰC SỰ đổi computed color của icon khi input-root mang
//       `color-error` / `color-success` (gán class trực tiếp để deterministic,
//       không phụ thuộc luồng validation).
//   (C) Không còn `:has(` nào trong stylesheet global (AuthLayout) — bằng chứng
//       đã bỏ `:has()` (Safari 15 không support).
import { chromium } from '@playwright/test';

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

await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.auth-input-wrapper', { timeout: 20000 });
await sleep(400);

// (C) Không còn :has( DÙNG LAM SELECTOR trong <style> (loại comment /* */
// trước khi test — comment giải thích "không dùng :has()" trong AuthLayout
// + comment cũ ở các component khác KHÔNG tính).
const hasHas = await page.evaluate(() => {
	const styles = [...document.querySelectorAll('style')]
		.map((s) => s.textContent)
		.join('\n')
		.replace(/\/\*[\s\S]*?\*\//g, ''); // strip block comments
	return /:has\(/.test(styles);
});
ok('(C) Không còn :has() selector trong stylesheet (đã loại comment)', hasHas === false, `hasHas=${hasHas}`);

// (A) DOM order: input-root trước, icon sau, cùng parent .auth-input-wrapper
const dom = await page.evaluate(() => {
	const wrapper = document.querySelector('.auth-input-wrapper');
	if (!wrapper) return { found: false };
	const icon = wrapper.querySelector('.auth-input-icon');
	const inputRoot = wrapper.querySelector('.input-root');
	if (!icon || !inputRoot) return { found: true, icon: !!icon, inputRoot: !!inputRoot, iconAfterInput: false };
	// iconAfterInput: icon xuất hiện SAU inputRoot trong NodeList con của wrapper
	const children = [...wrapper.children];
	const iInput = children.findIndex((c) => c === inputRoot || inputRoot.contains(c) || (c.className && String(c.className).includes('input-root')));
	const iIcon = children.findIndex((c) => c === icon);
	return { found: true, icon: true, inputRoot: true, iconAfterInput: iIcon > iInput, iInput, iIcon };
});
ok('(A) .auth-input-wrapper + icon + input-root tồn tại', dom.found && dom.icon && dom.inputRoot, JSON.stringify(dom));
ok('(A) icon đứng SAU input-root trong DOM (điều kiện cho `~`)', dom.iconAfterInput === true, JSON.stringify({ iInput: dom.iInput, iIcon: dom.iIcon }));

// (B) Gán color-error → icon computed color đổi sang đỏ #dc2626 (rgb(220, 38, 38))
const base = await page.evaluate(() => {
	const icon = document.querySelector('.auth-input-wrapper .auth-input-icon');
	return { color: getComputedStyle(icon).color };
});
await page.evaluate(() => {
	document.querySelector('.auth-input-wrapper .input-root').classList.add('color-error');
});
await sleep(60); // chờ transition color 0.2s? đọc mid-transition — dùng 300ms
await sleep(240);
const error = await page.evaluate(() => {
	const icon = document.querySelector('.auth-input-wrapper .auth-input-icon');
	return { color: getComputedStyle(icon).color };
});
ok('(B) icon default (trước gán) là xám #94a3b8', /rgb\(\s*148,\s*163,\s*184\s*\)/.test(base.color), base.color);
ok('(B) gán color-error → icon đổi màu ĐỎ #dc2626', /rgb\(\s*220,\s*38,\s*38\s*\)/.test(error.color), `${base.color} → ${error.color}`);

// (B2) Đổi sang color-success → xanh #16a34a (rgb(22, 163, 74))
await page.evaluate(() => {
	const r = document.querySelector('.auth-input-wrapper .input-root');
	r.classList.remove('color-error');
	r.classList.add('color-success');
});
await sleep(300);
const success = await page.evaluate(() => {
	const icon = document.querySelector('.auth-input-wrapper .auth-input-icon');
	return { color: getComputedStyle(icon).color };
});
ok('(B) gán color-success → icon đổi màu XANH #16a34a', /rgb\(\s*22,\s*163,\s*74\s*\)/.test(success.color), `${error.color} → ${success.color}`);

// Dọn class
await page.evaluate(() => {
	const r = document.querySelector('.auth-input-wrapper .input-root');
	r.classList.remove('color-success');
});

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
