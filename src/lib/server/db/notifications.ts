// $lib/server/db/notifications.ts
// NotificationService — quản trị thông báo hệ thống (per-user + broadcast)
// Pattern theo PaymentService (payments.ts)

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { notifications as notificationMessages } from '../messages/db';

const cbNotifications = cbData('notifications');
const notificationsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`notifications\``;

const adminMessages = {
	notFound: notificationMessages.notFound,
	queryFailed: notificationMessages.queryFailed,
	permissionDenied: notificationMessages.permissionDenied,
	invalidType: notificationMessages.invalidType,
	createFailed: notificationMessages.createFailed,
	markReadFailed: notificationMessages.markReadFailed,
	deleteFailed: notificationMessages.deleteFailed
} as const;

const NOTIFICATION_TYPES = [
	'info',
	'success',
	'warning',
	'error',
	'order',
	'stock',
	'system'
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const NOTIFICATION_SAFE_FIELDS = [
	'notificationId',
	'userId',
	'broadcast',
	'title',
	'body',
	'type',
	'link',
	'isRead',
	'readAt',
	'createdAt'
] as const;

export interface NotificationDocument {
	_id?: string;
	notificationId: string;
	// undefined = broadcast (tất cả user) — giữ field vắng mặt thay vì null để khớp
	// typed "string | undefined" khi tạo document
	userId?: string;
	// cờ đánh dấu broadcast để list/lọc không phụ thuộc field userId vắng mặt
	broadcast: boolean;
	title: string;
	body: string;
	type: NotificationType;
	link?: string;
	isRead: boolean;
	readAt?: string;
	createdAt: string;
}

export interface NotificationListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

function sanitizeNotification(doc: NotificationDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of NOTIFICATION_SAFE_FIELDS) {
		if (doc[field] !== undefined) safe[field] = (doc as unknown as Record<string, unknown>)[field];
	}
	return safe;
}

