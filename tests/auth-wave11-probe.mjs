// auth-wave11-probe.mjs
// Wave 11 — Login + Register pages hoàn thiện.
//
// Verify 2 bug THẬT + terms modal hiện đại:
//   (L1) Login username (không @) → blur → field KHÔNG báo lỗi "must be an email"
//        (trước đây type="email" tự gắn isEmail → FAIL sai) + màu input-root
//        KHÔNG color-error.
//   (L2) Login email hợp lệ → blur → field PASS (không invalid message) + màu
//        input-root color-success.
//   (L3) Login email sai format ("user@@x") → blur → field BÁO LỖI (custom
//        validator email) — FieldMessages hiện invalid.
//   (L4) Nút submit login disabled khi field sai (formContext.validation.isValid=false)
//        và KHÔNG disabled khi hợp lệ (required đầy đủ).
//   (R1) Register terms modal MỞ khi click link "Terms of Service" → header + body
//        + footer + nút Accept/Decline hiển thị.
//   (R2) Terms modal ĐÓNG khi click Decline (không tick checkbox).
//   (R3) Terms modal Accept → checkbox agreeTerms ticked → submit enable-ready path
//        (checkbox .checked = true).
//   (R4) Modal flush architecture: container KHÔNG bị đè padding 1.5rem (body cuộn
//        đúng vùng body — .modal-body-root overflow-y auto).
//   (R5) terms row + label (.terms-label) không phải CSS chết — visible.
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

// ════════════════ LOGIN ════════════════
await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(400);

const usernameInput = page.locator('.auth-input-wrapper input').first();

const getFieldState = async () => {
	return page.evaluate(() => {
		const root = document.querySelector('.auth-input-wrapper .input-root');
		// FieldMessages dùng class .fieldMessages-root (p.invalid là child)
		const p = document.querySelector('.form-root .fieldMessages-root p');
		return {
			classes: root ? root.className : null,
			hasError: root ? root.classList.contains('color-error') : null,
			hasSuccess: root ? root.classList.contains('color-success') : null,
			messageText: p ? p.textContent.trim() : ''
		};
	});
};

// (L1) username không @ → KHÔNG báo lỗi "must be an email"
await usernameInput.fill('testuser');
await usernameInput.blur();
await sleep(700); // debounce validation (configs.delay 300ms) + render
let st = await getFieldState();
ok(
	'(L1) username (không @) sau blur KHÔNG báo lỗi email',
	st.hasError === false && !st.messageText.includes('must be an email') && !st.messageText.includes('email không hợp lệ'),
	`classes=${st.classes} msg="${st.messageText.slice(0, 80)}"`
);

// (L2) email hợp lệ → PASS
await usernameInput.fill('user@example.com');
await usernameInput.blur();
await sleep(700);
st = await getFieldState();
ok(
	'(L2) email hợp lệ sau blur → color-success + không invalid',
	st.hasSuccess === true && st.hasError === false,
	`classes=${st.classes} msg="${st.messageText.slice(0, 80)}"`
);

// (L3) email sai format → BÁO LỖI
await usernameInput.fill('user@@example');
await usernameInput.blur();
await sleep(700);
st = await getFieldState();
ok(
	'(L3) email sai format sau blur → color-error + invalid message',
	st.hasError === true && st.messageText.length > 0,
	`classes=${st.classes} msg="${st.messageText.slice(0, 80)}"`
);

// (L4) nút submit disabled khi field sai, enabled khi hợp lệ
const submitBtn = page.locator('.auth-btn-submit').first();
const disabledInvalid = await submitBtn.isDisabled();
await usernameInput.fill('user@example.com');
await sleep(400);
const passInput = page.locator('.auth-input-wrapper input').nth(1);
await passInput.fill('Password123!');
await sleep(400);
const disabledValid = await submitBtn.isDisabled();
ok('(L4) submit disabled khi field sai', disabledInvalid === true, `disabled=${disabledInvalid}`);
ok(
	'(L4) submit KHÔNG disabled khi required đầy đủ (username email + password)',
	disabledValid === false,
	`disabled=${disabledValid}`
);

