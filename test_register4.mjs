import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch({
		channel: 'msedge',
		headless: true
	});
	const context = await browser.newContext({ ignoreHTTPSErrors: true });
	const page = await context.newPage();

	page.on('console', msg => {
		if (msg.text().includes('[DEBUG Reset Button Enabled Reason]')) {
			console.log(msg.text());
		}
	});

	await page.goto('https://localhost:3002/register', { waitUntil: 'domcontentloaded', timeout: 60000 });
	await page.waitForTimeout(2000);

	// Fill all fields
	await page.locator('input[name="lastname"]').fill('Nguyen');
	await page.locator('input[name="midname"]').fill('Van');
	await page.locator('input[name="firstname"]').fill('An');
	await page.locator('input[name="username"]').fill('testuser');
	await page.locator('input[name="email"]').fill('test@example.com');
	await page.locator('input[name="password"]').fill('password123');
	await page.locator('input[name="confirmPassword"]').fill('password123');
	await page.waitForTimeout(400);

	// Check terms checkbox
	const checkbox = page.locator('.checkbox-root').first();
	await checkbox.click({ force: true });
	await page.waitForTimeout(500);

	// Handle modal if opened
	const modalAccept = await page.$('button:has-text("I Accept"), button:has-text("Tôi chấp nhận")');
	if (modalAccept) {
		await modalAccept.click({ force: true });
		await page.waitForTimeout(500);
	}
	await page.waitForTimeout(400);

	let resetBtn = await page.$('.register-btn-reset');
	let isDisabled = await resetBtn?.getAttribute('disabled');
	let classList = await resetBtn?.getAttribute('class');
	console.log('=== BEFORE RESET (all fields filled) ===');
	console.log('Reset Button disabled attr:', isDisabled);
	console.log('Reset Button class list:', classList);

	let submitBtn = await page.$('.register-btn-submit');
	let submitDisabled = await submitBtn?.getAttribute('disabled');
	let submitClass = await submitBtn?.getAttribute('class');
	console.log('Submit Button disabled attr:', submitDisabled);
	console.log('Submit Button class list:', submitClass);

	// Check all field values
	const lastname = await page.locator('input[name="lastname"]').inputValue();
	const firstname = await page.locator('input[name="firstname"]').inputValue();
	const username = await page.locator('input[name="username"]').inputValue();
	const email = await page.locator('input[name="email"]').inputValue();
	const password = await page.locator('input[name="password"]').inputValue();
	const confirmPassword = await page.locator('input[name="confirmPassword"]').inputValue();
	console.log('Values:', { lastname, firstname, username, email, password, confirmPassword });

	// Click Reset
	await resetBtn?.click({ force: true });
	await page.waitForTimeout(500);

	resetBtn = await page.$('.register-btn-reset');
	isDisabled = await resetBtn?.getAttribute('disabled');
	classList = await resetBtn?.getAttribute('class');
	console.log('=== AFTER RESET CLICK ===');
	console.log('Reset Button disabled attr:', isDisabled);
	console.log('Reset Button class list:', classList);

	// Check values after reset
	const lastname2 = await page.locator('input[name="lastname"]').inputValue();
	const firstname2 = await page.locator('input[name="firstname"]').inputValue();
	const username2 = await page.locator('input[name="username"]').inputValue();
	const email2 = await page.locator('input[name="email"]').inputValue();
	const password2 = await page.locator('input[name="password"]').inputValue();
	const confirmPassword2 = await page.locator('input[name="confirmPassword"]').inputValue();
	console.log('Values after reset:', { lastname: lastname2, firstname: firstname2, username: username2, email: email2, password: password2, confirmPassword: confirmPassword2 });

	// Check checkbox
	const checkboxChecked = await page.$('.checkbox-root.has-value');
	console.log('Checkbox has-value class after reset:', !!checkboxChecked);

	await browser.close();
})();