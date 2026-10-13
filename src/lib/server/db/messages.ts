// $lib/server/db/messages.ts
// MessageService — tin nhắn nội bộ giữa users (thread-based, không E2EE — khác pattern chat conversations)
// Pattern theo PaymentService (payments.ts)

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/products';
import { messages as messageMessages } from '../messages/db';

const cbMessages = cbData('messages');
const messagesKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`messages\``;

const adminMessages = {
	notFound: messageMessages.notFound,
	queryFailed: messageMessages.queryFailed,
	permissionDenied: messageMessages.permissionDenied,
	sendFailed: messageMessages.sendFailed,
	markReadFailed: messageMessages.markReadFailed,
	deleteFailed: messageMessages.deleteFailed,
	invalidRecipient: messageMessages.invalidRecipient,
	subjectRequired: messageMessages.subjectRequired
} as const;

const MESSAGE_SAFE_FIELDS = [
	'messageId',
	'threadId',
	'senderId',
	'senderName',
	'recipientIds',
	'subject',
	'body',
	'attachments',
	'isReadBy',
	'createdAt'
] as const;

export interface MessageDocument {
	_id?: string;
	messageId: string;
	threadId: string;
	senderId: string;
	senderName: string;
	recipientIds: string[];
	subject?: string;
	body: string;
	attachments?: { name: string; url: string; size: number }[];
	isReadBy: string[];
	createdAt: string;
}

export interface MessageListResult {
	items: Record<string, unknown>[];
	total: number;
	page: number;
	pageSize: number;
}

function sanitizeMessage(doc: MessageDocument): Record<string, unknown> {
	const safe = { _id: doc._id } as Record<string, unknown>;
	for (const field of MESSAGE_SAFE_FIELDS) {
		if (doc[field] !== undefined) safe[field] = (doc as unknown as Record<string, unknown>)[field];
	}
	return safe;
}

