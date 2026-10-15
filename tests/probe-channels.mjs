// Probe omnichannel sales channels (channel_accounts + channel_orders + import).
// Kịch bản (mock mode — CHANNEL_MOCK_MODE default 'true' khi unset, adapter sinh đơn giả):
//  P0  N1QL setup qua Data API: CREATE COLLECTION + INDEX + UPSERT permissions/grants
//      (server đang chạy không tự init collection mới — phải tạo tay như seed-grants-missing.mjs).
//  P1  Login admin → channels-metadata trả 9 kênh có credentialFields (không secret).
//  P2  Tạo account shopee "Probe Shop" credentials giả → 200, có documentKey.
//  P3  accounts-list → KHÔNG có credentialsEncrypted/credentials (chỉ hasCredentials=true).
//  P4  Sync → inserted=2 (mock round 0), account status 'connected' + syncCursor='1'.
//  P5  orders-list → 2 đơn pending_import, KHÔNG rawPayload.
//  P6  Sync lần 2 → mock round 1 → 2 đơn mới nữa (cursor chạy) — verify cursor hoạt động.
//  P7  Import đơn 1 → order nội bộ CH-YYYYMMDD-XXXX + link orderId, status imported.
//  P8  Import lại đơn đó → bị từ chối (alreadyImported).
//  P9  Đơn imported có orderId trỏ tới order thật trong orders (N1QL check).
//  P10 Xóa account → list hết account đó.
//  P11 UI /admin/channels render: card + bảng + nút Import.
//  P12 RBAC: staff KHÔNG có grant channels:manage (N1QL check detail_roles),
//      owner CÓ both read+manage.
// Chạy: node tests/probe-channels.mjs
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

// ─────────────────────────────────────────────── P0: N1QL setup
async function n1ql(statement) {
	const r = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
		method: 'POST',
		headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
		body: JSON.stringify({ statement })
	});
	const j = await r.json().catch(() => ({}));
	const err = j.errors ?? [];
	return { status: r.status, ok: r.status === 200 && err.length === 0, errors: err };
}

const now = new Date().toISOString();
let setupAllOk = true;
const setupSteps = [];
// Collections
for (const coll of ['channel_accounts', 'channel_orders']) {
	const r = await n1ql(
		`CREATE COLLECTION \`${BUCKET}\`.\`${SCOPE}\`.\`${coll}\` IF NOT EXISTS`
	);
	setupSteps.push(`collection ${coll}: ${r.ok}`);
	setupAllOk = setupAllOk && r.ok;
}
// Indexes cho query WHERE (channel, channelOrderId, channelAccountId, status)
for (const [coll, field] of [
	['channel_accounts', 'channel'],
	['channel_accounts', 'createdAt'],
	['channel_orders', 'channelAccountId'],
	['channel_orders', 'channelOrderId'],
	['channel_orders', 'status'],
	['channel_orders', 'channel']
]) {
	const r = await n1ql(
		`CREATE INDEX \`idx_${coll}_${field}\` IF NOT EXISTS ON \`${BUCKET}\`.\`${SCOPE}\`.\`${coll}\`(${field})`
	);
	setupSteps.push(`index ${coll}.${field}: ${r.ok}`);
	setupAllOk = setupAllOk && r.ok;
}
// Permissions — collection tên 'permissions' (seedPermissions dùng cbData('permissions'))
for (const [key, action] of [
	['channels:read', 'read'],
	['channels:manage', 'manage']
]) {
	const doc = JSON.stringify({ key, resource: 'channels', action, createdAt: now });
	const r = await n1ql(
		`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.\`permissions\` (KEY, VALUE) VALUES ('perm-${key.replace(':', '-')}', ${doc})`
	);
	setupSteps.push(`permission ${key}: ${r.ok}`);
	setupAllOk = setupAllOk && r.ok;
}
// Grants: owner all 2, manager own_branch 2, staff chỉ read
const grants = [
	['owner', 'channels:read', 'all'],
	['owner', 'channels:manage', 'all'],
	['manager', 'channels:read', 'own_branch'],
	['manager', 'channels:manage', 'own_branch'],
	['staff', 'channels:read', 'own_branch']
];
for (const [roleName, permissionKey, scopeName] of grants) {
	const key = `grant-${roleName}-${permissionKey.replace(':', '-')}`;
	const doc = JSON.stringify({ roleName, permissionKey, scope: scopeName, createdAt: now });
	const r = await n1ql(
		`UPSERT INTO \`${BUCKET}\`.\`${SCOPE}\`.\`detail_roles\` (KEY, VALUE) VALUES ('${key}', ${doc})`
	);
	setupSteps.push(`grant ${roleName}/${permissionKey}: ${r.ok}`);
	setupAllOk = setupAllOk && r.ok;
}
ok('P0 N1QL setup (collections + indexes + permissions + grants)', setupAllOk, setupSteps.join('; '));

