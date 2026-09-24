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

    // Check computed styles for input-root (the flex container)
    const rootStyles = await passwordInputRoot.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        display: cs.display,
        alignItems: cs.alignItems,
        alignContent: cs.alignContent,
        justifyContent: cs.justifyContent,
        height: cs.height,
        minHeight: cs.minHeight,
        maxHeight: cs.maxHeight,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        borderTopWidth: cs.borderTopWidth,
        borderBottomWidth: cs.borderBottomWidth,
        boxSizing: cs.boxSizing,
      }
    })
    console.log('Input Root (Flex Container) Styles:', rootStyles)

    // Check action group styles
    const actionsStyles = await actionGroup.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        display: cs.display,
        alignSelf: cs.alignSelf,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        height: cs.height,
        minHeight: cs.minHeight,
        maxHeight: cs.maxHeight,
        flexGrow: cs.flexGrow,
        flexShrink: cs.flexShrink,
        flexBasis: cs.flexBasis,
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        boxSizing: cs.boxSizing,
      }
    })
    console.log('Action Group Styles:', actionsStyles)

    // Check button styles
    const buttons = await actionGroup.evaluateHandle(el => Array.from(el.querySelectorAll('button')))
    const btn = await buttons.evaluateHandle(arr => arr[0])
    const btnStyles = await btn.evaluate(el => {
      const cs = window.getComputedStyle(el)
      return {
        display: cs.display,
        height: cs.height,
        minHeight: cs.minHeight,
        alignSelf: cs.alignSelf,
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
      }
    })
    console.log('Button Styles:', btnStyles)

    // Get positions
    const rootRect = await passwordInputRoot.evaluate(el => el.getBoundingClientRect())
    const actionsRect = await actionGroup.evaluate(el => el.getBoundingClientRect())
    const btnRect = await btn.evaluate(el => el.getBoundingClientRect())

    console.log('\nRects:')
    console.log('Root:', rootRect)
    console.log('Actions:', actionsRect)
    console.log('Button:', btnRect)

    // Check if action group's parent is input-root
    const parentCheck = await actionGroup.evaluate(el => {
      return {
        parentClass: el.parentElement?.className,
        parentTag: el.parentElement?.tagName,
      }
    })
    console.log('\nParent of action group:', parentCheck)

    await buttons.dispose()
    await btn.dispose()

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

debugFlex()
