// tests/alert-dialog-probe.mjs
// Verify AlertDialog (element) — dialog DẠNG XÁC NHẬN (shadcn AlertDialog).
// Trang demo: /ui/alert-dialog (3 case: danger trigger, controlled, info).
//
// Kiểm tra:
//  AD0 closed: no [role="alertdialog"]
//  AD1 click trigger → dialog hiện + role=alertdialog + aria-modal=true
//  AD2 aria-labelledby/describedby trỏ đúng id + text đúng
//  AD3 focus: khi open, document.activeElement = Action button
//  AD4 Escape → đóng + focus về trigger
//  AD5 Tab: Action → Cancel → Action (loop 2 nút, focus trap)
//  AD6 Action click: demo log update + dialog đóng
//  AD7 Cancel click: dialog đóng, log KHÔNG đổi
//  AD8 backdrop click: dialog VẪN MỞ (không đóng)
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

// ============ /ui/alert-dialog ============
await page.goto('https://localhost:3000/ui/alert-dialog', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="alertdialog-demo"]', { timeout: 20000 });
await sleep(400);

const dangerSection = '[data-test="ad-danger"]';
const trigger = () => page.locator(`${dangerSection} [data-ad-trigger] button`);

// AD0 — closed: không có dialog nào trong DOM
const ad0 = await page.evaluate(() => !!document.querySelector('[role="alertdialog"]'));
ok('AD0 closed: no [role="alertdialog"] in DOM', !ad0, `present=${ad0}`);

// AD1 — click trigger → dialog + role + aria-modal
await trigger().click();
await sleep(300);
const ad1 = await page.evaluate((sec) => {
	const dlg = document.querySelector('[role="alertdialog"]');
	const trig = document.querySelector(`${sec} [data-ad-trigger]`);
	return {
		dlg: !!dlg,
		role: dlg?.getAttribute('role'),
		modal: dlg?.getAttribute('aria-modal'),
		expanded: trig?.getAttribute('aria-expanded')
	};
}, dangerSection);
ok('AD1 click trigger → role=alertdialog + aria-modal=true + trigger aria-expanded=true', ad1.dlg && ad1.role === 'alertdialog' && ad1.modal === 'true' && ad1.expanded === 'true', JSON.stringify(ad1));

// AD2 — aria-labelledby/describedby trỏ đúng id + text
const ad2 = await page.evaluate(() => {
	const dlg = document.querySelector('[role="alertdialog"]');
	if (!dlg) return null;
	const titleEl = document.getElementById(dlg.getAttribute('aria-labelledby'));
	const descEl = document.getElementById(dlg.getAttribute('aria-describedby'));
	return {
		titleId: dlg.getAttribute('aria-labelledby'),
		descId: dlg.getAttribute('aria-describedby'),
		titleText: titleEl?.textContent?.trim(),
		descText: descEl?.textContent?.trim(),
		titleTag: titleEl?.tagName,
		descTag: descEl?.tagName
	};
});
ok(
	'AD2 aria-labelledby/describedby → đúng id + text (h3 "Xóa sản phẩm?")',
	ad2?.titleText === 'Xóa sản phẩm?' && ad2?.descText?.includes('không thể hoàn tác') && ad2?.titleTag === 'H3' && ad2?.descTag === 'P',
	JSON.stringify(ad2)
);

// AD3 — focus khi open = Action button
const ad3 = await page.evaluate(() => {
	const active = document.activeElement;
	return {
		isAction: active?.getAttribute('data-ad-action') != null || active?.closest('[data-ad-action]') != null,
		text: active?.textContent?.trim(),
		tag: active?.tagName
	};
});
ok('AD3 focus khi open = Action button ("Xóa")', ad3.isAction && ad3.text === 'Xóa', JSON.stringify(ad3));

// AD5 — Tab loop 2 nút (làm TRƯỚC AD4 để còn dialog mở)
const tabSeq = [];
// focus hiện tại = Action. Tab → Cancel. Tab → Action. Shift+Tab → Cancel.
await page.keyboard.press('Tab');
await sleep(120);
tabSeq.push(await page.evaluate(() => document.activeElement?.textContent?.trim()));
await page.keyboard.press('Tab');
await sleep(120);
tabSeq.push(await page.evaluate(() => document.activeElement?.textContent?.trim()));
await page.keyboard.press('Tab', { modifiers: ['Shift'] });
await sleep(120);
tabSeq.push(await page.evaluate(() => document.activeElement?.textContent?.trim()));
ok('AD5 Tab loop 2 nút: Action→Cancel→Action (Shift+Tab → Cancel)', tabSeq[0] === 'Hủy' && tabSeq[1] === 'Xóa' && tabSeq[2] === 'Hủy', JSON.stringify(tabSeq));

// AD4 — Escape → đóng + focus về trigger
await page.keyboard.press('Escape');
await sleep(250);
const ad4 = await page.evaluate((sec) => {
	const dlg = document.querySelector('[role="alertdialog"]');
	const innerBtn = document.querySelector(`${sec} [data-ad-trigger] button`);
	return {
		closed: !dlg,
		focusOnTrigger: innerBtn === document.activeElement,
		expanded: document.querySelector(`${sec} [data-ad-trigger]`)?.getAttribute('aria-expanded'),
		innerBtn: !!innerBtn
	};
}, dangerSection);
ok('AD4 Escape → đóng + focus về trigger (button trong trigger)', ad4.closed && ad4.focusOnTrigger && ad4.expanded === 'false', JSON.stringify(ad4));

