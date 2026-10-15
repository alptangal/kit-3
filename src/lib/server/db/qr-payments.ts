// $lib/server/db/qr-payments.ts
// QrPaymentService — thanh toán QR + TỰ ĐỘNG xác nhận giao dịch qua tool
// kiểm tra giao dịch bên ngoài (tool Python của user, config-driven adapter).
//
// Flow:
// 1. Khi tạo order (POS + storefront) với paymentMethod QR (momo/zalopay/bank_transfer)
//    → tạo payment doc status 'pending' + QR payload (chứa nội dung chuyển khoản
//    ĐỘC NHẤN theo paymentCode) → client render QR.
// 2. Adapter gọi tool đối soát: đọc config từ env ($env/dynamic/private) →
//    fetch tool URL → parse response theo RESPONSE_MAP (JSON path configurable vì
//    format tool chưa biết) → nếu "success" → transition pending → completed
//    (conditional N1QL: CHỈ từ pending, không bao giờ ngược completed → pending)
//    + cập nhật order.paymentStatus = 'paid' + ghi transactionReference từ tool.
// 3. Auto polling: interval quét các payment pending có method QR, check từng cái
//    (bật qua env QR_CHECKER_AUTO_POLL=true).
//
// Config env (user điền SAU, mọi field đều có default hợp lý):
//   QR_CHECKER_URL            — URL endpoint tool Python (bắt buộc để check chạy)
//   QR_CHECKER_AUTH           — giá trị header Authorization (tuỳ chọn)
//   QR_CHECKER_AUTH_HEADER    — tên header auth (mặc định 'Authorization')
//   QR_CHECKER_METHOD         — GET | POST (mặc định GET)
//   QR_CHECKER_QUERY_FIELD    — tên param gửi mã giao dịch (mặc định 'id')
//   QR_CHECKER_RESPONSE_MAP   — JSON mapping path trong response tool:
//       { "status": "data.status", "amount": "data.amount",
//         "paidAt": "data.paidAt", "reference": "data.reference" }
//   QR_CHECKER_SUCCESS_VALUE  — giá trị status coi là thành công (mặc định 'SUCCESS')
//   QR_CHECKER_SUCCESS_VALUES — JSON array giá trị success (vd '["00","SUCCESS"]'),
//                               ưu tiên hơn SUCCESS_VALUE nếu có
//   QR_CHECKER_CONTENT_FIELD  — tên trường trong response chứa NỘI DUNG chuyển khoản
//                               (để match paymentCode khi tool không trả status per-id)
//   QR_CHECKER_AUTO_POLL      — 'true' bật auto polling
//   QR_CHECKER_POLL_INTERVAL_MS — chu kỳ poll (mặc định 30000, tối thiểu 10000)
//   QR_CHECKER_POLL_BATCH     — số payment tối đa mỗi lần poll (mặc định 20)

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { cbData } from '$modules/couchbase/clients';
import { broadcastDbChange } from '$lib/server/db-broadcast';

const cbPayments = cbData('payments');
const cbOrders = cbData('orders');
const paymentsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`payments\``;
const ordersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`orders\``;

/**
 * Phương thức thanh toán hiển thị QR cho khách quét.
 * Gồm CẢ giá trị schema (e_wallet) vì POS map momo/zalopay → 'e_wallet'
 * khi lưu payment (PAYMENT_METHOD_MAP), còn storefront lưu method thô
 * (momo/zalopay) — poll phải bắt cả hai nhóm.
 */
export const QR_PAYMENT_METHODS = ['momo', 'zalopay', 'bank_transfer', 'e_wallet'] as const;

export function isQrPaymentMethod(method: string): boolean {
	return (QR_PAYMENT_METHODS as readonly string[]).includes(method);
}

