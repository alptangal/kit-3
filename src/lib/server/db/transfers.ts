// $lib/server/db/transfers.ts
// TransferService — chuyển kho giữa các chi nhánh (stock_transfers)
// Pattern: suppliers.ts (ActorContext, requirePermission, list/get/create/update, adminMessages)
//
// Luồng nghiệp vụ:
//   tạo (pending, do fromBranch yêu cầu)
//   → toBranch duyệt (in_transit — hàng rời kho gốc, kho TRỪ tại thời điểm duyệt)
//   → toBranch nhận hàng xong (completed — kho CỘNG tại chi nhánh nhận)
//   → huỷ (cancelled — chỉ khi pending hoặc in_transit; in_transit đã trừ kho gốc
//     nên huỷ hoàn kho gốc)
//
// Schema: src/lib/modules/schema.ts stock_transfers
//   { transferCode, fromBranchId, toBranchId, status, items[{productId, quantity, lotId?}], requestedBy, approvedBy, createdAt, completedAt }
// LƯU Ý: schema cũ ghi productId nhưng toàn hệ thống thao tác theo variantId
// (inventory_stock/stock_movements đều key theo variantId) → service dùng field
// `productId` chứa giá trị variantId (giữ đúng schema đã đăng ký collection).

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { ActorContext } from './users';
import { broadcastDbChange } from '../db-broadcast';

const cbTransfers = cbData('stock_transfers');
const cbInventoryStock = cbData('inventory_stock');
const cbStockMovements = cbData('stock_movements');
const cbBranches = cbData('branches');

const transfersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`stock_transfers\``;
const inventoryStockKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`inventory_stock\``;
const branchesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`branches\``;

const adminMessages = {
	notFound: {
		vi: 'Không tìm thấy phiếu chuyển kho',
		en: 'Stock transfer not found'
	} as TranslateContent,
	queryFailed: {
		vi: 'Truy vấn thất bại',
		en: 'Query failed'
	} as TranslateContent,
	createFailed: {
		vi: 'Tạo phiếu chuyển kho thất bại',
		en: 'Failed to create stock transfer'
	} as TranslateContent,
	updateFailed: {
		vi: 'Cập nhật phiếu chuyển kho thất bại',
		en: 'Failed to update stock transfer'
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
	} as TranslateContent,
	invalidItems: {
		vi: 'Danh sách mục chuyển kho không hợp lệ',
		en: 'Invalid transfer items'
	} as TranslateContent,
	sameBranch: {
		vi: 'Chi nhánh gửi và nhận phải khác nhau',
		en: 'Source and destination branches must be different'
	} as TranslateContent,
	branchNotFound: {
		vi: 'Không tìm thấy chi nhánh',
		en: 'Branch not found'
	} as TranslateContent,
	insufficientStock: {
		vi: 'Tồn kho không đủ tại chi nhánh gửi',
		en: 'Insufficient stock at source branch'
	} as TranslateContent
} as const;

const TRANSFER_ADMIN_SAFE_FIELDS = [
	'transferCode',
	'fromBranchId',
	'toBranchId',
	'status',
	'items',
	'requestedBy',
	'approvedBy',
	'createdAt',
	'completedAt'
] as const;

const VALID_STATUSES = ['pending', 'in_transit', 'completed', 'cancelled'] as const;
type TransferStatus = typeof VALID_STATUSES[number];

// Chuyển trạng thái hợp lệ:
// pending → in_transit (toBranch duyệt) | cancelled
// in_transit → completed | cancelled (hoàn kho gốc)
const VALID_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
	pending: ['in_transit', 'cancelled'],
	in_transit: ['completed', 'cancelled'],
	completed: [],
	cancelled: []
};

function isValidTransition(from: string, to: string): boolean {
	return (VALID_TRANSITIONS[from as TransferStatus] ?? []).includes(to as TransferStatus);
}

