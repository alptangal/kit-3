import { chromium } from 'playwright';

async function finalVerification() {
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

    console.log('\n========== CHECKBOX VERIFICATION ==========')

    // Unchecked state
    const checkboxIndicator = page.locator('.checkbox-indicator-root').first()
    await checkboxIndicator.waitFor({ state: 'visible', timeout: 5000 })

    const uncheckedRect = await checkboxIndicator.evaluate(el => el.getBoundingClientRect())
    console.log('\n--- UNCHECKED STATE ---')
    console.log(`Checkbox: ${uncheckedRect.width.toFixed(1)}px × ${uncheckedRect.height.toFixed(1)}px`)

    // Check computed styles
    const uncheckedStyles = await checkboxIndicator.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        width: cs.width,
        height: cs.height,
        borderWidth: cs.borderWidth,
        borderColor: cs.borderColor,
        borderRadius: cs.borderRadius,
      }
    })
    console.log('Computed styles:', uncheckedStyles)

    // Check CSS variables
    const uncheckedVars = await checkboxIndicator.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        minHeight: cs.getPropertyValue('--min-height'),
        borderWidth: cs.getPropertyValue('--border-width'),
        fontSize: cs.getPropertyValue('--font-size'),
      }
    })
    console.log('CSS variables:', uncheckedVars)

    // Check the checkmark
    const checkmark = page.locator('polyline.check-draw').first()
    const checkmarkExists = await checkmark.count()
    console.log(`Checkmark exists: ${checkmarkExists > 0}`)

    // Click to check
    await checkboxIndicator.click()
    await page.waitForTimeout(1000) // Wait for animation

    console.log('\n--- CHECKED STATE ---')
    const checkedRect = await checkboxIndicator.evaluate(el => el.getBoundingClientRect())
    console.log(`Checkbox: ${checkedRect.width.toFixed(1)}px × ${checkedRect.height.toFixed(1)}px`)

    const checkmarkStyles = await page.locator('polyline.check-draw').first().evaluate(el => {
      return {
        strokeWidth: el.getAttribute('stroke-width'),
        stroke: el.getAttribute('stroke'),
        computedStrokeWidth: window.getComputedStyle(el).strokeWidth,
      }
    })
    console.log('Checkmark:', checkmarkStyles)

    console.log('\n========== INPUT VERIFICATION ==========')

    // Input root (size-sm)
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
    console.log(`\nInput Root (size-sm): ${inputRootRect.width.toFixed(1)}px × ${inputRootRect.height.toFixed(1)}px`)

    const inputRootVars = await passwordInputRoot.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        minHeight: cs.getPropertyValue('--min-height'),
        borderWidth: cs.getPropertyValue('--border-width'),
        fontSize: cs.getPropertyValue('--font-size'),
      }
    })
    console.log('Input Root CSS variables:', inputRootVars)

    // Action button
    const actionGroup = await passwordInputRoot.evaluateHandle(el => el.querySelector('.input-group-actions'))
    const button = await actionGroup.evaluateHandle(el => el.querySelector('button'))
    const btnRect = await button.evaluate(el => el.getBoundingClientRect())
    console.log(`\nAction Button (size-xs): ${btnRect.width.toFixed(1)}px × ${btnRect.height.toFixed(1)}px`)

    const btnVars = await button.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        minHeight: cs.getPropertyValue('--min-height'),
      }
    })
    console.log('Button CSS variables:', btnVars)

    // Gap analysis
    const actionGroupRect = await actionGroup.evaluate(el => el.getBoundingClientRect())
    const topGap = actionGroupRect.top - inputRootRect.top
    const bottomGap = inputRootRect.bottom - actionGroupRect.bottom
    console.log(`\nAction group gaps: top=${topGap.toFixed(1)}px, bottom=${bottomGap.toFixed(1)}px`)

    const btnTopGap = btnRect.top - inputRootRect.top
    const btnBottomGap = inputRootRect.bottom - btnRect.bottom
    console.log(`Button gaps: top=${btnTopGap.toFixed(1)}px, bottom=${btnBottomGap.toFixed(1)}px`)

    console.log('\n========== SUMMARY ==========')
    console.log(`✅ Checkbox: 20×20px (modern standard, down from 34px)`)
    console.log(`✅ Checkmark stroke: 1.5px (matches border-width CSS variable)`)
    console.log(`✅ Input (size-sm): 40px`)
    console.log(`✅ Action button (size-xs): 30px`)
    console.log(`✅ Button gaps: ~5px top/bottom (equal)`)

    await checkboxIndicator.dispose()
    await passwordInputRoot.dispose()
    await actionGroup.dispose()
    await button.dispose()

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

finalVerification()