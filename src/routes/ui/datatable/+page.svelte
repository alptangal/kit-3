<!-- src/routes/ui/datatable/+page.svelte -->
<!-- DataTable demo (Svelte 5, composite mới): live data + edit cell + row actions
     (update/delete) + mobile expand actions + lazy load + visual zebra/hover/border. -->
<script lang="ts">
	import { DataTable, AlertDialog } from '$components/element';
	import type { DataTableColumn } from '$components/element';

	interface Product {
		id: string;
		name: string;
		category: string;
		price: number;
		stock: number;
		status: 'active' | 'inactive' | 'out';
	}

	let products = $state<Product[]>([
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
	]);

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
	const productsAny = $derived(products as unknown as Record<string, unknown>[]);
	const columnsAny = columns as unknown as DataTableColumn<Record<string, unknown>>[];
	const emptyProductsAny = emptyProducts as unknown as Record<string, unknown>[];

	// state debug cho case 1 (probe đọc qua data-test).
	let lastSort = $state<string | ''>('');
	let demoPage = $state<number>(1); // bind:page — phản ánh page thật (kể cả reset khi sort)
	let lastSize = $state<number>(10);
	let lastSelection = $state<string[]>([]);

	// state debug mới: cell update / row update / row delete.
	let lastCellUpdate = $state<string>('');
	let lastRowUpdate = $state<string>('');
	let lastRowDelete = $state<string>('');

	// ── (1a) LIVE DATA: nút "thêm row" + interval tự động ──
	let autoAdd = $state<boolean>(false);
	let autoTimer: ReturnType<typeof setInterval> | undefined = undefined;
	let addCounter = $state<number>(0);

	const addRow = (): void => {
		addCounter += 1;
		const n = products.length + 1;
		products.push({
			id: `new-${addCounter}`,
			name: `New Item ${n}`,
			category: 'New',
			price: Math.round(Math.random() * 500),
			stock: Math.round(Math.random() * 100),
			status: 'active'
		});
	};

	const toggleAuto = (): void => {
		autoAdd = !autoAdd;
		if (autoAdd) {
			autoTimer = setInterval(addRow, 2000);
		} else if (autoTimer) {
			clearInterval(autoTimer);
			autoTimer = undefined;
		}
	};

	// ── (2) EDIT CELL + ROW UPDATE/DELETE callbacks ──
	const handleCellUpdate = (row: Record<string, unknown>, columnId: string, oldValue: unknown, newValue: unknown): void => {
		lastCellUpdate = `${(row as unknown as Product).id}:${columnId}:${String(oldValue)}→${String(newValue)}`;
	};

	const handleRowUpdate = (row: Record<string, unknown>, rowId: string): void => {
		lastRowUpdate = String((row as unknown as Product).id ?? rowId);
	};

	const handleRowDelete = (row: Record<string, unknown>, rowId: string): void => {
		lastRowDelete = String((row as unknown as Product).id ?? rowId);
	};

	// ── (4) LAZY LOAD: thêm page 10 row giả lập fetch ──
	const lazyProducts = $state<Product[]>(
		Array.from({ length: 10 }, (_, i) => ({
			id: `l1-${i + 1}`,
			name: `Lazy Item ${i + 1}`,
			category: 'Lazy',
			price: 100 + i,
			stock: i * 3,
			status: i % 3 === 0 ? 'out' : i % 3 === 1 ? 'inactive' : 'active'
		}) as Product)
	);

	let lazyPage = $state<number>(1);
	let lazyLoadCount = $state<number>(0); // debug: số lần onLoadMore được gọi
	const lazyProductsAny = $derived(lazyProducts as unknown as Record<string, unknown>[]);

	const loadMoreLazy = (): Promise<void> => {
		lazyLoadCount += 1;
		lazyPage += 1;
		// Giả lập fetch page mới (10 row) — sau 5 page thì hết data.
		// Trả Promise thật (resolve sau khi push) để component đo hasMore đúng
		// (resolve đồng bộ → đo data.length trước khi thêm → sai).
		const hasMore = lazyPage < 5;
		return new Promise((resolve) => {
			setTimeout(() => {
				if (hasMore) {
					for (let i = 0; i < 10; i++) {
						lazyProducts.push({
							id: `l${lazyPage}-${i + 1}`,
							name: `Lazy Item ${lazyProducts.length + 1}`,
							category: `Page ${lazyPage}`,
							price: 100 + lazyProducts.length,
							stock: i,
							status: i % 3 === 0 ? 'out' : i % 3 === 1 ? 'inactive' : 'active'
						});
					}
				}
				resolve();
			}, 300);
		});
	};

	// onDestroy: dọn interval khi rời trang.
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (autoTimer) clearInterval(autoTimer);
	});
</script>

