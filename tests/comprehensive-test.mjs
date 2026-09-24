import { chromium } from 'playwright';

async function testAllIssues() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    await page.goto('https://localhost:3003/login', { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForTimeout(8000);

    const usernameInput = page.locator('input[name="username"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitBtn = page.locator('button.auth-btn-submit');
    const resetBtn = page.locator('button.auth-btn-reset');

    console.log('========== 1. SUBMIT BUTTON DISABLED LOGIC ==========');
    const checkDisabled = async (label) => {
      const disabled = await submitBtn.evaluate(el => el.disabled);
      const ariaDisabled = await submitBtn.getAttribute('aria-disabled');
      console.log(`${label}: disabled=${disabled}, aria-disabled=${ariaDisabled}`);
    };

    await checkDisabled('Initial (empty)');
    await usernameInput.fill('test@example.com');
    await page.waitForTimeout(100);
    await checkDisabled('After username only');
    await usernameInput.blur();
    await page.waitForTimeout(300);
    await checkDisabled('After username blur');
    await passwordInput.fill('password123');
    await page.waitForTimeout(100);
    await checkDisabled('After password filled (focused)');
    await passwordInput.blur();
    await page.waitForTimeout(300);
    await checkDisabled('After password blur');

    console.log('\n========== 2. SHOW/HIDE PASSWORD ==========');
    const showBtn = page.locator('.input-group-actions button').last();  // Last button should be show password
    if (await showBtn.count() > 0) {
      const beforeType = await passwordInput.getAttribute('type');
      console.log('Before:', beforeType);
      await showBtn.evaluate(el => el.click());
      await page.waitForTimeout(300);
      const after1 = await passwordInput.getAttribute('type');
      console.log('After click:', after1);
      await showBtn.evaluate(el => el.click());
      await page.waitForTimeout(300);
      const after2 = await passwordInput.getAttribute('type');
      console.log('After second click:', after2);
    }

    console.log('\n========== 3. VALIDATION ERROR DISPLAY ==========');
    await usernameInput.fill('');
    await passwordInput.fill('');
    await page.waitForTimeout(100);
    await passwordInput.press('Enter');
    await page.waitForTimeout(800);

    const errorSelectors = ['.auth-alert--error', '.field-messages', '[class*="error"]', '[class*="invalid"]', '.textField-root .field-messages'];
    for (const sel of errorSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        const text = await page.locator(sel).first().textContent();
        console.log(`Found "${sel}": ${count} elements - "${(text || '').trim().substring(0, 100)}"`);
      }
    }

    const fieldMessages = await page.locator('.field-messages, [class*="fieldMessage"]').evaluateAll(els =>
      els.map(el => ({ className: el.className, text: el.textContent?.trim().substring(0, 200), display: window.getComputedStyle(el).display, visibility: window.getComputedStyle(el).visibility }))
    );
    console.log('FieldMessages elements:', JSON.stringify(fieldMessages, null, 2));

    console.log('\n========== 4. LABEL-INPUT ASSOCIATION ==========');
    const labelInputCheck = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[name="username"], input[name="password"]');
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

    console.log('\n========== 5. CHECKBOX DETAILS ==========');
    const checkbox = page.locator('.checkbox-indicator-root').first();
    const checkboxDetails = await checkbox.evaluate(el => {
      const cs = window.getComputedStyle(el);
      const checkmark = el.querySelector('.check-draw');
      return { width: cs.width, height: cs.height, borderWidth: cs.borderWidth, borderColor: cs.borderColor, borderRadius: cs.borderRadius, backgroundColor: cs.backgroundColor, display: cs.display, alignItems: cs.alignItems, justifyContent: cs.justifyContent, className: el.className, hasCheckmark: !!checkmark, checkmarkAttrs: checkmark ? { strokeWidth: checkmark.getAttribute('stroke-width'), stroke: checkmark.getAttribute('stroke') } : null };
    });
    console.log('Checkbox details:', JSON.stringify(checkboxDetails, null, 2));

    await checkbox.click();
    await page.waitForTimeout(600);
    const checkedDetails = await checkbox.evaluate(el => {
      const checkmark = el.querySelector('.check-draw');
      return { className: el.className, hasCheckmark: !!checkmark, checkmarkAttrs: checkmark ? { strokeWidth: checkmark.getAttribute('stroke-width'), stroke: checkmark.getAttribute('stroke'), strokeDasharray: checkmark.getAttribute('stroke-dasharray'), strokeDashoffset: checkmark.getAttribute('stroke-dashoffset') } : null };
    });
    console.log('Checkbox checked:', JSON.stringify(checkedDetails, null, 2));

    console.log('\n========== 6. INPUT BORDER COLORS ==========');
    await usernameInput.fill('');
    await passwordInput.fill('');
    await page.waitForTimeout(100);

    const usernameRoot = await usernameInput.evaluateHandle(el => { let c = el.parentElement; while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; } return null; });
    const passwordRoot = await passwordInput.evaluateHandle(el => { let c = el.parentElement; while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; } return null; });

    const defaultStyles = await Promise.all([
      usernameRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, backgroundColor: window.getComputedStyle(el).backgroundColor, className: el.className })),
      passwordRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, backgroundColor: window.getComputedStyle(el).backgroundColor, className: el.className }))
    ]);
    console.log('Default (unfocused):');
    console.log('  Username:', defaultStyles[0]);
    console.log('  Password:', defaultStyles[1]);

    await usernameInput.focus();
    await page.waitForTimeout(100);
    const focusStyles = await usernameRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, boxShadow: window.getComputedStyle(el).boxShadow }));
    console.log('  Username focus:', focusStyles);

    await usernameInput.fill('ab');
    await usernameInput.blur();
    await page.waitForTimeout(500);
    const errorStyles = await usernameRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, boxShadow: window.getComputedStyle(el).boxShadow, className: el.className }));
    console.log('  Username error:', errorStyles);

    await usernameInput.fill('valid@example.com');
    await usernameInput.blur();
    await page.waitForTimeout(500);
    const successStyles = await usernameRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, boxShadow: window.getComputedStyle(el).boxShadow, className: el.className }));
    console.log('  Username success:', successStyles);

    await usernameRoot.dispose();
    await passwordRoot.dispose();

    console.log('\n========== 7. EMAIL AUTOCOMPLETE SUGGESTIONS ==========');
    await usernameInput.fill('test@');
    await page.waitForTimeout(300);
    const emailPopup = await page.locator('.email-suggestions-popup').count();
    console.log('Email suggestions popup count:', emailPopup);
    if (emailPopup > 0) {
      const popupStyle = await page.locator('.email-suggestions-popup').evaluate(el => ({ zIndex: window.getComputedStyle(el).zIndex, display: window.getComputedStyle(el).display }));
      console.log('Popup style:', popupStyle);
    }

    await usernameInput.fill('test@gmail');
    await page.waitForTimeout(300);
    const emailItems = await page.locator('.email-suggestion-item').count();
    console.log('Email suggestion items:', emailItems);

    await usernameInput.fill('');
    await page.waitForTimeout(100);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testAllIssues().catch(console.error);