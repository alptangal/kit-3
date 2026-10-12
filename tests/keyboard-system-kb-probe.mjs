// keyboard-system-kb-probe.mjs
// Functional probe cho task "B3 — Number keyboard: kb hệ thống đè + phím full-cell".
//
// B3.1 basic.svelte.ts createInputVisual(): aria-hidden + tabIndex -1 (kb hệ thống
//      không focus được bằng Tab; a11y tree sạch).
// B3.2 input/Main.svelte:
//      - configs.focus() chỉ focus visualInput khi CHƯA có visualKeyboard
//        (kb hệ thống không được mở đè kb visual number).
//      - showVisualNumberKb() + hideVisualNumberKb() blur visualInput.
// B3.3 keyboard/number/Main.svelte: phím full-cell (grid 5 hàng minmax(0,1fr),
//      .button-root height 100% min-height 0) — đáy root khít hàng cuối.
//
// KB1  tap input number (mobile) → kb visual mount + visualKeyboard meta set
// KB2  tap ngoài → kb unmount + activeElement KHÔNG phải visualInput (blur)
// KB3  tap input lần 2 → kb mount LẠI, height không đổi, elementFromPoint là nút phím
// KB4  gõ phím → value input đổi (7 8 . 5 → "78.5")
// KB5  phím full-cell: mỗi .button-root cao ≈ rootH/5 (±2), đáy row cuối ≈ đáy root
// KB6  0 pageerror qua mọi context
// PC guard: desktop tap input number KHÔNG mount keyboard (isMobile false).
//
// Bẫy Playwright (từ keyboard-probe): visualViewport resize không fire khi không có
// soft keyboard thật → MutationObserver bắt visualInput append (z-index -1) → mock
// vv.height + dispatch resize NGAY LÚC NẤY.
// Chạy: node tests/keyboard-system-kb-probe.mjs (dev server https://localhost:3000)
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = `${process.env.PROBE_BASE || 'https://localhost:3000'}/ui/input`;
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync('tests/screenshots/keyboard', { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// Mock soft keyboard: khi store append visualInput (input fixed z-index -1) →
// định nghĩa vv.height = 60% viewport + dispatch 'resize' sau 30ms — đúng flow
// getVisualKeyboardMeta chờ.
const MOCK_VV = () => {
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
};

// ── Mobile context (Pixel 5 — isMobile UA) ──
const contextM = await browser.newContext({
	...devices['Pixel 5'],
	ignoreHTTPSErrors: true,
	baseURL: 'https://localhost:3000'
});
await contextM.addInitScript(MOCK_VV);
const page = await contextM.newPage();
const pageErrors = [];
page.on('pageerror', (e) => {
	pageErrors.push(e.message);
	console.log('PAGEERROR:', e.message);
});
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="input-number"] input', { timeout: 20000 });
await sleep(500);

const kbSel = 'div[data-keyboard-host] .keyboard-number-root';
const kbMounted = () => page.evaluate(() => !!document.querySelector('div[data-keyboard-host] .keyboard-number-root'));

console.log('\n=== KB1: TAP INPUT NUMBER → KB MOUNT + visualInput thuộc tính ===');
// visualInput phải tồn tại SAU tap (mousedown path createInputVisual/getVisualKeyboardMeta)
await page.locator('[data-test="input-number"] input').click();
await sleep(700);
const kb1 = await page.evaluate(() => {
	const kb = document.querySelector('.keyboard-number-root');
	const vis = [...document.querySelectorAll('body > input')].find(
		(i) => i.style.zIndex === '-1'
	);
	return {
		mounted: !!kb,
		visExists: !!vis,
		visAriaHidden: vis?.getAttribute('aria-hidden') ?? null,
		visTabIndex: vis?.tabIndex ?? null,
		kbH: kb ? kb.getBoundingClientRect().height : null,
		vkMetaSet: !!document.querySelector('[data-keyboard-host]')
	};
});
ok('KB1a: tap → kb visual mount', kb1.mounted, `mounted=${kb1.mounted}`);
ok('KB1b: visualInput tồn tại (body > input z-index -1)', kb1.visExists);
ok(
	'KB1c: visualInput aria-hidden=true + tabIndex=-1',
	kb1.visAriaHidden === 'true' && kb1.visTabIndex === -1,
	`aria-hidden=${kb1.visAriaHidden} tabIndex=${kb1.visTabIndex}`
);
const kbHeightFirst = kb1.kbH;

console.log('\n=== KB2: TAP NGOÀI → KB UNMOUNT + visualInput BLUR ===');
await page.locator('h2').first().click();
await sleep(400);
const kb2 = await page.evaluate(() => {
	const vis = [...document.querySelectorAll('body > input')].find(
		(i) => i.style.zIndex === '-1'
	);
	return {
		mounted: !!document.querySelector('.keyboard-number-root'),
		activeIsVis: document.activeElement === vis,
		activeTag: document.activeElement?.tagName ?? null
	};
});
ok('KB2a: tap ngoài → kb unmount', !kb2.mounted, `mounted=${kb2.mounted}`);
ok(
	'KB2b: activeElement KHÔNG phải visualInput (đã blur — kb hệ thống không nhảy lên)',
	!kb2.activeIsVis,
	`activeTag=${kb2.activeTag}`
);

console.log('\n=== KB3: TAP LẦN 2 → KB MOUNT LẠI (height ổn định, phím ở đúng điểm) ===');
await page.locator('[data-test="input-number"] input').click();
await sleep(700);
const h2v = await page.evaluate(() => {
	const kb = document.querySelector('.keyboard-number-root');
	if (!kb) return null;
	const r = kb.getBoundingClientRect();
	const cx = r.left + r.width * 0.125; // giữa cột 1 (AC)
	const cy = r.top + r.height / 10; // giữa hàng 1
	const el = document.elementFromPoint(cx, cy);
	return {
		height: r.height,
		probeIsBtn: !!el && !!el.closest('.button-root'),
		probeLabel: el?.textContent?.trim() ?? null,
		vkMetaStable: !!document.querySelector('[data-keyboard-host]')
	};
});
ok('KB3a: tap lần 2 → kb mount LẠI', h2v != null, `height=${h2v?.height}`);
ok(
	'KB3b: height không đổi giữa 2 lần mở (kb hệ thống không đè)',
	kbHeightFirst != null && h2v != null && Math.abs(kbHeightFirst - h2v.height) <= 2,
	`h1=${kbHeightFirst} h2=${h2v?.height}`
);
ok(
	'KB3c: elementFromPoint giữa phím AC là .button-root (không khe)',
	h2v?.probeIsBtn === true,
	`label="${h2v?.probeLabel}"`
);

console.log('\n=== KB4: GÕ PHÍM → VALUE ĐỔI ===');
const pressKey = async (label) => {
	// BẪY: label có thể là regex special ('.', '(', ')', ':', '=', '+') → escape.
	// Không escape → '.' match MỌI nút 1 ký tự, first() = '(' → gõ sai (78.5 → 78(5).
	const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	await page
		.locator(`${kbSel} button`, { hasText: new RegExp(`^\\s*${esc}\\s*$`) })
		.first()
		.click();
	await sleep(120);
};
await pressKey('7');
await pressKey('8');
await pressKey('.');
await pressKey('5');
const v4 = await page.inputValue('[data-test="input-number"] input');
ok('KB4: 7 8 . 5 → "78.5"', v4 === '78.5', `value="${v4}"`);

console.log('\n=== KB5: PHÍM FULL-CELL — 5 HÀNG KHÍT ĐÁY ROOT ===');
const kb5 = await page.evaluate(() => {
	const kb = document.querySelector('.keyboard-number-root');
	if (!kb) return null;
	const r = kb.getBoundingClientRect();
	const btns = [...kb.querySelectorAll(':scope > .button-root')];
	const wrapDivs = [...kb.querySelectorAll(':scope > div')];
	const wrapBtns = wrapDivs.flatMap((d) => [...d.querySelectorAll('.button-root')]).map((b) => b.getBoundingClientRect().height);
	const allH = [...btns.map((b) => b.getBoundingClientRect().height), ...wrapBtns];
	const rootPadBottom = parseFloat(getComputedStyle(kb).paddingBottom) || 0;
	// cell = (rootH - padding-bottom) / 5 — grid 5 hàng nằm TRÊN vùng padding
	const expected = (r.height - rootPadBottom) / 5;
	// đáy row cuối: nút "0" (cột 1 hàng 5) — bottom gần đáy root (padding-bottom 16px tính riêng)
	const zero = btns[btns.length - 1]?.getBoundingClientRect();
	return {
		rootH: r.height,
		padBottom: rootPadBottom,
		expected,
		minH: Math.min(...allH),
		maxH: Math.max(...allH),
		btnCount: btns.length,
		wrapCount: wrapDivs.length,
		zeroBottomGap: zero ? Math.abs(r.bottom - rootPadBottom - zero.bottom) : null,
		zeroH: zero?.height ?? null
	};
});
ok('KB5a: 19 nút con trực tiếp (AC/Del/: + 16 số) + 1 div bọc ( )', kb5?.btnCount === 19 && kb5?.wrapCount === 1, JSON.stringify(kb5));
ok(
	'KB5b: mọi phím cao ≈ (rootH−padding)/5 (±2px) — full-cell không còn min-height 2.5rem',
	kb5 && Math.abs(kb5.minH - kb5.expected) <= 2 && Math.abs(kb5.maxH - kb5.expected) <= 2,
	`expected=${kb5?.expected?.toFixed(1)} min=${kb5?.minH?.toFixed(1)} max=${kb5?.maxH?.toFixed(1)}`
);
ok(
	'KB5c: đáy hàng cuối khít đáy root (chừa đúng padding-bottom)',
	kb5 && kb5.zeroBottomGap !== null && kb5.zeroBottomGap <= 1.5,
	`gap=${kb5?.zeroBottomGap?.toFixed(2)}`
);

// ── Screenshot: keyboard full-cell trên input number ──
const shotEl = await page.locator('[data-keyboard-host]');
if ((await shotEl.count()) > 0) {
	// keyboard fixed — chụp cả page cho đủ ngữ cảnh input + keyboard
	await sleep(200);
	await page.screenshot({ path: 'tests/screenshots/keyboard/kb-virtual-375.png' });
}

console.log('\n=== KB6: 0 PAGEERROR (mobile) ===');
ok('KB6a: 0 pageerror (mobile context)', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 150));

