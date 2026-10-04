// tests/dropdown-menu-probe.mjs
// Verify DropdownMenu (element) + TeamSwitcher (navigation).
// Trang demo: /ui/dropdown-menu (nhiều menu) + /ui/sidebar (TeamSwitcher).
//
// Kiểm tra:
//  DM0 trang hiển thị (nhiều .dropdown-menu-root)
//  DM1 trigger: button + aria-haspopup="menu" + aria-expanded=false
//  DM2 click trigger → content (role=menu) hiện + aria-expanded=true
//  DM3 content căn align-start (left=0)
//  DM4 item: role=menuitem; disabled item aria-disabled + không activate
//  DM5 click item → onselect + menu tự đóng + focus về trigger
//  DM6 outside-click (mousedown ngoài) → menu đóng
//  DM7 Escape → menu đóng + focus về trigger
//  DM8 Tab → menu đóng
//  DM9 roving focus: ArrowDown/Up + Home/End di chuyển focus trong menu
//  DM10 controlled: toggle bằng state (nút bên) mở/đóng
//  DM11 TeamSwitcher: trigger hiện team hiện; chọn team khác → value đổi + checkmark
//  DM12 TeamSwitcher "Tạo team" → oncreate (counter tăng)
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

// ============ /ui/dropdown-menu ============
await page.goto('https://localhost:3000/ui/dropdown-menu', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.dropdown-menu-root', { timeout: 20000 });
await sleep(400);

// DM0 — structure
const roots = await page.locator('.dropdown-menu-root').count();
ok('DM0 multiple .dropdown-menu-root render', roots >= 5, `count=${roots}`);

// Menu cơ bản (section đầu)
const basicRoot = page.locator('[data-test="dm-basic"] .dropdown-menu-root').first();
const basicTrigger = basicRoot.locator('[data-dm-trigger]');

// DM1 — trigger attrs (closed)
const t1 = await basicTrigger.evaluate((b) => ({
	tag: b.tagName,
	haspopup: b.getAttribute('aria-haspopup'),
	expanded: b.getAttribute('aria-expanded')
}));
ok('DM1 trigger button + haspopup=menu + expanded=false', t1.tag === 'BUTTON' && t1.haspopup === 'menu' && t1.expanded === 'false', JSON.stringify(t1));

// DM2 — open
await basicTrigger.click();
await sleep(150);
const opened = await page.evaluate(() => {
	const menu = document.querySelector('[data-test="dm-basic"] [role="menu"]');
	const trig = document.querySelector('[data-test="dm-basic"] [data-dm-trigger]');
	return {
		menu: !!menu,
		expanded: trig?.getAttribute('aria-expanded'),
		controls: trig?.getAttribute('aria-controls'),
		idMatch: menu ? menu.id === trig?.getAttribute('aria-controls') : false
	};
});
ok('DM2 open → role=menu + expanded=true + aria-controls=id', opened.menu && opened.expanded === 'true' && opened.idMatch, JSON.stringify(opened));

// DM3 — align-start
const alignStart = await page.evaluate(() => {
	const menu = document.querySelector('[data-test="dm-basic"] [role="menu"]');
	if (!menu) return null;
	const cs = getComputedStyle(menu);
	return { pos: cs.position, left: cs.left };
});
ok('DM3 content align-start (position absolute, left=0px)', alignStart?.pos === 'absolute' && alignStart?.left === '0px', JSON.stringify(alignStart));

// DM4 — items + disabled
const items = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="dm-basic"] [role="menu"]');
	if (!scope) return null;
	const list = [...scope.querySelectorAll('[role="menuitem"]')];
	const dis = list.find((el) => el.textContent?.includes('Ngừng hoạt động'));
	return {
		count: list.length,
		disabledFound: !!dis,
		disabledAttr: dis?.getAttribute('aria-disabled'),
		disabledCss: dis ? getComputedStyle(dis).pointerEvents : ''
	};
});
ok('DM4 menuitems + disabled item (aria-disabled + pointer-events none)', items && items.count >= 4 && items.disabledFound && items.disabledAttr === 'true' && items.disabledCss === 'none', JSON.stringify(items));

