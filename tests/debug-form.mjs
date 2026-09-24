import { chromium } from 'playwright';

async function debugForm() {
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
    console.log('🚀 Navigating to https://localhost:3000/login...');
    await page.goto('https://localhost:3000/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });

    // Get form context validation state
    const formState = await page.evaluate(() => {
      // Find the form element
      const form = document.querySelector('form');
      if (!form) return { error: 'Form not found' };
      
      // Try to access Svelte component instance
      // The form component should be on the form element
      const formComponent = form.__svelte__;
      if (formComponent) {
        return {
          childrens: formComponent.ctx?.configs?.childrens?.size,
          loading: formComponent.ctx?.configs?.loading,
          validationIsValid: formComponent.ctx?.configs?.validation?.isValid,
        };
      }
      
      // Check all textField-root elements
      const textFields = document.querySelectorAll('.textField-root');
      const fields = [];
      textFields.forEach((tf, i) => {
        const comp = tf.__svelte__;
        if (comp) {
          fields.push({
            index: i,
            name: comp.ctx?.configs?.name,
            loading: comp.ctx?.configs?.loading,
            validation: comp.ctx?.configs?.validation,
            status: comp.ctx?.configs?.status,
            value: comp.ctx?.configs?.value,
          });
        }
      });
      
      return { fields };
    });
    
    console.log('Initial form state:', JSON.stringify(formState, null, 2));

    const usernameInput = page.locator('input[name="username"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitBtn = page.locator('button.auth-btn-submit');

    await usernameInput.fill('testuser');
    await page.waitForTimeout(300);
    
    const formState2 = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return { error: 'Form not found' };
      const formComponent = form.__svelte__;
      if (formComponent) {
        return {
          childrens: formComponent.ctx?.configs?.childrens?.size,
          loading: formComponent.ctx?.configs?.loading,
          validationIsValid: formComponent.ctx?.configs?.validation?.isValid,
        };
      }
      return { error: 'No svelte component' };
    });
    console.log('After username fill:', JSON.stringify(formState2, null, 2));

    const disabled1 = await submitBtn.evaluate(el => el.disabled);
    console.log('Submit disabled after username:', disabled1);

    await passwordInput.fill('testpassword');
    await page.waitForTimeout(300);
    
    const formState3 = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return { error: 'Form not found' };
      const formComponent = form.__svelte__;
      if (formComponent) {
        return {
          childrens: formComponent.ctx?.configs?.childrens?.size,
          loading: formComponent.ctx?.configs?.loading,
          validationIsValid: formComponent.ctx?.configs?.validation?.isValid,
          _loading: formComponent.ctx?.configs?._loading,
        };
      }
      return { error: 'No svelte component' };
    });
    console.log('After password fill:', JSON.stringify(formState3, null, 2));

    const disabled2 = await submitBtn.evaluate(el => el.disabled);
    console.log('Submit disabled after both:', disabled2);

    // Check button's formContext
    const btnState = await page.evaluate(() => {
      const btn = document.querySelector('button.auth-btn-submit');
      if (!btn) return { error: 'Button not found' };
      const comp = btn.__svelte__;
      if (comp) {
        return {
          loadingDerived: comp.ctx?.loadingDerived,
          disabledDerived: comp.ctx?.disabledDerived,
          formContext: comp.ctx?.formContext ? {
            loading: comp.ctx.formContext.loading,
            validationIsValid: comp.ctx.formContext.validation?.isValid,
            childrens: comp.ctx.formContext.childrens?.size,
          } : null,
        };
      }
      return { error: 'No svelte component on button' };
    });
    console.log('Button state:', JSON.stringify(btnState, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugForm().catch(console.error);
