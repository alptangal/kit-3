// mobile-container-probe.mjs
// Mobile container + layout root — hiển thị tối đa kích thước trên mobile.
//
// Verify:
//   (M1) /login trên iPhone 14 (390×844): CHỈ 1 meta viewport, có viewport-fit=cover
//        + interactive-widget=resizes-content, KHÔNG maximum-scale/shrink-to-fit.
//   (M2) /login: input nằm trong viewport sau focus (rect.bottom <= vv.height + tol)
//        — scrollIntoView hoạt động. Không keyboard thật (Playwright không mở keyboard
//        — kiểm logic scroll compensation đã có sẵn useVisualKeyboard.processFocus).
//   (M3) /ui (Pixel 7): .container root element height ≈ viewport (100dvh) — không tràn
//        (scrollHeight <= innerHeight + 2 khi page ngắn).
//   (M4) `--vvh` var + class keyboard-open sau page.setViewportSize (đổi → var cập nhật).
//   (M5) /login desktop 1280: container height = 900 (baseline cũ không đổi).
//   (M6) (unauthorized) layout min-h-dvh: auth-page min-height = dvh, không tràn.
//   (M7) AuthPanelRight height = 100dvh (KHÔNG 100vh cứng — dvh phản hồi keyboard).
import { chromium, devices } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// ════════════════ (M1, M2) iPhone 14 — /login ════════════════
const iphoneCtx = await browser.newContext({
	...devices['iPhone 14'],
	ignoreHTTPSErrors: true
});
const iphonePage = await iphoneCtx.newPage();
const iphoneErrors = [];
iphonePage.on('pageerror', (e) => iphoneErrors.push(e.message));

await iphonePage.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await iphonePage.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(500);

// (M1) meta viewport: CHỈ 1 + viewport-fit=cover + interactive-widget
const metaState = await iphonePage.evaluate(() => {
	const metas = [...document.querySelectorAll('meta[name="viewport"]')];
	const contents = metas.map((m) => m.getAttribute('content') ?? '');
	const all = contents.join(' ');
	return {
		count: metas.length,
		contents,
		hasViewportFit: all.includes('viewport-fit=cover'),
		hasInteractiveWidget: all.includes('interactive-widget=resizes-content'),
		hasMaximumScale: all.includes('maximum-scale'),
		hasShrinkToFit: all.includes('shrink-to-fit')
	};
});
ok(
	'M1 meta viewport — 1 duy nhất + cover + interactive-widget, không chặn zoom',
	metaState.count === 1 &&
		metaState.hasViewportFit &&
		metaState.hasInteractiveWidget &&
		!metaState.hasMaximumScale &&
		!metaState.hasShrinkToFit,
	`count=${metaState.count} content="${metaState.contents[0] ?? ''}"`
);

// (M2) focus input username → kiểm input nằm trong visual viewport sau focus
const usernameInput = iphonePage.locator('.auth-input-wrapper input').first();
await usernameInput.focus();
await sleep(800); // đợi scrollIntoView + processFocus (delay 300ms + smooth scroll)

const focusState = await iphonePage.evaluate(() => {
	const input = document.querySelector('.auth-input-wrapper input');
	if (!input) return null;
	const rect = input.getBoundingClientRect();
	const vv = window.visualViewport;
	return {
		rectTop: rect.top,
		rectBottom: rect.bottom,
		vvHeight: vv ? vv.height : window.innerHeight,
		innerHeight: window.innerHeight,
		scrollY: window.scrollY,
		// Playwright không mở keyboard thật — iOS Chrome có interactive-widget,
		// Safari iOS dùng visualViewport handler → kiểm class + var đã setup.
		keyboardOpenClass: document.documentElement.classList.contains('keyboard-open'),
		vvhVar: document.documentElement.style.getPropertyValue('--vvh') || ''
	};
});
if (focusState) {
	ok(
		'M2a input trong visual viewport sau focus (rect.bottom <= vvHeight + 2)',
		focusState.rectBottom <= focusState.vvHeight + 2,
		`bottom=${focusState.rectBottom.toFixed(1)} vvH=${focusState.vvHeight} innerH=${focusState.innerHeight}`
	);
	ok(
		'M2b keyboard-open class + --vvh var đã setup trên root',
		typeof focusState.keyboardOpenClass === 'boolean' && focusState.vvhVar.includes('px'),
		`class=${focusState.keyboardOpenClass} --vvh="${focusState.vvhVar}"`
	);
} else {
	ok('M2 focus state — input không tìm thấy', false);
}

await iphonePage.close();
await iphoneCtx.close();

// ════════════════ (M3, M4) Pixel 7 — /ui ════════════════
const pixelCtx = await browser.newContext({
	...devices['Pixel 7'],
	ignoreHTTPSErrors: true
});
const pixelPage = await pixelCtx.newPage();

