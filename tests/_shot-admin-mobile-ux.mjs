// tests/_shot-admin-mobile-ux.mjs
// Chụp 5 ảnh B5 (Pha 3): admin mobile UX.
//   1. admin-orders-mobile-top.png      — orders 375px đầu trang (header + filters + bảng)
//   2. admin-orders-mobile-scrolled.png — orders 375px cuộn (sticky header + thead + pagination)
//   3. admin-users-mobile-cards.png     — users 375px card view
//   4. admin-users-mobile-edit-modal.png— users 375px modal edit sau tap card + nút Xoá
//   5. admin-orders-desktop-sticky.png  — orders 1280px (stickyHead media ≤1024 → thead sticky)
import { chromium, devices } from 'playwright';

const BASE = 'https://localhost:3000';
const OUT = 'tests/screenshots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
	await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForSelector('.auth-input-wrapper input', { timeout: 20000 });
	await sleep(500);
	await page.locator('.auth-input-wrapper input').first().fill('admin');
	await sleep(400);
	await page.locator('.auth-input-wrapper input').nth(1).fill('123123_Qwe');
	await sleep(600);
	await page.locator('.auth-btn-submit').first().click();
	await page.waitForURL((u) => !u.toString().includes('/login'), {
		waitUntil: 'domcontentloaded',
		timeout: 20000
	});
	await sleep(1500);
}

/** Chờ .admin-inset-body xuất hiện + kích thước ổn định 2 lần liên tiếp. */
async function settle(page) {
	await page.waitForSelector('.admin-inset-body', { timeout: 20000 });
	let prev = '';
	for (let i = 0; i < 20; i++) {
		await sleep(400);
		const sig = await page.evaluate(
			() => document.querySelector('.admin-inset-body')?.getBoundingClientRect().height ?? 0
		);
		if (sig > 0 && sig === prev) break;
		prev = sig;
	}
}

const scrollAdminTo = async (page, top) => {
	await page.evaluate((t) => {
		let el = document.querySelector('.admin-inset-body');
		while (el && el.parentElement) {
			el = el.parentElement;
			if (getComputedStyle(el).overflowY === 'auto') {
				el.scrollTop = t;
				return;
			}
		}
		window.scrollTo(0, t);
	}, top);
	await sleep(600);
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

// ── MOBILE ──
{
	const context = await browser.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
	const page = await context.newPage();
	await login(page);

	// 1+2: orders
	await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await settle(page);
	// /api/admin/orders/stats chậm (~6-9s) — poll stat-value không còn placeholder
	// "—" trước khi chụp (max ~15s, quá hạn vẫn chụp).
	for (let i = 0; i < 30; i++) {
		const statsReady = await page.evaluate(() => {
			const vals = [...document.querySelectorAll('.stat-value')];
			return vals.length > 0 && vals.every((v) => v.textContent?.trim() !== '—');
		});
		if (statsReady) break;
		await sleep(500);
	}
	await sleep(800);
	await page.screenshot({ path: `${OUT}/admin-b5/admin-orders-mobile-top.png` });

	await scrollAdminTo(page, 500);
	await sleep(800);
	await page.screenshot({ path: `${OUT}/admin-b5/admin-orders-mobile-scrolled.png` });

	// 3+4: users cards + modal
	await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await settle(page);
	// chờ cards render thật (không is-loading, có card data) — settle chỉ đo height
	for (let i = 0; i < 30; i++) {
		const ready = await page.evaluate(() => {
			const root = document.querySelector('.datatable-root');
			return (
				!!root &&
				!root.classList.contains('is-loading') &&
				document.querySelectorAll('.datatable-card[data-row-id]').length > 0
			);
		});
		if (ready) break;
		await sleep(500);
	}
	await sleep(800);
	await page.screenshot({ path: `${OUT}/admin-b5/admin-users-mobile-cards.png` });

	// tap card đầu → modal edit
	const tapped = await page.evaluate(() => {
		const card = document.querySelector('.datatable-card[data-row-id]');
		if (card) {
			card.click();
			return true;
		}
		return false;
	});
	if (tapped) {
		// poll modal hiện + nút Delete footer paint xong (animation timing —
		// chụp sớm sẽ mất footer như lần đầu)
		for (let i = 0; i < 20; i++) {
			await sleep(500);
			const open = await page.evaluate(() =>
				[...document.querySelectorAll('.modal-root')].some((d) => d.getBoundingClientRect().width > 0)
			);
			if (open) break;
		}
		for (let i = 0; i < 20; i++) {
			const delVisible = await page.evaluate(() => {
				const del = document.querySelector('[data-test="user-modal-delete"]');
				if (!del) return false;
				const r = del.getBoundingClientRect();
				return r.width > 0 && r.height > 0;
			});
			if (delVisible) break;
			await sleep(500);
		}
		// UserFormModal đặt .modal-actions BÊN TRONG Body cuộn được (không phải
		// Footer sticky như các page khác) — rect non-zero vẫn có thể bị clip
		// dưới fold khi scrollHeight > clientHeight → scroll xuống đáy trước chụp.
		await page.evaluate(() => {
			const body = document.querySelector('.user-form-modal-body');
			if (body) body.scrollTop = body.scrollHeight;
		});
		await sleep(1000);
		await page.screenshot({ path: `${OUT}/admin-b5/admin-users-mobile-edit-modal.png` });
	}

	await context.close();
}

// ── DESKTOP ──
{
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1280, height: 900 }
	});
	const page = await context.newPage();
	await login(page);
	await page.goto(`${BASE}/admin/orders`, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await settle(page);
	await sleep(800);
	await page.screenshot({ path: `${OUT}/admin-b5/admin-orders-desktop-sticky.png` });
	await context.close();
}

await browser.close();
console.log('DONE 5 shots → tests/screenshots/admin-b5/');
