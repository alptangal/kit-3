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

    // Check focus state
    console.log('\n=== Focus State ===');
    const usernameInput = page.locator('input[name="username"]');
    const usernameInputRoot = await usernameInput.evaluateHandle((el) => {
      let current = el.parentElement;
      while (current) {
        if (current.classList.contains('input-root')) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    });

    // Check initial state
    let styles = await usernameInputRoot.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderColor: computed.borderColor,
        classList: Array.from(el.classList),
      };
    });
    console.log('Initial state:', styles);

    // Focus the input
    await usernameInput.focus();
    await page.waitForTimeout(200);

    styles = await usernameInputRoot.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderColor: computed.borderColor,
        classList: Array.from(el.classList),
      };
    });
    console.log('After focus:', styles);

    // Blur
    await usernameInput.blur();
    await page.waitForTimeout(200);

    styles = await usernameInputRoot.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderColor: computed.borderColor,
        classList: Array.from(el.classList),
      };
    });
    console.log('After blur:', styles);

    // Check error state by typing invalid username
    console.log('\n=== Error State (invalid username) ===');
    await usernameInput.fill('ab'); // too short
    await usernameInput.blur();
    await page.waitForTimeout(500);

    styles = await usernameInputRoot.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderColor: computed.borderColor,
        classList: Array.from(el.classList),
      };
    });
    console.log('After invalid input:', styles);

    // Check success state - need to type valid and wait for check
    console.log('\n=== Success State (valid username - would check API) ===');
    await usernameInput.fill('validusername123');
    await usernameInput.blur();
    await page.waitForTimeout(1000); // Wait for API check

    styles = await usernameInputRoot.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        borderColor: computed.borderColor,
        classList: Array.from(el.classList),
      };
    });
    console.log('After valid input:', styles);

    // Check password strength meter with various passwords
    console.log('\n=== Password Strength Meter ===');
    const passwordInput = page.locator('input[name="password"]');
    const passwordInputRoot = await passwordInput.evaluateHandle((el) => {
      let current = el.parentElement;
      while (current) {
        if (current.classList.contains('input-root')) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    });

    const textFieldRoot = await passwordInputRoot.evaluateHandle((el) => el.parentElement);

    const passwords = ['', 'weak', 'Better123', 'VeryStrongPass123!'];
    for (const pwd of passwords) {
      await passwordInput.fill(pwd);
      await page.waitForTimeout(300);

      const strengthMeter = await textFieldRoot.evaluateHandle((el) => el.querySelector('.strength-meter'));
      const isVisible = await strengthMeter.evaluate(el => el !== null);

      if (isVisible) {
        const label = await strengthMeter.evaluate(el => el.querySelector('.strength-label')?.textContent);
        const barWidth = await strengthMeter.evaluate(el => {
          const fill = el.querySelector('.strength-bar-fill');
          return fill ? window.getComputedStyle(fill).width : '0%';
        });
        console.log(`Password "${pwd}": label="${label}", barWidth="${barWidth}"`);
      } else {
        console.log(`Password "${pwd}": No strength meter (empty)`);
      }

      await strengthMeter.dispose();
    }

    // Check email autocomplete
    console.log('\n=== Email Autocomplete ===');
    const emailInput = page.locator('input[name="email"]');
    await emailInput.fill('test@gm');
    await page.waitForTimeout(500);

    const suggestions = await page.locator('.email-suggestions-popup').evaluate((el) => {
      if (!el) return { visible: false };
      const computed = window.getComputedStyle(el);
      const items = Array.from(el.querySelectorAll('.email-suggestion-item')).map(item => item.textContent);
      return {
        visible: computed.display !== 'none',
        items
      };
    });
    console.log('Email suggestions:', suggestions);

    // Check show/hide password toggle
    console.log('\n=== Show/Hide Password Toggle ===');
    const passwordToggle = await passwordInputRoot.evaluateHandle((el) => el.querySelector('button[aria-label*="password" i], button:has(svg)'));
    if (passwordToggle) {
      const isVisible = await passwordToggle.evaluate(el => el !== null);
      console.log('Password toggle button exists:', isVisible);
    }

    // Check leading icons
    console.log('\n=== Leading Icons ===');
    const inputs = ['username', 'email', 'password', 'confirmPassword'];
    for (const name of inputs) {
      const input = page.locator(`input[name="${name}"]`);
      const icon = await input.evaluateHandle((el) => {
        const inputRoot = el.closest('.input-root');
        if (!inputRoot) return null;
        return inputRoot.querySelector('svg.auth-input-icon');
      });

      const hasIcon = await icon.evaluate(el => el !== null);
      console.log(`${name} leading icon: ${hasIcon}`);
      await icon.dispose();
    }

    console.log('\n=== SUMMARY ===');
    console.log('Register page input styling check complete.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkRegisterPage();