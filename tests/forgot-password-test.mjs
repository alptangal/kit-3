import { chromium } from 'playwright';

// Test forgot-password page: submit disabled logic + realtime email check
// Server: https://localhost:3000 (user-assigned dev port)
async function testForgotPassword() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3000/forgot-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  console.log('========== FORGOT PASSWORD PAGE TEST ==========');
  const submitBtn = page.locator('button.auth-btn-submit');

  const checkState = async (label) => {
    const disabled = await submitBtn.evaluate(el => el.disabled);
    const color = await submitBtn.evaluate(el => getComputedStyle(el).color);
    console.log(`${label}: disabled=${disabled}`);
    return disabled;
  };

  // Test 1: Initial state — empty email → disabled
  await checkState('Initial (empty)');

  // Test 2: Invalid email format → disabled (realtime check skips invalid)
  await page.locator('input[name="email"]').fill('invalid-email');
  await page.waitForTimeout(700);
  await checkState('Invalid format');

  // Test 3: Valid format, unregistered email → check runs → taken=false → disabled
  await page.locator('input[name="email"]').fill('unregistered_test_xyz@example.com');
  await page.waitForTimeout(2000); // wait debounce 400ms + API round-trip
  await checkState('Unregistered email');
  const mismatchVisible = await page.locator('.error-hint').count();
  console.log('error-hint visible (unregistered):', mismatchVisible);
  if (mismatchVisible > 0) {
    console.log('error-hint text:', await page.locator('.error-hint').first().textContent());
  }

  // Test 4: Real API + seeded registered email → taken=true → enabled.
  // Không dùng page.route mock: fetchSecure luôn gửi envelope mã hoá và
  // giải mã response — mock plain-JSON sẽ fail với "Encryption.decryptedText failed".
  // Email admin seed trong .env (username_owner='admin') là email đã đăng ký thật.
  await page.locator('input[name="email"]').fill('phuongdomega@atomicmail.io');
  await page.waitForTimeout(3000); // debounce 400ms + API round-trip mã hoá
  const disabledAfterTaken = await checkState('Registered (real taken=true)');
  const successHint = await page.locator('.success-hint').count();
  console.log('success-hint visible:', successHint);
  if (successHint > 0) {
    console.log('success-hint text:', await page.locator('.success-hint').first().textContent());
  }
  if (!disabledAfterTaken) {
    console.log('✅ PASS: submit enabled when email is registered (taken=true)');
  } else {
    console.log('❌ FAIL: submit still disabled with taken=true');
  }

  // Test 5: Input border colors default vs error vs success
  const emailRoot = await page.locator('input[name="email"]').evaluateHandle(el => {
    let c = el.parentElement;
    while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; }
    return null;
  });
  console.log('\n========== INPUT COLOR STATES ==========');
  // default (fresh state after route change)
  const cls = await emailRoot.evaluate(el => el.className);
  console.log('Input root class (taken=true state):', cls);
  await emailRoot.dispose();

  console.log('\n========== FORGOT PASSWORD TEST COMPLETE ==========');
  await browser.close();
}

testForgotPassword().catch(console.error);
