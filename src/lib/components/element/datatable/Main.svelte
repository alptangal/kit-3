<script lang="ts">
	// src/lib/components/element/datatable/Main.svelte
	// DataTable (Root) — data-driven table: sort + filter (search) + pagination +
	// row selection + density + empty/loading state. Source-of-truth = $state
	// (không dùng writable store của table v1). Sub (Head/Body/Pagination) đọc
	// shared state qua Symbol context (_context.ts).
	//
	// Pipeline derived: data → filter(query) → sort(activeSort/order) →
	// paginate(safePage/pageSize). Sort/pageSize change reset page=1.
	//
	// A11y (CONTRACT §6): table + caption, th scope="col" + aria-sort,
	// search input aria-label, pagination prev/next aria-label.
	import { SvelteSet } from 'svelte/reactivity';
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { queryMatchesText } from '$modules/highlight';
	import { client } from '$store/basic.svelte';
	import { setDataTableContext } from './_context';
	import Head from './Head.svelte';
	import Body from './Body.svelte';
	import Pagination from './Pagination.svelte';
	import type {
		DataTableColumn,
		DataTableConfigs,
		DataTableDensity,
		DataTableRootProps,
		DataTableSortOrder
	} from './_interface';
	import type { Size } from '$components/interface';
	import type { TranslateContent } from '$interfaces/basic';

	let {
		data = $bindable<Record<string, unknown>[] | undefined>(undefined),
		columns: columnsProp,
		caption,
		pageSize: pageSizeProp,
		sortable,
		selectable,
		searchable,
		searchPlaceholder,
		pageSizeOptions: pageSizeOptionsProp,
		showPagination,
		density: densityProp,
		variant,
		page = $bindable<number>(1),
		searchLabel,
		clearFilterLabel,
		resultsLabel,
		emptyLabel,
		loadingLabel,
		loading,
		selectAllLabel,
		rowSelectLabel,
		pageSizeLabel,
		previousLabel,
		nextLabel,
		getRowId,
		onSortChange,
		onPageChange,
		onPageSizeChange,
		onSelectionChange,
		onRowClick,
		size,
		'aria-label': ariaLabel,
		class: classProp,
		events,
		overwriteDefaultStyles,
		...props
	}: DataTableRootProps<Record<string, unknown>> = $props();

	const rows: Record<string, unknown>[] = $derived(data ?? []);
	const columns: DataTableColumn<Record<string, unknown>>[] = $derived(columnsProp ?? []);
	const resolvedSize: Size = $derived(size ?? client.browser?.size ?? 'md');
	const density: DataTableDensity = $derived(densityProp ?? variant ?? 'default');

	// Resolve TranslateContent | string theo language (fallback en → vi)
	const getText = (content?: TranslateContent | string, fallback?: { en: string; vi: string }): string => {
		const lang = client.browser?.language ?? 'en';
		const fb = (key: string): string => (fallback ? ((fallback as Record<string, string>)[key] ?? '') : '');
		if (!content) return fb(lang);
		if (typeof content === 'string') return content;
		return content[lang] ?? content.en ?? content.vi ?? fb(lang);
	};

	// ── STATE (source of truth) ──
	let query = $state('');
	let activeSort: string | undefined = $state(undefined);
	let sortOrder: DataTableSortOrder = $state('asc');
	// page là bindable prop (source of truth), không phải $state riêng.
	// pageSize: prop chỉ là giá trị khởi đầu; select page-size ghi vào state nội bộ.
	let pageSizeState = $state<number | undefined>(undefined);
	const pageSize: number = $derived(pageSizeState ?? pageSizeProp ?? 10);
	const pageSizeOptions: number[] = $derived(pageSizeOptionsProp ?? [5, 10, 20]);
	const selected = new SvelteSet<string>();

	// row id theo getRowId (default: index)
	const idOf = (row: Record<string, unknown>, index: number): string =>
		(getRowId?.(row as never, index) ?? String(index));

	// Lấy value cell theo accessor (key name | function)
	const getCellValue = (row: Record<string, unknown>, col: DataTableColumn<Record<string, unknown>>): unknown => {
		const a = col.accessor;
		if (typeof a === 'function') return (a as (r: Record<string, unknown>) => unknown)(row);
		return row[a as string];
	};

	// So sánh 2 value accessor (số theo giá trị, còn lại String). undefined → cuối.
	const compareValues = (av: unknown, bv: unknown): number => {
		if (av == null && bv == null) return 0;
		if (av == null) return 1;
		if (bv == null) return -1;
		if (typeof av === 'number' && typeof bv === 'number') return av - bv;
		const s = String(av).localeCompare(String(bv), undefined, { numeric: true });
		return s;
	};

	// ── PIPELINE derived ──
	// 1) index hóa data (giữ index gốc cho getRowId/rowSelectLabel/onRowClick)
	const indexed: { row: Record<string, unknown>; index: number }[] = $derived(
		rows.map((row, index) => ({ row, index }))
	);
	// 2) filter (search, case-insensitive + nhạy dấu, mọi cột filterable)
	const filtered: { row: Record<string, unknown>; index: number }[] = $derived.by(() => {
		const q = query.trim();
		if (!q) return indexed;
		return indexed.filter(({ row }) => {
			for (const col of columns) {
				if (col.filterable === false) continue;
				const val = getCellValue(row, col);
				if (val == null) continue;
				if (queryMatchesText(String(val), q)) return true;
			}
			return false;
		});
	});
	// 3) sort (bảo toàn index gốc)
	const sorted: { row: Record<string, unknown>; index: number }[] = $derived.by(() => {
		if (!activeSort) return filtered;
		const col = columns.find((c) => c.id === activeSort);
		if (!col) return filtered;
		const dir = sortOrder === 'asc' ? 1 : -1;
		return [...filtered].sort((a, b) => {
			const av = getCellValue(a.row, col);
			const bv = getCellValue(b.row, col);
			return compareValues(av, bv) * dir;
		});
	});
	// 4) paginate
	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / pageSize)));
	const safePage = $derived(Math.min(Math.max(1, page), totalPages));
	const pageRows: { row: Record<string, unknown>; index: number }[] = $derived(
		sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
	);

	// page vọt quá totalPages (vd data giảm) → clamp state để debug/bind đúng.
	$effect(() => {
		if (page > totalPages) page = totalPages;
	});

	// ── ACTIONS (gọi từ sub qua context) ──
	const toggleSort = (columnId: string): void => {
		if (activeSort === columnId) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			activeSort = columnId;
			sortOrder = 'asc';
		}
		page = 1; // reset page khi đổi sort (kế thừa table v1)
		onSortChange?.(columnId, sortOrder);
	};

	const goToPage = (p: number): void => {
		const next = Math.min(Math.max(1, p), totalPages);
		if (next === page) return;
		page = next;
		onPageChange?.(next);
	};

	const changePageSize = (size: number): void => {
		if (size === pageSize || size < 1) return;
		pageSizeState = size; // ghi state nội bộ (select đọc giá trị này)
		page = 1; // reset page khi đổi page size
		onPageSizeChange?.(size);
	};

	const isSelected = (id: string): boolean => selected.has(id);

	const toggleRow = (id: string): void => {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
		onSelectionChange?.([...selected]);
	};

	const togglePageSelection = (): void => {
		const ids = pageRows.map(({ row, index }) => idOf(row, index));
		if (ids.length === 0) return;
		const allSelected = ids.every((id) => selected.has(id));
		for (const id of ids) {
			if (allSelected) selected.delete(id);
			else selected.add(id);
		}
		onSelectionChange?.([...selected]);
	};

	const handleRowClick = (row: Record<string, unknown>, index: number): void => {
		onRowClick?.(row as never, idOf(row, index));
	};

	// ── LABELS (i18n, template {n}/{page}/{index} thay ở nơi dùng) ──
	const captionText = $derived(getText(caption, { en: 'Data table', vi: 'Bảng dữ liệu' }));
	const searchPlaceholderText = $derived(getText(searchPlaceholder, { en: 'Search…', vi: 'Tìm kiếm…' }));
	const searchText = $derived(getText(searchLabel, { en: 'Search', vi: 'Tìm kiếm' }));
	const clearText = $derived(getText(clearFilterLabel, { en: 'Clear search', vi: 'Xóa tìm kiếm' }));
	const resultsTemplate = $derived(getText(resultsLabel, { en: '{n} results', vi: '{n} kết quả' }));
	const emptyText = $derived(getText(emptyLabel, { en: 'No data', vi: 'Không có dữ liệu' }));
	const loadingText = $derived(getText(loadingLabel, { en: 'Loading…', vi: 'Đang tải…' }));
	const selectAllText = $derived(getText(selectAllLabel, { en: 'Select all rows on this page', vi: 'Chọn tất cả row trên trang này' }));
	const rowSelectTemplate = $derived(getText(rowSelectLabel, { en: 'Select row {index}', vi: 'Chọn row {index}' }));
	const pageSizeLabelText = $derived(getText(pageSizeLabel, { en: 'Rows per page', vi: 'Số row mỗi trang' }));
	const previousText = $derived(getText(previousLabel, { en: 'Previous', vi: 'Trước' }));
	const nextText = $derived(getText(nextLabel, { en: 'Next', vi: 'Sau' }));
	const pageInfoTemplate = $derived(getText(undefined, { en: 'Page {page} of {total}', vi: 'Trang {page} / {total}' }));

	const resultsText = $derived(resultsTemplate.replace('{n}', String(filtered.length)));
	const showSearch = $derived(!!searchable);
	const selectableDerived = $derived(!!selectable);
	const sortableDerived = $derived(!!sortable);
	const showPaginationDerived = $derived(showPagination ?? true);
	const loadingDerived = $derived(!!loading);

	// ── CONFIGS (đổ style + labels cho root) ──
	let configs: DataTableConfigs = $state({
		get size() {
			return resolvedSize;
		},
		get density() {
			return density;
		},
		get loading() {
			return loadingDerived;
		},
		get selectable() {
			return selectableDerived;
		},
		get sortable() {
			return sortableDerived;
		},
		get captionText() {
			return captionText;
		},
		get searchPlaceholderText() {
			return searchPlaceholderText;
		},
		get searchText() {
			return searchText;
		},
		get clearText() {
			return clearText;
		},
		get resultsText() {
			return resultsText;
		},
		get emptyText() {
			return emptyText;
		},
		get loadingText() {
			return loadingText;
		},
		get selectAllText() {
			return selectAllText;
		},
		get rowSelectText() {
			return rowSelectTemplate;
		},
		get pageSizeLabelText() {
			return pageSizeLabelText;
		},
		get previousText() {
			return previousText;
		},
		get nextText() {
			return nextText;
		},
		get pageInfoText() {
			return pageInfoTemplate;
		},
		get event() {
			return events ?? [];
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'datatable-root',
				`size-${this.size}`,
				`density-${this.density}`,
				this.loading ? 'is-loading' : undefined,
				this.selectable ? 'has-selection' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: classProp }, overwriteDefaultStyles);
		}
	});

	// ── SHARED STATE (root → sub) ──
	const shared = {
		configs,
		get pageRows() {
			return pageRows;
		},
		get columns() {
			return columns;
		},
		get query() {
			return query;
		},
		get filteredCount() {
			return filtered.length;
		},
		get page() {
			return safePage;
		},
		get totalPages() {
			return totalPages;
		},
		get pageSize() {
			return pageSize;
		},
		get pageSizeOptions() {
			return pageSizeOptions;
		},
		get activeSort() {
			return activeSort;
		},
		get sortOrder() {
			return sortOrder;
		},
		get allPageSelected() {
			const ids = pageRows.map(({ row, index }) => idOf(row, index));
			return ids.length > 0 && ids.every((id) => selected.has(id));
		},
		getCellValue,
		getRowId: idOf,
		isSelected,
		toggleRow,
		togglePageSelection,
		toggleSort,
		goToPage,
		changePageSize,
		handleRowClick
	};
	setDataTableContext(shared);

	export { configs };
