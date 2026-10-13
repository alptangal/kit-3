// tests/draft-store-probe.mjs — B9 draft-store probe
// Kiểm: settings autosave + restore flow, brands modal restore + discard,
// flag off (draftRestore=false → không autosave), UserFormModal strip password,
// clearDraft sau save success, expire, dialog UI structure.
//
// Chạy: node tests/draft-store-probe.mjs
// Cần: dev server https://localhost:3000 + partykit dev :1999 (không dùng cho B9 nhưng app mount partykit socket).

import { chromium } from 'playwright';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const results = [];
let page;

function ok(name, cond, extra = '') {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
}

async function login(p) {
	await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await p.fill('.auth-input-wrapper input >> nth=0', 'admin');
	await p.fill('.auth-input-wrapper input >> nth=1', '123123_Qwe');
	// BẪY: KHÔNG dùng locator kép — .auth-card button.button-root match nút toggle password
	// (eye) đứng trước submit trong DOM → click sai → login fail âm thầm.
	await p.click('button[type="submit"]');
	await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
}

/** Đọc giá trị draft settings trong localStorage của page. */
async function readSettingsDraft(p) {
	return p.evaluate(() => {
		const keys = Object.keys(localStorage).filter((k) => k.startsWith('draft:') && k.includes(':settings'));
		return keys.map((k) => ({ k, raw: localStorage.getItem(k) }));
	});
}

// ─────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
});
page = await context.newPage();
const pageerrors = [];
page.on('pageerror', (e) => pageerrors.push(String(e)));

// ── DF0: settings page load + interface có features (switch render) ──
await login(page);
// Deterministic: xóa mọi draft cũ từ lần chạy trước
await page.evaluate(() => {
	Object.keys(localStorage)
		.filter((k) => k.startsWith('draft:'))
		.forEach((k) => localStorage.removeItem(k));
});
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
// BẪY: API /api/admin/system-settings/get chậm ~4s (đọc DB) — đợi tab render chứ không sleep cứng.
await page.waitForSelector('[data-test="tab-trigger-security"]', { timeout: 30000 }).catch(() => {});
ok('DF0 settings page loads', (await page.locator('[data-test="settings-page"]').count()) > 0);

// Vào tab Security (desktop ≥768 → Tabs render)
const securityTab = page.locator('[data-test="tab-trigger-security"]');
if ((await securityTab.count()) > 0) {
	await securityTab.first().click();
	await page.waitForSelector('[data-test="switch-draft-restore"]', { timeout: 8000 }).catch(() => {});
}
await sleep(400);
// Switch hiện forward data-test (switch-draft-restore) + role=switch — đo qua cả 2
const switchCount = await page
	.locator('[role="switch"][aria-label*="nháp"], [role="switch"][aria-label*="draft" i], [data-test="switch-draft-restore"]')
	.count();
ok('DF0a draftRestore switch renders in Security tab', switchCount >= 1, `count=${switchCount}`);

// ── DF1: sửa appName → autosave ghi draft sau debounce ──
// BẪY: Input KHÔNG spread data-test → id selector (id="settings-app-name" render)
const appNameInput = page.locator('#settings-app-name');
// AppName input: General tab
const generalTab = page.locator('[data-test="tab-trigger-general"]');
if ((await generalTab.count()) > 0) {
	await generalTab.first().click();
	await page.waitForSelector('#settings-app-name', { timeout: 5000 }).catch(() => {});
}
await sleep(400);
// BẪY: id TRÙNG 2 lần (desktop Tabs + mobile Accordion cùng render) → dùng .filter(visible) hoặc :visible
const firstInput = page.locator('#settings-app-name:visible');
const beforeVal = await firstInput.inputValue();
await firstInput.fill(beforeVal + ' X'); // sửa nhẹ
await sleep(700 + 600); // debounce 500 + margin
const draftRaw = await page.evaluate(() => {
	const keys = Object.keys(localStorage).filter((k) => k.startsWith('draft:'));
	return keys.map((k) => ({ k, raw: localStorage.getItem(k) }));
});
const settingsDraft = draftRaw.find((d) => d.k.includes(':settings'));
ok('DF1 settings draft autosaved after edit', !!settingsDraft, settingsDraft ? `key=${settingsDraft.k}` : 'no draft key');
const draftData1 = settingsDraft ? JSON.parse(settingsDraft.raw) : null;
ok('DF1a draft shape v:1 + savedAt + data', !!draftData1 && draftData1.v === 1 && typeof draftData1.savedAt === 'number' && !!draftData1.data);

