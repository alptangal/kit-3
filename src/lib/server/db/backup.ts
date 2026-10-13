// $lib/server/db/backup.ts
// BackupService — backup / restore TOÀN BỘ dữ liệu các collection trong scope
// hiện tại của bucket (tên bucket/scope từ env, xem $modules/couchbase/clients.ts).
//
// Giới hạn đã ghi nhận (MVP):
// - Backup gói TẤT CẢ docs vào MỘT JSON object trong memory → chấp nhận cho DB
//   vài chục MB. DB lớn hơn cần chuyển sang stream/chunk file ngoài MVP.
// - exportCollection paginate theo OFFSET (LIMIT/OFFSET) — với DB rất lớn offset
//   sâu sẽ chậm dần; MVP chấp nhận (maxDocs mặc định 200k/collection làm chặn
//   memory tuyệt đối).
// - Restore CHỈ 'upsert' (ghi đè theo _id, KHÔNG xoá document dư) — không có
//   mode destructive delete-first trong MVP.
// - Không backup collection trên cluster VAULT (system_secrets) — chỉ cluster DATA.

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/users';
import { PermissionChecker } from '$modules/rbac/permission-checker';
import type { CollectionName } from '$modules/schema';

// collectionsName KHÔNG được export từ $modules/schema.ts (chỉ export type
// CollectionName). schema.ts thuộc agent phase-5 đang chạy song song nên KHÔNG
// sửa — ở đây liệt kê SONG SONG danh sách 39 collection (bản copy từ schema.ts
// dòng 3–44). NẾU schema.ts THÊM collection mới thì PHẢI CẬP NHẬT cả mảng này
// (thứ tự + nội dung khớp để type-check bắt lệch qua `satisfies`).
const BACKUP_COLLECTIONS = [
	'users',
	'webauthn_challenges',
	'name_roles',
	'permissions',
	'detail_roles',
	'user_status',
	'products',
	'product_variants',
	'product_variant_attributes',
	'inventory_stock',
	'inventory_lots',
	'stock_movements',
	'orders',
	'suppliers',
	'purchase_orders',
	'stock_transfers',
	'stock_takes',
	'brands',
	'categories',
	'branches',
	'payments',
	'order_returns',
	'pos_sessions',
	'promotions',
	'loyalty_transactions',
	'audit_logs',
	'notifications',
	'notification_templates',
	'conversations',
	'messages',
	'system',
	'refresh_tokens',
	'token_rotation_logs',
	'system_secrets',
	'user_preferences',
	'carts',
	'checkouts',
	'shipments',
	'partykit_sync_state'
] as const satisfies readonly CollectionName[];

/** Tập hợp tên collection hợp lệ (theo schema) — dùng validate restore. */
const KNOWN_COLLECTIONS = new Set<string>(BACKUP_COLLECTIONS);

// ── Messages ──
export const backupMessages = {
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent,
	listFailed: {
		vi: 'Liệt kê collection thất bại',
		en: 'Failed to list collections'
	} as TranslateContent,
	exportFailed: {
		vi: 'Tạo backup thất bại',
		en: 'Failed to create backup'
	} as TranslateContent,
	restoreFailed: {
		vi: 'Khôi phục backup thất bại',
		en: 'Failed to restore backup'
	} as TranslateContent,
	invalidBackup: {
		vi: 'File backup không hợp lệ (thiếu version/collections)',
		en: 'Invalid backup file (missing version/collections)'
	} as TranslateContent,
	unknownCollection: {
		vi: 'Backup chứa collection không có trong schema',
		en: 'Backup contains a collection not present in the schema'
	} as TranslateContent
};

// ── Quyền ──
// Permission 'backup:manage' CHƯA tồn tại trong seed permissions (seed-data.ts chỉ
// có products:*/orders:*/inventory:*/... + 'reports:view'). Permission 'system:manage'
// cũng CHƯA có trong seed (chỉ được nhắc trong comment của system-settings.ts).
// Do đó kiểm quyền THEO ROLENAME TRỰC TIẾP như SystemSettingsService đã làm cho
// settings (xem comment đầu file đó): chỉ 'owner' được backup/restore DB toàn hệ
// thống — thao tác chạm toàn bộ dữ liệu, không phù hợp scope own_branch/own_records.
// Fallback PermissionChecker.getScope('backup:manage') giữ sẵn để khi seed thêm
// permission này, role được grant vẫn qua được mà không phải sửa code.
const ALLOWED_ROLES = ['owner'];

/** Kiểm quyền backup/restore — trả null nếu OK, ngược lại trả failure chuẩn service. */
async function requireBackupPermission(
	actor: ActorContext
): Promise<{ success: false; messages: TranslateContent } | null> {
	if (ALLOWED_ROLES.includes(actor.roleName)) return null;
	const scope = await PermissionChecker.getScope(actor.roleName, 'backup:manage');
	if (scope) return null;
	return { success: false, messages: backupMessages.permissionDenied };
}

