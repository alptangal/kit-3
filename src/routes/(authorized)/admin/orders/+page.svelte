<!-- src/routes/(authorized)/admin/orders/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Checkbox } from '$components/form';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
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
					body: { page, pageSize, includeDeleted }
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
				if (typeof data?.page === 'number') page = data.page;
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

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === page || loading) return;
		page = target;
		await loadOrders();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		page = 1;
		await loadOrders();
	}

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

	function fillTemplate(text: string, name: string): string {
		return text.replace('{name}', name);
	}

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

	<!-- ── Trạng thái loading ── -->
	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={refresh}>
				{pageContents.states.retry[lang]}
			</Button>
		</div>
	{:else if orders.length === 0}
		<div class="admin-state">
			<p>{includeDeleted ? pageContents.states.emptyDeleted[lang] : pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<!-- ── Bảng đơn hàng ── -->
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.orderCode[lang]}</th>
						<th scope="col">{pageContents.table.customer[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.items[lang]}</th>
						<th scope="col">{pageContents.table.total[lang]}</th>
						<th scope="col">{pageContents.table.created[lang]}</th>
						<th scope="col" class="col-actions">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each orders as row (getRowDocumentKey(row) || `${row.orderCode ?? ''}`)}
						<tr class:row-deleted={includeDeleted && isRowDeleted(row)}>
							<td class="col-code">{row.orderCode ?? '—'}</td>
							<td class="col-customer">{row.customerId ?? '—'}</td>
							<td class="col-status">
								<span class="status-badge status-{getStatusColor(row.status)}">
									{getStatusLabel(row.status)}
								</span>
							</td>
							<td class="col-items">
								{#if row.items && row.items.length > 0}
									{row.items.length} {pageContents.modals.itemsTitle[lang].split(' ')[0]}
								{:else}
									—
								{/if}
							</td>
							<td class="col-total">{row.totalAmount != null ? formatCurrency(row.totalAmount, lang) : '—'}</td>
							<td class="col-created">{formatDate(row.createdAt, lang)}</td>
							<td class="col-actions">
								<div class="row-actions">
									{#if includeDeleted && isRowDeleted(row)}
										<!-- Không có restore cho đơn hàng, chỉ xoá mềm -->
									{:else}
										<Button color="default" variant="ghost" size="sm" onClick={() => openDetailModal(row)}>
											{pageContents.modals.detailTitle[lang]}
										</Button>
										<Button color="default" variant="ghost" size="sm" onClick={() => openStatusModal(row)}>
											{pageContents.modals.statusTitle[lang]}
										</Button>
										<Button
											color="error"
											variant="ghost"
											size="sm"
											onClick={() => openDeleteModal(row)}
										>
											{pageContents.actions.delete[lang]}
										</Button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- ── Phân trang ── -->
		<footer class="admin-pagination">
			<span class="total-count">{totalCountText}</span>
			<div class="page-controls">
				<Button
					color="default"
					variant="outline"
					size="sm"
					disabled={page <= 1 || loading}
					onClick={() => goToPage(page - 1)}
				>
					{pageContents.pagination.prev[lang]}
				</Button>
				<span class="page-info">{pageInfoText}</span>
				<Button
					color="default"
					variant="outline"
					size="sm"
					disabled={page >= totalPages || loading}
					onClick={() => goToPage(page + 1)}
				>
					{pageContents.pagination.next[lang]}
				</Button>
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
	{/if}
</section>

<!-- ── Modal chi tiết đơn hàng ── -->
{#if detailModalDisplay}
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
{/if}

<!-- ── Modal đổi trạng thái ── -->
{#if statusModalDisplay}
	<Modal bind:display={statusModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.modals.statusTitle[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">
					{fillTemplate(pageContents.modals.statusIntro[lang], statusModalOrder?.orderCode ?? '')}
				</p>
				<select class="admin-select" bind:value={statusModalValue} disabled={statusModalBusy}>
					<option value="pending">{pageContents.table.status[lang]}: {getStatusLabel('pending')}</option>
					<option value="confirmed">{pageContents.table.status[lang]}: {getStatusLabel('confirmed')}</option>
					<option value="shipped">{pageContents.table.status[lang]}: {getStatusLabel('shipped')}</option>
					<option value="delivered">{pageContents.table.status[lang]}: {getStatusLabel('delivered')}</option>
					<option value="cancelled">{pageContents.table.status[lang]}: {getStatusLabel('cancelled')}</option>
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
{/if}

<!-- ── Modal xoá ── -->
{#if deleteModalDisplay}
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
{/if}

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

	/* Table */
	.admin-table-wrap {
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.admin-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.admin-table th {
		text-align: left;
		padding: 0.875rem 1rem;
		background: var(--muted);
		color: var(--foreground);
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	.admin-table td {
		padding: 0.875rem 1rem;
		border-bottom: 1px solid var(--border);
		vertical-align: middle;
	}

	.admin-table tbody tr:last-child td {
		border-bottom: none;
	}

	.admin-table tbody tr:hover td {
		background: var(--accent);
	}

	.admin-table tbody tr.row-deleted td {
		opacity: 0.5;
		background: var(--muted);
	}

	.col-code {
		font-family: monospace;
		font-weight: 600;
		color: var(--primary);
	}

	.col-customer {
		font-weight: 500;
	}

	.col-status {
		white-space: nowrap;
	}

	.col-items {
		color: var(--muted-foreground);
		font-size: 0.85rem;
	}

	.col-total {
		font-weight: 600;
		font-family: monospace;
	}

	.col-created {
		white-space: nowrap;
		color: var(--muted-foreground);
	}

	.col-actions {
		white-space: nowrap;
		width: 1%;
	}

	.row-actions {
		display: flex;
		gap: 0.35rem;
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
	.status-info { background: var(--primary-100); color: var(--primary-700); }
	.status-error { background: var(--danger-100, hsl(var(--error-h) var(--error-s) 85%)); color: var(--error); }
	.status-primary { background: var(--primary-100); color: var(--primary-700); }
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

	/* State */
	.admin-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem 1.5rem;
		text-align: center;
		background: var(--card);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		color: var(--muted-foreground);
	}

	.admin-state.error {
		color: var(--error);
		border-color: var(--error-100, hsl(var(--error-h) var(--error-s) 30%));
	}

	.state-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.admin-state.error .state-title {
		color: var(--error);
	}

	.state-detail {
		margin: 0;
		font-size: 0.9rem;
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
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--primary) !important;
	}

	.detail-items-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8rem;
	}

	.detail-items-table th,
	.detail-items-table td {
		padding: 0.5rem;
		border-bottom: 1px solid var(--border);
		text-align: left;
	}

	.detail-items-table th {
		font-weight: 600;
		color: var(--muted-foreground);
		font-size: 0.7rem;
		text-transform: uppercase;
	}

	.detail-items-table tbody tr:last-child td {
		border-bottom: none;
	}

	.modal-intro {
		margin: 0 0 1rem;
		color: var(--muted-foreground);
	}

	.temp-password-box {
		background: var(--muted);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.temp-password-title {
		margin: 0 0 0.25rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.temp-password-note {
		margin: 0 0 0.75rem;
		font-size: 0.8rem;
		color: var(--muted-foreground);
	}

	.temp-password-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.temp-password-value {
		flex: 1;
		font-family: monospace;
		font-size: 1rem;
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 0.35rem;
		padding: 0.5rem 0.75rem;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.admin-page {
			padding: 1rem;
		}

		.admin-table th,
		.admin-table td {
			padding: 0.625rem 0.75rem;
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