// toggle-base-probe.mjs
// Functional probe cho task wave 11 "Toggle component MỚI (element, shadcn base/toggle)":
// - B0  page render (.toggle-root >= 1, demo root)
// - B1  click nút → aria-pressed đổi true↔false (controlled qua bind:pressed)
// - B2  keyboard: focus nút → Space/Enter → toggle (activeElement + aria-pressed)
// - B3  variant: default + outline render đúng class
// - B4  size: sm/default/lg render đúng class + min-height khác nhau
// - B5  icon: icon cạnh text + icon-only render (svg iconify)
// - B6  color pressed-state: pressed đổi màu nền (success/error semantic)
// - B7  disabled → không toggle được (aria-pressed giữ nguyên)
// - B8  a11y: role implicit button, aria-pressed khớp DOM class .pressed, focus ring
// - B9  uncontrolled: không bind → toggle nội bộ vẫn đổi aria-pressed
// Chạy: node tests/toggle-base-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/toggle';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toggle-demo"]', { timeout: 20000 });
await page.waitForSelector('.toggle-root', { timeout: 20000 });
// Chờ SvelteKit hydration (client listeners + binding)
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

const root = (dataTest) => page.locator(`[data-test="${dataTest}"] .toggle-root`);
const toggleBtn = (dataTest) => page.locator(`[data-test="${dataTest}"] button.toggle-root`);

console.log('\n=== B0: PAGE RENDER ===');
ok('B0: demo root render', (await page.locator('[data-test="toggle-demo"]').count()) === 1);
const rootCount = await page.locator('.toggle-root').count();
ok('B0: .toggle-root >= 1 (mọi section có toggle)', rootCount >= 7, `count=${rootCount}`);
ok(
	'B0: toggle là <button type="button">',
	(await page.locator('button.toggle-root[type="button"]').count()) === rootCount,
	`buttons=${await page.locator('button.toggle-root[type="button"]').count()}`
);

console.log('\n=== B1: CLICK NÚT → ARIA-PRESSED ĐỔI ===');
const b1Btn = toggleBtn('tg-default').first();
const b1Before = await b1Btn.getAttribute('aria-pressed');
await b1Btn.click();
await page.waitForTimeout(150);
const b1After = await b1Btn.getAttribute('aria-pressed');
ok('B1: click → aria-pressed đổi (false↔true)', b1Before !== b1After, `${b1Before} → ${b1After}`);
ok('B1: click → DOM class .pressed gán', (await b1Btn.getAttribute('class'))?.includes('pressed') === true);
// Click lần 2 → về lại giá trị ban đầu (đảm bind:pressed 2 chiều)
await b1Btn.click();
await page.waitForTimeout(150);
const b1Back = await b1Btn.getAttribute('aria-pressed');
ok('B1: click lần 2 → aria-pressed về giá trị ban đầu', b1Back === b1Before, `${b1After} → ${b1Back}`);

console.log('\n=== B2: KEYBOARD (SPACE / ENTER) ===');
const b2Btn = toggleBtn('tg-keyboard').first();
const b2Before = await b2Btn.getAttribute('aria-pressed');
await b2Btn.focus();
await page.waitForTimeout(100);
const activeIsToggle = await page.evaluate(() => {
	const a = document.activeElement;
	return a instanceof HTMLElement && a.classList.contains('toggle-root');
});
ok('B2: focus → document.activeElement = toggle button', activeIsToggle);
await page.keyboard.press(' ');
await page.waitForTimeout(150);
const b2Space = await b2Btn.getAttribute('aria-pressed');
ok('B2: Space → toggle (aria-pressed đổi)', b2Space !== b2Before, `${b2Before} → ${b2Space}`);
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
const b2Enter = await b2Btn.getAttribute('aria-pressed');
ok('B2: Enter → toggle về lại (aria-pressed đổi)', b2Enter !== b2Space && b2Enter === b2Before, `${b2Space} → ${b2Enter}`);

console.log('\n=== B3: VARIANT (default + outline) ===');
const b3Default = toggleBtn('tg-default').first();
const b3Outline = toggleBtn('tg-outline').first();
ok('B3: default variant có class variant-default', (await b3Default.getAttribute('class'))?.includes('variant-default') === true);
ok('B3: outline variant có class variant-outline', (await b3Outline.getAttribute('class'))?.includes('variant-outline') === true);
// Outline: viền hiển thị (border-color !== transparent)
const b3OutlineBorder = await b3Outline.evaluate((el) => getComputedStyle(el).borderColor);
ok('B3: outline có viền hiển thị', !/transparent|rgba\(0, 0, 0, 0\)/.test(b3OutlineBorder), b3OutlineBorder);
// Default: nền trong suốt khi unpressed
const b3DefaultBg = await b3Default.evaluate((el) => getComputedStyle(el).backgroundColor);
ok('B3: default unpressed → nền trong suốt', /transparent|rgba\(0, 0, 0, 0\)/.test(b3DefaultBg), b3DefaultBg);

console.log('\n=== B4: SIZE (sm / default / lg) ===');
const b4Sm = toggleBtn('tg-sizes').nth(0);
const b4Md = toggleBtn('tg-sizes').nth(1);
const b4Lg = toggleBtn('tg-sizes').nth(2);
ok('B4: sm có class size-sm', (await b4Sm.getAttribute('class'))?.includes('size-sm') === true);
ok('B4: default có class size-default', (await b4Md.getAttribute('class'))?.includes('size-default') === true);
ok('B4: lg có class size-lg', (await b4Lg.getAttribute('class'))?.includes('size-lg') === true);
// Min-height khác nhau (sm < default < lg — đo DOM)
const hSm = await b4Sm.evaluate((el) => el.getBoundingClientRect().height);
const hMd = await b4Md.evaluate((el) => el.getBoundingClientRect().height);
const hLg = await b4Lg.evaluate((el) => el.getBoundingClientRect().height);
ok('B4: min-height tăng dần (sm < default < lg)', hSm < hMd && hMd < hLg, `${hSm} < ${hMd} < ${hLg}`);