// ════════════════ REGISTER — terms modal ════════════════
await page.goto('https://localhost:3000/register', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.terms-link-btn', { timeout: 20000 });
await sleep(400);

// (R5) label text "I agree to the" visible (không phải CSS chết — verify
// bằng text content thực, không kiểm class scoped có thể bị xóa khi dọn CSS)
const termsLabelVisible = await page
	.getByText('I agree to the', { exact: false })
	.first()
	.isVisible();
ok('(R5) label text visible (không phải CSS chết)', termsLabelVisible === true);

// (R1) click link → modal mở với header/body/footer + nút
await page.locator('.terms-link-btn').click();
await page.waitForSelector('.terms-modal-box', { timeout: 10000 });
await sleep(500);
const modalState = await page.evaluate(() => {
	const box = document.querySelector('.terms-modal-box');
	if (!box) return { found: false };
	const header = box.querySelector('.modal-header-root');
	const body = box.querySelector('.modal-body-root');
	const footer = box.querySelector('.modal-footer-root');
	const buttons = box.querySelectorAll('.modal-footer-root button');
	const intro = box.querySelector('.modal-intro');
	const clauses = box.querySelectorAll('.clause-item');
	return {
		found: true,
		header: !!header,
		body: !!body,
		footer: !!footer,
		buttonCount: buttons.length,
		buttonTexts: [...buttons].map((b) => (b.textContent || '').trim()).filter(Boolean),
		hasIntro: !!intro,
		clauseCount: clauses.length,
		borderRadius: getComputedStyle(box).borderRadius,
		paddingTop: getComputedStyle(box).paddingTop,
		paddingBottom: getComputedStyle(box).paddingBottom,
		overflow: getComputedStyle(box).overflow,
		bodyOverflowY: body ? getComputedStyle(body).overflowY : null
	};
});
ok('(R1) terms modal mở: header + body + footer tồn tại', modalState.found && modalState.header && modalState.body && modalState.footer, JSON.stringify(modalState).slice(0, 160));
ok(
	'(R1) footer có 2 nút Accept + Decline',
	modalState.buttonCount === 2,
	`buttons=${JSON.stringify(modalState.buttonTexts)}`
);
ok(
	'(R1) body có intro + 3 clause-item',
	modalState.hasIntro && modalState.clauseCount === 3,
	`clauses=${modalState.clauseCount}`
);
ok(
	'(R4) container flush: padding-top/bottom = 0 (không đè 1.5rem) + overflow hidden + body overflow-y auto',
	modalState.paddingTop === '0px' && modalState.paddingBottom === '0px' && modalState.overflow === 'hidden' && modalState.bodyOverflowY === 'auto',
	`padTop=${modalState.paddingTop} padBottom=${modalState.paddingBottom} overflow=${modalState.overflow} bodyOY=${modalState.bodyOverflowY}`
);

// Screenshot modal mở (ui-checker đọc)
await page.screenshot({ path: 'tests/screenshot/auth-wave11/terms-modal-open.png', fullPage: false });

// (R2) Decline → modal đóng, checkbox KHÔNG tick
// Checkbox KHÔNG có native <input> — role="checkbox" + aria-checked trên div.
await page.locator('.terms-modal-footer button', { hasText: /Decline|Từ chối/ }).click();
await sleep(500);
const modalClosed = (await page.locator('.terms-modal-box').count()) === 0;
const agreeUnchecked = await page.evaluate(() => {
	const cb = document.querySelector('.terms-row .checkbox-root');
	return cb ? cb.getAttribute('aria-checked') === 'false' : null;
});
ok('(R2) Decline → modal đóng', modalClosed === true, `modalCount=0`);
ok('(R2) Decline → checkbox KHÔNG tick (aria-checked=false)', agreeUnchecked === true, `unchecked=${agreeUnchecked}`);

// (R3) mở lại → Accept → checkbox ticked
await page.locator('.terms-link-btn').click();
await page.waitForSelector('.terms-modal-box', { timeout: 10000 });
await sleep(400);
await page.locator('.terms-modal-footer button', { hasText: /Accept|Tôi đồng ý/ }).click();
await sleep(500);
const agreeChecked = await page.evaluate(() => {
	const cb = document.querySelector('.terms-row .checkbox-root');
	return cb ? cb.getAttribute('aria-checked') === 'true' : null;
});
const modalClosedAgain = (await page.locator('.terms-modal-box').count()) === 0;
ok('(R3) Accept → checkbox agreeTerms ticked', agreeChecked === true, `checked=${agreeChecked}`);
ok('(R3) Accept → modal đóng', modalClosedAgain === true, `modalCount=0`);

// Screenshot register form sau Accept (checkbox ticked)
await page.screenshot({ path: 'tests/screenshot/auth-wave11/register-after-accept.png', fullPage: false });

// Screenshot login form (trạng thái hợp lệ)
await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(400);
await usernameInput.fill('user@example.com');
await passInput.fill('Password123!');
await sleep(500);
await page.screenshot({ path: 'tests/screenshot/auth-wave11/login-valid-state.png', fullPage: false });

ok('Không có pageerror', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
