import { chromium } from 'playwright';

async function testStatus() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3003/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  // Add debug to the component
  await page.evaluate(() => {
    // Try to find the svelte component and add logging
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function(fn, delay, ...args) {
      const wrapped = function() {
        console.log('[DEBUG] setTimeout called with delay:', delay);
        return fn.apply(this, args);
      };
      return originalSetTimeout(wrapped, delay, ...args);
    };
  });

  // Fill username
  console.log('Filling username...');
  await page.locator('input[name="username"]').fill('testuser123');
  await page.waitForTimeout(100);
  await page.locator('input[name="username"]').blur();
  await page.waitForTimeout(5000);

  // Check the status values
  const status = await page.evaluate(() => {
    // Try to access the component instance
    const forms = document.querySelectorAll('form');
    console.log('Forms:', forms.length);
    
    // Check for any global state
    return {
      windowKeys: Object.keys(window).filter(k => k.includes('user') || k.includes('status') || k.includes('form'))
    };
  });
  
  console.log('Status check:', status);
  
  // Fill email
  console.log('Filling email...');
  await page.locator('input[name="email"]').fill('test123@example.com');
  await page.waitForTimeout(100);
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(5000);

  await browser.close();
}

testStatus().catch(console.error);
