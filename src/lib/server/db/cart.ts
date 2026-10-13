// $lib/server/db/cart.ts
// CartService — giỏ hàng storefront (collection `carts`, Phase 5).
// Pattern OrderAdminService (orders.ts): cbData + N1QL keyspace + messages
// const rờ + return {success, messages}. KHÔNG dùng PermissionChecker —
// quyền xử lý ở tầng service: user chỉ được sửa cart của chính mình
// (actor.userId === userId), trừ role quản trị (owner/manager/admin).

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PricingService } from './pricing';
import { carts as cartMessages } from '../messages/db';

const cbCarts = cbData('carts');
const cbVariants = cbData('product_variants');

const cartsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`carts\``;
const variantsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\``;

// TTL cart: refresh expiresAt sau MỖI mutation (30 ngày inactive).
const CART_TTL_DAYS = 30;

// Role được xem/sửa cart người khác (chỉ dùng cho admin dùng lại service này).
const ADMIN_ROLES = ['owner', 'manager', 'admin'];

export interface CartItem {
	variantId: string;
	quantity: number;
	price: number;
	promotionApplied?: string;
}

export interface CartDocument {
	_id?: string;
	documentKey?: string;
	userId: string;
	branchId: string;
	items: CartItem[];
	subtotal: number;
	discountAmount: number;
	appliedPromotionCode: string | null;
	total: number;
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

type CartResult<T = Record<string, unknown>> =
	| { success: false; messages: TranslateContent }
	| ({ success: true } & T);

function expiryDate(now: string): string {
	const d = new Date(now);
	d.setDate(d.getDate() + CART_TTL_DAYS);
	return d.toISOString();
}

function sanitizeCart(doc: CartDocument, documentKey: string): Record<string, unknown> {
	return {
		_id: documentKey,
		userId: doc.userId,
		branchId: doc.branchId,
		items: doc.items,
		subtotal: doc.subtotal,
		discountAmount: doc.discountAmount,
		appliedPromotionCode: doc.appliedPromotionCode,
		total: doc.total,
		expiresAt: doc.expiresAt,
		createdAt: doc.createdAt,
		updatedAt: doc.updatedAt
	};
}

export class CartService {
	/**
	 * Guard chung: actor phải là chính user đó hoặc role quản trị.
	 * (Storefront cart API luôn truyền userId = actor.userId — guard này
	 * chặn trường hợp caller truyền userId người khác.)
	 */
	private static checkAccess(actor: ActorContext, userId: string): TranslateContent | null {
		if (actor.userId === userId) return null;
		if (ADMIN_ROLES.includes(actor.roleName)) return null;
		return cartMessages.permissionDenied;
	}

	/** Cart của user (theo documentKey `cart::{userId}`) — null khi chưa có. */
	private static async findCart(userId: string): Promise<{ doc: CartDocument; documentKey: string } | null> {
		const documentKey = `cart::${userId}`;
		const res = await cbCarts.document.get({ documentKey });
		if (!res.ok || !res.data) return null;
		return { doc: res.data as CartDocument, documentKey };
	}

	/** Tính lại subtotal/discount/total từ items + promotion hiện tại. */
	private static computeTotals(items: CartItem[], discountAmount: number): { subtotal: number; total: number } {
		const subtotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
		const total = Math.max(0, subtotal - discountAmount);
		return { subtotal, total };
	}

	/**
	 * Lấy cart hiện tại hoặc tạo mới (khởi tạo rỗng). Đảm bảo 1 cart/user.
	 */
	static async getOrCreateCart(
		actor: ActorContext,
		userId: string,
		branchId?: string | null
	): Promise<CartResult<{ cart: Record<string, unknown> }>> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		if (!branchId) {
			return { success: false, messages: cartMessages.branchRequired };
		}

		const existing = await this.findCart(userId);
		if (existing) {
			return { success: true, cart: sanitizeCart(existing.doc, existing.documentKey) };
		}

		const now = new Date().toISOString();
		const documentKey = `cart::${userId}`;
		const doc: Omit<CartDocument, '_id' | 'documentKey'> = {
			userId,
			branchId,
			items: [],
			subtotal: 0,
			discountAmount: 0,
			appliedPromotionCode: null,
			total: 0,
			expiresAt: expiryDate(now),
			createdAt: now,
			updatedAt: now
		};

		try {
			const res = await cbCarts.document.create({ documentKey, content: doc });
			if (!res.ok) return { success: false, messages: cartMessages.createFailed };
			return { success: true, cart: sanitizeCart(doc as CartDocument, documentKey) };
		} catch {
			return { success: false, messages: cartMessages.createFailed };
		}
	}

