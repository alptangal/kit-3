import { test, expect } from '@playwright/test';

const components = [
  { name: 'Button', selector: 'button:has-text("Button")' },
  { name: 'Tooltip-Button', selector: 'button:has-text("Tooltip")' },
  { name: 'Input-Number', selector: 'input[type="number"]' },
];

test.describe('UI Component Cross-Browser Check', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ui');
    await page.waitForLoadState('networkidle');
  });

  for (const component of components) {
    test(`${component.name} - Default State`, async ({ page }, testInfo) => {
      const element = page.locator(component.selector).first();
      await expect(element).toBeVisible();
      await page.screenshot({ path: `test-results/ui-check/${testInfo.project.name}-${component.name}-default.png`, fullPage: false });
    });

    test(`${component.name} - Hover State`, async ({ page }, testInfo) => {
      const element = page.locator(component.selector).first();
      await element.hover();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/ui-check/${testInfo.project.name}-${component.name}-hover.png`, fullPage: false });
    });

    test(`${component.name} - Focus State`, async ({ page }, testInfo) => {
      const element = page.locator(component.selector).first();
      await element.focus();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/ui-check/${testInfo.project.name}-${component.name}-focus.png`, fullPage: false });
    });
  }

  test('Tooltip - Open/Close', async ({ page }, testInfo) => {
    const tooltipTrigger = page.locator('button:has-text("Tooltip")').first();
    await tooltipTrigger.hover();
    await page.waitForTimeout(500);
    const tooltipContent = page.locator('[role="tooltip"]').first();
    if (await tooltipContent.isVisible().catch(() => false)) {
      await page.screenshot({ path: `test-results/ui-check/${testInfo.project.name}-Tooltip-open.png`, fullPage: false });
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `test-results/ui-check/${testInfo.project.name}-Tooltip-closed.png`, fullPage: false });
  });

  test('Input - Type and Interaction', async ({ page }, testInfo) => {
    const input = page.locator('input[type="number"]').first();
    await input.fill('123');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/ui-check/${testInfo.project.name}-Input-filled.png`, fullPage: false });
  });
});