// DM5 — select item → onselect + close + focus trigger
await page.locator('[data-test="dm-basic"] [role="menuitem"]', { hasText: 'Tạo không gian' }).click();
await sleep(150);
const afterSelect = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="dm-basic"]');
	const menu = scope.querySelector('[role="menu"]');
	const trig = scope.querySelector('[data-dm-trigger]');
	const picked = document.querySelector('[data-test="dm-picked"]')?.textContent;
	return {
		menuGone: !menu,
		focusedTrigger: document.activeElement === trig,
		picked
	};
});
ok('DM5 click item → onselect ("Tạo không gian") + close + focus trigger', afterSelect.menuGone && afterSelect.focusedTrigger && afterSelect.picked?.includes('Tạo không gian'), JSON.stringify(afterSelect));

// DM6 — outside-click (mở lại, mousedown ra ngoài menu)
await basicTrigger.click();
await sleep(120);
await page.mouse.click(20, 400); // điểm ngoài root menu
await sleep(150);
const outsideClosed = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="dm-basic"]');
	return !scope.querySelector('[role="menu"]');
});
ok('DM6 outside mousedown → menu đóng', outsideClosed);

// DM7 — Escape (mở lại, nhấn Escape)
await basicTrigger.click();
await sleep(120);
await page.keyboard.press('Escape');
await sleep(150);
const esc = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="dm-basic"]');
	const menu = scope.querySelector('[role="menu"]');
	const trig = scope.querySelector('[data-dm-trigger]');
	return { closed: !menu, focus: document.activeElement === trig };
});
ok('DM7 Escape → đóng + focus về trigger', esc.closed && esc.focus, JSON.stringify(esc));

// DM8 — Tab (mở lại, nhấn Tab)
await basicTrigger.click();
await sleep(120);
await page.keyboard.press('Tab');
await sleep(150);
const tabClosed = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="dm-basic"]');
	return !scope.querySelector('[role="menu"]');
});
ok('DM8 Tab → menu đóng', tabClosed);

// DM9 — roving focus (mở, focus item đầu, ArrowDown/Up/Home/End)
await basicTrigger.click();
await sleep(250); // chờ effect focus item đầu
const roving = await page.evaluate(async () => {
	const scope = document.querySelector('[data-test="dm-basic"]');
	const list = [...scope.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
	const texts = () => document.activeElement?.textContent?.trim().slice(0, 20);
	const start = document.activeElement?.textContent?.trim().slice(0, 20);
	document.activeElement?.focus?.();
	const down = () => {};
	return {
		listCount: list.length,
		firstFocused: list[0] === document.activeElement,
		startText: start
	};
});
await page.keyboard.press('ArrowDown');
await sleep(80);
const afterDown = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
await page.keyboard.press('ArrowDown');
await sleep(80);
await page.keyboard.press('End');
await sleep(80);
const afterEnd = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
await page.keyboard.press('Home');
await sleep(80);
const afterHome = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
const stillInMenu = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="dm-basic"]');
	return !!scope.querySelector('[role="menuitem"]:focus');
});
ok('DM9 roving focus: focus item đầu + Arrow/End/Home di chuyển trong menu', roving.firstFocused && afterDown && afterEnd !== afterHome && stillInMenu, JSON.stringify({ roving, afterDown, afterEnd, afterHome }));

// DM10 — controlled (parent state → menu; trigger → state sync ngược)
const ctrlTrigger = () => page.locator('[data-test="dm-controlled-trigger"] [data-dm-trigger]');
const ctrlRow = () => page.locator('[data-test="dm-controlled-toggle"]').locator('..');
await page.locator('[data-test="dm-controlled-toggle"]').click();
await sleep(150);
const ctrlOpen = await ctrlRow().evaluate((row) => !!row.querySelector('[role="menu"]'));
ok('DM10a controlled: "Mở bằng state" → menu hiện (bind:open)', ctrlOpen, `open=${ctrlOpen}`);
// trigger đóng (toggle false) → controlled phải sync về false (text trigger đổi)
await ctrlTrigger().click();
await sleep(150);
const ctrlClosed = await ctrlRow().evaluate((row) => !row.querySelector('[role="menu"]'));
const syncText = await ctrlTrigger().textContent();
ok('DM10b controlled: trigger đóng → state sync (trigger text "Đóng bằng trigger")', ctrlClosed && syncText?.includes('Đóng bằng trigger'), `closed=${ctrlClosed} text=${syncText}`);

