import { chromium } from 'playwright';

async function testRegisterPage() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3003/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  console.log('========== REGISTER PAGE TESTS ==========');

  // Test 1: Submit button disabled logic
  const submitBtn = page.locator('button.auth-btn-submit');
  const checkDisabled = async (label) => {
    const disabled = await submitBtn.evaluate(el => el.disabled);
    const ariaDisabled = await submitBtn.getAttribute('aria-disabled');
    console.log(`${label}: disabled=${disabled}, aria-disabled=${ariaDisabled}`);
  };

  await checkDisabled('Initial (empty)');

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

  await page.locator('input[name="username"]').fill('testuser');
  await page.waitForTimeout(100);
  await page.locator('input[name="username"]').blur();
  await page.waitForTimeout(2000); // wait for debounce and check
  await checkDisabled('After username (waited 2s)');

  await page.locator('input[name="email"]').fill('test@example.com');
  await page.waitForTimeout(100);
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(2000); // wait for debounce and check
  await checkDisabled('After email (waited 2s)');

  await page.locator('input[name="password"]').fill('password123');
  await page.waitForTimeout(100);
  await page.locator('input[name="password"]').blur();
  await page.waitForTimeout(300);
  await checkDisabled('After password');

  await page.locator('input[name="confirmPassword"]').fill('password123');
  await page.waitForTimeout(100);
  await page.locator('input[name="confirmPassword"]').blur();
  await page.waitForTimeout(300);
  await checkDisabled('After confirmPassword');

  const checkbox = page.locator('.checkbox-indicator-root').first();
  await checkbox.click();
  await page.waitForTimeout(600);
  await checkDisabled('After checkbox');

  // Test 2: Show/hide password
  const showBtns = page.locator('.input-group-actions button');
  console.log('Show password buttons count:', await showBtns.count());

  // Test 3: Email autocomplete suggestions
  await page.locator('input[name="email"]').fill('test@');
  await page.waitForTimeout(300);
  const emailPopup = await page.locator('.email-suggestions-popup').count();
  console.log('Email suggestions popup count:', emailPopup);
  if (emailPopup > 0) {
    const popupStyle = await page.locator('.email-suggestions-popup').evaluate(el => ({ zIndex: window.getComputedStyle(el).zIndex, display: window.getComputedStyle(el).display }));
    console.log('Popup style:', popupStyle);
  }

  await page.locator('input[name="email"]').fill('test@gmail');
  await page.waitForTimeout(300);
  const emailItems = await page.locator('.email-suggestion-item').count();
  console.log('Email suggestion items:', emailItems);

  // Test 4: Phone autocomplete suggestions
  await page.locator('input[name="phone"]').fill('84');
  await page.waitForTimeout(300);
  const phonePopup = await page.locator('.phone-suggestions-popup').count();
  console.log('Phone suggestions popup count:', phonePopup);
  if (phonePopup > 0) {
    const popupStyle = await page.locator('.phone-suggestions-popup').evaluate(el => ({ zIndex: window.getComputedStyle(el).zIndex, display: window.getComputedStyle(el).display }));
    console.log('Phone popup style:', popupStyle);
  }

  const phoneItems = await page.locator('.phone-suggestion-item').count();
  console.log('Phone suggestion items:', phoneItems);

  // Test 5: Input border colors and action buttons positioning
  const checkInputButtons = async () => {
    return await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[name="email"], input[name="password"], input[name="confirmPassword"]');
      const results = [];
      inputs.forEach(input => {
        const root = input.closest('.input-root');
        if (root) {
          const actions = root.querySelector('.input-group-actions');
          const actionButtons = actions?.querySelectorAll('button');
          results.push({
            name: input.name,
            rootClass: root.className,
            rootHeight: window.getComputedStyle(root).height,
            rootPadding: window.getComputedStyle(root).padding,
            actionsCount: actionButtons?.length ?? 0,
            actionsStyles: actions ? {
              height: window.getComputedStyle(actions).height,
              padding: window.getComputedStyle(actions).padding,
              alignItems: window.getComputedStyle(actions).alignItems,
              justifyContent: window.getComputedStyle(actions).justifyContent,
              gap: window.getComputedStyle(actions).gap
            } : null,
            buttonStyles: actionButtons ? Array.from(actionButtons).map(btn => ({
              className: btn.className,
              height: window.getComputedStyle(btn).height,
              width: window.getComputedStyle(btn).width,
              margin: window.getComputedStyle(btn).margin,
              padding: window.getComputedStyle(btn).padding
            })) : []
          });
        }
      });
      return results;
    });
  };
  console.log('Input buttons check:', JSON.stringify(await checkInputButtons(), null, 2));

  console.log('\n========== REGISTER PAGE TESTS COMPLETE ==========');
  await browser.close();
}

testRegisterPage().catch(console.error);