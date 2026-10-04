// Kiểm tra computed style thực tế của Select trong browser (ground truth)
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000';
const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
const page = await context.newPage();
await page.goto(`${BASE}/ui/select`, { waitUntil: 'networkidle' });

const pick = (sel, props) =>
	page.locator(sel).first().evaluate((el, props) => {
		const cs = getComputedStyle(el);
		const out = {};
		for (const p of props) out[p] = cs[p];
		return out;
	}, props);

// Token global
const tokens = await page.evaluate(() => {
	const cs = getComputedStyle(document.documentElement);
	return {
		'--color-sky-500': cs.getPropertyValue('--color-sky-500').trim(),
		'--disabled-opacity': cs.getPropertyValue('--disabled-opacity').trim(),
		'--color-gray-400': cs.getPropertyValue('--color-gray-400').trim(),
		'--error': cs.getPropertyValue('--error').trim(),
		'--border-radius-md': cs.getPropertyValue('--border-radius-md').trim()
	};
});
console.log('TOKENS :', JSON.stringify(tokens, null, 2));

// Trigger trạng thái closed, default
console.log('TRIGGER closed:', JSON.stringify(
	await pick('.select-root .select-trigger', ['borderColor', 'backgroundColor', 'boxShadow', 'borderRadius', 'minHeight', 'fontSize'])
));

// Focus trigger
await page.locator('.select-root').first().locator('.select-trigger').focus();
await page.waitForTimeout(100);
console.log('TRIGGER focus :', JSON.stringify(
	await pick('.select-root.focus .select-trigger', ['borderColor', 'backgroundColor', 'boxShadow'])
));

// Mở dropdown
await page.locator('.select-root').first().locator('.select-trigger').click();
await page.waitForTimeout(200);
console.log('DROPDOWN open :', JSON.stringify(
	await pick('.select-root .select-dropdown', ['backgroundColor', 'borderColor', 'boxShadow', 'backdropFilter', 'borderRadius'])
));

console.log('OPTION default  :', JSON.stringify(
	await pick('.select-option', ['color', 'backgroundColor'])
));
console.log('OPTION highlight:', JSON.stringify(
	await pick('.select-option.highlighted', ['color', 'backgroundColor', 'fontWeight'])
));
console.log('OPTION disabled :', JSON.stringify(
	await pick('.select-option.disabled', ['opacity', 'pointerEvents', 'cursor'])
));
console.log('SEARCH input    :', JSON.stringify(
	await pick('.select-search-input', ['borderColor', 'backgroundColor', 'borderRadius'])
));

// Chọn option → state selected trong trigger
await page.locator('.select-option').first().click();
await page.waitForTimeout(200);
console.log('CLEAR button    :', JSON.stringify(
	await pick('.select-clear-button', ['width', 'height', 'color', 'opacity', 'backgroundColor'])
));

await browser.close();
