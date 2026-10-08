// switch-probe.mjs (rename tu toggle-probe.mjs — wave 11)
// Functional probe cho task "viết lại Toggle theo mẫu Checkbox (configs $state
// + Symbol context + form field + validation)":
// - T0  page render (.switch-root >= 1, demo root)
// - T1  click switch → aria-checked đổi true↔false
// - T2  keyboard: focus switch → Space/Enter → toggle (activeElement + aria-checked)
// - T3  click label → toggle
// - T4  disabled → không toggle được (aria-checked giữ nguyên)
// - T5  loading → không toggle được
// - T6  required + FieldMessages: ban đầu invalid → bật → valid (showValid)
// - T7  form gating: trong <Form>, toggle required OFF → submit disabled; ON → enabled
// - T8  a11y: role="switch", aria-checked khớp, focus ring :focus-visible
// - T9  reset: gọi reset → về trạng thái ban đầu
// Chạy: node tests/switch-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/switch';
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
await page.waitForSelector('[data-test="switch-demo"]', { timeout: 20000 });
await page.waitForSelector('.switch-root', { timeout: 20000 });
// Chờ SvelteKit hydration (client listeners + binding)
await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(400);

const root = (dataTest) => page.locator(`[data-test="${dataTest}"] .switch-root`);
const switchBtn = (dataTest) => root(dataTest).locator('button.switch-switch');
const labelEl = (dataTest) => root(dataTest).locator('label.switch-label, span.switch-label');

console.log('\n=== T0: PAGE RENDER ===');
ok('T0: demo root render', (await page.locator('[data-test="switch-demo"]').count()) === 1);
const rootCount = await page.locator('.switch-root').count();
ok('T0: .switch-root >= 1 (mọi section có switch)', rootCount >= 8, `count=${rootCount}`);
ok(
	'T0: switch là <button role="switch">',
	(await page.locator('button.switch-switch[role="switch"]').count()) === rootCount,
	`buttons=${await page.locator('button.switch-switch[role="switch"]').count()}`
);

console.log('\n=== T1: CLICK SWITCH → ARIA-CHÉCKED ĐỔI ===');
const t1Btn = switchBtn('sw-default').first();
const t1Before = await t1Btn.getAttribute('aria-checked');
await t1Btn.click();
await page.waitForTimeout(150);
const t1After = await t1Btn.getAttribute('aria-checked');
ok('T1: click → aria-checked đổi (false↔true)', t1Before !== t1After, `${t1Before} → ${t1After}`);
// Click lần 2 → về lại giá trị ban đầu (đảm bind:checked 2 chiều)
await t1Btn.click();
await page.waitForTimeout(150);
const t1Back = await t1Btn.getAttribute('aria-checked');
ok('T1: click lần 2 → aria-checked về giá trị ban đầu', t1Back === t1Before, `${t1After} → ${t1Back}`);

console.log('\n=== T2: KEYBOARD (SPACE / ENTER) ===');
const t2Btn = switchBtn('sw-keyboard').first();
const t2Before = await t2Btn.getAttribute('aria-checked');
await t2Btn.focus();
await page.waitForTimeout(100);
const activeIsSwitch = await page.evaluate(() => {
	const a = document.activeElement;
	return a instanceof HTMLElement && a.classList.contains('switch-switch');
});
ok('T2: focus → document.activeElement = switch button', activeIsSwitch);
await page.keyboard.press(' ');
await page.waitForTimeout(150);
const t2Space = await t2Btn.getAttribute('aria-checked');
ok('T2: Space → toggle (aria-checked đổi)', t2Space !== t2Before, `${t2Before} → ${t2Space}`);
await page.keyboard.press('Enter');
await page.waitForTimeout(150);
const t2Enter = await t2Btn.getAttribute('aria-checked');
ok('T2: Enter → toggle về lại (aria-checked đổi)', t2Enter !== t2Space && t2Enter === t2Before, `${t2Space} → ${t2Enter}`);

