// Screenshot tooltip wave 6 (follow + animate) — 4 ảnh vào tests/screenshots/tooltip/.
// Chụp khi tooltip ĐANG hiển thị (hover trigger + đợi is-shown). Content/arrow là
// portal element (append body) → dùng clip theo rect (element.screenshot clip sai
// với panel absolute — bẫy wave 5).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'tests/screenshots/tooltip';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2
});
const page = await context.newPage();
await page.goto('https://localhost:3000/ui/tooltip', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.tooltip-root', { timeout: 20000 });
await page.waitForTimeout(400);

// Hover trigger → đợi tooltip định vị + is-shown → clip vùng quanh tooltip
// (content rect + margin 40px) → screenshot.
async function shotTooltip(testIdTrigger, outPath) {
	const trigger = page.locator(`[data-test="${testIdTrigger}"]`);
	await trigger.scrollIntoViewIfNeeded();
	await page.waitForTimeout(150);
	await trigger.hover({ position: { x: 20, y: 10 } });
	await page.waitForTimeout(900); // delay 300 + transition 200 + settle
	const clip = await page.evaluate(() => {
		const tip = document.querySelector('.tooltip-content');
		if (!tip) return null;
		const r = tip.getBoundingClientRect();
		const a = document.querySelector('.tooltip-arrow')?.getBoundingClientRect();
		const left = Math.min(r.left, a?.left ?? r.left);
		const top = Math.min(r.top, a?.top ?? r.top);
		const right = Math.max(r.right, a?.right ?? r.right);
		const bottom = Math.max(r.bottom, a?.bottom ?? r.bottom);
		const M = 40;
		return {
			x: Math.max(0, Math.round(left - M)),
			y: Math.max(0, Math.round(top - M)),
			width: Math.min(1280, Math.round(right - left + M * 2)),
			height: Math.min(900, Math.round(bottom - top + M * 2))
		};
	});
	if (!clip) {
		console.log('WARN: không thấy .tooltip-content cho', testIdTrigger);
		return;
	}
	await page.screenshot({ path: `${OUT}/${outPath}`, clip });
	console.log('shot:', outPath, JSON.stringify(clip));
	// Rời chuột cho lần chụp sau.
	await page.mouse.move(640, 850);
	await page.waitForTimeout(300);
}

// 06: follow=true (tooltip bám chuột — hover điểm trái trigger)
await shotTooltip('tp-follow-trigger', '06-follow.png');
// 07: animate=scale (opacity + scale 0.95)
await shotTooltip('tp-animate-scale-trigger', '07-animate-scale.png');
// 08: animate=slide (opacity + dịch 4px theo hướng position)
await shotTooltip('tp-animate-slide-trigger', '08-animate-slide.png');

// 09: fullpage (refresh với các section demo mới: follow + animate)
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/09-fullpage.png`, fullPage: true });
console.log('shot: 09-fullpage (fullPage)');

await browser.close();
