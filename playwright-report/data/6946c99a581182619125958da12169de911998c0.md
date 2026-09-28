# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: register-input-styling.spec.ts >> Register Page Input Styling >> should have show/hide password toggle buttons
- Location: tests\register-input-styling.spec.ts:125:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('input[name="password"]').locator('..').locator('button').filter({ has: locator('svg') }).last()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('input[name="password"]').locator('..').locator('button').filter({ has: locator('svg') }).last() with timeout 5000ms
  - waiting for locator('input[name="password"]').locator('..').locator('button').filter({ has: locator('svg') }).last()

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
- text: Phone number
- textbox "Phone number":
  - /placeholder: Enter phone number (optional)
- text: Optional - for account recovery and notifications Password *
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
  - /url: /login
```

# Test source

```ts
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
> 128 |     await expect(passwordToggle).toBeVisible();
      |                                  ^ Error: expect(locator).toBeVisible() failed
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
  173 |       const root = document.documentElement;
  174 |       const style = window.getComputedStyle(root);
  175 |       return {
  176 |         background: style.getPropertyValue('--background'),
  177 |         foreground: style.getPropertyValue(--foreground),
  178 |         primary: style.getPropertyValue('--primary'),
  179 |         success: style.getPropertyValue('--success'),
  180 |         error: style.getPropertyValue('--error'),
  181 |       };
  182 |     });
  183 | 
  184 |     console.log('CSS Variables:', variables);
  185 |     // Just verify they exist
  186 |     expect(variables.background).toBeTruthy();
  187 |     expect(variables.primary).toBeTruthy();
  188 |   });
  189 | 
  190 |   test('should have responsive name field grid layout', async ({ page }) => {
  191 |     const nameGrid = page.locator('.name-grid');
  192 |     await expect(nameGrid).toBeVisible();
  193 | 
  194 |     // Check grid styles at desktop
  195 |     const gridStyles = await nameGrid.evaluate((el) => {
  196 |       const computed = window.getComputedStyle(el);
  197 |       return {
  198 |         display: computed.display,
  199 |         gridTemplateColumns: computed.gridTemplateColumns,
  200 |         gap: computed.gap,
  201 |       };
  202 |     });
  203 | 
  204 |     expect(gridStyles.display).toBe('grid');
  205 |     expect(gridStyles.gridTemplateColumns).toContain('1fr');
  206 |   });
  207 | });
```