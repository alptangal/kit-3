// $lib/server/db/fulfillment.ts
// FulfillmentService — ĐIỀU PHỐI xử lý đơn hàng gộp POS + online (Phase 5 #40)
// Queue đơn paid/confirmed chờ xử lý; markFulfilled → shipped + tạo shipment nếu online;
// markAwaitingPickup cho đơn click-and-collect.

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { fulfillment as fulfillmentMessages } from '../messages/db';

const cbOrders = cbData('orders');
const cbShipments = cbData('shipments');
const ordersKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`orders\``;
const shipmentsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`shipments\``;

const adminMessages = {
	notFound: fulfillmentMessages.notFound,
	queryFailed: fulfillmentMessages.queryFailed,
	permissionDenied: fulfillmentMessages.permissionDenied,
	invalidStatus: fulfillmentMessages.invalidStatus,
	invalidPickupStatus: fulfillmentMessages.invalidPickupStatus,
	fulfillFailed: fulfillmentMessages.fulfillFailed,
	fulfilled: fulfillmentMessages.fulfilled,
	awaitingPickup: fulfillmentMessages.awaitingPickup
} as const;

/** Đơn chờ xử lý: paid (online đã trả tiền) + confirmed (POS/online đã xác nhận) */
const QUEUE_STATUSES = ['paid', 'confirmed'] as const;

const FULFILLMENT_SAFE_FIELDS = [
	'orderCode',
	'customerId',
	'staffId',
	'branchId',
	'status',
	'channel',
	'fulfillmentMethod',
	'items',
	'totalAmount',
	'createdAt',
	'updatedAt'
] as const;

interface OrderDocument {
	_id: string;
	orderCode: string;
	customerId: string;
	staffId: string;
	branchId: string | null;
	status: string;
	channel?: string; // 'pos' | 'online' | undefined (đơn cũ)
	fulfillmentMethod?: string; // 'shipping' | 'pickup' | undefined
	items: { variantId: string; quantity: number; price: number }[];
	totalAmount: number;
	createdAt: string;
	updatedAt: string;
}

export interface FulfillmentQueueResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

function sanitizeOrderForFulfillment(doc: OrderDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of FULFILLMENT_SAFE_FIELDS) {
		if (doc[field] !== undefined) safe[field] = (doc as unknown as Record<string, unknown>)[field];
	}
	// Channel suy ra cho đơn cũ: staffId + không channel → coi như POS
	if (safe.channel === undefined) safe.channel = 'pos';
	return safe;
}

