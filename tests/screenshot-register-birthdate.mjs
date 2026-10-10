// tests/screenshot-register-birthdate.mjs
// Chụp field birthdate register cho ui-checker (B4 — áp 5 tính năng).
// Bẫy: .datetime-scope là display:contents → KHÔNG có boundingBox, phải
// scroll qua .input-datetime-root + clip = union rect các children (evaluate).
// Ảnh đầu sau goto trắng → settle; viewport height > clip cao nhất.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const OUT = 'test-results/ui-check/register-birthdate';

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const page = await browser.newPage({
	viewport: { width: 1280, height: 2400 },
	ignoreHTTPSErrors: true
});
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);

fs.mkdirSync(OUT, { recursive: true });

// union rect của .datetime-scope children (display:contents → rect rỗng)
async function scopeBox() {
	return await page.evaluate(() => {
		const scope = document.querySelector('.datetime-scope');
		if (!scope) return null;
		const rects = [...scope.children].map((c) => c.getBoundingClientRect());
		if (!rects.length) return null;
		const x = Math.min(...rects.map((r) => r.x));
		const y = Math.min(...rects.map((r) => r.y));
		const right = Math.max(...rects.map((r) => r.right));
		const bottom = Math.max(...rects.map((r) => r.bottom));
		return { x, y, width: right - x, height: bottom - y };
	});
}

async function shot(name, includePanel = false) {
	let box = await scopeBox();
	if (!box || !box.height) {
		console.error(`MISSING ${name}`);
		return;
	}
	if (includePanel) {
		// panel absolute TRÀN xuống dưới field (đo thực tế: +320px) → mở rộng clip
		const pr = await page.evaluate(() => {
			const panel = document.querySelector('.datetime-scope .date-picker-panel');
			if (!panel) return null;
			const r = panel.getBoundingClientRect();
			return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
		});
		if (pr) {
			const x = Math.min(box.x, pr.x);
			const y = Math.min(box.y, pr.y);
			box = {
				x,
				y,
				width: Math.max(box.x + box.width, pr.right) - x,
				height: Math.max(box.y + box.height, pr.bottom) - y
			};
		}
	}
	await page.screenshot({
		path: path.join(OUT, `${name}.png`),
		clip: {
			x: Math.max(0, box.x - 8),
			y: Math.max(0, box.y - 8),
			width: box.width + 16,
			height: Math.min(box.height + 16, 2200)
		}
	});
	console.log(`SHOT ${name}.png (${Math.round(box.width)}x${Math.min(Math.round(box.height), 2200)})`);
}

const root = page.locator('.datetime-scope .input-datetime-root');

// 1) Field birthdate trống (3 ô mdy + nút lịch)
await root.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await shot('birthdate-empty');

// 2) Đã gõ giá trị (nút clear hiện)
await root.locator('.dt-box').first().click();
await page.keyboard.type('02151990', { delay: 30 });
await page.waitForTimeout(300);
await shot('birthdate-filled');

// 3) Panel picker đang mở (field + lịch) — clip gồm cả panel absolute
await root.locator('.dt-picker').click();
await page.waitForTimeout(400);
await shot('birthdate-picker-open', true);

await browser.close();
console.log('DONE');
