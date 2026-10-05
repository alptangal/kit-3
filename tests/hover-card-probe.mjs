// tests/hover-card-probe.mjs
// Verify HoverCard (element composite): /ui/hover-card.
//
// Kiểm tra:
//  HC0 closed: trigger render, content KHÔNG hiện
//  HC1 hover trigger → sleep 400ms → content role="tooltip" hiện
//  HC2 rời trigger (không vào content) → sleep 400ms → ẩn
//  HC3 hover VÀO content → content giữ mở (keep-alive)
//  HC4 mouse rời content → content ẩn
//  HC5 delay: hover + 100ms → CHƯA hiện; +400ms nữa → hiện (show delay 300ms)
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
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

await page.goto('https://localhost:3000/ui/hover-card', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.hover-card-root', { timeout: 20000 });
await sleep(400);

// ============ HC0 — closed: trigger có, content không ============
const hc0 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="hc-list"]');
	const trig = scope.querySelector('[data-hc-trigger]');
	const card = scope.querySelector('.hover-card-content');
	return {
		roots: document.querySelectorAll('.hover-card-root').length,
		triggerTag: trig?.tagName,
		cardAbsent: !card,
		descr: trig?.getAttribute('aria-describedby') // undefined khi closed
	};
});
ok(
	'HC0 closed: trigger span render + content ABSENT + trigger không aria-describedby',
	hc0.roots >= 4 && hc0.triggerTag === 'SPAN' && hc0.cardAbsent && hc0.descr == null,
	JSON.stringify(hc0)
);

// Trigger user 1 (button bên trong span [data-hc-trigger])
const user1Btn = page.locator('[data-test="hc-user-u1"]');

// ============ HC1 — hover → 400ms → hiện ============
await user1Btn.hover();
await sleep(400); // show delay 300ms + animation
const hc1 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="hc-list"]');
	const card = scope.querySelector('.hover-card-content');
	const trig = scope.querySelector('[data-hc-trigger]');
	const cs = card ? getComputedStyle(card) : null;
	return {
		role: card?.getAttribute('role'),
		pos: cs?.position,
		z: cs?.zIndex,
		expandedDescr: !!trig?.getAttribute('aria-describedby') && trig.getAttribute('aria-describedby') === card?.id
	};
});
ok(
	'HC1 hover trigger → 400ms → card role=tooltip hiện + absolute + trigger aria-describedby=card.id',
	hc1.role === 'tooltip' && hc1.pos === 'absolute' && hc1.expandedDescr === true,
	JSON.stringify(hc1)
);

// ============ HC3 — đưa chuột VÀO card → keep-alive (trước khi HC2/HC4) ============
if (hc1.role === 'tooltip') {
	const card = page.locator('[data-test="hc-list"] .hover-card-content');
	const box = await card.boundingBox();
	if (box) {
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
		await sleep(400); // > hide grace 150ms
	}
}
const hc3 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="hc-list"]');
	return !!scope.querySelector('.hover-card-content');
});
ok('HC3 đưa chuột VÀO card → card giữ mở (keep-alive, vượt hide grace 150ms)', hc3);

// ============ HC4 — rời card → ẩn ============
await page.mouse.move(10, 700, { steps: 8 }); // xa trigger + card, path không cắt trigger
await sleep(400); // hide grace 150ms + buffer
const hc4 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="hc-list"]');
	return !scope.querySelector('.hover-card-content');
});
ok('HC4 chuột rời card → card ẩn (sau hide grace)', hc4);

// ============ HC2 — hover trigger rồi rời ngay (không vào card) → ẩn ============
await user1Btn.hover();
await sleep(500); // mở
const hc2open = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="hc-list"]');
	return !!scope.querySelector('.hover-card-content');
});
// Rời trigger NGAY (đường đi không đi qua card: từ trigger về phía dưới trái,
// card nằm ngay dưới trigger → di chuyển xa ra ngoài)
await page.mouse.move(10, 820, { steps: 12 });
await sleep(400);
const hc2 = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="hc-list"]');
	return !scope.querySelector('.hover-card-content');
});
ok('HC2 hover trigger rồi rời (không vào card) → card hiện rồi ẩn (đúng intent)', hc2open && hc2);

// ============ HC5 — delay: hover + 100ms CHƯA hiện; +400ms → hiện ============
// Dùng trigger code (section hc-code) để tránh nhiễu state user1
const codeTrigger = page.locator('[data-test="hc-code-trigger"]');
await codeTrigger.hover();
await sleep(100);
const hc5early = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="hc-code"]');
	return !!scope.querySelector('.hover-card-content');
});
await sleep(400); // 100 + 400 = 500ms > delay show 300ms
const hc5late = await page.evaluate(() => {
	const scope = document.querySelector('[data-test="hc-code"]');
	const card = scope.querySelector('.hover-card-content');
	return { shown: !!card, role: card?.getAttribute('role'), hasCode: !!card?.querySelector('pre code') };
});
ok(
	'HC5 delay show: 100ms CHƯA hiện; 500ms → hiện (role=tooltip + code block)',
	hc5early === false && hc5late.shown === true && hc5late.role === 'tooltip' && hc5late.hasCode === true,
	JSON.stringify({ hc5early, hc5late })
);

// Dọn state: rời chuột
await page.mouse.move(10, 820, { steps: 6 });
await sleep(300);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