// AD6 — Action click → log "deleted: X" + dialog đóng
await trigger().click();
await sleep(300);
const logBefore = await page.locator('[data-test="ad-log"]').textContent();
await page.locator('[data-ad-action]').click();
await sleep(250);
const ad6 = await page.evaluate(() => {
	const dlg = document.querySelector('[role="alertdialog"]');
	const log = document.querySelector('[data-test="ad-log"]')?.textContent;
	return { closed: !dlg, log };
});
ok('AD6 Action click → log "deleted: MacBook Air M3" + dialog đóng', ad6.closed && ad6.log?.includes('deleted: MacBook Air M3'), JSON.stringify({ before: logBefore, after: ad6.log, closed: ad6.closed }));

// AD7 — Cancel click → đóng, log KHÔNG đổi
const logBeforeCancel = await page.locator('[data-test="ad-log"]').textContent();
await trigger().click();
await sleep(300);
await page.locator('[data-ad-cancel]').click();
await sleep(250);
const ad7 = await page.evaluate(() => {
	const dlg = document.querySelector('[role="alertdialog"]');
	const log = document.querySelector('[data-test="ad-log"]')?.textContent;
	return { closed: !dlg, log };
});
ok('AD7 Cancel click → dialog đóng, log KHÔNG đổi', ad7.closed && ad7.log === logBeforeCancel, JSON.stringify({ log: ad7.log, closed: ad7.closed }));

// AD8 — backdrop click → dialog VẪN MỞ
await trigger().click();
await sleep(300);
// Click vùng overlay (điểm ngoài box — box ~400px centered, viewport 1280×900).
await page.mouse.click(30, 450);
await sleep(250);
const ad8 = await page.evaluate(() => {
	const dlg = document.querySelector('[role="alertdialog"]');
	return { stillOpen: !!dlg };
});
ok('AD8 backdrop click → dialog VẪN MỞ (không đóng)', ad8.stillOpen, JSON.stringify(ad8));

// cleanup: đóng dialog (Escape) để không "dịch" state cho các probe khác
await page.keyboard.press('Escape');
await sleep(150);

// ============ Bonus: controlled case (b) + info case (c) ============
// AD9 — controlled: nút "Mở" → dialog hiện; nút "Đóng" → dialog ẩn; state text đổi
const ctrlSection = '[data-test="ad-controlled"]';
await page.locator(`${ctrlSection} [data-test="ad-controlled-open"]`).click();
await sleep(300);
const ctrlOpenState = await page.evaluate(() => {
	const dlg = document.querySelector('[role="alertdialog"]');
	const stateText = document.querySelector('[data-test="ad-controlled-state"]')?.textContent;
	const actionFocused = document.activeElement?.getAttribute('data-ad-action') != null;
	return { dlg: !!dlg, stateText, actionFocused };
});
ok('AD9a controlled: "Mở" → dialog hiện + focus Action + state "mở"', ctrlOpenState.dlg && ctrlOpenState.stateText?.includes('mở') && ctrlOpenState.actionFocused, JSON.stringify(ctrlOpenState));

// AD9b — controlled CLOSE: click Cancel TRONG dialog (overlay phủ nền →
// nút "Đóng (đóng)" background KHÔNG click được khi open — đúng semantics
// dialog). Cancel → close() → bind:open = false → state "đóng".
// Note: dialog được PORTAL ra layout root → Cancel KHÔNG phải descendant
// của .row[data-test="ad-controlled"] → selector trực tiếp, không scoped.
await page.locator('[data-test="ad-controlled-cancel"]').click();
await sleep(250);
const ctrlClosedState = await page.evaluate(() => {
	const dlg = document.querySelector('[role="alertdialog"]');
	const stateText = document.querySelector('[data-test="ad-controlled-state"]')?.textContent;
	return { dlg: !!dlg, stateText };
});
ok('AD9b controlled: Cancel trong dialog → dialog ẩn + state "đóng"', !ctrlClosedState.dlg && ctrlClosedState.stateText?.includes('đóng'), JSON.stringify(ctrlClosedState));

// AD10 — info variant: action color=primary (không đỏ) + focus Action khi open
const infoSection = '[data-test="ad-info"]';
await page.locator(`${infoSection} [data-ad-trigger] button`).click();
await sleep(300);
const ad10 = await page.evaluate(() => {
	const dlg = document.querySelector('[role="alertdialog"]');
	const action = document.querySelector('[data-ad-action]');
	const cs = action ? getComputedStyle(action) : null;
	const bg = cs?.backgroundColor;
	const isRed = bg === 'rgb(255, 0, 0)' || (bg ? bg.includes('255,') && Number(bg.match(/,\s*(\d+)/)?.[1] ?? 999) < 100 : false);
	return { dlg: !!dlg, bg, isRed, focused: action === document.activeElement };
});
ok('AD10 info: action không đỏ (color=primary) + focus Action khi open', ad10.dlg && !ad10.isRed && ad10.focused, JSON.stringify(ad10));
await page.keyboard.press('Escape');
await sleep(150);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
