// Functional probe cho Tooltip (element) — enabled/disabled + ma trận size/color/variant
// + arrow sync. Chạy: node tests/tooltip-probe.mjs (dev server https://localhost:3000)
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000/ui/tooltip';
const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);

// TP0 — structure
ok('TP0 tooltip page render', (await page.locator('[data-test="tooltip-demo"]').count()) === 1);

// Helper: hover một trigger (data-test) → đợi tooltip portal hiện → trả về
// snapshot state của content + arrow (cả hai append vào document.body).
// Màu ghi dạng RGB để so khớp (computed trả rgb() ngay cả khi token là hsl()).
async function hoverProbe(testId, wait = 900) {
	await page.locator(`[data-test="${testId}"]`).hover({ position: { x: 20, y: 10 } });
	await page.waitForTimeout(wait);
	const snap = await page.evaluate(() => {
		const tip = document.querySelector('.tooltip-content');
		if (!tip) return { found: false };
		const cs = window.getComputedStyle(tip);
		const visible = cs.opacity !== '0' && cs.visibility !== 'hidden' && cs.display !== 'none';
		const arrow = document.querySelector('.tooltip-arrow');
		const rect = tip.getBoundingClientRect();
		const aRect = arrow?.getBoundingClientRect();
		return {
			found: true,
			visible,
			classes: tip.className,
			background: cs.backgroundColor,
			color: cs.color,
			borderColor: cs.borderColor,
			position: arrow ? [...arrow.classList].find((c) => c.startsWith('position-')) : null,
			rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
			arrow: !!arrow,
			arrowClasses: arrow?.className ?? null,
			arrowRect: aRect
				? { left: aRect.left, top: aRect.top, right: aRect.right, bottom: aRect.bottom }
				: null
		};
	});
	// Rời chuột để tooltip tắt trước probe tiếp theo.
	await page.mouse.move(640, 850);
	await page.waitForTimeout(250);
	return snap;
}

// Helper: chuyển token (hsl/hex) → rgb string để so với computed style.
async function tokenToRgb(cssVarName) {
	return page.evaluate((name) => {
		const raw = getComputedStyle(document.documentElement)
			.getPropertyValue(name)
			.trim();
		if (!raw) return null;
		const el = document.createElement('span');
		el.style.color = raw;
		document.body.appendChild(el);
		const rgb = getComputedStyle(el).color;
		el.remove();
		return rgb;
	}, cssVarName);
}

// TP1 — enabled hover: tooltip hiện sau delay
const tp1 = await hoverProbe('tp-enabled-trigger');
ok(
	'TP1 enabled hover → tooltip hiện sau ~300ms',
	tp1?.found === true && tp1?.visible === true,
	JSON.stringify(tp1?.found ? { visible: tp1.visible, classes: tp1.classes } : tp1)
);

// TP2 — arrow tồn tại + có class position-* (đã sync)
ok(
	'TP2 tooltip có arrow + class position-*',
	tp1?.arrow === true && /position-(top|bottom|left|right)/.test(tp1?.arrowClasses ?? ''),
	`arrowClasses=${tp1?.arrowClasses}`
);

// TP2b — ARROW SYNC: arrow mọc từ mép content ĐÚNG HƯỚNG position
// (position-top → arrow.top ≈ content.bottom; position-left → tooltip bên trái
// target → arrow mọc từ mép PHẢI content: arrow.left ≈ content.right...).
// Trục VUÔNG GÓC: arrow nằm trong khung content (không trượt ra ngoài — bug
// gốc). Trục THEO HƯỚNG: arrow áp sát mép + chỉ vượt ra tối đa 1 mũi tên
// (arrowSize ≈ 7px — arrow cố ý nằm ngoài khung theo hướng chỉ).
{
	const r = tp1.rect;
	const a = tp1.arrowRect;
	const arrowSize = Math.max(a.right - a.left, a.bottom - a.top);
	const inX = a.left >= r.left - 2 && a.right <= r.right + arrowSize + 2;
	const inY = a.top >= r.top - 2 && a.bottom <= r.bottom + arrowSize + 2;
	const flush =
		tp1.position === 'position-top'
			? Math.abs(a.top - r.bottom) <= 3
			: tp1.position === 'position-bottom'
				? Math.abs(a.bottom - r.top) <= 3
				: tp1.position === 'position-left'
					? Math.abs(a.left - r.right) <= 3
					: Math.abs(a.right - r.left) <= 3;
	// Vuông góc với hướng: chặt hơn — arrow không vượt khung quá 2px trên trục
	// vuông góc (position-left → trục Y; position-top → trục X).
	const perp =
		tp1.position === 'position-top' || tp1.position === 'position-bottom'
			? a.left >= r.left - 2 && a.right <= r.right + 2
			: a.top >= r.top - 2 && a.bottom <= r.bottom + 2;
	ok('TP2b arrow bám mép content theo hướng position', inX && inY && flush && perp, JSON.stringify({ position: tp1.position, content: r, arrow: a }));
}

