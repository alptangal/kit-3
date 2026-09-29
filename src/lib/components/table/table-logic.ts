export interface TableColumn<T> {
  id: string;
  label: string;
  accessor: keyof T | ((row: T) => any);
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
}

export interface TableState<T> {
  rows: T[];
  columns: TableColumn<T>[];
  sortBy: string | null;
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
  selectedRows: Set<string>;
  isLoading: boolean;
}

export interface TableActions<T> {
  setRows: (rows: T[]) => void;
  setColumns: (columns: TableColumn<T>[]) => void;
  setSortBy: (columnId: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  toggleRowSelection: (rowId: string) => void;
  selectAllRows: () => void;
  clearRowSelection: () => void;
  setLoading: (loading: boolean) => void;
}

export function createTableState<T>(
  initialRows: T[] = [],
  initialColumns: TableColumn<T> = [],
  pageSize: number = 10,
  getRowId: (row: T, index: number) => string = (_, i) => String(i)
): TableState<T> & TableActions<T> {
  let state: TableState<T> = {
    rows: initialRows,
    columns: initialColumns,
    sortBy: null,
    sortOrder: 'asc',
    currentPage: 1,
    pageSize,
    selectedRows: new Set(),
    isLoading: false,
  };

  let currentRowIds = initialRows.map((row, i) => getRowId(row, i));

  return {
    get rows() {
      return state.rows;
    },
    get columns() {
      return state.columns;
    },
    get sortBy() {
      return state.sortBy;
    },
    get sortOrder() {
      return state.sortOrder;
    },
    get currentPage() {
      return state.currentPage;
    },
    get pageSize() {
      return state.pageSize;
    },
    get selectedRows() {
      return state.selectedRows;
    },
    get isLoading() {
      return state.isLoading;
    },
    setRows(rows: T[]) {
      state.rows = rows;
      currentRowIds = rows.map((row, i) => getRowId(row, i));
    },
    setColumns(columns: TableColumn<T>[]) {
      state.columns = columns;
    },
    setSortBy(columnId: string) {
      if (state.sortBy === columnId) {
        // Toggle sort order if clicking same column
        state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = columnId;
        state.sortOrder = 'asc';
      }
      state.currentPage = 1; // Reset to first page on sort
    },
    setSortOrder(order: 'asc' | 'desc') {
      state.sortOrder = order;
    },
    setCurrentPage(page: number) {
      state.currentPage = Math.max(1, page);
    },
    setPageSize(size: number) {
      state.pageSize = Math.max(1, size);
      state.currentPage = 1; // Reset to first page on page size change
    },
    toggleRowSelection(rowId: string) {
      if (state.selectedRows.has(rowId)) {
        state.selectedRows.delete(rowId);
      } else {
        state.selectedRows.add(rowId);
      }
    },
    selectAllRows() {
      currentRowIds.forEach((id) => state.selectedRows.add(id));
    },
    clearRowSelection() {
      state.selectedRows.clear();
    },
    setLoading(loading: boolean) {
      state.isLoading = loading;
    },
  };
}

export function sortRows<T>(
  rows: T[],
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  columns: TableColumn<T>[]
): T[] {
  const column = columns.find((c) => c.id === sortBy);
  if (!column) return rows;

  const sorted = [...rows].sort((a, b) => {
    const aVal = typeof column.accessor === 'function' ? column.accessor(a) : a[column.accessor];
    const bVal = typeof column.accessor === 'function' ? column.accessor(b) : b[column.accessor];

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

export function paginateRows<T>(rows: T[], currentPage: number, pageSize: number): T[] {
  const startIndex = (currentPage - 1) * pageSize;
  return rows.slice(startIndex, startIndex + pageSize);
}

export function getTotalPages(totalRows: number, pageSize: number): number {
  return Math.ceil(totalRows / pageSize);
}
