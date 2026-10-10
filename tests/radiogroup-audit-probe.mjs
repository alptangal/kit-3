// radiogroup-audit-probe.mjs
// Audit probe cho task "#radio group component — check/test đã áp tối đa sizes, colors, variants":
// - RA0  page render + đủ 14 size + đủ 7 color group
// - RA1  mọi size: class size-* đúng + --radio-size scale theo --font-size (monotonic)
// - RA2  mọi color: --color đúng token semantic (map colors.scss), KHÔNG còn color mù
// - RA3  checked circle + label theo --radio-checked-color (semantic, KHÔNG hardcode indigo)
// - RA4  validation vẫn sinh error/success (required chưa chọn → error; chọn → success)
// - RA5  hover background theo token --default-100 (theme-aware, KHÔNG literal)
// - RA6  dot màu token --background (đổi theo theme, không #fff cứng)
// - RA7  orientation/disabled/required (variants) hoạt động
// Chạy: node tests/radiogroup-audit-probe.mjs (dev server https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const PAGE = `${BASE}/ui/radiogroup`;
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const SIZES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
const COLORS = ['default', 'primary', 'info', 'secondary', 'success', 'warning', 'error'];

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="radiogroup-demo"]', { timeout: 20000 });

const sizeGroup = (s) => page.locator(`[data-test="rg-sizes"] .radiogroup-root.size-${s}`);
const colorGroup = (c) => page.locator(`[data-test="rg-colors"] .radiogroup-root.color-${c}`);

// ── RA0: render đủ group ──
console.log('\n=== RA0: RENDER ĐỦ 14 SIZE + 7 COLOR ===');
ok('RA0: demo root render', (await page.locator('[data-test="radiogroup-demo"]').count()) === 1);
let nSize = 0;
for (const s of SIZES) nSize += await sizeGroup(s).count();
ok('RA0: 14 group size-* render (2xs→9xl)', nSize === 14, String(nSize));
let nColor = 0;
for (const c of COLORS) nColor += await colorGroup(c).count();
ok('RA0: 7 group color-* render', nColor === 7, String(nColor));

// ── RA1: size class + --radio-size scale theo --font-size ──
console.log('\n=== RA1: SIZE TOKEN SCALE ===');
// Đọc mỗi group: --font-size + --radio-size thực tế (px) + min-height item
const sizeData = await page.evaluate(() => {
	const out = [];
	for (const g of document.querySelectorAll('[data-test="rg-sizes"] .radiogroup-root')) {
		const s = getComputedStyle(g);
		const fs = parseFloat(s.fontSize);
		const sizeToken = s.getPropertyValue('--radio-size').trim();
		out.push({
			cls: [...g.classList].find((c) => c.startsWith('size-')),
			fontSize: fs,
			radioSizeToken: sizeToken,
			minHeight: parseFloat(getComputedStyle(g.querySelector('.radio-item')).minHeight) || 0
		});
	}
	return out;
});
ok(
	'RA1: đủ 14 class size-2xs→size-9xl (đúng thứ tự)',
	SIZES.every((s, i) => sizeData[i]?.cls === `size-${s}`),
	sizeData.map((d) => d.cls).join(',')
);
const fontSizes = sizeData.map((d) => d.fontSize);
const monotonicFs = fontSizes.every((v, i) => i === 0 || v > fontSizes[i - 1]);
ok('RA1: --font-size tăng dần 2xs→9xl (strict)', monotonicFs, fontSizes.join(','));
// --radio-size = calc(font-size + 0.5rem) → giá trị tính = fs + 8px.
// Mỗi group có 2 item → circle đầu tiên của TỪNG group (bước 2).
const radioSizes = await page.evaluate(() =>
	[...document.querySelectorAll('[data-test="rg-sizes"] .radiogroup-root')].map(
		(g) => parseFloat(getComputedStyle(g.querySelector('.radio-circle')).width)
	)
);
const expectRadio = sizeData.map((d) => d.fontSize + 8);
const radioOk = radioSizes.every((v, i) => Math.abs(v - expectRadio[i]) < 1.5);
ok('RA1: --radio-size = font-size + 0.5rem trên mọi size', radioOk, radioSizes.map((v) => v.toFixed(1)).join(','));
// min-height item theo token: 2xs→xl token cố định tăng dần (24→50);
// 2xl→9xl = font-size token (24→128, floor = chữ). Ranh giới xl(50) > 2xl(24)
// là thiết kế token hệ thống (mọi component size ≥ 2xl cùng hành vi) — assert
// 2 nhóm con monotonic + mọi giá trị > 0 (KHÔNG 0 như bug token cũ).
const minHeights = sizeData.map((d) => d.minHeight);
const head = minHeights.slice(0, 6); // 2xs..xl
const tail = minHeights.slice(6); // 2xl..9xl
const headOk = head.every((v, i) => i === 0 || v > head[i - 1]);
const tailOk = tail.every((v, i) => i === 0 || v > tail[i - 1]);
ok(
	'RA1: item --min-height theo token (2 nhóm monotonic, không 0)',
	headOk && tailOk && minHeights.every((v) => v > 0),
	minHeights.join(',')
);

