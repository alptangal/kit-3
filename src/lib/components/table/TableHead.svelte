<script lang="ts">
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { TableColumn } from './table-logic';

  interface TableContext<T> {
    columns: Writable<TableColumn<T>[]>;
    sortBy: Writable<string | null>;
    sortOrder: Writable<'asc' | 'desc'>;
    selectedRows: Writable<Set<string>>;
    onSortChange?: (columnId: string) => void;
  }

  interface Props {
    onSelectAll?: () => void;
    onClearSelection?: () => void;
    selectable?: boolean;
    allSelected?: boolean;
  }

  let { onSelectAll, onClearSelection, selectable = true, allSelected = false }: Props = $props();

  const context = getContext<TableContext<any>>('table');
  const { columns, sortBy, sortOrder, onSortChange } = context;

  function handleSort(columnId: string) {
    onSortChange?.(columnId);
  }

  function handleSelectAll() {
    if (allSelected) {
      onClearSelection?.();
    } else {
      onSelectAll?.();
    }
  }
</script>

<thead class="table-head">
  <tr>
    {#if selectable}
      <th class="table-checkbox-cell">
        <input
          type="checkbox"
          checked={allSelected}
          onchange={handleSelectAll}
          class="table-select-all"
          aria-label="Select all rows"
        />
      </th>
    {/if}
    {#each $columns as column (column.id)}
      <th
        class="table-header-cell"
        class:sortable={column.sortable}
        class:sorted={$sortBy === column.id}
        onclick={() => column.sortable && handleSort(column.id)}
      >
        <div class="header-content">
          <span>{column.label}</span>
          {#if column.sortable && $sortBy === column.id}
            <span class="sort-icon" aria-hidden="true">
              {$sortOrder === 'asc' ? '↑' : '↓'}
            </span>
          {/if}
        </div>
      </th>
    {/each}
  </tr>
</thead>

<style>
  .table-head {
    background-color: var(--color-surface-accent);
    border-bottom: 2px solid var(--color-border);
  }

  tr {
    display: contents;
  }

  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--color-text);
    border-right: 1px solid var(--color-border);
  }

  th:last-child {
    border-right: none;
  }

  .table-checkbox-cell {
    width: 50px;
    text-align: center;
    padding: 0.75rem;
  }

  .table-header-cell {
    cursor: default;
    user-select: none;
  }

  .table-header-cell.sortable {
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .table-header-cell.sortable:hover {
    background-color: var(--color-surface-hover);
  }

  .table-header-cell.sorted {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .sort-icon {
    font-size: 0.75rem;
    font-weight: bold;
  }

  .table-select-all {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }
</style>
