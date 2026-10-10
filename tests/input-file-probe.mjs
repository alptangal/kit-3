// input-file-probe.mjs
// Functional probe cho task "hoàn thiện #input (thêm type='file')":
// - FI0  page render (data-test=input-demo, 9 sections file)
// - FI1  single-select: setInputFiles → 1 card preview (ảnh blob:)
// - FI2  single replace: set file khác → vẫn 1 card, name mới
// - FI3  multiple: 3 files (png+txt+csv) → 3 cards, kind đúng (thumb/text/csv)
// - FI4  cap maxFiles=3: set 5 → chỉ 3 cards
// - FI5  remove: click nút xóa → còn 2 cards
// - FI6  required + FieldMessages: pending → add → valid (showValid) → remove hết → error
// - FI7  form gating: submit disabled → add file + email → enabled (payload không có file key)
// - FI8  disabled: dropzone không focusable, không mở dialog
// - FI9  preview text: <pre> csv/json/txt khớp head fixture
// - FI10 native input hidden + accept/multiple đúng
// ── Mới (tùy chọn type='file') ──
// - FI11 remove button color error (tokenToRgb so --error-500)
// - FI12 clearable: nút "Xóa tất cả" hiện khi ≥1 file → click → rỗng + validation đúng
// - FI13 quickDelete: tick 2 card → quickbar "Xóa N tệp đã chọn" → xóa hàng loạt
// - FI14 fileDetails: click card → modal hiện tên/size/mime/lastModified + ảnh
// - FI15 single replace vẫn hoạt động (lặp lại với tùy chọn mới bật)
// Chạy: node tests/input-file-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const BASE = process.env.PROBE_BASE ?? 'https://localhost:3000/ui/input';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fixtures (Node viết trực tiếp vào tests/fixtures/) ──
const FIX = 'tests/fixtures';
mkdirSync(FIX, { recursive: true });
// 1x1 PNG (base64 chuẩn)
const pngBase64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
writeFileSync(join(FIX, 'logo.png'), Buffer.from(pngBase64, 'base64'));
// PNG thứ 2 (byte khác logo.png) — dùng cho test FI2 (single replace),
// vì if-single chỉ accept "image/*,.pdf" (config.json sẽ bị reject đúng ý).
const png2Base64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgF3TzHkVAAAAABJRU5ErkJggg==';
writeFileSync(join(FIX, 'cover.png'), Buffer.from(png2Base64, 'base64'));
writeFileSync(join(FIX, 'notes.txt'), 'file notes line 1\nfile notes line 2\nfile notes line 3');
writeFileSync(join(FIX, 'data.csv'), 'id,name\n1,Alpha\n2,Bravo\n3,Charlie\n4,Delta\n5,Echo');
writeFileSync(join(FIX, 'config.json'), JSON.stringify({ env: 'probe', list: [1, 2, 3] }, null, 2));
writeFileSync(join(FIX, 'a.txt'), 'a');
writeFileSync(join(FIX, 'b.txt'), 'b');

const p = (n) => join(FIX, n);
// Size thật của fixture (logo.png base64 decode = 70 bytes, KHÔNG hardcode "1 B")
const logoSize = statSync(p('logo.png')).size;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-demo"]', { timeout: 20000 });

// ── Hydration gate ──
// setInputFiles (Playwright) fire change NGAY sau load → nếu chạy trước khi Svelte
// gắn listener onchange (hydration) thì lần change ĐẦU TIÊN bị mất. Gate xác định:
// click dropzone đầu tiên → filechooser PHẢI fire (chứng minh Svelte đã gắn
// onclick/onclick). setFiles([]) → files rỗng, không sinh card (an toàn, đóng dialog).
{
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser', { timeout: 10000 }),
		page.locator('.input-file-dropzone').first().click()
	]);
	await chooser.setFiles([]).catch(() => {});
	await sleep(200);
}

