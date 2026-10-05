// src/lib/components/element/datatable/_interface.ts
// DataTable — data-driven table (Svelte 5, composite đơn giản):
// Root giữ data + sort/filter/pagination/selection state ($state),
// Head/Body/Pagination đọc shared state qua Symbol context.
// Token thật: --content1 (nền), --content2 (header/alt row), --content3 (grid line),
// --primary (sort/selection), --content1-foreground (text chính).
import type { BasicConfigs, BasicProps, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';

export type DataTableSortOrder = 'asc' | 'desc';
export type DataTableDensity = 'default' | 'compact';
export type DataTableColumnAlign = 'left' | 'center' | 'right';
/** Status semantic cho pill (map token: success→--success, danger→--danger, ...). */
export type DataTableStatus = 'default' | 'success' | 'warning' | 'danger' | 'info';

/** Lấy value cell theo accessor: key name hoặc function (tiếp thủ table v1). */
export type DataTableAccessor<T> = keyof T | ((row: T) => unknown);

export interface DataTableColumn<T> {
	id: string;
	label: string;
	accessor: DataTableAccessor<T>;
	/** Hiện nút sort trên header + aria-sort. */
	sortable?: boolean;
	/** Duyệt theo cột này khi có search text (mặc định: mọi cột). */
	filterable?: boolean;
	/** Căn nội dung cell + header. */
	align?: DataTableColumnAlign;
	/** CSS width cho cột (vd '100px'). */
	width?: string;
	/** Render tùy cell: trả text (mỗi giá trị cell). */
	render?: (value: unknown, row: T, rowIndex: number) => string;
	/** Map value thành status pill (vd (s) => s === 'active' ? 'success' : 'default'). */
	status?: (value: unknown, row: T) => DataTableStatus | undefined;
	/** Tắt highlight match của search trên cột này (vd số). */
	noHighlight?: boolean;
}

export interface DataTableRootProps<T = Record<string, unknown>> extends BasicProps {
	/** Dữ liệu row. */
	data?: T[];
	/** Khai báo column (data-driven). */
	columns: DataTableColumn<T>[];
	/** Tiêu đề cho `<caption>` (i18n). */
	caption?: TranslateContent | string;
	/** Số row mỗi trang (default 10). */
	pageSize?: number;
	/** Cho phép sort (click header). */
	sortable?: boolean;
	/** Cho phép chọn row (checkbox). */
	selectable?: boolean;
	/** Hiện ô search (client-side, mọi cột). */
	searchable?: boolean;
	/** Placeholder ô search (i18n). */
	searchPlaceholder?: TranslateContent | string;
	/** Cho phép đổi page size (hiện select). */
	pageSizeOptions?: number[];
	/** Hiện thanh pagination. */
	showPagination?: boolean;
	/** Mật độ padding cell. */
	density?: DataTableDensity;
	/** Alias của `density` (spec task: variant/density). */
	variant?: DataTableDensity;
	/** Trang hiện tại (bindable; reset khi data/sort/pageSize đổi nếu clamp). */
	page?: number;
	/** Nhãn ô search (i18n, aria-label). */
	searchLabel?: TranslateContent | string;
	/** Nhãn clear filter (i18n, aria-label). */
	clearFilterLabel?: TranslateContent | string;
	/** Nhãn kết quả (i18n; `n` thay bằng số row sau filter). */
	resultsLabel?: TranslateContent | string;
	/** Nhãn empty state (i18n). */
	emptyLabel?: TranslateContent | string;
	/** Placeholder khi loading (i18n). */
	loadingLabel?: TranslateContent | string;
	/** Đang tải (overlay + skeleton rows). */
	loading?: boolean;
	/** Nhãn select-all (i18n, aria-label). */
	selectAllLabel?: TranslateContent | string;
	/** Nhãn row select (i18n, `index` = thứ tự trong data). */
	rowSelectLabel?: TranslateContent | string;
	/** Nhãn page size (i18n, aria-label). */
	pageSizeLabel?: TranslateContent | string;
	/** Nhãn nút prev (i18n). */
	previousLabel?: TranslateContent | string;
	/** Nhãn nút next (i18n). */
	nextLabel?: TranslateContent | string;
	/** Định danh row (default: index). */
	getRowId?: (row: T, index: number) => string;
	/** Callback khi sort đổi (column id, order). */
	onSortChange?: (columnId: string, order: DataTableSortOrder) => void;
	/** Callback khi page đổi. */
	onPageChange?: (page: number) => void;
	/** Callback khi page size đổi. */
	onPageSizeChange?: (size: number) => void;
	/** Callback khi selection đổi (mọi lần toggle). */
	onSelectionChange?: (ids: string[]) => void;
	/** Callback khi row click (row + id). */
	onRowClick?: (row: T, rowId: string) => void;
	/** Nhãn table (i18n, aria-label). */
	'aria-label'?: string;
	/** Passthrough `data-*` (vd `data-test`). */
	'data-test'?: string;
}

export interface DataTableConfigs extends BasicConfigs {
	size: Size;
	style: (string | undefined)[];
	density: DataTableDensity;
	loading: boolean;
	/** Có checkbox chọn row không. */
	selectable: boolean;
	/** Cho phép sort không. */
	sortable: boolean;
	/** Nhãn đã resolve i18n (cho sub render + probe đọc). */
	captionText: string;
	searchPlaceholderText: string;
	searchText: string;
	clearText: string;
	/** `n` thay bằng số row sau filter. */
	resultsText: string;
	emptyText: string;
	loadingText: string;
	selectAllText: string;
	/** `{index}` thay bằng thứ tự 1-based. */
	rowSelectText: string;
	pageSizeLabelText: string;
	previousText: string;
	nextText: string;
	/** `{page}`/`{total}` thay bằng số. */
	pageInfoText: string;
}

/** Shared state root → sub (Head/Body/Pagination), bỏ writable store của v1. */
export interface DataTableSharedState {
	configs: DataTableConfigs;
	/** Row hiển thị hiện tại (đã filter + sort + paginate) + index trong data. */
	pageRows: { row: Record<string, unknown>; index: number }[];
	/** Cột khai báo (render header/cell theo cùng metadata). */
	columns: DataTableColumn<Record<string, unknown>>[];
	/** Query search hiện tại (cho highlight cell). */
	query: string;
	/** Số row sau filter (trước paginate). */
	filteredCount: number;
	/** Trang hiện tại (đã clamp 1..totalPages). */
	page: number;
	/** Tổng trang (đã filter). */
	totalPages: number;
	/** Page size hiện tại. */
	pageSize: number;
	/** Option page size (để render select). */
	pageSizeOptions: number[];
	/** Lấy value cell theo accessor. */
	getCellValue: (row: Record<string, unknown>, col: DataTableColumn<Record<string, unknown>>) => unknown;
	/** id row theo getRowId. */
	getRowId: (row: Record<string, unknown>, index: number) => string;
	/** Row (id) được chọn? */
	isSelected: (id: string) => boolean;
	/** Toggle 1 row. */
	toggleRow: (id: string) => void;
	/** Toggle chọn cả trang hiện tại (select-all header). */
	togglePageSelection: () => void;
	/** All row trang hiện tại đã chọn? */
	allPageSelected: boolean;
	/** Toggle sort theo cột. */
	toggleSort: (columnId: string) => void;
	/** column hiện đang sort (undefined nếu chưa). */
	activeSort: string | undefined;
	/** order hiện tại (chỉ dùng khi activeSort). */
	sortOrder: DataTableSortOrder;
	/** Điều hướng trang. */
	goToPage: (page: number) => void;
	/** Đổi page size. */
	changePageSize: (size: number) => void;
	/** Gọi onRowClick (kèm id). */
	handleRowClick: (row: Record<string, unknown>, index: number) => void;
}