console.log('\n=== T3: CLICK LABEL → TOGGLE ===');
const t3Root = root('sw-default').first();
const t3Switch = switchBtn('sw-default').first();
const t3Label = labelEl('sw-default').first();
const t3Before = await t3Switch.getAttribute('aria-checked');
await t3Label.click();
await page.waitForTimeout(150);
const t3After = await t3Switch.getAttribute('aria-checked');
ok('T3: click label → aria-checked đổi (label control switch)', t3Before !== t3After, `${t3Before} → ${t3After}`);
// Click label lần 2 → về lại (tránh để lại state cho checks sau)
await t3Label.click();
await page.waitForTimeout(150);
ok('T3: click label lần 2 → về giá trị ban đầu', (await t3Switch.getAttribute('aria-checked')) === t3Before);
ok('T3: label đúng loại <label> (không natively nested trong button)', (await t3Root.locator('label.switch-label, span.switch-label').count()) >= 1);

console.log('\n=== T4: DISABLED → KHÔNG TOGGLE ĐƯỢC ===');
const t4Btn = switchBtn('sw-disabled').first(); // "Disabled (on)" = aria-checked true
ok('T4: disabled switch có attribute disabled', (await t4Btn.isDisabled()) === true);
const t4Before = await t4Btn.getAttribute('aria-checked');
await t4Btn.click({ force: true }).catch(() => {});
await page.waitForTimeout(150);
const t4After = await t4Btn.getAttribute('aria-checked');
ok('T4: click disabled → aria-checked giữ nguyên', t4Before === t4After, `${t4Before} → ${t4After}`);
// Label của disabled cũng không toggle được (pointer-events:none trên root)
const t4Label = labelEl('sw-disabled').first();
await t4Label.click({ force: true }).catch(() => {});
await page.waitForTimeout(150);
ok('T4: click label disabled → vẫn giữ nguyên', (await t4Btn.getAttribute('aria-checked')) === t4Before);

console.log('\n=== T5: LOADING → KHÔNG TOGGLE ĐƯỢC ===');
const t5Btn = switchBtn('sw-loading').first();
const t5Before = await t5Btn.getAttribute('aria-checked');
await t5Btn.click(); // bắt đầu loading (800ms mock)
await page.waitForTimeout(150); // đang trong loading window
ok('T5: lúc loading switch bị disabled (block click)', (await t5Btn.isDisabled()) === true);
await t5Btn.click({ force: true }).catch(() => {});
await page.waitForTimeout(1100); // hết loading → giá trị commit (1 lần click thật)
const t5After = await t5Btn.getAttribute('aria-checked');
ok('T5: loading kết thúc → giá trị commit (aria-checked đổi 1 lần)', t5After !== t5Before, `${t5Before} → ${t5After}`);
ok('T5: loading kết thúc → switch enable lại', (await t5Btn.isDisabled()) === false);

console.log('\n=== T6: REQUIRED + FIELDMESSAGES (showValid) ===');
const t6Root = root('sw-required').first();
const t6Msg = page.locator('[data-test="sw-required"] .fieldMessages-root');
// Ban đầu (required, off, chưa đổi): message invalid đã hiện (kick onMount)
await page.waitForTimeout(300);
const t6Init = (await t6Msg.textContent().catch(() => '')) ?? '';
ok(
	'T6: ban đầu (required + off) → message invalid hiện',
	/required|bắt buộc/i.test(t6Init),
	t6Init.trim()
);
ok(
	'T6: ban đầu message invalid có class .invalid',
	(await page.locator('[data-test="sw-required"] .fieldMessages-root p.invalid').count()) >= 1
);
// Bật lên → debounce 300ms → message valid
const t6Btn = switchBtn('sw-required').first();
await t6Btn.click();
await page.waitForTimeout(700);
const t6On = (await t6Msg.textContent().catch(() => '')) ?? '';
ok('T6: bật → message valid hiện (showValid)', /valid|hợp lệ/i.test(t6On), t6On.trim());
ok('T6: bật → không còn message invalid', (await page.locator('[data-test="sw-required"] .fieldMessages-root p.invalid').count()) === 0);
// Tắt xuống → invalid lại
await t6Btn.click();
await page.waitForTimeout(700);
const t6Off = (await t6Msg.textContent().catch(() => '')) ?? '';
ok('T6: tắt → message invalid hiện lại', /required|bắt buộc/i.test(t6Off), t6Off.trim());
// Bật lại (để lại state hợp lệ cho screenshot)
await t6Btn.click();
await page.waitForTimeout(700);

