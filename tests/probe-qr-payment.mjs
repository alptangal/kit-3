// Probe QR payment + auto-confirm qua tool đối soát.
// Kịch bản:
//  Q1  Mock tool HTTP server (port 4599) trả JSON {status:'SUCCESS', reference} —
//      khớp config default QR_CHECKER_RESPONSE_MAP {"status":"status"} + SUCCESS_VALUES ["SUCCESS"].
//  Q2  POS checkout paymentMethod=momo → payment doc pending + QR (payload + dataUrl).
//  Q3  Storefront checkout paymentMethod=bank_transfer → payment pending + QR payload.
//  Q4  /api/admin/payments/qr/check (paymentCode) → payment completed + order paid.
//  Q5  Conditional transition: check lại payment đã completed → status vẫn completed
//      (mock tắt trước khi gọi lại → chứng tỏ KHÔNG gọi tool nữa).
//  Q6  Tool trả PENDING → payment giữ pending (không confirm sớm).
//  Q7  UI admin payments: nút Check QR trên payment pending method QR; badge auto
//      poll vắng (AUTO_POLL=false mặc định) = PASS.
//  Q8  Thanks page storefront hiển thị QR render client từ payload (?qr=&pay=).
// Chạy: node tests/probe-qr-payment.mjs
// YÊU CẦU MÔI TRƯỜNG: dev server đã đọc env QR_CHECKER_URL='http://127.0.0.1:4599/transaction'
// (nếu chưa, probe tự thêm vào .env rồi báo user restart server → SKIP phần check tool).
import { chromium } from 'playwright';
import http from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, appendFileSync, existsSync } from 'node:fs';

const BASE = process.env.PROBE_BASE || 'https://localhost:3000';
const SHOT_DIR = 'tests/_ui-shots';
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
// POS map momo → schema 'e_wallet' (PAYMENT_METHOD_MAP) — method hợp lệ cho QR check.
function payPayMethodOk(pay) {
	return pay?.method === 'e_wallet' || pay?.method === 'momo';
}
function ok(name, pass, detail = '') {
	results.push({ name, pass, detail });
	console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────── Q1: mock tool đối soát
let mockMode = 'success'; // success | pending | mismatch
let lastQuery = null;
const mockServer = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://localhost:4599');
	let code = url.searchParams.get('id');
	let body = '';
	req.on('data', (c) => (body += c));
	req.on('end', () => {
		if (!code && body) {
			try {
				code = JSON.parse(body).id ?? null; // POST JSON {"id": ...}
			} catch {
				/* không JSON */
			}
		}
		lastQuery = code;
		let payload;
		if (mockMode === 'success') {
			payload = { status: 'SUCCESS', reference: `MOCK-TXN-${code}` };
		} else if (mockMode === 'mismatch') {
			payload = { status: 'SUCCESS', amount: 999, reference: 'MOCK-TXN-WRONG' };
		} else {
			payload = { status: 'PENDING' };
		}
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify(payload));
	});
});
mockServer.on('error', () => {});
await new Promise((resolve) => mockServer.listen(4599, '127.0.0.1', resolve));
console.log('[mock] tool đối soát chạy tại http://127.0.0.1:4599/transaction');

// ─────────────────────────────────────────────── đảm bảo .env có QR_CHECKER_URL
// Dev server (Vite) load .env lúc start — thêm entry mới KHÔNG có hiệu lực tới khi
// restart. Probe phát hiện thiếu → tự ghi .env + yêu cầu restart (chỉ 1 lần).
const ENV_PATH = 'D:/nodejs/svelte/kit-3/.env';
let env = readFileSync(ENV_PATH, 'utf8');
let toolConfiguredInServer = true;
if (!/^QR_CHECKER_URL=.+$/m.test(env) || /^QR_CHECKER_URL=''$/m.test(env)) {
	if (!env.includes('QR_CHECKER_URL=')) {
		env += "\nQR_CHECKER_URL='http://127.0.0.1:4599/transaction'\n";
	} else {
		env = env.replace(/^QR_CHECKER_URL=''$/m, "QR_CHECKER_URL='http://127.0.0.1:4599/transaction'");
	}
	appendFileSync(ENV_PATH, '', 'utf8');
	writeFileSync(ENV_PATH, env, 'utf8');
	console.log('[env] đã ghi QR_CHECKER_URL vào .env — CẦN RESTART dev server để có hiệu lực.');
	toolConfiguredInServer = false;
}
// Trong mọi trường hợp giữ RESPONSE_MAP default '{"status":"status"}' (đã trong .env).

