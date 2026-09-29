import { describe, it, expect } from 'vitest';
import {
  createTableState,
  setRows,
  addSort,
  toggleSort,
  clearSorts,
  setFilter,
  clearFilters,
  selectRow,
  deselectRow,
  selectAllRows,
  clearSelection,
  expandRow,
  collapseRow,
  toggleRowExpanded,
  focusRow,
  moveFocusNext,
  moveFocusPrevious,
  setPage,
  setPageSize,
  setLoading,
  addColumn,
  removeColumn,
  type TableColumn,
  type TableState,
} from './table-logic';

interface MockRow {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

describe('Table State Logic', () => {
  const mockColumns: TableColumn<MockRow>[] = [
    { id: 'name', label: 'Name', sortable: true, filterable: true },
    { id: 'email', label: 'Email', sortable: true, filterable: true },
    { id: 'status', label: 'Status', sortable: true, filterable: true },
    { id: 'createdAt', label: 'Created', sortable: true, filterable: false },
  ];

  const mockRows: MockRow[] = [
    {
      id: '1',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      status: 'active',
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      name: 'Bob Smith',
      email: 'bob@example.com',
      status: 'inactive',
      createdAt: '2024-01-20',
    },
    {
      id: '3',
      name: 'Carol White',
      email: 'carol@example.com',
      status: 'active',
      createdAt: '2024-01-25',
    },
  ];

  describe('createTableState', () => {
    it('should create initial state with defaults', () => {
      const state = createTableState(mockColumns, mockRows);
      expect(state.columns).toEqual(mockColumns);
      expect(state.rows).toEqual(mockRows);
      expect(state.sorts).toEqual([]);
      expect(state.filters).toEqual([]);
      expect(state.selectedRowIds.size).toBe(0);
      expect(state.expandedRowIds.size).toBe(0);
      expect(state.focusedRowId).toBeNull();
      expect(state.pageSize).toBe(10);
      expect(state.currentPage).toBe(0);
      expect(state.totalRows).toBe(3);
      expect(state.isLoading).toBe(false);
      expect(state.rowIdField).toBe('id');
    });

    it('should create state with custom config', () => {
      const state = createTableState(mockColumns, mockRows, {
        pageSize: 20,
        rowIdField: 'id',
      });
      expect(state.pageSize).toBe(20);
      expect(state.rowIdField).toBe('id');
    });

    it('should initialize rowsMeta for all rows', () => {
      const state = createTableState(mockColumns, mockRows);
      expect(state.rowsMeta.size).toBe(3);
      state.rows.forEach(row => {
        const meta = state.rowsMeta.get(row.id);
        expect(meta).toBeDefined();
        expect(meta?.isSelected).toBe(false);
        expect(meta?.isExpanded).toBe(false);
        expect(meta?.isFocused).toBe(false);
      });
    });

    it('should handle empty rows', () => {
      const state = createTableState(mockColumns, []);
      expect(state.rows).toEqual([]);
      expect(state.totalRows).toBe(0);
      expect(state.rowsMeta.size).toBe(0);
    });
  });

  describe('setRows', () => {
    it('should update rows and reset metadata', () => {
      let state = createTableState(mockColumns, mockRows);
      const newRows = mockRows.slice(0, 2);
      state = setRows(state, newRows);

      expect(state.rows).toEqual(newRows);
      expect(state.totalRows).toBe(2);
      expect(state.rowsMeta.size).toBe(2);
    });

    it('should reset to first page', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setPage(state, 5);
      state = setRows(state, mockRows);

      expect(state.currentPage).toBe(0);
    });

    it('should preserve selection for existing rows', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectRow(state, '1');
      state = setRows(state, mockRows);

      expect(state.selectedRowIds.has('1')).toBe(true);
    });
  });

