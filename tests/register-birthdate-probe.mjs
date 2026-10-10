// tests/register-birthdate-probe.mjs
// Probe B4 — birthdate register sau khi áp 5 tính năng InputDatetime:
//   RB1  date-only 3 ô (hideTime — không giờ/phút)
//   RB2  format theo lang: vi → dmy (ô đầu = ngày), en → mdy (ô đầu = tháng)
//   RB3  nút picker tồn tại + mở panel DatePicker
//   RB4  minYear/maxYear: gõ năm 1899 → snap 1900; maxYear = năm nay
//   RB5  clearable + cross-field (31/02/2001 → 28)
//   RB6  regression: required thiếu ngày sinh → aria-invalid (form validate)
// BASE: process.env.PROBE_BASE || 'https://localhost:3000'
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const results = [];

function log(name, pass, detail = '') {
	results.push({ name, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'} · ${name}${detail ? ` — ${detail}` : ''}`);
}

const run = async () => {
	const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
	await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
	await page.waitForTimeout(600);

	const scope = page.locator('.datetime-scope');

	// RB1: date-only 3 ô — không có ô giờ/phút
	{
		const boxes = scope.locator('.input-datetime-root .dt-box');
		const count = await boxes.count();
		const segs = [];
		for (let i = 0; i < count; i++) segs.push(await boxes.nth(i).getAttribute('data-segment'));
		log(
			'RB1 · date-only 3 ô (không H/M)',
			count === 3 && !segs.includes('H') && !segs.includes('M'),
			`count=${count} segs=[${segs.join(' ')}]`
		);
	}

	// RB2a: lang store = 'en' (basic.svelte.ts hardcode, không navigator) → mdy
	// — ô display đầu là THÁNG, thứ tự m/d/y
	{
		const first = scope.locator('.dt-box').first();
		const seg = await first.getAttribute('data-segment');
		log('RB2a · lang=en → mdy: ô đầu là tháng', seg === 'm', `first=${seg}`);
	}

	// RB3: nút picker + mở panel
	{
		const btn = scope.locator('.dt-picker');
		const count = await btn.count();
		let panelOpened = false;
		if (count === 1) {
			await btn.click();
			await page.waitForTimeout(300);
			panelOpened = (await scope.locator('.date-picker-panel').count()) === 1;
			await page.keyboard.press('Escape');
			await page.waitForTimeout(200);
		}
		log('RB3 · nút lịch + panel mở được', count === 1 && panelOpened, `btn=${count} panelOpened=${panelOpened}`);
	}

	// RB4: minYear snap 1899 → 1900 + maxYear = năm nay
	{
		const clear = scope.locator('.dt-clear');
		if (await clear.count()) await clear.click();
		await page.waitForTimeout(100);
		const first = scope.locator('.dt-box').first();
		await first.click();
		// mdy en: tháng, ngày, năm — gõ 01/15/1899 → năm snap 1900
		await page.keyboard.type('01151899', { delay: 25 });
		await page.waitForTimeout(200);
		const yearVal = await scope.locator('.dt-box[data-segment="y"]').inputValue();
		log('RB4a · năm 1899 → snap 1900 (minYear)', yearVal === '1900', `year=${yearVal}`);
		// maxYear: gõ năm tương lai xa 9999 → snap năm nay
		const yearBox = scope.locator('.dt-box[data-segment="y"]');
		await yearBox.click();
		await page.keyboard.type('9999', { delay: 30 });
		await page.waitForTimeout(200);
		const yearVal2 = await yearBox.inputValue();
		const nowYear = String(new Date().getFullYear());
		log('RB4b · năm 9999 → snap năm nay (maxYear)', yearVal2 === nowYear, `year=${yearVal2} kỳ ${nowYear}`);
	}

	// RB5: cross-field 02/31/2001 (mdy) → ngày snap 28
	{
		const clear = scope.locator('.dt-clear');
		if (await clear.count()) await clear.click();
		await page.waitForTimeout(100);
		await scope.locator('.dt-box').first().click();
		await page.keyboard.type('02312001', { delay: 25 });
		await page.waitForTimeout(200);
		const dayVal = await scope.locator('.dt-box[data-segment="d"]').inputValue();
		log('RB5 · 02/31/2001 → 28 (cross-field)', dayVal === '28', `day=${dayVal}`);
	}

	// RB6: required — clear rồi gõ thiếu (tháng+ngày, thiếu năm) → aria-invalid
	{
		const clear = scope.locator('.dt-clear');
		if (await clear.count()) await clear.click();
		await page.waitForTimeout(100);
		await scope.locator('.dt-box').first().click();
		await page.keyboard.type('0215', { delay: 25 }); // 02/15 (thiếu năm)
		await page.waitForTimeout(700);
		const invalid = await scope.locator('.dt-box[aria-invalid="true"]').count();
		log('RB6 · required thiếu năm → aria-invalid', invalid > 0, `invalid=${invalid}`);
	}

	await browser.close();

	const failed = results.filter((r) => !r.pass);
	console.log(`\n══ KẾT QUẢ: ${results.length - failed.length}/${results.length} PASS ══`);
	if (failed.length) {
		console.log('FAIL list:');
		for (const f of failed) console.log(`  - ${f.name} — ${f.detail}`);
		process.exit(1);
	}
};

run().catch((err) => {
	console.error('PROBE CRASH:', err);
	process.exit(1);
});
