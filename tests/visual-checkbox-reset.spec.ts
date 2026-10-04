import { test, expect } from '@playwright/test';

test.use({
    ignoreHTTPSErrors: true
});

test.describe('Visual comparison - checkbox reset', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('https://localhost:3000/login', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
    });

    test('Capture states for visual verification', async ({ page }) => {
        const usernameInput = page.locator('input[name="username"]').first();
        const passwordInput = page.locator('input[name="password"]').first();
        const rememberCheckbox = page.locator('.checkbox-root').first();
        const resetButton = page.locator('button:has-text("Reset")').first();

        // 1. Initial state
        await page.screenshot({ path: 'tests/screenshots/visual/01-initial.png', fullPage: true });

        // 2. Check checkbox only
        await rememberCheckbox.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'tests/screenshots/visual/02-checkbox-checked.png', fullPage: true });

        // 3. Click reset
        await resetButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tests/screenshots/visual/03-after-reset.png', fullPage: true });

        // 4. Check input element classes directly
        const usernameClasses = await usernameInput.evaluate(el => el.closest('.input-root')?.className);
        const passwordClasses = await passwordInput.evaluate(el => el.closest('.input-root')?.className);
        const checkboxClasses = await rememberCheckbox.getAttribute('class');

        console.log('=== FINAL STATE ===');
        console.log('Username root classes:', usernameClasses);
        console.log('Password root classes:', passwordClasses);
        console.log('Checkbox classes:', checkboxClasses);

        // Verify no error classes
        expect(usernameClasses).not.toContain('color-error');
        expect(passwordClasses).not.toContain('color-error');
    });
});