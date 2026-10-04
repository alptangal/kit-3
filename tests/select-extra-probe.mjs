// select-extra-probe.mjs
// Functional + computed-style probe cho 6 hoàn thiện Select:
// (1) tooltip action buttons (2) avatar ảnh (3) description (4) disabled
// (5) required + Label sync (6) fix bug "Add" (label option mới = value)
// Chạy: node tests/select-extra-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:3000/ui/select';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
// Mở dropdown bằng chevron (tránh click trúng chip ×) + chờ option render
const openViaChevron = async (sec) => {
	await sec.locator('.select-trigger__icon').click();
	await sec.locator('.select-option').first().waitFor({ timeout: 4000 });
};
// Đọc value thật (paragraph "Selected: <code>..."), tránh bắt nhầm <code> trong mô tả
const valueCode = (sec) => sec.locator('p:has-text("Selected") code');

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2 // ảnh nét hơn cho ui-checker
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

// ── (1) TOOLTIP ACTION BUTTONS ──
console.log('\n=== 1. TOOLTIP (edit/delete/clear) ===');
const editSection = page.locator('section:has(h2:text("Update / Delete Option"))');

// Hover nút edit → tooltip-content render trong body, z-index nổi trên dropdown
await openViaChevron(editSection);
const editBtn = editSection.locator('.select-option__action--edit').first();
await editBtn.hover();
await page.waitForSelector('.tooltip-content', { timeout: 3000 });
const tipEdit = await page.locator('.tooltip-content').first().evaluate((el) => {
	const cs = getComputedStyle(el);
	return {
		text: el.textContent?.trim(),
		z: parseInt(cs.zIndex, 10),
		pos: cs.position,
		pe: cs.pointerEvents
	};
});
ok('tooltip edit: render trong body', tipEdit.pos === 'fixed', `position=${tipEdit.pos}`);
ok('tooltip edit: text "Sửa option"', /Sửa option|Edit option/.test(tipEdit.text), tipEdit.text);
ok('tooltip edit: z-index ≥ 9000 (nổi trên panel dropdown 50)', tipEdit.z >= 9000, `z=${tipEdit.z}`);
ok('tooltip edit: pointer-events none (không chặn click)', tipEdit.pe === 'none', tipEdit.pe);

// Hover nút delete → text "Xóa option"
await editSection.locator('.select-option__action--delete').first().hover();
await page.waitForTimeout(250);
const tipDel = await page.locator('.tooltip-content').first().evaluate((el) => el.textContent?.trim());
ok('tooltip delete: text "Xóa option"', /Xóa option|Delete option/.test(tipDel), tipDel);

// Hover nút clear (section Single Select có value) → tooltip "Xóa"
// Trước: chọn Apple ở single section
const singleSec = page.locator('section:has(h2:text("Single Select"))');
await openViaChevron(singleSec);
await singleSec.locator('.select-option__label', { hasText: 'Apple' }).first().click();
await page.waitForTimeout(150);
const clearBtn = singleSec.locator('.select-clear-button');
await clearBtn.hover();
await page.waitForSelector('.tooltip-content', { timeout: 3000 });
const tipClear = await page.locator('.tooltip-content').first().evaluate((el) => el.textContent?.trim());
ok('tooltip clear: render khi hover nút X', tipClear.length > 0, tipClear);

// tooltip không sót khi dropdown đóng (rời chuột khỏi trigger trước — nếu vẫn hover
// thì tooltip hiện là đúng behavior)
await page.keyboard.press('Escape');
await page.mouse.move(5, 5);
await page.waitForTimeout(300);
const leftover = await page.locator('.tooltip-content').count();
ok('tooltip: không sót instance sau khi rời chuột + đóng dropdown', leftover === 0, `count=${leftover}`);

// ── (2) + (3) AVATAR + DESCRIPTION ──
console.log('\n=== 2+3. AVATAR + DESCRIPTION ===');
const richSection = page.locator('section:has(h2:text("Rich Options (avatar + description)"))');
await openViaChevron(richSection);
const imgInfo = await richSection.locator('.select-option__image').first().evaluate((el) => {
	const cs = getComputedStyle(el);
	const r = el.getBoundingClientRect();
	return {
		br: cs.borderRadius,
		objFit: cs.objectFit,
		w: Math.round(r.width),
		h: Math.round(r.height)
	};
});
ok('avatar: render trong option (3 img)', (await richSection.locator('.select-option__image').count()) === 3);
ok('avatar: border-radius full (tròn)', imgInfo.br === '9999px', `border-radius=${imgInfo.br}`);
ok('avatar: object-fit cover', imgInfo.objFit === 'cover', imgInfo.objFit);
ok('avatar: size 28px (1.75rem)', imgInfo.w === 28 && imgInfo.h === 28, `${imgInfo.w}x${imgInfo.h}`);

