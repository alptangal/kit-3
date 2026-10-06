// src/lib/components/element/pagination/_interface.ts
// LIGHT ATOM — Pagination (mirror shadcn usePagination): không context, không form.
// Bindable `page`, totalPages/totalItems+pageSize, sibling/boundary count, ellipsis.
import type { BasicConfigs, BasicProps, Color, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export interface PaginationProps extends BasicProps {
	/** Trang hiện tại — BINDABLE (clamped 1..totalPages). */
	page?: number;
	/** Tổng số trang. Nếu thiếu, suy ra từ totalItems / pageSize (ceil). */
	totalPages?: number;
	/** Tổng số item (suy totalPages khi chưa có). */
	totalItems?: number;
	/** Item mỗi trang (default 10) — dùng suy totalPages khi thiếu. */
	pageSize?: number;
	/** Số trang "gần" hiện 2 bên trang active (default 1). 0 → không sibling. */
	siblingCount?: number;
	/** Số trang "biên" luôn hiện (default 1). */
	boundaryCount?: number;
	/** Nhãn nút trước (TranslateContent | string, default en 'Previous' / vi 'Trước'). */
	prevLabel?: TranslateContent | string;
	/** Nhãn nút sau (TranslateContent | string, default en 'Next' / vi 'Sau'). */
	nextLabel?: TranslateContent | string;
	size?: Size;
	/** Màu trang active (default 'primary'). */
	color?: Color;
	'aria-label'?: string;
	/** Kiểu hiển thị: 'default' (hiện dải trang) hoặc 'compact' (chỉ prev + counter + next). */
	variant?: 'default' | 'compact';
	/** Đang đồng bộ data: root aria-busy, MỌI item disabled + mờ + cursor not-allowed. */
	loading?: boolean;
	/** Iconify name cho nút prev (vd 'material-symbols-light:arrow-left-rounded') — render trước label. */
	prevIcon?: string;
	/** Iconify name cho nút next — render trước label. */
	nextIcon?: string;
}

export interface PaginationConfigs extends Omit<BasicConfigs, 'value' | 'status'> {
	page: number;
	totalPages: number;
	entries: PaginationEntry[];
	size: Size;
	color: Color;
	variant: 'default' | 'compact';
	loading: boolean;
}

/** Một entry render trong dải trang. */
export type PaginationEntry =
	| { type: 'prev' }
	| { type: 'next' }
	| { type: 'ellipsis-start' }
	| { type: 'ellipsis-end' }
	| { type: 'page'; n: number };
