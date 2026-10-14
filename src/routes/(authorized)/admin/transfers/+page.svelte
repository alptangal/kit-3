<!-- src/routes/(authorized)/admin/transfers/+page.svelte
	Quản trị chuyển kho giữa các chi nhánh (stock_transfers).
	Pattern theo trang payments (fetchSecure POST encrypted, pageContents vi/en).
	Luồng: tạo (pending) → chi nhánh NHẬN duyệt (in_transit, trừ kho gửi)
	→ nhận hàng xong (completed, cộng kho nhận) → huỷ (in_transit huỷ hoàn kho gốc). -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface TransferRow {
		_id?: string;
		transferCode?: string;
		fromBranchId?: string;
		toBranchId?: string;
		status?: string;
		items?: Array<{ productId: string; quantity: number; lotId?: string }>;
		requestedBy?: string;
		approvedBy?: string | null;
		createdAt?: string | null;
		completedAt?: string | null;
		notes?: string | null;
	}

	interface BranchOption {
		_id: string;
		name?: string;
		address?: string;
	}

	interface VariantOption {
		_id: string;
		sku?: string;
		displayName?: string;
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
		title: { vi: 'Chuyển kho', en: 'Stock transfers' },
		subtitle: {
			vi: 'Tạo yêu cầu chuyển kho giữa các chi nhánh; chi nhánh nhận duyệt và hoàn tất nhận hàng',
			en: 'Create stock transfer requests between branches; receiving branch approves and completes'
		},
		createButton: { vi: 'Tạo phiếu chuyển kho', en: 'New transfer' },
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' }
		},
		table: {
			transferCode: { vi: 'Mã phiếu', en: 'Transfer code' },
			route: { vi: 'Tuyến chuyển', en: 'Route' },
			items: { vi: 'Sản phẩm', en: 'Items' },
			createdAt: { vi: 'Ngày tạo', en: 'Created' },
			status: { vi: 'Trạng thái', en: 'Status' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		statuses: {
			pending: { vi: 'Chờ duyệt', en: 'Pending approval' },
			in_transit: { vi: 'Đang chuyển', en: 'In transit' },
			completed: { vi: 'Hoàn tất', en: 'Completed' },
			cancelled: { vi: 'Đã huỷ', en: 'Cancelled' }
		},
		actions: {
			approve: { vi: 'Duyệt', en: 'Approve' },
			complete: { vi: 'Nhận hàng', en: 'Receive' },
			cancel: { vi: 'Huỷ', en: 'Cancel' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh sách phiếu chuyển kho', en: 'Failed to load transfers' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có phiếu chuyển kho nào', en: 'No transfers yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			pageInfo: { vi: 'Trang {page}/{total}', en: 'Page {page}/{total}' },
			totalCount: { vi: '{total} phiếu chuyển kho', en: '{total} transfers' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		createModal: {
			title: { vi: 'Tạo phiếu chuyển kho', en: 'Create stock transfer' },
			fromBranch: { vi: 'Chi nhánh gửi', en: 'Source branch' },
			toBranch: { vi: 'Chi nhánh nhận', en: 'Destination branch' },
			variant: { vi: 'Biến thể sản phẩm', en: 'Product variant' },
			quantity: { vi: 'Số lượng', en: 'Quantity' },
			notes: { vi: 'Ghi chú (tuỳ chọn)', en: 'Notes (optional)' },
			addItem: { vi: 'Thêm dòng', en: 'Add item row' },
			removeItem: { vi: 'Bỏ dòng', en: 'Remove row' },
			submit: { vi: 'Tạo phiếu', en: 'Create transfer' },
			requireFields: {
				vi: 'Chọn chi nhánh gửi/nhận khác nhau, biến thể và số lượng hợp lệ',
				en: 'Pick different source/destination branches, a variant and a valid quantity'
			},
			requireItem: { vi: 'Chọn biến thể và số lượng > 0', en: 'Pick a variant and quantity > 0' }
		},
		confirmModal: {
			approveTitle: { vi: 'Duyệt phiếu chuyển kho', en: 'Approve transfer' },
			approveBody: {
				vi: 'Duyệt phiếu sẽ trừ tồn kho chi nhánh gửi và đưa hàng vào trạng thái "Đang chuyển".',
				en: 'Approving will deduct stock at the source branch and move goods to "In transit".'
			},
			completeTitle: { vi: 'Xác nhận nhận hàng', en: 'Confirm receipt' },
			completeBody: {
				vi: 'Xác nhận đã nhận đủ hàng? Tồn kho chi nhánh nhận sẽ được cộng.',
				en: 'Confirm all goods received? Destination branch stock will be increased.'
			},
			cancelTitle: { vi: 'Huỷ phiếu chuyển kho', en: 'Cancel transfer' },
			cancelBody: {
				vi: 'Huỷ phiếu đang chuyển sẽ hoàn lại tồn kho cho chi nhánh gửi.',
				en: 'Cancelling an in-transit transfer will restore stock to the source branch.'
			},
			submitApprove: { vi: 'Duyệt', en: 'Approve' },
			submitComplete: { vi: 'Xác nhận', en: 'Confirm' },
			submitCancel: { vi: 'Huỷ phiếu', en: 'Cancel transfer' }
		},
		toasts: {
			created: { vi: 'Đã tạo phiếu chuyển kho', en: 'Transfer created' },
			approved: { vi: 'Đã duyệt phiếu — hàng đang chuyển', en: 'Approved — goods in transit' },
			completed: { vi: 'Đã hoàn tất chuyển kho', en: 'Transfer completed' },
			cancelled: { vi: 'Đã huỷ phiếu chuyển kho', en: 'Transfer cancelled' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const TRANSFER_STATUSES = ['pending', 'in_transit', 'completed', 'cancelled'] as const;

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): string {
		switch (status) {
			case 'completed':
				return 'success';
			case 'pending':
				return 'warning';
			case 'in_transit':
				return 'default';
			case 'cancelled':
				return 'error';
			default:
				return 'default';
		}
	}

	// ── Branch/variant options ──
	let branches = $state<BranchOption[]>([]);
	let variantOptions = $state<VariantOption[]>([]);

	function branchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const b = branches.find((x) => x._id === branchId);
		return b?.name ?? branchId;
	}

	function variantLabel(variantId?: string): string {
		if (!variantId) return '—';
		const v = variantOptions.find((x) => x._id === variantId);
		return v ? `${v.sku ? v.sku + ' — ' : ''}${v.displayName ?? ''}` : variantId;
	}

	function itemsSummary(row: TransferRow): string {
		if (!row.items?.length) return '—';
		return row.items.map((i) => `${variantLabel(i.productId)} ×${i.quantity}`).join(', ');
	}

	// ── Danh sách ──
	let transfers = $state<TransferRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let statusFilter = $state('');

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
	async function loadTransfers() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/transfers/list',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						status: statusFilter || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: TransferRow[]; total?: number; page?: number }
					| undefined;
				transfers = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/transfers] load failed:', err);
		}
	}

	// ── Load branches + variants cho modal tạo ──
	async function loadBranches() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/branches',
				{ method: 'POST', body: {} },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { branches?: BranchOption[] } | undefined;
				branches = data?.branches ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/transfers] loadBranches failed:', err);
		}
	}

	async function loadVariantOptions() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/list',
				{ method: 'POST', body: { page: 1, pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: VariantOption[] } | undefined;
				variantOptions = data?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/transfers] loadVariantOptions failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadTransfers();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadTransfers();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadTransfers();
	}

	// ── Modal tạo phiếu ──
	interface DraftItem {
		productId: string;
		quantity: number;
	}
	let createModalDisplay = $state(false);
	let draftFromBranch = $state('');
	let draftToBranch = $state('');
	let draftItems = $state<DraftItem[]>([{ productId: '', quantity: 1 }]);
	let draftNotes = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	function openCreateModal() {
		draftFromBranch = '';
		draftToBranch = '';
		draftItems = [{ productId: '', quantity: 1 }];
		draftNotes = '';
		formError = undefined;
		createModalDisplay = true;
	}

	function addDraftItem() {
		draftItems = [...draftItems, { productId: '', quantity: 1 }];
	}

	function removeDraftItem(index: number) {
		draftItems = draftItems.filter((_, i) => i !== index);
	}

	async function submitCreate() {
		if (submitting || !encryptionKeys) return;
		if (!draftFromBranch || !draftToBranch || draftFromBranch === draftToBranch) {
			formError = pageContents.createModal.requireFields[lang];
			return;
		}
		const validItems = draftItems
			.filter((i) => i.productId && Number(i.quantity) > 0)
			.map((i) => ({ productId: i.productId, quantity: Math.floor(Number(i.quantity)) }));
		if (validItems.length === 0) {
			formError = pageContents.createModal.requireItem[lang];
			return;
		}
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/transfers/create',
				{
					method: 'POST',
					body: {
						fromBranchId: draftFromBranch,
						toBranchId: draftToBranch,
						items: validItems,
						notes: draftNotes.trim() || undefined
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.created)
						: pageContents.toasts.created[lang],
					'success'
				);
				createModalDisplay = false;
				await loadTransfers();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/transfers] create failed:', err);
		}
	}

	// ── Modal confirm hành động trạng thái ──
	type ConfirmKind = 'approve' | 'complete' | 'cancel';
	let confirmModalDisplay = $state(false);
	let confirmKind = $state<ConfirmKind>('approve');
	let confirmTarget = $state<TransferRow | null>(null);

	function openConfirmModal(kind: ConfirmKind, row: TransferRow) {
		confirmKind = kind;
		confirmTarget = row;
		formError = undefined;
		confirmModalDisplay = true;
	}

	function confirmTitle(): string {
		if (confirmKind === 'approve') return pageContents.confirmModal.approveTitle[lang];
		if (confirmKind === 'complete') return pageContents.confirmModal.completeTitle[lang];
		return pageContents.confirmModal.cancelTitle[lang];
	}

	function confirmBody(): string {
		if (confirmKind === 'approve') return pageContents.confirmModal.approveBody[lang];
		if (confirmKind === 'complete') return pageContents.confirmModal.completeBody[lang];
		return pageContents.confirmModal.cancelBody[lang];
	}

	async function submitConfirm() {
		if (submitting || !confirmTarget?._id || !encryptionKeys) return;
		const endpoint =
			confirmKind === 'approve'
				? '/api/admin/transfers/approve'
				: confirmKind === 'complete'
					? '/api/admin/transfers/complete'
					: '/api/admin/transfers/cancel';
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				endpoint,
				{ method: 'POST', body: { transferId: confirmTarget._id } },
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				const toastKey =
					confirmKind === 'approve'
						? pageContents.toasts.approved
						: confirmKind === 'complete'
							? pageContents.toasts.completed
							: pageContents.toasts.cancelled;
				showToast(
					response.message ? resolveServerMessage(response.message, lang, toastKey) : toastKey[lang],
					'success'
				);
				confirmModalDisplay = false;
				await loadTransfers();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/transfers] status action failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadTransfers(), loadBranches(), loadVariantOptions()]);
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
			<Button color="success" onClick={openCreateModal} data-test="admin-transfers-create">
				{pageContents.createButton[lang]}
			</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange} data-test="admin-transfers-status-filter">
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each TRANSFER_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadTransfers}>
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
			<Button color="primary" variant="outline" onClick={loadTransfers}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if transfers.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap" data-test="admin-transfers-table">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.transferCode[lang]}</th>
						<th scope="col">{pageContents.table.route[lang]}</th>
						<th scope="col">{pageContents.table.items[lang]}</th>
						<th scope="col">{pageContents.table.createdAt[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each transfers as row (row._id)}
						<tr data-test="admin-transfers-row">
							<td class="col-code">{row.transferCode ?? '—'}</td>
							<td>
								{branchLabel(row.fromBranchId)}
								<span class="route-arrow">→</span>
								{branchLabel(row.toBranchId)}
							</td>
							<td class="col-wrap">{itemsSummary(row)}</td>
							<td>{formatDateTime(row.createdAt)}</td>
							<td class="col-status">
								<span class="status-badge status-{statusColor(row.status)}" data-transfer-status={row.status}>{statusLabel(row.status)}</span>
							</td>
							<td class="col-actions">
								<div class="row-actions">
									{#if row.status === 'pending'}
										<!-- Quy ước màu nút: approve = primary -->
										<Button color="primary" size="sm" onClick={() => openConfirmModal('approve', row)}>
											{pageContents.actions.approve[lang]}
										</Button>
									{/if}
									{#if row.status === 'in_transit'}
										<!-- Quy ước màu nút: complete = success -->
										<Button color="success" size="sm" onClick={() => openConfirmModal('complete', row)}>
											{pageContents.actions.complete[lang]}
										</Button>
									{/if}
									{#if row.status === 'pending' || row.status === 'in_transit'}
										<!-- Quy ước màu nút: cancel = error -->
										<Button color="error" variant="outline" size="sm" onClick={() => openConfirmModal('cancel', row)}>
											{pageContents.actions.cancel[lang]}
										</Button>
									{/if}
									{#if row.status === 'completed' || row.status === 'cancelled'}
										<span class="actions-none">—</span>
									{/if}
								</div>
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

<!-- ── Modal tạo phiếu ── -->
{#if createModalDisplay}
	<Modal bind:display={createModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.createModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.fromBranch[lang]}</span>
							<select class="admin-select modal-select" bind:value={draftFromBranch} data-test="admin-transfers-from-branch">
								<option value="">—</option>
								{#each branches as b (b._id)}
									<option value={b._id}>{b.name ?? b._id}</option>
								{/each}
							</select>
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.toBranch[lang]}</span>
							<select class="admin-select modal-select" bind:value={draftToBranch} data-test="admin-transfers-to-branch">
								<option value="">—</option>
								{#each branches as b (b._id)}
									<option value={b._id}>{b.name ?? b._id}</option>
								{/each}
							</select>
						</label>
					</div>
					{#each draftItems as item, idx}
						<div class="form-grid-2 item-row">
							<label class="form-field">
								<span class="form-label">{pageContents.createModal.variant[lang]}</span>
								<select class="admin-select modal-select" bind:value={item.productId} data-test="admin-transfers-variant">
									<option value="">—</option>
									{#each variantOptions as v (v._id)}
										<option value={v._id}>{variantLabel(v._id)}</option>
									{/each}
								</select>
							</label>
							<label class="form-field item-qty">
								<span class="form-label">{pageContents.createModal.quantity[lang]}</span>
								<input class="admin-input" type="number" min="1" step="1" bind:value={item.quantity} />
								{#if draftItems.length > 1}
									<Button
										color="error"
										variant="ghost"
										size="sm"
										onClick={() => removeDraftItem(idx)}
									>
										{pageContents.createModal.removeItem[lang]}
									</Button>
								{/if}
							</label>
						</div>
					{/each}
					<Button color="default" variant="outline" size="sm" onClick={addDraftItem}>
						{pageContents.createModal.addItem[lang]}
					</Button>
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.notes[lang]}</span>
						<textarea class="admin-textarea" rows="2" bind:value={draftNotes} disabled={submitting}></textarea>
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create = success -->
				<Button color="success" onClick={submitCreate} loading={submitting} disabled={submitting} data-test="admin-transfers-submit">
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

<!-- ── Modal confirm trạng thái ── -->
{#if confirmModalDisplay}
	<Modal bind:display={confirmModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{confirmTitle()}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<p class="modal-body-text">{confirmBody()}</p>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				{#if confirmKind === 'approve'}
					<!-- approve = primary -->
					<Button color="primary" onClick={submitConfirm} loading={submitting} disabled={submitting}>
						{pageContents.confirmModal.submitApprove[lang]}
					</Button>
				{:else if confirmKind === 'complete'}
					<!-- complete = success -->
					<Button color="success" onClick={submitConfirm} loading={submitting} disabled={submitting}>
						{pageContents.confirmModal.submitComplete[lang]}
					</Button>
				{:else}
					<!-- cancel = error -->
					<Button color="error" onClick={submitConfirm} loading={submitting} disabled={submitting}>
						{pageContents.confirmModal.submitCancel[lang]}
					</Button>
				{/if}
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

	.col-code {
		font-weight: 600;
		color: var(--foreground);
	}

	.col-wrap {
		white-space: normal;
		min-width: 8rem;
		max-width: 22rem;
	}

	.col-status {
		white-space: nowrap;
	}

	.col-actions {
		white-space: nowrap;
	}

	.row-actions {
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
	}

	.actions-none {
		color: var(--foreground-500);
	}

	.route-arrow {
		color: var(--foreground-500);
		padding: 0 0.35rem;
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

	.form-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;

		@media (max-width: 720px) {
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

	.modal-select {
		width: 100%;
		height: 2.5rem;
	}

	.item-qty input {
		max-width: 8rem;
	}
</style>