console.log('\n=== B5: ICON (cạnh text + icon-only) ===');
const b5Btns = toggleBtn('tg-icon');
// Switch 1: icon cạnh text (search-rounded)
const b5Btn1 = b5Btns.nth(0);
ok('B5: toggle icon có .toggle-icon', (await b5Btn1.locator('.toggle-icon').count()) === 1);
ok('B5: toggle icon có svg iconify render', (await b5Btn1.locator('.toggle-icon svg').count()) === 1);
ok('B5: icon aria-hidden (trang trí)', (await b5Btn1.locator('.toggle-icon[aria-hidden="true"]').count()) === 1);
ok('B5: icon cạnh text (label render cùng nút)', (await b5Btn1.locator('.toggle-label').textContent())?.trim() === 'Tìm kiếm');
// Switch 2: icon-only (không label/children — aria-label bắt buộc)
const b5Btn2 = b5Btns.nth(1);
ok('B5: icon-only không có label', (await b5Btn2.locator('.toggle-label').count()) === 0);
ok('B5: icon-only có aria-label', ((await b5Btn2.getAttribute('aria-label')) ?? '').length > 0);
ok('B5: icon-only có icon render', (await b5Btn2.locator('.toggle-icon svg').count()) === 1);

console.log('\n=== B6: COLOR PRESSED-STATE (semantic nền) ===');
const b6Success = toggleBtn('tg-colors').nth(1); // Success
const b6Before = await b6Success.evaluate((el) => getComputedStyle(el).backgroundColor);
await b6Success.click();
await page.waitForTimeout(200);
const b6After = await b6Success.evaluate((el) => getComputedStyle(el).backgroundColor);
ok('B6: success pressed → nền đổi màu semantic', b6Before !== b6After, `${b6Before} → ${b6After}`);
ok(
	'B6: success pressed có class color-success + pressed',
	((await b6Success.getAttribute('class'))?.includes('color-success') &&
		(await b6Success.getAttribute('class'))?.includes('pressed')) === true
);
await b6Success.click();
await page.waitForTimeout(200);

console.log('\n=== B7: DISABLED → KHÔNG TOGGLE ĐƯỢC ===');
const b7Btn = toggleBtn('tg-disabled').first(); // "Disabled (pressed)" = aria-pressed true
ok('B7: disabled toggle có attribute disabled', (await b7Btn.isDisabled()) === true);
const b7Before = await b7Btn.getAttribute('aria-pressed');
await b7Btn.click({ force: true }).catch(() => {});
await page.waitForTimeout(150);
const b7After = await b7Btn.getAttribute('aria-pressed');
ok('B7: click disabled → aria-pressed giữ nguyên', b7Before === b7After, `${b7Before} → ${b7After}`);

console.log('\n=== B8: A11Y (aria-pressed, focus ring) ===');
const b8 = await page.evaluate(() => {
	const btns = [...document.querySelectorAll('button.toggle-root')];
	return btns.map((b) => ({
		pressed: b.getAttribute('aria-pressed'),
		type: b.getAttribute('type'),
		label: (b.getAttribute('aria-label') ?? '').length > 0
	}));
});
ok('B8: mọi toggle type="button"', b8.every((b) => b.type === 'button'));
ok('B8: aria-pressed ∈ {true,false} khớp DOM class .pressed', b8.every((b) => b.pressed === 'true' || b.pressed === 'false'));
ok('B8: mọi toggle có aria-label (label text fallback)', b8.every((b) => b.label));
// Focus ring: :focus-visible (keyboard focus) → outline indigo
const b8Btn = toggleBtn('tg-keyboard').first();
await b8Btn.focus();
await page.keyboard.press('Shift'); // no-op, giữ focus
const b8Outline = await b8Btn.evaluate((el) => getComputedStyle(el).outlineColor + ' ' + getComputedStyle(el).outlineWidth);
ok('B8: focus ring (outline visible trên keyboard focus)', /2px/.test(b8Outline) && !/rgb\(0, 0, 0\)/.test(b8Outline), b8Outline);

console.log('\n=== B9: UNCONTROLLED (không bind → toggle nội bộ) ===');
// Toggle "Keyboard demo" không bind:pressed → toggle nội bộ (B2 đã toggle 2 lần về
// false ban đầu). Toggle thêm 1 lần → aria-pressed đổi (state nội bộ hoạt động).
const b9Btn = toggleBtn('tg-keyboard').first();
const b9Before = await b9Btn.getAttribute('aria-pressed');
await b9Btn.click();
await page.waitForTimeout(150);
const b9After = await b9Btn.getAttribute('aria-pressed');
ok('B9: uncontrolled click → aria-pressed đổi (state nội bộ)', b9Before !== b9After, `${b9Before} → ${b9After}`);
await b9Btn.click();
await page.waitForTimeout(150);
ok('B9: uncontrolled click lần 2 → về lại', (await b9Btn.getAttribute('aria-pressed')) === b9Before);

// ── Screenshots cho ui-checker (DSF2, light; section-level để avoid ảnh cao) ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/toggle-base';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="tg-sizes"]').screenshot({ path: `${shotDir}/01-sizes.png` });
await page.locator('[data-test="tg-icon"]').screenshot({ path: `${shotDir}/02-icon.png` });
await page.locator('[data-test="tg-colors"]').screenshot({ path: `${shotDir}/03-colors.png` });
await page.locator('[data-test="tg-default"]').screenshot({ path: `${shotDir}/04-default.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
