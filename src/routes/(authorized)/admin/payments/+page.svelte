<!-- src/routes/(authorized)/admin/payments/+page.svelte -->
<!-- Pha 5 #35: quản trị thanh toán — đối soát chuyển khoản ngân hàng (bank_transfer).
     List + filter status + confirm (pending → completed) + markFailed (hỏi reason).
     Pattern theo trang promotions (fetchSecure POST encrypted, pageContents vi/en). -->
<script lang="ts">
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDateTime as formatDateTimeShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface PaymentRow {
		_id?: string;
		paymentCode?: string;
		orderId?: string;
		method?: string;
		amount?: number;
		status?: string;
		transactionReference?: string | null;
		notes?: string | null;
		processedBy?: string | null;
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
		title: { vi: 'Thanh toán', en: 'Payments' },
		subtitle: {
			vi: 'Đối soát thanh toán: xác nhận chuyển khoản ngân hàng hoặc đánh dấu thất bại',
			en: 'Payment reconciliation: confirm bank transfers or mark payments as failed'
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allMethods: { vi: 'Tất cả phương thức', en: 'All methods' }
		},
		table: {
			paymentCode: { vi: 'Mã thanh toán', en: 'Payment code' },
			orderId: { vi: 'Đơn hàng', en: 'Order' },
			method: { vi: 'Phương thức', en: 'Method' },
			amount: { vi: 'Số tiền', en: 'Amount' },
			transaction: { vi: 'Mã giao dịch', en: 'Transaction ref' },
			createdAt: { vi: 'Thời gian', en: 'Time' },
			status: { vi: 'Trạng thái', en: 'Status' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		methods: {
			cash: { vi: 'Tiền mặt', en: 'Cash' },
			credit_card: { vi: 'Thẻ tín dụng', en: 'Credit card' },
			bank_transfer: { vi: 'Chuyển khoản', en: 'Bank transfer' },
			e_wallet: { vi: 'Ví điện tử', en: 'E-wallet' },
			loyalty_points: { vi: 'Điểm tích luỹ', en: 'Loyalty points' }
		},
		statuses: {
			pending: { vi: 'Chờ xử lý', en: 'Pending' },
			completed: { vi: 'Hoàn tất', en: 'Completed' },
			failed: { vi: 'Thất bại', en: 'Failed' },
			refunded: { vi: 'Đã hoàn tiền', en: 'Refunded' }
		},
		actions: {
			confirm: { vi: 'Xác nhận đã nhận chuyển khoản', en: 'Confirm transfer received' },
			markFailed: { vi: 'Đánh dấu thất bại', en: 'Mark as failed' },
			checkQr: { vi: 'Check QR', en: 'Check QR' }
		},
		qr: {
			badgeAuto: {
				vi: 'Tự động xác nhận QR: đang chạy (mỗi {n}s)',
				en: 'QR auto-confirm: running (every {n}s)'
			},
			checking: { vi: 'Đang kiểm tra…', en: 'Checking…' },
			confirmed: {
				vi: 'QR xác nhận thành công — thanh toán hoàn tất',
				en: 'QR confirmed — payment completed'
			},
			stillPending: {
				vi: 'Tool đối soát chưa thấy giao dịch — vẫn chờ',
				en: 'Checker tool has not seen the transaction — still pending'
			},
			failed: { vi: 'Kiểm tra QR thất bại', en: 'QR check failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh sách thanh toán', en: 'Failed to load payments' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có thanh toán nào', en: 'No payments yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCount: { vi: '{total} thanh toán', en: '{total} payments' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		confirmModal: {
			title: { vi: 'Xác nhận nhận chuyển khoản', en: 'Confirm bank transfer' },
			body: {
				vi: 'Xác nhận đã nhận đủ tiền chuyển khoản cho thanh toán này? Trạng thái sẽ chuyển sang "Hoàn tất".',
				en: 'Confirm the bank transfer for this payment has been received in full? Status will become "Completed".'
			},
			notes: { vi: 'Ghi chú đối soát (tuỳ chọn)', en: 'Reconciliation note (optional)' },
			transaction: { vi: 'Mã giao dịch tham chiếu (tuỳ chọn)', en: 'Transaction reference (optional)' },
			submit: { vi: 'Xác nhận', en: 'Confirm' }
		},
		failModal: {
			title: { vi: 'Đánh dấu thanh toán thất bại', en: 'Mark payment as failed' },
			reason: { vi: 'Lý do (bắt buộc)', en: 'Reason (required)' },
			submit: { vi: 'Đánh dấu thất bại', en: 'Mark as failed' }
		},
		toasts: {
			confirmed: { vi: 'Đã xác nhận nhận chuyển khoản', en: 'Bank transfer confirmed' },
			markedFailed: { vi: 'Đã đánh dấu thanh toán thất bại', en: 'Payment marked as failed' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireReason: { vi: 'Vui lòng nhập lý do', en: 'Please enter a reason' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
	const PAYMENT_METHODS = ['cash', 'credit_card', 'bank_transfer', 'e_wallet', 'loyalty_points'] as const;

	function methodLabel(method?: string): string {
		const key = (method ?? '') as keyof typeof pageContents.methods;
		const label = pageContents.methods[key];
		return label ? label[lang] : (method ?? '—');
	}

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): 'success' | 'warning' | 'danger' | 'default' {
		switch (status) {
			case 'completed':
				return 'success';
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
	let payments = $state<PaymentRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let statusFilter = $state('');
	let methodFilter = $state('');

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDateTime(raw?: string | null): string {
		return formatDateTimeShared(raw, lang);
	}

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	function isConfirmable(row: PaymentRow): boolean {
		return row.method === 'bank_transfer' && row.status === 'pending';
	}

	function isMarkFailedable(row: PaymentRow): boolean {
		return row.status === 'pending';
	}

	// ── QR payment (momo/zalopay/bank_transfer) — nút Check QR gọi tool đối soát ──
	// Gồm cả 'e_wallet' — POS map momo/zalopay → schema 'e_wallet' khi lưu payment.
	const QR_CHECK_METHODS = ['momo', 'zalopay', 'bank_transfer', 'e_wallet'];
	let checkingCode = $state<string | null>(null);
	let qrAutoPollInfo = $state<{ enabled: boolean; intervalMs?: number } | null>(null);

	function isQrCheckable(row: PaymentRow): boolean {
		return (
			row.status === 'pending' &&
			QR_CHECK_METHODS.includes(row.method ?? '') &&
			!!row.paymentCode
		);
	}

	async function checkQr(row: PaymentRow) {
		if (!row.paymentCode || checkingCode || !encryptionKeys) return;
		checkingCode = row.paymentCode;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/payments/qr/check',
				{ method: 'POST', body: { paymentCode: row.paymentCode } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { status?: string } | undefined;
				if (data?.status === 'completed') {
					showToast(pageContents.qr.confirmed[lang], 'success');
				} else {
					showToast(pageContents.qr.stillPending[lang], 'success');
				}
				await loadPayments();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.qr.failed), 'error');
			}
		} catch (err) {
			showToast(pageContents.qr.requestFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/payments] qr check failed:', err);
		} finally {
			checkingCode = null;
		}
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
	async function loadPayments() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/payments/list',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						status: statusFilter || undefined,
						method: methodFilter || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| {
							items?: PaymentRow[];
							total?: number;
							page?: number;
							qrAutoPoll?: { enabled: boolean; intervalMs?: number };
					  }
					| undefined;
				payments = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				if (data?.qrAutoPoll) qrAutoPollInfo = data.qrAutoPoll;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/payments] load failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadPayments();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadPayments();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadPayments();
	}

	// ── DataTable columns (status pill qua col.status — 'error' → 'danger') ──
	const paymentsAny = $derived(payments as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'paymentCode',
			label: pageContents.table.paymentCode[lang],
			sortable: true,
			accessor: (row) => (row as unknown as PaymentRow).paymentCode ?? '—'
		},
		{
			id: 'orderId',
			label: pageContents.table.orderId[lang],
			accessor: (row) => (row as unknown as PaymentRow).orderId ?? '—'
		},
		{
			id: 'method',
			label: pageContents.table.method[lang],
			sortable: true,
			accessor: (row) => methodLabel((row as unknown as PaymentRow).method)
		},
		{
			id: 'amount',
			label: pageContents.table.amount[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as PaymentRow).amount)
		},
		{
			id: 'transaction',
			label: pageContents.table.transaction[lang],
			accessor: (row) => (row as unknown as PaymentRow).transactionReference ?? '—',
			noHighlight: true
		},
		{
			id: 'createdAt',
			label: pageContents.table.createdAt[lang],
			sortable: true,
			accessor: (row) => formatDateTime((row as unknown as PaymentRow).createdAt),
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			sortable: true,
			accessor: (row) => statusLabel((row as unknown as PaymentRow).status),
			status: (_value, row) => statusColor((row as unknown as PaymentRow).status)
		}
	]);

	// ── Modal xác nhận chuyển khoản ──
	let confirmModalDisplay = $state(false);
	let confirmTarget = $state<PaymentRow | null>(null);
	let confirmNotes = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	function openConfirmModal(row: PaymentRow) {
		confirmTarget = row;
		confirmNotes = '';
		formError = undefined;
		confirmModalDisplay = true;
	}

	async function submitConfirm() {
		if (submitting || !confirmTarget?._id || !encryptionKeys) return;
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/payments/confirm',
				{
					method: 'POST',
					body: {
						paymentId: confirmTarget._id,
						notes: confirmNotes.trim() || undefined
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.confirmed)
						: pageContents.toasts.confirmed[lang],
					'success'
				);
				confirmModalDisplay = false;
				await loadPayments();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/payments] confirm failed:', err);
		}
	}

	// ── Modal đánh dấu thất bại ──
	let failModalDisplay = $state(false);
	let failTarget = $state<PaymentRow | null>(null);
	let failReason = $state('');

	function openFailModal(row: PaymentRow) {
		failTarget = row;
		failReason = '';
		formError = undefined;
		failModalDisplay = true;
	}

	async function submitMarkFailed() {
		if (submitting || !failTarget?._id || !encryptionKeys) return;
		if (!failReason.trim()) {
			formError = pageContents.form.requireReason[lang];
			return;
		}
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/payments/mark-failed',
				{
					method: 'POST',
					body: {
						paymentId: failTarget._id,
						reason: failReason.trim()
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.markedFailed)
						: pageContents.toasts.markedFailed[lang],
					'success'
				);
				failModalDisplay = false;
				await loadPayments();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/payments] mark-failed error:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadPayments();
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
		{#if qrAutoPollInfo?.enabled}
			<span class="qr-auto-badge" data-test="qr-auto-badge">
				{pageContents.qr.badgeAuto[lang].replace(
					'{n}',
					String(Math.round((qrAutoPollInfo.intervalMs ?? 30000) / 1000))
				)}
			</span>
		{/if}
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each PAYMENT_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={methodFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allMethods[lang]}</option>
			{#each PAYMENT_METHODS as method (method)}
				<option value={method}>{methodLabel(method)}</option>
			{/each}
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadPayments}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	{#if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadPayments}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else}
	<!-- ── Bảng thanh toán — DataTable (component có sẵn) ──
	     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
	     Pagination element bên dưới bind:page điều khiển server.
	     Skeleton + empty state do DataTable tự xử lý (loadingLabel/emptyLabel). -->
	<div class="admin-table-wrap">
		<DataTable
			data={paymentsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			searchable
			searchPlaceholder={{ vi: 'Tìm thanh toán…', en: 'Search payments…' }}
			resizable={{ enabled: true, fit: true }}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.states.empty[lang]}
			loadingLabel={pageContents.states.loading[lang]}
			caption={{ vi: 'Danh sách thanh toán', en: 'Payment list' }}
			actionsLabel={pageContents.table.actions}
			stickyHead
			data-test="payments-datatable"
		>
			{#snippet actionsContent(row)}
				{@const payment = row as unknown as PaymentRow}
				<div class="row-actions">
					{#if isQrCheckable(payment)}
						<!-- QR pending: Check QR gọi tool đối soát tự động (đặt trước confirm —
						     bank_transfer vẫn giữ nút Confirm thủ công bên cạnh) -->
						<Button
							color="primary"
							variant="outline"
							size="sm"
							loading={checkingCode === payment.paymentCode}
							disabled={!!checkingCode}
							onClick={() => checkQr(payment)}
						>
							{checkingCode === payment.paymentCode
								? pageContents.qr.checking[lang]
								: pageContents.actions.checkQr[lang]}
						</Button>
					{/if}
					{#if isConfirmable(payment)}
						<!-- Quy ước màu nút: confirm = success -->
						<Button color="success" size="sm" onClick={() => openConfirmModal(payment)}>
							{pageContents.actions.confirm[lang]}
						</Button>
					{:else if !isQrCheckable(payment) && isMarkFailedable(payment)}
						<!-- Quy ước màu nút: delete/mark-failed = error -->
						<Button color="error" size="sm" onClick={() => openFailModal(payment)}>
							{pageContents.actions.markFailed[lang]}
						</Button>
					{:else if !isQrCheckable(payment)}
						<span class="actions-none">—</span>
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

<!-- ── Modal xác nhận chuyển khoản ── -->
{#if confirmModalDisplay}
	<Modal bind:display={confirmModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.confirmModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<p class="modal-body-text">{pageContents.confirmModal.body[lang]}</p>
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.confirmModal.notes[lang]}</span>
						<textarea class="admin-textarea" rows="3" bind:value={confirmNotes} disabled={submitting}></textarea>
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- confirm = success -->
				<Button color="success" onClick={submitConfirm} loading={submitting} disabled={submitting}>
					{pageContents.confirmModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						confirmModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal đánh dấu thất bại ── -->
{#if failModalDisplay}
	<Modal bind:display={failModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.failModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.failModal.reason[lang]}</span>
						<textarea class="admin-textarea" rows="3" bind:value={failReason} disabled={submitting}></textarea>
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- mark-failed = error -->
				<Button color="error" onClick={submitMarkFailed} loading={submitting} disabled={submitting}>
					{pageContents.failModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						failModalDisplay = false;
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

	/* Badge trạng thái auto-confirm QR (chỉ hiện khi QR_CHECKER_AUTO_POLL=true + có URL tool) */
	.qr-auto-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--success, #2e7d32);
		background: var(--success-soft, hsl(152, 45%, 90%));
		border: 1px solid var(--success, #2e7d32);
		border-radius: 999px;
		padding: 0.3rem 0.75rem;
		white-space: nowrap;
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
		/* Sticky thead: wrap overflow-x auto tao scroll context - th sticky bam
		   theo wrap (khong cuon) -> thead truot mat. Desktop co stickyHead:
		   wrap phai thoat scroll context (beng ngang do .datatable-table-wrap tu cuon). */
		@media (min-width: 768px) {
			&:has(:global(.datatable-sticky-head)) {
				overflow-x: visible;
			}
		}
	}

	/* Nút action trong snippet actionsContent DataTable —
	   lồng .datatable-row + width:1% + min-width:fit-content chống nén (bẫy 39px clip) */
	.row-actions {
		display: flex;
		gap: 0.25rem;
		width: 1%;
		min-width: fit-content;
	}

	.actions-none {
		color: var(--foreground-500);
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
