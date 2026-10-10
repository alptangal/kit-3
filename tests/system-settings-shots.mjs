// system-settings-shots.mjs — screenshot /settings: General + Security + Commerce + Appearance + Status tab
import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE_URL = 'https://localhost:3000';
const OUT_DIR = 'test-results/system-settings';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

// Login
await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.form-root .auth-input-wrapper input', { timeout: 20000 });
await page.locator('.form-root .auth-input-wrapper input').first().fill('admin');
await page.locator('.form-root .auth-input-wrapper input').nth(1).fill('123123_Qwe');
await page.locator('.auth-btn-submit').first().click();
await page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 20000 });
console.log('logged in');

await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('[data-test="settings-title"]', { timeout: 20000 });
// Đợi settings load xong (input app-name có value) — Input component không
// spread data-test xuống DOM (pattern BasicProps đã ghi chú trong input/Main) → dùng id
await page.waitForFunction(() => {
	const inp = document.querySelector('#settings-app-name');
	return !!inp && inp.value !== '';
}, { timeout: 20000 });
console.log('appName loaded (waitForFunction PASS)');
// ÉP REPAINT trước ảnh đầu: ảnh đầu tiên sau page.goto từng bị trắng
// (5289B blank PNG qua nhiều run) dù DOM/animation-probe báo đã paint —
// headless Chromium chỉ chụp frame compositor ĐÃ present, và evaluate/rAF
// không tạo thay đổi thị giác nào → frame cuối cùng compositor có vẫn là
// frame trắng ban đầu. Click tab (hidden/display swap) buộc present frame
// mới; các ảnh sau click-tab chưa từng bị trắng. Warm-up screenshot KHÔNG
// hiệu quả (đã thử) vì bản thân nó cũng chỉ đọc frame cũ.
await page.locator('[data-test="tab-trigger-security"]').click();
await page.waitForFunction(
	() => document.querySelector('[data-test="tab-trigger-security"]')?.getAttribute('aria-selected') === 'true',
	{ timeout: 5000 }
);
await page.locator('[data-test="tab-trigger-general"]').click();
await page.waitForFunction(
	() => document.querySelector('[data-test="tab-trigger-general"]')?.getAttribute('aria-selected') === 'true',
	{ timeout: 5000 }
);
// Chờ indicator + màu trigger transition (300ms) CHẠY HẾT trước khi chụp —
// nếu không ảnh bắt giữa chừng: DOM general active nhưng underline + màu
// còn bay → ui-checker đọc nhầm tab active (đã từng bắt elapsed 17/300ms).
// Fallback timeout 2s: nếu có animation infinite (spinner) thì proceed anyway.
await page
	.waitForFunction(() => document.getAnimations({ subtree: true }).length === 0, { timeout: 2000 })
	.catch(() => {});
// Warm-up screenshot (vứt buffer): ảnh ĐẦU TIÊN sau hydrate từng bị trắng
// (5289B blank PNG — Chromium headless Windows captureScreenshot đầu đọc frame
// chưa composite dù DOM đã loaded; ảnh thứ 2+ luôn ổn, navStart không đổi
// chứng minh không reload). Ép compositor produce frame thật trước ảnh thật.
await page.screenshot();
// Log DOM state NGAY trước mỗi lần chụp — đối chiếu với ui-checker sau.
// navType: 'navigate' = load đầu, 'reload' = trang tự reload (thủ phạm reset
// state về loading giữa waitForFunction PASS và screenshot).
const logState = async (label) => {
	const s = await page.evaluate(() => {
		const nav = performance.getEntriesByType('navigation')[0];
		// Mọi animation đang sống (gồm cả View Transition pseudo animations)
		const anims = document
			.getAnimations({ subtree: true })
			.slice(0, 8)
			.map((a) => {
				const timing = a.effect?.getComputedTiming();
				return {
					name: a.animationName ?? a.transitionProperty ?? a.id ?? 'anim',
					elapsed: Math.round(a.currentTime ?? 0),
					end: Math.round(timing?.endTime ?? 0)
				};
			});
		return {
			loading: document.querySelector('.settings-state')?.textContent?.trim() ?? null,
			appName: document.querySelector('#settings-app-name')?.value ?? null,
			navType: nav?.type ?? null,
			navStart: nav ? Math.round(nav.startTime) : null,
			now: Math.round(performance.now()),
			anims,
			htmlClip: getComputedStyle(document.documentElement).clipPath,
			htmlOpacity: getComputedStyle(document.documentElement).opacity,
			bodyOpacity: getComputedStyle(document.body).opacity
		};
	});
	console.log(`[state ${label}] ${JSON.stringify(s)}`);
};
// Nếu trang reload giữa chừng, waitForFunction ở dưới sẽ treo — phát hiện
// reload bằng cách theo dõi navStart thay đổi giữa 2 lần log.
await logState('general');
// Double-rAF: chờ ≥ 2 frame được COMPOSE sau khi DOM settle — chặn paint race
// (screenshot từng bắt frame trắng/loading dù DOM đã loaded: CDP captureScreenshot
// đọc từ compositor, DOM pass ≠ frame đã paint; waitForFunction poll bằng rAF
// nên có thể pass trong chính frame vừa mutate).
const settlePaint = async () => {
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	);
};
await logState('general');
await settlePaint();
await page.screenshot({ path: `${OUT_DIR}/settings-general.png` });
console.log('shot: settings-general.png');

for (const tab of ['security', 'commerce', 'appearance', 'status']) {
	await page.locator(`[data-test="tab-trigger-${tab}"]`).click();
	// Đợi tab thật sự active (aria-selected) — không dùng timeout cứng
	await page.waitForFunction(
		(t) => document.querySelector(`[data-test="tab-trigger-${t}"]`)?.getAttribute('aria-selected') === 'true',
		tab,
		{ timeout: 5000 }
	);
	await page.waitForTimeout(500);
	// Status tab đợi status-grid render
	if (tab === 'status') {
		await page.waitForFunction(() => !!document.querySelector('[data-test="status-grid"]'), { timeout: 20000 });
		await page.waitForTimeout(400);
	}
	await logState(tab);
	await settlePaint();
	// Chờ mọi transition kết thúc (indicator 300ms) — tránh ảnh bắt giữa chừng
	await page
		.waitForFunction(() => document.getAnimations({ subtree: true }).length === 0, { timeout: 2000 })
		.catch(() => {});
	await page.screenshot({ path: `${OUT_DIR}/settings-${tab}.png` });
	console.log(`shot: settings-${tab}.png`);
}

await browser.close();
console.log('DONE');
