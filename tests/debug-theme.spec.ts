import { test, expect } from '@playwright/test';

test.describe('Debug Theme', () => {
  test.use({ baseURL: 'https://localhost:3000' });

  test('debug css variables', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    
    const variables = await page.evaluate(() => {
      const root = document.documentElement;
      const style = window.getComputedStyle(root);
      return {
        background: style.getPropertyValue('--background'),
        foreground: style.getPropertyValue('--foreground'),
        primary: style.getPropertyValue('--primary'),
        success: style.getPropertyValue('--success'),
        error: style.getPropertyValue('--error'),
        allVars: Array.from(style).filter(k => k.startsWith('--')).reduce((acc, k) => {
          acc[k] = style.getPropertyValue(k);
          return acc;
        }, {} as Record<string, string>),
      };
    });

    console.log('CSS Variables:', JSON.stringify(variables, null, 2));
    expect(variables.background).toBeTruthy();
  });
});
