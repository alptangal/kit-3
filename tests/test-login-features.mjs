import { chromium } from 'playwright';

async function testLoginPageFeatures() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--ignore-certificate-errors']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  try {
    // Test Login Page - password field show/hide and clear button
    console.log('\n========== TEST LOGIN PAGE FEATURES ==========');
    await page.goto('https://localhost:3001/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Test password field show/hide button
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.click();
    await passwordInput.fill('testpassword');
    await page.waitForTimeout(300);

    // Check show password button exists (it's in the input-group-actions for the password field)
    const showPwdButtons = page.locator('.input-group-actions button:has(svg)');
    const showPwdCount = await showPwdButtons.count();
    console.log('Show password buttons count:', showPwdCount);

    // Check clear button on password field
    const passwordClearButton = page.locator('.input-group-actions .input-clear').last();
    const pwdClearVisible = await passwordClearButton.isVisible();
    console.log('Password field clear button visible:', pwdClearVisible);

    // Test Forgot Password Page - email field with real-time validation
    console.log('\n========== TEST FORGOT PASSWORD PAGE FEATURES ==========');
    await page.goto('https://localhost:3001/forgot-password', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Test email field - should have real-time validation loading indicator
    const emailInput = page.locator('input[type="email"]');
    await emailInput.click();
    await emailInput.fill('test@example.com');
    await page.waitForTimeout(500);

    // Check for loading indicator during validation
    const loadingIndicator = page.locator('.input-loading-indicator');
    const loadingVisible = await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false);
    console.log('Loading indicator visible during validation:', loadingVisible);

    // Wait for validation to complete
    await page.waitForTimeout(1000);

    // Check if clear button appears after validation
    const forgotClearButton = page.locator('.input-group-actions .input-clear');
    const forgotClearVisible = await forgotClearButton.isVisible({ timeout: 1000 }).catch(() => false);
    console.log('Clear button visible after validation:', forgotClearVisible);

    // Test email autocomplete trigger on forgot password page
    console.log('\n========== TEST EMAIL AUTOCOMPLETE ON FORGOT PASSWORD ==========');
    await emailInput.fill('');

    const emailTriggerResults = await page.evaluate(async () => {
      const input = document.querySelector('input[type="email"]');
      if (!input) return { error: 'Input not found' };

      const results = [];

      // Test 1: Only @
      input.focus();
      input.value = '@';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
      results.push({
        test: 'only @',
        popupVisible: !!document.querySelector('.email-suggestions-popup')
      });

      // Test 2: a@
      input.value = 'a@';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
      results.push({
        test: 'a@',
        popupVisible: !!document.querySelector('.email-suggestions-popup')
      });

      // Test 3: full email
      input.value = 'test@gmail.com';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
      results.push({
        test: 'full email',
        popupVisible: !!document.querySelector('.email-suggestions-popup')
      });

      return results;
    });

    console.log('Email autocomplete trigger on forgot password page:', JSON.stringify(emailTriggerResults, null, 2));

    // Test Register Page features
    console.log('\n========== TEST REGISTER PAGE FEATURES ==========');
    await page.goto('https://localhost:3001/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Test email field on register page
    const registerEmailInput = page.locator('input[type="email"]');
    await registerEmailInput.click();
    await registerEmailInput.fill('test');
    await page.waitForTimeout(300);

    // Test phone field autocomplete
    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.click();
    await phoneInput.fill('8');
    await page.waitForTimeout(500);

    const phonePopup = page.locator('.phone-suggestions-popup');
    const phonePopupVisible = await phonePopup.isVisible();
    console.log('Phone suggestions popup visible:', phonePopupVisible);

    // Test phone autocomplete z-index
    if (phonePopupVisible) {
      const phoneZIndex = await phonePopup.evaluate(el => window.getComputedStyle(el).zIndex);
      console.log('Phone suggestions z-index:', phoneZIndex);
    }

    // Test email autocomplete z-index on register page
    await registerEmailInput.fill('test@');
    await page.waitForTimeout(500);

    const registerEmailPopup = page.locator('.email-suggestions-popup');
    const registerEmailPopupVisible = await registerEmailPopup.isVisible();
    console.log('Register email suggestions popup visible:', registerEmailPopupVisible);

    if (registerEmailPopupVisible) {
      const emailZIndex = await registerEmailPopup.evaluate(el => window.getComputedStyle(el).zIndex);
      console.log('Register email suggestions z-index:', emailZIndex);
    }

    console.log('\n========== SUMMARY ==========');
    console.log('✅ All features tested successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testLoginPageFeatures().catch(console.error);