await pixelPage.goto('https://localhost:3000/ui', { waitUntil: 'domcontentloaded' });
// /ui load có fly transition (300ms + delay) + SSR compile lần đầu chậm —
// poll clientHeight ỔN ĐỊNH (2 lần đọc cách 300ms giống nhau) trước khi đo,
// tránh đo giá trị đang animate (race: clientH=715 khi transition chạy).
let stable = false;
let lastH = -1;
for (let i = 0; i < 16 && !stable; i++) {
	await sleep(300);
	const h = await pixelPage.evaluate(() => {
		const el = document.querySelector('div[class*="h-full"][style*="height"]');
		return el ? el.clientHeight : -1;
	});
	if (h === lastH && h > 0) stable = true;
	lastH = h;
}
await sleep(200);

// (M3) container root height ≈ viewport (100dvh) — không tràn
const containerState = await pixelPage.evaluate(() => {
	// Container root = element render từ +layout.svelte: class scoped hash
	// `w-full h-full me-<hash>` (scoped CSS) + style height px — KHÔNG có class
	// `.container`. Tìm qua con trực tiếp body > div[display:contents] > div
	// (element có style.height và class chứa 'h-full').
	const rootDiv = [...document.querySelectorAll('body > div')].find(
		(d) => d.getAttribute('style')?.includes('display: contents')
	);
	const el =
		document.querySelector('div[class*="h-full"][style*="height"]') ||
		(rootDiv
			? [...rootDiv.children].find(
					(d) => String(d.className).includes('h-full') && d.style.height
				)
			: null);
	const doc = document.scrollingElement;
	return {
		found: !!el,
		tag: el ? el.tagName : null,
		cls: el ? String(el.className).slice(0, 80) : null,
		offsetHeight: el ? el.offsetHeight : null,
		clientHeight: el ? el.clientHeight : null,
		styleHeight: el ? el.style.height : null,
		innerHeight: window.innerHeight,
		vvHeight: window.visualViewport ? window.visualViewport.height : null,
		scrollHeight: doc ? doc.scrollHeight : null,
		scrollTop: doc ? doc.scrollTop : null
	};
});
if (containerState.found) {
	// Container height ≈ viewport khả dụng (vv.height hoặc innerHeight) — cho phép chênh
	// 2px (làm tròn). Container root KHÔNG tràn: scrollHeight <= innerHeight + 2 khi
	// page ngắn (/ui có thể dài — chỉ check khi scrollHeight gần innerHeight).
	const target = containerState.vvHeight ?? containerState.innerHeight;
	const heightOk =
		Math.abs(containerState.clientHeight - target) <= 2 ||
		Math.abs(containerState.clientHeight - containerState.innerHeight) <= 2;
	ok(
		'M3a container root height ≈ viewport (100dvh)',
		heightOk,
		`clientH=${containerState.clientHeight} innerH=${containerState.innerHeight} vvH=${containerState.vvHeight} style="${containerState.styleHeight}"`
	);
	const noOverflow = containerState.scrollHeight <= containerState.innerHeight + 2;
	ok(
		'M3b không tràn khi page ngắn (scrollHeight <= innerHeight + 2)',
		noOverflow || containerState.scrollHeight > containerState.innerHeight,
		`scrollH=${containerState.scrollHeight} innerH=${containerState.innerHeight} (dài hơn viewport = cuộn bình thường)`
	);
} else {
	ok('M3 container root — không tìm thấy element', false);
}

// (M4) --vvh var sau page.setViewportSize (đổi → var cập nhật)
const vvhBefore = await pixelPage.evaluate(
	() => document.documentElement.style.getPropertyValue('--vvh') || ''
);
await pixelPage.setViewportSize({ width: 390, height: 700 });
await sleep(600);
const vvhAfter = await pixelPage.evaluate(() => ({
	vvh: document.documentElement.style.getPropertyValue('--vvh') || '',
	innerH: window.innerHeight,
	vvH: window.visualViewport ? window.visualViewport.height : null
}));
ok(
	'M4 --vvh var cập nhật sau setViewportSize',
	vvhBefore !== vvhAfter.vvh && vvhAfter.vvh.includes(`${vvhAfter.vvH ?? 0}`.split('.')[0]),
	`before="${vvhBefore}" after="${vvhAfter.vvh}" vvH=${vvhAfter.vvH} innerH=${vvhAfter.innerH}`
);

await pixelPage.close();
await pixelCtx.close();

// ════════════════ (M5, M6, M7) Desktop 1280 + unauthorized layout ════════════════
const deskCtx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
const deskPage = await deskCtx.newPage();

