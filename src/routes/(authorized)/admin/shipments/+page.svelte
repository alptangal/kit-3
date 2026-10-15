<!-- src/routes/(authorized)/admin/shipments/+page.svelte -->
<!-- Pha 5 #36: quản trị vận đơn — xem trạng thái + xử lý webhook fail (đổi status).
     KHÔNG tạo vận đơn thủ công (shipment tạo tự động khi fulfill đơn online).
     Pattern theo trang promotions (fetchSecure POST encrypted, pageContents vi/en). -->
<script lang="ts">
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface ShipmentRow {
		_id?: string;
		orderId?: string;
		provider?: string;
		trackingNumber?: string | null;
		recipientName?: string | null;
		recipientPhone?: string | null;
		shippingAddress?: string | null;
		cost?: number | null;
		estimatedDeliveryDate?: string | null;
		status?: string;
		statusHistory?: { status?: string; note?: string; at?: string }[] | null;
		createdAt?: string | null;
	}

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Cặp khoá RSA ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Nội dung song ngữ ──
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Vận chuyển', en: 'Shipments' },
		subtitle: {
			vi: 'Theo dõi trạng thái vận đơn và xử lý khi webhook hãng vận chuyển lỗi',
			en: 'Track shipment status and handle carrier webhook failures'
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' }
		},
		table: {
			orderId: { vi: 'Đơn hàng', en: 'Order' },
			provider: { vi: 'Đối tác', en: 'Provider' },
			trackingNumber: { vi: 'Mã vận đơn', en: 'Tracking no.' },
			recipient: { vi: 'Người nhận', en: 'Recipient' },
			cost: { vi: 'Phí', en: 'Cost' },
			estimated: { vi: 'Dự kiến giao', en: 'ETA' },
			status: { vi: 'Trạng thái', en: 'Status' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		providers: {
			ghn: { vi: 'GHN', en: 'GHN' },
			ghtk: { vi: 'GHTK', en: 'GHTK' },
			ahamove: { vi: 'Ahamove', en: 'Ahamove' },
			internal: { vi: 'Nội bộ', en: 'Internal' }
		},
		statuses: {
			pending: { vi: 'Chờ xử lý', en: 'Pending' },
			label_created: { vi: 'Đã tạo mã', en: 'Label created' },
			picked_up: { vi: 'Đã lấy hàng', en: 'Picked up' },
			in_transit: { vi: 'Đang vận chuyển', en: 'In transit' },
			delivered: { vi: 'Đã giao', en: 'Delivered' },
			failed: { vi: 'Thất bại', en: 'Failed' },
			returned: { vi: 'Đã hoàn về', en: 'Returned' }
		},
		actions: {
			updateStatus: { vi: 'Cập nhật trạng thái', en: 'Update status' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh sách vận đơn', en: 'Failed to load shipments' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có vận đơn nào', en: 'No shipments yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCount: { vi: '{total} vận đơn', en: '{total} shipments' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		statusModal: {
			title: { vi: 'Cập nhật trạng thái vận đơn', en: 'Update shipment status' },
			body: {
				vi: 'Dùng khi webhook hãng vận chuyển lỗi — chọn đúng trạng thái thực tế của kiện hàng.',
				en: 'Use when a carrier webhook failed — pick the real status of the parcel.'
			},
			newStatus: { vi: 'Trạng thái mới', en: 'New status' },
			notes: { vi: 'Ghi chú (tuỳ chọn)', en: 'Note (optional)' },
			submit: { vi: 'Cập nhật', en: 'Update' }
		},
		toasts: {
			updated: { vi: 'Đã cập nhật trạng thái vận đơn', en: 'Shipment status updated' },
			failed: { vi: 'Cập nhật không thành công', en: 'Failed to update status' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const SHIPMENT_STATUSES = ['pending', 'label_created', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'] as const;

	function providerLabel(provider?: string): string {
		const key = (provider ?? '') as keyof typeof pageContents.providers;
		const label = pageContents.providers[key];
		return label ? label[lang] : (provider ?? '—');
	}

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): 'success' | 'warning' | 'danger' | 'default' {
		switch (status) {
			case 'delivered':
				return 'success';
			case 'in_transit':
			case 'picked_up':
			case 'label_created':
			case 'pending':
				return 'warning';
			case 'failed':
				// DataTableStatus không có 'error' — map sang 'danger'
				return 'danger';
			default:
				return 'default';
		}
	}

	// ── Danh sách ──
	let shipments = $state<ShipmentRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let statusFilter = $state('');

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	function formatDateTime(raw?: string | null): string {
		if (!raw) return '—';
		try {
			const date = new Date(raw);
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}).format(date);
		} catch {
			return '—';
		}
	}

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
	async function loadShipments() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/shipments/list',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						status: statusFilter || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: ShipmentRow[]; total?: number; page?: number }
					| undefined;
				shipments = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/shipments] load failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadShipments();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadShipments();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadShipments();
	}

	// ── DataTable columns ──
	const shipmentsAny = $derived(shipments as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'orderId',
			label: pageContents.table.orderId[lang],
			sortable: true,
			accessor: (row) => (row as unknown as ShipmentRow).orderId ?? '—'
		},
		{
			id: 'provider',
			label: pageContents.table.provider[lang],
			sortable: true,
			accessor: (row) => providerLabel((row as unknown as ShipmentRow).provider)
		},
		{
			id: 'trackingNumber',
			label: pageContents.table.trackingNumber[lang],
			sortable: true,
			accessor: (row) => (row as unknown as ShipmentRow).trackingNumber ?? '—',
			noHighlight: true
		},
		{
			id: 'recipient',
			label: pageContents.table.recipient[lang],
			accessor: (row) => (row as unknown as ShipmentRow).recipientName ?? '—',
			noHighlight: true
		},
		{
			id: 'cost',
			label: pageContents.table.cost[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as ShipmentRow).cost)
		},
		{
			id: 'estimated',
			label: pageContents.table.estimated[lang],
			sortable: true,
			accessor: (row) => formatDateTime((row as unknown as ShipmentRow).estimatedDeliveryDate),
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			sortable: true,
			accessor: (row) => statusLabel((row as unknown as ShipmentRow).status),
			status: (_value, row) => statusColor((row as unknown as ShipmentRow).status)
		}
	]);

	// ── Modal đổi trạng thái (webhook fail retry) ──
	let statusModalDisplay = $state(false);
	let statusTarget = $state<ShipmentRow | null>(null);
	let newStatus = $state('');
	let statusNotes = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	function openStatusModal(row: ShipmentRow) {
		statusTarget = row;
		newStatus = row.status ?? 'pending';
		statusNotes = '';
		formError = undefined;
		statusModalDisplay = true;
	}

	async function submitStatus() {
		if (submitting || !statusTarget?._id || !encryptionKeys) return;
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/shipments/update-status',
				{
					method: 'POST',
					body: {
						shipmentId: statusTarget._id,
						status: newStatus,
						notes: statusNotes.trim() || undefined
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.updated)
						: pageContents.toasts.updated[lang],
					'success'
				);
				statusModalDisplay = false;
				await loadShipments();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/shipments] update-status error:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadShipments();
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
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each SHIPMENT_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadShipments}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	{#if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadShipments}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else}
	<!-- ── Bảng vận đơn — DataTable (component có sẵn) ──
	     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
	     Pagination element bên dưới bind:page điều khiển server. -->
	<div class="admin-table-wrap">
		<DataTable
			data={shipmentsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			searchable
			searchPlaceholder={{ vi: 'Tìm vận đơn…', en: 'Search shipments…' }}
			resizable={{ enabled: true, fit: true }}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.states.empty[lang]}
			loadingLabel={pageContents.states.loading[lang]}
			caption={{ vi: 'Danh sách vận đơn', en: 'Shipment list' }}
			actionsLabel={pageContents.table.actions}
			stickyHead
			data-test="shipments-datatable"
		>
			{#snippet actionsContent(row)}
				{@const shipment = row as unknown as ShipmentRow}
				<div class="row-actions">
					<!-- Quy ước màu nút: edit/update = primary -->
					<Button color="primary" size="sm" onClick={() => openStatusModal(shipment)}>
						{pageContents.actions.updateStatus[lang]}
					</Button>
				</div>
			{/snippet}
		</DataTable>
	</div>

	<!-- ── Phân trang (server-side) ── -->
	<footer class="admin-pagination">
		<span class="total-count">{pageContents.pagination.totalCount[lang].replace('{total}', String(total))}</span>
		<div class="page-controls">
			<Pagination
				bind:page={pageNo}
				totalPages={totalPages}
				loading={loading}
				variant="compact"
				prevLabel={pageContents.pagination.prev[lang]}
				nextLabel={pageContents.pagination.next[lang]}
				aria-label={pageContents.title[lang]}
			/>
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

<!-- ── Modal cập nhật trạng thái ── -->
{#if statusModalDisplay}
	<Modal bind:display={statusModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.statusModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<p class="modal-body-text">{pageContents.statusModal.body[lang]}</p>
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.statusModal.newStatus[lang]}</span>
						<select class="admin-select" bind:value={newStatus} disabled={submitting}>
							{#each SHIPMENT_STATUSES as status (status)}
								<option value={status}>{statusLabel(status)}</option>
							{/each}
						</select>
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.statusModal.notes[lang]}</span>
						<textarea class="admin-textarea" rows="3" bind:value={statusNotes} disabled={submitting}></textarea>
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- edit/update = primary -->
				<Button color="primary" onClick={submitStatus} loading={submitting} disabled={submitting}>
					{pageContents.statusModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						statusModalDisplay = false;
					}}
				>
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

		@media (max-width: 720px) {
			padding: 1rem;
		}
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
		font-size: 0.9rem;
		color: var(--foreground-500);
		margin: 0.25rem 0 0;
	}

	.admin-filters {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.admin-select {
		height: 2.25rem;
		padding: 0 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.85rem;
		cursor: pointer;

		&:disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: not-allowed;
		}

		option {
			background: var(--default-200);
			color: var(--foreground);
		}
	}

	.admin-textarea {
		padding: 0.6rem 0.75rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.9rem;
		width: 100%;
		resize: vertical;
		font-family: inherit;

		&:disabled {
			opacity: var(--disabled-opacity, 0.5);
		}
	}

	.admin-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--foreground-500);

		&.error {
			color: var(--error);
		}

		.state-title {
			font-weight: 600;
			margin: 0;
		}

		.state-detail {
			font-size: 0.85rem;
			margin: 0;
		}

		p {
			margin: 0;
		}
	}

	.admin-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
	}

	/* Nút action trong actionsContent — chống nén (bẫy 39px clip) */
	.row-actions {
		display: flex;
		gap: 0.25rem;
		width: 1%;
		min-width: fit-content;
	}

	.admin-pagination {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.total-count {
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.page-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.page-size {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.page-size-label {
		font-size: 0.8rem;
		color: var(--foreground-500);
	}

	.modal-body-text {
		font-size: 0.9rem;
		color: var(--foreground);
		margin: 0 0 0.75rem;
	}

	.form-error-banner {
		background: var(--danger-soft, hsl(358, 62.5%, 90.6%));
		color: var(--error);
		border-left: 3px solid var(--error);
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
	}

	.form-grid {
		display: grid;
		gap: 0.75rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
	}
</style>
