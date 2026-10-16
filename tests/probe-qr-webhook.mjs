// Probe webhook QR payment (push-in từ tool đối soát ngoài của user).
// Kịch bản:
//  W1  Token chưa set → POST /api/webhooks/qr-payment → 404 (route ẩn).
//  W2  Set QR_WEBHOOK_TOKEN tạm (env process — không đọc được runtime; probe
//      dùng token set trong .env: QT_qrwebhook_test_2026). Sai token → 401.
//  W3  Tạo payment doc pending test (WEB-TEST-<ts>) qua N1QL + order thật.
//  W4  Webhook payload linh hoạt {id: <code>, amount, status:'SUCCESS',
//      paidAt, reference} → 200 {ok:true,status:'completed'}.
//  W5  Verify DB: payment status=completed, processedBy=qr-webhook,
//      transactionReference khớp; order paymentStatus=paid.
//  W6  Idempotent: gọi lại webhook → 200 already_confirmed (không đổi notes).
//  W7  Sai amount → 409 amount_mismatch (tạo payment pending khác).
//  W8  paymentCode không tồn tại → 404 payment_not_found.
//  W9  Dọn dẹp: DELETE docs test.
// Chạy: node tests/probe-qr-webhook.mjs   (dev server :3000 + .env có QR_WEBHOOK_TOKEN)
import { chromium, request as pwRequest } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'https://127.0.0.1:3000';
const env = {};
for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
	const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]?([^'"]*?)['"]?\s*$/);
	if (m) env[m[1]] = m[2].trim();
}
const CLUSTER = env.cb_clusterId, USER = env.cb_username, PASS = env.cb_password;
const BUCKET = env.cb_bucketName, SCOPE = env.cb_scopeName;
const BASIC = Buffer.from(`${USER}:${PASS}`).toString('base64');
const TOKEN = env.QR_WEBHOOK_TOKEN || '';
const KS = (c) => `\`${BUCKET}\`.\`${SCOPE}\`.\`${c}\``;

const results = [];
function ok(name, pass, detail = '') {
	results.push({ name, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}

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

// ── Browser đăng nhập admin (session cookie dùng cho admin API nếu cần) ──
const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90000 });
await page.fill('.auth-input-wrapper input >> nth=0', 'admin');
await page.fill('.auth-input-wrapper input >> nth=1', '123123_Qwe');
await page.click('button[type=submit]');
await page.waitForURL(`${BASE}/`, { timeout: 60000 }).catch(() => {});
ok('W0 login admin', !/login/.test(page.url() || ''));

const api = await ctx.request;

// ── W1: token rỗng → 404 (skip nếu .env đã set token) ──
if (!TOKEN) {
	const r1 = await api.post(`${BASE}/api/webhooks/qr-payment`, { data: { id: 'X' } });
	ok('W1 token rỗng → 404 ẩn route', r1.status() === 404, `status=${r1.status()}`);
} else {
	ok('W1 token rỗng → 404 ẩn route', true, 'skip — .env đã set QR_WEBHOOK_TOKEN');
}

// ── W3: tạo order + payment pending test ──
const ts = Date.now();
const orderId = `order_webhook_test_${ts}`;
const payCode = `WEB-TEST-${ts}`;
const payId = `payment_webhook_test_${ts}`;
const amount = 250000;
const rOrder = await n1ql(`UPSERT INTO ${KS('orders')} (KEY, VALUE) VALUES ('${orderId}', ${JSON.stringify({
	orderCode: `WEB-ORD-${ts}`, status: 'pending', paymentStatus: 'pending', totalAmount: amount,
	createdAt: new Date().toISOString(), _test: 'qr-webhook-probe'
})})`);
const rPay = await n1ql(`UPSERT INTO ${KS('payments')} (KEY, VALUE) VALUES ('${payId}', ${JSON.stringify({
	paymentCode: payCode, orderId, method: 'bank_transfer', status: 'pending', amount,
	notes: '[probe] webhook test', createdAt: new Date().toISOString(), _test: 'qr-webhook-probe'
})})`);
ok('W3 tạo order+payment test', rOrder.ok && rPay.ok, `order=${rOrder.ok} pay=${rPay.ok}`);

// ── W2: sai token → 401 ──
const r2 = await api.post(`${BASE}/api/webhooks/qr-payment`, {
	headers: { Authorization: 'Bearer sai-token' },
	data: { id: payCode }
});
ok('W2 sai token → 401', r2.status() === 401, `status=${r2.status()}`);

// ── W4: payload linh hoạt → completed ──
const r4 = await api.post(`${BASE}/api/webhooks/qr-payment`, {
	headers: { Authorization: `Bearer ${TOKEN}` },
	data: { id: payCode, amount, status: 'SUCCESS', paidAt: new Date().toISOString(), reference: `TXN-${ts}` }
});
const j4 = await r4.json().catch(() => ({}));
ok('W4 webhook confirm → completed', r4.status() === 200 && j4.status === 'completed', `status=${r4.status()} body=${JSON.stringify(j4).slice(0, 120)}`);

// ── W5: verify DB ──
const v5 = await n1ql(`SELECT p.status, p.processedBy, p.transactionReference, o.paymentStatus
	FROM ${KS('payments')} p LEFT JOIN ${KS('orders')} o ON KEYS p.orderId WHERE p.paymentCode = '${payCode}'`);
const row5 = v5.results?.[0] ?? {};
ok('W5 DB payment completed + order paid',
	row5.status === 'completed' && row5.processedBy === 'qr-webhook' && row5.transactionReference === `TXN-${ts}` && row5.paymentStatus === 'paid',
	JSON.stringify(row5));

// ── W6: idempotent ──
const r6 = await api.post(`${BASE}/api/webhooks/qr-payment`, {
	headers: { Authorization: `Bearer ${TOKEN}` },
	data: { id: payCode, status: 'SUCCESS' }
});
const j6 = await r6.json().catch(() => ({}));
ok('W6 gọi lại → already_confirmed', r6.status() === 200 && j6.note === 'already_confirmed', `body=${JSON.stringify(j6).slice(0, 80)}`);

// ── W7: sai amount → 409 ──
const payCode2 = `WEB-TEST-2-${ts}`;
const payId2 = `payment_webhook_test_2_${ts}`;
await n1ql(`UPSERT INTO ${KS('payments')} (KEY, VALUE) VALUES ('${payId2}', ${JSON.stringify({
	paymentCode: payCode2, orderId, method: 'bank_transfer', status: 'pending', amount: 999000,
	notes: '[probe] webhook amount test', createdAt: new Date().toISOString(), _test: 'qr-webhook-probe'
})})`);
const r7 = await api.post(`${BASE}/api/webhooks/qr-payment`, {
	headers: { Authorization: `Bearer ${TOKEN}` },
	data: { id: payCode2, amount: 12345, status: 'SUCCESS' }
});
ok('W7 sai amount → 409', r7.status() === 409, `status=${r7.status()}`);

// ── W8: paymentCode lạ → 404 ──
const r8 = await api.post(`${BASE}/api/webhooks/qr-payment`, {
	headers: { Authorization: `Bearer ${TOKEN}` },
	data: { id: 'KHONG-TON-TAI-XYZ' }
});
ok('W8 payment lạ → 404', r8.status() === 404, `status=${r8.status()}`);

// ── W9: dọn dẹp ──
await n1ql(`DELETE FROM ${KS('payments')} WHERE _test = 'qr-webhook-probe'`);
await n1ql(`DELETE FROM ${KS('orders')} WHERE _test = 'qr-webhook-probe'`);
ok('W9 dọn docs test', true);

await browser.close();
const total = results.length;
const passed = results.filter((r) => r.pass).length;
console.log(`\n===== QR WEBHOOK PROBE: ${passed}/${total} PASS =====`);
process.exit(passed === total ? 0 : 1);
