import { chromium } from 'playwright';

async function testForgotPasswordPage() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3003/forgot-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  console.log('========== FORGOT PASSWORD PAGE TESTS ==========');

  // Test 1: Submit button disabled logic
  const submitBtn = page.locator('button.auth-btn-submit');
  const checkDisabled = async (label) => {
    const disabled = await submitBtn.evaluate(el => el.disabled);
    const ariaDisabled = await submitBtn.getAttribute('aria-disabled');
    console.log(`${label}: disabled=${disabled}, aria-disabled=${ariaDisabled}`);
  };

  await checkDisabled('Initial (empty)');

  await page.locator('input[name="email"]').fill('test@example.com');
  await page.waitForTimeout(100);
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(300);
  await checkDisabled('After email (blurred)');

  // Wait longer for the check to complete
  await page.waitForTimeout(2000);
  await checkDisabled('After email (waited 2s)');

  // Test 2: Email autocomplete suggestions
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

  // Test 3: Input border colors and action buttons
  const checkInputButtons = async () => {
    return await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[name="email"]');
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

  console.log('\n========== FORGOT PASSWORD PAGE TESTS COMPLETE ==========');
  await browser.close();
}

testForgotPasswordPage().catch(console.error);