// tests/theme-sidebar-probe.mjs
// Probe Playwright kiểm tra:
// A1. ThemeToggle hover light mode (data-theme='light' + colorScheme:'dark') → text SÁNG (contrast)
// A2. ThemeToggle hover dark mode → OK
// A3. ThemeToggle duration: set 600ms → --theme-transition-duration = 600ms trên documentElement
// B1. Sidebar collapsed → rail width = 56px
// B2. Menu button width = 56px (fill full, KHÔNG 48px), lề trái/phải ≈ 0
// B3. Brand-row trên trigger-row (rect.top brand < rect.top trigger)
// B4. Logo icon hiện khi collapsed (hideLogo=false mặc định demo)
// B5. Peek hover → name hiện lại
import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = 'https://localhost:3000';
const OUT_DIR = 'tests/screenshots/theme-sidebar';

async function main() {
	// Timeout tổng 120s — treo (waitForFunction không thoát) → thoát với FAIL
	const overallTimer = setTimeout(() => {
		console.error('PROBE TIMEOUT (120s) — thoát bắt buộc');
		process.exit(1);
	}, 120000);

	fs.mkdirSync(OUT_DIR, { recursive: true });
	const browser = await chromium.launch({
		headless: true,
		args: ['--ignore-certificate-errors']
	});
	const context = await browser.newContext({
		viewport: { width: 1280, height: 900 },
		colorScheme: 'dark' // A: test light mode + OS dark
	});
	const page = await context.newPage();

	let passed = 0;
	let failed = 0;

	function check(name, cond, details = '') {
		if (cond) {
			console.log(`✅ PASS: ${name}`);
			passed++;
		} else {
			console.log(`❌ FAIL: ${name} ${details}`);
			failed++;
		}
	}

	// ── A: Theme page ──
	console.log('\n=== A: Theme page ===');
	await page.goto(`${BASE_URL}/ui/theme`, { waitUntil: 'networkidle', timeout: 30000 });

	// Force light theme trên app (data-theme='light') mà OS=dark (context colorScheme)
	await page.evaluate(() => {
		document.documentElement.setAttribute('data-theme', 'light');
	});

	// A1: Hover ThemeToggle (GHOST component — [data-test="theme-toggle"]) —
	// light theme + OS dark → background ĐEN, text PHẢI SÁNG
	const ghostBtn = page.locator('[data-test="theme-toggle"] button');
	await ghostBtn.waitFor({ state: 'visible', timeout: 10000 });

	// Get computed style trước hover
	const beforeHover = await page.evaluate(() => {
		const btn = document.querySelector('[data-test="theme-toggle"] button');
		if (!btn) return null;
		const cs = getComputedStyle(btn);
		return {
			background: cs.backgroundColor,
			color: cs.color
		};
	});
	console.log('beforeHover', beforeHover);

	// Hover + đợi transition (200ms) hoàn tất để computed style ổn định
	await ghostBtn.hover();
	await page.waitForTimeout(300);

	// Get computed style khi hover
	const onHover = await page.evaluate(() => {
		const btn = document.querySelector('[data-test="theme-toggle"] button');
		if (!btn) return null;
		const cs = getComputedStyle(btn);
		return {
			background: cs.backgroundColor,
			color: cs.color
		};
	});
	console.log('onHover', onHover);

	// Parse rgb/rgba (alpha tách riêng — luma tính trên rgb channels)
	function parseRgb(str) {
		const m = (str || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
		if (!m) return null;
		return {
			r: +m[1],
			g: +m[2],
			b: +m[3],
			a: m[4] == null ? 1 : +m[4]
		};
	}
	function luma(c) {
		return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
	}

	// Kiểm tra contrast: NỀN vs TEXT phải trái dấu luma (nền tối → text sáng,
	// nền sáng → text tối). Fix A1: data-theme='light' thắng media OS dark →
	// hover nền gray-200 (SÁNG) + text gray-700 (TỐI) = combo hợp lệ (trước fix
	// nền gray-950 ĐEN từ media OS + text --foreground light TỐI → cùng tối = mất).
	if (onHover) {
		const bg = parseRgb(onHover.background);
		const clr = parseRgb(onHover.color);
		if (bg && clr) {
			const bgL = luma(bg);
			const clrL = luma(clr);
			const bgAlpha = bg.a ?? 1;
			// Nền trong suốt (transparent) → skip (không判定 được), coi như fail
			const contrastOk =
				bgAlpha > 0.01 && Math.abs(bgL - clrL) > 60; // chênh luma đủ lớn = đọc được
			check('A1: Light theme + OS dark hover → contrast OK', contrastOk,
				`bgLuma=${bgL.toFixed(1)} clrLuma=${clrL.toFixed(1)} (nền sáng + text tối = hợp lệ)`);
		} else {
			check('A1: Light theme + OS dark hover → contrast OK', false, `cannot parse colors bg=${onHover.background} clr=${onHover.color}`);
		}
	}

	// Screenshot A1
	await page.screenshot({ path: path.join(OUT_DIR, 'a1-theme-toggle-light-hover.png') });

	// A2: Dark theme hover OK
	await page.evaluate(() => {
		document.documentElement.setAttribute('data-theme', 'dark');
	});
	await page.waitForTimeout(200);
	await ghostBtn.hover();
	await page.waitForTimeout(300);
	const onHoverDark = await page.evaluate(() => {
		const btn = document.querySelector('[data-test="theme-toggle"] button');
		if (!btn) return null;
		const cs = getComputedStyle(btn);
		return { background: cs.backgroundColor, color: cs.color };
	});
	console.log('onHoverDark', onHoverDark);
	// Kiểm tra contrast tương tự A1: nền dark (rgb 3,7,18) → text sáng là combo
	// đúng; chênh luma > 60 = đọc được.
	if (onHoverDark) {
		const bg = parseRgb(onHoverDark.background);
		const clr = parseRgb(onHoverDark.color);
		if (bg && clr) {
			const bgL = luma(bg);
			const clrL = luma(clr);
			const bgAlpha = bg.a ?? 1;
			const contrastOk =
				bgAlpha > 0.01 && Math.abs(bgL - clrL) > 60;
			check('A2: Dark theme hover → contrast OK', contrastOk,
				`bgLuma=${bgL.toFixed(1)} clrLuma=${clrL.toFixed(1)}`);
		} else {
			check('A2: Dark theme hover → contrast OK', false, `cannot parse ${onHoverDark.background} ${onHoverDark.color}`);
		}
	}

	await page.screenshot({ path: path.join(OUT_DIR, 'a2-theme-toggle-dark-hover.png') });

	// A3: Duration 600ms → --theme-transition-duration = 600ms. KHÔNG click
	// theme toggle trước (View Transition block <body> pointer events → click
	// duration bị intercept + treo). Click nút "Đổi theme (nút text)" (outline
	// — KHÔNG qua View Transition block) → var set + đọc ngay.
	//
	// BẪY (đã biết — Wave10 I0): section demo mới → page có thể cache/redirect
	// auth guard khi data-theme đổi giữa chừng → kiểm URL + reload nếu cần.
	await page.evaluate(() => {
		document.documentElement.setAttribute('data-theme', 'light');
	});
	await page.waitForTimeout(300);
	console.log('URL trước A3:', page.url());
	await page.reload({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
	await page.waitForTimeout(300);

	const dur600Btn = page.locator('[data-test="th-duration-600"]');
	const durCount = await dur600Btn.count();
	console.log('dur600 count:', durCount);
	if (durCount === 0) {
		check('A3: Duration 600ms → var = 600ms khi toggle', false, 'nút th-duration-600 không tồn tại trên DOM');
	} else {
		await dur600Btn.waitFor({ state: 'visible', timeout: 10000 });
		await dur600Btn.click();
		await page.waitForTimeout(150);
		const durBefore = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--theme-transition-duration').trim();
		});
		console.log('--theme-transition-duration (sau click duration):', durBefore);

		// Click nút text "Đổi theme" → animateThemeTransition chạy + var set trong
		// lúc transition → đọc NGAY sau click (trong 600ms window)
		const textBtn = page.locator('[data-test="theme-toggle-btn"] button');
		await textBtn.click();
		const durVar = await page.evaluate(() => {
			return getComputedStyle(document.documentElement).getPropertyValue('--theme-transition-duration').trim();
		});
		console.log('--theme-transition-duration (trong transition):', durVar);
		check('A3: Duration 600ms → var = 600ms khi toggle', durVar === '600ms', `got: "${durVar}"`);

		// Đợi transition xong + capture screenshot
		await page.waitForTimeout(900);
	}
	await page.screenshot({ path: path.join(OUT_DIR, 'a3-theme-transition-600ms.png') });

	// ── B: Sidebar page ──
	console.log('\n=== B: Sidebar page ===');
	await page.goto(`${BASE_URL}/ui/sidebar`, { waitUntil: 'networkidle', timeout: 30000 });

	// Trigger collapse (Sidebar.Trigger trong trigger-row)
	const triggerBtn = page.locator('[data-test="sb-trigger-row"] button.sidebar-trigger');
	await triggerBtn.waitFor({ state: 'visible', timeout: 10000 });
	await triggerBtn.click();
	// BẪY: click để chuột đứng TRÊN aside (trigger nằm trong aside) → peek
	// `:hover` active giữ --sb-width = 240px (rule peek đứng SAU trong file,
	// specificity ngang → thắng rule collapsed) → collapse không bao giờ hoàn
	// tất → B1/B2 đo nhầm 240px. Move chuột RA KHỎI aside (over inset content)
	// ngay sau click → peek tắt → rail thu về 56px.
	await page.mouse.move(900, 450);
	// Đợi collapse hoàn tất (transition width 300ms + buffer) — aside 240→56
	await page.waitForFunction(
		() => {
			const el = document.querySelector('.sidebar-aside');
			return el && el.getBoundingClientRect().width < 100;
		},
		{ timeout: 5000 }
	).catch(() => {});
	await page.waitForTimeout(300);

	// B1: Rail width = 56px
	const aside = page.locator('.sidebar-aside');
	const asideRect = await aside.evaluate(el => el.getBoundingClientRect());
	console.log('aside rect', asideRect);
	check('B1: Collapsed rail width = 56px', Math.abs(asideRect.width - 56) < 2, `got ${asideRect.width}px`);

	// B2: Menu button width = 56px, lề ≈ 0
	const menuBtn = page.locator('.sidebar-menu-button').first();
	const btnRect = await menuBtn.evaluate(el => el.getBoundingClientRect());
	const leftGap = btnRect.left - asideRect.left;
	const rightGap = asideRect.right - btnRect.right;
	console.log('menuBtn rect', btnRect, 'leftGap', leftGap, 'rightGap', rightGap);
	check('B2: Menu button width = 56px (fill full)', Math.abs(btnRect.width - 56) < 2, `got ${btnRect.width}px`);
	check('B2b: Menu button margin ≈ 0', leftGap < 2 && rightGap < 2, `leftGap=${leftGap} rightGap=${rightGap}`);

	// B3: Brand-row trên trigger-row
	const brandRow = page.locator('[data-test="sb-brand-row"]');
	const triggerRow = page.locator('[data-test="sb-trigger-row"]');
	const brandRect = await brandRow.evaluate(el => el.getBoundingClientRect());
	const triggerRect = await triggerRow.evaluate(el => el.getBoundingClientRect());
	console.log('brandRow rect', brandRect, 'triggerRect', triggerRect);
	check('B3: Brand-row above trigger-row', brandRect.top < triggerRect.top, `brandTop=${brandRect.top} triggerTop=${triggerRect.top}`);

	// B4: Logo icon hiện khi collapsed (hideLogo=false)
	const brandIcon = page.locator('[data-test="sb-brand"] .brand-icon');
	const iconVisible = await brandIcon.isVisible();
	check('B4: Logo icon visible when collapsed (hideLogo=false)', iconVisible);

	// Screenshot collapsed TRƯỚC khi hover (chuột phải ở ngoài aside — nếu hover
	// trước, peek active → rail 240px, ảnh sai)
	await page.screenshot({ path: path.join(OUT_DIR, 'b-sidebar-collapsed.png') });

	// B5: Peek hover → name hiện lại
	await page.locator('.sidebar-aside').hover();
	await page.waitForTimeout(300);
	const brandName = page.locator('[data-test="sb-brand"] .brand-name');
	const nameVisible = await brandName.isVisible();
	check('B5: Peek hover → brand name visible', nameVisible);

	// Peek hover screenshot (rail mở rộng tạm 240px + name hiện)
	await page.screenshot({ path: path.join(OUT_DIR, 'b-sidebar-peek-hover.png') });

	await browser.close();
	clearTimeout(overallTimer);

	console.log(`\n=== SUMMARY: ${passed} PASS, ${failed} FAIL ===`);
	if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
	console.error('Probe error:', err);
	process.exitCode = 1;
});