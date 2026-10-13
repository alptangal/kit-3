<!-- src/routes/(authorized)/admin/customers/+page.svelte -->
<script lang="ts">
	// B6.2: migrate sang DataTable + Pagination (pattern users/variants page).
	// Giữ nguyên: stats bar, 3 modal (detail/status/delete), _interface.ts
	// (AdminCustomerRow, getStatusLabel/Color, getRowName, formatDate).
	// FIX BUG pre-existing: page cũ dùng bảng <table> thuần — không có
	// server-side filter (search/statusId) dù endpoint hỗ trợ; đổi sang
	// DataTable + search + select status filter.
	import { onMount } from 'svelte';
	import { Button, DataTable, Pagination } from '$components/element';
	import { Input, Label, TextField } from '$components/form';
	import { Checkbox } from '$components/form/checkbox';
	import { Modal } from '$components/modal';
	import { ModalContainer } from '$components/modal/Container';
	import { ModalHeader } from '$components/modal/Header';
	import { ModalBody } from '$components/modal/Body';
	import { ModalFooter } from '$components/modal/Footer';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import type { DataTableColumn } from '$components/element/datatable';
	import {
		getRowDocumentKey,
		getRowName,
		getStatusLabel,
		getStatusColor,
		formatDate,
		resolveServerMessage,
		pageContents,
		type AdminCustomerRow,
		type AdminCustomersStats
	} from './_interface';
	import type { Size } from '$components/interface';

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
	let customers = $state<AdminCustomerRow[]>([]);
	let total = $state(0);
	let page = $state(1);
	let pageSize = $state(20);
	let includeDeleted = $state(false);
	let searchQuery = $state('');
	let selectedStatus = $state('');
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);

	// ── Stats ──
	let stats = $state<AdminCustomersStats | null>(null);
	let statsLoading = $state(true);

	// ── Catalog statuses ──
	let statuses = $state<Array<{ id: string; name?: string; label?: string }>>([]);

	// ── Modal chi tiết ──
	let detailModalDisplay = $state(false);
	let detailModalCustomer = $state<AdminCustomerRow | null>(null);

	// ── Modal đổi trạng thái ──
	let statusModalDisplay = $state(false);
	let statusModalCustomer = $state<AdminCustomerRow | null>(null);
	let statusModalValue = $state('');
	let statusModalBusy = $state(false);

	// ── Modal xoá ──
	let deleteModalDisplay = $state(false);
	let deleteModalCustomer = $state<AdminCustomerRow | null>(null);
	let deleteModalBusy = $state(false);

	// ── Derived ──
	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const pageInfoText = $derived(
		pageContents.pagination.pageInfo[lang].replace('{page}', String(page)).replace('{total}', String(totalPages))
	);
	const totalCountText = $derived(
		pageContents.pagination.totalCount[lang].replace('{total}', String(total))
	);

	function isRowDeleted(row: AdminCustomerRow): boolean {
		return Boolean(row.deletedAt);
	}

	// ── Gọi API ──
	async function loadStats() {
		if (!encryptionKeys) return;
		statsLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/customers/stats',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			statsLoading = false;
			if (response.ok) {
				stats = response.data as AdminCustomersStats;
			}
		} catch (err) {
			statsLoading = false;
			if (import.meta.env.DEV) console.error('[customers] stats failed:', err);
		}
	}

	async function loadStatuses() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/roles',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (response.ok) {
				// Endpoint trả statuses theo shape {documentKey, name, ...} —
				// normalize (documentKey → id) như users page rồi lọc 4 status
				// hợp lệ cho customer.
				const data = response.data as { statuses?: Record<string, unknown>[] } | undefined;
				statuses = (data?.statuses ?? [])
					.map((raw) => {
						const r = raw as Record<string, any>;
						return {
							id: String(r.id ?? r.documentKey ?? r.key ?? r._id ?? ''),
							name: r.name as string | undefined,
							label: (r.label ?? r.displayName ?? r.name) as string | undefined
						};
					})
					.filter(
						(s) =>
							s.id &&
							['status-active', 'status-suspended', 'status-banned', 'status-pending_verification'].includes(
								s.id
							)
					);
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[customers] statuses failed:', err);
		}
	}

	async function loadCustomers() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/customers/list',
				{
					method: 'POST',
					body: {
						page,
						pageSize,
						includeDeleted,
						search: searchQuery || undefined,
						statusId: selectedStatus || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| {
							customers?: AdminCustomerRow[];
							items?: AdminCustomerRow[];
							total?: number;
							page?: number;
							pageSize?: number;
					  }
					| undefined;
				customers = data?.customers ?? data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number' && data.page !== page) {
					// response gán lại page (server clamp) — chặn effect refetch
					pendingPageApply = true;
					page = data.page;
				}
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, {
					vi: 'Không tải được danh sách khách hàng',
					en: 'Failed to load customer list'
				});
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, {
				vi: 'Không tải được danh sách khách hàng',
				en: 'Failed to load customer list'
			});
			if (import.meta.env.DEV) console.error('[customers] load failed:', err);
		}
	}

	async function refresh() {
		await Promise.all([loadCustomers(), loadStats()]);
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
			if (import.meta.env.DEV) console.error(`[customers] ${url} failed:`, err);
			client.browser?.toasts?.create({
				title: pageContents.toasts.requestFailed[lang],
				color: 'error'
			});
			return false;
		}
	}

	// ── Handlers mở modal ──
	function openDetailModal(row: AdminCustomerRow) {
		detailModalCustomer = row;
		detailModalDisplay = true;
	}

	function openStatusModal(row: AdminCustomerRow) {
		statusModalCustomer = row;
		statusModalValue = String(row.statusId ?? '');
		statusModalDisplay = true;
	}

	function openDeleteModal(row: AdminCustomerRow) {
		deleteModalCustomer = row;
		deleteModalDisplay = true;
	}

	// ── Handlers xác nhận trong modal ──
	async function confirmChangeStatus() {
		if (!statusModalCustomer || statusModalBusy) return;
		statusModalBusy = true;
		const ok = await runRowAction(
			'/api/admin/customers/set-status',
			{ documentKey: getRowDocumentKey(statusModalCustomer), statusId: statusModalValue },
			'statusChanged'
		);
		statusModalBusy = false;
		if (ok) {
			statusModalDisplay = false;
			await refresh();
		}
	}

	async function confirmDelete() {
		if (!deleteModalCustomer || deleteModalBusy) return;
		deleteModalBusy = true;
		const ok = await runRowAction(
			'/api/admin/customers/delete',
			{ documentKey: getRowDocumentKey(deleteModalCustomer) },
			'customerDeleted'
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
		void loadCustomers();
	});

	function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		page = 1;
		// effect theo dõi pageSize tự fetch
	}

	// ── Filters: search debounce + select status + checkbox (mỗi cái 1 effect
	//    riêng với guard armed + last-value — pattern users/variants page) ──
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
			void loadCustomers();
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
		void loadCustomers();
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
		void loadCustomers();
	});

	// ── B6.2: DataTable columns (status pill qua col.status — 'error' → 'danger') ──
	function customerStatusColor(statusId?: string | null): 'success' | 'warning' | 'danger' | 'default' {
		const color = getStatusColor(statusId);
		return color === 'error' ? 'danger' : (color as 'success' | 'warning' | 'default');
	}

	const customersAny = $derived(customers as unknown as Record<string, unknown>[]);
	const allColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'name',
			label: pageContents.table.name[lang],
			accessor: (row) => getRowName(row as unknown as AdminCustomerRow),
			sortable: false
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			accessor: (row) => getStatusLabel((row as unknown as AdminCustomerRow).statusId),
			status: (_value, row) => customerStatusColor((row as unknown as AdminCustomerRow).statusId)
		},
		{
			id: 'loyalty',
			label: pageContents.table.loyalty[lang],
			accessor: (row) => String((row as unknown as AdminCustomerRow).loyaltyPoints ?? 0),
			sortable: false
		},
		{
			id: 'created',
			label: pageContents.table.created[lang],
			accessor: (row) => formatDate((row as unknown as AdminCustomerRow).createdAt, lang),
			noHighlight: true
		},
		{
			id: 'lastLogin',
			label: pageContents.table.lastLogin[lang],
			accessor: (row) => formatDate((row as unknown as AdminCustomerRow).lastLoginAt, lang),
			noHighlight: true
		}
	]);
	// Mobile (375px): 6 cột bóp thành ~325px → truncate cực đoan. Giữ name +
	// status + loyalty (đặc trưng khách hàng), bỏ created/lastLogin.
	const isMobileViewport = $derived(client.browser?.isMobile ?? false);
	const columns = $derived(
		isMobileViewport
			? allColumns.filter((c) => !['created', 'lastLogin'].includes(c.id))
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
	onMount(() => subscribeDbChanges('customers', () => void loadCustomers()));
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadCustomers(), loadStats(), loadStatuses()]);
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
	<div class="admin-stats" role="region" aria-label={pageContents.stats.totalCustomers[lang]}>
		<div class="stat-card">
			<span class="stat-label">{pageContents.stats.totalCustomers[lang]}</span>
			<span class="stat-value">{stats?.totalCustomers ?? (statsLoading ? '—' : '0')}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{pageContents.stats.todayCustomers[lang]}</span>
			<span class="stat-value">{stats?.todayCustomers ?? (statsLoading ? '—' : '0')}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{pageContents.stats.activeCustomers[lang]}</span>
			<span class="stat-value">{stats?.activeCustomers ?? (statsLoading ? '—' : '0')}</span>
		</div>
		<div class="stat-card">
			<span class="stat-label">{pageContents.table.status[lang]}</span>
			<div class="stat-status-breakdown">
				{#if stats?.statusBreakdown}
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
			<Input placeholder={pageContents.filters.searchPlaceholder[lang]} bind:value={searchQuery}>
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
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each statuses as status (status.id)}
				<option value={status.id}>{status.label ?? status.name ?? status.id}</option>
			{/each}
		</select>
	</div>

	<!-- ── B6.2: bảng khách hàng — DataTable (component có sẵn) ──
	     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
	     Pagination element bên dưới bind:page điều khiển server. -->
	<div class="admin-table-wrap">
		<DataTable
			data={customersAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.states.empty[lang]}
			loadingLabel={pageContents.states.loading[lang]}
			caption={{ vi: 'Danh sách khách hàng', en: 'Customer list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
			stickyHead
			mobileTapMode="callback"
			onRowClick={(row) => openDetailModal(row as unknown as AdminCustomerRow)}
			cardFields={['name', 'status', 'loyalty', 'created', 'lastLogin']}
			data-test="customers-datatable"
		>
			{#snippet actionsContent(row)}
				{@const customer = row as unknown as AdminCustomerRow}
				<div class="row-actions">
					{#if includeDeleted && isRowDeleted(customer)}
						<!-- Không có restore cho khách hàng trong scope này -->
					{:else}
						<Button
							color="default"
							variant="ghost"
							size="sm"
							onClick={() => openDetailModal(customer)}
							data-test="customer-action-detail"
						>
							{pageContents.modals.detailTitle[lang]}
						</Button>
						<Button
							color="default"
							variant="ghost"
							size="sm"
							onClick={() => openStatusModal(customer)}
							data-test="customer-action-status"
						>
							{pageContents.modals.statusTitle[lang]}
						</Button>
						<Button
							color="error"
							variant="ghost"
							size="sm"
							onClick={() => openDeleteModal(customer)}
							data-test="customer-action-delete"
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

<!-- ── Modal chi tiết khách hàng ── -->
<Modal bind:display={detailModalDisplay} size="lg" isDimissable>
	<Modal.Container>
		<Modal.Container.Header>{pageContents.modals.detailTitle[lang]}</Modal.Container.Header>
		<Modal.Container.Body>
			{#if detailModalCustomer}
				<p class="modal-intro">
					{fillTemplate(pageContents.modals.detailIntro[lang], getRowName(detailModalCustomer))}
				</p>
				<div class="detail-section">
					<h4>{pageContents.table.name[lang]}</h4>
					<p>{getRowName(detailModalCustomer)}</p>
				</div>
				<div class="detail-section">
					<h4>{pageContents.table.status[lang]}</h4>
					<p><span class="status-badge status-{getStatusColor(detailModalCustomer.statusId)}">{getStatusLabel(detailModalCustomer.statusId)}</span></p>
				</div>
				<div class="detail-section">
					<h4>{pageContents.table.tier[lang]}</h4>
					<p>{detailModalCustomer.customerTierEncrypted ? 'VIP' : '—'}</p>
				</div>
				<div class="detail-section">
					<h4>{pageContents.table.loyalty[lang]}</h4>
					<p>{detailModalCustomer.loyaltyPoints ?? 0}</p>
				</div>
				<div class="detail-section">
					<h4>{pageContents.table.created[lang]}</h4>
					<p>{formatDate(detailModalCustomer.createdAt, lang)}</p>
				</div>
				<div class="detail-section">
					<h4>{pageContents.table.lastLogin[lang]}</h4>
					<p>{formatDate(detailModalCustomer.lastLoginAt, lang)}</p>
				</div>
				<div class="detail-section">
					<h4>{pageContents.modals.authMethod[lang]}</h4>
					<p>{detailModalCustomer.authMethod ?? '—'}</p>
				</div>
				<div class="detail-section">
					<h4>2FA</h4>
					<p>{detailModalCustomer.mfaEnabled ? pageContents.modals.mfaOn[lang] : pageContents.modals.mfaOff[lang]}</p>
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
				{fillTemplate(pageContents.modals.statusIntro[lang], getRowName(statusModalCustomer))}
			</p>
			<select class="admin-select" bind:value={statusModalValue} disabled={statusModalBusy}>
				{#each statuses as status (status.id)}
					<option value={status.id}>{status.label ?? status.name ?? status.id}</option>
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
				{fillTemplate(pageContents.modals.deleteIntro[lang], getRowName(deleteModalCustomer))}
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
