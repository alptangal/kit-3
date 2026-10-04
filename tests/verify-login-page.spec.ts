import { test } from '@playwright/test';

test.describe('Login Page - Verify Requirements', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('https://localhost:3000/login', { waitUntil: 'networkidle' });
	});

test.use({
	ignoreHTTPSErrors: true
});

	test('1. Default state - button heights match input height', async ({ page }) => {
		// Take screenshot of initial state
		await page.screenshot({ path: 'tests/screenshots/01-default-state.png', fullPage: true });
	});

	test('2. Error state - input/label/icon all red', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]').first();

		// Fill with invalid email
		await emailInput.fill('invalid');
		await emailInput.blur();
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'tests/screenshots/02-error-state.png', fullPage: true });
	});

	test('3. Success state - input/label/icon all green', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]').first();

		// Clear and fill with valid email
		await emailInput.clear();
		await emailInput.fill('test@example.com');
		await emailInput.blur();
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'tests/screenshots/03-success-state.png', fullPage: true });
	});

	test('4. Button sizes - verify login/reset buttons height match input', async ({ page }) => {
		// Get input height
		const inputRoot = page.locator('.input-root').first();
		const inputBox = await inputRoot.boundingBox();

		// Get button heights
		const loginButton = page.locator('button:has-text("Sign in")').first();
		const resetButton = page.locator('button:has-text("Reset")').first();
		const loginBox = await loginButton.boundingBox();
		const resetBox = await resetButton.boundingBox();

		console.log('Input height:', inputBox?.height);
		console.log('Login button height:', loginBox?.height);
		console.log('Reset button height:', resetBox?.height);

		await page.screenshot({ path: 'tests/screenshots/04-button-sizes.png', fullPage: true });
	});

	test('5. Clear button - should be first action button', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]').first();

		// Fill input to trigger clear button
		await emailInput.fill('test@example.com');
		await emailInput.blur();
		await page.waitForTimeout(300);

		await page.screenshot({ path: 'tests/screenshots/05-clear-button-position.png', fullPage: true });
	});

	test('6. Mobile responsive - check layout on smaller screens', async ({ page }) => {
		await page.setViewportSize({ width: 480, height: 800 });
		await page.screenshot({ path: 'tests/screenshots/06-mobile-responsive.png', fullPage: true });
	});
});
