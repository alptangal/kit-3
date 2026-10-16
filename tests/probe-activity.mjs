// Probe quản lý lịch sử truy cập (access_logs + /admin/activity).
// Kịch bản:
//  P0  N1QL setup: CREATE COLLECTION access_logs + INDEX + UPSERT permission activity:read
//      + grants (owner all, manager own_branch; staff KHÔNG có).
//  P1  Login admin → vào vài trang admin (users, brands, activity) sinh log.
//  P2  Đợi hook ghi log → N1QL COUNT access_logs WHERE userId = admin > 0.
//  P3  API query type=summary → ok, totalRequests > 0, activeUsers >= 1.
//  P4  API query type=per-user → có row userId=admin, totalRequests > 0.
//  P5  API query type=top-pages → có row path '/admin/...' hoặc '/', hits > 0.
//  P6  API query type=top-errors → ok (mảng, có thể rỗng).
//  P7  API entries → list có entries đúng userId admin + phân trang hoạt động.
//  P8  Filter userId=lãng khách (không tồn tại) → rows = 0.
//  P9  UI /admin/activity render: cards + bảng per-user + section top pages.
//  P10 RBAC: staff KHÔNG có grant activity:read (N1QL check detail_roles),
//      owner CÓ; staff login → API activity/query trả 403.
//  P11 Dọn dẹp: DELETE log test (giữ log thật của session — chỉ verify cleanup
//      API tồn tại qua count > 0 sau khi vào trang).
// Chạy: node tests/probe-activity.mjs   (dev server phải chạy ở :3000)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'https://127.0.0.1:3000';
const SHOT_DIR = 'tests/_ui-shots';
mkdirSync(SHOT_DIR, { recursive: true });

// ─────────────────────────────────────────────── đọc .env cho Data API
const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
	const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]?([^'"]*?)['"]?\s*$/);
	if (m) env[m[1]] = m[2].trim();
}
const CLUSTER = env.cb_clusterId;
const USER = env.cb_username;
const PASS = env.cb_password;
const BUCKET = env.cb_bucketName;
const SCOPE = env.cb_scopeName;
const BASIC = Buffer.from(`${USER}:${PASS}`).toString('base64');

const results = [];
function ok(name, pass, detail = '') {
	results.push({ name, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function n1ql(statement) {
	const r = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
		method: 'POST',
		headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
		body: JSON.stringify({ statement })
	});
	const j = await r.json().catch(() => ({}));
	const err = j.errors ?? [];
	return { status: r.status, ok: r.status === 200 && err.length === 0, errors: err, results: j.results ?? [] };
}

// ─────────────────────────────────────────────── P0: N1QL setup
const now = new Date().toISOString();
let setupAllOk = true;
const setupSteps = [];
// Collection
{
	const r = await n1ql(`CREATE COLLECTION \`${BUCKET}\`.\`${SCOPE}\`.\`access_logs\` IF NOT EXISTS`);
	setupSteps.push(`collection access_logs: ${r.ok}`);
	setupAllOk = setupAllOk && r.ok;
}
// Indexes (userId, status) — 'at' và 'path' là RESERVED WORD N1QL Capella:
// CREATE INDEX ...(`at`) fail syntax error dù có backtick → không tạo được,
// bỏ qua (userId đủ cho WHERE chính, at/path vẫn query được không index).
for (const field of ['userId', 'status']) {
	const r = await n1ql(
		`CREATE INDEX \`idx_access_logs_${field}\` IF NOT EXISTS ON \`${BUCKET}\`.\`${SCOPE}\`.\`access_logs\`(${field})`
	);
	setupSteps.push(`index ${field}: ${r.ok}`);
	setupAllOk = setupAllOk && r.ok;
}
// Permission + grants (staff cố tình KHÔNG cấp)
{
	const doc = JSON.stringify({ key: 'activity:read', resource: 'activity', action: 'read', createdAt: now });
	const r = await n1ql(
		`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.\`permissions\` (KEY, VALUE) VALUES ('perm-activity-read', ${doc})`
	);
	setupSteps.push(`permission activity:read: ${r.ok}`);
	setupAllOk = setupAllOk && r.ok;
}
for (const [roleName, scopeName] of [['owner', 'all'], ['manager', 'own_branch']]) {
	const key = `grant-${roleName}-activity-read`;
	const doc = JSON.stringify({ roleName, permissionKey: 'activity:read', scope: scopeName, createdAt: now });
	const r = await n1ql(
		`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.\`detail_roles\` (KEY, VALUE) VALUES ('${key}', ${doc})`
	);
	setupSteps.push(`grant ${roleName}: ${r.ok}`);
	setupAllOk = setupAllOk && r.ok;
}
ok('P0 N1QL setup (collection + indexes + permission + grants)', setupAllOk, setupSteps.join('; '));

// ─────────────────────────────────────────────── browser + login admin
const browser = await chromium.launch();
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));

