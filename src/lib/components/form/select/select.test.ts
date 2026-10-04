import { test, expect } from '@playwright/test';

test.describe('Select Component', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/select-test', { waitUntil: 'networkidle' });
		await page.waitForTimeout(500);
	});

	test('Basic single select - open dropdown and select option', async ({ page }) => {
		const selectTrigger = page.locator('.select-root').first().locator('.select-trigger');
		const selectRoot = page.locator('.select-root').first();

		// Click to open dropdown
		await selectTrigger.click();
		await page.waitForTimeout(100);

		// Check dropdown is open
		await expect(selectRoot).toHaveClass(/open/);

		// Select an option
		await page.locator('.select-option', { hasText: 'Việt Nam' }).click();
		await page.waitForTimeout(100);

		// Check value is set
		await expect(selectTrigger.locator('.select-trigger__value')).toContainText('Việt Nam');

		// Check dropdown closed
		await expect(selectRoot).not.toHaveClass(/open/);
	});

	test('Searchable select - type to filter options', async ({ page }) => {
		const selectTrigger = page.locator('.select-root').nth(1).locator('.select-trigger');
		const selectRoot = page.locator('.select-root').nth(1);

		await selectTrigger.click();
		await page.waitForTimeout(100);

		// Type in search
		const searchInput = selectRoot.locator('.select-search-input');
		await searchInput.fill('Việt');
		await page.waitForTimeout(100);

		// Should show only matching option
		await expect(page.locator('.select-option', { hasText: 'Việt Nam' })).toBeVisible();
		await expect(page.locator('.select-option', { hasText: 'Hoa Kỳ' })).not.toBeVisible();

		await searchInput.fill('Japan');
		await page.waitForTimeout(100);
		await expect(page.locator('.select-option', { hasText: 'Nhật Bản' })).toBeVisible();
	});

	test('Multiple select - select multiple options', async ({ page }) => {
		const selectRoot = page.locator('.select-root').nth(3);
		const selectTrigger = selectRoot.locator('.select-trigger');

		await selectTrigger.click();
		await page.waitForTimeout(100);

		// Select multiple options
		await page.locator('.select-option', { hasText: 'Việt Nam' }).click();
		await page.waitForTimeout(50);
		await page.locator('.select-option', { hasText: 'Nhật Bản' }).click();
		await page.waitForTimeout(50);

		// Check trigger shows both values
		await expect(selectTrigger.locator('.select-trigger__value')).toContainText('Việt Nam');
		await expect(selectTrigger.locator('.select-trigger__value')).toContainText('Nhật Bản');

		// Dropdown should stay open for multiple
		await expect(selectRoot).toHaveClass(/open/);
	});

	test('Clear button - clears selection', async ({ page }) => {
		const selectRoot = page.locator('.select-root').first();
		const selectTrigger = selectRoot.locator('.select-trigger');

		// Select an option first
		await selectTrigger.click();
		await page.waitForTimeout(100);
		await page.locator('.select-option', { hasText: 'Việt Nam' }).click();
		await page.waitForTimeout(100);

		// Click clear button
		await selectRoot.locator('.select-clear-button').click();
		await page.waitForTimeout(100);

		// Value should be cleared
		await expect(selectTrigger.locator('.select-trigger__value .select-placeholder')).toContainText('Chọn quốc gia');
	});

	test('Keyboard navigation - arrow keys and enter', async ({ page }) => {
		const selectTrigger = page.locator('.select-root').first().locator('.select-trigger');

		await selectTrigger.click();
		await page.waitForTimeout(100);

		// Arrow down to highlight
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(50);
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(50);

		// Enter to select
		await page.keyboard.press('Enter');
		await page.waitForTimeout(100);

		// Should have selected 3rd option (Hàn Quốc)
		await expect(selectTrigger.locator('.select-trigger__value')).toContainText('Hàn Quốc');
	});

	test('Escape key closes dropdown', async ({ page }) => {
		const selectTrigger = page.locator('.select-root').first().locator('.select-trigger');
		const selectRoot = page.locator('.select-root').first();

		await selectTrigger.click();
		await page.waitForTimeout(100);

		await expect(selectRoot).toHaveClass(/open/);

		await page.keyboard.press('Escape');
		await page.waitForTimeout(100);

		await expect(selectRoot).not.toHaveClass(/open/);
	});

	test('Disabled option cannot be selected', async ({ page }) => {
		const selectTrigger = page.locator('.select-root').first().locator('.select-trigger');

		await selectTrigger.click();
		await page.waitForTimeout(100);

		// Try to click disabled option
		const disabledOption = page.locator('.select-option.disabled', { hasText: 'Disabled option' });
		await disabledOption.click();
		await page.waitForTimeout(100);

		// Should not select disabled option
		await expect(selectTrigger.locator('.select-trigger__value')).not.toContainText('Disabled option');
	});

	test('Required validation - shows error when empty', async ({ page }) => {
		const selectRoot = page.locator('.select-root').nth(4);
		const selectTrigger = selectRoot.locator('.select-trigger');

		// Focus and blur without selecting
		await selectTrigger.focus();
		await page.waitForTimeout(50);
		await selectTrigger.blur();
		await page.waitForTimeout(500);

		// Should have error styling
		await expect(selectRoot).toHaveClass(/error/);
	});

	test('Different sizes render correctly', async ({ page }) => {
		const sizes = ['xs', 'sm', 'md', 'lg'];

		for (let i = 0; i < sizes.length; i++) {
			const selectRoot = page.locator('.select-root').nth(6 + i);
			await expect(selectRoot).toHaveClass(new RegExp(`size-${sizes[i]}`));
		}
	});

	test('Different variants render correctly', async ({ page }) => {
		const variants = ['secondary', 'primary', 'ghost'];

		for (let i = 0; i < variants.length; i++) {
			const selectRoot = page.locator('.select-root').nth(10 + i);
			await expect(selectRoot).toHaveClass(new RegExp(`variant-${variants[i]}`));
		}
	});

	test('Loading state shows spinner', async ({ page }) => {
		const selectRoot = page.locator('.select-root').last();
		const selectTrigger = selectRoot.locator('.select-trigger');

		await expect(selectTrigger.locator('.select-spinner')).toBeVisible();
		await expect(selectTrigger).toBeDisabled();
	});
});