console.log('\n=== KB-REF: TAP NGOÀI → MỞ LẠI (screenshot refocus) ===');
await page.locator('h2').first().click();
await sleep(400);
ok('KB-REFa: đóng lần 2 OK', !(await kbMounted()));
await page.locator('[data-test="input-number"] input').click();
await sleep(700);
ok('KB-REFb: mở lần 3 OK (không kẹt state)', await kbMounted());
await page.screenshot({ path: 'tests/screenshots/keyboard/kb-refocus-375.png' });

console.log('\n=== PC GUARD: DESKTOP KHÔNG MOUNT KB ===');
const contextPC = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const pagePC = await contextPC.newPage();
const pcErrors = [];
pagePC.on('pageerror', (e) => pcErrors.push(e.message));
await pagePC.goto(BASE, { waitUntil: 'domcontentloaded' });
await pagePC.waitForSelector('[data-test="input-number"] input', { timeout: 20000 });
await sleep(400);
await pagePC.locator('[data-test="input-number"] input').click();
await sleep(500);
const pcState = await pagePC.evaluate(() => ({
	mounted: !!document.querySelector('.keyboard-number-root'),
	visExists: [...document.querySelectorAll('body > input')].some((i) => i.style.zIndex === '-1')
}));
ok('PC: desktop tap input number → KHÔNG mount kb', !pcState.mounted && !pcState.visExists, JSON.stringify(pcState));
ok('PC: 0 pageerror (desktop)', pcErrors.length === 0, pcErrors.join(' | ').slice(0, 150));

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(' -', f.name, f.extra));
	process.exit(1);
}
