// $lib/modules/i18n/index.ts
// Helper i18n client dùng chung — nguồn sự thật ngôn ngữ là client.browser.language
// (được root +layout.svelte seed từ navigator, và user-prefs applyUserPrefsFromLayout /
// setLanguage cập nhật khi user đổi ngôn ngữ — prefs.language persist DB).
//
// Pattern hiện có: mỗi trang admin giữ dict vi/en inline (pageContents) + derive
// `lang` từ client.browser. Module này KHÔNG thay pattern — chỉ gom các hàm lặp
// lại ở ~30 trang: resolve lang + format ngày giờ/số theo locale.

import { client } from '$store/basic.svelte';

/** Lang đã chuẩn hoá 2 giá trị (bẫy cũ: 'vi-VN' làm index dict → luôn slice/so sánh). */
export type Lang = 'vi' | 'en';

/**
 * Lang hiện tại theo prefs (fallback 'en' khi client chưa seed — SSR/mocked).
 * Reactive ở nơi gọi: dùng trong $derived để tự cập nhật khi user đổi ngôn ngữ.
 */
export function getLang(): Lang {
	return client.browser?.language === 'vi' ? 'vi' : 'en';
}

/** Locale BCP-47 tương ứng lang ('vi' → 'vi-VN', 'en' → 'en-US'); giá trị lạ → 'en-US'. */
export function getLocale(lang?: Lang | string): string {
	const l = lang ?? getLang();
	return l === 'vi' ? 'vi-VN' : 'en-US';
}

/**
 * Format datetime theo lang (mẫu dùng chung ~30 trang admin: yyyy MMM dd, HH:mm).
 * raw rỗng/không parse được → '—'. lang nhận string rộng (LanguageCode) — mọi giá trị
 * ngoài 'vi' coi như 'en' (cùng nhánh fallback của các trang trước khi gom helper).
 */
export function formatDateTime(raw?: string | Date | null, lang?: Lang | string): string {
	if (!raw) return '—';
	try {
		const date = typeof raw === 'string' ? new Date(raw) : raw;
		return new Intl.DateTimeFormat(getLocale(lang), {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	} catch {
		return '—';
	}
}

/**
 * Format date (không giờ) theo lang (mẫu: yyyy MMM dd).
 * raw rỗng/không parse được → '—'.
 */
export function formatDate(raw?: string | Date | null, lang?: Lang | string): string {
	if (!raw) return '—';
	try {
		const date = typeof raw === 'string' ? new Date(raw) : raw;
		return new Intl.DateTimeFormat(getLocale(lang), {
			year: 'numeric',
			month: 'short',
			day: '2-digit'
		}).format(date);
	} catch {
		return '—';
	}
}

/** Format số theo locale lang (Intl.NumberFormat, mặc định không thập phân lẻ ảo). */
export function formatNumber(value?: number | null, lang?: Lang | string): string {
	if (value === null || value === undefined || Number.isNaN(value)) return '—';
	return new Intl.NumberFormat(getLocale(lang)).format(value);
}
