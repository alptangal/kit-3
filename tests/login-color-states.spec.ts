import { test, expect } from '@playwright/test';

test.describe('Login Form - Color States', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('https://localhost:3000/login', { waitUntil: 'networkidle' });
	});

	test('default state - input should have default background', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]');

		// Get computed styles
		const bgColor = await emailInput.evaluate(el => {
			return window.getComputedStyle(el).backgroundColor;
		});

		console.log('Default background:', bgColor);
		await page.screenshot({ path: 'tests/screenshots/01-default-state.png' });
	});

	test('error state - input should have red background when email validation fails', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]');
		const submitButton = page.locator('button[type="submit"]');

		// Focus and blur email field with invalid email to trigger error
		await emailInput.fill('invalid');
		await emailInput.blur();

		// Wait for validation
		await page.waitForTimeout(300);

		// Check if input has error class
		const classes = await emailInput.evaluate(el => el.className);
		console.log('Email input classes after invalid input:', classes);

		// Get computed styles
		const bgColor = await emailInput.evaluate(el => {
			return window.getComputedStyle(el).backgroundColor;
		});
		const borderColor = await emailInput.evaluate(el => {
			return window.getComputedStyle(el).borderColor;
		});

		console.log('Error state - Background:', bgColor);
		console.log('Error state - Border:', borderColor);

		// Should have reddish tint
		expect(bgColor).toMatch(/rgba\(239, 68, 68|rgb\(239, 68|rgb\(255,/);

		await page.screenshot({ path: 'tests/screenshots/02-error-state.png' });
	});

	test('success state - input should have green background when email is valid', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]');

		// Fill with valid email
		await emailInput.fill('test@example.com');
		await emailInput.blur();

		// Wait for validation
		await page.waitForTimeout(300);

		// Check if input has success class
		const classes = await emailInput.evaluate(el => el.className);
		console.log('Email input classes after valid input:', classes);

		// Get computed styles
		const bgColor = await emailInput.evaluate(el => {
			return window.getComputedStyle(el).backgroundColor;
		});
		const borderColor = await emailInput.evaluate(el => {
			return window.getComputedStyle(el).borderColor;
		});

		console.log('Success state - Background:', bgColor);
		console.log('Success state - Border:', borderColor);

		// Should have greenish tint
		expect(bgColor).toMatch(/rgba\(34, 197, 94|rgb\(34, 197|rgb\(102,/);

		await page.screenshot({ path: 'tests/screenshots/03-success-state.png' });
	});

	test('label color sync - label should change color with input validation state', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]');
		const emailLabel = page.locator('label').first();

		// Default state
		let labelClasses = await emailLabel.evaluate(el => el.className);
		console.log('Label classes (default):', labelClasses);

		// Error state
		await emailInput.fill('invalid');
		await emailInput.blur();
		await page.waitForTimeout(300);

		labelClasses = await emailLabel.evaluate(el => el.className);
		console.log('Label classes (error):', labelClasses);
		expect(labelClasses).toContain('color-error');

		// Success state
		await emailInput.clear();
		await emailInput.fill('test@example.com');
		await emailInput.blur();
		await page.waitForTimeout(300);

		labelClasses = await emailLabel.evaluate(el => el.className);
		console.log('Label classes (success):', labelClasses);
		expect(labelClasses).toContain('color-success');

		await page.screenshot({ path: 'tests/screenshots/04-label-color-sync.png' });
	});
});
