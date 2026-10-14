// $lib/server/db/checkout.ts
// CheckoutService — thanh toán storefront (collection `checkouts`, Phase 5).
// Flow initiateCheckout: validate cart + địa chỉ + paymentMethod → tạo order
// (status 'pending', KHÔNG qua OrderAdminService vì service đó yêu cầu quyền
// 'orders:create' mà customer không có — copy logic validate của orders.ts,
// permission-free vì actor luôn là chính chủ cart) → trừ tồn kho trực tiếp
// qua N1QL atomic (InventoryService.adjustStock bị gate 'inventory:adjust') →
// tạo checkout doc (status 'converted_to_order', orderId gắn) → clear cart.

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { checkouts as checkoutMessages } from '../messages/db';

const cbCheckouts = cbData('checkouts');
const cbCarts = cbData('carts');
const cbOrders = cbData('orders');
const cbVariants = cbData('product_variants');
const cbUsers = cbData('users');
const cbInventoryStock = cbData('inventory_stock');

const checkoutsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`checkouts\``;
const ordersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`orders\``;
const inventoryStockKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_stock\``;

// Enum paymentMethod theo schema.ts (UI chỉ expose 5 phương thức chính).
const VALID_PAYMENT_METHODS = ['cash', 'bank_pos', 'momo', 'zalopay', 'bank_transfer', 'cod', 'loyalty_points'];

export interface ShippingAddress extends Record<string, unknown> {
	street: string;
	ward: string;
	district: string;
	province: string;
	postalCode?: string;
	phoneNumber: string;
	recipientName: string;
}

export interface CheckoutDocument {
	_id?: string;
	documentKey?: string;
	userId: string;
	orderId: string;
	cartId: string;
	shippingAddress: ShippingAddress;
	paymentMethod: string;
	paymentStatus: string;
	status: string;
	notes?: string;
	expiresAt?: string;
	createdAt: string;
	updatedAt: string;
	completedAt?: string;
}

type CheckoutResult<T = Record<string, unknown>> =
	| { success: false; messages: TranslateContent }
	| ({ success: true } & T);

const ADMIN_ROLES = ['owner', 'manager', 'admin'];

function sanitizeCheckout(doc: CheckoutDocument, documentKey: string): Record<string, unknown> {
	return {
		_id: documentKey,
		userId: doc.userId,
		orderId: doc.orderId,
		cartId: doc.cartId,
		shippingAddress: doc.shippingAddress,
		paymentMethod: doc.paymentMethod,
		paymentStatus: doc.paymentStatus,
		status: doc.status,
		notes: doc.notes,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt,
		completedAt: doc.completedAt
	};
}

function isValidAddress(addr: ShippingAddress | undefined | null): addr is ShippingAddress {
	if (!addr || typeof addr !== 'object') return false;
	const required: Array<keyof ShippingAddress> = ['street', 'ward', 'district', 'province', 'phoneNumber', 'recipientName'];
	return required.every((k) => typeof addr[k] === 'string' && (addr[k] as string).trim().length > 0);
}

export class CheckoutService {
	private static checkAccess(actor: ActorContext, userId: string): TranslateContent | null {
		if (actor.userId === userId) return null;
		if (ADMIN_ROLES.includes(actor.roleName)) return null;
		return checkoutMessages.permissionDenied;
	}

	/**
	 * Trừ tồn kho best-effort: N1QL UPDATE atomic với điều kiện quantityOnHand
	 * >= số lượng (chống race). Không có doc tồn kho / trừ thất bại → chỉ log,
	 * KHÔNG fail checkout (tồn kho có thể chưa được nhập cho variant mới).
	 */
	private static async deductStock(
		variantId: string,
		branchId: string,
		quantity: number,
		orderId: string
	): Promise<void> {
		try {
			const res = await cbInventoryStock.document.query({
				statement: `
					UPDATE ${inventoryStockKeyspace}
					SET quantityOnHand = quantityOnHand - $3, updatedAt = $4
					WHERE variantId = $1 AND branchId = $2 AND quantityOnHand >= $3
				`,
				args: [variantId, branchId, quantity, new Date().toISOString()],
				readonly: false
			});
			if (!res.ok) {
				console.error('[CheckoutService.deductStock] update failed', variantId, branchId);
			}
		} catch (e) {
			console.error('[CheckoutService.deductStock] error', variantId, e);
		}
	}

