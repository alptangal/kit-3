// tests/context-menu-probe.mjs
// Verify ContextMenu (element) — right-click trên target → menu fixed tại điểm
// chuột (clamp viewport), roving focus, item select/destroy/destructive.
// Trang demo: /ui/context-menu.
//
// Kiểm tra:
//  CM0 initial: no .context-menu-content in DOM
//  CM1 right-click row 2 → content hiện + label "User 2" + position ≈ điểm chuột (clamp viewport)
//  CM2 role=menu + items role=menuitem
//  CM3 ArrowDown x2 → focus item 3 (skip separator/label)
//  CM4 Home → focus item đầu
//  CM5 click item "Sao chép" (Copy) → demo log update + menu đóng
//  CM6 Escape → đóng
//  CM7 outside left-click → đóng
//  CM8 destructive item có class destructive
//  CM9 disabled item aria-disabled + không focusable
//  CM10 image card right-click → label "product-hero.png"
//  CM11 right-click gần đáy viewport → menu clamp (không cut mép)
//  CM12 separator giữa label và items (role=separator)
//  CM13 icon render trong items (async load Iconify API → cache)
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL' }  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/context-menu', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.context-menu-root', { timeout: 20000 });
await sleep(400);

// CM0 — initial: chưa có menu nào mở
const initialMenus = await page.locator('.context-menu-content').count();
ok('CM0 initial: no .context-menu-content in DOM', initialMenus === 0, `count=${initialMenus}`);

// CM11 (chạy TRƯỚC CM1 để không ảnh hưởng scroll state) — clamp viewport:
// scroll để row 4 nằm gần đáy viewport, right-click → menu phải bị đẩy lên (in viewport).
const row4 = page.locator('[data-test="cm-users"] .row[data-user="4"]');
await row4.evaluate((el) => el.scrollIntoView({ block: 'end' }));
await sleep(200);
const row4Box = await row4.boundingBox();
if (!row4Box) throw new Error('CM11: row 4 không có boundingBox');
const c4x = Math.round(row4Box.x + row4Box.width / 2);
const c4y = Math.min(row4Box.y + row4Box.height / 2, 880); // giữ trong viewport (1280×900)
await page.mouse.click(c4x, c4y, { button: 'right' });
await sleep(250);
const cm11 = await page.evaluate((p) => {
	const menu = document.querySelector('[data-test="cm-users"] [role="menu"]');
	if (!menu) return null;
	const r = menu.getBoundingClientRect();
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	return {
		label: menu.querySelector('[data-cm-label]')?.textContent?.trim(),
		bottom: r.bottom,
		right: r.right,
		top: r.top,
		clamped: r.bottom <= vh + 1 && r.right <= vw + 1 && r.top >= 0
	};
}, { x: c4x, y: c4y });
ok('CM11 right-click gần đáy viewport → menu clamp (không cut mép)', cm11?.clamped === true && cm11.label?.includes('User 4'), JSON.stringify(cm11));
await page.keyboard.press('Escape');
await sleep(200);
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(200);

// ============ CM1 — right-click row 2 → open tại điểm chuột ============
const row2 = page.locator('[data-test="cm-users"] .row[data-user="2"]');
const row2Box = await row2.boundingBox();
if (!row2Box) throw new Error('CM1: row 2 không có boundingBox');
const cx = Math.round(row2Box.x + row2Box.width / 2);
const cy = Math.round(row2Box.y + row2Box.height / 2);
await page.mouse.click(cx, cy, { button: 'right' });
await sleep(250); // chờ mount + focus item đầu

const cm1 = await page.evaluate((p) => {
	const menu = document.querySelector('[data-test="cm-users"] [role="menu"]');
	if (!menu) return { menu: false };
	const label = menu.querySelector('[data-cm-label]')?.textContent?.trim() ?? '';
	const r = menu.getBoundingClientRect();
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	return {
		menu: true,
		label,
		pos: 'fixed',
		left: r.left,
		top: r.top,
		right: r.right,
		bottom: r.bottom,
		inViewport: r.left >= 0 && r.top >= 0 && r.right <= vw + 1 && r.bottom <= vh + 1
	};
}, { x: cx, y: cy });
ok(
	'CM1 right-click row 2 → content hiện + label "User 2" + vị trí ≈ điểm chuột & in viewport',
	cm1.menu && cm1.label.includes('User 2') && cm1.pos === 'fixed' && cm1.inViewport && Math.abs(cm1.left - cx) <= 24 && Math.abs(cm1.top - cy) <= 24,
	JSON.stringify(cm1)
);

// CM2 — role=menu + items role=menuitem
const cm2 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="cm-users"] [role="menu"]');
	if (!scope) return null;
	const items = [...scope.querySelectorAll('[role="menuitem"]')];
	return { role: scope.getAttribute('role'), count: items.length, allMenuitem: items.every((i) => i.getAttribute('role') === 'menuitem') };
});
ok('CM2 role=menu + 3 items role=menuitem', cm2?.role === 'menu' && cm2.count === 3 && cm2.allMenuitem, JSON.stringify(cm2));

// CM12 — separator giữa label và items (role="separator")
const cm12 = await page.evaluate(() => {
	const sep = document.querySelector('[data-test="cm-users"] [role="menu"] [role="separator"]');
	return sep ? { found: true, h: getComputedStyle(sep).height } : { found: false };
});
ok('CM12 separator giữa label và items (role=separator, 1px)', cm12.found && cm12.h === '1px', JSON.stringify(cm12));

