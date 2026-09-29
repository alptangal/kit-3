import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTableState,
  sortRows,
  paginateRows,
  getTotalPages,
  type TableColumn,
} from './table-logic';

interface TestRow {
  id: string;
  name: string;
  email: string;
  age: number;
}

const testData: TestRow[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com', age: 28 },
  { id: '2', name: 'Bob', email: 'bob@example.com', age: 35 },
  { id: '3', name: 'Charlie', email: 'charlie@example.com', age: 22 },
  { id: '4', name: 'Diana', email: 'diana@example.com', age: 31 },
  { id: '5', name: 'Eve', email: 'eve@example.com', age: 26 },
];

const testColumns: TableColumn<TestRow>[] = [
  { id: 'name', label: 'Name', accessor: 'name', sortable: true },
  { id: 'email', label: 'Email', accessor: 'email' },
  { id: 'age', label: 'Age', accessor: 'age', sortable: true },
];

describe('Table Logic', () => {
  describe('Initial State', () => {
    it('should create table with default state', () => {
      const table = createTableState(testData, testColumns);
      expect(table.rows).toEqual(testData);
      expect(table.columns).toEqual(testColumns);
      expect(table.sortBy).toBeNull();
      expect(table.currentPage).toBe(1);
      expect(table.pageSize).toBe(10);
      expect(table.selectedRows.size).toBe(0);
      expect(table.isLoading).toBe(false);
    });

    it('should support custom page size', () => {
      const table = createTableState(testData, testColumns, 5);
      expect(table.pageSize).toBe(5);
    });

    it('should be able to set custom rows and columns', () => {
      const table = createTableState();
      table.setRows(testData);
      table.setColumns(testColumns);

      expect(table.rows).toEqual(testData);
      expect(table.columns).toEqual(testColumns);
    });
  });

  describe('Sorting', () => {
    it('should set sort column and order', () => {
      const table = createTableState(testData, testColumns);
      table.setSortBy('name');

      expect(table.sortBy).toBe('name');
      expect(table.sortOrder).toBe('asc');
    });

    it('should toggle sort order when clicking same column', () => {
      const table = createTableState(testData, testColumns);
      table.setSortBy('name');
      expect(table.sortOrder).toBe('asc');

      table.setSortBy('name');
      expect(table.sortOrder).toBe('desc');
    });

    it('should reset sort order when changing column', () => {
      const table = createTableState(testData, testColumns);
      table.setSortBy('name');
      table.setSortOrder('desc');

      table.setSortBy('age');
      expect(table.sortOrder).toBe('asc');
    });

    it('should reset to page 1 when sorting', () => {
      const table = createTableState(testData, testColumns, 2);
      table.setCurrentPage(3);
      table.setSortBy('name');

      expect(table.currentPage).toBe(1);
    });

    it('should sort rows by string column ascending', () => {
      const sorted = sortRows(testData, 'name', 'asc', testColumns);
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[4].name).toBe('Eve');
    });

    it('should sort rows by string column descending', () => {
      const sorted = sortRows(testData, 'name', 'desc', testColumns);
      expect(sorted[0].name).toBe('Eve');
      expect(sorted[4].name).toBe('Alice');
    });

    it('should sort rows by number column', () => {
      const sorted = sortRows(testData, 'age', 'asc', testColumns);
      expect(sorted[0].age).toBe(22);
      expect(sorted[4].age).toBe(35);
    });

    it('should handle sorting by accessor function', () => {
      const columnsWithFunction: TableColumn<TestRow>[] = [
        { id: 'full', label: 'Full', accessor: (row) => `${row.name} ${row.email}` },
      ];

      const sorted = sortRows(testData, 'full', 'asc', columnsWithFunction);
      expect(sorted[0].name).toBe('Alice');
    });
  });

  describe('Pagination', () => {
    it('should paginate rows correctly', () => {
      const paginated = paginateRows(testData, 1, 2);
      expect(paginated).toHaveLength(2);
      expect(paginated[0].id).toBe('1');
      expect(paginated[1].id).toBe('2');
    });

    it('should return correct page 2', () => {
      const paginated = paginateRows(testData, 2, 2);
      expect(paginated).toHaveLength(2);
      expect(paginated[0].id).toBe('3');
      expect(paginated[1].id).toBe('4');
    });

    it('should return partial last page', () => {
      const paginated = paginateRows(testData, 3, 2);
      expect(paginated).toHaveLength(1);
      expect(paginated[0].id).toBe('5');
    });

    it('should calculate total pages correctly', () => {
      expect(getTotalPages(5, 2)).toBe(3);
      expect(getTotalPages(10, 5)).toBe(2);
      expect(getTotalPages(7, 3)).toBe(3);
    });

    it('should set current page', () => {
      const table = createTableState(testData, testColumns, 2);
      table.setCurrentPage(2);
      expect(table.currentPage).toBe(2);
    });

    it('should not allow page less than 1', () => {
      const table = createTableState(testData, testColumns);
      table.setCurrentPage(0);
      expect(table.currentPage).toBe(1);

      table.setCurrentPage(-5);
      expect(table.currentPage).toBe(1);
    });

    it('should update page size and reset to page 1', () => {
      const table = createTableState(testData, testColumns, 2);
      table.setCurrentPage(3);
      table.setPageSize(5);

      expect(table.pageSize).toBe(5);
      expect(table.currentPage).toBe(1);
    });
  });

  describe('Row Selection', () => {
    it('should toggle row selection', () => {
      const table = createTableState(testData, testColumns);
      table.toggleRowSelection('1');

      expect(table.selectedRows.has('1')).toBe(true);
      expect(table.selectedRows.size).toBe(1);
    });

    it('should toggle off selected row', () => {
      const table = createTableState(testData, testColumns);
      table.toggleRowSelection('1');
      table.toggleRowSelection('1');

      expect(table.selectedRows.has('1')).toBe(false);
      expect(table.selectedRows.size).toBe(0);
    });

    it('should select multiple rows', () => {
      const table = createTableState(testData, testColumns);
      table.toggleRowSelection('1');
      table.toggleRowSelection('2');
      table.toggleRowSelection('3');

      expect(table.selectedRows.size).toBe(3);
    });

    it('should select all rows', () => {
      const table = createTableState(testData, testColumns);
      table.selectAllRows();

      expect(table.selectedRows.size).toBe(5);
      expect(table.selectedRows.has('0')).toBe(true);
      expect(table.selectedRows.has('4')).toBe(true);
    });

    it('should clear row selection', () => {
      const table = createTableState(testData, testColumns);
      table.selectAllRows();
      table.clearRowSelection();

      expect(table.selectedRows.size).toBe(0);
    });

    it('should maintain row selection across page changes', () => {
      const table = createTableState(testData, testColumns, 2);
      table.toggleRowSelection('1');
      table.setCurrentPage(2);

      expect(table.selectedRows.has('1')).toBe(true);
    });
  });

  describe('Loading State', () => {
    it('should set loading state', () => {
      const table = createTableState(testData, testColumns);
      table.setLoading(true);

      expect(table.isLoading).toBe(true);
    });

    it('should clear loading state', () => {
      const table = createTableState(testData, testColumns);
      table.setLoading(true);
      table.setLoading(false);

      expect(table.isLoading).toBe(false);
    });
  });

  describe('Column Management', () => {
    it('should update columns', () => {
      const table = createTableState(testData, testColumns);
      const newColumns: TableColumn<TestRow>[] = [
        { id: 'name', label: 'Full Name', accessor: 'name' },
      ];

      table.setColumns(newColumns);
      expect(table.columns).toEqual(newColumns);
    });

    it('should support column accessor as function', () => {
      const columnsWithFunction: TableColumn<TestRow>[] = [
        {
          id: 'initials',
          label: 'Initials',
          accessor: (row) => row.name[0],
        },
      ];

      const sorted = sortRows(testData, 'initials', 'asc', columnsWithFunction);
      expect(sorted[0].name).toBe('Alice');
    });
  });

  describe('Combined Operations', () => {
    it('should handle sort + pagination', () => {
      let data = testData;
      data = sortRows(data, 'age', 'asc', testColumns);
      const paginated = paginateRows(data, 1, 2);

      expect(paginated[0].age).toBe(22);
      expect(paginated[1].age).toBe(26);
    });

    it('should handle sort + selection + pagination', () => {
      const table = createTableState(testData, testColumns, 2);
      table.setSortBy('age');
      table.setCurrentPage(1);
      table.toggleRowSelection('1');

      expect(table.sortBy).toBe('age');
      expect(table.currentPage).toBe(1);
      expect(table.selectedRows.size).toBe(1);
    });

    it('should handle select all, change page, then deselect', () => {
      const table = createTableState(testData, testColumns, 2);
      table.selectAllRows();
      table.setCurrentPage(2);
      table.clearRowSelection();

      expect(table.selectedRows.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data set', () => {
      const table = createTableState([], testColumns);
      expect(table.rows).toEqual([]);
      expect(getTotalPages(0, 10)).toBe(0);
    });

    it('should handle single row', () => {
      const table = createTableState([testData[0]], testColumns);
      expect(table.rows).toHaveLength(1);
      expect(getTotalPages(1, 10)).toBe(1);
    });

    it('should handle large page size', () => {
      const table = createTableState(testData, testColumns, 1000);
      expect(getTotalPages(5, 1000)).toBe(1);
    });

    it('should handle page size of 1', () => {
      const table = createTableState(testData, testColumns, 1);
      expect(getTotalPages(5, 1)).toBe(5);
    });
  });
});
