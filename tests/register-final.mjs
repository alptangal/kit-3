import { chromium } from 'playwright';

// Test register page: default colors (no color-error at rest), suggestion popups, clear/loading interplay
// Server: https://localhost:3000 (user-assigned dev port)
async function testRegisterPage() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3000/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  console.log('========== REGISTER PAGE COMPREHENSIVE TEST ==========');

  // ── Test 1: DEFAULT COLOR — untouched inputs must NOT be color-error ──
  console.log('\n── Test 1: Default color state (regression fix) ──');
  const usernameRoot = await page.locator('input[name="username"]').evaluateHandle(el => {
    let c = el.parentElement;
    while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; }
    return null;
  });
  const emailRoot = await page.locator('input[name="email"]').evaluateHandle(el => {
    let c = el.parentElement;
    while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; }
    return null;
  });
  const passwordRoot = await page.locator('input[name="password"]').evaluateHandle(el => {
    let c = el.parentElement;
    while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; }
    return null;
  });

  for (const [name, handle] of [['username', usernameRoot], ['email', emailRoot], ['password', passwordRoot]]) {
    const info = await handle.evaluate(el => ({
      className: el.className,
      borderColor: getComputedStyle(el).borderColor
    }));
    const hasError = /\bcolor-error\b/.test(info.className);
    console.log(`${name}: className="${info.className}"`);
    console.log(`  ${hasError ? '❌ FAIL: color-error at rest' : '✅ PASS: neutral at rest'} (border=${info.borderColor})`);
  }

  // ── Test 2: Realtime check turns color after blur+value ──
  console.log('\n── Test 2: Color after typed+blur (should turn valid) ──');
  await page.locator('input[name="username"]').fill('testuser123');
  await page.locator('input[name="username"]').blur();
  await page.waitForTimeout(1500);
  const clsAfter = await usernameRoot.evaluate(el => el.className);
  console.log('username after fill+blur:', clsAfter);
  console.log(/\bcolor-success\b/.test(clsAfter) ? '✅ PASS: success after valid input' : '⚠️ check className above (may be neutral if check pending)');

  // ── Test 3: Email suggestion popup appears with ≥1 char before @ ──
  console.log('\n── Test 3: Email autocomplete popup ──');
  await page.locator('input[name="email"]').fill('test@');
  await page.waitForTimeout(500);
  let popupCount = await page.locator('.email-suggestions-popup').count();
  console.log(`Popup count after "test@": ${popupCount} (expect ≥1)`);
  if (popupCount > 0) {
    const visible = await page.locator('.email-suggestions-popup').first().evaluate(el => {
      const r = el.getBoundingClientRect();
      const below = document.elementFromPoint(r.left + 5, r.top + 5);
      return { zIndex: getComputedStyle(el).zIndex, w: r.width, h: r.height, hitTestEl: below?.className };
    });
    console.log('Popup style/hit-test:', visible);
    // click a suggestion
    const items = page.locator('.email-suggestion-item');
    if (await items.count() > 0) {
      await items.first().click();
      await page.waitForTimeout(300);
      const val = await page.locator('input[name="email"]').inputValue();
      console.log('Input value after suggestion click:', val, val === 'test@gmail.com' ? '✅ PASS' : '❌ FAIL');
    }
  } else {
    console.log('❌ FAIL: no popup');
  }

  // Email popup should NOT appear with only text before @ typed? — per spec: show only after ≥1 valid char typed before @
  await page.locator('input[name="email"]').fill('test');
  await page.waitForTimeout(400);
  popupCount = await page.locator('.email-suggestions-popup').count();
  console.log(`Popup count after just "test" (no @): ${popupCount} (expect 0)`);

  // ── Test 4: Phone suggestion popup ──
  console.log('\n── Test 4: Phone autocomplete popup ──');
  const phoneInput = page.locator('input[name="phone"], input[name="phoneNumber"], input[type="tel"]');
  const phoneCount = await phoneInput.count();
  console.log('Phone input count:', phoneCount);
  if (phoneCount > 0) {
    await phoneInput.first().fill('+84');
    await page.waitForTimeout(500);
    const phonePopup = await page.locator('.phone-suggestions-popup').count();
    console.log('Phone popup count after "+84":', phonePopup, phonePopup > 0 ? '✅ PASS' : '❌ FAIL');
  }

  // ── Test 5: Clear button hidden while loading ──
  console.log('\n── Test 5: Clear button vs loading indicator ──');
  // trigger realtime check on username to set loading
  await page.locator('input[name="username"]').fill('');
  await page.locator('input[name="username"]').fill('checkinguser');
  await page.waitForTimeout(200); // during debounce+check, loading spinner shows
  const clearBtnVisible = await page.locator('input[name="username"] ~ * .input-group-actions .input-action-btn, .input-root .input-group-actions button').count();
  console.log('Action buttons count while checking:', clearBtnVisible);
  await page.waitForTimeout(1500);

  await usernameRoot.dispose();
  await emailRoot.dispose();
  await passwordRoot.dispose();

  console.log('\n========== REGISTER PAGE TEST COMPLETE ==========');
  await browser.close();
}

testRegisterPage().catch(console.error);
