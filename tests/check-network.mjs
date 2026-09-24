import { chromium } from 'playwright';

async function testNetwork() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));
  
  // Monitor network requests
  page.on('request', request => {
    if (request.url().includes('/api/register/check')) {
      console.log('>> REQUEST:', request.url(), request.method(), request.postData());
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('/api/register/check')) {
      console.log('<< RESPONSE:', response.url(), response.status());
      response.json().then(data => console.log('Response data:', data)).catch(() => {});
    }
  });

  await page.goto('https://localhost:3003/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  console.log('========== Filling username ==========');
  await page.locator('input[name="username"]').fill('testuser123');
  await page.waitForTimeout(100);
  await page.locator('input[name="username"]').blur();
  await page.waitForTimeout(5000); // wait for debounce and check

  console.log('========== Filling email ==========');
  await page.locator('input[name="email"]').fill('test123@example.com');
  await page.waitForTimeout(100);
  await page.locator('input[name="email"]').blur();
  await page.waitForTimeout(5000);

  await browser.close();
}

testNetwork().catch(console.error);
