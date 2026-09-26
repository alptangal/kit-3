import { test, expect, devices } from '@playwright/test';
import path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'test-results-ui-check');

async function ensureDir(page: any, dir: string) {
  await page.evaluate((path: string) => {
    // @ts-ignore
    if (typeof window.__electronAPI !== 'undefined') return;
    // browser side: just return
  }, dir);
}

const components = [
  { name: 'Button', selector: 'button' },
  { name: 'Tooltip-Trigger', selector: 'button svg, button:has-text("Tooltip")' },
  { name: 'Input-Number', selector: 'input[type="number"]' },
  { name: 'Checkbox', selector: 'input[type="checkbox"]' },
];

const projects = [devices['Desktop Chrome'], devices['Desktop Firefox'], devices['Desktop Safari']];
const projectNames = ['chromium', 'firefox', 'webkit'];

test.describe('UI Component Cross-Browser Check', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }, testInfo) => {
    await page.goto('/ui');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  let projectIndex = 0;

  for (const [i, projectName] of projectNames.entries()) {
    const device = projects[i];

    test(`${projectName}: Button - default/hover/focus`, async ({ page }) => {
      const button = page.locator('button').first();
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      if (box) {
        await page.screenshot({ path: `${screenshotDir}/${projectName}-Button-default.png`, clip: { x: box.x, y: box.y, width: Math.max(box.width + 50, 200), height: Math.max(box.height + 50, 100) } });
      } else {
        await page.screenshot({ path: `${screenshotDir}/${projectName}-Button-default.png` });
      }

      await button.hover();
      await page.waitForTimeout(300);
      if (box) {
        await page.screenshot({ path: `${screenshotDir}/${projectName}-Button-hover.png`, clip: { x: box.x, y: box.y, width: Math.max(box.width + 50, 200), height: Math.max(box.height + 50, 100) } });
      }

      await button.focus();
      await page.waitForTimeout(300);
      if (box) {
        await page.screenshot({ path: `${screenshotDir}/${projectName}-Button-focus.png`, clip: { x: box.x, y: box.y, width: Math.max(box.width + 50, 200), height: Math.max(box.height + 50, 100) } });
      }
    });

    test(`${projectName}: Tooltip - default/hover/open`, async ({ page }) => {
      const triggers = page.locator('button');
      const count = await triggers.count();
      let tooltipTrigger;
      for (let i = 0; i < count; i++) {
        const btn = triggers.nth(i);
        const hasTooltip = await btn.evaluate((el: HTMLElement) => {
          return Array.from(el.attributes).some(a => a.name.includes('tooltip') || (el as any)._svelteTooltip);
        });
        if (hasTooltip) {
          tooltipTrigger = btn;
          break;
        }
      }
      if (!tooltipTrigger) tooltipTrigger = page.locator('button').nth(1);
      if (tooltipTrigger) {
        const box = await tooltipTrigger.boundingBox();
        await tooltipTrigger.hover();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${screenshotDir}/${projectName}-Tooltip-hover.png` });
        await page.mouse.move(0, 0);
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${screenshotDir}/${projectName}-Tooltip-closed.png` });
      }
    });

    test(`${projectName}: Input - default/focus/type`, async ({ page }) => {
      const input = page.locator('input[type="number"]').first();
      if (await input.count() > 0) {
        const box = await input.boundingBox();
        await input.focus();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${screenshotDir}/${projectName}-Input-focus.png` });
        await input.fill('12345');
        await page.waitForTimeout(300);
        if (box) {
          await page.screenshot({ path: `${screenshotDir}/${projectName}-Input-filled.png` });
        }
        // clipboard button
        const copyBtn = page.locator('button[title*="copy"], button[title*="paste"], button[title*="Copy"], button[title*="Paste"]').first();
        if (await copyBtn.count() > 0) {
          await copyBtn.click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: `${screenshotDir}/${projectName}-Input-copy-clicked.png` });
        }
      }
    });
  }

  test('webkit: Sticky hover + clipboard API check', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'webkit');
    const input = page.locator('input[type="number"]').first();
    if (await input.count() > 0) {
      const box = await input.boundingBox();
      if (box) {
        await input.hover();
        await page.waitForTimeout(500);
        const hoverBox = await input.boundingBox();
        // Check if sticky hover persists (box should not be null)
        const hasStickyHover = hoverBox !== null;
        console.log(`[WebKit] Input sticky hover persists: ${hasStickyHover}`);

        // Check clipboard API
        const clipboardResult = await page.evaluate(() => {
          try {
            return navigator.clipboard ? 'available' : 'not-available';
          } catch (e) {
            return `error: ${e.message}`;
          }
        });
        console.log(`[WebKit] Clipboard API: ${clipboardResult}`);

        // Check aspect-ratio in ancestor
        const aspectInfo = await input.evaluate((el: HTMLElement) => {
          let ancestor: HTMLElement | null = el.parentElement;
          while (ancestor) {
            const style = window.getComputedStyle(ancestor);
            const hasContents = style.display === 'contents';
            if (hasContents) {
              return `found ancestor with display:contents, aspect-ratio: ${style.aspectRatio}`;
            }
            ancestor = ancestor.parentElement;
          }
          return 'no display:contents ancestor found';
        });
        console.log(`[WebKit] Aspect-ratio check: ${aspectInfo}`);

        await page.screenshot({ path: `${screenshotDir}/webkit-aspect-check.png` });
      }
    }
  });
});