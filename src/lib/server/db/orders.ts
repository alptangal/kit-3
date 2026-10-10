// $lib/server/db/orders.ts
// OrderAdminService — các thao tác QUẢN TRỊ trên đơn hàng (orders)
// Theo pattern ProductAdminService + UserAdminService

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { orders as orderMessages, customers as customerMessages } from '../messages/db';

const cbOrders = cbData('orders');
const cbVariants = cbData('product_variants');
const cbUsers = cbData('users');

const ordersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`orders\``;
const variantsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\``;
const usersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`users\``;

const adminMessages = {
	notFound: orderMessages.notFound,
	queryFailed: orderMessages.queryFailed,
	createFailed: orderMessages.createFailed,
	updateFailed: orderMessages.updateFailed,
	deleteFailed: orderMessages.deleteFailed,
	permissionDenied: orderMessages.permissionDenied,
	variantNotFound: orderMessages.variantNotFound,
	itemsRequired: orderMessages.itemsRequired,
	customerRequired: orderMessages.customerRequired,
	invalidStatus: orderMessages.invalidStatus,
	invalidStatusTransition: orderMessages.invalidStatusTransition,
	statusUpdated: orderMessages.statusUpdated,
	statsFailed: orderMessages.statsFailed,
	customerNotFound: orderMessages.customerNotFound
} as const;

const ORDER_ADMIN_SAFE_FIELDS = [
	'orderCode',
	'customerId',
	'staffId',
	'branchId',
	'status',
	'items',
	'totalAmount',
	'createdAt',
	'updatedAt'
] as const;

type OrderItem = {
	variantId: string;
	lotId?: string;
	quantity: number;
	price: number;
};

interface OrderDocument {
	_id: string;
	orderCode: string;
	customerId: string;
	staffId: string;
	branchId: string | null;
	status: string;
	items: OrderItem[];
	totalAmount: number;
	createdAt: string;
	updatedAt: string;
}

interface OrderAdminListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

interface OrderStatsResult {
	totalOrders: number;
	todayOrders: number;
	deliveredRevenue: number;
	statusBreakdown: Record<string, number>;
}

function sanitizeOrderForAdmin(doc: OrderDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of ORDER_ADMIN_SAFE_FIELDS) {
		safe[field] = doc[field];
	}
	return safe;
}

