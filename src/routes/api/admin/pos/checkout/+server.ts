// src/routes/api/admin/pos/checkout/+server.ts
// POS terminal checkout: validate stock -> create order (paid/pos) -> deduct stock
// -> create completed payment -> update session totals when sessionId given.
// V2: hỗ trợ chia tiền nhiều phương thức (payments[] mỗi line 1 payment doc),
// giảm giá từng dòng (lineDiscount), giảm giá cả đơn theo số tiền
// (orderDiscountAmount, song song customerDiscount %), customerId + notes.
// Flow cũ (paymentMethod + cashReceived đơn method) giữ nguyên tương thích.
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import {
	readAdminRequest,
	respondEncrypted,
	getActorContext,
	statusForServiceFailure
} from '$lib/server/admin/api';
import { broadcastDbChange } from '$lib/server/db-broadcast';
import { cbData } from '$modules/couchbase/clients';
import { POSService } from '$lib/server/db/pos';
import { InventoryService } from '$lib/server/db/inventory';
import { QrPaymentService, isQrPaymentMethod } from '$lib/server/db/qr-payments';
import { SerialService } from '$lib/server/db/serials';

const cbOrders = cbData('orders');
const cbPayments = cbData('payments');
const cbVariants = cbData('product_variants');
const cbUsers = cbData('users');

/** POS payment method (VALID_PAYMENT_METHODS trong checkout.ts) -> schema payments
 *  method ('cash'|'credit_card'|'bank_transfer'|'e_wallet'|'loyalty_points'). */
const PAYMENT_METHOD_MAP: Record<string, string> = {
	cash: 'cash',
	bank_pos: 'credit_card',
	momo: 'e_wallet',
	zalopay: 'e_wallet',
	bank_transfer: 'bank_transfer',
	cod: 'cash',
	loyalty_points: 'loyalty_points'
};

interface CheckoutItem {
	variantId: string;
	quantity: number;
	unitPrice?: number;
	/** Giảm giá cả dòng (VND) — trừ vào price*quantity. */
	lineDiscount?: number;
	/** Serial/IMEI (variant trackSerial): danh sách mã bán — mỗi chiếc 1 mã.
	 *  Bắt buộc khi variant trackSerial, số lượng phải bằng quantity. */
	serials?: string[];
	/** Đơn vị bán (P2): index trong variant.units — undefined/0 = base. */
	unitIndex?: number;
	/** Hệ số quy đổi client gửi kèm (1 đơn vị bán = unitFactor đơn vị base).
	 *  Backend ưu tiên units từ doc variant (chống client gửi factor sai). */
	unitFactor?: number;
}

interface PaymentInput {
	method?: string;
	amount?: number;
	cashReceived?: number;
}

