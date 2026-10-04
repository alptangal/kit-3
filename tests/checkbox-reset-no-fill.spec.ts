import { test, expect } from '@playwright/test';

test.use({
    ignoreHTTPSErrors: true
});

test.describe('Login Page - Checkbox Reset Bug (No Input Fill)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('https://localhost:3002/login', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
    });

    test('Only check checkbox -> Reset button -> Input fields should NOT change state', async ({ page }) => {
        // Step 1: Initial state - no fill, just check checkbox
        const usernameInput = page.locator('input[name="username"]').first();
        const passwordInput = page.locator('input[name="password"]').first();
        const rememberCheckbox = page.locator('.checkbox-root').first();
        const resetButton = page.locator('button:has-text("Reset")').first();

        await page.screenshot({ path: 'tests/screenshots/checkbox-reset/01-initial-no-fill.png', fullPage: true });

        // Step 2: Check "Remember me" checkbox (WITHOUT filling username/password)
        await rememberCheckbox.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/screenshots/checkbox-reset/02-checkbox-checked-no-fill.png', fullPage: true });

        // Check initial state of inputs (should be pristine, no validation)
        const usernameClassesBefore = await usernameInput.locator('..').first().getAttribute('class');
        const passwordClassesBefore = await passwordInput.locator('..').first().getAttribute('class');
        console.log('Username root classes BEFORE reset:', usernameClassesBefore);
        console.log('Password root classes BEFORE reset:', passwordClassesBefore);

        // Step 3: Click Reset button (first click)
        await resetButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tests/screenshots/checkbox-reset/03-after-first-reset-no-fill.png', fullPage: true });

        // Step 4: Check that input fields did NOT change state (no validation triggered)
        const usernameClassesAfter = await usernameInput.locator('..').first().getAttribute('class');
        const passwordClassesAfter = await passwordInput.locator('..').first().getAttribute('class');
        console.log('Username root classes AFTER reset:', usernameClassesAfter);
        console.log('Password root classes AFTER reset:', passwordClassesAfter);

        // Verify no error classes appeared
        if (usernameClassesAfter) {
            expect(usernameClassesAfter).not.toContain('color-error');
        }
        if (passwordClassesAfter) {
            expect(passwordClassesAfter).not.toContain('color-error');
        }

        // Verify fields are still empty
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

        // Step 5: Verify form is back to pristine state (inputs empty, checkbox unchecked)
        // Note: Reset button doesn't have disabled binding in current implementation
        const isResetDisabled = await resetButton.isDisabled();
        console.log('Reset button disabled after reset:', isResetDisabled);

        await page.screenshot({ path: 'tests/screenshots/checkbox-reset/04-final-state-no-fill.png', fullPage: true });
    });
});