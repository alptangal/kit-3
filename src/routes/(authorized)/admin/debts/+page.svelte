<script lang="ts">
	// /admin/debts — Quản lí công nợ 2 chiều: tab "Phải thu (khách hàng)" + "Phải trả (NCC)".
	// 1 trang 2 tab (pattern payments/transfers) — cùng collection `debts` nên
	// summary/DataTable/modal ghi nhận trả dùng chung, không lặp code 2 trang.
	import { onMount } from 'svelte';
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { resolveServerMessage } from '../_interface';

	interface DebtRow {
		_id: string;
		debtCode?: string | null;
		type?: 'receivable' | 'payable' | null;
		partyType?: string | null;
		partyId?: string | null;
		partyName?: string | null;
		referenceType?: string | null;
		referenceId?: string | null;
		referenceCode?: string | null;
		amount?: number | null;
		paidAmount?: number | null;
		remainingAmount?: number | null;
		dueDate?: string | null;
		status?: string | null;
		branchId?: string | null;
		notes?: string | null;
		createdBy?: string | null;
		settledAt?: string | null;
		createdAt?: string | null;
		updatedAt?: string | null;
	}

	interface PaymentRow {
		_id: string;
		debtId?: string | null;
		debtCode?: string | null;
		amount?: number | null;
		method?: string | null;
		paidAt?: string | null;
		receivedBy?: string | null;
		notes?: string | null;
		branchId?: string | null;
		createdAt?: string | null;
	}

	interface PartyOption {
		id: string;
		name: string;
	}

	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : 'en');

	let encryptionKeys: { publicKey: CryptoKey; privateKey: CryptoKey } | undefined = $state();

	// Tab đang xem: receivable (AR) | payable (AP)
	let activeTab: 'receivable' | 'payable' = $state('receivable');

	// Summary cards (lọc theo tab hiện tại)
	let summary = $state<{ totalOutstanding: number; totalPaid: number; overdueCount: number; openCount: number }>({
		totalOutstanding: 0,
		totalPaid: 0,
		overdueCount: 0,
		openCount: 0
	});

	// Danh sách khoản nợ
	let debts = $state<DebtRow[]>([]);
	let total = $state(0);
	let page = $state(1);
	let pageSize = $state(10);
	let loading = $state(false);
	let loadError = $state<string | undefined>();

	// Filter
	let statusFilter = $state('');

	// Modal ghi nhận trả
	let displayPay = $state(false);
	let payTarget = $state<DebtRow | null>(null);
	let payAmount = $state('');
	let payMethod = $state('cash');
	let payNotes = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>();

	// Modal tạo khoản nợ
	let displayCreate = $state(false);
	let createType = $state<'receivable' | 'payable'>('receivable');
	let createPartyId = $state('');
	let createAmount = $state('');
	let createDueDate = $state('');
	let createNotes = $state('');
	let createError = $state<string | undefined>();

	// Modal chi tiết + lịch sử thanh toán
	let displayDetail = $state(false);
	let detailDebt = $state<DebtRow | null>(null);
	let detailPayments = $state<PaymentRow[]>([]);
	let detailLoading = $state(false);

	// Modal xóa
	let displayDelete = $state(false);
	let deleteTarget = $state<DebtRow | null>(null);
	let deleting = $state(false);

	// Parties cho select tạo khoản nợ
	let customerOptions = $state<PartyOption[]>([]);
	let supplierOptions = $state<PartyOption[]>([]);

	const pageContents = {
		vi: {
			title: 'Công nợ',
			subtitle: 'Theo dõi công nợ phải thu (khách hàng) và phải trả (nhà cung cấp)',
			tabReceivable: 'Phải thu (khách hàng)',
			tabPayable: 'Phải trả (nhà cung cấp)',
			cardOutstanding: 'Còn nợ',
			cardPaid: 'Đã thanh toán',
			cardOverdue: 'Khoản quá hạn',
			cardOpen: 'Khoản chưa trả',
			colCode: 'Mã',
			colParty: 'Đối tượng',
			colReference: 'Nguồn',
			colAmount: 'Tổng nợ',
			colPaid: 'Đã trả',
			colRemaining: 'Còn lại',
			colDue: 'Hạn trả',
			colStatus: 'Trạng thái',
			colActions: '',
			btnCreate: 'Tạo khoản nợ',
			btnPay: 'Ghi nhận trả',
			btnDelete: 'Xóa',
			btnRetry: 'Thử lại',
			btnCancel: 'Hủy',
			btnSave: 'Ghi nhận',
			btnClose: 'Đóng',
			payTitle: 'Ghi nhận thanh toán',
			createTitle: 'Tạo khoản nợ',
			detailTitle: 'Chi tiết khoản nợ',
			deleteTitle: 'Xóa khoản nợ',
			deleteConfirm: 'Bạn có chắc muốn xóa khoản nợ này? Chỉ xóa được khi chưa có lịch sử thanh toán.',
			labelAmount: 'Số tiền',
			labelMethod: 'Phương thức',
			labelNotes: 'Ghi chú',
			labelParty: 'Đối tượng',
			labelDue: 'Hạn trả',
			labelRemaining: 'Còn lại',
			labelPaidHistory: 'Lịch sử thanh toán',
			methodCash: 'Tiền mặt',
			methodBank: 'Chuyển khoản',
			methodCard: 'Thẻ',
			methodOther: 'Khác',
			statusOpen: 'Chưa trả',
			statusPartial: 'Trả một phần',
			statusSettled: 'Đã tất toán',
			statusOverdue: 'Quá hạn',
			typeReceivable: 'Phải thu',
			typePayable: 'Phải trả',
			loading: 'Đang tải…',
			empty: 'Chưa có khoản nợ nào',
			emptyPayments: 'Chưa có lần thanh toán nào',
			noParty: 'Chọn đối tượng',
			payHintRemaining: 'Còn lại:',
			errAmount: 'Số tiền không hợp lệ',
			errParty: 'Vui lòng chọn đối tượng',
			errLoad: 'Không thể tải danh sách công nợ',
			paySuccess: 'Đã ghi nhận thanh toán',
			createSuccess: 'Đã tạo khoản nợ',
			deleteSuccess: 'Đã xóa khoản nợ',
			customerUnit: 'Khách',
			supplierUnit: 'NCC'
		},
		en: {
			title: 'Debts',
			subtitle: 'Track receivables (customers) and payables (suppliers)',
			tabReceivable: 'Receivable (customers)',
			tabPayable: 'Payable (suppliers)',
			cardOutstanding: 'Outstanding',
			cardPaid: 'Paid',
			cardOverdue: 'Overdue',
			cardOpen: 'Unpaid',
			colCode: 'Code',
			colParty: 'Party',
			colReference: 'Source',
			colAmount: 'Total',
			colPaid: 'Paid',
			colRemaining: 'Remaining',
			colDue: 'Due date',
			colStatus: 'Status',
			colActions: '',
			btnCreate: 'New debt',
			btnPay: 'Record payment',
			btnDelete: 'Delete',
			btnRetry: 'Retry',
			btnCancel: 'Cancel',
			btnSave: 'Record',
			btnClose: 'Close',
			payTitle: 'Record payment',
			createTitle: 'New debt',
			detailTitle: 'Debt detail',
			deleteTitle: 'Delete debt',
			deleteConfirm: 'Delete this debt? Only possible when there is no payment history.',
			labelAmount: 'Amount',
			labelMethod: 'Method',
			labelNotes: 'Notes',
			labelParty: 'Party',
			labelDue: 'Due date',
			labelRemaining: 'Remaining',
			labelPaidHistory: 'Payment history',
			methodCash: 'Cash',
			methodBank: 'Bank transfer',
			methodCard: 'Card',
			methodOther: 'Other',
			statusOpen: 'Open',
			statusPartial: 'Partial',
			statusSettled: 'Settled',
			statusOverdue: 'Overdue',
			typeReceivable: 'Receivable',
			typePayable: 'Payable',
			loading: 'Loading…',
			empty: 'No debts yet',
			emptyPayments: 'No payments yet',
			noParty: 'Select a party',
			payHintRemaining: 'Remaining:',
			errAmount: 'Invalid amount',
			errParty: 'Please select a party',
			errLoad: 'Failed to load debts',
			paySuccess: 'Payment recorded',
			createSuccess: 'Debt created',
			deleteSuccess: 'Debt deleted',
			customerUnit: 'Customer',
			supplierUnit: 'Supplier'
		}
	};
	type Lang = keyof typeof pageContents;
	const t = $derived(pageContents[lang as Lang]);

	const statusColors: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
		open: 'default',
		partial: 'warning',
		settled: 'success',
		overdue: 'danger'
	};

	function formatMoney(value?: number | null): string {
		const n = Number(value ?? 0);
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(n);
	}

	function formatDate(value?: string | null): string {
		if (!value) return '—';
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return '—';
		return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			dateStyle: 'medium'
		}).format(d);
	}

	function statusLabel(status?: string | null): string {
		switch (status) {
			case 'settled':
				return t.statusSettled;
			case 'partial':
				return t.statusPartial;
			case 'overdue':
				return t.statusOverdue;
			case 'open':
			default:
				return t.statusOpen;
		}
	}

	function methodLabel(method?: string | null): string {
		switch (method) {
			case 'bank_transfer':
				return t.methodBank;
			case 'card':
				return t.methodCard;
			case 'other':
				return t.methodOther;
			case 'cash':
			default:
				return t.methodCash;
		}
	}

	function showToast(title: string, color: 'success' | 'error' = 'success') {
		client.browser?.toasts?.create({ title, color });
	}

	async function loadSummary() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/debts/summary',
				{ method: 'POST', body: { type: activeTab } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { totalOutstanding: number; totalPaid: number; overdueCount: number; openCount: number };
				summary = {
					totalOutstanding: data.totalOutstanding ?? 0,
					totalPaid: data.totalPaid ?? 0,
					overdueCount: data.overdueCount ?? 0,
					openCount: data.openCount ?? 0
				};
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[debts] summary failed:', err);
		}
	}

	async function loadDebts() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/debts/list',
				{
					method: 'POST',
					body: {
						type: activeTab,
						status: statusFilter || undefined,
						page,
						pageSize
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as { items: DebtRow[]; total: number };
				debts = data.items ?? [];
				total = data.total ?? 0;
			} else {
				loadError = resolveServerMessage(response.message, lang, { vi: t.errLoad, en: t.errLoad });
			}
		} catch (err) {
			loading = false;
			loadError = t.errLoad;
			if (import.meta.env.DEV) console.error('[debts] list failed:', err);
		}
	}

	async function reload() {
		await Promise.all([loadSummary(), loadDebts()]);
	}

	async function loadParties() {
		if (!encryptionKeys) return;
		try {
			const [custRes, suppRes] = await Promise.all([
				encryption.fetchSecure('/api/admin/customers/list', { method: 'POST', body: { page: 1, pageSize: 100 } }, encryptionKeys),
				encryption.fetchSecure('/api/admin/suppliers/list', { method: 'POST', body: { page: 1, pageSize: 100 } }, encryptionKeys)
			]);
			if (custRes.ok) {
				const data = custRes.data as { items?: Record<string, any>[] };
				customerOptions = (data.items ?? []).map((c) => ({
					id: String(c._id ?? c.id ?? ''),
					name: [c.firstname, c.lastname].filter(Boolean).join(' ').trim() || String(c._id ?? '')
				}));
			}
			if (suppRes.ok) {
				const data = suppRes.data as { items?: Record<string, any>[] };
				supplierOptions = (data.items ?? []).map((s) => ({
					id: String(s._id ?? s.id ?? ''),
					name: String(s.name ?? s._id ?? '')
				}));
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[debts] load parties failed:', err);
		}
	}

	function openCreate(type: 'receivable' | 'payable') {
		createType = type;
		createPartyId = '';
		createAmount = '';
		createDueDate = '';
		createNotes = '';
		createError = undefined;
		displayCreate = true;
	}

	async function submitCreate() {
		if (displayCreate === false) return;
		const amount = Number(createAmount);
		if (!createPartyId || !Number.isFinite(amount) || amount <= 0) {
			createError = !createPartyId ? t.errParty : t.errAmount;
			return;
		}
		createError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/debts/create',
				{
					method: 'POST',
					body: {
						type: createType,
						partyId: createPartyId,
						amount,
						dueDate: createDueDate || null,
						notes: createNotes || null
					}
				},
				encryptionKeys
			);
			if (response.ok) {
				displayCreate = false;
				showToast(t.createSuccess, 'success');
				page = 1;
				await reload();
			} else {
				createError = resolveServerMessage(response.message, lang, { vi: t.errLoad, en: t.errLoad });
			}
		} catch (err) {
			createError = t.errLoad;
			if (import.meta.env.DEV) console.error('[debts] create failed:', err);
		}
	}

	function openPay(row: DebtRow) {
		payTarget = row;
		payAmount = String(row.remainingAmount ?? '');
		payMethod = 'cash';
		payNotes = '';
		formError = undefined;
		displayPay = true;
	}

	async function submitPay() {
		if (displayPay === false || !payTarget) return;
		const amount = Number(payAmount);
		if (!Number.isFinite(amount) || amount <= 0) {
			formError = t.errAmount;
			return;
		}
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/debts/record-payment',
				{
					method: 'POST',
					body: {
						id: payTarget._id,
						amount,
						method: payMethod,
						notes: payNotes || null
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				displayPay = false;
				showToast(t.paySuccess, 'success');
				await reload();
				if (displayDetail && detailDebt?._id === payTarget._id) {
					await openDetail({ ...payTarget, ...((response.data as any)?.debt ?? {}) } as DebtRow, true);
				}
			} else {
				formError = resolveServerMessage(response.message, lang, { vi: t.errAmount, en: t.errAmount });
			}
		} catch (err) {
			submitting = false;
			formError = t.errAmount;
			if (import.meta.env.DEV) console.error('[debts] record payment failed:', err);
		}
	}

	async function openDetail(row: DebtRow, keepOpen = false) {
		if (!keepOpen) {
			displayDetail = true;
			detailPayments = [];
			detailDebt = row;
		}
		detailLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/debts/get',
				{ method: 'POST', body: { id: row._id } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { debt: DebtRow; payments: PaymentRow[] };
				detailDebt = data.debt;
				detailPayments = data.payments ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[debts] detail failed:', err);
		}
		detailLoading = false;
	}

	function openDelete(row: DebtRow) {
		deleteTarget = row;
		displayDelete = true;
	}

	async function submitDelete() {
		if (displayDelete === false || !deleteTarget) return;
		deleting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/debts/delete',
				{ method: 'POST', body: { id: deleteTarget._id } },
				encryptionKeys
			);
			deleting = false;
			if (response.ok) {
				displayDelete = false;
				showToast(t.deleteSuccess, 'success');
				await reload();
			} else {
				showToast(resolveServerMessage(response.message, lang, { vi: t.errLoad, en: t.errLoad }), 'error');
			}
		} catch (err) {
			deleting = false;
			if (import.meta.env.DEV) console.error('[debts] delete failed:', err);
		}
	}

	function switchTab(tab: 'receivable' | 'payable') {
		if (activeTab === tab) return;
		activeTab = tab;
		page = 1;
		statusFilter = '';
		void reload();
	}

	// Pagination — server-side: Pagination element chỉ có bindable page (không
	// callback) — effect theo dõi page/pageSize refetch server. Chỉ chạy SAU lần
	// đầu (tránh trùng onMount); pendingPageApply bỏ qua lần response gán lại page
	// (chống vòng lặp fetch). Pattern brands/users page.
	const totalPages = $derived(Math.ceil(total / pageSize) || 1);
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
		void loadDebts();
	});

	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'debtCode',
			label: t.colCode,
			accessor: 'debtCode',
			noHighlight: true
		},
		{
			id: 'partyName',
			label: t.colParty,
			accessor: 'partyName'
		},
		{
			id: 'referenceCode',
			label: t.colReference,
			accessor: (row) => String((row as unknown as DebtRow).referenceCode ?? '—'),
			noHighlight: true
		},
		{
			id: 'amount',
			label: t.colAmount,
			accessor: (row) => formatMoney((row as unknown as DebtRow).amount),
			noHighlight: true
		},
		{
			id: 'paidAmount',
			label: t.colPaid,
			accessor: (row) => formatMoney((row as unknown as DebtRow).paidAmount),
			noHighlight: true
		},
		{
			id: 'remainingAmount',
			label: t.colRemaining,
			accessor: (row) => formatMoney((row as unknown as DebtRow).remainingAmount),
			noHighlight: true
		},
		{
			id: 'dueDate',
			label: t.colDue,
			accessor: (row) => formatDate((row as unknown as DebtRow).dueDate),
			noHighlight: true
		},
		{
			id: 'status',
			label: t.colStatus,
			accessor: 'status',
			status: (v) => statusColors[String(v ?? 'open')] ?? 'default'
		}
	]);

	onMount(() => {
		if (!client.browser) client.browser = {};
		encryption.generateRSAKeyPair().then((keys) => {
			encryptionKeys = keys;
			void loadParties();
			void reload();
		});
	});