</script>

<div class={configs.style} {...props} {@attach handleEvents(configs.event)}>
	{#if showSearch}
		<div class="datatable-toolbar">
			<div class="datatable-search-wrap">
				<input
					class="datatable-search"
					type="search"
					role="searchbox"
					aria-label={configs.searchText}
					placeholder={configs.searchPlaceholderText}
					value={query}
					oninput={(e) => (query = (e.target as HTMLInputElement).value)}
				/>
				{#if query}
					<button
						type="button"
						class="datatable-search-clear"
						aria-label={configs.clearText}
						onclick={() => (query = '')}
					>
						<span aria-hidden="true">✕</span>
					</button>
				{/if}
			</div>
			<span class="datatable-results" data-role="results">{configs.resultsText}</span>
		</div>
	{/if}

	<div class="datatable-table-wrap">
		<table class="datatable" aria-label={ariaLabel ?? undefined}>
			<caption class="datatable-caption">{configs.captionText}</caption>
			<Head />
			<Body />
		</table>
	</div>

	{#if showPaginationDerived}
		<Pagination />
	{/if}
</div>

<style lang="scss">
	@use '_styles.scss' as dt;

	.datatable-root {
		@include dt.cell-tokens;

		position: relative;
		display: block;
		width: 100%;
		font-size: var(--font-size, 1rem);
		line-height: var(--line-height, 1.5);
		background: var(--content1, #fff);
		color: var(--content1-foreground, #18181b);
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		border-radius: var(--border-radius-md, var(--radius, 0.5rem));
		overflow: hidden;
	}

	.datatable-table-wrap {
		width: 100%;
		overflow-x: auto;
	}

	.datatable {
		width: 100%;
		border-collapse: collapse;
		table-layout: auto;
	}

	.datatable-caption {
		caption-side: top;
		padding: var(--cell-pad-y, 0.75rem) var(--cell-pad-x, 0.75rem);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--muted, #71717a);
		text-align: left;
	}

	// ── Toolbar (search + results) ──
	.datatable-toolbar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		padding: var(--cell-pad-y, 0.75rem) var(--cell-pad-x, 0.75rem);
		border-bottom: 1px solid var(--content3, hsl(240 5.88% 90%));
	}

	.datatable-search-wrap {
		position: relative;
		flex: 1;
		min-width: 200px;
	}

	.datatable-search {
		width: 100%;
		height: 2.25rem;
		padding: 0 2rem 0 0.75rem;
		font: inherit;
		color: var(--content1-foreground, #18181b);
		background: var(--content1, #fff);
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		border-radius: var(--border-radius-sm, 0.375rem);
		&::placeholder {
			color: var(--muted, #71717a);
			opacity: 0.9;
		}
		&::-webkit-search-cancel-button {
			display: none;
		}
		@include dt.focus-ring;
	}

	.datatable-search-clear {
		position: absolute;
		top: 50%;
		right: 0.4rem;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		font-size: 0.75rem;
		color: var(--muted, #71717a);
		background: transparent;
		border: 0;
		border-radius: 50%;
		cursor: var(--cursor-interactive);
		@media (hover: hover) and (pointer: fine) {
			&:hover {
				background: var(--content2, hsl(240 4.76% 95.88%));
				color: var(--content1-foreground, #18181b);
			}
		}
		@include dt.focus-ring;
	}

	.datatable-results {
		margin-left: auto;
		font-size: 0.8125rem;
		color: var(--muted, #71717a);
		white-space: nowrap;
	}

	// ── Density: compact thu hẹp padding cell (set var trên root) ──
	.datatable-root {
		&.density-default {
			--cell-pad-y: 0.75rem;
			--cell-pad-x: 0.75rem;
		}
		&.density-compact {
			--cell-pad-y: 0.4rem;
			--cell-pad-x: 0.6rem;
		}
	}
</style>
