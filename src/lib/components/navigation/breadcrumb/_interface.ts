// src/lib/components/navigation/breadcrumb/_interface.ts
// Breadcrumb — điều hướng "hạng" (trang chủ › … › trang hiện tại).
// Chạy qua design token; item cuối = trang hiện tại (aria-current="page", không link).
//
// P2 hoàn thiện:
//  - icon / description per item (Icon iconify + Tooltip)
//  - separator tùy biến (string / Snippet) — global và per-item
//  - ellipsis: maxItems → "…" (DropdownMenu) khi items vượt ngưỡng
//  - FIX: separator render trước CURRENT item (trước đó chỉ có trong links)
import type { Snippet } from 'svelte';
import type { BasicProps, BasicConfigs } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export interface BreadcrumbItem {
	/** Nội dung hiển thị (i18n hoặc string) */
	label?: string | TranslateContent;
	/** href nội bộ (bắt đầu "/") → SvelteKit SPA link; ngoài (http…) → tab mới */
	href?: string;
	/** Snippet tùy biến thay cho label (hiếm dùng) */
	snippet?: Snippet;
	/** Tên icon iconify trước label (vd 'lucide:home') */
	icon?: string;
	/** Mô tả item — hiển thị trong Tooltip khi hover label */
	description?: string | TranslateContent;
	/**
	 * Separator TRƯỚC item này (ghi đè global separator).
	 * - string: render nguyên văn (vd '→', '/', '›')
	 * - Snippet: render markup tùy biến (vd <Icon icon="lucide:chevron-right" />)
	 * Không truyền → dùng global `separator` → default chevron SVG.
	 */
	separator?: string | Snippet;
}

export interface BreadcrumbProps extends BasicProps {
	/** Danh sách item. Nếu không truyền / rỗng → tự derive từ page.url */
	items?: BreadcrumbItem[];
	/** aria-label của nav (mặc định "Breadcrumb") */
	'aria-label'?: string;
	/** Bật khi không truyền items: sinh breadcrumb từ URL hiện tại */
	fromCurrentPage?: boolean;
	/**
	 * Separator mặc định giữa các item (string / Snippet).
	 * - string: render nguyên văn (vd '→')
	 * - Snippet: render markup (vd <Icon icon="lucide:chevron-right" />)
	 * Không truyền → chevron SVG mặc định (bám hệ hiện tại).
	 * Ghi đè per-item qua `item.separator`.
	 */
	separator?: string | Snippet;
	/**
	 * Số item tối đa hiển thị (không đếm "…"). Khi `derivedItems.length > maxItems`:
	 * giữ item đầu + (maxItems - 1) item cuối, các item giữa
	 * chuyển thành nút "…" mở DropdownMenu để chọn.
	 */
	maxItems?: number;
}

export interface BreadcrumbConfigs extends BasicConfigs {
	readonly items: BreadcrumbItem[];
	get style(): (string | undefined)[];
}