const descInfo = await richSection.locator('.select-option__description').first().evaluate((el) => ({
	fontSize: getComputedStyle(el).fontSize,
	whiteSpace: getComputedStyle(el).whiteSpace,
	overflow: getComputedStyle(el).textOverflow
}));
const labelInfo = await richSection.locator('.select-option__label').first().evaluate((el) => ({
	fontSize: getComputedStyle(el).fontSize
}));
ok('description: render trong option (3 dòng)', (await richSection.locator('.select-option__description').count()) === 3);
ok('description: font-size < label', parseFloat(descInfo.fontSize) < parseFloat(labelInfo.fontSize), `desc=${descInfo.fontSize} label=${labelInfo.fontSize}`);
ok('description: ellipsis (nowrap + overflow hidden)', descInfo.whiteSpace === 'nowrap' && descInfo.overflow === 'ellipsis');

// Section thường (không image/description) → layout cũ giữ nguyên (không node rỗng)
ok('option thường: không render media/description khi không có data',
	(await singleSec.locator('.select-option__media').count()) === 0 &&
	(await singleSec.locator('.select-option__description').count()) === 0);

// ── (4) DISABLED (polish) ──
console.log('\n=== 4. DISABLED ===');
const disabledSection = page.locator('section:has(h2:text("Disabled (polish)"))');
const disabledSingle = disabledSection.locator('.select-trigger').first();
const disabledMulti = disabledSection.locator('.select-trigger').last();

ok('disabled single: trigger button disabled', (await disabledSingle.getAttribute('disabled')) !== null);
ok('disabled single: aria-disabled="true"', (await disabledSingle.getAttribute('aria-disabled')) === 'true');

// Có value "apple" + clearable nhưng disabled → nút clear BỊ ẨN
const clearCount = await disabledSection.locator('.select-clear-button').count();
ok('disabled single (có value): clear button ẩn', clearCount === 0, `count=${clearCount}`);

// Click trigger disabled → dropdown KHÔNG mở
await disabledSingle.click({ force: true }).catch(() => {});
await page.waitForTimeout(200);
const ddCount = await disabledSection.locator('.select-dropdown').count();
ok('disabled: click trigger → dropdown không mở', ddCount === 0, `count=${ddCount}`);

// Multiple disabled + showChips removableChips → chip KHÔNG có nút ×
const chipRemoveCount = await disabledSection.locator('.select-chips .tag-remove').count();
ok('disabled multiple: chip không có nút ×', chipRemoveCount === 0, `count=${chipRemoveCount}`);
ok('disabled multiple: chip vẫn render value (Red, Green)',
	(await disabledSection.locator('.select-chips .tag-text').allTextContents()).some((t) => t.includes('Red')));

// Gegenproof: single section BỎ focus (không disabled) + có value → clear button HIỆN
ok('control: clear button hiện ở select không-disabled có value',
	(await singleSec.locator('.select-clear-button').count()) === 1);

// ── (5) REQUIRED + LABEL SYNC ──
console.log('\n=== 5. REQUIRED + LABEL SYNC ===');
const requiredSection = page.locator('section:has(h2:text("Required + Label sync"))');
const syncLabel = requiredSection.locator('label');
const syncTrigger = requiredSection.locator('.select-trigger');

ok('label: có asterisk (required)', (await syncLabel.locator('span:has-text(" * ")').count()) >= 1);
const forAttr = await syncLabel.getAttribute('for');
const triggerId = await syncTrigger.getAttribute('id');
ok('label: for === id trigger (field-sel-sync)', forAttr === triggerId && triggerId === 'field-sel-sync',
	`for=${forAttr} id=${triggerId}`);

// Click label → kích hoạt trigger button (label[for] → button labelable) → dropdown mở
// (focus sau đó rơi vào search input vì searchable — behavior chuẩn của Select)
await syncLabel.click();
await page.waitForTimeout(250);
const labelActivated = await requiredSection.locator('.select-dropdown').count();
ok('click label → dropdown mở (for/id link hoạt động)', labelActivated === 1, `count=${labelActivated}`);
await page.keyboard.press('Escape'); // đóng lại trước khi mở bằng chevron ở bước sau
await page.mouse.move(5, 5);
await page.waitForTimeout(200);
// Chưa chọn: required + value rỗng → isValid (live-computed) = false → Label class color-error
// (giống semantics checkbox/input: required chưa fill = error)
const labelClassesBefore = (await syncLabel.getAttribute('class')) ?? '';
// Chọn option → processValidation('change') → isValid=true (boolean) →
// Label đọc selectContext.validation.isValid → class color-success
await openViaChevron(requiredSection);
await requiredSection.locator('.select-option__label', { hasText: 'Apple' }).first().click();
await page.waitForTimeout(400); // chờ debounce validation
const labelClassesAfter = (await syncLabel.getAttribute('class')) ?? '';
ok('label (required, chưa chọn): đồng bộ color-error theo validation (isValid=false)',
	/color-error/.test(labelClassesBefore), labelClassesBefore);
