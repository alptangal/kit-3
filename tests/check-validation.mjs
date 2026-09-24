import { chromium } from 'playwright';

async function checkValidationStates() {
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

    await page.waitForSelector('input[name="lastname"]', { timeout: 10000 });

    // Helper to get input root
    const getInputRoot = async (name) => {
      const input = page.locator(`input[name="${name}"]`);
      return await input.evaluateHandle((el) => {
        let current = el.parentElement;
        while (current) {
          if (current.classList.contains('input-root')) {
            return current;
          }
          current = current.parentElement;
        }
        return null;
      });
    };

    const getStyles = async (handle) => {
      return await handle.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          borderColor: computed.borderColor,
          backgroundColor: computed.backgroundColor,
          classList: Array.from(el.classList),
        };
      });
    };

    console.log('=== Testing Various Validation Scenarios ===\n');

    // 1. Test required field validation (blur without value)
    console.log('1. Required field validation (username)');
    const usernameRoot = await getInputRoot('username');
    await page.locator('input[name="username"]').focus();
    await page.locator('input[name="username"]').blur();
    await page.waitForTimeout(300);
    console.log('   After blur empty:', await getStyles(usernameRoot));

    // 2. Test email format validation
    console.log('\n2. Email format validation');
    const emailRoot = await getInputRoot('email');
    await page.locator('input[name="email"]').fill('invalid-email');
    await page.locator('input[name="email"]').blur();
    await page.waitForTimeout(300);
    console.log('   After invalid email:', await getStyles(emailRoot));

    // 3. Test password confirmation mismatch
    console.log('\n3. Password confirmation mismatch');
    const passwordRoot = await getInputRoot('password');
    const confirmRoot = await getInputRoot('confirmPassword');

    await page.locator('input[name="password"]').fill('CorrectPass123');
    await page.locator('input[name="confirmPassword"]').fill('WrongPass123');
    await page.locator('input[name="confirmPassword"]').blur();
    await page.waitForTimeout(300);
    console.log('   Password input:', await getStyles(passwordRoot));
    console.log('   Confirm input:', await getStyles(confirmRoot));

    // 4. Test matching passwords
    console.log('\n4. Matching passwords');
    await page.locator('input[name="confirmPassword"]').fill('CorrectPass123');
    await page.locator('input[name="confirmPassword"]').blur();
    await page.waitForTimeout(300);
    console.log('   Password input:', await getStyles(passwordRoot));
    console.log('   Confirm input:', await getStyles(confirmRoot));

    // 5. Test password too short
    console.log('\n5. Password too short');
    await page.locator('input[name="password"]').fill('short');
    await page.locator('input[name="password"]').blur();
    await page.waitForTimeout(300);
    console.log('   After short password:', await getStyles(passwordRoot));

    // 6. Check disabled state during loading
    console.log('\n6. Loading state (username check)');
    await page.locator('input[name="username"]').fill('testuser123');
    await page.locator('input[name="username"]').blur();
    await page.waitForTimeout(100);
    console.log('   During loading:', await getStyles(usernameRoot));
    await page.waitForTimeout(1000);
    console.log('   After loading:', await getStyles(usernameRoot));

    // Cleanup
    await usernameRoot.dispose();
    await emailRoot.dispose();
    await passwordRoot.dispose();
    await confirmRoot.dispose();

    console.log('\n=== SUMMARY ===');
    console.log('Validation state testing complete.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkValidationStates();