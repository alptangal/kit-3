<!-- src/routes/(authorized)/admin/pos-sessions/+page.svelte -->
<script lang="ts">
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDateTime as formatDateTimeShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolveServerMessage } from '../_interface';

	interface PosSessionRow {
		_id?: string;
		deviceId?: string;
		branchId?: string;
		userId?: string;
		status?: string;
		openingBalance?: number;
		totalSales?: number;
		totalReturns?: number;
		totalExpenses?: number;
		totalCash?: number;
		closingBalance?: number | null;
		variance?: number | null;
		notes?: string | null;
		openedAt?: string | null;
		closedAt?: string | null;
	}

	interface BranchOption {
		_id: string;
		name?: string;
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
		title: { vi: 'Phiên POS', en: 'POS sessions' },
		subtitle: {
			vi: 'Mở phiên bán hàng theo thiết bị, cập nhật tổng số và chốt phiên đối soát tiền',
			en: 'Open register sessions per device, update totals and close with cash reconciliation'
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' },
			device: { vi: 'Thiết bị', en: 'Device' }
		},
		table: {
			device: { vi: 'Thiết bị', en: 'Device' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			status: { vi: 'Trạng thái', en: 'Status' },
			opening: { vi: 'Tiền đầu phiên', en: 'Opening' },
			sales: { vi: 'Bán', en: 'Sales' },
			returns: { vi: 'Trả hàng', en: 'Returns' },
			expenses: { vi: 'Chi phí', en: 'Expenses' },
			cash: { vi: 'Tiền quầy', en: 'Cash' },
			closing: { vi: 'Tiền cuối phiên', en: 'Closing' },
			variance: { vi: 'Chênh lệch', en: 'Variance' },
			opened: { vi: 'Mở lúc', en: 'Opened' },
			closed: { vi: 'Chốt lúc', en: 'Closed' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		statuses: {
			open: { vi: 'Đang mở', en: 'Open' },
			closed: { vi: 'Đã chốt', en: 'Closed' }
		},
		actions: {
			openSession: { vi: 'Mở phiên', en: 'Open session' },
			updateTotals: { vi: 'Cập nhật tổng', en: 'Update totals' },
			closeSession: { vi: 'Chốt phiên', en: 'Close session' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được phiên POS', en: 'Failed to load POS sessions' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có phiên POS nào', en: 'No POS sessions yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCount: { vi: '{total} phiên POS', en: '{total} POS sessions' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		openModal: {
			title: { vi: 'Mở phiên POS', en: 'Open POS session' },
			device: { vi: 'Mã thiết bị', en: 'Device id' },
			opening: { vi: 'Tiền đầu phiên', en: 'Opening balance' },
			notes: { vi: 'Ghi chú (tuỳ chọn)', en: 'Notes (optional)' },
			submit: { vi: 'Mở phiên', en: 'Open session' }
		},
		totalsModal: {
			title: { vi: 'Cập nhật tổng số phiên', en: 'Update session totals' },
			intro: {
				vi: 'Nhập lượng tăng thêm trong phiên (không phải tổng tích luỹ). Tiền quầy = tiền đầu + bán − trả − chi phí.',
				en: 'Enter amounts to add during the session (not running totals). Cash = opening + sales − returns − expenses.'
			},
			salesToAdd: { vi: 'Thêm doanh số', en: 'Sales to add' },
			returnsToAdd: { vi: 'Thêm trả hàng', en: 'Returns to add' },
			expensesToAdd: { vi: 'Thêm chi phí', en: 'Expenses to add' },
			confirm: { vi: 'Cập nhật', en: 'Update' }
		},
		closeModal: {
			title: { vi: 'Chốt phiên POS', en: 'Close POS session' },
			intro: {
				vi: 'Nhập số tiền thực đếm trong quầy để tính chênh lệch.',
				en: 'Enter the physically counted cash to compute the variance.'
			},
			closing: { vi: 'Tiền đếm thực tế', en: 'Counted cash' },
			notes: { vi: 'Ghi chú (tuỳ chọn)', en: 'Notes (optional)' },
			confirm: { vi: 'Chốt phiên', en: 'Close session' }
		},
		toasts: {
			opened: { vi: 'Đã mở phiên POS', en: 'POS session opened' },
			openFailed: { vi: 'Mở phiên không thành công', en: 'Failed to open session' },
			totalsUpdated: { vi: 'Đã cập nhật tổng số', en: 'Totals updated' },
			totalsFailed: { vi: 'Cập nhật tổng không thành công', en: 'Failed to update totals' },
			closed: { vi: 'Đã chốt phiên POS', en: 'POS session closed' },
			closeFailed: { vi: 'Chốt phiên không thành công', en: 'Failed to close session' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireDevice: { vi: 'Vui lòng nhập mã thiết bị', en: 'Please enter a device id' },
			requireAmount: { vi: 'Số tiền phải là số không âm', en: 'Amount must be a non-negative number' },
			requireClosing: { vi: 'Vui lòng nhập số tiền đếm thực tế', en: 'Please enter the counted cash' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// pathname ép về string

	const SESSION_STATUSES = ['open', 'closed'] as const;

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): 'success' | 'default' {
		switch (status) {
			case 'open':
				return 'success';
			case 'closed':
				return 'default';
			default:
				return 'default';
		}
	}

	// ── Danh sách ──
	let sessions = $state<PosSessionRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let statusFilter = $state('');
	let branchFilter = $state('');
	let deviceFilter = $state('');

	let branches = $state<BranchOption[]>([]);

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	function getBranchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const branch = branches.find((b) => b._id === branchId);
		return branch?.name ?? branchId;
	}

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDateTime(raw?: string | null): string {
		return formatDateTimeShared(raw, lang);
	}

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
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
			if (import.meta.env.DEV) console.error('[admin/pos-sessions] load branches failed:', err);
		}
	}

	async function loadSessions() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/sessions/list',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						status: statusFilter || undefined,
						branchId: branchFilter || undefined,
						deviceId: deviceFilter.trim() || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: PosSessionRow[]; total?: number; page?: number }
					| undefined;
				sessions = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/pos-sessions] load failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadSessions();
	}

	// Pagination element bind:page — đổi trang server qua effect armed-guard
	// (chạy sau lần arm đầu, tránh load trùng lúc mount — onMount đã gọi loadSessions)
	let pageArmed = $state(false);
	$effect(() => {
		void pageNo;
		if (!pageArmed) {
			pageArmed = true;
			return;
		}
		if (loading) return;
		void goToPage(pageNo);
	});

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadSessions();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadSessions();
	}

	// ---------- DataTable ----------
	const sessionsAny = $derived(sessions as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'device',
			label: pageContents.table.device[lang],
			sortable: true,
			accessor: (row) => (row as unknown as PosSessionRow).deviceId ?? '—'
		},
		{
			id: 'branch',
			label: pageContents.table.branch[lang],
			accessor: (row) => getBranchLabel((row as unknown as PosSessionRow).branchId),
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			sortable: true,
			accessor: (row) => statusLabel((row as unknown as PosSessionRow).status),
			status: (_v, row) => statusColor((row as unknown as PosSessionRow).status)
		},
		{
			id: 'opening',
			label: pageContents.table.opening[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as PosSessionRow).openingBalance),
			noHighlight: true
		},
		{
			id: 'sales',
			label: pageContents.table.sales[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as PosSessionRow).totalSales),
			noHighlight: true
		},
		{
			id: 'returns',
			label: pageContents.table.returns[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as PosSessionRow).totalReturns),
			noHighlight: true
		},
		{
			id: 'expenses',
			label: pageContents.table.expenses[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as PosSessionRow).totalExpenses),
			noHighlight: true
		},
		{
			id: 'cash',
			label: pageContents.table.cash[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as PosSessionRow).totalCash),
			noHighlight: true
		},
		{
			id: 'variance',
			label: pageContents.table.variance[lang],
			sortable: true,
			accessor: (row) => {
				const r = row as unknown as PosSessionRow;
				if (r.variance === null || r.variance === undefined) return '—';
				return `${r.variance > 0 ? '+' : ''}${formatMoney(r.variance)}`;
			},
			status: (_v, row) => {
				const v = (row as unknown as PosSessionRow).variance ?? 0;
				if (v < 0) return 'danger';
				if (v > 0) return 'success';
				return 'default';
			},
			noHighlight: true
		},
		{
			id: 'opened',
			label: pageContents.table.opened[lang],
			sortable: true,
			accessor: (row) => formatDateTime((row as unknown as PosSessionRow).openedAt),
			noHighlight: true
		}
	]);

	// ── Modal mở phiên ──
	let openModalDisplay = $state(false);
	let openSubmitting = $state(false);
	let openError = $state<string | undefined>(undefined);
	let openForm = $state<{ deviceId: string; openingBalance: number; notes: string }>({
		deviceId: '',
		openingBalance: 0,
		notes: ''
	});

	function openOpenModal() {
		openForm = { deviceId: '', openingBalance: 0, notes: '' };
		openError = undefined;
		openModalDisplay = true;
	}

	async function submitOpen() {
		if (openSubmitting || !encryptionKeys) return;
		if (!openForm.deviceId.trim()) {
			openError = pageContents.form.requireDevice[lang];
			return;
		}
		if (!Number.isFinite(openForm.openingBalance) || openForm.openingBalance < 0) {
			openError = pageContents.form.requireAmount[lang];
			return;
		}
		openError = undefined;
		openSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/sessions/open',
				{
					method: 'POST',
					body: {
						deviceId: openForm.deviceId.trim(),
						openingBalance: Number(openForm.openingBalance),
						notes: openForm.notes.trim() || undefined
					}
				},
				encryptionKeys
			);
			openSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.opened)
						: pageContents.toasts.opened[lang],
					'success'
				);
				openModalDisplay = false;
				await loadSessions();
			} else {
				openError = resolveServerMessage(response.message, lang, pageContents.toasts.openFailed);
			}
		} catch (err) {
			openSubmitting = false;
			openError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/pos-sessions] open failed:', err);
		}
	}

	// ── Modal cập nhật tổng ──
	let totalsModalDisplay = $state(false);
	let totalsRow = $state<PosSessionRow | null>(null);
	let totalsForm = $state<{ salesToAdd: number; returnsToAdd: number; expensesToAdd: number }>({
		salesToAdd: 0,
		returnsToAdd: 0,
		expensesToAdd: 0
	});
	let totalsBusy = $state(false);
	let totalsError = $state<string | undefined>(undefined);

	function openTotalsModal(row: PosSessionRow) {
		totalsRow = row;
		totalsForm = { salesToAdd: 0, returnsToAdd: 0, expensesToAdd: 0 };
		totalsError = undefined;
		totalsModalDisplay = true;
	}

	async function submitTotals() {
		if (!totalsRow || totalsBusy || !encryptionKeys) return;
		const { salesToAdd, returnsToAdd, expensesToAdd } = totalsForm;
		if (![salesToAdd, returnsToAdd, expensesToAdd].every((v) => Number.isFinite(v) && v >= 0)) {
			totalsError = pageContents.form.requireAmount[lang];
			return;
		}
		totalsBusy = true;
		totalsError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/sessions/update-totals',
				{
					method: 'POST',
					body: {
						sessionId: totalsRow._id,
						salesToAdd: Number(salesToAdd),
						returnsToAdd: Number(returnsToAdd),
						expensesToAdd: Number(expensesToAdd)
					}
				},
				encryptionKeys
			);
			totalsBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.totalsUpdated)
						: pageContents.toasts.totalsUpdated[lang],
					'success'
				);
				totalsModalDisplay = false;
				await loadSessions();
			} else {
				totalsError = resolveServerMessage(response.message, lang, pageContents.toasts.totalsFailed);
			}
		} catch (err) {
			totalsBusy = false;
			totalsError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/pos-sessions] update totals failed:', err);
		}
	}

	// ── Modal chốt phiên ──
	let closeModalDisplay = $state(false);
	let closeRow = $state<PosSessionRow | null>(null);
	let closeForm = $state<{ closingBalance: number; notes: string }>({ closingBalance: 0, notes: '' });
	let closeBusy = $state(false);
	let closeError = $state<string | undefined>(undefined);

	function openCloseModal(row: PosSessionRow) {
		closeRow = row;
		closeForm = { closingBalance: 0, notes: '' };
		closeError = undefined;
		closeModalDisplay = true;
	}

	async function submitClose() {
		if (!closeRow || closeBusy || !encryptionKeys) return;
		if (!Number.isFinite(closeForm.closingBalance) || closeForm.closingBalance < 0) {
			closeError = pageContents.form.requireClosing[lang];
			return;
		}
		closeBusy = true;
		closeError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/pos/sessions/close',
				{
					method: 'POST',
					body: {
						sessionId: closeRow._id,
						closingBalance: Number(closeForm.closingBalance),
						notes: closeForm.notes.trim() || undefined
					}
				},
				encryptionKeys
			);
			closeBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.closed)
						: pageContents.toasts.closed[lang],
					'success'
				);
				closeModalDisplay = false;
				await loadSessions();
			} else {
				closeError = resolveServerMessage(response.message, lang, pageContents.toasts.closeFailed);
			}
		} catch (err) {
			closeBusy = false;
			closeError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/pos-sessions] close failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadSessions(), loadBranches()]);
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
			<!-- Quy ước màu nút: create = success -->
			<Button color="success" onClick={openOpenModal}>{pageContents.actions.openSession[lang]}</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each SESSION_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={branchFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allBranches[lang]}</option>
			{#each branches as branch (branch._id)}
				<option value={branch._id}>{branch.name ?? branch._id}</option>
			{/each}
		</select>
		<input
			class="admin-input filter-device"
			type="text"
			bind:value={deviceFilter}
			placeholder={pageContents.filters.device[lang]}
			aria-label={pageContents.filters.device[lang]}
		/>
		<Button color="default" variant="outline" size="sm" onClick={loadSessions}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	{#if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadSessions}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else}
		<!-- ── Bảng phiên POS — DataTable (component có sẵn) ──
		     Server-side paging: paging trong DataTable TẮT, footer Pagination điều khiển server. -->
		<div class="admin-table-wrap">
			<DataTable
				data={sessionsAny}
				{columns}
				pageSize={pageSize}
				showPagination={false}
				sortable
				searchable
				searchPlaceholder={{ vi: 'Tìm phiên POS…', en: 'Search POS sessions…' }}
				resizable={{ enabled: true, fit: true }}
				loading={loading && !loadedOnce}
				visual={{ striped: true, hoverable: true }}
				emptyLabel={pageContents.states.empty[lang]}
				loadingLabel={pageContents.states.loading[lang]}
				caption={{ vi: 'Danh sách phiên POS', en: 'POS sessions list' }}
				actionsLabel={pageContents.table.actions[lang]}
				stickyHead
				data-test="pos-sessions-datatable"
			>
				{#snippet actionsContent(row)}
					{@const r = row as unknown as PosSessionRow}
					<div class="row-actions">
						{#if r.status === 'open'}
							<!-- update/edit = primary -->
							<Button color="primary" variant="ghost" size="sm" onClick={() => openTotalsModal(r)}>
								{pageContents.actions.updateTotals[lang]}
							</Button>
							<!-- close session là thao tác kết thúc → error -->
							<Button color="error" variant="ghost" size="sm" onClick={() => openCloseModal(r)}>
								{pageContents.actions.closeSession[lang]}
							</Button>
						{/if}
					</div>
				{/snippet}
			</DataTable>
		</div>
	{/if}

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
</section>

<!-- ── Modal mở phiên ── -->
{#if openModalDisplay}
	<Modal bind:display={openModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.openModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if openError}
					<div class="form-error-banner" role="alert">{openError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.openModal.device[lang]}</span>
						<input class="admin-input" type="text" bind:value={openForm.deviceId} disabled={openSubmitting} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.openModal.opening[lang]}</span>
						<input class="admin-input" type="number" min="0" step="any" bind:value={openForm.openingBalance} disabled={openSubmitting} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.openModal.notes[lang]}</span>
						<input class="admin-input" type="text" bind:value={openForm.notes} disabled={openSubmitting} />
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create = success -->
				<Button color="success" onClick={submitOpen} loading={openSubmitting} disabled={openSubmitting}>
					{pageContents.openModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={openSubmitting}
					onClick={() => {
						openModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal cập nhật tổng ── -->
{#if totalsModalDisplay}
	<Modal bind:display={totalsModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.totalsModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if totalsError}
					<div class="form-error-banner" role="alert">{totalsError}</div>
				{/if}
				<p class="modal-intro">
					<strong>{totalsRow?.deviceId ?? '—'}</strong>
					— {getBranchLabel(totalsRow?.branchId)}
				</p>
				<p class="modal-intro">{pageContents.totalsModal.intro[lang]}</p>
				<div class="form-grid">
					<div class="form-grid-3">
						<label class="form-field">
							<span class="form-label">{pageContents.totalsModal.salesToAdd[lang]}</span>
							<input class="admin-input" type="number" min="0" step="any" bind:value={totalsForm.salesToAdd} disabled={totalsBusy} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.totalsModal.returnsToAdd[lang]}</span>
							<input class="admin-input" type="number" min="0" step="any" bind:value={totalsForm.returnsToAdd} disabled={totalsBusy} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.totalsModal.expensesToAdd[lang]}</span>
							<input class="admin-input" type="number" min="0" step="any" bind:value={totalsForm.expensesToAdd} disabled={totalsBusy} />
						</label>
					</div>
					<p class="totals-preview">
						{pageContents.table.cash[lang]}:
						<strong>
							{formatMoney(
								(totalsRow?.openingBalance ?? 0) +
									(totalsRow?.totalSales ?? 0) +
									Number(totalsForm.salesToAdd || 0) -
									(totalsRow?.totalReturns ?? 0) -
									Number(totalsForm.returnsToAdd || 0) -
									(totalsRow?.totalExpenses ?? 0) -
									Number(totalsForm.expensesToAdd || 0)
							)}
						</strong>
					</p>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- update = primary -->
				<Button color="primary" onClick={submitTotals} loading={totalsBusy}>
					{pageContents.totalsModal.confirm[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						totalsModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal chốt phiên ── -->
{#if closeModalDisplay}
	<Modal bind:display={closeModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.closeModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if closeError}
					<div class="form-error-banner" role="alert">{closeError}</div>
				{/if}
				<p class="modal-intro">
					<strong>{closeRow?.deviceId ?? '—'}</strong>
					— {pageContents.table.cash[lang]}: {formatMoney(closeRow?.totalCash)}
				</p>
				<p class="modal-intro">{pageContents.closeModal.intro[lang]}</p>
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.closeModal.closing[lang]}</span>
						<input class="admin-input" type="number" min="0" step="any" bind:value={closeForm.closingBalance} disabled={closeBusy} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.closeModal.notes[lang]}</span>
						<input class="admin-input" type="text" bind:value={closeForm.notes} disabled={closeBusy} />
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- kết thúc phiên = error (thao tác chốt/kết thúc) -->
				<Button color="error" onClick={submitClose} loading={closeBusy}>
					{pageContents.closeModal.confirm[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={closeBusy}
					onClick={() => {
						closeModalDisplay = false;
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

	.admin-filters {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.filter-device {
		max-width: 14rem;
		width: auto;
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
		/* Sticky thead: wrap overflow-x auto tao scroll context - th sticky bam
		   theo wrap (khong cuon) -> thead truot mat. Desktop co stickyHead:
		   wrap phai thoat scroll context (beng ngang do .datatable-table-wrap tu cuon). */
		@media (min-width: 768px) {
			&:has(:global(.datatable-sticky-head)) {
				overflow-x: visible;
			}
		}
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

	.modal-intro {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--foreground);
		line-height: 1.5;
	}

	.totals-preview {
		font-size: 0.9rem;
		color: var(--foreground);
		margin: 0;
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

	.form-grid-3 {
		grid-template-columns: 1fr 1fr 1fr;

		@media (max-width: 680px) {
			grid-template-columns: 1fr;
		}
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
