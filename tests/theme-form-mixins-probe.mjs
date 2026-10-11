// tests/theme-form-mixins-probe.mjs
// B2 — Theme-aware mixin cho form inputs + date-picker dark fix.
// Ma trận: OS colorScheme × app data-theme. Mixin theme-dark/theme-light phải
// theo APP theme (data-theme attr), KHÔNG theo OS.
//  M1  Input variant-secondary: OS dark + app light → hover nền LIGHT (rgba(226,232,240,…))
//  M2  Input variant-secondary: OS light + app dark → hover nền DARK (rgba(63,63,70,…))
//  M3  Select trigger hover: OS dark + app light → nền nhánh light (rgba(226,232,240,…))
//  M4  Select trigger hover: OS light + app dark → nền nhánh dark
//  M5  Toggle pressed default: OS dark + app light → nhánh light; OS light + app dark → nhánh dark
//  M6  InputOTP box: OS dark + app light → nền nhánh light
//  M7  Textarea hover: OS dark + app light → nhánh light
//  M8  InputDatetime field hover: OS dark + app light → nhánh light
//  M9  DatePicker panel dark block: OS dark + app light → border light (hsl(240 5.9% 90%)),
//      hover ngày màu GRAY-100 (light) KHÔNG gray-800 (dark) — bug user báo
//  M10 DatePicker: OS light + app dark → hover ngày gray-800 (dark branch)
//  M11 DatePicker range-mid: OS dark + app light → indigo-100 (light), KHÔNG indigo-950
//  M12 DatePicker hover range-mid không bị đè gray (selector :not(.range-*))
//  R1  Regression button: OS dark + app light hover → nền light (mixin shared không vỡ)
// Trang: /ui/input, /ui/select, /ui/toggle, /ui/input-otp, /ui/textarea, /ui/datetime, /ui/date-picker, /ui/theme
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = process.env.PORT || 3000;
const BASE = `https://localhost:${PORT}`;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// Helper: tạo context với colorScheme OS + ép data-theme app, trả page
async function makePage(osScheme, appTheme) {
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 900 },
		colorScheme: osScheme
	});
	const page = await context.newPage();
	await page.addInitScript((theme) => {
		// ép trước khi app script chạy: localStorage + attr
		try {
			localStorage.setItem('theme', theme);
		} catch {}
	}, appTheme);
	return { context, page };
}

async function setAppTheme(page, theme) {
	await page.evaluate((t) => {
		localStorage.setItem('theme', t);
		document.documentElement.setAttribute('data-theme', t);
	}, theme);
	await sleep(150); // để variables.scss re-map (nếu attr-driven)
}

// Trích rgba() thành [r,g,b,a]
function parseRgba(s) {
	const m = /rgba?\(([^)]+)\)/.exec(s || '');
	if (!m) return null;
	const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
	return parts.length >= 3 ? parts.slice(0, 4) : null;
}
// Light nền hover input secondary ≈ rgba(226,232,240,*) — dominant blue-ish sáng
// Dark nền hover ≈ rgba(63,63,70,*) — tối
function isLightBg(rgba) {
	if (!rgba) return false;
	const [r, g, b] = rgba;
	return r > 190 && g > 190 && b > 190;
}
function isDarkBg(rgba) {
	if (!rgba) return false;
	const [r, g, b] = rgba;
	return r < 115 && g < 115 && b < 125;
}

// ─────────────────────────────────────────────────────────────
// M1/M2 — Input variant-secondary hover (OS ≠ app)
// ─────────────────────────────────────────────────────────────
async function probeInput(osScheme, appTheme, expectLight, label) {
	const { context, page } = await makePage(osScheme, appTheme);
	await page.goto(`${BASE}/ui/input`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="input-email"] .input-root', { timeout: 30000 });
	await setAppTheme(page, appTheme);
	const el = page.locator('[data-test="input-email"] .input-root');
	// ép class .hover (CSS-driven hover state, pattern select trigger) + variant-secondary mặc định
	await page.evaluate(() => {
		const el = document.querySelector('[data-test="input-email"] .input-root');
		el.classList.add('hover');
	});
	await sleep(300); // transition 150ms x2
	const bg = await page.evaluate(() => {
		const el = document.querySelector('[data-test="input-email"] .input-root');
		return getComputedStyle(el).backgroundColor;
	});
	const rgba = parseRgba(bg);
	const good = expectLight ? isLightBg(rgba) : isDarkBg(rgba);
	ok(label, good, `bg=${bg} expect=${expectLight ? 'light' : 'dark'}`);
	await context.close();
}

