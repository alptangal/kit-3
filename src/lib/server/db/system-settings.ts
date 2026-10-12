// $lib/server/db/system-settings.ts
// SystemSettingsService — settings toàn hệ thống (app settings) persisted trong
// collection 'system' (documentKey 'app-settings'). Collection 'system' đã có sẵn
// trong schema + seed (hiện chứa document 'initApp' — xem seed-data.ts seedAllCatalogData).
//
// Quyền: permission 'system:manage' CHƯA có trong seed permissions → kiểm roleName
// TRỰC TIẾP trong service (không qua PermissionChecker.can với key chưa tồn tại):
//   - 'owner'   : được SỬA settings (update) + đọc
//   - 'manager' : chỉ được ĐỌC (kiểm qua PermissionChecker.getScope 'reports:view')
//   - còn lại   : không đọc được (permissionDenied)

import type { TranslateContent } from '$interfaces/basic';
import { cb_bucketName, cb_scopeName } from '$env/static/private';
import { cbData } from '$modules/couchbase/clients';
import type { ActorContext } from '$lib/server/db/users';
import { PermissionChecker } from '$modules/rbac/permission-checker';

const cbSystem = cbData('system');
const systemKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`system\``;

const SETTINGS_DOCUMENT_KEY = 'app-settings';

// ── Messages ──
export const systemSettingsMessages = {
	notFound: {
		vi: 'Không tìm thấy cấu hình hệ thống',
		en: 'System settings not found'
	} as TranslateContent,
	queryFailed: {
		vi: 'Lấy cấu hình hệ thống thất bại',
		en: 'Failed to fetch system settings'
	} as TranslateContent,
	updateFailed: {
		vi: 'Cập nhật cấu hình hệ thống thất bại',
		en: 'Failed to update system settings'
	} as TranslateContent,
	createFailed: {
		vi: 'Tạo cấu hình hệ thống thất bại',
		en: 'Failed to create system settings'
	} as TranslateContent,
	permissionDenied: {
		vi: 'Bạn không có quyền thực hiện thao tác này',
		en: 'You do not have permission to perform this action'
	} as TranslateContent
};

// ── Settings shape (persisted document) ──
export interface SystemSettingsGeneral {
	appName: string;
	defaultLang: 'vi' | 'en';
	timezone: string;
}
export interface SystemSettingsSecurity {
	sessionTimeoutMinutes: number;
	maxLoginAttempts: number;
	passwordMinLength: number;
}
export interface SystemSettingsCommerce {
	currency: 'VND' | 'USD';
	taxRatePercent: number;
	lowStockThreshold: number;
}
export interface SystemSettingsAppearance {
	theme: 'light' | 'dark' | 'system';
	density: 'comfortable' | 'compact';
}
export interface SystemSettings {
	general: SystemSettingsGeneral;
	security: SystemSettingsSecurity;
	commerce: SystemSettingsCommerce;
	appearance: SystemSettingsAppearance;
}

export type SystemSettingsPatch = {
	general?: Partial<SystemSettingsGeneral>;
	security?: Partial<SystemSettingsSecurity>;
	commerce?: Partial<SystemSettingsCommerce>;
	appearance?: Partial<SystemSettingsAppearance>;
};

/** Mặc định khi document chưa có (lần chạy đầu) */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
	general: {
		appName: 'Kit Admin',
		defaultLang: 'vi',
		timezone: 'Asia/Ho_Chi_Minh'
	},
	security: {
		sessionTimeoutMinutes: 30,
		maxLoginAttempts: 5,
		passwordMinLength: 8
	},
	commerce: {
		currency: 'VND',
		taxRatePercent: 10,
		lowStockThreshold: 10
	},
	appearance: {
		theme: 'system',
		density: 'comfortable'
	}
};

