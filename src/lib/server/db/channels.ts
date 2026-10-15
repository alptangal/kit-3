// $lib/server/db/channels.ts
// ChannelService — quản lí tài khoản kênh bán (channel_accounts) + đơn từ kênh
// (channel_orders) + đồng bộ (syncOrders) + import đơn kênh vào orders nội bộ.
//
// Pattern theo SocialAccountService (social.ts):
// - credentials AES-GCM encrypt (tái dùng encryptSocialToken/decryptSocialToken)
// - KHÔNG bao giờ trả credentialsEncrypted về API (sanitize + hasCredentials)
// - Adapter pattern: mỗi kênh 1 file trong $lib/server/channels/, registry map.
//
// Import đơn kênh → orders nội bộ:
// - KHÔNG dùng OrderAdminService.create (bắt buộc customerId là role-customer;
//   khách từ kênh có thể không có account) — insert thẳng theo shape OrderDocument,
//   status 'pending', KHÔNG trừ tồn kho (đơn chờ xử lý như đơn online).
// - Match variant qua sku = channelSku (case-insensitive).

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import { systemVault } from '$lib/store/initSystemVault';
import { encryptSocialToken, decryptSocialToken } from './social';
import { getChannelAdapter } from '$lib/server/channels/registry';
import { CHANNEL_IDS, type ChannelId, type ResolvedChannelAccount } from '$lib/server/channels/types';
import { broadcastDbChange } from '$lib/server/db-broadcast';
import type { ActorContext } from './users';

const cbAccounts = cbData('channel_accounts');
const cbOrders = cbData('channel_orders');
const cbInternalOrders = cbData('orders');
const cbVariants = cbData('product_variants');

export type ChannelAccountStatus = 'connected' | 'disconnected' | 'error' | 'pending';
export type ChannelOrderStatus = 'pending_import' | 'imported' | 'failed' | 'cancelled';

const channelMessages = {
	readDenied: {
		vi: 'Bạn không có quyền xem tài khoản kênh bán',
		en: 'You do not have permission to view channel accounts'
	},
	manageDenied: {
		vi: 'Bạn không có quyền quản lí kênh bán',
		en: 'You do not have permission to manage sales channels'
	},
	notFound: { vi: 'Không tìm thấy tài khoản kênh', en: 'Channel account not found' },
	orderNotFound: { vi: 'Không tìm thấy đơn kênh', en: 'Channel order not found' },
	invalidChannel: { vi: 'Kênh không hợp lệ', en: 'Invalid channel' },
	invalidName: { vi: 'Tên tài khoản không được để trống', en: 'Account name is required' },
	alreadyImported: {
		vi: 'Đơn kênh này đã được nhập rồi',
		en: 'This channel order has already been imported'
	},
	importFailed: { vi: 'Nhập đơn kênh thất bại', en: 'Failed to import channel order' },
	syncFailed: { vi: 'Đồng bộ đơn từ kênh thất bại', en: 'Failed to sync orders from channel' },
	noItems: { vi: 'Đơn kênh không có sản phẩm nào', en: 'Channel order has no items' },
	vaultNotReady: {
		vi: 'Hệ thống chưa sẵn sàng (vault chưa khởi tạo) — thử lại sau',
		en: 'System not ready (vault not initialized) — try again later'
	}
};

/** Sanitize account — KHÔNG trả credentialsEncrypted ra ngoài. */
export function sanitizeChannelAccountForAdmin(doc: Record<string, unknown>) {
	return {
		documentKey: doc.documentKey ?? doc._id ?? '',
		channel: doc.channel,
		name: doc.name,
		status: doc.status,
		shopId: doc.shopId ?? null,
		lastSyncAt: doc.lastSyncAt ?? null,
		syncCursor: doc.syncCursor ?? null,
		config: doc.config ?? {},
		lastError: doc.lastError ?? null,
		hasCredentials: Boolean(doc.credentialsEncrypted),
		createdAt: doc.createdAt ?? null,
		updatedAt: doc.updatedAt ?? null
	};
}