	/**
	 * Thêm 1 variant vào cart (nếu đã có thì cộng dồn số lượng).
	 * Giá lấy từ variant doc (không tin client) — variant phải active.
	 */
	static async addToCart(
		actor: ActorContext,
		userId: string,
		variantId: string,
		quantity: number,
		branchId?: string | null
	): Promise<CartResult<{ cart: Record<string, unknown> }>> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		const qty = Math.max(1, Math.floor(Number(quantity)));
		if (!Number.isFinite(qty) || qty < 1) {
			return { success: false, messages: cartMessages.invalidQuantity };
		}

		// Variant phải tồn tại + active (giá server-side, không tin client).
		const variantRes = await cbVariants.document.get({ documentKey: variantId });
		if (!variantRes.ok || !variantRes.data) {
			return { success: false, messages: cartMessages.variantNotFound };
		}
		const variant = variantRes.data as { price: number; status?: string; deletedAt?: string };
		if (variant.status !== 'active' || variant.deletedAt) {
			return { success: false, messages: cartMessages.variantNotFound };
		}

		// getOrCreate đảm bảo cart tồn tại trước khi mutate.
		const ensured = await this.getOrCreateCart(actor, userId, branchId);
		if (!ensured.success) return ensured;
		const cart = ensured.cart as unknown as CartDocument;
		const documentKey = `cart::${userId}`;

		const items: CartItem[] = Array.isArray(cart.items) ? [...cart.items] : [];
		const existingIdx = items.findIndex((it) => it.variantId === variantId);
		if (existingIdx >= 0) {
			items[existingIdx] = { ...items[existingIdx], quantity: items[existingIdx].quantity + qty };
		} else {
			items.push({ variantId, quantity: qty, price: variant.price });
		}

		const { subtotal, total } = this.computeTotals(items, cart.discountAmount ?? 0);
		const now = new Date().toISOString();
		const updated: CartDocument = {
			...cart,
			items,
			subtotal,
			total,
			expiresAt: expiryDate(now),
			updatedAt: now
		};

