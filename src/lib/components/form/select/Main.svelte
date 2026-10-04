<script lang="ts">
	//$components/form/select/Main.svelte
	import { styleSynced, measureTextWidth } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { Tag, Tooltip } from '$components/element';
	import { Modal } from '$components/modal';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount, untrack, type SvelteComponent } from 'svelte';
	import { getFormContext } from '../form';
	import { setSelectContext } from './_context';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import type {
		SelectConfigs,
		SelectLoadMoreMode,
		SelectOption,
		SelectOptionGroup,
		SelectPlacement,
		SelectProps,
		SelectSortDirection,
		SelectSortField
	} from './_interface';
	import type { EventListener } from '$components/interface';
	import type { ValidationCompact, ValidationFull } from '../input/_interface';
	import type { TranslateContent } from '$interfaces/basic';

	let {
		value = $bindable(),
		disabled = $bindable(),
		sort = $bindable<SelectSortField | undefined>(),
		sortDirection = $bindable<SelectSortDirection>(),
		children,
		...props
	}: SelectProps = $props();

	// Capture initial value for reset functionality
	let _initialValue: string | string[] | undefined = value;
	// Track if field was just reset programmatically - suppress validation until user interacts
	let _justReset = $state(true);
	// Options created at runtime via "search & create" (allowCreate)
	let createdOptions = $state<SelectOption[]>([]);
	// Options loaded from an async source (loadOptions / setOptions — sync data DB/socket)
	let loadedOptions = $state<SelectOption[]>([]);
	// Option đang ở chế độ edit nội bộ (nút pencil)
	let editingValue = $state<string | null>(null);
	let editingLabel = $state('');
	// Guard: nút Cancel/Save fire onmousedown (trước blur input) đặt true →
	// blur kế tiếp BỎ QUA confirmEditOption (chống click Cancel bị confirm trước).
	let _editBlurGuard = false;
	let initialOptionsLoaded = $state(false);
	// Số option hiển thị (load-more) + trang hiện tại (pagination)
	let visibleCount = $state(0);
	let currentPage = $state(1);
	// Pagination: jump-to-page (click số trang hiện tại → input nhập trang)
	let pageJumpOpen = $state(false);
	let pageJumpValue = $state('');
	// Loading khi remote search đang chạy
	let _searchLoading = $state(false);
	// Token race-guard: chỉ response mới nhất được apply (gõ liên tục nhiều lần)
	let _remoteToken = 0;
	// Display riêng cho Modal fullscreen (không bind trực tiếp configs.status.open —
	// Modal có logic ESC/backdrop/close-button riêng; onClose sẽ gọi configs.close()).
	let fullscreenDisplay = $state(false);

	// Refs DOM
	let searchInputEl: HTMLInputElement | undefined;
	let editInputEl: HTMLInputElement | undefined; // ô edit option inline (autofocus)
	let optionListEl: HTMLElement | undefined;
	let triggerEl: HTMLElement | undefined; // nút trigger (đo width cho chip)
	let dropdownEl: HTMLElement | undefined; // panel dropdown (đo chiều cao cho auto-flip)

	// (12b) Metrics panel mở NGANG (left/right) — set trên .select-root qua CSS var
	// --dd-top/--dd-width: top panel so với ROOT (trigger top, đã clamp viewport)
	// + width panel = width trigger. Chỉ set khi placement là left/right.
	let ddMetrics = $state<{ top?: number; width?: number; maxHeight?: number }>({});

	// Constant layout — dùng để tự tính maxOptions khi user không set
	const OPTION_ROW_HEIGHT = 38; // px: 0.5rem padding ×2 + ~22px line-height + gap 2px
	const SEARCH_ROW_HEIGHT = 52; // px: input search + margin-bottom (khi searchable)
	// Trạng thái chọn: 'all' | 'some'
	type SelectAllState = 'all' | 'some' | 'none';

	// Form context đọc ngay đầu phase init (getFormContext() = getContext(),
	// không reactive) để sizeDerived cascading dùng formContext?.size — tránh
	// "used before its declaration" khi khai báo nằm dưới (sau các derived).
	const formContext = getFormContext();

	// ── Deriveds base ──
	const modeDerived = $derived(props.mode ?? 'single');
	const variantDerived = $derived(props.variant ?? 'secondary');
	const sizeDerived = $derived(props.size ?? formContext?.size ?? client.browser?.size ?? 'md');
	const searchableDerived = $derived(props.searchable ?? false);
	const clearableDerived = $derived(props.clearable ?? (modeDerived === 'single'));
	const createOptionEnabledDerived = $derived(!!props.allowCreate);
	const remoteSearchDerived = $derived(!!(props.remoteSearch && props.loadOptions));
	const editableOptionsDerived = $derived(!!props.editableOptions);
	const deletableOptionsDerived = $derived(!!props.deletableOptions);
	const showSelectAllEnabledDerived = $derived(!!(props.showSelectAll && modeDerived === 'multiple'));
	const fullscreenDerived = $derived(!!props.fullscreen);
	const backdropDerived = $derived(!!props.backdrop);
	const positionDerived = $derived(props.position ?? 'auto');

	const maxHeightDerived = $derived.by(() => {
		if (props.maxHeight) return typeof props.maxHeight == 'number' ? props.maxHeight : parseFloat(props.maxHeight);
		return 300;
	});

	// Limit option display — user có thể set maxOptions, nếu không tính theo không gian dropdown
	const maxOptionsDerived = $derived.by(() => {
		if (props.maxOptions && props.maxOptions > 0) return props.maxOptions;
		const listHeight = Math.max(40, maxHeightDerived - (searchableDerived ? SEARCH_ROW_HEIGHT : 0));
		// Ít nhất 5 option, tối đa không giới hạn nếu user không yêu cầu limit
		return Math.max(5, Math.floor(listHeight / OPTION_ROW_HEIGHT));
	});

	const loadMoreModeDerived: SelectLoadMoreMode = $derived(props.loadMoreMode ?? 'scroll');
	const loadMoreChunkDerived = $derived(
		props.loadMoreChunk ?? Math.max(5, Math.floor(maxOptionsDerived / 2))
	);
	const pageSizeDerived = $derived(props.pageSize ?? Math.max(5, Math.floor(maxOptionsDerived / 2)));

	const colorDerived = $derived.by(() => {
		if (props.color) return props.color;
		if (props.loading || configs?.loading) return 'default';
		if (props.validation || requiredDerived) {
			const validation = configs?.validation;
			const isValid = validation?.isValid;
			const process = validation?.process;
			if (process && process.size > 0) {
				if (isValid == 'pending') return 'default';
				return isValid ? 'success' : 'error';
			}
			return 'default';
		}
		return 'default';
	});

	const requiredDerived = $derived(!!props.required);
	const nameDerived = $derived(props.name);
	const loadingDerived = $derived(props.loading);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'select-root',
			`size-${sizeDerived}`,
			`variant-${variantDerived}`,
			`color-${colorDerived}`,
			disabledDerived ? 'disabled' : undefined,
			configs?.status?.focus ? 'focus' : undefined,
			configs?.status?.hover ? 'hover' : undefined,
			configs?.status?.open ? 'open' : undefined,
			configs?.status?.open && fullscreenDerived ? 'fullscreen' : undefined,
			// Có backdrop: trigger phải nổi trên backdrop (z=45) để user vẫn theo dõi
			// được option đã chọn khi nền bị dim + blur
			configs?.status?.open && backdropDerived && !fullscreenDerived ? 'backdrop' : undefined,
			showChipsEnabledDerived ? 'has-chips' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	const disabledDerived = $derived.by(() => {
		if (disabled !== undefined) return disabled;
		const formContext = getFormContext();
		return formContext?.disabled ?? false;
	});

	const delayDerived = $derived(client.browser?.delay ?? 300);
	const durationDerived = $derived.by(() => {
		const d = client.browser?.duration;
		if (typeof d == 'number') return d;
		if (typeof d == 'string') return parseFloat(d) || 300;
		return 300;
	});

	// Resolve a TranslateContent | string to the active language (fallback en → vi)
	const getText = (content?: TranslateContent | string): string | undefined => {
		if (!content) return undefined;
		if (typeof content === 'string') return content;
		const lang = client.browser?.language ?? 'en';
		return content[lang] ?? content.en ?? content.vi;
	};

	// Process options — merge 3 sources: props.options (reactive), loadedOptions (async source),
	// createdOptions (allowCreate runtime). Dedupe by value, giữ thứ tự xuất hiện.
	const allOptionsDerived = $derived.by((): SelectOption[] => {
		const seen = new Set<string>();
		const opts: SelectOption[] = [];
		const push = (o: SelectOption) => {
			if (seen.has(o.value)) return;
			seen.add(o.value);
			opts.push(o);
		};
		if (props.options) props.options.forEach(push);
		if (props.optionGroups) {
			for (const group of props.optionGroups) {
				for (const opt of group.options) push({ ...opt, group: group.label });
			}
		}
		loadedOptions.forEach(push);
		createdOptions.forEach(push);
		return opts;
	});

	// Options khả dụng (non-disabled) — dùng cho select-all (chọn TOÀN BỘ khả dụng)
	const selectableOptionsDerived = $derived(allOptionsDerived.filter((o) => !o.disabled));

	// ── Search: NHẠY DẤU đúng hệ ngôn ngữ (diacritic-aware, không "bỏ dấu" tùy tiện) ──
	// Query CÓ dấu (vd "á")  → chỉ khớp đúng ký tự có dấu đó (KHÔNG khớp "a" hay "à").
	// Query KHÔNG dấu (vd "a", "truong") → khớp cả họ có dấu (a/à/á…, "truong"→"Trường").
	// Case-insensitive. Dùng chung: filter option + highlight segments.
	// (Create-option dedup bên dưới dùng foldSearch = NFD+lowercase GIỮ dấu — so khớp exact.)
	const foldSearch = (s: string): string => s.normalize('NFD').toLowerCase();

	// Token = { base (chữ gốc, lowercase), marks (chuỗi dấu combining), orig (index gốc) }.
	// Mỗi ký tự original giải NFD thành base + các dấu combining; orig giữ index gốc để
	// slice text đúng vị trí khi highlight (1 token ≙ 1 ký tự original).
	const tokenize = (text: string): { base: string; marks: string; orig: number }[] => {
		const tokens: { base: string; marks: string; orig: number }[] = [];
		for (let i = 0; i < text.length; i++) {
			const nfd = text[i].normalize('NFD');
			let marks = '';
			for (let k = 1; k < nfd.length; k++) {
				const code = nfd.codePointAt(k)!;
				if (code >= 0x0300 && code <= 0x036f) marks += nfd[k]; // chỉ lấy dấu combining
			}
			tokens.push({ base: nfd[0].toLowerCase(), marks, orig: i });
		}
		return tokens;
	};

	// Hai token khớp không (NHẠY DẤU). Query token KHÔNG dấu (marks='') → wildcard dấu
	// (khớp mọi biến thể dấu của cùng chữ gốc). Query token CÓ dấu → bắt buộc đúng dấu đó.
	const tokensMatch = (q: { base: string; marks: string }, t: { base: string; marks: string }): boolean => {
		if (q.base !== t.base) return false;
		if (q.marks === '') return true;
		return q.marks === t.marks;
	};

	// Tìm mọi vị trí khớp (query) trong text (dãy token). Trả về [start, end) theo index
	// ORIGINAL của text (để slice). Loại bỏ trùng lặp overlap (giữ match bắt đầu sớm nhất).
	const findMatches = (
		textTokens: { base: string; marks: string; orig: number }[],
		queryTokens: { base: string; marks: string; orig: number }[]
	): [number, number][] => {
		const m = queryTokens.length;
		if (m === 0) return [];
		const raw: [number, number][] = [];
		for (let i = 0; i + m <= textTokens.length; i++) {
			let ok = true;
			for (let k = 0; k < m; k++) {
				if (!tokensMatch(queryTokens[k], textTokens[i + k])) {
					ok = false;
					break;
				}
			}
			if (ok) raw.push([textTokens[i].orig, textTokens[i + m - 1].orig + 1]);
		}
		const merged: [number, number][] = [];
		let lastEnd = -1;
		for (const [s, e] of raw) {
			if (s >= lastEnd) {
				merged.push([s, e]);
				lastEnd = e;
			}
		}
		return merged;
	};

	// queryMatchesText: text (label/description) có chứa query (nhạy dấu) không?
	const queryMatchesText = (text: string, query: string): boolean => {
		const q = query.trim();
		if (!text || !q) return false;
		return findMatches(tokenize(text), tokenize(q)).length > 0;
	};

	/**
	 * Chia text thành các đoạn { text, isMatch } theo query (nhạy dấu + case-insensitive).
	 * Query rỗng → 1 đoạn duy nhất (isMatch=false).
	 * Dùng để highlight label/description option theo ô search (in-primary, không nền).
	 */
	const matchSegments = (text: string, query: string): { text: string; isMatch: boolean }[] => {
		const q = query.trim();
		if (!text || !q) return [{ text, isMatch: false }];
		const matches = findMatches(tokenize(text), tokenize(q));
		if (matches.length === 0) return [{ text, isMatch: false }];
		const segments: { text: string; isMatch: boolean }[] = [];
		let cursor = 0;
		for (const [start, end] of matches) {
			if (start > cursor) segments.push({ text: text.slice(cursor, start), isMatch: false });
			segments.push({ text: text.slice(start, end), isMatch: true });
			cursor = end;
		}
		if (cursor < text.length) segments.push({ text: text.slice(cursor), isMatch: false });
		return segments;
	};

	// Filtered options: local filter (query) HOẶC toàn bộ khi remote search đang chạy
	// (kết quả remote sẽ merge vào allOptions khi loadOptions resolve)
	const filteredOptionsDerived = $derived.by((): SelectOption[] => {
		const query = (configs.status.searchQuery ?? '').trim();
		// Remote search: có query + đang chờ kết quả → list rỗng (tránh hiện option
		// cũ không khớp query); spinner trong ô search báo trạng thái.
		if (remoteSearchDerived && _searchLoading && query) return [];
		if (!query) return allOptionsDerived;
		// Nhạy dấu (query "á" chỉ khớp "á"). Tìm trên label + value + description —
		// MẪU ĐẺU: highlight (matchSegments) tô cả label lẫn description, nên filter
		// cũng phải xét description để option khớp description không bị ẩn oan.
		return allOptionsDerived.filter(
			(opt) =>
				queryMatchesText(opt.label, query) ||
				queryMatchesText(opt.value, query) ||
				queryMatchesText(opt.description ?? '', query)
		);
	});

	// Sort state (bindable props.sort / sortDirection). undefined sortField →
	// giữ nguyên thứ tự nguồn (backward-compatible, không sort).
	const sortFieldDerived = $derived.by((): SelectSortField | undefined => {
		const f = sort;
		return f === 'alpha' || f === 'date' ? f : undefined;
	});
	const sortDirectionDerived = $derived.by((): SelectSortDirection =>
		sortDirection === 'desc' ? 'desc' : 'asc'
	);
	const showSortDerived = $derived(!!props.showSort);

	// Sort: áp trên filteredOptions (sau filter search) trước khi slice load-more/pagination.
	// 'date': option thiếu `date` luôn ở CUỐI (cả asc lẫn desc) — không lẫn vào giữa list.
	const sortedOptionsDerived = $derived.by((): SelectOption[] => {
		const opts = filteredOptionsDerived;
		const field = sortFieldDerived;
		if (!field || opts.length < 2) return opts;
		const dir = sortDirectionDerived === 'asc' ? 1 : -1;
		const copy = [...opts];
		copy.sort((a, b) => {
			if (field === 'date') {
				const ta = a.date != null ? new Date(a.date).getTime() : NaN;
				const tb = b.date != null ? new Date(b.date).getTime() : NaN;
				// Cả hai không có date → giữ nguyên thứ tự (stable: value làm tie-breaker)
				if (Number.isNaN(ta) && Number.isNaN(tb))
					return a.value.localeCompare(b.value, client.browser?.language ?? 'en');
				// NaN luôn hạng cuối: date nào hợp lệ đều xếp trước option không-date
				if (Number.isNaN(ta)) return 1;
				if (Number.isNaN(tb)) return -1;
				return (ta - tb) * dir;
			}
			// 'alpha': locale-aware (hỗ trợ tiếng Việt), tie-breaker value để stable
			const cmp = a.label
				.localeCompare(b.label, client.browser?.language ?? 'en', {
					sensitivity: 'base',
					numeric: true
				});
			return cmp !== 0 ? cmp * dir : a.value.localeCompare(b.value);
		});
		return copy;
	});

	// Pipeline: allOptions → filteredOptions (search) → sortedOptions (sort)
	// → visibleOptions (slice load-more/pagination). Sort KHÔNG đổi tập khả dụng
	// (selectableOptions vẫn từ allOptions) hay value lookup (allOptions.find).

	// "Create when no results" (allowCreate): value from the trimmed search query
	// .by() → lazy, tránh đọc `configs` trước khi nó được khai báo bên dưới
	const createValueDerived = $derived.by(() => configs.status.searchQuery?.trim() ?? '');
	const showCreateOptionDerived = $derived.by(() => {
		if (!createOptionEnabledDerived || !createValueDerived) return false;
		if (remoteSearchDerived) return false; // remote search không ghép create-option
		// Dedup EXACT (giữ dấu): chỉ so khớp khi value trùng đúng (kể cả dấu) — khác
		// với search (nhạy dấu wildcard). foldSearch = NFD + lowercase, giữ dấu.
		const q = foldSearch(createValueDerived);
		return !allOptionsDerived.some((o) => foldSearch(o.value) === q);
	});
	const createOptionLabelDerived = $derived.by(() => {
		const t = getText(props.createOptionLabel);
		const q = createValueDerived;
		return t ? t.replace('{value}', q) : q;
	});

	// i18n-able internal strings (fallback en → vi)
	const searchPlaceholderTextDerived = $derived.by(
		() => getText(props.searchPlaceholder) ?? getText({ en: 'Search...', vi: 'Tìm kiếm...' })
	);
	const noOptionsTextDerived = $derived.by(() => {
		if (searchableDerived && configs.status.searchQuery) {
			return getText({ en: 'No results found', vi: 'Không tìm thấy kết quả' });
		}
		return getText({ en: 'No options', vi: 'Không có tùy chọn' });
	});
	const clearLabelTextDerived = $derived.by(
		() => getText(props.clearLabel) ?? getText({ en: 'Clear selection', vi: 'Xóa lựa chọn' })
	);
	const loadMoreLabelDerived = $derived.by(
		() => getText(props.loadMoreLabel) ?? getText({ en: 'Load more', vi: 'Tải thêm' })
	);
	const selectAllLabelDerived = $derived.by(
		() => getText(props.selectAllLabel) ?? getText({ en: 'Select all', vi: 'Chọn tất cả' })
	);
	const sortByTextDerived = $derived(getText({ en: 'Sort by', vi: 'Xếp theo' }));
	const sortAlphaTextDerived = $derived(getText({ en: 'A–Z (name)', vi: 'A–Z (tên)' }));
	const sortDateTextDerived = $derived(getText({ en: 'Date', vi: 'Ngày' }));
	const sortAscLabelDerived = $derived(getText({ en: 'Ascending', vi: 'Tăng dần' }));
	const sortDescLabelDerived = $derived(getText({ en: 'Descending', vi: 'Giảm dần' }));

	// Pre-computed create-option attributes (re-evaluated on highlight change)
	const createOptionAttrsDerived = $derived.by(() =>
		configs.createOption(
			false,
			configs.status.highlightedIndex === configs.filteredOptions.length
		)
	);

	// Pagination
	const totalPagesDerived = $derived(Math.max(1, Math.ceil(filteredOptionsDerived.length / pageSizeDerived)));
	const visibleOptionsDerived = $derived.by((): SelectOption[] => {
		const opts = sortedOptionsDerived;
		if (loadMoreModeDerived === 'pagination') {
			const start = (Math.min(currentPage, totalPagesDerived) - 1) * pageSizeDerived;
			return opts.slice(start, start + pageSizeDerived);
		}
		// scroll / button: slice theo visibleCount
		// Nếu visibleCount = 0 (chưa init) → dùng maxOptionsDerived
		const cap = visibleCount === 0 ? maxOptionsDerived : visibleCount;
		return opts.slice(0, cap);
	});
	// hasMore: chỉ hiện UI load-more khi còn option chưa hiển thị (đã vượt không gian)
	const hasMoreDerived = $derived(filteredOptionsDerived.length > visibleOptionsDerived.length);

	// ── Select-all state (multiple) ──
	const selectAllStateDerived = $derived.by((): SelectAllState => {
		if (!showSelectAllEnabledDerived) return 'none';
		const val = configs.value;
		const arr = Array.isArray(val) ? val : [];
		const selectable = selectableOptionsDerived;
		if (selectable.length === 0) return 'none';
		const selectedCount = selectable.filter((o) => arr.includes(o.value)).length;
		if (selectedCount === selectable.length) return 'all';
		if (selectedCount > 0) return 'some';
		return 'none';
	});

	// Check if value is selected
	const isOptionSelected = (opt: SelectOption): boolean => {
		const val = configs.value;
		if (modeDerived === 'multiple') {
			return Array.isArray(val) && val.includes(opt.value);
		}
		return val === opt.value;
	};

	// Display value for trigger
	const displayValueDerived = $derived.by((): string => {
		const val = configs.value;
		if (!val) return '';
		if (modeDerived === 'multiple') {
			const arr = Array.isArray(val) ? val : [val];
			return arr
				.map((v) => allOptionsDerived.find((o) => o.value === v)?.label ?? v)
				.join(', ');
		}
		return allOptionsDerived.find((o) => o.value === val)?.label ?? (val as string);
	});

	// (M2) Option object ĐÃ CHỌN (single) — để trigger hiển thị avatar + label,
	// không chỉ label (rich options). undefined khi chưa có value.
	const selectedSingleOptionDerived = $derived.by((): SelectOption | undefined => {
		if (modeDerived !== 'single') return undefined;
		const val = configs.value;
		if (!val) return undefined;
		const found = allOptionsDerived.find((o) => o.value === val);
		return found ?? { value: val as string, label: String(val) };
	});

	// ── Chip overflow (multiple) ──
	// Tập option ĐÃ CHỌN (theo thứ tự value — cuối array = mới nhất, ưu tiên hiển thị)
	const selectedOptionsDerived = $derived.by((): SelectOption[] => {
		const val = configs.value;
		const arr = Array.isArray(val) ? val : [];
		return arr.map((v) => {
			const opt = allOptionsDerived.find((o) => o.value === v);
			return opt ?? { value: v, label: String(v) };
		});
	});
	// Chỉ bật chips khi: multiple + showChips (default multiple) + không fullscreen.
	// Đọc configs.status.open (reactive) → derived re-eval khi panel mở/đóng.
	const showChipsEnabledDerived = $derived.by(() => {
		if (modeDerived !== 'multiple') return false;
		if (props.showChips === false) return false;
		if (configs.status.open && fullscreenDerived) return false; // fullscreen: chip tự tắt
		return true;
	});
	const removableChipsDerived = $derived(props.removableChips !== false);
	const chipTruncateLengthDerived = $derived(props.chipTruncateLength ?? 14);

	// Placeholder display
	const placeholderDerived = $derived.by(() => {
		if (!props.placeholder) return undefined;
		if (typeof props.placeholder === 'string') return props.placeholder;
		const currentLang = client.browser?.language ?? 'en';
		const text = props.placeholder[currentLang] ?? props.placeholder.en ?? props.placeholder.vi;
		return text ? text : undefined;
	});
	// Title for the fullscreen Modal header
	const fullscreenTitleDerived = $derived(placeholderDerived ?? getText({ en: 'Select', vi: 'Chọn' }));

	// ── Chip fit (overflow) ──
	// Kết quả đo: chip visible (recent-first, reverse order) + số chip ẩn (gom "+N")
	// fallback=true → chưa đo xong (SSR / kích thước 0) → render text fallback
	let chipFit = $state<{ visible: SelectOption[]; hiddenCount: number; fallback: boolean }>({
		visible: [],
		hiddenCount: 0,
		fallback: true
	});
	let chipFitSig = $state('');
	// Cache width chip theo (label-truncated + removable) — font trigger ổn định
	const chipWidthCache = new SvelteMap<string, number>();
	// Hằng số đo (px, đồng bộ Tag size-sm: --tag-h 24px, --tag-pad 10px, gap 4px, nút × 16px)
	const CHIP_GAP = 4;
	const CHIP_CHROME_REMOVABLE = 44; // pad-inline 20 + gap 4 + nút × 16 + border 2 + an toàn 2
	const CHIP_CHROME_PLAIN = 22; // pad-inline 20 + border 2 (chip "+N" không có nút ×)
	const CHIPS_RESERVE = 72; // chevron + clear button + padding trigger

	/** Đo width 1 chip (cache theo label + removable). */
	const chipWidthOf = (opt: SelectOption, removable: boolean): number => {
		const trunc = chipTruncateLengthDerived;
		const text = trunc > 0 && opt.label.length > trunc ? opt.label.slice(0, trunc) : opt.label;
		const key = `${text}|${removable ? 1 : 0}`;
		const cached = chipWidthCache.get(key);
		if (cached !== undefined) return cached;
		const w =
			(triggerEl ? measureTextWidth(text, triggerEl) : text.length * 8) +
			(removable ? CHIP_CHROME_REMOVABLE : CHIP_CHROME_PLAIN);
		chipWidthCache.set(key, w);
		return w;
	};

	/**
	 * Tính bộ chip fit (THUần HUYẾT — không gán state): ưu tiên option MỚI NHẤT
	 * (cuối array), phần ẩn gom 1 chip "+N". Returns { visible, hiddenCount, sig }
	 * để caller so signature trước khi gán (guard chống re-render lặp).
	 */
	const computeChipsFit = () => {
		const opts = selectedOptionsDerived;
		const removable = removableChipsDerived;
		const sig = (hiddenCount: number) =>
			`${opts.length}|${removable ? 1 : 0}|${chipTruncateLengthDerived}|${hiddenCount}|${
				opts.map((o) => o.value).join(',')
			}`;
		if (opts.length === 0)
			return { visible: [] as SelectOption[], hiddenCount: 0, sig: sig(0) };
		const trigger = triggerEl;
		if (!trigger) return null; // chưa có DOM — giữ fallback
		const available = trigger.clientWidth - CHIPS_RESERVE;
		if (available <= 0) return null; // kích thước chưa ổn định — giữ fallback
		// Total width nếu hiện tất cả
		let total = 0;
		for (const o of opts) total += chipWidthOf(o, removable) + CHIP_GAP;
		if (total - CHIP_GAP <= available) {
			return { visible: [...opts], hiddenCount: 0, sig: sig(0) };
		}
		// Chừa chỗ chip "+N" rồi đo ngược từ option mới nhất
		const plusW = measureTextWidth(`+${opts.length}`, trigger) + CHIP_CHROME_PLAIN;
		let budget = available - plusW - CHIP_GAP;
		const visible: SelectOption[] = [];
		for (let i = opts.length - 1; i >= 0; i--) {
			const w = chipWidthOf(opts[i], removable);
			// Luôn giữ ≥1 chip kể cả khi budget âm (tránh trigger trống)
			if (budget - w >= 0 || visible.length === 0) {
				visible.unshift(opts[i]);
				budget -= w + CHIP_GAP;
			} else break;
		}
		const hiddenCount = opts.length - visible.length;
		return { visible, hiddenCount, sig: sig(hiddenCount) };
	};

	/** Đo + gán chipFit (chỉ khi signature đổi). */
	const measureChipsFit = () => {
		const result = computeChipsFit();
		if (!result) return;
		if (result.sig === chipFitSig) return; // không đổi — skip re-render
		chipFitSig = result.sig;
		chipFit = { visible: result.visible, hiddenCount: result.hiddenCount, fallback: false };
	};

	let configs: SelectConfigs = $state({
		get value() {
			return value ?? '';
		},
		set value(v) {
			value = v as string | string[];
			// Emit onValueChange (hook cho DB/socket persist)
			if (props.onValueChange) props.onValueChange(v);
		},
		get mode() {
			return modeDerived;
		},
		get variant() {
			return variantDerived;
		},
		get size() {
			return sizeDerived;
		},
		get disabled() {
			return disabledDerived;
		},
		get required() {
			return requiredDerived;
		},
		get searchable() {
			return searchableDerived;
		},
		get clearable() {
			return clearableDerived;
		},
		get allowCreate() {
			return createOptionEnabledDerived;
		},
		get showCreateOption() {
			return showCreateOptionDerived;
		},
		get createValue() {
			return createValueDerived;
		},
		get createOptionLabel() {
			return createOptionLabelDerived;
		},
		get color() {
			return colorDerived;
		},
		get name() {
			return nameDerived;
		},
		get maxHeight() {
			return maxHeightDerived;
		},
		_loading: undefined as undefined | boolean,
		get loading() {
			if (this._loading !== undefined) return this._loading;
			return loadingDerived;
		},
		set loading(v: boolean | undefined) {
			this._loading = v;
		},
		get delay() {
			return delayDerived;
		},
		get duration() {
			return durationDerived;
		},
		get style() {
			return styleDerived;
		},
		status: {
			open: false,
			focus: false,
			hover: false,
			highlightedIndex: -1,
			searchQuery: ''
		},
		trigger: {
			get style() {
				const defaultStyles: (string | undefined)[] = ['select-trigger'];
				return styleSynced({ defaultStyles });
			}
		},
		dropdown: {
			get ref() {
				return dropdownEl;
			},
			get style() {
				// Mapping thống nhất 4 hướng (M1): --down/--up/--left/--right
				// (--down không cần rule riêng — CSS base đã là down)
				const defaultStyles: (string | undefined)[] = [
					'select-dropdown',
					configs.status.placement ? `select-dropdown--${configs.status.placement}` : undefined
				];
				return styleSynced({ defaultStyles });
			}
		},
		searchInput: {
			get ref() {
				return searchInputEl;
			},
			get style() {
				const defaultStyles: (string | undefined)[] = ['select-search-input'];
				return styleSynced({ defaultStyles });
			}
		},
		searchClear: {
			get ref() {
				return undefined;
			},
			get display() {
				return (
					searchableDerived &&
					!!configs.status.searchQuery &&
					!disabledDerived
				);
			},
			get style() {
				const defaultStyles: (string | undefined)[] = ['select-search-clear'];
				return styleSynced({ defaultStyles });
			}
		},
		optionList: {
			get ref() {
				return optionListEl;
			},
			get style() {
				const defaultStyles: (string | undefined)[] = ['select-option-list'];
				return styleSynced({ defaultStyles });
			}
		},
		option: (opt: SelectOption, index: number, isSelected: boolean, isHighlighted: boolean) => {
			const defaultStyles: (string | undefined)[] = [
				'select-option',
				isSelected ? 'selected' : undefined,
				isHighlighted ? 'highlighted' : undefined,
				opt.disabled ? 'disabled' : undefined,
				editingValue === opt.value ? 'editing' : undefined
			];
			return {
				style: styleSynced({ defaultStyles }),
				attrs: {
					role: 'option',
					'aria-selected': isSelected,
					'aria-disabled': opt.disabled,
					tabindex: opt.disabled ? -1 : 0
				}
			};
		},
		group: (label: string) => {
			const defaultStyles: (string | undefined)[] = ['select-optgroup'];
			return {
				style: styleSynced({ defaultStyles })
			};
		},
		createOption: (isSelected: boolean, isHighlighted: boolean) => {
			const defaultStyles: (string | undefined)[] = [
				'select-option',
				'create-option',
				isSelected ? 'selected' : undefined,
				isHighlighted ? 'highlighted' : undefined
			];
			return {
				style: styleSynced({ defaultStyles }),
				attrs: {
					role: 'option',
					'aria-selected': isSelected
				}
			};
		},
		clearButton: {
			get display() {
				const val = configs.value;
				const hasValue = Array.isArray(val) ? val.length > 0 : val !== '';
				// Không hiện nút clear khi disabled (không cho sửa value khi khóa)
				return !!(configs.clearable && hasValue && !configs.disabled);
			},
			get style() {
				const defaultStyles: (string | undefined)[] = ['select-clear-button'];
				return styleSynced({ defaultStyles });
			}
		},
		loadingIndicator: {
			get display() {
				return configs.loading ?? false;
			},
			get style() {
				const defaultStyles: (string | undefined)[] = ['select-loading-indicator'];
				return styleSynced({ defaultStyles });
			}
		},
		validation: {
			_cachedIsValid: undefined as boolean | 'pending' | undefined,
			get isValid() {
				if (this._cachedIsValid !== undefined) return this._cachedIsValid;
				if (_justReset) return true;
				if (!props.validation && !configs.required) return true;
				if (configs.validation?.process) {
					const results = [...configs.validation.process.values()];
					if (results.some((rs) => rs == 'pending')) return 'pending';
					return results.every((rs) => rs);
				}
				if (configs.required) {
					const val = configs.value;
					if (modeDerived === 'multiple') {
						return Array.isArray(val) && val.length > 0;
					}
					return Boolean(val);
				}
				return true;
			},
			set isValid(v: boolean | 'pending' | undefined) {
				this._cachedIsValid = v;
			},
			process: undefined as Map<string, boolean | 'pending'> | undefined,
			messages: undefined as Map<string, { content?: TranslateContent; kind: 'valid' | 'invalid' }> | undefined
		},
		get allOptions() {
			return allOptionsDerived;
		},
		get filteredOptions() {
			return filteredOptionsDerived;
		},
		get selectableOptions() {
			return selectableOptionsDerived;
		},
		get maxOptions() {
			return maxOptionsDerived;
		},
		get visibleOptions() {
			return visibleOptionsDerived;
		},
		get hasMore() {
			return hasMoreDerived;
		},
		get loadMoreMode() {
			return loadMoreModeDerived;
		},
		get showSelectAll() {
			return showSelectAllEnabledDerived;
		},
		get allSelected() {
			return selectAllStateDerived === 'all';
		},
		get someSelected() {
			return selectAllStateDerived === 'some';
		},
		get remoteSearch() {
			return remoteSearchDerived;
		},
		get editableOptions() {
			return editableOptionsDerived;
		},
		get deletableOptions() {
			return deletableOptionsDerived;
		},
		get pageSize() {
			return pageSizeDerived;
		},
		get currentPage() {
			return currentPage;
		},
		get totalPages() {
			return totalPagesDerived;
		},
		get sortField() {
			return sortFieldDerived;
		},
		get sortDirection() {
			return sortDirectionDerived;
		},
		get showSort() {
			return showSortDerived;
		},
		get searchLoading() {
			return {
				display: _searchLoading,
				style: styleSynced({ defaultStyles: ['select-search-spinner'] })
			};
		},

		// ── Methods ──
		toggleOpen() {
			if (configs.disabled) return;
			configs.status.open = !configs.status.open;
			if (!configs.status.open) {
				configs.status.searchQuery = '';
				configs.status.highlightedIndex = -1;
				editingValue = null;
			} else {
				// Highlight first non-disabled option
				const firstIndex = configs.visibleOptions.findIndex((o) => !o.disabled);
				configs.status.highlightedIndex = firstIndex >= 0 ? firstIndex : -1;
				// Autofocus search input (an toàn iOS Safari — requestAnimationFrame + preventScroll)
				configs.focusSearchInput();
				// Load options async lần đầu (nếu có loadOptions)
				if (props.loadOptions && !initialOptionsLoaded) {
					configs.loadInitialOptions();
				}
			}
		},
		close() {
			configs.status.open = false;
			// Đi qua setSearchQuery: remote search sẽ gọi loadOptions('') để nạp lại
			// danh sách gốc (loadedOptions đang giữ kết quả filter cũ sau khi gõ search)
			configs.setSearchQuery('');
			configs.status.highlightedIndex = -1;
			editingValue = null;
		},
		open() {
			if (configs.disabled) return;
			configs.status.open = true;
			const firstIndex = configs.visibleOptions.findIndex((o) => !o.disabled);
			configs.status.highlightedIndex = firstIndex >= 0 ? firstIndex : -1;
			configs.focusSearchInput();
			if (props.loadOptions && !initialOptionsLoaded) {
				configs.loadInitialOptions();
			}
		},
		// Focus ô search input (an toàn iOS Safari: rAF + preventScroll, tránh scroll jump)
		focusSearchInput() {
			if (!searchableDerived || !browser) return;
			// Chờ dropdown render xong (rAF) — ref có thể vẫn undefined tại thời điểm gọi
			// (khi gọi từ toggleOpen/open trước khi DOM cập nhật). Dùng optional chaining
			// bên trong rAF để an toàn; preventScroll tránh iOS Safari tự scroll dropdown đi.
			requestAnimationFrame(() => {
				searchInputEl?.focus({ preventScroll: true });
			});
		},
		// Clear query search (nút X trong ô search)
		clearSearch() {
			configs.setSearchQuery('');
			// Reset load-more khi clear query
			visibleCount = 0;
			currentPage = 1;
			// Focus lại ô search (giữ trải nghiệm gõ liên tục)
			configs.focusSearchInput();
		},
		selectOption(optionValue: string) {
			const opt = allOptionsDerived.find((o) => o.value === optionValue);
			if (!opt || opt.disabled) return;
			// Emit onOptionSelect (hook DB/socket)
			if (props.onOptionSelect) props.onOptionSelect(optionValue);

			if (modeDerived === 'multiple') {
				const current = (Array.isArray(configs.value) ? configs.value : []) as string[];
				const newValue = current.includes(optionValue)
					? current.filter((v) => v !== optionValue)
					: [...current, optionValue];
				configs.value = newValue;
			} else {
				configs.value = optionValue;
				configs.close();
			}
			_justReset = false;
			// Trigger validation khi chọn option (mimic Input on change/blur)
			configs.processValidation('change');
		},
		// Chọn/bỏ chọn tất cả option khả dụng (select-all row)
		toggleSelectAll() {
			if (modeDerived !== 'multiple') return;
			const selectable = selectableOptionsDerived;
			if (selectable.length === 0) return;
			const current = (Array.isArray(configs.value) ? configs.value : []) as string[];
			const allSelected = selectAllStateDerived === 'all';
			const selectableValues = new Set(selectable.map((o) => o.value));
			const newValue = allSelected
				? current.filter((v) => !selectableValues.has(v))
				: [...new Set([...current, ...selectable.map((o) => o.value)])];
			configs.value = newValue;
			_justReset = false;
			configs.processValidation('change');
		},
		// Load thêm option (scroll / button): tăng visibleCount theo chunk
		loadMore() {
			// visibleCount = 0 nghĩa là đang hiển thị theo cap mặc định (maxOptions)
			const current = visibleCount === 0 ? maxOptionsDerived : visibleCount;
			visibleCount = Math.min(filteredOptionsDerived.length, current + loadMoreChunkDerived);
		},
		// Điều hướng phân trang
		nextPage() {
			if (currentPage < totalPagesDerived) currentPage++;
		},
		prevPage() {
			if (currentPage > 1) currentPage--;
		},
		// Đổi trường sort (giữ chiều hiện tại) — qua control trong dropdown
		setSortField(field: SelectSortField) {
			if (sort === field) return;
			sort = field;
			configs.resetPagination();
			props.onSortChange?.(field, sortDirectionDerived);
		},
		// Đảo chiều sort (asc ⇄ desc)
		toggleSortDirection() {
			sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
			configs.resetPagination();
			props.onSortChange?.(sortFieldDerived ?? 'alpha', sortDirectionDerived);
		},
		// Scroll-to-load (mode 'scroll'): kiểm tra đã cuộn tới đáy chưa
		checkScrollLoad(el: HTMLElement) {
			if (loadMoreModeDerived !== 'scroll') return;
			if (!configs.hasMore) return;
			const threshold = 48; // px: trigger khi cách đáy 48px
			const nearBottom =
				el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
			if (nearBottom) configs.loadMore();
		},
		// Reset visibleCount/currentPage khi query search đổi (mới)
		resetPagination() {
			visibleCount = 0;
			currentPage = 1;
		},
		selectCreateOption() {
			if (!configs.showCreateOption) return;
			// Label của option tạo mới = chính giá trị (query đã trim), KHÔNG phải
			// mẫu "Add {value}" (mẫu chỉ là hint cho dòng "create this" trong list)
			const value = configs.createValue;
			const label = value;
			createdOptions.push({ value, label });
			// Emit onOptionCreate (hook DB/socket)
			if (props.onOptionCreate) props.onOptionCreate(value, label);
			configs.selectOption(value);
			// After creating, reset the search so the option shows as selected
			if (modeDerived === 'multiple') {
				configs.status.searchQuery = '';
				configs.status.highlightedIndex = -1;
				configs.resetPagination();
				// TỰ ĐỘNG FOCUS SEARCH: vừa thêm xong option, dropdown vẫn mở
				// (mode multiple) → đưa caret về ô search để user tạo/search tiếp ngay.
				// (single-mode: selectOption() đã close() dropdown → không focus,
				//  focusSearchInput() tự no-op khi !searchable.)
				configs.focusSearchInput();
			}
		},
		// Xóa option (emit event — component KHÔNG tự đổi source)
		deleteOption(v: string) {
			if (props.onOptionDelete) props.onOptionDelete(v);
			// Nếu option đang được chọn → bỏ chọn (tránh value không còn option tương ứng)
			if (modeDerived === 'multiple') {
				const current = (Array.isArray(configs.value) ? configs.value : []) as string[];
				if (current.includes(v)) {
					configs.value = current.filter((x) => x !== v);
				}
			} else if (configs.value === v) {
				configs.value = '';
			}
			// Bỏ khỏi createdOptions nếu là option tạo runtime
			createdOptions = createdOptions.filter((o) => o.value !== v);
		},
		// Sửa option (emit event — component KHÔNG tự đổi source)
		updateOption(v: string, newLabel: string) {
			if (props.onOptionUpdate) props.onOptionUpdate(v, newLabel);
			// Nếu option tạo runtime thì cập nhật label nội bộ luôn
			createdOptions = createdOptions.map((o) => (o.value === v ? { ...o, label: newLabel } : o));
			editingValue = null;
			editingLabel = '';
		},
		// Bắt đầu edit option (nút pencil) — option disabled không cho sửa
		startEditOption(opt: SelectOption) {
			if (opt.disabled) return;
			editingValue = opt.value;
			editingLabel = opt.label;
			_editBlurGuard = false;
			configs.status.highlightedIndex = configs.visibleOptions.findIndex(
				(o) => o.value === opt.value
			);
			// Tự động focus ô edit: DOM cần 1 frame để render <input>
			// (giống focusSearchInput — rAF + preventScroll tránh iOS scroll nhảy)
			requestAnimationFrame(() => {
				editInputEl?.focus({ preventScroll: true });
			});
		},
		cancelEditOption() {
			editingValue = null;
			editingLabel = '';
		},
		confirmEditOption() {
			if (editingValue && editingLabel.trim()) {
				configs.updateOption(editingValue, editingLabel.trim());
			} else {
				configs.cancelEditOption();
			}
		},
		// Nạp option ban đầu từ loadOptions (nếu có)
		async loadInitialOptions() {
			if (!props.loadOptions || initialOptionsLoaded) return;
			initialOptionsLoaded = true;
			try {
				const opts = await props.loadOptions();
				if (opts && Array.isArray(opts)) {
					loadedOptions = opts;
				}
			} catch (e) {
				// Silent — user có thể xử lý qua onSearch/timeout
				console.warn('[Select] loadOptions() failed:', e);
			}
		},
		// Thay toàn bộ bộ option nạp từ source (đồng bộ socket/DB)
		setOptions(opts: SelectOption[]) {
			if (Array.isArray(opts)) loadedOptions = opts;
		},
		clear() {
			configs.value = modeDerived === 'multiple' ? [] : '';
			_justReset = true;
		},
		highlightOption(index: number) {
			const total = configs.visibleOptions.length;
			// index === total highlights the "create" row (when present)
			if (index < 0) return;
			if (index === total) {
				if (configs.showCreateOption) configs.status.highlightedIndex = index;
				return;
			}
			if (index < total) {
				const opt = configs.visibleOptions[index];
				if (!opt.disabled) {
					configs.status.highlightedIndex = index;
				}
			}
		},
		setSearchQuery(query: string) {
			configs.status.searchQuery = query;
			// Reset pagination khi query đổi
			configs.resetPagination();
			// Emit onSearch (đã debounce nếu remote)
			if (props.onSearch) {
				if (!configs.timeId) configs.timeId = new Map();
				const key = 'timeout-search';
				const prev = configs.timeId.get(key);
				if (prev) clearTimeout(prev);
				const delay = props.searchDelay ?? delayDerived;
				configs.timeId.set(
					key,
					setTimeout(() => props.onSearch?.(query), delay) as unknown as NodeJS.Timeout
				);
			}
			// Remote search: gọi loadOptions(query) debounce
			if (remoteSearchDerived) {
				if (!configs.timeId) configs.timeId = new Map();
				const key = 'timeout-remote-search';
				const prev = configs.timeId.get(key);
				if (prev) clearTimeout(prev);
				const delay = props.searchDelay ?? delayDerived;
				_searchLoading = true;
				// Token race-guard: response về sau (lạc hậu) bị bỏ qua
				const token = ++_remoteToken;
				configs.timeId.set(
					key,
					setTimeout(async () => {
						try {
							const opts = await props.loadOptions?.(query);
							if (token !== _remoteToken) return; // query mới hơn đã gửi — bỏ qua
							if (opts && Array.isArray(opts)) {
								// Remote search: thay thế loadedOptions (không merge với local)
								loadedOptions = opts;
							}
						} catch (e) {
							console.warn('[Select] remote search failed:', e);
						} finally {
							if (token === _remoteToken) _searchLoading = false;
						}
					}, delay) as unknown as NodeJS.Timeout
				);
			}
			// Highlight first non-disabled visible option (hoặc create row)
			const firstIndex = configs.visibleOptions.findIndex((o) => !o.disabled);
			if (firstIndex >= 0) {
				configs.status.highlightedIndex = firstIndex;
			} else if (configs.showCreateOption) {
				configs.status.highlightedIndex = configs.visibleOptions.length;
			} else {
				configs.status.highlightedIndex = -1;
			}
		},
		// Trigger validation (mimic Input on blur/change)
		async processValidation(eventName: keyof EventListener) {
			_justReset = false;
			if (!props.validation && !configs.required) return;
			if (!configs.validation.process) configs.validation.process = new SvelteMap();
			if (!configs.validation.messages) configs.validation.messages = new SvelteMap();
			if (!configs.timeId) configs.timeId = new Map();

			const defaultValidators: (ValidationCompact | ValidationFull)[] = [];
			if (configs.required) {
				defaultValidators.push({
					isValid: (input) => {
						if (input === undefined || input === '') return false;
						if (Array.isArray(input)) return input.length > 0;
						return typeof input === 'string' && input.trim().length > 0;
					},
					message: {
						invalid: {
							en: 'This field is required',
							vi: 'Trường này là bắt buộc'
						}
					}
				});
			}

			const entries = props.validation
				? (Object.entries(props.validation) as [string, any][])
						.filter(([k]) => k !== 'operator')
						.filter(([k]) => ['change', 'blur', 'input'].includes(k))
				: [];
			const operator: 'and' | 'or' = props.validation?.operator ?? 'and';

			// Gộp defaultValidators vào event 'change' (mimic Input: default ở blur, Select ở change)
			const allHandles: (ValidationCompact | ValidationFull)[] = [];
			for (const [ev, data] of entries) {
				if (ev === eventName) {
					if (Array.isArray(data)) allHandles.push(...data);
					else if (data && typeof data === 'object' && Array.isArray(data.handles))
						allHandles.push(...data.handles);
				}
			}
			if (eventName === 'change' && defaultValidators.length > 0) {
				allHandles.push(...defaultValidators);
			}
			if (allHandles.length === 0) return;

			// Debounce theo delay
			const name = `timeout-validation-${eventName}`;
			const prevTime = configs.timeId.get(name);
			if (prevTime) clearTimeout(prevTime);

			configs.validation.process.set(eventName, 'pending');
			configs.timeId.set(
				name,
				setTimeout(async () => {
					const val = untrack(() => value);
					const results = await Promise.all(
						allHandles.map(async (h) => {
							let result: boolean;
							if (typeof h === 'function') {
								result = await (h as ValidationCompact)(val as any);
							} else {
								result = await h.isValid(val as any);
								const content = result ? h.message?.valid : h.message?.invalid;
								configs.validation.messages?.set(h.isValid as any, {
									content,
									kind: result ? 'valid' : 'invalid'
								});
							}
							return result;
						})
					);
					const overall = operator === 'and' ? results.every(Boolean) : results.some(Boolean);
					configs.validation.process?.set(eventName, overall);
					configs.validation.isValid = overall;
				}, delayDerived) as unknown as NodeJS.Timeout
			);
		},
		focus() {
			_justReset = false;
			configs.status.focus = true;
		},
		blur() {
			configs.status.focus = false;
			configs.close();
			// Trigger validation on blur (mimic Input)
			configs.processValidation('blur');
		},
		reset() {
			value = _initialValue;
			configs.validation.process = undefined;
			configs.validation.messages = undefined;
			configs.validation.isValid = undefined;
			_justReset = true;
			if (configs.timeId) {
				for (const id of configs.timeId.values()) clearTimeout(id);
				configs.timeId.clear();
			}
			configs.loading = false;
			configs.status.focus = false;
			configs.status.open = false;
			_searchLoading = false;
			visibleCount = 0;
			currentPage = 1;
			editingValue = null;
			editingLabel = '';
		}
	});

	// ── (12) Auto-flip 4 hướng: down → up → left/right (M1, vertical-first) ──
	// Anchor = trigger (không theo chuột). panel height = dropdownEl.offsetHeight
	// (đã cap bởi inline max-height). Chỉ khi CẢ HAI chiều dọc thiếu chỗ mới
	// xét ngang — chọn phía có không gian LỚN HƠN (left/right physical).
	const DD_EDGE = 8; // an toàn cạnh viewport cho panel ngang
	const computePlacement = (): SelectPlacement => {
		const t = triggerEl;
		const p = dropdownEl;
		if (!t || !p) return 'down';
		const r = t.getBoundingClientRect();
		const h = p.offsetHeight;
		const w = r.width; // width panel khi mở ngang = width trigger
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		const m = 12; // gap 4 + an toàn 8
		// (1) vertical-first — giữ nguyên behavior cũ
		const below = vh - r.bottom;
		const above = r.top;
		if (below >= h + m) return 'down';
		if (above > below) return 'up';
		// (2) cả hai dọc thiếu → xét ngang
		const left = r.left;
		const right = vw - r.right;
		if (left >= w + m && right >= w + m) return right >= left ? 'right' : 'left';
		if (left >= w + m) return 'left';
		if (right >= w + m) return 'right';
		return 'down'; // không hướng nào vừa → giữ down + page scroll (ổn định, như cũ)
	};

	// Metrics panel mở NGANG: top so với ROOT (root = containing block, có thể
	// có Label phía trên trigger) + width = width trigger + cap height viewport.
	// Set vào ddMetrics → CSS var --dd-top/--dd-width trên .select-root.
	const computeAnchorMetrics = () => {
		const t = triggerEl;
		const p = dropdownEl;
		const root = configs.ref;
		if (!t || !p || !root) return;
		const r = t.getBoundingClientRect();
		const rr = root.getBoundingClientRect();
		const vh = window.innerHeight;
		const panelH = Math.min(p.offsetHeight, vh - DD_EDGE * 2);
		// top trigger SO VỚI top root (Label slot → offsetTop > 0 nếu có)
		const anchorTop = r.top - rr.top;
		// Clamp panel nằm trọn trong viewport (dọc)
		const vpTop = Math.max(DD_EDGE, Math.min(anchorTop + rr.top, vh - panelH - DD_EDGE));
		ddMetrics = {
			top: Math.round(vpTop - rr.top),
			width: Math.round(r.width),
			maxHeight: Math.round(panelH)
		};
	};

	// Đăng ký context để <Label> (và FieldMessages/Description) đồng bộ
	// required/asterisk/màu/size — mirror pattern checkbox (precedent checkbox/index.ts).
	setSelectContext(configs);

	$effect(() => {
		// (M1) Bỏ guard `positionDerived !== 'auto'` — manual trước đây DEAD:
		// không ai gán placement khi user set position="up"/"left"/...
		// Manual: gán thẳng hướng chọn (không auto-flip). Auto: đo + flip 4 hướng.
		if (!browser || !configs.status.open || fullscreenDerived) return;
		// Đọc để đăng ký dep (rAF không track): re-measure khi panel height đổi
		// (options, value, maxHeight).
		void configs.value;
		void configs.filteredOptions.length;
		void maxHeightDerived;
		let raf = 0;
		const run = () => {
			raf = requestAnimationFrame(() => {
				const p: SelectPlacement =
					positionDerived === 'auto' ? computePlacement() : (positionDerived as SelectPlacement);
				if (configs.status.placement !== p) configs.status.placement = p;
				// Panel mở ngang: tính/refresh --dd-top/--dd-width (cần cập nhật
				// kể cả khi placement đã đúng — resize/trigger đổi width).
				if (p === 'left' || p === 'right') computeAnchorMetrics();
			});
		};
		run();
		window.addEventListener('resize', run);
		// Trigger đổi width khi open (chips) → refresh --dd-width (follow pattern chip-fit)
		const ro =
			'ResizeObserver' in window ? new ResizeObserver(run) : undefined;
		if (triggerEl) ro?.observe(triggerEl);
		return () => {
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener('resize', run);
			ro?.disconnect();
		};
	});

	// ── (10) Fullscreen: sync display cho Modal (fullscreen reuse Modal) ──
	// Modal tự quản lý ESC/backdrop/nút close (đổi display→false → onClose gọi configs.close());
	// body scroll lock cũng do Modal đảm nhiệm (counter nested-safe).
	$effect(() => {
		if (fullscreenDerived) {
			fullscreenDisplay = configs.status.open;
			return () => {
				// chọn option / tự đóng / unmount: sync ngược về false — KHÔNG gọi close
				// (configs.close() do Modal.onClose xử lý khi người dùng đóng trực tiếp).
				fullscreenDisplay = false;
			};
		}
	});

	// ── (9) Chip fit: đo width trigger → fit chip (ResizeObserver + rAF) ──
	// Đọc selectedOptionsDerived/removableChipsDerived/chipTruncateLengthDerived TRONG BODY
	// để đăng ký dependency (read trong rAF không được track) → re-measure khi value đổi.
	$effect(() => {
		if (!browser || !showChipsEnabledDerived) return;
		// Đọc để đăng ký dep (rAF không track)
		void selectedOptionsDerived;
		void removableChipsDerived;
		void chipTruncateLengthDerived;
		const ro =
			'ResizeObserver' in window ? new ResizeObserver(() => measureChipsFit()) : undefined;
		let raf = 0;
		const run = () => {
			raf = requestAnimationFrame(measureChipsFit);
		};
		run();
		if (triggerEl) ro?.observe(triggerEl);
		window.addEventListener('resize', run);
		return () => {
			if (raf) cancelAnimationFrame(raf);
			ro?.disconnect();
			window.removeEventListener('resize', run);
		};
	});

	// Handle keyboard navigation in dropdown
	let dropdownKeyDownHandler: ((e: KeyboardEvent) => void) | undefined;

	$effect(() => {
		if (!browser) return;

		dropdownKeyDownHandler = (e: KeyboardEvent) => {
			if (!configs.status.open) return;
			const options = configs.visibleOptions;
			const hasCreate = configs.showCreateOption;
			const total = options.length + (hasCreate ? 1 : 0);

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					let nextIndex = configs.status.highlightedIndex + 1;
					while (nextIndex < options.length && options[nextIndex]?.disabled) nextIndex++;
					if (nextIndex < total) configs.highlightOption(nextIndex);
					break;
				case 'ArrowUp':
					e.preventDefault();
					let prevIndex = configs.status.highlightedIndex - 1;
					while (prevIndex >= 0 && options[prevIndex]?.disabled) prevIndex--;
					if (prevIndex >= 0) configs.highlightOption(prevIndex);
					break;
				case 'Enter':
				case ' ':
					e.preventDefault();
					if (configs.status.highlightedIndex === options.length && hasCreate) {
						configs.selectCreateOption();
					} else if (configs.status.highlightedIndex >= 0) {
						const opt = options[configs.status.highlightedIndex];
						if (opt && !opt.disabled) {
							configs.selectOption(opt.value);
						}
					}
					break;
				case 'Escape':
					e.preventDefault();
					configs.close();
					break;
				case 'Tab':
					// Fullscreen: Modal focus-trap (listener trên modal-root) xử lý Tab
					// trước khi bubble tới đây — select KHÔNG đóng ở chế độ fullscreen.
					if (!fullscreenDerived) configs.close();
					break;
			}
		};

		document.addEventListener('keydown', dropdownKeyDownHandler);
		return () => {
			if (dropdownKeyDownHandler) {
				document.removeEventListener('keydown', dropdownKeyDownHandler);
			}
		};
	});

	// Click outside to close — fullscreen: Modal tự quản lý (backdrop/ESC/nút close),
	// panel (Modal) nằm NGOÀI configs.ref nên click trong panel sẽ bị "outside" nhầm.
	$effect(() => {
		if (!browser || fullscreenDerived) return;

		function handleClickOutside(e: MouseEvent) {
			if (configs.status.open && configs.ref && !configs.ref.contains(e.target as Node)) {
				configs.close();
			}
		}

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	});

	// Register with form context
	onMount(() => {
		if (formContext) {
			if (!formContext.childrens) formContext.childrens = new SvelteSet();
			formContext.childrens.add(configs);
		}
	});

	onDestroy(() => {
		if (configs.timeId) {
			for (const id of configs.timeId.values()) clearTimeout(id);
			configs.timeId.clear();
		}
	});

	export { configs };
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	style:--duration={`${configs.duration}ms`}
	style:--max-height={`${configs.maxHeight}px`}
	style:--dd-top={ddMetrics.top !== undefined ? `${ddMetrics.top}px` : undefined}
	style:--dd-width={ddMetrics.width !== undefined ? `${ddMetrics.width}px` : undefined}
	{@attach handleEvents(configs.event)}