/** Ghép patch lên settings mặc định — chỉ nhận field đã khai báo (không phần mở rộng lạ). */
function mergeWithDefaults(patch: SystemSettingsPatch | undefined): SystemSettings {
	const base: SystemSettings = {
		general: { ...DEFAULT_SYSTEM_SETTINGS.general },
		security: { ...DEFAULT_SYSTEM_SETTINGS.security },
		commerce: { ...DEFAULT_SYSTEM_SETTINGS.commerce },
		appearance: { ...DEFAULT_SYSTEM_SETTINGS.appearance }
	};
	if (!patch) return base;
	if (patch.general) {
		if (typeof patch.general.appName === 'string') base.general.appName = patch.general.appName;
		if (patch.general.defaultLang === 'vi' || patch.general.defaultLang === 'en') {
			base.general.defaultLang = patch.general.defaultLang;
		}
		if (typeof patch.general.timezone === 'string') base.general.timezone = patch.general.timezone;
	}
	if (patch.security) {
		if (typeof patch.security.sessionTimeoutMinutes === 'number' && Number.isFinite(patch.security.sessionTimeoutMinutes)) {
			base.security.sessionTimeoutMinutes = patch.security.sessionTimeoutMinutes;
		}
		if (typeof patch.security.maxLoginAttempts === 'number' && Number.isFinite(patch.security.maxLoginAttempts)) {
			base.security.maxLoginAttempts = patch.security.maxLoginAttempts;
		}
		if (typeof patch.security.passwordMinLength === 'number' && Number.isFinite(patch.security.passwordMinLength)) {
			base.security.passwordMinLength = patch.security.passwordMinLength;
		}
	}
	if (patch.commerce) {
		if (patch.commerce.currency === 'VND' || patch.commerce.currency === 'USD') {
			base.commerce.currency = patch.commerce.currency;
		}
		if (typeof patch.commerce.taxRatePercent === 'number' && Number.isFinite(patch.commerce.taxRatePercent)) {
			base.commerce.taxRatePercent = patch.commerce.taxRatePercent;
		}
		if (typeof patch.commerce.lowStockThreshold === 'number' && Number.isFinite(patch.commerce.lowStockThreshold)) {
			base.commerce.lowStockThreshold = patch.commerce.lowStockThreshold;
		}
	}
	if (patch.appearance) {
		if (
			patch.appearance.theme === 'light' ||
			patch.appearance.theme === 'dark' ||
			patch.appearance.theme === 'system'
		) {
			base.appearance.theme = patch.appearance.theme;
		}
		if (
			patch.appearance.density === 'comfortable' ||
			patch.appearance.density === 'compact'
		) {
			base.appearance.density = patch.appearance.density;
		}
	}
	return base;
}

export class SystemSettingsService {
	/** Document settings có vai trò owner? (kênh cho canEdit UI) */
	static canEdit(actor: ActorContext): boolean {
		return actor.roleName === 'owner';
	}

	/**
	 * Đọc defaults công khai (theme/density/defaultLang) — KHÔNG check quyền.
	 * Dùng cho fallback per-user preferences sau login (mọi user đã đăng nhập
	 * đều cần biết theme/ngôn ngữ mặc định hệ thống; không lộ security/commerce).
	 */
	static async getPublicDefaults(): Promise<{
		theme: 'light' | 'dark' | 'system';
		density: 'comfortable' | 'compact';
		defaultLang: 'vi' | 'en';
	}> {
		try {
			const res = await cbSystem.document.get({ documentKey: SETTINGS_DOCUMENT_KEY });
			if (!res.ok || !res.data) {
				return {
					theme: DEFAULT_SYSTEM_SETTINGS.appearance.theme,
					density: DEFAULT_SYSTEM_SETTINGS.appearance.density,
					defaultLang: DEFAULT_SYSTEM_SETTINGS.general.defaultLang
				};
			}
			const raw = res.data as { settings?: SystemSettingsPatch };
			const merged = mergeWithDefaults(raw?.settings);
			return {
				theme: merged.appearance.theme,
				density: merged.appearance.density,
				defaultLang: merged.general.defaultLang
			};
		} catch {
			return {
				theme: DEFAULT_SYSTEM_SETTINGS.appearance.theme,
				density: DEFAULT_SYSTEM_SETTINGS.appearance.density,
				defaultLang: DEFAULT_SYSTEM_SETTINGS.general.defaultLang
			};
		}
	}

	/** Đọc settings — owner/manager (có scope 'reports:view') đều đọc được. */
	static async list(
		actor: ActorContext
	): Promise<
		| { success: false; messages: TranslateContent }
		| { success: true; settings: SystemSettings; canEdit: boolean }
	> {
		if (actor.roleName !== 'owner') {
			const scope = await PermissionChecker.getScope(actor.roleName, 'reports:view');
			if (!scope) return { success: false, messages: systemSettingsMessages.permissionDenied };
		}

		try {
			const res = await cbSystem.document.get({ documentKey: SETTINGS_DOCUMENT_KEY });
			// Document chưa có (lần chạy đầu / seed chưa ghi) → trả mặc định
			if (!res.ok || !res.data) {
				return { success: true, settings: DEFAULT_SYSTEM_SETTINGS, canEdit: this.canEdit(actor) };
			}
			const raw = res.data as { settings?: SystemSettingsPatch };
			return {
				success: true,
				settings: mergeWithDefaults(raw?.settings),
				canEdit: this.canEdit(actor)
			};
		} catch {
			return { success: false, messages: systemSettingsMessages.queryFailed };
		}
	}