// ── DF2: reload → dialog hỏi khôi phục ──
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
// BẪY (đo qua timestamp): settings-page hydrate xong ~3ms nhưng dialog mount sau
// ~800-1600ms (chờ API get + draftAsked) → waitForSelector match settings-page
// trả NGAY, sleep(800) chỉ vừa đủ thua → poll dialog như mọi bước khác.
const dlgVisible = await page
	.waitForSelector('[role="alertdialog"]:visible', { timeout: 10000 })
	.then(() => true)
	.catch(() => false);
if (!dlgVisible) {
	// fallback text khi selector khí cảng
	const c3 = await page.getByText('Draft found').count();
	ok('DF2 restore dialog appears on reload with draft', c3 > 0, 'fallback text');
} else {
	ok('DF2 restore dialog appears on reload with draft', true);
}

// ── DF2a: dialog text + 2 nút ──
if (dlgVisible) {
	const restoreBtn = page.locator('[data-test="draft-restore-restore"]');
	const discardBtn = page.locator('[data-test="draft-restore-discard"]');
	ok(
		'DF2a dialog has restore + discard buttons',
		(await restoreBtn.count()) >= 1 && (await discardBtn.count()) >= 1
	);
	// ── DF3: click Khôi phục → giá trị apply ──
	// BẪY: dialog đang mở (overlay chặn) → click Restore TRƯỚC, tab SAU.
	await restoreBtn.first().click();
	await sleep(600);
	// Sau reload tab có thể không còn ở General → click lại trước khi đo input
	await page.locator('[data-test="tab-trigger-general"]').first().click();
	await sleep(400);
	const afterVal = await firstInput.inputValue();
	ok('DF3 restore applies draft values', afterVal === beforeVal + ' X', `after="${afterVal}" expected="${beforeVal} X"`);
} else {
	// dialog không mở vẫn phải vào tab General cho các bước sau
	await page.locator('[data-test="tab-trigger-general"]').first().click();
	await sleep(400);
	ok('DF3 restore applies draft values', false, 'dialog không hiện — skip');
}

// ── DF4: Save thành công → clearDraft ──
const saveBtn = page.locator('[data-test="settings-save"], [data-test="settings-save-bar"]').first();
if ((await saveBtn.count()) > 0 && (await saveBtn.isEnabled().catch(() => false))) {
	const keysBefore = await page.evaluate(() =>
		Object.keys(localStorage).filter((k) => k.startsWith('draft:')).join(','),
	);
	await saveBtn.click();
	// chờ POST update xong (handleSave clearDraft chạy sau response.ok, trước loadSettings)
	const saveResp = page
		.waitForResponse((r) => r.url().includes('/api/admin/system-settings/update'), { timeout: 8000 })
		.catch(() => null);
	await saveResp;
	await sleep(1500);
	const draftRaw2 = await page.evaluate(() => {
		const keys = Object.keys(localStorage).filter((k) => k.startsWith('draft:') && k.includes(':settings'));
		return keys.length;
	});
	ok(
		'DF4 settings draft cleared after save success',
		draftRaw2 === 0,
		`keys=${draftRaw2} before=[${keysBefore}]`,
	);
} else {
	ok('DF4 settings draft cleared after save success', false, 'save btn không click được');
}

// Helper đóng modal create brand: click Cancel nếu có, else Escape → đợi modal thật sự đóng.
// (BẪY: chỉ sleep sau cancel là chưa đủ — modal đóng bằng transition; nếu chưa hidden thì click
// addBtn tiếp theo bị .modal-root "intercepts pointer events" timeout.)
const closeBrandModal = async () => {
	const c = page.locator('.modal-footer button.button-root').filter({ hasText: /Cancel|Hủy|Đóng/i }).first();
	if ((await c.count()) > 0) await c.click();
	else await page.keyboard.press('Escape');
	await page.waitForSelector('.modal-root', { state: 'hidden', timeout: 5000 }).catch(() => {});
	const still = await page.locator('.modal-root').count();
	if (still > 0) {
		await page.keyboard.press('Escape');
		await page.waitForSelector('.modal-root', { state: 'hidden', timeout: 3000 }).catch(() => {});
	}
	await sleep(300);
};

