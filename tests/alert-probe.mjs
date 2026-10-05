// tests/alert-probe.mjs
// Verify Alert (element) — inline notification: semantic color × icon default,
// a11y role/aria-live, title+description (i18n), description-only, children snippet.
// Trang demo: /ui/alert
//
// Kiểm tra:
//  A0 trang hiển thị + .alert-root count >= 8
//  A1 mỗi color → class color-* đúng + computed bg/border khác nhau (so default vs error)
//  A2 icon — mỗi alert có ≥1 <svg>; không truyền icon → icon default vẫn render
//  A3 a11y — role alert (error/warning) / status (khác) + aria-live assertive/polite
//  A4 title + description render đúng text (i18n en/vi — đọc lang hiện tại từ page)
//  A5 description-only (không title) render OK; section children (snippet) render đúng nội dung
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

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
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/alert', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.alert-root', { timeout: 20000 });
await sleep(400);

// ── BẪY ICONIFY ASYNC: <Icon> fetch runtime ~1-4s mới có <svg> → chờ trước khi assert ──
try {
	await page.waitForFunction(
		() => {
			const roots = document.querySelectorAll('.alert-root');
			if (!roots.length) return false;
			return [...roots].every((r) => r.querySelector('svg'));
		},
		{ timeout: 15000 }
	);
} catch {
	console.log('WARN  A2 icon: iconify chưa fetch đủ (offline?) — probe vẫn chạy, check icon có thể WARN');
}

// A0 — structure
const alertCount = await page.locator('.alert-root').count();
ok('A0 trang /ui/alert render + .alert-root count >= 8', alertCount >= 8, `count=${alertCount}`);

// A1 — variant color: class color-* đúng + computed khác nhau (default vs error)
const a1 = await page.evaluate(() => {
	const bySel = {
		default: '[data-test="al-default"] .alert-root',
		primary: '[data-test="al-primary"] .alert-root',
		success: '[data-test="al-success"] .alert-root',
		warning: '[data-test="al-warning"] .alert-root',
		error: '[data-test="al-error"] .alert-root'
	};
	const out = {};
	for (const [color, sel] of Object.entries(bySel)) {
		const el = document.querySelector(sel);
		if (!el) return { missing: sel };
		const cs = getComputedStyle(el);
		out[color] = {
			cls: [...el.classList].find((c) => c.startsWith('color-')),
			background: cs.backgroundColor,
			border: cs.borderTopColor
		};
	}
	return out;
});
const a1ClassOk =
	!!a1 &&
	!a1.missing &&
	a1.default?.cls === 'color-default' &&
	a1.primary?.cls === 'color-primary' &&
	a1.success?.cls === 'color-success' &&
	a1.warning?.cls === 'color-warning' &&
	a1.error?.cls === 'color-error';
ok('A1 class color-* đúng cho 5 semantic', a1ClassOk, JSON.stringify(a1));
const a1VisualOk =
	!!a1 &&
	!a1.missing &&
	a1.default.background !== a1.error.background &&
	a1.default.border !== a1.error.border;
ok('A1 computed bg/border khác nhau (default vs error) — variant hoạt động', a1VisualOk, JSON.stringify(a1));

// A2 — icon: mỗi .alert-root có ≥1 <svg>
const a2 = await page.evaluate(() => {
	const roots = [...document.querySelectorAll('.alert-root')];
	return {
		total: roots.length,
		withSvg: roots.filter((r) => r.querySelector('svg')).length
	};
});
ok('A2 mỗi alert có ≥1 <svg> (icon default hoặc custom render)', a2.withSvg === a2.total, JSON.stringify(a2));

// A3 — a11y: role + aria-live theo semantic
const a3 = await page.evaluate(() => {
	const read = (sel) => {
		const el = document.querySelector(sel + ' .alert-root');
		return el ? { role: el.getAttribute('role'), live: el.getAttribute('aria-live') } : null;
	};
	return {
		error: read('[data-test="al-error"]'),
		warning: read('[data-test="al-warning"]'),
		success: read('[data-test="al-success"]'),
		default: read('[data-test="al-default"]'),
		primary: read('[data-test="al-primary"]')
	};
});
ok(
	'A3 role=alert + aria-live=assertive (error, warning)',
	a3.error?.role === 'alert' &&
		a3.error.live === 'assertive' &&
		a3.warning?.role === 'alert' &&
		a3.warning.live === 'assertive',
	JSON.stringify(a3)
);
ok(
	'A3 role=status + aria-live=polite (success, default, primary)',
	a3.success?.role === 'status' &&
		a3.success.live === 'polite' &&
		a3.default?.role === 'status' &&
		a3.default.live === 'polite' &&
		a3.primary?.role === 'status' &&
		a3.primary.live === 'polite',
	JSON.stringify(a3)
);