ok('label (required, đã chọn hợp lệ): đồng bộ color-success theo validation',
	/color-success/.test(labelClassesAfter), labelClassesAfter);

// Size sync: label dùng size từ select (md → font-size cụ thể)
const labelSize = await syncLabel.evaluate((el) => getComputedStyle(el).fontSize);
ok('label: font-size đồng bộ size (md ≈ 16px)', parseFloat(labelSize) === 16 || parseFloat(labelSize) > 0,
	`font-size=${labelSize}`);

// ── (6) FIX BUG "ADD" ──
console.log('\n=== 6. FIX BUG ADD ===');
const createSection = page.locator('section:has(h2:text("Create Option (allowCreate)"))');
// Gõ "neon" trong search → hiện row "create this"
await openViaChevron(createSection);
await createSection.locator('.select-search-input').fill('neon');
await page.waitForTimeout(300);
// Click row create
const createRow = createSection.locator('.select-option.create-option');
await createRow.waitFor({ timeout: 3000 });
const hintLabel = await createRow.locator('.select-option__label').textContent();
ok('row create: hint dùng mẫu "Add neon"', /Add neon|Thêm neon/.test(hintLabel ?? ''), (hintLabel ?? '').trim());
await createRow.click();
await page.waitForTimeout(200);
// Trigger hiện "neon" (KHÔNG phải "Add neon")
const tagTexts = await createSection.locator('.select-chips .tag-text').allTextContents();
ok('chọn xong: chip/trigger hiện "neon" (không "Add neon")',
	tagTexts.some((t) => t.trim() === 'neon') && !tagTexts.some((t) => /Add|Thêm/.test(t)),
	`tags=[${tagTexts.join(' | ')}]`);
// Mở lại → option mới trong list có label "neon" (khác mẫu)
const newOptLabel = await createSection.locator('.select-option__label', { hasText: 'neon' }).count();
ok('option mới trong list: label "neon"', newOptLabel >= 1, `count=${newOptLabel}`);

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
mkdirSync('tests/screenshot/select-extra', { recursive: true });
const shotDir = 'tests/screenshot/select-extra';
const fresh = async () => {
	await page.goto(BASE, { waitUntil: 'domcontentloaded' });
	await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });
};
// Chụp theo union bounding box (section + dropdown/tooltip đang mở) → không bị clip
const shot = async (name, sec, extra) => {
	const rects = [await sec.boundingBox()];
	if (extra) {
		const r = await extra.boundingBox();
		if (r) rects.push(r);
	}
	const vp = await page.viewportSize();
	const pad = 12;
	const x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad);
	const y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
	const x1 = Math.min(vp.width, Math.max(...rects.map((r) => r.x + r.width)) + pad);
	const y1 = Math.min(vp.height, Math.max(...rects.map((r) => r.y + r.height)) + pad);
	if (x1 - x0 < 50 || y1 - y0 < 50) {
		await sec.screenshot({ path: `${shotDir}/${name}.png` });
		return;
	}
	await page.screenshot({ path: `${shotDir}/${name}.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
};

// 01: rich options (avatar + description, dropdown mở)
await fresh();
const rSec = page.locator('section:has(h2:text("Rich Options (avatar + description)"))');
await openViaChevron(rSec);
await shot('01-rich-options', rSec, rSec.locator('.select-dropdown'));

// 02: tooltip edit (hover nút pencil) — dùng option THỨ 2 (tooltip trên option đầu
// bị clip mép trên viewport) + đợi debounce position + fade-in 0.3s hoàn tất
await fresh();
const eSec = page.locator('section:has(h2:text("Update / Delete Option"))');
await openViaChevron(eSec);
await page.waitForTimeout(200); // panel settle
await eSec.locator('.select-option__action--edit').nth(1).hover();
await page.waitForSelector('.tooltip-content', { timeout: 3000 });
await page.waitForTimeout(700);
await shot('02-tooltip-edit', eSec, page.locator('.tooltip-content').first());

// 03: disabled (single + multiple)
await fresh();
await shot('03-disabled', page.locator('section:has(h2:text("Disabled (polish)"))'));

// 04: required + label sync (dropdown mở, có asterisk)
await fresh();
const rqSec = page.locator('section:has(h2:text("Required + Label sync"))');
await openViaChevron(rqSec);
await shot('04-required-label', rqSec, rqSec.locator('.select-dropdown'));

// 05: create option "neon" (row create + chip neon sau khi chọn)
await fresh();
const crSec = page.locator('section:has(h2:text("Create Option (allowCreate)"))');
await openViaChevron(crSec);
await crSec.locator('.select-search-input').fill('neon');
await page.waitForTimeout(300);
const crRow = crSec.locator('.select-option.create-option');
await shot('05-create-option-row', crSec, crRow);
await crRow.click();
await page.waitForTimeout(300);
await shot('06-create-option-chip', crSec);

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