/** Payment sau chuẩn hoá — mỗi line tạo 1 payment doc. */
interface NormalizedPayment {
	method: string;
	amount: number;
	cashReceived?: number;
}

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			items: CheckoutItem[];
			paymentMethod: string;
			payments?: PaymentInput[];
			sessionId?: string;
			branchId?: string;
			cashReceived?: number;
			customerDiscount?: number;
			orderDiscountAmount?: number;
			customerId?: string;
			notes?: string;
		}>(event);
		if (!read.ok) return read.response;
		const { lang, publicKeyB64 } = read;

		const respond = (payload: Parameters<typeof respondEncrypted>[1], status = 200) =>
			respondEncrypted(publicKeyB64, payload, lang, status);

		const actor = await getActorContext(locals);
		if (!actor) {
			return respond(
				{ ok: false, message: { vi: 'Phiên đăng nhập đã hết hạn', en: 'Session expired' } },
				401
			);
		}

		const data = read.data;
		const branchId = data.branchId || actor.branchId || undefined;
		const items = Array.isArray(data.items) ? data.items : [];
		if (items.length === 0) {
			return respond(
				{ ok: false, message: { vi: 'Giỏ hàng trống', en: 'Cart is empty' } },
				400
			);
		}
		const customerDiscount =
			typeof data.customerDiscount === 'number' && data.customerDiscount > 0
				? Math.min(data.customerDiscount, 100)
				: 0;

		// ── Validate items: variant active + enough stock at branch ──
		const validated: Array<{ variantId: string; quantity: number; baseQuantity: number; price: number; lineDiscount: number; serials: string[]; unitName?: string; unitIndex: number }> = [];
		let totalAmount = 0;
		for (const item of items) {
			const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0));
			if (!item.variantId || quantity < 1) {
				return respond(
					{ ok: false, message: { vi: 'Sản phẩm trong giỏ không hợp lệ', en: 'Invalid cart item' } },
					400
				);
			}
			const variantRes = await cbVariants.document.get({ documentKey: item.variantId });
			if (!variantRes.ok || !variantRes.data) {
				return respond(
					{ ok: false, message: { vi: 'Không tìm thấy biến thể', en: 'Variant not found' } },
					404
				);
			}
			const variant = variantRes.data as {
				price?: number;
				status?: string;
				deletedAt?: string | null;
				trackSerial?: boolean;
				units?: Array<{ name?: string; factor?: number; price?: number | null }> | null;
			};
			if (variant.status !== 'active' || variant.deletedAt) {
				return respond(
					{
						ok: false,
						message: { vi: 'Biến thể không còn hoạt động', en: 'Variant is not active' }
					},
					400
				);
			}
			// ── Đơn vị quy đổi (P2): trừ tồn theo ĐƠN VỊ BASE ──
			// factor lấy từ doc variant (nguồn sự thật) — client chỉ gửi index.
			const unitIndexRaw = Math.max(0, Math.floor(Number(item.unitIndex) || 0));
			const variantUnits = Array.isArray(variant.units) ? variant.units : [];
			const unit = unitIndexRaw > 0 ? variantUnits[unitIndexRaw] : undefined;
			const unitFactor =
				unit && unitIndexRaw > 0
					? Math.max(1, Math.floor(Number(unit.factor) || 1))
					: 1;
			const unitName =
				unit && unitIndexRaw > 0 && unit.name ? String(unit.name) : undefined;
			// Số lượng quy đổi về base: 2 thùng × 24 = 48 chai trừ khỏi kho.
			const baseQuantity = quantity * unitFactor;
			const price = Number(
				item.unitPrice ?? variant.price ?? 0
			) >= 0
				? Number(item.unitPrice ?? variant.price ?? 0)
				: 0;
			if (!branchId) {
				return respond(
					{
						ok: false,
						message: {
							vi: 'Không xác định được chi nhánh để trừ tồn kho',
							en: 'Cannot determine branch for stock deduction'
						}
					},
					400
				);
			}
			const stockRes = await InventoryService.getStock(actor, item.variantId, branchId);
			if (!stockRes.success) {
				return respond(
					{ ok: false, message: stockRes.messages },
					statusForServiceFailure(stockRes.messages)
				);
			}
			const onHand =
				(stockRes.stock as { quantityOnHand?: number } | undefined)?.quantityOnHand ?? 0;
			if (onHand < baseQuantity) {
				return respond(
					{
						ok: false,
						message: {
							vi: `Tồn kho không đủ cho biến thể (còn ${onHand})`,
							en: `Insufficient stock for variant (${onHand} left)`
						}
					},
					409
				);
			}
			// ── Serial/IMEI (variant trackSerial): BẮT BUỘC chọn serial cụ thể ──
			// Số serial phải đúng bằng quantity; mỗi serial phải đang 'in_stock' tại branch.
			// Validate ở ĐÂY (trước tạo order) — markSold chạy SAU khi tạo order thành công.
			let itemSerials: string[] = [];
			if (variant.trackSerial) {
				const rawSerials = Array.isArray(item.serials) ? item.serials : [];
				itemSerials = Array.from(
					new Set(rawSerials.map((s) => String(s ?? '').trim().toUpperCase()).filter(Boolean))
				);
				if (itemSerials.length === 0) {
					return respond(
						{
							ok: false,
							message: {
								vi: 'Sản phẩm này cần chọn số serial cụ thể để bán',
								en: 'This product requires selecting serial numbers to sell'
							}
						},
						400
					);
				}
				if (itemSerials.length !== quantity) {
					return respond(
						{
							ok: false,
							message: {
								vi: `Số serial (${itemSerials.length}) phải bằng số lượng bán (${quantity})`,
								en: `Serial count (${itemSerials.length}) must match sold quantity (${quantity})`
							}
						},
						400
					);
				}
			}

			// Giảm giá cả dòng — clamp 0..price*quantity để tổng không âm.
			const lineDiscount = Math.min(
				Math.max(0, Math.round(Number(item.lineDiscount) || 0)),
				price * quantity
			);
			validated.push({
				variantId: item.variantId,
				quantity,
				baseQuantity,
				price,
				lineDiscount,
				serials: itemSerials,
				unitName,
				unitIndex: unitIndexRaw
			});
			totalAmount += price * quantity - lineDiscount;
		}

		// ── Serial/IMEI: xác nhận mọi serial đang 'in_stock' tại branch (1 query batch IN) ──
		// Chạy TRƯỚC tạo order — phát hiện sớm serial đã bán/đổi trạng thái (race 2 quầy).
		const allSerials = validated.flatMap((v) => v.serials);
		if (allSerials.length > 0 && branchId) {
			const inStockRes = await SerialService.listInStockForVariant(actor, validated[0].variantId, branchId);
			// Fallback per-variant: nếu giỏ có nhiều variant trackSerial thì query từng variant
			const inStockByVariant = new Map<string, Set<string>>();
			const trackSerialVariants = Array.from(new Set(validated.filter((v) => v.serials.length > 0).map((v) => v.variantId)));
			for (const vid of trackSerialVariants) {
				const res = vid === validated[0].variantId && inStockRes.success
					? inStockRes
					: await SerialService.listInStockForVariant(actor, vid, branchId);
				if (res.success) {
					inStockByVariant.set(
						vid,
						new Set(res.items.map((s) => String((s as { serial?: string }).serial ?? '').toUpperCase()))
					);
				}
			}
			for (const v of validated) {
				if (v.serials.length === 0) continue;
				const available = inStockByVariant.get(v.variantId);
				// Query thất bại (lỗi hạ tầng) → bỏ qua pre-check, markSold sau đó vẫn chặn (N1QL điều kiện status)
				if (!available) continue;
				const missing = v.serials.filter((s) => !available.has(s));
				if (missing.length > 0) {
					return respond(
						{
							ok: false,
							message: {
								vi: `Serial không còn tồn trong kho: ${missing.join(', ')}`,
								en: `Serials no longer in stock: ${missing.join(', ')}`
							}
						},
						409
					);
				}
			}
		}

		// ── Discount: % khách hàng + số tiền cả đơn (VND) ──
		const percentOff = Math.round((totalAmount * customerDiscount) / 100);
		const amountOff = Math.min(
			Math.max(0, Math.round(Number(data.orderDiscountAmount) || 0)),
			Math.max(0, totalAmount - percentOff)
		);
		const discountAmount = percentOff + amountOff;
		const payableAmount = Math.max(0, totalAmount - discountAmount);

		// ── Chuẩn hoá payments: mảng chia tiền (V2) hoặc 1 method cũ ──
		let normalizedPayments: NormalizedPayment[];
		const rawPayments = Array.isArray(data.payments) ? data.payments : [];
		if (rawPayments.length > 0) {
			normalizedPayments = [];
			let sum = 0;
			for (const p of rawPayments) {
				const method = String(p?.method ?? '');
				if (!PAYMENT_METHOD_MAP[method]) {
					return respond(
						{
							ok: false,
							message: { vi: 'Phương thức thanh toán không hợp lệ', en: 'Invalid payment method' }
						},
						400
					);
				}
				const amount = Math.round(Number(p?.amount));
				// Đơn 0đ (giỏ giá 0): cho phép duy nhất 1 dòng amount 0 khi payable = 0
				// — giữ tương thích flow cũ một method/đơn giá 0.
				const allowZero = payableAmount === 0 && rawPayments.length === 1;
				if (!Number.isFinite(amount) || amount < 0 || (amount === 0 && !allowZero)) {
					return respond(
						{
							ok: false,
							message: {
								vi: 'Số tiền từng phương thức phải lớn hơn 0',
								en: 'Each payment amount must be greater than 0'
							}
						},
						400
					);
				}
				const cashReceived =
					p?.cashReceived !== undefined && p?.cashReceived !== null
						? Number(p.cashReceived)
						: undefined;
				if (method === 'cash' && cashReceived !== undefined && cashReceived < amount) {
					return respond(
						{
							ok: false,
							message: {
								vi: 'Tiền khách đưa nhỏ hơn số tiền phương thức tiền mặt',
								en: 'Cash received is less than the cash method amount'
							}
						},
						400
					);
				}
				normalizedPayments.push({ method, amount, cashReceived });
				sum += amount;
			}
			if (sum !== payableAmount) {
				return respond(
					{
						ok: false,
						message: {
							vi: `Tổng các phương thức (${sum}) phải bằng số tiền cần thu (${payableAmount})`,
							en: `Sum of payment methods (${sum}) must equal the payable amount (${payableAmount})`
						}
					},
					400
				);
			}
		} else {
			const paymentMethod = data.paymentMethod ?? 'cash';
			if (!PAYMENT_METHOD_MAP[paymentMethod]) {
				return respond(
					{
						ok: false,
						message: { vi: 'Phương thức thanh toán không hợp lệ', en: 'Invalid payment method' }
					},
					400
				);
			}
			const cashReceived =
				typeof data.cashReceived === 'number' ? Number(data.cashReceived) : undefined;
			if (paymentMethod === 'cash') {
				if (!Number.isFinite(cashReceived) || (cashReceived as number) < payableAmount) {
					return respond(
						{
							ok: false,
							message: {
								vi: 'Tiền khách đưa nhỏ hơn tổng tiền cần thanh toán',
								en: 'Cash received is less than the payable amount'
							}
						},
						400
					);
				}
			}
			normalizedPayments = [{ method: paymentMethod, amount: payableAmount, cashReceived }];
		}

		// ── Customer (optional): phải là role-customer, chưa xoá ──
		let customerId: string | null = null;
		if (data.customerId) {
			const customerRes = await cbUsers.document.get({ documentKey: data.customerId });
			if (!customerRes.ok || !customerRes.data) {
				return respond(
					{ ok: false, message: { vi: 'Khách hàng không hợp lệ', en: 'Invalid customer' } },
					400
				);
			}
			const customer = customerRes.data as { roleId?: string; deletedAt?: string | null };
			if (customer.roleId !== 'role-customer' || customer.deletedAt) {
				return respond(
					{ ok: false, message: { vi: 'Khách hàng không hợp lệ', en: 'Invalid customer' } },
					400
				);
			}
			customerId = data.customerId;
		}

		// ── Create order: status paid, channel pos ──
		const now = new Date().toISOString();
		const documentKey = `order::${crypto.randomUUID()}`;
		const datePart = now.slice(0, 10).replace(/-/g, '');
		const orderCode = `ORD-${datePart}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

		const orderDoc = {
			orderCode,
			customerId,
			staffId: actor.userId,
			branchId: branchId ?? null,
			status: 'paid',
			channel: 'pos',
			items: validated.map((v) => ({
				variantId: v.variantId,
				lotId: undefined,
				quantity: v.quantity,
				price: v.price,
				discount: v.lineDiscount,
				// Serial/IMEI bán kèm — truy vết từng chiếc về đơn (serial_numbers.orderId cũng ghi)
				serials: v.serials.length > 0 ? v.serials : undefined,
				// Đơn vị bán (P2): unitIndex trong variant.units + hệ số đã dùng khi trừ kho
				unitIndex: v.unitIndex > 0 ? v.unitIndex : undefined,
				unitFactor: v.unitIndex > 0 ? Math.round(v.baseQuantity / v.quantity) : undefined,
				unitName: v.unitName
			})),
			totalAmount: payableAmount,
			discountAmount,
			notes: data.notes?.trim() ? data.notes.trim() : undefined,
			createdAt: now,
			updatedAt: now
		};

		const orderRes = await cbOrders.document.create({ documentKey, content: orderDoc });
		if (!orderRes.ok) {
			return respond(
				{ ok: false, message: { vi: 'Tạo đơn hàng không thành công', en: 'Failed to create order' } },
				500
			);
		}

		// ── Deduct stock + record stock movements ──
		// Trừ theo QUY ĐỔI BASE: 1 thùng (factor 24) → trừ 24 chai (baseQuantity).
		for (const item of validated) {
			const adjustRes = await InventoryService.adjustStock(
				actor,
				item.variantId,
				branchId as string,
				-item.baseQuantity,
				'sale',
				documentKey,
				actor.userId,
				`POS sale ${orderCode}`
			);
			if (!adjustRes.success) {
				// Order đã tạo nhưng trừ tồn thất bại — trả lỗi để biết, KHÔNG rollback (POS thực tế
				// đã validate tồn kho ở trên; thất bại chỉ xảy ra khi có race/giám sát khác).
				return respond(
					{ ok: false, message: adjustRes.messages },
					statusForServiceFailure(adjustRes.messages)
				);
			}
		}

		// ── Serial/IMEI: chuyển status 'sold' + orderId (N1QL điều kiện status='in_stock'
		// chống race — serial mất giữa chừng → trả lỗi, order vẫn giữ (đã trừ tồn)) ──
		for (const item of validated) {
			if (item.serials.length === 0 || !branchId) continue;
			const markRes = await SerialService.markSold({
				variantId: item.variantId,
				serials: item.serials,
				branchId: branchId as string,
				orderId: documentKey,
				now
			});
			if (!markRes.success) {
				console.error(`[POST /api/admin/pos/checkout] markSold failed for ${item.variantId}:`, markRes.messages);
				return respond({ ok: false, message: markRes.messages ?? { vi: 'Cập nhật serial thất bại', en: 'Failed to update serials' } }, 409);
			}
		}

		// ── Create payment docs — MỖI payment line 1 doc ──
		// bank_transfer + momo/zalopay (QR methods): khách quét QR → chờ tool đối
		// soát tự confirm → status 'pending'. cash/bank_pos/cod/loyalty_points:
		// hoàn tất ngay tại quầy → 'completed'. (confirmBankTransfer admin vẫn nhận
		// pending bank_transfer như cũ; momo/zalopay pending confirm qua qr/check.)
		const paymentsOut: Array<{
			paymentCode: string;
			method: string;
			amount: number;
			status: string;
			qr?: { payload: string; dataUrl: string };
		}> = [];
		let change = 0;
		for (const line of normalizedPayments) {
			const pendingQrMethod = isQrPaymentMethod(line.method);
			const paymentKey = `payment::${crypto.randomUUID()}`;
			const paymentCode = `PAY-${datePart}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
			if (line.method === 'cash') {
				change += (line.cashReceived ?? line.amount) - line.amount;
			}
			const paymentDoc = {
				orderId: documentKey,
				paymentCode,
				method: PAYMENT_METHOD_MAP[line.method],
				amount: line.amount,
				status: pendingQrMethod ? 'pending' : 'completed',
				transactionReference: orderCode,
				notes:
					line.method === 'cash'
						? `POS cash — received ${Number(line.cashReceived ?? line.amount)}, change ${Math.max(0, (line.cashReceived ?? line.amount) - line.amount)}`
						: `POS ${line.method}`,
				processedBy: actor.userId,
				createdAt: now
			};
			await cbPayments.document.create({ documentKey: paymentKey, content: paymentDoc });

			const out: (typeof paymentsOut)[number] = {
				paymentCode,
				method: line.method,
				amount: line.amount,
				status: pendingQrMethod ? 'pending' : 'completed'
			};
			// ── QR thanh toán (momo/zalopay/bank_transfer): sinh QR cho khách quét ──
			if (pendingQrMethod) {
				out.qr = await QrPaymentService.generateQr(paymentCode, line.amount, orderCode);
			}
			paymentsOut.push(out);
		}
		// QR chính (tương thích UI cũ): line QR đầu tiên nếu có.
		const primaryQr = paymentsOut.find((p) => p.qr)?.qr;

		// ── Update session totals khi bán gắn ca ──
		let sessionUpdated = false;
		if (data.sessionId) {
			const sessionRes = await POSService.updateSessionTotals(actor, data.sessionId, {
				salesToAdd: payableAmount
			});
			sessionUpdated = sessionRes.success;
		}

		void broadcastDbChange({ collection: 'orders', action: 'create', by: actor?.userId });
		void broadcastDbChange({ collection: 'inventory_stock', action: 'update', by: actor?.userId });

		return respond({
			ok: true,
			message: { vi: 'Thanh toán thành công', en: 'Checkout completed successfully' },
			data: {
				documentKey,
				orderCode,
				totalAmount: payableAmount,
				subtotal: totalAmount,
				discountAmount,
				change,
				sessionUpdated,
				paymentCode: paymentsOut[0]?.paymentCode,
				payments: paymentsOut,
				qr: primaryQr
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/pos/checkout]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
