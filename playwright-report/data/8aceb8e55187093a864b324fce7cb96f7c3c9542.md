# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: register-input-styling.spec.ts >> Register Page Input Styling >> should have responsive name field grid layout
- Location: tests\register-input-styling.spec.ts:190:3

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "1fr"
Received string:    "153.333px 153.333px 153.333px"
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - navigation [ref=e5]:
    - generic [ref=e6]: left
    - generic [ref=e7]: control
    - generic [ref=e10]: right
  - generic [ref=e11]:
    - generic [ref=e17]:
      - generic [ref=e23]:
        - heading [level=2] [ref=e24]: Join us today!
        - paragraph [ref=e25]: Start your journey with a professional, securely encrypted management platform.
      - list [ref=e26]:
        - listitem [ref=e27]:
          - generic [ref=e28]: ✦
          - generic [ref=e29]: Vault & End-to-end Encryption
        - listitem [ref=e30]:
          - generic [ref=e31]: ✦
          - generic [ref=e32]: Enterprise distributed data architecture
        - listitem [ref=e33]:
          - generic [ref=e34]: ✦
          - generic [ref=e35]: Access anytime, anywhere on any device
    - generic [ref=e37]:
      - generic [ref=e38]:
        - heading "Create an account" [level=1] [ref=e44]
        - paragraph [ref=e45]: Sign up quickly with advanced end-to-end encryption
      - generic [ref=e46]:
        - generic [aria-hidden] [ref=e47]:
          - text: Website
          - textbox [ref=e48]
        - group "Full name" [ref=e49]:
          - generic [ref=e50]:
            - generic [ref=e51]:
              - generic [ref=e52]: Last name *
              - textbox "Last name *" [ref=e55]:
                - /placeholder: Doe
            - generic [ref=e56]:
              - generic [ref=e57]: Middle name
              - textbox "Middle name" [ref=e60]:
                - /placeholder: Middle
            - generic [ref=e61]:
              - generic [ref=e62]: First name *
              - textbox "First name *" [ref=e65]:
                - /placeholder: John
        - generic [ref=e66]:
          - generic [ref=e67]: Username *
          - textbox "Username *" [ref=e72]:
            - /placeholder: Enter username
          - generic [ref=e73]: 3-30 characters (alphanumeric, -, _)
        - generic [ref=e74]:
          - generic [ref=e75]: Email address *
          - textbox "Email address *" [ref=e81]:
            - /placeholder: Enter your email
        - generic [ref=e82]:
          - generic [ref=e83]: Phone number
          - textbox "Phone number" [ref=e88]:
            - /placeholder: Enter phone number (optional)
          - generic [ref=e89]: Optional - for account recovery and notifications
        - generic [ref=e90]:
          - generic [ref=e91]: Password *
          - generic [ref=e92]:
            - textbox "Password *" [ref=e96]:
              - /placeholder: Enter your password
            - button [ref=e98] [cursor=pointer]
          - generic [ref=e102]: Min 8 chars, uppercase, lowercase, number & special char
        - generic [ref=e103]:
          - generic [ref=e104]: Confirm password *
          - generic [ref=e105]:
            - textbox "Confirm password *" [ref=e109]:
              - /placeholder: Confirm your password
            - button [ref=e111] [cursor=pointer]
        - generic [ref=e117] [cursor=pointer]:
          - text: I agree to the
          - button "Terms of Service & Privacy Policy" [ref=e118]
        - generic [ref=e120]:
          - button "Create account" [disabled]
          - button "Reset form" [disabled]
      - generic [ref=e121]: Already have an account?
      - link "Sign in now" [ref=e124] [cursor=pointer]:
        - /url: /login
```

# Test source

```ts
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
> 205 |     expect(gridStyles.gridTemplateColumns).toContain('1fr');
      |                                            ^ Error: expect(received).toContain(expected) // indexOf
  206 |   });
  207 | });
```