console.log('\n=== T7: FORM GATING (toggle required + email) ===');
const t7Submit = page.locator('[data-test="sw-form"] .button-root').filter({ hasText: 'Submit' }).first();
ok('T7: ban đầu submit DISABLED (toggle required OFF + email trống)', (await t7Submit.isDisabled()) === true);
const t7Btn = switchBtn('sw-form').first();
await t7Btn.click(); // bật consent
const t7Email = page.locator('[data-test="sw-form"] input[type="email"]');
await t7Email.fill('probe@example.com');
await t7Email.blur();
await page.waitForTimeout(700); // debounce validation
ok('T7: bật toggle + email hợp lệ → submit ENABLED', (await t7Submit.isDisabled()) === false);
// Email sai → form invalid → disabled
await t7Email.fill('sai-dinh-dang');
await t7Email.blur();
await page.waitForTimeout(700);
ok('T7: email sai → submit DISABLED (form validation gate)', (await t7Submit.isDisabled()) === true);
// Sửa email đúng + submit → payload boolean
await t7Email.fill('probe@example.com');
await t7Email.blur();
await page.waitForTimeout(700);
await t7Submit.click();
await page.waitForTimeout(400);
const t7Payload = await page.locator('[data-test="sw-payload"]').textContent().catch(() => '');
ok('T7: submit → payload có consent=true (boolean serialize)', /"consent":true/.test(t7Payload ?? ''), t7Payload);

console.log('\n=== T8: A11Y (role=switch, aria-checked, focus ring) ===');
const t8 = await page.evaluate(() => {
	const btns = [...document.querySelectorAll('button.switch-switch')];
	return btns.map((b) => ({
		role: b.getAttribute('role'),
		checked: b.getAttribute('aria-checked'),
		label: (b.getAttribute('aria-label') ?? '').length > 0
	}));
});
ok('T8: mọi switch role="switch"', t8.every((b) => b.role === 'switch'));
ok('T8: aria-checked ∈ {true,false} khớp DOM class has-value', t8.every((b) => b.checked === 'true' || b.checked === 'false'));
ok('T8: mọi switch có aria-label (label text fallback)', t8.every((b) => b.label));
// Focus ring: :focus-visible (keyboard focus) → outline indigo
const t8Btn = switchBtn('sw-keyboard').first();
await t8Btn.focus();
await page.keyboard.press('Shift'); // no-op, giữ focus
const t8Outline = await t8Btn.evaluate((el) => getComputedStyle(el).outlineColor + ' ' + getComputedStyle(el).outlineWidth);
ok('T8: focus ring (outline visible trên keyboard focus)', /2px/.test(t8Outline) && !/rgb\(0, 0, 0\)/.test(t8Outline), t8Outline);

console.log('\n=== T9: RESET ===');
const t9Btn = switchBtn('sw-reset').first();
const t9Before = await t9Btn.getAttribute('aria-checked');
await t9Btn.click();
await page.waitForTimeout(150);
ok('T9: bật toggle reset demo (aria-checked true)', (await t9Btn.getAttribute('aria-checked')) === 'true');
await page.locator('[data-test="sw-reset-btn"]').click();
await page.waitForTimeout(200);
const t9After = await t9Btn.getAttribute('aria-checked');
ok('T9: sau reset → về giá trị ban đầu (off/false)', t9After === 'false', `${t9After}`);
ok('T9: reset hint đồng bộ (off)', ((await page.locator('[data-test="sw-reset-value"]').textContent()) ?? '').trim() === 'off');
// Reset không để lại message validation (field không required → không có)
ok('T9: field không-required không có fieldMessages message sau reset', (await page.locator('[data-test="sw-reset"] .fieldMessages-root p').count()) === 0);

