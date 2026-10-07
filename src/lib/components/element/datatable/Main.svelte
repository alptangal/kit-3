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
	import { AlertDialog } from '../alert-dialog/index.ts';
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
		rowActions,
		editable,
		lazyLoad: lazyLoadProp,
		visual,
		creatable,
		exportable,
		onRowCreate,
		onRowClone,
		onCopy,
		onImport,
		onCellUpdate,
		onRowUpdate,
		onRowDelete,
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
	const isMobile: boolean = $derived(client.browser?.isMobile ?? false);

	// Visual (zebra/hover/border) — truyền boolean cũng được (chỉ zebra).
	const striped: boolean = $derived(typeof visual === 'boolean' ? visual : (visual?.striped ?? false));
	const hoverable: boolean = $derived(typeof visual === 'boolean' ? visual : (visual?.hoverable ?? false));
	const bordered: boolean = $derived(typeof visual === 'object' && visual !== null ? (visual.bordered ?? false) : false);

	// Editable: boolean | object → { enabled, columns, labels }.
	const editableCfg = $derived.by(() => {
		const noLabel = {
			cellLabel: undefined as TranslateContent | string | undefined,
			confirmLabel: undefined as TranslateContent | string | undefined,
			cancelLabel: undefined as TranslateContent | string | undefined
		};
		if (editable === true) return { enabled: true, columns: undefined as string[] | undefined, ...noLabel };
		if (typeof editable === 'object' && editable !== null) {
			return {
				enabled: editable.enabled ?? true,
				columns: editable.columns,
				cellLabel: editable.cellLabel,
				confirmLabel: editable.confirmLabel,
				cancelLabel: editable.cancelLabel
			};
		}
		return { enabled: false, columns: undefined as string[] | undefined, ...noLabel };
	});
	const editableDerived: boolean = $derived(editableCfg.enabled);
	const rowActionsDerived: boolean = $derived(!!rowActions);

	// Lazy load config.
	const lazyLoadEnabled: boolean = $derived(!!lazyLoadProp?.enabled);
	const lazyHasMoreProp: boolean | undefined = $derived(lazyLoadProp?.hasMore);
	const lazyOnLoadMore = $derived(lazyLoadProp?.onLoadMore);
	// Nút load more (mặc định true; false = chỉ infinite scroll).
	const lazyShowButton: boolean = $derived(lazyLoadProp?.loadMoreButton ?? true);

	// ── Creatable / Exportable config (wave 7) ──
	const creatableCfg = $derived.by(() => {
		if (creatable === true) return { enabled: true, label: undefined as TranslateContent | string | undefined };
		if (typeof creatable === 'object' && creatable !== null) {
			return { enabled: creatable.enabled ?? true, label: creatable.label };
		}
		return { enabled: false, label: undefined as TranslateContent | string | undefined };
	});
	const creatableDerived: boolean = $derived(creatableCfg.enabled);

	const exportCfg = $derived.by(() => {
		if (exportable === true) {
			return {
				enabled: true,
				formats: undefined as ('csv' | 'json')[] | undefined,
				import: false,
				exportLabel: undefined as TranslateContent | string | undefined,
				importLabel: undefined as TranslateContent | string | undefined
			};
		}
		if (typeof exportable === 'object' && exportable !== null) {
			return {
				enabled: exportable.enabled ?? true,
				formats: exportable.formats,
				import: exportable.import ?? false,
				exportLabel: exportable.exportLabel,
				importLabel: exportable.importLabel
			};
		}
		return {
			enabled: false,
			formats: undefined as ('csv' | 'json')[] | undefined,
			import: false,
			exportLabel: undefined as TranslateContent | string | undefined,
			importLabel: undefined as TranslateContent | string | undefined
		};
	});
	const exportableDerived: boolean = $derived(exportCfg.enabled);
	const exportFormats: ('csv' | 'json')[] = $derived(
		exportCfg.formats && exportCfg.formats.length > 0 ? exportCfg.formats : ['csv']
	);
	const importableDerived: boolean = $derived(exportCfg.enabled && exportCfg.import);
	// Copy row(s) luôn có (toolbar selection tools + row action) — toggle qua
	// config `exportable`/`rowActions`; toolbar copy-selected dùng biến này.
	const copyableDerived: boolean = $derived(true);

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

	// ── STATE edit cell / delete confirm / row actions / lazy load ──
	// editCell: {rowId, columnId, value} — value 2-way với input editor.
	let editCell: { rowId: string; columnId: string; value: string } | undefined = $state(undefined);
	// rowEdit: chế độ sửa CẢ ROW (PC nút ✎ / mobile nút Update) — values theo columnId.
	let rowEdit: { rowId: string; values: Record<string, string> } | undefined = $state(undefined);
	// deleteRowId: row đang đợi confirm delete (AlertDialog đọc qua state này).
	let deleteRowId: string | undefined = $state(undefined);
	// deleteOpen: dialog confirm delete đang mở (bind:open cho AlertDialog —
	// Escape/Cancel đóng qua bind, requestDeleteRow mở bằng code).
	let deleteOpen: boolean = $state(false);
	// expandedRowId: row đang mở action bar mobile (tap row → expand).
	let expandedRowId: string | undefined = $state(undefined);
	// loadingMore: lazy load đang fetch.
	let loadingMore: boolean = $state(false);
	// hasMoreLazy: còn data để load (prop override, hoặc tự đo bằng lần load trước).
	let hasMoreLazyState = $state<boolean | undefined>(undefined);

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
	// 4) paginate — lazyLoad enabled: hiển thị TẤT CẢ row đã load (infinite
	// scroll thêm data vào cùng danh sách; nếu giữ pageSize thì row mới rơi
	// vào trang sau và user không bao giờ thấy khi cuộn).
	const effectivePageSize: number = $derived(
		lazyLoadEnabled ? Math.max(1, filtered.length || pageSize) : pageSize
	);
	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / effectivePageSize)));
	const safePage = $derived(Math.min(Math.max(1, page), totalPages));
	const pageRows: { row: Record<string, unknown>; index: number }[] = $derived(
		sorted.slice((safePage - 1) * effectivePageSize, safePage * effectivePageSize)
	);

	// page vọt quá totalPages (vd data giảm) → clamp state để debug/bind đúng.
	$effect(() => {
		if (page > totalPages) page = totalPages;
	});

	// Data thay đổi → đóng edit cell đang mở nếu row/column bị xóa (không mất
	// state khi chỉ update giá trị — rowId còn tồn tại trong data).
	$effect(() => {
		if (!editCell) return;
		const exists = rows.some((row, index) => idOf(row, index) === editCell?.rowId);
		if (!exists) editCell = undefined;
	});
	$effect(() => {
		if (!rowEdit) return;
		const exists = rows.some((row, index) => idOf(row, index) === rowEdit?.rowId);
		if (!exists) rowEdit = undefined;
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

	// ── ACTIONS edit cell / delete / row actions / lazy load ──
	const isEditing = (rowId: string, columnId: string): boolean =>
		editCell?.rowId === rowId && editCell?.columnId === columnId;

	const openCellEditor = (rowId: string, columnId: string, value: unknown): void => {
		// Chỉ 1 editor mở tại 1 thời điểm (click cell khác → chuyển editor).
		editCell = { rowId, columnId, value: value == null ? '' : String(value) };
	};

	const setEditValue = (value: string): void => {
		if (editCell) editCell.value = value;
	};

	const getEditValue = (): string | undefined => editCell?.value;

	const confirmCellEditor = (): void => {
		if (!editCell) return;
		const { rowId, columnId, value } = editCell;
		// Tìm row + column thật để gọi callback (oldValue từ accessor).
		const indexedRow = rows.find((row, index) => idOf(row, index) === rowId);
		const col = columns.find((c) => c.id === columnId);
		if (indexedRow && col) {
			const oldValue = getCellValue(indexedRow, col);
			// Coerce về kiểu accessor (số → number) — tránh "5" !== 5 khi so sánh.
			let newValue: unknown = value;
			if (typeof oldValue === 'number' && value.trim() !== '' && !Number.isNaN(Number(value))) {
				newValue = Number(value);
			}
			if (newValue !== oldValue) {
				// Promise<void> cho phép user async save — không await (không block UI).
				onCellUpdate?.(indexedRow as never, columnId, oldValue, newValue);
				// Ghi trực tiếp vào data array ($state deep proxy — table re-render).
				if (typeof col.accessor === 'string') {
					(indexedRow as Record<string, unknown>)[col.accessor] = newValue;
				}
			}
		}
		editCell = undefined;
	};

	const cancelCellEditor = (): void => {
		editCell = undefined;
	};

	// ── ROW EDIT (sửa cả row — PC nút ✎ / mobile nút Update) ──
	const isRowEditing = (rowId: string): boolean => rowEdit?.rowId === rowId;

	const openRowEditor = (rowId: string): void => {
		const found = findRowById(rowId);
		if (!found) return;
		const values: Record<string, string> = {};
		for (const col of columns) {
			if (col.status || col.render) continue; // cột pill/render không edit trực tiếp
			const v = getCellValue(found.row, col);
			values[col.id] = v == null ? '' : String(v);
		}
		rowEdit = { rowId, values };
		// Đóng cell editor nếu đang mở (chỉ 1 chế độ edit tại 1 thời điểm).
		editCell = undefined;
	};

	const closeRowEditor = (commit: boolean): void => {
		if (!rowEdit) return;
		const { rowId, values } = rowEdit;
		if (commit) {
			const found = findRowById(rowId);
			if (found) {
				for (const col of columns) {
					if (!(col.id in values)) continue;
					if (col.status || col.render) continue;
					const oldValue = getCellValue(found.row, col);
					let newValue: unknown = values[col.id];
					if (typeof oldValue === 'number' && String(newValue).trim() !== '' && !Number.isNaN(Number(newValue))) {
						newValue = Number(newValue);
					}
					if (newValue !== oldValue) {
						onCellUpdate?.(found.row as never, col.id, oldValue, newValue);
						if (typeof col.accessor === 'string') {
							(found.row as Record<string, unknown>)[col.accessor] = newValue;
						}
					}
				}
				onRowUpdate?.(found.row as never, rowId);
			}
		}
		rowEdit = undefined;
	};

	const getRowEditValue = (rowId: string, columnId: string): string | undefined =>
		rowEdit?.rowId === rowId ? (rowEdit.values[columnId] ?? '') : undefined;

	const setRowEditValue = (rowId: string, columnId: string, value: string): void => {
		if (rowEdit?.rowId === rowId) rowEdit.values[columnId] = value;
	};

	const requestDeleteRow = (rowId: string): void => {
		deleteRowId = rowId;
		deleteOpen = true;
	};

	const isDeletePending = (rowId: string): boolean => deleteRowId === rowId && deleteOpen;

	const findRowById = (rowId: string): { row: Record<string, unknown>; index: number } | undefined => {
		const idx = rows.findIndex((row, index) => idOf(row, index) === rowId);
		return idx === -1 ? undefined : { row: rows[idx], index: idx };
	};

	// Xác nhận delete (AlertDialog Action) → gọi onRowDelete + xóa khỏi data
	// ($state deep proxy — splice re-render). Row bị xóa → đóng edit/actions.
	const confirmDeleteRow = (): void => {
		if (!deleteRowId) return;
		const found = findRowById(deleteRowId);
		if (found) {
			onRowDelete?.(found.row as never, deleteRowId);
			rows.splice(found.index, 1);
		}
		deleteRowId = undefined;
		deleteOpen = false;
		if (expandedRowId) expandedRowId = undefined;
	};

	const toggleRowActions = (rowId: string): void => {
		expandedRowId = expandedRowId === rowId ? undefined : rowId;
	};

	const isRowExpanded = (rowId: string): boolean => expandedRowId === rowId;

	const handleRowUpdate = (row: Record<string, unknown>, rowId: string): void => {
		// Mở row editor (PC nút ✎ / mobile nút Update → sửa cả row).
		openRowEditor(rowId);
	};

	const handleRowDeleteDirect = (row: Record<string, unknown>, rowId: string): void => {
		const found = findRowById(rowId);
		if (found) {
			onRowDelete?.(row as never, rowId);
			rows.splice(found.index, 1);
		}
		if (expandedRowId === rowId) expandedRowId = undefined;
	};

	// ── CREATE ROW (wave 7 — nút create: toolbar + empty + no-results) ──
	// Placeholder row rỗng theo columns (accessor key → '') — id mới tăng dần.
	let createCounter = $state<number>(0);
	const createRow = (): void => {
		createCounter += 1;
		const newRow: Record<string, unknown> = {};
		for (const col of columns) {
			if (typeof col.accessor === 'string') newRow[col.accessor] = '';
		}
		const rowId = `__new-${createCounter}`;
		// Create từ no-results/empty: xóa search đang lọc (row mới rỗng không
		// khớp query → mất dấu ngay sau khi tạo).
		if (query) query = '';
		rows.push(newRow);
		onRowCreate?.(newRow as never, rowId);
		// Nhảy trang tới vị trí row mới: tìm trong `sorted` (TRƯỚC paginate —
		// pageRows chỉ chứa row trang hiện tại, row mới ở trang sau → không
		// thấy). So qua rowId (reference khác bản local do $state deep proxy).
		const newRowId = idOf(newRow, rows.length - 1);
		const sortedIdx = sorted.findIndex(({ row, index }) => idOf(row, index) === newRowId);
		if (sortedIdx >= 0) {
			const targetPage = Math.floor(sortedIdx / effectivePageSize) + 1;
			if (targetPage !== page) page = targetPage;
		}
		// Mở row editor cho row mới ngay (điền giá trị).
		openRowEditor(idOf(newRow, rows.length - 1));
	};

	// ── COPY ROW(S) (TSV — header col khi nhiều row; paste vào Excel được) ──
	const rowToText = (row: Record<string, unknown>): string =>
		columns.map((col) => String(getCellValue(row, col) ?? '')).join('\t');

	const writeClipboard = (text: string): void => {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(text).catch(() => {});
		}
		onCopy?.(text);
	};

	const copyRow = (rowId: string): void => {
		const found = findRowById(rowId);
		if (found) writeClipboard(rowToText(found.row));
	};

	const copySelected = (): void => {
		const selectedRows = pageRows.filter(({ row, index }) => selected.has(idOf(row, index)));
		if (selectedRows.length === 0) return;
		const header = columns.map((col) => col.label).join('\t');
		const body = selectedRows.map(({ row }) => rowToText(row)).join('\n');
		writeClipboard(selectedRows.length > 1 ? `${header}\n${body}` : body);
	};

	// ── CLONE ROW (thêm bản sao ngay dưới row gốc — id mới) ──
	const cloneRow = (rowId: string): void => {
		const found = findRowById(rowId);
		if (!found) return;
		const clone: Record<string, unknown> = { ...found.row };
		// id mới (tránh trùng getRowId) + đánh dấu row clone.
		if ('id' in clone) clone.id = `${String(clone.id)}-copy-${Date.now()}`;
		clone.__cloned = true;
		rows.splice(found.index + 1, 0, clone);
		onRowClone?.(found.row as never, clone as never);
	};

	// ── EXPORT (CSV/JSON — data ĐÃ FILTER, không phải toàn bộ data) ──
	const exportData = (format: 'csv' | 'json'): void => {
		const rowsOut = sorted.map(({ row }) => {
			const out: Record<string, unknown> = {};
			for (const col of columns) {
				if (typeof col.accessor === 'string') out[col.accessor] = getCellValue(row, col);
			}
			return out;
		});
		let content = '';
		let mime = 'text/csv';
		let ext = 'csv';
		if (format === 'json') {
			content = JSON.stringify(rowsOut, null, 2);
			mime = 'application/json';
			ext = 'json';
		} else {
			const header = columns
				.filter((col) => typeof col.accessor === 'string')
				.map((col) => `"${col.label.replace(/"/g, '""')}"`)
				.join(',');
			const body = rowsOut
				.map((r) =>
					columns
						.filter((col) => typeof col.accessor === 'string')
						.map((col) => {
							const v = r[col.accessor as string];
							return `"${String(v ?? '').replace(/"/g, '""')}"`;
						})
						.join(',')
				)
				.join('\n');
			content = `${header}\n${body}`;
		}
		if (typeof document === 'undefined') return;
		const blob = new Blob([`﻿${content}`], { type: `${mime};charset=utf-8` });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `datatable-export.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
	};

	// ── IMPORT (file CSV/JSON → parse → onImport) ──
	const importData = (file: File): void => {
		if (typeof FileReader === 'undefined') return;
		const reader = new FileReader();
		reader.onload = () => {
			const text = String(reader.result ?? '');
			try {
				if (file.name.toLowerCase().endsWith('.json')) {
					const parsed = JSON.parse(text);
					if (Array.isArray(parsed)) onImport?.(parsed as Record<string, unknown>[]);
				} else {
					// CSV đơn giản: dòng đầu = header, giá trị trong "..." ("" = escape).
					const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
					if (lines.length < 2) return;
					const parseLine = (line: string): string[] => {
						const cells: string[] = [];
						let cur = '';
						let inQuotes = false;
						for (let i = 0; i < line.length; i++) {
							const ch = line[i];
							if (inQuotes) {
								if (ch === '"' && line[i + 1] === '"') {
									cur += '"';
									i++;
								} else if (ch === '"') {
									inQuotes = false;
								} else {
									cur += ch;
								}
							} else if (ch === '"') {
								inQuotes = true;
							} else if (ch === ',') {
								cells.push(cur);
								cur = '';
							} else {
								cur += ch;
							}
						}
						cells.push(cur);
						return cells;
					};
					const headers = parseLine(lines[0]);
					const out = lines.slice(1).map((line) => {
						const cells = parseLine(line);
						const obj: Record<string, unknown> = {};
						headers.forEach((h, i) => {
							obj[h] = cells[i] ?? '';
						});
						return obj;
					});
					onImport?.(out);
				}
			} catch {
				// file lỗi định dạng → bỏ qua (user tự xử lý qua onImport không gọi).
			}
		};
		reader.readAsText(file);
	};

	// ── SELECTION TOOLS (toolbar: delete-selected + clear-selection) ──
	const deleteSelected = (): void => {
		if (selected.size === 0) return;
		// Xóa từ cuối lên (index không dịch khi splice từng row).
		for (let i = rows.length - 1; i >= 0; i--) {
			if (selected.has(idOf(rows[i], i))) {
				onRowDelete?.(rows[i] as never, idOf(rows[i], i));
				rows.splice(i, 1);
			}
		}
		selected.clear();
		onSelectionChange?.([]);
	};

	const clearSelection = (): void => {
		if (selected.size === 0) return;
		selected.clear();
		onSelectionChange?.([]);
	};

	const selectedCount: number = $derived(selected.size);

	// ── LAZY LOAD ──
	const hasMoreLazy: boolean = $derived(lazyHasMoreProp ?? hasMoreLazyState ?? true);
	const isLoadingMore: boolean = $derived(loadingMore);

	const loadMore = (): void => {
		if (!lazyLoadEnabled || loadingMore || !hasMoreLazy || !lazyOnLoadMore) return;
		loadingMore = true;
		Promise.resolve(lazyOnLoadMore()).then(
			() => {
				loadingMore = false;
				// Không có prop hasMore → tự đo: nếu lần gọi này không thêm row
				// (độ dài data không đổi) → hết data, dừng load tiếp.
				if (lazyHasMoreProp === undefined) {
					const n = (data ?? []).length;
					if (n > 0 && n === lastLoadedCount) hasMoreLazyState = false;
					lastLoadedCount = n;
				}
			},
			() => {
				loadingMore = false;
			}
		);
	};

	// Đếm data lần load trước (tự đo hasMore khi không có prop).
	let lastLoadedCount = $state<number | undefined>(undefined);

	// ── INFINITE SCROLL (IntersectionObserver sentinel cuối bảng) ──
	let sentinelEl: HTMLDivElement | undefined = $state(undefined);
	$effect(() => {
		if (!lazyLoadEnabled || typeof document === 'undefined' || !sentinelEl) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) loadMore();
				}
			},
			{ root: null, rootMargin: '100px', threshold: 0 }
		);
		observer.observe(sentinelEl);
		return () => observer.disconnect();
	});

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

	// ── LABELS edit/delete/lazy (i18n) ──
	const editText = $derived(getText(editableCfg.cellLabel, { en: 'Edit cell', vi: 'Sửa ô' }));
	const confirmCellText = $derived(getText(editableCfg.confirmLabel, { en: 'Confirm', vi: 'Xác nhận' }));
	const cancelCellText = $derived(getText(editableCfg.cancelLabel, { en: 'Cancel', vi: 'Hủy' }));
	const deleteRowText = $derived(getText(undefined, { en: 'Delete', vi: 'Xóa' }));
	const updateRowText = $derived(getText(undefined, { en: 'Update', vi: 'Cập nhật' }));
	const deleteTitleText = $derived(getText(undefined, { en: 'Delete row?', vi: 'Xóa row này?' }));
	const deleteDescText = $derived(
		getText(undefined, { en: 'This action cannot be undone.', vi: 'Hành động này không thể hoàn tác.' })
	);
	const loadMoreText = $derived(getText(lazyLoadProp?.loadMoreLabel, { en: 'Load more', vi: 'Tải thêm' }));
	const loadingMoreText = $derived(getText(lazyLoadProp?.loadingMoreLabel, { en: 'Loading…', vi: 'Đang tải…' }));
	const rowActionsText = $derived(getText(undefined, { en: 'Row actions', vi: 'Thao tác row' }));

	// ── LABELS wave 7 (create/export/import/copy/clone/selection tools) ──
	const createText = $derived(getText(creatableCfg.label, { en: 'Create new row', vi: 'Tạo row mới' }));
	const exportText = $derived(getText(exportCfg.exportLabel, { en: 'Export', vi: 'Xuất' }));
	const importText = $derived(getText(exportCfg.importLabel, { en: 'Import', vi: 'Nhập' }));
	const copyText = $derived(getText(undefined, { en: 'Copy', vi: 'Sao chép' }));
	const cloneText = $derived(getText(undefined, { en: 'Duplicate', vi: 'Nhân đôi' }));
	const deleteSelectedText = $derived(getText(undefined, { en: 'Delete selected', vi: 'Xóa đã chọn' }));
	const clearSelectionText = $derived(getText(undefined, { en: 'Clear selection', vi: 'Bỏ chọn' }));

	const resultsText = $derived(resultsTemplate.replace('{n}', String(filtered.length)));
	const showSearch = $derived(!!searchable);
	const selectableDerived = $derived(!!selectable);
	const sortableDerived = $derived(!!sortable);
	const showPaginationDerived = $derived(
		lazyLoadEnabled ? false : (showPagination ?? true)
	);
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
		get deleteRowId() {
			return deleteRowId;
		},
		get expandedRowId() {
			return expandedRowId;
		},
		get editCell() {
			return editCell;
		},
		get loadingMore() {
			return loadingMore;
		},
		get hasMore() {
			return hasMoreLazy;
		},
		get striped() {
			return striped;
		},
		get hoverable() {
			return hoverable;
		},
		get bordered() {
			return bordered;
		},
		get editable() {
			return editableDerived;
		},
		get isMobile() {
			return isMobile;
		},
		get editText() {
			return editText;
		},
		get confirmText() {
			return confirmCellText;
		},
		get cancelText() {
			return cancelCellText;
		},
		get deleteText() {
			return deleteRowText;
		},
		get updateText() {
			return updateRowText;
		},
		get deleteTitleText() {
			return deleteTitleText;
		},
		get deleteDescText() {
			return deleteDescText;
		},
		get loadMoreText() {
			return loadMoreText;
		},
		get loadingMoreText() {
			return loadingMoreText;
		},
		get rowActionsLabel() {
			return rowActionsText;
		},
		get creatable() {
			return creatableDerived;
		},
		get createText() {
			return createText;
		},
		get exportable() {
			return exportableDerived;
		},
		get exportFormats() {
			return exportFormats;
		},
		get importable() {
			return importableDerived;
		},
		get exportText() {
			return exportText;
		},
		get importText() {
			return importText;
		},
		get copyText() {
			return copyText;
		},
		get cloneText() {
			return cloneText;
		},
		get deleteSelectedText() {
			return deleteSelectedText;
		},
		get clearSelectionText() {
			return clearSelectionText;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'datatable-root',
				`size-${this.size}`,
				`density-${this.density}`,
				this.loading ? 'is-loading' : undefined,
				this.selectable ? 'has-selection' : undefined,
				this.striped ? 'striped' : undefined,
				this.hoverable ? 'hoverable' : undefined,
				this.bordered ? 'bordered-columns' : undefined,
				this.editable ? 'editable' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: classProp }, overwriteDefaultStyles);
		}
	});

	// ── SHARED STATE (root → sub) — getter inline trực tiếp literal (spread
	// `{...obj}` invoke getter và copy GIÁ TRỊ tĩnh — editable/rowActions/deleteOpen
	// sẽ đóng băng lúc mount nếu bọc qua object trung gian rồi spread).
	const shared = {
		get configs() {
			return configs;
		},
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
		handleRowClick,
		get editable() {
			return editableDerived;
		},
		get editableColumns() {
			return editableCfg.columns;
		},
		get rowActions() {
			return rowActionsDerived;
		},
		get isMobile() {
			return isMobile;
		},
		isRowEditing,
		openRowEditor,
		closeRowEditor,
		getRowEditValue,
		setRowEditValue,
		get deleteOpen() {
			return deleteOpen;
		},
		openCellEditor,
		confirmCellEditor,
		cancelCellEditor,
		isEditing,
		setEditValue,
		getEditValue,
		requestDeleteRow,
		confirmDeleteRow,
		isDeletePending,
		toggleRowActions,
		isRowExpanded,
		handleRowUpdate,
		handleRowDeleteDirect,
		get hasMoreLazy() {
			return hasMoreLazy;
		},
		get isLoadingMore() {
			return isLoadingMore;
		},
		loadMore,
		createRow,
		copyRow,
		copySelected,
		cloneRow,
		exportData,
		importData,
		deleteSelected,
		clearSelection,
		get selectedCount() {
			return selected.size;
		}
	};
	setDataTableContext(shared);

	export { configs };
</script>

<div class={configs.style} {...props} {@attach handleEvents(configs.event)}>
	{#if showSearch || creatableDerived || exportableDerived}
		<div class="datatable-toolbar">
			{#if showSearch}
				<div class="datatable-search-wrap">
					<input
						class="datatable-search"
						type="search"
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
			{/if}

			{#if creatableDerived}
				<button
					type="button"
					class="datatable-btn datatable-btn--create"
					data-test="datatable-create"
					aria-label={configs.createText}
					onclick={() => createRow()}
				>
					<span aria-hidden="true">＋</span>{configs.createText}
				</button>
			{/if}

			{#if exportableDerived}
				<span class="datatable-export-group" data-role="export-group">
					{#each exportFormats as fmt, fi (fmt)}
						<button
							type="button"
							class="datatable-btn datatable-btn--export"
							data-test={`datatable-export-${fmt}`}
							aria-label={`${configs.exportText} ${fmt.toUpperCase()}`}
							onclick={() => exportData(fmt)}
						>
							{configs.exportText} {fmt.toUpperCase()}
						</button>
					{/each}
					{#if importableDerived}
						<label class="datatable-btn datatable-btn--import" data-test="datatable-import">
							<span aria-hidden="true">{configs.importText}</span>
							<input
								type="file"
								accept=".csv,.json"
								aria-label={configs.importText}
								onchange={(e) => {
									const file = (e.target as HTMLInputElement).files?.[0];
									if (file) importData(file);
									(e.target as HTMLInputElement).value = '';
								}}
							/>
						</label>
					{/if}
				</span>
			{/if}

			{#if configs.selectable && selectedCount > 0}
				<span class="datatable-selection-tools" data-role="selection-tools">
					<span class="datatable-selection-count">{selectedCount}</span>
					{#if copyableDerived}
						<button
							type="button"
							class="datatable-btn datatable-btn--tool"
							data-test="datatable-copy-selected"
							aria-label={configs.copyText}
							onclick={() => copySelected()}
						>
							{configs.copyText}
						</button>
					{/if}
					<button
						type="button"
						class="datatable-btn datatable-btn--tool datatable-btn--danger"
						data-test="datatable-delete-selected"
						aria-label={configs.deleteSelectedText}
						onclick={() => deleteSelected()}
					>
						{configs.deleteSelectedText}
					</button>
					<button
						type="button"
						class="datatable-btn datatable-btn--tool"
						data-test="datatable-clear-selection"
						aria-label={configs.clearSelectionText}
						onclick={() => clearSelection()}
					>
						{configs.clearSelectionText}
					</button>
				</span>
			{/if}
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

	{#if lazyLoadEnabled}
		<div class="datatable-lazyload">
			{#if loadingMore}
				<span class="datatable-lazyload-loading" data-role="lazy-loading">{configs.loadingMoreText}</span>
			{:else if hasMoreLazy && lazyShowButton}
				<button
					type="button"
					class="datatable-lazyload-btn"
					data-test="datatable-load-more"
					aria-label={configs.loadMoreText}
					onclick={() => loadMore()}
				>
					{configs.loadMoreText}
				</button>
			{/if}
		</div>
		<!-- Sentinel infinite scroll: quan sát khi cuộn tới cuối bảng (load more button ẩn) -->
		<div class="datatable-lazyload-sentinel" bind:this={sentinelEl} aria-hidden="true"></div>
	{/if}

	{#if configs.deleteRowId}
		<AlertDialog bind:open={deleteOpen}>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>{configs.deleteTitleText}</AlertDialog.Title>
					<AlertDialog.Description>{configs.deleteDescText}</AlertDialog.Description>
				</AlertDialog.Header>
				<AlertDialog.Footer>
					<AlertDialog.Action color="danger" onselect={() => confirmDeleteRow()}>
						{configs.deleteText}
					</AlertDialog.Action>
					<AlertDialog.Cancel data-test="datatable-delete-cancel">
						{configs.cancelText}
					</AlertDialog.Cancel>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog>
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

	// ── Toolbar buttons (create / export / import / selection tools) ──
	.datatable-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 2rem;
		padding: 0 0.75rem;
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--content1-foreground, #18181b);
		background: var(--content1, #fff);
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		border-radius: var(--border-radius-sm, 0.375rem);
		cursor: var(--cursor-interactive);
		transition: background-color 150ms ease, color 150ms ease;
		white-space: nowrap;

		&--create {
			color: hsl(0 0% 100%);
			background: var(--primary, var(--color-indigo-500));
			border-color: transparent;

			&:hover {
				background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 85%, black);
			}
		}

		&--import {
			position: relative;
			overflow: hidden;

			input[type='file'] {
				position: absolute;
				inset: 0;
				width: 100%;
				height: 100%;
				opacity: 0;
				cursor: var(--cursor-interactive);
			}
		}

		&--tool {
			min-height: 1.75rem;
			padding: 0 0.625rem;
			font-size: 0.75rem;

			&.datatable-btn--danger {
				color: var(--danger, var(--color-red-500));
				border-color: color-mix(in srgb, var(--danger, var(--color-red-500)) 30%, transparent);

				&:hover {
					background: color-mix(in srgb, var(--danger, var(--color-red-500)) 8%, transparent);
				}
			}
		}

		@media (hover: hover) and (pointer: fine) {
			&:hover:not(.datatable-btn--create):not(.datatable-btn--danger) {
				background: var(--content2, hsl(240 4.76% 95.88%));
			}
		}
		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
		}
	}

	.datatable-export-group {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.datatable-selection-tools {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: color-mix(in srgb, var(--primary, var(--color-indigo-500)) 8%, transparent);
		border-radius: var(--border-radius-sm, 0.375rem);
	}

	.datatable-selection-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.25rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: hsl(0 0% 100%);
		background: var(--primary, var(--color-indigo-500));
		border-radius: 9999px;
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

	// ── Lazy load footer (nút load more + loading text) ──
	.datatable-lazyload {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.625rem var(--cell-pad-x, 0.75rem);
		border-top: 1px solid var(--content3, hsl(240 5.88% 90%));
	}

	.datatable-lazyload-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2rem;
		padding: 0 1rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--content1-foreground, #18181b);
		background: transparent;
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		border-radius: var(--border-radius-sm, 0.375rem);
		cursor: var(--cursor-interactive);
		transition: background-color 150ms ease;

		@media (hover: hover) and (pointer: fine) {
			&:hover {
				background: var(--content2, hsl(240 4.76% 95.88%));
			}
		}
		@include dt.focus-ring;
	}

	.datatable-lazyload-loading {
		font-size: 0.8125rem;
		color: var(--muted, #71717a);
	}

	// ── Infinite scroll sentinel (chỉ quan sát khi bật lazy + nút ẩn) ──
	.datatable-lazyload-sentinel {
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
