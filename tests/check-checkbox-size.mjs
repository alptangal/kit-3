import { chromium } from 'playwright';

async function checkCheckboxSize() {
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

    // Force reload to get latest CSS
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    await page.waitForSelector('input[name="lastname"]', { timeout: 10000 });

    // Find the checkbox indicator
    const checkboxIndicator = page.locator('.checkbox-indicator-root').first()
    await checkboxIndicator.waitFor({ state: 'visible', timeout: 5000 })

    // Get checkbox indicator rect
    const indicatorRect = await checkboxIndicator.evaluate(el => el.getBoundingClientRect())

    // Get checkbox root
    const checkboxRoot = await checkboxIndicator.evaluateHandle(el => {
      let current = el.parentElement
      while (current) {
        if (current.classList.contains('checkbox-root')) return current
        current = current.parentElement
      }
      return null
    })

    const rootRect = await checkboxRoot.evaluate(el => el.getBoundingClientRect())

    console.log('\n=== CHECKBOX SIZE ANALYSIS ===')
    console.log('Checkbox Root:', {
      top: rootRect.top,
      bottom: rootRect.bottom,
      height: rootRect.height,
      left: rootRect.left,
      right: rootRect.right,
      width: rootRect.width,
    })
    console.log('Checkbox Indicator:', {
      top: indicatorRect.top,
      bottom: indicatorRect.bottom,
      height: indicatorRect.height,
      left: indicatorRect.left,
      right: indicatorRect.right,
      width: indicatorRect.width,
    })

    // Check computed styles for the indicator
    const indicatorStyles = await checkboxIndicator.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        width: cs.width,
        height: cs.height,
        minWidth: cs.minWidth,
        minHeight: cs.minHeight,
        borderWidth: cs.borderWidth,
        borderStyle: cs.borderStyle,
        borderColor: cs.borderColor,
        borderRadius: cs.borderRadius,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
      }
    })
    console.log('\nIndicator Computed Styles:', indicatorStyles)

    // Check computed styles for the root
    const rootStyles = await checkboxRoot.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        display: cs.display,
        gap: cs.gap,
        alignItems: cs.alignItems,
      }
    })
    console.log('Root Computed Styles:', rootStyles)

    // Check CSS variables
    const cssVars = await checkboxIndicator.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        minHeight: cs.getPropertyValue('--min-height'),
        borderWidth: cs.getPropertyValue('--border-width'),
        borderRadius: cs.getPropertyValue('--border-radius'),
        fontSize: cs.getPropertyValue('--font-size'),
      }
    })
    console.log('\nCSS Variables on Indicator:', cssVars)

    // Check checkbox root CSS variables
    const rootCssVars = await checkboxRoot.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        minHeight: cs.getPropertyValue('--min-height'),
        borderWidth: cs.getPropertyValue('--border-width'),
        borderRadius: cs.getPropertyValue('--border-radius'),
        fontSize: cs.getPropertyValue('--font-size'),
      }
    })
    console.log('CSS Variables on Root:', rootCssVars)

    // Compare with input root for reference
    console.log('\n=== COMPARISON WITH INPUT ROOT (size-sm) ===')
    const passwordInput = page.locator('input[name="password"]')
    const passwordInputRoot = await passwordInput.evaluateHandle((el) => {
      let current = el.parentElement
      while (current) {
        if (current.classList.contains('input-root')) return current
        current = current.parentElement
      }
      return null
    })

    const inputRootRect = await passwordInputRoot.evaluate(el => el.getBoundingClientRect())
    console.log('Input Root:', {
      height: inputRootRect.height,
      width: inputRootRect.width,
    })

    const inputRootStyles = await passwordInputRoot.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        minHeight: cs.getPropertyValue('--min-height'),
        borderWidth: cs.getPropertyValue('--border-width'),
        borderRadius: cs.getPropertyValue('--border-radius'),
        fontSize: cs.getPropertyValue('--font-size'),
      }
    })
    console.log('Input Root CSS Variables:', inputRootStyles)

    await checkboxRoot.dispose()
    await passwordInputRoot.dispose()

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

checkCheckboxSize()