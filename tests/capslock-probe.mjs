// capslock-probe.mjs
// Probe cho P2: "Caps Lock warning" trên password field của /login và /register.
// Playwright KHÔNG bật được Caps Lock vật lý → dispatch KEYDOWN SYNTHETIC lên
// input password, override getModifierState() => true để mô phỏng Caps Lock bật.
// Handler Svelte (onkeydown trên wrapper .caps-scope, event bubble từ input)
// đọc e.getModifierState('CapsLock') → set capsLockOn → render .caps-hint.
// Verify: (1) hint HIỆN khi CapsLock=true, (2) hint TẠO MẤT khi CapsLock=false,
// (3) hint TẠO MẤT khi blur (focusout). i18n: 'Caps Lock is on' (default en).
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Dispatch keydown lên input password với CapsLock state giả lập.
async function dispatchCaps(page, on) {
	await page.evaluate((capsOn) => {
		const input = document.querySelector('.caps-scope input[type="password"]');
		if (!input) throw new Error('password input not found in .caps-scope');
		input.focus();
		const e = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
		// Override getModifierState cho instance này (shadow prototype method)
		e.getModifierState = (mod) => (mod === 'CapsLock' ? capsOn : false);
		input.dispatchEvent(e);
	}, on);
}

async function runSuite(context, path, label) {
	const page = await context.newPage();
	page.on('pageerror', (e) => console.log(`PAGEERROR[${label}]:`, e.message));
	await page.goto('https://localhost:3000' + path, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle').catch(() => {});
	await sleep(400);

	const hintSel = '.caps-scope .caps-hint';
	const inputSel = '.caps-scope input[type="password"]';

	// C0: input password tồn tại trong .caps-scope
	const inputCount = await page.locator(inputSel).count();
	ok(`${label} C0: password input trong .caps-scope`, inputCount === 1, String(inputCount));

	// C1: ban đầu KHÔNG có hint (capsLockOn=false)
	const hint0 = await page.locator(hintSel).count();
	ok(`${label} C1: ban đầu không có caps-hint`, hint0 === 0, String(hint0));

	// C2: dispatch keydown CapsLock=true → hint HIỆN
	await dispatchCaps(page, true);
	await sleep(50);
	const hint1 = await page.locator(hintSel).count();
	const hintText = hint1 ? await page.locator(hintSel).first().innerText() : '';
	ok(`${label} C2: CapsLock ON → caps-hint hiện`, hint1 === 1, hintText);
	ok(`${label} C2b: hint text đúng i18n`, /Caps Lock/i.test(hintText), hintText);

	// C3: dispatch keydown CapsLock=false → hint TẠO MẤT
	await dispatchCaps(page, false);
	await sleep(50);
	const hint2 = await page.locator(hintSel).count();
	ok(`${label} C3: CapsLock OFF → caps-hint ẩn`, hint2 === 0, String(hint2));

	// C4: bật lại rồi BLUR → hint ẩn (focusout reset)
	await dispatchCaps(page, true);
	await sleep(50);
	ok(`${label} C4a: bật CapsLock lại`, (await page.locator(hintSel).count()) === 1);
	await page.evaluate(() => {
		const input = document.querySelector('.caps-scope input[type="password"]');
		input.blur();
	});
	await sleep(50);
	ok(`${label} C4b: blur → caps-hint ẩn`, (await page.locator(hintSel).count()) === 0);

	// Screenshot khi hint đang hiện (để ui-checker)
	await dispatchCaps(page, true);
	await sleep(50);
	const shot = `tests/screenshot/capslock/${label}-capslock-on.png`;
	await page.screenshot({ path: shot }).catch(() => {});

	await page.close();
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const { mkdirSync } = await import('node:fs');
mkdirSync('tests/screenshot/capslock', { recursive: true });

console.log('\n=== LOGIN: Caps Lock warning ===');
await runSuite(context, '/login', 'login');
console.log('\n=== REGISTER: Caps Lock warning ===');
await runSuite(context, '/register', 'register');

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
