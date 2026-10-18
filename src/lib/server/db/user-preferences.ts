// $lib/server/db/user-preferences.ts
// UserPreferencesService — per-user preferences (theme/language/datatable settings)
// persisted trong collection 'user_preferences' (documentKey = userId).
//
// Quyền: user CHỈ đọc/ghi document của CHÍNH MÌNH — userId luôn lấy từ session
// (locals.user), KHÔNG BAO GIỜ nhận userId từ request body. Không cần permission
// key: mọi user đã đăng nhập đều có quyền chỉnh preference của chính mình.

import type { TranslateContent } from '$interfaces/basic';
import { cbData } from '$modules/couchbase/clients';

const cbPrefs = cbData('user_preferences');

// ── Shape (persisted document) ──
export interface DataTablePagePrefs {
	/** colId -> px width (từ resize/auto-fit đã persist) */
	columnWidths?: Record<string, number>;
	/** cột pinned theo thứ tự */
	stickyColumns?: string[];
	/** colId -> aggregation type */
	aggregations?: Record<string, string>;
	/** sort server-side đã persist (D5): field + hướng */
	sort?: { field?: string; direction?: 'asc' | 'desc' };
	/** M3: template field hiển thị card mobile — mảng id cột */
	cardFields?: string[];
	pageSize?: number;
}

export interface UserPreferences {
	/** 'light' | 'dark' | 'system' — undefined = chưa chọn (fallback hệ thống) */
	theme?: 'light' | 'dark' | 'system';
	/** 'vi' | 'en' — undefined = chưa chọn (fallback system defaultLang) */
	language?: 'vi' | 'en';
	/** key = route path, vd '/admin/brands' */
	datatable?: Record<string, DataTablePagePrefs>;
	/** C7: từ khóa tìm kiếm đã dùng — key = route path, mới nhất đầu, cross-device */
	searchKeywords?: Record<string, string[]>;
	updatedAt?: string;
}

export type UserPreferencesPatch = Partial<UserPreferences>;

// ── Messages ──
export const userPreferencesMessages = {
	queryFailed: {
		vi: 'Lấy tùy chọn người dùng thất bại',
		en: 'Failed to fetch user preferences'
	} as TranslateContent,
	updateFailed: {
		vi: 'Cập nhật tùy chọn người dùng thất bại',
		en: 'Failed to update user preferences'
	} as TranslateContent,
	createFailed: {
		vi: 'Tạo tùy chọn người dùng thất bại',
		en: 'Failed to create user preferences'
	} as TranslateContent
};

const MAX_DATATABLE_KEYS = 50;

/**
 * Whitelist patch — chỉ nhận field đã khai báo, kiểm kiểu từng field.
 * datatable: giới hạn số key (route) + số key con để document không phình vô hạn.
 */
function sanitizePatch(patch: UserPreferencesPatch | undefined): UserPreferencesPatch {
	const clean: UserPreferencesPatch = {};
	if (!patch) return clean;

	if (patch.theme === 'light' || patch.theme === 'dark' || patch.theme === 'system') {
		clean.theme = patch.theme;
	}
	if (patch.language === 'vi' || patch.language === 'en') {
		clean.language = patch.language;
	}
	if (patch.datatable && typeof patch.datatable === 'object') {
		const entries = Object.entries(patch.datatable as Record<string, unknown>).slice(
			0,
			MAX_DATATABLE_KEYS
		);
		const datatable: Record<string, DataTablePagePrefs> = {};
		for (const [key, value] of entries) {
			if (typeof value !== 'object' || value === null) continue;
			const v = value as DataTablePagePrefs;
			const page: DataTablePagePrefs = {};
			if (v.columnWidths && typeof v.columnWidths === 'object') {
				const widths: Record<string, number> = {};
				const wEntries = Object.entries(v.columnWidths).slice(0, 50);
				for (const [colId, w] of wEntries) {
					if (typeof w === 'number' && Number.isFinite(w) && w > 0) widths[colId] = w;
				}
				page.columnWidths = widths;
			}
			if (Array.isArray(v.stickyColumns)) {
				page.stickyColumns = v.stickyColumns.filter((c): c is string => typeof c === 'string');
			}
			if (v.aggregations && typeof v.aggregations === 'object') {
				const aggs: Record<string, string> = {};
				const aggEntries = Object.entries(v.aggregations).slice(0, 50);
				for (const [colId, agg] of aggEntries) {
					if (typeof agg === 'string') aggs[colId] = agg;
				}
				page.aggregations = aggs;
			}
			if (typeof v.pageSize === 'number' && Number.isFinite(v.pageSize) && v.pageSize > 0) {
				page.pageSize = Math.round(v.pageSize);
			}
			// D5: sort { field, direction } — whitelist kiểu, field ≤32 chars.
			if (v.sort && typeof v.sort === 'object') {
				const s: { field?: string; direction?: 'asc' | 'desc' } = {};
				if (typeof v.sort.field === 'string' && v.sort.field.length > 0 && v.sort.field.length <= 32) {
					s.field = v.sort.field;
				}
				if (v.sort.direction === 'asc' || v.sort.direction === 'desc') {
					s.direction = v.sort.direction;
				}
				if (s.field || s.direction) page.sort = s;
			}
			// M3: cardFields — tối đa 10 id, mỗi id ≤32 chars.
			if (Array.isArray(v.cardFields)) {
				const cf = v.cardFields
					.filter((c): c is string => typeof c === 'string' && c.length > 0 && c.length <= 32)
					.slice(0, 10);
				if (cf.length > 0) page.cardFields = cf;
			}
			datatable[key] = page;
		}
		clean.datatable = datatable;
	}
	// C7: searchKeywords — tối đa 10 route, mỗi route ≤20 từ khóa ≤100 chars,
	// dedupe, mới nhất đầu.
	if (patch.searchKeywords && typeof patch.searchKeywords === 'object') {
		const entries = Object.entries(patch.searchKeywords as Record<string, unknown>).slice(0, 10);
		const keywords: Record<string, string[]> = {};
		for (const [key, value] of entries) {
			if (typeof key !== 'string' || key.length === 0 || key.length > 100) continue;
			if (!Array.isArray(value)) continue;
			const seen = new Set<string>();
			const list: string[] = [];
			for (const kw of value) {
				if (typeof kw !== 'string' || kw.length === 0 || kw.length > 100) continue;
				if (seen.has(kw)) continue;
				seen.add(kw);
				list.push(kw);
				if (list.length >= 20) break;
			}
			if (list.length > 0) keywords[key] = list;
		}
		clean.searchKeywords = keywords;
	}
	return clean;
}