// CM13 — icon render ASYNC (Iconify fetch API → cache localStorage). Bẫy: chụp/assert
// quá sớm sẽ thấy 0 svg — phải chờ selector svg (max 15s, sau đó chạy nhanh nhờ cache).
try {
	await page.waitForSelector('[data-test="cm-users"] [role="menu"] .context-menu-item__icon svg', { timeout: 15000 });
} catch {
	/* offline → cm13 fail, log rõ */
}
const cm13 = await page.evaluate(() => {
	const items = [...document.querySelectorAll('[data-test="cm-users"] [role="menu"] [data-cm-item]')];
	return { withIcon: items.filter((i) => i.querySelector('.context-menu-item__icon svg')).length, total: items.length };
});
ok('CM13 icon render trong items (3/3 svg sau khi async load)', cm13.withIcon === cm13.total && cm13.total === 3, JSON.stringify(cm13));

// CM3 — ArrowDown x2 → focus item 3 (skip separator/label: nav chỉ qua [data-cm-item])
await sleep(100); // effect focus item đầu (setTimeout 0)
const focusText = () => page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 24));
const f0 = await focusText();
await page.keyboard.press('ArrowDown');
await sleep(80);
const f1 = await focusText();
await page.keyboard.press('ArrowDown');
await sleep(80);
const f2 = await focusText();
ok('CM3 ArrowDown x2 → focus item 3 (skip separator/label)', f0?.includes('Sao chép') && f1?.includes('Chỉnh sửa') && f2?.includes('Xóa'), JSON.stringify({ f0, f1, f2 }));

// CM4 — Home → focus item đầu
await page.keyboard.press('Home');
await sleep(80);
const fHome = await focusText();
ok('CM4 Home → focus item đầu', fHome?.includes('Sao chép'), fHome ?? '');

// CM5 — click item "Sao chép" → log update + menu đóng
await page.locator('[data-test="cm-users"] [role="menuitem"]', { hasText: 'Sao chép' }).click();
await sleep(200);
const cm5 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="cm-users"]');
	const logEl = document.querySelector('[data-test="cm-log"]');
	return {
		menuGone: !scope.querySelector('[role="menu"]'),
		log: logEl?.textContent ?? ''
	};
});
ok('CM5 click "Sao chép" → log update + menu đóng', cm5.menuGone && cm5.log.includes('Copy minh.khoa@acme.io'), JSON.stringify(cm5));

// CM6 — Escape → đóng
await page.mouse.click(cx, cy, { button: 'right' });
await sleep(200);
await page.keyboard.press('Escape');
await sleep(200);
const cm6 = await page.evaluate(() => !document.querySelector('[data-test="cm-users"] [role="menu"]'));
ok('CM6 Escape → menu đóng', cm6);

// CM7 — outside left-click → đóng (không trả focus)
await page.mouse.click(cx, cy, { button: 'right' });
await sleep(200);
await page.mouse.click(30, 30); // góc viewport, ngoài menu
await sleep(200);
const cm7 = await page.evaluate(() => !document.querySelector('[data-test="cm-users"] [role="menu"]'));
ok('CM7 outside left-click → menu đóng', cm7);

// CM8 — destructive item có class destructive
await page.mouse.click(cx, cy, { button: 'right' });
await sleep(200);
const cm8 = await page.evaluate(() => {
	const item = document.querySelector('[data-test="cm-users"] [role="menuitem"].destructive');
	return { found: !!item, text: item?.textContent?.trim() };
});
ok('CM8 destructive item có class .destructive', cm8.found && cm8.text?.includes('Xóa'), JSON.stringify(cm8));

// CM9 — disabled item (section cm-disabled): aria-disabled + focus tự động BỎ qua
const disBox = await page.locator('[data-test="cm-disabled"] .disabled-box').boundingBox();
if (disBox) {
	await page.mouse.click(Math.round(disBox.x + disBox.width / 2), Math.round(disBox.y + disBox.height / 2), { button: 'right' });
	await sleep(300);
	const cm9 = await page.evaluate(() => {
		const scope = document.querySelector('[data-test="cm-disabled"] [role="menu"]');
		if (!scope) return null;
		const dis = scope.querySelector('[data-cm-disabled]');
		const active = document.activeElement;
		return {
			menu: true,
			label: scope.querySelector('[data-cm-label]')?.textContent?.trim(),
			disAttr: dis?.getAttribute('aria-disabled'),
			disTabIndex: dis?.getAttribute('tabindex'),
			firstFocused: active?.textContent?.trim().slice(0, 24)
		};
	});
	ok('CM9 disabled item aria-disabled + roving skip (focus "Sao chép link", không "Lưu bản sao")', cm9?.menu && cm9.label?.includes('document.pdf') && cm9.disAttr === 'true' && cm9.disTabIndex === '-1' && cm9.firstFocused?.includes('Sao chép link'), JSON.stringify(cm9));

	// CM10 — image card right-click → label "product-hero.png"
	await page.keyboard.press('Escape');
	await sleep(150);
	const imgBox = await page.locator('[data-test="cm-image"] .image-card').boundingBox();
	if (imgBox) {
		await page.mouse.click(Math.round(imgBox.x + imgBox.width / 2), Math.round(imgBox.y + imgBox.height / 2), { button: 'right' });
		await sleep(250);
		const cm10 = await page.evaluate(() => {
			const scope = document.querySelector('[data-test="cm-image"] [role="menu"]');
			return { menu: !!scope, label: scope?.querySelector('[data-cm-label]')?.textContent?.trim() };
		});
		ok('CM10 image card right-click → label "product-hero.png"', cm10.menu && cm10.label?.includes('product-hero.png'), JSON.stringify(cm10));
	} else {
		ok('CM10 image card right-click → label "product-hero.png"', false, 'image-card không có boundingBox');
	}
} else {
	ok('CM9 disabled item aria-disabled + roving skip', false, '.disabled-box không có boundingBox');
	ok('CM10 image card right-click', false, 'skip (cm-disabled missing)');
}

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
