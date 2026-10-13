// $lib/server/db/email-logs.ts
// EmailLogService — log gửi email (queue/sent/failed) + retry MOCK (chưa có SMTP thật — backlog)
// Pattern theo PaymentService (payments.ts)

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { email_logs as emailLogMessages } from '../messages/db';

const cbEmailLogs = cbData('email_logs');
const emailLogsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`email_logs\``;

const adminMessages = {
	notFound: emailLogMessages.notFound,
	queryFailed: emailLogMessages.queryFailed,
	permissionDenied: emailLogMessages.permissionDenied,
	invalidStatus: emailLogMessages.invalidStatus,
	retryFailed: emailLogMessages.retryFailed,
	deleteFailed: emailLogMessages.deleteFailed
} as const;

const EMAIL_STATUSES = ['queued', 'sent', 'failed'] as const;
export type EmailLogStatus = (typeof EMAIL_STATUSES)[number];

const EMAIL_LOG_SAFE_FIELDS = [
	'emailId',
	'to',
	'subject',
	'template',
	'status',
	'error',
	'sentAt',
	'createdAt',
	'relatedType',
	'relatedId',
	'retryCount'
] as const;

export interface EmailLogDocument {
	_id?: string;
	emailId: string;
	to: string;
	subject: string;
	template: string;
	status: EmailLogStatus;
	error?: string;
	sentAt?: string;
	createdAt: string;
	relatedType?: string;
	relatedId?: string;
	// số lần retry — phục vụ theo dõi hàng đợi mock
	retryCount?: number;
}

export interface EmailLogListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

function sanitizeEmailLog(doc: EmailLogDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of EMAIL_LOG_SAFE_FIELDS) {
		if (doc[field] !== undefined) safe[field] = (doc as unknown as Record<string, unknown>)[field];
	}
	return safe;
}

export class EmailLogService {
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

	/** Danh sách email log — filter status/template/relatedType, phân trang. */
	static async list(
		actor: ActorContext,
		options: {
			status?: string;
			template?: string;
			relatedType?: string;
			relatedId?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<
		| { success: true; data: EmailLogListResult }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'email_logs:read');
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
			if (options.template) {
				conditions.push(`p.template = $${args.length + 1}`);
				args.push(options.template);
			}
			if (options.relatedType) {
				conditions.push(`p.relatedType = $${args.length + 1}`);
				args.push(options.relatedType);
			}
			if (options.relatedId) {
				conditions.push(`p.relatedId = $${args.length + 1}`);
				args.push(options.relatedId);
			}
			const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

			const dataStatement = `
				SELECT p.*, META().id AS _id
				FROM ${emailLogsKeyspace} p
				${whereClause}
				ORDER BY p.createdAt DESC
				LIMIT $${args.length + 1} OFFSET $${args.length + 2}
			`.trim();
			const dataArgs = [...args, pageSize, offset];

			const countStatement = `
				SELECT RAW COUNT(*) AS total
				FROM ${emailLogsKeyspace} p
				${whereClause}
			`.trim();

			const [dataRes, countRes] = await Promise.all([
				cbEmailLogs.document.query({ statement: dataStatement, args: dataArgs, readonly: true }),
				cbEmailLogs.document.query({ statement: countStatement, args, readonly: true })
			]);

			if (!dataRes.ok || !countRes.ok) {
				return { success: false, messages: adminMessages.queryFailed };
			}
			const rows = (dataRes.data?.results ?? []) as unknown as EmailLogDocument[];
			const total = Number(countRes.data?.results?.[0] ?? 0);

			return {
				success: true,
				data: {
					items: rows.map(sanitizeEmailLog),
					total,
					page,
					pageSize
				}
			};
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/** Chi tiết 1 email log. */
	static async getById(
		actor: ActorContext,
		emailId: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'email_logs:read');
		if (denied) return denied;

		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${emailLogsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbEmailLogs.document.query({ statement, args: [emailId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as EmailLogDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			return { success: true, data: sanitizeEmailLog(doc) };
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/**
	 * Tạo log email (nội bộ — caller là service gửi mail MOCK trong đợt này).
	 * Backlog: tích hợp SMTP/nodemailer thật sẽ thay thế phần ghi log này bằng send thật.
	 */
	static async create(input: {
		to: string;
		subject: string;
		template: string;
		status?: EmailLogStatus;
		relatedType?: string;
		relatedId?: string;
	}): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		if (!input.to?.trim() || !input.subject?.trim() || !input.template?.trim()) {
			return { success: false, messages: emailLogMessages.invalidInput };
		}
		const status = input.status ?? 'queued';
		if (!(EMAIL_STATUSES as readonly string[]).includes(status)) {
			return { success: false, messages: adminMessages.invalidStatus };
		}

		try {
			const now = new Date().toISOString();
			const emailId = `email-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
			const doc: EmailLogDocument = {
				emailId,
				to: input.to.trim(),
				subject: input.subject.trim(),
				template: input.template.trim(),
				status,
				createdAt: now,
				retryCount: 0,
				...(input.relatedType ? { relatedType: input.relatedType } : {}),
				...(input.relatedId ? { relatedId: input.relatedId } : {})
			};

			const res = await cbEmailLogs.document.create({ documentKey: emailId, content: doc });
			if (!res.ok) return { success: false, messages: emailLogMessages.createFailed };

			return { success: true, data: sanitizeEmailLog(doc) };
		} catch {
			return { success: false, messages: emailLogMessages.createFailed };
		}
	}

	/**
	 * Retry gửi email — MOCK: chỉ chuyển queued|failed → queued + tăng retryCount + log console.
	 * Backlog: khi có SMTP thật (nodemailer), hàm này sẽ đẩy job vào hàng đợi gửi thực.
	 */
	static async retry(
		actor: ActorContext,
		emailId: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'email_logs:manage');
		if (denied) return denied;

		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${emailLogsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbEmailLogs.document.query({ statement, args: [emailId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as EmailLogDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			if (doc.status === 'sent') {
				return { success: false, messages: adminMessages.invalidStatus };
			}

			// MOCK — chưa có SMTP thật (backlog). Chỉ re-queue + ghi log.
			console.log(`[EmailLogService] MOCK retry email ${emailId} → re-queued (no SMTP integration yet)`);
			const updateStatement = `
				UPDATE ${emailLogsKeyspace}
				SET status = 'queued', retryCount = $2, error = NULL
				WHERE META().id = $1
				RETURNING p.*
			`.trim();
			const updateRes = await cbEmailLogs.document.query({
				statement: updateStatement,
				args: [emailId, (doc.retryCount ?? 0) + 1],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) {
				return { success: false, messages: adminMessages.retryFailed };
			}

			return { success: true, data: sanitizeEmailLog(updateRes.data.results[0] as EmailLogDocument) };
		} catch {
			return { success: false, messages: adminMessages.retryFailed };
		}
	}

	/** Xoá 1 email log. */
	static async delete(
		actor: ActorContext,
		emailId: string
	): Promise<
		| { success: true; data: { deleted: true } }
		| { success: false; messages: TranslateContent }
	> {
		const denied = await this.requirePermission(actor, 'email_logs:manage');
		if (denied) return denied;

		try {
			const deleteRes = await cbEmailLogs.document.delete({ documentKey: emailId });
			if (!deleteRes.ok) return { success: false, messages: adminMessages.deleteFailed };

			return { success: true, data: { deleted: true } };
		} catch {
			return { success: false, messages: adminMessages.deleteFailed };
		}
	}
}
