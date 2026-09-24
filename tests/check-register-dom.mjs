import { chromium } from 'playwright';

async function checkRegisterPage() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--ignore-certificate-errors']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to https://localhost:3000/register...');
    await page.goto('https://localhost:3000/register', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    console.log('Page loaded, checking inputs...');

    // Wait for inputs to be visible
    await page.waitForSelector('input[name="lastname"]', { timeout: 10000 });

    // Get the username input and check its ancestors
    const usernameInput = page.locator('input[name="username"]');

    // Check ancestors to find input-root
    const ancestors = await usernameInput.evaluate((el) => {
      const result = [];
      let current = el.parentElement;
      while (current && result.length < 10) {
        result.push({
          tag: current.tagName,
          classList: Array.from(current.classList),
          id: current.id
        });
        current = current.parentElement;
      }
      return result;
    });

    console.log('Username input ancestors:');
    ancestors.forEach((a, i) => {
      console.log(`  Level ${i}: <${a.tag.toLowerCase()}> class="${a.classList.join(' ')}" id="${a.id}"`);
    });

    // Find the input-root container
    const inputRootContainer = await usernameInput.evaluate((el) => {
      let current = el.parentElement;
      while (current) {
        if (current.classList.contains('input-root')) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    });

    if (inputRootContainer) {
      console.log('\nFound input-root container!');
    } else {
      console.log('\nNo input-root container found in ancestors');
    }

    // Also check the textField-root
    const textFieldRoot = await usernameInput.evaluate((el) => {
      let current = el.parentElement;
      while (current) {
        if (current.classList.contains('textField-root')) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    });

    if (textFieldRoot) {
      console.log('\nFound textField-root container!');
    }

    // Check all inputs for their input-root containers
    console.log('\n=== Checking all inputs for input-root ===');
    const inputNames = ['lastname', 'midname', 'firstname', 'username', 'email', 'phone', 'password', 'confirmPassword'];

    for (const name of inputNames) {
      const input = page.locator(`input[name="${name}"]`);
      const hasInputRoot = await input.evaluate((el) => {
        let current = el.parentElement;
        while (current) {
          if (current.classList.contains('input-root')) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      });

      if (hasInputRoot) {
        // Get the actual element and its styles
        const handle = await input.evaluateHandle((el) => {
          let current = el.parentElement;
          while (current) {
            if (current.classList.contains('input-root')) {
              return current;
            }
            current = current.parentElement;
          }
          return null;
        });

        const styles = await handle.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            borderRadius: computed.borderRadius,
            minHeight: computed.minHeight,
            display: computed.display,
            backgroundColor: computed.backgroundColor,
            borderWidth: computed.borderWidth,
            borderColor: computed.borderColor,
            paddingInlineStart: computed.paddingInlineStart,
            classList: Array.from(el.classList),
          };
        });
        console.log(`Input ${name} - input-root styles:`, styles);

        await handle.dispose();
      } else {
        console.log(`Input ${name} - NO input-root found`);
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log('Register page input styling check complete.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

checkRegisterPage();