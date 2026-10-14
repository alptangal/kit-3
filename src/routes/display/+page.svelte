<!-- src/routes/display/+page.svelte -->
<!-- TV/kiosk dashboard — màn hình lớn 1920px+ treo tường, KHÔNG chuột.
     Auth: trang NẰM NGOÀI publicPaths (hooks.server.ts) → chưa login bị redirect
     /login?redirect=/display; khi CÓ session thì load thẳng. Sau login, TV giữ
     session cookie; trang tự refresh data mỗi 60s + full reload mỗi 30 phút để
     không bao giờ "chết" im lặng. KHÔNG hover state, KHÔNG nút tương tác. -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';

	// ── Shape khớp payload api/admin/dashboard (tái dùng — không tạo API mới) ──
	interface DashboardStats {
		totalOrders?: number;
		todayOrders?: number;
		deliveredRevenue?: number;
	}
	interface PosSessionRow {
		_id?: string;
		deviceId?: string;
		status?: string;
		openedAt?: string | null;
		totalSales?: number;
	}
	interface LowStockRow {
		_id?: string;
		variantId?: string;
		quantityOnHand?: number;
		quantityReserved?: number;
	}
	interface DashboardData {
		orderStats?: DashboardStats | null;
		pendingPaymentsCount?: number | null;
		openPosSessions?: PosSessionRow[] | null;
		lowStock?: LowStockRow[] | null;
	}

	// ── Nội dung song ngữ (vi/en — theo ngôn ngữ user prefs) ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : 'en');
	const t = {
		title: { vi: 'Bảng điều khiển cửa hàng', en: 'Store dashboard' },
		updated: { vi: 'Cập nhật', en: 'Updated' },
		needLogin: { vi: 'Cần đăng nhập từ thiết bị khác', en: 'Sign-in required from another device' },
		needLoginHint: {
			vi: 'Mở trình duyệt trên máy/điện thoại, đăng nhập rồi quét lại màn hình này. Tự thử lại sau 15 giây…',
			en: 'Open the browser on another device, sign in, and this screen will retry automatically in 15 seconds…'
		},
		ordersToday: { vi: 'Đơn hôm nay', en: 'Orders today' },
		totalOrders: { vi: 'Tổng đơn hàng', en: 'Total orders' },
		revenue: { vi: 'Doanh thu đã giao', en: 'Delivered revenue' },
		lowStock: { vi: 'Tồn kho thấp', en: 'Low stock items' },
		posOpen: { vi: 'Phiên POS đang mở', en: 'Open POS sessions' },
		pendingPayments: { vi: 'Thanh toán chờ', en: 'Pending payments' },
		device: { vi: 'Thiết bị', en: 'Device' },
		openedAt: { vi: 'Mở lúc', en: 'Opened' },
		sales: { vi: 'Doanh số', en: 'Sales' },
		variant: { vi: 'Biến thể', en: 'Variant' },
		onHand: { vi: 'Tồn kho', en: 'On hand' },
		reserved: { vi: 'Đặt trước', en: 'Reserved' },
		loading: { vi: 'Đang tải…', en: 'Loading…' },
		loadFail: { vi: 'Không tải được dữ liệu', en: 'Failed to load data' },
		empty: { vi: 'Chưa có dữ liệu', en: 'No data' }
	} as const;

	function text(key: keyof typeof t): string {
		return t[key][lang];
	}

	// ── State ──
	let data = $state<DashboardData | null>(null);
	let loading = $state(true);
	let loadError = $state<string | undefined>(undefined);
	let needLogin = $state(false);
	let lastUpdated = $state<Date | null>(null);

	let encryptionKeys = $state<
		{ publicKey: CryptoKey; privateKey: CryptoKey } | undefined
	>(undefined);

	// ── Refresh: data 60s, full page 30 phút ──
	const DATA_INTERVAL_MS = 60_000;
	const PAGE_RELOAD_MS = 30 * 60_000;
	const RETRY_LOGIN_MS = 15_000;

	let dataTimer: ReturnType<typeof setInterval> | undefined;
	let pageTimer: ReturnType<typeof setInterval> | undefined;
	let loginRetryTimer: ReturnType<typeof setTimeout> | undefined;

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(value);
	}

	function formatCount(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return String(value);
	}

	function formatTime(d: Date | null): string {
		if (!d) return '—';
		return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}).format(d);
	}

	function formatDateTime(raw?: string | null): string {
		if (!raw) return '—';
		try {
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				hour: '2-digit',
				minute: '2-digit',
				day: '2-digit',
				month: '2-digit'
			}).format(new Date(raw));
		} catch {
			return '—';
		}
	}

	// ── Load data qua API admin dashboard (encrypted, cần session) ──
	async function loadData() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		needLogin = false;
		try {
			const res = await encryption.fetchSecure(
				'/api/admin/dashboard',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (res.ok) {
				data = (res.data as DashboardData | undefined) ?? null;
				lastUpdated = new Date();
			} else if (res.status === 401) {
				needLogin = true;
			} else {
				loadError = text('loadFail');
			}
		} catch (e) {
			// fetchSecure ném Error khi status != 200 (vd 401 chưa login)
			const m = e instanceof Error ? e.message : String(e);
			if (/status 401/.test(m)) {
				needLogin = true;
			} else {
				loadError = text('loadFail');
			}
		} finally {
			loading = false;
		}
	}

	// Khi 401: đứng yên hiển thị thông báo + retry 15s (TV không ai gõ password)
	function scheduleLoginRetry() {
		if (loginRetryTimer) clearTimeout(loginRetryTimer);
		loginRetryTimer = setTimeout(() => {
			void loadData();
		}, RETRY_LOGIN_MS);
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		// redirect param từ hooks khi chưa login — nếu vừa bị đá về login thì
		// tự quay lại /display sau khi đăng nhập xong ở thiết bị khác (session cookie
		// dùng chung trình duyệt TV-box). Trang này KHÔNG nằm trong publicPaths
		// (quyết định: session-based, không thêm token query — URL treo tường dễ lộ).
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };

		await loadData();

		dataTimer = setInterval(() => {
			if (!needLogin) void loadData();
		}, DATA_INTERVAL_MS);

		pageTimer = setInterval(() => {
			// full reload 30 phút — giải phóng memory leak/fragment tích tụ trên TV chạy 24/7
			window.location.reload();
		}, PAGE_RELOAD_MS);
	});

	// needLogin bật → bắt đầu retry loop
	$effect(() => {
		if (needLogin) scheduleLoginRetry();
	});

	// redirect=1 → user vừa login ở tab khác: thử lại ngay
	$effect(() => {
		if (page.url.searchParams.get('retry') === '1' && encryptionKeys) void loadData();
	});

	onDestroy(() => {
		if (dataTimer) clearInterval(dataTimer);
		if (pageTimer) clearInterval(pageTimer);
		if (loginRetryTimer) clearTimeout(loginRetryTimer);
	});

	function goLogin() {
		goto('/login?redirect=/display');
	}
