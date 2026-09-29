<script lang="ts">
  import { Table, TableHead, TableBody, TablePagination, type TableColumn } from '$lib/components/table';

  interface Product {
    id: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    status: 'active' | 'inactive';
  }

  const sampleData: Product[] = [
    { id: '1', name: 'Laptop', category: 'Electronics', price: 999, stock: 15, status: 'active' },
    { id: '2', name: 'Keyboard', category: 'Electronics', price: 89, stock: 45, status: 'active' },
    { id: '3', name: 'Mouse', category: 'Electronics', price: 29, stock: 120, status: 'active' },
    { id: '4', name: 'Monitor', category: 'Electronics', price: 399, stock: 8, status: 'inactive' },
    { id: '5', name: 'Desk Chair', category: 'Furniture', price: 249, stock: 5, status: 'active' },
    { id: '6', name: 'Desk', category: 'Furniture', price: 499, stock: 3, status: 'active' },
    { id: '7', name: 'USB Cable', category: 'Accessories', price: 9, stock: 200, status: 'active' },
    { id: '8', name: 'HDMI Cable', category: 'Accessories', price: 12, stock: 150, status: 'active' },
    { id: '9', name: 'Webcam', category: 'Electronics', price: 79, stock: 25, status: 'active' },
    { id: '10', name: 'Microphone', category: 'Electronics', price: 149, stock: 30, status: 'active' },
    { id: '11', name: 'Speaker', category: 'Electronics', price: 199, stock: 0, status: 'inactive' },
    { id: '12', name: 'Headphones', category: 'Electronics', price: 179, stock: 40, status: 'active' },
  ];

  const columns: TableColumn<Product>[] = [
    { id: 'name', label: 'Product Name', accessor: 'name', sortable: true, width: '200px' },
    { id: 'category', label: 'Category', accessor: 'category', sortable: true, width: '150px' },
    { id: 'price', label: 'Price', accessor: 'price', sortable: true, width: '100px' },
    { id: 'stock', label: 'Stock', accessor: 'stock', sortable: true, width: '80px' },
    {
      id: 'status',
      label: 'Status',
      accessor: 'status',
      sortable: true,
      width: '100px',
    },
  ];

  let selectedItems = $state<string[]>([]);
  let currentSort = $state<string | null>(null);
  let isLoading = $state(false);

  function handleSort(columnId: string) {
    currentSort = columnId;
  }

  function handlePageChange(page: number) {
    console.log('Page changed to:', page);
  }

  function handleSelectionChange(selected: string[]) {
    selectedItems = selected;
    console.log('Selected items:', selected);
  }

  function handleSelectAll() {
    const allIds = sampleData.map((_, i) => String(i));
    selectedItems = allIds;
  }

  function handleClearSelection() {
    selectedItems = [];
  }
</script>

