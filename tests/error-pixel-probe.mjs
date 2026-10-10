// tests/error-pixel-probe.mjs — probe ErrorPage pixel-digit layer + fullscreen + nút Home/Back
// Chạy: node tests/error-pixel-probe.mjs
import { chromium } from 'playwright';

const BASE = 'https://localhost:3000';
const results = [];
let pass = 0;
let fail = 0;
function record(name, ok, detail = '') {
	results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
	if (ok) pass++;
	else fail++;
}

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// ── Helper: load page + thu thập cells-on ──
async function loadErrorPage(url) {
	const context = await browser.newContext({ ignoreHTTPSErrors: true });
	const page = await context.newPage();
	await page.goto(url, { waitUntil: 'networkidle' });
	await page.waitForTimeout(700);
	return { context, page };
}

// Đọc tham chiếu màu: span trick — color: var(--warning) → computed rgb
function rgbRef(page, token) {
	return page.evaluate((t) => {
		const span = document.createElement('span');
		span.style.color = `var(${t})`;
		document.body.appendChild(span);
		const rgb = getComputedStyle(span).color;
		span.remove();
		return rgb;
	}, token);
}

// ── (a) /ui/error?status=404 — layer pixel render ──
{
	const { context, page } = await loadErrorPage(`${BASE}/ui/error?status=404`);
	const info = await page.evaluate(() => {
		const root = document.querySelector('[data-test="error-root"]');
		const matrix = root?.querySelector('.error-matrix');
		const cellsOn = root ? Array.from(root.querySelectorAll('[data-cell-on]')) : [];
		const cellsRain = root ? root.querySelectorAll('[data-cell]').length : 0;
		const rects = cellsOn.map((el) => {
			const r = el.getBoundingClientRect();
			const m = matrix?.getBoundingClientRect();
			return {
				x: Math.round(r.x),
				y: Math.round(r.y),
				w: Math.round(r.width),
				h: Math.round(r.height),
				inMatrix: m ? r.x >= m.x - 2 && r.y >= m.y - 2 && r.right <= m.right + 2 && r.bottom <= m.bottom + 2 : false,
				col: el.style.getPropertyValue('--cell-col'),
				row: el.style.getPropertyValue('--cell-row')
			};
		});
		const color = cellsOn[0] ? getComputedStyle(cellsOn[0]).backgroundColor : '';
		const caption = root?.querySelector('[data-test="error-status"]')?.textContent ?? '';
		const statusLegacy = root?.querySelector('.error-status');
		return {
			cellsOn: cellsOn.length,
			cellsRain,
			rects,
			color,
			caption,
			hasLegacyStatus: Boolean(statusLegacy)
		};
	});

	// Đếm pixel bitmap mong đợi của "404": digitCells của 4,0,4
	const bmp404 = 4 * 2 + 0; // placeholder — tính thật bên dưới qua import
	// Import bitmap để tính chính xác (node ESM)
	const { digitPixelCount } = await import('../src/lib/components/element/error/_pixel-font.ts').catch(
		() => ({ digitPixelCount: null })
	);
	let expected = null;
	if (digitPixelCount) {
		expected = digitPixelCount('4') * 2 + digitPixelCount('0');
	} else {
		// Fallback hardcode: digit "4" = 11 pixel, "0" = 12 pixel (bitmap 5×7 ở trên)
		expected = 11 * 2 + 12; // = 34
	}
	record(
		'PX1 pixel layer 404 render đúng số pixel bitmap',
		Math.abs(info.cellsOn - expected) <= 2,
		`cellsOn=${info.cellsOn}, expected≈${expected} (bmp404 var=${bmp404})`
	);
	record(
		'PX1.1 cells-on nằm TRONG matrix bounds',
		info.rects.every((r) => r.inMatrix),
		`${info.rects.filter((r) => r.inMatrix).length}/${info.rects.length} in-bounds`
	);
	const warnRef = await rgbRef(page, '--warning');
	record(
		'PX1.2 màu cell-on = warning (same-system rgb)',
		normalize(info.color) === normalize(warnRef),
		`cell-on=${info.color}, ref=${warnRef}`
	);
	record(
		'PX1.3 caption 404 hiển thị, KHÔNG còn .error-status legacy',
		info.caption === '404' && !info.hasLegacyStatus,
		`caption="${info.caption}", legacy=${info.hasLegacyStatus}`
	);
	await context.close();
}

