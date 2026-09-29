/**
 * Table State Logic
 * Manages table state: columns, rows, sorting, filtering, selection, pagination
 */

export interface TableColumn<T = any> {
  id: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  getDisplayValue?: (row: T) => string | number;
}

export interface TableSortConfig {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface TableFilterConfig {
  columnId: string;
  value: string;
}

export interface TableRowMeta {
  isSelected: boolean;
  isExpanded: boolean;
  isFocused: boolean;
}

export interface TableState<T = any> {
  columns: TableColumn<T>[];
  rows: T[];
  rowsMeta: Map<string | number, TableRowMeta>;
  sorts: TableSortConfig[];
  filters: TableFilterConfig[];
  selectedRowIds: Set<string | number>;
  expandedRowIds: Set<string | number>;
  focusedRowId: string | number | null;
  pageSize: number;
  currentPage: number;
  totalRows: number;
  isLoading: boolean;
  rowIdField: string;
}

export const createTableState = <T,>(
  columns: TableColumn<T>[],
  rows: T[] = [],
  config?: {
    pageSize?: number;
    rowIdField?: string;
  }
): TableState<T> => {
  const rowIdField = config?.rowIdField ?? 'id';
  const rowsMeta = new Map<string | number, TableRowMeta>();

  rows.forEach(row => {
    const rowId = (row as any)[rowIdField];
    rowsMeta.set(rowId, {
      isSelected: false,
      isExpanded: false,
      isFocused: false,
    });
  });

  return {
    columns,
    rows,
    rowsMeta,
    sorts: [],
    filters: [],
    selectedRowIds: new Set(),
    expandedRowIds: new Set(),
    focusedRowId: null,
    pageSize: config?.pageSize ?? 10,
    currentPage: 0,
    totalRows: rows.length,
    isLoading: false,
    rowIdField,
  };
};

export const setRows = <T,>(
  state: TableState<T>,
  rows: T[]
): TableState<T> => {
  const rowsMeta = new Map<string | number, TableRowMeta>();

  rows.forEach(row => {
    const rowId = (row as any)[state.rowIdField];
    const existing = state.rowsMeta.get(rowId);
    rowsMeta.set(rowId, existing || {
      isSelected: false,
      isExpanded: false,
      isFocused: false,
    });
  });

  return {
    ...state,
    rows,
    rowsMeta,
    totalRows: rows.length,
    currentPage: 0,
  };
};

export const addSort = <T,>(
  state: TableState<T>,
  columnId: string,
  direction: 'asc' | 'desc',
  multiSort: boolean = false
): TableState<T> => {
  const column = state.columns.find(col => col.id === columnId);
  if (!column || !column.sortable) return state;

  const newSorts = multiSort
    ? state.sorts.filter(s => s.columnId !== columnId)
    : [];

  newSorts.push({ columnId, direction });

  return {
    ...state,
    sorts: newSorts,
    currentPage: 0,
  };
};

export const toggleSort = <T,>(
  state: TableState<T>,
  columnId: string,
  multiSort: boolean = false
): TableState<T> => {
  const existing = state.sorts.find(s => s.columnId === columnId);

  if (!existing) {
    return addSort(state, columnId, 'asc', multiSort);
  }

  if (existing.direction === 'asc') {
    return addSort(state, columnId, 'desc', multiSort);
  }

  const newSorts = state.sorts.filter(s => s.columnId !== columnId);
  return {
    ...state,
    sorts: newSorts,
    currentPage: 0,
  };
};

export const clearSorts = <T,>(state: TableState<T>): TableState<T> => ({
  ...state,
  sorts: [],
  currentPage: 0,
});

export const setFilter = <T,>(
  state: TableState<T>,
  columnId: string,
  value: string
): TableState<T> => {
  const column = state.columns.find(col => col.id === columnId);
  if (!column || !column.filterable) return state;

  const newFilters = state.filters.filter(f => f.columnId !== columnId);
  if (value) {
    newFilters.push({ columnId, value });
  }

  return {
    ...state,
    filters: newFilters,
    currentPage: 0,
  };
};

export const clearFilters = <T,>(state: TableState<T>): TableState<T> => ({
  ...state,
  filters: [],
  currentPage: 0,
});

export const selectRow = <T,>(
  state: TableState<T>,
  rowId: string | number,
  multiSelect: boolean = false
): TableState<T> => {
  if (!state.rowsMeta.has(rowId)) return state;

  const newSelected = multiSelect
    ? new Set(state.selectedRowIds)
    : new Set<string | number>();

  if (newSelected.has(rowId)) {
    newSelected.delete(rowId);
  } else {
    newSelected.add(rowId);
  }

  return {
    ...state,
    selectedRowIds: newSelected,
  };
};

export const deselectRow = <T,>(
  state: TableState<T>,
  rowId: string | number
): TableState<T> => {
  const newSelected = new Set(state.selectedRowIds);
  newSelected.delete(rowId);

  return {
    ...state,
    selectedRowIds: newSelected,
  };
};

export const selectAllRows = <T,>(state: TableState<T>): TableState<T> => {
  const newSelected = new Set<string | number>();
  state.rows.forEach(row => {
    const rowId = (row as any)[state.rowIdField];
    newSelected.add(rowId);
  });

  return {
    ...state,
    selectedRowIds: newSelected,
  };
};

export const clearSelection = <T,>(state: TableState<T>): TableState<T> => ({
  ...state,
  selectedRowIds: new Set(),
});

export const expandRow = <T,>(
  state: TableState<T>,
  rowId: string | number
): TableState<T> => {
  if (!state.rowsMeta.has(rowId)) return state;

  const newExpanded = new Set(state.expandedRowIds);
  newExpanded.add(rowId);

  return {
    ...state,
    expandedRowIds: newExpanded,
  };
};

export const collapseRow = <T,>(
  state: TableState<T>,
  rowId: string | number
): TableState<T> => {
  const newExpanded = new Set(state.expandedRowIds);
  newExpanded.delete(rowId);

  return {
    ...state,
    expandedRowIds: newExpanded,
  };
};

export const toggleRowExpanded = <T,>(
  state: TableState<T>,
  rowId: string | number
): TableState<T> => {
  if (state.expandedRowIds.has(rowId)) {
    return collapseRow(state, rowId);
  }
  return expandRow(state, rowId);
};

export const focusRow = <T,>(
  state: TableState<T>,
  rowId: string | number | null
): TableState<T> => {
  if (rowId !== null && !state.rowsMeta.has(rowId)) return state;

  return {
    ...state,
    focusedRowId: rowId,
  };
};

export const moveFocusNext = <T,>(state: TableState<T>): TableState<T> => {
  const visibleRows = state.rows;
  if (visibleRows.length === 0) return state;

  if (state.focusedRowId === null) {
    const firstRowId = (visibleRows[0] as any)[state.rowIdField];
    return focusRow(state, firstRowId);
  }

  const currentIndex = visibleRows.findIndex(
    row => (row as any)[state.rowIdField] === state.focusedRowId
  );

  if (currentIndex === -1 || currentIndex === visibleRows.length - 1) {
    return state;
  }

  const nextRowId = (visibleRows[currentIndex + 1] as any)[state.rowIdField];
  return focusRow(state, nextRowId);
};

export const moveFocusPrevious = <T,>(state: TableState<T>): TableState<T> => {
  const visibleRows = state.rows;
  if (visibleRows.length === 0) return state;

  if (state.focusedRowId === null) {
    const lastRowId = (visibleRows[visibleRows.length - 1] as any)[state.rowIdField];
    return focusRow(state, lastRowId);
  }

  const currentIndex = visibleRows.findIndex(
    row => (row as any)[state.rowIdField] === state.focusedRowId
  );

  if (currentIndex <= 0) {
    return state;
  }

  const prevRowId = (visibleRows[currentIndex - 1] as any)[state.rowIdField];
  return focusRow(state, prevRowId);
};

export const setPage = <T,>(
  state: TableState<T>,
  page: number
): TableState<T> => {
  const maxPage = Math.ceil(state.totalRows / state.pageSize) - 1;
  const validPage = Math.max(0, Math.min(page, maxPage));

  return {
    ...state,
    currentPage: validPage,
  };
};

export const setPageSize = <T,>(
  state: TableState<T>,
  pageSize: number
): TableState<T> => {
  if (pageSize <= 0) return state;

  return {
    ...state,
    pageSize,
    currentPage: 0,
  };
};

export const setLoading = <T,>(
  state: TableState<T>,
  isLoading: boolean
): TableState<T> => ({
  ...state,
  isLoading,
});

export const addColumn = <T,>(
  state: TableState<T>,
  column: TableColumn<T>,
  insertAt?: number
): TableState<T> => {
  const newColumns = insertAt !== undefined
    ? [
        ...state.columns.slice(0, insertAt),
        column,
        ...state.columns.slice(insertAt),
      ]
    : [...state.columns, column];

  return {
    ...state,
    columns: newColumns,
  };
};

export const removeColumn = <T,>(
  state: TableState<T>,
  columnId: string
): TableState<T> => {
  const newColumns = state.columns.filter(col => col.id !== columnId);
  const newFilters = state.filters.filter(f => f.columnId !== columnId);
  const newSorts = state.sorts.filter(s => s.columnId !== columnId);

  return {
    ...state,
    columns: newColumns,
    filters: newFilters,
    sorts: newSorts,
  };
};
