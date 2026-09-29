<script lang="ts">
  import { setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import type { Writable } from 'svelte/store';
  import { createTableState, sortRows, paginateRows, getTotalPages, type TableColumn } from './table-logic';

  interface TableContext<T> {
    rows: Writable<T[]>;
    columns: Writable<TableColumn<T>[]>;
    sortBy: Writable<string | null>;
    sortOrder: Writable<'asc' | 'desc'>;
    currentPage: Writable<number>;
    pageSize: Writable<number>;
    selectedRows: Writable<Set<string>>;
    isLoading: Writable<boolean>;
    sortedRows: Writable<T[]>;
    paginatedRows: Writable<T[]>;
    totalPages: Writable<number>;
    onSortChange?: (columnId: string) => void;
    onPageChange?: (page: number) => void;
    onSelectionChange?: (selectedIds: string[]) => void;
    getRowId: (row: T, index: number) => string;
  }

  interface Props<T> {
    data?: T[];
    columns?: TableColumn<T>[];
    pageSize?: number;
    sortable?: boolean;
    selectable?: boolean;
    loading?: boolean;
    onSortChange?: (columnId: string) => void;
    onPageChange?: (page: number) => void;
    onSelectionChange?: (selectedIds: string[]) => void;
    getRowId?: (row: T, index: number) => string;
    children?: any;
  }

  let {
    data = [],
    columns = [],
    pageSize = 10,
    sortable = true,
    selectable = true,
    loading = false,
    onSortChange,
    onPageChange,
    onSelectionChange,
    getRowId = (_, i) => String(i),
    children,
  }: Props<any> = $props();

  const rows = writable(data);
  const columnsStore = writable(columns);
  const sortBy = writable<string | null>(null);
  const sortOrder = writable<'asc' | 'desc'>('asc');
  const currentPage = writable(1);
  const pageSizeStore = writable(pageSize);
  const selectedRows = writable<Set<string>>(new Set());
  const isLoading = writable(loading);
  const sortedRows = writable<any[]>([]);
  const paginatedRows = writable<any[]>([]);
  const totalPages = writable(0);

  const context: TableContext<any> = {
    rows,
    columns: columnsStore,
    sortBy,
    sortOrder,
    currentPage,
    pageSize: pageSizeStore,
    selectedRows,
    isLoading,
    sortedRows,
    paginatedRows,
    totalPages,
    onSortChange,
    onPageChange,
    onSelectionChange,
    getRowId,
  };

  setContext('table', context);

  // Sync prop changes
  $effect.pre(() => {
    rows.set(data);
    columnsStore.set(columns);
    isLoading.set(loading);
  });

  // Compute sorted rows
  $effect(() => {
    let result = $rows;
    if ($sortBy && sortable) {
      result = sortRows(result, $sortBy, $sortOrder, $columnsStore);
    }
    sortedRows.set(result);
  });

  // Compute paginated rows
  $effect(() => {
    const paginated = paginateRows($sortedRows, $currentPage, $pageSizeStore);
    paginatedRows.set(paginated);
  });

  // Compute total pages
  $effect(() => {
    totalPages.set(getTotalPages($rows.length, $pageSizeStore));
  });

  function handleSort(columnId: string) {
    if (!sortable) return;

    if ($sortBy === columnId) {
      sortOrder.set($sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      sortBy.set(columnId);
      sortOrder.set('asc');
    }
    currentPage.set(1);
    onSortChange?.(columnId);
  }

  function handlePageChange(page: number) {
    currentPage.set(page);
    onPageChange?.(page);
  }

  function handleSelectionChange() {
    onSelectionChange?.([...($selectedRows as any)]);
  }
</script>

<div class="table-container" class:loading={$isLoading}>
  {@render children?.({
    sortBy: $sortBy,
    sortOrder: $sortOrder,
    currentPage: $currentPage,
    pageSize: $pageSizeStore,
    totalPages: $totalPages,
    selectedRows: $selectedRows,
    isLoading: $isLoading,
    rows: $paginatedRows,
    allRows: $rows,
    columns: $columnsStore,
    onSort: handleSort,
    onPageChange: handlePageChange,
    onSelectionChange: handleSelectionChange,
  })}
</div>

<style>
  .table-container {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    background-color: var(--color-surface);
  }

  .table-container.loading {
    opacity: 0.6;
    pointer-events: none;
  }
</style>
