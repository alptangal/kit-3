// auth-wave11-reshot.mjs — chụp LẠI 2 ảnh debug-after-label-click + register-after-accept
// (ảnh debug cũ chụp TRƯỚC khi fix @attach; ảnh register-after-accept cần verify DOM tick)
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
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

// ═══════ (1) Click vào CHỮ "I agree to the" (không phải link) → modal KHÔNG mở ═══════
await page.goto('https://localhost:3000/register', { waitUntil: 'networkidle' });
await page.waitForSelector('.terms-text', { timeout: 20000 });
await sleep(1200);

// Playwright click vào span.terms-text — click thực trên element đó
// (target = span) → sau fix onclick guard, modal KHÔNG được mở.
const termsText = page.locator('.terms-text').first();
const textBox = await termsText.boundingBox();
if (textBox) {
	// click tại vị trí 30px từ mép trái (vùng chữ, tránh button ở cuối)
	await page.mouse.click(textBox.x + 30, textBox.y + textBox.height / 2);
	await sleep(700);
}
const modalAfterTextClick = (await page.locator('.terms-modal-box').count()) > 0;
ok('(D1) click CHỮ terms-text → modal KHÔNG mở (fix labelable-forwarding)', modalAfterTextClick === false, `modalOpen=${modalAfterTextClick}`);

// Screenshot debug mới
await page.screenshot({ path: 'tests/screenshot/auth-wave11/debug-after-label-click.png', fullPage: false });

// ═══════ (2) Accept → verify DOM tick + chụp lại register-after-accept ═══════
await page.locator('.terms-link-btn').click();
await page.waitForSelector('.terms-modal-box', { timeout: 10000 });
await sleep(500);
await page.locator('.terms-modal-footer button', { hasText: /Accept|Tôi đồng ý/ }).click();
await sleep(700);
const domState = await page.evaluate(() => {
	const cb = document.querySelector('.terms-row .checkbox-root');
	// tìm tick indicator bên trong checkbox (span/div/svg)
	const tickEl = cb ? cb.querySelector('span, div, svg') : null;
	const tickStyles = tickEl
		? {
				tag: tickEl.tagName,
				cls: tickEl.className || null,
				display: getComputedStyle(tickEl).display,
				opacity: getComputedStyle(tickEl).opacity,
				color: getComputedStyle(tickEl).color,
				bg: getComputedStyle(tickEl).backgroundColor
			}
		: null;
	const cbStyles = cb
		? {
				borderColor: getComputedStyle(cb).borderColor,
				bg: getComputedStyle(cb).backgroundColor
			}
		: null;
	const submitBtn = document.querySelector('.auth-btn-submit');
	return {
		ariaChecked: cb ? cb.getAttribute('aria-checked') : null,
		tickStyles,
		cbStyles,
		submitDisabled: submitBtn ? submitBtn.disabled : null,
		submitClasses: submitBtn ? submitBtn.className : null
	};
});
ok('(D2) Accept → checkbox aria-checked=true', domState.ariaChecked === 'true', `ariaChecked=${domState.ariaChecked}`);
ok('(D2) tick indicator hiển thị (opacity > 0, display ≠ none)', domState.tickStyles && domState.tickStyles.opacity !== '0' && domState.tickStyles.display !== 'none', JSON.stringify(domState.tickStyles).slice(0, 140));
ok('(D2) submit KHÔNG disabled sau Accept', domState.submitDisabled === false, `disabled=${domState.submitDisabled}`);

// Screenshot mới: full page + zoom riêng vào checkbox row
await page.screenshot({ path: 'tests/screenshot/auth-wave11/register-after-accept.png', fullPage: false });
const cbBox = await page.locator('.terms-row').first().boundingBox();
if (cbBox) {
	await page.screenshot({
		path: 'tests/screenshot/auth-wave11/register-checkbox-zoom.png',
		clip: { x: Math.max(0, cbBox.x - 10), y: Math.max(0, cbBox.y - 10), width: cbBox.width + 20, height: cbBox.height + 20 }
	});
}

ok('Không có pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