</script>

<svelte:head>
	<title>{text('title')}</title>
</svelte:head>

<div class="display-root" data-test="display-root">
	<header class="display-header">
		<div class="display-title-wrap">
			<h1 class="display-title" data-test="display-title">{text('title')}</h1>
			<span class="display-updated">
				{text('updated')}: {formatTime(lastUpdated)}
			</span>
		</div>
		<span class="display-clock" data-test="display-clock">
			{new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				weekday: 'long',
				hour: '2-digit',
				minute: '2-digit'
			}).format(new Date())}
		</span>
	</header>

	{#if needLogin}
		<!-- Chưa có session: thông báo lớn cho người quản lý TV + tự retry -->
		<div class="display-notice" data-test="display-need-login" role="alert">
			<h2>{text('needLogin')}</h2>
			<p>{text('needLoginHint')}</p>
			<button class="display-login-btn" onclick={goLogin}>{text('needLogin')}</button>
		</div>
	{:else if loading && !data}
		<div class="display-notice">
			<p class="display-loading">{text('loading')}</p>
		</div>
	{:else if loadError && !data}
		<div class="display-notice" role="alert">
			<p class="display-error">{loadError}</p>
		</div>
	{:else if data}
		<!-- ── Stat cards to cỡ TV ── -->
		<div class="stat-grid" data-test="display-stats">
			<div class="stat-card stat-primary" data-test="display-stat-today-orders">
				<span class="stat-label">{text('ordersToday')}</span>
				<span class="stat-value">{formatCount(data.orderStats?.todayOrders)}</span>
			</div>
			<div class="stat-card" data-test="display-stat-revenue">
				<span class="stat-label">{text('revenue')}</span>
				<span class="stat-value">{formatMoney(data.orderStats?.deliveredRevenue)}</span>
			</div>
			<div class="stat-card" data-test="display-stat-total-orders">
				<span class="stat-label">{text('totalOrders')}</span>
				<span class="stat-value">{formatCount(data.orderStats?.totalOrders)}</span>
			</div>
			<div class="stat-card" data-test="display-stat-pending-payments">
				<span class="stat-label">{text('pendingPayments')}</span>
				<span class="stat-value">{formatCount(data.pendingPaymentsCount)}</span>
			</div>
			<div class="stat-card" data-test="display-stat-low-stock">
				<span class="stat-label">{text('lowStock')}</span>
				<span class="stat-value">{formatCount(data.lowStock?.length ?? 0)}</span>
			</div>
			<div class="stat-card" data-test="display-stat-open-pos">
				<span class="stat-label">{text('posOpen')}</span>
				<span class="stat-value">{formatCount(data.openPosSessions?.length ?? 0)}</span>
			</div>
		</div>

		<div class="panel-grid">
			<!-- ── Phiên POS đang mở ── -->
			<section class="panel" data-test="display-panel-pos">
				<h2 class="panel-title">{text('posOpen')}</h2>
				{#if !data.openPosSessions || data.openPosSessions.length === 0}
					<p class="panel-empty">{text('empty')}</p>
				{:else}
					<table class="display-table">
						<thead>
							<tr>
								<th scope="col">{text('device')}</th>
								<th scope="col">{text('openedAt')}</th>
								<th scope="col">{text('sales')}</th>
							</tr>
						</thead>
						<tbody>
							{#each data.openPosSessions as row (row._id)}
								<tr>
									<td class="col-strong">{row.deviceId ?? '—'}</td>
									<td>{formatDateTime(row.openedAt)}</td>
									<td class="col-num">{formatMoney(row.totalSales)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>

			<!-- ── Tồn kho thấp ── -->
			<section class="panel" data-test="display-panel-lowstock">
				<h2 class="panel-title">{text('lowStock')}</h2>
				{#if !data.lowStock || data.lowStock.length === 0}
					<p class="panel-empty">{text('empty')}</p>
				{:else}
					<table class="display-table">
						<thead>
							<tr>
								<th scope="col">{text('variant')}</th>
								<th scope="col">{text('onHand')}</th>
								<th scope="col">{text('reserved')}</th>
							</tr>
						</thead>
						<tbody>
							{#each data.lowStock as row (row._id)}
								<tr>
									<td class="col-strong">{row.variantId ?? '—'}</td>
									<td class="col-num">{formatCount(row.quantityOnHand)}</td>
									<td class="col-num">{formatCount(row.quantityReserved)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</section>
		</div>
	{/if}
</div>

<style lang="scss">
	/* TV dashboard — toàn token theme, KHÔNG hover, KHÔNG cursor interactions.
	   Typography to: 3xl→9xl theo token sizes. Dark mode tự theo data-theme. */
	.display-root {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 2.5rem 3rem;
		background: var(--background);
		color: var(--foreground);
		box-sizing: border-box;
	}

	.display-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 2rem;
		border-bottom: 2px solid var(--default-300);
		padding-bottom: 1.25rem;
	}

	.display-title {
		font-size: var(--text-5xl, 3rem);
		font-weight: 800;
		margin: 0;
		color: var(--foreground);
		letter-spacing: -0.02em;
	}

	.display-updated {
		display: block;
		margin-top: 0.5rem;
		font-size: var(--text-lg, 1.125rem);
		color: var(--foreground-500);
		font-variant-numeric: tabular-nums;
	}

	.display-clock {
		font-size: var(--text-2xl, 1.5rem);
		font-weight: 600;
		color: var(--primary-600);
		font-variant-numeric: tabular-nums;
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.5rem;
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.75rem 2rem;
		border-radius: 1.25rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);

		&.stat-primary {
			border-color: var(--primary-300);
			background: var(--primary-100);
		}
	}

	.stat-label {
		font-size: var(--text-xl, 1.25rem);
		color: var(--foreground-500);
		font-weight: 500;
	}

	.stat-value {
		font-size: var(--text-6xl, 4rem);
		line-height: 1.05;
		font-weight: 800;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;

		.stat-primary & {
			color: var(--primary-700);
		}
	}

	.panel-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		align-items: start;
		flex: 1;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.75rem 2rem;
		border-radius: 1.25rem;
		border: 1px solid var(--default-300);
		background: var(--background);
	}

	.panel-title {
		font-size: var(--text-2xl, 1.5rem);
		font-weight: 700;
		margin: 0;
		color: var(--foreground);
	}

	.panel-empty {
		font-size: var(--text-lg, 1.125rem);
		color: var(--foreground-500);
		margin: 0;
	}

	.display-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-lg, 1.125rem);

		th,
		td {
			padding: 0.9rem 0.75rem;
			border-bottom: 1px solid var(--default-200);
			text-align: left;
			white-space: nowrap;
		}

		th {
			font-size: var(--text-base, 1rem);
			text-transform: uppercase;
			font-weight: 600;
			color: var(--foreground-500);
		}

		tbody tr:last-child td {
			border-bottom: 0;
		}
	}

	.col-strong {
		font-weight: 600;
		color: var(--foreground);
		max-width: 22rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.col-num {
		font-variant-numeric: tabular-nums;
	}

	/* ── Trạng thái notice (login / loading / error) ── */
	.display-notice {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
		padding: 4rem 2rem;

		h2 {
			font-size: var(--text-4xl, 2.25rem);
			font-weight: 700;
			color: var(--warning-700, var(--foreground));
			margin: 0;
		}

		p {
			font-size: var(--text-xl, 1.25rem);
			color: var(--foreground-500);
			max-width: 48rem;
			margin: 0;
			line-height: 1.6;
		}

		.display-loading {
			font-size: var(--text-3xl, 1.875rem);
		}

		.display-error {
			color: var(--error);
			font-size: var(--text-2xl, 1.5rem);
		}
	}

	.display-login-btn {
		margin-top: 0.5rem;
		padding: 1rem 2.5rem;
		border: 0;
		border-radius: 0.9rem;
		background: var(--primary-500);
		color: var(--primary-foreground);
		font-size: var(--text-xl, 1.25rem);
		font-weight: 700;
		cursor: pointer;
	}

	/* TV 1920px+ — typography phóng thêm */
	@media (min-width: 1920px) {
		.display-root {
			padding: 3.5rem 4.5rem;
			gap: 2.5rem;
		}

		.display-title {
			font-size: var(--text-7xl, 4.5rem);
		}

		.stat-value {
			font-size: var(--text-8xl, 6rem);
		}

		.stat-label {
			font-size: var(--text-2xl, 1.5rem);
		}

		.display-table {
			font-size: var(--text-xl, 1.25rem);
		}
	}

	/* Tablet dọc / màn nhỏ hơn: stat 2 cột */
	@media (max-width: 1280px) {
		.stat-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.panel-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
