import { test, expect } from '@playwright/test';

test.use({
    ignoreHTTPSErrors: true
});

test.describe('Login Page - Checkbox Reset Bug', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('https://localhost:3002/login', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
    });

    test('Checkbox checked -> Reset button -> No validation errors on other fields', async ({ page }) => {
        // Step 1: Fill username and password
        const usernameInput = page.locator('input[name="username"]').first();
        const passwordInput = page.locator('input[name="password"]').first();
        const rememberCheckbox = page.locator('.checkbox-root').first();
        const resetButton = page.locator('button:has-text("Reset")').first();

        await usernameInput.fill('testuser');
        await passwordInput.fill('testpass123');
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/screenshots/checkbox-reset/01-filled.png', fullPage: true });

        // Step 2: Check "Remember me" checkbox
        await rememberCheckbox.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/screenshots/checkbox-reset/02-checkbox-checked.png', fullPage: true });

        // Step 3: Click Reset button (first click)
        await resetButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tests/screenshots/checkbox-reset/03-after-first-reset.png', fullPage: true });

        // Step 4: Check that NO validation errors appear on username/password fields
        // Get the input roots
        const usernameRoot = usernameInput.locator('..').first();
        const passwordRoot = passwordInput.locator('..').first();

        // Check classes - should NOT have color-error
        const usernameClasses = await usernameRoot.getAttribute('class');
        const passwordClasses = await passwordRoot.getAttribute('class');

        console.log('Username root classes:', usernameClasses);
        console.log('Password root classes:', passwordClasses);

        // Verify no error classes
        if (usernameClasses) {
            expect(usernameClasses).not.toContain('color-error');
        }
        if (passwordClasses) {
            expect(passwordClasses).not.toContain('color-error');
        }

        // Verify fields are cleared
        const usernameValue = await usernameInput.inputValue();
        const passwordValue = await passwordInput.inputValue();
        const checkboxClasses = await rememberCheckbox.getAttribute('class');
        const checkboxChecked = checkboxClasses?.includes('has-value') ?? false;

        console.log('Username value after reset:', usernameValue);
        console.log('Password value after reset:', passwordValue);
        console.log('Checkbox checked after reset:', checkboxChecked);

        expect(usernameValue).toBe('');
        expect(passwordValue).toBe('');
        expect(checkboxChecked).toBe(false);

        // Step 5: Verify reset button is now disabled (form is pristine)
        const isResetDisabled = await resetButton.isDisabled();
        console.log('Reset button disabled after reset:', isResetDisabled);
        expect(isResetDisabled).toBe(true);

        await page.screenshot({ path: 'tests/screenshots/checkbox-reset/04-final-state.png', fullPage: true });
    });
});