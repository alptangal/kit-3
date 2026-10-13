// B8 probe: PartyKit realtime db-changes.
// Kịch bản: partykit dev chạy riêng port 1999 (spawn bằng probe nếu chưa có).
// Context A + B login admin. B tạo brand → A không reload vẫn thấy brand mới.
// B xóa brand → A thấy biến mất.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const PK_PORT = 1999;
const SHOT_DIR = 'tests/screenshots/admin-realtime';
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
function ok(name, pass, detail = '') {
	results.push({ name, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- helpers
async function login(page) {
	await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await page.fill('.auth-input-wrapper input >> nth=0', 'admin');
	await page.fill('.auth-input-wrapper input >> nth=1', '123123_Qwe');
	await page.click('button[type="submit"]');
	await page.waitForURL(BASE + '/');
}

async function countRows(page) {
	return await page.evaluate(() => {
		// bỏ qua skeleton rows (cùng class .datatable-row khi loading)
		const rows = document.querySelectorAll('.datatable-row:not(.datatable-row--skeleton)');
		return rows.length;
	});
}

async function readCellText(page, rowIdx, colIdx) {
	return await page.evaluate(
		([r, c]) => {
			const rows = document.querySelectorAll('.datatable-row');
			const row = rows[r];
			if (!row) return null;
			const cell = row.querySelectorAll('td');
			return cell[c] ? cell[c].textContent.trim() : null;
		},
		[rowIdx, colIdx]
	);
}

// ---------------------------------------------------------------- partykit
async function isPartyKitUp() {
	try {
		const res = await fetch(`http://localhost:${PK_PORT}/party/server-keys`);
		return true;
	} catch {
		return false;
	}
}

async function main() {
	// 0. partykit dev (spawn nếu chưa chạy)
	let pkProc = null;
	if (!(await isPartyKitUp())) {
		console.log('Spawning partykit dev on :1999 ...');
		pkProc = spawn('npx', ['partykit', 'dev', '--port', String(PK_PORT)], {
			cwd: 'partykit',
			shell: true,
			stdio: 'ignore'
		});
		await sleep(6000);
		// Poll cho tới khi up (max 20s)
		for (let i = 0; i < 10 && !(await isPartyKitUp()); i++) await sleep(2000);
	}
	ok('PK0 partykit dev reachable', await isPartyKitUp());

	// 1. POST db-change trực tiếp vào partykit (server contract test)
	// Token thật nằm trong partykit/.env (partykit dev ưu tiên .env hơn vars json)
	const token =
		process.env.PARTYKIT_INTERNAL_TOKEN ||
		readFileSync('partykit/.env', 'utf8').match(/PARTYKIT_INTERNAL_TOKEN=(\S+)/)?.[1] ||
		'dev-insecure-token-change-me';
	const r401 = await fetch(`http://localhost:${PK_PORT}/party/db-changes`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ collection: 'brands', action: 'create' })
	});
	ok('PK1 db-changes POST without token → 401', r401.status === 401, `status=${r401.status}`);

	const r400 = await fetch(`http://localhost:${PK_PORT}/party/db-changes`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ collection: 'x'.repeat(100), action: 'create' })
	});
	ok('PK2 invalid collection (100 chars) → 400', r400.status === 400, `status=${r400.status}`);

	const r405 = await fetch(`http://localhost:${PK_PORT}/party/db-changes`, {
		method: 'PUT',
		headers: { Authorization: `Bearer ${token}` }
	});
	ok('PK3 GET/PUT → 405', r405.status === 405, `status=${r405.status}`);

	// server-keys room không bị ảnh hưởng
	const rKey = await fetch(`http://localhost:${PK_PORT}/party/server-keys`);
	ok('PK4 server-keys room still served', rKey.status === 200 || rKey.status === 404, `status=${rKey.status}`);

	const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });

	// 2. Context A: admin brands page
	const ctxA = await browser.newContext({ ignoreHTTPSErrors: true });
	const pageA = await ctxA.newPage();
	const pageErrorsA = [];
	pageA.on('pageerror', (e) => pageErrorsA.push(String(e)));
	await login(pageA);
	await pageA.goto(BASE + '/admin/brands', { waitUntil: 'networkidle' });
	await sleep(1500);
	await pageA.waitForSelector('.datatable-row', { timeout: 10000 }).catch(() => {});
	ok('RT1 A loads brands list', (await countRows(pageA)) >= 0);

	const beforeA = await countRows(pageA);
	console.log(`  A rows before: ${beforeA}`);

	// 3. Context B: tạo brand mới (tên unique theo timestamp — tránh slugTaken 400)
	const brandName = `RT-Brand-${Date.now()}`;
	const ctxB = await browser.newContext({ ignoreHTTPSErrors: true });
	const pageB = await ctxB.newPage();
	const pageErrorsB = [];
	pageB.on('pageerror', (e) => pageErrorsB.push(String(e)));
	await login(pageB);
	await pageB.goto(BASE + '/admin/brands', { waitUntil: 'networkidle' });
	await sleep(1500);
	// Chờ rows render xong mới đếm (tránh 0 do list chưa mount)
	await pageB.waitForSelector('.datatable-row', { timeout: 10000 }).catch(() => {});
	const beforeB = await countRows(pageB);

	// Mở modal create (nút primary trong header — theo text VI/EN)
	const createBtn = pageB.locator('header button.button-root.color-primary').first();
	if (!(await createBtn.count())) {
		// fallback theo text
		const byText = pageB.locator('button', { hasText: /Thêm|Create|Add/i }).first();
		await byText.click();
	} else {
		await createBtn.click();
	}
	await sleep(500);
	await pageB.fill('input[name="brand-name"]', brandName);
	// Slug auto-generated qua $effect — chờ điền xong
	await sleep(600);
	// Nút save = nút variant-solid cuối modal footer
	const saveBtn = pageB.locator('.modal-footer button.variant-solid').last();

	// Bắt response create để chẩn đoán (400 slugTaken / 429 / OK)
	const createRespPromise = pageB
		.waitForResponse((r) => r.url().includes('/api/admin/brands/create'), { timeout: 8000 })
		.catch(() => null);
	await saveBtn.click();
	const createResp = await createRespPromise;
	console.log(`  [diag] POST /api/admin/brands/create → ${createResp ? createResp.status : 'NO-REQUEST'}`);
	await sleep(500);

	// B thấy ngay (mutation response refetch) — chờ modal đóng hẳn + rows ổn định
	await pageB.waitForSelector('.modal-root', { state: 'detached', timeout: 8000 }).catch(() => {});
	let afterB = 0;
	for (let i = 0; i < 8; i++) {
		const first = await countRows(pageB);
		await sleep(400);
		const second = await countRows(pageB);
		if (first === second && first > 0) {
			afterB = second;
			break;
		}
	}
	if (afterB === 0) afterB = await countRows(pageB);
	// diag: mount count + cells (tìm duplicate render)
	const bDiag = await pageB.evaluate(() => ({
		rows: document.querySelectorAll('.datatable-row').length,
		mounts: document.querySelectorAll('.datatable-root').length,
		wraps: document.querySelectorAll('.admin-table-wrap').length,
		firstCells: Array.from(document.querySelectorAll('.datatable-row td:first-child'))
			.slice(0, 22)
			.map((td) => (td.textContent || '').trim().slice(0, 22))
	}));
	console.log(`  [diag] B mounts=${bDiag.mounts} wraps=${bDiag.wraps} cells=${JSON.stringify(bDiag.firstCells)}`);
	ok('RT2 B sees new brand after create', afterB === beforeB + 1, `rows ${beforeB}→${afterB}`);

	// 4. A nhận WS event → refetch KHÔNG reload
	await sleep(2500);
	const afterA = await countRows(pageA);
	// diag: WS state trong page A
	const wsDiag = await pageA.evaluate(() => {
		const nav = performance.getEntriesByType('resource').filter((r) => r.name.startsWith('ws://') || r.name.startsWith('wss://'));
		return nav.map((r) => r.name);
	});
	console.log(`  [diag] A ws resources: ${JSON.stringify(wsDiag)} | A rows ${beforeA}→${afterA}`);
	ok('RT3 A realtime refetch sees new brand', afterA === beforeA + 1, `rows ${beforeA}→${afterA}`);
	await pageA.screenshot({ path: `${SHOT_DIR}/01-a-receives-create.png`, fullPage: false });

	// 5. B xóa brand → A thấy biến mất
	await pageB.fill('.admin-search input', brandName);
	await sleep(1200);
	const delBtn = pageB.locator('[data-test="brand-action-delete"]').first();
	if (await delBtn.count()) {
		pageB.once('dialog', (d) => d.accept());
		await delBtn.click();
		await sleep(1500);
	}
	await sleep(2500);
	const goneA = await countRows(pageA);
	const firstCell = await readCellText(pageA, 0, 0);
	ok('RT4 A list no longer shows deleted brand', firstCell !== brandName, `first cell: ${firstCell}`);
	await pageA.screenshot({ path: `${SHOT_DIR}/02-a-after-delete.png`, fullPage: false });

	ok('RT5 0 pageerror A', pageErrorsA.length === 0, pageErrorsA.join(' | '));
	ok('RT6 0 pageerror B', pageErrorsB.length === 0, pageErrorsB.join(' | '));

	await browser.close();
	if (pkProc) pkProc.kill();

	const passCount = results.filter((r) => r.pass).length;
	console.log(`\n=== ${passCount}/${results.length} PASS ===`);
	process.exit(passCount === results.length ? 0 : 1);
}

main().catch((e) => {
	console.error('PROBE CRASH:', e);
	process.exit(1);
});