const qrMessages: Record<string, TranslateContent> = {
	notFound: { vi: 'Không tìm thấy thanh toán', en: 'Payment not found' },
	toolNotConfigured: {
		vi: 'Chưa cấu hình công cụ kiểm tra giao dịch (QR_CHECKER_URL)',
		en: 'Transaction checker tool is not configured (QR_CHECKER_URL)'
	},
	checkFailed: { vi: 'Kiểm tra giao dịch thất bại', en: 'Transaction check failed' },
	stillPending: { vi: 'Giao dịch chưa được xác nhận (chưa thấy tiền)', en: 'Transaction not confirmed yet' },
	confirmed: { vi: 'Giao dịch đã được xác nhận thành công', en: 'Transaction confirmed successfully' },
	amountMismatch: {
		vi: 'Số tiền giao dịch không khớp với thanh toán',
		en: 'Transaction amount does not match payment'
	}
};

/** Cấu hình adapter — đọc từ env mỗi lần check (đổi .env không cần restart code path). */
export interface QrCheckerConfig {
	url?: string;
	auth?: string;
	authHeader: string;
	method: 'GET' | 'POST';
	queryField: string;
	responseMap: { status?: string; amount?: string; paidAt?: string; reference?: string; content?: string };
	successValues: string[];
	contentField?: string;
	autoPoll: boolean;
	pollIntervalMs: number;
	pollBatch: number;
}

