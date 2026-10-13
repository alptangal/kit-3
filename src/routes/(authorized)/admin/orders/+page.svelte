<!-- src/routes/(authorized)/admin/orders/+page.svelte -->
<script lang="ts">
	// B6.2: migrate sang DataTable + Pagination (pattern customers/users/variants).
	// Giữ nguyên: stats bar (4 card + status breakdown), 3 modal
	// (detail/status/delete), _interface.ts (AdminOrderRow, getStatusLabel/Color,
	// formatCurrency, formatDate, getRowDocumentKey). FIX BUG pre-existing: page
	// cũ dùng bảng <table> thuần — thêm search + filter trạng thái (server-side
	// nếu endpoint hỗ trợ, không thì lọc client — body vẫn gửi search/status).
	import { onMount } from 'svelte';
	import { Button, DataTable, Pagination } from '$components/element';
	import { Input } from '$components/form';
	import { Checkbox } from '$components/form/checkbox';
	import { Modal } from '$components/modal';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import type { DataTableColumn } from '$components/element/datatable';
	import type { Size } from '$components/interface';
	import {
		getRowDocumentKey,
		formatCurrency,
		formatDate,
		getStatusLabel,
		getStatusColor,
		resolveServerMessage,
		pageContents,
		type AdminOrderRow,
		type AdminOrdersStats
	} from './_interface';

	import { subscribeDbChanges } from '$modules/db-realtime';
	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Cặp khoá RSA cho mọi fetchSecure trên trang ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Trạng thái danh sách ──
	let orders = $state<AdminOrderRow[]>([]);
	let total = $state(0);
	let page = $state(1);
	let pageSize = $state(20);
	let includeDeleted = $state(false);
	let searchQuery = $state('');
	let selectedStatus = $state('');
	// true ngay từ đầu — tránh flash empty-state trước khi onMount kịp sinh khoá + fetch
	let loading = $state(true);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);

	// ── Stats ──
	let stats = $state<AdminOrdersStats | null>(null);
	let statsLoading = $state(true);

	// ── Modal chi tiết ──
	let detailModalDisplay = $state(false);
	let detailModalOrder = $state<AdminOrderRow | null>(null);

	// ── Modal đổi trạng thái ──
	let statusModalDisplay = $state(false);
	let statusModalOrder = $state<AdminOrderRow | null>(null);
	let statusModalValue = $state('');
	let statusModalBusy = $state(false);

	// ── Modal xoá ──
	let deleteModalDisplay = $state(false);
	let deleteModalOrder = $state<AdminOrderRow | null>(null);
	let deleteModalBusy = $state(false);

	// ── Derived ──
	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const pageInfoText = $derived(
		pageContents.pagination.pageInfo[lang].replace('{page}', String(page)).replace('{total}', String(totalPages))
	);
	const totalCountText = $derived(
		pageContents.pagination.totalCount[lang].replace('{total}', String(total))
	);

	// Trạng thái đơn là enum cứng (pending/confirmed/shipped/delivered/cancelled)
	// — không cần endpoint catalog như customers.
	const orderStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;

	// Label filters — orders/_interface.ts không có nhóm `filters` (khác customers)
	// → khai báo cục bộ theo shape TranslateContent.
	const searchPlaceholder = {
		vi: 'Tìm đơn hàng (mã, khách hàng)…',
		en: 'Search orders (code, customer)…'
	} as const;
	const allStatusesLabel = {
		vi: 'Tất cả trạng thái',
		en: 'All statuses'
	} as const;

	function isRowDeleted(row: AdminOrderRow): boolean {
		return Boolean(row.deletedAt);
	}

	// ── Gọi API ──
	async function loadStats() {
		if (!encryptionKeys) return;
		statsLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/orders/stats',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			statsLoading = false;
			if (response.ok) {
				stats = response.data as AdminOrdersStats;
			}
		} catch (err) {
			statsLoading = false;
			if (import.meta.env.DEV) console.error('[orders] stats failed:', err);
		}
	}

	async function loadOrders() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/orders/list',
				{
					method: 'POST',
					body: {
						page,
						pageSize,
						includeDeleted,
						search: searchQuery || undefined,
						status: selectedStatus || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| {
							orders?: AdminOrderRow[];
							items?: AdminOrderRow[];
							total?: number;
							page?: number;
							pageSize?: number;
					  }
					| undefined;
				orders = data?.orders ?? data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number' && data.page !== page) {
					// response gán lại page (server clamp) — chặn effect refetch
					pendingPageApply = true;
					page = data.page;
				}
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, {
					vi: 'Không tải được danh sách đơn hàng',
					en: 'Failed to load order list'
				});
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, {
				vi: 'Không tải được danh sách đơn hàng',
				en: 'Failed to load order list'
			});
			if (import.meta.env.DEV) console.error('[orders] load failed:', err);
		}
	}

	async function refresh() {
		await Promise.all([loadOrders(), loadStats()]);
	}

	/** Gọi 1 thao tác hàng (set-status, delete) */
	async function runRowAction(
		url: string,
		body: Record<string, unknown>,
		successKey: string
	): Promise<boolean> {
		if (!encryptionKeys) return false;
		try {
			const response = await encryption.fetchSecure(url, { method: 'POST', body }, encryptionKeys);
			if (response.ok) {
				client.browser?.toasts?.create({
					title: response.message
						? resolveServerMessage(response.message, lang, {
								vi: pageContents.toasts[successKey].vi,
								en: pageContents.toasts[successKey].en
							})
						: pageContents.toasts[successKey][lang],
					color: 'success'
				});
				return true;
			}
			client.browser?.toasts?.create({
				title: resolveServerMessage(response.message, lang, {
					vi: pageContents.toasts.actionFailed.vi,
					en: pageContents.toasts.actionFailed.en
				}),
				color: 'error'
			});
			return false;
		} catch (err) {
			if (import.meta.env.DEV) console.error(`[orders] ${url} failed:`, err);
			client.browser?.toasts?.create({
				title: pageContents.toasts.requestFailed[lang],
				color: 'error'
			});
			return false;
		}
	}

	// ── Handlers mở modal ──
	function openDetailModal(row: AdminOrderRow) {
		detailModalOrder = row;
		detailModalDisplay = true;
	}

	function openStatusModal(row: AdminOrderRow) {
		statusModalOrder = row;
		statusModalValue = String(row.status ?? '');
		statusModalDisplay = true;
	}

	function openDeleteModal(row: AdminOrderRow) {
		deleteModalOrder = row;
		deleteModalDisplay = true;
	}

	// ── Handlers xác nhận trong modal ──
	async function confirmChangeStatus() {
		if (!statusModalOrder || statusModalBusy) return;
		statusModalBusy = true;
		const ok = await runRowAction(
			'/api/admin/orders/status',
			{ documentKey: getRowDocumentKey(statusModalOrder), status: statusModalValue },
			'statusChanged'
		);
		statusModalBusy = false;
		if (ok) {
			statusModalDisplay = false;
			await refresh();
		}
	}

	async function confirmDelete() {
		if (!deleteModalOrder || deleteModalBusy) return;
		deleteModalBusy = true;
		const ok = await runRowAction(
			'/api/admin/orders/delete',
			{ documentKey: getRowDocumentKey(deleteModalOrder) },
			'orderDeleted'
		);
		deleteModalBusy = false;
		if (ok) {
			deleteModalDisplay = false;
			await refresh();
		}
	}

	// ── Phân trang server-side ──
	// Pagination element chỉ có bindable page — theo dõi page + pageSize để
	// refetch. Chỉ chạy SAU lần đầu (tránh trùng onMount); pendingPageApply
	// bỏ qua lần response gán lại page (chống vòng lặp fetch).
	let paginationArmed = false;
	let pendingPageApply = false;
	$effect(() => {
		void page;
		void pageSize;
		if (!paginationArmed) {
			paginationArmed = true;
			return;
		}
		if (pendingPageApply) {
			pendingPageApply = false;
			return;
		}
		void loadOrders();
	});

	function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		page = 1;
		// effect theo dõi pageSize tự fetch
	}

	// ── Filters: search debounce + select status + checkbox (mỗi cái 1 effect
	//    riêng với guard armed + last-value — pattern customers/users page) ──
	let searchDebounce: ReturnType<typeof setTimeout>;
	let searchArmed = false;
	$effect(() => {
		void searchQuery;
		if (!searchArmed) {
			searchArmed = true;
			return;
		}
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			page = 1;
			void loadOrders();
		}, 300);
	});

	let statusFilterArmed = false;
	let lastStatus = '';
	$effect(() => {
		const current = selectedStatus;
		if (!statusFilterArmed) {
			statusFilterArmed = true;
			lastStatus = current;
			return;
		}
		if (current === lastStatus) return;
		lastStatus = current;
		page = 1;
		void loadOrders();
	});

	let deletedToggleArmed = false;
	let lastIncludeDeleted = false;
	$effect(() => {
		const current = includeDeleted;
		if (!deletedToggleArmed) {
			deletedToggleArmed = true;
			lastIncludeDeleted = current;
			return;
		}
		if (current === lastIncludeDeleted) return;
		lastIncludeDeleted = current;
		page = 1;
		void loadOrders();
	});

	// ── B6.2: DataTable columns (status pill qua col.status — 'error' → 'danger',
	//    'info'/'primary' giữ nguyên — DataTable hỗ trợ đủ bộ) ──
	function orderStatusColor(status?: string | null): 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'default' {
		const color = getStatusColor(status);
		return color === 'error' ? 'danger' : (color as 'success' | 'warning' | 'info' | 'primary' | 'default');
	}

	const ordersAny = $derived(orders as unknown as Record<string, unknown>[]);
	const allColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'orderCode',
			label: pageContents.table.orderCode[lang],
			accessor: (row) => String((row as unknown as AdminOrderRow).orderCode ?? '—')
		},
		{
			id: 'customer',
			label: pageContents.table.customer[lang],
			accessor: (row) => String((row as unknown as AdminOrderRow).customerId ?? '—')
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			accessor: (row) => getStatusLabel((row as unknown as AdminOrderRow).status),
			status: (_value, row) => orderStatusColor((row as unknown as AdminOrderRow).status)
		},
		{
			id: 'items',
			label: pageContents.table.items[lang],
			accessor: (row) => String((row as unknown as AdminOrderRow).items?.length ?? 0),
			sortable: false
		},
		{
			id: 'total',
			label: pageContents.table.total[lang],
			accessor: (row) => {
				const amount = (row as unknown as AdminOrderRow).totalAmount;
				return amount != null ? formatCurrency(amount, lang) : '—';
			},
			noHighlight: true
		},
		{
			id: 'created',
			label: pageContents.table.created[lang],
			accessor: (row) => formatDate((row as unknown as AdminOrderRow).createdAt, lang),
			noHighlight: true
		}
	]);
	// Mobile (375px): 6 cột bóp → giữ orderCode + status + total (đặc trưng đơn
	// hàng), bỏ customer/items/created.
	const isMobileViewport = $derived(client.browser?.isMobile ?? false);
	const columns = $derived(
		isMobileViewport
			? allColumns.filter((c) => !['customer', 'items', 'created'].includes(c.id))
			: allColumns
	);

	// Gộp class: defaultStyles snippet là (string|undefined)[] — lọc undefined
	// trước khi truyền vào Icon class (string[]). Helper nằm trong script
	// (không inline trong attribute) vì unocss parse attribute bằng acorn.
	function mergeIconClasses(
		styles: ReadonlyArray<string | undefined> | undefined,
		extra: string
	): string[] {
		return [...(styles ?? []).filter((c): c is string => typeof c === 'string'), extra];
	}

	function fillTemplate(text: string, name: string): string {
		return text.replace('{name}', name);
	}

	// B8 realtime: refetch list khi collection thay đổi từ client khác
	onMount(() => subscribeDbChanges('orders', () => void loadOrders()));
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadOrders(), loadStats()]);
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page">
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<div class="admin-header-actions">
			<Checkbox bind:checked={includeDeleted} disabled={loading}>
				{pageContents.showDeleted[lang]}
			</Checkbox>
		</div>
	</header>

	<!-- ── Stats bar ── -->
	<div class="admin-stats" role="region" aria-label={pageContents.stats.totalOrders[lang]}>
		<div class="stat-card">
			<span class="stat-label">{pageContents.stats.totalOrders[lang]}</span>
			<span class="stat-value">{stats?.totalOrders ?? (statsLoading ? '—' : '0')}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{pageContents.stats.todayOrders[lang]}</span>
			<span class="stat-value">{stats?.todayOrders ?? (statsLoading ? '—' : '0')}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{pageContents.stats.deliveredRevenue[lang]}</span>
			<span class="stat-value">{stats ? formatCurrency(stats.deliveredRevenue, lang) : (statsLoading ? '—' : '0 ₫')}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{pageContents.table.status[lang]}</span>
			<div class="stat-status-breakdown">
				{#if stats && Object.keys(stats.statusBreakdown).length > 0}
					{#each Object.entries(stats.statusBreakdown) as [status, count]}
						<span class="stat-status-chip status-{getStatusColor(status)}">
							{getStatusLabel(status)}: {count}
						</span>
					{/each}
				{:else}
					<span class="stat-status-chip">—</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<div class="admin-search">
			<Input placeholder={searchPlaceholder[lang]} bind:value={searchQuery}>
				{#snippet leading(data)}
					<Icon
						icon={iconify['search-rounded']}
						size={(data?.size ?? 'sm') as Size}
						class={mergeIconClasses(data?.defaultStyles, 'admin-search-icon')}
					/>
				{/snippet}
			</Input>
		</div>
		<select
			class="admin-select"
			bind:value={selectedStatus}
			aria-label={pageContents.table.status[lang]}
		>
			<option value="">{allStatusesLabel[lang]}</option>
			{#each orderStatuses as status (status)}
				<option value={status}>{getStatusLabel(status)}</option>
			{/each}
		</select>
	</div>

	<!-- ── B6.2: bảng đơn hàng — DataTable (component có sẵn)
	     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
	     Pagination element bên dưới bind:page điều khiển server. -->
	<div class="admin-table-wrap">
		<DataTable
			data={ordersAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.states.empty[lang]}
			loadingLabel={pageContents.states.loading[lang]}
			caption={{ vi: 'Danh sách đơn hàng', en: 'Order list' }}
			actionsLabel={pageContents.table.actions[lang]}
			stickyHead
			mobileTapMode="callback"
			onRowClick={(row) => openDetailModal(row as unknown as AdminOrderRow)}
			cardFields={['orderCode', 'customer', 'status', 'total', 'created']}
			data-test="orders-datatable"
		>
			{#snippet actionsContent(row)}
				{@const order = row as unknown as AdminOrderRow}
				<div class="row-actions">
					{#if includeDeleted && isRowDeleted(order)}
						<!-- Không có restore cho đơn hàng, chỉ xoá mềm -->
					{:else}
						<Button
							color="default"
							variant="ghost"
							size="sm"
							onClick={() => openDetailModal(order)}
							data-test="order-action-detail"
						>
							{pageContents.modals.detailTitle[lang]}
						</Button>
						<Button
							color="default"
							variant="ghost"
							size="sm"
							onClick={() => openStatusModal(order)}
							data-test="order-action-status"
						>
							{pageContents.modals.statusTitle[lang]}
						</Button>
						<Button
							color="error"
							variant="ghost"
							size="sm"
							onClick={() => openDeleteModal(order)}
							data-test="order-action-delete"
						>
							{pageContents.modals.deleteTitle[lang]}
						</Button>
					{/if}
				</div>
			{/snippet}
		</DataTable>
	</div>

	<!-- ── Phân trang (server-side) ── -->
	<footer class="admin-pagination">
		<span class="total-count">{totalCountText}</span>
		<div class="page-controls">
			<Pagination
				bind:page={page}
				totalPages={totalPages}
				loading={loading}
				variant="compact"
				prevLabel={pageContents.pagination.prev[lang]}
				nextLabel={pageContents.pagination.next[lang]}
				aria-label={pageContents.title[lang]}
			/>
			<span class="page-info">{pageInfoText}</span>
			<label class="page-size">
				<span class="page-size-label">{pageContents.pagination.pageSizeLabel[lang]}</span>
				<select
					class="admin-select"
					value={pageSize}
					onchange={(e) => changePageSize(Number((e.currentTarget as HTMLSelectElement).value))}
				>
					{#each [10, 20, 50, 100] as size (size)}
						<option value={size}>{size}</option>
					{/each}
				</select>
			</label>
		</div>
	</footer>
</section>

<!-- ── Modal chi tiết đơn hàng ── -->
<Modal bind:display={detailModalDisplay} size="lg" isDimissable>
	<Modal.Container>
		<Modal.Container.Header>{pageContents.modals.detailTitle[lang]}</Modal.Container.Header>
		<Modal.Container.Body>
			{#if detailModalOrder}
				<p class="modal-intro">
					{fillTemplate(pageContents.modals.detailIntro[lang], detailModalOrder.orderCode ?? '')}
				</p>
				<div class="detail-section">
					<h4>{pageContents.table.customer[lang]}</h4>
					<p>{detailModalOrder.customerId ?? '—'}</p>
				</div>
				<div class="detail-section">
					<h4>{pageContents.modals.itemsTitle[lang]}</h4>
					{#if detailModalOrder.items && detailModalOrder.items.length > 0}
						<table class="detail-items-table">
							<thead>
								<tr>
									<th>{pageContents.modals.variant[lang]}</th>
									<th>{pageContents.modals.lot[lang]}</th>
									<th>{pageContents.modals.qty[lang]}</th>
									<th>{pageContents.modals.price[lang]}</th>
									<th>{pageContents.modals.subtotal[lang]}</th>
								</tr>
							</thead>
							<tbody>
								{#each detailModalOrder.items as item}
									<tr>
										<td>{item.variantId}</td>
										<td>{item.lotId ?? '—'}</td>
										<td>{item.quantity}</td>
										<td>{formatCurrency(item.price, lang)}</td>
										<td>{formatCurrency(item.price * item.quantity, lang)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{:else}
						<p>—</p>
					{/if}
				</div>
				<div class="detail-section">
					<h4>{pageContents.table.total[lang]}</h4>
					<p class="detail-total">{detailModalOrder.totalAmount != null ? formatCurrency(detailModalOrder.totalAmount, lang) : '—'}</p>
				</div>
				<div class="detail-section">
					<h4>{pageContents.table.created[lang]}</h4>
					<p>{formatDate(detailModalOrder.createdAt, lang)}</p>
				</div>
			{/if}
		</Modal.Container.Body>
		<Modal.Container.Footer>
			<Button color="default" variant="ghost" onClick={() => { detailModalDisplay = false; }}>
				{pageContents.modals.cancel[lang]}
			</Button>
		</Modal.Container.Footer>
	</Modal.Container>
</Modal>

<!-- ── Modal đổi trạng thái ── -->
<Modal bind:display={statusModalDisplay} size="sm" isDimissable>
	<Modal.Container>
		<Modal.Container.Header>{pageContents.modals.statusTitle[lang]}</Modal.Container.Header>
		<Modal.Container.Body>
			<p class="modal-intro">
				{fillTemplate(pageContents.modals.statusIntro[lang], statusModalOrder?.orderCode ?? '')}
			</p>
			<select class="admin-select" bind:value={statusModalValue} disabled={statusModalBusy}>
				{#each orderStatuses as status (status)}
					<option value={status}>{getStatusLabel(status)}</option>
				{/each}
			</select>
		</Modal.Container.Body>
		<Modal.Container.Footer>
			<Button color="primary" onClick={confirmChangeStatus} loading={statusModalBusy} disabled={!statusModalValue}>
				{pageContents.modals.confirm[lang]}
			</Button>
			<Button color="default" variant="ghost" onClick={() => { statusModalDisplay = false; }}>
				{pageContents.modals.cancel[lang]}
			</Button>
		</Modal.Container.Footer>
	</Modal.Container>
</Modal>

<!-- ── Modal xoá ── -->
<Modal bind:display={deleteModalDisplay} size="sm" isDimissable>
	<Modal.Container>
		<Modal.Container.Header>{pageContents.modals.deleteTitle[lang]}</Modal.Container.Header>
		<Modal.Container.Body>
			<p class="modal-intro">
				{fillTemplate(pageContents.modals.deleteIntro[lang], deleteModalOrder?.orderCode ?? '')}
			</p>
		</Modal.Container.Body>
		<Modal.Container.Footer>
			<Button color="error" onClick={confirmDelete} loading={deleteModalBusy}>
				{pageContents.modals.confirm[lang]}
			</Button>
			<Button color="default" variant="ghost" onClick={() => { deleteModalDisplay = false; }}>
				{pageContents.modals.cancel[lang]}
			</Button>
		</Modal.Container.Footer>
	</Modal.Container>
</Modal>

<style lang="scss">
	.admin-page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem;
		max-width: 1280px;
		margin: 0 auto;
		width: 100%;
	}

	.admin-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.admin-title {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}

	.admin-subtitle {
		color: var(--muted-foreground);
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
	}

	.admin-header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	/* Stats bar */
	.admin-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
	}

	.stat-label {
		display: block;
		font-size: 0.8rem;
		color: var(--muted-foreground);
		margin-bottom: 0.25rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
	}

	.stat-status-breakdown {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.25rem;
	}

	.stat-status-chip {
		font-size: 0.7rem;
		padding: 0.15rem 0.5rem;
		border-radius: 9999px;
		font-weight: 600;
	}

	/* Filters */
	.admin-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;

		/* B5: sticky dưới admin header (mobile — var đo bằng ResizeObserver
		   trên .admin-inset). margin-block âm giữ nhịp gap 1rem của .admin-page. */
		@media (max-width: 767px) {
			position: sticky;
			top: calc(var(--admin-header-h, 0px) + var(--admin-body-pad-top, 0.5rem));
			z-index: 400;
			background: var(--background, #fff);
			padding-block: 0.25rem;
			margin-block: -0.25rem;
		}
	}

	.admin-search {
		flex: 1;
		min-width: 220px;
		max-width: 320px;
	}

	.admin-select {
		padding: 0.35rem 2rem 0.35rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--background);
		color: var(--foreground);
		font-size: 0.8rem;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.5rem center;
	}

	.admin-select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-100);
	}

	/* Nút action trong snippet actionsContent DataTable */
	.row-actions {
		display: flex;
		gap: 0.35rem;
		justify-content: flex-end;
	}

	/* B6.2: khung bảng — đồng bộ các page admin khác (users/brands/categories/
	   products): scroll ngang khi min-content cột vượt viewport thay vì vỡ layout. */
	.admin-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);

		/* B5: card mode mobile — bỏ khung bảng rỗng (card tự có border). */
		@media (max-width: 767px) {
			border: 0;
			border-radius: 0;
		}
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: capitalize;
	}

	.status-success { background: var(--success-100); color: var(--success-700); }
	.status-warning { background: var(--warning-100, var(--default-200)); color: var(--warning-700, var(--default-700)); }
	.status-error { background: var(--danger-100, hsl(var(--error-h) var(--error-s) 85%)); color: var(--error); }
	.status-info { background: var(--info-100, var(--default-200)); color: var(--info-700, var(--default-700)); }
	.status-primary { background: var(--primary-100); color: var(--primary-700, var(--primary)); }
	.status-default { background: var(--default-100); color: var(--default-700); }

	/* Pagination */
	.admin-pagination {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		font-size: 0.875rem;

		/* B5: sticky pagination mobile — luôn thấy điều khiển trang. */
		@media (max-width: 767px) {
			position: sticky;
			bottom: 0;
			z-index: 300;
			background: var(--background, #fff);
			padding-block: 0.5rem;
			margin-block: -0.25rem;
		}
	}

	.total-count {
		color: var(--muted-foreground);
		font-weight: 500;
	}

	.page-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.page-info {
		color: var(--muted-foreground);
		font-weight: 500;
		min-width: 100px;
		text-align: center;
	}

	.page-size {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-size-label {
		color: var(--muted-foreground);
		font-size: 0.8rem;
	}

	/* Modal detail */
	.detail-section {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.detail-section:last-child {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.detail-section h4 {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-section p {
		margin: 0;
		color: var(--foreground);
	}

	.detail-total {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.detail-items-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;

		th,
		td {
			padding: 0.4rem 0.5rem;
			border-bottom: 1px solid var(--border);
			text-align: left;
		}

		th {
			color: var(--muted-foreground);
			font-weight: 600;
		}
	}

	.modal-intro {
		margin: 0 0 1rem;
		color: var(--muted-foreground);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.admin-page {
			padding: 1rem;
		}

		.admin-stats {
			grid-template-columns: 1fr 1fr;
		}

		.admin-header {
			flex-direction: column;
			align-items: stretch;
		}

		.admin-header-actions {
			justify-content: space-between;
		}
	}
</style>
