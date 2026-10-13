// $lib/server/db/shipments.ts
// ShipmentService — QUẢN TRỊ vận đơn (xem trạng thái + xử lý webhook fail)
// Pattern theo OrderAdminService (orders.ts)

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { shipments as shipmentMessages } from '../messages/db';

const cbShipments = cbData('shipments');
const shipmentsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`shipments\``;

const adminMessages = {
	notFound: shipmentMessages.notFound,
	queryFailed: shipmentMessages.queryFailed,
	permissionDenied: shipmentMessages.permissionDenied,
	invalidStatus: shipmentMessages.invalidStatus,
	updateFailed: shipmentMessages.updateFailed,
	statusUpdated: shipmentMessages.statusUpdated
} as const;

/** Status flow: pending → label_created → picked_up → in_transit → delivered; failed/returned là trạng thái xử lý webhook fail */
export const SHIPMENT_STATUSES = [
	'pending',
	'label_created',
	'picked_up',
	'in_transit',
	'delivered',
	'failed',
	'returned'
] as const;

const SHIPMENT_ADMIN_SAFE_FIELDS = [
	'orderId',
	'provider',
	'trackingNumber',
	'shippingAddress',
	'recipientName',
	'recipientPhone',
	'weight',
	'dimensions',
	'cost',
	'estimatedDeliveryDate',
	'status',
	'statusHistory',
	'externalData',
	'createdAt',
	'updatedAt'
] as const;

interface ShipmentDocument {
	_id: string;
	orderId: string;
	provider: string;
	trackingNumber?: string;
	shippingAddress?: Record<string, unknown>;
	recipientName?: string;
	recipientPhone?: string;
	weight?: number;
	dimensions?: Record<string, unknown>;
	cost?: number;
	estimatedDeliveryDate?: string;
	status: string;
	statusHistory?: { status: string; timestamp: string; notes?: string }[];
	externalData?: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface ShipmentListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

function sanitizeShipmentForAdmin(doc: ShipmentDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of SHIPMENT_ADMIN_SAFE_FIELDS) {
		if (doc[field] !== undefined) safe[field] = (doc as unknown as Record<string, unknown>)[field];
	}
	return safe;
}

export class ShipmentService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
		if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
		return null;
	}

	/** Danh sách vận đơn — filter status/orderId/provider, phân trang */
	static async list(
		actor: ActorContext,
		options: {
			status?: string;
			orderId?: string;
			provider?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<
		| { success: true; data: ShipmentListResult }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'shipments:read');
		if (denied) return denied;

		try {
			const page = Math.max(1, options.page ?? 1);
			const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
			const offset = (page - 1) * pageSize;

			const conditions: string[] = [];
			const args: (string | number)[] = [];
			if (options.status) {
				conditions.push(`s.status = $${args.length + 1}`);
				args.push(options.status);
			}
			if (options.orderId) {
				conditions.push(`s.orderId = $${args.length + 1}`);
				args.push(options.orderId);
			}
			if (options.provider) {
				conditions.push(`s.provider = $${args.length + 1}`);
				args.push(options.provider);
			}
			const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

			const dataStatement = `
				SELECT s.*, META().id AS _id
				FROM ${shipmentsKeyspace} s
				${whereClause}
				ORDER BY s.createdAt DESC
				LIMIT $${args.length + 1} OFFSET $${args.length + 2}
			`.trim();
			const dataArgs = [...args, pageSize, offset];

			const countStatement = `
				SELECT RAW COUNT(*) AS total
				FROM ${shipmentsKeyspace} s
				${whereClause}
			`.trim();

			const [dataRes, countRes] = await Promise.all([
				cbShipments.document.query({ statement: dataStatement, args: dataArgs, readonly: true }),
				cbShipments.document.query({ statement: countStatement, args, readonly: true })
			]);

			if (!dataRes.ok || !countRes.ok) {
				return { success: false, messages: adminMessages.queryFailed };
			}
			const rows = (dataRes.data?.results ?? []) as unknown as ShipmentDocument[];
			const total = Number(countRes.data?.results?.[0] ?? 0);

			return {
				success: true,
				data: {
					items: rows.map(sanitizeShipmentForAdmin),
					total,
					page,
					pageSize
				}
			};
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/** Chi tiết 1 vận đơn */
	static async getById(
		actor: ActorContext,
		shipmentId: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'shipments:read');
		if (denied) return denied;

		try {
			const statement = `SELECT s.*, META().id AS _id FROM ${shipmentsKeyspace} s WHERE META().id = $1 LIMIT 1`;
			const res = await cbShipments.document.query({ statement, args: [shipmentId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as ShipmentDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			return { success: true, data: sanitizeShipmentForAdmin(doc) };
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/**
	 * Cập nhật trạng thái vận đơn — chính để xử lý webhook fail retry
	 * (vd: carrier webhook lỗi → staff cập nhật tay 'in_transit'/'delivered').
	 */
	static async updateStatus(
		actor: ActorContext,
		shipmentId: string,
		status: string,
		notes?: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'shipments:manage');
		if (denied) return denied;

		if (!(SHIPMENT_STATUSES as readonly string[]).includes(status)) {
			return { success: false, messages: adminMessages.invalidStatus };
		}

		try {
			const statement = `SELECT s.*, META().id AS _id FROM ${shipmentsKeyspace} s WHERE META().id = $1 LIMIT 1`;
			const res = await cbShipments.document.query({ statement, args: [shipmentId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as ShipmentDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			if (doc.status === status) {
				return { success: true, data: sanitizeShipmentForAdmin(doc) };
			}

			const now = new Date().toISOString();
			const historyEntry = { status, timestamp: now, ...(notes ? { notes } : {}) };
			const updatedHistory = [...(doc.statusHistory ?? []), historyEntry];

			const updateStatement = `
				UPDATE ${shipmentsKeyspace}
				SET status = $2, statusHistory = $3, updatedAt = $4
				WHERE META().id = $1
				RETURNING s.*
			`.trim();
			const updateRes = await cbShipments.document.query({
				statement: updateStatement,
				args: [shipmentId, status, updatedHistory, now],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) return { success: false, messages: adminMessages.updateFailed };

			return { success: true, data: sanitizeShipmentForAdmin(updateRes.data.results[0] as ShipmentDocument) };
		} catch {
			return { success: false, messages: adminMessages.updateFailed };
		}
	}
}