// Locators scoped per section (nhiều input[type=file] trên trang)
const section = (t) => page.locator(`[data-test="${t}"]`);
const fileInput = (t) => section(t).locator('input[type="file"]');
const dropzone = (t) => section(t).locator('.input-file-dropzone');
const cards = (t) => section(t).locator('.input-file-card');
const cardNames = (t) => cards(t).locator('.input-file-name').allTextContents();

console.log('\n=== FI0: PAGE RENDER ===');
ok('FI0: demo root render', (await page.locator('[data-test="input-demo"]').count()) === 1);
const fileSections = [
	'if-single',
	'if-multiple',
	'if-required',
	'if-preview',
	'if-details',
	'if-quick-delete',
	'if-clearable',
	'if-form',
	'if-disabled'
];
const sectionCount = await Promise.all(fileSections.map((s) => section(s).count()));
ok('FI0: 9 sections file render', sectionCount.every((c) => c === 1), JSON.stringify(sectionCount));
const dropzones = await page.locator('.input-file-dropzone').count();
ok('FI0: 9 dropzone render', dropzones === 9, String(dropzones));

console.log('\n=== FI1: SINGLE SELECT → 1 CARD (ảnh blob:) ===');
await fileInput('if-single').setInputFiles([p('logo.png')]);
await sleep(350); // preview build (objectURL) + re-render
ok('FI1: 1 card sau khi chọn ảnh', (await cards('if-single').count()) === 1, String(await cards('if-single').count()));
const imgSrc = await section('if-single').locator('.input-file-thumb').getAttribute('src').catch(() => null);
ok('FI1: preview là <img> src=blob:', !!imgSrc && imgSrc.startsWith('blob:'), imgSrc?.slice(0, 20) ?? '(null)');
const hint1 = await section('if-single').locator('code').first().textContent();
ok('FI1: demo hint đồng bộ page state (logo.png)', hint1?.trim() === 'logo.png', hint1);

console.log('\n=== FI2: SINGLE REPLACE (chọn mới thay thế) ===');
// if-single accept="image/*,.pdf" → phải dùng ảnh (cover.png, byte khác logo.png);
// dùng config.json là SAI (bị reject đúng spec → 0 card, không phải test replace).
await fileInput('if-single').setInputFiles([p('cover.png')]);
await sleep(350);
ok('FI2: vẫn 1 card sau khi chọn file 2', (await cards('if-single').count()) === 1, String(await cards('if-single').count()));
ok('FI2: card name mới = cover.png (thay thế logo.png)', (await cardNames('if-single'))[0] === 'cover.png', JSON.stringify(await cardNames('if-single')));

console.log('\n=== FI3: MULTIPLE (3 files: png+txt+csv) ===');
await fileInput('if-multiple').setInputFiles([p('logo.png'), p('notes.txt'), p('data.csv')]);
await sleep(400);
ok('FI3: 3 cards', (await cards('if-multiple').count()) === 3, String(await cards('if-multiple').count()));
ok(
	'FI3: kinds đúng (1 img + 2 text/csv)',
	(await section('if-multiple').locator('.input-file-thumb').count()) === 1 &&
		(await section('if-multiple').locator('.input-file-preview-text').count()) === 2,
	`thumb=${await section('if-multiple').locator('.input-file-thumb').count()} text=${await section('if-multiple').locator('.input-file-preview-text').count()}`
);
ok('FI3: demo hint "3/3"', (await section('if-multiple').locator('code').first().textContent())?.trim() === '3/3');

console.log('\n=== FI4: CAP maxFiles=3 (set 5 → 3) ===');
await fileInput('if-multiple').setInputFiles([p('a.txt'), p('b.txt'), p('notes.txt'), p('data.csv'), p('config.json')]);
await sleep(400);
ok('FI4: cap maxFiles=3 → đúng 3 cards', (await cards('if-multiple').count()) === 3, String(await cards('if-multiple').count()));

console.log('\n=== FI5: REMOVE (click nút xóa → còn 2) ===');
await cards('if-multiple').first().locator('.input-file-remove').click();
await sleep(350);
ok('FI5: click remove → còn 2 cards', (await cards('if-multiple').count()) === 2, String(await cards('if-multiple').count()));

