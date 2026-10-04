//$components/form/select/_interface.ts
import type { BasicProps, EventListener, Color, Size } from '$components/interface';
import type { TranslateContent } from '$interfaces/basic';
import type { Snippet, SvelteComponent } from 'svelte';
import type { ValidationCompact, ValidationFull } from '../input/_interface';

export type SelectVariant = 'primary' | 'secondary' | 'ghost';
export type SelectMode = 'single' | 'multiple';
/** Chế độ load thêm option khi danh sách vượt không gian hiển thị. */
export type SelectLoadMoreMode = 'scroll' | 'button' | 'pagination';
/** Trường sort list option: 'alpha' (theo label, locale) | 'date' (theo option.date). */
export type SelectSortField = 'alpha' | 'date';
export type SelectSortDirection = 'asc' | 'desc';

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
	group?: string;
	/** Ảnh đại diện (URL/asset) — render dạng circle avatar bên trái option. */
	image?: string;
	/** Dòng mô tả phụ bên dưới label. */
	description?: string;
	/** Ngày/thời gian (ISO string hoặc timestamp ms) — khóa sort khi sortField='date'. */
	date?: string | number;
}

export interface SelectOptionGroup {
	label: string;
	options: SelectOption[];
}

export interface SelectProps extends BasicProps {
	value?: string | string[];
	mode?: SelectMode;
	variant?: SelectVariant;
	size?: Size;
	placeholder?: TranslateContent | string;
	options?: SelectOption[];
	optionGroups?: SelectOptionGroup[];
	searchable?: boolean;
	searchPlaceholder?: TranslateContent | string;
	/**
	 * When true and the search query has no match, a "create" option is shown at
	 * the bottom of the list; picking it adds the option at runtime and selects it.
	 * Requires `searchable` (a search box is where the new value is typed).
	 */
	allowCreate?: boolean;
	/** Label for the create option. `{value}` is replaced with the current query. */
	createOptionLabel?: TranslateContent | string;
	disabled?: boolean;
	required?: boolean;
	name?: string;
	clearable?: boolean;
	/** Accessible label for the clear (X) button. */
	clearLabel?: TranslateContent | string;
	maxHeight?: number | string;
	loading?: boolean;
	color?: Color;
	validation?: {
		[k in keyof EventListener]:
			| (ValidationCompact | ValidationFull)[]
			| {
					operator?: 'and' | 'or';
					handles: (ValidationCompact | ValidationFull)[];
			  };
	} & { operator?: 'and' | 'or' };

	// ── (1) Select-all (multiple) ──
	/** Hiển thị row "chọn tất cả" ở đầu danh sách (chỉ active khi mode='multiple'). */
	showSelectAll?: boolean;
	/** Nhãn cho select-all row. */
	selectAllLabel?: TranslateContent | string;

	// ── (2)+(3) Load-more + giới hạn render theo không gian ──
	/**
	 * Số option tối đa hiển thị trước khi cần load-more. Nếu không đặt, tự tính
	 * theo không gian dropdown (maxHeight / chiều cao mỗi option).
	 */
	maxOptions?: number;
	/** Chế độ load-more. Mặc định 'scroll'. */
	loadMoreMode?: SelectLoadMoreMode;
	/** Nhãn nút/động tác load-more. */
	loadMoreLabel?: TranslateContent | string;
	/** Số option thêm mỗi lần load (scroll/button). Mặc định theo maxOptions/chunk. */
	loadMoreChunk?: number;
	/** Số option mỗi trang (chế độ pagination). */
	pageSize?: number;

	// ── (4) Sort list option (alphabetic / date) ──
	/**
	 * Trường sort hiện tại. 'alpha' = theo label (locale-aware, tiếng Việt),
	 * 'date' = theo `option.date` (option thiếu date luôn ở cuối). Không đặt
	 * (undefined) → giữ nguyên thứ tự nguồn (backward-compatible). Bindable.
	 */
	sort?: SelectSortField;
	/** Chiều sort ('asc' | 'desc'). Mặc định 'asc'. Bindable. */
	sortDirection?: SelectSortDirection;
	/** Hiện control sort (chọn trường + đổi chiều) ở đầu danh sách option. */
	showSort?: boolean;
	/** Callback khi user đổi sort (qua control trong dropdown). */
	onSortChange?: (field: SelectSortField, direction: SelectSortDirection) => void;

	// ── (5) Update / delete option (emit event, user tự cập nhật source) ──
	/** Hiện nút chỉnh sửa (pencil) ở option. */
	editableOptions?: boolean;
	/** Hiện nút xóa (trash) ở option. */
	deletableOptions?: boolean;
	/** Callback khi sửa label option. Component không tự đổi `options`. */
	onOptionUpdate?: (value: string, newLabel: string) => void;
	/** Callback khi xóa option. Component không tự đổi `options`. */
	onOptionDelete?: (value: string) => void;