>
	<!-- Slot children (vd <Label> bên trong để đồng bộ required/asterisk/màu qua select-context) -->
	{@render children?.()}

	<!-- Trigger Button -->
	<button
		type="button"
		bind:this={triggerEl}
		id={props.name ? `field-${props.name}` : undefined}
		class={configs.trigger.style}
		disabled={configs.disabled}
		aria-haspopup="listbox"
		aria-expanded={configs.status.open}
		aria-disabled={configs.disabled}
		onclick={() => configs.toggleOpen()}
		onfocus={() => configs.focus()}
		onblur={(e) => {
			// Fullscreen: Modal chiếm focus (search input bên trong modal portal, ngoài
			// configs.ref) — đây là hành vi cố ý, KHÔNG đóng; Modal tự quản lý ESC/close.
			if (fullscreenDerived) return;
			// Keep open when focus moves inside the select (search input, option)
			const related = e.relatedTarget as Node | null;
			if (configs.ref && related && configs.ref.contains(related)) return;
			configs.blur();
		}}
		onmouseenter={() => { if (!configs.disabled) configs.status.hover = true; }}
		onmouseleave={() => { configs.status.hover = false; }}
	>
		<span class="select-trigger__value select-chips">
			{#if showChipsEnabledDerived && !chipFit.fallback && selectedOptionsDerived.length}
				{#if chipFit.hiddenCount > 0}
					<Tag
						variant="ghost"
						color="default"
						size="sm"
						label={`+${chipFit.hiddenCount}`}
					/>
				{/if}
				{#each chipFit.visible as opt (opt.value)}
					<Tag
						label={opt.label}
						size="sm"
						color="secondary"
						variant="soft"
						maxChars={chipTruncateLengthDerived}
						removable={removableChipsDerived && !configs.disabled}
						onRemove={() => {
							props.onChipRemove?.(opt.value);
							configs.selectOption(opt.value);
						}}
					/>
				{/each}
			{:else if displayValueDerived}
				<!-- (M2) Rich option: circle avatar + label trong trigger (single
				     có option.image) — reuse .select-option__media/__image -->
				{#if selectedSingleOptionDerived?.image}
					<span class="select-trigger__selected">
						<span class="select-option__media select-trigger__avatar" aria-hidden="true">
							<img
								class="select-option__image"
								src={selectedSingleOptionDerived.image}
								alt=""
								loading="lazy"
							/>
						</span>
						<span class="select-trigger__selected-label">{displayValueDerived}</span>
					</span>
				{:else}
					{displayValueDerived}
				{/if}
			{:else if placeholderDerived}
				<span class="select-placeholder">{placeholderDerived}</span>
			{/if}
		</span>

		{#if configs.loadingIndicator.display}
			<span class="select-spinner" aria-hidden="true"></span>
		{/if}

		<span class="select-trigger__icon" aria-hidden="true">
			<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="6 9 12 15 18 9"></polyline>
			</svg>
		</span>

		{#if configs.clearButton.display}
			<Tooltip size="sm" delay={150}>
				<button
					type="button"
					class={configs.clearButton.style}
					onclick={(e) => { e.stopPropagation(); configs.clear(); }}
					aria-label={clearLabelTextDerived}
				>
					<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
				<Tooltip.Content size="sm" class="select-action-tooltip">
					<Tooltip.Arrow />
					{clearLabelTextDerived}
				</Tooltip.Content>
			</Tooltip>
		{/if}
	</button>

	<!-- (11) Backdrop — mờ + blur vùng nền, click nền để đóng (z=40, dưới panel 50) -->
	{#if configs.status.open && backdropDerived && !fullscreenDerived}
		<div
			class="select-backdrop"
			aria-hidden="true"
			onmousedown={(e) => {
				e.stopPropagation();
				configs.close();
			}}
		></div>
	{/if}

	<!-- Body dropdown dùng chung cho panel thường + Modal fullscreen (reuse Modal) -->
	{#snippet selectBody()}
		{#if configs.searchable}
			<div class="select-search-wrapper">
				<span class="select-search-icon" aria-hidden="true">
					<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8"></circle>
						<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
					</svg>
				</span>
				<input
					type="text"
					bind:this={searchInputEl}
					class={configs.searchInput.style}
					placeholder={searchPlaceholderTextDerived}
					value={configs.status.searchQuery}
					oninput={(e) => configs.setSearchQuery((e.target as HTMLInputElement).value)}
					onfocus={(e) => { e.stopPropagation(); configs.status.focus = true; }}
					onkeydown={(e) => {
						// Edit mode: xử lý Enter/Escape/Tab ở đây
						if (editingValue) {
							if (e.key === 'Enter') {
								e.preventDefault();
								e.stopPropagation();
								configs.confirmEditOption();
								return;
							}
							if (e.key === 'Escape') {
								e.preventDefault();
								e.stopPropagation();
								configs.cancelEditOption();
								return;
							}
						}
						const navKeys = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'];
						if (!navKeys.includes(e.key)) e.stopPropagation();
					}}
					aria-autocomplete="list"
					aria-controls="select-option-list"
				/>
				<!-- (4) Search loading spinner (remote search) -->
				{#if configs.searchLoading.display}
					<span class="select-search-spinner" aria-hidden="true"></span>
				{/if}
				<!-- (8) Clear button trong ô search (hiện khi có query) -->
				{#if configs.searchClear.display}
					<button
						type="button"
						class={configs.searchClear.style}
						onclick={(e) => { e.stopPropagation(); configs.clearSearch(); }}
						aria-label={getText({ en: 'Clear search', vi: 'Xóa tìm kiếm' })}
					>
						<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				{/if}
			</div>
		{/if}

		<!-- (M4) Controls row: select-all + sort-bar CÙNG 1 row (space-between
			 + wrap khi hẹp) — nằm NGOÀI option list để không scroll theo options.
			 Mỗi cụm width fit (M5); elevation nhẹ (M6). -->
		{#if configs.showSelectAll && configs.visibleOptions.length > 0 || configs.showSort}
			<div class="select-controls">
				<!-- (1) Select-all row (multiple) -->
				{#if configs.showSelectAll && configs.visibleOptions.length > 0}
					<div
						class="select-option select-all-row"
						role="checkbox"
						aria-checked={configs.allSelected}
						tabindex="0"
						onclick={() => configs.toggleSelectAll()}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								e.stopPropagation();
								configs.toggleSelectAll();
							}
						}}
					>
						<span class="select-option__checkbox select-all__indicator" aria-hidden="true">
							{#if configs.allSelected || configs.someSelected}
								<svg
									class="select-check-draw"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									{#if configs.allSelected}
										<polyline
											points="4 12 9 17 20 6"
											stroke-linecap="round"
											stroke-linejoin="round"
											pathLength="1"
											class="select-check-draw"
											stroke="currentColor"
											stroke-width="2.5"
										/>
									{:else}
										<!-- indeterminate: gạch ngang -->
										<line
											x1="5" y1="12" x2="19" y2="12"
											stroke-linecap="round"
											stroke="currentColor"
											stroke-width="2.5"
										/>
									{/if}
								</svg>
							{/if}
						</span>
						<span class="select-option__label select-all__label">
							{selectAllLabelDerived}
						</span>
					</div>
				{/if}
				<!-- (2) Sort control (hiện khi showSort): chọn trường + đảo chiều -->
				{#if configs.showSort}
					<div class="select-sort-bar" role="group" aria-label={sortByTextDerived}>
						<span class="select-sort-bar__label">{sortByTextDerived}</span>
						<select
							class="select-sort-bar__select"
							value={sortFieldDerived ?? 'alpha'}
							onchange={(e) => configs.setSortField((e.target as HTMLSelectElement).value as SelectSortField)}
						>
							<option value="alpha">{sortAlphaTextDerived}</option>
							<option value="date">{sortDateTextDerived}</option>
						</select>
						<button
							type="button"
							class="select-sort-bar__direction"
							onclick={(e) => { e.stopPropagation(); configs.toggleSortDirection(); }}
							aria-label={sortDirectionDerived === 'asc' ? sortDescLabelDerived : sortAscLabelDerived}
							title={sortDirectionDerived === 'asc' ? sortDescLabelDerived : sortAscLabelDerived}
						>
							{#if sortDirectionDerived === 'asc'}
								<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="12" y1="19" x2="12" y2="5"></line>
									<polyline points="5 12 12 5 19 12"></polyline>
								</svg>
							{:else}
								<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="12" y1="5" x2="12" y2="19"></line>
									<polyline points="19 12 12 19 5 12"></polyline>
								</svg>
							{/if}
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<div
			bind:this={optionListEl}
			id="select-option-list"
			class={configs.optionList.style}
			role="listbox"
			onscroll={(e) => configs.checkScrollLoad(e.target as HTMLElement)}
		>
			{#if configs.visibleOptions.length === 0 && !configs.showCreateOption}
				<div class="select-no-options">
					{noOptionsTextDerived}
				</div>
			{:else}
				{#each configs.visibleOptions as opt, index (opt.value)}
					{#if opt.group && index === configs.visibleOptions.findIndex(o => o.group === opt.group)}
						<div class={configs.group(opt.group).style.join(' ')}>
							{opt.group}
						</div>
					{/if}
					{#if editingValue === opt.value}
						<!-- (5) Edit option inline: ô input + nút Cancel/Save.
						     Cancel → trả về flow thường khi user không còn muốn sửa
						     (đồng bộ phím Escape). Save → xác nhận (đồng bộ phím Enter).
						     Nút dùng onmousedown (fire TRƯỚC blur của input) để không
						     bị onblur->confirmEditOption chạy trước; ngay khi mousedown
						     set _editBlurGuard=true, blur kế tiếp sẽ bỏ qua confirm. -->
						<div class="select-option editing">
							<input
								type="text"
								bind:this={editInputEl}
								class="select-option__edit-input"
								bind:value={editingLabel}
								onblur={() => {
									if (_editBlurGuard) {
										_editBlurGuard = false;
										return;
									}
									configs.confirmEditOption();
								}}
								onkeydown={(e) => {
									// Chặn key bóng lên document handler (nav/option) khi đang edit
									e.stopPropagation();
									if (e.key === 'Enter') {
										e.preventDefault();
										configs.confirmEditOption();
									} else if (e.key === 'Escape') {
										e.preventDefault();
										configs.cancelEditOption();
									}
								}}
							/>
							<span class="select-option__actions select-option__actions--editing">
								<button
									type="button"
									class="select-option__action select-option__action--cancel"
									onmousedown={(e) => {
										e.stopPropagation();
										_editBlurGuard = true;
										configs.cancelEditOption();
									}}
									aria-label={getText({ en: 'Cancel edit', vi: 'Hủy sửa option' })}
								>
									<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M18 6 6 18M6 6l12 12"></path>
									</svg>
								</button>
								<button
									type="button"
									class="select-option__action select-option__action--save"
									onmousedown={(e) => {
										e.stopPropagation();
										_editBlurGuard = true;
										configs.confirmEditOption();
									}}
									aria-label={getText({ en: 'Save edit', vi: 'Lưu sửa option' })}
								>
									<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"></polyline>
									</svg>
								</button>
							</span>
						</div>
					{:else}
						<div
							class={configs.option(opt, index, isOptionSelected(opt), configs.status.highlightedIndex === index).style.join(' ')}
							{...configs.option(opt, index, isOptionSelected(opt), configs.status.highlightedIndex === index).attrs}
							onclick={() => configs.selectOption(opt.value)}
							onmouseenter={() => configs.highlightOption(index)}
						>
							{#if modeDerived === 'multiple'}
								<span class="select-option__checkbox" aria-hidden="true">
									{#if isOptionSelected(opt)}
										<svg
											class="select-check-draw"
											viewBox="0 0 24 24"
											fill="none"
											xmlns="http://www.w3.org/2000/svg"
										>
											<polyline
												points="4 12 9 17 20 6"
												stroke-linecap="round"
												stroke-linejoin="round"
												pathLength="1"
												class="select-check-draw"
												stroke="currentColor"
												stroke-width="2.5"
											/>
										</svg>
									{/if}
								</span>
							{/if}
							{#if opt.image}
								<span class="select-option__media" aria-hidden="true">
									<img class="select-option__image" src={opt.image} alt="" loading="lazy" />
								</span>
							{/if}
							<span class="select-option__text">
								<span class="select-option__label">
									{#each matchSegments(opt.label, configs.status.searchQuery ?? '') as seg}
										{#if seg.isMatch}
											<mark class="select-option__highlight">{seg.text}</mark>
										{:else}
											{seg.text}
										{/if}
									{/each}
								</span>
								{#if opt.description}
									<span class="select-option__description">
										{#each matchSegments(opt.description, configs.status.searchQuery ?? '') as seg}
											{#if seg.isMatch}
												<mark class="select-option__highlight">{seg.text}</mark>
											{:else}
												{seg.text}
											{/if}
										{/each}
									</span>
								{/if}
							</span>
							<!-- (5) Edit/Delete buttons (hover) — bọc Tooltip để hiện chú thích -->
							<span class="select-option__actions">
								{#if configs.editableOptions}
									<Tooltip size="sm" delay={150}>
										<button
											type="button"
											class="select-option__action select-option__action--edit"
											onclick={(e) => { e.stopPropagation(); configs.startEditOption(opt); }}
											aria-label={getText({ en: 'Edit option', vi: 'Sửa option' })}
										>
											<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
												<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
											</svg>
										</button>
										<Tooltip.Content size="sm">
											<Tooltip.Arrow />
											{getText({ en: 'Edit option', vi: 'Sửa option' })}
										</Tooltip.Content>
									</Tooltip>
								{/if}
								{#if configs.deletableOptions}
									<Tooltip size="sm" delay={150}>
										<button
											type="button"
											class="select-option__action select-option__action--delete"
											onclick={(e) => { e.stopPropagation(); configs.deleteOption(opt.value); }}
											aria-label={getText({ en: 'Delete option', vi: 'Xóa option' })}
										>
											<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<polyline points="3 6 5 6 21 6"></polyline>
												<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
											</svg>
										</button>
										<Tooltip.Content size="sm" class="select-action-tooltip">
											<Tooltip.Arrow />
											{getText({ en: 'Delete option', vi: 'Xóa option' })}
										</Tooltip.Content>
									</Tooltip>
								{/if}
							</span>
						</div>
					{/if}
				{/each}
			{/if}

			{#if configs.showCreateOption}
				<div
					class={createOptionAttrsDerived.style.join(' ')}
					{...createOptionAttrsDerived.attrs}
					onclick={() => configs.selectCreateOption()}
					onmouseenter={() => configs.highlightOption(configs.visibleOptions.length)}
				>
					<span class="select-option__label create-option__label">
						<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="12" y1="5" x2="12" y2="19"></line>
							<line x1="5" y1="12" x2="19" y2="12"></line>
						</svg>
						{configs.createOptionLabel}
					</span>
				</div>
			{/if}

			<!-- (2)+(3) Load-more UI (chỉ hiện khi hasMore — option vượt không gian) -->
			{#if configs.hasMore}
				{#if configs.loadMoreMode === 'button'}
					<button
						type="button"
						class="select-load-more"
						onclick={() => configs.loadMore()}
					>
						{loadMoreLabelDerived}
						<span class="select-load-more__count">
							({configs.visibleOptions.length}/{filteredOptionsDerived.length})
						</span>
					</button>
				{:else if configs.loadMoreMode === 'pagination'}
					<div class="select-pagination">
						<button
							type="button"
							class="select-pagination__btn"
							disabled={configs.currentPage <= 1}
							onclick={() => configs.prevPage()}
							aria-label={getText({ en: 'Previous page', vi: 'Trang trước' })}
						>
							<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="15 18 9 12 15 6"></polyline>
							</svg>
						</button>
						<span class="select-pagination__info">
							{configs.currentPage}/{configs.totalPages}
						</span>
						<button
							type="button"
							class="select-pagination__btn"
							disabled={configs.currentPage >= configs.totalPages}
							onclick={() => configs.nextPage()}
							aria-label={getText({ en: 'Next page', vi: 'Trang sau' })}
						>
							<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="9 18 15 12 9 6"></polyline>
							</svg>
						</button>
					</div>
				{:else}
					<!-- mode 'scroll': hint load-more ở đáy -->
					<div class="select-load-more-hint" aria-hidden="true">
						{#if _searchLoading}
							<span class="select-search-spinner"></span>
						{:else}
							<span>{loadMoreLabelDerived}…</span>
						{/if}
					</div>
				{/if}
			{/if}
			</div>
		{/snippet}


	<!-- (10) Fullscreen: reuse Modal (focus trap, ARIA, scroll lock, ESC, nút close Button đồng bộ) -->
	{#if fullscreenDerived && fullscreenDisplay}
		<Modal
			size="full"
			variant="opaque"
			transitionType="none"
			initialFocus={configs.searchable ? '.select-search-input' : undefined}
			onClose={() => configs.close()}
			bind:display={fullscreenDisplay}
		>
			<Modal.Container>
				<Modal.Container.Header>{fullscreenTitleDerived}</Modal.Container.Header>
				<Modal.Container.Body class="select-fullscreen-body">
					{@render selectBody()}
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>
	{/if}
	<!-- Dropdown (thường) — fullscreen chuyển sang Modal bên dưới -->
	{#if configs.status.open && !fullscreenDerived}
		<div
			bind:this={dropdownEl}
			class={configs.dropdown.style}
			role="listbox"
			aria-label="Select options"
			style:max-height={`${ (configs.status.placement === 'left' || configs.status.placement === 'right') &&
				ddMetrics.maxHeight
					? ddMetrics.maxHeight
					: configs.maxHeight
			}px`}
		>
			{@render selectBody()}
		</div>
	{/if}
</svelte:element>

<style lang="scss">
	@use './styles.scss';
</style>
