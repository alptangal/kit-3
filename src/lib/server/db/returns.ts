// $lib/server/db/returns.ts
// ReturnService — đổi/trả hàng từ đơn hàng (order_returns)
// Pattern: suppliers.ts (ActorContext, requirePermission, list/get/create, adminMessages)
//
// Luồng nghiệp vụ:
//   tạo (requested) — chỉ cho phép trong 7 NGÀY kể từ createdAt của đơn hàng
//   → manager duyệt (approved)
//   → hoàn tất (completed) — HOÀN TỒN KHO (cộng lại) tại chi nhánh XỬ LÝ
//     (returnBranchId) + hoàn tiền chỉ GHI CHÚ (refundNote) — không cần refund engine
//   → từ chối (rejected)
//
// Đổi trả KHÁC chi nhánh: originBranchId (chi nhánh bán gốc — nơi tạo đơn) tách
// riêng với returnBranchId (chi nhánh xử lý — nơi nhận lại hàng). Tồn kho hoàn
// VÀO chi nhánh xử lý (nơi khách trả hàng), không hoàn về nơi bán.
//
// Schema: src/lib/modules/schema.ts order_returns
//   { returnCode, orderId, originBranchId, returnBranchId, branchId (deprecated),
//     customerId, items[{variantId, lotId?, quantity, refundUnitPrice, reason}],
//     totalRefundAmount, status, handledBy, createdAt, updatedAt }

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { ActorContext } from './users';
import { broadcastDbChange } from '../db-broadcast';

const cbReturns = cbData('order_returns');
const cbOrders = cbData('orders');
const cbBranches = cbData('branches');
const cbInventoryStock = cbData('inventory_stock');
const cbStockMovements = cbData('stock_movements');

const returnsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`order_returns\``;
const inventoryStockKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_stock\``;

const adminMessages = {
	notFound: {
		vi: 'Không tìm thấy phiếu đổi trả',
		en: 'Return not found'
	} as TranslateContent,
	orderNotFound: {
		vi: 'Không tìm thấy đơn hàng',
		en: 'Order not found'
	} as TranslateContent,
	branchNotFound: {
		vi: 'Không tìm thấy chi nhánh',
		en: 'Branch not found'
	} as TranslateContent,
	variantNotInOrder: {
		vi: 'Sản phẩm không thuộc đơn hàng hoặc số lượng vượt số lượng đã mua',
		en: 'Variant not in order or quantity exceeds purchased quantity'
	} as TranslateContent,
	invalidItems: {
		vi: 'Danh sách mục đổi trả không hợp lệ',
		en: 'Invalid return items'
	} as TranslateContent,
	returnWindowExpired: {
		vi: 'Đã quá 7 ngày đổi trả kể từ khi tạo đơn hàng',
		en: 'Return window (7 days) has expired'
	} as TranslateContent,
	queryFailed: {
		vi: 'Truy vấn thất bại',
		en: 'Query failed'
	} as TranslateContent,
	createFailed: {
		vi: 'Tạo phiếu đổi trả thất bại',
		en: 'Failed to create return'
	} as TranslateContent,
	updateFailed: {
		vi: 'Cập nhật phiếu đổi trả thất bại',
		en: 'Failed to update return'
	} as TranslateContent,
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent,
	invalidStatus: {
		vi: 'Trạng thái không hợp lệ',
		en: 'Invalid status'
	} as TranslateContent,
	invalidStatusTransition: {
		vi: 'Chuyển trạng thái không hợp lệ',
		en: 'Invalid status transition'
	} as TranslateContent
} as const;

const RETURN_ADMIN_SAFE_FIELDS = [
	'returnCode',
	'orderId',
	'originBranchId',
	'returnBranchId',
	'branchId',
	'customerId',
	'items',
	'totalRefundAmount',
	'refundNote',
	'status',
	'handledBy',
	'createdAt',
	'updatedAt'
] as const;

const VALID_STATUSES = ['requested', 'approved', 'completed', 'rejected'] as const;
type ReturnStatus = typeof VALID_STATUSES[number];

// requested → approved | rejected; approved → completed | rejected
const VALID_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
	requested: ['approved', 'rejected'],
	approved: ['completed', 'rejected'],
	completed: [],
	rejected: []
};

function isValidTransition(from: string, to: string): boolean {
	return (VALID_TRANSITIONS[from as ReturnStatus] ?? []).includes(to as ReturnStatus);
}