// ─────────────────────────────────────────────── browser
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

// ─────────────────────────────────────────────── Q2: POS checkout momo → QR
// Chuẩn bị: variant có stock tại branch 'main' + giá 25000 (set qua API — dữ liệu
// Couchbase hiện tại có variant giá 0 nên probe tự nạp).
const PROBE_VARIANT = 'variant::imp_684114138a01c072a3035a5c';
const PROBE_BRANCH = 'main';
const prep = await page.evaluate(async ([vid, branch]) => {
	const enc = await import('/src/lib/modules/encryption.ts');
	const post = (url, body) => enc.encryption.fetchSecure(url, { method: 'POST', body });
	const adj = await post('/api/admin/inventory/stock/adjust', {
		variantId: vid,
		branchId: branch,
		change: 10,
		referenceType: 'manual',
		note: 'probe-qr stock top-up'
	});
	const upd = await post('/api/admin/variants/update', { documentKey: vid, price: 25000 });
	return { adjOk: adj?.ok === true, updOk: upd?.ok === true };
}, [PROBE_VARIANT, PROBE_BRANCH]);

const posResult2 = await page.evaluate(async ([vid, branch]) => {
	const enc = await import('/src/lib/modules/encryption.ts');
	const post = (url, body) => enc.encryption.fetchSecure(url, { method: 'POST', body });
	const created = await post('/api/admin/pos/checkout', {
		items: [{ variantId: vid, quantity: 1 }],
		paymentMethod: 'momo',
		branchId: branch
	});
	if (!created?.ok) return { error: 'checkout-failed', detail: created };
	return {
		paymentCode: created.data?.paymentCode,
		qrPayload: created.data?.qr?.payload,
		qrDataUrl: created.data?.qr?.dataUrl,
		orderCode: created.data?.orderCode,
		totalAmount: created.data?.totalAmount,
		orderId: created.data?.documentKey
	};
}, [PROBE_VARIANT, PROBE_BRANCH]);
if (posResult2.error) {
	ok('Q2 POS momo → payment pending + QR', false, JSON.stringify(posResult2).slice(0, 300));
} else {
	ok(
		'Q2 POS momo → payment pending + QR',
		!!posResult2.paymentCode &&
			!!posResult2.qrPayload &&
			typeof posResult2.qrDataUrl === 'string' &&
			posResult2.qrDataUrl.startsWith('data:image/png'),
		`paymentCode=${posResult2.paymentCode} order=${posResult2.orderCode} total=${posResult2.totalAmount}`
	);
	// Q2b: payment POS momo phải 'pending' + method schema 'e_wallet' (POS map
	// momo → e_wallet) — chờ tool đối soát chứ không completed ngay.
	const posPayList = await post(page, '/api/admin/payments/list', {
		orderId: posResult2.orderId,
		page: 1,
		pageSize: 5
	});
	const posPay = (posPayList?.data?.items ?? [])[0];
	ok(
		'Q2b payment POS momo pending (method e_wallet)',
		posPay?.status === 'pending' && payPayMethodOk(posPay),
		`status=${posPay?.status} method=${posPay?.method}`
	);
}