/** Sanitize channel order — rawPayload chỉ trả khi client yêu cầu chi tiết. */
export function sanitizeChannelOrderForAdmin(doc: Record<string, unknown>) {
	return {
		documentKey: doc.documentKey ?? doc._id ?? '',
		channel: doc.channel,
		channelOrderId: doc.channelOrderId,
		channelAccountId: doc.channelAccountId,
		orderId: doc.orderId ?? null,
		status: doc.status,
		customerName: doc.customerName ?? null,
		phone: doc.phone ?? null,
		address: doc.address ?? null,
		items: doc.items ?? [],
		totalAmount: doc.totalAmount ?? 0,
		currency: doc.currency ?? 'VND',
		shippingFee: doc.shippingFee ?? 0,
		importError: doc.importError ?? null,
		receivedAt: doc.receivedAt ?? null,
		importedAt: doc.importedAt ?? null,
		createdAt: doc.createdAt ?? null
	};
}

/** Giải mã credentials — chỉ dùng bên trong server (adapter). */
async function resolveAccount(
	doc: Record<string, unknown>
): Promise<ResolvedChannelAccount | null> {
	const encrypted = doc.credentialsEncrypted as
		| Record<string, { ivB64: string; ciphertextB64: string }>
		| undefined;
	if (!encrypted) return null;
	try {
		// credentialsEncrypted shape: { <field>: { ivB64, ciphertextB64 } }
		const credentials: Record<string, string> = {};
		for (const [field, rec] of Object.entries(encrypted)) {
			if (rec && typeof rec === 'object' && 'ivB64' in rec && 'ciphertextB64' in rec) {
				credentials[field] = await decryptSocialToken(rec);
			}
		}
		return {
			documentKey: String(doc.documentKey ?? doc._id ?? ''),
			channel: doc.channel as ChannelId,
			name: String(doc.name ?? ''),
			status: String(doc.status ?? ''),
			shopId: (doc.shopId as string) ?? null,
			syncCursor: (doc.syncCursor as string) ?? null,
			config: (doc.config as Record<string, unknown>) ?? {},
			credentials
		};
	} catch {
		return null;
	}
}

export class ChannelService {
	private static requirePermission(actor: ActorContext, key: string) {
		return PermissionChecker.can(actor.roleName, key, {
			branchId: actor.branchId,
			actorUserId: actor.userId
		});
	}

	// ===== channel_accounts CRUD =====