	/** Cập nhật settings — CHỈ 'owner'. Ghép patch lên settings hiện có (deep merge). */
	static async update(
		actor: ActorContext,
		patch: SystemSettingsPatch
	): Promise<{ success: boolean; messages: TranslateContent }> {
		if (actor.roleName !== 'owner') {
			return { success: false, messages: systemSettingsMessages.permissionDenied };
		}

		// Đọc settings hiện có (mặc định nếu chưa có) rồi ghép patch — không mất field
		let current: SystemSettings;
		try {
			const res = await cbSystem.document.get({ documentKey: SETTINGS_DOCUMENT_KEY });
			const raw = res.ok ? (res.data as { settings?: SystemSettingsPatch } | undefined) : undefined;
			current = mergeWithDefaults(raw?.settings);
		} catch {
			return { success: false, messages: systemSettingsMessages.queryFailed };
		}

		const merged = mergeWithDefaults({
			general: { ...current.general, ...(patch.general ?? {}) },
			security: { ...current.security, ...(patch.security ?? {}) },
			commerce: { ...current.commerce, ...(patch.commerce ?? {}) },
			appearance: { ...current.appearance, ...(patch.appearance ?? {}) }
		});

		const content = {
			settings: merged,
			updatedBy: actor.userId,
			updatedAt: new Date().toISOString()
		};

		try {
			// Document đã tồn tại ('initApp' chung collection) → update; chưa có → create
			// (content cast — InferCollection<'system'> chỉ khai báo field 'initApp',
			// settings document dùng key riêng 'app-settings' ngoài schema)
			const existing = await cbSystem.document.get({ documentKey: SETTINGS_DOCUMENT_KEY });
			if (existing.ok && existing.data) {
				const res = await cbSystem.document.update({
					documentKey: SETTINGS_DOCUMENT_KEY,
					content: content as unknown as Record<string, unknown>
				});
				if (!res.ok) return { success: false, messages: systemSettingsMessages.updateFailed };
			} else {
				const res = await cbSystem.document.create({
					documentKey: SETTINGS_DOCUMENT_KEY,
					content: content as unknown as Record<string, unknown>
				});
				if (!res.ok) return { success: false, messages: systemSettingsMessages.createFailed };
			}
			return {
				success: true,
				messages: {
					vi: 'Cập nhật cấu hình hệ thống thành công',
					en: 'System settings updated successfully'
				}
			};
		} catch {
			return { success: false, messages: systemSettingsMessages.updateFailed };
		}
	}

	// ========== STATUS (health check) ==========

	/** Audit logs gần đây (7 ngày qua) — bảng nhỏ trên status dashboard. */
	static async listRecentAuditLogs(
		actor: ActorContext,
		options: { days?: number; limit?: number } = {}
	): Promise<
		| { success: false; messages: TranslateContent }
		| { success: true; items: SystemAuditLogRow[]; total: number }
	> {
		if (actor.roleName !== 'owner') {
			const scope = await PermissionChecker.getScope(actor.roleName, 'reports:view');
			if (!scope) return { success: false, messages: systemSettingsMessages.permissionDenied };
		}

		const days = Math.min(90, Math.max(1, options.days ?? 7));
		const limit = Math.min(100, Math.max(1, options.limit ?? 10));
		const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
		const auditKeyspace = `\`${cb_bucketName}\`.\`${cb_scopeName}\`.\`audit_logs\``;

		try {
			const [countRes, dataRes] = await Promise.all([
				cbSystem.document.query({
					statement: `SELECT RAW COUNT(*) FROM ${auditKeyspace} WHERE createdAt > $1`,
					args: [cutoff],
					readonly: true
				}),
				cbSystem.document.query({
					statement: `SELECT userId, action, collectionName, createdAt FROM ${auditKeyspace} WHERE createdAt > $1 ORDER BY createdAt DESC LIMIT ${limit}`,
					args: [cutoff],
					readonly: true
				})
			]);
			if (!countRes.ok || !dataRes.ok) {
				return { success: false, messages: systemSettingsMessages.queryFailed };
			}
			const total = Number(countRes.data?.results?.[0] ?? 0);
			// Couchbase bọc mỗi row trong { <collection>: {...} } — unwrap
			const items = ((dataRes.data?.results ?? []) as Record<string, unknown>[]).map(
				(row) => (row.audit_logs ?? row) as SystemAuditLogRow
			);
			return { success: true, items, total };
		} catch {
			return { success: false, messages: systemSettingsMessages.queryFailed };
		}
	}
}

export interface SystemAuditLogRow {
	userId?: string;
	userRole?: string;
	action?: string;
	collectionName?: string;
	documentId?: string;
	createdAt?: string;
}
