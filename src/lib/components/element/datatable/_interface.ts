// src/lib/components/element/datatable/_interface.ts
// DataTable — data-driven table (Svelte 5, composite đơn giản):
// Root giữ data + sort/filter/pagination/selection state ($state),
// Head/Body/Pagination đọc shared state qua Symbol context.
// Token thật: --content1 (nền), --content2 (header/alt row), --content3 (grid line),
// --primary (sort/selection), --content1-foreground (text chính).
import type { BasicConfigs, BasicProps, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';
import type { Snippet } from 'svelte';

export type DataTableSortOrder = 'asc' | 'desc';
export type DataTableSortMode = 'client' | 'server';
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
	/** Editor kiểu giá trị cho edit cell/row (mặc định: text, số tự nhận theo oldValue). */
	editor?: 'text' | 'number' | 'boolean' | 'date' | 'select';
	/** Options cho editor 'select'. */
	options?: string[];
}

/** Config resize column (kéo mép th + auto-fit width khởi tạo). */
export interface DataTableResizable {
	/** Bật resize (default true khi truyền object). */
	enabled?: boolean;
	/** Đo content khởi tạo (canvas measureText) → width vừa đủ + ellipsis text tràn. Mặc định true. */
	fit?: boolean;
	/** Width tối thiểu khi resize/auto-fit (px, mặc định 60). */
	minWidth?: number;
	/** Width tối đa khi auto-fit (px, mặc định 400 — text dài hơn → ellipsis). */
	maxWidth?: number;
}

/** Config modal chi tiết row (click row/cell → Modal, update/delete từ modal). */
export interface DataTableRowDetail {
	/** Bật row detail (default true khi truyền object). */
	enabled?: boolean;
	/** Tiêu đề modal (i18n). */
	title?: TranslateContent | string;
	/** Modal cho phép sửa field (mặc định true). */
	editable?: boolean;
}

/** Config inline edit cell (PC): click cell → input + confirm/cancel. */
export interface DataTableEditable {
	/** Bật edit cell (default true khi truyền object). */
	enabled?: boolean;
	/** Cột cho phép edit (default: mọi cột không status/render). */
	columns?: string[];
	/** Nhãn edit cell (i18n, aria-label input). */
	cellLabel?: TranslateContent | string;
	/** Nhãn confirm (i18n, aria-label + title). */
	confirmLabel?: TranslateContent | string;
	/** Nhãn cancel (i18n, aria-label + title). */
	cancelLabel?: TranslateContent | string;
}

/** Config lazy load (infinite scroll + nút load more). */
export interface DataTableLazyLoad {
	/** Bật lazy load. */
	enabled?: boolean;
	/** Số row load mỗi lần (mặc định 10). */
	pageSize?: number;
	/** Gọi khi cuộn tới cuối (infinite scroll) / bấm load more. */
	onLoadMore?: () => Promise<void> | void;
	/** Còn data để load không (mặc định: tự đo bằng lần load trước). */
	hasMore?: boolean;
	/** Nút load more (mặc định true; false = chỉ infinite scroll). */
	loadMoreButton?: boolean;
	/** Nhãn nút load more (i18n). */
	loadMoreLabel?: TranslateContent | string;
	/** Nhãn loading more (i18n). */
	loadingMoreLabel?: TranslateContent | string;
}

/** Visual tùy chỉnh bề mặt row/cột (zebra/hover/border column). */
export interface DataTableVisual {
	/** Zebra striping (row lẻ nền alt). */
	striped?: boolean;
	/** Hover highlight row (PC). */
	hoverable?: boolean;
	/** Viền dọc giữa các cột. */
	bordered?: boolean;
}

/** Config tạo row mới (nút create: toolbar + empty + no-results). */
export interface DataTableCreatable {
	/** Bật create (default true khi truyền object). */
	enabled?: boolean;
	/** Nhãn nút create (i18n). */
	label?: TranslateContent | string;
}

/** Config xuất/nhập data (CSV/JSON). */
export interface DataTableExport {
	/** Bật export (default true khi truyền object). */
	enabled?: boolean;
	/** Định dạng xuất ('csv' mặc định; 'json'). */
	formats?: ('csv' | 'json')[];
	/** Cho phép nhập file CSV/JSON (nút import). */
	import?: boolean;
	/** Nhãn nút export (i18n). */
	exportLabel?: TranslateContent | string;
	/** Nhãn nút import (i18n). */
	importLabel?: TranslateContent | string;
}

