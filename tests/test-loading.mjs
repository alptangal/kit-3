import { chromium } from 'playwright';

async function testLoadingIndicator() {
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
    console.log('🚀 Navigating to https://localhost:3001/register...');
    await page.goto('https://localhost:3001/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    await page.waitForSelector('input[name="lastname"]', { timeout: 10000 });

    console.log('\n========== TEST LOADING INDICATOR (using phone field) ==========')

    // The phone field doesn't have real-time validation, let's test with email field
    // First scroll to email field
    await page.evaluate(() => {
      const el = document.querySelector('input[type="email"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await page.waitForTimeout(500);

    // Test loading indicator on email field (it has loading state from register page)
    const emailInput = page.locator('input[type="email"]');
    await emailInput.click();
    await emailInput.fill('test');
    await page.waitForTimeout(200);

    // Check for loading indicator
    const loadingIndicator = page.locator('.input-loading-indicator');
    const loadingVisible = await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false);
    console.log('Loading indicator visible immediately after typing:', loadingVisible);

    // Wait a bit more and check again
    await page.waitForTimeout(500);
    const loadingVisible2 = await loadingIndicator.isVisible({ timeout: 1000 }).catch(() => false);
    console.log('Loading indicator visible after 500ms:', loadingVisible2);

    // Wait for validation to complete
    await page.waitForTimeout(1000);

    // Check if clear button appears after validation
    const clearButton = page.locator('.input-clear');
    const clearVisible = await clearButton.isVisible({ timeout: 1000 }).catch(() => false);
    console.log('Clear button visible after validation:', clearVisible);

    console.log('\n========== SUMMARY ==========')
    console.log('Loading indicator test completed!')

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testLoadingIndicator().catch(console.error);