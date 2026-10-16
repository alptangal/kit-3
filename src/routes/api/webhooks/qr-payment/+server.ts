// src/routes/api/webhooks/qr-payment/+server.ts
// Webhook QR payment — tool đối soát của bạn GỬI REQUEST TỚI app khi xác minh
// giao dịch thành công (chiều ngược với qr/check: app hỏi tool).
//
// POST /api/webhooks/qr-payment
// Header: QR_WEBHOOK_HEADER (mặc định Authorization) = Bearer <QR_WEBHOOK_TOKEN>
// Body linh hoạt — app tự map:
//   { paymentCode? | id? | reference?, amount?, status?, paidAt? }
//   (status: "SUCCESS"|"success"|... — khớp QR_CHECKER_SUCCESS_VALUES; nếu
//    thiếu status thì coi như success — tool chỉ gọi webhook khi thành công)
//
// An toàn: token bắt buộc; paymentCode phải TỒN TẠI trong DB; transition
// conditional pending → completed (không bao giờ ngược); amount đối soát khi
// cả 2 phía đều có. Token rỗng → 404 (không lộ route).
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { cbData } from '$modules/couchbase/clients';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { readQrCheckerConfig } from '$lib/server/db/qr-payments';

const cbPayments = cbData('payments');
const cbOrders = cbData('orders');
const paymentsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`payments\``;
const ordersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`orders\``;

type WebhookPayload = {
	paymentCode?: string;
	id?: string;
	reference?: string;
	amount?: number | string;
	status?: string;
	paidAt?: string;
};

const getPath = (obj: unknown, path: string): unknown =>
	path
		.split('.')
		.reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj);

export const POST: RequestHandler = async ({ request }) => {
	const token = String(env.QR_WEBHOOK_TOKEN ?? '').trim();

	// Webhook TẮT khi chưa cấu hình token — 404 để không lộ route tồn tại.
	if (!token) {
		return json({ ok: false }, { status: 404 });
	}

	// Đọc token từ header cấu hình (Bearer prefix tùy chọn).
	const headerName = String(env.QR_WEBHOOK_HEADER ?? 'Authorization').trim() || 'Authorization';
	const raw = request.headers.get(headerName) ?? '';
	const provided = raw.replace(/^Bearer\s+/i, '').trim();
	if (!provided || provided !== token) {
		return json({ ok: false, error: 'unauthorized' }, { status: 401 });
	}

	// Body: JSON thuần hoặc string chứa JSON/URL-encoded form.
	let payload: WebhookPayload = {};
	const contentType = request.headers.get('content-type') ?? '';
	try {
		if (contentType.includes('application/json')) {
			payload = (await request.json()) as WebhookPayload;
		} else {
			const text = await request.text();
			try {
				payload = JSON.parse(text) as WebhookPayload;
			} catch {
				// form-urlencoded: k1=v1&k2=v2 (giá trị chứa JSON được parse lại)
				for (const [k, v] of new URLSearchParams(text)) {
					(payload as Record<string, unknown>)[k] = v;
				}
			}
		}
	} catch {
		return json({ ok: false, error: 'invalid_body' }, { status: 400 });
	}

	// Map linh hoạt: paymentCode/id/reference (responseMap cho biết field thật
	// trong payload của tool khi cần — ví dụ {id:'data.txnId'}).
	const config = readQrCheckerConfig();
	const map = (field: 'status' | 'reference' | 'amount' | 'paidAt'): unknown => {
		const mapped = config.responseMap[field];
		if (mapped) {
			const viaMap = getPath(payload, mapped);
			if (viaMap !== undefined) return viaMap;
		}
		return (payload as Record<string, unknown>)[field];
	};

	const paymentCode = String(payload.paymentCode ?? payload.id ?? map('reference') ?? '').trim();
	if (!paymentCode) {
		return json({ ok: false, error: 'missing_payment_code' }, { status: 400 });
	}

	// Status: có thì phải SUCCESS (QR_CHECKER_SUCCESS_VALUES); thiếu = tool chỉ
	// báo succès khi gọi webhook → coi như success.
	const successValues = (() => {
		try {
			const raw = JSON.parse(String(env.QR_CHECKER_SUCCESS_VALUES ?? '["SUCCESS"]')) as unknown[];
			return raw.map((v) => String(v).toUpperCase());
		} catch {
			return ['SUCCESS'];
		}
	})();
	const statusRaw = String(map('status') ?? '').trim().toUpperCase();
	if (statusRaw && !successValues.includes(statusRaw)) {
		return json({ ok: true, status: 'pending', note: 'not_success_status' });
	}

	// paymentCode phải tồn tại trong DB (chống webhook giả mạo). Lookup bằng
	// N1QL — documentKey KHÔNG phải paymentCode (giống QrPaymentService).
	const lookup = await cbPayments.document.query({
		statement: `SELECT META(p).id AS _id, p.status, p.amount, p.orderId FROM ${paymentsKeyspace} p WHERE p.paymentCode = $1 LIMIT 1`,
		args: [paymentCode],
		readonly: true
	});
	if (!lookup.ok) return json({ ok: false, error: 'lookup_failed' }, { status: 500 });
	const doc = (lookup.data?.results?.[0] ?? null) as Record<string, unknown> | null;
	if (!doc) return json({ ok: false, error: 'payment_not_found' }, { status: 404 });
	if (doc.status === 'completed') {
		return json({ ok: true, status: 'completed', note: 'already_confirmed' });
	}
	if (doc.status !== 'pending') {
		return json({ ok: false, error: 'not_pending', status: doc.status }, { status: 409 });
	}

	// Đối soát amount nếu webhook gửi.
	const amountRaw = map('amount');
	if (amountRaw !== undefined && amountRaw !== null && String(amountRaw) !== '') {
		const amount = Number(amountRaw);
		const expect = Number(doc.amount ?? 0);
		if (Number.isFinite(amount) && expect > 0 && amount !== expect) {
			return json({ ok: false, error: 'amount_mismatch', expected: expect, received: amount }, { status: 409 });
		}
	}

	// Confirm TRỰC TIẾP bằng conditional transition pending → completed (cùng
	// đường ống với QrPaymentService.checkAndConfirm — KHÔNG hỏi tool ngoài vì
	// webhook là chiều tool BÁO kết quả vào app).
	const reference = String(map('reference') ?? '') || paymentCode;
	const now = new Date().toISOString();
	const paidAt = String(map('paidAt') ?? '') || now;
	const note = `[${now}] QR webhook confirm (external tool)`;
	const updated = await cbPayments.document.query({
		statement: `
			UPDATE ${paymentsKeyspace} p
			SET status = 'completed', notes = $2, processedBy = 'qr-webhook',
			    transactionReference = $3, completedAt = $4
			WHERE META(p).id = $1 AND p.status = 'pending'
			RETURNING p.*
		`.trim(),
		args: [doc._id as string, note, reference, paidAt],
		readonly: false
	});
	if (!updated.ok) return json({ ok: false, error: 'confirm_failed' }, { status: 500 });

	// results rỗng = đã bị confirm đồng thời (race) — vẫn coi thành công.
	const row = (updated.data?.results?.[0] ?? null) as Record<string, unknown> | null;
	if (row?.orderId) {
		try {
			await cbOrders.document.query({
				statement: `UPDATE ${ordersKeyspace} SET paymentStatus = 'paid', updatedAt = $2 WHERE META().id = $1 AND (paymentStatus IS MISSING OR paymentStatus != 'paid')`,
				args: [row.orderId, now],
				readonly: false
			});
		} catch {
			// best-effort
		}
	}
	return json({ ok: true, status: 'completed' });
};
