// input-file-probe.mjs
// Functional probe cho task "hoàn thiện #input (thêm type='file')":
// - FI0  page render (data-test=input-demo, 6 sections file)
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
// Chạy: node tests/input-file-probe.mjs (dev server phải chạy ở https://localhost:3000)
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://localhost:3000/ui/input';
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
const fileSections = ['if-single', 'if-multiple', 'if-required', 'if-preview', 'if-form', 'if-disabled'];
const sectionCount = await Promise.all(fileSections.map((s) => section(s).count()));
ok('FI0: 6 sections file render', sectionCount.every((c) => c === 1), JSON.stringify(sectionCount));
const dropzones = await page.locator('.input-file-dropzone').count();
ok('FI0: 6 dropzone render', dropzones === 6, String(dropzones));

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

// ── Screenshots cho ui-checker ──
console.log('\n=== SCREENSHOTS ===');
const shotDir = 'tests/screenshot/input-file';
mkdirSync(shotDir, { recursive: true });
// 01: single (đang có cover.png card sau FI2 replace)
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

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