console.log('\n=== FI6: REQUIRED + FIELDMESSAGES (showValid, debounce) ===');
// Ban đầu: chưa validate (pending, không có message)
let reqRoot = section('if-required').locator('.input-root');
ok('FI6: ban đầu không có color-error (pending)', !((await reqRoot.getAttribute('class')) ?? '').includes('color-error'));
await fileInput('if-required').setInputFiles([p('logo.png')]);
await sleep(800); // debounce ~300ms
let msgText = await section('if-required').locator('.fieldMessages-root p').first().textContent().catch(() => '');
ok('FI6: add file → FieldMessages (showValid) hiện message hợp lệ', /valid|hợp lệ/i.test(msgText ?? ''), msgText?.trim());
ok('FI6: input-root có color-success', ((await reqRoot.getAttribute('class')) ?? '').includes('color-success'));
// Xóa hết → invalid (required) + message
await section('if-required')
	.locator('.input-file-remove')
	.first()
	.click();
await sleep(800);
msgText = await section('if-required').locator('.fieldMessages-root p').first().textContent().catch(() => '');
ok(
	'FI6: remove hết → FieldMessages hiện message required (invalid)',
	/require|bắt buộc/i.test(msgText ?? ''),
	msgText?.trim()
);
ok('FI6: input-root có color-error (invalid)', ((await reqRoot.getAttribute('class')) ?? '').includes('color-error'));

console.log('\n=== FI7: FORM GATING (file required + email) ===');
const submitBtn = section('if-form').locator('.button-root').filter({ hasText: 'Submit' }).first();
ok('FI7: ban đầu submit DISABLED (chưa có file + email)', await submitBtn.isDisabled());
await fileInput('if-form').setInputFiles([p('logo.png')]);
const formEmail = section('if-form').locator('input[type="email"]');
await formEmail.fill('probe@example.com');
await formEmail.blur();
await sleep(800); // debounce cả file + email
ok('FI7: file + email hợp lệ → submit ENABLED', !(await submitBtn.isDisabled()));
// Click submit → page onSubmit chạy (formSubmitted=true). Form KHÔNG serialize file
// (configs không có key `value`) — kiểm tra qua fact: button đổi label + không lỗi runtime.
await submitBtn.click();
await sleep(300);
ok('FI7: submit chạy (label đổi "Đã submit ✓")', (await submitBtn.textContent())?.includes('Đã submit'));
// Payload: file không được serialize — configs of file input không có key `value`.
const hasValueKey = await fileInput('if-form')
	.evaluate((el) => {
		// Không truy cập trực tiếp configs từ DOM; thay vào đó kiểm tra name của native input
		// (Form chỉ serialize children có key value; file configs bị skip → name là đủ,
		//  nhưng để chắc chắn: verify qua trang không crash + email vẫn validate được).
		return el.getAttribute('name');
	});
ok('FI7: native file input có name (if-form-file)', hasValueKey === 'if-form-file', hasValueKey ?? '(null)');

console.log('\n=== FI8: DISABLED (dropzone không tương tác) ===');
const dzDisabled = dropzone('if-disabled');
ok('FI8: dropzone disabled có tabindex=-1 + aria-disabled', (await dzDisabled.getAttribute('tabindex')) === '-1' && (await dzDisabled.getAttribute('aria-disabled')) === 'true');
// Click dropzone disabled → openFilePicker() bị guard (configs.disabled) → dialog KHÔNG mở,
// native input không nhận file. (Không test focus() chương trình — tabindex=-1 vẫn focus được
// bằng script, đó là hành vi chuẩn, không phải bug.)
await dzDisabled.click({ force: true }).catch(() => {});
await sleep(200);
const disabledFiles = await fileInput('if-disabled').evaluate((el) => el.files.length);
ok('FI8: click dropzone disabled không mở dialog / không nhận file', disabledFiles === 0, String(disabledFiles));
ok('FI8: card không hiển thị', (await cards('if-disabled').count()) === 0);

