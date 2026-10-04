import { test, expect } from '@playwright/test';

test.describe('Input Color Derivation Debug', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('https://localhost:3000/login', { waitUntil: 'networkidle' });
	});

	test('debug colorDerived - check class names on input elements', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]');
		const emailRoot = page.locator('.input-root').first();

		// Default state - before any interaction
		console.log('\n=== DEFAULT STATE ===');
		let rootClasses = await emailRoot.evaluate(el => el.className);
		console.log('Email root classes (default):', rootClasses);
		expect(rootClasses).toContain('color-default');

		// Trigger blur with invalid email
		console.log('\n=== FILLING WITH INVALID EMAIL ===');
		await emailInput.fill('invalid');
		await emailInput.blur();
		await page.waitForTimeout(500);

		rootClasses = await emailRoot.evaluate(el => el.className);
		console.log('Email root classes (after invalid):', rootClasses);
		console.log('Expected: should contain "color-error"');

		// Check if color-error is present
		const hasColorError = rootClasses.includes('color-error');
		console.log('Has color-error class?', hasColorError);

		// Check computed styles
		const bgColor = await emailRoot.evaluate(el => {
			return window.getComputedStyle(el).backgroundColor;
		});
		console.log('Computed background:', bgColor);

		// Check validation process state in Input component
		const validationState = await page.evaluate(() => {
			const el = document.querySelector('input[type="email"]');
			if (!el) return null;
			// Try to find parent component data
			return {
				element: el.outerHTML.substring(0, 200),
				classList: el.className,
				parentClassList: el.parentElement?.className
			};
		});
		console.log('Input element state:', validationState);

		await page.screenshot({ path: 'tests/screenshots/debug-invalid.png' });

		// Now fill with valid email
		console.log('\n=== FILLING WITH VALID EMAIL ===');
		await emailInput.clear();
		await emailInput.fill('test@example.com');
		await emailInput.blur();
		await page.waitForTimeout(500);

		rootClasses = await emailRoot.evaluate(el => el.className);
		console.log('Email root classes (after valid):', rootClasses);
		console.log('Expected: should contain "color-success"');

		const hasColorSuccess = rootClasses.includes('color-success');
		console.log('Has color-success class?', hasColorSuccess);

		const bgColorSuccess = await emailRoot.evaluate(el => {
			return window.getComputedStyle(el).backgroundColor;
		});
		console.log('Computed background (success):', bgColorSuccess);

		await page.screenshot({ path: 'tests/screenshots/debug-valid.png' });
	});

	test('inspect validation.process SvelteMap state', async ({ page }) => {
		const emailInput = page.locator('input[type="email"]');

		// Fill with invalid value and blur
		await emailInput.fill('invalid');
		await emailInput.blur();
		await page.waitForTimeout(500);

		// Try to inspect component state via window object
		const componentState = await page.evaluate(() => {
			const root = document.querySelector('.input-root');
			if (!root) return { error: 'No input-root found' };

			return {
				rootClasses: root.className,
				// Check if there are any style attributes
				style: root.getAttribute('style'),
				// Check CSS variables
				cssVars: {
					'--background': window.getComputedStyle(root).getPropertyValue('--background'),
					'--border-color': window.getComputedStyle(root).getPropertyValue('--border-color'),
					'--color': window.getComputedStyle(root).getPropertyValue('--color')
				},
				computedStyles: {
					backgroundColor: window.getComputedStyle(root).backgroundColor,
					borderColor: window.getComputedStyle(root).borderColor,
					color: window.getComputedStyle(root).color
				}
			};
		});

		console.log('\nComponent state after invalid input:');
		console.log(JSON.stringify(componentState, null, 2));

		expect(componentState.rootClasses).toContain('color-error');
	});
});