// ── RA2: color semantic map (trên root: --color; hover: token --default-100) ──
console.log('\n=== RA2: COLOR SEMANTIC MAP ===');
// .color-info theo colors.scss = var(--primary) → cùng giá trị với .color-primary
const colorVars = await page.evaluate(() => {
	const out = {};
	for (const g of document.querySelectorAll('[data-test="rg-colors"] .radiogroup-root')) {
		const cls = [...g.classList].find((c) => c.startsWith('color-'));
		const s = getComputedStyle(g);
		out[cls] = {
			colorVar: s.getPropertyValue('--color').trim(),
			checkedVar: s.getPropertyValue('--radio-checked-color').trim()
		};
	}
	return out;
});
// default: --color = var(--default) (border unchecked); checked-color = var(--primary...)
// Custom property đã resolve qua getComputedStyle → so SỐ trị giữa các token
// (default.colorVar == giá trị var(--default); checkedVar == var(--primary)).
const rootVars = await page.evaluate(() => {
	const s = getComputedStyle(document.documentElement);
	return {
		def: s.getPropertyValue('--default').trim(),
		pri: s.getPropertyValue('--primary').trim(),
		sec: s.getPropertyValue('--secondary').trim(),
		suc: s.getPropertyValue('--success').trim(),
		war: s.getPropertyValue('--warning').trim(),
		dan: s.getPropertyValue('--danger').trim()
	};
});
ok(
	'RA2: color-default: --color=--default token, checked-color=--primary',
	colorVars['color-default']?.colorVar === rootVars.def &&
		colorVars['color-default']?.checkedVar === rootVars.pri,
	JSON.stringify({ got: colorVars['color-default'], def: rootVars.def, pri: rootVars.pri })
);
// primary + info: cùng token (colors.scss map info → primary)
ok(
	'RA2: primary + info cùng --color (map info→primary theo colors.scss)',
	colorVars['color-primary']?.colorVar === colorVars['color-info']?.colorVar,
	`${colorVars['color-primary']?.colorVar} vs ${colorVars['color-info']?.colorVar}`
);
// secondary/success/warning/error: đúng token tương ứng (so giá trị root token)
ok(
	'RA2: 4 màu còn lại đúng token (secondary/success/warning/error)',
	colorVars['color-secondary']?.colorVar === rootVars.sec &&
		colorVars['color-success']?.colorVar === rootVars.suc &&
		colorVars['color-warning']?.colorVar === rootVars.war &&
		colorVars['color-error']?.colorVar === rootVars.dan,
	JSON.stringify({
		sec: [colorVars['color-secondary']?.colorVar, rootVars.sec],
		suc: [colorVars['color-success']?.colorVar, rootVars.suc],
		war: [colorVars['color-warning']?.colorVar, rootVars.war],
		dan: [colorVars['color-error']?.colorVar, rootVars.dan]
	})
);
// Mọi color có checked-color KHÔNG rỗng (không còn "mù")
ok(
	'RA2: mọi color-* có --radio-checked-color (không mù)',
	COLORS.every((c) => (colorVars[`color-${c}`]?.checkedVar ?? '').length > 0),
	JSON.stringify(Object.fromEntries(COLORS.map((c) => [c, colorVars[`color-${c}`]?.checkedVar])))
);

// ── RA3: checked circle + label theo --radio-checked-color (KHÔNG hardcode indigo) ──
console.log('\n=== RA3: CHECKED-STATE THEO MÀU SEMANTIC ===');
// checked sẵn item 'on' (page init) → đọc borderColor circle + color label của MỖI color group
const checkedStates = await page.evaluate(() => {
	const out = {};
	for (const g of document.querySelectorAll('[data-test="rg-colors"] .radiogroup-root')) {
		const cls = [...g.classList].find((c) => c.startsWith('color-'));
		const checked = g.querySelector('input:checked');
		if (!checked) continue;
		const circle = checked.closest('.radio-item').querySelector('.radio-circle');
		const label = checked.closest('.radio-item').querySelector('.radio-label');
		out[cls] = {
			circleBorder: getComputedStyle(circle).borderColor,
			circleBg: getComputedStyle(circle).backgroundColor,
			labelColor: getComputedStyle(label).color
		};
	}
	return out;
});
const colorOf = (c) => {
	// parse rgb string → "r,g,b" để so sánh nhóm
	const m = (c ?? '').match(/rgba?\(([^)]+)\)/);
	return m ? m[1].split(',').slice(0, 3).map((x) => parseFloat(x)).join(',') : c;
};
// default checked = primary (indigo fallback); error checked = danger đỏ; success = xanh lá...
ok(
	'RA3: circle checked KHÔNG còn indigo cứng khi set màu khác — 7 group cho ≥3 màu khác nhau',
	new Set(Object.values(checkedStates).map((s) => colorOf(s.circleBg))).size >= 3,
	JSON.stringify(Object.fromEntries(Object.entries(checkedStates).map(([k, v]) => [k, colorOf(v.circleBg)])))
);
const circleMatchLabel = Object.entries(checkedStates).every(
	([, s]) => colorOf(s.circleBg) === colorOf(s.labelColor)
);
ok('RA3: label selected + circle fill CÙNG màu (đồng bộ --radio-checked-color)', circleMatchLabel);

