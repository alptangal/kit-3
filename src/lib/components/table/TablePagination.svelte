<script lang="ts">
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';

  interface TableContext {
    currentPage: Writable<number>;
    pageSize: Writable<number>;
    totalPages: Writable<number>;
  }

  interface Props {
    onPageChange?: (page: number) => void;
  }

  let { onPageChange }: Props = $props();

  const context = getContext<TableContext>('table');
  const { currentPage, pageSize, totalPages } = context;

  function goToPage(page: number) {
    if (page >= 1 && page <= $totalPages) {
      currentPage.set(page);
      onPageChange?.(page);
    }
  }

  function previousPage() {
    goToPage($currentPage - 1);
  }

  function nextPage() {
    goToPage($currentPage + 1);
  }

  $effect(() => {
    // Reset to first page if current page exceeds total pages
    if ($currentPage > $totalPages && $totalPages > 0) {
      currentPage.set(1);
    }
  });
</script>

<div class="pagination">
  <button
    class="pagination-button"
    onclick={previousPage}
    disabled={$currentPage <= 1}
    aria-label="Previous page"
  >
    ← Previous
  </button>

  <div class="pagination-info">
    <span>Page <strong>{$currentPage}</strong> of <strong>{$totalPages}</strong></span>
    <span class="pagination-separator">•</span>
    <span>{$pageSize} per page</span>
  </div>

  <button
    class="pagination-button"
    onclick={nextPage}
    disabled={$currentPage >= $totalPages}
    aria-label="Next page"
  >
    Next →
  </button>
</div>

<style>
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-top: 1px solid var(--color-border);
    background-color: var(--color-surface);
    gap: 1rem;
  }

  .pagination-button {
    padding: 0.5rem 1rem;
    background-color: var(--color-primary);
    color: white;
    border: none;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .pagination-button:hover:not(:disabled) {
    background-color: var(--color-primary-hover);
  }

  .pagination-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .pagination-separator {
    opacity: 0.5;
  }
</style>
