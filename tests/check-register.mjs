import { chromium } from 'playwright';

async function checkRegisterPage() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--ignore-certificate-errors']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to https://localhost:3000/register...');
    await page.goto('https://localhost:3000/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('Page loaded, checking inputs...');

    // Wait for inputs to be visible
    await page.waitForSelector('input[name="lastname"]', { timeout: 10000 });

    // Get all input fields
    const inputs = await page.locator('input[type="text"], input[type="email"], input[type="password"], input[type="tel"]').all();
    console.log(`Found ${inputs.length} input fields`);

    // Check each input's container styling
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const container = input.locator('..');

      // Check if container has input-root class
      const hasInputRoot = await container.evaluate(el => el.classList.contains('input-root'));
      console.log(`Input ${name}: has input-root class = ${hasInputRoot}`);

      // Get computed styles
      const styles = await container.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          borderRadius: computed.borderRadius,
          minHeight: computed.minHeight,
          display: computed.display,
          backgroundColor: computed.backgroundColor,
          borderWidth: computed.borderWidth,
          borderColor: computed.borderColor,
          paddingInlineStart: computed.paddingInlineStart,
        };
      });

      console.log(`Input ${name} styles:`, styles);
    }

    // Check leading icons
    const leadingIcons = await page.locator('svg.auth-input-icon').all();
    console.log(`Found ${leadingIcons.length} leading icons`);

    // Check password strength meter
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill('TestPass123');
    await page.waitForTimeout(300);

    const strengthMeter = page.locator('.strength-meter');
    const isVisible = await strengthMeter.isVisible();
    console.log(`Password strength meter visible: ${isVisible}`);

    if (isVisible) {
      const strengthLabel = await strengthMeter.locator('.strength-label').textContent();
      console.log(`Strength label: ${strengthLabel}`);
    }

    // Check email autocomplete
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill('test@gm');
    await page.waitForTimeout(500);

    const suggestions = page.locator('.email-suggestions-popup');
    const suggestionsVisible = await suggestions.isVisible();
    console.log(`Email suggestions visible: ${suggestionsVisible}`);

    if (suggestionsVisible) {
      const suggestionItems = await suggestions.locator('.email-suggestion-item').all();
      console.log(`Number of suggestions: ${suggestionItems.length}`);
      for (const item of suggestionItems) {
        const text = await item.textContent();
        console.log(`  Suggestion: ${text}`);
      }
    }

    // Check focus state
    const usernameInput = page.locator('input[name="username"]');
    await usernameInput.focus();
    await page.waitForTimeout(100);

    const usernameContainer = usernameInput.locator('..');
    const hasFocusClass = await usernameContainer.evaluate(el => el.classList.contains('focus'));
    console.log(`Username input has focus class: ${hasFocusClass}`);

    // Check name grid layout
    const nameGrid = page.locator('.name-grid');
    const gridStyles = await nameGrid.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        gridTemplateColumns: computed.gridTemplateColumns,
        gap: computed.gap,
      };
    });
    console.log('Name grid styles:', gridStyles);

    // Check CSS variables
    const variables = await page.evaluate(() => {
      const root = document.documentElement;
      const style = window.getComputedStyle(root);
      return {
        background: style.getPropertyValue('--background'),
        primary: style.getPropertyValue('--primary'),
        success: style.getPropertyValue('--success'),
        error: style.getPropertyValue('--error'),
        foreground: style.getPropertyValue('--foreground'),
      };
    });
    console.log('CSS Variables:', variables);

    console.log('\n=== SUMMARY ===');
    console.log('Register page input styling check complete.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkRegisterPage();