<!-- src/routes/(authorized)/admin/activity/+page.svelte -->
<!-- Lịch sử truy cập user: card tổng hôm nay + chart requests theo giờ + bảng per-user
     (DataTable) + top pages (avg/p95 duration) + top lỗi 4xx/5xx.
     Filter: user (select) + khoảng ngày (from/to). API /api/admin/activity/*. -->
<script lang="ts">
	import { Button, DataTable, Chart } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import type { ChartDatum } from '$components/element/chart/_interface';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	// ── Types ──
	interface SummaryData {
		totalRequests: number;
		activeUsers: number;
		avgDurationMs: number;
		errorCount: number;
	}
	interface PerUserRow {
		userId: string;
		username?: string;
		totalRequests: number;
		firstAt: string;
		lastAt: string;
		spanMs: number;
		avgDurationMs: number;
	}
	interface TopPageRow {
		path: string;
		hits: number;
		avgDurationMs: number;
		p95DurationMs: number;
	}
	interface TopErrorRow {
		status: number;
		path: string;
		hits: number;
		lastAt: string;
	}
	interface UserOption {
		id: string;
		username?: string;
	}

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	const pageContents: { [k: string]: any } = {
		title: { vi: 'Lịch sử truy cập', en: 'Access history' },
		subtitle: {
			vi: 'Ai đang dùng ứng dụng, dùng bao lâu và trang nào chậm nhất',
			en: 'Who is using the app, for how long, and which pages are slowest'
		},
		cards: {
			today: { vi: 'Hôm nay', en: 'Today' },
			totalRequests: { vi: 'Tổng request', en: 'Total requests' },
			activeUsers: { vi: 'User hoạt động', en: 'Active users' },
			avgDuration: { vi: 'Thời gian phản hồi TB', en: 'Avg response time' },
			errors: { vi: 'Lỗi 4xx/5xx', en: 'Errors 4xx/5xx' }
		},
		filters: {
			allUsers: { vi: 'Tất cả user', en: 'All users' },
			from: { vi: 'Từ ngày', en: 'From' },
			to: { vi: 'Đến ngày', en: 'To' },
			user: { vi: 'User', en: 'User' }
		},
		sections: {
			hourly: { vi: 'Request theo giờ (hôm nay)', en: 'Requests by hour (today)' },
			perUser: { vi: 'Theo user (hôm nay)', en: 'Per user (today)' },
			topPages: { vi: 'Trang được truy cập nhiều nhất', en: 'Most visited pages' },
			slowestPages: { vi: 'Trang chậm nhất (avg)', en: 'Slowest pages (avg)' },
			topErrors: { vi: 'Lỗi 4xx/5xx nhiều nhất', en: 'Top errors 4xx/5xx' }
		},
		table: {
			user: { vi: 'User', en: 'User' },
			requests: { vi: 'Số request', en: 'Requests' },
			firstSeen: { vi: 'Truy cập đầu', en: 'First seen' },
			lastSeen: { vi: 'Truy cập cuối', en: 'Last seen' },
			span: { vi: 'Thời gian sử dụng', en: 'Usage span' },
			avgDuration: { vi: 'TB phản hồi', en: 'Avg response' },
			path: { vi: 'Đường dẫn', en: 'Path' },
			hits: { vi: 'Lượt', en: 'Hits' },
			p95: { vi: 'p95', en: 'p95' },
			status: { vi: 'Mã lỗi', en: 'Status' },
			lastAt: { vi: 'Lần cuối', en: 'Last at' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được dữ liệu lịch sử truy cập', en: 'Failed to load access history' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có dữ liệu truy cập', en: 'No access data yet' }
		}
	};

	function formatMs(n?: number): string {
		const v = Number(n ?? 0);
		if (v >= 1000) return `${(v / 1000).toFixed(1)}s`;
		return `${Math.round(v)}ms`;
	}

	function formatSpan(ms: number): string {
		if (ms <= 0) return '—';
		const totalSec = Math.floor(ms / 1000);
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		if (h > 0) return lang === 'vi' ? `${h} giờ ${m} phút` : `${h}h ${m}m`;
		if (m > 0) return lang === 'vi' ? `${m} phút` : `${m}m`;
		return lang === 'vi' ? `${totalSec} giây` : `${totalSec}s`;
	}

	function formatTime(raw?: string | null): string {
		if (!raw) return '—';
		try {
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			}).format(new Date(raw));
		} catch {
			return '—';
		}
	}

	function formatDateTime(raw?: string | null): string {
		if (!raw) return '—';
		try {
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}).format(new Date(raw));
		} catch {
			return '—';
		}
	}

	// ── Cặp khoá RSA ──
	let encryptionKeys = $state<
		| undefined
		| { publicKey: CryptoKey; privateKey: CryptoKey }
	>(undefined);

	// ── State ──
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);

	let summary = $state<SummaryData | undefined>(undefined);
	let perUserRows = $state<PerUserRow[]>([]);
	let topPagesByHits = $state<TopPageRow[]>([]);
	let topPagesByDuration = $state<TopPageRow[]>([]);
	let topErrors = $state<TopErrorRow[]>([]);
	let userOptions = $state<UserOption[]>([]);
	let hourlyData = $state<ChartDatum[]>([]);

	// ── Filter ──
	let userFilter = $state('');
	let fromFilter = $state('');
	let toFilter = $state('');

	function rangeParams() {
		return {
			userId: userFilter || undefined,
			from: fromFilter ? `${fromFilter}T00:00:00.000Z` : undefined,
			to: toFilter ? `${toFilter}T23:59:59.999Z` : undefined
		};
	}

	// ── Gọi API ──
	async function post<T>(url: string, body: Record<string, unknown>): Promise<T | undefined> {
		if (!encryptionKeys) throw new Error('no-keys');
		const response = await encryption.fetchSecure(url, { method: 'POST', body }, encryptionKeys);
		if (!response.ok) {
			throw new Error(resolveServerMessage(response.message, lang, pageContents.states.errorTitle));
		}
		return response.data as T;
	}

	async function loadAll() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		const range = rangeParams();
		try {
			const [s, pu, th, td, te, users] = await Promise.all([
				post<{ totalRequests: number; activeUsers: number; avgDurationMs: number; errorCount: number }>(
					'/api/admin/activity/query',
					{ type: 'summary' }
				),
				post<{ rows: PerUserRow[] }>('/api/admin/activity/query', { type: 'per-user' }),
				post<{ rows: TopPageRow[] }>(
					'/api/admin/activity/query',
					{ type: 'top-pages', orderBy: 'hits', limit: 8, ...range }
				),
				post<{ rows: TopPageRow[] }>(
					'/api/admin/activity/query',
					{ type: 'top-pages', orderBy: 'duration', limit: 8, ...range }
				),
				post<{ rows: TopErrorRow[] }>(
					'/api/admin/activity/query',
					{ type: 'top-errors', limit: 8, ...range }
				),
				post<{ rows: { userId: string; username?: string }[] }>(
					'/api/admin/activity/query',
					{ type: 'per-user', from: '2026-01-01T00:00:00.000Z' }
				)
			]);
			summary = s;
			perUserRows = pu?.rows ?? [];
			topPagesByHits = th?.rows ?? [];
			topPagesByDuration = td?.rows ?? [];
			topErrors = te?.rows ?? [];
			// User options: từ per-user rộng (từ 2026) — merge theo userId
			const map = new Map<string, UserOption>();
			for (const r of [...(users?.rows ?? []), ...perUserRows]) {
				if (!map.has(r.userId)) map.set(r.userId, { id: r.userId, username: r.username });
			}
			userOptions = [...map.values()];
			buildHourly();
			loadedOnce = true;
		} catch (err) {
			loadError = err instanceof Error && err.message !== 'no-keys'
				? err.message
				: resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/activity] load failed:', err);
		} finally {
			loading = false;
		}
	}

	// Chart request theo giờ hôm nay: aggregate từ per-user không đủ — query entries
	async function buildHourly() {
		try {
			const data = await post<{ rows: { at: string }[] }>('/api/admin/activity/entries', {
				pageSize: 100,
				page: 1
			});
			const buckets = Array.from({ length: 24 }, (_, h) => ({ h, n: 0 }));
			for (const r of data?.rows ?? []) {
				const hour = new Date(r.at).getHours();
				if (hour >= 0 && hour < 24) buckets[hour].n++;
			}
			hourlyData = buckets.map((b) => ({ label: `${String(b.h).padStart(2, '0')}:00`, value: b.n }));
		} catch {
			hourlyData = [];
		}
	}

	async function onFilterChange() {
		if (loading) return;
		await loadAll();
	}

	// ── Bảng per-user (DataTable) ──
	type PerUserGridRow = Record<string, unknown>;
	const perUserColumns = $derived<DataTableColumn<PerUserGridRow>[]>([
		{
			id: 'user',
			label: pageContents.table.user[lang],
			accessor: (row) => (row as unknown as PerUserRow).username ?? (row as unknown as PerUserRow).userId
		},
		{
			id: 'requests',
			label: pageContents.table.requests[lang],
			accessor: (row) => (row as unknown as PerUserRow).totalRequests,
			align: 'right'
		},
		{
			id: 'span',
			label: pageContents.table.span[lang],
			accessor: (row) => (row as unknown as PerUserRow).spanMs,
			render: (value) => formatSpan(Number(value ?? 0)),
			align: 'right'
		},
		{
			id: 'avg',
			label: pageContents.table.avgDuration[lang],
			accessor: (row) => (row as unknown as PerUserRow).avgDurationMs,
			render: (value) => formatMs(Number(value ?? 0)),
			align: 'right'
		},
		{
			id: 'first',
			label: pageContents.table.firstSeen[lang],
			accessor: (row) => formatTime((row as unknown as PerUserRow).firstAt)
		},
		{
			id: 'last',
			label: pageContents.table.lastSeen[lang],
			accessor: (row) => formatTime((row as unknown as PerUserRow).lastAt)
		}
	]);

	// ── Bảng top pages / top errors (bảng đơn giản, không cần sort/search) ──
	function userLabel(userId: string): string {
		const u = userOptions.find((o) => o.id === userId);
		return u?.username ?? userId;
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadAll();
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
		<label class="filter-field">
			<span>{pageContents.filters.user[lang]}</span>
			<select class="admin-select" bind:value={userFilter} onchange={onFilterChange} data-test="activity-filter-user">
				<option value="">{pageContents.filters.allUsers[lang]}</option>
				{#each userOptions as u (u.id)}
					<option value={u.id}>{u.username ?? u.id}</option>
				{/each}
			</select>
		</label>
		<label class="filter-field">
			<span>{pageContents.filters.from[lang]}</span>
			<input class="admin-input filter-date-input" type="date" bind:value={fromFilter} onchange={onFilterChange} data-test="activity-filter-from" />
		</label>
		<label class="filter-field">
			<span>{pageContents.filters.to[lang]}</span>
			<input class="admin-input filter-date-input" type="date" bind:value={toFilter} onchange={onFilterChange} data-test="activity-filter-to" />
		</label>
		<Button color="default" variant="outline" size="sm" onClick={loadAll} data-test="activity-retry">
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	{#if loading && !loadedOnce}
		<div class="admin-state" role="status" data-test="activity-loading">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="admin-state error" role="alert" data-test="activity-error">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="default" variant="outline" size="sm" onClick={loadAll}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else}
		<!-- ── Cards tổng hôm nay ── -->
		<div class="summary-cards" data-test="activity-summary">
			<div class="summary-card" data-test="activity-card-requests">
				<span class="card-label">{pageContents.cards.totalRequests[lang]}</span>
				<span class="card-value">{summary?.totalRequests ?? 0}</span>
				<span class="card-hint">{pageContents.cards.today[lang]}</span>
			</div>
			<div class="summary-card" data-test="activity-card-users">
				<span class="card-label">{pageContents.cards.activeUsers[lang]}</span>
				<span class="card-value">{summary?.activeUsers ?? 0}</span>
				<span class="card-hint">{pageContents.cards.today[lang]}</span>
			</div>
			<div class="summary-card" data-test="activity-card-duration">
				<span class="card-label">{pageContents.cards.avgDuration[lang]}</span>
				<span class="card-value">{formatMs(summary?.avgDurationMs)}</span>
				<span class="card-hint">{pageContents.cards.today[lang]}</span>
			</div>
			<div class="summary-card" class:card-error={(summary?.errorCount ?? 0) > 0} data-test="activity-card-errors">
				<span class="card-label">{pageContents.cards.errors[lang]}</span>
				<span class="card-value">{summary?.errorCount ?? 0}</span>
				<span class="card-hint">{pageContents.cards.today[lang]}</span>
			</div>
		</div>

		<!-- ── Chart requests theo giờ ── -->
		{#if hourlyData.length > 0}
			<div class="section-block" data-test="activity-hourly">
				<h2 class="section-title">{pageContents.sections.hourly[lang]}</h2>
				<Chart
					type="bar"
					data={hourlyData}
					color="var(--primary)"
					tooltip
					aria-label={pageContents.sections.hourly[lang]}
				/>
			</div>
		{/if}

		<!-- ── Bảng per-user ── -->
		<div class="section-block" data-test="activity-per-user">
			<h2 class="section-title">{pageContents.sections.perUser[lang]}</h2>
			<div class="admin-table-wrap">
				<DataTable
					data={perUserRows as unknown as PerUserGridRow[]}
					columns={perUserColumns}
					pageSize={10}
					showPagination={false}
					sortable
					resizable={{ enabled: true, fit: true }}
					loading={loading}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.empty[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					caption={{ vi: 'Sử dụng theo user', en: 'Usage per user' }}
					data-test="activity-user-table"
				/>
			</div>
		</div>

		<!-- ── Top pages (2 bảng: hits + duration) ── -->
		<div class="top-pages-grid">
			<div class="section-block" data-test="activity-top-pages">
				<h2 class="section-title">{pageContents.sections.topPages[lang]}</h2>
				<div class="admin-table-wrap">
					<table class="admin-table">
						<thead>
							<tr>
								<th scope="col">{pageContents.table.path[lang]}</th>
								<th scope="col">{pageContents.table.hits[lang]}</th>
								<th scope="col">{pageContents.table.avgDuration[lang]}</th>
								<th scope="col">{pageContents.table.p95[lang]}</th>
							</tr>
						</thead>
						<tbody>
							{#each topPagesByHits as row, i (row.path)}
								<tr data-test={i === 0 ? 'activity-top-page-first' : undefined}>
									<td class="col-path">{row.path}</td>
									<td class="col-num">{row.hits}</td>
									<td class="col-num">{formatMs(row.avgDurationMs)}</td>
									<td class="col-num">{formatMs(row.p95DurationMs)}</td>
								</tr>
							{:else}
								<tr><td colspan="4" class="col-empty">{pageContents.states.empty[lang]}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="section-block" data-test="activity-slow-pages">
				<h2 class="section-title">{pageContents.sections.slowestPages[lang]}</h2>
				<div class="admin-table-wrap">
					<table class="admin-table">
						<thead>
							<tr>
								<th scope="col">{pageContents.table.path[lang]}</th>
								<th scope="col">{pageContents.table.hits[lang]}</th>
								<th scope="col">{pageContents.table.avgDuration[lang]}</th>
								<th scope="col">{pageContents.table.p95[lang]}</th>
							</tr>
						</thead>
						<tbody>
							{#each topPagesByDuration as row, i (row.path)}
								<tr data-test={i === 0 ? 'activity-slow-page-first' : undefined}>
									<td class="col-path">{row.path}</td>
									<td class="col-num">{row.hits}</td>
									<td class="col-num">{formatMs(row.avgDurationMs)}</td>
									<td class="col-num">{formatMs(row.p95DurationMs)}</td>
								</tr>
							{:else}
								<tr><td colspan="4" class="col-empty">{pageContents.states.empty[lang]}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- ── Top errors ── -->
		<div class="section-block" data-test="activity-top-errors">
			<h2 class="section-title">{pageContents.sections.topErrors[lang]}</h2>
			<div class="admin-table-wrap">
				<table class="admin-table">
					<thead>
						<tr>
							<th scope="col">{pageContents.table.status[lang]}</th>
							<th scope="col">{pageContents.table.path[lang]}</th>
							<th scope="col">{pageContents.table.hits[lang]}</th>
							<th scope="col">{pageContents.table.lastAt[lang]}</th>
						</tr>
					</thead>
					<tbody>
						{#each topErrors as row, i (row.status + row.path)}
							<tr data-test={i === 0 ? 'activity-top-error-first' : undefined}>
								<td><span class="error-badge">{row.status}</span></td>
								<td class="col-path">{row.path}</td>
								<td class="col-num">{row.hits}</td>
								<td>{formatDateTime(row.lastAt)}</td>
							</tr>
						{:else}
							<tr><td colspan="4" class="col-empty">{pageContents.states.empty[lang]}</td></tr>
						{/each}
					</tbody>
				</table>
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

	.filter-field {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;

		> span {
			font-size: 0.8rem;
			color: var(--foreground-500);
		}
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
		height: 2.25rem;
		padding: 0 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.85rem;
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

	// ── Cards ──
	.summary-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.summary-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem 1.25rem;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);

		.card-label {
			font-size: 0.8rem;
			color: var(--foreground-500);
		}

		.card-value {
			font-size: 1.6rem;
			font-weight: 700;
			color: var(--foreground);
		}

		.card-hint {
			font-size: 0.75rem;
			color: var(--foreground-500);
		}

		&.card-error .card-value {
			color: var(--error);
		}
	}

	// ── Sections ──
	.section-block {
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

	.top-pages-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
		gap: 1.25rem;

		/* BẢY: grid item mặc định min-width:auto — bảng monospace dài (path +
		   4 cột số nowrap) đẩy item rộng hơn track → tràn mép phải viewport,
		   cắt mất cột P95. min-width:0 ép item co theo track, overflow-x của
		   .admin-table-wrap cuộn ngang thay vì phá khung. */
		& > * {
			min-width: 0;
		}

		@media (max-width: 960px) {
			grid-template-columns: 1fr;
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

	.col-path {
		font-family: var(--font-mono, monospace);
		font-size: 0.8rem;
		max-width: 22rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.col-num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.col-empty {
		text-align: center;
		color: var(--foreground-500);
	}

	.error-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		background: var(--error-100, var(--default-200));
		color: var(--error-700, var(--error));
	}
</style>
