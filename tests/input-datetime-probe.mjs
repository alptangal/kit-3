// tests/input-datetime-probe.mjs
// Probe InputDatetime — 5 tính năng Pha 2 + regression các hành vi cũ:
//   1) format đa ngôn ngữ (display order + separator, value ISO không đổi)
//   2) nút datePicker (PickerToggle → panel DatePicker → select → bridge ISO)
//   3) validate khi gõ (snap tháng/ngày/giờ/phút) + minYear/maxYear
//   4) clearable (nút xóa toàn bộ — đã có, verify)
//   5) auto-sync cross-field (2/2000 → 29, 2/2001 → 28)
// Regression: basic bind, dateonly, sizes, required validation, paste, disabled.
// BASE: process.env.PROBE_BASE || 'https://localhost:3000'
import { chromium } from 'playwright';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const results = [];

function log(name, pass, detail = '') {
	results.push({ name, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'} · ${name}${detail ? ` — ${detail}` : ''}`);
}

// Gõ tuần tự vào các ô của field (ô đầu click → auto-advance khi đủ nhóm).
async function typeSegments(page, section, values) {
	const root = page.locator(`[data-test="${section}"] .input-datetime-root`);
	await root.locator('.dt-box').first().click();
	for (const v of values) {
		for (const ch of v) {
			await page.keyboard.type(ch, { delay: 30 });
		}
	}
}

// Click nút clear của section nếu đang hiện (trước khi gõ kịch bản mới).
async function clearIfVisible(page, section) {
	const btn = page.locator(`[data-test="${section}"] .dt-clear`);
	if (await btn.count()) await btn.click();
	await page.waitForTimeout(60);
}

async function readEcho(page, testId) {
	return ((await page.locator(`[data-test="${testId}"]`).textContent()) ?? '').trim();
}

const run = async () => {
	const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
	await page.goto(`${BASE}/ui/datetime`, { waitUntil: 'networkidle' });

	// ═══ 1) FORMAT ĐA NGÔN NGỮ ═══
	// F1: tab dmy active mặc định → ô đầu là NGÀY
	{
		const seg = await page
			.locator('[data-test="dt-format"] .dt-box')
			.first()
			.getAttribute('data-segment');
		log('F1 · dmy: ô đầu là NGÀY (data-segment=d)', seg === 'd', `got=${seg}`);
	}
	// F2: separator dmy = '/' '/' '·' ':'
	{
		const seps = page.locator('[data-test="dt-format"] .dt-separator');
		const texts = [];
		for (let i = 0; i < (await seps.count()); i++)
			texts.push(((await seps.nth(i).textContent()) ?? '').trim());
		log(
			'F2 · dmy: separator / / · :',
			texts[0] === '/' && texts[1] === '/' && texts[2] === '·' && texts[3] === ':',
			`seps=[${texts.join(' ')}]`
		);
	}
	// F3: gõ dmy 15/10/2000 → value ISO 2000-10-15
	{
		await typeSegments(page, 'dt-format', ['15', '10', '2000']);
		const echo = await readEcho(page, 'dt-format-echo');
		log('F3 · dmy gõ 15/10/2000 → ISO 2000-10-15', echo === '2000-10-15', `echo=${echo}`);
	}
	// F4: đổi tab ymd → ô đầu NĂM + separator '-'
	{
		await page.locator('[data-test="dt-format-tab-ymd"]').click();
		await page.waitForTimeout(100);
		const seg = await page
			.locator('[data-test="dt-format"] .dt-box')
			.first()
			.getAttribute('data-segment');
		const sep1 = (
			(await page.locator('[data-test="dt-format"] .dt-separator').first().textContent()) ?? ''
		).trim();
		log('F4 · ymd: ô đầu NĂM + sep "-"', seg === 'y' && sep1 === '-', `seg=${seg} sep=${sep1}`);
	}
	// F5: value ISO GIỮ NGUYÊN khi đổi format
	{
		const echo = await readEcho(page, 'dt-format-echo');
		log('F5 · đổi format giữ value ISO', echo === '2000-10-15', `echo=${echo}`);
	}
	// F6: mdy → ô đầu THÁNG
	{
		await page.locator('[data-test="dt-format-tab-mdy"]').click();
		await page.waitForTimeout(100);
		const seg = await page
			.locator('[data-test="dt-format"] .dt-box')
			.first()
			.getAttribute('data-segment');
		log('F6 · mdy: ô đầu THÁNG', seg === 'm', `seg=${seg}`);
	}
	// F7: ymd gõ 2000 10 15 → ISO đúng (display order map ngược storage)
	{
		await page.locator('[data-test="dt-format-tab-ymd"]').click();
		await page.waitForTimeout(100);
		await clearIfVisible(page, 'dt-format');
		await typeSegments(page, 'dt-format', ['2000', '10', '15']);
		const echo = await readEcho(page, 'dt-format-echo');
		log('F7 · ymd gõ → ISO 2000-10-15', echo === '2000-10-15', `echo=${echo}`);
	}
	// F8: hideTime → 3 ô + không '·'
	{
		await page.locator('[data-test="dt-format-hidetime"]').check();
		await page.waitForTimeout(100);
		const count = await page.locator('[data-test="dt-format"] .dt-box').count();
		const seps = page.locator('[data-test="dt-format"] .dt-separator');
		const sepTexts = [];
		for (let i = 0; i < (await seps.count()); i++)
			sepTexts.push(((await seps.nth(i).textContent()) ?? '').trim());
		log(
			'F8 · hideTime: 3 ô + sep cuối rỗng (không ·)',
			count === 3 && !sepTexts.includes('·'),
			`boxes=${count} seps=[${sepTexts.join(' ')}]`
		);
		await page.locator('[data-test="dt-format-hidetime"]').uncheck();
		await page.waitForTimeout(100);
	}

	// ═══ 2) DATEPICKER BUTTON ═══
	// P1: nút lịch tồn tại + aria pattern (dialog, expanded=false)
	{
		const btn = page.locator('[data-test="dt-picker"] .dt-picker');
		const count = await btn.count();
		const expanded = count ? await btn.getAttribute('aria-expanded') : null;
		const haspopup = count ? await btn.getAttribute('aria-haspopup') : null;
		log(
			'P1 · nút lịch + aria (dialog, expanded=false)',
			count === 1 && haspopup === 'dialog' && expanded === 'false',
			`count=${count} haspopup=${haspopup} expanded=${expanded}`
		);
	}
	// P2: click nút → panel mở + expanded=true
	{
		await page.locator('[data-test="dt-picker"] .dt-picker').click();
		await page.waitForTimeout(200);
		const visible = (await page.locator('[data-test="dt-picker"] .date-picker-panel').count()) === 1;
		const expanded = await page
			.locator('[data-test="dt-picker"] .dt-picker')
			.getAttribute('aria-expanded');
		log(
			'P2 · click nút mở panel (expanded=true)',
			visible && expanded === 'true',
			`visible=${visible} expanded=${expanded}`
		);
	}
	// P3: chọn cell HÔM NAY (data-dp-day, tháng 0-based như dateKey) → panel
	// đóng + value ISO hôm nay + focus trả nút lịch. LƯU Ý: nút footer "Hôm
	// nay" chỉ NAVIGATE (jumpToToday), không select.
	{
		const t = new Date();
		const key = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
		await page.locator(`[data-test="dt-picker"] [data-dp-day="${key}"]`).click();
		await page.waitForTimeout(250);
		const panel = await page.locator('[data-test="dt-picker"] .date-picker-panel').count();
		const today = new Date();
		const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
			today.getDate()
		).padStart(2, '0')}`;
		const echo = await readEcho(page, 'dt-picker-echo');
		const focused = await page.evaluate(
			() => (document.activeElement instanceof HTMLElement ? document.activeElement.dataset.dpTrigger : undefined)
		);
		log(
			'P3 · select hôm nay → đóng + ISO + focus nút',
			panel === 0 && echo === iso && focused === '',
			`panel=${panel} echo=${echo} (kỳ ${iso}) focused=${JSON.stringify(focused)}`
		);
	}
	// P4: hôm nay KHÔNG bị chặn (trong min/max 1900–2030)
	{
		await page.locator('[data-test="dt-picker"] .dt-picker').click();
		await page.waitForTimeout(200);
		const aria = await page.evaluate(() => {
			const el = document.querySelector('[data-test="dt-picker"] .date-picker-day.today');
			return el ? el.getAttribute('aria-disabled') : 'missing';
		});
		await page.locator('[data-test="dt-picker"] .dt-picker').click(); // toggle đóng
		await page.waitForTimeout(150);
		log('P4 · hôm nay trong min/max (không aria-disabled)', aria === null, `aria=${JSON.stringify(aria)}`);
	}
	// P5: single mode — hôm nay highlight selected
	{
		await page.locator('[data-test="dt-picker"] .dt-picker').click();
		await page.waitForTimeout(200);
		const sel = await page.locator('[data-test="dt-picker"] .date-picker-day.selected').count();
		await page.locator('[data-test="dt-picker"] .dt-picker').click();
		await page.waitForTimeout(150);
		log('P5 · single mode: selected = hôm nay', sel === 1, `selected=${sel}`);
	}
	// P6: gõ 2000-10-15 → mở panel thấy "Tháng 10, 2000" + selected 15
	{
		await clearIfVisible(page, 'dt-picker');
		await typeSegments(page, 'dt-picker', ['2000', '10', '15']);
		const echo = await readEcho(page, 'dt-picker-echo');
		await page.locator('[data-test="dt-picker"] .dt-picker').click();
		await page.waitForTimeout(250);
		const monthLabel = (
			(await page.locator('[data-test="dt-picker"] [data-dp-month-label]').textContent()) ?? ''
		).trim();
		const selected = await page.locator('[data-test="dt-picker"] .date-picker-day.selected').count();
		await page.locator('[data-test="dt-picker"] .dt-picker').click();
		await page.waitForTimeout(150);
		log(
			'P6 · gõ → panel mở đúng tháng có selected',
			echo === '2000-10-15' && monthLabel === 'Tháng 10, 2000' && selected === 1,
			`echo=${echo} month=${monthLabel} selected=${selected}`
		);
	}
	// P7: Escape đóng panel + focus trả nút (closeAndFocusTrigger data-dp-trigger)
	{
		await page.locator('[data-test="dt-picker"] .dt-picker').click();
		await page.waitForTimeout(200);
		await page.keyboard.press('Escape');
		await page.waitForTimeout(250);
		const panel = await page.locator('[data-test="dt-picker"] .date-picker-panel').count();
		const focused = await page.evaluate(
			() => (document.activeElement instanceof HTMLElement ? document.activeElement.dataset.dpTrigger : undefined)
		);
		log(
			'P7 · Escape đóng + focus nút lịch',
			panel === 0 && focused === '',
			`panel=${panel} focused=${JSON.stringify(focused)}`
		);
	}

	// ═══ 3) VALIDATE KHI GÕ (SNAP) ═══
	// V1: tháng 13 → '12'
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['05', '13', '1990']);
		const monthVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="m"]')
			.inputValue();
		const echo = await readEcho(page, 'dt-clamp-echo');
		log('V1 · tháng 13 → snap 12', monthVal === '12' && echo === '1990-12-05', `month=${monthVal} echo=${echo}`);
	}
	// V2: tháng 00 → '01'
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['05', '00', '1990']);
		const monthVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="m"]')
			.inputValue();
		log('V2 · tháng 00 → snap 01', monthVal === '01', `month=${monthVal}`);
	}
	// V3: ngày 00 → '01'
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['00', '10', '1990']);
		const dayVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="d"]')
			.inputValue();
		log('V3 · ngày 00 → snap 01', dayVal === '01', `day=${dayVal}`);
	}
	// V4: năm 1899 → 1900 (minYear)
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['05', '10', '1899']);
		const yearVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="y"]')
			.inputValue();
		log('V4 · năm 1899 → snap 1900 (minYear)', yearVal === '1900', `year=${yearVal}`);
	}
	// V5: năm 9999 → 2030 (maxYear)
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['05', '10', '9999']);
		const yearVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="y"]')
			.inputValue();
		log('V5 · năm 9999 → snap 2030 (maxYear)', yearVal === '2030', `year=${yearVal}`);
	}
	// V6: giờ 25 → 23, phút 99 → 59 (dt-basic ymd có giờ)
	{
		await clearIfVisible(page, 'dt-basic');
		await typeSegments(page, 'dt-basic', ['2000', '10', '15', '25', '99']);
		const h = await page.locator('[data-test="dt-basic"] .dt-box[data-segment="H"]').inputValue();
		const m = await page.locator('[data-test="dt-basic"] .dt-box[data-segment="M"]').inputValue();
		log('V6 · giờ 25→23 + phút 99→59', h === '23' && m === '59', `h=${h} m=${m}`);
	}

	// ═══ 4) CLEARABLE ═══
	// C1: clear → mọi ô rỗng + value rỗng
	{
		const visible = (await page.locator('[data-test="dt-basic"] .dt-clear').count()) === 1;
		await page.locator('[data-test="dt-basic"] .dt-clear').click();
		const echo = await readEcho(page, 'dt-value-echo');
		const boxes = page.locator('[data-test="dt-basic"] .dt-box');
		let allEmpty = true;
		for (let i = 0; i < (await boxes.count()); i++) {
			if ((await boxes.nth(i).inputValue()) !== '') allEmpty = false;
		}
		log(
			'C1 · clear → ô rỗng + value rỗng',
			visible && echo === 'chưa có giá trị' && allEmpty,
			`visible=${visible} echo=${echo} allEmpty=${allEmpty}`
		);
	}
	// C2: clear → focus về ô đầu
	{
		const focused = await page.evaluate(() => {
			const el = document.activeElement;
			return el instanceof HTMLInputElement && el.classList.contains('dt-box')
				? el.dataset.segment
				: null;
		});
		log('C2 · clear focus ô đầu (ymd → ô năm)', focused === 'y', `focused=${focused}`);
	}

	// ═══ 5) CROSS-FIELD AUTO-SYNC ═══
	// X1: 31/02/2000 → 29 (năm nhuận)
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['31', '02', '2000']);
		const dayVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="d"]')
			.inputValue();
		const echo = await readEcho(page, 'dt-clamp-echo');
		log('X1 · 31/02/2000 → 29 (nhuận)', dayVal === '29' && echo === '2000-02-29', `day=${dayVal} echo=${echo}`);
	}
	// X2: 31/02/2001 → 28 (không nhuận)
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['31', '02', '2001']);
		const dayVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="d"]')
			.inputValue();
		const echo = await readEcho(page, 'dt-clamp-echo');
		log('X2 · 31/02/2001 → 28', dayVal === '28' && echo === '2001-02-28', `day=${dayVal} echo=${echo}`);
	}
	// X3: 31/01/1990 → đổi tháng 04 → ngày snap 30
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['31', '01', '1990']);
		const monthBox = page.locator('[data-test="dt-clamp"] .dt-box[data-segment="m"]');
		await monthBox.click();
		await page.keyboard.press('Backspace'); // xóa trọn ô tháng
		await page.keyboard.type('04', { delay: 40 });
		await page.waitForTimeout(100);
		const dayVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="d"]')
			.inputValue();
		const echo = await readEcho(page, 'dt-clamp-echo');
		log('X3 · đổi tháng 01→04: ngày 31 → 30', dayVal === '30' && echo === '1990-04-30', `day=${dayVal} echo=${echo}`);
	}
	// X4: 29/02/2000 → đổi năm 2001 → 28
	{
		await clearIfVisible(page, 'dt-clamp');
		await typeSegments(page, 'dt-clamp', ['29', '02', '2000']);
		const yearBox = page.locator('[data-test="dt-clamp"] .dt-box[data-segment="y"]');
		await yearBox.click();
		await page.keyboard.type('2001', { delay: 40 }); // overwrite interceptor
		await page.waitForTimeout(100);
		const dayVal = await page
			.locator('[data-test="dt-clamp"] .dt-box[data-segment="d"]')
			.inputValue();
		const echo = await readEcho(page, 'dt-clamp-echo');
		log('X4 · 29/02/2000 → năm 2001: 28', dayVal === '28' && echo === '2001-02-28', `dayVal=${dayVal} echo=${echo}`);
	}

	// ═══ REGRESSION ═══
	// R1: dateonly 3 ô
	{
		const count = await page.locator('[data-test="dt-dateonly"] .dt-box').count();
		log('R1 · dateonly 3 ô (hideTime)', count === 3, `count=${count}`);
	}
	// R2: sizes md > sm
	{
		const mdH = await page
			.locator('[data-test="dt-sizes"] .input-datetime-root.size-md .dt-box')
			.first()
			.evaluate((el) => el.getBoundingClientRect().height);
		const smH = await page
			.locator('[data-test="dt-sizes"] .input-datetime-root.size-sm .dt-box')
			.first()
			.evaluate((el) => el.getBoundingClientRect().height);
		log('R2 · sizes: md box cao hơn sm', mdH > smH, `md=${mdH} sm=${smH}`);
	}
	// R3: paste chuỗi liên tục tán ô (ymd mặc định)
	{
		const first = page.locator('[data-test="dt-paste"] .dt-box').first();
		await first.click();
		await first.evaluate((el) => {
			const dt = new DataTransfer();
			dt.setData('text', '200001150830');
			el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
		});
		await page.waitForTimeout(100);
		const echo = ((await page.locator('[data-test="dt-paste"] code').last().textContent()) ?? '').trim();
		log('R3 · paste 200001150830 → tán ô', echo === '2000-01-15T08:30', `echo=${echo}`);
	}
	// R4: disabled — mọi ô native disabled
	{
		const disabledCount = await page
			.locator('[data-test="dt-disabled"] .dt-box[disabled]')
			.count();
		const total = await page.locator('[data-test="dt-disabled"] .dt-box').count();
		log(
			'R4 · disabled: mọi ô disabled',
			disabledCount === total && total > 0,
			`${disabledCount}/${total}`
		);
	}
	// R5: required — gõ thiếu (chỉ năm+tháng) → aria-invalid sau debounce
	{
		const clearBtn = page.locator('[data-test="dt-required"] .dt-clear');
		if (await clearBtn.count()) await clearBtn.click();
		await typeSegments(page, 'dt-required', ['2000', '10']);
		await page.waitForTimeout(700);
		const invalid = await page
			.locator('[data-test="dt-required"] .dt-box[aria-invalid="true"]')
			.count();
		log('R5 · required thiếu ngày → aria-invalid sau debounce', invalid > 0, `invalid=${invalid}`);
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