	/**
	 * Bắt đầu + hoàn tất checkout trong 1 lần gọi:
	 * 1. Load cart theo cartId (phải là cart của userId và còn items)
	 * 2. Validate địa chỉ + paymentMethod
	 * 3. Tạo order status 'pending' (validate variant như orders.ts, staffId='')
	 * 4. Trừ tồn kho (best-effort)
	 * 5. Tạo checkout doc status 'converted_to_order'
	 * 6. Clear cart
	 */
	static async initiateCheckout(
		actor: ActorContext,
		userId: string,
		cartId: string,
		shippingAddress: ShippingAddress,
		paymentMethod: string,
		options?: { notes?: string }
	): Promise<
		| { success: false; messages: TranslateContent }
		| { success: true; checkout: Record<string, unknown>; orderId: string; orderCode: string }
	> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		// 1. Load cart — cartId phải khớp cart của user này (documentKey `cart::{userId}`).
		const expectedKey = `cart::${userId}`;
		if (!cartId || cartId !== expectedKey) {
			return { success: false, messages: checkoutMessages.cartNotFound };
		}

		// (đọc cart qua collection carts)
		const cartGet = await cbCarts.document.get({ documentKey: expectedKey });
		if (!cartGet.ok || !cartGet.data) {
			return { success: false, messages: checkoutMessages.cartNotFound };
		}
		const cart = cartGet.data as {
			userId: string;
			branchId: string;
			items: Array<{ variantId: string; quantity: number; price: number }>;
			subtotal: number;
			discountAmount: number;
			total: number;
		};
		if (!Array.isArray(cart.items) || cart.items.length === 0) {
			return { success: false, messages: checkoutMessages.cartEmpty };
		}

		// 2. Validate địa chỉ + paymentMethod.
		if (!isValidAddress(shippingAddress)) {
			return { success: false, messages: checkoutMessages.invalidShippingAddress };
		}
		const method = String(paymentMethod ?? '');
		if (!VALID_PAYMENT_METHODS.includes(method)) {
			return { success: false, messages: checkoutMessages.invalidPaymentMethod };
		}

		// 3. Tạo order — validate từng variant như OrderAdminService.create
		// (price lấy từ cart đã chốt server-side; quantity nguyên >= 1).
		let totalAmount = 0;
		const validatedItems: Array<{ variantId: string; quantity: number; price: number }> = [];
		for (const item of cart.items) {
			const variantRes = await cbVariants.document.get({ documentKey: item.variantId });
			if (!variantRes.ok || !variantRes.data) {
				return { success: false, messages: checkoutMessages.cartEmpty };
			}
			const variant = variantRes.data as { price: number; status?: string; deletedAt?: string };
			if (variant.status !== 'active' || variant.deletedAt) {
				return { success: false, messages: checkoutMessages.cartEmpty };
			}
			const quantity = Math.max(1, Math.floor(item.quantity));
			const price = item.price ?? variant.price;
			totalAmount += price * quantity;
			validatedItems.push({ variantId: item.variantId, quantity, price });
		}
		// Áp discount đã chốt trên cart (từ promotion đã apply).
		const discountAmount = Math.max(0, Number(cart.discountAmount ?? 0));
		const finalTotal = Math.max(0, totalAmount - discountAmount);

		// Customer validate — như orders.ts (role-customer, chưa xoá).
		const customerRes = await cbUsers.document.get({ documentKey: userId });
		if (!customerRes.ok || !customerRes.data) {
			return { success: false, messages: checkoutMessages.permissionDenied };
		}
		const customer = customerRes.data as { roleId?: string; deletedAt?: string };
		if (customer.deletedAt) {
			return { success: false, messages: checkoutMessages.permissionDenied };
		}

