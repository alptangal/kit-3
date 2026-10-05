// tests/accordion-probe.mjs
// Verify Accordion (element composite — shadcn accordion) trên /ui/accordion.
//
// Kiểm tra:
//  AC0 initial aria-expanded (defaultValue render đúng: single item1, multiple 1+2)
//  AC1 single: click item 2 → item1 đóng + item2 mở (switch)
//  AC2 collapsible: click item đang mở → đóng
//  AC3 non-collapsible: click item đang mở → VẪN MỞ (giữ); click khác → switch
//  AC4 multiple: 2 item open default; click 1 → còn 1
//  AC5 disabled: click trigger khóa → không đổi
//  AC6 content: role=region + aria-labelledby khớp id trigger
//  AC7 controlled: button ngoài (bind:value array) → aria-expanded theo
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
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto('https://localhost:3000/ui/accordion', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="accordion-demo"]', { timeout: 20000 });
// Iconify fetch svg ASYNC (item "Giúp gì?" có icon) → có thể shift layout.
await page.waitForSelector('[data-test="ac-single"] .accordion-trigger__icon svg', { timeout: 15000 }).catch(() => {});
await sleep(400);

// helper: trạng thái (expanded + content hiển thị) của trigger theo text
const stateOf = (scope, label) =>
	page.evaluate(
		({ scope, label }) => {
			const s = document.querySelector(scope);
			if (!s) return null;
			const trig = [...s.querySelectorAll('.accordion-trigger')].find((b) => b.textContent?.includes(label));
			if (!trig) return null;
			const content = document.getElementById(trig.getAttribute('aria-controls'));
			return {
				expanded: trig.getAttribute('aria-expanded'),
				region: content?.role,
				contentVisible: content ? !!content.querySelector('.accordion-content-inner') : false,
				display: content ? getComputedStyle(content.querySelector('.accordion-content-inner') ?? content).display : 'none'
			};
		},
		{ scope, label }
	);

// ═══ AC0 — initial aria-expanded (SSR + mount) ═══
const ac0 = await page.evaluate(() => {
	const single = document.querySelector('[data-test="ac-single"]');
	const multi = document.querySelector('[data-test="ac-multiple"]');
	return {
		singleOpen: [...single.querySelectorAll('.accordion-trigger')].filter((b) => b.getAttribute('aria-expanded') === 'true').length,
		multiOpen: [...multi.querySelectorAll('.accordion-trigger')].filter((b) => b.getAttribute('aria-expanded') === 'true').length,
		singleRegionCount: single.querySelectorAll('[role="region"] .accordion-content-inner').length
	};
});
ok('AC0 initial: single 1 open (item1), multiple 2 open (1+2)', ac0.singleOpen === 1 && ac0.multiOpen === 2 && ac0.singleRegionCount === 1, JSON.stringify(ac0));

// ═══ AC1 — single switch: click item 2 → item1 đóng, item2 mở ═══
await page.locator('[data-test="ac-single"] .accordion-trigger', { hasText: 'Item 2' }).click();
await sleep(450); // fly 300ms
const ac1 = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-single"]');
	const trig = (t) => [...s.querySelectorAll('.accordion-trigger')].find((b) => b.textContent?.includes(t));
	const i1 = trig('Giúp gì?');
	const i2 = trig('Item 2');
	const inner = (id) => !!document.getElementById(id)?.querySelector('.accordion-content-inner');
	return {
		i1: i1.getAttribute('aria-expanded'),
		i2: i2.getAttribute('aria-expanded'),
		i1Closed: !inner(i1.getAttribute('aria-controls')),
		i2Open: inner(i2.getAttribute('aria-controls'))
	};
});
ok('AC1 single: click item2 → item1 đóng (inner unmount), item2 mở', ac1.i1 === 'false' && ac1.i2 === 'true' && ac1.i1Closed && ac1.i2Open, JSON.stringify(ac1));

