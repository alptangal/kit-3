// input-file-wave11-shots.mjs — chụp 4 ảnh WAVE 11 với state sạch (mỗi ảnh
// load lại trang riêng để tránh state tích lũy từ các bước trước).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.PROBE_BASE ?? 'https://localhost:3000/ui/input';
const shotDir = 'tests/screenshots/input-file';
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 },
	deviceScaleFactor: 2,
	colorScheme: 'light'
});

const FIX = 'tests/fixtures';
const p = (n) => join(FIX, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function freshPage() {
	const page = await context.newPage();
	await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
	await page.waitForSelector('[data-test="input-demo"]', { timeout: 60000 });
	await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
	await page.waitForTimeout(800);
	// Hydration gate
	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser', { timeout: 10000 }),
		page.locator('.input-file-dropzone').first().click()
	]);
	await chooser.setFiles([]).catch(() => {});
	await sleep(200);
	return page;
}

const shot = async (page, name) => {
	await page.locator('[data-test="if-quick-delete"]').screenshot({ path: `${shotDir}/${name}` });
	console.log('shot:', name);
};

// ── Shot 1: unchecked (3 files, không chọn gì) ──
{
	const page = await freshPage();
	const qs = page.locator('[data-test="if-quick-delete"]');
	await qs.locator('input[type="file"]').setInputFiles([p('logo.png'), p('notes.txt'), p('cover.png')]);
	await sleep(400);
	const state = await qs.locator('[data-test="input-file-select-all"] .checkbox-root').getAttribute('aria-checked');
	console.log('shot1 aria-checked:', state);
	await shot(page, 'w11-01-selectall-unchecked.png');
	await page.close();
}

// ── Shot 2: checked (click select-all) ──
{
	const page = await freshPage();
	const qs = page.locator('[data-test="if-quick-delete"]');
	await qs.locator('input[type="file"]').setInputFiles([p('logo.png'), p('notes.txt'), p('cover.png')]);
	await sleep(400);
	await qs.locator('[data-test="input-file-select-all"] .checkbox-root').click();
	await sleep(400);
	const state = await qs.locator('[data-test="input-file-select-all"] .checkbox-root').getAttribute('aria-checked');
	console.log('shot2 aria-checked:', state);
	await shot(page, 'w11-02-selectall-checked.png');
	await page.close();
}

// ── Shot 3 + 4: indeterminate + quickbar visible (tick 1 card) ──
{
	const page = await freshPage();
	const qs = page.locator('[data-test="if-quick-delete"]');
	await qs.locator('input[type="file"]').setInputFiles([p('logo.png'), p('notes.txt'), p('cover.png')]);
	await sleep(400);
	await qs.locator('[data-test="input-file-check"] > .checkbox-root').nth(0).click();
	await sleep(400);
	const state = await qs.locator('[data-test="input-file-select-all"] .checkbox-root').getAttribute('aria-checked');
	const indet = await qs.locator('[data-test="input-file-select-all"] .checkbox-root').evaluate((el) => el.classList.contains('indeterminate'));
	console.log('shot3 aria-checked:', state, 'indeterminate class:', indet);
	await shot(page, 'w11-03-selectall-indeterminate.png');
	await shot(page, 'w11-04-quickbar-visible.png');
	await page.close();
}

await browser.close();
console.log('DONE');
