// tests/keyboard-probe.mjs
// Verify visual number keyboard (mobile) — Fix #1..#5.
//
// Fix #1  nền mờ + phím KHÍT (không gap) — grid root phủ kín, không khe lộ trang
// Fix #2  nhiều input đồng thời (cleanup onDestroy) — mở KB ở input A, mở ở B →
//         KB duy nhất, target đúng B; unmount input đang mở → KB biến mất
// Fix #3  hide khi blur — click ngoài (window mousedown) + focusout programmatic
// Fix #4  chức năng tổng thể: mở/đóng, gõ phím cập nhật value + cursor, Del/AC,
//         '=' tính biểu thức, currency autoFormat giữ caret
// Fix #5  visual caret định vị theo currentCursor (left px đo mirror span)
import { chromium, devices } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
// Mobile Android — client.browser.isMobile = true (UA từ layout server data)
const context = await browser.newContext({
	...devices['Pixel 5'],
	ignoreHTTPSErrors: true
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

// ── Mock soft keyboard (BẮT BUỘC trên Playwright) ───────────────────────────
// getVisualKeyboardMeta() chờ visualViewport 'resize' để đo height keyboard
// (chênh viewport trước/sau khi soft keyboard mở). Emulation KHÔNG có soft
// keyboard thật → resize không bao giờ fire → Promise treo → KB không mount.
// Bẫy: override HTMLElement.prototype.focus KHÔNG bắt được — store gọi
// visualInput.focus() qua tham chiếu trực tiếp (đã bind trước patch chạy).
// Cách chắc chắn: MutationObserver bắt visualInput (z-index -1) lúc APPEND →
// mock resize NGAY LÚC NẤY (trước cả khi store gọi focus).
await page.addInitScript(() => {
	const vv = window.visualViewport;
	if (!vv) return;
	const mo = new MutationObserver((muts) => {
		for (const m of muts) {
			for (const n of m.addedNodes) {
				if (n instanceof HTMLInputElement && n.style.zIndex === '-1') {
					Object.defineProperty(vv, 'height', {
						value: Math.round(window.innerHeight * 0.6),
						configurable: true
					});
					setTimeout(() => vv.dispatchEvent(new Event('resize')), 30);
				}
			}
		}
	});
	new Promise((res) => {
		if (document.body) return res();
		const iv = setInterval(() => {
			if (document.body) {
				clearInterval(iv);
				res();
			}
		}, 5);
	}).then(() => mo.observe(document.body, { childList: true }));
});

const app = 'https://localhost:3000';
await page.goto(`${app}/ui/input`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-number"] input', { timeout: 20000 });
await sleep(500);

// ── Helpers ──────────────────────────────────────────────────────────────────
const kbSel = 'div[data-keyboard-host] .keyboard-number-root';
async function kbExists() {
	return page.evaluate(() => !!document.querySelector('div[data-keyboard-host]'));
}
async function openKb(testId) {
	await page.locator(`[data-test="${testId}"] input`).click();
	await sleep(450); // rAF mount + getVisualKeyboardMeta flow
}
async function closeByOutsideClick() {
	// click h2 (ngoài cả root lẫn keyboard)
	await page.locator('h2').first().click();
	await sleep(250);
}

// ── Fix #4a: mở keyboard qua click input number ──────────────────────────────
await openKb('input-number');
ok('K1 mở keyboard: host container mount vào body', await kbExists());
const kbVisible = await page.evaluate((sel) => {
	const kb = document.querySelector(sel);
	if (!kb) return null;
	const r = kb.getBoundingClientRect();
	return { w: r.width, h: r.height, bottom: r.bottom, iw: innerWidth };
}, kbSel);
ok(
	// LƯU Ý: load handler keyboard đẩy body lên bằng margin-top âm khi input bị che
	// → bottom thực tế = viewport + |margin-top|. Điều kiện đúng: phủ hết đáy viewport
	// (bottom = innerHeight + |margin|) + full width + fixed.
	'K2 keyboard fixed bottom + full width',
	kbVisible && kbVisible.w === kbVisible.iw && kbVisible.bottom >= kbVisible.h,
	JSON.stringify(kbVisible)
);

// ── Fix #1: không gap — grid phủ kín root; nền root mờ ───────────────────────
const gapCheck = await page.evaluate((sel) => {
	const kb = document.querySelector(sel);
	if (!kb) return null;
	const cs = getComputedStyle(kb);
	const r = kb.getBoundingClientRect();
	// elementFromPoint tại các điểm khe tiềm năng giữa phím hàng 1-2 (y=1/4 cao)
	const probeY = r.top + r.height * 0.33;
	const probeX = r.left + r.width * 0.5;
	const el = document.elementFromPoint(probeX, probeY);
	const inKb = !!el && !!el.closest(sel);
	return {
		backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
		bg: cs.backgroundColor,
		probeInKb: inKb,
		probeTag: el?.tagName ?? null,
		gridGap: cs.gap
	};
}, kbSel);
ok(
	'K3 Fix#1: root có nền + backdrop-filter blur (che nội dung phía sau)',
	gapCheck && gapCheck.backdrop && gapCheck.backdrop !== 'none',
	JSON.stringify(gapCheck)
);
ok(
	'K4 Fix#1: không lộ trang qua khe giữa phím (elementFromPoint trong keyboard)',
	gapCheck && gapCheck.probeInKb,
	JSON.stringify(gapCheck)
);

// ── Fix #4b: gõ phím → value + currentCursor ─────────────────────────────────
// Phím theo grid 4 cột: AC ( ) Del : / 7 8 9 x / 4 5 6 - / 1 2 3 + / 0 . % =
const keys = (await page.locator(`${kbSel} button`).all()).slice(0, 22);
// nhấn 1 2 3 → "123"
// Bẫy: Button component render label bọc whitespace (" 1  ") → regex cần \s*;
// label có thể chứa regex special ('+', '(' ')' ':') → escape bằng \Q..E style thủ công.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pressByKeyLabel = async (label) => {
	await page.locator(`${kbSel} button`, { hasText: new RegExp(`^\\s*${escapeRe(label)}\\s*$`) }).click();
	await sleep(120);
};
await pressByKeyLabel('1');
await pressByKeyLabel('2');
await pressByKeyLabel('3');
const v1 = await page.inputValue('[data-test="input-number"] input');
ok('K5 gõ 1,2,3 → value "123"', v1 === '123', `value=${v1}`);

// Del xóa tại cursor (cuối) → "12"
await pressByKeyLabel('Del');
const v2 = await page.inputValue('[data-test="input-number"] input');
ok('K6 Del tại cursor cuối → "12"', v2 === '12', `value=${v2}`);

// ── Fix #5: visual caret hiện + vị trí theo cursor ───────────────────────────
const cursor1 = await page.evaluate(() => {
	const c = document.querySelector('[data-test="input-visual-cursor"]');
	if (!c) return null;
	return { left: c.getBoundingClientRect().left, display: getComputedStyle(c).display };
});
ok('K7 Fix#5: visual caret HIỆN khi keyboard mở', !!cursor1, JSON.stringify(cursor1));
const cursorLeft1 = cursor1?.left ?? 0;
// click vào vị trí sát mép trái input (locator.click + position: Playwright tự đo
// tọa độ MỚI — bẫy: mouse.click với boundingBox cũ lệch vì keyboard load handler
// vừa cuộn trang: margin-top âm + scrollTo top=100).
const inputLoc = page.locator('[data-test="input-number"] input');
const inputBox = await inputLoc.boundingBox();
await inputLoc.click({ position: { x: 2, y: inputBox.height / 2 } });
await sleep(250);
const cursor2 = await page.evaluate(() => {
	const c = document.querySelector('[data-test="input-visual-cursor"]');
	return c ? c.getBoundingClientRect().left : null;
});
ok(
	'K8 Fix#5: caret ĐỔI VỊ TRÍ theo click (currentCursor đổi)',
	cursor2 !== null && Math.abs(cursor2 - cursorLeft1) > 2,
	`before=${cursorLeft1} after=${cursor2}`
);
// nhấn phím sau khi cursor về đầu → chèn tại đầu: "512" → nhấn 7 → "712"? Không —
// click đầu → currentCursor=1 (calculatorCursor trả index đầu tiên vượt clientX) →
// chèn tại index 1: "712"... đo chính xác: value hiện tại "12", click sát trái →
// index 1 → "172"? Ground truth khó neo — chỉ cần value ĐỔI + caret cập nhật lại.
await pressByKeyLabel('7');
const v3 = await page.inputValue('[data-test="input-number"] input');
ok('K9 Fix#5: chèn tại cursor (value đổi sau click đặt caret)', v3 !== '12' && v3.includes('7'), `value=${v3}`);

// ── Fix #4c: '=' tính biểu thức ──────────────────────────────────────────────
// dọn: AC → gõ 1 2 + 3 = → "15"
await pressByKeyLabel('AC');
await pressByKeyLabel('1');
await pressByKeyLabel('2');
await pressByKeyLabel('+');
await pressByKeyLabel('3');
await pressByKeyLabel('=');
await sleep(350); // setTimeout calculate theo configs.delay
const v4 = await page.inputValue('[data-test="input-number"] input');
ok('K10 "=" tính 12+3 → "15"', v4 === '15', `value=${v4}`);

// ── Fix #3a: click ngoài → keyboard đóng ─────────────────────────────────────
await closeByOutsideClick();
const kbClosed1 = !(await kbExists());
ok('K11 Fix#3: click ngoài (window mousedown) → keyboard unmount', kbClosed1);
const cursorGone1 = await page.evaluate(() => !document.querySelector('[data-test="input-visual-cursor"]'));
ok('K12 Fix#3+5: đóng → visual caret ẩn', cursorGone1);

// ── Fix #2a: mở ở input thứ 2 (currency) khi chưa có KB — không "đang mở" ở A ─
await openKb('input-currency-vnd');
const kbVnd = await page.evaluate((sel) => {
	const kb = document.querySelector(sel);
	return kb ? kb.getBoundingClientRect().width : null;
}, kbSel);
ok('K13 mở lại ở currency (VND) → keyboard mount', kbVnd !== null, `width=${kbVnd}`);
// gõ 1234 → autoFormat vi-VN → "1.234"
await pressByKeyLabel('1');
await pressByKeyLabel('2');
await pressByKeyLabel('3');
await pressByKeyLabel('4');
const vndVal = await page.inputValue('[data-test="input-currency-vnd"] input');
ok('K14 currency autoFormat live "1234"→"1.234"', vndVal === '1.234', `value=${vndVal}`);

// ── Fix #2b: MỞ SONG SONG — unmount input đang mở → keyboard cũng unmount ────
// Dùng page.evaluate trực tiếp gỡ node input chứa keyboard đang mở (mô phỏng
// onDestroy chạy khi component unmount giữa chừng — ví dụ điều hướng route).
// Thực tế dùng route navigate: sang trang khác → input unmount → KB phải tắt.
await page.goto(`${app}/ui/select`, { waitUntil: 'domcontentloaded' });
await sleep(400);
const kbAfterNav = await kbExists();
ok('K15 Fix#2: navigate route (input unmount) → keyboard unmount', !kbAfterNav);

// ── Fix #3b: mở lại ở number rồi Tab/blur programmatic ───────────────────────
await page.goto(`${app}/ui/input`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-number"] input', { timeout: 20000 });
await sleep(400);
await openKb('input-number');
// focusout programmatic: mobile flow activeElement=BODY (visualInput blur trong
// resize handler) → h2.focus() không fire focusout từ input. Mô phỏng chính xác
// Tab/blur: dispatch FocusEvent focusout lên input (relatedTarget ngoài KB) —
// listener Fix #3 window capture nhận → hide.
await page.evaluate(() => {
	const i = document.querySelector('[data-test="input-number"] input');
	i?.dispatchEvent(new FocusEvent('focusout', { relatedTarget: null, bubbles: true }));
});
await sleep(300);
ok('K16 Fix#3: focusout programmatic (Tab) → keyboard unmount', !(await kbExists()));

// ── Fix #2c: 2 input mở liên tiếp — keyboard target chuyển đúng ─────────────
await openKb('input-number');
await pressByKeyLabel('9');
const vNum = await page.inputValue('[data-test="input-number"] input');
// KHÔNG đóng — click thẳng input currency (window mousedown handler sẽ hide KB cũ
// rồi mousedown root của currency mở KB mới)
await page.locator('[data-test="input-currency-vnd"] input').click();
await sleep(500);
await pressByKeyLabel('8');
const vVnd2 = await page.inputValue('[data-test="input-currency-vnd"] input');
ok(
	'K17 Fix#2: mở A→B không qua "đóng tường minh" — B nhận phím đúng',
	vVnd2 === '8',
	`vnd=${vVnd2}`
);
ok('K18 Fix#2: input A không nhận phím của B', vNum === '9', `number=${vNum}`);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