// ═══ AC2 — collapsible: click item đang mở → đóng ═══
// (a) ac-single: default collapsible=true theo spec (single → click item đang
// mở → đóng). Sau AC1, item2 đang mở → click → đóng.
await page.locator('[data-test="ac-single"] .accordion-trigger', { hasText: 'Item 2' }).click();
await sleep(450);
const ac2 = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-single"]');
	const i2 = [...s.querySelectorAll('.accordion-trigger')].find((b) => b.textContent?.includes('Item 2'));
	return {
		i2: i2.getAttribute('aria-expanded'),
		i2Inner: !!document.getElementById(i2.getAttribute('aria-controls'))?.querySelector('.accordion-content-inner')
	};
});
ok('AC2 collapsible: click item đang mở → đóng (aria-expanded=false, inner unmount)', ac2.i2 === 'false' && !ac2.i2Inner, JSON.stringify(ac2));

// ═══ AC3 — non-collapsible: click item đang mở → VẪN MỞ; click khác → switch ═══
const ac3a = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-nocollapse"]');
	const i1 = [...s.querySelectorAll('.accordion-trigger')].find((b) => b.textContent?.includes('Item 1'));
	return i1.getAttribute('aria-expanded');
});
await page.locator('[data-test="ac-nocollapse"] .accordion-trigger', { hasText: 'Item 1 (đang mở)' }).click();
await sleep(450);
const ac3b = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-nocollapse"]');
	const i1 = [...s.querySelectorAll('.accordion-trigger')].find((b) => b.textContent?.includes('Item 1'));
	return i1.getAttribute('aria-expanded');
});
await page.locator('[data-test="ac-nocollapse"] .accordion-trigger', { hasText: 'Item 2' }).click();
await sleep(450);
const ac3c = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-nocollapse"]');
	const find = (t) => [...s.querySelectorAll('.accordion-trigger')].find((b) => b.textContent?.includes(t));
	const i1 = find('Item 1');
	const i2 = find('Item 2');
	const inner = (id) => !!document.getElementById(id)?.querySelector('.accordion-content-inner');
	return {
		i1: i1.getAttribute('aria-expanded'),
		i2: i2.getAttribute('aria-expanded'),
		i1Inner: inner(i1.getAttribute('aria-controls')),
		i2Inner: inner(i2.getAttribute('aria-controls'))
	};
});
ok('AC3 non-collapsible: click item1 đang mở → GIỮ NGUYÊN (true); click item2 → switch (1 đóng, 2 mở)', ac3a === 'true' && ac3b === 'true' && ac3c.i1 === 'false' && ac3c.i2 === 'true' && !ac3c.i1Inner && ac3c.i2Inner, JSON.stringify({ ac3a, ac3b, ac3c }));

// ═══ AC4 — multiple: click 1 item đang mở → đóng, item kia giữ ═══
const ac4before = await stateOf('[data-test="ac-multiple"]', 'Item 2');
await page.locator('[data-test="ac-multiple"] .accordion-trigger', { hasText: 'Item 2 (open)' }).click();
await sleep(450);
const ac4 = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-multiple"]');
	const find = (t) => [...s.querySelectorAll('.accordion-trigger')].find((b) => b.textContent?.includes(t));
	const i1 = find('Item 1 (open)');
	const i2 = find('Item 2');
	const i3 = find('Item 3');
	const inner = (id) => !!document.getElementById(id)?.querySelector('.accordion-content-inner');
	return {
		i1: i1.getAttribute('aria-expanded'),
		i2: i2.getAttribute('aria-expanded'),
		i3: i3.getAttribute('aria-expanded'),
		i1Inner: inner(i1.getAttribute('aria-controls')),
		i2Inner: inner(i2.getAttribute('aria-controls'))
	};
});
ok('AC4 multiple: item2 (open) click → đóng; item1 giữ open; item3 closed', ac4before?.expanded === 'true' && ac4.i1 === 'true' && ac4.i2 === 'false' && ac4.i3 === 'false' && ac4.i1Inner && !ac4.i2Inner, JSON.stringify({ ac4before, ac4 }));

