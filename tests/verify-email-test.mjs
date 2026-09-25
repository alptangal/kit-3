import { chromium } from 'playwright';

const results = { passed: [], failed: [] };
function check(name, cond) {
	if (cond) results.passed.push(name); else results.failed.push(name);
	console.log(`${cond ? 'PASS' : 'FAIL'}: ${name}`);
}

const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.log('[console.error]', msg.text()); });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

try {
	// === 1. Garbage token → invalid state, KHÔNG crash (Review Focus #4) ===
	await page.goto('https://localhost:3000/verify-email?token=garbage-token-xyz', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(8000); // đợi auto-verify submit + response
	const bodyText1 = await page.locator('body').innerText();
	const invalidState = bodyText1.toLowerCase().includes('invalid') || bodyText1.toLowerCase().includes('không hợp lệ');
	check('1. verify-email garbage token → invalid state (không crash)', invalidState);

	// === 2. Không token → invalid state ===
	await page.goto('https://localhost:3000/verify-email', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const bodyText2 = await page.locator('body').innerText();
	const noTokenState = bodyText2.toLowerCase().includes('invalid') || bodyText2.toLowerCase().includes('không hợp lệ');
	check('2. verify-email không token → invalid state', noTokenState);

	// === 3. Resend-verification với email KHÔNG tồn tại → success message giống email thật (Review Focus #5) ===
	await page.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const [resNonExist, resExist] = await page.evaluate(async () => {
		async function tryResend(email) {
			// Dùng page fetch với session keys — encryption là NAMED export (export const encryption)
			const { encryption } = await import('/src/lib/modules/encryption.ts');
			const keys = await encryption.generateRSAKeyPair();
			const body = { email, publicKeyB64: await encryption.exportKeyToBase64(keys.publicKey, 'spki') };
			const res = await encryption.fetchSecure('/api/resend-verification', { method: 'POST', body }, keys);
			return res;
		}
		return [await tryResend('nonexistent-xyz@atomicmail.io'), await tryResend('phuongdomega@atomicmail.io')];
	});
	const msgNonExist = resNonExist?.message?.en ?? String(resNonExist?.message ?? '');
	const msgExist = resExist?.message?.en ?? String(resExist?.message ?? '');
	check('3a. resend-verification email không tồn tại → ok:true', resNonExist?.ok === true);
	check('3b. resend-verification email tồn tại → ok:true', resExist?.ok === true);
	check('3c. Hai response message GIỐNG HỆT nhau (anti-enumeration)', msgNonExist === msgExist && msgNonExist !== '');
} catch (e) {
	console.log('[FATAL]', e.message);
	results.failed.push('fatal: ' + e.message);
} finally {
	await browser.close();
	console.log(`\n=== KẾT QUẢ: ${results.passed.length} pass, ${results.failed.length} fail ===`);
	if (results.failed.length > 0) { console.log('FAILED:', results.failed.join(', ')); process.exit(1); }
}