function normalize(rgb) {
	// Chuẩn hóa "rgb(r, g, b)" → "r,g,b" (bỏ khoảng trắng — tránh lệch format)
	return String(rgb).replace(/\s+/g, '').replace(/rgba?\(/, '').replace(/\)$/, '');
}

// ── (b) ?status=500 → danger; ?status=403 → warning ──
for (const [status, token, nameTag] of [
	['500', '--danger', '500→danger'],
	['403', '--warning', '403→warning']
]) {
	const { context, page } = await loadErrorPage(`${BASE}/ui/error?status=${status}`);
	const color = await page.evaluate(() => {
		const cell = document.querySelector('[data-cell-on]');
		return cell ? getComputedStyle(cell).backgroundColor : '';
	});
	const ref = await rgbRef(page, token);
	record(
		`PX2 ${nameTag} màu cell-on khớp`,
		normalize(color) === normalize(ref),
		`cell-on=${color}, ref=${ref}`
	);
	await context.close();
}

// ── (c) --error-cols/--error-rows set đúng từ JS ──
{
	const { context, page } = await loadErrorPage(`${BASE}/ui/error?status=404`);
	const vars = await page.evaluate(() => {
		const root = document.querySelector('[data-test="error-root"]');
		const matrix = root?.querySelector('.error-matrix');
		return {
			cols: matrix ? getComputedStyle(matrix).getPropertyValue('--error-cols').trim() : '',
			rows: matrix ? getComputedStyle(matrix).getPropertyValue('--error-rows').trim() : '',
			gridCols: matrix ? getComputedStyle(matrix).gridTemplateColumns.split(' ').length : 0,
			gridRows: matrix ? getComputedStyle(matrix).gridTemplateRows.split(' ').length : 0
		}		;
	});
	record(
		'PX3 --error-cols/--error-rows set từ JS',
		vars.cols === '40' && vars.rows === '14',
		`cols=${vars.cols}, rows=${vars.rows}`
	);
	record(
		'PX3.1 grid thực tế theo vars (gridTemplateColumns 40 cột)',
		vars.gridCols === 40,
		`gridCols=${vars.gridCols}`
	);
	await context.close();
}

// ── (d) Matrix full viewport ──
{
	const { context, page } = await loadErrorPage(`${BASE}/ui/error?status=404`);
	const vp = page.viewportSize();
	const rect = await page.evaluate(() => {
		const m = document.querySelector('[data-test="error-root"] .error-matrix');
		if (!m) return null;
		const r = m.getBoundingClientRect();
		return { x: r.x, y: r.y, w: r.width, h: r.height };
	});
	record(
		'PX4 matrix full viewport (rect >= viewport - 2px)',
		rect && rect.w >= vp.width - 2 && rect.h >= vp.height - 2 && Math.abs(rect.x) <= 2 && Math.abs(rect.y) <= 2,
		`rect=${rect ? `${Math.round(rect.w)}x${Math.round(rect.h)} @${Math.round(rect.x)},${Math.round(rect.y)}` : 'null'}, vp=${vp.width}x${vp.height}`
	);
	await context.close();
}

