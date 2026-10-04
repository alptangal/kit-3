// select-advanced-diag.mjs — Diagnostic ground-truth cho auto-flip (04/05) + chip-width (01)
// Log: rect trigger top/bottom, rotation chevron, dropdown rect + class + chủ sở hữu.
import { chromium } from '@playwright/test';

const BASE = 'https://localhost:3000/ui/select';
const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('h1:has-text("Select Component Demo")', { timeout: 20000 });

const dump = async (tag) => {
	const info = await page.evaluate(() => {
		const sec = [...document.querySelectorAll('section')].find((s) =>
			s.querySelector('h2')?.textContent?.includes('Auto-Flip')
		);
		const triggers = [...sec.querySelectorAll('.select-trigger')];
		const drops = [...sec.querySelectorAll('.select-dropdown')];
		return {
			vh: window.innerHeight,
			scrollY: window.scrollY,
			triggers: triggers.map((t, i) => ({
				i,
				...t.getBoundingClientRect().toJSON(),
				caret: getComputedStyle(t.querySelector('.select-trigger__icon') || t).transform,
				open: !!t.closest('[class*="open"]') || !!t.querySelector('input:focus')
			})),
			drops: drops.map((d) => {
				const r = d.getBoundingClientRect();
				const root = d.closest('.select-root');
				const idx = root ? [...sec.querySelectorAll('.select-root')].indexOf(root) : -1;
				return {
					rootIdx: idx,
					up: d.classList.contains('select-dropdown--up'),
					top: r.top,
					bottom: r.bottom,
					height: r.height,
					width: r.width
				};
			})
		};
	});
	console.log(`\n[${tag}] vh=${info.vh} scrollY=${Math.round(info.scrollY)}`);
	info.triggers.forEach((t) =>
		console.log(
			`  trigger#${t.i}: top=${Math.round(t.top)} bottom=${Math.round(t.bottom)} h=${Math.round(
				t.height
			)} caret=${t.caret}`
		)
	);
	info.drops.forEach((d) =>
		console.log(
			`  dropdown(root#${d.rootIdx}): up=${d.up} top=${Math.round(d.top)} bottom=${Math.round(
				d.bottom
			)} h=${Math.round(d.height)} w=${Math.round(d.width)}`
		)
	);
};

const fSec = page.locator('section:has(h2:text("Auto-Flip Position"))');

// ── 04: mở trigger đáy, mong chờ UP ──
const fBottom = fSec.locator('.select-trigger').last();
await fBottom.evaluate((el) => el.scrollIntoView({ block: 'end', inline: 'center' }));
await page.waitForTimeout(100);
await fBottom.click();
await page.waitForSelector('.select-dropdown', { timeout: 3000 });
await page.waitForTimeout(300);
await dump('04 bottom-open');

// ── 05: mở trigger top, mong chờ DOWN ──
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
const fTop = fSec.locator('.select-trigger').first();
await fTop.evaluate((el) => el.scrollIntoView({ block: 'start', inline: 'center' }));
await page.waitForTimeout(100);
await fTop.click();
await page.waitForSelector('.select-dropdown', { timeout: 3000 });
await page.waitForTimeout(300);
await dump('05 top-open');

// ── 01: đo chip width thật trong trigger 260px & trigger rộng hơn ──
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
const cSec = page.locator('section:has(h2:text("Chip Overflow (multiple)"))');
const wrapperW = await cSec.locator('div').first().evaluate((el) => el.getBoundingClientRect().width);
console.log(`\n[01] chip-section wrapper width = ${Math.round(wrapperW)}`);

await browser.close();
