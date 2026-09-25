import { chromium } from 'playwright';

const results = { passed: [], failed: [] };
function check(name, cond) {
	if (cond) results.passed.push(name); else results.failed.push(name);
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`);
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

try {
	await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);

	// 1. Ba module import được trong browser (Vite serves Svelte components)
	const importResults = await page.evaluate(async () => {
		const out = {};
		for (const name of ['inputEmail/Main.svelte', 'inputPhone/Main.svelte', 'inputPassword/Main.svelte']) {
			try {
				const mod = await import(`/src/lib/components/form/${name}`);
				out[name] = typeof mod.default === 'function' || typeof mod.default === 'object';
			} catch (e) {
				out[name] = 'ERROR: ' + e.message;
			}
		}
		return out;
	});
	for (const [name, ok] of Object.entries(importResults)) {
		check(`1. Module ${name} importable`, ok === true);
	}

	// 2. form/index.ts export 3 component mới
	const indexExports = await page.evaluate(async () => {
		const mod = await import('/src/lib/components/form/index.ts');
		return { EmailInput: !!mod.EmailInput, PhoneInput: !!mod.PhoneInput, PasswordInput: !!mod.PasswordInput };
	});
	check('2a. form/index.ts exports EmailInput', indexExports.EmailInput);
	check('2b. form/index.ts exports PhoneInput', indexExports.PhoneInput);
	check('2c. form/index.ts exports PasswordInput', indexExports.PasswordInput);

	// 3. Regression: email suggestions vẫn hoạt động trên register (Input facade đường cũ)
	const page2 = await context.newPage();
	await page2.goto('https://localhost:3000/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page2.waitForTimeout(5000);
	const emailField = page2.locator('input[name="email"]').first();
	await emailField.fill('test@');
	await page2.waitForTimeout(1500);
	const popupCount = await page2.locator('.email-suggestions-popup').count();
	check('3. Regression: email popup sau "test@" (Input facade)', popupCount > 0);
	await emailField.fill('');
	await page2.waitForTimeout(500);
} catch (e) {
	console.log('[FATAL]', e.message);
	results.failed.push('fatal: ' + e.message);
} finally {
	await browser.close();
	console.log(`\n=== KẾT QUẢ: ${results.passed.length} pass, ${results.failed.length} fail ===`);
	if (results.failed.length > 0) { console.log('FAILED:', results.failed.join(', ')); process.exit(1); }
}