console.log('\n=== FI9: PREVIEW TEXT (csv/json/txt khớp head fixture) ===');
await fileInput('if-preview').setInputFiles([p('data.csv'), p('config.json'), p('notes.txt')]);
await sleep(500);
const preTexts = await section('if-preview').locator('.input-file-preview-text').allTextContents();
ok('FI9: 3 <pre> preview', preTexts.length === 3, String(preTexts.length));
ok(
	'FI9: csv preview chứa "id,name" + đúng 5 dòng đầu (dòng 6 "5,Echo" bị cắt)',
	preTexts.some((t) => t.includes('id,name') && t.includes('4,Delta') && !t.includes('5,Echo')),
	preTexts[0]?.slice(0, 40)
);
ok('FI9: json preview parse+pretty (chứa "env" + "probe")', preTexts.some((t) => t.includes('"env"') && t.includes('"probe"')), preTexts[1]?.slice(0, 40));
ok('FI9: txt preview chứa "file notes line 1"', preTexts.some((t) => t.includes('file notes line 1')), preTexts[2]?.slice(0, 40));

console.log('\n=== FI10: NATIVE INPUT HIDDEN + accept/multiple ===');
const nativeAttrs = await page.evaluate(() => {
	const out = {};
	for (const sec of ['if-single', 'if-multiple']) {
		const el = document.querySelector(`[data-test="${sec}"] input[type="file"]`);
		const cs = el ? getComputedStyle(el) : null;
		out[sec] = el
			? {
					accept: el.accept,
					multiple: el.multiple,
					hidden: cs ? cs.position === 'absolute' && cs.width === '1px' : false
				}
			: null;
	}
	return out;
});
ok(
	'FI10: if-single accept="image/*,.pdf" + KHÔNG multiple',
	nativeAttrs['if-single']?.accept === 'image/*,.pdf' && nativeAttrs['if-single'].multiple === false,
	JSON.stringify(nativeAttrs['if-single'])
);
ok(
	'FI10: if-multiple accept=".png,.txt,.csv" + multiple=true',
	nativeAttrs['if-multiple']?.accept === '.png,.txt,.csv' && nativeAttrs['if-multiple'].multiple === true,
	JSON.stringify(nativeAttrs['if-multiple'])
);
ok(
	'FI10: native input hidden (clip pattern: absolute + 1px)',
	nativeAttrs['if-single']?.hidden === true && nativeAttrs['if-multiple']?.hidden === true,
	JSON.stringify({ s: nativeAttrs['if-single']?.hidden, m: nativeAttrs['if-multiple']?.hidden })
);

console.log('\n=== FI11: REMOVE BUTTON COLOR ERROR (tokenToRgb) ===');
// So màu icon nút remove qua computed style: icon dùng currentColor → màu
// computed của svg = màu icon thực tế. Token raw là hsl() → helper tokenToRgb.
async function tokenToRgb(cssVarName) {
	return page.evaluate((name) => {
		const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		if (!raw) return null;
		const el = document.createElement('span');
		el.style.color = raw;
		document.body.appendChild(el);
		const rgb = getComputedStyle(el).color;
		el.remove();
		return rgb;
	}, cssVarName);
}
const errToken = await tokenToRgb('--error');
// remove button trong if-preview (đang có 3 cards sau FI9)
const removeBtn = section('if-preview').locator('.input-file-remove').first();
const removeColor = await removeBtn.evaluate((el) => getComputedStyle(el).color);
ok(
	'FI11: remove button color = token --error (rgb)',
	removeColor === errToken,
	`color=${removeColor} expect=${errToken}`
);
// nút remove KHÔNG màu gray cũ (--color-gray-500 sẽ là màu trung tính khác)
ok('FI11: remove color KHÔNG gray-500 cũ', removeColor !== (await tokenToRgb('--color-gray-500')));