	// ── (6) Data source + đồng bộ (reactive options + hooks + async load) ──
	/**
	 * Nguồn option async. Gọi khi mở lần đầu (query=undefined) và (nếu remoteSearch)
	 * khi search debounce. Kết quả merge vào danh sách hiện có (dedupe by value).
	 */
	loadOptions?: (query?: string) => Promise<SelectOption[]>;
	/**
	 * Khi true + loadOptions: mỗi lần gõ search sẽ gọi loadOptions(query) (remote
	 * search) thay vì filter local. Nếu không: loadOptions chỉ dùng để nạp ban đầu.
	 */
	remoteSearch?: boolean;
	/** Delai debounce remote search (ms). Mặc định theo client.browser.delay (300). */
	searchDelay?: number;
	/** Gọi khi value thay đổi (do chọn option). */
	onValueChange?: (value: string | string[]) => void;
	/** Gọi khi query search thay đổi (đã debounce nếu remote). */
	onSearch?: (query: string) => void;
	/** Gọi khi một option được chọn. */
	onOptionSelect?: (value: string) => void;
	/** Gọi khi tạo option mới (allowCreate). */
	onOptionCreate?: (value: string, label: string) => void;

	// ── (9) Chip overflow (multiple) — hiển thị option đã chọn dạng tag ──
	/**
	 * Hiện option đã chọn dạng chip/tag trong trigger (chỉ active khi
	 * mode='multiple'). Tự đo width để vừa trigger, phần còn lại gom
	 * vào MỘT chip "+N" (ưu tiên option mới nhất). Mặc định: mode==='multiple'.
	 */
	showChips?: boolean;
	/** Mỗi chip có nút × để bỏ chọn option đó (mặc định true khi showChips). */
	removableChips?: boolean;
	/** Số ký tự tối đa label chip trước khi cắt + ellipsis (mặc định 14). */
	chipTruncateLength?: number;
	/** Callback khi bỏ chọn option qua nút × trên chip (trước khi toggle). */
	onChipRemove?: (value: string) => void;

	// ── (10) Fullscreen — panel option che toàn bộ viewport khi mở ──
	/** Khi mở, dropdown thành overlay fixed inset:0 (CSS, không Fullscreen API). */
	fullscreen?: boolean;

	// ── (11) Backdrop — mờ + blur vùng nền khi list hiển thị (click nền để đóng) ──
	backdrop?: boolean;

	// ── (12) Auto-flip vị trí panel option theo không gian viewport ──
	/**
	 * 'auto' (mặc định): tự chọn vị trí — ưu tiên chiều dọc (down → up),
	 * chỉ khi CẢ HAI chiều dọc đều thiếu chỗ mới xét ngang (left/right,
	 * chọn phía có không gian lớn hơn). left/right là physical (không phải
	 * logical start/end).
	 * 'down'/'up'/'left'/'right': cố định vị trí panel so với trigger
	 * (manual — không auto-flip; nếu không đủ chỗ, panel có thể tràn).
	 */
	position?: SelectPosition;
}

/** Vị trí panel option — giá trị user set (prop) gồm 'auto' để tự đo. */
export type SelectPosition = 'down' | 'up' | 'left' | 'right' | 'auto';

/** Placement thực tế sau khi measure (4 hướng, không có 'auto'). */
export type SelectPlacement = 'down' | 'up' | 'left' | 'right';

export interface SelectConfigs {
	// Base config properties
	ref?: HTMLElement;
	style?: (string | undefined)[];
	event?: { events: EventListener; target?: HTMLElement | Window | Document }[];
	childrens?: Map<HTMLElement, any>;
	baseStatus?: {
		hover?: boolean;
		focus?: boolean;
		loaded?: boolean;
	};
	baseValue?: string | number;
	timeId?: Map<string, NodeJS.Timeout | number>;