export class OrderAdminService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetBranchId?: string | null,
		targetUserId?: string
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			targetBranchId,
			actorUserId: actor.userId,
			targetUserId
		});
		if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
		return null;
	}

	// Valid status flow: pending → confirmed → shipped → delivered
	// cancelled can be from pending/confirmed only
	// delivered and cancelled are terminal states
	private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
		pending: ['confirmed', 'cancelled'],
		confirmed: ['shipped', 'cancelled'],
		shipped: ['delivered'],
		delivered: [],
		cancelled: []
	};

	private static isValidTransition(from: string, to: string): boolean {
		const allowed = this.VALID_TRANSITIONS[from];
		return allowed ? allowed.includes(to) : false;
	}

	static async list(
		actor: ActorContext,
		options: {
			page?: number;
			pageSize?: number;
			includeDeleted?: boolean;
			search?: string;
			status?: string;
			customerId?: string;
			startDate?: string;
			endDate?: string;
		} = {}
	): Promise<{ success: false; messages: TranslateContent } | ({ success: true } & OrderAdminListResult)> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'orders:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: (string | number)[] = [];

		if (scope === 'own_branch') {
			if (!actor.branchId) {
				return { success: false, messages: adminMessages.permissionDenied };
			}
			args.push(actor.branchId);
			conditions.push(`branchId = $${args.length}`);
		} else if (scope === 'own_records') {
			args.push(actor.userId);
			conditions.push(`staffId = $${args.length}`);
		}

		if (!options.includeDeleted) {
			conditions.push('(deletedAt IS NULL OR deletedAt IS MISSING)');
		}

		if (options.search) {
			args.push(`%${options.search}%`);
			conditions.push(`orderCode LIKE $${args.length}`);
		}

		if (options.status) {
			args.push(options.status);
			conditions.push(`status = $${args.length}`);
		}

		if (options.customerId) {
			args.push(options.customerId);
			conditions.push(`customerId = $${args.length}`);
		}

		if (options.startDate) {
			args.push(options.startDate);
			conditions.push(`createdAt >= $${args.length}`);
		}

		if (options.endDate) {
			args.push(options.endDate);
			conditions.push(`createdAt <= $${args.length}`);
		}

		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const selectClause = `META().id AS _id, ${ORDER_ADMIN_SAFE_FIELDS.map((f) => `\`${f}\``).join(', ')}`;

		const [countRes, dataRes] = await Promise.all([
			cbOrders.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${ordersKeyspace} ${whereClause}`,
				args,
				readonly: true
			}),
			cbOrders.document.query({
				statement: `SELECT ${selectClause} FROM ${ordersKeyspace} ${whereClause} ORDER BY createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
				args,
				readonly: true
			})
		]);

		if (!countRes.ok || !dataRes.ok) {
			return { success: false, messages: adminMessages.queryFailed };
		}

		const total = Number(countRes.data?.results?.[0] ?? 0);
		const items = (dataRes.data?.results ?? []).map(sanitizeOrderForAdmin);

		return { success: true, items, total, page, pageSize };
	}

	static async getById(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: false; messages: TranslateContent } | { success: true; data: Record<string, unknown> }> {
		const denied = await this.requirePermission(actor, 'orders:read', null, documentKey);
		if (denied) return denied;

		const res = await cbOrders.document.get({ documentKey });
		if (!res.ok || !res.data) {
			return { success: false, messages: adminMessages.notFound };
		}

		return { success: true, data: sanitizeOrderForAdmin({ ...res.data as OrderDocument, _id: documentKey }) };
	}

	static async create(
		actor: ActorContext,
		data: {
			customerId: string;
			items: Array<{ variantId: string; lotId?: string; quantity: number; price?: number }>;
			branchId?: string | null;
			status?: string;
		}
	): Promise<{ success: boolean; messages: TranslateContent; documentKey?: string }> {
		const denied = await this.requirePermission(actor, 'orders:create');
		if (denied) return denied;

		// Validate items
		if (!data.items || data.items.length === 0) {
			return { success: false, messages: adminMessages.itemsRequired };
		}

		// Validate customer exists and has role-customer
		const customerRes = await cbUsers.document.get({ documentKey: data.customerId });
		if (!customerRes.ok || !customerRes.data) {
			return { success: false, messages: adminMessages.customerNotFound };
		}
		const customer = customerRes.data as { roleId?: string; deletedAt?: string };
		if (customer.roleId !== 'role-customer') {
			return { success: false, messages: adminMessages.customerNotFound };
		}
		if (customer.deletedAt) {
			return { success: false, messages: adminMessages.customerNotFound };
		}

		// Validate each variant and calculate totalAmount
		let totalAmount = 0;
		const validatedItems: OrderItem[] = [];

		for (const item of data.items) {
			const variantRes = await cbVariants.document.get({ documentKey: item.variantId });
			if (!variantRes.ok || !variantRes.data) {
				return { success: false, messages: adminMessages.variantNotFound };
			}
			const variant = variantRes.data as { price: number; status?: string; deletedAt?: string };
			if (variant.status !== 'active' || variant.deletedAt) {
				return { success: false, messages: adminMessages.variantNotFound };
			}

			const price = item.price ?? variant.price;
			const quantity = Math.max(1, Math.floor(item.quantity));
			totalAmount += price * quantity;

			validatedItems.push({
				variantId: item.variantId,
				lotId: item.lotId,
				quantity,
				price
			});
		}

		const now = new Date().toISOString();
		const documentKey = `order::${crypto.randomUUID()}`;

		// Generate orderCode: ORD-YYYYMMDD-XXXX (last 4 of uuid)
		const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
		const uuidPart = crypto.randomUUID().slice(0, 4).toUpperCase();
		const orderCode = `ORD-${datePart}-${uuidPart}`;

		const orderDoc: Omit<OrderDocument, '_id'> = {
			orderCode,
			customerId: data.customerId,
			staffId: actor.userId,
			branchId: data.branchId ?? actor.branchId ?? null,
			status: data.status ?? 'pending',
			items: validatedItems,
			totalAmount,
			createdAt: now,
			updatedAt: now
		};

		try {
			const res = await cbOrders.document.create({
				documentKey,
				content: orderDoc
			});
			if (!res.ok) return { success: false, messages: adminMessages.createFailed };
			return { success: true, messages: { vi: 'Tạo đơn hàng thành công', en: 'Order created successfully' }, documentKey };
		} catch {
			return { success: false, messages: adminMessages.createFailed };
		}
	}

	static async update(
		actor: ActorContext,
		documentKey: string,
		data: {
			items?: Array<{ variantId: string; lotId?: string; quantity: number; price?: number }>;
			status?: string;
		}
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbOrders.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.notFound };

		const denied = await this.requirePermission(actor, 'orders:update', null, documentKey);
		if (denied) return denied;

		const order = target.data as OrderDocument;

		// If updating status, validate transition
		if (data.status !== undefined) {
			if (!this.isValidTransition(order.status, data.status)) {
				return { success: false, messages: adminMessages.invalidStatusTransition };
			}
		}

		// If updating items, recalculate totalAmount
		let validatedItems: OrderItem[] | undefined;
		let totalAmount: number | undefined;

		if (data.items !== undefined) {
			if (!data.items || data.items.length === 0) {
				return { success: false, messages: adminMessages.itemsRequired };
			}

			let newTotal = 0;
			validatedItems = [];

			for (const item of data.items) {
				const variantRes = await cbVariants.document.get({ documentKey: item.variantId });
				if (!variantRes.ok || !variantRes.data) {
					return { success: false, messages: adminMessages.variantNotFound };
				}
				const variant = variantRes.data as { price: number; status?: string; deletedAt?: string };
				if (variant.status !== 'active' || variant.deletedAt) {
					return { success: false, messages: adminMessages.variantNotFound };
				}

				const price = item.price ?? variant.price;
				const quantity = Math.max(1, Math.floor(item.quantity));
				newTotal += price * quantity;

				validatedItems.push({
					variantId: item.variantId,
					lotId: item.lotId,
					quantity,
					price
				});
			}
			totalAmount = newTotal;
		}

		const updatePayload: Partial<OrderDocument> = { updatedAt: new Date().toISOString() };
		if (data.status !== undefined) updatePayload.status = data.status;
		if (validatedItems !== undefined) updatePayload.items = validatedItems;
		if (totalAmount !== undefined) updatePayload.totalAmount = totalAmount;

		try {
			const res = await cbOrders.document.update({ documentKey, content: updatePayload as OrderDocument });
			if (!res.ok) return { success: false, messages: adminMessages.updateFailed };
			return { success: true, messages: { vi: 'Cập nhật đơn hàng thành công', en: 'Order updated successfully' } };
		} catch {
			return { success: false, messages: adminMessages.updateFailed };
		}
	}

	static async delete(
		actor: ActorContext,
		documentKey: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbOrders.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.notFound };

		const denied = await this.requirePermission(actor, 'orders:delete', null, documentKey);
		if (denied) return denied;

		// Soft delete
		try {
			const res = await cbOrders.document.update({
				documentKey,
				content: { deletedAt: new Date().toISOString() } as Partial<OrderDocument> as OrderDocument
			});
			if (!res.ok) return { success: false, messages: adminMessages.deleteFailed };
			return { success: true, messages: { vi: 'Xoá đơn hàng thành công', en: 'Order deleted successfully' } };
		} catch {
			return { success: false, messages: adminMessages.deleteFailed };
		}
	}

	static async setStatus(
		actor: ActorContext,
		documentKey: string,
		status: string
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const target = await cbOrders.document.get({ documentKey });
		if (!target.ok || !target.data) return { success: false, messages: adminMessages.notFound };

		const denied = await this.requirePermission(actor, 'orders:update', null, documentKey);
		if (denied) return denied;

		const order = target.data as OrderDocument;

		if (!this.isValidTransition(order.status, status)) {
			return { success: false, messages: adminMessages.invalidStatusTransition };
		}

		try {
			const res = await cbOrders.document.update({
				documentKey,
				content: { status, updatedAt: new Date().toISOString() } as Partial<OrderDocument> as OrderDocument
			});
			if (!res.ok) return { success: false, messages: adminMessages.updateFailed };
			return { success: true, messages: adminMessages.statusUpdated };
		} catch {
			return { success: false, messages: adminMessages.updateFailed };
		}
	}

	static async getStats(
		actor: ActorContext
	): Promise<{ success: false; messages: TranslateContent } | { success: true; data: OrderStatsResult }> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'orders:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };

		// Điều kiện scope (branch/nhân viên phụ trách) dùng chung cho 4 query —
		// mỗi query tự nối chuỗi WHERE cho đúng bộ args của nó (tránh replace
		// chuỗi SQL dễ vỡ như bản cũ: mất WHERE khi chỉ có filter createdAt).
		const scopeConditions: string[] = [];
		const scopeArgs: (string | number)[] = [];
		if (scope === 'own_branch') {
			if (!actor.branchId) return { success: false, messages: adminMessages.permissionDenied };
			scopeArgs.push(actor.branchId);
			scopeConditions.push(`branchId = $${scopeArgs.length}`);
		} else if (scope === 'own_records') {
			scopeArgs.push(actor.userId);
			scopeConditions.push(`staffId = $${scopeArgs.length}`);
		}

		// Filter "chưa xoá" cho mọi count (đơn soft-delete không tính vào stats)
		const notDeleted = ['(deletedAt IS NULL OR deletedAt IS MISSING)'];
		const buildWhere = (extraConditions: string[], args: (string | number)[]) => {
			const all = [...notDeleted, ...scopeConditions, ...extraConditions];
			return all.length ? `WHERE ${all.join(' AND ')}` : '';
		};

		try {
			// Total orders — mọi đơn chưa xoá trong scope
			const totalRes = await cbOrders.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${ordersKeyspace} ${buildWhere([], scopeArgs)}`,
				args: scopeArgs,
				readonly: true
			});

			// Today orders — createdAt >= đầu hôm nay (ISO string so lexical OK)
			const todayArgs = [...scopeArgs, new Date().toISOString().slice(0, 10)];
			const todayRes = await cbOrders.document.query({
				statement: `SELECT RAW COUNT(*) FROM ${ordersKeyspace} ${buildWhere([`createdAt >= $${todayArgs.length}`], todayArgs)}`,
				args: todayArgs,
				readonly: true
			});

			// Delivered revenue — SUM(totalAmount) các đơn đã giao
			const revenueArgs = [...scopeArgs, 'delivered'];
			const revenueRes = await cbOrders.document.query({
				statement: `SELECT RAW SUM(totalAmount) FROM ${ordersKeyspace} ${buildWhere([`status = $${revenueArgs.length}`], revenueArgs)}`,
				args: revenueArgs,
				readonly: true
			});

			// Status breakdown — group theo status trong scope.
			// N1QL: RAW chỉ hợp lệ khi SELECT có duy nhất 1 biểu thức — dùng
			// COUNT(*) AS count thông thường rồi đọc field `count` từ kết quả.
			const statusRes = await cbOrders.document.query({
				statement: `SELECT status, COUNT(*) AS count FROM ${ordersKeyspace} ${buildWhere([], scopeArgs)} GROUP BY status`,
				args: scopeArgs,
				readonly: true
			});

			if (!totalRes.ok || !todayRes.ok || !revenueRes.ok || !statusRes.ok) {
				return { success: false, messages: adminMessages.statsFailed };
			}

			const totalOrders = Number(totalRes.data?.results?.[0] ?? 0);
			const todayOrders = Number(todayRes.data?.results?.[0] ?? 0);
			const deliveredRevenue = Number(revenueRes.data?.results?.[0] ?? 0);

			const statusBreakdown: Record<string, number> = {};
			for (const row of statusRes.data?.results ?? []) {
				const r = row as { status: string; count: number };
				statusBreakdown[r.status] = r.count;
			}

			return { success: true, data: { totalOrders, todayOrders, deliveredRevenue, statusBreakdown } };
		} catch {
			return { success: false, messages: adminMessages.statsFailed };
		}
	}
}