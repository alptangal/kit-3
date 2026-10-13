import { cbData } from '$modules/couchbase/clients';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { systemVault } from '$lib/store/initSystemVault';
import type { ActorContext } from './users';

const cbSocialAccounts = cbData('social_accounts');
const cbSocialPosts = cbData('social_posts');
const socialAccountsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`social_accounts\``;
const socialPostsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`social_posts\``;

// ============================================================
// Social media manager
// ============================================================

export type SocialPlatform =
	| 'facebook'
	| 'instagram'
	| 'zalo'
	| 'tiktok'
	| 'youtube'
	| 'twitter_x'
	| 'linkedin';

export type SocialAccountStatus = 'connected' | 'disconnected' | 'error';
export type SocialPostStatus =
	| 'draft'
	| 'scheduled'
	| 'publishing'
	| 'published'
	| 'failed'
	| 'cancelled';

export interface SocialAccountDocument {
	accountId: string;
	platform: SocialPlatform;
	accountName: string;
	handle?: string;
	accessTokenEncrypted?: { ivB64: string; ciphertextB64: string };
	pageId?: string;
	followersCount: number;
	status: SocialAccountStatus;
	lastSyncAt?: string;
	createdAt: string;
	updatedAt: string;
}

export interface SocialPostDocument {
	socialPostId: string;
	campaignId?: string;
	platform: SocialPlatform;
	content: string;
	mediaUrls: string[];
	scheduledAt?: string;
	publishedAt?: string;
	status: SocialPostStatus;
	error?: string;
	externalPostId?: string;
	permalink?: string;
	createdAt: string;
	updatedAt: string;
}

const SOCIAL_ACCOUNT_SAFE_FIELDS = [
	'accountId',
	'platform',
	'accountName',
	'handle',
	'pageId',
	'followersCount',
	'status',
	'lastSyncAt',
	'createdAt',
	'updatedAt'
] as const;

// accessTokenEncrypted KHÔNG nằm trong safe fields — không bao giờ trả token về client
export function sanitizeSocialAccountForAdmin(doc: Record<string, unknown>) {
	const result: Record<string, unknown> = { _id: doc._id };
	for (const key of SOCIAL_ACCOUNT_SAFE_FIELDS) {
		if (doc[key] !== undefined) result[key] = doc[key];
	}
	return result;
}

export function sanitizeSocialPostForAdmin(doc: Record<string, unknown>) {
	return { ...doc };
}

// ActorContext dùng chung từ users.ts (roleName/userId/branchId)

const accountMessages = {
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện hành động này',
		en: 'You do not have permission to perform this action'
	},
	notFound: {
		vi: 'Không tìm thấy tài khoản mạng xã hội',
		en: 'Social account not found'
	},
	queryFailed: {
		vi: 'Không thể truy vấn danh sách tài khoản',
		en: 'Failed to query social accounts'
	},
	connectFailed: {
		vi: 'Không thể kết nối tài khoản',
		en: 'Failed to connect account'
	},
	updateFailed: {
		vi: 'Không thể cập nhật tài khoản',
		en: 'Failed to update account'
	},
	deleteFailed: {
		vi: 'Không thể xóa tài khoản',
		en: 'Failed to delete account'
	},
	tokenEncryptionFailed: {
		vi: 'Không thể mã hóa access token',
		en: 'Failed to encrypt access token'
	},
	vaultUninitialized: {
		vi: 'Vault hệ thống chưa được khởi tạo',
		en: 'System vault is not initialized'
	}
} as const;

const postMessages = {
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện hành động này',
		en: 'You do not have permission to perform this action'
	},
	notFound: { vi: 'Không tìm thấy bài đăng', en: 'Social post not found' },
	queryFailed: { vi: 'Không thể truy vấn danh sách bài đăng', en: 'Failed to query social posts' },
	createFailed: { vi: 'Không thể tạo bài đăng', en: 'Failed to create social post' },
	updateFailed: { vi: 'Không thể cập nhật bài đăng', en: 'Failed to update social post' },
	deleteFailed: { vi: 'Không thể xóa bài đăng', en: 'Failed to delete social post' },
	invalidStatusTransition: {
		vi: 'Chuyển trạng thái không hợp lệ',
		en: 'Invalid status transition'
	},
	scheduleRequired: {
		vi: 'Thời gian lên lịch là bắt buộc',
		en: 'Scheduled time is required'
	},
	platformAccountMissing: {
		vi: 'Không có tài khoản kết nối cho nền tảng này',
		en: 'No connected account for this platform'
	}
} as const;

