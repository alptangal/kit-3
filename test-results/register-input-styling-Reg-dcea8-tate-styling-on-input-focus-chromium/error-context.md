# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: register-input-styling.spec.ts >> Register Page Input Styling >> should show focus state styling on input focus
- Location: tests\register-input-styling.spec.ts:67:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.focus: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[name="username"]')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]: "500"
    - 'heading "D:/nodejs/svelte/kit-3/src/lib/components/layout/navigation-bar/Main.svelte:44:63 Invalid regular expression: /if}}</: Lone quantifier brackets https://svelte.dev/e/js_parse_error" [level=1] [ref=e5]'
  - generic [ref=e8]:
    - generic [ref=e9]: "[plugin:vite-plugin-svelte:compile] D:/nodejs/svelte/kit-3/src/lib/components/layout/navigation-bar/Main.svelte:44:63 Invalid regular expression: /if}}</: Lone quantifier brackets https://svelte.dev/e/js_parse_error"
    - generic [ref=e10]: Main.svelte:44:63
    - generic [ref=e11]: "42 | {/if} 43 | <div class=\"nav-sidebar {configs.isOpen ? 'nav-sidebar--open' : ''}\"> 44 | <div class=\"nav-brand\">{#if configs.brand}{configs.brand}{{/if}}</div> ^ 45 | <div class=\"nav-list\"> 46 | {#each configs.items as item, i}"
    - generic [ref=e12]:
      - text: Click outside, press Esc key, or fix the code to dismiss.You can also disable this overlay by setting
      - code [ref=e13]: server.hmr.overlay
      - text: to
      - code [ref=e14]: "false"
      - text: in
      - code [ref=e15]: vite.config.ts
      - text: .
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
  45  |     await expect(inputContainer).toHaveClass(/input-root/);
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
> 72  |     await usernameInput.focus();
      |                         ^ Error: locator.focus: Test timeout of 30000ms exceeded.
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
  146 |     // Check progress bar
  147 |     const strengthBar = strengthMeter.locator('.strength-bar-fill');
  148 |     await expect(strengthBar).toBeVisible();
  149 | 
  150 |     // Check label
  151 |     const strengthLabel = strengthMeter.locator('.strength-label');
  152 |     await expect(strengthLabel).toBeVisible();
  153 |   });
  154 | 
  155 |   test('should have email autocomplete suggestions', async ({ page }) => {
  156 |     const emailInput = page.locator('input[name="email"]');
  157 | 
  158 |     // Type partial email to trigger suggestions
  159 |     await emailInput.fill('test@gm');
  160 |     await page.waitForTimeout(300);
  161 | 
  162 |     // Check suggestions popup
  163 |     const suggestions = page.locator('.email-suggestions-popup');
  164 |     await expect(suggestions).toBeVisible();
  165 | 
  166 |     // Should have gmail.com suggestion
  167 |     await expect(suggestions.locator('text=gmail.com')).toBeVisible();
  168 |   });
  169 | 
  170 |   test('should have proper dark/light theme support', async ({ page }) => {
  171 |     // Check that CSS variables are properly defined
  172 |     const variables = await page.evaluate(() => {
```