// Cửa sổ đổi trả 7 ngày (ms)
const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function sanitizeReturnForAdmin(doc: any & { _id: string }) {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of RETURN_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

interface ReturnListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

type ReturnItem = {
	variantId: string;
	quantity: number;
	lotId?: string;
	refundUnitPrice: number;
	reason?: string;
};

type OrderItem = { variantId: string; lotId?: string; quantity: number; price: number };

export class ReturnService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetBranchId?: string | null
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId
		});
		if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
		return null;
	}

	/**
	 * List returns (phân trang + filter status).
	 * Scope own_branch: thấy phiếu mà chi nhánh mình là returnBranchId (xử lý)
	 * HOẶC originBranchId (bán gốc).
	 */
	static async list(
		actor: ActorContext,
		options: {
			status?: string;
			branchId?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & ReturnListResult)> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'returns:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];

		if (scope === 'own_branch') {
			if (!actor.branchId) return { success: false, messages: adminMessages.permissionDenied };
			conditions.push('(returnBranchId = $' + (args.length + 1) + ' OR originBranchId = $' + (args.length + 1) + ')');
			args.push(actor.branchId, actor.branchId);
		}

		if (options.branchId) {
			conditions.push('(returnBranchId = $' + (args.length + 1) + ' OR originBranchId = $' + (args.length + 1) + ')');
			args.push(options.branchId, options.branchId);
		}

		if (options.status) {
			conditions.push('status = $' + (args.length + 1));
			args.push(options.status);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = 'META().id AS _id, ' + RETURN_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

		const [countRes, dataRes] = await Promise.all([
			cbReturns.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${returnsKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbReturns.document.query({
				statement: `SELECT ${selectClause} FROM ${returnsKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []).map(sanitizeReturnForAdmin);

		return { success: true, items, total, page, pageSize };
	}

	/**
	 * Get 1 return — own_branch chỉ thấy phiếu liên quan chi nhánh mình.
	 */
	static async get(
		actor: ActorContext,
		returnId: string
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { ret: Record<string, unknown> })> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'returns:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const res = await cbReturns.document.get({ documentKey: returnId });
		if (!res.ok) {
			return { success: false, messages: adminMessages.notFound };
		}

		const ret = (res as any).data;

		if (scope === 'own_branch' && actor.branchId && !this.isRelatedBranch(ret, actor.branchId)) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		return { success: true, ret: sanitizeReturnForAdmin({ ...ret, _id: returnId }) };
	}

	private static isRelatedBranch(ret: { originBranchId?: string | null; returnBranchId?: string | null }, branchId?: string): boolean {
		if (!branchId) return false;
		return ret.originBranchId === branchId || ret.returnBranchId === branchId;
	}

	/**
	 * Lấy đơn hàng + kiểm tra cửa sổ đổi trả 7 ngày (check lúc TẠO).
	 */
	private static async loadOrderInWindow(orderId: string): Promise<
		{ ok: false; messages: TranslateContent } | { ok: true; order: any }
	> {
		const res = await cbOrders.document.get({ documentKey: orderId });
		if (!res.ok) return { ok: false, messages: adminMessages.orderNotFound };
		const order = (res as any).data as {
			createdAt?: string;
			branchId?: string | null;
			customerId?: string;
			items?: OrderItem[];
		};

		const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : NaN;
		if (!Number.isFinite(createdAt) || Date.now() - createdAt > RETURN_WINDOW_MS) {
			return { ok: false, messages: adminMessages.returnWindowExpired };
		}

		return { ok: true, order };
	}

	/**
	 * Tạo phiếu đổi trả (status 'requested').
	 * - orderId phải trong 7 ngày kể từ createdAt.
	 * - items phải thuộc đơn: variantId có trong order.items và quantity ≤ đã mua
	 *   (trừ số lượng đã trả ở các return trước của cùng đơn — không cho trả 2 lần).
	 * - returnBranchId mặc định = chi nhánh bán (đổi trả cùng chỗ), cho phép chọn
	 *   chi nhánh xử lý KHÁC (đổi trả ở chi nhánh khác).
	 */
	static async create(
		actor: ActorContext,
		data: {
			orderId: string;
			returnBranchId?: string;
			items: Array<{ variantId: string; quantity: number; reason?: string; lotId?: string }>;
			refundNote?: string;
		}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { ret: Record<string, unknown> })> {
		const loaded = await this.loadOrderInWindow(data.orderId);
		if (!loaded.ok) return { success: false, messages: loaded.messages };
		const order = loaded.order;

		if (!data.items || data.items.length === 0) {
			return { success: false, messages: adminMessages.invalidItems };
		}

		const originBranchId = (order.branchId ?? null) as string | null;
		const returnBranchId = data.returnBranchId || originBranchId;

		// Quyền tạo: returns:manage tại chi nhánh xử lý (mặc định nơi bán)
		const permError = await this.requirePermission(actor, 'returns:manage', returnBranchId);
		if (permError) return permError;

		// Chi nhánh xử lý phải tồn tại + active (khi khác chi nhánh bán)
		if (returnBranchId && returnBranchId !== originBranchId) {
			const branchRes = await cbBranches.document.get({ documentKey: returnBranchId });
			const branch = branchRes.ok ? (branchRes as any).data : null;
			if (!branch || branch.status !== 'active') {
				return { success: false, messages: adminMessages.branchNotFound };
			}
		}

		// Validate items thuộc đơn + tính refund theo price của đơn
		const orderItems: OrderItem[] = Array.isArray(order.items) ? order.items : [];
		const validatedItems: ReturnItem[] = [];
		let totalRefundAmount = 0;

		for (const item of data.items) {
			const purchased = orderItems.find((oi) => oi.variantId === item.variantId);
			const quantity = Math.floor(Number(item.quantity));
			if (!purchased || !Number.isFinite(quantity) || quantity <= 0 || quantity > Number(purchased.quantity)) {
				return { success: false, messages: adminMessages.variantNotInOrder };
			}
			const refundUnitPrice = Number(purchased.price);
			totalRefundAmount += refundUnitPrice * quantity;
			validatedItems.push({
				variantId: item.variantId,
				quantity,
				...(item.lotId ? { lotId: item.lotId } : {}),
				refundUnitPrice,
				...(item.reason ? { reason: item.reason } : {})
			});
		}

		const returnId = `return_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const now = new Date().toISOString();

		// Mã phiếu RT-YYYYMMDD-XXXX
		const datePart = now.slice(0, 10).replace(/-/g, '');
		const returnCode = `RT-${datePart}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

		const ret = {
			returnCode,
			orderId: data.orderId,
			originBranchId,
			returnBranchId,
			// Giữ field cũ cho tương thích client cũ (không lưu code mới đọc 2 nơi)
			branchId: returnBranchId,
			customerId: order.customerId ?? null,
			items: validatedItems,
			totalRefundAmount,
			refundNote: data.refundNote ?? null,
			status: 'requested' as ReturnStatus,
			handledBy: null,
			createdAt: now,
			updatedAt: now
		};

		const createRes = await cbReturns.document.create({
			documentKey: returnId,
			content: ret
		});
		if (!createRes.ok) {
			return { success: false, messages: adminMessages.createFailed };
		}

		void broadcastDbChange({ collection: 'order_returns', action: 'create', by: actor.userId });

		return { success: true, ret: sanitizeReturnForAdmin({ ...ret, _id: returnId }) };
	}

	// ========== STOCK RESTOCK (hoàn tồn kho chi nhánh xử lý) ==========

	/**
	 * Cộng tồn kho chi nhánh XỬ LÝ (returnBranchId) — pattern suppliers.receiveItemToStock:
	 * doc chưa có → tạo mới; có → cộng dồn N1QL `SET quantityOnHand = quantityOnHand + $n`.
	 */
	private static async restock(
		actor: ActorContext,
		variantId: string,
		branchId: string,
		quantity: number,
		referenceId: string,
		now: string
	): Promise<boolean> {
		const stockId = `stock_${variantId}_${branchId}`;
		const getRes = await cbInventoryStock.document.get({ documentKey: stockId });
		if (!getRes.ok) {
			const createRes = await cbInventoryStock.document.create({
				documentKey: stockId,
				content: {
					variantId,
					branchId,
					quantityOnHand: quantity,
					quantityReserved: 0,
					updatedAt: now
				}
			});
			if (!createRes.ok) return false;
		} else {
			const incRes = await cbInventoryStock.document.query({
				statement: `
					UPDATE ${inventoryStockKeyspace}
					SET quantityOnHand = quantityOnHand + $3, updatedAt = $4
					WHERE META().id = $1 AND variantId = $2
				`,
				args: [stockId, variantId, quantity, now],
				readonly: false
			});
			if (!incRes.ok) return false;
		}

		// Ghi stock movement 'in' — truy vết về phiếu đổi trả
		await cbStockMovements.document.create({
			documentKey: `${variantId}_${branchId}_${Date.now()}_rtrn${Math.random().toString(36).substring(2, 6)}`,
			content: {
				variantId,
				branchId,
				lotId: null,
				type: 'in',
				quantity,
				quantityBefore: null,
				quantityAfter: null,
				referenceType: 'order_return',
				referenceId,
				performedBy: actor.userId,
				note: 'Restock via customer return',
				createdAt: now
			}
		});

		return true;
	}

	// ========== STATUS TRANSITIONS ==========

	private static async loadReturn(returnId: string): Promise<{ ok: false } | { ok: true; ret: any }> {
		const res = await cbReturns.document.get({ documentKey: returnId });
		if (!res.ok) return { ok: false };
		return { ok: true, ret: (res as any).data };
	}

	/**
	 * Manager duyệt: requested → approved.
	 * Quyền: returns:manage tại chi nhánh XỬ LÝ (nơi hoàn kho).
	 */
	static async approve(
		actor: ActorContext,
		returnId: string
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { ret: Record<string, unknown> })> {
		const loaded = await this.loadReturn(returnId);
		if (!loaded.ok) return { success: false, messages: adminMessages.notFound };
		const ret = loaded.ret;

		const permError = await this.requirePermission(actor, 'returns:manage', ret.returnBranchId);
		if (permError) return permError;

		const scope = await PermissionChecker.getScope(actor.roleName, 'returns:read');
		if (scope === 'own_branch' && !this.isRelatedBranch(ret, actor.branchId)) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		if (!isValidTransition(String(ret.status), 'approved')) {
			return { success: false, messages: adminMessages.invalidStatusTransition };
		}

		const now = new Date().toISOString();
		ret.status = 'approved';
		ret.handledBy = actor.userId;
		ret.updatedAt = now;

		const updateRes = await cbReturns.document.update({ documentKey: returnId, content: ret });
		if (!updateRes.ok) return { success: false, messages: adminMessages.updateFailed };

		void broadcastDbChange({ collection: 'order_returns', action: 'set-status', by: actor.userId });
		return { success: true, ret: sanitizeReturnForAdmin({ ...ret, _id: returnId }) };
	}

	/**
	 * Từ chối: requested|approved → rejected.
	 */
	static async reject(
		actor: ActorContext,
		returnId: string
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { ret: Record<string, unknown> })> {
		const loaded = await this.loadReturn(returnId);
		if (!loaded.ok) return { success: false, messages: adminMessages.notFound };
		const ret = loaded.ret;

		const permError = await this.requirePermission(actor, 'returns:manage', ret.returnBranchId);
		if (permError) return permError;

		const scope = await PermissionChecker.getScope(actor.roleName, 'returns:read');
		if (scope === 'own_branch' && !this.isRelatedBranch(ret, actor.branchId)) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		if (!isValidTransition(String(ret.status), 'rejected')) {
			return { success: false, messages: adminMessages.invalidStatusTransition };
		}

		const now = new Date().toISOString();
		ret.status = 'rejected';
		ret.handledBy = actor.userId;
		ret.updatedAt = now;

		const updateRes = await cbReturns.document.update({ documentKey: returnId, content: ret });
		if (!updateRes.ok) return { success: false, messages: adminMessages.updateFailed };

		void broadcastDbChange({ collection: 'order_returns', action: 'set-status', by: actor.userId });
		return { success: true, ret: sanitizeReturnForAdmin({ ...ret, _id: returnId }) };
	}

	/**
	 * Hoàn tất: approved → completed.
	 * - HOÀN TỒN KHO: cộng lại quantity từng item tại chi nhánh XỬ LÝ (returnBranchId).
	 * - HOÀN TIỀN: chỉ GHI CHÚ (refundNote + completedAt) — không refund engine.
	 */
	static async complete(
		actor: ActorContext,
		returnId: string
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { ret: Record<string, unknown> })> {
		const loaded = await this.loadReturn(returnId);
		if (!loaded.ok) return { success: false, messages: adminMessages.notFound };
		const ret = loaded.ret;

		const permError = await this.requirePermission(actor, 'returns:manage', ret.returnBranchId);
		if (permError) return permError;

		const scope = await PermissionChecker.getScope(actor.roleName, 'returns:read');
		if (scope === 'own_branch' && !this.isRelatedBranch(ret, actor.branchId)) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		if (!isValidTransition(String(ret.status), 'completed')) {
			return { success: false, messages: adminMessages.invalidStatusTransition };
		}

		const now = new Date().toISOString();
		const items: ReturnItem[] = Array.isArray(ret.items) ? ret.items : [];

		// Hoàn tồn kho từng item tại chi nhánh xử lý
		for (const item of items) {
			const ok = await this.restock(actor, item.variantId, ret.returnBranchId, Number(item.quantity), returnId, now);
			if (!ok) return { success: false, messages: adminMessages.updateFailed };
		}

		ret.status = 'completed';
		ret.handledBy = actor.userId;
		ret.completedAt = now;
		ret.updatedAt = now;
		// Hoàn tiền ghi chú: không đụng payments/refund engine
		if (!ret.refundNote) ret.refundNote = `Refund ${Number(ret.totalRefundAmount ?? 0)} recorded (no refund engine)`;

		const updateRes = await cbReturns.document.update({ documentKey: returnId, content: ret });
		if (!updateRes.ok) return { success: false, messages: adminMessages.updateFailed };

		void broadcastDbChange({ collection: 'order_returns', action: 'set-status', by: actor.userId });
		return { success: true, ret: sanitizeReturnForAdmin({ ...ret, _id: returnId }) };
	}
}
