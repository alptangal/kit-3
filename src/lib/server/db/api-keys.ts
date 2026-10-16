// $lib/server/db/api-keys.ts
// ApiKeyService — Secret Key API (sk-...) để gọi /api/agent/* từ ngoài.
//
// Bảo mật:
// - raw key CHỈ sinh 1 lần khi create, hiển thị ĐÚNG 1 LẦN cho user;
// - DB CHỈ lưu keyHash = SHA-256 hex (createHash từ node:crypto);
// - prefix (8 ký tự đầu) lưu kèm để nhận diện key trên UI;
// - verify(rawKey) → keyHash → tra doc → userId → PermissionChecker như session.
//
// Quyền: api_keys:read (list) / api_keys:manage (create/revoke) — seed owner 'all'.
// User chỉ thao tác key CỦA CHÍNH MÌNH (self-service): route lọc theo userId
// từ session; KHÔNG nhận userId từ client.

import { createHash, randomBytes } from 'node:crypto';
import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { Users, type ActorContext } from './users';
import type { ApiKey } from '$modules/schema';

const cbKeys = cbData('api_keys');
const cbRoles = cbData('name_roles');

export const apiKeyMessages = {
	denied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent,
	queryFailed: {
		vi: 'Lấy danh sách key thất bại',
		en: 'Failed to fetch API keys'
	} as TranslateContent,
	notFound: {
		vi: 'Không tìm thấy key hoặc key không thuộc về bạn',
		en: 'Key not found or does not belong to you'
	} as TranslateContent,
	invalidName: {
		vi: 'Tên key không hợp lệ (1–100 ký tự)',
		en: 'Invalid key name (1-100 characters)'
	} as TranslateContent,
	createFailed: {
		vi: 'Tạo key thất bại',
		en: 'Failed to create API key'
	} as TranslateContent,
	revokeFailed: {
		vi: 'Thu hồi key thất bại',
		en: 'Failed to revoke API key'
	} as TranslateContent,
	alreadyRevoked: {
		vi: 'Key đã bị thu hồi trước đó',
		en: 'Key was already revoked'
	} as TranslateContent,
	invalid: {
		vi: 'API key không hợp lệ',
		en: 'Invalid API key'
	} as TranslateContent,
	expired: {
		vi: 'API key đã bị thu hồi',
		en: 'API key has been revoked'
	} as TranslateContent
} as const;

const MAX_KEYS_PER_USER = 20;