// ── (e) Nút Home + Back render, click Home → goto / ──
{
	const { context, page } = await loadErrorPage(`${BASE}/ui/error?status=404`);
	const btns = await page.evaluate(() => {
		// Button KHÔNG render data-test xuống DOM (chỉ chọn props cụ thể) →
		// tìm qua .error-actions: nút đầu = Home (<a>), nút sau = Back (<button>)
		const row = document.querySelector('.error-actions');
		const kids = row ? Array.from(row.children) : [];
		const home = kids[0];
		const back = kids[1];
		return {
			homeCount: kids.length,
			home: home ? home.tagName + '|' + (home.getAttribute('href') ?? '') : null,
			back: back ? back.tagName : null,
			homeText: home?.textContent?.trim() ?? '',
			backText: back?.textContent?.trim() ?? ''
		};
	});
	record(
		'PX5 nút Home render (a, href hợp lệ về /)',
		btns.home !== null && btns.home.startsWith('A|') && /(\/|\.\.\/)$/.test(btns.home.split('|')[1]),
		`home=${btns.home}, text="${btns.homeText}", rowChildren=${btns.homeCount}`
	);
	record('PX5.1 nút Back render (button)', btns.back === 'BUTTON', `back=${btns.back}, text="${btns.backText}"`);

	try {
		await Promise.race([
			page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 10000 }),
			page.click('.error-actions > :first-child')
		]);
	} catch {
		// click race timeout — kiểm url hiện tại
	}
	await page.waitForTimeout(1500);
	const currentUrl = new URL(page.url());
	const status = await page.evaluate(async () => {
		const r = await fetch('/', { method: 'GET' });
		return r.status;
	});
	record(
		'PX5.2 click Home → goto / (200)',
		currentUrl.pathname === '/' && status === 200,
		`url=${currentUrl.href}, fetchStatus=${status}`
	);
	await context.close();
}

// ── (f) Deterministic: 2 lần load cùng cells count + SSR html chứa pattern ──
{
	// 2 lần load client
	const a = await loadErrorPage(`${BASE}/ui/error?status=404`);
	const countA = await a.page.evaluate(() => document.querySelectorAll('[data-cell-on]').length);
	await a.context.close();
	const b = await loadErrorPage(`${BASE}/ui/error?status=404`);
	const countB = await b.page.evaluate(() => document.querySelectorAll('[data-cell-on]').length);
	await b.context.close();
	record('PX6 deterministic: 2 lần load cùng cells count', countA === countB, `countA=${countA}, countB=${countB}`);

	// SSR html: fetch text, so digit pattern xuất hiện — node fetch bỏ verify TLS
	const ssrResp = await fetch(`${BASE}/ui/error?status=404`, {
		headers: { accept: 'text/html' }
	}).catch(() => null);
	let html = ssrResp ? await ssrResp.text() : '';
	if (!html) {
		// Fallback: dùng page.request trong context mới (Playwright tự bỏ verify)
		const lastCtx = await browser.newContext({ ignoreHTTPSErrors: true });
		const lastPage = await lastCtx.newPage();
		const resp = await lastPage.request.get(`${BASE}/ui/error?status=404`);
		html = await resp.text();
		await lastCtx.close();
	}
	const ssrCount = (html.match(/data-cell-on="/g) || []).length;
	record(
		'PX6.1 SSR html chứa cùng cells-on pattern',
		ssrCount === countA,
		`ssrCount=${ssrCount}, clientCount=${countA}`
	);
}

// ── (g) Reduced-motion: cells-on không animation-delay ──
{
	const context = await browser.newContext({ ignoreHTTPSErrors: true, reducedMotion: 'reduce' });
	const page = await context.newPage();
	await page.goto(`${BASE}/ui/error?status=404`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(400);
	const rm = await page.evaluate(() => {
		const cells = Array.from(document.querySelectorAll('[data-cell-on]'));
		if (!cells.length) return { count: 0 };
		const first = getComputedStyle(cells[0]);
		return {
			count: cells.length,
			animation: first.animationName,
			duration: first.animationDuration,
			delay: first.animationDelay,
			opacity: first.opacity
		};
	});
	record(
		'PX7 reduced-motion: cell-on không animation-delay (tức thì)',
		rm.count > 0 && (rm.animation === 'none' || parseFloat(rm.delay) === 0),
		`count=${rm.count}, animation=${rm.animation}, delay=${rm.delay}, opacity=${rm.opacity}`
	);
	await context.close();
}

await browser.close();
console.log(results.join('\n'));
console.log(`\nTỔNG: ${pass}/${pass + fail} PASS`);
process.exit(fail > 0 ? 1 : 0);