		try {
			const res = await cbCarts.document.update({ documentKey, content: updated });
			if (!res.ok) return { success: false, messages: cartMessages.updateFailed };
			return { success: true, cart: sanitizeCart(updated, documentKey) };
		} catch {
			return { success: false, messages: cartMessages.updateFailed };
		}
	}

	/**
	 * Đặt số lượng 1 item trong cart (0 = xoá item).
	 */
	static async updateItemQuantity(
		actor: ActorContext,
		userId: string,
		variantId: string,
		quantity: number
	): Promise<CartResult<{ cart: Record<string, unknown> }>> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		const existing = await this.findCart(userId);
		if (!existing) return { success: false, messages: cartMessages.notFound };

		const qty = Math.floor(Number(quantity));
		if (!Number.isFinite(qty) || qty < 0) {
			return { success: false, messages: cartMessages.invalidQuantity };
		}

		const items: CartItem[] = Array.isArray(existing.doc.items) ? [...existing.doc.items] : [];
		const idx = items.findIndex((it) => it.variantId === variantId);
		if (idx < 0) return { success: false, messages: cartMessages.variantNotFound };

		if (qty === 0) {
			items.splice(idx, 1);
		} else {
			items[idx] = { ...items[idx], quantity: qty };
		}

		const { subtotal, total } = this.computeTotals(items, existing.doc.discountAmount ?? 0);
		const now = new Date().toISOString();
		const updated: CartDocument = {
			...existing.doc,
			items,
			subtotal,
			total,
			expiresAt: expiryDate(now),
			updatedAt: now
		};

		try {
			const res = await cbCarts.document.update({ documentKey: existing.documentKey, content: updated });
			if (!res.ok) return { success: false, messages: cartMessages.updateFailed };
			return { success: true, cart: sanitizeCart(updated, existing.documentKey) };
		} catch {
			return { success: false, messages: cartMessages.updateFailed };
		}
	}

	/**
	 * Xoá 1 item khỏi cart.
	 */
	static async removeItem(
		actor: ActorContext,
		userId: string,
		variantId: string
	): Promise<CartResult<{ cart: Record<string, unknown> }>> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		const existing = await this.findCart(userId);
		if (!existing) return { success: false, messages: cartMessages.notFound };

		const items: CartItem[] = Array.isArray(existing.doc.items) ? [...existing.doc.items] : [];
		const next = items.filter((it) => it.variantId !== variantId);
		if (next.length === items.length) {
			return { success: false, messages: cartMessages.variantNotFound };
		}

		const { subtotal, total } = this.computeTotals(next, existing.doc.discountAmount ?? 0);
		const now = new Date().toISOString();
		const updated: CartDocument = {
			...existing.doc,
			items: next,
			subtotal,
			total,
			expiresAt: expiryDate(now),
			updatedAt: now
		};

		try {
			const res = await cbCarts.document.update({ documentKey: existing.documentKey, content: updated });
			if (!res.ok) return { success: false, messages: cartMessages.updateFailed };
			return { success: true, cart: sanitizeCart(updated, existing.documentKey) };
		} catch {
			return { success: false, messages: cartMessages.updateFailed };
		}
	}

	/**
	 * Áp mã khuyến mãi lên cart: validate qua PricingService.applyPromotion
	 * (không kiểm tra quyền — public cho customer), ghi promotionApplied vào
	 * items + discountAmount/appliedPromotionCode trên cart.
	 */
	static async applyPromotion(
		actor: ActorContext,
		userId: string,
		promotionCode: string
	): Promise<CartResult<{ cart: Record<string, unknown> }>> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		const existing = await this.findCart(userId);
		if (!existing) return { success: false, messages: cartMessages.notFound };

		const code = String(promotionCode ?? '').trim();
		if (!code) return { success: false, messages: cartMessages.invalidPromotion };

		const items: CartItem[] = Array.isArray(existing.doc.items) ? [...existing.doc.items] : [];
		if (items.length === 0) return { success: false, messages: cartMessages.itemsRequired };

		const { subtotal } = this.computeTotals(items, 0);

		// PricingService.applyPromotion tự validate (active/dates/limit/minOrder)
		// và trả discountAmount + finalTotal. Nó cũng tự tăng usageCount.
		const promo = await PricingService.applyPromotion(code, subtotal);
		if (!promo.success) return { success: false, messages: cartMessages.invalidPromotion };

		const now = new Date().toISOString();
		const updated: CartDocument = {
			...existing.doc,
			items: items.map((it) => ({ ...it, promotionApplied: code })),
			discountAmount: promo.discountAmount,
			appliedPromotionCode: code,
			total: promo.finalTotal,
			expiresAt: expiryDate(now),
			updatedAt: now
		};

		try {
			const res = await cbCarts.document.update({ documentKey: existing.documentKey, content: updated });
			if (!res.ok) return { success: false, messages: cartMessages.updateFailed };
			return { success: true, cart: sanitizeCart(updated, existing.documentKey) };
		} catch {
			return { success: false, messages: cartMessages.updateFailed };
		}
	}

	/**
	 * Tính lại totals từ items hiện tại (dùng sau khi giá thay đổi hoặc bỏ promo).
	 */
	static async recalcTotals(
		actor: ActorContext,
		userId: string
	): Promise<CartResult<{ cart: Record<string, unknown> }>> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		const existing = await this.findCart(userId);
		if (!existing) return { success: false, messages: cartMessages.notFound };

		const items: CartItem[] = Array.isArray(existing.doc.items) ? [...existing.doc.items] : [];
		const { subtotal, total } = this.computeTotals(items, existing.doc.discountAmount ?? 0);
		const now = new Date().toISOString();
		const updated: CartDocument = {
			...existing.doc,
			items,
			subtotal,
			total,
			expiresAt: expiryDate(now),
			updatedAt: now
		};

		try {
			const res = await cbCarts.document.update({ documentKey: existing.documentKey, content: updated });
			if (!res.ok) return { success: false, messages: cartMessages.updateFailed };
			return { success: true, cart: sanitizeCart(updated, existing.documentKey) };
		} catch {
			return { success: false, messages: cartMessages.updateFailed };
		}
	}

	/**
	 * Xoá sạch items (giữ cart để user dùng tiếp) — gọi sau checkout thành công.
	 */
	static async clearCart(actor: ActorContext, userId: string): Promise<CartResult<{ cart: Record<string, unknown> }>> {
		const denied = this.checkAccess(actor, userId);
		if (denied) return { success: false, messages: denied };

		const existing = await this.findCart(userId);
		if (!existing) return { success: false, messages: cartMessages.notFound };

		const now = new Date().toISOString();
		const updated: CartDocument = {
			...existing.doc,
			items: [],
			subtotal: 0,
			discountAmount: 0,
			appliedPromotionCode: null,
			total: 0,
			expiresAt: expiryDate(now),
			updatedAt: now
		};

		try {
			const res = await cbCarts.document.update({ documentKey: existing.documentKey, content: updated });
			if (!res.ok) return { success: false, messages: cartMessages.updateFailed };
			return { success: true, cart: sanitizeCart(updated, existing.documentKey) };
		} catch {
			return { success: false, messages: cartMessages.updateFailed };
		}
	}

	/**
	 * Helper cleanup: xoá cart đã hết hạn (expiresAt < now).
	 * Trả về số document đã xoá (best-effort, không throw).
	 */
	static async deleteExpired(): Promise<number> {
		try {
			const res = await cbCarts.document.query({
				statement: `DELETE FROM ${cartsKeyspace} WHERE expiresAt < $1 RETURNING META().id AS _id`,
				args: [new Date().toISOString()],
				readonly: false
			});
			return res.ok ? (res.data?.results?.length ?? 0) : 0;
		} catch {
			return 0;
		}
	}
}