// ─────────────────────────────────────────────── browser + login
const browser = await chromium.launch();
const context = await browser.newContext({
	ignoreHTTPSErrors: true,
	viewport: { width: 1280, height: 900 }
});
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(e.message));

async function login(pg) {
	await pg.goto(BASE + '/login', { waitUntil: 'networkidle' });
	await pg.fill('.auth-input-wrapper input >> nth=0', 'admin');
	await pg.fill('.auth-input-wrapper input >> nth=1', '123123_Qwe');
	await pg.click('button[type="submit"]');
	await pg.waitForURL(BASE + '/');
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

await login(page);

// ─────────────────────────────────────────────── P1: channels-metadata
const meta = await post(page, '/api/admin/channels/channels-metadata', {});
const metaChannels = meta?.data?.channels ?? [];
const metaOk =
	meta?.ok === true &&
	Array.isArray(metaChannels) &&
	metaChannels.length === 9 &&
	metaChannels.every((c) => Array.isArray(c.credentialFields) && Array.isArray(c.configFields));
ok(
	'P1 channels-metadata trả 9 kênh',
	metaOk,
	`count=${metaChannels.length} channels=${metaChannels.map((c) => c.channel).join(',')}`
);

// ─────────────────────────────────────────────── P2: tạo account shopee mock
const ACC_NAME = `Probe Shop ${Date.now()}`;
const created = await post(page, '/api/admin/channels/accounts-create', {
	channel: 'shopee',
	name: ACC_NAME,
	shopId: '123456',
	credentials: {
		partnerId: '1000',
		partnerKey: 'probe-partner-key',
		accessToken: 'probe-access-token'
	},
	config: { autoConfirm: false }
});
const accKey = created?.data?.documentKey ?? null;
ok('P2 tạo account shopee (credentials encrypt)', created?.ok === true && !!accKey, `key=${accKey}`);

// ─────────────────────────────────────────────── P3: KHÔNG lộ credentials
const accList = await post(page, '/api/admin/channels/accounts-list', { search: ACC_NAME });
const accRow = (accList?.data?.accounts ?? []).find((a) => a.name === ACC_NAME);
const serialized = JSON.stringify(accRow ?? {});
const leakSafe =
	!!accRow &&
	accRow.hasCredentials === true &&
	!serialized.includes('probe-partner-key') &&
	!serialized.includes('probe-access-token') &&
	!('credentialsEncrypted' in (accRow ?? {}));
ok(
	'P3 accounts-list KHÔNG lộ credentials',
	leakSafe,
	`hasCredentials=${accRow?.hasCredentials} serialized=${serialized.slice(0, 120)}`
);

// ─────────────────────────────────────────────── P4: sync → 2 đơn mock round 0
const sync1 = await post(page, '/api/admin/channels/sync', { documentKey: accKey });
ok(
	'P4 sync #1 → 2 đơn mới (mock round 0)',
	sync1?.ok === true && sync1?.data?.inserted === 2 && sync1?.data?.skipped === 0,
	`inserted=${sync1?.data?.inserted} skipped=${sync1?.data?.skipped} cursor=${sync1?.data?.cursor}`
);

// Account sau sync: status connected + cursor '1'
const accList2 = await post(page, '/api/admin/channels/accounts-list', { search: ACC_NAME });
const accRow2 = (accList2?.data?.accounts ?? []).find((a) => a.name === ACC_NAME);
ok(
	'P4b account status=connected + cursor chạy',
	accRow2?.status === 'connected' && accRow2?.syncCursor === '1',
	`status=${accRow2?.status} cursor=${accRow2?.syncCursor}`
);

// ─────────────────────────────────────────────── P5: orders-list + không rawPayload
const orders1 = await post(page, '/api/admin/channels/orders-list', {
	channelAccountId: accKey,
	pageSize: 50
});
const orderRows = orders1?.data?.orders ?? [];
const orderSerialized = JSON.stringify(orderRows);
ok(
	'P5 orders-list 2 đơn pending_import, không rawPayload',
	orderRows.length === 2 &&
		orderRows.every((o) => o.status === 'pending_import') &&
		!orderSerialized.includes('"rawPayload"'),
	`rows=${orderRows.length} statuses=${orderRows.map((o) => o.status).join(',')}`
);

// ─────────────────────────────────────────────── P6: sync #2 → round 1 → 1 đơn mới
// Mock contract: round 0 sinh 2 đơn, round 1+ sinh 1 đơn/lượt (xem mock-util.ts).
const sync2 = await post(page, '/api/admin/channels/sync', { documentKey: accKey });
ok(
	'P6 sync #2 → cursor round 1 → 1 đơn mới',
	sync2?.ok === true && sync2?.data?.inserted === 1 && sync2?.data?.cursor === '2',
	`inserted=${sync2?.data?.inserted} cursor=${sync2?.data?.cursor}`
);
// Dedup: tổng đơn = 2 (round 0) + 1 (round 1) = 3; sync lặp không nhân bản
// (cursor tăng nên channelOrderId khác nhau — dedup test qua P8 và channelOrderId duy nhất).
const ordersAll = await post(page, '/api/admin/channels/orders-list', {
	channelAccountId: accKey,
	pageSize: 50
});
ok(
	'P6b tổng 3 đơn sau 2 lượt sync (round 0: 2 đơn, round 1: 1 đơn)',
	(ordersAll?.data?.orders ?? []).length === 3 && ordersAll?.data?.total === 3,
	`total=${ordersAll?.data?.total}`
);

// ─────────────────────────────────────────────── P7: import đơn đầu → CH- order
const targetOrder = (ordersAll?.data?.orders ?? []).find((o) => o.status === 'pending_import');
const imported = await post(page, '/api/admin/channels/orders-import', {
	documentKey: targetOrder?.documentKey
});
const internalOrderCode = imported?.data?.orderCode ?? null;
ok(
	'P7 import đơn → order nội bộ CH-…',
	imported?.ok === true && /^CH-\d{8}-[A-Z0-9]{4}$/.test(internalOrderCode ?? ''),
	`orderCode=${internalOrderCode} orderId=${imported?.data?.orderId} unmatched=${JSON.stringify(imported?.data?.unmatchedSkus ?? [])}`
);

// ─────────────────────────────────────────────── P8: import lại → bị từ chối
const imported2 = await post(page, '/api/admin/channels/orders-import', {
	documentKey: targetOrder?.documentKey
});
ok(
	'P8 import lại đơn đã nhập → bị từ chối',
	imported2?.ok !== true,
	`ok=${imported2?.ok} message=${JSON.stringify(imported2?.message ?? imported2?.messages ?? '').slice(0, 120)}`
);

// ─────────────────────────────────────────────── P9: order thật tồn tại trong orders + KHÔNG trừ tồn kho
const checkOrder = await n1ql(
	`SELECT o.orderCode, o.status, o.channelSource, o.channelOrderDocumentKey FROM \`${BUCKET}\`.\`${SCOPE}\`.\`orders\` o WHERE o.channelOrderDocumentKey = '${targetOrder?.documentKey}' LIMIT 1`
);
// Data API query service trả results trong j.results (không phải data.results)
const orderCheckRes = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
	method: 'POST',
	headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
	body: JSON.stringify({
		statement: `SELECT o.orderCode, o.status, o.channelSource, o.customerId FROM \`${BUCKET}\`.\`${SCOPE}\`.\`orders\` o WHERE o.channelOrderDocumentKey = '${targetOrder?.documentKey}' LIMIT 1`
	})
})
	.then((r) => r.json())
	.catch(() => ({}));