  describe('Sorting', () => {
    it('should add single sort', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = addSort(state, 'name', 'asc');

      expect(updated.sorts).toHaveLength(1);
      expect(updated.sorts[0]).toEqual({ columnId: 'name', direction: 'asc' });
    });

    it('should not sort non-sortable column', () => {
      const nonSortableColumns = mockColumns.map((col, idx) =>
        idx === 0 ? { ...col, sortable: false } : col
      );
      const state = createTableState(nonSortableColumns, mockRows);
      const updated = addSort(state, 'name', 'asc');

      expect(updated).toEqual(state);
    });

    it('should replace sort in single-sort mode', () => {
      let state = createTableState(mockColumns, mockRows);
      state = addSort(state, 'name', 'asc', false);
      state = addSort(state, 'email', 'desc', false);

      expect(state.sorts).toHaveLength(1);
      expect(state.sorts[0].columnId).toBe('email');
    });

    it('should add multiple sorts in multi-sort mode', () => {
      let state = createTableState(mockColumns, mockRows);
      state = addSort(state, 'name', 'asc', true);
      state = addSort(state, 'email', 'desc', true);

      expect(state.sorts).toHaveLength(2);
    });

    it('should toggle sort direction', () => {
      let state = createTableState(mockColumns, mockRows);
      state = toggleSort(state, 'name', false);
      expect(state.sorts[0].direction).toBe('asc');

      state = toggleSort(state, 'name', false);
      expect(state.sorts[0].direction).toBe('desc');

      state = toggleSort(state, 'name', false);
      expect(state.sorts).toHaveLength(0);
    });

    it('should reset page on sort', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setPage(state, 3);
      state = addSort(state, 'name', 'asc');

      expect(state.currentPage).toBe(0);
    });

