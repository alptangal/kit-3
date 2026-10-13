<!-- src/routes/(authorized)/admin/post-categories/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { AlertDialog } from '$lib/components/element/alert-dialog';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface CategoryRow {
		_id?: string;
		categoryId?: string;
		name?: string;
		slug?: string;
		description?: string;
		sortOrder?: number;
		status?: string;
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
		title: { vi: 'Danh mục bài viết', en: 'Post categories' },
		subtitle: {
			vi: 'Quản lý nhóm bài viết: sắp xếp thứ tự, bật/tắt hiển thị',
			en: 'Manage post groups: ordering, enable/disable'
		},
		table: {
			name: { vi: 'Tên', en: 'Name' },
			slug: { vi: 'Đường dẫn', en: 'Slug' },
			description: { vi: 'Mô tả', en: 'Description' },
			sortOrder: { vi: 'Thứ tự', en: 'Order' },
			status: { vi: 'Trạng thái', en: 'Status' }
		},
		statuses: {
			active: { vi: 'Đang hoạt động', en: 'Active' },
			inactive: { vi: 'Tạm tắt', en: 'Inactive' }
		},
		actions: {
			create: { vi: 'Tạo danh mục', en: 'Create category' },
			edit: { vi: 'Sửa', en: 'Edit' },
			"delete": { vi: 'Xoá', en: 'Delete' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh mục', en: 'Failed to load categories' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có danh mục nào', en: 'No categories yet' }
		},
		editModal: {
			createTitle: { vi: 'Tạo danh mục', en: 'Create category' },
			editTitle: { vi: 'Sửa danh mục', en: 'Edit category' },
			name: { vi: 'Tên', en: 'Name' },
			slug: { vi: 'Đường dẫn (slug)', en: 'Slug' },
			slugHint: { vi: 'Để trống sẽ tự sinh từ tên', en: 'Leave empty to auto-generate from name' },
			description: { vi: 'Mô tả', en: 'Description' },
			sortOrder: { vi: 'Thứ tự sắp xếp', en: 'Sort order' },
			status: { vi: 'Trạng thái', en: 'Status' },
			submitCreate: { vi: 'Tạo', en: 'Create' },
			submitSave: { vi: 'Lưu', en: 'Save' }
		},
		deleteDialog: {
			title: { vi: 'Xoá danh mục?', en: 'Delete category?' },
			description: {
				vi: 'Chỉ xoá được khi không còn bài viết nào dùng danh mục này.',
				en: 'Can only be deleted when no posts use this category.'
			},
			confirm: { vi: 'Xoá', en: 'Delete' },
			cancel: { vi: 'Huỷ', en: 'Cancel' }
		},
		toasts: {
			created: { vi: 'Đã tạo danh mục', en: 'Category created' },
			updated: { vi: 'Đã cập nhật danh mục', en: 'Category updated' },
			deleted: { vi: 'Đã xoá danh mục', en: 'Category deleted' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireName: { vi: 'Vui lòng nhập tên', en: 'Please enter a name' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const CATEGORY_STATUSES = ['active', 'inactive'] as const;

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): string {
		return status === 'active' ? 'success' : 'default';
	}

	// ── Danh sách ──
	let categories = $state<CategoryRow[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	async function loadCategories() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/posts/categories/list',
				{ method: 'POST', body: { pageSize: 100 } },
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as { items?: CategoryRow[]; total?: number } | undefined;
				categories = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/post-categories] load failed:', err);
		}
	}

	// ── Modal tạo/sửa ──
	let editModalDisplay = $state(false);
	let editingCategoryId = $state<string | undefined>(undefined);
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);
	let form = $state({
		name: '',
		slug: '',
		description: '',
		sortOrder: 0,
		status: 'active'
	});

	function openCreateModal() {
		editingCategoryId = undefined;
		form = { name: '', slug: '', description: '', sortOrder: 0, status: 'active' };
		formError = undefined;
		editModalDisplay = true;
	}

	function openEditModal(row: CategoryRow) {
		editingCategoryId = row.categoryId;
		form = {
			name: row.name ?? '',
			slug: row.slug ?? '',
			description: row.description ?? '',
			sortOrder: row.sortOrder ?? 0,
			status: row.status ?? 'active'
		};
		formError = undefined;
		editModalDisplay = true;
	}

	function validateForm(): string | undefined {
		if (!form.name.trim()) return pageContents.form.requireName[lang];
		return undefined;
	}

	async function submitCategory() {
		if (submitting || !encryptionKeys) return;
		const validationError = validateForm();
		if (validationError) {
			formError = validationError;
			return;
		}
		formError = undefined;
		submitting = true;
		try {
			const isEdit = Boolean(editingCategoryId);
			const response = await encryption.fetchSecure(
				isEdit ? '/api/admin/posts/categories/update' : '/api/admin/posts/categories/create',
				{
					method: 'POST',
					body: isEdit
						? {
								categoryId: editingCategoryId,
								name: form.name.trim(),
								slug: form.slug.trim() || undefined,
								description: form.description,
								sortOrder: Number(form.sortOrder) || 0,
								status: form.status
							}
						: {
								name: form.name.trim(),
								slug: form.slug.trim() || undefined,
								description: form.description,
								sortOrder: Number(form.sortOrder) || 0,
								status: form.status
							}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					resolveServerMessage(response.message, lang, isEdit ? pageContents.toasts.updated : pageContents.toasts.created),
					'success'
				);
				editModalDisplay = false;
				await loadCategories();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/post-categories] submit failed:', err);
		}
	}

	// ── Xoá ──
	let deleteDialogOpen = $state(false);
	let deletingCategory = $state<CategoryRow | undefined>(undefined);
	let deleteBusy = $state(false);

	function askDeleteCategory(row: CategoryRow) {
		deletingCategory = row;
		deleteDialogOpen = true;
	}

	async function confirmDeleteCategory() {
		const row = deletingCategory;
		if (!row?.categoryId || !encryptionKeys || deleteBusy) return;
		deleteBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/posts/categories/delete',
				{ method: 'POST', body: { categoryId: row.categoryId } },
				encryptionKeys
			);
			deleteBusy = false;
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.deleted), 'success');
				deleteDialogOpen = false;
				deletingCategory = undefined;
				await loadCategories();
			} else {
				// Còn post dùng → server trả message inUse
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			deleteBusy = false;
			if (import.meta.env.DEV) console.error('[admin/post-categories] delete failed:', err);
			showToast(pageContents.toasts.requestFailed[lang], 'error');
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadCategories();
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
			<Button color="success" onClick={openCreateModal}>{pageContents.actions.create[lang]}</Button>
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
			<Button color="primary" variant="outline" onClick={loadCategories}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if categories.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.name[lang]}</th>
						<th scope="col">{pageContents.table.slug[lang]}</th>
						<th scope="col">{pageContents.table.description[lang]}</th>
						<th scope="col">{pageContents.table.sortOrder[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col" class="col-actions"><span class="visually-hidden">actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each categories as row (row._id ?? row.categoryId)}
						<tr>
							<td class="col-name">{row.name ?? '—'}</td>
							<td class="col-slug">/{row.slug ?? ''}</td>
							<td class="col-desc">{row.description || '—'}</td>
							<td class="col-num">{row.sortOrder ?? 0}</td>
							<td class="col-status">
								<span class="status-badge status-{statusColor(row.status)}">{statusLabel(row.status)}</span>
							</td>
							<td class="col-actions">
								<div class="row-actions">
									<!-- Quy ước: edit = primary -->
									<Button color="primary" variant="ghost" size="sm" onClick={() => openEditModal(row)}>
										{pageContents.actions.edit[lang]}
									</Button>
									<!-- delete = error -->
									<Button color="error" variant="ghost" size="sm" onClick={() => askDeleteCategory(row)}>
										{pageContents.actions.delete[lang]}
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<footer class="admin-pagination">
		<span class="total-count">{total}</span>
	</footer>
</section>

<!-- ── Modal tạo/sửa danh mục ── -->
{#if editModalDisplay}
	<Modal bind:display={editModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				{editingCategoryId ? pageContents.editModal.editTitle[lang] : pageContents.editModal.createTitle[lang]}
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.name[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.name} disabled={submitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.slug[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.slug} disabled={submitting} />
							<span class="form-hint">{pageContents.editModal.slugHint[lang]}</span>
						</label>
					</div>
					<label class="form-field">
						<span class="form-label">{pageContents.editModal.description[lang]}</span>
						<textarea class="admin-input admin-textarea" rows="2" bind:value={form.description} disabled={submitting}></textarea>
					</label>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.sortOrder[lang]}</span>
							<input class="admin-input" type="number" step="1" bind:value={form.sortOrder} disabled={submitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.editModal.status[lang]}</span>
							<select class="admin-select" bind:value={form.status} disabled={submitting}>
								{#each CATEGORY_STATUSES as status (status)}
									<option value={status}>{statusLabel(status)}</option>
								{/each}
							</select>
						</label>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitCategory} loading={submitting} disabled={submitting}>
					{editingCategoryId ? pageContents.editModal.submitSave[lang] : pageContents.editModal.submitCreate[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						editModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog xoá danh mục ── -->
<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{pageContents.deleteDialog.title[lang]}</AlertDialog.Title>
			<AlertDialog.Description>{pageContents.deleteDialog.description[lang]}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{pageContents.deleteDialog.cancel[lang]}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={confirmDeleteCategory}>
				{pageContents.deleteDialog.confirm[lang]}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

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

	.col-name {
		font-weight: 600;
		color: var(--foreground);
	}

	.col-slug {
		color: var(--foreground-500);
		font-size: 0.8rem;
	}

	.col-desc {
		white-space: normal;
		min-width: 12rem;
		color: var(--foreground-500);
	}

	.col-num {
		font-variant-numeric: tabular-nums;
	}

	.col-status {
		white-space: nowrap;
	}

	.col-actions {
		text-align: right;

		.visually-hidden {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip: rect(0 0 0 0);
			white-space: nowrap;
		}
	}

	.row-actions {
		display: inline-flex;
		gap: 0.25rem;
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

		&.status-default {
			background: var(--default-200);
			color: var(--foreground-600);
		}
	}

	.admin-pagination {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 1rem;
	}

	.total-count {
		font-size: 0.85rem;
		color: var(--foreground-500);
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

	.form-grid-2 {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: 1fr 1fr;

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

	.form-hint {
		font-size: 0.75rem;
		color: var(--foreground-500);
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
		height: auto;
		min-height: 2.5rem;
		padding: 0.5rem 0.75rem;
		resize: vertical;
		font-family: inherit;
		line-height: 1.5;
	}
</style>
