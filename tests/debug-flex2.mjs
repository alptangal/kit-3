import { chromium } from 'playwright';

async function debugFlex() {
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
    console.log('Navigating to https://localhost:3000/register...');
    await page.goto('https://localhost:3000/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    await page.waitForSelector('input[name="lastname"]', { timeout: 10000 });

    // Get password input root
    const passwordInput = page.locator('input[name="password"]')
    const passwordInputRoot = await passwordInput.evaluateHandle((el) => {
      let current = el.parentElement
      while (current) {
        if (current.classList.contains('input-root')) return current
        current = current.parentElement
      }
      return null
    })

    // Get the input-group-actions container
    const actionGroup = await passwordInputRoot.evaluateHandle(el => el.querySelector('.input-group-actions'))

    // Check ALL computed styles for action group
    const actionsStyles = await actionGroup.evaluate(el => {
      const cs = window.getComputedStyle(el)
      const styles = {}
      for (let i = 0; i < cs.length; i++) {
        const prop = cs[i]
        styles[prop] = cs.getPropertyValue(prop)
      }
      return styles
    })
    console.log('Action Group ALL Styles:', JSON.stringify(actionsStyles, null, 2))

    // Check button computed styles in detail
    const buttons = await actionGroup.evaluateHandle(el => Array.from(el.querySelectorAll('button')))
    const btn = await buttons.evaluateHandle(arr => arr[0])
    const btnStyles = await btn.evaluate(el => {
      const cs = window.getComputedStyle(el)
      const styles = {}
      for (let i = 0; i < cs.length; i++) {
        const prop = cs[i]
        styles[prop] = cs.getPropertyValue(prop)
      }
      return styles
    })
    console.log('Button ALL Styles:', JSON.stringify(btnStyles, null, 2))

    await buttons.dispose()
    await btn.dispose()

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

debugFlex()