// ============================================================
// Token encryption — AES-GCM với key derive từ vault indexKey
// NOTE (backlog): production nên chuyển sang dedicated vault record
// (cbVault) thay vì dùng indexKey. Ở đây chỉ cần 1 secret đã có sẵn
// server-side, không lưu plaintext token trong DB.
// ============================================================

let cachedAesKey: CryptoKey | null = null;

async function getTokenAesKey(): Promise<CryptoKey> {
	if (cachedAesKey) return cachedAesKey;
	const indexKey = (systemVault as unknown as { indexKey: Uint8Array | ArrayBuffer }).indexKey;
	if (!indexKey) {
		throw new Error('vault-not-initialized');
	}
	const raw = indexKey instanceof Uint8Array ? indexKey : new Uint8Array(indexKey as ArrayBuffer);
	cachedAesKey = await crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, [
		'encrypt',
		'decrypt'
	]);
	return cachedAesKey;
}

export async function encryptSocialToken(
	plaintext: string
): Promise<{ ivB64: string; ciphertextB64: string }> {
	const key = await getTokenAesKey();
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
	return {
		ivB64: btoa(String.fromCharCode(...iv)),
		ciphertextB64: btoa(
			Array.from(new Uint8Array(ciphertext))
				.map((b) => String.fromCharCode(b))
				.join('')
		)
	};
}

export async function decryptSocialToken(record: {
	ivB64: string;
	ciphertextB64: string;
}): Promise<string> {
	const key = await getTokenAesKey();
	const iv = Uint8Array.from(atob(record.ivB64), (c) => c.charCodeAt(0));
	const ciphertext = Uint8Array.from(atob(record.ciphertextB64), (c) => c.charCodeAt(0));
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
	return new TextDecoder().decode(plaintext);
}