// ─────────────────────────────────────────────── Q3: storefront bank_transfer → QR
const sfResult = await page.evaluate(async () => {
	const enc = await import('/src/lib/modules/encryption.ts');
	const post = (url, body) => enc.encryption.fetchSecure(url, { method: 'POST', body });
	// đảm bảo variant có giá > 0 để storefront list hiện
	const prods = await post('/api/storefront/products/list', { page: 1, pageSize: 20 });
	// products list trả data.products (không phải items), mỗi sản phẩm có variants[]
	const product = (prods?.data?.products ?? []).find((p) => p.variants?.some((v) => (v.price ?? 0) > 0));
	if (!product) return { error: 'no-product', detail: 'không có sản phẩm có variant giá > 0' };
	const variantId = product.variants.find((v) => (v.price ?? 0) > 0)?.variantId ?? product.productId;
	const added = await post('/api/storefront/cart/add', { variantId, quantity: 1 });
	if (!added?.ok) return { error: 'cart-add-failed', detail: added };
	// cartId từ /api/storefront/cart/get (chính là flow thật của checkout page)
	const cartGet = await post('/api/storefront/cart/get', {});
	const cartId = cartGet?.data?.cart?.cartId ?? cartGet?.data?.cart?._id;
	if (!cartId) return { error: 'no-cart', detail: cartGet };
	const checkout = await post('/api/storefront/checkout/initiate', {
		cartId,
		shippingAddress: {
			recipientName: 'QR Probe',
			phoneNumber: '0900000000',
			street: 'Test',
			ward: 'W',
			district: 'D',
			province: 'HCMC'
		},
		paymentMethod: 'bank_transfer'
	});
	if (!checkout?.ok) return { error: 'checkout-failed', detail: checkout };
	return {
		paymentCode: checkout.data?.paymentCode,
		qrPayload: checkout.data?.qr?.payload,
		orderCode: checkout.data?.orderCode
	};
});
if (sfResult.error) {
	ok('Q3 storefront bank_transfer → payment + QR', false, JSON.stringify(sfResult).slice(0, 300));
} else {
	ok(
		'Q3 storefront bank_transfer → payment + QR',
		!!sfResult.paymentCode && !!sfResult.qrPayload,
		`paymentCode=${sfResult.paymentCode} order=${sfResult.orderCode}`
	);
}

// ─────────────────────────────────────────────── Q4: qr/check → completed
// Target là payment storefront bank_transfer (PENDING thật). POS momo payment
// cũng pending giờ đây (QR methods chờ tool đối soát) — dùng storefront cho
// flow check vì có sẵn cart flow.
const targetCode = sfResult?.paymentCode;
if (!targetCode) {
	ok('Q4 qr/check → completed', false, 'không có paymentCode (Q3 fail)');
} else {
	// Q4a: payment storefront bank_transfer đang pending trong list
	const before = await post(page, '/api/admin/payments/list', {
		page: 1,
		pageSize: 50,
		status: 'pending',
		method: 'bank_transfer'
	});
	const beforeRow = (before?.data?.items ?? []).find((p) => p.paymentCode === targetCode);
	ok('Q4a payment storefront bank_transfer đang pending', !!beforeRow, beforeRow ? `amount=${beforeRow.amount}` : 'không thấy trong list pending bank_transfer');

	mockMode = 'success';
	const check = await post(page, '/api/admin/payments/qr/check', { paymentCode: targetCode });
	const checkOk = check?.ok && check?.data?.status === 'completed';
	ok('Q4b qr/check → completed', !!checkOk, `status=${check?.data?.status} msg=${JSON.stringify(check?.message ?? check?.messages ?? '').slice(0, 120)}`);

	// Q4c: payment doc có notes QR auto-confirm. Reference không đổi khi map chưa
	// khai báo path 'reference' — behavior đúng (không ghi đè giá trị cũ).
	const payDoc = check?.data?.payment;
	ok(
		'Q4c payment doc ghi nhận auto-confirm',
		!!payDoc && /QR auto-confirm/i.test(String(payDoc.notes ?? '')),
		`notes=${String(payDoc?.notes ?? '').slice(-80)}`
	);
}

