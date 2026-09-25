// E2E: Reset-password flow — RED trước khi implement (Task 1)
// Chạy: node tests/reset-password-test.mjs (server dev port 3000)
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
	// === PHẦN 1: /reset-password KHÔNG có token → hiển thị invalid ===
	await page.goto('https://localhost:3000/reset-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const noTokenInvalid = await page.locator('.auth-alert--error').count();
	check('1. /reset-password không token → hiện invalid state', noTokenInvalid > 0);

	// === PHẦN 2: garbage token → invalid state ===
	await page.goto('https://localhost:3000/reset-password?token=garbage-token-xyz', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const garbageInvalid = await page.locator('.auth-alert--error').count();
	check('2. garbage token → invalid state', garbageInvalid > 0);

	// === PHẦN 3: quên mật khẩu → lấy reset link từ DEV OUTBOX ===
	await page.goto('https://localhost:3000/forgot-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(5000);
	const emailInput = page.locator('input[name="email"]');
	await emailInput.fill('phuongdomega@atomicmail.io');
	await page.waitForTimeout(1000); // đợi email availability check
	const submitBtn = page.locator('button.auth-btn-submit');
	await page.waitForFunction(() => !document.querySelector('button.auth-btn-submit')?.disabled, { timeout: 30000 });
	await submitBtn.click();
	await page.waitForTimeout(8000); // đợi API response + toast
	// Token được log ra server console qua sendDevEmail; E2E đọc từ dev outbox endpoint
	const outboxRes = await page.evaluate(async () => {
		const res = await fetch('/api/dev-emails', { headers: { 'Accept-Language': 'en' } });
		return res.ok ? await res.json() : null;
	});
	check('3. forgot-password với email seed → outbox có email reset', outboxRes && Array.isArray(outboxRes.emails) && outboxRes.emails.length > 0);
	// Task 3: outbox email phải giữ cấu trúc EmailMessage {to, subject, html} qua facade refactor
	check('3b. Outbox email có cấu trúc EmailMessage {to, subject, html}',
		outboxRes && outboxRes.emails?.[0] && typeof outboxRes.emails[0].to === 'string'
		&& typeof outboxRes.emails[0].subject === 'string' && typeof outboxRes.emails[0].html === 'string');
	let resetUrl = null;
	if (outboxRes?.emails?.length) {
		const last = outboxRes.emails[outboxRes.emails.length - 1];
		const m = last.html?.match(/https?:\/\/[^"'<\s]+\/reset-password\?token=[A-Za-z0-9._-]+/);
		resetUrl = m ? m[0] : null;
	}
	check('4. Email reset chứa link /reset-password?token=', !!resetUrl);

	// === PHẦN 4: mở reset link, set password mới ===
	if (resetUrl) {
		await page.goto(resetUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
		await page.waitForTimeout(5000);
		// Confirm mismatch → submit disabled (Review Focus #3)
		await page.locator('input[name="password"]').fill('NewP@ssw0rd-2026!');
		await page.locator('input[name="confirmPassword"]').fill('Different-P@ss');
		await page.waitForTimeout(1000);
		let mismatchBlocks = await submitBtn.evaluate((el) => el.disabled);
		check('5. password/confirm mismatch → submit disabled', mismatchBlocks === true);
		// Đúng confirm → submit enabled
		await page.locator('input[name="confirmPassword"]').fill('NewP@ssw0rd-2026!');
		await page.waitForTimeout(1000);
		await submitBtn.click();
		await page.waitForTimeout(8000);
		const successHint = await page.locator('.success-hint').count();
		check('6. Reset thành công → success hint', successHint > 0);

		// === PHẦN 5: token replay → invalid (Review Focus #2) ===
		await page.goto(resetUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
		await page.waitForTimeout(5000);
		await page.locator('input[name="password"]').fill('Another-P@ss-2026!');
		await page.locator('input[name="confirmPassword"]').fill('Another-P@ss-2026!');
		await page.waitForTimeout(1000);
		await submitBtn.click();
		await page.waitForTimeout(8000);
		const replayError = await page.locator('.auth-alert--error').count();
		check('7. Token replay → invalid error', replayError > 0);

		// === PHẦN 6: restore password gốc qua flow thứ hai ===
		await page.goto('https://localhost:3000/forgot-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
		await page.waitForTimeout(5000);
		await page.locator('input[name="email"]').fill('phuongdomega@atomicmail.io');
		await page.waitForTimeout(1000);
		await page.waitForFunction(() => !document.querySelector('button.auth-btn-submit')?.disabled, { timeout: 30000 });
		await page.locator('button.auth-btn-submit').click();
		await page.waitForTimeout(8000);
		const outbox2 = await page.evaluate(async () => {
			const res = await fetch('/api/dev-emails', { headers: { 'Accept-Language': 'en' } });
			return res.ok ? await res.json() : null;
		});
		let restoreUrl = null;
		if (outbox2?.emails?.length) {
			const last = outbox2.emails[outbox2.emails.length - 1];
			const m = last.html?.match(/https?:\/\/[^"'<\s]+\/reset-password\?token=[A-Za-z0-9._-]+/);
			restoreUrl = m ? m[0] : null;
		}
		if (restoreUrl) {
			await page.goto(restoreUrl, { waitUntil: 'domcontentloaded', timeout: 180000 });
			await page.waitForTimeout(5000);
			const origPass = process.env.password_owner ?? 'PhuongDomega@2026';
			await page.locator('input[name="password"]').fill(origPass);
			await page.locator('input[name="confirmPassword"]').fill(origPass);
			await page.waitForTimeout(1000);
			await page.locator('button.auth-btn-submit').click();
			await page.waitForTimeout(8000);
			const restored = await page.locator('.success-hint').count();
			check('8. Restore password gốc thành công', restored > 0);
		} else {
			check('8. Restore password gốc thành công', false);
		}
	} else {
		console.log('SKIP phần 4-8: không có resetUrl');
	}
} catch (e) {
	console.log('[FATAL]', e.message);
	results.failed.push('fatal: ' + e.message);
} finally {
	await browser.close();
	console.log(`\n=== KẾT QUẢ: ${results.passed.length} pass, ${results.failed.length} fail ===`);
	if (results.failed.length > 0) { console.log('FAILED:', results.failed.join(', ')); process.exit(1); }
}
