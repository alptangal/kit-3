<!-- src/routes/ui/datatable/+page.svelte -->
<!-- DataTable demo (Svelte 5, composite mới). -->
<script lang="ts">
	import { DataTable } from '$components/element';
	import type { DataTableColumn } from '$components/element';

	interface Product {
		id: string;
		name: string;
		category: string;
		price: number;
		stock: number;
		status: 'active' | 'inactive' | 'out';
	}

	const products: Product[] = [
		{ id: 'p1', name: 'Laptop', category: 'Electronics', price: 999, stock: 15, status: 'active' },
		{ id: 'p2', name: 'Keyboard', category: 'Electronics', price: 89, stock: 45, status: 'active' },
		{ id: 'p3', name: 'Mouse', category: 'Electronics', price: 29, stock: 120, status: 'active' },
		{ id: 'p4', name: 'Monitor', category: 'Electronics', price: 399, stock: 8, status: 'inactive' },
		{ id: 'p5', name: 'Desk Chair', category: 'Furniture', price: 249, stock: 5, status: 'active' },
		{ id: 'p6', name: 'Desk', category: 'Furniture', price: 499, stock: 3, status: 'out' },
		{ id: 'p7', name: 'USB Cable', category: 'Accessories', price: 9, stock: 200, status: 'active' },
		{ id: 'p8', name: 'HDMI Cable', category: 'Accessories', price: 12, stock: 150, status: 'active' },
		{ id: 'p9', name: 'Webcam', category: 'Electronics', price: 79, stock: 25, status: 'active' },
		{ id: 'p10', name: 'Microphone', category: 'Electronics', price: 149, stock: 30, status: 'active' },
		{ id: 'p11', name: 'Speaker', category: 'Electronics', price: 199, stock: 0, status: 'out' },
		{ id: 'p12', name: 'Headphones', category: 'Electronics', price: 179, stock: 40, status: 'active' },
		{ id: 'p13', name: 'Bookshelf', category: 'Furniture', price: 329, stock: 12, status: 'active' },
		{ id: 'p14', name: 'Lamp', category: 'Furniture', price: 59, stock: 60, status: 'active' },
		{ id: 'p15', name: 'Cable Organizer', category: 'Accessories', price: 19, stock: 80, status: 'active' }
	];

	const columns: DataTableColumn<Product>[] = [
		{ id: 'name', label: 'Product', accessor: 'name', sortable: true, width: '180px' },
		{ id: 'category', label: 'Category', accessor: 'category', sortable: true },
		{
			id: 'price',
			label: 'Price',
			accessor: 'price',
			sortable: true,
			align: 'right',
			noHighlight: true,
			render: (v) => `$${v}`
		},
		{
			id: 'stock',
			label: 'Stock',
			accessor: 'stock',
			sortable: true,
			align: 'right',
			noHighlight: true
		},
		{
			id: 'status',
			label: 'Status',
			accessor: 'status',
			status: (v) => (v === 'active' ? 'success' : v === 'out' ? 'danger' : 'warning')
		}
	];

	// (4) empty + loading cases dùng dataset riêng.
	const emptyProducts: Product[] = [];

	// DataTable root type (Record<string, unknown>) — cast demo Product[]/columns
	// để khớp prop mà không mất type trong code demo.
	const productsAny = products as unknown as Record<string, unknown>[];
	const columnsAny = columns as unknown as DataTableColumn<Record<string, unknown>>[];
	const emptyProductsAny = emptyProducts as unknown as Record<string, unknown>[];

	// state debug cho case 1 (probe đọc qua data-test).
	let lastSort = $state<string | ''>('');
	let demoPage = $state<number>(1); // bind:page — phản ánh page thật (kể cả reset khi sort)
	let lastSize = $state<number>(10);
	let lastSelection = $state<string[]>([]);
</script>

<div class="page" data-test="datatable-demo">
	<h1 class="page-title">DataTable · Svelte 5 (sort + filter + pagination + selection)</h1>

	<!-- (1) Full: sortable + searchable + selectable + status pill + pageSize 10 -->
	<section class="demo" data-test="dt-basic">
		<h2>Full (15 row · sort + search + select + status · pageSize 10)</h2>
		<p class="demo-hint">Click header sort (asc/desc, reset page=1), ô search filter mọi cột, checkbox chọn row + select-all, status pill (success/danger/warning).</p>
		<DataTable
			data={productsAny}
			columns={columnsAny}
			pageSize={10}
			pageSizeOptions={[5, 10, 20]}
			sortable
			searchable
			selectable
			caption={ { vi: 'Sản phẩm', en: 'Products' } }
			aria-label="Bảng sản phẩm"
			getRowId={(r, i) => (r as unknown as Product).id ?? String(i)}
			bind:page={demoPage}
			onSortChange={(id) => (lastSort = id)}
			onPageSizeChange={(s) => (lastSize = s)}
			onSelectionChange={(ids) => (lastSelection = ids)}
		/>
		<div class="state" data-test="dt-basic-state">
			<span data-test="dt-sort">{lastSort || 'none'}</span>
			<span data-test="dt-page">Trang {demoPage}</span>
			<span data-test="dt-size">Size {lastSize}</span>
			<span data-test="dt-selected">Chọn {lastSelection.length}</span>
		</div>
	</section>

	<!-- (2) Density compact -->
	<section class="demo" data-test="dt-compact">
		<h2>Density compact (padding cell hẹp)</h2>
		<p class="demo-hint">density="compact" thu hẹp --cell-pad-y/x; size="sm" font nhỏ hơn default.</p>
		<DataTable
			data={productsAny}
			columns={columnsAny}
			pageSize={5}
			pageSizeOptions={[5, 10]}
			density="compact"
			size="sm"
			caption={ { vi: 'Sản phẩm (compact)', en: 'Products (compact)' } }
		/>
	</section>

	<!-- (3) Sort (focus) + align right số -->
	<section class="demo" data-test="dt-sort-view">
		<h2>Sort + align (nền "Price" click)</h2>
		<p class="demo-hint">Chỉ sortable (không search/select). Cột số align="right".</p>
		<DataTable
			data={productsAny}
			columns={columnsAny}
			pageSize={5}
			sortable
			caption={ { vi: 'Sắp xếp', en: 'Sort view' } }
		/>
	</section>

	<!-- (4) Empty data -->
	<section class="demo" data-test="dt-empty">
		<h2>Empty (data=[])</h2>
		<p class="demo-hint">data rỗng → row empty full-span muted "Không có dữ liệu".</p>
		<DataTable data={emptyProductsAny} columns={columnsAny} pageSize={5} caption={ { vi: 'Rỗng', en: 'Empty' } } />
	</section>

	<!-- (5) Loading state -->
	<section class="demo" data-test="dt-loading">
		<h2>Loading (placeholder)</h2>
		<p class="demo-hint">loading → row skeleton muted (reduced-motion: không blink).</p>
		<DataTable data={productsAny} columns={columnsAny} pageSize={5} loading caption={ { vi: 'Đang tải', en: 'Loading' } } />
	</section>
</div>

<style lang="scss">
	.page {
		max-width: 46rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}
	.demo {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.demo h2 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}
	.demo-hint {
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
		margin: 0;
	}
	.state {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}
</style>
