<script lang="ts">
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { TableColumn } from './table-logic';

  interface TableContext<T> {
    columns: Writable<TableColumn<T>[]>;
    paginatedRows: Writable<T[]>;
    selectedRows: Writable<Set<string>>;
    getRowId: (row: T, index: number) => string;
  }

  interface Props<T> {
    onRowClick?: (row: T, rowId: string) => void;
    onRowSelect?: (rowId: string, selected: boolean) => void;
    selectable?: boolean;
  }

  let { onRowClick, onRowSelect, selectable = true }: Props<any> = $props();

  const context = getContext<TableContext<any>>('table');
  const { columns, paginatedRows, selectedRows, getRowId } = context;

  function getCellValue(row: any, column: TableColumn<any>): any {
    return typeof column.accessor === 'function' ? column.accessor(row) : row[column.accessor];
  }

  function handleRowSelect(rowId: string) {
    const isSelected = $selectedRows.has(rowId);
    if (isSelected) {
      selectedRows.update((set) => {
        set.delete(rowId);
        return set;
      });
    } else {
      selectedRows.update((set) => {
        set.add(rowId);
        return set;
      });
    }
    onRowSelect?.(rowId, !isSelected);
  }

  function handleRowClick(row: any, rowId: string) {
    onRowClick?.(row, rowId);
  }
</script>

<tbody class="table-body">
  {#each $paginatedRows as row, index (index)}
    {@const rowId = getRowId(row, index)}
    {@const isSelected = $selectedRows.has(rowId)}
    <tr class="table-row" class:selected={isSelected} onclick={() => handleRowClick(row, rowId)}>
      {#if selectable}
        <td class="table-checkbox-cell" onclick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onchange={() => handleRowSelect(rowId)}
            class="table-row-checkbox"
            aria-label={`Select row ${rowId}`}
          />
        </td>
      {/if}
      {#each $columns as column (column.id)}
        <td class="table-cell" style={column.width ? `width: ${column.width}` : ''}>
          {getCellValue(row, column)}
        </td>
      {/each}
    </tr>
  {/each}
</tbody>

<style>
  .table-body {
    display: contents;
  }

  .table-row {
    display: contents;
    cursor: pointer;
  }

  .table-row:hover > :not(.table-checkbox-cell) {
    background-color: var(--color-surface-hover);
  }

  .table-row.selected > td {
    background-color: var(--color-primary-light);
  }

  .table-checkbox-cell {
    width: 50px;
    text-align: center;
    padding: 0.75rem;
    border-right: 1px solid var(--color-border);
  }

  .table-cell {
    padding: 1rem;
    border-right: 1px solid var(--color-border);
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text);
  }

  .table-cell:last-child {
    border-right: none;
  }

  .table-row-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }
</style>
