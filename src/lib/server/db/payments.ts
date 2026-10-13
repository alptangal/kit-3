// $lib/server/db/payments.ts
// PaymentService — QUẢN TRỊ thanh toán (đối soát chuyển khoản ngân hàng)
// Pattern theo OrderAdminService (orders.ts)

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { payments as paymentMessages } from '../messages/db';

const cbPayments = cbData('payments');
const paymentsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`payments\``;

const adminMessages = {
	notFound: paymentMessages.notFound,
	queryFailed: paymentMessages.queryFailed,
	permissionDenied: paymentMessages.permissionDenied,
	invalidStatus: paymentMessages.invalidStatus,
	invalidMethod: paymentMessages.invalidMethod,
	alreadyProcessed: paymentMessages.alreadyProcessed,
	reasonRequired: paymentMessages.reasonRequired,
	confirmFailed: paymentMessages.confirmFailed,
	markFailedFailed: paymentMessages.markFailedFailed,
	statusUpdated: paymentMessages.statusUpdated
} as const;

const PAYMENT_ADMIN_SAFE_FIELDS = [
	'paymentCode',
	'orderId',
	'method',
	'amount',
	'status',
	'transactionReference',
	'notes',
	'processedBy',
	'createdAt'
] as const;

interface PaymentDocument {
	_id: string;
	orderId: string;
	paymentCode: string;
	method: string;
	amount: number;
	status: string;
	transactionReference?: string;
	notes?: string;
	processedBy?: string;
	createdAt: string;
}

export interface PaymentListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

function sanitizePaymentForAdmin(doc: PaymentDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of PAYMENT_ADMIN_SAFE_FIELDS) {
		if (doc[field] !== undefined) safe[field] = (doc as unknown as Record<string, unknown>)[field];
	}
	return safe;
}

export class PaymentService {
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

	/** Danh sách thanh toán — filter status/orderId/method, phân trang */
	static async list(
		actor: ActorContext,
		options: {
			status?: string;
			orderId?: string;
			method?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<
		| { success: true; data: PaymentListResult }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'payments:read');
		if (denied) return denied;

		try {
			const page = Math.max(1, options.page ?? 1);
			const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
			const offset = (page - 1) * pageSize;

			const conditions: string[] = [];
			const args: (string | number)[] = [];
			if (options.status) {
				conditions.push(`p.status = $${args.length + 1}`);
				args.push(options.status);
			}
			if (options.orderId) {
				conditions.push(`p.orderId = $${args.length + 1}`);
				args.push(options.orderId);
			}
			if (options.method) {
				conditions.push(`p.method = $${args.length + 1}`);
				args.push(options.method);
			}
			const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

			const dataStatement = `
				SELECT p.*, META().id AS _id
				FROM ${paymentsKeyspace} p
				${whereClause}
				ORDER BY p.createdAt DESC
				LIMIT $${args.length + 1} OFFSET $${args.length + 2}
			`.trim();
			const dataArgs = [...args, pageSize, offset];

			const countStatement = `
				SELECT RAW COUNT(*) AS total
				FROM ${paymentsKeyspace} p
				${whereClause}
			`.trim();

			const [dataRes, countRes] = await Promise.all([
				cbPayments.document.query({ statement: dataStatement, args: dataArgs, readonly: true }),
				cbPayments.document.query({ statement: countStatement, args, readonly: true })
			]);

			if (!dataRes.ok || !countRes.ok) {
				return { success: false, messages: adminMessages.queryFailed };
			}
			const rows = (dataRes.data?.results ?? []) as unknown as PaymentDocument[];
			const total = Number(countRes.data?.results?.[0] ?? 0);

			return {
				success: true,
				data: {
					items: rows.map(sanitizePaymentForAdmin),
					total,
					page,
					pageSize
				}
			};
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/** Chi tiết 1 thanh toán */
	static async getById(
		actor: ActorContext,
		paymentId: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'payments:read');
		if (denied) return denied;

		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${paymentsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbPayments.document.query({ statement, args: [paymentId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as PaymentDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			return { success: true, data: sanitizePaymentForAdmin(doc) };
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/**
	 * Đối soát chuyển khoản ngân hàng: pending → completed
	 * Ghi note đối soát (ai xác nhận, lúc nào).
	 */
	static async confirmBankTransfer(
		actor: ActorContext,
		paymentId: string,
		notes?: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'payments:manage');
		if (denied) return denied;

		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${paymentsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbPayments.document.query({ statement, args: [paymentId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as PaymentDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			if (doc.method !== 'bank_transfer') {
				return { success: false, messages: adminMessages.invalidMethod };
			}
			if (doc.status !== 'pending') {
				return { success: false, messages: adminMessages.alreadyProcessed };
			}

			const now = new Date().toISOString();
			const reconcileNote = `[${now}] ${actor.userId} đối soát chuyển khoản thành công${notes ? `: ${notes}` : ''}`;
			const updatedNotes = doc.notes ? `${doc.notes}\n${reconcileNote}` : reconcileNote;

			const updateStatement = `
				UPDATE ${paymentsKeyspace}
				SET status = 'completed', notes = $2, processedBy = $3
				WHERE META().id = $1
				RETURNING p.*
			`.trim();
			const updateRes = await cbPayments.document.query({
				statement: updateStatement,
				args: [paymentId, updatedNotes, actor.userId],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) return { success: false, messages: adminMessages.confirmFailed };

			return { success: true, data: sanitizePaymentForAdmin(updateRes.data.results[0] as PaymentDocument) };
		} catch {
			return { success: false, messages: adminMessages.confirmFailed };
		}
	}

	/** Đánh dấu thanh toán thất bại (kèm lý do bắt buộc) */
	static async markFailed(
		actor: ActorContext,
		paymentId: string,
		reason: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'payments:manage');
		if (denied) return denied;

		if (!reason?.trim()) return { success: false, messages: adminMessages.reasonRequired };

		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${paymentsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbPayments.document.query({ statement, args: [paymentId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as PaymentDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			if (doc.status !== 'pending') {
				return { success: false, messages: adminMessages.alreadyProcessed };
			}

			const now = new Date().toISOString();
			const failNote = `[${now}] ${actor.userId} đánh dấu thất bại: ${reason.trim()}`;
			const updatedNotes = doc.notes ? `${doc.notes}\n${failNote}` : failNote;

			const updateStatement = `
				UPDATE ${paymentsKeyspace}
				SET status = 'failed', notes = $2, processedBy = $3
				WHERE META().id = $1
				RETURNING p.*
			`.trim();
			const updateRes = await cbPayments.document.query({
				statement: updateStatement,
				args: [paymentId, updatedNotes, actor.userId],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) return { success: false, messages: adminMessages.markFailedFailed };

			return { success: true, data: sanitizePaymentForAdmin(updateRes.data.results[0] as PaymentDocument) };
		} catch {
			return { success: false, messages: adminMessages.markFailedFailed };
		}
	}
}