// ─────────────────────────────────────────────── Q4d: POS momo (method e_wallet) qua qr/check
// POS map momo → schema 'e_wallet' — verify qr/check confirm được cả payment e_wallet.
if (posResult2?.paymentCode) {
	mockMode = 'success';
	if (!mockServer.listening) {
		await new Promise((resolve) => mockServer.listen(4599, '127.0.0.1', resolve));
	}
	const posCheck = await post(page, '/api/admin/payments/qr/check', { paymentCode: posResult2.paymentCode });
	ok(
		'Q4d qr/check POS momo (e_wallet) → completed',
		posCheck?.ok === true && posCheck?.data?.status === 'completed',
		`status=${posCheck?.data?.status} msg=${JSON.stringify(posCheck?.message ?? '').slice(0, 100)}`
	);
} else {
	ok('Q4d qr/check POS momo (e_wallet) → completed', false, 'không có POS paymentCode (Q2 fail)');
}

// ─────────────────────────────────────────────── Q5: conditional transition
if (!targetCode) {
	ok('Q5 check lại completed không đổi', false, 'không có paymentCode');
} else {
	// Tắt mock: đóng server → nếu service vẫn gọi tool sẽ fetch fail → checkFailed,
	// NHƯNG service phải short-circuit (doc.status != pending → trả luôn không gọi tool).
	await new Promise((resolve) => mockServer.close(resolve));
	const again2 = await post(page, '/api/admin/payments/qr/check', { paymentCode: targetCode });
	ok(
		'Q5 check lại completed → vẫn completed, không gọi tool',
		again2?.ok && again2?.data?.status === 'completed',
		`status=${again2?.data?.status}`
	);
}

// ─────────────────────────────────────────────── Q6: tool trả PENDING → giữ pending
// Tạo storefront bank_transfer nữa với mock trả {status:'PENDING'} → check → ok,
// payment vẫn pending (không confirm).
mockMode = 'pending';
await new Promise((resolve) => {
	// mock server đang đóng từ Q5 — listen lại (guard ERR_SERVER_ALREADY_LISTEN)
	if (!mockServer.listening) mockServer.listen(4599, '127.0.0.1', resolve);
	else resolve();
});
const zapResult = await page.evaluate(async () => {
	const enc = await import('/src/lib/modules/encryption.ts');
	const post = (url, body) => enc.encryption.fetchSecure(url, { method: 'POST', body });
	// checkout 1 đã clear cart — thêm lại item trước khi tạo payment thứ 2
	const prods = await post('/api/storefront/products/list', { page: 1, pageSize: 20 });
	const product = (prods?.data?.products ?? []).find((p) => p.variants?.some((v) => (v.price ?? 0) > 0));
	if (!product) return { error: 'no-product' };
	const variantId = product.variants.find((v) => (v.price ?? 0) > 0)?.variantId ?? product.productId;
	const added = await post('/api/storefront/cart/add', { variantId, quantity: 1 });
	if (!added?.ok) return { error: 'cart-add-failed', detail: added };
	const cartGet = await post('/api/storefront/cart/get', {});
	const cartId = cartGet?.data?.cart?.cartId ?? cartGet?.data?.cart?._id;
	if (!cartId) return { error: 'no-cart' };
	const created = await post('/api/storefront/checkout/initiate', {
		cartId,
		shippingAddress: {
			recipientName: 'QR Probe 2',
			phoneNumber: '0900000001',
			street: 'Test',
			ward: 'W',
			district: 'D',
			province: 'HCMC'
		},
		paymentMethod: 'bank_transfer'
	});
	if (!created?.ok) return { error: 'checkout-failed', detail: created };
	return { paymentCode: created.data?.paymentCode };
});
if (zapResult?.paymentCode) {
	const pendingCheck = await post(page, '/api/admin/payments/qr/check', { paymentCode: zapResult.paymentCode });
	ok(
		'Q6 tool trả PENDING → payment giữ pending',
		pendingCheck?.ok === true && pendingCheck?.data?.status === 'pending',
		`resp=${JSON.stringify({ ok: pendingCheck?.ok, status: pendingCheck?.data?.status }).slice(0, 160)}`
	);
} else {
	ok('Q6 tool trả PENDING → payment giữ pending', false, 'không tạo được payment: ' + JSON.stringify(zapResult).slice(0, 160));
}

