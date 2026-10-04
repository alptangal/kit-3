// src/lib/components/navigation/breadcrumb/_interface.ts
// Breadcrumb — điều hướng "hạng" (trang chủ › … › trang hiện tại).
// Chạy qua design token; item cuối = trang hiện tại (aria-current="page", không link).
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export interface BreadcrumbItem {
	/** Nội dung hiển thị (i18n hoặc string hoặc Snippet tùy biến) */
	label?: string | TranslateContent;
	/** href nội bộ (bắt đầu "/") → SvelteKit SPA link; ngoài (http…) → tab mới */
	href?: string;
	/** Snippet tùy biến thay cho label (icon + text, v.v.) */
	snippet?: Snippet;
}

export interface BreadcrumbProps extends BasicProps {
	/** Danh sách item. Nếu không truyền / rỗng → tự derive từ page.url (aria-from-current-page). */
	items?: BreadcrumbItem[];
	/** aria-label của nav (mặc định "Breadcrumb") */
	'aria-label'?: string;
	/** Bật khi không truyền items: sinh breadcrumb từ URL hiện tại */
	fromCurrentPage?: boolean;
}

export interface BreadcrumbConfigs extends BasicConfigs {
	readonly items: BreadcrumbItem[];
	get style(): (string | undefined)[];
}