</script>

<section class="admin-page" data-test="debts-page">
	<header class="admin-header">
		<div>
			<h1 class="admin-title">{t.title}</h1>
			<p class="admin-subtitle">{t.subtitle}</p>
		</div>
		<Button color="success" onClick={() => openCreate(activeTab)} data-test="debts-create-btn">
			{t.btnCreate}
		</Button>
	</header>

	<div class="debts-tabs" role="tablist">
		<button
			type="button"
			class="debts-tab"
			class:active={activeTab === 'receivable'}
			role="tab"
			aria-selected={activeTab === 'receivable'}
			onclick={() => switchTab('receivable')}
			data-test="debts-tab-receivable"
		>
			{t.tabReceivable}
		</button>
		<button
			type="button"
			class="debts-tab"
			class:active={activeTab === 'payable'}
			role="tab"
			aria-selected={activeTab === 'payable'}
			onclick={() => switchTab('payable')}
			data-test="debts-tab-payable"
		>
			{t.tabPayable}
		</button>
	</div>

	<div class="debts-summary">
		<div class="summary-card" data-test="debts-summary-outstanding">
			<span class="summary-label">{t.cardOutstanding}</span>
			<span class="summary-value">{formatMoney(summary.totalOutstanding)}</span>
		</div>
		<div class="summary-card" data-test="debts-summary-paid">
			<span class="summary-label">{t.cardPaid}</span>
			<span class="summary-value">{formatMoney(summary.totalPaid)}</span>
		</div>
		<div class="summary-card" class:danger={summary.overdueCount > 0} data-test="debts-summary-overdue">
			<span class="summary-label">{t.cardOverdue}</span>
			<span class="summary-value">{summary.overdueCount}</span>
		</div>
		<div class="summary-card" data-test="debts-summary-open">
			<span class="summary-label">{t.cardOpen}</span>
			<span class="summary-value">{summary.openCount}</span>
		</div>
	</div>

	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={() => { page = 1; void loadDebts(); }} data-test="debts-status-filter">
			<option value="">{t.colStatus}: all</option>
			<option value="open">{t.statusOpen}</option>
			<option value="partial">{t.statusPartial}</option>
			<option value="settled">{t.statusSettled}</option>
			<option value="overdue">{t.statusOverdue}</option>
		</select>
		<Button variant="outline" onClick={() => void reload()}>{t.btnRetry}</Button>
	</div>

	{#if loadError}
		<div class="admin-state error" data-test="debts-error">{loadError}</div>
	{:else}
		<div class="admin-table-wrap">
			<DataTable
				data={debts as unknown as Record<string, unknown>[]}
				{columns}
				pageSize={pageSize}
				showPagination={false}
				loading={loading}
				visual={{ striped: true, hoverable: true }}
				emptyLabel={t.empty}
				loadingLabel={t.loading}
				caption={t.title}
				actionsLabel={t.colActions}
				stickyHead
				data-test="debts-table"
			>
				{#snippet actionsContent(row)}
					{@const debt = row as unknown as DebtRow}
					<div class="row-actions">
						{#if debt.status !== 'settled'}
							<Button variant="outline" color="success" onclick={() => openPay(debt)} data-test="debts-pay-btn">
								{t.btnPay}
							</Button>
						{/if}
						<Button variant="outline" color="primary" onclick={() => void openDetail(debt)} data-test="debts-detail-btn">
							{t.detailTitle}
						</Button>
						<Button variant="outline" color="error" onclick={() => openDelete(debt)} data-test="debts-delete-btn">
							{t.btnDelete}
						</Button>
					</div>
				{/snippet}
			</DataTable>
		</div>

		<footer class="admin-pagination">
			<span class="total-count">{total} {lang === 'vi' ? 'khoản' : 'items'}</span>
			<div class="page-info-wrap">
				<Pagination bind:page totalPages={totalPages} loading={loading} variant="compact" />
			</div>
			<select
				class="admin-select page-size-select"
				value={pageSize}
				onchange={(e) => {
					pageSize = Number((e.currentTarget as HTMLSelectElement).value);
					page = 1;
				}}
			>
				{#each [10, 20, 50, 100] as size (size)}
					<option value={size}>{size}</option>
				{/each}
			</select>
		</footer>
	{/if}
</section>

<!-- Modal ghi nhận trả -->
{#if displayPay}
	<Modal bind:display={displayPay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>{t.payTitle}</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if payTarget}
					<p class="pay-target-info">
						{payTarget.debtCode} — {payTarget.partyName}
						<br />
						{t.payHintRemaining} <strong>{formatMoney(payTarget.remainingAmount)}</strong>
					</p>
				{/if}
				{#if formError}
					<div class="form-error-banner">{formError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-field">
						<label class="form-label" for="pay-amount">{t.labelAmount}</label>
						<input id="pay-amount" class="admin-input" type="number" min="0" bind:value={payAmount} data-test="debts-pay-amount" />
					</div>
					<div class="form-field">
						<label class="form-label" for="pay-method">{t.labelMethod}</label>
						<select id="pay-method" class="admin-select" bind:value={payMethod} data-test="debts-pay-method">
							<option value="cash">{t.methodCash}</option>
							<option value="bank_transfer">{t.methodBank}</option>
							<option value="card">{t.methodCard}</option>
							<option value="other">{t.methodOther}</option>
						</select>
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="pay-notes">{t.labelNotes}</label>
						<textarea id="pay-notes" class="admin-textarea" rows="2" bind:value={payNotes}></textarea>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-footer-root">
					<Button color="success" loading={submitting} disabled={submitting} onClick={() => void submitPay()} data-test="debts-pay-submit">
						{t.btnSave}
					</Button>
					<Button variant="ghost" onClick={() => { displayPay = false; }}>{t.btnCancel}</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- Modal tạo khoản nợ -->
{#if displayCreate}
	<Modal bind:display={displayCreate} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>{t.createTitle}</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if createError}
					<div class="form-error-banner">{createError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-field">
						<label class="form-label" for="create-type">{t.colStatus}</label>
						<select id="create-type" class="admin-select" bind:value={createType}>
							<option value="receivable">{t.typeReceivable}</option>
							<option value="payable">{t.typePayable}</option>
						</select>
					</div>
					<div class="form-field">
						<label class="form-label" for="create-party">{t.labelParty}</label>
						<select id="create-party" class="admin-select" bind:value={createPartyId} data-test="debts-create-party">
							<option value="">{t.noParty}</option>
							{#each createType === 'receivable' ? customerOptions : supplierOptions as party}
								<option value={party.id}>{party.name}</option>
							{/each}
						</select>
					</div>
					<div class="form-field">
						<label class="form-label" for="create-amount">{t.labelAmount}</label>
						<input id="create-amount" class="admin-input" type="number" min="0" bind:value={createAmount} data-test="debts-create-amount" />
					</div>
					<div class="form-field">
						<label class="form-label" for="create-due">{t.labelDue}</label>
						<input id="create-due" class="admin-input" type="date" bind:value={createDueDate} />
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="create-notes">{t.labelNotes}</label>
						<textarea id="create-notes" class="admin-textarea" rows="2" bind:value={createNotes}></textarea>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-footer-root">
					<Button color="success" onClick={() => void submitCreate()}>{t.btnSave}</Button>
					<Button variant="ghost" onClick={() => { displayCreate = false; }}>{t.btnCancel}</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- Modal chi tiết + lịch sử -->
{#if displayDetail}
	<Modal bind:display={displayDetail} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>{t.detailTitle}</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if detailDebt}
					<div class="detail-grid">
						<div><span class="detail-key">{t.colCode}</span><span>{detailDebt.debtCode}</span></div>
						<div><span class="detail-key">{t.colParty}</span><span>{detailDebt.partyName}</span></div>
						<div><span class="detail-key">{t.colAmount}</span><span>{formatMoney(detailDebt.amount)}</span></div>
						<div><span class="detail-key">{t.colPaid}</span><span>{formatMoney(detailDebt.paidAmount)}</span></div>
						<div><span class="detail-key">{t.labelRemaining}</span><span>{formatMoney(detailDebt.remainingAmount)}</span></div>
						<div><span class="detail-key">{t.colDue}</span><span>{formatDate(detailDebt.dueDate)}</span></div>
						<div><span class="detail-key">{t.colStatus}</span><span>{statusLabel(detailDebt.status)}</span></div>
						{#if detailDebt.referenceCode}
							<div><span class="detail-key">{t.colReference}</span><span>{detailDebt.referenceCode}</span></div>
						{/if}
						{#if detailDebt.notes}
							<div><span class="detail-key">{t.labelNotes}</span><span>{detailDebt.notes}</span></div>
						{/if}
					</div>

					<h4 class="history-title">{t.labelPaidHistory}</h4>
					{#if detailLoading}
						<p class="history-empty">{t.loading}</p>
					{:else if detailPayments.length === 0}
						<p class="history-empty">{t.emptyPayments}</p>
					{:else}
						<table class="payments-table">
							<thead>
								<tr>
									<th>{t.colPaid}</th>
									<th>{t.labelMethod}</th>
									<th>{t.labelNotes}</th>
								</tr>
							</thead>
							<tbody>
								{#each detailPayments as p (p._id)}
									<tr>
										<td>{formatMoney(p.amount)}</td>
										<td>{methodLabel(p.method)}</td>
										<td>{p.notes ?? '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-footer-root">
					<Button variant="ghost" onClick={() => { displayDetail = false; }}>{t.btnClose}</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- Modal xóa -->
{#if displayDelete}
	<Modal bind:display={displayDelete} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>{t.deleteTitle}</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				<p>{t.deleteConfirm}</p>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-footer-root">
					<Button color="error" loading={deleting} disabled={deleting} onClick={() => void submitDelete()} data-test="debts-delete-confirm">
						{t.btnDelete}
					</Button>
					<Button variant="ghost" onClick={() => { displayDelete = false; }}>{t.btnCancel}</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<style lang="scss">
	.admin-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		color: var(--foreground);
	}

	.admin-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.admin-title {
		font-size: 1.5rem;
		font-weight: 600;
	}

	.admin-subtitle {
		color: var(--foreground-500);
		font-size: 0.875rem;
	}

	.debts-tabs {
		display: flex;
		gap: 0.5rem;
		border-bottom: 1px solid var(--default-300);
	}

	.debts-tab {
		padding: 0.5rem 1rem;
		border: none;
		background: transparent;
		color: var(--foreground-500);
		font-size: 0.875rem;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;

		&.active {
			color: var(--primary);
			border-bottom-color: var(--primary);
			font-weight: 600;
		}
	}

	.debts-summary {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
	}

	.summary-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--default-300);
		border-radius: 0.5rem;
		background: var(--background);

		&.danger .summary-value {
			color: var(--error);
		}
	}

	.summary-label {
		font-size: 0.75rem;
		color: var(--foreground-500);
	}

	.summary-value {
		font-size: 1.125rem;
		font-weight: 600;
	}

	.admin-filters {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.admin-select,
	.admin-input,
	.admin-textarea {
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--default-300);
		border-radius: 0.375rem;
		background: var(--background);
		color: var(--foreground);
		font-size: 0.875rem;
	}

	.admin-table-wrap {
		width: 100%;
		overflow: auto;

		/* Sticky thead: wrap overflow auto tao scroll context - th sticky bam theo
		   wrap (khong cuon) -> thead truot mat. Desktop co stickyHead: wrap phai
		   thoat scroll context. */
		@media (min-width: 768px) {
			&:has(:global(.datatable-sticky-head)) {
				overflow: visible;
			}
		}
	}

	.row-actions {
		display: flex;
		gap: 0.25rem;
		width: 1%;
		min-width: fit-content;
	}

	.admin-pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.total-count {
		font-size: 0.8125rem;
		color: var(--foreground-500);
	}

	.page-size-select {
		width: 5rem;
	}

	.admin-state {
		padding: 2rem;
		text-align: center;
		color: var(--foreground-500);

		&.error {
			color: var(--error);
		}
	}

	.form-error-banner {
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		background: var(--danger-soft, hsl(358, 62.5%, 90.6%));
		color: var(--error);
		font-size: 0.8125rem;
		margin-bottom: 0.75rem;
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;

		&.form-field--full {
			grid-column: 1 / -1;
		}
	}

	.form-label {
		font-size: 0.8125rem;
		color: var(--foreground-500);
	}

	.pay-target-info {
		font-size: 0.875rem;
		color: var(--foreground-500);
		margin-bottom: 0.75rem;
	}

	.modal-footer-root {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		width: 100%;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem 1rem;

		> div {
			display: flex;
			flex-direction: column;
		}
	}

	.detail-key {
		font-size: 0.75rem;
		color: var(--foreground-500);
	}

	.history-title {
		margin-top: 1rem;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.history-empty {
		font-size: 0.8125rem;
		color: var(--foreground-500);
	}

	.payments-table {
		width: 100%;
		font-size: 0.8125rem;
		border-collapse: collapse;

		th,
		td {
			padding: 0.375rem 0.5rem;
			border-bottom: 1px solid var(--default-300);
			text-align: left;
		}
	}
</style>