export class FulfillmentService {
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
	 * Hàng chờ xử lý đơn: gộp POS + online (status paid/confirmed).
	 * branchId lọc theo chi nhánh (scope own_branch tự thêm điều kiện).
	 */
	static async listFulfillmentQueue(
		actor: ActorContext,
		options: { branchId?: string; page?: number; pageSize?: number } = {}
	): Promise<
		| { success: true; data: FulfillmentQueueResult }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'fulfillment:read');
		if (denied) return denied;

		try {
			const page = Math.max(1, options.page ?? 1);
			const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
			const offset = (page - 1) * pageSize;

			const conditions: string[] = [
				'(o.deletedAt IS NULL OR o.deletedAt IS MISSING)',
				`o.status IN $1`
			];
			const args: (string | number | string[])[] = [[...QUEUE_STATUSES]];

			const targetBranchId = options.branchId ?? null;
			if (targetBranchId) {
				conditions.push(`o.branchId = $${args.length + 1}`);
				args.push(targetBranchId);
			}

			const whereClause = `WHERE ${conditions.join(' AND ')}`;

			const dataStatement = `
				SELECT o.*, META().id AS _id
				FROM ${ordersKeyspace} o
				${whereClause}
				ORDER BY o.createdAt ASC
				LIMIT $${args.length + 1} OFFSET $${args.length + 2}
			`.trim();
			const dataArgs = [...args, pageSize, offset] as (string | number)[];

			const countStatement = `
				SELECT RAW COUNT(*) AS total
				FROM ${ordersKeyspace} o
				${whereClause}
			`.trim();

			const [dataRes, countRes] = await Promise.all([
				cbOrders.document.query({ statement: dataStatement, args: dataArgs, readonly: true }),
				cbOrders.document.query({
					statement: countStatement,
					args: args as (string | number)[],
					readonly: true
				})
			]);

			if (!dataRes.ok || !countRes.ok) {
				return { success: false, messages: adminMessages.queryFailed };
			}
			const rows = (dataRes.data?.results ?? []) as unknown as OrderDocument[];
			const total = Number(countRes.data?.results?.[0] ?? 0);

			return {
				success: true,
				data: {
					items: rows.map(sanitizeOrderForFulfillment),
					total,
					page,
					pageSize
				}
			};
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/**
	 * Xử lý xong đơn: status → shipped.
	 * Đơn online (channel='online', fulfillmentMethod='shipping') → tạo shipment record.
	 * Đơn pickup không tạo shipment.
	 */
	static async markFulfilled(
		actor: ActorContext,
		orderId: string,
		info: { carrier?: string; trackingNumber?: string } = {}
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		try {
			const statement = `SELECT o.*, META().id AS _id FROM ${ordersKeyspace} o WHERE META().id = $1 LIMIT 1`;
			const res = await cbOrders.document.query({ statement, args: [orderId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as OrderDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			const denied = await this.requirePermission(actor, 'fulfillment:manage', doc.branchId);
			if (denied) return denied;

			if (!(QUEUE_STATUSES as readonly string[]).includes(doc.status)) {
				return { success: false, messages: adminMessages.invalidStatus };
			}

			const now = new Date().toISOString();
			const channel = doc.channel ?? 'pos';
			const isOnlineShipping = channel === 'online' && doc.fulfillmentMethod !== 'pickup';

			// Đơn online giao tận nơi → tạo vận đơn nội bộ (staff nhập carrier/tracking)
			if (isOnlineShipping) {
				const shipmentDoc = {
					orderId,
					provider: info.carrier ?? 'internal',
					trackingNumber: info.trackingNumber ?? '',
					recipientName: '',
					recipientPhone: '',
					cost: 0,
					status: 'label_created',
					statusHistory: [{ status: 'label_created', timestamp: now }],
					externalData: {},
					createdAt: now,
					updatedAt: now
				};
				const shipmentId = `shipment::${orderId}::${Date.now()}`;
				const shipmentRes = await cbShipments.document.create({
					documentKey: shipmentId,
					content: shipmentDoc
				});
				if (!shipmentRes.ok) return { success: false, messages: adminMessages.fulfillFailed };
			}

			const updateStatement = `
				UPDATE ${ordersKeyspace}
				SET status = 'shipped', updatedAt = $2
				WHERE META().id = $1
				RETURNING o.*
			`.trim();
			const updateRes = await cbOrders.document.query({
				statement: updateStatement,
				args: [orderId, now],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) return { success: false, messages: adminMessages.fulfillFailed };

			return { success: true, data: sanitizeOrderForFulfillment(updateRes.data.results[0] as OrderDocument) };
		} catch {
			return { success: false, messages: adminMessages.fulfillFailed };
		}
	}

	/** Đơn click-and-collect: xử lý xong → chờ khách nhận tại cửa hàng (giữ trạng thái confirmed + cờ awaitingPickup) */
	static async markAwaitingPickup(
		actor: ActorContext,
		orderId: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		try {
			const statement = `SELECT o.*, META().id AS _id FROM ${ordersKeyspace} o WHERE META().id = $1 LIMIT 1`;
			const res = await cbOrders.document.query({ statement, args: [orderId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as OrderDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			const denied = await this.requirePermission(actor, 'fulfillment:manage', doc.branchId);
			if (denied) return denied;

			if (!(QUEUE_STATUSES as readonly string[]).includes(doc.status)) {
				return { success: false, messages: adminMessages.invalidStatus };
			}
			if (doc.fulfillmentMethod === 'shipping') {
				return { success: false, messages: adminMessages.invalidPickupStatus };
			}

			const now = new Date().toISOString();
			const updateStatement = `
				UPDATE ${ordersKeyspace}
				SET status = 'awaiting_pickup', updatedAt = $2
				WHERE META().id = $1
				RETURNING o.*
			`.trim();
			const updateRes = await cbOrders.document.query({
				statement: updateStatement,
				args: [orderId, now],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) return { success: false, messages: adminMessages.fulfillFailed };

			return { success: true, data: sanitizeOrderForFulfillment(updateRes.data.results[0] as OrderDocument) };
		} catch {
			return { success: false, messages: adminMessages.fulfillFailed };
		}
	}
}
