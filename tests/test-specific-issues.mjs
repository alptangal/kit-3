import { chromium } from 'playwright';

async function testSpecificIssues() {
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
    console.log('🚀 Navigating to https://localhost:3003/login...');
    await page.goto('https://localhost:3003/login', {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });

    await page.waitForTimeout(2000);

    await page.waitForSelector('input[name="username"]', { timeout: 30000 });
    await page.waitForSelector('input[name="password"]', { timeout: 30000 });

    const usernameInput = page.locator('input[name="username"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitBtn = page.locator('button.auth-btn-submit');
    const resetBtn = page.locator('button.auth-btn-reset');

    console.log('\n========== 1. SHOW/HIDE PASSWORD DEBUG ==========');

    const showBtn = page.locator('.input-group-actions button').first();
    if (await showBtn.count() > 0) {
      // Detailed inspection
      const btnInfo = await showBtn.evaluate(el => ({
        type: el.type,
        tagName: el.tagName,
        className: el.className,
        innerHTML: el.innerHTML,
        attributes: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' '),
      }));
      console.log('Button details:', JSON.stringify(btnInfo, null, 2));

      // Check Input component's actionButtons config
      const passwordRoot = await passwordInput.evaluateHandle(el => {
        let c = el.parentElement;
        while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; }
        return null;
      });

      const actionGroup = await passwordRoot.evaluateHandle(el => el.querySelector('.input-group-actions'));
      const buttons = await actionGroup.evaluateHandle(el => Array.from(el.querySelectorAll('button')));
      const btnCount = await buttons.evaluate(arr => arr.length);
      console.log('Action buttons count:', btnCount);

      // Just check the first button since we know count is 1
      const btn = await buttons.evaluateHandle(arr => arr[0]);
      const btnDetail = await btn.evaluate(el => ({
        type: el.type,
        className: el.className,
        innerHTML: el.innerHTML,
        onclick: el.onclick ? 'has onclick' : 'no onclick',
      }));
      console.log('Button 0:', btnDetail);
      await btn.dispose();

      // Test click with different methods
      console.log('\n--- Test click methods ---');
      const beforeType = await passwordInput.getAttribute('type');
      console.log('Before:', beforeType);

      // Method 1: evaluate click
      await showBtn.evaluate(el => el.click());
      await page.waitForTimeout(300);
      const after1 = await passwordInput.getAttribute('type');
      console.log('After evaluate click:', after1);

      // Method 2: dispatchEvent
      await showBtn.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await page.waitForTimeout(300);
      const after2 = await passwordInput.getAttribute('type');
      console.log('After dispatchEvent:', after2);

      // Method 3: Check if there's a click handler
      try {
        const hasClickHandler = await showBtn.evaluate(el => {
          return el.onclick ? 'yes (onclick)' : 'no onclick property';
        });
        console.log('Has click handler:', hasClickHandler);
      } catch (e) {
        console.log('Click handler check error:', e.message);
      }

      await buttons.dispose();
      await actionGroup.dispose();
      await passwordRoot.dispose();
    }

    console.log('\n========== 2. SUBMIT BUTTON DISABLED LOGIC ==========');

    // Check the status.disabled derivation
    const checkDisabled = async (label) => {
      const disabled = await submitBtn.evaluate(el => el.disabled);
      const ariaDisabled = await submitBtn.getAttribute('aria-disabled');
      const classes = await submitBtn.getAttribute('class');
      console.log(`${label}: disabled=${disabled}, aria-disabled=${ariaDisabled}`);
      console.log(`  Classes: ${classes}`);
    };

    await checkDisabled('Initial (empty)');

    await usernameInput.fill('test');
    await page.waitForTimeout(100);
    await checkDisabled('After username only');

    await passwordInput.fill('test');
    await page.waitForTimeout(100);
    await checkDisabled('After both filled');

    await passwordInput.fill('password123');
    await page.waitForTimeout(100);
    await checkDisabled('After valid password');

    // Check the derived status in component
    const statusCheck = await page.evaluate(() => {
      // Try to access the component's reactive state
      return { note: 'Cannot access Svelte state directly from browser' };
    });
    console.log('Status check:', statusCheck);

    console.log('\n========== 3. VALIDATION ERROR DISPLAY ==========');

    // Clear and trigger validation
    await usernameInput.fill('');
    await passwordInput.fill('');
    await page.waitForTimeout(100);

    // Press Enter to submit
    await passwordInput.press('Enter');
    await page.waitForTimeout(800);

    // Check all possible error locations
    const errorSelectors = [
      '.auth-alert--error',
      '.field-messages',
      '[class*="error"]',
      '[class*="invalid"]',
      '.textField-root .field-messages',
    ];

    for (const sel of errorSelectors) {
      const count = await page.locator(sel).count();
      if (count > 0) {
        const text = await page.locator(sel).first().textContent();
        console.log(`Found "${sel}": ${count} elements - "${text?.trim().substring(0, 100)}"`);
      }
    }

    // Check FieldMessages component
    const fieldMessages = await page.locator('.field-messages, [class*="fieldMessage"]').evaluateAll(els =>
      els.map(el => ({
        className: el.className,
        text: el.textContent?.trim().substring(0, 200),
        display: window.getComputedStyle(el).display,
        visibility: window.getComputedStyle(el).visibility,
      }))
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

        results.push({
          name,
          id,
          hasId: !!id,
          labelsWithFor: labels.length,
          wrappingLabel: !!wrappingLabel,
          ariaLabel,
          ariaLabelledBy,
        });
      });
      return results;
    });
    console.log('Label-Input association:', JSON.stringify(labelInputCheck, null, 2));

    console.log('\n========== 5. DESKTOP CARD WIDTH ==========');

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);

    const layoutInfo = await page.evaluate(() => {
      const panelRight = document.querySelector('.auth-panel-right');
      const card = document.querySelector('.auth-card');
      const form = document.querySelector('form');

      return {
        panelRight: panelRight ? {
          display: window.getComputedStyle(panelRight).display,
          flexDirection: window.getComputedStyle(panelRight).flexDirection,
          justifyContent: window.getComputedStyle(panelRight).justifyContent,
          alignItems: window.getComputedStyle(panelRight).alignItems,
          width: window.getComputedStyle(panelRight).width,
          maxWidth: window.getComputedStyle(panelRight).maxWidth,
        } : null,
        card: card ? {
          display: window.getComputedStyle(card).display,
          width: window.getComputedStyle(card).width,
          maxWidth: window.getComputedStyle(card).maxWidth,
          marginLeft: window.getComputedStyle(card).marginLeft,
          marginRight: window.getComputedStyle(card).marginRight,
        } : null,
        form: form ? {
          display: window.getComputedStyle(form).display,
          width: window.getComputedStyle(form).width,
        } : null,
      };
    });
    console.log('Layout info:', JSON.stringify(layoutInfo, null, 2));

    console.log('\n========== 6. INPUT BORDER COLORS ==========');

    // Check default (unfocused) state
    await usernameInput.fill('');
    await passwordInput.fill('');
    await page.waitForTimeout(100);

    const usernameRoot = await usernameInput.evaluateHandle(el => {
      let c = el.parentElement;
      while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; }
      return null;
    });

    const passwordRoot = await passwordInput.evaluateHandle(el => {
      let c = el.parentElement;
      while (c) { if (c.classList.contains('input-root')) return c; c = c.parentElement; }
      return null;
    });

    const defaultStyles = await Promise.all([
      usernameRoot.evaluate(el => ({
        borderColor: window.getComputedStyle(el).borderColor,
        backgroundColor: window.getComputedStyle(el).backgroundColor,
        className: el.className,
      })),
      passwordRoot.evaluate(el => ({
        borderColor: window.getComputedStyle(el).borderColor,
        backgroundColor: window.getComputedStyle(el).backgroundColor,
        className: el.className,
      }))
    ]);

    console.log('Default (unfocused):');
    console.log('  Username:', defaultStyles[0]);
    console.log('  Password:', defaultStyles[1]);

    // Check focus state
    await usernameInput.focus();
    await page.waitForTimeout(100);
    const focusStyles = await usernameRoot.evaluate(el => ({
      borderColor: window.getComputedStyle(el).borderColor,
      boxShadow: window.getComputedStyle(el).boxShadow,
    }));
    console.log('  Username focus:', focusStyles);

    // Check error state - fill invalid and blur
    await usernameInput.fill('ab');
    await usernameInput.blur();
    await page.waitForTimeout(300);
    const errorStyles = await usernameRoot.evaluate(el => ({
      borderColor: window.getComputedStyle(el).borderColor,
      boxShadow: window.getComputedStyle(el).boxShadow,
      className: el.className,
    }));
    console.log('  Username error:', errorStyles);

    // Check success state
    await usernameInput.fill('valid@example.com');
    await usernameInput.blur();
    await page.waitForTimeout(300);
    const successStyles = await usernameRoot.evaluate(el => ({
      borderColor: window.getComputedStyle(el).borderColor,
      boxShadow: window.getComputedStyle(el).boxShadow,
      className: el.className,
    }));
    console.log('  Username success:', successStyles);

    await usernameRoot.dispose();
    await passwordRoot.dispose();

    console.log('\n========== 7. CHECKBOX DETAILS ==========');

    const checkbox = page.locator('.checkbox-indicator-root').first();
    const checkboxDetails = await checkbox.evaluate(el => {
      const cs = window.getComputedStyle(el);
      const checkmark = el.querySelector('.check-draw');
      return {
        width: cs.width,
        height: cs.height,
        borderWidth: cs.borderWidth,
        borderColor: cs.borderColor,
        borderRadius: cs.borderRadius,
        backgroundColor: cs.backgroundColor,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        className: el.className,
        hasCheckmark: !!checkmark,
        checkmarkAttrs: checkmark ? {
          strokeWidth: checkmark.getAttribute('stroke-width'),
          stroke: checkmark.getAttribute('stroke'),
        } : null,
      };
    });
    console.log('Checkbox details:', JSON.stringify(checkboxDetails, null, 2));

    // Test checkbox click and checkmark animation
    await checkbox.click();
    await page.waitForTimeout(600);

    const checkedDetails = await checkbox.evaluate(el => {
      const checkmark = el.querySelector('.check-draw');
      return {
        className: el.className,
        hasCheckmark: !!checkmark,
        checkmarkAttrs: checkmark ? {
          strokeWidth: checkmark.getAttribute('stroke-width'),
          stroke: checkmark.getAttribute('stroke'),
          strokeDasharray: checkmark.getAttribute('stroke-dasharray'),
          strokeDashoffset: checkmark.getAttribute('stroke-dashoffset'),
        } : null,
      };
    });
    console.log('Checkbox checked:', JSON.stringify(checkedDetails, null, 2));

    console.log('\n========== 8. BUTTON VARIANTS DETAIL ==========');

    const buttons = [
      { name: 'Submit', selector: 'button.auth-btn-submit' },
      { name: 'Reset', selector: 'button.auth-btn-reset' },
      { name: 'Forgot', selector: '.login-forgot-link' },
      { name: 'Register', selector: '.auth-switch-btn' },
    ];

    for (const btn of buttons) {
      const locator = page.locator(btn.selector);
      const count = await locator.count();
      if (count > 0) {
        const details = await locator.first().evaluate(el => {
          const cs = window.getComputedStyle(el);
          return {
            tagName: el.tagName,
            type: el.type,
            className: el.className,
            width: cs.width,
            height: cs.height,
            minHeight: cs.getPropertyValue('--min-height'),
            paddingInline: cs.paddingInline,
            paddingBlock: cs.paddingBlock,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            backgroundColor: cs.backgroundColor,
            color: cs.color,
            borderColor: cs.borderColor,
            borderWidth: cs.borderWidth,
            borderRadius: cs.borderRadius,
            display: cs.display,
            alignItems: cs.alignItems,
            justifyContent: cs.justifyContent,
            gap: cs.gap,
            cursor: cs.cursor,
          };
        });
        console.log(`\n${btn.name}:`);
        console.log(JSON.stringify(details, null, 2));
      }
    }

    console.log('\n========== 9. AUTH LAYOUT STRUCTURE ==========');

    const layoutStructure = await page.evaluate(() => {
      const authPage = document.querySelector('.auth-page');
      const panelLeft = document.querySelector('auth-panel-left') || document.querySelector('[class*="panel-left"]');
      const panelRight = document.querySelector('.auth-panel-right');

      return {
        authPage: authPage ? {
          display: window.getComputedStyle(authPage).display,
          minHeight: window.getComputedStyle(authPage).minHeight,
          flexDirection: window.getComputedStyle(authPage).flexDirection,
        } : null,
        panelLeft: panelLeft ? {
          display: window.getComputedStyle(panelLeft).display,
          flex: window.getComputedStyle(panelLeft).flex,
          width: window.getComputedStyle(panelLeft).width,
        } : null,
        panelRight: panelRight ? {
          display: window.getComputedStyle(panelRight).display,
          flex: window.getComputedStyle(panelRight).flex,
          width: window.getComputedStyle(panelRight).width,
        } : null,
      };
    });
    console.log('Auth layout structure:', JSON.stringify(layoutStructure, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testSpecificIssues().catch(console.error);