console.log('\n=== FI12: CLEARABLE (nút Xóa tất cả) ===');
const clearSection = section('if-clearable');
const clearBtn = clearSection.locator('[data-test="input-file-clear-all"]');
ok('FI12: ban đầu KHÔNG có nút Xóa tất cả (chưa chọn file)', (await clearBtn.count()) === 0, String(await clearBtn.count()));
await fileInput('if-clearable').setInputFiles([p('logo.png'), p('notes.txt')]);
await sleep(400);
ok('FI12: chọn 2 file → nút Xóa tất cả hiện', (await clearBtn.count()) === 1, String(await clearBtn.count()));
ok('FI12: header previews hiện "2 tệp"', (await clearSection.locator('.input-file-count').textContent())?.trim() === '2 tệp');
// required + showValid: chọn file → valid → clear hết → error (validation đúng discipline)
const clearRoot = clearSection.locator('.input-root');
await sleep(700); // debounce validation
ok(
	'FI12: sau chọn file required → color-success (validation không bị nuốt)',
	((await clearRoot.getAttribute('class')) ?? '').includes('color-success'),
	(await clearRoot.getAttribute('class')) ?? ''
);
await clearBtn.click();
await sleep(800);
ok('FI12: click Xóa tất cả → 0 cards', (await cards('if-clearable').count()) === 0, String(await cards('if-clearable').count()));
ok('FI12: nút Xóa tất cả ẨN khi 0 file', (await clearBtn.count()) === 0);
await sleep(600); // debounce validation sau clear
ok(
	'FI12: clear hết (required) → color-error (validation bung ĐÚNG nhịp, không bị kẹt success)',
	((await clearRoot.getAttribute('class')) ?? '').includes('color-error'),
	(await clearRoot.getAttribute('class')) ?? ''
);

console.log('\n=== FI13: QUICK DELETE (tick + xóa hàng loạt) ===');
const qdSection = section('if-quick-delete');
// Checkbox component KHÔNG render prop data-test lên DOM (BasicProps không
// spread) → tick locator qua wrapper span data-test (nằm ngoài Checkbox root).
const qdChecks = qdSection.locator('[data-test="input-file-check"] > .checkbox-root');
const qdBar = qdSection.locator('[data-test="input-file-quickbar"]');
const qdDelete = qdSection.locator('[data-test="input-file-quickbar-delete"]');
ok('FI13: ban đầu KHÔNG có quickbar', (await qdBar.count()) === 0);
await fileInput('if-quick-delete').setInputFiles([p('logo.png'), p('notes.txt'), p('cover.png')]);
await sleep(400);
ok('FI13: 3 cards, mỗi card có ô tick', (await cards('if-quick-delete').count()) === 3 && (await qdChecks.count()) === 3, `cards=${await cards('if-quick-delete').count()} checks=${await qdChecks.count()}`);
await qdChecks.nth(0).click();
await qdChecks.nth(1).click();
await sleep(250);
ok('FI13: tick 2 card → card có class input-file-selected', (await qdSection.locator('.input-file-card.input-file-selected').count()) === 2);
ok('FI13: tick 2 → quickbar hiện', (await qdBar.count()) === 1, String(await qdBar.count()));
ok('FI13: quickbar label "Xóa 2 tệp đã chọn"', (await qdDelete.textContent())?.includes('Xóa 2 tệp đã chọn'), (await qdDelete.textContent())?.trim());
ok('FI13: header "Đã chọn 2/3 tệp"', (await qdSection.locator('.input-file-selected-count').textContent())?.trim() === 'Đã chọn 2/3 tệp');
await qdDelete.click();
await sleep(400);
ok('FI13: xóa hàng loạt → còn 1 card', (await cards('if-quick-delete').count()) === 1, String(await cards('if-quick-delete').count()));
ok('FI13: quickbar ẨN sau khi xóa (selection rác được dọn)', (await qdBar.count()) === 0);
ok('FI13: card còn lại là cover.png (không bị tick)', (await cardNames('if-quick-delete'))[0] === 'cover.png', JSON.stringify(await cardNames('if-quick-delete')));
// untick: click lại ô đã tick → bỏ chọn
await qdChecks.nth(0).click();
await qdChecks.nth(0).click();
await sleep(200);
ok('FI13: tick rồi untick → KHÔNG có quickbar', (await qdBar.count()) === 0);

