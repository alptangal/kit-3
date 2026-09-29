# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: register-input-styling.spec.ts >> Register Page Input Styling >> should have all input fields visible and properly styled
- Location: tests\register-input-styling.spec.ts:15:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  locator('input[name="lastname"]')
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" locator('input[name="lastname"]') with timeout 5000ms
  - waiting for locator('input[name="lastname"]')

```

```yaml
- navigation: left control right
- heading "Create an account" [level=1]
- paragraph: Sign up quickly with advanced end-to-end encryption
- group "Full name":
  - text: Last name *
  - textbox "Last name *":
    - /placeholder: Doe
  - text: Middle name
  - textbox "Middle name":
    - /placeholder: Middle
  - text: First name *
  - textbox "First name *":
    - /placeholder: John
- text: Username *
- textbox "Username *":
  - /placeholder: Enter username
- text: 3-30 characters (alphanumeric, -, _) Email address *
- textbox "Email address *":
  - /placeholder: Enter your email
- text: Phone number *
- textbox "Phone number *":
  - /placeholder: Enter phone number
- text: Enter Vietnamese phone number (e.g., 09xxxxxxxx or +849xxxxxxxx) Password *
- textbox "Password *":
  - /placeholder: Enter your password
- button
- text: Min 8 chars, uppercase, lowercase, number & special char Confirm password *
- textbox "Confirm password *":
  - /placeholder: Confirm your password
