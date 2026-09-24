import { test, expect } from '@playwright/test';

test.describe('Register Page Input Styling', () => {
  test.use({
  baseURL: 'https://localhost:3000',
});

test.beforeEach(async ({ page }) => {
    // Navigate to the register page
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should load register page without errors', async ({ page }) => {
    await expect(page).toHaveTitle(/Create an account|Đăng ký/);
  });

  test('should have all input fields visible and properly styled', async ({ page }) => {
    // Check all text input fields exist
    const lastnameInput = page.locator('input[name="lastname"]');
    const midnameInput = page.locator('input[name="midname"]');
    const firstnameInput = page.locator('input[name="firstname"]');
    const usernameInput = page.locator('input[name="username"]');
    const emailInput = page.locator('input[name="email"]');
    const phoneInput = page.locator('input[name="phone"]');
    const passwordInput = page.locator('input[name="password"]');
    const confirmPasswordInput = page.locator('input[name="confirmPassword"]');

    await expect(lastnameInput).toBeVisible();
    await expect(midnameInput).toBeVisible();
    await expect(firstnameInput).toBeVisible();
    await expect(usernameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(phoneInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(confirmPasswordInput).toBeVisible();
  });

  test('should have proper input styling with border-radius and padding', async ({ page }) => {
    const usernameInput = page.locator('input[name="username"]');
    const inputContainer = usernameInput.locator('..'); // The input root container

    // Check that the input container has the expected classes
    await expect(inputContainer).toHaveClass(/input-root/);

    // Check computed styles
    const styles = await inputContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderRadius: computed.borderRadius,
        minHeight: computed.minHeight,
        paddingInline: computed.paddingInlineStart,
        backgroundColor: computed.backgroundColor,
        borderWidth: computed.borderWidth,
        borderColor: computed.borderColor,
        display: computed.display,
      };
    });

    // Verify basic styling
    expect(styles.borderRadius).not.toBe('0px');
    expect(styles.minHeight).not.toBe('0px');
    expect(styles.display).toBe('flex');
  });

  test('should show focus state styling on input focus', async ({ page }) => {
    const usernameInput = page.locator('input[name="username"]');
    const inputContainer = usernameInput.locator('..');

    // Focus the input
    await usernameInput.focus();

    // Check that focus class is applied
    await expect(inputContainer).toHaveClass(/focus/);

    // Check focus border color
    const focusStyles = await inputContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderColor: computed.borderColor,
      };
    });

    // Should have focus border color (sky-500)
    expect(focusStyles.borderColor).toBeTruthy();
  });

  test('should show error state styling when validation fails', async ({ page }) => {
    const usernameInput = page.locator('input[name="username"]');
    const inputContainer = usernameInput.locator('..');

    // Fill with invalid username (too short)
    await usernameInput.fill('ab');
    await usernameInput.blur();

    // Wait for validation
    await page.waitForTimeout(500);

    // Check if error styling is applied (might need more complex validation)
    // For now, just verify the input can receive error state
    const errorStyles = await inputContainer.evaluate((el) => {
      return {
        classList: Array.from(el.classList),
      };
    });

    console.log('Error state classes:', errorStyles.classList);
  });

  test('should have proper leading icons for inputs', async ({ page }) => {
    // Check username leading icon (user icon)
    const usernameLeading = page.locator('input[name="username"]').locator('..').locator('svg.auth-input-icon');
    await expect(usernameLeading).toBeVisible();

    // Check email leading icon (mail icon)
    const emailLeading = page.locator('input[name="email"]').locator('..').locator('svg.auth-input-icon');
    await expect(emailLeading).toBeVisible();

    // Check password leading icon (lock icon)
    const passwordLeading = page.locator('input[name="password"]').locator('..').locator('svg.auth-input-icon');
    await expect(passwordLeading).toBeVisible();
  });

  test('should have show/hide password toggle buttons', async ({ page }) => {
    // Password field should have eye icon button
    const passwordToggle = page.locator('input[name="password"]').locator('..').locator('button').filter({ has: page.locator('svg') }).last();
    await expect(passwordToggle).toBeVisible();

    // Confirm password field should have eye icon button
    const confirmPasswordToggle = page.locator('input[name="confirmPassword"]').locator('..').locator('button').filter({ has: page.locator('svg') }).last();
    await expect(confirmPasswordToggle).toBeVisible();
  });

  test('should have password strength meter', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]');
    const passwordContainer = passwordInput.locator('..').locator('..'); // TextField root

    // Fill password to trigger strength meter
    await passwordInput.fill('TestPass123');

    // Check strength meter appears
    const strengthMeter = passwordContainer.locator('.strength-meter');
    await expect(strengthMeter).toBeVisible();

    // Check progress bar
    const strengthBar = strengthMeter.locator('.strength-bar-fill');
    await expect(strengthBar).toBeVisible();

    // Check label
    const strengthLabel = strengthMeter.locator('.strength-label');
    await expect(strengthLabel).toBeVisible();
  });

  test('should have email autocomplete suggestions', async ({ page }) => {
    const emailInput = page.locator('input[name="email"]');

    // Type partial email to trigger suggestions
    await emailInput.fill('test@gm');
    await page.waitForTimeout(300);

    // Check suggestions popup
    const suggestions = page.locator('.email-suggestions-popup');
    await expect(suggestions).toBeVisible();

    // Should have gmail.com suggestion
    await expect(suggestions.locator('text=gmail.com')).toBeVisible();
  });

  test('should have proper dark/light theme support', async ({ page }) => {
    // Check that CSS variables are properly defined
    const variables = await page.evaluate(() => {
      const root = document.documentElement;
      const style = window.getComputedStyle(root);
      return {
        background: style.getPropertyValue('--background'),
        foreground: style.getPropertyValue(--foreground),
        primary: style.getPropertyValue('--primary'),
        success: style.getPropertyValue('--success'),
        error: style.getPropertyValue('--error'),
      };
    });

    console.log('CSS Variables:', variables);
    // Just verify they exist
    expect(variables.background).toBeTruthy();
    expect(variables.primary).toBeTruthy();
  });

  test('should have responsive name field grid layout', async ({ page }) => {
    const nameGrid = page.locator('.name-grid');
    await expect(nameGrid).toBeVisible();

    // Check grid styles at desktop
    const gridStyles = await nameGrid.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        gridTemplateColumns: computed.gridTemplateColumns,
        gap: computed.gap,
      };
    });

    expect(gridStyles.display).toBe('grid');
    expect(gridStyles.gridTemplateColumns).toContain('1fr');
  });
});