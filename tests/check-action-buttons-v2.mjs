import { chromium } from 'playwright';

async function checkActionButtons() {
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

    if (!actionGroup) {
      console.log('No input-group-actions found')
      return
    }

    // Get positions
    const positions = await Promise.all([
      passwordInputRoot.evaluate(el => el.getBoundingClientRect()),
      actionGroup.evaluate(el => el.getBoundingClientRect()),
      passwordInput.evaluate(el => el.getBoundingClientRect()),
    ])

    const [rootRect, actionsRect, inputRect] = positions

    console.log('\n=== POSITION ANALYSIS ===')
    console.log('Input Root:', {
      top: rootRect.top,
      bottom: rootRect.bottom,
      height: rootRect.height,
    })
    console.log('Action Group:', {
      top: actionsRect.top,
      bottom: actionsRect.bottom,
      height: actionsRect.height,
    })

    // Calculate gaps
    const topGap = actionsRect.top - rootRect.top
    const bottomGap = rootRect.bottom - actionsRect.bottom
    const verticalCenterDiff = (actionsRect.top + actionsRect.height/2) - (rootRect.top + rootRect.height/2)

    console.log('\n=== GAPS ===')
    console.log(`Top gap: ${topGap.toFixed(2)}px`)
    console.log(`Bottom gap: ${bottomGap.toFixed(2)}px`)
    console.log(`Vertical center diff: ${verticalCenterDiff.toFixed(2)}px`)

    // Check computed styles for the action group
    const actionsStyles = await actionGroup.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        height: cs.height,
        minHeight: cs.minHeight,
        alignSelf: cs.alignSelf,
        alignItems: cs.alignItems,
        display: cs.display,
      }
    })
    console.log('\nAction Group Computed Styles:', actionsStyles)

    // Check button
    const buttons = await actionGroup.evaluateHandle(el => Array.from(el.querySelectorAll('button')))
    const buttonCount = await buttons.evaluate(arr => arr.length)
    console.log(`\nButton count: ${buttonCount}`)

    if (buttonCount > 0) {
      const btn = await buttons.evaluateHandle(arr => arr[0])
      const btnRect = await btn.evaluate(el => el.getBoundingClientRect())
      const btnTopGap = btnRect.top - rootRect.top
      const btnBottomGap = rootRect.bottom - btnRect.bottom
      console.log(`Button: topGap=${btnTopGap.toFixed(2)}px, bottomGap=${btnBottomGap.toFixed(2)}px, height=${btnRect.height.toFixed(2)}px`)

      const btnStyles = await btn.evaluate(el => {
        const cs = window.getComputedStyle(el)
        return {
          height: cs.height,
          minHeight: cs.minHeight,
          alignSelf: cs.alignSelf,
        }
      })
      console.log('Button Computed Styles:', btnStyles)
    }

    await buttons.dispose()

    console.log('\n=== ASSESSMENT ===')
    if (Math.abs(topGap) < 1 && Math.abs(bottomGap) < 1) {
      console.log('✅ PERFECT: Action group fills full height (no top/bottom gaps)')
    } else if (topGap <= 2 && bottomGap <= 2) {
      console.log('✅ GOOD: Small gaps (<=2px)')
    } else {
      console.log(`⚠️  GAPS: Top=${topGap.toFixed(2)}px, Bottom=${bottomGap.toFixed(2)}px`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

checkActionButtons()