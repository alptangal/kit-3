import { test, expect } from '@playwright/test';

const components = [
  { name: 'Button', selector: 'button:has-text("Button")' },
  { name: 'Tooltip-Button', selector: 'button:has-text("Tooltip")' },
  // Input component renders type="number" as a text input with class
  // 'input-editor-number' (custom visual number keyboard design).
  // Hover nhắm vào wrapper div — input bên trong không nhận pointer events.
  {
    name: 'Input-Number',
    selector: '.input-editor-number input',
    hoverSelector: '.input-editor-number'
  },
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
      const element = page.locator(component.hoverSelector ?? component.selector).first();
      const box = await element.boundingBox();
      if (box) {
        // Input component có overlay div chặn pointer events trên wrapper,
        // nên dùng mouse.move tới tọa độ thay vì locator.hover()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await element.hover();
      }
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
    const input = page.locator('.input-editor-number input').first();
    await input.fill('123');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/ui-check/${testInfo.project.name}-Input-filled.png`, fullPage: false });
  });
});