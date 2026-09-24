import { chromium } from 'playwright';

async function testApi() {
  const browser = await chromium.launch({ headless: false, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('Console:', msg.text()));
  page.on('pageerror', err => console.log('Page error:', err.message));

  await page.goto('https://localhost:3003/register', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(5000);

  // Try to trigger the API check directly from the browser
  const result = await page.evaluate(async () => {
    // Try to access the fetchSecure function or make a direct fetch
    try {
      const serverPubRes = await fetch('https://localhost:3003/api/encryption/public-key');
      const serverPub = await serverPubRes.json();
      console.log('Server public key:', serverPub);
      
      // Try to call the check API with a simple unencrypted request
      const checkRes = await fetch('https://localhost:3003/api/register/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', email: 'test@example.com' })
      });
      const checkData = await checkRes.json();
      console.log('Check API response:', checkData);
      
      return checkData;
    } catch (e) {
      console.log('Error:', e);
      return { error: e.message };
    }
  });
  
  console.log('API Result:', result);
  await browser.close();
}

testApi().catch(console.error);