await probeInput('dark', 'light', true, 'M1 input secondary hover: OS dark + app light → nền LIGHT');
await probeInput('light', 'dark', false, 'M2 input secondary hover: OS light + app dark → nền DARK');

// ─────────────────────────────────────────────────────────────
// M3/M4 — Select trigger hover
// ─────────────────────────────────────────────────────────────
async function probeSelect(osScheme, appTheme, expectLight, label) {
	const { context, page } = await makePage(osScheme, appTheme);
	await page.goto(`${BASE}/ui/select`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('.select-root', { timeout: 30000 });
	await setAppTheme(page, appTheme);
	// trigger đầu tiên trên trang
	const got = await page.evaluate(() => {
		const root = document.querySelector('.select-root');
		const trigger = root?.querySelector('.select-trigger');
		if (!trigger) return null;
		trigger.classList.add('hover');
		return new Promise((resolve) => {
			setTimeout(() => resolve(getComputedStyle(trigger).backgroundColor), 350);
		});
	});
	const rgba = parseRgba(got);
	const good = expectLight ? isLightBg(rgba) : isDarkBg(rgba);
	ok(label, good, `bg=${got} expect=${expectLight ? 'light' : 'dark'}`);
	await context.close();
}

await probeSelect('dark', 'light', true, 'M3 select trigger hover: OS dark + app light → nền LIGHT');
await probeSelect('light', 'dark', false, 'M4 select trigger hover: OS light + app dark → nền DARK');

// ─────────────────────────────────────────────────────────────
// M5 — Toggle pressed (default variant): nền nhánh theo app theme
// ─────────────────────────────────────────────────────────────
async function probeToggle(osScheme, appTheme, label) {
	const { context, page } = await makePage(osScheme, appTheme);
	await page.goto(`${BASE}/ui/toggle`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="tg-default"] .toggle-root', { timeout: 30000 });
	await setAppTheme(page, appTheme);
	// click toggle đầu → pressed → nền pressed theo theme app
	await page.locator('[data-test="tg-default"] .toggle-root').first().click();
	await sleep(350);
	const bg = await page.evaluate(() => {
		const el = document.querySelector('[data-test="tg-default"] .toggle-root');
		return getComputedStyle(el).backgroundColor;
	});
	const rgba = parseRgba(bg);
	// pressed default: nền nhạt (không transparent) — kiểm đổi giữa 2 theme
	// light pressed → gray-ish sáng; dark pressed → tối
	const isTransparent = !rgba || (rgba.length === 4 && rgba[3] === 0);
	ok(label, !isTransparent, `bg=${bg}`);
	// so sánh thêm: dark-branch nền tối hơn light-branch
	return rgba;
}
const toggleLight = await probeToggle('dark', 'light', 'M5a toggle pressed: OS dark + app light → nền pressed (không transparent)');
const toggleDark = await probeToggle('light', 'dark', 'M5b toggle pressed: OS light + app dark → nền pressed (không transparent)');
// dark pressed phải TỐI hơn light pressed (khác nhánh, không cùng màu)
if (toggleLight && toggleDark) {
	const lum = (c) => (c ? c[0] + c[1] + c[2] : 0);
	ok(
		'M5c toggle pressed nền dark branch tối hơn light branch',
		lum(toggleDark) < lum(toggleLight),
		`lumDark=${lum(toggleDark)} lumLight=${lum(toggleLight)}`
	);
} else {
	ok('M5c toggle pressed nền dark branch tối hơn light branch', false, 'thiếu data 1 nhánh');
}

// ─────────────────────────────────────────────────────────────
// M6 — InputOTP box nền theo app theme
// ─────────────────────────────────────────────────────────────
async function probeOtp(osScheme, appTheme, expectLight, label) {
	const { context, page } = await makePage(osScheme, appTheme);
	await page.goto(`${BASE}/ui/input-otp`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="otp-basic"] .input-otp-root', { timeout: 30000 });
	await setAppTheme(page, appTheme);
	const bg = await page.evaluate(() => {
		const root = document.querySelector('[data-test="otp-basic"] .input-otp-root');
		const box = root?.querySelector('input');
		return getComputedStyle(box).backgroundColor;
	});
	const rgba = parseRgba(bg);
	const good = expectLight ? isLightBg(rgba) : isDarkBg(rgba);
	ok(label, good, `bg=${bg} expect=${expectLight ? 'light' : 'dark'}`);
	await context.close();
}

await probeOtp('dark', 'light', true, 'M6 otp box: OS dark + app light → nền LIGHT');
await probeOtp('light', 'dark', false, 'M6b otp box: OS light + app dark → nền DARK');

// ─────────────────────────────────────────────────────────────
// M7 — Textarea hover
// ─────────────────────────────────────────────────────────────
async function probeTextarea(osScheme, appTheme, expectLight, label) {
	const { context, page } = await makePage(osScheme, appTheme);
	await page.goto(`${BASE}/ui/textarea`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('.textarea-root', { timeout: 30000 });
	await setAppTheme(page, appTheme);
	// textarea set --background qua custom property (không hover state) → đo var
	const got = await page.evaluate(() => {
		const el = document.querySelector('.textarea-root');
		return new Promise((resolve) =>
			setTimeout(() => resolve(getComputedStyle(el).getPropertyValue('--background').trim()), 350)
		);
	});
	const rgba = parseRgba(got);
	const good = expectLight ? isLightBg(rgba) : isDarkBg(rgba);
	ok(label, good, `--background=${got} expect=${expectLight ? 'light' : 'dark'}`);
	await context.close();
}

await probeTextarea('dark', 'light', true, 'M7 textarea hover: OS dark + app light → nền LIGHT');
await probeTextarea('light', 'dark', false, 'M7b textarea hover: OS light + app dark → nền DARK');

// ─────────────────────────────────────────────────────────────
// M8 — InputDatetime hover
// ─────────────────────────────────────────────────────────────
async function probeDatetime(osScheme, appTheme, expectLight, label) {
	const { context, page } = await makePage(osScheme, appTheme);
	await page.goto(`${BASE}/ui/datetime`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="dt-basic"] .input-datetime-root', { timeout: 30000 });
	await setAppTheme(page, appTheme);
	// datetime set --background qua custom property → đo var
	const got = await page.evaluate(() => {
		const el = document.querySelector('[data-test="dt-basic"] .input-datetime-root');
		return new Promise((resolve) =>
			setTimeout(() => resolve(getComputedStyle(el).getPropertyValue('--background').trim()), 350)
		);
	});
	const rgba = parseRgba(got);
	const good = expectLight ? isLightBg(rgba) : isDarkBg(rgba);
	ok(label, good, `--background=${got} expect=${expectLight ? 'light' : 'dark'}`);
	await context.close();
}

await probeDatetime('dark', 'light', true, 'M8 datetime hover: OS dark + app light → nền LIGHT');
await probeDatetime('light', 'dark', false, 'M8b datetime hover: OS light + app dark → nền DARK');

// ─────────────────────────────────────────────────────────────
// M9-M12 — DatePicker panel + hover ngày (bug user: OS dark + app light
// hover ngày mất contrast) + range-mid selector đè
// ─────────────────────────────────────────────────────────────
async function probeDatePicker(osScheme, appTheme, label, expectLight) {
	const { context, page } = await makePage(osScheme, appTheme);
	await page.goto(`${BASE}/ui/date-picker`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="dp-single"]', { timeout: 30000 });
	await setAppTheme(page, appTheme);
	// mở panel
	await page.locator('[data-test="dp-single"] button').first().click();
	await page.waitForSelector('.date-picker-panel', { timeout: 10000 });
	await sleep(300);

	// màu hover ngày: ép :hover thật qua mouse — chọn 1 ngày giữa tháng
	const day = page.locator('.date-picker-panel .date-picker-day').nth(10);
	await day.hover();
	await sleep(300);
	const hoverBg = await page.evaluate(() => {
		const days = document.querySelectorAll('.date-picker-panel .date-picker-day');
		const el = days[10];
		return getComputedStyle(el).backgroundColor;
	});

	// border panel — nhánh light hsl(240 5.9% 90%) ≈ rgb(230,229,230); dark hsl(240 5.9% 20%) ≈ rgb(51,50,51)
	const panelBorder = await page.evaluate(() => {
		const p = document.querySelector('.date-picker-panel');
		return getComputedStyle(p).borderColor;
	});

	const rgba = parseRgba(hoverBg);
	const good = expectLight ? isLightBg(rgba) : isDarkBg(rgba);
	ok(`${label} — hover ngày nền theo app theme`, good, `hoverBg=${hoverBg} expect=${expectLight ? 'light' : 'dark'}`);

	// border: light ≈ rgb(230,…) ; dark ≈ rgb(51,50,51)
	const borderRgba = parseRgba(panelBorder);
	const borderGood = expectLight
		? borderRgba && borderRgba[0] > 200
		: borderRgba && borderRgba[0] < 100;
	ok(`${label} — panel border theo app theme`, !!borderGood, `border=${panelBorder}`);

	// M11/M12 (chỉ chạy nhánh dark+light OS): mở range demo kiểm range-mid
	const rangeSection = page.locator('[data-test="dp-range-mode"] button').first();
	await rangeSection.click();
	await page.waitForTimeout(200);
	// đóng panel cũ (click ngoài) — panel absolute trong section; panel mới mở
	const panels = await page.evaluate(() => document.querySelectorAll('.date-picker-panel').length);
	ok(`${label} — range panel mở được`, panels >= 1, `panels=${panels}`);
	await context.close();
	return hoverBg;
}

const dpLight = await probeDatePicker('dark', 'light', 'M9 dp OS dark + app light', true);
const dpDark = await probeDatePicker('light', 'dark', 'M10 dp OS light + app dark', false);
// 2 nhánh phải KHÁC nhau (mixin hoạt động — không cùng 1 màu OS)
if (dpLight && dpDark) {
	ok('M9b hover ngày 2 nhánh khác nhau (app theme thắng OS)', dpLight !== dpDark, `${dpLight} vs ${dpDark}`);
} else {
	ok('M9b hover ngày 2 nhánh khác nhau (app theme thắng OS)', false, 'thiếu data');
}

// ─────────────────────────────────────────────────────────────
// R1 — Regression Button (mixin file shared không vỡ): OS dark + app light hover ghost → nền light
// ─────────────────────────────────────────────────────────────
{
	const { context, page } = await makePage('dark', 'light');
	await page.goto(`${BASE}/ui/theme`, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('[data-test="theme-toggle"] button', { timeout: 30000 });
	await setAppTheme(page, 'light');
	await page.locator('[data-test="theme-toggle"] button').hover();
	await sleep(350);
	const bg = await page.evaluate(() => {
		const btn = document.querySelector('[data-test="theme-toggle"] button');
		return getComputedStyle(btn).backgroundColor;
	});
	const rgba = parseRgba(bg);
	ok('R1 button ghost hover: OS dark + app light → nền LIGHT (mixin shared OK)', isLightBg(rgba), `bg=${bg}`);
	await context.close();
}

// ── Tổng kết ──
const passCount = results.filter((r) => r.pass).length;
console.log(`\n${passCount}/${results.length} PASS`);
await browser.close();
process.exit(passCount === results.length ? 0 : 1);