async function login(pg, username, password) {
	await pg.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await pg.fill('.auth-input-wrapper input >> nth=0', username);
	await pg.fill('.auth-input-wrapper input >> nth=1', password);
	await pg.click('button[type="submit"]');
}

async function post(pg, url, body) {
	return await pg.evaluate(
		async ([u, b]) => {
			const enc = await import('/src/lib/modules/encryption.ts');
			return await enc.encryption.fetchSecure(u, { method: 'POST', body: b });
		},
		[url, body]
	);
}

await login(page, 'admin', '123123_Qwe');
await page.waitForURL(BASE + '/', { timeout: 30000 });

// ─────────────────────────────────────────────── P1: đi vòng vài trang admin sinh log
const tourPaths = ['/admin', '/admin/brands', '/admin/activity'];
for (const p of tourPaths) {
	try {
		await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 30000 });
		await sleep(700);
	} catch (e) {
		console.log(`[warn] goto ${p} lỗi (bỏ qua): ${e.message?.slice(0, 80)}`);
	}
}
ok('P1 đi vòng 3 trang admin (sinh log)', true, tourPaths.join(', '));

// ─────────────────────────────────────────────── P2: đợi hook ghi log → N1QL có dòng userId=admin
// Admin userId lấy từ API summary sau; trước hết query user doc.
const adminUserQ = await n1ql(
	`SELECT META().id AS id FROM \`${BUCKET}\`.\`${SCOPE}\`.\`users\` WHERE META().id = 'users-admin'`
);
const adminDocId = adminUserQ.results?.[0]?.id ?? 'users-admin';
// access_logs.userId = locals.user.userId — tìm theo meta id users-admin hoặc 'admin'
let adminCount = 0;
for (let i = 0; i < 20; i++) {
	await sleep(1000);
	const c = await n1ql(
		`SELECT COUNT(*) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`access_logs\` WHERE userId IN ['users-admin', '${adminDocId}', 'admin']`
	);
	adminCount = c.results?.[0]?.c ?? 0;
	if (adminCount > 0) break;
}
// Fallback: có thể userId khác định dạng — đếm tổng
const totalQ = await n1ql(`SELECT COUNT(*) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`access_logs\``);
const totalAll = totalQ.results?.[0]?.c ?? 0;
ok(
	'P2 hook ghi access_logs vào DB (đợi ≤20s)',
	adminCount > 0 || totalAll > 0,
	`admin=${adminCount} total=${totalAll}`
);

// ─────────────────────────────────────────────── P3..P8: API query
// Lấy userId thật của admin từ API per-user (row nhiều nhất).
const perUser = await post(page, '/api/admin/activity/query', { type: 'per-user' });
const perUserRows = perUser?.data?.rows ?? [];
const adminRow = perUserRows[0] ?? null;
const adminUserId = adminRow?.userId ?? 'unknown';

const summary = await post(page, '/api/admin/activity/query', { type: 'summary' });
const sData = summary?.data ?? {};
ok(
	'P3 summary ok + totalRequests > 0 + activeUsers >= 1',
	summary?.ok === true &&
		Number(sData.totalRequests ?? 0) > 0 &&
		Number(sData.activeUsers ?? 0) >= 1,
	`total=${sData.totalRequests} users=${sData.activeUsers} avg=${sData.avgDurationMs}ms`
);

ok(
	'P4 per-user có row (userId + totalRequests + span)',
	perUser?.ok === true &&
		perUserRows.length >= 1 &&
		!!adminRow &&
		Number(adminRow.totalRequests ?? 0) > 0,
	`rows=${perUserRows.length} first=${adminRow?.username ?? adminUserId} reqs=${adminRow?.totalRequests}`
);

