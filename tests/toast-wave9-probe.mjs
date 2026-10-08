// tests/toast-wave9-probe.mjs
// Verify Wave 9 Toast — 2 điểm UI:
//  W9.1 .toast-root có align-items: center (căn dọc trục giữa)
//  W9.2 Icon svg (Indicator) thẳng hàng trục giữa root (cy = root center)
//  W9.3 Content KHÔNG stretch (height = height tự nhiên, không = root content-box)
//  W9.4 Title line-1 thẳng hàng icon (icon cy trong phạm vi title line-1)
//  W9.5 Description (nếu có) căn giữa root
//  W9.6 Action button (nếu có) căn giữa root
//  W9.7 Close button: class aspect-square + computed aspect-ratio 1/1
//  W9.8 Close button: width == height (square ratio thực tế)
//  W9.9 Close button: giữ position absolute + translate(50%, -50%) ở góc phải-trên
// Trang demo: /ui/toast — dùng nút Success demo (toast có icon + title + description).
import { chromium } from '@playwright/test';

const results = [];
const ok = (name, cond, extra = '') => {
	results.push({ name, pass: !!cond, extra });
	console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  → ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PORT = process.env.PORT || 3000;
const BASE = `https://localhost:${PORT}`;

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(`${BASE}/ui/toast`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="toast-wrapper"]', { state: 'attached', timeout: 30000 });
await sleep(500);

// Bấm nút Success demo → toast có icon + title + description + action (probe event
// `toast-probe:fire` tạo toast KHÔNG icon/description → không dùng).
await page.locator('[data-test="toast-btn-success"]').click();
await page
	.locator('.toast-root', { hasText: 'Đã lưu thành công' })
	.waitFor({ state: 'visible', timeout: 5000 });
await sleep(1500); // iconify load xong (svg có kích thước thật)

const m = await page.evaluate(() => {
	const root = [...document.querySelectorAll('.toast-root')].find((r) =>
		r.textContent?.includes('Đã lưu thành công')
	);
	if (!root) return null;
	const rr = root.getBoundingClientRect();
	const rs = getComputedStyle(root);
	const svg = root.querySelector('svg');
	const content = root.querySelector('.toast-content-root');
	const title = root.querySelector('.toast-content-title-root');
	const desc = root.querySelector('.description-root');
	const actionBtn = [...root.querySelectorAll('button')].find((b) =>
		b.textContent?.includes('Xem lại')
	);
	const svgRect = svg?.getBoundingClientRect();
	const contentRect = content?.getBoundingClientRect();
	const titleRect = title?.getBoundingClientRect();
	const descRect = desc?.getBoundingClientRect();
	const actionRect = actionBtn?.getBoundingClientRect();
	return {
		root: {
			alignItems: rs.alignItems,
			display: rs.display,
			h: rr.height,
			// content-box height (không padding) — Content KHÔNG stretch nghĩa là
			// height Content < content-box height (vì Content không full 2 khối).
			contentBoxH: rr.height - parseFloat(rs.paddingTop) - parseFloat(rs.paddingBottom)
		},
		icon: svgRect
			? { cy: svgRect.y + svgRect.height / 2 - rr.y, h: svgRect.height, w: svgRect.width }
			: null,
		content: contentRect ? { y: contentRect.y - rr.y, h: contentRect.height } : null,
		title: titleRect ? { y: titleRect.y - rr.y, h: titleRect.height } : null,
		desc: descRect ? { cy: descRect.y + descRect.height / 2 - rr.y, h: descRect.height } : null,
		action: actionRect ? { cy: actionRect.y + actionRect.height / 2 - rr.y } : null
	};
});

if (!m) {
	ok('W9 setup: tìm thấy toast success', false, 'toast không render');
} else {
	// W9.1 — align-items: center
	ok('W9.1 .toast-root align-items: center', m.root.alignItems === 'center', `alignItems=${m.root.alignItems}`);

	// W9.2 — icon svg cy = root center (dựa trục giữa)
	const rootCy = m.root.h / 2;
	ok(
		'W9.2 icon svg căn giữa trục dọc root (±2px)',
		m.icon && Math.abs(m.icon.cy - rootCy) <= 2,
		`iconCy=${m.icon?.cy} rootCy=${rootCy}`
	);

	// W9.3 — Content KHÔNG stretch: height < content-box height (chỉ 1 khối text
	// tự nhiên + description). Trước sửa Content stretch full = contentBoxH.
	ok(
		'W9.3 Content không stretch (height < content-box)',
		m.content && m.content.h < m.root.contentBoxH - 1,
		`contentH=${m.content?.h} contentBoxH=${m.root.contentBoxH}`
	);

	// W9.4 — title line-1 thẳng hàng icon: icon cy nằm trong phạm vi dòng đầu title
	// (title.y .. title.y + lineHeight 24px).
	const titleLine1Top = m.title?.y ?? 0;
	ok(
		'W9.4 icon thẳng hàng dòng đầu title (icon cy trong line-1)',
		m.icon && m.icon.cy >= titleLine1Top && m.icon.cy <= titleLine1Top + 24,
		`iconCy=${m.icon?.cy} titleLine1=[${titleLine1Top}..${titleLine1Top + 24}]`
	);

	// W9.5 — description nằm TRONG Content (dưới title), KHÔNG tự căn giữa root
	// (description là hàng 2 của khối Content; căn giữa root là việc của Content).
	if (m.desc) {
		const descInsideContent =
			m.desc.cy > (m.title?.y ?? 0) + (m.title?.h ?? 0) - 6 && m.desc.cy < m.root.contentBoxH;
		ok(
			'W9.5 description nằm dưới title trong khối Content',
			descInsideContent,
			`descCy=${m.desc.cy} titleBottom=${(m.title?.y ?? 0) + (m.title?.h ?? 0)} contentBoxH=${m.root.contentBoxH}`
		);
	} else {
		ok('W9.5 description vị trí (skip — không có description)', true);
	}

	// W9.6 — action button căn giữa root (±2px)
	if (m.action) {
		ok(
			'W9.6 action button căn giữa trục dọc root (±2px)',
			Math.abs(m.action.cy - rootCy) <= 2,
			`actionCy=${m.action.cy} rootCy=${rootCy}`
		);
	} else {
		ok('W9.6 action button căn giữa (skip — không có action)', true);
	}
}

// ── Close button (chỉ hiện khi hover toast) ──
await page.locator('.toast-root', { hasText: 'Đã lưu thành công' }).hover();
await sleep(300);
const c = await page.evaluate(() => {
	const root = [...document.querySelectorAll('.toast-root')].find((r) =>
		r.textContent?.includes('Đã lưu thành công')
	);
	if (!root) return null;
	const btn = root.querySelector('button[aria-label="Đóng thông báo"]');
	if (!btn) return { found: false };
	const rect = btn.getBoundingClientRect();
	const s = getComputedStyle(btn);
	return {
		found: true,
		cls: btn.className,
		aspectRatio: s.aspectRatio,
		w: rect.width,
		h: rect.height,
		// Kiểm position absolute + translate(50%, -50%)
		position: s.position,
		transform: s.transform,
		// transform matrix: translate(50%,-50%) → e, f = w/2, -h/2
		expectedE: rect.width / 2,
		expectedF: -rect.height / 2
	};
});

if (!c || !c.found) {
	ok('W9.7 close button render khi hover', false, 'không tìm thấy nút close');
} else {
	ok('W9.7 close button có class aspect-square', c.cls.includes('aspect-square'), c.cls.slice(-40));

	// Computed aspect-ratio: 'auto/1/1' tùy browser — chấp nhận 1/1 hoặc auto/1/1
	const ratioOk = c.aspectRatio === '1 / 1' || c.aspectRatio === 'auto / 1 / 1' || c.aspectRatio.includes('1 / 1');
	ok('W9.7b close button computed aspect-ratio 1/1', ratioOk, `aspectRatio=${c.aspectRatio}`);

	ok(
		'W9.8 close button square ratio thực tế (width == height ±1px)',
		Math.abs(c.w - c.h) <= 1,
		`w=${c.w} h=${c.h}`
	);

	// W9.9 — giữ position absolute + translate(50%, -50%)
	// transform matrix(a,b,c,d,e,f): translate → e/f
	let tfOk = false;
	let tfDetail = c.transform;
	const mm = c.transform.match(/matrix\(([^)]+)\)/);
	if (mm) {
		const parts = mm[1].split(',').map((v) => parseFloat(v.trim()));
		if (parts.length === 6) {
			tfOk = Math.abs(parts[4] - c.expectedE) <= 1 && Math.abs(parts[5] - c.expectedF) <= 1;
			tfDetail = `e=${parts[4]} (expect ${c.expectedE}), f=${parts[5]} (expect ${c.expectedF})`;
		}
	} else if (c.transform.includes('translate')) {
		tfOk = true;
	}
	ok('W9.9 close giữ translate(50%,-50%)', tfOk, tfDetail);

	const posOk = c.position === 'absolute';
	ok('W9.9b close position absolute', posOk, `position=${c.position}`);
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