// ── RA4: validation sinh error/success như cũ (regression) ──
console.log('\n=== RA4: VALIDATION ERROR/SUCCESS (regression) ===');
// rg-required: ban đầu chưa chọn → sau khi "đổi" (click rồi đổi) mới validate; đơn giản:
// click Free (đổi giá trị) → success; thông báo valid hiện sau debounce
await page.locator('[data-test="rg-required"] .radio-item', { hasText: 'Free' }).click();
await page.waitForTimeout(700);
const msgRequired = await page
	.locator('[data-test="rg-required"] .fieldMessages-root')
	.textContent()
	.catch(() => '');
ok(
	'RA4: required chọn xong → message valid (showValid) sau debounce',
	/valid|hợp lệ/i.test(msgRequired ?? ''),
	msgRequired?.trim()
);
// root required đổi class color-success (validation sinh)
const requiredCls = await page
	.locator('[data-test="rg-required"] .radiogroup-root')
	.getAttribute('class');
ok(
	'RA4: required đã chọn hợp lệ → root thêm class color-success',
	/color-success/.test(requiredCls ?? ''),
	requiredCls
);

// ── RA5: hover background token --default-100 (theme-aware) ──
console.log('\n=== RA5: HOVER TOKEN (theme-aware) ===');
// Quy tắc hover nằm trong @media (hover: hover) lồng trong scoped sheet → duyệt
// đệ quy mọi CSSRule (CSSMediaRule.cssRules). Svelte scoped chèn hash class
// TRƯỚC pseudo (.radio-item.s-hash:hover:not(.s-hash.disabled-item)) → needle
// là ".radio-item" CÙNG ":hover" trong selectorText, không chuỗi liền kề.
const findRule = (needleParts) => {
	return page.evaluate((parts) => {
		const found = [];
		const walk = (rules) => {
			for (const rule of rules) {
				if (rule.cssRules) walk(rule.cssRules);
				const sel = rule.selectorText ?? '';
				if (parts.every((p) => sel.includes(p))) {
					const bg =
						rule.style?.backgroundColor || rule.style?.getPropertyValue('background-color') || '';
					if (bg) found.push({ sel, bg });
				}
			}
		};
		for (const sheet of document.styleSheets) {
			try {
				walk(sheet.cssRules);
			} catch {
				/* cross-origin */
			}
		}
		return found;
	}, needleParts);
};
const hoverRules = await findRule(['.radio-item', ':hover']);
const hoverUsesToken = hoverRules.length > 0 && hoverRules.every((r) => /default-100/.test(r.bg));
ok(
	'RA5: rule hover dùng var(--default-100) (token theme-aware, không literal rgba(125,125,125))',
	hoverUsesToken,
	JSON.stringify(hoverRules)
);

// ── RA6: dot màu token --background ──
console.log('\n=== RA6: DOT TOKEN THEO THEME ===');
const dotRules = await findRule(['.radio-circle', '::after']);
const dotUsesToken = dotRules.length > 0 && dotRules.some((r) => /var\(--background/.test(r.bg));
ok('RA6: dot dùng var(--background) (token, không #fff cứng)', dotUsesToken, JSON.stringify(dotRules));

// ── RA7: variants (orientation / disabled / keyboard) ──
console.log('\n=== RA7: VARIANTS (orientation/disabled/keyboard) ===');
const horizontalFlex = await page
	.locator('[data-test="rg-horizontal"] .radiogroup-root')
	.evaluate((el) => getComputedStyle(el).flexDirection);
ok('RA7: orientation=horizontal → flex-direction: row', horizontalFlex === 'row', horizontalFlex);
const disabledCount = await page
	.locator('[data-test="rg-disabled"] input[type="radio"]:disabled')
	.count();
ok('RA7: item disabled → input disabled attr', disabledCount === 1, String(disabledCount));
// keyboard: focus group keyboard + ArrowDown chọn/focus kế
await page.locator('[data-test="rg-keyboard"] input[type="radio"]').first().focus();
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(80);
const act = await page.evaluate(() => {
	const a = document.activeElement;
	return a instanceof HTMLInputElement && a.type === 'radio' ? a.value : null;
});
ok('RA7: ArrowDown roving focus vẫn hoạt động', act === 'k2', String(act));

// ── Screenshots cho ui-checker (TỪNG ảnh, không gộp) ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/radiogroup';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="rg-sizes"]').screenshot({ path: `${shotDir}/audit-01-sizes.png` });
await page.locator('[data-test="rg-colors"]').screenshot({ path: `${shotDir}/audit-02-colors.png` });
await page.locator('[data-test="rg-required"]').screenshot({ path: `${shotDir}/audit-03-required.png` });
await page.locator('[data-test="rg-disabled"]').screenshot({ path: `${shotDir}/audit-04-disabled.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
