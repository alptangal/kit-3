// tests/avatar-probe.mjs
// Verify Avatar composite (Root + Image + Fallback).
// Trang demo: /ui/avatar (data-test="avatar-demo").
//
// Kiểm tra:
//  AV0 root role="img" + aria-label (aria-label ?? alt)
//  AV1 src hợp lệ → sau chờ: img visible + root .is-loaded
//  AV2 src hỏng → không có <img> visible (hoặc img lỗi) + fallback hiện
//  AV3 không src → initials tự động ("Nguyễn Văn A" → "NA": word đầu + word cuối)
//  AV4 fallback tùy chỉnh (slot emoji hiện)
//  AV5 size map: computed width đúng px (xs 24 / sm 32 / md 40 / lg 48 / xl 64)
//  AV6 shape: computed border-radius (circle = size/2, square = 0, rounded = 8px)
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

await page.goto('https://127.0.0.1:3000/ui/avatar', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.avatar-root', { timeout: 20000 });

// Ổn định layout: sau domcontentloaded, CSS scoped + hydration có thể chưa apply xong
// (page render hẹp). Chờ khi .page demo đạt max-width hoặc reload lần 2.
for (let i = 0; i < 5; i++) {
	const w = await page.evaluate(() => document.querySelector('[data-test="avatar-demo"]')?.getBoundingClientRect().width ?? 0);
	if (w > 500) break;
	if (i === 2) {
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.waitForSelector('.avatar-root', { timeout: 20000 });
	}
	await sleep(400);
}
const stableW = await page.evaluate(() => document.querySelector('[data-test="avatar-demo"]')?.getBoundingClientRect().width ?? 0);
ok('S0 trang ổn định layout (demo width > 500px sau chờ/reload)', stableW > 500, `width=${+stableW.toFixed(1)}`);

// data-URI load gần như instant — vẫn chờ để onload/fade-out ổn định.
await sleep(400);

// AV0 — role="img" + aria-label
const a11y = await page.evaluate(() => {
	const loaded = document.querySelector('[data-test="av-loaded"] .avatar-root');
	const initials = document.querySelector('[data-test="av-initials"] .avatar-root');
	return {
		loadedRole: loaded?.getAttribute('role'),
		loadedLabel: loaded?.getAttribute('aria-label'),
		initialsLabel: initials?.getAttribute('aria-label')
	};
});
ok(
	'AV0 root role="img" + aria-label (explicit label ?? alt)',
	a11y.loadedRole === 'img' && a11y.loadedLabel === 'Công ty ACME Inc' && a11y.initialsLabel === 'Nguyễn Văn A',
	JSON.stringify(a11y)
);

// AV1 — src hợp lệ: img visible + class is-loaded (đợi onload data-URI)
await sleep(300);
const loaded = await page.evaluate(() => {
	const root = document.querySelector('[data-test="av-loaded"] .avatar-root');
	if (!root) return null;
	const img = root.querySelector('img');
	if (!img) return { root: root.className, img: false };
	const cs = getComputedStyle(img);
	const rect = img.getBoundingClientRect();
	return {
		rootClass: root.className,
		isLoaded: root.classList.contains('is-loaded'),
		imgVisible: cs.display !== 'none' && rect.width > 0 && rect.height > 0,
		objectFit: cs.objectFit
	};
});
ok(
	'AV1 src hợp lệ → img visible + root .is-loaded + object-fit cover',
	loaded?.isLoaded && loaded?.imgVisible && loaded?.objectFit === 'cover',
	JSON.stringify(loaded)
);

// AV2 — src hỏng: không img visible (hoặc img lỗi) + fallback hiện "ND" (alt "Người dùng không tồn tại")
const error = await page.evaluate(() => {
	const root = document.querySelector('[data-test="av-error"] .avatar-root');
	if (!root) return null;
	const img = root.querySelector('img');
	const imgOk = img ? img.complete && img.naturalWidth > 0 : null;
	const imgCs = img ? getComputedStyle(img) : null;
	const fallback = root.querySelector('.avatar-fallback');
	const fcs = fallback ? getComputedStyle(fallback) : null;
	return {
		rootClass: root.className,
		isError: root.classList.contains('is-error'),
		imgBroken: img ? !imgOk : null,
		// img lỗi phải bị ẩn (visibility hidden) — fallback là thứ nhìn thấy, không phải icon broken-image
		imgHidden: imgCs ? imgCs.visibility === 'hidden' : null,
		fallbackVisible: fcs ? fcs.display !== 'none' && fcs.visibility !== 'hidden' : false,
		fallbackText: fallback?.textContent?.trim()
	};
});
ok(
	'AV2 src hỏng → is-error + img ẩn (không icon broken) + fallback hiện (initials "NA" từ alt "Nguyễn Văn A")',
	error?.isError &&
		error?.fallbackVisible &&
		error?.fallbackText === 'NA' &&
		(error?.imgBroken === true || error?.imgBroken === null) &&
		(error?.imgHidden === true || error?.imgHidden === null),
	JSON.stringify(error)
);

// AV3 — không src → initials "NA" (alt "Nguyễn Văn A")
const initials = await page.evaluate(() => {
	const root = document.querySelector('[data-test="av-initials"] .avatar-root');
	if (!root) return null;
	const img = root.querySelector('img');
	const el = root.querySelector('.avatar-fallback__initials');
	return {
		isEmpty: root.classList.contains('is-empty'),
		noImg: !img,
		text: el?.textContent?.trim()
	};
});
ok('AV3 không src → is-empty + không <img> + initials "NA" (word đầu + word cuối)', initials?.isEmpty && initials?.noImg && initials?.text === 'NA', JSON.stringify(initials));

// AV4 — fallback tùy chỉnh (slot emoji 🤖, không render initials)
const custom = await page.evaluate(() => {
	const root = document.querySelector('[data-test="av-custom"] .avatar-root');
	if (!root) return null;
	const fallback = root.querySelector('.avatar-fallback');
	return {
		hasEmoji: fallback?.textContent?.includes('🤖') ?? false,
		noAutoInitials: !fallback?.querySelector('.avatar-fallback__initials')
	};
});
ok('AV4 fallback tùy chỉnh: slot emoji hiện, không auto-initials', custom?.hasEmoji && custom?.noAutoInitials, JSON.stringify(custom));

// AV5 — size map (computed width, DSF không ảnh hưởng getComputedStyle)
const sizes = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="av-size"]');
	if (!scope) return null;
	const map = {};
	for (const el of scope.querySelectorAll('.avatar-root')) {
		const m = el.className.match(/\bsize-(\w+)\b/);
		if (m) map[m[1]] = getComputedStyle(el).width;
	}
	return map;
});
const expectedSizes = { xs: '24px', sm: '32px', md: '40px', lg: '48px', xl: '64px' };
const sizesOk = Object.entries(expectedSizes).every(([k, v]) => sizes?.[k] === v);
ok('AV5 size map: xs 24 / sm 32 / md 40 / lg 48 / xl 64 px', sizesOk, JSON.stringify(sizes));