export class SocialAccountService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string
	): Promise<boolean> {
		return PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
	}

	static async listAccounts(
		actor: ActorContext,
		options: { platform?: string; status?: string; page?: number; pageSize?: number } = {}
	) {
		if (!(await this.requirePermission(actor, 'social:read'))) {
			return { success: false as const, messages: accountMessages.permissionDenied };
		}

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: string[] = [];
		if (options.platform) {
			conditions.push(`sa.platform = $${args.length + 1}`);
			args.push(options.platform);
		}
		if (options.status) {
			conditions.push(`sa.status = $${args.length + 1}`);
			args.push(options.status);
		}
		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		try {
			const [countRes, dataRes] = await Promise.all([
				cbSocialAccounts.document.query({
					statement: `SELECT RAW COUNT(*) FROM ${socialAccountsKeyspace} sa ${whereClause}`,
					args,
					readonly: true
				}),
				cbSocialAccounts.document.query({
					statement: `SELECT sa.*, META().id AS _id FROM ${socialAccountsKeyspace} sa ${whereClause} ORDER BY sa.createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
					args,
					readonly: true
				})
			]);

			if (!countRes.ok || !dataRes.ok) {
				return { success: false as const, messages: accountMessages.queryFailed };
			}

			const total = Number(countRes.data?.results?.[0] ?? 0);
			const items = (dataRes.data?.results ?? []).map(sanitizeSocialAccountForAdmin);
			return { success: true as const, items, total, page, pageSize };
		} catch (e) {
			console.error('[SocialAccountService.listAccounts]', e);
			return { success: false as const, messages: accountMessages.queryFailed };
		}
	}

	static async getAccount(actor: ActorContext, accountId: string) {
		if (!(await this.requirePermission(actor, 'social:read'))) {
			return { success: false as const, messages: accountMessages.permissionDenied };
		}

		try {
			const res = await cbSocialAccounts.document.query({
				statement: `SELECT sa.*, META().id AS _id FROM ${socialAccountsKeyspace} sa WHERE sa.accountId = $1 LIMIT 1`,
				args: [accountId],
				readonly: true
			});
			const doc = res.data?.results?.[0];
			if (!doc) {
				return { success: false as const, messages: accountMessages.notFound };
			}
			return { success: true as const, data: sanitizeSocialAccountForAdmin(doc) };
		} catch (e) {
			console.error('[SocialAccountService.getAccount]', e);
			return { success: false as const, messages: accountMessages.queryFailed };
		}
	}

	static async getAccountToken(actor: ActorContext, accountId: string) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: accountMessages.permissionDenied };
		}

		try {
			const res = await cbSocialAccounts.document.query({
				statement: `SELECT sa.accessTokenEncrypted FROM ${socialAccountsKeyspace} sa WHERE sa.accountId = $1 LIMIT 1`,
				args: [accountId],
				readonly: true
			});
			const encrypted = res.data?.results?.[0]?.accessTokenEncrypted;
			if (!encrypted) {
				return { success: false as const, messages: accountMessages.notFound };
			}
			const token = await decryptSocialToken(encrypted);
			return { success: true as const, data: { token } };
		} catch (e) {
			console.error('[SocialAccountService.getAccountToken]', e);
			return { success: false as const, messages: accountMessages.tokenEncryptionFailed };
		}
	}

	/**
	 * Connect chỉ lưu metadata + token encrypted — KHÔNG gọi API mạng xã hội thật.
	 * Backlog: tích hợp OAuth flow thật theo platform (facebook/instagram/zalo/...).
	 */
	static async connectAccount(
		actor: ActorContext,
		input: {
			platform: SocialPlatform;
			accountName: string;
			handle?: string;
			pageId?: string;
			accessToken?: string;
		}
	) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: accountMessages.permissionDenied };
		}

		const now = new Date().toISOString();
		const accountId = `soc_${input.platform}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const documentKey = `social_account_${input.platform}_${Date.now()}`;

		const content: SocialAccountDocument = {
			accountId,
			platform: input.platform,
			accountName: input.accountName,
			handle: input.handle,
			pageId: input.pageId,
			followersCount: 0,
			status: 'connected',
			lastSyncAt: now,
			createdAt: now,
			updatedAt: now
		};
		if (!content.handle) delete (content as unknown as Record<string, unknown>).handle;
		if (!content.pageId) delete (content as unknown as Record<string, unknown>).pageId;

		try {
			if (input.accessToken) {
				try {
					content.accessTokenEncrypted = await encryptSocialToken(input.accessToken);
				} catch (e) {
					if (e instanceof Error && e.message === 'vault-not-initialized') {
						return { success: false as const, messages: accountMessages.vaultUninitialized };
					}
					return { success: false as const, messages: accountMessages.tokenEncryptionFailed };
				}
			}

			await cbSocialAccounts.document.create({ documentKey, content });
			return {
				success: true as const,
				data: sanitizeSocialAccountForAdmin({ ...content, _id: documentKey })
			};
		} catch (e) {
			console.error('[SocialAccountService.connectAccount]', e);
			return { success: false as const, messages: accountMessages.connectFailed };
		}
	}

	static async updateAccount(
		actor: ActorContext,
		accountId: string,
		updates: Partial<{
			accountName: string;
			handle: string;
			pageId: string;
			followersCount: number;
			accessToken: string;
		}>
	) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: accountMessages.permissionDenied };
		}

		try {
			const existing = await this.getAccountUnchecked(accountId);
			if (!existing) {
				return { success: false as const, messages: accountMessages.notFound };
			}

			const setClauses: string[] = [];
			const args: (string | number)[] = [];
			if (updates.accountName !== undefined) {
				setClauses.push(`accountName = $${args.length + 1}`);
				args.push(updates.accountName);
			}
			if (updates.handle !== undefined) {
				setClauses.push(`handle = $${args.length + 1}`);
				args.push(updates.handle);
			}
			if (updates.pageId !== undefined) {
				setClauses.push(`pageId = $${args.length + 1}`);
				args.push(updates.pageId);
			}
			if (updates.followersCount !== undefined) {
				setClauses.push(`followersCount = $${args.length + 1}`);
				args.push(updates.followersCount);
			}
			if (updates.accessToken !== undefined) {
				let encrypted: { ivB64: string; ciphertextB64: string };
				try {
					encrypted = await encryptSocialToken(updates.accessToken);
				} catch (e) {
					if (e instanceof Error && e.message === 'vault-not-initialized') {
						return { success: false as const, messages: accountMessages.vaultUninitialized };
					}
					return { success: false as const, messages: accountMessages.tokenEncryptionFailed };
				}
				setClauses.push(`accessTokenEncrypted = $${args.length + 1}`);
				args.push(encrypted as unknown as string);
			}

			if (!setClauses.length) {
				return { success: true as const, data: sanitizeSocialAccountForAdmin(existing) };
			}

			setClauses.push(`updatedAt = $${args.length + 1}`);
			args.push(new Date().toISOString());
			setClauses.push(`lastSyncAt = $${args.length + 1}`);
			args.push(new Date().toISOString());

			const query = `UPDATE ${socialAccountsKeyspace} SET ${setClauses.join(', ')} WHERE accountId = $${args.length + 1} RETURNING sa.*`;
			const res = await cbSocialAccounts.document.query({
				statement: query,
				args: [...args, accountId]
			});
			const updated = res.data?.results?.[0];
			if (!updated) {
				return { success: false as const, messages: accountMessages.notFound };
			}
			return { success: true as const, data: sanitizeSocialAccountForAdmin(updated) };
		} catch (e) {
			console.error('[SocialAccountService.updateAccount]', e);
			return { success: false as const, messages: accountMessages.updateFailed };
		}
	}

	static async disconnectAccount(actor: ActorContext, accountId: string) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: accountMessages.permissionDenied };
		}

		try {
			const existing = await this.getAccountUnchecked(accountId);
			if (!existing) {
				return { success: false as const, messages: accountMessages.notFound };
			}
			const now = new Date().toISOString();
			// Ngắt kết nối: status = disconnected + xóa token encrypted
			const res = await cbSocialAccounts.document.query({
				statement: `UPDATE ${socialAccountsKeyspace} SET status = 'disconnected', accessTokenEncrypted = NULL, updatedAt = $1 WHERE accountId = $2 RETURNING sa.*`,
				args: [now, accountId]
			});
			const updated = res.data?.results?.[0];
			if (!updated) {
				return { success: false as const, messages: accountMessages.notFound };
			}
			return { success: true as const, data: sanitizeSocialAccountForAdmin(updated) };
		} catch (e) {
			console.error('[SocialAccountService.disconnectAccount]', e);
			return { success: false as const, messages: accountMessages.updateFailed };
		}
	}

	static async deleteAccount(actor: ActorContext, accountId: string) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: accountMessages.permissionDenied };
		}

		try {
			const existing = await this.getAccountUnchecked(accountId);
			if (!existing) {
				return { success: false as const, messages: accountMessages.notFound };
			}
			await cbSocialAccounts.document.query({
				statement: `DELETE FROM ${socialAccountsKeyspace} WHERE accountId = $1`,
				args: [accountId]
			});
			return { success: true as const };
		} catch (e) {
			console.error('[SocialAccountService.deleteAccount]', e);
			return { success: false as const, messages: accountMessages.deleteFailed };
		}
	}

	private static async getAccountUnchecked(accountId: string) {
		const res = await cbSocialAccounts.document.query({
			statement: `SELECT sa.*, META().id AS _id FROM ${socialAccountsKeyspace} sa WHERE sa.accountId = $1 LIMIT 1`,
			args: [accountId],
			readonly: true
		});
		return res.data?.results?.[0] ?? null;
	}
}

