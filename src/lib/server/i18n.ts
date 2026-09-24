// src/lib/server/i18n.ts
// Server-side i18n: resolve ngôn ngữ client yêu cầu từ header Accept-Language
// và thu gọn TranslateContent về đúng 1 ngôn ngữ đó trước khi respond.
//
// Client gửi 'Accept-Language' = client.browser.language (store basic.svelte) —
// cùng nguồn mà các page dùng để hiển thị message, nên message trả về luôn
// khớp key mà page sẽ đọc (message[lang]).

import type { LanguageCode, TranslateContent } from '$interfaces/basic';

/**
 * Parse header Accept-Language → mã ngôn ngữ chính (primary subtag).
 * Vd: 'vi-VN,vi;q=0.9,en;q=0.8' → 'vi'; '' / null → 'en'.
 */
export function resolveLang(acceptLanguage: string | null | undefined): LanguageCode {
	const first = (acceptLanguage ?? '').split(',')[0]?.trim() ?? '';
	const primary = first.split(';')[0]?.split('-')[0]?.toLowerCase() ?? '';
	return (primary || 'en') as LanguageCode;
}

/**
 * Thu gọn TranslateContent (nhiều ngôn ngữ) về đúng 1 key của ngôn ngữ client dùng.
 * Giữ nguyên shape object { [lang]: string } để client tiếp tục đọc
 * `message[lang] ?? message.en` như cũ — chỉ khác là không còn nhận
 * toàn bộ các ngôn ngữ không dùng tới.
 * Nếu ngôn ngữ yêu cầu không có nội dung, emit key 'en' (fallback)
 * để client luôn đọc được giá trị thay vì nhận key rỗng.
 */
export function localize(content: TranslateContent, lang: LanguageCode): TranslateContent {
	if (!content) return content;
	if (content[lang] !== undefined) return { [lang]: content[lang] } as TranslateContent;
	if (content.en !== undefined) return { en: content.en } as TranslateContent;
	// Không có nội dung cho lang lẫn 'en' — trả nguyên bản, client tự fallback
	return content;
}

/**
 * Localize mọi `message` trong payload phản hồi trước khi mã hoá:
 * - `message` ở top-level (shape ServerResponse chuẩn)
 * - `message` lồng trong các block object 1 cấp
 *   (vd /api/register/check có result.username/email/phone, mỗi block 1 message)
 * String message (error nội bộ) được giữ nguyên.
 */
export function localizePayload<T>(payload: T, lang: LanguageCode): T {
	if (!payload || typeof payload !== 'object') return payload;
	const result: any = { ...(payload as any) };
	if (result.message && typeof result.message === 'object') {
		result.message = localize(result.message, lang);
	}
	for (const key of Object.keys(result)) {
		const value = result[key];
		if (
			value &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			value.message &&
			typeof value.message === 'object'
		) {
			result[key] = { ...value, message: localize(value.message, lang) };
		}
	}
	return result as T;
}