console.log('\n=== FI14: FILE DETAILS MODAL (click card → chi tiết) ===');
const dtSection = section('if-details');
const dtTrigger = dtSection.locator('[data-test="input-file-detail-trigger"]');
// Modal portal nằm ngoài section → scope page; chỉ 1 modal mở tại 1 thời điểm.
// Modal KHÔNG render prop data-test lên modal-root → role/đóng check qua .modal-root;
// data-test nằm ở grid trong Body (verify riêng).
const dtModal = page.locator('.modal-root');
const dtModalGrid = page.locator('[data-test="input-file-details-modal"]');
ok('FI14: ban đầu KHÔNG có modal chi tiết', (await dtModal.count()) === 0);
await fileInput('if-details').setInputFiles([p('logo.png'), p('notes.txt')]);
await sleep(450);
ok('FI14: 2 cards, mỗi card có nút mở chi tiết', (await cards('if-details').count()) === 2 && (await dtTrigger.count()) === 2, `cards=${await cards('if-details').count()} triggers=${await dtTrigger.count()}`);
await dtTrigger.first().click();
await sleep(450); // modal transition + portal mount
ok('FI14: click card ảnh → modal chi tiết mở (role=dialog)', (await dtModal.count()) === 1 && (await dtModal.getAttribute('role')) === 'dialog');
ok('FI14: grid Body có data-test (Modal không render data-test lên root)', (await dtModalGrid.count()) === 1);
const modalTitle = await dtModal.locator('.modal-header-root').textContent();
ok('FI14: modal title = tên file', modalTitle?.includes('logo.png'), modalTitle?.trim());
const detailRows = await dtModal.locator('.input-file-detail-row').allTextContents();
const detailText = detailRows.join('\n');
ok(
	'FI14: chi tiết có Kích thước (bytes format + số bytes)',
	/Kích thước/.test(detailText) && detailText.includes(`${logoSize} B`) && detailText.includes(`${logoSize} bytes`),
	detailRows.find((r) => r.includes('Kích thước'))?.trim()
);
ok(
	'FI14: chi tiết có Loại tệp (mime image/png)',
	/Loại tệp/.test(detailText) && /image\/png/.test(detailText),
	detailRows.find((r) => r.includes('Loại tệp'))?.trim()
);
ok(
	'FI14: chi tiết có Sửa lần cuối (định dạng ngày giờ)',
	/Sửa lần cuối/.test(detailText) && /\d{4}/.test(detailText),
	detailRows.find((r) => r.includes('Sửa lần cuối'))?.trim()
);
ok(
	'FI14: chi tiết KHÔNG có đường dẫn full (File API chỉ có name — webkitRelativePath trống thì ẩn)',
	!/Đường dẫn tương đối/.test(detailText),
	'(webkitRelativePath = "" → row ẩn đúng)'
);
const detailImg = await dtModal.locator('.input-file-detail-image').getAttribute('src').catch(() => null);
ok('FI14: ảnh size gốc trong modal (src blob:, object-contain)', !!detailImg && detailImg.startsWith('blob:'));
const imgFit = await dtModal.locator('.input-file-detail-image').evaluate((el) => getComputedStyle(el).objectFit);
ok('FI14: ảnh object-fit contain (không crop)', imgFit === 'contain', imgFit);
// Đóng modal (nút × trong Header) → modal đóng
await dtModal.locator('.modal-close-button').click();
await sleep(400);
ok('FI14: nút × đóng modal', (await dtModal.count()) === 0, String(await dtModal.count()));
// Mở chi tiết file text → preview text (không ảnh)
await dtTrigger.nth(1).click();
await sleep(450);
const detailPre = await dtModal.locator('.input-file-detail-preview-text').textContent().catch(() => null);
ok('FI14: card text → modal hiện preview text (không ảnh)', detailPre?.includes('file notes line 1') === true, detailPre?.slice(0, 30));
await dtModal.locator('.modal-close-button').click();
await sleep(300);
// ESC đóng modal
await dtTrigger.first().click();
await sleep(350);
await page.keyboard.press('Escape');
await sleep(350);
ok('FI14: ESC đóng modal chi tiết', (await dtModal.count()) === 0, String(await dtModal.count()));

