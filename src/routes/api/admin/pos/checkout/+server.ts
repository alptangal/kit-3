// src/routes/api/admin/pos/checkout/+server.ts
// POS terminal checkout: validate stock -> create order (paid/pos) -> deduct stock
// -> create completed payment -> update session totals when sessionId given.
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

const cbOrders = cbData('orders');
const cbPayments = cbData('payments');
const cbVariants = cbData('product_variants');

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
}

export const POST: RequestHandler = async (event) => {
	const { locals } = event;

	try {
		const read = await readAdminRequest<{
			items: CheckoutItem[];
			paymentMethod: string;
			sessionId?: string;
			branchId?: string;
			cashReceived?: number;
			customerDiscount?: number;
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
		const paymentMethod = data.paymentMethod ?? 'cash';
		const schemaMethod = PAYMENT_METHOD_MAP[paymentMethod];
		if (!schemaMethod) {
			return respond(
				{
					ok: false,
					message: { vi: 'Phương thức thanh toán không hợp lệ', en: 'Invalid payment method' }
				},
				400
			);
		}
		const customerDiscount =
			typeof data.customerDiscount === 'number' && data.customerDiscount > 0
				? Math.min(data.customerDiscount, 100)
				: 0;

		// ── Validate items: variant active + enough stock at branch ──
		const validated: Array<{ variantId: string; quantity: number; price: number }> = [];
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
			if (onHand < quantity) {
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
			validated.push({ variantId: item.variantId, quantity, price });
			totalAmount += price * quantity;
		}

		// ── Customer discount (percent) ──
		const discountAmount = Math.round((totalAmount * customerDiscount) / 100);
		const payableAmount = Math.max(0, totalAmount - discountAmount);

		// ── Cash received → change (only for cash) ──
		let change = 0;
		if (paymentMethod === 'cash') {
			const cashReceived = Number(data.cashReceived);
			if (!Number.isFinite(cashReceived) || cashReceived < payableAmount) {
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
			change = Math.round(cashReceived - payableAmount);
		}

		// ── Create order: status paid, channel pos ──
		const now = new Date().toISOString();
		const documentKey = `order::${crypto.randomUUID()}`;
		const datePart = now.slice(0, 10).replace(/-/g, '');
		const orderCode = `ORD-${datePart}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

		const orderDoc = {
			orderCode,
			customerId: null,
			staffId: actor.userId,
			branchId: branchId ?? null,
			status: 'paid',
			channel: 'pos',
			items: validated.map((v) => ({
				variantId: v.variantId,
				lotId: undefined,
				quantity: v.quantity,
				price: v.price
			})),
			totalAmount: payableAmount,
			discountAmount,
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
		for (const item of validated) {
			const adjustRes = await InventoryService.adjustStock(
				actor,
				item.variantId,
				branchId as string,
				-item.quantity,
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

		// ── Create payment doc ──
		// bank_transfer + momo/zalopay (QR methods): khách quét QR → chờ tool đối
		// soát tự confirm → status 'pending'. cash/bank_pos/cod/loyalty_points:
		// hoàn tất ngay tại quầy → 'completed'. (confirmBankTransfer admin vẫn nhận
		// pending bank_transfer như cũ; momo/zalopay pending confirm qua qr/check.)
		const pendingQrMethod = isQrPaymentMethod(paymentMethod);
		const paymentKey = `payment::${crypto.randomUUID()}`;
		const paymentDoc = {
			orderId: documentKey,
			paymentCode: `PAY-${datePart}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
			method: schemaMethod,
			amount: payableAmount,
			status: pendingQrMethod ? 'pending' : 'completed',
			transactionReference: orderCode,
			notes:
				paymentMethod === 'cash'
					? `POS cash — received ${Number(data.cashReceived ?? 0)}, change ${change}`
					: `POS ${paymentMethod}`,
			processedBy: actor.userId,
			createdAt: now
		};
		await cbPayments.document.create({ documentKey: paymentKey, content: paymentDoc });

		// ── QR thanh toán (momo/zalopay/bank_transfer): sinh QR cho khách quét ──
		// Payment tương ứng đang 'pending' — chờ tool đối soát (nút Check QR ở
		// admin/payments hoặc auto poll) tự confirm.
		let qr: { payload: string; dataUrl: string } | undefined;
		if (pendingQrMethod) {
			qr = await QrPaymentService.generateQr(paymentDoc.paymentCode, payableAmount, orderCode);
		}

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
				discountAmount,
				change,
				sessionUpdated,
				paymentCode: paymentDoc.paymentCode,
				qr
			}
		});
	} catch (e) {
		console.error('[POST /api/admin/pos/checkout]', e);
		return json({ message: e instanceof Error ? e.message : String(e), ok: false }, { status: 500 });
	}
};