// TP3 — disabled: root class "disabled"; hover KHÔNG hiện tooltip
{
	// data-test KHÔNG spread xuống DOM trên Tooltip → locate qua class root.
	const wrap = page.locator('.tooltip-root.disabled');
	ok(
		'TP3a disabled root có class "disabled"',
		(await wrap.count()) === 1 &&
			(await wrap.evaluate((w) => w.classList.contains('tooltip-root') && w.classList.contains('disabled')))
	);
	await page.locator('[data-test="tp-disabled-trigger"]').hover({ position: { x: 20, y: 10 } });
	await page.waitForTimeout(700);
	const noTip = await page.evaluate(() => !document.querySelector('.tooltip-content'));
	ok('TP3b disabled: hover KHÔNG hiện tooltip', noTip);
	// cursor not-allowed đọc trên chính root.disabled (display:contents không tạo
	// box nhưng computed cursor vẫn đọc được; control con tự set cursor riêng —
	// hành vi đúng theo thiết kế "control con do user render giữ hành vi riêng").
	const cursor = await page.evaluate(() => {
		const root = document.querySelector('.tooltip-root.disabled');
		if (!root) return { found: false };
		return { found: true, cursor: getComputedStyle(root).cursor };
	});
	ok(
		'TP3c disabled: root cursor not-allowed',
		cursor?.found === true && cursor.cursor === 'not-allowed',
		JSON.stringify(cursor)
	);
	await page.mouse.move(640, 850);
	await page.waitForTimeout(250);
}

// TP4 — variant solid + color info (default root): nền = --color-sky-600
{
	const expect = await tokenToRgb('--color-sky-600');
	const solidInfo = tp1;
	const bgMatch = solidInfo.background === expect;
	ok(
		'TP4 solid+info: nền = raw palette --color-sky-600',
		bgMatch,
		`bg=${solidInfo.background} expect=${expect}`
	);
}

// TP5 — ma trận COLOR (7 màu, variant solid): nền phân biệt đúng raw palette
{
	const palette = ['default', 'secondary', 'success', 'info', 'warning', 'error', 'primary'];
	const refs = {
		default: 'gray',
		secondary: 'cyan',
		success: 'green',
		info: 'sky',
		warning: 'amber',
		error: 'red',
		primary: 'indigo'
	};
	for (const c of palette) {
		const snap = await hoverProbe(`tp-color-${c}-trigger`);
		const expect = await tokenToRgb(`--color-${refs[c]}-600`);
		const pass = snap?.found && snap.background === expect && snap.visible;
		ok(
			`TP5 color=${c}: nền solid = --color-${refs[c]}-600`,
			pass,
			`bg=${snap?.background} expect=${expect}`
		);
	}
}

// TP6 — ma trận VARIANT (4 kiểu, color info): nền/border phân biệt
{
	// soft: nền = --color-sky-100; outline: nền = --content1 + border --color-sky-500;
	// ghost: nền trong suốt
	const softExpect = await tokenToRgb('--color-sky-100');
	const soft = await hoverProbe('tp-variant-soft-trigger');
	ok(
		'TP6a variant=soft: nền = --color-sky-100',
		soft?.found && soft.background === softExpect && soft.visible,
		`bg=${soft?.background} expect=${softExpect}`
	);

	const outline = await hoverProbe('tp-variant-outline-trigger');
	const content1 = await tokenToRgb('--content1');
	const sky500 = await tokenToRgb('--color-sky-500');
	ok(
		'TP6b variant=outline: nền = --content1, border = --color-sky-500',
		outline?.found && outline.background === content1 && outline.borderColor === sky500,
		`bg=${outline?.background} border=${outline?.borderColor}`
	);

	const ghost = await hoverProbe('tp-variant-ghost-trigger');
	ok(
		'TP6c variant=ghost: nền trong suốt',
		ghost?.found && ghost.background === 'rgba(0, 0, 0, 0)' && ghost.visible,
		`bg=${ghost?.background}`
	);
}

// TP7 — ma trận SIZE (14 bậc): tooltip hiện + class size-* đúng bậc
{
	const sizes = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
	for (const s of sizes) {
		const snap = await hoverProbe(`tp-size-${s}-trigger`);
		// font-size computed trả "px" — so qua canvas measure: dùng so sánh với
		// font-size expect quy đổi. Đơn giản: so class size-* có trên element.
		const hasClass = snap?.classes?.includes(`size-${s}`);
		ok(
			`TP7 size=${s}: class size-${s} + tooltip hiện`,
			snap?.found && snap.visible && hasClass,
			`classes=${snap?.classes?.split(' ').filter((c) => c.startsWith('size-')).join(',')}`
		);
	}
}