// ============ /ui/sidebar — TeamSwitcher ============
await page.goto('https://localhost:3000/ui/sidebar', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.switcher [data-dm-trigger]', { timeout: 20000 });
await sleep(400);

const swTrigger = page.locator('.switcher [data-dm-trigger]');

// DM11 — trigger hiện team hiện
const sw1 = await swTrigger.evaluate((b) => b.textContent?.trim());
ok('DM11 TeamSwitcher trigger hiện "Acme Inc"', sw1?.includes('Acme Inc'), sw1);

// mở menu switcher
await swTrigger.click();
await sleep(200);
const swOpen = await page.evaluate(() => {
	const scope = document.querySelector('.switcher');
	return !!scope.querySelector('[role="menu"]');
});

// checkmark: item active ("Acme Inc") phải có .trailing chứa svg; item khác không
const checkBefore = await page.evaluate(() => {
	const scope = document.querySelector('.switcher [role="menu"]');
	if (!scope) return null;
	const items = [...scope.querySelectorAll('[role="menuitem"]')];
	const find = (t) => items.find((i) => i.textContent?.includes(t));
	return {
		acme: !!find('Acme Inc')?.querySelector('.trailing svg'),
		nb: !!find('Nebula Corp')?.querySelector('.trailing svg')
	};
});
ok('DM11a TeamSwitcher checkmark: item active (Acme Inc) có check, item khác không', checkBefore?.acme === true && checkBefore?.nb === false, JSON.stringify(checkBefore));

// chọn team "Nebula Corp"
await page.locator('.switcher [role="menuitem"]', { hasText: 'Nebula Corp' }).click();
await sleep(200);
const swAfter = await swTrigger.evaluate((b) => b.textContent?.trim());
ok('DM11 TeamSwitcher: chọn "Nebula Corp" → value đổi (trigger hiện Nebula Corp)', swOpen && swAfter?.includes('Nebula Corp'), `before=open, after=${swAfter}`);

// checkmark phải chuyển sang item active mới (mở lại menu vì select đã close)
await swTrigger.click();
await sleep(200);
const checkAfter = await page.evaluate(() => {
	const scope = document.querySelector('.switcher [role="menu"]');
	if (!scope) return null;
	const items = [...scope.querySelectorAll('[role="menuitem"]')];
	const find = (t) => items.find((i) => i.textContent?.includes(t));
	return {
		acme: !!find('Acme Inc')?.querySelector('.trailing svg'),
		nb: !!find('Nebula Corp')?.querySelector('.trailing svg')
	};
});
ok('DM11b TeamSwitcher checkmark chuyển sang team mới (Nebula Corp)', checkAfter?.acme === false && checkAfter?.nb === true, JSON.stringify(checkAfter));

// DM12 — "Tạo team" → oncreate (chạy trên section switcher của /ui/dropdown-menu,
// vì sidebar demo không có counter hiển thị)
await page.goto('https://localhost:3000/ui/dropdown-menu', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="dm-switcher-section"] [data-dm-trigger]', { timeout: 20000 });
await sleep(300);
const createdBefore = await page.locator('[data-test="dm-team-created"]').textContent();
const sw2Trigger = page.locator('[data-test="dm-switcher-section"] [data-dm-trigger]');
await sw2Trigger.click();
await sleep(200);
await page.locator('[data-test="dm-switcher-section"] [role="menuitem"]', { hasText: 'Tạo team' }).click();
await sleep(200);
const createdAfter = await page.locator('[data-test="dm-team-created"]').textContent();
ok('DM12 TeamSwitcher "Tạo team" → oncreate (counter tăng)', createdAfter !== createdBefore, `${createdBefore} → ${createdAfter}`);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