export class SocialPostService {
	private static async requirePermission(
		actor: ActorContext,
		permissionKey: string
	): Promise<boolean> {
		return PermissionChecker.can(actor.roleName, permissionKey, {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
	}

	static async listPosts(
		actor: ActorContext,
		options: {
			platform?: string;
			status?: string;
			campaignId?: string;
			page?: number;
			pageSize?: number;
		} = {}
	) {
		if (!(await this.requirePermission(actor, 'social:read'))) {
			return { success: false as const, messages: postMessages.permissionDenied };
		}

		const page = Math.max(1, options.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const conditions: string[] = [];
		const args: string[] = [];
		if (options.platform) {
			conditions.push(`sp.platform = $${args.length + 1}`);
			args.push(options.platform);
		}
		if (options.status) {
			conditions.push(`sp.status = $${args.length + 1}`);
			args.push(options.status);
		}
		if (options.campaignId) {
			conditions.push(`sp.campaignId = $${args.length + 1}`);
			args.push(options.campaignId);
		}
		const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

		try {
			const [countRes, dataRes] = await Promise.all([
				cbSocialPosts.document.query({
					statement: `SELECT RAW COUNT(*) FROM ${socialPostsKeyspace} sp ${whereClause}`,
					args,
					readonly: true
				}),
				cbSocialPosts.document.query({
					statement: `SELECT sp.*, META().id AS _id FROM ${socialPostsKeyspace} sp ${whereClause} ORDER BY sp.createdAt DESC LIMIT ${pageSize} OFFSET ${offset}`,
					args,
					readonly: true
				})
			]);

			if (!countRes.ok || !dataRes.ok) {
				return { success: false as const, messages: postMessages.queryFailed };
			}

			const total = Number(countRes.data?.results?.[0] ?? 0);
			const items = (dataRes.data?.results ?? []).map(sanitizeSocialPostForAdmin);
			return { success: true as const, items, total, page, pageSize };
		} catch (e) {
			console.error('[SocialPostService.listPosts]', e);
			return { success: false as const, messages: postMessages.queryFailed };
		}
	}

	static async getPost(actor: ActorContext, socialPostId: string) {
		if (!(await this.requirePermission(actor, 'social:read'))) {
			return { success: false as const, messages: postMessages.permissionDenied };
		}

		try {
			const res = await cbSocialPosts.document.query({
				statement: `SELECT sp.*, META().id AS _id FROM ${socialPostsKeyspace} sp WHERE sp.socialPostId = $1 LIMIT 1`,
				args: [socialPostId],
				readonly: true
			});
			const doc = res.data?.results?.[0];
			if (!doc) {
				return { success: false as const, messages: postMessages.notFound };
			}
			return { success: true as const, data: sanitizeSocialPostForAdmin(doc) };
		} catch (e) {
			console.error('[SocialPostService.getPost]', e);
			return { success: false as const, messages: postMessages.queryFailed };
		}
	}

	static async createPost(
		actor: ActorContext,
		input: {
			platform: SocialPlatform;
			content: string;
			mediaUrls?: string[];
			campaignId?: string;
			scheduledAt?: string;
		}
	) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: postMessages.permissionDenied };
		}

		// Nếu có campaignId, kiểm tra campaign tồn tại (best-effort)
		if (input.campaignId) {
			const cbCampaigns = cbData('campaigns');
			const campaignsKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`campaigns\``;
			try {
				const check = await cbCampaigns.document.query({
					statement: `SELECT RAW COUNT(*) FROM ${campaignsKeyspace} c WHERE c.campaignId = $1`,
					args: [input.campaignId],
					readonly: true
				});
				if ((check.data?.results?.[0] ?? 0) === 0) {
					return { success: false as const, messages: postMessages.notFound };
				}
			} catch {
				// best-effort — không chặn nếu query lỗi
			}
		}

		const now = new Date().toISOString();
		const socialPostId = `spst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const documentKey = `social_post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

		const content: SocialPostDocument = {
			socialPostId,
			platform: input.platform,
			content: input.content,
			mediaUrls: input.mediaUrls ?? [],
			status: input.scheduledAt ? 'scheduled' : 'draft',
			createdAt: now,
			updatedAt: now
		};
		if (input.scheduledAt) content.scheduledAt = input.scheduledAt;
		if (input.campaignId) content.campaignId = input.campaignId;

		try {
			await cbSocialPosts.document.create({ documentKey, content });
			return {
				success: true as const,
				data: sanitizeSocialPostForAdmin({ ...content, _id: documentKey })
			};
		} catch (e) {
			console.error('[SocialPostService.createPost]', e);
			return { success: false as const, messages: postMessages.createFailed };
		}
	}

