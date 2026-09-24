import { chromium } from 'playwright';

async function testForgotPasswordPage() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3003/forgot-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  console.log('========== FORGOT PASSWORD PAGE TESTS (with unique email) ==========');

  // Test 1: Submit button disabled logic
  const submitBtn = page.locator('button.auth-btn-submit');
  const checkDisabled = async (label) => {
    const disabled = await submitBtn.evaluate(el => el.disabled);
    const ariaDisabled = await submitBtn.getAttribute('aria-disabled');
    console.log(`${label}: disabled=${disabled}, aria-disabled=${ariaDisabled}`);
  };

  await checkDisabled('Initial (empty)');

  // Use unique email that should be "available" (not taken)
  const uniqueId = Date.now();
  const email = `test_${uniqueId}@example.com`;

  await page.locator('input[name="email"]').fill(email);
  await page.waitForTimeout(100);
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(3000); // wait for debounce and check
  await checkDisabled('After email (blurred, waited 3s)');

  await page.waitForTimeout(2000);
  await checkDisabled('After email (waited 2s more)');

  console.log('\n========== FORGOT PASSWORD PAGE TESTS COMPLETE ==========');
  await browser.close();
}

testForgotPasswordPage().catch(console.error);
