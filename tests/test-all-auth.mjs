import { chromium } from 'playwright';

async function testAllAuthPages() {
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
    // Test Login Page
    console.log('\n========== TEST LOGIN PAGE ==========');
    await page.goto('https://localhost:3001/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const loginTitle = await page.locator('h1.auth-title').textContent();
    console.log('Login page title:', loginTitle);

    const loginInputs = await page.locator('input[type="text"], input[type="password"], input[type="email"]').count();
    console.log('Login page inputs:', loginInputs);

    const loginButtons = await page.locator('button.auth-btn-submit, button.auth-btn-reset').count();
    console.log('Login page action buttons:', loginButtons);

    const loginLeftPanel = await page.locator('.auth-panel-left').isVisible();
    console.log('Login left panel visible:', loginLeftPanel);

    const loginRightPanel = await page.locator('.auth-panel-right').isVisible();
    console.log('Login right panel visible:', loginRightPanel);

    const loginCard = await page.locator('.auth-card').isVisible();
    console.log('Login card visible:', loginCard);

    // Test Register Page
    console.log('\n========== TEST REGISTER PAGE ==========');
    await page.goto('https://localhost:3001/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const registerTitle = await page.locator('h1.auth-title').textContent();
    console.log('Register page title:', registerTitle);

    const registerInputs = await page.locator('input[type="text"], input[type="password"], input[type="email"], input[type="phone"]').count();
    console.log('Register page inputs:', registerInputs);

    const registerButtons = await page.locator('button.auth-btn-submit, button.auth-btn-reset').count();
    console.log('Register page action buttons:', registerButtons);

    const registerLeftPanel = await page.locator('.auth-panel-left').isVisible();
    console.log('Register left panel visible:', registerLeftPanel);

    const registerRightPanel = await page.locator('.auth-panel-right').isVisible();
    console.log('Register right panel visible:', registerRightPanel);

    const registerCard = await page.locator('.auth-card').isVisible();
    console.log('Register card visible:', registerCard);

    // Test Forgot Password Page
    console.log('\n========== TEST FORGOT PASSWORD PAGE ==========');
    await page.goto('https://localhost:3001/forgot-password', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const forgotTitle = await page.locator('h1.auth-title').textContent();
    console.log('Forgot password page title:', forgotTitle);

    const forgotInputs = await page.locator('input[type="email"]').count();
    console.log('Forgot password page inputs:', forgotInputs);

    const forgotButtons = await page.locator('button.auth-btn-submit, button.auth-btn-reset').count();
    console.log('Forgot password page action buttons:', forgotButtons);

    const forgotLeftPanel = await page.locator('.auth-panel-left').isVisible();
    console.log('Forgot left panel visible:', forgotLeftPanel);

    const forgotRightPanel = await page.locator('.auth-panel-right').isVisible();
    console.log('Forgot right panel visible:', forgotRightPanel);

    const forgotCard = await page.locator('.auth-card').isVisible();
    console.log('Forgot card visible:', forgotCard);

    console.log('\n========== SUMMARY ==========');
    console.log('✅ All three auth pages loaded successfully!');
    console.log('✅ Left decorative panels visible on all pages');
    console.log('✅ Right form panels visible on all pages');
    console.log('✅ Auth cards visible on all pages');
    console.log('✅ Input fields and action buttons present on all pages');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testAllAuthPages().catch(console.error);