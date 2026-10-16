<!-- src/routes/(authorized)/admin/dashboard/+page.svelte -->
<!-- Pha 5 #39: tổng quan admin — stat cards (đơn hôm nay / doanh thu / đang giao /
     thanh toán chờ) + đơn gần đây + phiên POS đang mở + tồn kho thấp.
     Dữ liệu tổng hợp qua API api/admin/dashboard (Promise.allSettled các services).
     KHÔNG tạo dữ liệu giả — khối service lỗi hiển thị "—". -->
<script lang="ts">
	import { Button } from '$components/element';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDateTime as formatDateTimeShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface DashboardStats {
		totalOrders?: number;
		todayOrders?: number;
		deliveredRevenue?: number;
		statusBreakdown?: Record<string, number>;
	}

	interface RecentOrder {
		_id?: string;
		orderCode?: string;
		customerId?: string;
		status?: string;
		totalAmount?: number;
		createdAt?: string | null;
	}

	interface PosSessionRow {
		_id?: string;
		deviceId?: string;
		userId?: string;
		status?: string;
		openedAt?: string | null;
		totalSales?: number;
	}

	interface LowStockRow {
		_id?: string;
		variantId?: string;
		branchId?: string;
		quantityOnHand?: number;
		quantityReserved?: number;
	}

	interface DashboardData {
		orderStats?: DashboardStats | null;
		pendingPaymentsCount?: number | null;
		activeShipmentsCount?: number | null;
		openPosSessions?: PosSessionRow[] | null;
		recentOrders?: RecentOrder[] | null;
		recentOrdersTotal?: number | null;
		lowStock?: LowStockRow[] | null;
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
		title: { vi: 'Tổng quan', en: 'Dashboard' },
		subtitle: {
			vi: 'Bức tranh tổng thể: đơn hàng, thanh toán, vận chuyển và kho',
			en: 'The big picture: orders, payments, shipments and inventory'
		},
		cards: {
			todayOrders: { vi: 'Đơn hôm nay', en: 'Orders today' },
			totalOrders: { vi: 'Tổng đơn hàng', en: 'Total orders' },
			deliveredRevenue: { vi: 'Doanh thu đã giao', en: 'Delivered revenue' },
			pendingPayments: { vi: 'Thanh toán chờ xử lý', en: 'Pending payments' },
			activeShipments: { vi: 'Đang vận chuyển', en: 'In transit' },
			openPosSessions: { vi: 'Phiên POS đang mở', en: 'Open POS sessions' }
		},
		sections: {
			recentOrders: { vi: 'Đơn hàng gần đây', en: 'Recent orders' },
			openPosSessions: { vi: 'Phiên POS đang mở', en: 'Open POS sessions' },
			lowStock: { vi: 'Tồn kho thấp (kém nhất)', en: 'Lowest stock' }
		},
		table: {
			orderCode: { vi: 'Mã đơn', en: 'Order' },
			total: { vi: 'Tổng tiền', en: 'Total' },
			status: { vi: 'Trạng thái', en: 'Status' },
			createdAt: { vi: 'Thời gian', en: 'Time' },
			device: { vi: 'Thiết bị', en: 'Device' },
			openedAt: { vi: 'Mở lúc', en: 'Opened' },
			totalSales: { vi: 'Doanh số', en: 'Sales' },
			variant: { vi: 'Biến thể', en: 'Variant' },
			onHand: { vi: 'Tồn kho', en: 'On hand' },
			reserved: { vi: 'Đặt trước', en: 'Reserved' }
		},
		orderStatuses: {
			pending: { vi: 'Chờ xử lý', en: 'Pending' },
			confirmed: { vi: 'Đã xác nhận', en: 'Confirmed' },
			paid: { vi: 'Đã thanh toán', en: 'Paid' },
			processing: { vi: 'Đang xử lý', en: 'Processing' },
			shipped: { vi: 'Đã gửi hàng', en: 'Shipped' },
			awaiting_pickup: { vi: 'Chờ lấy hàng', en: 'Awaiting pickup' },
			delivered: { vi: 'Đã giao', en: 'Delivered' },
			completed: { vi: 'Hoàn tất', en: 'Completed' },
			cancelled: { vi: 'Đã huỷ', en: 'Cancelled' },
			refunded: { vi: 'Đã hoàn tiền', en: 'Refunded' }
		},
		states: {
			loading: { vi: 'Đang tải tổng quan…', en: 'Loading dashboard…' },
			errorTitle: { vi: 'Không tải được tổng quan', en: 'Failed to load dashboard' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có dữ liệu', en: 'No data yet' },
			unavailable: { vi: 'Không khả dụng', en: 'Unavailable' }
		}
	};

	function orderStatusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.orderStatuses;
		const label = pageContents.orderStatuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function orderStatusColor(status?: string): string {
		switch (status) {
			case 'delivered':
			case 'completed':
				return 'success';
			case 'pending':
			case 'awaiting_pickup':
			case 'processing':
			case 'paid':
			case 'confirmed':
			case 'shipped':
				return 'warning';
			case 'cancelled':
			case 'refunded':
				return 'error';
			default:
				return 'default';
		}
	}

	// ── State ──
	let data = $state<DashboardData | null>(null);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDateTime(raw?: string | null): string {
		return formatDateTimeShared(raw, lang);
	}

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	function formatCount(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return String(value);
	}

	// ── Gọi API ──
	async function loadDashboard() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/dashboard',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				data = (response.data as DashboardData | undefined) ?? null;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/dashboard] load failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadDashboard();
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
			<Button color="default" variant="outline" size="sm" onClick={loadDashboard}>
				{pageContents.states.retry[lang]}
			</Button>
		</div>
	</header>

	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadDashboard}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if data}
		<!-- ── Stat cards ── -->
		<div class="stat-grid">
			<div class="stat-card" data-test="dashboard-stat-today-orders">
				<span class="stat-label">{pageContents.cards.todayOrders[lang]}</span>
				<span class="stat-value">{formatCount(data.orderStats?.todayOrders)}</span>
			</div>
			<div class="stat-card" data-test="dashboard-stat-total-orders">
				<span class="stat-label">{pageContents.cards.totalOrders[lang]}</span>
				<span class="stat-value">{formatCount(data.orderStats?.totalOrders)}</span>
			</div>
			<div class="stat-card" data-test="dashboard-stat-revenue">
				<span class="stat-label">{pageContents.cards.deliveredRevenue[lang]}</span>
				<span class="stat-value">{formatMoney(data.orderStats?.deliveredRevenue)}</span>
			</div>
			<div class="stat-card" data-test="dashboard-stat-pending-payments">
				<span class="stat-label">{pageContents.cards.pendingPayments[lang]}</span>
				<span class="stat-value">{formatCount(data.pendingPaymentsCount)}</span>
			</div>
			<div class="stat-card" data-test="dashboard-stat-active-shipments">
				<span class="stat-label">{pageContents.cards.activeShipments[lang]}</span>
				<span class="stat-value">{formatCount(data.activeShipmentsCount)}</span>
			</div>
			<div class="stat-card" data-test="dashboard-stat-open-pos">
				<span class="stat-label">{pageContents.cards.openPosSessions[lang]}</span>
				<span class="stat-value">{formatCount(data.openPosSessions?.length)}</span>
			</div>
		</div>

		<!-- ── Đơn hàng gần đây ── -->
		<div class="dash-section" data-test="dashboard-recent-orders">
			<h2 class="section-title">{pageContents.sections.recentOrders[lang]}</h2>
			{#if !data.recentOrders || data.recentOrders.length === 0}
				<div class="admin-state"><p>{pageContents.states.empty[lang]}</p></div>
			{:else}
				<div class="admin-table-wrap">
					<table class="admin-table">
						<thead>
							<tr>
								<th scope="col">{pageContents.table.orderCode[lang]}</th>
								<th scope="col">{pageContents.table.total[lang]}</th>
								<th scope="col">{pageContents.table.status[lang]}</th>
								<th scope="col">{pageContents.table.createdAt[lang]}</th>
							</tr>
						</thead>
						<tbody>
							{#each data.recentOrders as row (row._id)}
								<tr>
									<td class="col-code">{row.orderCode ?? '—'}</td>
									<td class="col-num">{formatMoney(row.totalAmount)}</td>
									<td class="col-status">
										<span class="status-badge status-{orderStatusColor(row.status)}">{orderStatusLabel(row.status)}</span>
									</td>
									<td>{formatDateTime(row.createdAt)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<div class="dash-two-col">
			<!-- ── Phiên POS đang mở ── -->
			<div class="dash-section" data-test="dashboard-open-pos">
				<h2 class="section-title">{pageContents.sections.openPosSessions[lang]}</h2>
				{#if !data.openPosSessions || data.openPosSessions.length === 0}
					<div class="admin-state"><p>{pageContents.states.empty[lang]}</p></div>
				{:else}
					<div class="admin-table-wrap">
						<table class="admin-table">
							<thead>
								<tr>
									<th scope="col">{pageContents.table.device[lang]}</th>
									<th scope="col">{pageContents.table.openedAt[lang]}</th>
									<th scope="col">{pageContents.table.totalSales[lang]}</th>
								</tr>
							</thead>
							<tbody>
								{#each data.openPosSessions as row (row._id)}
									<tr>
										<td class="col-code">{row.deviceId ?? '—'}</td>
										<td>{formatDateTime(row.openedAt)}</td>
										<td class="col-num">{formatMoney(row.totalSales)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- ── Tồn kho thấp ── -->
			<div class="dash-section" data-test="dashboard-low-stock">
				<h2 class="section-title">{pageContents.sections.lowStock[lang]}</h2>
				{#if !data.lowStock || data.lowStock.length === 0}
					<div class="admin-state"><p>{pageContents.states.empty[lang]}</p></div>
				{:else}
					<div class="admin-table-wrap">
						<table class="admin-table">
							<thead>
								<tr>
									<th scope="col">{pageContents.table.variant[lang]}</th>
									<th scope="col">{pageContents.table.onHand[lang]}</th>
									<th scope="col">{pageContents.table.reserved[lang]}</th>
								</tr>
							</thead>
							<tbody>
								{#each data.lowStock as row (row._id)}
									<tr>
										<td class="col-code">{row.variantId ?? '—'}</td>
										<td class="col-num">{formatCount(row.quantityOnHand)}</td>
										<td class="col-num">{formatCount(row.quantityReserved)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>

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

	.admin-header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
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

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 0.75rem;

		@media (max-width: 1080px) {
			grid-template-columns: repeat(3, 1fr);
		}

		@media (max-width: 640px) {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 1rem;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
	}

	.stat-label {
		font-size: 0.78rem;
		color: var(--foreground-500);
	}

	.stat-value {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}

	.dash-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section-title {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.dash-two-col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
		align-items: start;

		@media (max-width: 900px) {
			grid-template-columns: 1fr;
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

	.admin-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;

		th,
		td {
			padding: 0.75rem 1rem;
			border-bottom: 1px solid var(--default-200);
			text-align: left;
			white-space: nowrap;
		}

		th {
			font-size: 0.8rem;
			text-transform: uppercase;
			font-weight: 600;
			background: var(--default-100);
			color: var(--foreground-500);
		}

		tbody tr:hover {
			background: var(--default-50);
		}
	}

	.col-code {
		font-weight: 600;
		color: var(--foreground);
		max-width: 14rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.col-num {
		font-variant-numeric: tabular-nums;
	}

	.col-status {
		white-space: nowrap;
	}

	.status-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;

		&.status-success {
			background: var(--success-100, var(--default-200));
			color: var(--success-700, var(--success));
		}

		&.status-warning {
			background: var(--warning-100, var(--default-200));
			color: var(--warning-700, var(--foreground-600));
		}

		&.status-error {
			background: var(--danger-100, hsl(358, 62.5%, 90.6%));
			color: var(--error);
		}

		&.status-default {
			background: var(--default-200);
			color: var(--foreground-600);
		}
	}
</style>