	static async listAccounts(
		actor: ActorContext,
		params: { search?: string; channel?: string; page?: number; pageSize?: number } = {}
	) {
		if (!this.requirePermission(actor, 'channels:read')) {
			return { success: false as const, messages: channelMessages.readDenied };
		}
		const page = Math.max(1, params.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
		const where: string[] = [];
		const args: unknown[] = [];
		// Data API chỉ hỗ trợ positional args ($1, $2…) + array — KHÔNG dùng named object.
		if (params.channel) {
			args.push(params.channel);
			where.push(`a.channel = $${args.length}`);
		}
		if (params.search) {
			args.push(`%${params.search.toLowerCase()}%`);
			where.push(`(LOWER(a.name) LIKE $${args.length} OR LOWER(a.channel) LIKE $${args.length})`);
		}
		const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const countRes = await cbAccounts.document.query({
			statement: `SELECT RAW COUNT(*) AS count FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_accounts\` a ${whereClause}`,
			args
		});
		if (!countRes.ok) return { success: false as const, messages: channelMessages.syncFailed };
		const total = (countRes.data?.results?.[0] as number) ?? 0;

		const listRes = await cbAccounts.document.query({
			// LIMIT/OFFSET inline — Data API không hỗ trợ param hoá chỗ này,
			// nhưng WHERE vẫn dùng positional args.
			statement: `SELECT a.*, META(a).id AS documentKey FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_accounts\` a ${whereClause} ORDER BY a.createdAt DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
			args
		});
		if (!listRes.ok) return { success: false as const, messages: channelMessages.syncFailed };

		const accounts = (listRes.data?.results ?? []).map((row: Record<string, unknown>) =>
			sanitizeChannelAccountForAdmin(row)
		);
		return { success: true as const, data: { accounts, total, page, pageSize } };
	}

	static async createAccount(
		actor: ActorContext,
		input: {
			channel: string;
			name: string;
			shopId?: string;
			config?: Record<string, unknown>;
			credentials?: Record<string, string>;
		}
	) {
		if (!this.requirePermission(actor, 'channels:manage')) {
			return { success: false as const, messages: channelMessages.manageDenied };
		}
		const channel = input.channel as ChannelId;
		if (!CHANNEL_IDS.includes(channel)) {
			return { success: false as const, messages: channelMessages.invalidChannel };
		}
		if (!input.name?.trim()) {
			return { success: false as const, messages: channelMessages.invalidName };
		}
		const adapter = getChannelAdapter(input.channel);
		if (!adapter) return { success: false as const, messages: channelMessages.invalidChannel };

		let credentialsEncrypted: Record<string, { ivB64: string; ciphertextB64: string }> | undefined;
		if (input.credentials && Object.keys(input.credentials).length > 0) {
			try {
				credentialsEncrypted = {};
				for (const [field, value] of Object.entries(input.credentials)) {
					if (typeof value !== 'string' || !value) continue;
					credentialsEncrypted[field] = await encryptSocialToken(value);
				}
				if (Object.keys(credentialsEncrypted).length === 0) credentialsEncrypted = undefined;
			} catch {
				return { success: false as const, messages: channelMessages.vaultNotReady };
			}
		}

		const now = new Date().toISOString();
		const documentKey = `channel_account_${channel}_${Date.now()}_${Math.random()
			.toString(36)
			.slice(2, 8)}`;
		const doc = {
			channel,
			name: input.name.trim(),
			status: 'pending' as ChannelAccountStatus,
			credentialsEncrypted: credentialsEncrypted ?? null,
			shopId: input.shopId?.trim() || null,
			syncCursor: null,
			config: input.config ?? {},
			lastError: null,
			lastSyncAt: null,
			createdAt: now,
			updatedAt: now
		};
		const createRes = await cbAccounts.document.create({ documentKey, content: doc });
		if (!createRes.ok) {
			return { success: false as const, messages: channelMessages.syncFailed };
		}
		// KHÔNG broadcast: 'channel_accounts' chưa thuộc DbChangeCollection union
		// (db-broadcast.ts) — trang /admin/channels refetch sau mỗi action anyway.
		return { success: true as const, data: { documentKey } };
	}

	/** Update — chỉ đổi name/config/shopId/status; credentials đổi riêng qua endpoint riêng. */
	static async updateAccount(
		actor: ActorContext,
		documentKey: string,
		updates: {
			name?: string;
			shopId?: string | null;
			config?: Record<string, unknown>;
			status?: ChannelAccountStatus;
			credentials?: Record<string, string>;
		}
	) {
		if (!this.requirePermission(actor, 'channels:manage')) {
			return { success: false as const, messages: channelMessages.manageDenied };
		}
		const getRes = await cbAccounts.document.get({ documentKey });
		if (!getRes.ok) return { success: false as const, messages: channelMessages.notFound };
		const existing = getRes.data as Record<string, unknown>;

		const setClauses: string[] = [];
		const args: unknown[] = [];
		const pushArg = (value: unknown) => {
			args.push(value);
			return `$${args.length}`;
		};
		if (updates.name !== undefined) {
			setClauses.push(`name = ${pushArg(String(updates.name).trim())}`);
		}
		if (updates.shopId !== undefined) {
			setClauses.push(`shopId = ${pushArg(updates.shopId || null)}`);
		}
		if (updates.config !== undefined) {
			setClauses.push(`config = ${pushArg(updates.config)}`);
		}
		if (updates.status !== undefined) {
			setClauses.push(`status = ${pushArg(updates.status)}`);
		}
		// Credentials — merge: field mới đè, field=''+null xoá
		if (updates.credentials !== undefined) {
			const current = (existing.credentialsEncrypted as Record<string, unknown>) ?? {};
			const merged: Record<string, { ivB64: string; ciphertextB64: string }> = {};
			for (const [field, rec] of Object.entries(current)) {
				if (rec && typeof rec === 'object' && 'ivB64' in (rec as object)) {
					merged[field] = rec as { ivB64: string; ciphertextB64: string };
				}
			}
			for (const [field, value] of Object.entries(updates.credentials)) {
				if (typeof value !== 'string' || value === '') {
					delete merged[field];
				} else {
					merged[field] = await encryptSocialToken(value);
				}
			}
			setClauses.push(`credentialsEncrypted = ${pushArg(merged)}`);
		}
		setClauses.push(`updatedAt = ${pushArg(new Date().toISOString())}`);
		setClauses.push(`WHERE META().id = ${pushArg(documentKey)}`);

		if (args.length === 1) {
			// chỉ WHERE — không có field nào để update
			return { success: true as const, data: { documentKey } };
		}

		const res = await cbAccounts.document.query({
			statement: `UPDATE \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_accounts\` SET ${setClauses.join(', ')}`,
			args
		});
		if (!res.ok) return { success: false as const, messages: channelMessages.syncFailed };
		return { success: true as const, data: { documentKey } };
	}

	static async deleteAccount(actor: ActorContext, documentKey: string) {
		if (!this.requirePermission(actor, 'channels:manage')) {
			return { success: false as const, messages: channelMessages.manageDenied };
		}
		const res = await cbAccounts.document.delete({ documentKey });
		if (!res.ok && res.status !== 404) {
			return { success: false as const, messages: channelMessages.syncFailed };
		}
		return { success: true as const, data: { documentKey } };
	}

	// ===== testConnection =====

	static async testConnection(actor: ActorContext, documentKey: string) {
		if (!this.requirePermission(actor, 'channels:manage')) {
			return { success: false as const, messages: channelMessages.manageDenied };
		}
		const getRes = await cbAccounts.document.get({ documentKey });
		if (!getRes.ok) return { success: false as const, messages: channelMessages.notFound };
		const doc = getRes.data as Record<string, unknown>;
		const adapter = getChannelAdapter(String(doc.channel));
		if (!adapter) return { success: false as const, messages: channelMessages.invalidChannel };

		const account = await resolveAccount(doc);
		if (!account) {
			// Không có credentials (hoặc giải mã lỗi) → testConnection không chạy được
			await this.setAccountError(documentKey, 'Thiếu credentials hoặc vault chưa sẵn sàng');
			return { success: false as const, messages: channelMessages.vaultNotReady };
		}
		try {
			const result = adapter.testConnection
				? await adapter.testConnection(account)
				: { ok: true, message: 'Kênh không hỗ trợ test connection — coi như OK' };
			const newStatus: ChannelAccountStatus = result.ok ? 'connected' : 'error';
			await cbAccounts.document.query({
				statement: `UPDATE \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_accounts\` SET status = $1, lastError = $2, updatedAt = $3 WHERE META().id = $4`,
				args: [
					newStatus,
					result.ok ? null : (result.message ?? 'Test connection failed'),
					new Date().toISOString(),
					documentKey
				]
			});
			return {
				success: true as const,
				data: { ok: result.ok, message: result.message ?? null, status: newStatus }
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			await this.setAccountError(documentKey, msg);
			return { success: false as const, messages: { vi: msg, en: msg } };
		}
	}

	private static async setAccountError(documentKey: string, errorMessage: string) {
		await cbAccounts.document.query({
			statement: `UPDATE \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_accounts\` SET status = 'error', lastError = $1, updatedAt = $2 WHERE META().id = $3`,
			args: [errorMessage, new Date().toISOString(), documentKey]
		});
	}

	// ===== syncOrders =====

	static async syncOrders(actor: ActorContext, documentKey: string) {
		if (!this.requirePermission(actor, 'channels:manage')) {
			return { success: false as const, messages: channelMessages.manageDenied };
		}
		const getRes = await cbAccounts.document.get({ documentKey });
		if (!getRes.ok) return { success: false as const, messages: channelMessages.notFound };
		const doc = getRes.data as Record<string, unknown>;
		const adapter = getChannelAdapter(String(doc.channel));
		if (!adapter) return { success: false as const, messages: channelMessages.invalidChannel };

		const account = await resolveAccount(doc);
		if (!account) {
			await this.setAccountError(documentKey, 'Không giải mã được credentials');
			return { success: false as const, messages: channelMessages.vaultNotReady };
		}

		try {
			const { orders, cursor } = await adapter.fetchNewOrders(account, account.syncCursor ?? null);
			let inserted = 0;
			let skipped = 0;
			for (const dto of orders) {
				// Dedup: đơn đã tồn tại (cùng account + channelOrderId) → bỏ qua
				const dupCheck = await cbOrders.document.query({
					statement: `SELECT RAW COUNT(*) FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_orders\` WHERE channelAccountId = $1 AND channelOrderId = $2`,
					args: [documentKey, dto.channelOrderId]
				});
				const count = (dupCheck.data?.results?.[0] as number) ?? 0;
				if (count > 0) {
					skipped++;
					continue;
				}
				const nowIso = new Date().toISOString();
				const orderDocKey = `channel_order_${crypto.randomUUID()}`;
				await cbOrders.document.create({
					documentKey: orderDocKey,
					content: {
						channel: account.channel,
						channelOrderId: dto.channelOrderId,
						channelAccountId: documentKey,
						status: 'pending_import',
						customerName: dto.customerName ?? null,
						phone: dto.phone ?? null,
						address: dto.address ?? null,
						items: dto.items.map((it) => ({
							variantId: it.variantId ?? null,
							channelSku: it.channelSku,
							name: it.name,
							quantity: it.quantity,
							unitPrice: it.unitPrice
						})),
						totalAmount: dto.totalAmount,
						currency: dto.currency ?? 'VND',
						shippingFee: dto.shippingFee ?? 0,
						rawPayload: dto.rawPayload ?? null,
						importError: null,
						receivedAt: dto.placedAt ?? nowIso,
						importedAt: null,
						createdAt: nowIso
					}
				});
				inserted++;
			}

			// Cập nhật account: cursor + lastSyncAt + status
			await cbAccounts.document.query({
				statement: `UPDATE \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_accounts\` SET syncCursor = $1, lastSyncAt = $2, status = 'connected', lastError = NULL, updatedAt = $3 WHERE META().id = $4`,
				args: [
					cursor ?? account.syncCursor,
					new Date().toISOString(),
					new Date().toISOString(),
					documentKey
				]
			});
			return { success: true as const, data: { inserted, skipped, cursor } };
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			await this.setAccountError(documentKey, msg);
			return { success: false as const, messages: { vi: `Đồng bộ thất bại: ${msg}`, en: `Sync failed: ${msg}` } };
		}
	}

	// ===== channel_orders list =====

	static async listOrders(
		actor: ActorContext,
		params: {
			channelAccountId?: string;
			channel?: string;
			status?: string;
			search?: string;
			page?: number;
			pageSize?: number;
		} = {}
	) {
		if (!this.requirePermission(actor, 'channels:read')) {
			return { success: false as const, messages: channelMessages.readDenied };
		}
		const page = Math.max(1, params.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
		const where: string[] = [];
		const args: unknown[] = [];
		// Data API chỉ hỗ trợ positional args ($1, $2…) + array — KHÔNG dùng named object.
		if (params.channelAccountId) {
			args.push(params.channelAccountId);
			where.push(`o.channelAccountId = $${args.length}`);
		}
		if (params.channel) {
			args.push(params.channel);
			where.push(`o.channel = $${args.length}`);
		}
		if (params.status) {
			args.push(params.status);
			where.push(`o.status = $${args.length}`);
		}
		if (params.search) {
			args.push(`%${params.search.toLowerCase()}%`);
			where.push(
				`(LOWER(o.channelOrderId) LIKE $${args.length} OR LOWER(o.customerName) LIKE $${args.length} OR LOWER(o.phone) LIKE $${args.length})`
			);
		}
		const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

		const countRes = await cbOrders.document.query({
			statement: `SELECT RAW COUNT(*) FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_orders\` o ${whereClause}`,
			args
		});
		if (!countRes.ok) return { success: false as const, messages: channelMessages.syncFailed };
		const total = (countRes.data?.results?.[0] as number) ?? 0;

		const listRes = await cbOrders.document.query({
			// LIMIT/OFFSET inline — Data API không hỗ trợ param hoá chỗ này,
			// nhưng WHERE vẫn dùng positional args.
			statement: `SELECT o.*, META(o).id AS documentKey FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_orders\` o ${whereClause} ORDER BY o.createdAt DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
			args
		});
		if (!listRes.ok) return { success: false as const, messages: channelMessages.syncFailed };

		const orders = (listRes.data?.results ?? []).map((row: Record<string, unknown>) =>
			sanitizeChannelOrderForAdmin(row)
		);
		return { success: true as const, data: { orders, total, page, pageSize } };
	}

	// ===== importChannelOrder =====

	/**
	 * Nhập 1 đơn kênh thành order nội bộ:
	 * - Match từng item với product_variants theo sku = channelSku (case-insensitive).
	 * - KHÔNG trừ tồn kho — đơn vào status 'pending' chờ xử lý.
	 * - Item KHÔNG match variant vẫn giữ (variantId null) — xử lý sau.
	 */
	static async importChannelOrder(actor: ActorContext, documentKey: string) {
		if (!this.requirePermission(actor, 'channels:manage')) {
			return { success: false as const, messages: channelMessages.manageDenied };
		}
		const getRes = await cbOrders.document.get({ documentKey });
		if (!getRes.ok) return { success: false as const, messages: channelMessages.orderNotFound };
		const doc = getRes.data as Record<string, unknown>;
		if (doc.status === 'imported') {
			return { success: false as const, messages: channelMessages.alreadyImported };
		}
		if (doc.status === 'cancelled') {
			return { success: false as const, messages: channelMessages.alreadyImported };
		}
		const items = (doc.items as unknown[]) ?? [];
		if (!Array.isArray(items) || items.length === 0) {
			return { success: false as const, messages: channelMessages.noItems };
		}

		// Match variant theo SKU
		const orderItems: { variantId: string | null; lotId?: string; quantity: number; price: number }[] =
			[];
		const unmatchedSkus: string[] = [];
		for (const raw of items) {
			const it = raw as {
				variantId?: string | null;
				channelSku?: string;
				quantity?: number;
				unitPrice?: number;
				name?: string;
			};
			let variantId = it.variantId ?? null;
			if (!variantId && it.channelSku) {
				const skuRes = await cbVariants.document.query({
					statement: `SELECT META(v).id AS documentKey, v.sku FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`product_variants\` v WHERE LOWER(v.sku) = $1 AND (v.status = 'active' OR v.status IS MISSING) LIMIT 1`,
					args: [it.channelSku.toLowerCase()]
				});
				const hit = skuRes.data?.results?.[0] as { documentKey: string } | undefined;
				if (hit) {
					variantId = hit.documentKey;
				} else {
					unmatchedSkus.push(it.channelSku);
				}
			}
			orderItems.push({
				variantId,
				quantity: Number(it.quantity ?? 1),
				price: Number(it.unitPrice ?? 0)
			});
		}

		// Tạo order nội bộ — insert thẳng (không qua OrderAdminService.create
		// vì cần customerId role-customer; khách kênh không có account nội bộ).
		const now = new Date().toISOString();
		const orderCode = `CH-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random()
			.toString(36)
			.slice(2, 6)
			.toUpperCase()}`;
		const internalOrderKey = `order::${crypto.randomUUID()}`;
		const totalAmount = Number(doc.totalAmount ?? 0);
		const internalOrder = {
			orderCode,
			customerId: null,
			staffId: actor.userId,
			branchId: actor.branchId,
			status: 'pending',
			items: orderItems,
			totalAmount,
			channelSource: doc.channel,
			channelOrderId: doc.channelOrderId,
			channelOrderDocumentKey: documentKey,
			createdAt: now,
			updatedAt: now
		};
		const createRes = await cbInternalOrders.document.create({
			documentKey: internalOrderKey,
			content: internalOrder
		});
		if (!createRes.ok) {
			return { success: false as const, messages: channelMessages.importFailed };
		}

		// Đánh dấu imported + link
		const updRes = await cbOrders.document.query({
			statement: `UPDATE \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`channel_orders\` SET status = 'imported', orderId = $1, importedAt = $2, importError = NULL WHERE META().id = $3`,
			args: [internalOrderKey, now, documentKey]
		});
		if (!updRes.ok) {
			return { success: false as const, messages: channelMessages.importFailed };
		}

		// Broadcast realtime: đơn orders mới xuất hiện (pages orders refetch);
		// channel_orders không thuộc union DbChangeCollection — trang channels tự refetch.
		void broadcastDbChange({ collection: 'orders', action: 'create', by: actor.userId });

		return {
			success: true as const,
			data: {
				orderId: internalOrderKey,
				orderCode,
				unmatchedSkus,
				importedItems: orderItems.length
			}
		};
	}
}
