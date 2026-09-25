import { chromium } from 'playwright';

const results = { passed: [], failed: [] };
function check(name, cond) {
	if (cond) results.passed.push(name); else results.failed.push(name);
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`);
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
let pageErrors = [];
page.on('pageerror', (err) => { pageErrors.push(err.message); console.log('[pageerror]', err.message); });

try {
	// 1. App khởi động không JS error sau extraction (layout đọc focusOn ở +layout.svelte:160)
	await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	check('1. App load không pageerror (focusOn contract sống)', pageErrors.length === 0);

	// 2. Module mới import được
	const imports = await page.evaluate(async () => {
		const out = {};
		try {
			// .svelte.ts — $state runes ngoài component context yêu cầu đuôi .svelte.ts (Svelte 5)
			const hook = await import('/src/lib/components/keyboard/useVisualKeyboard.svelte.ts');
			out.hook = typeof hook.useVisualKeyboard === 'function';
		} catch (e) { out.hook = 'ERROR: ' + e.message; }
		try {
			const comp = await import('/src/lib/components/keyboard/VisualKeyboard.svelte');
			out.component = typeof comp.default === 'function' || typeof comp.default === 'object';
		} catch (e) { out.component = 'ERROR: ' + e.message; }
		try {
			const idx = await import('/src/lib/components/keyboard/index.ts');
			out.indexExport = !!idx.Keyboard?.Visual;
		} catch (e) { out.indexExport = 'ERROR: ' + e.message; }
		return out;
	});
	check('2a. useVisualKeyboard.svelte.ts importable + export useVisualKeyboard', imports.hook === true);
	check('2b. VisualKeyboard.svelte importable', imports.component === true);
	check('2c. keyboard/index.ts exports Keyboard.Visual', imports.indexExport === true);

	// 3. Layout root vẫn nhận touchActionDisabled từ focusOn (sanity: attribute pipeline sống)
	// focusOn luôn falsy ở desktop load → touch-action không bị disable; chỉ check element tồn tại
	const rootExists = await page.evaluate(() => !!document.querySelector('#app, body *'));
	check('3. Root app element render OK', rootExists);
} catch (e) {
	console.log('[FATAL]', e.message);
	results.failed.push('fatal: ' + e.message);
} finally {
	await browser.close();
	console.log(`\n=== KẾT QUẢ: ${results.passed.length} pass, ${results.failed.length} fail ===`);
	if (results.failed.length > 0) { console.log('FAILED:', results.failed.join(', ')); process.exit(1); }
}