// FOLLOW probe: hover trigger → move mouse TRONG trigger (mousemove fire, hover
// giữ — move ra ngoài sẽ mouseleave → unmount) → đo content rect TRƯỚC và SAU move.
// follow=true → rect ĐỔI theo anchor mới (mousemove block cập nhật anchor qua
// rAF + FollowContent $effect re-position); follow=false → rect GIỮ NGUYÊN
// (anchor chốt lúc đầu hover, mô hình shadcn/Radix).
async function followProbe(testId) {
	const trigger = page.locator(`[data-test="${testId}"]`);
	// Scroll vào view TRƯỚC khi lấy box — mouse.move thô không tự scroll (section
	// nằm dưới trang → boundingBox ngoài viewport 900px → move không fire event).
	await trigger.scrollIntoViewIfNeeded();
	await page.waitForTimeout(150);
	const box = await trigger.boundingBox();
	// Hover điểm TRÁI trigger → anchor chốt ở đây.
	await page.mouse.move(Math.round(box.x + 20), Math.round(box.y + box.height / 2));
	await page.waitForTimeout(700);
	const before = await page.evaluate(() => {
		const tip = document.querySelector('.tooltip-content');
		if (!tip) return null;
		const r = tip.getBoundingClientRect();
		return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
	});
	// Move chuột TRONG trigger sang phải (di ngang, cùng y — không rời element).
	await page.mouse.move(Math.round(box.x + box.width - 20), Math.round(box.y + box.height / 2), { steps: 5 });
	await page.waitForTimeout(350); // rAF + effect + reposition + transition
	const after = await page.evaluate(() => {
		const tip = document.querySelector('.tooltip-content');
		if (!tip) return null;
		const r = tip.getBoundingClientRect();
		return { left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
	});
	await page.mouse.move(640, 850);
	await page.waitForTimeout(250);
	return { before, after };
}

// TP8 — follow=true: content rect ĐỔI theo chuột (đã định vị + is-shown)
const tp8 = await followProbe('tp-follow-trigger');
ok(
	'TP8 follow=true: content rect đổi theo chuột',
	tp8?.before !== null && tp8?.after !== null && (tp8.before.left !== tp8.after.left || tp8.before.top !== tp8.after.top),
	`before=${JSON.stringify(tp8?.before)} after=${JSON.stringify(tp8?.after)}`
);

// TP8b — follow=true: tooltip vẫn visible sau move (không treo vòng lặp rAF)
ok(
	'TP8b follow=true: tooltip visible sau move (không loop)',
	tp8?.after !== null && tp8.after.w > 0 && tp8.after.h > 0,
	`after=${JSON.stringify(tp8?.after)}`
);

// TP9 — follow=false: content rect GIỮ NGUYÊN (anchor chốt lúc hover)
const tp9 = await followProbe('tp-nofollow-trigger');
ok(
	'TP9 follow=false: content rect giữ nguyên',
	tp9?.before !== null && tp9?.after !== null && tp9.before.left === tp9.after.left && tp9.before.top === tp9.after.top,
	`before=${JSON.stringify(tp9?.before)} after=${JSON.stringify(tp9?.after)}`
);

// TP10 — animate=scale: class animate-scale + tooltip visible
const tp10 = await hoverProbe('tp-animate-scale-trigger');
ok(
	'TP10 animate=scale: class animate-scale + visible',
	tp10?.found === true && tp10?.visible === true && tp10?.classes?.includes('animate-scale'),
	`classes=${tp10?.classes}`
);

// TP10b — animate=scale: is-shown đặt (opacity 1 sau định vị) + arrow bám
ok(
	'TP10b animate=scale: is-shown + arrow sync',
	tp10?.classes?.includes('is-shown') && tp10?.arrow === true,
	`classes=${tp10?.classes} arrow=${tp10?.arrow}`
);

// TP11 — animate=slide: class animate-slide + pos-* (hướng position)
const tp11 = await hoverProbe('tp-animate-slide-trigger');
ok(
	'TP11 animate=slide: class animate-slide + visible',
	tp11?.found === true && tp11?.visible === true && tp11?.classes?.includes('animate-slide'),
	`classes=${tp11?.classes}`
);

// TP11b — animate=slide: is-shown + arrow bám (đã định vị)
ok(
	'TP11b animate=slide: is-shown + arrow sync',
	tp11?.classes?.includes('is-shown') && tp11?.arrow === true && /position-(top|bottom|left|right)/.test(tp11?.arrowClasses ?? ''),
	`classes=${tp11?.classes} arrowClasses=${tp11?.arrowClasses}`
);

// TP12 — reduced motion: emulateMedia reduce → transition '0s' (hiện ngay)
{
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const snap = await hoverProbe('tp-enabled-trigger');
	const cs = await page.evaluate(() => {
		const tip = document.querySelector('.tooltip-content');
		if (!tip) return null;
		return window.getComputedStyle(tip).transitionDuration;
	});
	ok(
		'TP12 reduced motion: transition none',
		snap?.found === true && cs === '0s',
		`transitionDuration=${cs}`
	);
	// Khôi phục media để các probe sau (nếu thêm) chạy bình thường.
	await page.emulateMedia({ reducedMotion: 'no-preference' });
}

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${passed}/${results.length} PASS ===`);
if (failed.length) {
	console.log('FAILED:');
	failed.forEach((f) => console.log(`  - ${f.name}  ${f.extra}`));
	process.exit(1);
}
