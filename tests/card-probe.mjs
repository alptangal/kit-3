// tests/card-probe.mjs
// Verify Card composite (Root + Header/Title/Description/Content/Footer/Action).
// Trang demo: /ui/card (data-test="card-demo").
//
// Kiểm tra:
//  C0 .card-root render + visible
//  C1 sub classes có đủ: .card-header/.card-title/.card-content/.card-footer/.card-action
//  C2 as="section" → tag <section>
//  C3 elevation-raised: class + computed box-shadow != none
//  C4 Action: margin-left = auto
//  C5 prop class override (styleSynced merge) + overwriteDefaultStyles
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

await page.goto('https://127.0.0.1:3000/ui/card', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.card-root', { timeout: 20000 });
await sleep(300);

// Ổn định layout: sau domcontentloaded, CSS scoped + hydration có thể chưa apply xong
// (page render hẹp 48px). Chờ khi .page đạt max-width (672px) hoặc reload lần 2.
for (let i = 0; i < 5; i++) {
	const w = await page.evaluate(() => document.querySelector('[data-test="card-demo"]')?.getBoundingClientRect().width ?? 0);
	if (w > 500) break;
	if (i === 2) {
		await page.reload({ waitUntil: 'domcontentloaded' });
		await page.waitForSelector('.card-root', { timeout: 20000 });
	}
	await sleep(400);
}
const stableW = await page.evaluate(() => document.querySelector('[data-test="card-demo"]')?.getBoundingClientRect().width ?? 0);
ok('S0 trang ổn định layout (demo width > 500px sau chờ/reload)', stableW > 500, `width=${+stableW.toFixed(1)}`);

// C0 — .card-root render + visible
const rootInfo = await page.evaluate(() => {
	const card = document.querySelector('[data-test="cd-product"]');
	if (!card) return null;
	const cs = getComputedStyle(card);
	const rect = card.getBoundingClientRect();
	return {
		classRoot: card.classList.contains('card-root'),
		visible: cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
		background: cs.backgroundColor
	};
});
ok('C0 .card-root render + visible (cd-product)', rootInfo?.classRoot && rootInfo?.visible, JSON.stringify(rootInfo));

// C1 — sub classes
const subClasses = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="card-demo"]');
	return {
		header: !!scope.querySelector('.card-header'),
		title: !!scope.querySelector('.card-title'),
		description: !!scope.querySelector('.card-description'),
		content: !!scope.querySelector('.card-content'),
		footer: !!scope.querySelector('.card-footer'),
		action: !!scope.querySelector('.card-action')
	};
});
ok(
	'C1 đủ sub classes (.card-header/.card-title/.card-description/.card-content/.card-footer/.card-action)',
	Object.values(subClasses).every(Boolean),
	JSON.stringify(subClasses)
);

// C2 — as="section"
const raisedTag = await page.evaluate(() => document.querySelector('[data-test="cd-raised"]')?.tagName);
ok('C2 as="section" → tag <SECTION>', raisedTag === 'SECTION', raisedTag);

// C3 — elevation-raised: class + box-shadow != none
const raised = await page.evaluate(() => {
	const el = document.querySelector('[data-test="cd-raised"]');
	if (!el) return null;
	const cs = getComputedStyle(el);
	return {
		hasClass: el.classList.contains('elevation-raised'),
		border: cs.borderTopWidth,
		shadow: cs.boxShadow
	};
});
ok('C3 elevation-raised: class + border + box-shadow != none', raised?.hasClass && raised?.shadow && raised.shadow !== 'none', JSON.stringify(raised));