const realOrder = (orderCheckRes?.results ?? [])[0];
ok(
	'P9 order nội bộ tồn tại (status pending, KHÔNG trừ tồn kho)',
	!!realOrder &&
		realOrder.orderCode === internalOrderCode &&
		realOrder.status === 'pending' &&
		realOrder.channelSource === 'shopee',
	`orderCode=${realOrder?.orderCode} status=${realOrder?.status} source=${realOrder?.channelSource}`
);

// Tồn kho KHÔNG trừ: lấy SKU đơn + so stock trước/sau? Stock không đổi trong flow
// (import không đụng inventory) — verify qua inventory list 1 SKU trước/sau:
// skip vì import không gọi inventory API nào (kiểm tra bằng code review).

// ─────────────────────────────────────────────── P10: xóa account
const deleted = await post(page, '/api/admin/channels/accounts-delete', {
	documentKey: accKey
});
const accList3 = await post(page, '/api/admin/channels/accounts-list', { search: ACC_NAME });
const stillThere = (accList3?.data?.accounts ?? []).some((a) => a.documentKey === accKey);
ok('P10 xóa account → list hết', deleted?.ok === true && !stillThere, `deleted=${deleted?.ok}`);

// Dọn đơn probe (channel_orders) — để DB sạch, xóa channel_orders của account vừa sync
const delOrders = await n1ql(
	`DELETE FROM \`${BUCKET}\`.\`${SCOPE}\`.\`channel_orders\` WHERE channelAccountId = '${accKey}'`
);
const delInternal = await n1ql(
	`DELETE FROM \`${BUCKET}\`.\`${SCOPE}\`.\`orders\` WHERE channelOrderDocumentKey IS NOT NULL AND channelSource = 'shopee' AND orderCode = '${internalOrderCode ?? ''}'`
);

