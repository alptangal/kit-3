<!-- src/routes/(authorized)/admin/notifications/+page.svelte -->
<!-- Quản trị thông báo hệ thống: list + filter type/isRead + markRead/markAllRead +
     tạo broadcast (admin only) + xoá. Pattern theo trang payments. -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface NotificationRow {
		_id?: string;
		notificationId?: string;
		userId?: string | null;
		broadcast?: boolean;
		title?: string;
		body?: string;
		type?: string;
		link?: string | null;
		isRead?: boolean;
		readAt?: string | null;
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
		title: { vi: 'Thông báo', en: 'Notifications' },
		subtitle: {
			vi: 'Quản lý thông báo hệ thống: theo dõi, đánh dấu đã đọc, gửi broadcast',
			en: 'Manage system notifications: track, mark read, send broadcasts'
		},
		createBtn: { vi: 'Tạo thông báo', en: 'Create notification' },
		markAllBtn: { vi: 'Đánh tất cả đã đọc', en: 'Mark all as read' },
		filters: {
			allTypes: { vi: 'Tất cả loại', en: 'All types' },
			allReadStates: { vi: 'Tất cả trạng thái đọc', en: 'All read states' },
			unreadOnly: { vi: 'Chưa đọc', en: 'Unread' },
			readOnly: { vi: 'Đã đọc', en: 'Read' }
		},
		types: {
			info: { vi: 'Thông tin', en: 'Info' },
			success: { vi: 'Thành công', en: 'Success' },
			warning: { vi: 'Cảnh báo', en: 'Warning' },
			error: { vi: 'Lỗi', en: 'Error' },
			order: { vi: 'Đơn hàng', en: 'Order' },
			stock: { vi: 'Tồn kho', en: 'Stock' },
			system: { vi: 'Hệ thống', en: 'System' }
		},
		table: {
			title: { vi: 'Tiêu đề', en: 'Title' },
			body: { vi: 'Nội dung', en: 'Body' },
			type: { vi: 'Loại', en: 'Type' },
			recipient: { vi: 'Người nhận', en: 'Recipient' },
			createdAt: { vi: 'Thời gian', en: 'Time' },
			status: { vi: 'Trạng thái', en: 'Status' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		broadcastLabel: { vi: 'Broadcast (tất cả user)', en: 'Broadcast (all users)' },
		statuses: {
			unread: { vi: 'Chưa đọc', en: 'Unread' },
			read: { vi: 'Đã đọc', en: 'Read' }
		},
		actions: {
			markRead: { vi: 'Đánh đã đọc', en: 'Mark as read' },
			delete: { vi: 'Xoá', en: 'Delete' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh sách thông báo', en: 'Failed to load notifications' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có thông báo nào', en: 'No notifications yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			pageInfo: { vi: 'Trang {page}/{total}', en: 'Page {page}/{total}' },
			totalCount: { vi: '{total} thông báo', en: '{total} notifications' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		createModal: {
			title: { vi: 'Tạo thông báo', en: 'Create notification' },
			titleField: { vi: 'Tiêu đề', en: 'Title' },
			bodyField: { vi: 'Nội dung', en: 'Body' },
			typeField: { vi: 'Loại', en: 'Type' },
			userIdField: { vi: 'User ID (bỏ trống = broadcast)', en: 'User ID (empty = broadcast)' },
			linkField: { vi: 'Link (tuỳ chọn)', en: 'Link (optional)' },
			submit: { vi: 'Tạo', en: 'Create' }
		},
		deleteModal: {
			title: { vi: 'Xoá thông báo', en: 'Delete notification' },
			body: { vi: 'Xoá thông báo này? Hành động không thể hoàn tác.', en: 'Delete this notification? This cannot be undone.' },
			submit: { vi: 'Xoá', en: 'Delete' }
		},
		toasts: {
			created: { vi: 'Đã tạo thông báo', en: 'Notification created' },
			markedRead: { vi: 'Đã đánh dấu đã đọc', en: 'Marked as read' },
			markedAll: { vi: 'Đã đánh dấu tất cả đã đọc', en: 'Marked all as read' },
			deleted: { vi: 'Đã xoá thông báo', en: 'Notification deleted' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireTitle: { vi: 'Vui lòng nhập tiêu đề', en: 'Please enter a title' },
			requireBody: { vi: 'Vui lòng nhập nội dung', en: 'Please enter a body' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error', 'order', 'stock', 'system'] as const;

	function typeLabel(type?: string): string {
		const key = (type ?? '') as keyof typeof pageContents.types;
		const label = pageContents.types[key];
		return label ? label[lang] : (type ?? '—');
	}

	function typeColor(type?: string): string {
		switch (type) {
			case 'success':
			case 'order':
				return 'success';
			case 'warning':
			case 'stock':
				return 'warning';
			case 'error':
				return 'error';
			default:
				return 'default';
		}
	}

	// ── Danh sách ──
	let notifications = $state<NotificationRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let typeFilter = $state('');
	let readFilter = $state('');

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

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

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
	async function loadNotifications() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/notifications/list',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						type: typeFilter || undefined,
						isRead: readFilter === '' ? undefined : readFilter === 'read'
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: NotificationRow[]; total?: number; page?: number }
					| undefined;
				notifications = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/notifications] load failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadNotifications();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadNotifications();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadNotifications();
	}

	// ── Đánh dấu đã đọc ──
	let mutating = $state(false);

	async function markRead(row: NotificationRow) {
		if (mutating || !row._id || !encryptionKeys) return;
		mutating = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/notifications/mark-read',
				{ method: 'POST', body: { notificationId: row._id } },
				encryptionKeys
			);
			mutating = false;
			if (response.ok) {
				showToast(pageContents.toasts.markedRead[lang], 'success');
				await loadNotifications();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			mutating = false;
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/notifications] mark-read failed:', err);
		}
	}

	async function markAllRead() {
		if (mutating || !encryptionKeys) return;
		mutating = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/notifications/mark-all-read',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			mutating = false;
			if (response.ok) {
				showToast(pageContents.toasts.markedAll[lang], 'success');
				await loadNotifications();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			mutating = false;
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/notifications] mark-all-read failed:', err);
		}
	}

	// ── Xoá ──
	let deleteModalDisplay = $state(false);
	let deleteTarget = $state<NotificationRow | null>(null);
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	function openDeleteModal(row: NotificationRow) {
		deleteTarget = row;
		formError = undefined;
		deleteModalDisplay = true;
	}

	async function submitDelete() {
		if (submitting || !deleteTarget?._id || !encryptionKeys) return;
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/notifications/delete',
				{ method: 'POST', body: { notificationId: deleteTarget._id } },
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(pageContents.toasts.deleted[lang], 'success');
				deleteModalDisplay = false;
				await loadNotifications();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/notifications] delete failed:', err);
		}
	}

	// ── Modal tạo broadcast ──
	let createModalDisplay = $state(false);
	let createTitle = $state('');
	let createBody = $state('');
	let createType = $state('info');
	let createUserId = $state('');
	let createLink = $state('');

	function openCreateModal() {
		createTitle = '';
		createBody = '';
		createType = 'info';
		createUserId = '';
		createLink = '';
		formError = undefined;
		createModalDisplay = true;
	}

	async function submitCreate() {
		if (submitting || !encryptionKeys) return;
		if (!createTitle.trim()) {
			formError = pageContents.form.requireTitle[lang];
			return;
		}
		if (!createBody.trim()) {
			formError = pageContents.form.requireBody[lang];
			return;
		}
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/notifications/create',
				{
					method: 'POST',
					body: {
						title: createTitle.trim(),
						body: createBody.trim(),
						type: createType,
						userId: createUserId.trim() || null,
						link: createLink.trim() || undefined
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(pageContents.toasts.created[lang], 'success');
				createModalDisplay = false;
				await loadNotifications();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/notifications] create failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadNotifications();
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
			<!-- mark-all = secondary (outline) -->
			<Button color="default" variant="outline" onClick={markAllRead} disabled={mutating}>
				{pageContents.markAllBtn[lang]}
			</Button>
			<!-- create = success -->
			<Button color="success" onClick={openCreateModal}>
				{pageContents.createBtn[lang]}
			</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={typeFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allTypes[lang]}</option>
			{#each NOTIFICATION_TYPES as type (type)}
				<option value={type}>{typeLabel(type)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={readFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allReadStates[lang]}</option>
			<option value="unread">{pageContents.filters.unreadOnly[lang]}</option>
			<option value="read">{pageContents.filters.readOnly[lang]}</option>
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadNotifications}>
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
			<Button color="primary" variant="outline" onClick={loadNotifications}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if notifications.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.title[lang]}</th>
						<th scope="col">{pageContents.table.body[lang]}</th>
						<th scope="col">{pageContents.table.type[lang]}</th>
						<th scope="col">{pageContents.table.recipient[lang]}</th>
						<th scope="col">{pageContents.table.createdAt[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each notifications as row (row._id)}
						<tr class:row-unread={!row.isRead}>
							<td class="col-title">
								{row.title ?? '—'}
								{#if row.link}
									<a class="row-link" href={row.link}>{row.link}</a>
								{/if}
							</td>
							<td class="col-wrap">{row.body ?? '—'}</td>
							<td class="col-status">
								<span class="status-badge status-{typeColor(row.type)}">{typeLabel(row.type)}</span>
							</td>
							<td class="col-recipient">{row.broadcast ? pageContents.broadcastLabel[lang] : (row.userId ?? '—')}</td>
							<td>{formatDateTime(row.createdAt)}</td>
							<td class="col-status">
								<span class="status-badge status-{row.isRead ? 'default' : 'warning'}">
									{row.isRead ? pageContents.statuses.read[lang] : pageContents.statuses.unread[lang]}
								</span>
							</td>
							<td class="col-actions">
								{#if !row.isRead}
									<!-- mark-read = primary -->
									<Button color="primary" size="sm" onClick={() => markRead(row)}>
										{pageContents.actions.markRead[lang]}
									</Button>
								{/if}
								<!-- delete = error -->
								<Button color="error" variant="outline" size="sm" onClick={() => openDeleteModal(row)}>
									{pageContents.actions.delete[lang]}
								</Button>
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
			<span class="page-info">
				{pageContents.pagination.pageInfo[lang]
					.replace('{page}', String(pageNo))
					.replace('{total}', String(totalPages))}
			</span>
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

<!-- ── Modal tạo thông báo ── -->
{#if createModalDisplay}
	<Modal bind:display={createModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.createModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.titleField[lang]}</span>
						<input class="admin-input" type="text" bind:value={createTitle} disabled={submitting} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.bodyField[lang]}</span>
						<textarea class="admin-textarea" rows="4" bind:value={createBody} disabled={submitting}></textarea>
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.typeField[lang]}</span>
						<select class="admin-select" bind:value={createType} disabled={submitting}>
							{#each NOTIFICATION_TYPES as type (type)}
								<option value={type}>{typeLabel(type)}</option>
							{/each}
						</select>
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.userIdField[lang]}</span>
						<input class="admin-input" type="text" bind:value={createUserId} disabled={submitting} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.linkField[lang]}</span>
						<input class="admin-input" type="text" bind:value={createLink} disabled={submitting} />
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create = success -->
				<Button color="success" onClick={submitCreate} loading={submitting} disabled={submitting}>
					{pageContents.createModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						createModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
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
				<Button color="error" onClick={submitDelete} loading={submitting} disabled={submitting}>
					{pageContents.deleteModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
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

	.admin-header-actions {
		display: flex;
		gap: 0.5rem;
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

	.row-unread {
		font-weight: 600;
	}

	.col-title {
		font-weight: 600;
		color: var(--foreground);
		min-width: 10rem;
	}

	.row-link {
		display: block;
		font-size: 0.75rem;
		font-weight: 400;
		color: var(--primary);
		word-break: break-all;
	}

	.col-recipient {
		max-width: 12rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.col-wrap {
		white-space: normal;
		min-width: 12rem;
		max-width: 22rem;
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

	.page-info {
		font-size: 0.85rem;
		color: var(--foreground);
		min-width: 6rem;
		text-align: center;
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