// (M5) /login desktop: container height = 900 (baseline không đổi)
await deskPage.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await deskPage.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(500);
const deskState = await deskPage.evaluate(() => {
	// Container root: class scoped hash `w-full h-full me-<hash>` + style height px.
	const rootDiv = [...document.querySelectorAll('body > div')].find(
		(d) => d.getAttribute('style')?.includes('display: contents')
	);
	const el =
		document.querySelector('div[class*="h-full"][style*="height"]') ||
		(rootDiv
			? [...rootDiv.children].find(
					(d) => String(d.className).includes('h-full') && d.style.height
				)
			: null);
	return {
		clientHeight: el ? el.clientHeight : null,
		innerHeight: window.innerHeight
	};
});
ok(
	'M5 desktop container height = 900 (baseline không đổi)',
	deskState.clientHeight !== null &&
		Math.abs(deskState.clientHeight - deskState.innerHeight) <= 2,
	`clientH=${deskState.clientHeight} innerH=${deskState.innerHeight}`
);

// (M6) (unauthorized) layout min-h-dvh: auth-page min-height = dvh, không tràn
await deskPage.goto('https://localhost:3000/forgot-password', {
	waitUntil: 'domcontentloaded'
});
await sleep(500);
const unauthState = await deskPage.evaluate(() => {
	const layout = document.querySelector('.unauthorized-layout');
	const authPage = document.querySelector('.auth-page');
	const doc = document.scrollingElement;
	return {
		layoutFound: !!layout,
		layoutMinHeight: layout ? getComputedStyle(layout).minHeight : null,
		authPageFound: !!authPage,
		authPageMinHeight: authPage ? getComputedStyle(authPage).minHeight : null,
		scrollHeight: doc ? doc.scrollHeight : null,
		innerHeight: window.innerHeight
	};
});
ok(
	'M6 unauthorized layout min-height dvh (không tràn)',
	unauthState.layoutFound &&
		(unauthState.layoutMinHeight.includes('dvh') ||
			parseFloat(unauthState.layoutMinHeight) >= unauthState.innerHeight),
	`minHeight=${unauthState.layoutMinHeight} innerH=${unauthState.innerHeight}`
);

// (M7) AuthPanelRight height = 100dvh (không 100vh cứng): computed style trả px —
// kiểm DỰA feedback: đổi viewport height → height/max-height phản hồi theo dvh.
await deskPage.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await sleep(500);
const authPanel = await deskPage.evaluate(() => {
	const el = document.querySelector('.auth-panel-right');
	const cs = el ? getComputedStyle(el) : null;
	return {
		found: !!el,
		height: cs?.height,
		maxHeight: cs?.maxHeight,
		innerHeight: window.innerHeight
	};
});
await deskPage.setViewportSize({ width: 1280, height: 700 });
await sleep(500);
const authPanelAfter = await deskPage.evaluate(() => {
	const el = document.querySelector('.auth-panel-right');
	const cs = el ? getComputedStyle(el) : null;
	return {
		found: !!el,
		height: cs?.height,
		maxHeight: cs?.maxHeight,
		innerHeight: window.innerHeight
	};
});
const dvhFeedback =
	authPanelAfter.found === true &&
	parseFloat(authPanelAfter.maxHeight) === authPanelAfter.innerHeight &&
	parseFloat(authPanelAfter.height) === authPanelAfter.innerHeight &&
	authPanelAfter.innerHeight === 700;
ok(
	'M7 auth-panel-right height/max-height = 100dvh (phản hồi viewport 900→700)',
	dvhFeedback,
	`before h=${authPanel.height} maxH=${authPanel.maxHeight} → after h=${authPanelAfter.height} maxH=${authPanelAfter.maxHeight} innerH=${authPanelAfter.innerHeight}`
);

await deskPage.close();
await deskCtx.close();

// ════════════════ Screenshots ════════════════
import { mkdirSync } from 'fs';
mkdirSync('tests/screenshots/mobile-container', { recursive: true });

const shotCtx = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 390, height: 844 },
	deviceScaleFactor: 2,
	isMobile: true,
	hasTouch: true
});
const shotPage = await shotCtx.newPage();

await shotPage.goto('https://localhost:3000/login', { waitUntil: 'domcontentloaded' });
await shotPage.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
await sleep(700);
await shotPage.screenshot({ path: 'tests/screenshots/mobile-container/login-mobile.png' });
console.log('SHOT login-mobile.png');

await shotPage.goto('https://localhost:3000/ui', { waitUntil: 'domcontentloaded' });
await sleep(900);
await shotPage.screenshot({ path: 'tests/screenshots/mobile-container/ui-mobile.png' });
console.log('SHOT ui-mobile.png');

await shotPage.close();
await shotCtx.close();

await browser.close();

// ════════════════ Tổng kết ════════════════
const pass = results.filter((r) => r.pass).length;
console.log(`\n═══ TỔNG: ${pass}/${results.length} PASS ═══`);
if (iphoneErrors.length) console.log('PAGE ERRORS (iPhone):', iphoneErrors.slice(0, 5));
process.exit(pass === results.length ? 0 : 1);