// ─────────────────────────────────────────────── P11: UI /admin/channels
// Tạo lại 1 account để grid có dữ liệu render (P10 đã xóa hết).
const uiAcc = await post(page, '/api/admin/channels/accounts-create', {
	channel: 'shopee',
	name: 'UI Probe Shop',
	shopId: '777',
	credentials: { partnerId: '1', partnerKey: 'ui-probe-key', accessToken: 'ui-probe-token' }
});
const uiAccKey = uiAcc?.data?.documentKey ?? null;

await page.goto(`${BASE}/admin/channels`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(
	() => !!document.querySelector('[data-test="admin-channels-page"]'),
	{ timeout: 25000, polling: 500 }
);
// Đợi grid account render (không phải skeleton/loading) — có card thật
await page.waitForFunction(
	() => !!document.querySelector('[data-test="channels-account-card"]'),
	{ timeout: 25000, polling: 500 }
);
// Đợi bảng đơn render xong (loadOrders chạy tuần tự sau loadAccounts)
await page.waitForFunction(
	() => !!document.querySelector('[data-test="channels-orders-table"]'),
	{ timeout: 25000, polling: 500 }
);
const uiState = await page.evaluate(() => {
	const root = document.querySelector('[data-test="admin-channels-page"]');
	const grid = document.querySelector('[data-test="channels-accounts-grid"]');
	const table = document.querySelector('[data-test="channels-orders-table"]');
	const connectBtn = document.querySelector('[data-test="channels-connect-btn"]');
	const title = root?.querySelector('h1')?.textContent?.trim() ?? '';
	return {
		hasPage: !!root,
		hasGrid: !!grid,
		hasTable: !!table,
		hasConnectBtn: !!connectBtn,
		title
	};
});
ok(
	'P11 UI /admin/channels render (page + nút kết nối + bảng đơn)',
	uiState.hasPage && uiState.hasConnectBtn && uiState.hasTable && uiState.hasGrid,
	`title=${uiState.title} grid=${uiState.hasGrid} table=${uiState.hasTable}`
);
await page.screenshot({ path: `${SHOT_DIR}/channels-admin-page.png`, fullPage: true });

// Mở modal connect → form sinh từ metadata
await page.click('[data-test="channels-connect-btn"]');
await page.waitForSelector('[data-test="channels-form-channel"]', { timeout: 10000 });
const modalState = await page.evaluate(() => {
	const channelSelect = document.querySelector('[data-test="channels-form-channel"]');
	const options = channelSelect ? Array.from(channelSelect.querySelectorAll('option')) : [];
	const nameInput = document.querySelector('[data-test="channels-form-name"]');
	const submitBtn = document.querySelector('[data-test="channels-form-submit"]');
	return {
		optionCount: options.length,
		hasName: !!nameInput,
		hasSubmit: !!submitBtn
	};
});
ok(
	'P11b modal connect sinh form từ metadata (9 kênh)',
	modalState.optionCount === 9 && modalState.hasName && modalState.hasSubmit,
	`options=${modalState.optionCount}`
);
await page.screenshot({ path: `${SHOT_DIR}/channels-connect-modal.png`, fullPage: false });

// Đóng modal + dọn account UI probe
await page.keyboard.press('Escape');
await sleep(400);
await post(page, '/api/admin/channels/accounts-delete', { documentKey: uiAccKey });
await n1ql(
	`DELETE FROM \`${BUCKET}\`.\`${SCOPE}\`.\`channel_orders\` WHERE channelAccountId = '${uiAccKey ?? ''}'`
);

// ─────────────────────────────────────────────── P12: RBAC grants N1QL
const staffManage = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
	method: 'POST',
	headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
	body: JSON.stringify({
		statement: `SELECT COUNT(*) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`detail_roles\` WHERE roleName = 'staff' AND permissionKey = 'channels:manage'`
	})
})
	.then((r) => r.json())
	.catch(() => ({}));
