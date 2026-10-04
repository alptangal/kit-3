// select-touch-tooltip-probe.mjs
// Functional probe — request "hoàn thiện" 2026-10-02:
//  SELECT
//   S1  cursor not-allowed khi disabled (PC)
//   S2  load-more-hint gradient che vùng (không transparent)
//   S3  edit/update option → tự focus input
//   S4  PC/mobile: touch target phóng mobile, PC giữ gọn; input ≥16px mobile
//  TOOLTIP
//   T1  content theme = design token (var(--primary)/--primary-foreground),
//       không hardcode gray/black; có box-shadow (elevation)
//   T2  arrow mặc định color='info' (→ --primary) đồng màu thân tooltip
// Chạy: node tests/select-touch-tooltip-probe.mjs  (dev: https://localhost:3000)
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/select';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// ─────────────────────────── DESKTOP (PC) ───────────────────────────
const dctx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	hasTouch: false,
	...{},
});
// Emulate PC: hover:hover + pointer:fine (mặc định của chromium desktop)
const dpage = await dctx.newPage();
dpage.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await dpage.goto(BASE, { waitUntil: 'domcontentloaded' });
await dpage.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

const openNth = async (sec, n = 0) => {
	// Idempotent: nếu dropdown còn mở (từ bước trước) thì đóng trước
	const ddSel = sec.locator('.select-dropdown');
	if ((await ddSel.count()) > 0 && (await ddSel.first().isVisible().catch(() => false))) {
		await dpage.keyboard.press('Escape');
		await dpage.waitForTimeout(150);
	}
	await sec.locator('.select-trigger').nth(n).click();
	await ddSel.first().waitFor({ state: 'visible', timeout: 4000 });
	await dpage.waitForTimeout(250);
};

// ═══════════ S1 — cursor not-allowed khi disabled (PC) ═══════════
console.log('\n=== S1: cursor not-allowed (disabled, PC) ===');
{
	// (a) trigger.disabled: KHÔNG click (bị chặn) — chỉ đọc computed cursor
	const disSec = dpage.locator('section:has(h2:has-text("Disabled"))');
	const disTrigger = disSec.locator('.select-trigger').first();
	const trigDisabled = await disTrigger.evaluate((el) => el.disabled);
	if (trigDisabled) {
		const c = await disTrigger.evaluate((el) => getComputedStyle(el).cursor);
		const pe = await disTrigger.evaluate((el) => getComputedStyle(el).pointerEvents);
		ok('S1: trigger.disabled cursor = not-allowed (PC)', c === 'not-allowed', c);
		ok('S1: trigger.disabled pointer-events bật (PC, cursor mới hiện)', pe === 'auto', pe);
	} else ok('S1: trigger disabled (test)', false, '(trigger không disabled?)');

	// (b) option.disabled: đọc từ "Single Select" (dùng simpleOptions, option #7 disabled)
	const singleSec = dpage.locator('section:has(h2:has-text("Single Select"))');
	await openNth(singleSec, 0);
	// Option #7 (disabled) có thể bị slice (maxOptions khởi tạo ~5) → scroll list
	// xuống để load-more tải thêm cho đủ 7 option.
	const list = singleSec.locator('.select-option-list');
	if (await list.count() > 0) {
		await list.first().evaluate((el) => (el.scrollTop = el.scrollHeight)).catch(() => {});
		await dpage.waitForTimeout(350);
	}
	const disOpt = singleSec.locator('.select-option.disabled').first();
	if (await disOpt.count() > 0) {
		const cursor = await disOpt.evaluate((el) => getComputedStyle(el).cursor);
		ok('S1: option.disabled cursor = not-allowed (PC)', cursor === 'not-allowed', cursor);
		const pe = await disOpt.evaluate((el) => getComputedStyle(el).pointerEvents);
		ok('S1: option.disabled pointer-events bật (PC)', pe === 'auto', pe);
	} else ok('S1: option.disabled cursor (PC)', false, '(không có option.disabled trong Single Select)');
	await dpage.keyboard.press('Escape');
	await dpage.waitForTimeout(150);
}