export interface DataTableRootProps<T = Record<string, unknown>> extends BasicProps {
	/** Dữ liệu row. */
	data?: T[];
	/** Khai báo column (data-driven). */
	columns: DataTableColumn<T>[];
	/** Tiêu đề cho `<caption>` (i18n). */
	caption?: TranslateContent | string;
	/** Mô tả phụ dưới tiêu đề caption (i18n — ẩn khi cuộn, C5). */
	captionDescription?: TranslateContent | string;
	/** Snippet tools hiển thị cạnh tiêu đề caption (search/filter/buttons — sticky cùng caption). */
	captionTools?: Snippet;
	/** Số row mỗi trang (default 10). */
	pageSize?: number;
	/** Cho phép sort (click header). */
	sortable?: boolean;
	/** Cột đang sort (bindable — source of truth page khi sortMode='server'). */
	sortColumn?: string;
	/** Hướng sort (bindable — đi cùng sortColumn). */
	sortDirection?: DataTableSortOrder;
	/** 'client' (default): sort trong page; 'server': bỏ stage sort client (server đã sort). */
	sortMode?: DataTableSortMode;
	/** Cột số thứ tự đầu bảng (td = indexOffset + i + 1). */
	showIndex?: boolean;
	/** Offset STT khi phân trang server (vd (page-1)*pageSize). */
	indexOffset?: number;
	/** Checkbox cột đầu chỉ hiện khi hover row (hoặc row đã chọn). */
	checkboxHoverOnly?: boolean;
	/**
	 * Gộp checkbox VÀO ô STT (không có cột checkbox riêng): td STT mặc định hiện
	 * số, hover/focus td → đổi thành checkbox row; th '#' hover → checkbox
	 * select-all. Yêu cầu `selectable` + `showIndex` đồng thời bật.
	 */
	indexCheckboxes?: boolean;
	/** Click vùng nào của row cũng toggle chọn khi đã chọn ≥1 row (D6). */
	checkOnRowClick?: boolean;
	/** Ẩn toolbar selection tools built-in (copy/delete/clear local) — trang tự làm bulk bar. */
	selectionTools?: boolean;
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
	/** selection 2-way — page giữ mảng id (persists qua đổi trang/refetch). */
	selection?: string[];
	/** select-all header: 'page' (default) = chỉ trang hiện tại; 'filtered' = gọi onSelectAllFiltered. */
	selectAllMode?: 'page' | 'filtered';
	/** 'filtered': all page-selected hiển thị theo flag này (page ghi khi đã fetch chọn hết). */
	allFilteredSelected?: boolean;
	/** 'filtered': header select-all được gọi khi user chọn select-all. */
	onSelectAllFiltered?: () => void;
	/** Cho phép update/delete row (PC: hover row → action buttons; mobile: tap row → expand actions). */
	rowActions?: boolean;
	/** B6.2: nhãn th cột actions (i18n — default 'Actions'/'Thao tác'). */
	actionsLabel?: TranslateContent | string;
	/** Cho phép edit cell inline (click cell → input + confirm/cancel). */
	editable?: boolean | DataTableEditable;
	/** Lazy load row (infinite scroll + load more). */
	lazyLoad?: DataTableLazyLoad;
	/** Visual row/cột (zebra/hover/border). */
	visual?: DataTableVisual;
	/** Tạo row mới (nút create: toolbar + empty + no-results). */
	creatable?: boolean | DataTableCreatable;
	/** Xuất/nhập data (CSV/JSON). */
	exportable?: boolean | DataTableExport;
	/** Resize column (kéo mép th + auto-fit). */
	resizable?: boolean | DataTableResizable;
	/** Opt-in click row → modal chi tiết (update/delete từ modal). */
	rowDetail?: boolean | DataTableRowDetail;
	/** Opt-in click cell → modal chi tiết + focus đúng field (đè rowDetail click). */
	cellDetail?: boolean;
	/** B5: hành vi tap row trên mobile ('actions' mặc định — expand bar;
	     'callback' — gọi onRowClick; 'none' — không phản ứng). */
	mobileTapMode?: 'actions' | 'callback' | 'none';
	/** B5: card view tự động mobile — danh sách column.id hiển thị trên card
	     (phần tử đầu = tiêu đề card). Chỉ áp dụng khi isMobile + có giá trị. */
	cardFields?: string[];
	/** B5: sticky thead khi cuộn (media ≤1024px mở overflow — desktop giữ nguyên). */
	stickyHead?: boolean;
	/** B6.2: snippet actions custom (đè nút built-in — xem actionsContent). */
	actionsContent?: Snippet<[Record<string, unknown>, string]>;
	/** Callback khi tạo row mới (row + rowId). */
	onRowCreate?: (row: T, rowId: string) => void | Promise<void>;
	/** Callback khi clone row (row gốc + row clone). */
	onRowClone?: (row: T, clone: T) => void | Promise<void>;
	/** Callback khi copy row(s) ra clipboard (text đã copy). */
	onCopy?: (text: string) => void | Promise<void>;
	/** Callback khi import data (rows đã nhập). */
	onImport?: (rows: Record<string, unknown>[]) => void | Promise<void>;
	/** Callback khi mở modal chi tiết row (row + rowId). */
	onRowDetail?: (row: T, rowId: string) => void | Promise<void>;
	/** Callback khi cell update (row, column id, oldValue, newValue). */
	onCellUpdate?: (row: T, columnId: string, oldValue: unknown, newValue: unknown) => void | Promise<void>;
	/** Callback khi row update (row, rowId). */
	onRowUpdate?: (row: T, rowId: string) => void | Promise<void>;
	/** Callback khi xóa row (row, rowId). */
	onRowDelete?: (row: T, rowId: string) => void | Promise<void>;
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
	/** Confirm delete row (AlertDialog) đang mở cho rowId này (undefined nếu không). */
	deleteRowId: string | undefined;
	/** Row đang mở action bar mobile (undefined nếu không). */
	expandedRowId: string | undefined;
	/** Edit cell đang mở {rowId, columnId, value} (undefined nếu không). */
	editCell: { rowId: string; columnId: string; value: string } | undefined;
	/** Lazy load đang gọi onLoadMore? */
	loadingMore: boolean;
	/** Còn data để load không (lazy load). */
	hasMore: boolean;
	/** Visual config đã resolve (zebra/hover/border). */
	striped: boolean;
	hoverable: boolean;
	bordered: boolean;
	/** Edit cell bật? (cho class 'editable' trên root). */
	editable: boolean;
	/** Mobile? (client.browser?.isMobile — tap row → expand actions). */
	isMobile: boolean;
	/** Nhãn edit (i18n). */
	editText: string;
	confirmText: string;
	cancelText: string;
	deleteText: string;
	/** Nhãn nút update row (i18n). */
	updateText: string;
	deleteTitleText: string;
	deleteDescText: string;
	loadMoreText: string;
	loadingMoreText: string;
	/** Nhãn action bar mobile (i18n). */
	rowActionsLabel: string;
	/** B6.2: nhãn th cột actions (thead). */
	actionsText: string;
	/** Create row mới bật? (cho toolbar + empty + no-results). */
	creatable: boolean;
	/** Nhãn nút create (i18n). */
	createText: string;
	/** Export bật? (cho toolbar). */
	exportable: boolean;
	/** Định dạng export (đã resolve). */
	exportFormats: ('csv' | 'json')[];
	/** Cho phép import file? */
	importable: boolean;
	/** Nhãn nút export (i18n). */
	exportText: string;
	/** Nhãn nút import (i18n). */
	importText: string;
	/** Nhãn nút copy row(s) (i18n). */
	copyText: string;
	/** Nhãn nút clone row (i18n). */
	cloneText: string;
	/** Nhãn nút delete-selected (toolbar selection tools, i18n). */
	deleteSelectedText: string;
	/** Nhãn nút clear-selection (toolbar selection tools, i18n). */
	clearSelectionText: string;
	/** Nhãn nút close modal (i18n). */
	rowDetailCloseText: string;
	/** Nhãn nút save modal (i18n). */
	rowDetailSaveText: string;
	/** Resize column bật? (cho handle drag ở mép th). */
	resizable: boolean;
	/** Auto-fit width khởi tạo (đo content)? */
	resizeFit: boolean;
	/** Width tối thiểu khi resize/auto-fit (px). */
	resizeMinWidth: number;
	/** Width tối đa khi auto-fit (px). */
	resizeMaxWidth: number;
	/** Row detail (modal) bật? */
	rowDetail: boolean;
	/** Tiêu đề modal row detail (i18n). */
	rowDetailTitle: string;
	/** Modal row detail cho phép sửa field? */
	rowDetailEditable: boolean;
	/** Click cell → modal chi tiết (đè edit cell khi bật). */
	cellDetail: boolean;
	/** B5: hành vi tap row mobile (resolve từ prop, default 'actions'). */
	mobileTapMode: 'actions' | 'callback' | 'none';
	/** B5: card view mobile bật? (isMobile + cardFields có giá trị). */
	cardMode: boolean;
	/** B5: card fields (column.id; phần tử đầu = title). */
	cardFields: string[];
	/** B5: sticky thead bật? (media ≤1024 xử lý ở CSS). */
	stickyHead: boolean;
	/** Mô tả phụ caption (i18n đã resolve — ''). */
	captionDescriptionText: string;
	/** Snippet tools cạnh caption (search/filter/quick actions). */
	captionTools?: Snippet;
	/** Cột STT đầu bảng bật? */
	showIndex: boolean;
	/** Offset STT (indexOffset). */
	indexOffset: number;
	/** Checkbox ẩn đến khi hover row? */
	checkboxHoverOnly: boolean;
	/** Checkbox gộp vào ô STT (thay cột checkbox riêng)? */
	indexCheckboxes: boolean;
	/** Click row toggle chọn khi đã chọn ≥1? */
	checkOnRowClick: boolean;
	/** Toolbar selection tools built-in bật? */
	selectionTools: boolean;
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
	sortOrder: DataTableSortOrder;	/** Điều hướng trang. */
	goToPage: (page: number) => void;
	/** Đổi page size. */
	changePageSize: (size: number) => void;
	/** Gọi onRowClick (kèm id). */
	handleRowClick: (row: Record<string, unknown>, index: number) => void;
	/** Edit cell bật? (configs.editableDerived). */
	editable: boolean;
	/** Cột cho phép edit (undefined = mọi cột). */
	editableColumns: string[] | undefined;
	/** Row actions (update/delete) bật? */
	rowActions: boolean;
	/** Mobile? (client.browser?.isMobile — tap row → expand actions). */
	isMobile: boolean;
	/** B6.2: snippet actions custom (đè nút built-in — undefined = built-in). */
	actionsContent: Snippet<[Record<string, unknown>, string]> | undefined;
	/** Chế độ sửa CẢ ROW đang mở cho rowId này (undefined nếu không). */
	isRowEditing: (rowId: string) => boolean;
	/** Mở row editor (PC nút ✎ / mobile nút Update). */
	openRowEditor: (rowId: string) => void;
	/** Đóng row editor (commit=true: gọi onCellUpdate/onRowUpdate). */
	closeRowEditor: (commit: boolean) => void;
	/** Giá trị đang sửa của cell trong row editor (undefined nếu không mở). */
	getRowEditValue: (rowId: string, columnId: string) => string | undefined;
	/** Ghi giá trị đang sửa vào row editor. */
	setRowEditValue: (rowId: string, columnId: string, value: string) => void;
	/** Dialog confirm delete đang mở? */
	deleteOpen: boolean;
	/** Mở editor cho cell (click cell giá trị). */
	openCellEditor: (rowId: string, columnId: string, value: unknown) => void;
	/** Confirm edit (Enter/nút ✓) — gọi onCellUpdate + đóng editor. */
	confirmCellEditor: () => void;
	/** Cancel edit (Escape/nút ✕) — đóng editor giữ giá trị cũ. */
	cancelCellEditor: () => void;
	/** Row đang mở editor? */
	isEditing: (rowId: string, columnId: string) => boolean;
	/** Ghi giá trị đang gõ vào editCell.value (2-way input). */
	setEditValue: (value: string) => void;
	/** Giá trị đang gõ của editor (undefined nếu không mở). */
	getEditValue: () => string | undefined;
	/** Mở confirm delete row (AlertDialog). */
	requestDeleteRow: (rowId: string) => void;
	/** Xác nhận delete (Action AlertDialog) → gọi onRowDelete. */
	confirmDeleteRow: () => void;
	/** Row (id) đang đợi confirm delete? */
	isDeletePending: (rowId: string) => boolean;
	/** Toggle action bar mobile dưới row (tap row). */
	toggleRowActions: (rowId: string) => void;
	/** Row (id) đang mở action bar mobile? */
	isRowExpanded: (rowId: string) => boolean;
	/** Gọi onRowUpdate (PC/mobile nút "Update" — row toàn phần). */
	handleRowUpdate: (row: Record<string, unknown>, rowId: string) => void;
	/** Gọi onRowDelete trực tiếp (bỏ qua confirm — mobile nút delete đã qua confirm). */
	handleRowDeleteDirect: (row: Record<string, unknown>, rowId: string) => void;
	/** Lazy load: còn data? */
	hasMoreLazy: boolean;
	/** Lazy load: gọi onLoadMore (infinite scroll sentinel + nút load more). */
	loadMore: () => void;
	/** Lazy load: đang loading? */
	isLoadingMore: boolean;
	/** Tạo row mới (nút create) — push placeholder vào data + gọi onRowCreate. */
	createRow: () => void;
	/** Copy 1 row (text TSV) ra clipboard + gọi onCopy. */
	copyRow: (rowId: string) => void;
	/** Copy các row đã chọn (TSV) ra clipboard + gọi onCopy. */
	copySelected: () => void;
	/** Clone row (thêm bản sao ngay dưới + id mới) + gọi onRowClone. */
	cloneRow: (rowId: string) => void;
	/** Export data (đã filter) theo format ra file tải về. */
	exportData: (format: 'csv' | 'json') => void;
	/** Nhập file CSV/JSON (input file) → parse → gọi onImport. */
	importData: (file: File) => void;
	/** Xóa tất cả row đã chọn (toolbar selection tools). */
	deleteSelected: () => void;
	/** Bỏ chọn tất cả (toolbar selection tools). */
	clearSelection: () => void;
	/** Số row đã chọn (toolbar selection tools hiển thị). */
	selectedCount: number;
	/** Bắt đầu resize cột (kéo mép th, startX px + widthStart px). */
	startResize: (columnId: string, e: MouseEvent) => void;
	/** Reset width cột về auto (double-click handle — fit-content). */
	resetColumnWidth: (columnId: string) => void;
	/** Width hiện tại của cột (px hoặc undefined = auto). */
	columnWidth: (columnId: string) => number | undefined;
	/** Mở modal chi tiết row (click row/cell; focusColumn = field cần focus). */
	openRowDetail: (rowId: string, focusColumn?: string) => void;
	/** Đóng modal chi tiết row (commit=true: gọi onRowUpdate sau khi sửa). */
	closeRowDetail: (commit: boolean) => void;
	/** Modal chi tiết row đang mở cho rowId này (undefined nếu không). */
	detailRowId: string | undefined;
	/** Modal chi tiết row đang mở? (bind:display Modal) */
	detailOpen: boolean;
	/** Row detail (modal) bật? (cho row click → modal). */
	rowDetail: boolean;
	/** Click cell → modal chi tiết (đè edit cell khi bật). */
	cellDetail: boolean;
	/** Cell (columnId) cần focus khi mở modal chi tiết từ cell click. */
	detailFocusColumn: string | undefined;
	/** STT của row hiển thị (indexOffset + vị trí trong trang) — Body đọc. */
	rowIndexText: (indexInPage: number) => string;
	/** Click row → toggle chọn (checkOnRowClick, selectedCount ≥ 1). */
	tryToggleRowOnTap: (rowId: string) => boolean;
	/** Xác định editor type cho cell (col.editor > oldValue number → number). */
	getEditorType: (
		col: DataTableColumn<Record<string, unknown>>,
		value: unknown
	) => 'text' | 'number' | 'boolean' | 'date' | 'select';
	/** Parse yyyy-mm-dd → Date (giờ địa phương). */
	parseDateValue: (value: string) => Date | null;
}