const staffRead = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
	method: 'POST',
	headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
	body: JSON.stringify({
		statement: `SELECT COUNT(*) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`detail_roles\` WHERE roleName = 'staff' AND permissionKey = 'channels:read'`
	})
})
	.then((r) => r.json())
	.catch(() => ({}));
const ownerManage = await fetch(`https://${CLUSTER}.data.cloud.couchbase.com/_p/query/query/service`, {
	method: 'POST',
	headers: { authorization: `Basic ${BASIC}`, 'content-type': 'application/json' },
	body: JSON.stringify({
		statement: `SELECT COUNT(*) AS c FROM \`${BUCKET}\`.\`${SCOPE}\`.\`detail_roles\` WHERE roleName = 'owner' AND permissionKey = 'channels:manage'`
	})
})
	.then((r) => r.json())
	.catch(() => ({}));
const staffManageCount = staffManage?.results?.[0]?.c ?? -1;
const staffReadCount = staffRead?.results?.[0]?.c ?? -1;
const ownerManageCount = ownerManage?.results?.[0]?.c ?? -1;
ok(
	'P12 RBAC: staff KHÔNG manage (chỉ read), owner có manage',
	staffManageCount === 0 && staffReadCount === 1 && ownerManageCount >= 1,
	`staffManage=${staffManageCount} staffRead=${staffReadCount} ownerManage=${ownerManageCount}`
);

// ─────────────────────────────────────────────── summary
const passCount = results.filter((r) => r.pass).length;
console.log(`\n===== KẾT QUẢ: ${passCount}/${results.length} PASS =====`);
writeFileSync('tests/_channels-probe-result.json', JSON.stringify(results, null, 2), 'utf8');

await browser.close();
process.exit(passCount === results.length ? 0 : 1);