// ═══ AC5 — disabled: click trigger khóa → không đổi ═══
const ac5before = await stateOf('[data-test="ac-disabled"]', 'Item 2 (khóa)');
await page.locator('[data-test="ac-disabled"] .accordion-trigger', { hasText: 'Item 2 (khóa)' }).click({ force: true });
await sleep(300);
const ac5after = await stateOf('[data-test="ac-disabled"]', 'Item 2 (khóa)');
const ac5attrs = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-disabled"]');
	const b = [...s.querySelectorAll('.accordion-trigger')].find((x) => x.textContent?.includes('Item 2 (khóa)'));
	return { ariaDisabled: b.getAttribute('aria-disabled'), pointerEvents: getComputedStyle(b).pointerEvents };
});
ok('AC5 disabled: aria-disabled=true + pointer-events none; click (force) → không mở', ac5attrs.ariaDisabled === 'true' && ac5attrs.pointerEvents === 'none' && ac5before?.expanded === 'false' && ac5after?.expanded === 'false' && !ac5after?.contentVisible, JSON.stringify({ ac5attrs, ac5before, ac5after }));

// ═══ AC6 — content: role=region + aria-labelledby khớp id trigger ═══
// (target ac-multiple item1 — đang OPEN sau AC4, để cũng verify inner render)
const ac6 = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-multiple"]');
	const trig = [...s.querySelectorAll('.accordion-trigger')].find((b) => b.textContent?.includes('Item 1 (open)'));
	const content = document.getElementById(trig.getAttribute('aria-controls'));
	return {
		region: content?.role,
		idsMatch: content?.getAttribute('aria-labelledby') === trig.id,
		controlsMatch: trig.getAttribute('aria-controls') === content?.id,
		innerVisible: !!content?.querySelector('.accordion-content-inner'),
		expanded: trig.getAttribute('aria-expanded')
	};
});
ok('AC6 content: role=region + aria-labelledby = id trigger + aria-controls khớp + inner render (item open)', ac6.region === 'region' && ac6.idsMatch && ac6.controlsMatch && ac6.innerVisible && ac6.expanded === 'true', JSON.stringify(ac6));

// ═══ AC7 — controlled: button ngoài đổi array → aria-expanded theo ═══
const ac7init = await stateOf('[data-test="ac-controlled"]', 'Beta (c2)');
await page.locator('[data-test="ac-controlled-open-all"]').click();
await sleep(400);
const ac7all = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-controlled"]');
	return {
		open: [...s.querySelectorAll('.accordion-trigger')].filter((b) => b.getAttribute('aria-expanded') === 'true').length,
		valueText: document.querySelector('[data-test="ac-controlled-value"]')?.textContent?.trim()
	};
});
await page.locator('[data-test="ac-controlled-close-all"]').click();
await sleep(400);
const ac7closed = await page.evaluate(() => {
	const s = document.querySelector('[data-test="ac-controlled"]');
	return {
		open: [...s.querySelectorAll('.accordion-trigger')].filter((b) => b.getAttribute('aria-expanded') === 'true').length,
		valueText: document.querySelector('[data-test="ac-controlled-value"]')?.textContent?.trim()
	};
});
ok('AC7 controlled: ban đầu c1 open (c2 closed); "Mở tất cả" → 3 open; "Đóng tất cả" → 0 open', ac7init?.expanded === 'false' && ac7all.open === 3 && ac7all.valueText?.includes('c1, c2, c3') && ac7closed.open === 0 && ac7closed.valueText === 'value = []', JSON.stringify({ ac7init, ac7all, ac7closed }));

// ═══ Screenshot (light, DSF2) ═══
// Reload → chụp trạng thái BAN ĐẦU (defaultValue) thay vì state sau khi test.
await page.goto('https://localhost:3000/ui/accordion', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="accordion-demo"]', { timeout: 20000 });
await page.waitForSelector('[data-test="ac-single"] .accordion-trigger__icon svg', { timeout: 15000 }).catch(() => {});
await sleep(500);
// Layout Container là 100dvh overflow-auto → fullPage chỉ chụp viewport. Mở
// container (height auto, overflow visible) để fullPage chụp TOÀN B content.
await page.evaluate(() => {
	document.querySelectorAll('div').forEach((d) => {
		const cs = getComputedStyle(d);
		if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && d.scrollHeight > d.clientHeight + 50) {
			d.style.height = 'auto';
			d.style.overflow = 'visible';
			d.style.maxHeight = 'none';
		}
	});
});
await page.screenshot({ path: 'tests/screenshot/accordion/01-accordion-cases.png', fullPage: true });
console.log('\nScreenshot → tests/screenshot/accordion/01-accordion-cases.png');

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
