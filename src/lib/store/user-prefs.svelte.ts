// $lib/store/user-prefs.svelte.ts
// Per-user preferences client store — nhận data từ (authorized)/+layout.server.ts,
// resolve theo fallback chain, và cung cấp write-path cho theme/language.
//
// Fallback chain (user chốt):
//   theme    = prefs.theme → system appearance.theme → localStorage cũ (migrate) → 'system'
//   language = prefs.language → system defaultLang → navigator.language → 'en'
//
// Nguồn chân lý theme vẫn là profile.theme (basic.svelte.ts) — module này chỉ
// BOOTSTRAP giá trị ban đầu (suppress persist) và đăng ký sink ghi DB qua
// theme-persist-sink (theme-toggle/profile/settings đều đi qua 1 cửa).

import { browser } from '$app/environment';
import type { AppTheme } from '$interfaces/basic';
import { saveUserPrefs } from '$modules/prefs-api';
import type { DataTablePagePrefs, UserPreferences } from '$lib/server/db/user-preferences';
// Static import an toàn (một chiều): basic.svelte KHÔNG import user-prefs —
// sink registration đi qua theme-persist-sink module trung gian.
import { client, profile } from '$store/basic.svelte';
import { setThemePersistSink } from '$store/theme-persist-sink';

export interface UserPrefsSystemDefaults {
	theme: 'light' | 'dark' | 'system';
	density: 'comfortable' | 'compact';
	defaultLang: 'vi' | 'en';
}

export const userPrefs = $state({
	/** layout server đã trả data chưa (chặn apply 2 lần khi nav client) */
	loaded: false,
	theme: undefined as AppTheme | undefined,
	language: undefined as 'vi' | 'en' | undefined,
	datatable: {} as Record<string, DataTablePagePrefs>,
	/** C7: từ khóa tìm kiếm per-route (mới nhất đầu) — hydrate từ layout server */
	searchKeywords: {} as Record<string, string[]>
});

/** Flag chống vòng lặp: apply bootstrap → setter → persist (không mong muốn). */
let suppressThemePersist = false;

export type LayoutData = {
	prefs?: UserPreferences;
	system?: UserPrefsSystemDefaults;
};

/**
 * Gọi 1 lần từ (authorized)/+layout.svelte với data của layout server:
 * resolve theme + language theo chain, migrate localStorage cũ, đăng ký persist sink.
 */
export function applyUserPrefsFromLayout(data: LayoutData | undefined): void {
	if (!browser || !data || userPrefs.loaded) return;
	userPrefs.loaded = true;

	const prefs = data.prefs ?? {};
	const system = data.system ?? { theme: 'system', density: 'comfortable', defaultLang: 'en' };

	// ── C7: SEARCH KEYWORDS ──
	// Hydrate từ DB (cross-device) — merge với giá trị trong session (client có thể
	// đã lưu trước khi layout reload).
	userPrefs.searchKeywords = {
		...userPrefs.searchKeywords,
		...(prefs.searchKeywords ?? {})
	};

	// ── THEME ──
	// localStorage cũ (chưa có DB bao giờ) → migrate 1 lần vào DB rồi tiếp tục dùng
	let theme = prefs.theme;
	const legacy = readLegacyTheme();
	if (!theme && legacy) {
		theme = legacy;
		saveUserPrefs({ theme: legacy });
	}
	if (!theme) theme = system.theme;

	userPrefs.theme = theme;

	// Áp theme với suppress (setter lo animate + data-theme, KHÔNG persist lại —
	// chống vòng apply→persist→apply), rồi đăng ký sink cho mọi lần set sau.
	suppressThemePersist = true;
	try {
		profile.theme = theme;
	} finally {
		suppressThemePersist = false;
	}

	// đăng ký sink qua setThemePersistSink: mọi lần sau, setter theme → ghi DB
	setThemePersistSink((t: AppTheme) => {
		if (suppressThemePersist) return;
		userPrefs.theme = t;
		saveUserPrefs({ theme: t });
	});

	// ── LANGUAGE ──
	// Thứ tự: user pref → system defaultLang → navigator → 'en'
	// (đọc navigator trực tiếp — client.browser có thể chưa được root onMount seed)
	const base = browser ? (navigator.language ?? 'en').slice(0, 2) : undefined;
	const lang = prefs.language ?? system.defaultLang ?? (base === 'vi' ? 'vi' : 'en');
	userPrefs.language = lang === 'vi' ? 'vi' : 'en';
	if (client.browser) client.browser.language = userPrefs.language;
}

/** Đọc localStorage 'theme' cũ (chuẩn hoá giá trị) — trả undefined nếu không hợp lệ. */
function readLegacyTheme(): AppTheme | undefined {
	if (!browser) return undefined;
	const raw = localStorage.getItem('theme');
	if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
	return undefined;
}

/**
 * Ghi language preference (setLanguage từ UI switcher):
 * cập nhật client.browser.language + persist DB.
 */
export function setLanguage(lang: 'vi' | 'en'): void {
	userPrefs.language = lang;
	if (client.browser) client.browser.language = lang;
	saveUserPrefs({ language: lang });
}

/** Ghi datatable prefs 1 trang (read-merge theo key route trong server). */
export function saveDataTablePrefs(key: string, partial: DataTablePagePrefs): void {
	saveUserPrefs({ datatable: { [key]: partial } });
}

/**
 * C7: lưu từ khóa tìm kiếm 1 route — mới nhất đầu, dedupe, tối đa 20.
 * Ghi DB qua saveUserPrefs (merge per-route phía server) + cập nhật store local.
 */
export function recordSearchKeyword(routeKey: string, keyword: string): void {
	const kw = keyword.trim();
	if (!kw) return;
	const old = userPrefs.searchKeywords[routeKey] ?? [];
	const next = [kw, ...old.filter((k) => k !== kw)].slice(0, 20);
	userPrefs.searchKeywords[routeKey] = next;
	saveUserPrefs({ searchKeywords: { [routeKey]: next } });
}

/** Đọc danh sách từ khóa đã lưu 1 route (mới nhất đầu). */
export function getSearchKeywords(routeKey: string): string[] {
	return userPrefs.searchKeywords[routeKey] ?? [];
}

/** Nhóm 4: toàn bộ map route → keywords (bản sao, cho UI quản lí ở profile). */
export function getAllSearchKeywords(): Record<string, string[]> {
	return { ...userPrefs.searchKeywords };
}

/**
 * Nhóm 4: xóa lịch sử tìm kiếm — 1 route (routeKey) hoặc TOÀN BỘ route đã biết.
 * Server: patch mảng rỗng = xóa route (mergePrefs delete). Không truyền routeKey
 * → iterate mọi route trong store, patch rỗng từng route.
 */
export function clearSearchKeywords(routeKey?: string): void {
	if (routeKey) {
		userPrefs.searchKeywords[routeKey] = [];
		saveUserPrefs({ searchKeywords: { [routeKey]: [] } });
		return;
	}
	const routes = Object.keys(userPrefs.searchKeywords);
	if (!routes.length) return;
	const patch: Record<string, string[]> = {};
	for (const r of routes) {
		userPrefs.searchKeywords[r] = [];
		patch[r] = [];
	}
	saveUserPrefs({ searchKeywords: patch });
}