function mergePrefs(
	current: UserPreferences | undefined,
	patch: UserPreferencesPatch
): UserPreferences {
	const merged: UserPreferences = {
		theme: current?.theme,
		language: current?.language,
		datatable: { ...(current?.datatable ?? {}) },
		searchKeywords: { ...(current?.searchKeywords ?? {}) },
		updatedAt: new Date().toISOString()
	};
	if (patch.theme) merged.theme = patch.theme;
	if (patch.language) merged.language = patch.language;
	if (patch.datatable && merged.datatable) {
		// merge theo key route — patch chỉ đè các key nó chứa, giữ nguyên key khác
		for (const [key, pagePrefs] of Object.entries(patch.datatable)) {
			merged.datatable[key] = {
				...(merged.datatable[key] ?? {}),
				...pagePrefs
			};
		}
	}
	if (patch.searchKeywords && merged.searchKeywords) {
		// C7: merge per-route — từ khóa mới ghép TRƯỚC từ khóa cũ (mới nhất đầu),
		// dedupe, giới hạn 20/route.
		for (const [key, list] of Object.entries(patch.searchKeywords)) {
			const old = merged.searchKeywords[key] ?? [];
			const seen = new Set<string>();
			const mergedList: string[] = [];
			for (const kw of [...list, ...old]) {
				if (seen.has(kw)) continue;
				seen.add(kw);
				mergedList.push(kw);
				if (mergedList.length >= 20) break;
			}
			merged.searchKeywords[key] = mergedList;
		}
	}
	return merged;
}

export class UserPreferencesService {
	/** Đọc prefs của 1 user — document chưa có → {} (fallback tầng trên tự xử lý). */
	static async get(userId: string): Promise<UserPreferences> {
		try {
			const res = await cbPrefs.document.get({ documentKey: userId });
			if (!res.ok || !res.data) return {};
			const raw = res.data as UserPreferences;
			return {
				theme: raw.theme,
				language: raw.language,
				datatable: raw.datatable,
				searchKeywords: raw.searchKeywords,
				updatedAt: raw.updatedAt
			};
		} catch {
			// Document lỗi/không đọc được → coi như chưa có preferences (không chặn UI)
			return {};
		}
	}

	/**
	 * Ghép patch lên prefs hiện có (read-merge-write).
	 * BẮT BUỘC gọi với userId từ session — không nhận userId từ client.
	 */
	static async patch(
		userId: string,
		patch: UserPreferencesPatch
	): Promise<{ success: boolean; messages: TranslateContent }> {
		const clean = sanitizePatch(patch);
		if (Object.keys(clean).length === 0) {
			return { success: true, messages: { vi: 'Không có thay đổi', en: 'No changes' } };
		}

		let current: UserPreferences | undefined;
		try {
			const res = await cbPrefs.document.get({ documentKey: userId });
			current = res.ok && res.data ? (res.data as UserPreferences) : undefined;
		} catch {
			current = undefined;
		}

		const merged = mergePrefs(current, clean);

		try {
			const existing = await cbPrefs.document.get({ documentKey: userId });
			if (existing.ok && existing.data) {
				const res = await cbPrefs.document.update({
					documentKey: userId,
					content: merged as unknown as Record<string, unknown>
				});
				if (!res.ok) return { success: false, messages: userPreferencesMessages.updateFailed };
			} else {
				const res = await cbPrefs.document.create({
					documentKey: userId,
					content: merged as unknown as Record<string, unknown>
				});
				if (!res.ok) return { success: false, messages: userPreferencesMessages.createFailed };
			}
			return {
				success: true,
				messages: {
					vi: 'Cập nhật tùy chọn thành công',
					en: 'Preferences updated successfully'
				}
			};
		} catch {
			return { success: false, messages: userPreferencesMessages.updateFailed };
		}
	}
}