// ─────────────────────────────────────────────── Q7: UI admin payments
// List API + DataTable poll chậm (mất ~8-15s: RSA handshake + N1QL) — poll skeleton
// hết trước khi đếm row (memory: poll hết "Loading" trước chụp).
await page.goto(`${BASE}/admin/payments`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(
	() => {
		const root = document.querySelector('[data-test="payments-datatable"]');
		if (!root) return false;
		const skeletons = root.querySelectorAll('.datatable-row--skeleton');
		const rows = root.querySelectorAll('.datatable-row:not(.datatable-row--skeleton)');
		return rows.length > 0 && skeletons.length === 0;
	},
	{ timeout: 25000, polling: 500 }
);
await sleep(500);
const uiState = await page.evaluate(() => {
	const root = document.querySelector('[data-test="payments-datatable"]');
	const rows = root ? root.querySelectorAll('.datatable-row:not(.datatable-row--skeleton)') : [];
	const buttons = Array.from(document.querySelectorAll('.datatable-row button')).map((b) => b.textContent?.trim() ?? '');
	const badge = document.querySelector('[data-test="qr-auto-badge"]');
	return {
		hasTable: !!root,
		rowCount: rows.length,
		hasCheckQrButton: buttons.some((t) => t === 'Check QR' || t === 'Kiểm tra QR' || /check qr/i.test(t)),
		hasAutoBadge: !!badge
	};
});
ok('Q7a bảng payments render', uiState.hasTable && uiState.rowCount > 0, `rows=${uiState.rowCount}`);
ok('Q7b nút Check QR trên payment pending QR', uiState.hasCheckQrButton, 'tìm button "Check QR"');
ok('Q7c badge auto poll vắng khi AUTO_POLL=false', !uiState.hasAutoBadge, 'badge chỉ hiện khi auto poll bật');

// ─────────────────────────────────────────────── Q8: thanks page QR
if (sfResult?.paymentCode && sfResult?.qrPayload) {
	const qrUrl = `${BASE}/store/checkout/thanks?order=${encodeURIComponent(sfResult.orderCode ?? '')}&pay=${encodeURIComponent(sfResult.paymentCode)}&qr=${encodeURIComponent(sfResult.qrPayload)}`;
	await page.goto(qrUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
	await sleep(1500); // dynamic import qrcode + render
	const thanks = await page.evaluate(() => {
		const box = document.querySelector('[data-test="thanks-qr-payment"]');
		const img = box ? box.querySelector('img') : null;
		return { hasBox: !!box, imgSrcOk: !!img && (img.src ?? '').startsWith('data:image/png') };
	});
	ok('Q8 thanks page hiển thị QR', thanks.hasBox && thanks.imgSrcOk, 'data-test=thanks-qr-payment + img data:image/png');
	const shotQr = `${SHOT_DIR}/qr-thanks.png`;
	await page.screenshot({ path: shotQr, fullPage: true });
} else {
	ok('Q8 thanks page hiển thị QR', false, 'thiếu paymentCode/qrPayload từ Q3');
}

// ─────────────────────────────────────────────── screenshots
await page.goto(`${BASE}/admin/payments`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(2500);
await page.screenshot({ path: `${SHOT_DIR}/qr-admin-payments.png`, fullPage: false });

const passCount = results.filter((r) => r.pass).length;
console.log(`\n===== KẾT QUẢ: ${passCount}/${results.length} PASS =====`);
writeFileSync('tests/_qr-payment-probe-result.json', JSON.stringify(results, null, 2), 'utf8');

await browser.close();
mockServer.close();
process.exit(0);