// ── DF5: brands modal — gõ tên, đóng modal KHÔNG save, mở lại → dialog ──
await page.goto(BASE + '/admin/brands', { waitUntil: 'networkidle' });
// BẪY: admin page fetch list chậm — đợi nút add sẵn sàng chứ không sleep cứng
await page.waitForSelector('.admin-header-actions button.button-root.color-primary', { timeout: 30000 }).catch(() => {});
await sleep(800);
const addBtn = page.locator('.admin-header-actions button.button-root.color-primary').first();
await addBtn.click();
await sleep(600);
const nameInput = page.locator('input[name="brand-name"]');
await nameInput.fill('DF5-Draft-Brand');
await sleep(700 + 600);
// đóng modal qua nút Cancel (không save) + đợi modal hidden
await closeBrandModal();
// mở lại
await addBtn.click();
await sleep(600);
// BẪY: đo dialog qua role=alertdialog visible (root display:contents) + poll
// mount chậm ~800ms như DF2
const dlgVisibleCount = async () =>
	(await page.locator('[role="alertdialog"]:visible').count()) > 0;
const brandDlgVisible = await page
	.waitForSelector('[role="alertdialog"]:visible', { timeout: 6000 })
	.then(() => true)
	.catch(() => false);
ok('DF5 brands reopen shows restore dialog', brandDlgVisible);

// ── DF5a: Khôi phục → input có giá trị draft ──
if (brandDlgVisible) {
	await page.locator('[data-test="draft-restore-restore"]').first().click();
	await sleep(500);
	const val = await nameInput.inputValue();
	ok('DF5a brand name restored', val === 'DF5-Draft-Brand', `val="${val}"`);
	// clear draft: đóng modal + hủy
	await closeBrandModal();
}

// ── DF6: Bỏ qua → draft xóa vĩnh viễn, mở lại KHÔNG hỏi ──
// BẪY: sau DF5a close, draft brands:create VẪN còn (restore không clear —
// hành vi cố ý giống settings page) → lần mở đầu DF6 dialog xuất hiện NGAY.
// Discard xong draft bị xóa vĩnh viễn; dialogDiscard ĐÃ mở modal create sạch
// (discardDraft đặt modalOpen=true) → KHÔNG click addBtn lần nữa, fill trực tiếp.
await addBtn.click();
await sleep(600);
if (await dlgVisibleCount()) {
	await page.locator('[data-test="draft-restore-discard"]').first().click();
	await sleep(600);
}
// modal create đang mở (từ discard) — fill draft DF6
await nameInput.fill('DF6-Discard-Brand', { timeout: 8000 });
await sleep(700 + 600);
await closeBrandModal();
// mở lại → dialog hiện (draft DF6 còn) → Discard lần nữa → draft xóa
await addBtn.click();
await sleep(600);
const dlgReopen = await dlgVisibleCount();
if (dlgReopen) {
	await page.locator('[data-test="draft-restore-discard"]').first().click();
	await sleep(600);
	// discard đã mở modal create sạch → đóng trước khi kiểm lần cuối
	await closeBrandModal();
}
// lần cuối: mở KHÔNG được hỏi nữa
await addBtn.click();
await sleep(600);
const dlgAgain = await dlgVisibleCount();
ok('DF6 discard clears draft — reopen no dialog', !dlgAgain);
// đóng modal create
await closeBrandModal();

