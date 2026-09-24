import { chromium } from 'playwright';

async function testSpecificIssues() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  try {
    console.log('🚀 Navigating to https://localhost:3003/login...');
    await page.goto('https://localhost:3003/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(3000);

    const usernameInput = page.locator('input[name="username"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitBtn = page.locator('button.auth-btn-submit');
    const resetBtn = page.locator('button.auth-btn-reset');

    // Wait for elements to be ready
    await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
    await passwordInput.waitFor({ state: 'visible', timeout: 30000 });

    console.log('\n========== 1. SHOW/HIDE PASSWORD DEBUG ==========');
    const showBtn = page.locator('.input-group-actions button').first();
    if (await showBtn.count() > 0) {
      const btnInfo = await showBtn.evaluate(el => ({
        type: el.type,
        tagName: el.tagName,
        className: el.className,
        innerHTML: el.innerHTML,
        attributes: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`).join(' '),
      }));
      console.log('Button details:', JSON.stringify(btnInfo, null, 2));

      // Test click
      console.log('\n--- Test click methods ---');
      const beforeType = await passwordInput.getAttribute('type');
      console.log('Before:', beforeType);

      await showBtn.evaluate(el => el.click());
      await page.waitForTimeout(300);
      const after1 = await passwordInput.getAttribute('type');
      console.log('After evaluate click:', after1);

      await showBtn.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await page.waitForTimeout(300);
      const after2 = await passwordInput.getAttribute('type');
      console.log('After dispatchEvent:', after2);
    }

    console.log('\n========== 2. SUBMIT BUTTON DISABLED LOGIC ==========');
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

    console.log('\n========== 3. VALIDATION ERROR DISPLAY ==========');
    await usernameInput.fill('');
    await passwordInput.fill('');
    await page.waitForTimeout(100);
    await passwordInput.press('Enter');
    await page.waitForTimeout(800);

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
          name, id, hasId: !!id, labelsWithFor: labels.length, wrappingLabel: !!wrappingLabel, ariaLabel, ariaLabelledBy,
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
        panelRight: panelRight ? { display: window.getComputedStyle(panelRight).display, flexDirection: window.getComputedStyle(panelRight).flexDirection, justifyContent: window.getComputedStyle(panelRight).justifyContent, alignItems: window.getComputedStyle(panelRight).alignItems, width: window.getComputedStyle(panelRight).width, maxWidth: window.getComputedStyle(panelRight).maxWidth } : null,
        card: card ? { display: window.getComputedStyle(card).display, width: window.getComputedStyle(card).width, maxWidth: window.getComputedStyle(card).maxWidth, marginLeft: window.getComputedStyle(card).marginLeft, marginRight: window.getComputedStyle(card).marginRight } : null,
        form: form ? { display: window.getComputedStyle(form).display, width: window.getComputedStyle(form).width } : null,
      };
    });
    console.log('Layout info:', JSON.stringify(layoutInfo, null, 2));

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
    await page.waitForTimeout(300);
    const errorStyles = await usernameRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, boxShadow: window.getComputedStyle(el).boxShadow, className: el.className }));
    console.log('  Username error:', errorStyles);

    await usernameInput.fill('valid@example.com');
    await usernameInput.blur();
    await page.waitForTimeout(300);
    const successStyles = await usernameRoot.evaluate(el => ({ borderColor: window.getComputedStyle(el).borderColor, boxShadow: window.getComputedStyle(el).boxShadow, className: el.className }));
    console.log('  Username success:', successStyles);

    await usernameRoot.dispose();
    await passwordRoot.dispose();

    console.log('\n========== 7. CHECKBOX DETAILS ==========');
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
          return { tagName: el.tagName, type: el.type, className: el.className, width: cs.width, height: cs.height, minHeight: cs.getPropertyValue('--min-height'), paddingInline: cs.paddingInline, paddingBlock: cs.paddingBlock, fontSize: cs.fontSize, fontWeight: cs.fontWeight, backgroundColor: cs.backgroundColor, color: cs.color, borderColor: cs.borderColor, borderWidth: cs.borderWidth, borderRadius: cs.borderRadius, display: cs.display, alignItems: cs.alignItems, justifyContent: cs.justifyContent, gap: cs.gap, cursor: cs.cursor };
        });
        console.log(`\n${btn.name}:`);
        console.log(JSON.stringify(details, null, 2));
      }
    }

    console.log('\n========== 9. AUTH LAYOUT STRUCTURE ==========');
    const layoutStructure = await page.evaluate(() => {
      const authPage = document.querySelector('.auth-page');
      const panelLeft = document.querySelector('auth-panel-left') || document.querySelector('[class*="panel-left"]');
      const panelRight = document.queryquerSelector('.auth-panel-right');
      return { authPage: authPage ? { display: window.getComputedStyle(authPage).display, minHeight: window.getComputedStyle(authPage).minHeight, flexDirection: window.getComputedStyle(authPage).flexDirection } : null, panelLeft: panelLeft ? { display: window.getComputedStyle(panelLeft).display, flex: window.getComputedStyle(panelLeft).flex, width: window.getComputedStyle(panelLeft).width } : null, panelRight: panelRight ? { display: window.getComputedStyle(panelRight).display, flex: window.getComputedStyle(panelRight).flex, width: window.getComputedStyle(panelRight).width } : null };
    });
    console.log('Auth layout structure:', JSON.stringify(layoutStructure, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testSpecificIssues().catch(console.error);