// AV6 — shape: border-radius (circle = size/2, rounded = 8px, square = 0)
const shapes = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="av-shape"]');
	if (!scope) return null;
	const out = {};
	for (const el of scope.querySelectorAll('.avatar-root')) {
		const m = el.className.match(/\bshape-(\w+)\b/);
		if (m) out[m[1]] = getComputedStyle(el).borderRadius;
	}
	return out;
});
// circle: border-radius 50% → computed trả về "50%" (không resolve px) — hoặc 20px (size/2 md).
const circleOk = shapes?.circle === '50%' || shapes?.circle?.includes('20px');
const squareOk = shapes?.square === '0px' || shapes?.square === '0';
const roundedOk = shapes?.rounded?.includes('8px');
ok('AV6 shape: circle 50% / rounded 8px (--border-radius-lg) / square 0', circleOk && squareOk && roundedOk, JSON.stringify(shapes));

// AV6b — fallback font-size = 40% --avatar-size + căn giữa + nền --muted
const fallbackStyle = await page.evaluate(() => {
	const root = document.querySelector('[data-test="av-initials"] .avatar-root');
	const fb = root?.querySelector('.avatar-fallback');
	if (!fb) return null;
	const cs = getComputedStyle(fb);
	const rootCs = getComputedStyle(root);
	return {
		fontSize: cs.fontSize,
		display: cs.display,
		justify: cs.justifyContent,
		align: cs.alignItems,
		position: cs.position,
		rootBg: rootCs.backgroundColor
	};
});
ok(
	'AV6b fallback: font-size 16px (40% of 40px) + flex center + absolute; root nền --muted',
	fallbackStyle?.fontSize === '16px' &&
		fallbackStyle?.display === 'flex' &&
		fallbackStyle?.justify === 'center' &&
		fallbackStyle?.align === 'center' &&
		fallbackStyle?.position === 'absolute' &&
		/113,\s*113,\s*122|rgb\(113/.test(fallbackStyle?.rootBg ?? ''),
	JSON.stringify(fallbackStyle)
);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