// ── Shape backup document ──
export interface BackupDoc {
	_id: string;
	[k: string]: unknown;
}
export interface BackupCollection {
	count: number;
	docs: BackupDoc[];
}
export interface BackupPayload {
	version: 1;
	createdAt: string;
	actor: string;
	collections: Record<string, BackupCollection>;
}

export interface BackupListRow {
	name: string;
	count: number;
}

export interface BackupRestoreSummary {
	collections: Record<string, { upserted: number; failed: number }>;
	totalUpserted: number;
}

const auditKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`audit_logs\``;
const cbAudit = cbData('audit_logs');

/** Ghi 1 dòng audit log vào collection 'audit_logs' (fire-and-forget, không chặn flow). */
async function writeAuditLog(
	actor: ActorContext,
	action: string,
	detail: Record<string, unknown>
): Promise<void> {
	try {
		await cbAudit.document.create({
			content: {
				userId: actor.userId,
				userRole: actor.roleName,
				action,
				collectionName: 'backup',
				documentId: '-',
				changes: detail,
				createdAt: new Date().toISOString()
			}
		});
	} catch {
		// Audit log không được phép làm rơi thao tác backup/restore đã chạy xong.
	}
}

export class BackupService {
	/**
	 * Liệt kê các collection trong scope hiện tại + số docs mỗi collection
	 * (cho UI ước lượng kích thước backup).
	 */
	static async listCollections(
		actor: ActorContext
	): Promise<
		| { success: false; messages: TranslateContent }
		| { success: true; items: BackupListRow[] }
	> {
		const denied = await requireBackupPermission(actor);
		if (denied) return denied;

		const cbSystem = cbData('system');
		try {
			const listRes = await cbSystem.document.query({
				statement: `SELECT name FROM system:keyspaces WHERE \`bucket\` = "${cb_bucketName}" AND \`scope\` = "${cb_scopeName}"`,
				readonly: true
			});
			if (!listRes.ok) return { success: false, messages: backupMessages.listFailed };

			const names = ((listRes.data?.results ?? []) as { name?: string }[])
				.map((row) => row.name)
				.filter((n): n is string => Boolean(n));

			// Đếm docs song song — 1 query COUNT(*) mỗi collection.
			const counts = await Promise.all(
				names.map(async (name) => {
					try {
						const res = await cbSystem.document.query({
							statement: `SELECT RAW COUNT(*) FROM \`${cb_bucketName}\`.\`${cb_scopeName}\`.\`${name}\``,
							readonly: true
						});
						return Number(res.data?.results?.[0] ?? 0);
					} catch {
						return 0;
					}
				})
			);

			const items = names
				.map((name, i) => ({ name, count: counts[i] }))
				.sort((a, b) => a.name.localeCompare(b.name));
			return { success: true, items };
		} catch {
			return { success: false, messages: backupMessages.listFailed };
		}
	}

	/**
	 * Scan toàn bộ docs của 1 collection (paginate theo offset để không nghẽn
	 * memory từng query). Trả mảng docs phẳng { _id, ...fields }.
	 *
	 * LƯU Ý shape row: SELECT thường (không RAW) bị Couchbase bọc mỗi row trong
	 * { <tên-collection>: {...} } (xem comment ở couchbase.ts search). Dùng
	 * `SELECT RAW {object-constructor}` — RAW bỏ bọc wrapper, trả đúng object
	 * ta build: { _id, d } với d là body gốc của document.
	 */
	static async exportCollection(
		name: string,
		options: { chunkSize?: number; maxDocs?: number } = {}
	): Promise<BackupDoc[]> {
		const chunkSize = Math.min(1000, Math.max(1, options.chunkSize ?? 500));
		// maxDocs chặn tràn memory tuyệt đối (MVP).
		const maxDocs = Math.max(1, options.maxDocs ?? 200_000);
		const keyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`${name}\``;
		const cbClient = cbData(name as CollectionName);

		const docs: BackupDoc[] = [];
		let offset = 0;
		while (offset < maxDocs) {
			const res = await cbClient.document.query({
				statement: `SELECT RAW {"_id": META().id, "d": t} FROM ${keyspace} t ORDER BY META().id LIMIT ${chunkSize} OFFSET ${offset}`,
				readonly: true,
				timeout: '60s'
			});
			if (!res.ok) {
				throw new Error(
					`Export collection "${name}" failed at offset ${offset}: ${res.message ?? res.status}`
				);
			}
			const rows = (res.data?.results ?? []) as { _id?: string; d?: Record<string, unknown> }[];
			for (const row of rows) {
				if (row?._id && row.d && typeof row.d === 'object') {
					docs.push({ ...row.d, _id: row._id });
				}
			}
			if (rows.length < chunkSize) break; // hết docs
			offset += chunkSize;
		}
		return docs;
	}