console.log('\n=== FI15: MULTIPLE append với fileDetails bật (vẫn hoạt động) ===');
const dtInput = fileInput('if-details');
// FI14 để lại 2 cards (logo.png + notes.txt) → set thêm cover.png → append → 3
await dtInput.setInputFiles([p('cover.png')]);
await sleep(350);
ok('FI15: fileDetails + multiple → chọn thêm appends (3 cards)', (await cards('if-details').count()) === 3, String(await cards('if-details').count()));

console.log('\n=== FI15b: SINGLE thay thế vẫn hoạt động (if-single lặp lại) ===');
await fileInput('if-single').setInputFiles([p('logo.png')]);
await sleep(350);
ok('FI15b: single → chọn mới thay thế (1 card, logo.png)', (await cards('if-single').count()) === 1 && (await cardNames('if-single'))[0] === 'logo.png', JSON.stringify(await cardNames('if-single')));

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
// Số nhiều (mkdir mới) — đúng quy trình (5+ ảnh: previews + modal chi tiết +
// quick delete bar + clear button + error color).
const shotDir = 'tests/screenshots/input-file';
mkdirSync(shotDir, { recursive: true });
// 01: single (đang có logo.png card sau FI15b)
await section('if-single').screenshot({ path: `${shotDir}/01-single.png` });
// 02: multiple (đang có 2 cards + dropzone)
await section('if-multiple').screenshot({ path: `${shotDir}/02-multiple.png` });
// 03: required-error (đang ở trạng thái color-error sau FI6)
await section('if-required').screenshot({ path: `${shotDir}/03-required-error.png` });
// 04: preview (3 cards csv/json/txt)
await section('if-preview').screenshot({ path: `${shotDir}/04-preview.png` });
// 05: form (đã submit → "Đã submit ✓" + cards)
await section('if-form').screenshot({ path: `${shotDir}/05-form.png` });
// 06: disabled
await section('if-disabled').screenshot({ path: `${shotDir}/06-disabled.png` });

// ── Screenshots mới (tùy chọn type='file') ──
// 07: clearable (chọn lại 2 file sau FI12 — nút Xóa tất cả hiện ở header)
await fileInput('if-clearable').setInputFiles([p('logo.png'), p('notes.txt')]);
await sleep(400);
await section('if-clearable').screenshot({ path: `${shotDir}/07-clearable.png` });
await clearBtn.click(); // dọn lại cho các screenshot sau không lệch state
await sleep(400);
// 08: quick delete (tick 2 card → quickbar hiện)
await fileInput('if-quick-delete').setInputFiles([p('logo.png'), p('notes.txt'), p('cover.png')]);
await sleep(400);
await qdChecks.nth(0).click();
await qdChecks.nth(1).click();
await sleep(300);
await section('if-quick-delete').screenshot({ path: `${shotDir}/08-quick-delete.png` });
// dọn selection
await qdDelete.click();
await sleep(300);
// 09: file details modal (click card ảnh → modal)
await fileInput('if-details').setInputFiles([p('logo.png'), p('cover.png')]);
await sleep(400);
await dtTrigger.first().click();
await sleep(500);
await page.screenshot({ path: `${shotDir}/09-details-modal.png` });
await dtModal.locator('.modal-close-button').click();
await sleep(300);
// 10: details section (2 cards với nút chi tiết)
await section('if-details').screenshot({ path: `${shotDir}/10-details-cards.png` });
// 11: error color remove button (hover state khó chụp — chụp card remove + preview error)
await section('if-preview').screenshot({ path: `${shotDir}/11-remove-error.png` });

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