<div class="demo-container">
  <h1>Table Component</h1>

  <section class="demo-section">
    <h2>Products Table</h2>
    <p class="description">Interactive table with sorting, pagination, and row selection:</p>

    <Table data={sampleData} columns={columns} pageSize={5} sortable={true} selectable={true}>
      {#snippet children(tableProps)}
        <table class="demo-table">
          <TableHead
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            selectable={true}
            allSelected={selectedItems.length === sampleData.length && sampleData.length > 0}
          />
          <TableBody selectable={true} onRowSelect={() => {}} />
        </table>
        <TablePagination onPageChange={handlePageChange} />
      {/snippet}
    </Table>

    <div class="state-display">
      <p><strong>Current Sort:</strong> {currentSort || 'None'}</p>
      <p><strong>Selected Rows:</strong> {selectedItems.length} / {sampleData.length}</p>
      {#if selectedItems.length > 0}
        <p class="selected-ids">Selected IDs: {selectedItems.join(', ')}</p>
      {/if}
    </div>
  </section>

  <section class="demo-section">
    <h2>Features</h2>
    <ul class="features-list">
      <li>✓ Click column headers to sort ascending/descending</li>
      <li>✓ Pagination with configurable page size</li>
      <li>✓ Select individual rows or all rows at once</li>
      <li>✓ Row highlighting on hover and selection</li>
      <li>✓ Responsive column widths</li>
      <li>✓ Loading state support</li>
      <li>✓ Custom cell rendering with slots</li>
      <li>✓ Accessibility with keyboard navigation</li>
    </ul>
  </section>

  <section class="demo-section">
    <h2>Keyboard Navigation</h2>
    <div class="keyboard-guide">
      <ul>
        <li><kbd>Tab</kbd> - Navigate to next interactive element</li>
        <li><kbd>Shift + Tab</kbd> - Navigate to previous element</li>
        <li><kbd>Space</kbd> - Toggle checkbox</li>
        <li><kbd>Enter</kbd> - Activate button</li>
        <li><kbd>Click</kbd> - Sort column, select row, or change page</li>
      </ul>
    </div>
  </section>

  <section class="demo-section">
    <h2>Manual Test Checklist</h2>
    <div class="checklist">
      <label>
        <input type="checkbox" disabled />
        Click column header to sort
      </label>
      <label>
        <input type="checkbox" disabled />
        Click again to reverse sort order
      </label>
      <label>
        <input type="checkbox" disabled />
        Click row to select/deselect
      </label>
      <label>
        <input type="checkbox" disabled />
        Select all checkbox selects visible rows
      </label>
      <label>
        <input type="checkbox" disabled />
        Previous/Next buttons change page
      </label>
      <label>
        <input type="checkbox" disabled />
        Selected state persists across pages
      </label>
      <label>
        <input type="checkbox" disabled />
        Row highlights on hover
      </label>
      <label>
        <input type="checkbox" disabled />
        Selected rows show with primary color
      </label>
    </div>
  </section>
</div>

<style>
  .demo-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
      Arial, sans-serif;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 1.5rem;
    color: var(--color-text);
  }

  h2 {
    font-size: 1.5rem;
    margin-top: 2rem;
    margin-bottom: 1rem;
    color: var(--color-text);
  }

  .demo-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    border-radius: 8px;
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
  }

  .description {
    margin: 0 0 1rem 0;
    color: var(--color-text-secondary);
    font-size: 0.95rem;
  }

  .demo-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }

  .state-display {
    padding: 1rem;
    margin-top: 1rem;
    background-color: var(--color-surface-accent);
    border-radius: 6px;
    border-left: 3px solid var(--color-primary);
  }

  .state-display p {
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }

  .selected-ids {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .features-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .features-list li {
    padding: 0.5rem 0;
    color: var(--color-text);
  }

  .keyboard-guide {
    background-color: var(--color-surface-accent);
    padding: 1rem;
    border-radius: 6px;
    border-left: 3px solid var(--color-info);
  }

  .keyboard-guide ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .keyboard-guide li {
    padding: 0.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  kbd {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.85rem;
    font-weight: 500;
    min-width: 80px;
    text-align: center;
  }

  .checklist {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .checklist label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background-color 100ms ease;
  }

  .checklist label:hover {
    background-color: var(--color-surface-hover);
  }

  .checklist input[type='checkbox'] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary);
  }

  @media (prefers-color-scheme: dark) {
    :global(body) {
      --color-surface: #1e1e1e;
      --color-surface-hover: #2d2d2d;
      --color-surface-accent: #252525;
      --color-text: #e4e4e4;
      --color-text-secondary: #a0a0a0;
      --color-border: #3a3a3a;
      --color-primary: #0ea5e9;
      --color-info: #0ea5e9;
      --color-primary-light: #0ea5e911;
      --color-primary-hover: #0284c7;
    }
  }

  @media (prefers-color-scheme: light) {
    :global(body) {
      --color-surface: #ffffff;
      --color-surface-hover: #f5f5f5;
      --color-surface-accent: #f9f9f9;
      --color-text: #1f2937;
      --color-text-secondary: #6b7280;
      --color-border: #e5e7eb;
      --color-primary: #3b82f6;
      --color-info: #0ea5e9;
      --color-primary-light: #3b82f611;
      --color-primary-hover: #2563eb;
    }
  }
</style>
