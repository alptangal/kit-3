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

    // Get form context state
    const formState = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return { error: 'Form not found' };
      
      // Check all textField-root elements
      const textFields = document.querySelectorAll('.textField-root');
      const fields = [];
      textFields.forEach((tf, i) => {
        // Try to access internal state
        const inp = tf.querySelector('input');
        fields.push({
          index: i,
          inputName: inp?.name,
          inputValue: inp?.value,
          className: tf.className,
        });
      });
      
      return { fields };
    });
    
    console.log('Form fields:', JSON.stringify(formState, null, 2));

    const usernameInput = page.locator('input[name="username"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitBtn = page.locator('button.auth-btn-submit');

    // Check form loading state
    const formLoading = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return { error: 'Form not found' };
      const comp = form.__svelte__;
      if (comp) {
        return {
          loading: comp.ctx?.configs?.loading,
          _loading: comp.ctx?.configs?._loading,
          validationIsValid: comp.ctx?.configs?.validation?.isValid,
          childrens: comp.ctx?.configs?.childrens?.size,
        };
      }
      return { error: 'No svelte component' };
    });
    console.log('Form initial:', JSON.stringify(formLoading, null, 2));

    await usernameInput.fill('testuser');
    await page.waitForTimeout(300);
    
    const formLoading2 = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return { error: 'Form not found' };
      const comp = form.__svelte__;
      if (comp) {
        return {
          loading: comp.ctx?.configs?.loading,
          _loading: comp.ctx?.configs?._loading,
          validationIsValid: comp.ctx?.configs?.validation?.isValid,
          childrens: comp.ctx?.configs?.childrens?.size,
        };
      }
      return { error: 'No svelte component' };
    });
    console.log('After username:', JSON.stringify(formLoading2, null, 2));

    await passwordInput.fill('testpassword');
    await page.waitForTimeout(300);
    
    const formLoading3 = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return { error: 'Form not found' };
      const comp = form.__svelte__;
      if (comp) {
        return {
          loading: comp.ctx?.configs?.loading,
          _loading: comp.ctx?.configs?._loading,
          validationIsValid: comp.ctx?.configs?.validation?.isValid,
          childrens: comp.ctx?.configs?.childrens?.size,
        };
      }
      return { error: 'No svelte component' };
    });
    console.log('After password:', JSON.stringify(formLoading3, null, 2));

    // Check textField components
    const tfState = await page.evaluate(() => {
      const tfs = document.querySelectorAll('.textField-root');
      const fields = [];
      tfs.forEach((tf, i) => {
        const comp = tf.__svelte__;
        if (comp) {
          fields.push({
            index: i,
            name: comp.ctx?.configs?.name,
            loading: comp.ctx?.configs?.loading,
            validation: comp.ctx?.configs?.validation,
            status: comp.ctx?.configs?.status,
            value: comp.ctx?.configs?.value,
            children: comp.ctx?.configs?.children,
          });
        }
      });
      return { fields };
    });
    console.log('TextFields:', JSON.stringify(tfState, null, 2));

    // Check input components
    const inpState = await page.evaluate(() => {
      const inputs = document.querySelectorAll('.input-root');
      const fields = [];
      inputs.forEach((inp, i) => {
        const comp = inp.__svelte__;
        if (comp) {
          fields.push({
            index: i,
            type: comp.ctx?.configs?.type,
            value: comp.ctx?.configs?.input?.[comp.ctx?.configs?.type]?.value,
            validation: comp.ctx?.configs?.validation,
            loading: comp.ctx?.configs?.loading,
          });
        }
      });
      return { fields };
    });
    console.log('Inputs:', JSON.stringify(inpState, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugForm().catch(console.error);