	/**
	 * Publish MOCK — set publishedAt + status published + permalink giả.
	 * Backlog: gọi API mạng xã hội thật theo platform (facebook graph, zalo OA, ...).
	 * Khi publish thật cần check có account connected cho platform.
	 */
	static async publishNow(actor: ActorContext, socialPostId: string) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: postMessages.permissionDenied };
		}

		try {
			const existing = await this.getPostUnchecked(socialPostId);
			if (!existing) {
				return { success: false as const, messages: postMessages.notFound };
			}
			const currentStatus = existing.status as SocialPostStatus;
			if (currentStatus === 'published' || currentStatus === 'cancelled') {
				return { success: false as const, messages: postMessages.invalidStatusTransition };
			}

			const now = new Date().toISOString();
			// TODO(real-api): thay externalPostId/permalink mock bằng kết quả API thật
			const externalPostId = `mock_${Date.now()}`;
			const permalink = `https://social.example.com/${existing.platform}/${externalPostId}`;

			const res = await cbSocialPosts.document.query({
				statement: `UPDATE ${socialPostsKeyspace} SET status = 'published', publishedAt = $1, externalPostId = $2, permalink = $3, updatedAt = $4 WHERE socialPostId = $5 RETURNING sp.*`,
				args: [now, externalPostId, permalink, now, socialPostId]
			});
			const updated = res.data?.results?.[0];
			if (!updated) {
				return { success: false as const, messages: postMessages.notFound };
			}
			return { success: true as const, data: sanitizeSocialPostForAdmin(updated) };
		} catch (e) {
			console.error('[SocialPostService.publishNow]', e);
			return { success: false as const, messages: postMessages.updateFailed };
		}
	}

	/**
	 * Schedule: draft → scheduled với scheduledAt.
	 */
	static async schedulePost(actor: ActorContext, socialPostId: string, scheduledAt: string) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: postMessages.permissionDenied };
		}
		if (!scheduledAt) {
			return { success: false as const, messages: postMessages.scheduleRequired };
		}

		try {
			const existing = await this.getPostUnchecked(socialPostId);
			if (!existing) {
				return { success: false as const, messages: postMessages.notFound };
			}
			const currentStatus = existing.status as SocialPostStatus;
			if (currentStatus !== 'draft' && currentStatus !== 'scheduled') {
				return { success: false as const, messages: postMessages.invalidStatusTransition };
			}

			const now = new Date().toISOString();
			const res = await cbSocialPosts.document.query({
				statement: `UPDATE ${socialPostsKeyspace} SET status = 'scheduled', scheduledAt = $1, updatedAt = $2 WHERE socialPostId = $3 RETURNING sp.*`,
				args: [scheduledAt, now, socialPostId]
			});
			const updated = res.data?.results?.[0];
			if (!updated) {
				return { success: false as const, messages: postMessages.notFound };
			}
			return { success: true as const, data: sanitizeSocialPostForAdmin(updated) };
		} catch (e) {
			console.error('[SocialPostService.schedulePost]', e);
			return { success: false as const, messages: postMessages.updateFailed };
		}
	}

	static async cancelPost(actor: ActorContext, socialPostId: string) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: postMessages.permissionDenied };
		}

		try {
			const existing = await this.getPostUnchecked(socialPostId);
			if (!existing) {
				return { success: false as const, messages: postMessages.notFound };
			}
			const currentStatus = existing.status as SocialPostStatus;
			if (currentStatus === 'published' || currentStatus === 'cancelled') {
				return { success: false as const, messages: postMessages.invalidStatusTransition };
			}

			const now = new Date().toISOString();
			const res = await cbSocialPosts.document.query({
				statement: `UPDATE ${socialPostsKeyspace} SET status = 'cancelled', updatedAt = $1 WHERE socialPostId = $2 RETURNING sp.*`,
				args: [now, socialPostId]
			});
			const updated = res.data?.results?.[0];
			if (!updated) {
				return { success: false as const, messages: postMessages.notFound };
			}
			return { success: true as const, data: sanitizeSocialPostForAdmin(updated) };
		} catch (e) {
			console.error('[SocialPostService.cancelPost]', e);
			return { success: false as const, messages: postMessages.updateFailed };
		}
	}

	static async deletePost(actor: ActorContext, socialPostId: string) {
		if (!(await this.requirePermission(actor, 'social:manage'))) {
			return { success: false as const, messages: postMessages.permissionDenied };
		}

		try {
			const existing = await this.getPostUnchecked(socialPostId);
			if (!existing) {
				return { success: false as const, messages: postMessages.notFound };
			}
			await cbSocialPosts.document.query({
				statement: `DELETE FROM ${socialPostsKeyspace} WHERE socialPostId = $1`,
				args: [socialPostId]
			});
			return { success: true as const };
		} catch (e) {
			console.error('[SocialPostService.deletePost]', e);
			return { success: false as const, messages: postMessages.deleteFailed };
		}
	}

	private static async getPostUnchecked(socialPostId: string) {
		const res = await cbSocialPosts.document.query({
			statement: `SELECT sp.*, META().id AS _id FROM ${socialPostsKeyspace} sp WHERE sp.socialPostId = $1 LIMIT 1`,
			args: [socialPostId],
			readonly: true
		});
		return res.data?.results?.[0] ?? null;
	}
}
