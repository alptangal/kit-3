<!-- src/routes/(authorized)/admin/email-logs/+page.svelte -->
<!-- Email logs: DataTable + filter status/template + Retry (secondary) + Xoá (error)
     + modal xem chi tiết. Retry là MOCK (chưa có SMTP thật). -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDateTime as formatDateTimeShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface EmailLogRow {
		_id?: string;
		emailId?: string;
		to?: string;
		subject?: string;
		template?: string;
		status?: string;
		error?: string | null;
		sentAt?: string | null;
		createdAt?: string | null;
		relatedType?: string | null;
		relatedId?: string | null;
		retryCount?: number;
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
		title: { vi: 'Email logs', en: 'Email logs' },
		subtitle: {
			vi: 'Theo dõi trạng thái gửi email của hệ thống',
			en: 'Track system email delivery status'
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allTemplates: { vi: 'Tất cả template', en: 'All templates' }
		},
		statuses: {
			queued: { vi: 'Đang chờ', en: 'Queued' },
			sent: { vi: 'Đã gửi', en: 'Sent' },
			failed: { vi: 'Thất bại', en: 'Failed' }
		},
		table: {
			to: { vi: 'Người nhận', en: 'To' },
			subject: { vi: 'Chủ đề', en: 'Subject' },
			template: { vi: 'Template', en: 'Template' },
			status: { vi: 'Trạng thái', en: 'Status' },
			createdAt: { vi: 'Thời gian', en: 'Time' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		actions: {
			view: { vi: 'Xem', en: 'View' },
			retry: { vi: 'Retry', en: 'Retry' },
			delete: { vi: 'Xoá', en: 'Delete' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh sách email logs', en: 'Failed to load email logs' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có email log nào', en: 'No email logs yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCount: { vi: '{total} email log', en: '{total} email logs' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		viewModal: {
			title: { vi: 'Chi tiết email', en: 'Email details' },
			to: { vi: 'Người nhận', en: 'To' },
			subject: { vi: 'Chủ đề', en: 'Subject' },
			template: { vi: 'Template', en: 'Template' },
			status: { vi: 'Trạng thái', en: 'Status' },
			error: { vi: 'Lỗi', en: 'Error' },
			sentAt: { vi: 'Gửi lúc', en: 'Sent at' },
			createdAt: { vi: 'Tạo lúc', en: 'Created at' },
			relatedType: { vi: 'Liên quan (loại)', en: 'Related (type)' },
			relatedId: { vi: 'Liên quan (ID)', en: 'Related (ID)' },
			retryCount: { vi: 'Số lần retry', en: 'Retry count' },
			close: { vi: 'Đóng', en: 'Close' }
		},
		deleteModal: {
			title: { vi: 'Xoá email log', en: 'Delete email log' },
			body: { vi: 'Xoá email log này? Hành động không thể hoàn tác.', en: 'Delete this email log? This cannot be undone.' },
			submit: { vi: 'Xoá', en: 'Delete' }
		},
		toasts: {
			retried: { vi: 'Đã đưa email vào hàng chờ gửi lại', en: 'Email re-queued for delivery' },
			deleted: { vi: 'Đã xoá email log', en: 'Email log deleted' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const EMAIL_STATUSES = ['queued', 'sent', 'failed'] as const;
	const TEMPLATE_FILTER_OPTIONS = [
		'',
		'verify-email',
		'reset-password',
		'order-confirmation',
		'shipment-update',
		'welcome'
	] as const;

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): string {
		switch (status) {
			case 'sent':
				return 'success';
			case 'failed':
				return 'error';
			default:
				return 'warning';
		}
	}

	// ── Danh sách ──
	let logs = $state<EmailLogRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let statusFilter = $state('');
	let templateFilter = $state('');

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDateTime(raw?: string | null): string {
		return formatDateTimeShared(raw, lang);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
	async function loadLogs() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/email-logs/list',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						status: statusFilter || undefined,
						template: templateFilter || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: EmailLogRow[]; total?: number; page?: number }
					| undefined;
				logs = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/email-logs] load failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadLogs();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadLogs();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadLogs();
	}

	// ── Retry (mock re-queue) ──
	let retryingId = $state<string | undefined>(undefined);

	async function retryEmail(row: EmailLogRow) {
		if (retryingId || !row._id || !encryptionKeys) return;
		retryingId = row._id;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/email-logs/retry',
				{ method: 'POST', body: { emailId: row._id } },
				encryptionKeys
			);
			retryingId = undefined;
			if (response.ok) {
				showToast(pageContents.toasts.retried[lang], 'success');
				await loadLogs();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			retryingId = undefined;
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/email-logs] retry failed:', err);
		}
	}

	// ── Xoá ──
	let deleteModalDisplay = $state(false);
	let deleteTarget = $state<EmailLogRow | null>(null);
	let deleteSubmitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	function canDelete(row: EmailLogRow): boolean {
		return row.status === 'failed';
	}

	function openDeleteModal(row: EmailLogRow) {
		deleteTarget = row;
		formError = undefined;
		deleteModalDisplay = true;
	}

	async function submitDelete() {
		if (deleteSubmitting || !deleteTarget?._id || !encryptionKeys) return;
		deleteSubmitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/email-logs/delete',
				{ method: 'POST', body: { emailId: deleteTarget._id } },
				encryptionKeys
			);
			deleteSubmitting = false;
			if (response.ok) {
				showToast(pageContents.toasts.deleted[lang], 'success');
				deleteModalDisplay = false;
				await loadLogs();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			deleteSubmitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/email-logs] delete failed:', err);
		}
	}

	// ── Modal xem chi tiết ──
	let viewModalDisplay = $state(false);
	let viewTarget = $state<EmailLogRow | null>(null);
	let viewLoading = $state(false);
	let viewError = $state<string | undefined>(undefined);

	async function openViewModal(row: EmailLogRow) {
		viewTarget = row;
		viewError = undefined;
		viewModalDisplay = true;
		if (!encryptionKeys) return;
		viewLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/email-logs/get',
				{ method: 'POST', body: { emailId: row._id } },
				encryptionKeys
			);
			viewLoading = false;
			if (response.ok) {
				const data = response.data as { item?: EmailLogRow } | undefined;
				if (data?.item) viewTarget = data.item;
			} else {
				viewError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			viewLoading = false;
			viewError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/email-logs] get failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadLogs();
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
			{#each EMAIL_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={templateFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allTemplates[lang]}</option>
			{#each TEMPLATE_FILTER_OPTIONS.slice(1) as template (template)}
				<option value={template}>{template}</option>
			{/each}
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadLogs}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadLogs}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if logs.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.to[lang]}</th>
						<th scope="col">{pageContents.table.subject[lang]}</th>
						<th scope="col">{pageContents.table.template[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.createdAt[lang]}</th>
						<th scope="col">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each logs as row (row._id)}
						<tr>
							<td class="col-wrap">{row.to ?? '—'}</td>
							<td class="col-subject">{row.subject ?? '—'}</td>
							<td class="col-template">{row.template ?? '—'}</td>
							<td class="col-status">
								<span class="status-badge status-{statusColor(row.status)}">{statusLabel(row.status)}</span>
							</td>
							<td>{formatDateTime(row.createdAt)}</td>
							<td class="col-actions">
								<Button color="default" variant="outline" size="sm" onClick={() => openViewModal(row)}>
									{pageContents.actions.view[lang]}
								</Button>
								{#if row.status === 'queued' || row.status === 'failed'}
									<!-- retry = secondary (default outline) -->
									<Button
										color="default"
										variant="outline"
										size="sm"
										loading={retryingId === row._id}
										disabled={retryingId === row._id}
										onClick={() => retryEmail(row)}
									>
										{pageContents.actions.retry[lang]}
									</Button>
								{/if}
								{#if canDelete(row)}
									<!-- delete = error -->
									<Button color="error" variant="outline" size="sm" onClick={() => openDeleteModal(row)}>
										{pageContents.actions.delete[lang]}
									</Button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- ── Phân trang ── -->
	<footer class="admin-pagination">
		<span class="total-count">{pageContents.pagination.totalCount[lang].replace('{total}', String(total))}</span>
		<div class="page-controls">
			<Button
				color="default"
				variant="outline"
				size="sm"
				disabled={pageNo <= 1}
				onClick={() => goToPage(pageNo - 1)}
			>
				{pageContents.pagination.prev[lang]}
			</Button>
			<Button
				color="default"
				variant="outline"
				size="sm"
				disabled={pageNo >= totalPages}
				onClick={() => goToPage(pageNo + 1)}
			>
				{pageContents.pagination.next[lang]}
			</Button>
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

<!-- ── Modal xem chi tiết ── -->
{#if viewModalDisplay}
	<Modal bind:display={viewModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.viewModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if viewLoading}
					<div class="admin-state compact">
						<p>{pageContents.states.loading[lang]}</p>
					</div>
				{:else if viewError}
					<div class="form-error-banner" role="alert">{viewError}</div>
				{:else if viewTarget}
					<dl class="detail-grid">
						<div class="detail-row">
							<dt>{pageContents.viewModal.to[lang]}</dt>
							<dd>{viewTarget.to ?? '—'}</dd>
						</div>
						<div class="detail-row">
							<dt>{pageContents.viewModal.subject[lang]}</dt>
							<dd>{viewTarget.subject ?? '—'}</dd>
						</div>
						<div class="detail-row">
							<dt>{pageContents.viewModal.template[lang]}</dt>
							<dd>{viewTarget.template ?? '—'}</dd>
						</div>
						<div class="detail-row">
							<dt>{pageContents.viewModal.status[lang]}</dt>
							<dd>
								<span class="status-badge status-{statusColor(viewTarget.status)}">
									{statusLabel(viewTarget.status)}
								</span>
							</dd>
						</div>
						{#if viewTarget.error}
							<div class="detail-row detail-error">
								<dt>{pageContents.viewModal.error[lang]}</dt>
								<dd class="error-text">{viewTarget.error}</dd>
							</div>
						{/if}
						<div class="detail-row">
							<dt>{pageContents.viewModal.sentAt[lang]}</dt>
							<dd>{formatDateTime(viewTarget.sentAt)}</dd>
						</div>
						<div class="detail-row">
							<dt>{pageContents.viewModal.createdAt[lang]}</dt>
							<dd>{formatDateTime(viewTarget.createdAt)}</dd>
						</div>
						{#if viewTarget.relatedType}
							<div class="detail-row">
								<dt>{pageContents.viewModal.relatedType[lang]}</dt>
								<dd>{viewTarget.relatedType}</dd>
							</div>
						{/if}
						{#if viewTarget.relatedId}
							<div class="detail-row">
								<dt>{pageContents.viewModal.relatedId[lang]}</dt>
								<dd class="mono">{viewTarget.relatedId}</dd>
							</div>
						{/if}
						{#if typeof viewTarget.retryCount === 'number'}
							<div class="detail-row">
								<dt>{pageContents.viewModal.retryCount[lang]}</dt>
								<dd>{viewTarget.retryCount}</dd>
							</div>
						{/if}
					</dl>
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						viewModalDisplay = false;
					}}
				>
					{pageContents.viewModal.close[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal xoá ── -->
{#if deleteModalDisplay}
	<Modal bind:display={deleteModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.deleteModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<p class="modal-body-text">{pageContents.deleteModal.body[lang]}</p>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- delete = error -->
				<Button color="error" onClick={submitDelete} loading={deleteSubmitting} disabled={deleteSubmitting}>
					{pageContents.deleteModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={deleteSubmitting}
					onClick={() => {
						deleteModalDisplay = false;
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

	.admin-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 3rem 1rem;
		color: var(--foreground-500);

		&.compact {
			padding: 1.5rem 1rem;
		}

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

	.col-wrap {
		white-space: normal;
		min-width: 10rem;
		max-width: 16rem;
		word-break: break-word;
	}

	.col-subject {
		white-space: normal;
		min-width: 12rem;
		max-width: 20rem;
	}

	.col-template {
		font-family: var(--font-mono, monospace);
		font-size: 0.8rem;
	}

	.col-status {
		white-space: nowrap;
	}

	.col-actions {
		white-space: nowrap;

		:global(button + button) {
			margin-left: 0.4rem;
		}
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

	.detail-grid {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin: 0;
	}

	.detail-row {
		display: grid;
		grid-template-columns: 10rem 1fr;
		gap: 0.75rem;
		align-items: baseline;

		dt {
			font-size: 0.8rem;
			font-weight: 600;
			color: var(--foreground-500);
		}

		dd {
			margin: 0;
			font-size: 0.9rem;
			color: var(--foreground);
			word-break: break-word;
		}

		&.detail-error dd {
			color: var(--error);
		}
	}

	.mono {
		font-family: var(--font-mono, monospace);
		font-size: 0.8rem;
	}
</style>