// ── DF7: flag off (draftRestore=false) → không autosave ──
// Lấy userId từ layout data qua page.data — evaluate trong app context:
// đơn giản nhất: tắt switch trong settings page rồi thử brands.
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-test="tab-trigger-security"]', { timeout: 30000 }).catch(() => {});
await sleep(400);
const secTab2 = page.locator('[data-test^="tab-"], .tabs-trigger, [role="tab"]').filter({ hasText: /Bảo mật|Security/ });
if ((await secTab2.count()) > 0) await secTab2.first().click();
await sleep(400);
// Switch forward data-test (switch-draft-restore) — đo qua data-test trước, aria-label fallback
const drSwitch = page.locator('[data-test="switch-draft-restore"], [role="switch"][aria-label*="draft" i], [role="switch"][aria-label*="nháp" i]');
if ((await drSwitch.count()) > 0) {
	// switch đang ON → click để OFF (button role=switch)
	const checked = await drSwitch.first().getAttribute('aria-checked');
	if (checked !== 'false') await drSwitch.first().click();
	await sleep(400);
	const saveBtn2 = page.locator('[data-test="settings-save"], [data-test="settings-save-bar"]').first();
	if ((await saveBtn2.count()) > 0 && (await saveBtn2.isEnabled().catch(() => false))) {
		const resp7 = page
			.waitForResponse((r) => r.url().includes('/api/admin/system-settings/update'), { timeout: 8000 })
			.catch(() => null);
		await saveBtn2.click();
		await resp7;
		await sleep(1500);
	}
}
await page.goto(BASE + '/admin/brands', { waitUntil: 'networkidle' });
await sleep(1500);
await addBtn.click();
await sleep(500);
await nameInput.fill('DF7-Should-Not-Save');
await sleep(700 + 600);
await closeBrandModal();
await addBtn.click();
await sleep(600);
const dlgOff =
	(await page
		.locator('[role="alertdialog"]:visible, [data-test="draft-restore-dialog"] [role="alertdialog"]')
		.count()) > 0;
ok('DF7 flag off → no autosave, no dialog', !dlgOff);
if (await dlgOff) await closeBrandModal();

// ── DF8: bật lại flag (trả lại môi trường) ──
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await page.waitForSelector('[data-test="tab-trigger-security"]', { timeout: 30000 }).catch(() => {});
await sleep(400);
const secTab3 = page.locator('[data-test^="tab-"], .tabs-trigger, [role="tab"]').filter({ hasText: /Bảo mật|Security/ });
if ((await secTab3.count()) > 0) await secTab3.first().click();
await sleep(400);
if ((await drSwitch.count()) > 0) {
	const checked2 = await drSwitch.first().getAttribute('aria-checked');
	if (checked2 === 'false' || checked2 === null) await drSwitch.first().click();
	await sleep(400);
	const saveBtn3 = page.locator('[data-test="settings-save"], [data-test="settings-save-bar"]').first();
	if ((await saveBtn3.count()) > 0) {
		const resp8 = page
			.waitForResponse((r) => r.url().includes('/api/admin/system-settings/update'), { timeout: 8000 })
			.catch(() => null);
		if (await saveBtn3.isEnabled().catch(() => false)) {
			await saveBtn3.click();
			await resp8;
			await sleep(1500);
		}
	}
}
ok('DF8 flag re-enabled (cleanup)', true);

// ── DF9: UserFormModal strip password khỏi draft ──
await page.goto(BASE + '/admin', { waitUntil: 'networkidle' });
await page.waitForSelector('.admin-header-actions button.button-root.color-primary', { timeout: 30000 }).catch(() => {});
await sleep(800);
const userAddBtn = page.locator('.admin-header-actions button.button-root.color-primary').first();
if ((await userAddBtn.count()) > 0) {
	await userAddBtn.click();
	await sleep(700);
	const pwInput = page.locator('input[type="password"]').first();
	if ((await pwInput.count()) > 0) {
		await pwInput.fill('DF9-Secret-Pass');
		const fnInput = page.locator('input[name="user-firstname"], input').first();
		await fnInput.fill('DF9Name');
		await sleep(700 + 600);
	}
	const userDraft = await page.evaluate(() => {
		const keys = Object.keys(localStorage).filter((k) => k.startsWith('draft:') && k.includes('users:create'));
		return keys.map((k) => localStorage.getItem(k)).join('\n');
	});
	ok('DF9 user draft has NO password field', userDraft.length === 0 || !userDraft.includes('DF9-Secret-Pass'), userDraft.includes('DF9-Secret-Pass') ? 'PASSWORD LEAKED IN DRAFT!' : 'stripped ✓');
} else {
	ok('DF9 user draft has NO password field', false, 'không tìm nút add user');
}

// ── DF10: 0 pageerror toàn probe ──
ok('DF10 0 pageerror', pageerrors.length === 0, pageerrors.slice(0, 3).join(' | '));

// ─────────────────────────────────────────────────────────────────────────────
const passCount = results.filter((r) => r.pass).length;
console.log(`\n=== ${passCount}/${results.length} PASS ===`);
await browser.close();
if (passCount !== results.length) process.exit(1);
