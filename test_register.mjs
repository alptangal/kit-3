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

	// Wait 2 seconds
	await page.waitForTimeout(2000);

	// 1. Initial state
	let resetBtn = await page.$('.register-btn-reset');
	let isDisabled = await resetBtn?.getAttribute('disabled');
	let classList = await resetBtn?.getAttribute('class');
	console.log('=== 1. INITIAL STATE ===');
	console.log('Reset Button disabled attr:', isDisabled);
	console.log('Reset Button class list:', classList);

	// Check submit button
	let submitBtn = await page.$('.register-btn-submit');
	let submitDisabled = await submitBtn?.getAttribute('disabled');
	let submitClass = await submitBtn?.getAttribute('class');
	console.log('Submit Button disabled attr:', submitDisabled);
	console.log('Submit Button class list:', submitClass);

	// 2. Type into first input (lastname)
	const firstInput = page.locator('input').first();
	await firstInput.fill('Nguyen');
	await page.waitForTimeout(400);
	
	resetBtn = await page.$('.register-btn-reset');
	isDisabled = await resetBtn?.getAttribute('disabled');
	classList = await resetBtn?.getAttribute('class');
	console.log('=== 2. AFTER TYPING INTO LASTNAME ===');
	console.log('Reset Button disabled attr:', isDisabled);
	console.log('Reset Button class list:', classList);

	// Check submit
	submitBtn = await page.$('.register-btn-submit');
	submitDisabled = await submitBtn?.getAttribute('disabled');
	submitClass = await submitBtn?.getAttribute('class');
	console.log('Submit Button disabled attr:', submitDisabled);
	console.log('Submit Button class list:', submitClass);

	// 3. Clear it (back to initial)
	await firstInput.fill('');
	await page.waitForTimeout(400);
	
	resetBtn = await page.$('.register-btn-reset');
	isDisabled = await resetBtn?.getAttribute('disabled');
	classList = await resetBtn?.getAttribute('class');
	console.log('=== 3. AFTER CLEARING LASTNAME ===');
	console.log('Reset Button disabled attr:', isDisabled);
	console.log('Reset Button class list:', classList);

	// 4. Click checkbox agree terms
	const checkbox = page.locator('.checkbox-root').first();
	await checkbox.click({ force: true });
	await page.waitForTimeout(1000);
	
	// Check if modal opened and click accept
	const modalAccept = await page.$('button:has-text("I Accept"), button:has-text("Tôi chấp nhận")');
	if (modalAccept) {
		await modalAccept.click({ force: true });
		await page.waitForTimeout(500);
	}
	
	resetBtn = await page.$('.register-btn-reset');
	isDisabled = await resetBtn?.getAttribute('disabled');
	classList = await resetBtn?.getAttribute('class');
	console.log('=== 4. AFTER CHECKING TERMS (with modal) ===');
	console.log('Reset Button disabled attr:', isDisabled);
	console.log('Reset Button class list:', classList);

	// Check checkbox state
	const checkboxChecked = await page.$('.checkbox-root.has-value');
	console.log('Checkbox has-value class:', !!checkboxChecked);

	await browser.close();
})();