function sanitizeTransferForAdmin(doc: any & { _id: string }) {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of TRANSFER_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

interface TransferListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

type TransferItem = {
	// Tên field giữ theo schema (`productId`) — giá trị là variantId
	// (inventory_stock key theo variantId).
	productId: string;
	quantity: number;
	lotId?: string;
};

export class TransferService {
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

	/** Chi nhánh liên quan phiếu cho scope own_branch: fromBranchId HOẶC toBranchId. */
	private static isRelatedBranch(transfer: { fromBranchId?: string | null; toBranchId?: string | null }, branchId?: string): boolean {
		if (!branchId) return false;
		return transfer.fromBranchId === branchId || transfer.toBranchId === branchId;
	}

	/**
	 * List transfers (phân trang + filter status).
	 * Scope own_branch: thấy phiếu mà chi nhánh mình là from OR to.
	 */
	static async list(
		actor: ActorContext,
		options: {
			status?: string;
			branchId?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & TransferListResult)> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'transfers:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];

		if (scope === 'own_branch') {
			if (!actor.branchId) return { success: false, messages: adminMessages.permissionDenied };
			conditions.push('(fromBranchId = $' + (args.length + 1) + ' OR toBranchId = $' + (args.length + 1) + ')');
			args.push(actor.branchId, actor.branchId);
		}

		if (options.branchId) {
			conditions.push('(fromBranchId = $' + (args.length + 1) + ' OR toBranchId = $' + (args.length + 1) + ')');
			args.push(options.branchId, options.branchId);
		}

		if (options.status) {
			conditions.push('status = $' + (args.length + 1));
			args.push(options.status);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = 'META().id AS _id, ' + TRANSFER_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ');

		const [countRes, dataRes] = await Promise.all([
			cbTransfers.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${transfersKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbTransfers.document.query({
				statement: `SELECT ${selectClause} FROM ${transfersKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []).map(sanitizeTransferForAdmin);

		return { success: true, items, total, page, pageSize };
	}

	/**
	 * Get 1 transfer — own_branch chỉ thấy phiếu liên quan chi nhánh mình.
	 */
	static async get(
		actor: ActorContext,
		transferId: string
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { transfer: Record<string, unknown> })> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'transfers:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const res = await cbTransfers.document.get({ documentKey: transferId });
		if (!res.ok) {
			return { success: false, messages: adminMessages.notFound };
		}

		const transfer = (res as any).data;

		if (scope === 'own_branch' && !this.isRelatedBranch(transfer, actor.branchId)) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		return { success: true, transfer: sanitizeTransferForAdmin({ ...transfer, _id: transferId }) };
	}

	/**
	 * Tạo yêu cầu chuyển kho (status 'pending').
	 * - fromBranch/toBranch phải khác nhau và đều tồn tại (status active).
	 * - items: mỗi item {productId (variantId), quantity, lotId?}.
	 * - KHÔNG trừ kho lúc tạo — chỉ trừ khi toBranch duyệt (approve).
	 */
	static async create(
		actor: ActorContext,
		data: {
			fromBranchId: string;
			toBranchId: string;
			items: Array<{ productId: string; quantity: number; lotId?: string }>;
			notes?: string;
		}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { transfer: Record<string, unknown> })> {
		// Quyền tạo: transfers:manage trên chi nhánh GỬI
		const permError = await this.requirePermission(actor, 'transfers:manage', data.fromBranchId);
		if (permError) return permError;

		if (!data.items || data.items.length === 0) {
			return { success: false, messages: adminMessages.invalidItems };
		}
		for (const item of data.items) {
			if (!item.productId || !Number.isFinite(Number(item.quantity)) || Math.floor(Number(item.quantity)) <= 0) {
				return { success: false, messages: adminMessages.invalidItems };
			}
		}

		if (data.fromBranchId === data.toBranchId) {
			return { success: false, messages: adminMessages.sameBranch };
		}

		// 2 branch phải tồn tại + active
		const branchIds = [data.fromBranchId, data.toBranchId];
		for (const branchId of branchIds) {
			const branchRes = await cbBranches.document.get({ documentKey: branchId });
			const branch = branchRes.ok ? (branchRes as any).data : null;
			if (!branch || branch.status !== 'active') {
				return { success: false, messages: adminMessages.branchNotFound };
			}
		}

		const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const now = new Date().toISOString();

		// Mã phiếu TR-YYYYMMDD-XXXX (4 ký tự cuối uuid)
		const datePart = now.slice(0, 10).replace(/-/g, '');
		const transferCode = `TR-${datePart}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

		const items: TransferItem[] = data.items.map((item) => ({
			productId: item.productId,
			quantity: Math.floor(Number(item.quantity)),
			...(item.lotId ? { lotId: item.lotId } : {})
		}));

		const transfer = {
			transferCode,
			fromBranchId: data.fromBranchId,
			toBranchId: data.toBranchId,
			status: 'pending' as TransferStatus,
			items,
			requestedBy: actor.userId,
			approvedBy: null,
			createdAt: now,
			completedAt: null,
			notes: data.notes ?? null
		};

		const createRes = await cbTransfers.document.create({
			documentKey: transferId,
			content: transfer
		});
		if (!createRes.ok) {
			return { success: false, messages: adminMessages.createFailed };
		}

		void broadcastDbChange({ collection: 'stock_transfers', action: 'create', by: actor.userId });

		return { success: true, transfer: sanitizeTransferForAdmin({ ...transfer, _id: transferId }) };
	}

	// ========== STOCK HELPERS (pattern suppliers.receiveItemToStock) ==========

	/**
	 * Trừ tồn kho chi nhánh gửi (khi duyệt, in_transit).
	 * Kiểm tra đủ tồn trước (getStock) rồi UPDATE điều kiện theo số cũ chống race.
	 * Trả { ok, reason } — reason 'insufficient' | 'not_found' | 'failed'.
	 */
	private static async deductStock(
		actor: ActorContext,
		variantId: string,
		branchId: string,
		quantity: number,
		referenceId: string,
		now: string
	): Promise<{ ok: boolean; reason?: 'insufficient' | 'not_found' | 'failed' }> {
		const stockId = `stock_${variantId}_${branchId}`;
		const getRes = await cbInventoryStock.document.get({ documentKey: stockId });
		if (!getRes.ok) return { ok: false, reason: 'not_found' };

		const stock = (getRes as any).data as { quantityOnHand?: number; variantId?: string };
		const current = Number(stock?.quantityOnHand ?? 0);
		if (current < quantity) return { ok: false, reason: 'insufficient' };

		// UPDATE điều kiện theo số cũ — atomic, chống race
		const incRes = await cbInventoryStock.document.query({
			statement: `
				UPDATE ${inventoryStockKeyspace}
				SET quantityOnHand = quantityOnHand - $3, updatedAt = $4
				WHERE META().id = $1 AND variantId = $2 AND quantityOnHand = $5
			`,
			args: [stockId, variantId, quantity, now, current],
			readonly: false
		});
		if (!incRes.ok) return { ok: false, reason: 'failed' };
		if ((incRes.data?.results?.length ?? 0) === 0) return { ok: false, reason: 'failed' };

		// Ghi stock movement 'out' (pattern InventoryService.recordStockMovement)
		await cbStockMovements.document.create({
			documentKey: `${variantId}_${branchId}_${Date.now()}_trsf${Math.random().toString(36).substring(2, 6)}`,
			content: {
				variantId,
				branchId,
				lotId: null,
				type: 'out',
				quantity,
				quantityBefore: current,
				quantityAfter: current - quantity,
				referenceType: 'stock_transfer',
				referenceId,
				performedBy: actor.userId,
				note: 'Transfer sent to destination branch',
				createdAt: now
			}
		});

		return { ok: true };
	}

	/**
	 * Cộng tồn kho chi nhánh nhận (khi hoàn tất, completed).
	 * Doc chưa có → tạo mới; có → cộng dồn N1QL (pattern suppliers.receiveItemToStock).
	 */
	private static async addStock(
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
			// Chưa có doc tồn kho tại chi nhánh nhận → tạo mới
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

		// Ghi stock movement 'in'
		await cbStockMovements.document.create({
			documentKey: `${variantId}_${branchId}_${Date.now()}_trsi${Math.random().toString(36).substring(2, 6)}`,
			content: {
				variantId,
				branchId,
				lotId: null,
				type: 'in',
				quantity,
				quantityBefore: null,
				quantityAfter: null,
				referenceType: 'stock_transfer',
				referenceId,
				performedBy: actor.userId,
				note: 'Transfer received from source branch',
				createdAt: now
			}
		});

		return true;
	}

	// ========== STATUS TRANSITIONS ==========

	/** Load transfer doc (không permission — dùng nội bộ sau khi đã check quyền). */
	private static async loadTransfer(transferId: string): Promise<{ ok: false } | { ok: true; transfer: any }> {
		const res = await cbTransfers.document.get({ documentKey: transferId });
		if (!res.ok) return { ok: false };
		return { ok: true, transfer: (res as any).data };
	}

	private static async saveTransfer(transferId: string, transfer: any): Promise<boolean> {
		const res = await cbTransfers.document.update({ documentKey: transferId, content: transfer });
		return res.ok;
	}

	/**
	 * toBranch duyệt: pending → in_transit. TRỪ kho chi nhánh gửi NGAY LÚC DUYỆT
	 * (hàng rời kho). Nếu không đủ tồn → lỗi insufficientStock, giữ pending.
	 */
	static async approve(
		actor: ActorContext,
		transferId: string
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { transfer: Record<string, unknown> })> {
		const loaded = await this.loadTransfer(transferId);
		if (!loaded.ok) return { success: false, messages: adminMessages.notFound };
		const transfer = loaded.transfer;

		// Quyền duyệt thuộc chi nhánh NHẬN
		const permError = await this.requirePermission(actor, 'transfers:manage', transfer.toBranchId);
		if (permError) return permError;

		const scope = await PermissionChecker.getScope(actor.roleName, 'transfers:manage');
		if (scope === 'own_branch' && !this.isRelatedBranch(transfer, actor.branchId)) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		if (!isValidTransition(String(transfer.status), 'in_transit')) {
			return { success: false, messages: adminMessages.invalidStatusTransition };
		}

		const now = new Date().toISOString();
		const items: TransferItem[] = Array.isArray(transfer.items) ? transfer.items : [];

		// Trừ kho từng item tại chi nhánh gửi
		for (const item of items) {
			const result = await this.deductStock(actor, item.productId, transfer.fromBranchId, Number(item.quantity), transferId, now);
			if (!result.ok) {
				if (result.reason === 'not_found') {
					return { success: false, messages: adminMessages.notFound };
				}
				if (result.reason === 'insufficient') {
					return { success: false, messages: adminMessages.insufficientStock };
				}
				return { success: false, messages: adminMessages.updateFailed };
			}
		}

		transfer.status = 'in_transit';
		transfer.approvedBy = actor.userId;
		transfer.approvedAt = now;
		if (!this.saveTransfer(transferId, transfer)) {
			return { success: false, messages: adminMessages.updateFailed };
		}

		void broadcastDbChange({ collection: 'stock_transfers', action: 'set-status', by: actor.userId });
		return { success: true, transfer: sanitizeTransferForAdmin({ ...transfer, _id: transferId }) };
	}

	/**
	 * toBranch nhận hàng xong: in_transit → completed. CỘNG kho chi nhánh nhận.
	 */
	static async complete(
		actor: ActorContext,
		transferId: string
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { transfer: Record<string, unknown> })> {
		const loaded = await this.loadTransfer(transferId);
		if (!loaded.ok) return { success: false, messages: adminMessages.notFound };
		const transfer = loaded.transfer;

		const permError = await this.requirePermission(actor, 'transfers:manage', transfer.toBranchId);
		if (permError) return permError;

		const scope = await PermissionChecker.getScope(actor.roleName, 'transfers:manage');
		if (scope === 'own_branch' && !this.isRelatedBranch(transfer, actor.branchId)) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		if (!isValidTransition(String(transfer.status), 'completed')) {
			return { success: false, messages: adminMessages.invalidStatusTransition };
		}

		const now = new Date().toISOString();
		const items: TransferItem[] = Array.isArray(transfer.items) ? transfer.items : [];

		// Cộng kho từng item tại chi nhánh nhận
		for (const item of items) {
			const ok = await this.addStock(actor, item.productId, transfer.toBranchId, Number(item.quantity), transferId, now);
			if (!ok) return { success: false, messages: adminMessages.updateFailed };
		}

		transfer.status = 'completed';
		transfer.completedAt = now;
		if (!this.saveTransfer(transferId, transfer)) {
			return { success: false, messages: adminMessages.updateFailed };
		}

		void broadcastDbChange({ collection: 'stock_transfers', action: 'set-status', by: actor.userId });
		return { success: true, transfer: sanitizeTransferForAdmin({ ...transfer, _id: transferId }) };
	}

	/**
	 * Huỷ phiếu: pending → cancelled (không đổi gì kho) hoặc
	 * in_transit → cancelled (đã trừ kho gốc → HOÀN kho gốc).
	 */
	static async cancel(
		actor: ActorContext,
		transferId: string
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & { transfer: Record<string, unknown> })> {
		const loaded = await this.loadTransfer(transferId);
		if (!loaded.ok) return { success: false, messages: adminMessages.notFound };
		const transfer = loaded.transfer;

		// Huỷ: either branch (gửi hoặc nhận) với transfers:manage
		const permFrom = await this.requirePermission(actor, 'transfers:manage', transfer.fromBranchId);
		const permTo = await this.requirePermission(actor, 'transfers:manage', transfer.toBranchId);
		if (permFrom && permTo) return { success: false, messages: adminMessages.permissionDenied };

		const scope = await PermissionChecker.getScope(actor.roleName, 'transfers:manage');
		if (scope === 'own_branch' && !this.isRelatedBranch(transfer, actor.branchId)) {
			return { success: false, messages: adminMessages.permissionDenied };
		}

		if (!isValidTransition(String(transfer.status), 'cancelled')) {
			return { success: false, messages: adminMessages.invalidStatusTransition };
		}

		const now = new Date().toISOString();
		const items: TransferItem[] = Array.isArray(transfer.items) ? transfer.items : [];

		// in_transit đã trừ kho gốc → hoàn lại
		if (transfer.status === 'in_transit') {
			for (const item of items) {
				const ok = await this.addStock(actor, item.productId, transfer.fromBranchId, Number(item.quantity), transferId, now);
				if (!ok) return { success: false, messages: adminMessages.updateFailed };
			}
		}

		transfer.status = 'cancelled';
		transfer.cancelledAt = now;
		transfer.cancelledBy = actor.userId;
		if (!this.saveTransfer(transferId, transfer)) {
			return { success: false, messages: adminMessages.updateFailed };
		}

		void broadcastDbChange({ collection: 'stock_transfers', action: 'set-status', by: actor.userId });
		return { success: true, transfer: sanitizeTransferForAdmin({ ...transfer, _id: transferId }) };
	}
}

// (Helper scope cho transition nằm trong class — xem requirePermission/isRelatedBranch.)