// A4 — title + description render đúng text (i18n: chấp nhận cả en và vi)
// Demo truyền TranslateContent {en, vi}; lang hiện tại từ client.browser (default 'en').
const a4 = await page.evaluate(() => {
	const grab = (sel, cls) => document.querySelector(sel + ' .alert-root ' + cls)?.textContent ?? '';
	return {
		defaultTitle: grab('[data-test="al-default"]', '.alert-title'),
		defaultDesc: grab('[data-test="al-default"]', '.alert-description'),
		errorTitle: grab('[data-test="al-error"]', '.alert-title'),
		errorDesc: grab('[data-test="al-error"]', '.alert-description')
	};
});
const a4Ok =
	(a4.defaultTitle === 'Note' || a4.defaultTitle === 'Ghi chú') &&
	(a4.defaultDesc === 'This is a neutral note.' || a4.defaultDesc === 'Đây là ghi chú trung tính.') &&
	(a4.errorTitle === 'Failed' || a4.errorTitle === 'Thất bại') &&
	(a4.errorDesc === 'Something went wrong. Try again.' || a4.errorDesc === 'Có lỗi xảy ra. Hãy thử lại.');
ok('A4 title + description render đúng (i18n en/vi)', a4Ok, JSON.stringify(a4));

// A5 — description-only (không title) + children snippet
const a5 = await page.evaluate(() => {
	const descOnly = document.querySelector('[data-test="al-description-only"] .alert-root');
	const childrenAlert = document.querySelector('[data-test="al-children"] .alert-root');
	const childrenText = document.querySelector('[data-test="al-children-text"]')?.textContent ?? '';
	return {
		descOnly: {
			found: !!descOnly,
			noTitle: !descOnly?.querySelector('.alert-title'),
			hasDesc: !!descOnly?.querySelector('.alert-description'),
			cls: descOnly ? [...descOnly.classList].filter((c) => c.startsWith('no-') || c.startsWith('has-')) : []
		},
		children: {
			found: !!childrenAlert,
			text: childrenText,
			inside: childrenAlert?.contains(document.querySelector('[data-test="al-children-text"]'))
		}
	};
});
ok(
	'A5 description-only: không title, có description, class no-title',
	a5.descOnly.found && a5.descOnly.noTitle && a5.descOnly.hasDesc && a5.descOnly.cls.includes('no-title'),
	JSON.stringify(a5.descOnly)
);
ok(
	'A5 children snippet render đúng nội dung trong .alert-content',
	a5.children.found &&
		a5.children.inside &&
		a5.children.text === 'Extra rich content via children snippet.',
	JSON.stringify(a5.children)
);

// A6 — size (class size-*) + disabled (class disabled + opacity token)
const a6 = await page.evaluate(() => {
	const sizeScope = document.querySelector('[data-test="al-size"]');
	const sizes = sizeScope
		? [...sizeScope.querySelectorAll('.alert-root')].map((el) =>
				[...el.classList].find((c) => c.startsWith('size-'))
		  )
		: null;
	const disabled = document.querySelector('[data-test="al-disabled"] .alert-root.disabled');
	const disabledOpacity = disabled ? getComputedStyle(disabled).opacity : null;
	return { sizes, disabledFound: !!disabled, disabledOpacity };
});
ok(
	'A6 size: class size-sm / size-md / size-lg theo prop',
	!!a6.sizes &&
		a6.sizes.includes('size-sm') &&
		a6.sizes.includes('size-md') &&
		a6.sizes.includes('size-lg'),
	JSON.stringify(a6)
);
ok(
	'A6 disabled: class disabled + opacity = --disabled-opacity (0.5)',
	!!a6.disabledFound && a6.disabledOpacity === '0.5',
	JSON.stringify(a6)
);

// Screenshot — poll iconify load (mỗi .alert-root ≥1 svg) trước khi chụp
await page
	.waitForFunction(
		() =>
			[...document.querySelectorAll('.alert-root')].every((r) => r.querySelector('svg')),
		{ timeout: 10000 }
	)
	.catch(() => console.log('WARN  screenshot: iconify chưa đủ — vẫn chụp'));
await sleep(400);
const shotDir = 'tests/screenshot/alert';
mkdirSync(shotDir, { recursive: true });
await page.locator('[data-test="al-variants"]').scrollIntoViewIfNeeded();
await sleep(300);
await page.locator('[data-test="al-variants"]').screenshot({ path: `${shotDir}/01-variants.png` });
console.log(`Screenshot: ${shotDir}/01-variants.png`);
await page.locator('[data-test="al-custom"]').scrollIntoViewIfNeeded();
await sleep(300);
await page.locator('[data-test="al-custom"]').screenshot({ path: `${shotDir}/02-custom.png` });
console.log(`Screenshot: ${shotDir}/02-custom.png`);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
