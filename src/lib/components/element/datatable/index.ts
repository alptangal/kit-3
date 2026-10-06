// src/lib/components/element/datatable/index.ts
// DataTable composite — Object.assign như Card/Accordion: `<DataTable />` (Root
// tự render Head/Body/Pagination). PM gộp block này vào element/index.ts.
import DataTableRoot from './Main.svelte';
import DataTableHead from './Head.svelte';
import DataTableBody from './Body.svelte';
import DataTablePagination from './Pagination.svelte';

export const DataTable = Object.assign(DataTableRoot, {
	Head: DataTableHead,
	Body: DataTableBody,
	Pagination: DataTablePagination
});

export { getDataTableContext, setDataTableContext } from './_context';
export type {
	DataTableAccessor,
	DataTableColumn,
	DataTableColumnAlign,
	DataTableConfigs,
	DataTableDensity,
	DataTableEditable,
	DataTableLazyLoad,
	DataTableRootProps,
	DataTableSharedState,
	DataTableSortOrder,
	DataTableStatus,
	DataTableVisual
} from './_interface';
