<!-- src/routes/(authorized)/admin/fulfillment/+page.svelte -->
<!-- Pha 5 #40: hàng đợi điều phối đơn gộp POS + online (trạng thái paid/confirmed).
     "Đã xử lý" → markFulfilled (đơn online không phải pickup hỏi carrier + trackingNumber);
     "Chờ lấy hàng" → markAwaitingPickup (chỉ đơn click-and-collect).
     Pattern theo trang payments (fetchSecure POST encrypted, pageContents vi/en). -->
<script lang="ts">
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface QueueRow {
		_id?: string;
		orderCode?: string;
		customerId?: string;
		staffId?: string;
		branchId?: string;
		status?: string;
		channel?: string;
		fulfillmentMethod?: string;
		totalAmount?: number;
		createdAt?: string | null;
		updatedAt?: string | null;
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
		title: { vi: 'Xử lý đơn', en: 'Fulfillment' },
		subtitle: {
			vi: 'Hàng chờ điều phối gộp POS + online: gửi hàng hoặc chờ khách lấy tại cửa hàng',
			en: 'Unified POS + online fulfillment queue: ship orders or await in-store pickup'
		},
		filters: {
			allChannels: { vi: 'Tất cả kênh', en: 'All channels' },
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			branchPlaceholder: { vi: 'Lọc theo chi nhánh (ID)…', en: 'Filter by branch (ID)…' },
			applyBranch: { vi: 'Lọc', en: 'Filter' }
		},
		channels: {
			pos: { vi: 'Tại quầy (POS)', en: 'In-store (POS)' },
			online: { vi: 'Trực tuyến', en: 'Online' }
		},
		fulfillmentMethods: {
			shipping: { vi: 'Giao hàng', en: 'Shipping' },
			pickup: { vi: 'Nhận tại cửa hàng', en: 'Store pickup' }
		},
		statuses: {
			paid: { vi: 'Đã thanh toán', en: 'Paid' },
			confirmed: { vi: 'Đã xác nhận', en: 'Confirmed' }
		},
		table: {
			orderCode: { vi: 'Mã đơn', en: 'Order' },
			channel: { vi: 'Kênh', en: 'Channel' },
			fulfillmentMethod: { vi: 'Nhận hàng', en: 'Fulfilment' },
			branchId: { vi: 'Chi nhánh', en: 'Branch' },
			totalAmount: { vi: 'Tổng tiền', en: 'Total' },
			status: { vi: 'Trạng thái', en: 'Status' },
			createdAt: { vi: 'Tạo lúc', en: 'Created' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		actions: {
			fulfill: { vi: 'Đã xử lý', en: 'Fulfilled' },
			awaitingPickup: { vi: 'Chờ lấy hàng', en: 'Awaiting pickup' }
		},
		states: {
			loading: { vi: 'Đang tải hàng chờ…', en: 'Loading queue…' },
			errorTitle: { vi: 'Không tải được hàng chờ xử lý đơn', en: 'Failed to load fulfillment queue' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Không có đơn nào chờ xử lý', en: 'No orders awaiting fulfilment' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCount: { vi: '{total} đơn chờ xử lý', en: '{total} orders in queue' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		fulfillModal: {
			title: { vi: 'Xử lý đơn hàng', en: 'Fulfill order' },
			bodyPos: {
				vi: 'Xác nhận đã xử lý xong đơn tại quầy này? Đơn sẽ chuyển sang trạng thái "Đã gửi hàng".',
				en: 'Confirm this in-store order has been handled? It will move to "Shipped".'
			},
			bodyOnline: {
				vi: 'Nhập thông tin vận chuyển để gửi hàng cho đơn trực tuyến này. Đơn sẽ chuyển sang "Đã gửi hàng" và một vận đơn ở trạng thái "Đã tạo nhãn" sẽ được tạo.',
				en: 'Enter shipping details to dispatch this online order. It will move to "Shipped" and a "Label created" shipment record will be created.'
			},
			carrier: { vi: 'Đơn vị vận chuyển (tuỳ chọn)', en: 'Carrier (optional)' },
			trackingNumber: { vi: 'Mã vận đơn (tuỳ chọn)', en: 'Tracking number (optional)' },
			submit: { vi: 'Xác nhận đã xử lý', en: 'Confirm fulfilled' }
		},
		pickupModal: {
			title: { vi: 'Chuyển sang chờ lấy hàng', en: 'Mark awaiting pickup' },
			body: {
				vi: 'Chuyển đơn nhận tại cửa hàng này sang trạng thái "Chờ lấy hàng" để khách đến nhận?',
				en: 'Move this store-pickup order to "Awaiting pickup" so the customer can collect it?'
			},
			submit: { vi: 'Chờ lấy hàng', en: 'Awaiting pickup' }
		},
		toasts: {
			fulfilled: { vi: 'Đã xử lý đơn hàng', en: 'Order fulfilled' },
			awaitingPickup: { vi: 'Đã chuyển đơn sang chờ lấy hàng', en: 'Order marked as awaiting pickup' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const QUEUE_STATUSES = ['paid', 'confirmed'] as const;
	const CHANNELS = ['pos', 'online'] as const;

	function channelLabel(channel?: string): string {
		const key = (channel ?? '') as keyof typeof pageContents.channels;
		const label = pageContents.channels[key];
		return label ? label[lang] : (channel ?? '—');
	}

	function methodLabel(method?: string): string {
		const key = (method ?? '') as keyof typeof pageContents.fulfillmentMethods;
		const label = pageContents.fulfillmentMethods[key];
		return label ? label[lang] : (method ?? '—');
	}

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): 'success' | 'warning' | 'danger' | 'default' {
		switch (status) {
			case 'paid':
			case 'confirmed':
				return 'warning';
			default:
				return 'default';
		}
	}

	// ── Danh sách + filter ──
	let orders = $state<QueueRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	// channel/status lọc trên trang hiện tại (API hàng chờ chỉ nhận branchId/page/pageSize)
	let channelFilter = $state('');
	let statusFilter = $state('');
	let branchFilter = $state('');

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const visibleOrders = $derived(
		orders.filter((row) => {
			if (channelFilter && (row.channel ?? 'pos') !== channelFilter) return false;
			if (statusFilter && row.status !== statusFilter) return false;
			return true;
		})
	);

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
	async function loadQueue() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/fulfillment/queue',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						branchId: branchFilter.trim() || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: QueueRow[]; total?: number; page?: number }
					| undefined;
				orders = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/fulfillment] load failed:', err);
		}
	}

	// ── Phân trang ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadQueue();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadQueue();
	}

	async function applyBranchFilter() {
		if (loading) return;
		pageNo = 1;
		await loadQueue();
	}

	// ── DataTable columns ──
	const ordersAny = $derived(visibleOrders as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'orderCode',
			label: pageContents.table.orderCode[lang],
			accessor: (row) => (row as unknown as QueueRow).orderCode ?? '—'
		},
		{
			id: 'channel',
			label: pageContents.table.channel[lang],
			accessor: (row) => channelLabel((row as unknown as QueueRow).channel)
		},
		{
			id: 'fulfillmentMethod',
			label: pageContents.table.fulfillmentMethod[lang],
			accessor: (row) => methodLabel((row as unknown as QueueRow).fulfillmentMethod)
		},
		{
			id: 'branchId',
			label: pageContents.table.branchId[lang],
			accessor: (row) => (row as unknown as QueueRow).branchId ?? '—',
			noHighlight: true
		},
		{
			id: 'totalAmount',
			label: pageContents.table.totalAmount[lang],
			accessor: (row) => formatMoney((row as unknown as QueueRow).totalAmount)
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			accessor: (row) => statusLabel((row as unknown as QueueRow).status),
			status: (_value, row) => statusColor((row as unknown as QueueRow).status)
		},
		{
			id: 'createdAt',
			label: pageContents.table.createdAt[lang],
			accessor: (row) => formatDateTime((row as unknown as QueueRow).createdAt),
			noHighlight: true
		}
	]);

	// ── Điều kiện hiện nút ──
	function isFulfillable(_row: QueueRow): boolean {
		// Mọi đơn trong hàng chờ (paid/confirmed) đều có thể đánh dấu đã xử lý
		return true;
	}

	function needsShippingInfo(row: QueueRow): boolean {
		// Đơn online không phải pickup → hỏi carrier + trackingNumber
		return (row.channel ?? 'pos') === 'online' && row.fulfillmentMethod !== 'pickup';
	}

	function isAwaitingPickupable(row: QueueRow): boolean {
		// Chỉ đơn click-and-collect mới chuyển sang chờ lấy hàng
		return row.fulfillmentMethod === 'pickup';
	}

	// ── Modal đã xử lý (markFulfilled) ──
	let fulfillModalDisplay = $state(false);
	let fulfillTarget = $state<QueueRow | null>(null);
	let fulfillCarrier = $state('');
	let fulfillTracking = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	function openFulfillModal(row: QueueRow) {
		fulfillTarget = row;
		fulfillCarrier = '';
		fulfillTracking = '';
		formError = undefined;
		fulfillModalDisplay = true;
	}

	async function submitFulfill() {
		if (submitting || !fulfillTarget?._id || !encryptionKeys) return;
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/fulfillment/fulfill',
				{
					method: 'POST',
					body: {
						orderId: fulfillTarget._id,
						carrier: fulfillCarrier.trim() || undefined,
						trackingNumber: fulfillTracking.trim() || undefined
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.fulfilled)
						: pageContents.toasts.fulfilled[lang],
					'success'
				);
				fulfillModalDisplay = false;
				await loadQueue();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/fulfillment] fulfill failed:', err);
		}
	}

	// ── Modal chờ lấy hàng (markAwaitingPickup) ──
	let pickupModalDisplay = $state(false);
	let pickupTarget = $state<QueueRow | null>(null);

	function openPickupModal(row: QueueRow) {
		pickupTarget = row;
		formError = undefined;
		pickupModalDisplay = true;
	}

	async function submitAwaitingPickup() {
		if (submitting || !pickupTarget?._id || !encryptionKeys) return;
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/fulfillment/awaiting-pickup',
				{
					method: 'POST',
					body: { orderId: pickupTarget._id }
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.awaitingPickup)
						: pageContents.toasts.awaitingPickup[lang],
					'success'
				);
				pickupModalDisplay = false;
				await loadQueue();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/fulfillment] awaiting-pickup failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadQueue();
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
		<select class="admin-select" bind:value={channelFilter}>
			<option value="">{pageContents.filters.allChannels[lang]}</option>
			{#each CHANNELS as channel (channel)}
				<option value={channel}>{channelLabel(channel)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={statusFilter}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each QUEUE_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<input
			class="admin-input branch-input"
			type="text"
			bind:value={branchFilter}
			placeholder={pageContents.filters.branchPlaceholder[lang]}
			onkeydown={(e) => {
				if (e.key === 'Enter') applyBranchFilter();
			}}
		/>
		<Button color="default" variant="outline" size="sm" onClick={applyBranchFilter}>
			{pageContents.filters.applyBranch[lang]}
		</Button>
		<Button color="default" variant="outline" size="sm" onClick={loadQueue}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	{#if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadQueue}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else}
	<!-- ── Hàng chờ — DataTable (component có sẵn) ──
	     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
	     Pagination element bên dưới bind:page điều khiển server.
	     channel/status lọc client-side trên visibleOrders (API chỉ nhận branchId). -->
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
			caption={{ vi: 'Hàng chờ xử lý đơn', en: 'Fulfillment queue' }}
			actionsLabel={pageContents.table.actions}
			stickyHead
			data-test="fulfillment-datatable"
		>
			{#snippet actionsContent(row)}
				{@const queueRow = row as unknown as QueueRow}
				<div class="row-actions">
					{#if isFulfillable(queueRow)}
						<!-- Quy ước màu nút: xử lý đơn (edit-style) = primary -->
						<Button color="primary" size="sm" onClick={() => openFulfillModal(queueRow)}>
							{pageContents.actions.fulfill[lang]}
						</Button>
					{/if}
					{#if isAwaitingPickupable(queueRow)}
						<!-- Nút phụ (secondary) cho luồng click-and-collect -->
						<Button color="default" variant="outline" size="sm" onClick={() => openPickupModal(queueRow)}>
							{pageContents.actions.awaitingPickup[lang]}
						</Button>
					{/if}
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

<!-- ── Modal đã xử lý (markFulfilled) ── -->
{#if fulfillModalDisplay}
	<Modal bind:display={fulfillModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.fulfillModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<p class="modal-body-text">
					{needsShippingInfo(fulfillTarget ?? {}) ? pageContents.fulfillModal.bodyOnline[lang] : pageContents.fulfillModal.bodyPos[lang]}
				</p>
				{#if fulfillTarget && needsShippingInfo(fulfillTarget)}
					<div class="form-grid">
						<label class="form-field">
							<span class="form-label">{pageContents.fulfillModal.carrier[lang]}</span>
							<input class="admin-input" type="text" bind:value={fulfillCarrier} disabled={submitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.fulfillModal.trackingNumber[lang]}</span>
							<input class="admin-input" type="text" bind:value={fulfillTracking} disabled={submitting} />
						</label>
					</div>
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- fulfill = primary -->
				<Button color="primary" onClick={submitFulfill} loading={submitting} disabled={submitting}>
					{pageContents.fulfillModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						fulfillModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal chờ lấy hàng (markAwaitingPickup) ── -->
{#if pickupModalDisplay}
	<Modal bind:display={pickupModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.pickupModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<p class="modal-body-text">{pageContents.pickupModal.body[lang]}</p>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- luồng phụ = secondary (outline) -->
				<Button color="default" variant="outline" onClick={submitAwaitingPickup} loading={submitting} disabled={submitting}>
					{pageContents.pickupModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						pickupModalDisplay = false;
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

	.branch-input {
		max-width: 18rem;
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

	.admin-input {
		height: 2.5rem;
		padding: 0 0.75rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.9rem;
		width: 100%;

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
