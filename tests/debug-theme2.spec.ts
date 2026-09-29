import { test, expect } from '@playwright/test';

test.describe('Debug Theme 2', () => {
  test.use({ baseURL: 'https://localhost:3000' });

  test('replicate original test logic', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    // Check that CSS variables are properly defined - exact copy from original test
    const variables = await page.evaluate(() => {
      const root = document.documentElement;
      const style = window.getComputedStyle(root);
      return {
        background: style.getPropertyValue('--background'),
        foreground: style.getPropertyValue('--foreground'),
        primary: style.getPropertyValue('--primary'),
        success: style.getPropertyValue('--success'),
        error: style.getPropertyValue('--error'),
      };
    });

    console.log('CSS Variables:', variables);
    
    // Original test expectations
    expect(variables.background).toBeTruthy();
    expect(variables.primary).toBeTruthy();
  });
});