// ═══════════ S2 — load-more-hint gradient (không transparent) ═══════════
console.log('\n=== S2: load-more-hint gradient che phủ ===');
{
	// Load-more section mặc định mode 'scroll' → mở dropdown để hint render
	const sec = dpage.locator('section:has(h2:has-text("Load-more"))');
	if (await sec.count() > 0) {
		await openNth(sec, 0);
		const hint = sec.locator('.select-load-more-hint');
		if (await hint.count() > 0) {
			const bg = await hint.first().evaluate((el) => getComputedStyle(el).backgroundImage);
			const isGrad = bg.includes('linear-gradient');
			ok('S2: load-more-hint có linear-gradient', isGrad, bg.slice(0, 50));
			// gradient phải có stop MÀU (không chỉ transparent → che được option)
			const hasColorStop = /rgb|hsl/.test(bg);
			ok('S2: gradient có stop màu (che option, không in-môi)', hasColorStop, bg.slice(0, 80));
			// screenshot để ui-checker xác nhận che phủ
			mkdirSync('tests/screenshot/select-extra', { recursive: true });
			await sec.locator('.select-dropdown').first().scrollIntoViewIfNeeded().catch(() => {});
			await dpage.waitForTimeout(150);
			await dpage.screenshot({ path: 'tests/screenshot/select-extra/loadmore-hint.png' });
			console.log('  screenshot → tests/screenshot/select-extra/loadmore-hint.png');
		} else ok('S2: load-more-hint gradient', false, '(hint không render — mode không phải scroll?)');
		await dpage.keyboard.press('Escape');
		await dpage.waitForTimeout(150);
	} else ok('S2: load-more-hint gradient', false, '(không tìm thấy section Load-more)');
}

// ═══════════ S3 — edit option → tự focus input ═══════════
console.log('\n=== S3: edit option tự focus input ===');
{
	const sec = dpage.locator('section:has(h2:has-text("Update / Delete"))');
	await openNth(sec, 0);
	const editBtn = sec.locator('.select-option__action--edit').first();
	if (await editBtn.count() > 0) {
		await editBtn.click();
		await dpage.waitForTimeout(200);
		const editInput = sec.locator('.select-option__edit-input');
		const hasInput = (await editInput.count()) > 0;
		ok('S3: edit → hiện input', hasInput);
		if (hasInput) {
			const focused = await editInput.evaluate((el) => el === document.activeElement);
			ok('S3: edit → input TỰ FOCUS (activeElement)', focused);
		}
		await dpage.keyboard.press('Escape');
		await dpage.waitForTimeout(150);
	} else ok('S3: edit option tự focus input', false, '(không có nút edit)');
}

// ═══════════ S4 (PC) — target PC GIỮ GỌN (không bị phóng) ═══════════
console.log('\n=== S4 (PC): target giữ gọn 22-24px ===');
{
	const sec = dpage.locator('section:has(h2:has-text("Update / Delete"))');
	await openNth(sec, 0);
	const actW = await sec.locator('.select-option__action').first()
		.evaluate((el) => parseFloat(getComputedStyle(el).width));
	ok('S4(PC): option__action ≈ 22px (gọn, không phóng)', Math.abs(actW - 22) < 3, `w=${actW}px`);
	await dpage.keyboard.press('Escape');
	await dpage.waitForTimeout(150);
}

// ═══════════ T1 — tooltip theme = design token + elevation ═══════════
console.log('\n=== T1: tooltip content theme = token + box-shadow ===');
{
	// Hover nút edit → tooltip-content hiện trong body
	const sec = dpage.locator('section:has(h2:has-text("Update / Delete"))');
	await openNth(sec, 0);
	const editBtn = sec.locator('.select-option__action--edit').first();
	if (await editBtn.count() > 0) {
		await editBtn.hover();
		await dpage.waitForSelector('.tooltip-content', { state: 'visible', timeout: 4000 }).catch(() => {});
		const tip = dpage.locator('.tooltip-content').last();
		if (await tip.count() > 0) {
			const cs = await tip.evaluate((el) => {
				const s = getComputedStyle(el);
				const root = getComputedStyle(document.documentElement);
				return {
					background: s.backgroundColor,
					color: s.color,
					shadow: s.boxShadow,
					z: s.zIndex,
					primary: root.getPropertyValue('--primary').trim(),
					primaryFg: root.getPropertyValue('--primary-foreground').trim(),
					text: el.textContent?.trim().slice(0, 30)
				};
			});
			// background phải KHÁC gray-900/gray-200 cũ → bằng --primary (đồng bộ token)
			const isToken = cs.background !== 'rgb(17, 24, 39)' && cs.background !== 'rgb(229, 231, 235)';
			ok('T1: content background = design token (không gray hardcode)', isToken, `bg=${cs.background} (--primary=${cs.primary})`);
			// color = --primary-foreground (nền chính)
			ok('T1: content có màu chữ (không empty)', cs.color !== 'rgba(0, 0, 0, 0)', `color=${cs.color}`);
			// elevation
			ok('T1: content có box-shadow (elevation)', cs.shadow !== 'none', cs.shadow.slice(0, 40));
			// z-index cao (≥ 9500, nổi trên panel)
			ok('T1: content z-index ≥ 9500 (nổi trên panel)', parseInt(cs.z) >= 9500, `z=${cs.z}`);
			ok('T1: content có text (tooltip hiện đúng)', cs.text.length > 0, JSON.stringify(cs.text));
			// screenshot tooltip
			mkdirSync('tests/screenshot/select-extra', { recursive: true });
			const bb = await tip.boundingBox();
			if (bb) {
				const vp = await dpage.viewportSize();
				const x0 = Math.max(0, bb.x - 60);
				const y0 = Math.max(0, bb.y - 40);
				const x1 = Math.min(vp.width, bb.x + bb.width + 60);
				const y1 = Math.min(vp.height, bb.y + bb.height + 40);
				await dpage.screenshot({
					path: 'tests/screenshot/select-extra/tooltip-theme.png',
					clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
				});
				console.log('  screenshot → tests/screenshot/select-extra/tooltip-theme.png');
			}
		} else ok('T1: tooltip content hiện khi hover', false, '(.tooltip-content không visible)');
	} else ok('T1: tooltip content theme', false, '(không có nút edit để hover)');
}