console.log('\n=== T10: ICON TREN THUMB (icon + iconOn/iconOff) ===');
const t10Root = root('sw-icon');
const t10Btns = t10Root.locator('button.switch-switch');
// Switch 1: icon cố định (info-i-rounded) — icon hiển thị cả 2 state
const t10Btn1 = t10Btns.nth(0);
ok(
	'T10: switch icon có .switch-thumb-icon bên trong thumb',
	(await t10Btn1.locator('.switch-thumb .switch-thumb-icon').count()) === 1
);
ok(
	'T10: switch icon có svg iconify render',
	(await t10Btn1.locator('.switch-thumb-icon svg').count()) === 1
);
// Switch 2: cặp iconOn/iconOff — icon đổi theo state (off → close, on → check)
const t10Btn2 = t10Btns.nth(1);
const t10IconOff = await t10Btn2.locator('.switch-thumb .switch-thumb-icon svg').count();
ok('T10: pair icon OFF → có icon (close-rounded)', t10IconOff === 1, `svg=${t10IconOff}`);
await t10Btn2.click();
await page.waitForTimeout(200);
const t10IconOn = await t10Btn2.locator('.switch-thumb .switch-thumb-icon svg').count();
ok('T10: pair icon ON → vẫn có icon (check-rounded)', t10IconOn === 1, `svg=${t10IconOn}`);
ok('T10: pair icon ON → aria-checked đổi', (await t10Btn2.getAttribute('aria-checked')) === 'true');
// Icon color đổi theo state (on → màu on-color, off → muted): so sánh màu ON vs OFF
const t10ColorOn = await t10Btn2.locator('.switch-thumb-icon').evaluate((el) => getComputedStyle(el).color);
await t10Btn2.click();
await page.waitForTimeout(200);
const t10ColorOff = await t10Btn2.locator('.switch-thumb-icon').evaluate((el) => getComputedStyle(el).color);
ok('T10: icon color đổi theo state (ON ≠ OFF)', t10ColorOn !== t10ColorOff, `${t10ColorOn} vs ${t10ColorOff}`);

// ── Screenshots cho ui-checker (DSF2, light; section-level để avoid ảnh cao) ──
console.log('\n=== SCREENSHOTS ===');const shotDir = 'tests/screenshot/switch';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="sw-icon"]').screenshot({ path: `${shotDir}/00-icon.png` });
await page.locator('[data-test="sw-sizes"]').screenshot({ path: `${shotDir}/01-sizes.png` });
await page.locator('[data-test="sw-colors"]').screenshot({ path: `${shotDir}/02-colors.png` });
// tg-required đang ở state "valid" (bật) — screenshot 03 cần state ERROR:
// tắt toggle required → invalid message hiện
const t6Btn2 = switchBtn('sw-required').first();
await t6Btn2.click();
await page.waitForTimeout(700);
await page.locator('[data-test="sw-required"]').screenshot({ path: `${shotDir}/03-required-error.png` });
// Bật lại (dành cho state hợp lệ, không ảnh hưởng checks đã xong)
await t6Btn2.click();
await page.waitForTimeout(700);
// tg-form: restore state valid trước khi chụp (toggle on + email đúng)
const t7Btn2 = switchBtn('sw-form').first();
const t7Aria = await t7Btn2.getAttribute('aria-checked');
if (t7Aria === 'false') {
	await t7Btn2.click();
	await page.waitForTimeout(300);
}
const t7Email2 = page.locator('[data-test="sw-form"] input[type="email"]');
await t7Email2.fill('probe@example.com');
await t7Email2.blur();
await page.waitForTimeout(700);
await page.locator('[data-test="sw-form"]').screenshot({ path: `${shotDir}/04-form.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
