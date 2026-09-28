# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: register-input-styling.spec.ts >> Register Page Input Styling >> should have proper input styling with border-radius and padding
- Location: tests\register-input-styling.spec.ts:40:3

# Error details

```
Error: expect(locator).toHaveClass(expected) failed

Locator: locator('input[name="username"]').locator('..')
Expected pattern: /input-root/
Received string:  "input-highlight-wrapper s-QjuUwB7bxiUp"
Timeout: 5000ms

Call log:
  - Expect "toHaveClass" locator('input[name="username"]').locator('..') with timeout 5000ms
  - waiting for locator('input[name="username"]').locator('..')
    13 × locator resolved to <div class="input-highlight-wrapper s-QjuUwB7bxiUp">…</div>
       - unexpected value "input-highlight-wrapper s-QjuUwB7bxiUp"

```

```yaml
- textbox "Username *":
  - /placeholder: Enter username
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Register Page Input Styling', () => {
  4   |   test.use({
  5   |   baseURL: 'https://localhost:3000',
  6   | });
  7   | 
  8   | test.beforeEach(async ({ page }) => {
  9   |     // Navigate to the register page
  10  |     await page.goto('/register', { waitUntil: 'domcontentloaded' });
  11  |     // Wait for the page to load
  12  |     await page.waitForLoadState('networkidle');
  13  |   });
  14  | 
  15  |   test('should load register page without errors', async ({ page }) => {
  16  |     await expect(page).toHaveTitle(/Create an account|Đăng ký/);
  17  |   });
  18  | 
  19  |   test('should have all input fields visible and properly styled', async ({ page }) => {
  20  |     // Check all text input fields exist
  21  |     const lastnameInput = page.locator('input[name="lastname"]');
  22  |     const midnameInput = page.locator('input[name="midname"]');
  23  |     const firstnameInput = page.locator('input[name="firstname"]');
  24  |     const usernameInput = page.locator('input[name="username"]');
  25  |     const emailInput = page.locator('input[name="email"]');
  26  |     const phoneInput = page.locator('input[name="phone"]');
  27  |     const passwordInput = page.locator('input[name="password"]');
  28  |     const confirmPasswordInput = page.locator('input[name="confirmPassword"]');
  29  | 
  30  |     await expect(lastnameInput).toBeVisible();
  31  |     await expect(midnameInput).toBeVisible();
  32  |     await expect(firstnameInput).toBeVisible();
  33  |     await expect(usernameInput).toBeVisible();
  34  |     await expect(emailInput).toBeVisible();
  35  |     await expect(phoneInput).toBeVisible();
  36  |     await expect(passwordInput).toBeVisible();
  37  |     await expect(confirmPasswordInput).toBeVisible();
  38  |   });
  39  | 
  40  |   test('should have proper input styling with border-radius and padding', async ({ page }) => {
  41  |     const usernameInput = page.locator('input[name="username"]');
  42  |     const inputContainer = usernameInput.locator('..'); // The input root container
  43  | 
  44  |     // Check that the input container has the expected classes
> 45  |     await expect(inputContainer).toHaveClass(/input-root/);
      |                                  ^ Error: expect(locator).toHaveClass(expected) failed
  46  | 
  47  |     // Check computed styles
  48  |     const styles = await inputContainer.evaluate((el) => {
  49  |       const computed = window.getComputedStyle(el);
  50  |       return {
  51  |         borderRadius: computed.borderRadius,
  52  |         minHeight: computed.minHeight,
  53  |         paddingInline: computed.paddingInlineStart,
  54  |         backgroundColor: computed.backgroundColor,
  55  |         borderWidth: computed.borderWidth,
  56  |         borderColor: computed.borderColor,
  57  |         display: computed.display,
  58  |       };
  59  |     });
  60  | 
  61  |     // Verify basic styling
  62  |     expect(styles.borderRadius).not.toBe('0px');
  63  |     expect(styles.minHeight).not.toBe('0px');
  64  |     expect(styles.display).toBe('flex');
  65  |   });
  66  | 
  67  |   test('should show focus state styling on input focus', async ({ page }) => {
  68  |     const usernameInput = page.locator('input[name="username"]');
  69  |     const inputContainer = usernameInput.locator('..');
  70  | 
  71  |     // Focus the input
  72  |     await usernameInput.focus();
  73  | 
  74  |     // Check that focus class is applied
  75  |     await expect(inputContainer).toHaveClass(/focus/);
  76  | 
  77  |     // Check focus border color
  78  |     const focusStyles = await inputContainer.evaluate((el) => {
  79  |       const computed = window.getComputedStyle(el);
  80  |       return {
  81  |         borderColor: computed.borderColor,
  82  |       };
  83  |     });
  84  | 
  85  |     // Should have focus border color (sky-500)
  86  |     expect(focusStyles.borderColor).toBeTruthy();
  87  |   });
  88  | 
  89  |   test('should show error state styling when validation fails', async ({ page }) => {
  90  |     const usernameInput = page.locator('input[name="username"]');
  91  |     const inputContainer = usernameInput.locator('..');
  92  | 
  93  |     // Fill with invalid username (too short)
  94  |     await usernameInput.fill('ab');
  95  |     await usernameInput.blur();
  96  | 
  97  |     // Wait for validation
  98  |     await page.waitForTimeout(500);
  99  | 
  100 |     // Check if error styling is applied (might need more complex validation)
  101 |     // For now, just verify the input can receive error state
  102 |     const errorStyles = await inputContainer.evaluate((el) => {
  103 |       return {
  104 |         classList: Array.from(el.classList),
  105 |       };
  106 |     });
  107 | 
  108 |     console.log('Error state classes:', errorStyles.classList);
  109 |   });
  110 | 
  111 |   test('should have proper leading icons for inputs', async ({ page }) => {
  112 |     // Check username leading icon (user icon)
  113 |     const usernameLeading = page.locator('input[name="username"]').locator('..').locator('svg.auth-input-icon');
  114 |     await expect(usernameLeading).toBeVisible();
  115 | 
  116 |     // Check email leading icon (mail icon)
  117 |     const emailLeading = page.locator('input[name="email"]').locator('..').locator('svg.auth-input-icon');
  118 |     await expect(emailLeading).toBeVisible();
  119 | 
  120 |     // Check password leading icon (lock icon)
  121 |     const passwordLeading = page.locator('input[name="password"]').locator('..').locator('svg.auth-input-icon');
  122 |     await expect(passwordLeading).toBeVisible();
  123 |   });
  124 | 
  125 |   test('should have show/hide password toggle buttons', async ({ page }) => {
  126 |     // Password field should have eye icon button
  127 |     const passwordToggle = page.locator('input[name="password"]').locator('..').locator('button').filter({ has: page.locator('svg') }).last();
  128 |     await expect(passwordToggle).toBeVisible();
  129 | 
  130 |     // Confirm password field should have eye icon button
  131 |     const confirmPasswordToggle = page.locator('input[name="confirmPassword"]').locator('..').locator('button').filter({ has: page.locator('svg') }).last();
  132 |     await expect(confirmPasswordToggle).toBeVisible();
  133 |   });
  134 | 
  135 |   test('should have password strength meter', async ({ page }) => {
  136 |     const passwordInput = page.locator('input[name="password"]');
  137 |     const passwordContainer = passwordInput.locator('..').locator('..'); // TextField root
  138 | 
  139 |     // Fill password to trigger strength meter
  140 |     await passwordInput.fill('TestPass123');
  141 | 
  142 |     // Check strength meter appears
  143 |     const strengthMeter = passwordContainer.locator('.strength-meter');
  144 |     await expect(strengthMeter).toBeVisible();
  145 | 
```