	/**
	 * Tạo backup JSON cho TẤT CẢ collections (hoặc subset qua options.collections).
	 * Trả payload object để API route serialize thành file download.
	 */
	static async createBackup(
		actor: ActorContext,
		options: { collections?: string[]; chunkSize?: number } = {}
	): Promise<
		| { success: false; messages: TranslateContent }
		| { success: true; backup: BackupPayload }
	> {
		const denied = await requireBackupPermission(actor);
		if (denied) return denied;

		try {
			const list = await this.listCollections(actor);
			if (!list.success) return { success: false, messages: backupMessages.exportFailed };

			const wanted = options.collections?.filter(Boolean) ?? [];
			const targetNames = wanted.length
				? list.items.filter((row) => wanted.includes(row.name)).map((row) => row.name)
				: list.items.map((row) => row.name);

			const collections: Record<string, BackupCollection> = {};
			for (const name of targetNames) {
				const docs = await this.exportCollection(name, { chunkSize: options.chunkSize });
				collections[name] = { count: docs.length, docs };
			}

			const backup: BackupPayload = {
				version: 1,
				createdAt: new Date().toISOString(),
				actor: actor.userId,
				collections
			};

			await writeAuditLog(actor, 'backup:create', {
				collections: targetNames,
				totalDocs: Object.values(collections).reduce((sum, c) => sum + c.count, 0)
			});
			return { success: true, backup };
		} catch {
			return { success: false, messages: backupMessages.exportFailed };
		}
	}

	/**
	 * Khôi phục backup: UPSERT từng doc theo _id — overwrite NGUYÊN VẸN document
	 * (PUT full body qua document.update overwriteAll, KHÔNG merge với bản hiện có,
	 * KHÔNG xoá document dư ngoài backup — mode 'upsert' duy nhất của MVP).
	 * Chỉ nhận collection có trong schema (chống N1QL injection qua tên keyspace).
	 * Trả summary số doc upsert/failed mỗi collection.
	 */
	static async restoreBackup(
		actor: ActorContext,
		backupJson: unknown,
		options: { collections?: string[] } = {}
	): Promise<
		| { success: false; messages: TranslateContent }
		| { success: true; summary: BackupRestoreSummary }
	> {
		const denied = await requireBackupPermission(actor);
		if (denied) return denied;

		// Validate shape tối thiểu
		if (
			!backupJson ||
			typeof backupJson !== 'object' ||
			(backupJson as { version?: unknown }).version !== 1 ||
			typeof (backupJson as { collections?: unknown }).collections !== 'object' ||
			(backupJson as { collections?: unknown }).collections === null
		) {
			return { success: false, messages: backupMessages.invalidBackup };
		}
		const payload = backupJson as BackupPayload;
		const collectionNames = Object.keys(payload.collections ?? {});
		if (collectionNames.length === 0) {
			return { success: false, messages: backupMessages.invalidBackup };
		}

		// Chống injection tên keyspace + collection lạ: bắt buộc nằm trong schema.
		for (const name of collectionNames) {
			if (!KNOWN_COLLECTIONS.has(name)) {
				return { success: false, messages: backupMessages.unknownCollection };
			}
		}

		const wanted = options.collections?.filter(Boolean) ?? [];
		const targetNames = wanted.length
			? collectionNames.filter((n) => wanted.includes(n))
			: collectionNames;

		const summary: BackupRestoreSummary = { collections: {}, totalUpserted: 0 };

		try {
			for (const name of targetNames) {
				const group = payload.collections[name];
				const docs = Array.isArray(group?.docs) ? group.docs : [];
				const cbClient = cbData(name as CollectionName);

				let upserted = 0;
				let failed = 0;
				for (const doc of docs) {
					if (!doc || typeof doc !== 'object') {
						failed++;
						continue;
					}
					const { _id, ...body } = doc as BackupDoc;
					if (typeof _id !== 'string' || !_id) {
						failed++;
						continue;
					}
					try {
						const res = await cbClient.document.update({
							documentKey: _id,
							content: body,
							// overwriteAll: PUT nguyên body (bỏ qua merge với bản hiện có) —
							// restore phải tái tạo ĐÚNG trạng thái lúc backup.
							overwriteAll: true
						});
						if (res.ok) upserted++;
						else failed++;
					} catch {
						failed++;
					}
				}

				summary.collections[name] = { upserted, failed };
				summary.totalUpserted += upserted;
			}

			await writeAuditLog(actor, 'backup:restore', {
				collections: targetNames,
				totalUpserted: summary.totalUpserted,
				totalFailed: Object.values(summary.collections).reduce((s, c) => s + c.failed, 0)
			});
			return { success: true, summary };
		} catch {
			return { success: false, messages: backupMessages.restoreFailed };
		}
	}
}
