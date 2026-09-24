import { chromium } from 'playwright';

async function checkCheckboxCheckmark() {
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

    // Click the checkbox to check it
    const checkboxIndicator = page.locator('.checkbox-indicator-root').first()
    await checkboxIndicator.waitFor({ state: 'visible', timeout: 5000 })
    await checkboxIndicator.click()
    await page.waitForTimeout(1000) // Wait for animation to complete

    // Get the checkmark SVG
    const checkmark = page.locator('.check-draw').first()
    await checkmark.waitFor({ state: 'visible', timeout: 5000 })

    // Get checkmark stroke width
    const checkmarkStyles = await checkmark.evaluate(el => {
      return {
        strokeWidth: el.getAttribute('stroke-width'),
        stroke: el.getAttribute('stroke'),
      }
    })
    console.log('\n=== CHECKMARK STYLES ===')
    console.log('Checkmark attributes:', checkmarkStyles)

    // Get checkbox indicator computed border width
    const indicatorStyles = await checkboxIndicator.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        borderWidth: cs.borderWidth,
        borderColor: cs.borderColor,
      }
    })
    console.log('Indicator border:', indicatorStyles)

    // Check CSS variable
    const cssVars = await checkboxIndicator.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        borderWidth: cs.getPropertyValue('--border-width'),
      }
    })
    console.log('CSS variable --border-width:', cssVars)

    // Also check the polyline element directly
    const polyline = await page.locator('polyline.check-draw').first()
    const polylineStyles = await polyline.evaluate(el => {
      return {
        strokeWidth: el.getAttribute('stroke-width'),
        stroke: el.getAttribute('stroke'),
        computedStrokeWidth: window.getComputedStyle(el).strokeWidth,
      }
    })
    console.log('\nPolyline attributes:', polylineStyles)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

checkCheckboxCheckmark()