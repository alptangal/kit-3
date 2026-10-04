// Đo bounding-box thực tế của 3 panel multi-layer để kiểm tra đồng tâm + "vành" lộ ra.
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000/ui/modal';
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });

await page.getByRole('button', { name: 'Mở Modal', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Mở Modal lồng', exact: true }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Mở Modal lồng sâu hơn (lớp 3)', exact: true }).click();
await page.waitForTimeout(800); // chờ đủ transition layer (0.3s)

const data = await page.evaluate(() => {
	const panels = [...document.querySelectorAll('.modal-container-root')];
	return panels.map((p, i) => {
		const r = p.getBoundingClientRect();
		const cs = getComputedStyle(p);
		const m = cs.transform.match(/matrix\(([-\d.]+)/);
		return {
			i,
			x: +r.x.toFixed(1),
			y: +r.y.toFixed(1),
			w: +r.width.toFixed(1),
			h: +r.height.toFixed(1),
			cx: +((r.x + r.width / 2)).toFixed(1),
			cy: +((r.y + r.height / 2)).toFixed(1),
			scale: m ? parseFloat(m[1]) : 1,
			opacity: cs.opacity,
			blur: cs.filter,
			baseW: getComputedStyle(p).width
		};
	});
});
console.log(JSON.stringify(data, null, 2));
const cxs = data.map((d) => d.cx);
const cys = data.map((d) => d.cy);
console.log(
	'Δ center X:',
	Math.max(...cxs) - Math.min(...cxs),
	'| Δ center Y:',
	Math.max(...cys) - Math.min(...cys)
);
await page.screenshot({ path: 'tests/screenshot/modal-refinements/02b-layers-measure.png' });
await browser.close();