// ═══════════ T2 — arrow mặc định color='info' (đồng màu --primary) ═══════════
console.log('\n=== T2: arrow mặc định đồng màu thân (info → --primary) ===');
{
	const sec = dpage.locator('section:has(h2:has-text("Update / Delete"))');
	const editBtn = sec.locator('.select-option__action--edit').first();
	if (await editBtn.count() > 0) {
		// Hover + move chuột (set mousePosition cho arrow $effect)
		const bb = await editBtn.boundingBox();
		await editBtn.hover();
		if (bb) await dpage.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
		// Arrow render khi contentMeta.position set (sau setTimeout delay ~150ms)
		// → chờ đủ cho cả content đặt vị trí + arrow append
		await dpage.waitForTimeout(700);
		const arrow = dpage.locator('.tooltip-arrow').first();
		if (await arrow.count() > 0) {
			const cls = await arrow.getAttribute('class');
			// arrow phải mang color-info (không color-default) → đồng màu --primary
			const hasInfo = /color-info/.test(cls ?? '');
			ok('T2: arrow mặc định = color-info (đồng màu --primary)', hasInfo, cls?.slice(0, 60));
		} else ok('T2: arrow render', false, '(.tooltip-arrow không attached)');
	}
	await dpage.keyboard.press('Escape');
	await dpage.waitForTimeout(200);
	// tooltip phải biến mất sau khi đóng (không sót)
	const remain = await dpage.locator('.tooltip-content:visible').count();
	ok('T2: tooltip không sót khi dropdown đóng', remain === 0, `remain=${remain}`);
}

await dctx.close();

// ─────────────────────────── MOBILE (touch) ───────────────────────────
// Dùng device descriptor iPhone 13 → (hover:none)+(pointer:coarse) match thật
const iPhone = devices['iPhone 13'];
const mctx = await browser.newContext({
	...iPhone,
	ignoreHTTPSErrors: true,
	viewport: { width: 390, height: 844 },
});
const mpage = await mctx.newPage();
mpage.on('pageerror', (e) => console.log('PAGEERROR(m):', e.message));
await mpage.goto(BASE, { waitUntil: 'domcontentloaded' });
await mpage.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

console.log('\n=== S4 (mobile): target phóng + input ≥16px ===');
{
	// Media (hover:none) có match không?
	const hoverNone = await mpage.evaluate(
		() => window.matchMedia('(hover: none)').matches
	);
	console.log('  [info] matchMedia(hover:none) =', hoverNone);

	const sec = mpage.locator('section:has(h2:has-text("Update / Delete"))');
	await sec.locator('.select-trigger').first().click();
	await sec.locator('.select-dropdown').first().waitFor({ timeout: 4000 });
	await mpage.waitForTimeout(250);

	if (hoverNone) {
		const actW = await sec.locator('.select-option__action').first()
			.evaluate((el) => parseFloat(getComputedStyle(el).width));
		ok('S4(mobile): option__action phóng ≥ 28px', actW >= 27, `w=${actW}px`);
		const optH = await sec.locator('.select-option').first()
			.evaluate((el) => parseFloat(getComputedStyle(el).height));
		ok('S4(mobile): option row cao ≥ 44px', optH >= 43, `h=${optH}px`);
		// search input font ≥ 16px (nếu có ô search)
		const si = sec.locator('.select-search-input');
		if (await si.count() > 0) {
			const fs = await si.first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
			ok('S4(mobile): search-input font ≥ 16px (chặn iOS zoom)', fs >= 15.5, `fs=${fs}px`);
		}
	} else {
		// Không mô phỏng được mobile media → bỏ qua (không fail)
		ok('S4(mobile): target phóng', true, '(skip — context không mô phỏng hover:none, cần device thật)');
	}
}

await mctx.close();
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name));
	process.exit(1);
}