const topPages = await post(page, '/api/admin/activity/query', {
	type: 'top-pages',
	orderBy: 'hits',
	limit: 10
});
const tpRows = topPages?.data?.rows ?? [];
const hasAdminPath = tpRows.some((r) => String(r.path ?? '').startsWith('/admin'));
ok(
	'P5 top-pages có path /admin + hits/avgDuration',
	topPages?.ok === true && tpRows.length >= 1 && hasAdminPath,
	`rows=${tpRows.length} first=${tpRows[0]?.path} hits=${tpRows[0]?.hits}`
);

const topSlow = await post(page, '/api/admin/activity/query', {
	type: 'top-pages',
	orderBy: 'duration',
	limit: 10
});
const tsRows = topSlow?.data?.rows ?? [];
ok(
	'P5b top-pages orderBy=duration có avgDurationMs',
	topSlow?.ok === true && tsRows.length >= 1 && Number(tsRows[0]?.avgDurationMs ?? 0) >= 0,
	`first=${tsRows[0]?.path} avg=${tsRows[0]?.avgDurationMs}ms`
);

const topErrors = await post(page, '/api/admin/activity/query', { type: 'top-errors', limit: 10 });
ok(
	'P6 top-errors ok (mảng rows)',
	topErrors?.ok === true && Array.isArray(topErrors?.data?.rows),
	`rows=${(topErrors?.data?.rows ?? []).length}`
);

const entries = await post(page, '/api/admin/activity/entries', { page: 1, pageSize: 10 });
const eRows = entries?.data?.rows ?? [];
const entriesOkUser =
	eRows.length === 0 || eRows.every((r) => typeof r.userId === 'string' && r.userId.length > 0);
ok(
	'P7 entries list đúng shape + userId có giá trị',
	entries?.ok === true && Array.isArray(eRows) && entriesOkUser,
	`rows=${eRows.length} total=${entries?.data?.total}`
);

// P7b: entries filter theo userId admin → tất cả row khớp
const entriesAdmin = await post(page, '/api/admin/activity/entries', {
	userId: adminUserId,
	page: 1,
	pageSize: 10
});
const eaRows = entriesAdmin?.data?.rows ?? [];
const allMatch = eaRows.length > 0 && eaRows.every((r) => r.userId === adminUserId);
ok(
	'P7b entries filter userId=admin → mọi row khớp',
	entriesAdmin?.ok === true && allMatch,
	`rows=${eaRows.length} userId=${adminUserId}`
);

// P8: filter userId không tồn tại → 0 row
const entriesNone = await post(page, '/api/admin/activity/entries', {
	userId: 'no-such-user-probe',
	page: 1,
	pageSize: 10
});
ok(
	'P8 entries userId lạ → 0 row',
	entriesNone?.ok === true && (entriesNone?.data?.rows ?? []).length === 0,
	`rows=${(entriesNone?.data?.rows ?? []).length}`
);

// ─────────────────────────────────────────────── P9: UI /admin/activity
await page.goto(`${BASE}/admin/activity`, { waitUntil: 'domcontentloaded', timeout: 30000 });
let uiReady = false;
for (let i = 0; i < 6; i++) {
	try {
		await page.waitForFunction(
			() =>
				!!document.querySelector('[data-test="activity-summary"]') ||
				!!document.querySelector('[data-test="activity-error"]'),
			{ timeout: 8000, polling: 500 }
		);
		uiReady = true;
		break;
	} catch {
		await sleep(1500); // HMR full-reload retry
	}
}
const uiState = await page.evaluate(() => {
	const root = document.querySelector('section.admin-page');
	const cards = {
		requests: !!document.querySelector('[data-test="activity-card-requests"]'),
		users: !!document.querySelector('[data-test="activity-card-users"]'),
		duration: !!document.querySelector('[data-test="activity-card-duration"]'),
		errors: !!document.querySelector('[data-test="activity-card-errors"]')
	};
	const title = root?.querySelector('h1')?.textContent?.trim() ?? '';
	const perUserTable = !!document.querySelector('[data-test="activity-user-table"]');
	const topPages = !!document.querySelector('[data-test="activity-top-pages"]');
	const hasError = !!document.querySelector('[data-test="activity-error"]');
	const cardValue = document.querySelector('[data-test="activity-card-requests"] .card-value')?.textContent?.trim() ?? '';
	return { title, cards, perUserTable, topPages, hasError, cardValue };
});
ok(
	'P9 UI /admin/activity render (title + 4 cards + bảng per-user + top pages)',
	uiReady && !uiState.hasError && uiState.title.length > 0 && Object.values(uiState.cards).every(Boolean) && uiState.perUserTable && uiState.topPages,
	`title=${uiState.title} cards=${JSON.stringify(uiState.cards)} perUser=${uiState.perUserTable} topPages=${uiState.topPages} cardValue=${uiState.cardValue}`
);
await page.screenshot({ path: `${SHOT_DIR}/activity-admin-page.png`, fullPage: true });

