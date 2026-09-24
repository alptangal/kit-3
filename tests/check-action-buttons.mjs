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
    });

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
      left: rootRect.left,
      right: rootRect.right,
      width: rootRect.width,
    })
    console.log('Action Group:', {
      top: actionsRect.top,
      bottom: actionsRect.bottom,
      height: actionsRect.height,
      left: actionsRect.left,
      right: actionsRect.right,
      width: actionsRect.width,
    })
    console.log('Input Element:', {
      top: inputRect.top,
      bottom: inputRect.bottom,
      height: inputRect.height,
    })

    // Calculate gaps
    const topGap = actionsRect.top - rootRect.top
    const bottomGap = rootRect.bottom - actionsRect.bottom
    const verticalCenterDiff = (actionsRect.top + actionsRect.height/2) - (rootRect.top + rootRect.height/2)

    console.log('\n=== GAPS ===')
    console.log(`Top gap (action group top - root top): ${topGap.toFixed(2)}px`)
    console.log(`Bottom gap (root bottom - action group bottom): ${bottomGap.toFixed(2)}px`)
    console.log(`Vertical center difference: ${verticalCenterDiff.toFixed(2)}px`)

    // Check individual buttons
    console.log('\n=== INDIVIDUAL BUTTONS ===')
    const buttons = await actionGroup.evaluateHandle(el => Array.from(el.querySelectorAll('button')))
    const buttonCount = await buttons.evaluate(arr => arr.length)
    console.log(`Button count: ${buttonCount}`)

    for (let i = 0; i < buttonCount; i++) {
      const btn = await buttons.evaluateHandle((arr, idx) => arr[idx], i)
      const btnRect = await btn.evaluate(el => el.getBoundingClientRect())
      const btnTopGap = btnRect.top - rootRect.top
      const btnBottomGap = rootRect.bottom - btnRect.bottom
      console.log(`Button ${i}: topGap=${btnTopGap.toFixed(2)}px, bottomGap=${btnBottomGap.toFixed(2)}px, height=${btnRect.height.toFixed(2)}px`)
      await btn.dispose()
    }

    // Check computed styles for padding/margin
    console.log('\n=== COMPUTED STYLES ===')
    const rootStyles = await passwordInputRoot.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        height: cs.height,
        minHeight: cs.minHeight,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        gap: cs.gap,
      }
    })
    console.log('Input Root Styles:', rootStyles)

    const actionsStyles = await actionGroup.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        height: cs.height,
        minHeight: cs.minHeight,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        gap: cs.gap,
        width: cs.width,
      }
    })
    console.log('Action Group Styles:', actionsStyles)

    // Check button styles
    const firstBtn = await buttons.evaluateHandle(arr => arr[0])
    const btnStyles = await firstBtn.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        paddingRight: cs.paddingRight,
        height: cs.height,
        width: cs.width,
        minHeight: cs.minHeight,
        display: cs.display,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
        marginLeft: cs.marginLeft,
        marginRight: cs.marginRight,
      }
    })
    console.log('First Button Styles:', btnStyles)

    // Check input element styles
    const inputStyles = await passwordInput.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        height: cs.height,
        minHeight: cs.minHeight,
        lineHeight: cs.lineHeight,
        fontSize: cs.fontSize,
      }
    })
    console.log('Input Element Styles:', inputStyles)

    await buttons.dispose()
    await firstBtn.dispose()

    // Also check confirm password
    console.log('\n=== CONFIRM PASSWORD INPUT ===')
    const confirmInput = page.locator('input[name="confirmPassword"]')
    const confirmInputRoot = await confirmInput.evaluateHandle((el) => {
      let current = el.parentElement
      while (current) {
        if (current.classList.contains('input-root')) return current
        current = current.parentElement
      }
      return null
    })

    const confirmActionGroup = await confirmInputRoot.evaluateHandle(el => el.querySelector('.input-group-actions'))
    const confirmButtons = await confirmActionGroup.evaluateHandle(el => Array.from(el.querySelectorAll('button')))
    const confirmBtnCount = await confirmButtons.evaluate(arr => arr.length)
    console.log(`Confirm password button count: ${confirmBtnCount}`)

    await confirmButtons.dispose()
    await confirmInputRoot.dispose()

    // Check username (has clear button when value)
    console.log('\n=== USERNAME INPUT (with value) ===')
    const usernameInput = page.locator('input[name="username"]')
    await usernameInput.fill('testvalue')
    await page.waitForTimeout(200)

    const usernameInputRoot = await usernameInput.evaluateHandle((el) => {
      let current = el.parentElement
      while (current) {
        if (current.classList.contains('input-root')) return current
        current = current.parentElement
      }
      return null
    })

    const usernameActionGroup = await usernameInputRoot.evaluateHandle(el => el.querySelector('.input-group-actions'))
    const usernameButtons = await usernameActionGroup.evaluateHandle(el => Array.from(el.querySelectorAll('button')))
    const usernameBtnCount = await usernameButtons.evaluate(arr => arr.length)
    console.log(`Username button count (with value): ${usernameBtnCount}`)

    if (usernameBtnCount > 0) {
      const btn = await usernameButtons.evaluateHandle(arr => arr[0])
      const btnRect = await btn.evaluate(el => el.getBoundingClientRect())
      const rootRect2 = await usernameInputRoot.evaluate(el => el.getBoundingClientRect())
      console.log(`  Button topGap: ${(btnRect.top - rootRect2.top).toFixed(2)}px, bottomGap: ${(rootRect2.bottom - btnRect.bottom).toFixed(2)}px`)
    }

    await usernameButtons.dispose()
    await usernameInputRoot.dispose()

    console.log('\n=== SUMMARY ===')
    console.log('Action button positioning analysis complete.')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

checkActionButtons()