import { chromium } from 'playwright';

async function testForgotPasswordPage() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3012/forgot-password', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  console.log('========== FORGOT PASSWORD PAGE COMPREHENSIVE TEST ==========');

  const submitBtn = page.locator('button.auth-btn-submit');
  const checkDisabled = async (label) => {
    const disabled = await submitBtn.evaluate(el => el.disabled);
    const ariaDisabled = await submitBtn.getAttribute('aria-disabled');
    console.log(`${label}: disabled=${disabled}, aria-disabled=${ariaDisabled}`);
  };

  await checkDisabled('Initial (empty)');

  // Use an email that should be "taken" (already registered)
  // First check what emails exist or use a known test email
  const testEmail = 'test@example.com';

  await page.locator('input[name="email"]').fill(testEmail);
  await page.waitForTimeout(100);
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(3000); // wait for debounce and check
  await checkDisabled('After email (blurred, waited 3s)');

  await page.waitForTimeout(2000);
  await checkDisabled('After email (waited 2s more)');

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

  // Test 3: Input border colors and action buttons positioning
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

  // Test 4: Validation error display
  console.log('\n========== VALIDATION ERROR DISPLAY ==========');
  await page.locator('input[name="email"]').fill('');
  await page.waitForTimeout(100);
  await page.locator('input[name="email"]').press('Enter');
  await page.waitForTimeout(800);

  const fieldMessages = await page.locator('.field-messages, [class*="fieldMessage"]').evaluateAll(els =>
    els.map(el => ({ className: el.className, text: el.textContent?.trim().substring(0, 200), display: window.getComputedStyle(el).display, visibility: window.getComputedStyle(el).visibility }))
  );
  console.log('FieldMessages elements:', JSON.stringify(fieldMessages, null, 2));

  // Test 5: Label-input association
  console.log('\n========== LABEL-INPUT ASSOCIATION ==========');
  const labelInputCheck = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[name="email"]');
    const results = [];
    inputs.forEach(input => {
      const id = input.id;
      const name = input.name;
      const labels = document.querySelectorAll(`label[for="${id}"]`);
      const wrappingLabel = input.closest('label');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      results.push({ name, id, hasId: !!id, labelsWithFor: labels.length, wrappingLabel: !!wrappingLabel, ariaLabel, ariaLabelledBy });
    });
    return results;
  });
  console.log('Label-Input association:', JSON.stringify(labelInputCheck, null, 2));

  // Test 6: Input border colors
  console.log('\n========== INPUT BORDER COLORS ==========');
  await page.locator('input[name="email"]').fill('');
  await page.waitForTimeout(100);

  const emailRoot = await page.locator('input[name="email"]').evaluateHandle(el => { let c = el.parentElement; while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; } return null; });

  const defaultStyles = await emailRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, backgroundColor: window.getComputedStyle(el).backgroundColor, className: el.className }));
  console.log('Default (unfocused):', defaultStyles);

  await page.locator('input[name="email"]').focus();
  await page.waitForTimeout(100);
  const focusStyles = await emailRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, boxShadow: window.getComputedStyle(el).boxShadow }));
  console.log('  Email focus:', focusStyles);

  await page.locator('input[name="email"]').fill('invalid');
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(500);
  const errorStyles = await emailRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, boxShadow: window.getComputedStyle(el).boxShadow, className: el.className }));
  console.log('  Email error:', errorStyles);

  await page.locator('input[name="email"]').fill('valid@example.com');
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(3000); // wait for check to complete
  const successStyles = await emailRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, boxShadow: window.getComputedStyle(el).boxShadow, className: el.className }));
  console.log('  Email success:', successStyles);

  await emailRoot.dispose();

  console.log('\n========== FORGOT PASSWORD PAGE TESTS COMPLETE ==========');
  await browser.close();
}

testForgotPasswordPage().catch(console.error);