// C3b — elevation-border (default) có border, elevation-none không border
const elevVariants = await page.evaluate(() => {
	const product = document.querySelector('[data-test="cd-product"]');
	const minimal = document.querySelector('[data-test="cd-minimal"]');
	const csP = product ? getComputedStyle(product) : null;
	const csM = minimal ? getComputedStyle(minimal) : null;
	return {
		productBorder: csP?.borderTopWidth,
		productClass: product?.classList.contains('elevation-border'),
		minimalClass: minimal?.classList.contains('elevation-none'),
		minimalBorder: csM?.borderTopWidth
	};
});
ok('C3b elevation-border có border, elevation-none không border', elevVariants.productClass && elevVariants.productBorder === '1px' && elevVariants.minimalClass && elevVariants.minimalBorder === '0px', JSON.stringify(elevVariants));

// C4 — Action: CSS rule margin-inline-start auto (check styleSheets, vì getComputedStyle
// trả used value — 0px khi heading fill) + position sát mép phải header + align-self start.
const action = await page.evaluate(() => {
	const el = document.querySelector('[data-test="cd-product"] .card-action');
	if (!el) return null;
	const cs = getComputedStyle(el);
	// Parent element mang class .card-header (khác el.parentElement — HMR Svelte có thể
	// chèn node scope-hash giữa demo wrapper và Card.Header).
	const header = el.closest('.card-header');
	// CSS rule .card-action phải khai báo margin-inline-start: auto
	let ruleHasAuto = false;
	for (const sheet of document.styleSheets) {
		let rules;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		for (const r of rules ?? []) {
			if (r.selectorText && el.matches(r.selectorText) && r.style?.marginInlineStart === 'auto') ruleHasAuto = true;
		}
	}
	const elRect = el.getBoundingClientRect();
	const hRect = header.getBoundingClientRect();
	return {
		ruleHasAuto,
		alignSelf: cs.alignSelf,
		elRight: +elRect.right.toFixed(1),
		headerRight: +hRect.right.toFixed(1),
		headerClass: header?.className ?? null,
		// action sát mép phải header (trừ padding 1.25rem = 20px, dung sai 2px)
		nearHeaderRight: Math.abs(elRect.right - (hRect.right - 20)) < 2,
		// action không overlap phần heading bên trái (bị đẩy, không đè)
		inHeader: elRect.top >= hRect.top - 2 && elRect.bottom <= hRect.bottom + 2
	};
});
ok('C4 .card-action margin-inline-start auto (rule CSS) + push sát mép phải header + align-self start', action?.ruleHasAuto && action?.alignSelf === 'flex-start' && action?.nearHeaderRight && action?.inHeader, JSON.stringify(action));

// C5 — prop class merge (styleSynced): class truyền vào tồn tại trên cùng với .card-root
const classMerge = await page.evaluate(() => {
	const el = document.querySelector('[data-test="cd-product"]');
	if (!el) return null;
	return {
		hasPropClass: el.classList.contains('card-demo-card'),
		hasRootClass: el.classList.contains('card-root')
	};
});
ok('C5 prop class merge (card-demo-card + card-root cùng tồn tại)', classMerge?.hasPropClass && classMerge?.hasRootClass, JSON.stringify(classMerge));

// C5b — footer border-top + header/content/footer padding
const spacing = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="cd-settings"]');
	if (!scope) return null;
	const footer = scope.querySelector('.card-footer');
	const header = scope.querySelector('.card-header');
	const content = scope.querySelector('.card-content');
	const fcs = footer ? getComputedStyle(footer) : null;
	const hcs = header ? getComputedStyle(header) : null;
	const ccs = content ? getComputedStyle(content) : null;
	return {
		footerBorderTop: fcs?.borderTopWidth,
		headerPaddingTop: hcs?.paddingTop,
		contentPaddingLeft: ccs?.paddingLeft,
		contentFlexGrow: ccs?.flexGrow
	};
});
ok('C5b footer border-top + padding header/content + content flex-grow', spacing?.footerBorderTop === '1px' && spacing?.headerPaddingTop === '16px' && spacing?.contentPaddingLeft === '20px' && spacing?.contentFlexGrow === '1', JSON.stringify(spacing));

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
