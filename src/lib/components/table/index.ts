export { default as Table } from './Table.svelte';
export { default as TableHead } from './TableHead.svelte';
export { default as TableBody } from './TableBody.svelte';
export { default as TablePagination } from './TablePagination.svelte';
export { createTableState, sortRows, paginateRows, getTotalPages } from './table-logic';
export type { TableColumn, TableState, TableActions } from './table-logic';
