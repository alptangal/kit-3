import { chromium } from '@playwright/test';
const BASE = 'https://localhost:3000/ui/select';
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const ctx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	hasTouch: false
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

const sec = page.locator('section:has(h2:has-text("Update / Delete"))');
await sec.locator('.select-trigger').first().click();
await sec.locator('.select-dropdown').first().waitFor({ timeout: 4000 });
await page.waitForTimeout(250);
const editBtn = sec.locator('.select-option__action--edit').first();
const bb = await editBtn.boundingBox();
await editBtn.hover();
if (bb) await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);

let elapsed = 0;
for (const delta of [300, 500, 800, 1200]) {
	await page.waitForTimeout(delta);
	elapsed += delta;
	const state = await page.evaluate(() => {
		const tip = document.querySelector('.tooltip-content');
		const arrowInBody = document.body.querySelector('.tooltip-arrow');
		const allArrows = document.querySelectorAll('.tooltip-arrow').length;
		let tipStyle = null;
		if (tip) tipStyle = { top: tip.style.top, left: tip.style.left, w: tip.offsetWidth, h: tip.offsetHeight, z: getComputedStyle(tip).zIndex };
		return {
			allArrows,
			arrowInBody: !!arrowInBody,
			arrowInBodyCls: arrowInBody ? arrowInBody.className : null,
			arrowInBodyStyle: arrowInBody ? { top: arrowInBody.style.top, left: arrowInBody.style.left } : null,
			tipInBody: !!document.body.querySelector('.tooltip-content'),
			tipStyle
		};
	});
	console.log(`[t=${elapsed}ms]`, JSON.stringify(state));
	if (state.arrowInBody) break;
}
await browser.close();