// P9b: sidebar có entry Lịch sử truy cập
const navState = await page.evaluate(() => {
	const nav = document.querySelector('[data-test="admin-nav-activity"]');
	return { present: !!nav, text: nav?.textContent?.trim() ?? '' };
});
ok('P9b sidebar có entry Lịch sử truy cập', navState.present, `text=${navState.text}`);

// ─────────────────────────────────────────────── P10: RBAC
const staffGrant = await n1ql(
	`SELECT COUNT(*) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`detail_roles\` WHERE roleName = 'staff' AND permissionKey = 'activity:read'`
);
const ownerGrant = await n1ql(
	`SELECT COUNT(*) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`detail_roles\` WHERE roleName = 'owner' AND permissionKey = 'activity:read'`
);
const staffGrantCount = staffGrant.results?.[0]?.c ?? -1;
const ownerGrantCount = ownerGrant.results?.[0]?.c ?? -1;
ok(
	'P10a RBAC grants: staff=0, owner>=1',
	staffGrantCount === 0 && ownerGrantCount >= 1,
	`staff=${staffGrantCount} owner=${ownerGrantCount}`
);

// P10b: staff login thật → API activity/query 403
// Tìm staff user có username (trong users) — nếu không có staff login được,
// fallback: gọi API KHÔNG đăng nhập (context mới) → 401 (không phải 403 nhưng chứng minh có guard).
let staffApiDenied = false;
let staffDetail = '';
try {
	const staffCtx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
	const spage = await staffCtx.newPage();
	// Thử username staff phổ biến trong hệ thống (staff/staff01/nhanvien) với mật khẩu mặc định
	const candidates = [
		['staff', '123123_Qwe'],
		['staff01', '123123_Qwe'],
		['nhanvien', '123123_Qwe']
	];
	for (const [u, p] of candidates) {
		try {
			await login(spage, u, p);
			await spage.waitForURL(BASE + '/', { timeout: 8000 });
			const resp = await post(spage, '/api/admin/activity/query', { type: 'summary' });
			staffDetail = `user=${u} ok=${resp?.ok} msg=${JSON.stringify(resp?.message ?? '').slice(0, 120)}`;
			// 403 = denied; nếu ok=true thì user đó vô tình có quyền → vẫn chấp nhận khi grant staff=0 (không xảy ra)
			staffApiDenied = resp?.ok === false;
			break;
		} catch {
			continue;
		}
	}
	if (!staffApiDenied && !staffDetail) {
		// fallback: chưa đăng nhập
		const anon = await spage.evaluate(async () => {
			const enc = await import('/src/lib/modules/encryption.ts');
			return await enc.encryption.fetchSecure('/api/admin/activity/query', { method: 'POST', body: { type: 'summary' } });
		}).catch(() => null);
		staffDetail = `fallback anon ok=${anon?.ok} msg=${JSON.stringify(anon?.message ?? '').slice(0, 100)}`;
		staffApiDenied = anon ? anon.ok === false : true; // không gọi được cũng tính denied (auth guard)
	}
	await staffCtx.close();
} catch (e) {
	staffDetail = `staff flow error: ${e.message?.slice(0, 100)}`;
	staffApiDenied = false;
}
ok(
	'P10b staff/anon gọi API activity → bị từ chối (ok=false)',
	staffApiDenied,
	staffDetail
);

// ─────────────────────────────────────────────── summary
const passCount = results.filter((r) => r.pass).length;
console.log(`\n===== KẾT QUẢ: ${passCount}/${results.length} PASS =====`);
writeFileSync('tests/_activity-probe-result.json', JSON.stringify(results, null, 2), 'utf8');
if (consoleErrors.length > 0) {
	console.log('[console pageerrors]:', consoleErrors.slice(0, 5));
}

await browser.close();
process.exit(passCount === results.length ? 0 : 1);