export function readQrCheckerConfig(): QrCheckerConfig {
	let responseMap: QrCheckerConfig['responseMap'] = {};
	try {
		if (env.QR_CHECKER_RESPONSE_MAP) {
			responseMap = JSON.parse(env.QR_CHECKER_RESPONSE_MAP) as QrCheckerConfig['responseMap'];
		}
	} catch {
		console.error('[QrPaymentService] QR_CHECKER_RESPONSE_MAP is not valid JSON — using empty map');
	}

	let successValues = ['SUCCESS'];
	try {
		if (env.QR_CHECKER_SUCCESS_VALUES) {
			const parsed = JSON.parse(env.QR_CHECKER_SUCCESS_VALUES);
			if (Array.isArray(parsed) && parsed.length) {
				successValues = parsed.map((v) => String(v));
			}
		}
	} catch {
		console.error('[QrPaymentService] QR_CHECKER_SUCCESS_VALUES is not valid JSON array — fallback SUCCESS_VALUE');
	}
	if (successValues.length === 1 && successValues[0] === 'SUCCESS' && env.QR_CHECKER_SUCCESS_VALUE) {
		successValues = [env.QR_CHECKER_SUCCESS_VALUE];
	}

	const intervalRaw = Number(env.QR_CHECKER_POLL_INTERVAL_MS ?? 30000);
	const interval = Number.isFinite(intervalRaw) ? Math.max(10_000, intervalRaw) : 30_000;
	const batchRaw = Number(env.QR_CHECKER_POLL_BATCH ?? 20);
	const batch = Number.isFinite(batchRaw) ? Math.min(50, Math.max(1, batchRaw)) : 20;

	return {
		url: env.QR_CHECKER_URL || undefined,
		auth: env.QR_CHECKER_AUTH || undefined,
		authHeader: env.QR_CHECKER_AUTH_HEADER || 'Authorization',
		method: (env.QR_CHECKER_METHOD ?? 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET',
		queryField: env.QR_CHECKER_QUERY_FIELD || 'id',
		responseMap,
		successValues,
		contentField: env.QR_CHECKER_CONTENT_FIELD || undefined,
		autoPoll: env.QR_CHECKER_AUTO_POLL === 'true',
		pollIntervalMs: interval,
		pollBatch: batch
	};
}

/** Đọc giá trị theo JSON path "a.b.c" (mảng hỗ trợ "a.0.b"). */
function getPath(obj: unknown, path: string): unknown {
	if (!path) return undefined;
	let current: unknown = obj;
	for (const part of path.split('.')) {
		if (current === null || current === undefined) return undefined;
		if (Array.isArray(current)) {
			const idx = Number(part);
			current = Number.isInteger(idx) ? current[idx] : undefined;
		} else if (typeof current === 'object') {
			current = (current as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}
	return current;
}

export interface QrCheckerResult {
	/** 'success' = tool báo giao dịch thành công; 'pending' = chưa thấy/chưa thành công. */
	verdict: 'success' | 'pending';
	amount?: number;
	paidAt?: string;
	reference?: string;
}

interface PaymentDocument {
	_id: string;
	orderId: string;
	paymentCode: string;
	method: string;
	amount: number;
	status: string;
	transactionReference?: string;
	notes?: string;
	processedBy?: string;
	createdAt: string;
}

export function buildQrPayload(paymentCode: string, amount: number, orderCode?: string): string {
	const parts = [`Ma thanh toan: ${paymentCode}`];
	if (orderCode) parts.push(`Don hang: ${orderCode}`);
	parts.push(`So tien: ${amount}`);
	return parts.join(' | ');
}

export const QrPaymentService = {
	/**
	 * Sinh dữ liệu QR cho 1 payment pending (gọi khi tạo order với method QR).
	 * Trả payload text + data URL PNG để render trực tiếp <img src>.
	 */
	async generateQr(
		paymentCode: string,
		amount: number,
		orderCode?: string
	): Promise<{ payload: string; dataUrl: string }> {
		const payload = buildQrPayload(paymentCode, amount, orderCode);
		try {
			const { default: QRCode } = await import('qrcode');
			const dataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
			return { payload, dataUrl };
		} catch (e) {
			// QR render lỗi (hiếm) — vẫn trả payload text để client fallback render QR client-side.
			console.error('[QrPaymentService.generateQr] render failed', e);
			return { payload, dataUrl: '' };
		}
	},

	/**
	 * Gọi tool đối soát cho 1 mã giao dịch (paymentCode) — parse theo config.
	 * KHÔNG đụng DB. Throw nếu tool lỗi/config sai; trả verdict 'pending' nếu
	 * tool trả lời bình thường nhưng chưa thấy giao dịch thành công.
	 */
	async callChecker(paymentCode: string, config: QrCheckerConfig): Promise<QrCheckerResult> {
		if (!config.url) {
			throw new Error('QR_CHECKER_URL_NOT_CONFIGURED');
		}

		let response: Response;
		if (config.method === 'POST') {
			response = await fetch(config.url, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					...(config.auth ? { [config.authHeader]: config.auth } : {})
				},
				body: JSON.stringify({ [config.queryField]: paymentCode })
			});
		} else {
			const url = new URL(config.url);
			url.searchParams.set(config.queryField, paymentCode);
			response = await fetch(url, {
				method: 'GET',
				headers: config.auth ? { [config.authHeader]: config.auth } : undefined
			});
		}

		if (!response.ok) {
			throw new Error(`QR_CHECKER_HTTP_${response.status}`);
		}

		let body: unknown;
		try {
			// Đọc text MỘT LẦN rồi tự JSON.parse — body stream chỉ consume được một
			// lần, gọi .json() trước rồi .text() fallback sẽ luôn throw "body used".
			const text = await response.text();
			try {
				body = JSON.parse(text);
			} catch {
				// Tool trả text thuần (không JSON) — coi nội dung text là "status"
				body = { raw: text.trim() };
				// cho phép map tới 'raw'
				if (!config.responseMap.status && !config.contentField) {
					config.responseMap = { ...config.responseMap, status: 'raw' };
				}
			}
		} catch {
			throw new Error('QR_CHECKER_EMPTY_BODY');
		}

		const statusRaw = config.responseMap.status ? getPath(body, config.responseMap.status) : undefined;
		const status = statusRaw === undefined || statusRaw === null ? '' : String(statusRaw).trim();

		// Content-field mode: tool trả log/danh sách giao dịch — match paymentCode
		// xuất hiện trong nội dung (nội dung chuyển khoản chứa paymentCode độc nhất).
		if (config.contentField) {
			const content = String(getPath(body, config.contentField) ?? '');
			if (content && content.includes(paymentCode)) {
				// có giao dịch khớp nội dung → coi như thành công nếu status trống hoặc khớp success
				if (!status || config.successValues.includes(status)) {
					return {
						verdict: 'success',
						amount: config.responseMap.amount ? Number(getPath(body, config.responseMap.amount)) || undefined : undefined,
						paidAt: config.responseMap.paidAt ? String(getPath(body, config.responseMap.paidAt) ?? '') || undefined : undefined,
						reference: config.responseMap.reference ? String(getPath(body, config.responseMap.reference) ?? '') || undefined : undefined
					};
				}
			}
			return { verdict: 'pending' };
		}

		const success = config.successValues.includes(status);
		if (!success) {
			return { verdict: 'pending' };
		}

		return {
			verdict: 'success',
			amount: config.responseMap.amount ? Number(getPath(body, config.responseMap.amount)) || undefined : undefined,
			paidAt: config.responseMap.paidAt ? String(getPath(body, config.responseMap.paidAt) ?? '') || undefined : undefined,
			reference: config.responseMap.reference ? String(getPath(body, config.responseMap.reference) ?? '') || undefined : undefined
		};
	},

	/**
	 * Check + auto-confirm 1 payment (theo paymentCode).
	 * Conditional transition: chỉ pending → completed (UPDATE ... WHERE status = 'pending').
	 * Sau khi completed: cập nhật order.paymentStatus = 'paid' + ghi transactionReference
	 * từ tool (nếu có). Không bao giờ transition ngược.
	 */
	async checkAndConfirm(
		paymentCode: string,
		options?: { actorId?: string; amountMismatchTolerant?: boolean }
	): Promise<
		| { success: true; status: 'completed' | 'pending'; payment?: Record<string, unknown>; messages: TranslateContent }
		| { success: false; messages: TranslateContent }
	> {
		const config = readQrCheckerConfig();
		const lookup = await cbPayments.document.query({
			statement: `SELECT p.*, META().id AS _id FROM ${paymentsKeyspace} p WHERE p.paymentCode = $1 LIMIT 1`,
			args: [paymentCode],
			readonly: true
		});
		if (!lookup.ok) return { success: false, messages: qrMessages.checkFailed };
		const doc = (lookup.data?.results?.[0] ?? null) as PaymentDocument | null;
		if (!doc) return { success: false, messages: qrMessages.notFound };

		// Đã completed/refunded/failed → trả trạng thái hiện tại, không gọi tool nữa.
		if (doc.status !== 'pending') {
			return { success: true, status: doc.status === 'completed' ? 'completed' : 'pending', payment: doc as unknown as Record<string, unknown>, messages: doc.status === 'completed' ? qrMessages.confirmed : qrMessages.stillPending };
		}

		let result: QrCheckerResult;
		try {
			result = await this.callChecker(doc.paymentCode, config);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (msg === 'QR_CHECKER_URL_NOT_CONFIGURED') return { success: false, messages: qrMessages.toolNotConfigured };
			console.error('[QrPaymentService.checkAndConfirm] checker call failed', msg);
			return { success: false, messages: qrMessages.checkFailed };
		}

		if (result.verdict !== 'success') {
			return { success: true, status: 'pending', messages: qrMessages.stillPending };
		}

		// Đối soát số tiền nếu tool trả amount (khớp mới confirm — chống tool report sai).
		const expect = Number(doc.amount ?? 0);
		if (result.amount !== undefined && expect > 0 && result.amount !== expect && !options?.amountMismatchTolerant) {
			console.warn('[QrPaymentService.checkAndConfirm] amount mismatch', doc.paymentCode, result.amount, '!=', expect);
			return { success: false, messages: qrMessages.amountMismatch };
		}

		// Conditional transition: CHỈ pending → completed.
		const now = new Date().toISOString();
		const confirmNote = `[${now}] QR auto-confirm qua tool đối soát${options?.actorId ? ` (${options.actorId})` : ''}`;
		const updatedNotes = doc.notes ? `${doc.notes}\n${confirmNote}` : confirmNote;
		const newReference = result.reference ?? doc.transactionReference;

		const update = await cbPayments.document.query({
			statement: `
				UPDATE ${paymentsKeyspace} p
				SET status = 'completed', notes = $2, processedBy = $3,
				    transactionReference = $4, completedAt = $5
				WHERE META(p).id = $1 AND p.status = 'pending'
				RETURNING p.*
			`.trim(),
			args: [doc._id, updatedNotes, options?.actorId ?? 'qr-auto', newReference ?? null, result.paidAt ?? now],
			readonly: false
		});
		if (!update.ok) return { success: false, messages: qrMessages.checkFailed };
		const updated = (update.data?.results?.[0] ?? null) as PaymentDocument | null;

		// results rỗng = đã bị confirm đồng thời (race) — vẫn coi là success-pending.
		if (!updated) {
			return { success: true, status: 'completed', messages: qrMessages.confirmed };
		}

		// Đơn liên quan → paymentStatus 'paid' (best-effort).
		if (updated.orderId) {
			try {
				await cbOrders.document.query({
					statement: `UPDATE ${ordersKeyspace} SET paymentStatus = 'paid', updatedAt = $2 WHERE META().id = $1 AND (paymentStatus IS MISSING OR paymentStatus != 'paid')`,
					args: [updated.orderId, now],
					readonly: false
				});
				void broadcastDbChange({ collection: 'orders', action: 'update' });
			} catch (e) {
				console.error('[QrPaymentService.checkAndConfirm] order paymentStatus update failed', updated.orderId, e);
			}
		}

		return { success: true, status: 'completed', payment: updated as unknown as Record<string, unknown>, messages: qrMessages.confirmed };
	},

	/**
	 * Auto polling 1 lượt: quét các payment pending có method QR → checkAndConfirm
	 * từng cái. Trả số payment đã confirm. Batch tối đa config.pollBatch.
	 */
	async pollPendingOnce(): Promise<number> {
		const config = readQrCheckerConfig();
		if (!config.url) return 0;

		const methodArgs = QR_PAYMENT_METHODS as readonly string[];
		const inClause = methodArgs.map((_, i) => `$${i + 1}`).join(', ');
		const query = await cbPayments.document.query({
			statement: `
				SELECT p.paymentCode
				FROM ${paymentsKeyspace} p
				WHERE p.status = 'pending' AND p.method IN [${inClause}]
				ORDER BY p.createdAt ASC
				LIMIT $${methodArgs.length + 1}
			`.trim(),
			args: [...methodArgs, config.pollBatch],
			readonly: true
		});
		if (!query.ok) {
			console.error('[QrPaymentService.pollPendingOnce] query failed');
			return 0;
		}

		const codes = (query.data?.results ?? []) as Array<{ paymentCode?: string }>;
		let confirmed = 0;
		for (const row of codes) {
			if (!row.paymentCode) continue;
			try {
				const res = await this.checkAndConfirm(row.paymentCode);
				if (res.success && res.status === 'completed') {
					confirmed += 1;
					console.log(`[QrPaymentService.poll] auto-confirmed ${row.paymentCode}`);
				}
			} catch (e) {
				console.error('[QrPaymentService.poll] check failed', row.paymentCode, e);
			}
		}
		return confirmed;
	},

	/**
	 * Khởi động auto polling (chỉ khi QR_CHECKER_AUTO_POLL=true).
	 * setInterval trong module scope — guard bằng globalThis để chống double-start
	 * khi Vite SSR hot-reload module (mỗi reload tạo scope mới).
	 * Trả interval id (hoặc undefined nếu không bật).
	 */
	startAutoPolling(): NodeJS.Timeout | undefined {
		const config = readQrCheckerConfig();
		if (!config.autoPoll || !config.url) {
			if (config.autoPoll && !config.url) {
				console.warn('[QrPaymentService] QR_CHECKER_AUTO_POLL=true but QR_CHECKER_URL missing — polling disabled');
			}
			return undefined;
		}

		const g = globalThis as { __qrPaymentPollTimer?: NodeJS.Timeout };
		if (g.__qrPaymentPollTimer) return g.__qrPaymentPollTimer;

		const timer = setInterval(() => {
			void this.pollPendingOnce().catch((e) =>
				console.error('[QrPaymentService] auto poll error', e)
			);
		}, config.pollIntervalMs);
		timer.unref?.();
		g.__qrPaymentPollTimer = timer;
		console.log(`[QrPaymentService] auto polling started (every ${config.pollIntervalMs}ms, batch ${config.pollBatch})`);
		return timer;
	},

	/** Dừng auto polling (dùng khi cần cleanup). */
	stopAutoPolling(): void {
		const g = globalThis as { __qrPaymentPollTimer?: NodeJS.Timeout };
		if (g.__qrPaymentPollTimer) {
			clearInterval(g.__qrPaymentPollTimer);
			g.__qrPaymentPollTimer = undefined;
		}
	}
};