- button
- text: I agree to the
- button "Terms of Service & Privacy Policy"
- button "Create account" [disabled]
- button "Reset form" [disabled]
- text: Already have an account?
- link "Sign in now":
  - /url: ./login
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Register Page Input Styling', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     // Navigate to the register page
  6   |     await page.goto('/register', { waitUntil: 'domcontentloaded' });
  7   |     // Wait for the page to load
  8   |     await page.waitForLoadState('networkidle');
  9   |   });
  10  | 
  11  |   test('should load register page without errors', async ({ page }) => {
  12  |     await expect(page).toHaveTitle(/Create an account|Đăng ký/);
  13  |   });
  14  | 
  15  |   test('should have all input fields visible and properly styled', async ({ page }) => {
  16  |     // Check all text input fields exist
  17  |     const lastnameInput = page.locator('input[name="lastname"]');
  18  |     const midnameInput = page.locator('input[name="midname"]');
  19  |     const firstnameInput = page.locator('input[name="firstname"]');
  20  |     const usernameInput = page.locator('input[name="username"]');
  21  |     const emailInput = page.locator('input[name="email"]');
  22  |     const phoneInput = page.locator('input[name="phone"]');
  23  |     const passwordInput = page.locator('input[name="password"]');
  24  |     const confirmPasswordInput = page.locator('input[name="confirmPassword"]');
  25  | 
> 26  |     await expect(lastnameInput).toBeVisible();
      |                                 ^ Error: expect(locator).toBeVisible() failed
  27  |     await expect(midnameInput).toBeVisible();
  28  |     await expect(firstnameInput).toBeVisible();
  29  |     await expect(usernameInput).toBeVisible();
  30  |     await expect(emailInput).toBeVisible();
  31  |     await expect(phoneInput).toBeVisible();
  32  |     await expect(passwordInput).toBeVisible();
  33  |     await expect(confirmPasswordInput).toBeVisible();
  34  |   });
  35  | 
  36  |   test('should have proper input styling with border-radius and padding', async ({ page }) => {
  37  |     const usernameInput = page.locator('input[name="username"]');
  38  |     // Input is inside .input-highlight-wrapper which is inside .input-root
  39  |     const inputContainer = usernameInput.locator('..').locator('..'); // .input-root
  40  | 
  41  |     // Check that the input container has the expected classes
  42  |     await expect(inputContainer).toHaveClass(/input-root/);
  43  | 
  44  |     // Check computed styles
  45  |     const styles = await inputContainer.evaluate((el) => {
  46  |       const computed = window.getComputedStyle(el);
  47  |       return {
  48  |         borderRadius: computed.borderRadius,
  49  |         minHeight: computed.minHeight,
  50  |         paddingInline: computed.paddingInlineStart,
  51  |         backgroundColor: computed.backgroundColor,
  52  |         borderWidth: computed.borderWidth,
  53  |         borderColor: computed.borderColor,
  54  |         display: computed.display,
  55  |       };
  56  |     });
  57  | 
  58  |     // Verify basic styling
  59  |     expect(styles.borderRadius).not.toBe('0px');
  60  |     expect(styles.minHeight).not.toBe('0px');
  61  |     expect(styles.display).toBe('flex');
  62  |   });
  63  | 
  64  |   test('should show focus state styling on input focus', async ({ page }) => {
  65  |     const usernameInput = page.locator('input[name="username"]');
  66  |     // Input is inside .input-highlight-wrapper which is inside .input-root
  67  |     const inputContainer = usernameInput.locator('..').locator('..'); // .input-root
  68  | 
  69  |     // Focus the input
  70  |     await usernameInput.focus();
  71  | 
  72  |     // Check that focus class is applied
  73  |     await expect(inputContainer).toHaveClass(/focus/);
  74  | 
  75  |     // Check focus border color
  76  |     const focusStyles = await inputContainer.evaluate((el) => {
  77  |       const computed = window.getComputedStyle(el);
  78  |       return {
  79  |         borderColor: computed.borderColor,
  80  |       };
  81  |     });
  82  | 
  83  |     // Should have focus border color (sky-500)
  84  |     expect(focusStyles.borderColor).toBeTruthy();
  85  |   });
  86  | 
  87  |   test('should show error state styling when validation fails', async ({ page }) => {
  88  |     const usernameInput = page.locator('input[name="username"]');
  89  |     // Input is inside .input-highlight-wrapper which is inside .input-root
  90  |     const inputContainer = usernameInput.locator('..').locator('..'); // .input-root
  91  | 
  92  |     // Fill with invalid username (too short)
  93  |     await usernameInput.fill('ab');
  94  |     await usernameInput.blur();
  95  | 
  96  |     // Wait for validation
  97  |     await page.waitForTimeout(500);
  98  | 
  99  |     // Check if error styling is applied (might need more complex validation)
  100 |     // For now, just verify the input can receive error state
  101 |     const errorStyles = await inputContainer.evaluate((el) => {
  102 |       return {
  103 |         classList: Array.from(el.classList),
  104 |       };
  105 |     });
  106 | 
  107 |     console.log('Error state classes:', errorStyles.classList);
  108 |   });
  109 | 
  110 |   test('should have proper leading icons for inputs', async ({ page }) => {
  111 |     // Check username leading icon (user icon) - SVG is inside input-root div
  112 |     const usernameLeading = page.locator('input[name="username"]').locator('..').locator('..').locator('svg.auth-input-icon');
  113 |     await expect(usernameLeading).toBeVisible();
  114 | 
  115 |     // Check email leading icon (mail icon)
  116 |     const emailLeading = page.locator('input[name="email"]').locator('..').locator('..').locator('svg.auth-input-icon');
  117 |     await expect(emailLeading).toBeVisible();
  118 | 
  119 |     // Check password leading icon (lock icon)
  120 |     const passwordLeading = page.locator('input[name="password"]').locator('..').locator('..').locator('svg.auth-input-icon');
  121 |     await expect(passwordLeading).toBeVisible();
  122 |   });
  123 | 
  124 |   test('should have show/hide password toggle buttons', async ({ page }) => {
  125 |     // Password field should have eye icon button - inside input-group-actions
  126 |     const passwordToggle = page.locator('input[name="password"]').locator('..').locator('..').locator('.input-group-actions button').filter({ has: page.locator('svg') }).first();
```