	// Select-specific properties
	value: string | string[];
	mode: SelectMode;
	variant: SelectVariant;
	disabled: boolean;
	required: boolean;
	searchable: boolean;
	allowCreate: boolean;
	showCreateOption: boolean;
	createValue: string;
	createOptionLabel: string;
	clearable: boolean;
	color: Color;
	/** Size hiển thị — Label/FieldMessages đọc qua select-context để đồng bộ. */
	size: Size;
	name?: string;
	maxHeight: number | string;
	_loading?: boolean | undefined;
	loading?: boolean;
	delay: number;
	duration: number;
	status: {
		open: boolean;
		focus: boolean;
		hover: boolean;
		highlightedIndex: number;
		searchQuery: string;
		/** dirty so với mốc ban đầu — Form/Button đọc qua formContext.childrens */
		changed?: boolean;
		/** Vị trí panel sau khi measure (auto-flip 4 hướng) hoặc theo prop position manual. */
		placement?: SelectPlacement;
	};
	trigger: {
		ref?: HTMLElement;
		style: (string | undefined)[];
		event?: { events: EventListener; target?: HTMLElement | Window | Document }[];
	};
	dropdown: {
		ref?: HTMLElement;
		style: (string | undefined)[];
		event?: { events: EventListener; target?: HTMLElement | Window | Document }[];
	};
	searchInput: {
		ref?: HTMLElement;
		style: (string | undefined)[];
		event?: { events: EventListener; target?: HTMLElement | Window | Document }[];
	};
	// Nút clear trong ô search (hiện khi query không rỗng)
	searchClear: {
		ref?: HTMLElement;
		display: boolean;
		style: (string | undefined)[];
		event?: { events: EventListener; target?: HTMLElement | Window | Document }[];
	};
	optionList: {
		ref?: HTMLElement;
		style: (string | undefined)[];
		event?: { events: EventListener; target?: HTMLElement | Window | Document }[];
	};
	option: (option: SelectOption, index: number, isSelected: boolean, isHighlighted: boolean) => {
		style: (string | undefined)[];
		attrs: Record<string, string | number | boolean | undefined>;
	};
	group: (label: string) => {
		style: (string | undefined)[];
	};
	validation: {
		// Cache isValid (set bởi processValidation/reset) — getter isValid đọc trước
		_cachedIsValid?: boolean | 'pending' | undefined;
		isValid: boolean | 'pending' | undefined;
		messages?: Map<string, { content?: TranslateContent; kind: 'valid' | 'invalid' }>;
		process?: Map<string, boolean | 'pending'>;
	};
	createOption: (isSelected: boolean, isHighlighted: boolean) => {
		style: (string | undefined)[];
		attrs: Record<string, string | boolean | undefined>;
	};
	clearButton: {
		ref?: HTMLElement;
		style: (string | undefined)[];
		event?: { events: EventListener; target?: HTMLElement | Window | Document }[];
		display: boolean;
	};
	loadingIndicator: {
		ref?: HTMLElement;
		style: (string | undefined)[];
		event?: { events: EventListener; target?: HTMLElement | Window | Document }[];
		display: boolean;
	};
	// Loading indicator riêng cho ô search (trailing, khi remote search)
	searchLoading: {
		display: boolean;
		style: (string | undefined)[];
	};

	// Option list (gộp nguồn: props.options + loadOptions + createdOptions, dedupe)
	allOptions: SelectOption[];
	// Options sau khi filter theo search (local) hoặc remote (đã merge)
	filteredOptions: SelectOption[];
	// Tập option khả dụng (non-disabled, toàn bộ) — dùng cho select-all
	selectableOptions: SelectOption[];
	// Số option tối đa hiển thị (cap)
	maxOptions: number;
	// Options thực hiển thị trong danh sách (sliced theo load-more mode)
	visibleOptions: SelectOption[];
	// Còn option chưa hiển thị (hiện UI load-more)
	hasMore: boolean;
	// Chế độ load-more
	loadMoreMode: SelectLoadMoreMode;

	// Select-all state
	showSelectAll: boolean;
	allSelected: boolean;
	someSelected: boolean;

	// Remote search / edit-delete state
	remoteSearch: boolean;
	editableOptions: boolean;
	deletableOptions: boolean;

	// Pagination (chế độ 'pagination')
	pageSize: number;
	currentPage: number;
	totalPages: number;

	// Sort (chế độ 'alpha' | 'date')
	sortField: SelectSortField | undefined;
	sortDirection: SelectSortDirection;
	showSort: boolean;

	toggleOpen: () => void;
	close: () => void;
	open: () => void;
	selectOption: (value: string) => void;
	selectCreateOption: () => void;
	// Chọn/bỏ chọn tất cả option khả dụng
	toggleSelectAll: () => void;
	// Load thêm option (scroll/button)
	loadMore: () => void;
	// Điều hướng phân trang
	nextPage: () => void;
	prevPage: () => void;
	// Đổi trường sort (giữ chiều hiện tại)
	setSortField: (field: SelectSortField) => void;
	// Đảo chiều sort
	toggleSortDirection: () => void;
	// Xóa (thanh) query search — hiện nút clear trong ô search
	clearSearch: () => void;
	// Reset phân trang (khi query search đổi)
	resetPagination: () => void;
	// Scroll-to-load (mode 'scroll'): kiểm tra đã cuộn tới đáy chưa
	checkScrollLoad: (el: HTMLElement) => void;
	// Focus ô search input (an toàn iOS Safari: rAF + preventScroll)
	focusSearchInput: () => void;
	// Edit option inline (nút pencil): bắt đầu / xác nhận / hủy
	startEditOption: (opt: SelectOption) => void;
	confirmEditOption: () => void;
	cancelEditOption: () => void;
	clear: () => void;
	highlightOption: (index: number) => void;
	setSearchQuery: (query: string) => void;
	// Trigger validation (blur/change) — mimic Input
	processValidation: (eventName: keyof EventListener) => void;
	// Sửa / xóa option (emit event, không tự đổi source)
	updateOption: (value: string, newLabel: string) => void;
	deleteOption: (value: string) => void;
	// Nạp option ban đầu từ loadOptions (nếu có)
	loadInitialOptions: () => Promise<void>;
	// Thay toàn bộ bộ option nạp từ source (đồng bộ socket/DB)
	setOptions: (opts: SelectOption[]) => void;
	focus: () => void;
	blur: () => void;
	reset: () => void;
}