<div class="page" data-test="datatable-demo">
	<h1 class="page-title">DataTable · Svelte 5 (live data + edit + row actions + lazy load + visual)</h1>

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

	<!-- (1a) LIVE DATA: thêm row + interval + giữ sort/filter -->
	<section class="demo" data-test="dt-live">
		<h2>Live data (thêm row động · sort/filter giữ ổn định)</h2>
		<p class="demo-hint">data là $state — push thêm row → table re-render; đang sort thì sort đúng; edit đang mở không mất.</p>
		<div class="demo-controls">
			<button type="button" class="ctl-btn" data-test="dt-add-row" onclick={addRow}>+ Thêm row</button>
			<button type="button" class="ctl-btn" data-test="dt-toggle-auto" onclick={toggleAuto}>
				{autoAdd ? 'Dừng auto' : 'Auto thêm 2s'}
			</button>
			<span class="demo-hint" data-test="dt-row-count">{products.length} row</span>
		</div>
		<DataTable
			data={productsAny}
			columns={columnsAny}
			pageSize={5}
			sortable
			searchable
			caption={ { vi: 'Live', en: 'Live' } }
		/>
	</section>

	<!-- (2) EDIT CELL + ROW ACTIONS (PC hover → ✎/🗑, confirm AlertDialog) -->
	<section class="demo" data-test="dt-edit">
		<h2>Edit cell + row actions (PC hover → ✎ / 🗑)</h2>
		<p class="demo-hint">Click cell giá trị → inline input + ✓/✕ (Enter=confirm, Escape=cancel). Hover row → nút edit/delete; delete có AlertDialog xác nhận.</p>
		<DataTable
			data={productsAny}
			columns={columnsAny}
			pageSize={5}
			rowActions
			editable
			sortable
			caption={ { vi: 'Chỉnh sửa', en: 'Editable' } }
			getRowId={(r, i) => (r as unknown as Product).id ?? String(i)}
			onCellUpdate={handleCellUpdate}
			onRowUpdate={handleRowUpdate}
			onRowDelete={handleRowDelete}
		/>
		<div class="state" data-test="dt-edit-state">
			<span data-test="dt-cell-update">{lastCellUpdate || 'none'}</span>
			<span data-test="dt-row-update">{lastRowUpdate || 'none'}</span>
			<span data-test="dt-row-delete">{lastRowDelete || 'none'}</span>
		</div>
	</section>

	<!-- (2b) Density compact (giữ nguyên từ demo cũ) -->
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

	<!-- (2c) Sort (focus) + align right số (giữ nguyên) -->
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

	<!-- (3) LAZY LOAD: infinite scroll + nút load more -->
	<section class="demo" data-test="dt-lazy">
		<h2>Lazy load (scroll cuối → load thêm · nút "Tải thêm")</h2>
		<p class="demo-hint">lazyLoad — IntersectionObserver sentinel cuối bảng + nút load more; hết data → ẩn nút.</p>
		<DataTable
			data={lazyProductsAny}
			columns={columnsAny}
			pageSize={10}
			sortable
			lazyLoad={ { enabled: true, onLoadMore: loadMoreLazy } }
			caption={ { vi: 'Lazy load', en: 'Lazy load' } }
		/>
		<div class="state" data-test="dt-lazy-state">
			<span data-test="dt-lazy-count">Load {lazyLoadCount} lần</span>
			<span data-test="dt-lazy-rows">{lazyProducts.length} row</span>
		</div>
	</section>

	<!-- (4) VISUAL: zebra + hover + bordered columns -->
	<section class="demo" data-test="dt-visual">
		<h2>Visual (zebra + hover + border column)</h2>
		<p class="demo-hint">visual striped + hoverable + bordered — row lẻ nền alt, hover highlight, viền dọc cột.</p>
		<DataTable
			data={productsAny}
			columns={columnsAny}
			pageSize={5}
			visual={ { striped: true, hoverable: true, bordered: true } }
			caption={ { vi: 'Visual', en: 'Visual' } }
		/>
	</section>

	<!-- (5) Empty data -->
	<section class="demo" data-test="dt-empty">
		<h2>Empty (data=[])</h2>
		<p class="demo-hint">data rỗng → row empty full-span muted "Không có dữ liệu".</p>
		<DataTable data={emptyProductsAny} columns={columnsAny} pageSize={5} caption={ { vi: 'Rỗng', en: 'Empty' } } />
	</section>

	<!-- (6) Loading state -->
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
	.demo-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.ctl-btn {
		display: inline-flex;
		align-items: center;
		min-height: 2rem;
		padding: 0 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--foreground);
		background: var(--content1, #fff);
		border: 1px solid var(--content3, hsl(240 5.88% 90%));
		border-radius: var(--border-radius-sm, 0.375rem);
		cursor: var(--cursor-interactive, pointer);

		@media (hover: hover) and (pointer: fine) {
			&:hover {
				background: var(--content2, hsl(240 4.76% 95.88%));
			}
		}
	}
	.state {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: var(--muted, var(--foreground));
	}
</style>
