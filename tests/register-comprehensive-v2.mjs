import { chromium } from 'playwright';

async function testRegisterPage() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3003/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  console.log('========== REGISTER PAGE TESTS (with unique values) ==========');

  // Test 1: Submit button disabled logic
  const submitBtn = page.locator('button.auth-btn-submit');
  const checkDisabled = async (label) => {
    const disabled = await submitBtn.evaluate(el => el.disabled);
    const ariaDisabled = await submitBtn.getAttribute('aria-disabled');
    console.log(`${label}: disabled=${disabled}, aria-disabled=${ariaDisabled}`);
  };

  await checkDisabled('Initial (empty)');

  // Use unique values to avoid "taken" conflicts
  const uniqueId = Date.now();
  const username = `user_${uniqueId}`;
  const email = `test_${uniqueId}@example.com`;
  const password = 'password123';

  await page.locator('input[name="lastname"]').fill('Doe');
  await page.waitForTimeout(100);
  await page.locator('input[name="lastname"]').blur();
  await page.waitForTimeout(300);
  await checkDisabled('After lastname');

  await page.locator('input[name="firstname"]').fill('John');
  await page.waitForTimeout(100);
  await page.locator('input[name="firstname"]').blur();
  await page.waitForTimeout(300);
  await checkDisabled('After firstname');

  await page.locator('input[name="username"]').fill(username);
  await page.waitForTimeout(100);
  await page.locator('input[name="username"]').blur();
  await page.waitForTimeout(3000); // wait for debounce and check
  await checkDisabled('After username (waited 3s)');

  await page.locator('input[name="email"]').fill(email);
  await page.waitForTimeout(100);
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(3000); // wait for debounce and check
  await checkDisabled('After email (waited 3s)');

  await page.locator('input[name="password"]').fill(password);
  await page.waitForTimeout(100);
  await page.locator('input[name="password"]').blur();
  await page.waitForTimeout(300);
  await checkDisabled('After password');

  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.waitForTimeout(100);
  await page.locator('input[name="confirmPassword"]').blur();
  await page.waitForTimeout(300);
  await checkDisabled('After confirmPassword');

  const checkbox = page.locator('.checkbox-indicator-root').first();
  await checkbox.click();
  await page.waitForTimeout(600);
  await checkDisabled('After checkbox');

  // Check final status of username/email
  const statusInfo = await page.evaluate(() => {
    // Access the component state
    return {
      usernameStatus: window.__svelte_reg?.usernameStatus,
      emailStatus: window.__svelte_reg?.emailStatus
    };
  });
  console.log('Status info:', statusInfo);

  console.log('\n========== REGISTER PAGE TESTS COMPLETE ==========');
  await browser.close();
}

testRegisterPage().catch(console.error);