    it('should clear all sorts', () => {
      let state = createTableState(mockColumns, mockRows);
      state = addSort(state, 'name', 'asc', true);
      state = addSort(state, 'email', 'desc', true);
      state = clearSorts(state);

      expect(state.sorts).toHaveLength(0);
    });
  });

  describe('Filtering', () => {
    it('should add filter to filterable column', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = setFilter(state, 'name', 'alice');

      expect(updated.filters).toHaveLength(1);
      expect(updated.filters[0]).toEqual({
        columnId: 'name',
        value: 'alice',
      });
    });

    it('should not filter non-filterable column', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = setFilter(state, 'createdAt', 'value');

      expect(updated).toEqual(state);
    });

    it('should replace existing filter for column', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setFilter(state, 'name', 'alice');
      state = setFilter(state, 'name', 'bob');

      expect(state.filters).toHaveLength(1);
      expect(state.filters[0].value).toBe('bob');
    });

    it('should clear filter with empty string', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setFilter(state, 'name', 'alice');
      state = setFilter(state, 'name', '');

      expect(state.filters).toHaveLength(0);
    });

    it('should reset page on filter', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setPage(state, 3);
      state = setFilter(state, 'name', 'alice');

      expect(state.currentPage).toBe(0);
    });

    it('should clear all filters', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setFilter(state, 'name', 'alice');
      state = setFilter(state, 'email', 'bob@example.com');
      state = clearFilters(state);

      expect(state.filters).toHaveLength(0);
    });
  });

  describe('Selection', () => {
    it('should select single row', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = selectRow(state, '1', false);

      expect(updated.selectedRowIds.has('1')).toBe(true);
      expect(updated.selectedRowIds.size).toBe(1);
    });

    it('should toggle row in multi-select mode', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectRow(state, '1', true);
      expect(state.selectedRowIds.has('1')).toBe(true);

      state = selectRow(state, '1', true);
      expect(state.selectedRowIds.has('1')).toBe(false);
    });

    it('should replace selection in single-select mode', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectRow(state, '1', false);
      state = selectRow(state, '2', false);

      expect(state.selectedRowIds.size).toBe(1);
      expect(state.selectedRowIds.has('2')).toBe(true);
    });

    it('should add to selection in multi-select mode', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectRow(state, '1', true);
      state = selectRow(state, '2', true);

      expect(state.selectedRowIds.size).toBe(2);
    });

    it('should deselect row', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectRow(state, '1', true);
      state = selectRow(state, '2', true);
      state = deselectRow(state, '1');

      expect(state.selectedRowIds.size).toBe(1);
      expect(state.selectedRowIds.has('2')).toBe(true);
    });

    it('should select all rows', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectAllRows(state);

      expect(state.selectedRowIds.size).toBe(3);
      mockRows.forEach(row => {
        expect(state.selectedRowIds.has(row.id)).toBe(true);
      });
    });

    it('should clear selection', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectAllRows(state);
      state = clearSelection(state);

      expect(state.selectedRowIds.size).toBe(0);
    });

    it('should not select non-existent row', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = selectRow(state, '999', false);

      expect(updated).toEqual(state);
    });
  });

  describe('Row Expansion', () => {
    it('should expand row', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = expandRow(state, '1');

      expect(updated.expandedRowIds.has('1')).toBe(true);
    });

    it('should collapse row', () => {
      let state = createTableState(mockColumns, mockRows);
      state = expandRow(state, '1');
      state = collapseRow(state, '1');

      expect(state.expandedRowIds.has('1')).toBe(false);
    });

    it('should toggle row expansion', () => {
      let state = createTableState(mockColumns, mockRows);
      state = toggleRowExpanded(state, '1');
      expect(state.expandedRowIds.has('1')).toBe(true);

      state = toggleRowExpanded(state, '1');
      expect(state.expandedRowIds.has('1')).toBe(false);
    });

    it('should expand multiple rows independently', () => {
      let state = createTableState(mockColumns, mockRows);
      state = expandRow(state, '1');
      state = expandRow(state, '2');

      expect(state.expandedRowIds.size).toBe(2);
    });

    it('should not expand non-existent row', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = expandRow(state, '999');

      expect(updated).toEqual(state);
    });
  });

  describe('Row Focus', () => {
    it('should focus row', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = focusRow(state, '1');

      expect(updated.focusedRowId).toBe('1');
    });

    it('should clear focus with null', () => {
      let state = createTableState(mockColumns, mockRows);
      state = focusRow(state, '1');
      state = focusRow(state, null);

      expect(state.focusedRowId).toBeNull();
    });

    it('should not focus non-existent row', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = focusRow(state, '999');

      expect(updated).toEqual(state);
    });

    it('should move focus to next row', () => {
      let state = createTableState(mockColumns, mockRows);
      state = focusRow(state, '1');
      state = moveFocusNext(state);

      expect(state.focusedRowId).toBe('2');
    });

    it('should not move focus past last row', () => {
      let state = createTableState(mockColumns, mockRows);
      state = focusRow(state, '3');
      state = moveFocusNext(state);

      expect(state.focusedRowId).toBe('3');
    });

    it('should move focus to previous row', () => {
      let state = createTableState(mockColumns, mockRows);
      state = focusRow(state, '2');
      state = moveFocusPrevious(state);

      expect(state.focusedRowId).toBe('1');
    });

    it('should not move focus before first row', () => {
      let state = createTableState(mockColumns, mockRows);
      state = focusRow(state, '1');
      state = moveFocusPrevious(state);

      expect(state.focusedRowId).toBe('1');
    });

    it('should move focus to first row if no focus set', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = moveFocusNext(state);

      expect(updated.focusedRowId).toBe('1');
    });

    it('should move focus to last row from no focus', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = moveFocusPrevious(state);

      expect(updated.focusedRowId).toBe('3');
    });
  });

  describe('Pagination', () => {
    it('should set page', () => {
      const state = createTableState(mockColumns, mockRows, { pageSize: 1 });
      const updated = setPage(state, 2);

      expect(updated.currentPage).toBe(2);
    });

    it('should clamp page to valid range', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = setPage(state, 999);

      expect(updated.currentPage).toBe(0);
    });

    it('should not allow negative page', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = setPage(state, -1);

      expect(updated.currentPage).toBe(0);
    });

    it('should set page size', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = setPageSize(state, 20);

      expect(updated.pageSize).toBe(20);
    });

    it('should reset to first page when changing page size', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setPage(state, 3);
      state = setPageSize(state, 20);

      expect(state.currentPage).toBe(0);
    });

    it('should not allow invalid page size', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = setPageSize(state, 0);

      expect(updated).toEqual(state);
    });
  });

  describe('Loading State', () => {
    it('should set loading', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = setLoading(state, true);

      expect(updated.isLoading).toBe(true);
    });

    it('should clear loading', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setLoading(state, true);
      state = setLoading(state, false);

      expect(state.isLoading).toBe(false);
    });
  });

  describe('Column Management', () => {
    it('should add column at end', () => {
      const state = createTableState(mockColumns, mockRows);
      const newColumn: TableColumn<MockRow> = {
        id: 'actions',
        label: 'Actions',
      };
      const updated = addColumn(state, newColumn);

      expect(updated.columns).toHaveLength(5);
      expect(updated.columns[4]).toEqual(newColumn);
    });

    it('should add column at specific index', () => {
      const state = createTableState(mockColumns, mockRows);
      const newColumn: TableColumn<MockRow> = {
        id: 'phone',
        label: 'Phone',
      };
      const updated = addColumn(state, newColumn, 1);

      expect(updated.columns).toHaveLength(5);
      expect(updated.columns[1]).toEqual(newColumn);
    });

    it('should remove column', () => {
      const state = createTableState(mockColumns, mockRows);
      const updated = removeColumn(state, 'email');

      expect(updated.columns).toHaveLength(3);
      expect(updated.columns.every(col => col.id !== 'email')).toBe(true);
    });

    it('should remove filter when removing column', () => {
      let state = createTableState(mockColumns, mockRows);
      state = setFilter(state, 'email', 'alice');
      state = removeColumn(state, 'email');

      expect(state.filters).toHaveLength(0);
    });

    it('should remove sort when removing column', () => {
      let state = createTableState(mockColumns, mockRows);
      state = addSort(state, 'email', 'asc');
      state = removeColumn(state, 'email');

      expect(state.sorts).toHaveLength(0);
    });
  });

  describe('Complex Workflows', () => {
    it('should handle full user workflow: select, sort, filter, paginate', () => {
      let state = createTableState(mockColumns, mockRows, { pageSize: 1 });

      // User selects rows
      state = selectRow(state, '1', true);
      state = selectRow(state, '2', true);
      expect(state.selectedRowIds.size).toBe(2);

      // User sorts by name
      state = addSort(state, 'name', 'asc');
      expect(state.sorts[0].columnId).toBe('name');
      expect(state.currentPage).toBe(0);

      // User filters by status
      state = setFilter(state, 'status', 'active');
      expect(state.filters[0].value).toBe('active');
      expect(state.currentPage).toBe(0);

      // User goes to second page
      state = setPage(state, 1);
      expect(state.currentPage).toBe(1);

      // User expands a row
      state = expandRow(state, '1');
      expect(state.expandedRowIds.has('1')).toBe(true);
    });

    it('should handle data update with selections preserved', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectRow(state, '1', true);
      state = selectRow(state, '2', true);
      state = expandRow(state, '3');

      const newRows = mockRows.slice(0, 2);
      state = setRows(state, newRows);

      expect(state.selectedRowIds.has('1')).toBe(true);
      expect(state.selectedRowIds.has('2')).toBe(true);
      expect(state.rows).toEqual(newRows);
    });

    it('should handle focus movement through table with selection', () => {
      let state = createTableState(mockColumns, mockRows);
      state = selectRow(state, '1', false);

      state = moveFocusNext(state);
      expect(state.focusedRowId).toBe('1');

      state = selectRow(state, '2', true);
      state = moveFocusNext(state);
      expect(state.focusedRowId).toBe('2');
      expect(state.selectedRowIds.has('1')).toBe(true);
      expect(state.selectedRowIds.has('2')).toBe(true);
    });

    it('should handle clear operations', () => {
      let state = createTableState(mockColumns, mockRows);

      // Setup complex state
      state = selectAllRows(state);
      state = addSort(state, 'name', 'asc', true);
      state = addSort(state, 'email', 'desc', true);
      state = setFilter(state, 'status', 'active');
      state = expandRow(state, '1');
      state = focusRow(state, '2');

      // Clear everything
      state = clearSelection(state);
      state = clearSorts(state);
      state = clearFilters(state);

      expect(state.selectedRowIds.size).toBe(0);
      expect(state.sorts).toHaveLength(0);
      expect(state.filters).toHaveLength(0);
      expect(state.expandedRowIds.has('1')).toBe(true);
      expect(state.focusedRowId).toBe('2');
    });

    it('should handle multiple column operations', () => {
      let state = createTableState(mockColumns, mockRows);

      const col1: TableColumn<MockRow> = { id: 'phone', label: 'Phone' };
      const col2: TableColumn<MockRow> = { id: 'address', label: 'Address' };

      state = addColumn(state, col1);
      state = addColumn(state, col2, 2);
      expect(state.columns).toHaveLength(6);

      state = removeColumn(state, 'email');
      expect(state.columns).toHaveLength(5);
      expect(state.columns.every(col => col.id !== 'email')).toBe(true);
    });
  });
});
