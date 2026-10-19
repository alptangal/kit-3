//$lib/server/db-broadcast.ts

import { env } from '$env/dynamic/private';

/**
 * Broadcast thông báo "dữ liệu vừa thay đổi" sang PartyKit (room "db-changes")
 * để mọi admin client đang mở refetch list của mình (B8 realtime).
 *
 * Thiết kế fire-and-forget KHÔNG retry: event realtime cũ 16s sau chỉ là rác —
 * client refetch theo polling/refresh tay vẫn đúng. Khác với partykit-push
 * (public key phải đến được, nên retry backoff), module này chỉ là hint.
 *
 * Bảo mật: Bearer PARTYKIT_INTERNAL_TOKEN — giống push key; kẻ tấn công broadcast
 * giả tối đa khiến client refetch nhiều lần (vô hại — read đã qua permission check).
 *
 * Module CHỈ server-side. KHÔNG bao giờ throw.
 */

const DEFAULT_BROADCAST_URL = 'http://127.0.0.1:8787/parties/main/db-changes';
const DEFAULT_TOKEN = 'dev-insecure-token-change-me';

/** Tên collection Couchbase bị thay đổi — client subscribe theo tên này. */
export type DbChangeCollection =
	| 'brands'
	| 'categories'
	| 'products'
	| 'variants'
	| 'customers'
	| 'orders'
	| 'users'
	| 'inventory_lots'
	| 'inventory_stock'
	// Chuyển kho + đổi trả (Phase 3 vertical slices)
	| 'stock_transfers'
	| 'order_returns'
	// Công nợ 2 chiều (AR/AP) + lịch sử thanh toán
	| 'debts'
	| 'debt_payments'
	// Mua hàng / nhà cung cấp (purchase detail modal sửa entity)
	| 'suppliers'
	| 'purchase_orders'
	| 'system';

/** Hành động gây thay đổi — chỉ để log/debug, client v1 refetch mọi event. */
export type DbChangeAction = 'create' | 'update' | 'delete' | 'set-status' | 'set-role' | 'restore' | 'reset-password' | 'adjust';

export interface DbChangeEvent {
	collection: DbChangeCollection;
	action: DbChangeAction;
	/** Actor gây thay đổi (username) — chỉ để log/debug. */
	by?: string;
}

/**
 * POST event lên PartyKit room "db-changes". Không retry, không throw —
 * gọi dạng `void broadcastDbChange(...)` hoặc không await sau mutation success.
 */
export async function broadcastDbChange(event: DbChangeEvent): Promise<void> {
	const url = env.PARTYKIT_BROADCAST_URL ?? DEFAULT_BROADCAST_URL;
	const token = env.PARTYKIT_INTERNAL_TOKEN ?? DEFAULT_TOKEN;

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${token}`
			},
			body: JSON.stringify({ type: 'db-change', ...event })
		});

		if (!res.ok) {
			// 401/403: token sai — log rõ; 5xx: partykit dev chưa lên. Đều không retry.
			console.warn(`[db-broadcast] status ${res.status} for ${event.collection}/${event.action}`);
		}
	} catch (e) {
		// PartyKit chưa khởi động / network lỗi — realtime là best-effort
		console.warn(`[db-broadcast] failed: ${e instanceof Error ? e.message : e}`);
	}
}