/** SHA-256 hex — keyHash lưu DB. */
export function hashApiKey(rawKey: string): string {
	return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

/** Sinh raw key sk- + 32 bytes base64url (~43 ký tự). */
function generateRawKey(): { raw: string; prefix: string } {
	const raw = `sk-${randomBytes(32).toString('base64url')}`;
	return { raw, prefix: raw.slice(0, 8) };
}

/** Shape trả về client — KHÔNG bao giờ chứa keyHash. */
export interface ApiKeyView {
	documentKey: string;
	name: string;
	prefix: string;
	createdAt?: string;
	lastUsedAt?: string;
	revokedAt?: string;
}

function toView(row: Record<string, unknown>): ApiKeyView {
	return {
		documentKey: (row.documentKey as string) ?? '',
		name: row.name as string,
		prefix: row.prefix as string,
		createdAt: row.createdAt as string | undefined,
		lastUsedAt: row.lastUsedAt as string | undefined,
		revokedAt: row.revokedAt as string | undefined
	};
}

export class ApiKeyService {
	private static requirePermission(actor: ActorContext, key: string) {
		return PermissionChecker.can(actor.roleName, key, {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
	}

	/** Danh sách key CỦA CHÍNH actor (self-service — không nhận userId từ client). */
	static async listOwn(actor: ActorContext) {
		if (!this.requirePermission(actor, 'api_keys:read')) {
			return { success: false as const, messages: apiKeyMessages.denied };
		}
		try {
			const res = await cbKeys.document.query({
				statement: `SELECT META(k).id AS documentKey, k.* FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`api_keys\` k WHERE k.userId = $1 ORDER BY k.createdAt DESC`,
				args: [actor.userId]
			});
			if (!res.ok) return { success: false as const, messages: apiKeyMessages.queryFailed };
			const keys = (res.data?.results ?? []).map((row: Record<string, unknown>) => toView(row));
			return { success: true as const, data: { keys } };
		} catch {
			return { success: false as const, messages: apiKeyMessages.queryFailed };
		}
	}

	/**
	 * Tạo key mới cho CHÍNH actor. Trả raw key ĐÚNG 1 LẦN — route phải trả về
	 * client ngay trong response này; DB chỉ lưu keyHash.
	 */
	static async createOwn(actor: ActorContext, name: string) {
		if (!this.requirePermission(actor, 'api_keys:manage')) {
			return { success: false as const, messages: apiKeyMessages.denied };
		}
		const cleanName = typeof name === 'string' ? name.trim().slice(0, 100) : '';
		if (!cleanName) {
			return { success: false as const, messages: apiKeyMessages.invalidName };
		}
		try {
			// Chặn phình: tối đa 20 key còn hiệu lực mỗi user
			const countRes = await cbKeys.document.query({
				statement: `SELECT RAW COUNT(*) AS count FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`api_keys\` k WHERE k.userId = $1 AND k.revokedAt IS MISSING`,
				args: [actor.userId]
			});
			if (!countRes.ok) return { success: false as const, messages: apiKeyMessages.createFailed };
			const active = (countRes.data?.results?.[0] as number) ?? 0;
			if (active >= MAX_KEYS_PER_USER) {
				return {
					success: false as const,
					messages: {
						vi: `Bạn đã đạt giới hạn ${MAX_KEYS_PER_USER} key còn hiệu lực — hãy thu hồi bớt`,
						en: `You reached the limit of ${MAX_KEYS_PER_USER} active keys — revoke some first`
					} as TranslateContent
				};
			}

			const { raw, prefix } = generateRawKey();
			const now = new Date().toISOString();
			const documentKey = `api_keys::${actor.userId}::${prefix}`;
			const createRes = await cbKeys.document.create({
				documentKey,
				content: {
					userId: actor.userId,
					name: cleanName,
					prefix,
					keyHash: hashApiKey(raw),
					createdAt: now
				}
			});
			if (!createRes.ok) return { success: false as const, messages: apiKeyMessages.createFailed };

			return {
				success: true as const,
				data: {
					// raw key HIỂN THỊ ĐÚNG 1 LẦN — không lưu đâu khác, không log
					key: raw,
					view: { documentKey, name: cleanName, prefix, createdAt: now } satisfies ApiKeyView
				}
			};
		} catch (e) {
			// 409 = documentKey trùng (prefix collision cực hiếm) → user tạo lại
			console.error('[ApiKeyService.createOwn]', e instanceof Error ? e.message : String(e));
			return { success: false as const, messages: apiKeyMessages.createFailed };
		}
	}

	/** Thu hồi (soft — giữ lịch sử, set revokedAt). Chỉ key của chính actor. */
	static async revokeOwn(actor: ActorContext, documentKey: string) {
		if (!this.requirePermission(actor, 'api_keys:manage')) {
			return { success: false as const, messages: apiKeyMessages.denied };
		}
		try {
			const getRes = await cbKeys.document.get({ documentKey });
			if (!getRes.ok || !getRes.data) {
				return { success: false as const, messages: apiKeyMessages.notFound };
			}
			const doc = getRes.data as unknown as ApiKey & { userId: string; revokedAt?: string };
			if (doc.userId !== actor.userId) {
				return { success: false as const, messages: apiKeyMessages.notFound };
			}
			if (doc.revokedAt) {
				return { success: false as const, messages: apiKeyMessages.alreadyRevoked };
			}
			const updRes = await cbKeys.document.update({
				documentKey,
				content: { ...doc, revokedAt: new Date().toISOString() }
			});
			if (!updRes.ok) return { success: false as const, messages: apiKeyMessages.revokeFailed };
			return { success: true as const, data: { documentKey } };
		} catch {
			return { success: false as const, messages: apiKeyMessages.revokeFailed };
		}
	}

	/**
	 * Xác thực Bearer key cho /api/agent/*:
	 * raw key → hash → lookup → userId → roleName (name_roles) → ActorContext.
	 * Cập nhật lastUsedAt best-effort (fire-and-forget, không chặn request).
	 * Trả ActorContext (dùng tiếp PermissionChecker như session) — null nếu key sai/hết.
	 */
	static async verify(rawKey: string): Promise<ActorContext | null> {
		const trimmed = rawKey?.trim();
		if (!trimmed || !trimmed.startsWith('sk-')) return null;
		const keyHash = hashApiKey(trimmed);
		try {
			const res = await cbKeys.document.query({
				statement: `SELECT META(k).id AS documentKey, k.* FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`api_keys\` k WHERE k.keyHash = $1 LIMIT 2`,
				args: [keyHash]
			});
			if (!res.ok) return null;
			const rows = (res.data?.results ?? []) as Array<Record<string, unknown>>;
			const doc = rows[0] as unknown as
				| (ApiKey & { documentKey: string; userId: string; revokedAt?: string })
				| undefined;
			// keyHash unique về mặt thực tiễn (sha256 của key ngẫu nhiên 256-bit)
			if (!doc || doc.revokedAt) return null;

			// best-effort lastUsedAt — không chặn, không throw
			void cbKeys.document
				.update({
					documentKey: doc.documentKey,
					content: { ...doc, lastUsedAt: new Date().toISOString() }
				})
				.catch(() => undefined);

			return await this.resolveOwner(doc.userId);
		} catch {
			return null;
		}
	}

	/** Tra roleName (name_roles theo documentKey roleId) + branchId → ActorContext. */
	private static async resolveOwner(userId: string): Promise<ActorContext | null> {
		try {
			const user = await Users.getById(userId);
			if (!user || user.user.deletedAt) return null;
			const roleId = (user.user as { roleId?: string }).roleId;
			if (!roleId) return null;
			// roleId là DOCUMENT KEY (vd 'role-owner') — get trực tiếp rồi đọc field name
			const rolesRes = await cbRoles.document.get({ documentKey: roleId });
			if (!rolesRes.ok || !rolesRes.data) return null;
			const roleName = (rolesRes.data as { name?: string }).name;
			if (!roleName) return null;
			const branchId = (user.user as { branchId?: string }).branchId;
			return { roleName, userId, branchId };
		} catch {
			return null;
		}
	}
}
