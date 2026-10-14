<!-- src/routes/(authorized)/admin/analytics/+page.svelte -->
<!-- Trang thống kê biến động: giá nhập / nguồn cung / khối lượng nhập / tồn kho & giá bán. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Chart } from '$components/element';
	import type { ChartDatum } from '$components/element/chart/_interface';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { resolveServerMessage } from '../_interface';

	type AnalyticsTab = 'cost' | 'suppliers' | 'volume' | 'stock-price';

	interface TrendPoint {
		period: string;
		avg?: number;
		min?: number;
		max?: number;
		total?: number;
		netChange?: number;
		in?: number;
		out?: number;
		source?: string;
	}

	interface Forecast {
		trend: 'up' | 'down' | 'flat';
		nextEstimate: number | null;
		confidence: number | null;
		note?: { vi: string; en: string };
	}

	interface CostTrendData {
		points: TrendPoint[];
		dataNote?: { vi: string; en: string };
		forecast: Forecast;
	}

	interface SupplierRow {
		supplierId: string;
		supplierName?: string;
		avgCost: number;
		minCost: number;
		maxCost: number;
		totalQuantity: number;
		orderCount: number;
		lastReceivedAt?: string;
	}

	interface VolumeData {
		points: TrendPoint[];
		topVariants: { variantId: string; displayName?: string; totalQuantity: number; totalCost: number }[];
		forecast: Forecast;
	}

	interface StockData {
		points: TrendPoint[];
		currentStock: { variantId?: string; branchId?: string; onHand: number; available: number }[];
	}

	interface PriceTrendData {
		points: TrendPoint[];
		forecast: Forecast;
	}

	interface VariantOption {
		_id: string;
		sku?: string;
		displayName?: string;
	}

	interface BranchOption {
		_id: string;
		name?: string;
	}

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Cặp khoá RSA cho fetchSecure ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Nội dung song ngữ ──
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Thống kê', en: 'Analytics' },
		subtitle: {
			vi: 'Biến động giá nhập, khối lượng nhập, tồn kho và giá bán',
			en: 'Cost, purchase volume, stock and price movements'
		},
		tabs: {
			cost: { vi: 'Giá nhập', en: 'Cost' },
			suppliers: { vi: 'Nguồn cung', en: 'Suppliers' },
			volume: { vi: 'Khối lượng nhập', en: 'Purchase volume' },
			stockPrice: { vi: 'Tồn kho & Giá bán', en: 'Stock & Price' }
		},
		filters: {
			variant: { vi: 'Biến thể', en: 'Variant' },
			allVariants: { vi: 'Tất cả biến thể', en: 'All variants' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' },
			from: { vi: 'Từ', en: 'From' },
			to: { vi: 'Đến', en: 'To' },
			groupBy: { vi: 'Nhóm theo', en: 'Group by' },
			day: { vi: 'Ngày', en: 'Day' },
			week: { vi: 'Tuần', en: 'Week' },
			month: { vi: 'Tháng', en: 'Month' }
		},
		chart: {
			avgCost: { vi: 'Giá nhập TB', en: 'Avg cost' },
			minCost: { vi: 'Thấp nhất', en: 'Min' },
			maxCost: { vi: 'Cao nhất', en: 'Max' },
			purchaseTotal: { vi: 'Số lượng nhập', en: 'Quantity in' },
			purchaseCost: { vi: 'Tổng tiền nhập', en: 'Purchase cost' },
			stockIn: { vi: 'Nhập kho', en: 'Stock in' },
			stockOut: { vi: 'Xuất kho', en: 'Stock out' },
			netChange: { vi: 'Chênh lệch ròng', en: 'Net change' },
			salePrice: { vi: 'Giá bán TB', en: 'Avg sale price' },
			empty: { vi: 'Không có dữ liệu', en: 'No data' },
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' }
		},
		forecast: {
			title: { vi: 'Dự báo kỳ tới (naive)', en: 'Next period forecast (naive)' },
			next: { vi: 'Giá trị ước tính', en: 'Estimated value' },
			confidence: { vi: 'Độ tin cậy (R²)', en: 'Confidence (R²)' },
			up: { vi: 'Xu hướng tăng', en: 'Trending up' },
			down: { vi: 'Xu hướng giảm', en: 'Trending down' },
			flat: { vi: 'Xu hướng phẳng', en: 'Flat trend' }
		},
		tables: {
			period: { vi: 'Kỳ', en: 'Period' },
			avg: { vi: 'Trung bình', en: 'Average' },
			min: { vi: 'Thấp nhất', en: 'Min' },
			max: { vi: 'Cao nhất', en: 'Max' },
			source: { vi: 'Nguồn', en: 'Source' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			avgCost: { vi: 'Giá TB', en: 'Avg cost' },
			minCost: { vi: 'Thấp nhất', en: 'Min' },
			maxCost: { vi: 'Cao nhất', en: 'Max' },
			orders: { vi: 'Số lần nhập', en: 'Orders' },
			quantity: { vi: 'Tổng SL', en: 'Total qty' },
			lastReceived: { vi: 'Nhập gần nhất', en: 'Last received' },
			best: { vi: 'Giá tốt nhất', en: 'Best price' },
			variant: { vi: 'Biến thể', en: 'Variant' },
			totalQty: { vi: 'Tổng SL nhập', en: 'Total qty' },
			totalCost: { vi: 'Tổng tiền', en: 'Total cost' },
			onHand: { vi: 'Tồn thực', en: 'On hand' },
			available: { vi: 'Khả dụng', en: 'Available' },
			currentStock: { vi: 'Tồn hiện tại', en: 'Current stock' },
			topVariants: { vi: 'Top biến thể nhập nhiều', en: 'Top purchased variants' }
		},
		states: {
			errorTitle: { vi: 'Không tải được dữ liệu', en: 'Failed to load data' },
			retry: { vi: 'Thử lại', en: 'Retry' }
		},
		selectPlaceholder: { vi: 'Chọn biến thể', en: 'Select a variant' }
	};

	// ── State ──
	let activeTab = $state<AnalyticsTab>('cost');
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);

	let variantFilter = $state('');
	let branchFilter = $state('');
	let fromFilter = $state('');
	let toFilter = $state('');
	let groupBy = $state<'day' | 'week' | 'month'>('day');

	let variantOptions = $state<VariantOption[]>([]);
	let branches = $state<BranchOption[]>([]);

	// Dữ liệu từng tab
	let costData = $state<CostTrendData | undefined>(undefined);
	let supplierRows = $state<SupplierRow[]>([]);
	let supplierBestId = $state<string | undefined>(undefined);
	let volumeData = $state<VolumeData | undefined>(undefined);
	let stockData = $state<StockData | undefined>(undefined);
	let priceData = $state<PriceTrendData | undefined>(undefined);

	// ── Helpers ──
	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	function formatPeriod(period: string): string {
		if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
			const [, m, d] = period.split('-');
			return `${d}/${m}`;
		}
		if (/^\d{4}-W\d{2}$/.test(period)) return period.replace(/^(\d{4})-W(\d{2})$/, 'W$2/$1');
		if (/^\d{4}-\d{2}$/.test(period)) {
			const [y, m] = period.split('-');
			return `${m}/${y}`;
		}
		return period;
	}

	function formatDate(raw?: string | null): string {
		if (!raw) return '—';
		try {
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit'
			}).format(new Date(raw));
		} catch {
			return '—';
		}
	}

	function t(key: string): any {
		const [group, name] = key.split('.');
		return pageContents[group]?.[name] ?? { vi: key, en: key };
	}

	// ── Gọi API ──
	async function callAnalytics<T>(type: string, extra: Record<string, unknown> = {}): Promise<T | undefined> {
		if (!encryptionKeys) return undefined;
		const body: Record<string, unknown> = { type, groupBy };
		if (variantFilter) body.variantId = variantFilter;
		if (branchFilter) body.branchId = branchFilter;
		if (fromFilter) body.from = fromFilter;
		if (toFilter) body.to = toFilter;
		Object.assign(body, extra);

		const response = await encryption.fetchSecure('/api/admin/analytics/query', { method: 'POST', body }, encryptionKeys);
		if (response.ok) return response.data as T;
		throw new Error(resolveServerMessage(response.message, lang, t('states.errorTitle')));
	}

	async function loadTab() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			if (activeTab === 'cost') {
				costData = await callAnalytics<CostTrendData>('cost-trend');
			} else if (activeTab === 'suppliers') {
				const data = await callAnalytics<{ rows: SupplierRow[]; bestSupplierId?: string }>(
					'supplier-comparison',
					{ variantId: variantFilter }
				);
				if (data) {
					supplierRows = data.rows ?? [];
					supplierBestId = data.bestSupplierId;
				}
			} else if (activeTab === 'volume') {
				volumeData = await callAnalytics<VolumeData>('purchase-volume');
			} else {
				// Tab tồn kho & giá bán: 2 truy vấn song song
				const [stock, price] = await Promise.all([
					callAnalytics<StockData>('stock-trend'),
					callAnalytics<PriceTrendData>('price-trend', { variantId: variantFilter })
				]);
				stockData = stock;
				priceData = price;
				if (price && 'success' in price && !price.success && 'messages' in price) {
					showToast(
						resolveServerMessage(price.messages as { vi: string; en: string } | undefined, lang, t('states.errorTitle')),
						'error'
					);
				}
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	async function loadVariantOptions() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/list',
				{ method: 'POST', body: { page: 1, pageSize: 200 } },
				encryptionKeys
			);
			if (response.ok) {
				variantOptions = (response.data as { items?: VariantOption[] } | undefined)?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/analytics] load variants failed:', err);
		}
	}

	async function loadBranches() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/branches',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (response.ok) {
				branches = (response.data as BranchOption[] | undefined) ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/analytics] load branches failed:', err);
		}
	}

	function switchTab(tab: AnalyticsTab) {
		if (activeTab === tab) return;
		activeTab = tab;
		void loadTab();
	}

	function onFilterChange() {
		void loadTab();
	}

	// ── Chuẩn hoá dữ liệu chart ──
	const costSeries = $derived.by(() => {
		const points = costData?.points ?? [];
		const labels = points.map((p) => formatPeriod(p.period));
		return {
			labels,
			avg: points.map((p) => p.avg ?? 0),
			min: points.map((p) => p.min ?? 0),
			max: points.map((p) => p.max ?? 0)
		};
	});

	const volumeSeries = $derived.by(() => {
		const points = volumeData?.points ?? [];
		return {
			labels: points.map((p) => formatPeriod(p.period)),
			total: points.map((p) => p.total ?? 0),
			cost: points.map((p) => p.netChange ?? 0)
		};
	});

	const stockSeries = $derived.by(() => {
		const points = stockData?.points ?? [];
		return {
			labels: points.map((p) => formatPeriod(p.period)),
			in: points.map((p) => p.in ?? 0),
			out: points.map((p) => p.out ?? 0),
			net: points.map((p) => p.netChange ?? 0)
		};
	});

	const priceSeries = $derived.by(() => {
		const points = priceData?.points ?? [];
		return {
			labels: points.map((p) => formatPeriod(p.period)),
			avg: points.map((p) => p.avg ?? 0)
		};
	});

	function toChartData(values: number[], labels: string[]): ChartDatum[] {
		return labels.map((label, i) => ({ label, value: values[i] ?? 0 }));
	}

	function toSeriesData(name: string, color: string, values: number[], labels: string[]) {
		return { name, color, data: values };
	}

	const forecastBadge = $derived.by(() => {
		let forecast: Forecast | undefined;
		if (activeTab === 'cost') forecast = costData?.forecast;
		else if (activeTab === 'suppliers') forecast = undefined;
		else if (activeTab === 'volume') forecast = volumeData?.forecast;
		else forecast = priceData?.forecast;
		if (!forecast || forecast.nextEstimate === null) return undefined;
		return forecast;
	});

	function forecastLabel(trend: Forecast['trend']): string {
		return t(`forecast.${trend}`)[lang];
	}

	// ── Khởi động ──
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadVariantOptions(), loadBranches(), loadTab()]);
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page" data-test="analytics-page">
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		{#if forecastBadge}
			<div class="forecast-card" data-test="analytics-forecast">
				<span class="forecast-title">{t('forecast.title')[lang]}</span>
				<div class="forecast-row">
					<span class="forecast-trend" class:up={forecastBadge.trend === 'up'} class:down={forecastBadge.trend === 'down'}>
						{#if forecastBadge.trend === 'up'}▲{:else if forecastBadge.trend === 'down'}▼{:else}◆{/if}
						{forecastLabel(forecastBadge.trend)}
					</span>
					<span class="forecast-value">{t('forecast.next')[lang]}: <strong>{formatMoney(forecastBadge.nextEstimate)}</strong></span>
					{#if forecastBadge.confidence !== null}
						<span class="forecast-confidence">{t('forecast.confidence')[lang]}: {Math.round(forecastBadge.confidence * 100)}%</span>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- ── Tab ── -->
	<div class="tab-strip" role="tablist">
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'cost'}
			role="tab"
			aria-selected={activeTab === 'cost'}
			onclick={() => switchTab('cost')}
			data-test="analytics-tab-cost"
		>
			{t('tabs.cost')[lang]}
		</button>
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'suppliers'}
			role="tab"
			aria-selected={activeTab === 'suppliers'}
			onclick={() => switchTab('suppliers')}
			data-test="analytics-tab-suppliers"
		>
			{t('tabs.suppliers')[lang]}
		</button>
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'volume'}
			role="tab"
			aria-selected={activeTab === 'volume'}
			onclick={() => switchTab('volume')}
			data-test="analytics-tab-volume"
		>
			{t('tabs.volume')[lang]}
		</button>
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'stock-price'}
			role="tab"
			aria-selected={activeTab === 'stock-price'}
			onclick={() => switchTab('stock-price')}
			data-test="analytics-tab-stock-price"
		>
			{t('tabs.stockPrice')[lang]}
		</button>
	</div>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={variantFilter} onchange={onFilterChange} data-test="analytics-filter-variant">
			<option value="">{t('filters.allVariants')[lang]}</option>
			{#each variantOptions as v (v._id)}
				<option value={v._id}>{v.displayName || v.sku || v._id}</option>
			{/each}
		</select>
		{#if activeTab === 'cost' || activeTab === 'stock-price'}
			<select class="admin-select" bind:value={branchFilter} onchange={onFilterChange} data-test="analytics-filter-branch">
				<option value="">{t('filters.allBranches')[lang]}</option>
				{#each branches as b (b._id)}
					<option value={b._id}>{b.name ?? b._id}</option>
				{/each}
			</select>
		{/if}
		<label class="filter-date">
			<span>{t('filters.from')[lang]}</span>
			<input class="admin-input filter-date-input" type="date" bind:value={fromFilter} onchange={onFilterChange} />
		</label>
		<label class="filter-date">
			<span>{t('filters.to')[lang]}</span>
			<input class="admin-input filter-date-input" type="date" bind:value={toFilter} onchange={onFilterChange} />
		</label>
		<select class="admin-select" bind:value={groupBy} onchange={onFilterChange} data-test="analytics-filter-groupby">
			<option value="day">{t('filters.day')[lang]}</option>
			<option value="week">{t('filters.week')[lang]}</option>
			<option value="month">{t('filters.month')[lang]}</option>
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadTab}>
			{t('states.retry')[lang]}
		</Button>
	</div>

	<!-- ── Trạng thái ── -->
	{#if loadError}
		<div class="admin-state error" data-test="analytics-error">
			<p class="state-title">{t('states.errorTitle')[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="default" variant="outline" size="sm" onClick={loadTab}>{t('states.retry')[lang]}</Button>
		</div>
	{:else if loading}
		<div class="admin-state" data-test="analytics-loading">
			<p class="state-title">{t('chart.loading')[lang]}</p>
		</div>
	{:else if activeTab === 'cost'}
		<!-- ── Tab giá nhập ── -->
		{#if (costData?.points ?? []).length === 0}
			<div class="admin-state">
				<p class="state-title">{t('chart.empty')[lang]}</p>
			</div>
		{:else}
			<div class="chart-block">
				<Chart
					type="line"
					data={toChartData(costSeries.avg, costSeries.labels)}
					series={[
						toSeriesData(t('chart.avgCost')[lang], 'var(--primary)', costSeries.avg, costSeries.labels),
						toSeriesData(t('chart.minCost')[lang], 'var(--success)', costSeries.min, costSeries.labels),
						toSeriesData(t('chart.maxCost')[lang], 'var(--error)', costSeries.max, costSeries.labels)
					]}
					showPoints
					showArea
					tooltip
					valueFormatter={(n) => formatMoney(n)}
					aria-label={t('tabs.cost')[lang]}
				/>
				{#if costData?.dataNote}
					<p class="data-note">{resolveServerMessage(costData.dataNote, lang, { vi: '', en: '' })}</p>
				{/if}
			</div>
			<div class="admin-table-wrap">
				<table class="admin-table">
					<thead>
						<tr>
							<th>{t('tables.period')[lang]}</th>
							<th class="col-num">{t('tables.avg')[lang]}</th>
							<th class="col-num">{t('tables.min')[lang]}</th>
							<th class="col-num">{t('tables.max')[lang]}</th>
							<th>{t('tables.source')[lang]}</th>
						</tr>
					</thead>
					<tbody>
						{#each costData?.points ?? [] as point (point.period)}
							<tr data-test="analytics-cost-row">
								<td class="col-code">{formatPeriod(point.period)}</td>
								<td class="col-num">{formatMoney(point.avg)}</td>
								<td class="col-num">{formatMoney(point.min)}</td>
								<td class="col-num">{formatMoney(point.max)}</td>
								<td>{point.source === 'purchase_orders' ? 'purchase_orders' : 'price_history'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else if activeTab === 'suppliers'}
		<!-- ── Tab nguồn cung ── -->
		{#if !variantFilter}
			<div class="admin-state">
				<p class="state-title">{t('filters.allVariants')[lang]} — {t('filters.variant')[lang]}</p>
				<p class="state-detail">
					{lang === 'vi'
						? 'Chọn 1 biến thể ở bộ lọc để so sánh giá giữa các nhà cung cấp.'
						: 'Pick a variant in the filters to compare supplier prices.'}
				</p>
			</div>
		{:else if supplierRows.length === 0}
			<div class="admin-state">
				<p class="state-title">{t('chart.empty')[lang]}</p>
			</div>
		{:else}
			<div class="admin-table-wrap">
				<table class="admin-table">
					<thead>
						<tr>
							<th>{t('tables.supplier')[lang]}</th>
							<th class="col-num">{t('tables.avgCost')[lang]}</th>
							<th class="col-num">{t('tables.minCost')[lang]}</th>
							<th class="col-num">{t('tables.maxCost')[lang]}</th>
							<th class="col-num">{t('tables.orders')[lang]}</th>
							<th class="col-num">{t('tables.quantity')[lang]}</th>
							<th>{t('tables.lastReceived')[lang]}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each supplierRows as row (row.supplierId)}
							<tr data-test="analytics-supplier-row">
								<td class="col-code">{row.supplierName ?? row.supplierId}</td>
								<td class="col-num">{formatMoney(row.avgCost)}</td>
								<td class="col-num">{formatMoney(row.minCost)}</td>
								<td class="col-num">{formatMoney(row.maxCost)}</td>
								<td class="col-num">{row.orderCount}</td>
								<td class="col-num">{formatMoney(row.totalQuantity)}</td>
								<td>{formatDate(row.lastReceivedAt)}</td>
								<td>
									{#if row.supplierId === supplierBestId}
										<span class="best-badge" data-test="analytics-best-badge">{t('tables.best')[lang]}</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else if activeTab === 'volume'}
		<!-- ── Tab khối lượng nhập ── -->
		{#if (volumeData?.points ?? []).length === 0}
			<div class="admin-state">
				<p class="state-title">{t('chart.empty')[lang]}</p>
			</div>
		{:else}
			<div class="chart-block">
				<Chart
					type="bar"
					data={toChartData(volumeSeries.total, volumeSeries.labels)}
					tooltip
					valueFormatter={(n) => formatMoney(n)}
					title={t('chart.purchaseTotal')[lang]}
					aria-label={t('chart.purchaseTotal')[lang]}
				/>
				<Chart
					type="line"
					data={toChartData(volumeSeries.cost, volumeSeries.labels)}
					showPoints
					showArea
					tooltip
					valueFormatter={(n) => formatMoney(n)}
					title={t('chart.purchaseCost')[lang]}
					aria-label={t('chart.purchaseCost')[lang]}
				/>
			</div>
			{#if (volumeData?.topVariants ?? []).length > 0}
				<div class="admin-table-wrap">
					<table class="admin-table">
						<thead>
							<tr>
								<th>{t('tables.variant')[lang]}</th>
								<th class="col-num">{t('tables.totalQty')[lang]}</th>
								<th class="col-num">{t('tables.totalCost')[lang]}</th>
							</tr>
						</thead>
						<tbody>
							{#each volumeData?.topVariants ?? [] as top (top.variantId)}
								<tr data-test="analytics-top-variant-row">
									<td class="col-code">{top.displayName ?? top.variantId}</td>
									<td class="col-num">{formatMoney(top.totalQuantity)}</td>
									<td class="col-num">{formatMoney(top.totalCost)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	{:else}
		<!-- ── Tab tồn kho & giá bán ── -->
		{#if (stockData?.points ?? []).length === 0 && (priceData?.points ?? []).length === 0}
			<div class="admin-state">
				<p class="state-title">{t('chart.empty')[lang]}</p>
			</div>
		{:else}
			{#if (stockData?.points ?? []).length > 0}
				<div class="chart-block">
					<Chart
						type="line"
						data={toChartData(stockSeries.net, stockSeries.labels)}
						series={[
							toSeriesData(t('chart.stockIn')[lang], 'var(--success)', stockSeries.in, stockSeries.labels),
							toSeriesData(t('chart.stockOut')[lang], 'var(--error)', stockSeries.out, stockSeries.labels),
							toSeriesData(t('chart.netChange')[lang], 'var(--primary)', stockSeries.net, stockSeries.labels)
						]}
						showPoints
						tooltip
						aria-label={t('chart.netChange')[lang]}
					/>
				</div>
			{/if}
			{#if (priceData?.points ?? []).length > 0}
				<div class="chart-block">
					<Chart
						type="line"
						data={toChartData(priceSeries.avg, priceSeries.labels)}
						showPoints
						showArea
						tooltip
						valueFormatter={(n) => formatMoney(n)}
						title={t('chart.salePrice')[lang]}
						aria-label={t('chart.salePrice')[lang]}
					/>
				</div>
			{/if}
			{#if (stockData?.currentStock ?? []).length > 0}
				<div class="admin-table-wrap">
					<table class="admin-table">
						<thead>
							<tr>
								<th>{t('tables.variant')[lang]}</th>
								<th>{t('filters.branch')[lang]}</th>
								<th class="col-num">{t('tables.onHand')[lang]}</th>
								<th class="col-num">{t('tables.available')[lang]}</th>
							</tr>
						</thead>
						<tbody>
							{#each stockData?.currentStock ?? [] as row, i (i)}
								<tr data-test="analytics-stock-row">
									<td class="col-code">{row.variantId ?? '—'}</td>
									<td>{row.branchId ?? '—'}</td>
									<td class="col-num">{formatMoney(row.onHand)}</td>
									<td class="col-num">{formatMoney(row.available)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
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

	.forecast-card {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.75rem 1rem;
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
	}

	.forecast-title {
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--foreground-500);
		font-weight: 600;
	}

	.forecast-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		font-size: 0.9rem;
		color: var(--foreground);
	}

	.forecast-trend {
		font-weight: 600;

		&.up {
			color: var(--success);
		}

		&.down {
			color: var(--error);
		}
	}

	.forecast-confidence {
		font-size: 0.8rem;
		color: var(--foreground-500);
	}

	.tab-strip {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--default-200);
	}

	.tab-item {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		border: none;
		background: transparent;
		color: var(--foreground-500);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;

		&.active {
			color: var(--foreground);
			font-weight: 600;
			border-bottom-color: var(--primary);
		}

		&:hover {
			color: var(--foreground);
		}
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
		max-width: 16rem;

		option {
			background: var(--default-200);
			color: var(--foreground);
		}
	}

	.filter-date {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.filter-date-input {
		width: auto;
	}

	.admin-input {
		height: 2.25rem;
		padding: 0 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.85rem;

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

	.chart-block {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.data-note {
		font-size: 0.8rem;
		color: var(--foreground-500);
		margin: 0;
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
	}

	.col-num {
		font-variant-numeric: tabular-nums;
	}

	.best-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--success-100, var(--default-200));
		color: var(--success-700, var(--success));
	}
</style>