export class MessageService {
	/**
	 * Danh sách thread mà user tham gia (gửi hoặc nhận) — group theo threadId,
	 * trả về message mới nhất mỗi thread + unread count.
	 */
	static async listThreads(
		actor: ActorContext,
		options: { search?: string; page?: number; pageSize?: number } = {}
	): Promise<
		| {
				success: true;
				data: { items: Record<string, unknown>[]; total: number; page: number; pageSize: number };
		  }
		| { success: false; messages: TranslateContent }
	> {
		try {
			const page = Math.max(1, options.page ?? 1);
			const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
			const offset = (page - 1) * pageSize;

			// Thread = nhóm message mà actor là sender hoặc nằm trong recipientIds.
			// Search theo subject (LIKE) nếu có.
			const conditions: string[] = ['(p.senderId = $1 OR ARRAY_CONTAINS(p.recipientIds, $1))'];
			const args: (string | number)[] = [actor.userId];
			if (options.search?.trim()) {
				conditions.push(`LOWER(p.subject) LIKE $${args.length + 1}`);
				args.push(`%${options.search.trim().toLowerCase()}%`);
			}
			const whereClause = `WHERE ${conditions.join(' AND ')}`;

			// Gom mới nhất mỗi thread: GROUP BY threadId lấy MAX(createdAt) — rồi map ngược.
			const dataStatement = `
				SELECT p.*, META().id AS _id
				FROM ${messagesKeyspace} p
				${whereClause}
				ORDER BY p.createdAt DESC
			`.trim();

			const res = await cbMessages.document.query({ statement: dataStatement, args, readonly: true });
			if (!res.ok) return { success: false, messages: adminMessages.queryFailed };

			const rows = (res.data?.results ?? []) as unknown as MessageDocument[];

			// Gom thread client-side (dữ liệu admin quy mô nhỏ — đủ dùng, tránh N1QL phức tạp)
			const threads = new Map<
				string,
				{
					threadId: string;
					lastMessage: Record<string, unknown>;
					lastMessageAt: string;
					unreadCount: number;
					totalMessages: number;
				}
			>();
			for (const row of rows) {
				const existing = threads.get(row.threadId);
				const isUnread = !row.isReadBy?.includes(actor.userId) && row.senderId !== actor.userId;
				if (!existing) {
					threads.set(row.threadId, {
						threadId: row.threadId,
						lastMessage: sanitizeMessage(row),
						lastMessageAt: row.createdAt,
						unreadCount: isUnread ? 1 : 0,
						totalMessages: 1
					});
				} else {
					existing.totalMessages += 1;
					if (isUnread) existing.unreadCount += 1;
				}
			}

			const all = [...threads.values()].sort((a, b) =>
				a.lastMessageAt < b.lastMessageAt ? 1 : a.lastMessageAt > b.lastMessageAt ? -1 : 0
			);
			const total = all.length;
			const items = all.slice(offset, offset + pageSize).map((t) => ({
				threadId: t.threadId,
				lastMessage: t.lastMessage,
				lastMessageAt: t.lastMessageAt,
				unreadCount: t.unreadCount,
				totalMessages: t.totalMessages
			}));

			return { success: true, data: { items, total, page, pageSize } };
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/** Toàn bộ message trong 1 thread — chỉ người tham gia (sender/recipient) được xem. */
	static async listMessages(
		actor: ActorContext,
		threadId: string
	): Promise<
		| { success: true; data: { items: Record<string, unknown>[]; total: number } }
		| { success: false; messages: TranslateContent }
	> {
		try {
			const statement = `
				SELECT p.*, META().id AS _id
				FROM ${messagesKeyspace} p
				WHERE p.threadId = $1
				ORDER BY p.createdAt ASC
			`.trim();
			const res = await cbMessages.document.query({ statement, args: [threadId], readonly: true });
			if (!res.ok) return { success: false, messages: adminMessages.queryFailed };

			const rows = (res.data?.results ?? []) as unknown as MessageDocument[];
			const isParticipant = rows.some(
				(r) => r.senderId === actor.userId || r.recipientIds?.includes(actor.userId)
			);
			if (!rows.length) return { success: true, data: { items: [], total: 0 } };
			if (!isParticipant) return { success: false, messages: adminMessages.permissionDenied };

			return {
				success: true,
				data: { items: rows.map(sanitizeMessage), total: rows.length }
			};
		} catch {
			return { success: false, messages: adminMessages.queryFailed };
		}
	}

	/** Gửi tin nhắn: tạo message mới (thread mới nếu không truyền threadId). */
	static async send(
		actor: ActorContext,
		input: {
			threadId?: string;
			recipientIds: string[];
			subject?: string;
			body: string;
			attachments?: { name: string; url: string; size: number }[];
			// senderName để thread list hiển thị — lấy từ client UI truyền lên
			senderName?: string;
		}
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		if (!input.body?.trim()) return { success: false, messages: adminMessages.sendFailed };
		const recipients = (input.recipientIds ?? []).map((r) => String(r).trim()).filter(Boolean);
		if (!recipients.length) return { success: false, messages: adminMessages.invalidRecipient };

		// Thread tiếp diễn: kiểm tra actor có trong thread không
		if (input.threadId) {
			const existing = await this.listMessages(actor, input.threadId);
			if (!existing.success) return existing;
			if (existing.data.total === 0) {
				// thread không tồn tại → cho phép tạo mới với threadId này
			}
		}

		try {
			const now = new Date().toISOString();
			const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
			const threadId = input.threadId?.trim() || `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const doc: MessageDocument = {
				messageId,
				threadId,
				senderId: actor.userId,
				senderName: input.senderName?.trim() || actor.userId,
				recipientIds: recipients,
				body: input.body.trim(),
				isReadBy: [actor.userId],
				createdAt: now,
				...(input.subject?.trim() ? { subject: input.subject.trim() } : {}),
				...(input.attachments?.length ? { attachments: input.attachments } : {})
			};

			const res = await cbMessages.document.create({ documentKey: messageId, content: doc });
			if (!res.ok) return { success: false, messages: adminMessages.sendFailed };

			return { success: true, data: sanitizeMessage(doc) };
		} catch {
			return { success: false, messages: adminMessages.sendFailed };
		}
	}

	/** Đánh dấu đã đọc 1 message — chỉ recipient (sender mặc định đã đọc tin của mình). */
	static async markRead(
		actor: ActorContext,
		messageId: string
	): Promise<
		| { success: true; data: Record<string, unknown> }
		| { success: false; messages: TranslateContent }
	> {
		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${messagesKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbMessages.document.query({ statement, args: [messageId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as MessageDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			if (doc.senderId !== actor.userId && !doc.recipientIds?.includes(actor.userId)) {
				return { success: false, messages: adminMessages.permissionDenied };
			}
			if (doc.isReadBy?.includes(actor.userId)) {
				return { success: true, data: sanitizeMessage(doc) };
			}

			const updateStatement = `
				UPDATE ${messagesKeyspace}
				SET isReadBy = ARRAY_PUT($2, isReadBy)
				WHERE META().id = $1
				RETURNING p.*
			`.trim();
			const updateRes = await cbMessages.document.query({
				statement: updateStatement,
				args: [messageId, actor.userId],
				readonly: false
			});
			if (!updateRes.ok || !updateRes.data?.results?.length) {
				return { success: false, messages: adminMessages.markReadFailed };
			}

			return { success: true, data: sanitizeMessage(updateRes.data.results[0] as MessageDocument) };
		} catch {
			return { success: false, messages: adminMessages.markReadFailed };
		}
	}

	/** Xoá 1 message — chỉ sender hoặc recipient được xoá (đơn giản: hard delete). */
	static async deleteOwn(
		actor: ActorContext,
		messageId: string
	): Promise<
		| { success: true; data: { deleted: true } }
		| { success: false; messages: TranslateContent }
	> {
		try {
			const statement = `SELECT p.*, META().id AS _id FROM ${messagesKeyspace} p WHERE META().id = $1 LIMIT 1`;
			const res = await cbMessages.document.query({ statement, args: [messageId], readonly: true });
			const doc = (res.data?.results?.[0] ?? null) as MessageDocument | null;
			if (!doc) return { success: false, messages: adminMessages.notFound };

			if (doc.senderId !== actor.userId && !doc.recipientIds?.includes(actor.userId)) {
				return { success: false, messages: adminMessages.permissionDenied };
			}

			const deleteRes = await cbMessages.document.delete({ documentKey: messageId });
			if (!deleteRes.ok) return { success: false, messages: adminMessages.deleteFailed };

			return { success: true, data: { deleted: true } };
		} catch {
			return { success: false, messages: adminMessages.deleteFailed };
		}
	}
}