export class NotificationService {
	/** Permission notifications:read — user thường xem của mình (own_records), admin (all). */
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string,
		targetUserId?: string | null
	): Promise<{ success: false; messages: TranslateContent } | null> {
		const allowed = await PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			actorUserId: actor.userId,
			targetUserId: targetUserId ?? undefined
		});
		if (!allowed) return { success: false, messages: adminMessages.permissionDenied };
		return null;
	}

	private static assertType(type: string): type is NotificationType {
		return (NOTIFICATION_TYPES as readonly string[]).includes(type);
	}

	/**
	 * Danh sách thông báo.
	 * - actor có quyền 'all' → xem tất cả (kể cả broadcast) + filter userId tuỳ chọn.
	 * - actor chỉ có 'own_records' → chỉ xem thông báo của chính mình + broadcast.
	 */
	static async list(
		actor: ActorContext,
		options: {
			type?: string;
			isRead?: boolean;
			userId?: string;
			page?: number;
			pageSize?: number;
		} = {}
	): Promise<
		| { success: true; data: NotificationListResult }
		| { success: false; messages: TranslateContent }
	> {
		const adminScope = await PermissionChecker.getScope(actor.roleName, 'notifications:read');
		if (!adminScope) return { success: false, messages: adminMessages.permissionDenied };
		const seeAll = adminScope === 'all';

		try {
			const page = Math.max(1, options.page ?? 1);
			const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
			const offset = (page - 1) * pageSize;

			const conditions: string[] = [];
			const args: (string | number | boolean)[] = [];
			if (options.type) {
				conditions.push(`p.type = $${args.length + 1}`);
				args.push(options.type);
			}
			if (typeof options.isRead === 'boolean') {
				conditions.push(`p.isRead = $${args.length + 1}`);
				args.push(options.isRead);
			}

			// Phạm vi xem: admin 'all' có thể filter theo userId bất kỳ; ngược lại ép theo actor
			const targetUserId = seeAll ? (options.userId ?? undefined) : actor.userId;
			if (targetUserId) {
				// Thông báo riêng cho user + thông báo broadcast (userId MISSING)
				conditions.push(
					`(p.userId = $${args.length + 1} OR p.userId IS MISSING)`
				);
				args.push(targetUserId);
			} else if (!seeAll) {
				// own_records nhưng không xác định được userId → chỉ broadcast
				conditions.push('p.userId IS MISSING');
			}

			const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

			const dataStatement = `
				SELECT p.*, META().id AS _id
				FROM ${notificationsKeyspace} p
				${whereClause}
				ORDER BY p.createdAt DESC
				LIMIT $${args.length + 1} OFFSET $${args.length + 2}
			`.trim();
			const dataArgs = [...args, pageSize, offset];

			const countStatement = `
				SELECT RAW COUNT(*) AS total
				FROM ${notificationsKeyspace} p
				${whereClause}
			`.trim();

			const [dataRes, countRes] = await Promise.all([
				cbNotifications.document.query({ statement: dataStatement, args: dataArgs, readonly: true }),
				cbNotifications.document.query({ statement: countStatement, args, readonly: true })
			]);

			if (!dataRes.ok || !countRes.ok) {
				return { success: false, messages: adminMessages.queryFailed };
			}
			const rows = (dataRes.data?.results ?? []) as unknown as NotificationDocument[];
			const total = Number(countRes.data?.results?.[0] ?? 0);

			return {
				success: true,
				data: {
					items: rows.map(sanitizeNotification),
					total,
					page,
					pageSize
				}
			};
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/** Tạo thông báo (nội bộ — hệ thống đẩy thông báo; UI admin dùng cho broadcast). */
	static async create(
		actor: ActorContext | null,
		input: {
			title: string;
			body: string;
			type: string;
			// undefined/broadcast=true → gửi tất cả user; ngược lại gửi riêng 1 user
			userId?: string | null;
			link?: string;
		}
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		// Tạo nội bộ (actor null) được phép; tạo từ UI admin phải qua notifications:manage ('all')
		if (actor) {
			const denied = await this.requirePermission(actor, 'notifications:manage');
			if (denied) return denied;
		}

		if (!input.title?.trim() || !input.body?.trim()) {
			return { success: false, messages: adminMessages.createFailed };
		}
		if (!this.assertType(input.type)) {
			return { success: false, messages: adminMessages.invalidType };
		}

		try {
			const now = new Date().toISOString();
			const notificationId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
			const doc: NotificationDocument = {
				notificationId,
				title: input.title.trim(),
				body: input.body.trim(),
				type: input.type,
				isRead: false,
				createdAt: now,
				...(input.userId ? { userId: input.userId, broadcast: false } : { broadcast: true }),
				...(input.link?.trim() ? { link: input.link.trim() } : {})
			};

			const res = await cbNotifications.document.create({
				documentKey: notificationId,
				content: doc
			});
			if (!res.ok) return { success: false, messages: adminMessages.createFailed };

			return { success: true, data: sanitizeNotification(doc) };
		} catch {
			return { success: false, messages: adminMessages.createFailed };
		}
	}

	/** Đánh dấu 1 thông báo đã đọc — chỉ chủ nhân thông báo hoặc admin 'all'. */
	static async markRead(
		actor: ActorContext,
		notificationId: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${notificationsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbNotifications.document.query({ statement, args: [notificationId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as NotificationDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			const isOwner = !!doc.userId && doc.userId === actor.userId;
			if (!isOwner) {
				// broadcast: mọi user authenticated được markRead của chính mình (bản sao per-user
				// chưa có — tạm cho phép markRead broadcast để UI không kẹt; ghi nhận qua 'all')
				const scope = await PermissionChecker.getScope(actor.roleName, 'notifications:read');
				if (scope !== 'all' && doc.broadcast) {
					// user thường: cho phép (broadcast là "của mình")
				} else if (scope !== 'all') {
					return { success: false, messages: adminMessages.permissionDenied };
				}
			}

			const now = new Date().toISOString();
			const updateStatement = `
				UPDATE ${notificationsKeyspace}
				SET isRead = true, readAt = $2
				WHERE META().id = $1
				RETURNING p.*
			`.trim();
			const updateRes = await cbNotifications.document.query({
				statement: updateStatement,
				args: [notificationId, now],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) {
				return { success: false, messages: adminMessages.markReadFailed };
			}

			return { success: true, data: sanitizeNotification(updateRes.data.results[0] as NotificationDocument) };
		} catch {
			return { success: false, messages: adminMessages.markReadFailed };
		}
	}

	/** Đánh dấu TẤT CẢ thông báo của 1 user đã đọc (broadcast + per-user). */
	static async markAllRead(
		actor: ActorContext,
		targetUserId?: string
	): Promise<
		| { success: true; data: { updated: number } }
		| { success: false; messages: TranslateContent }
	> {
		const scope = await PermissionChecker.getScope(actor.roleName, 'notifications:read');
		if (!scope) return { success: false, messages: adminMessages.permissionDenied };
		// user thường chỉ mark-all cho chính mình; admin 'all' mark-all hộ user khác được
		const userId = scope === 'all' ? (targetUserId ?? actor.userId) : actor.userId;

		try {
			const now = new Date().toISOString();
			const updateStatement = `
				UPDATE ${notificationsKeyspace}
				SET isRead = true, readAt = $2
				WHERE (userId = $1 OR userId IS MISSING) AND isRead = false
				RETURNING p.notificationId
			`.trim();
			const updateRes = await cbNotifications.document.query({
				statement: updateStatement,
				args: [userId, now],
				readonly: false
			});
			if (!updateRes.ok) return { success: false, messages: adminMessages.markReadFailed };

			return { success: true, data: { updated: updateRes.data?.results?.length ?? 0 } };
		} catch {
			return { success: false, messages: adminMessages.markReadFailed };
		}
	}

	/** Xoá thông báo — chủ nhân hoặc admin 'all'. */
	static async deleteOwn(
		actor: ActorContext,
		notificationId: string
	): Promise<
		| { success: true; data: { deleted: true } }
		| { success: false; messages: TranslateContent }
	> {
		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${notificationsKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbNotifications.document.query({ statement, args: [notificationId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as NotificationDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			const isOwner = !!doc.userId && doc.userId === actor.userId;
			if (!isOwner) {
				const scope = await PermissionChecker.getScope(actor.roleName, 'notifications:read');
				if (scope !== 'all' && !doc.broadcast) {
					return { success: false, messages: adminMessages.permissionDenied };
				}
				if (scope !== 'all' && doc.broadcast) {
					// user thường xoá broadcast của chính mình: đổi userId thành chính mình
					// (soft-delete per-user) — đơn giản: từ chối, chỉ admin được xoá broadcast
					return { success: false, messages: adminMessages.permissionDenied };
				}
			}

			const deleteRes = await cbNotifications.document.delete({ documentKey: notificationId });
			if (!deleteRes.ok) return { success: false, messages: adminMessages.deleteFailed };

			return { success: true, data: { deleted: true } };
		} catch {
			return { success: false, messages: adminMessages.deleteFailed };
		}
	}
}