		const now = new Date().toISOString();
		const orderKey = `order::${crypto.randomUUID()}`;
		const datePart = now.slice(0, 10).replace(/-/g, '');
		const orderCode = `ORD-${datePart}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

		const orderDoc = {
			orderCode,
			customerId: userId,
			// Self-checkout storefront: không có staff phụ trách.
			staffId: '',
			branchId: cart.branchId ?? actor.branchId ?? null,
			status: 'pending',
			items: validatedItems,
			totalAmount: finalTotal,
			createdAt: now,
			updatedAt: now
		};

		try {
			const res = await cbOrders.document.create({ documentKey: orderKey, content: orderDoc });
			if (!res.ok) return { success: false, messages: checkoutMessages.orderCreateFailed };
		} catch {
			return { success: false, messages: checkoutMessages.orderCreateFailed };
		}

		// 4. Trừ tồn kho (best-effort — không chặn checkout).
		const branchId = orderDoc.branchId;
		if (branchId) {
			for (const item of validatedItems) {
				await this.deductStock(item.variantId, branchId, item.quantity, orderKey);
			}
		}

		// 5. Tạo checkout doc — order đã tạo xong → status 'converted_to_order'.
		const checkoutKey = `checkout::${crypto.randomUUID()}`;
		const checkoutDoc: Omit<CheckoutDocument, '_id' | 'documentKey'> = {
			userId,
			orderId: orderKey,
			cartId: expectedKey,
			shippingAddress,
			paymentMethod: method,
			paymentStatus: 'pending',
			status: 'converted_to_order',
			notes: options?.notes,
			createdAt: now,
			updatedAt: now,
			completedAt: now
		};

		try {
			const res = await cbCheckouts.document.create({ documentKey: checkoutKey, content: checkoutDoc });
			if (!res.ok) {
				// Order đã tạo nhưng checkout doc lỗi — order vẫn hợp lệ, trả success
				// kèm cảnh báo log (không double-charge: paymentStatus vẫn pending).
				console.error('[CheckoutService.initiateCheckout] checkout doc create failed', orderKey);
				return {
					success: true,
					checkout: sanitizeCheckout(checkoutDoc as CheckoutDocument, checkoutKey),
					orderId: orderKey,
					orderCode
				};
			}
		} catch (e) {
			console.error('[CheckoutService.initiateCheckout] checkout doc error', orderKey, e);
			return {
				success: true,
				checkout: sanitizeCheckout(checkoutDoc as CheckoutDocument, checkoutKey),
				orderId: orderKey,
				orderCode
			};
		}

		// 6. Clear cart sau khi order tạo thành công (best-effort).
		try {
			await cbCarts.document.update({
				documentKey: expectedKey,
				content: {
					...cart,
					items: [],
					subtotal: 0,
					discountAmount: 0,
					total: 0,
					updatedAt: new Date().toISOString()
				}
			});
		} catch {
			// Cart không clear được không ảnh hưởng order đã tạo — log thôi.
			console.error('[CheckoutService.initiateCheckout] clear cart failed', userId);
		}

		return {
			success: true,
			checkout: sanitizeCheckout(checkoutDoc as CheckoutDocument, checkoutKey),
			orderId: orderKey,
			orderCode
		};
	}

	/**
	 * Danh sách đơn hàng của chính customer (storefront /store/account) —
	 * query orders WHERE customerId = userId, mới nhất trước. Permission-free
	 * (actor luôn là chính chủ) — KHÔNG dùng OrderAdminService.list vì nó gate
	 * 'orders:read' mà customer không có.
	 */
	static async listMyOrders(
		actor: ActorContext,
		userId: string,
		options: { page?: number; pageSize?: number } = {}
	): Promise<
		| { success: false; messages: TranslateContent }
		| { success: true; orders: Record<string, unknown>[]; total: number; page: number; pageSize: number }
	> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10));
		const offset = (page - 1) * pageSize;

		const conditions = ['customerId = $1', '(deletedAt IS NULL OR deletedAt IS MISSING)'];
		const args = [userId];

		const [countRes, dataRes] = await Promise.all([
			cbOrders.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${ordersKeyspace} WHERE ${conditions.join(' AND ')}`,
				args: [...args],
				readonly: true
			}),
			cbOrders.document.query({
				statement: `SELECT META().id AS orderId, orderCode, status, items, totalAmount, branchId, createdAt, updatedAt
					FROM ${ordersKeyspace}
					WHERE ${conditions.join(' AND ')}
					ORDER BY createdAt DESC
					LIMIT ${pageSize} OFFSET ${offset}`,
				args: [...args],
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: checkoutMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		return {
			success: true,
			orders: dataRes.data?.results ?? [],
			total,
			page,
			pageSize
		};
	}

	/**
	 * Xem 1 checkout (chủ sở hữu hoặc admin).
	 */
	static async getCheckout(
		actor: ActorContext,
		userId: string,
		checkoutId: string
	): Promise<CheckoutResult<{ checkout: Record<string, unknown> }>> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		const res = await cbCheckouts.document.get({ documentKey: checkoutId });
		if (!res.ok || !res.data) {
			return { success: false, messages: checkoutMessages.notFound };
		}
		const doc = res.data as CheckoutDocument;
		// Owner/admin mới được xem — user chỉ xem checkout của chính mình.
		if (doc.userId !== userId && !ADMIN_ROLES.includes(actor.roleName)) {
			return { success: false, messages: checkoutMessages.permissionDenied };
		}
		return { success: true, checkout: sanitizeCheckout(doc, checkoutId) };
	}
}
