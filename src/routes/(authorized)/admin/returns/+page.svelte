<!-- src/routes/(authorized)/admin/returns/+page.svelte
	Quản trị đổi trả hàng (order_returns).
	Pattern theo trang payments (fetchSecure POST encrypted, pageContents vi/en).
	Luồng: tạo từ đơn (requested, check 7 ngày) → manager duyệt (approved)
	→ hoàn tất (completed: hoàn tồn kho chi nhánh xử lý + hoàn tiền ghi chú)
	→ từ chối (rejected).
	Đổi trả khác chi nhánh: originBranchId (bán gốc) vs returnBranchId (xử lý). -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface ReturnRow {
		_id?: string;
		returnCode?: string;
		orderId?: string;
		originBranchId?: string | null;
		returnBranchId?: string | null;
		customerId?: string | null;
		items?: Array<{ variantId: string; quantity: number; refundUnitPrice: number; reason?: string; lotId?: string }>;
		totalRefundAmount?: number;
		refundNote?: string | null;
		status?: string;
		handledBy?: string | null;
		createdAt?: string | null;
		updatedAt?: string | null;
	}

	interface BranchOption {
		_id: string;
		name?: string;
		address?: string;
	}

	interface OrderRow {
		_id?: string;
		orderCode?: string;
		status?: string;
		totalAmount?: number;
		createdAt?: string;
		items?: Array<{ variantId: string; quantity: number; price: number }>;
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
		title: { vi: 'Đổi trả', en: 'Returns' },
		subtitle: {
			vi: 'Tạo phiếu đổi trả từ đơn hàng trong 7 ngày; duyệt, từ chối và hoàn tất (hoàn tồn kho chi nhánh xử lý)',
			en: 'Create returns from orders within 7 days; approve, reject and complete (restock at handling branch)'
		},
		createButton: { vi: 'Tạo phiếu đổi trả', en: 'New return' },
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' }
		},
		table: {
			returnCode: { vi: 'Mã phiếu', en: 'Return code' },
			orderId: { vi: 'Đơn hàng', en: 'Order' },
			branch: { vi: 'Chi nhánh xử lý', en: 'Handling branch' },
			items: { vi: 'Sản phẩm', en: 'Items' },
			refund: { vi: 'Tổng hoàn', en: 'Refund total' },
			createdAt: { vi: 'Ngày tạo', en: 'Created' },
			status: { vi: 'Trạng thái', en: 'Status' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		statuses: {
			requested: { vi: 'Chờ duyệt', en: 'Requested' },
			approved: { vi: 'Đã duyệt', en: 'Approved' },
			completed: { vi: 'Hoàn tất', en: 'Completed' },
			rejected: { vi: 'Từ chối', en: 'Rejected' }
		},
		actions: {
			approve: { vi: 'Duyệt', en: 'Approve' },
			reject: { vi: 'Từ chối', en: 'Reject' },
			complete: { vi: 'Hoàn tất', en: 'Complete' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh sách phiếu đổi trả', en: 'Failed to load returns' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có phiếu đổi trả nào', en: 'No returns yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCount: { vi: '{total} phiếu đổi trả', en: '{total} returns' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		createModal: {
			title: { vi: 'Tạo phiếu đổi trả', en: 'Create return' },
			orderId: { vi: 'Đơn hàng', en: 'Order' },
			loadOrder: { vi: 'Tải đơn', en: 'Load order' },
			returnBranch: { vi: 'Chi nhánh xử lý (mặc định: nơi bán)', en: 'Handling branch (default: selling branch)' },
			variant: { vi: 'Sản phẩm trong đơn', en: 'Item in order' },
			quantity: { vi: 'Số lượng trả', en: 'Quantity to return' },
			reason: { vi: 'Lý do', en: 'Reason' },
			refundNote: { vi: 'Ghi chú hoàn tiền (tuỳ chọn)', en: 'Refund note (optional)' },
			addItem: { vi: 'Thêm dòng', en: 'Add item row' },
			removeItem: { vi: 'Bỏ dòng', en: 'Remove row' },
			submit: { vi: 'Tạo phiếu', en: 'Create return' },
			requireOrder: { vi: 'Chọn và tải đơn hàng trước', en: 'Pick and load an order first' },
			requireItem: { vi: 'Chọn sản phẩm và số lượng hợp lệ', en: 'Pick an item and a valid quantity' },
			orderLoaded: { vi: 'Đã tải đơn', en: 'Order loaded' },
			orderLoadFailed: { vi: 'Không tải được đơn (kiểm tra mã hoặc cửa sổ 7 ngày)', en: 'Failed to load order (check id or the 7-day window)' }
		},
		confirmModal: {
			approveTitle: { vi: 'Duyệt phiếu đổi trả', en: 'Approve return' },
			approveBody: {
				vi: 'Duyệt phiếu đổi trả này? Sau đó có thể hoàn tất để hoàn tồn kho.',
				en: 'Approve this return? After that you can complete it to restock.'
			},
			rejectTitle: { vi: 'Từ chối phiếu đổi trả', en: 'Reject return' },
			rejectBody: {
				vi: 'Từ chối phiếu đổi trả này? Phiếu sẽ không thể hoàn tất.',
				en: 'Reject this return? It cannot be completed afterwards.'
			},
			completeTitle: { vi: 'Hoàn tất đổi trả', en: 'Complete return' },
			completeBody: {
				vi: 'Hoàn tất sẽ CỘNG lại tồn kho tại chi nhánh xử lý và ghi nhận hoàn tiền (chú thích).',
				en: 'Completing will restock the handling branch and record the refund as a note.'
			},
			submitApprove: { vi: 'Duyệt', en: 'Approve' },
			submitReject: { vi: 'Từ chối', en: 'Reject' },
			submitComplete: { vi: 'Hoàn tất', en: 'Complete' }
		},
		toasts: {
			created: { vi: 'Đã tạo phiếu đổi trả', en: 'Return created' },
			approved: { vi: 'Đã duyệt phiếu đổi trả', en: 'Return approved' },
			rejected: { vi: 'Đã từ chối phiếu đổi trả', en: 'Return rejected' },
			completed: { vi: 'Đã hoàn tất đổi trả — tồn kho đã hoàn lại', en: 'Return completed — stock restocked' },
			failed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const RETURN_STATUSES = ['requested', 'approved', 'completed', 'rejected'] as const;

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): string {
		switch (status) {
			case 'completed':
				return 'success';
			case 'requested':
				return 'warning';
			case 'approved':
				return 'default';
			case 'rejected':
				return 'error';
			default:
				return 'default';
		}
	}

	// ── Branch options ──
	let branches = $state<BranchOption[]>([]);

	function branchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const b = branches.find((x) => x._id === branchId);
		return b?.name ?? branchId;
	}

	function itemsSummary(row: ReturnRow): string {
		if (!row.items?.length) return '—';
		return row.items
			.map((i) => `${i.variantId} ×${i.quantity}`)
			.join(', ');
	}

	// ── Danh sách ──
	let returns = $state<ReturnRow[]>([]);
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

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
	async function loadReturns() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/returns/list',
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
					| { items?: ReturnRow[]; total?: number; page?: number }
					| undefined;
				returns = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/returns] load failed:', err);
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
				// Route trả data = mảng branch trực tiếp (xem /api/admin/inventory/branches)
				branches = (response.data as BranchOption[] | undefined) ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/returns] loadBranches failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadReturns();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadReturns();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadReturns();
	}

	// ── Modal tạo phiếu ──
	interface DraftItem {
		variantId: string;
		quantity: number;
		reason: string;
	}
	let createModalDisplay = $state(false);
	let draftOrderId = $state('');
	let loadedOrder = $state<OrderRow | null>(null);
	let draftReturnBranch = $state('');
	let draftItems = $state<DraftItem[]>([]);
	let draftRefundNote = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	function openCreateModal() {
		draftOrderId = '';
		loadedOrder = null;
		draftReturnBranch = '';
		draftItems = [];
		draftRefundNote = '';
		formError = undefined;
		createModalDisplay = true;
	}

	function orderItemLabel(variantId: string): string {
		const item = loadedOrder?.items?.find((i) => i.variantId === variantId);
		if (!item) return variantId;
		return `${variantId} (đã mua ×${item.quantity})`;
	}

	async function loadOrderItems() {
		if (!encryptionKeys || !draftOrderId.trim()) {
			formError = pageContents.createModal.requireOrder[lang];
			return;
		}
		formError = undefined;
		try {
			// /api/admin/orders/detail trả nguyên đơn (đủ items) — dùng để chọn variant
			const response = await encryption.fetchSecure(
				'/api/admin/orders/detail',
				{ method: 'POST', body: { documentKey: draftOrderId.trim() } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as OrderRow | undefined;
				loadedOrder = data ?? null;
				// Prefill mỗi item của đơn thành 1 dòng trả với quantity = 1
				draftItems = (data?.items ?? []).map((i) => ({
					variantId: i.variantId,
					quantity: 1,
					reason: ''
				}));
			} else {
				loadedOrder = null;
				draftItems = [];
				formError = pageContents.createModal.orderLoadFailed[lang];
			}
		} catch (err) {
			loadedOrder = null;
			draftItems = [];
			formError = pageContents.createModal.orderLoadFailed[lang];
			if (import.meta.env.DEV) console.error('[admin/returns] load order failed:', err);
		}
	}

	function addDraftItem() {
		if (!loadedOrder?.items?.length) return;
		draftItems = [...draftItems, { variantId: loadedOrder.items[0].variantId, quantity: 1, reason: '' }];
	}

	function removeDraftItem(index: number) {
		draftItems = draftItems.filter((_, i) => i !== index);
	}

	async function submitCreate() {
		if (submitting || !encryptionKeys) return;
		if (!draftOrderId.trim() || !loadedOrder) {
			formError = pageContents.createModal.requireOrder[lang];
			return;
		}
		const validItems = draftItems
			.filter((i) => i.variantId && Number(i.quantity) > 0)
			.map((i) => ({
				variantId: i.variantId,
				quantity: Math.floor(Number(i.quantity)),
				...(i.reason.trim() ? { reason: i.reason.trim() } : {})
			}));
		if (validItems.length === 0) {
			formError = pageContents.createModal.requireItem[lang];
			return;
		}
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/returns/create',
				{
					method: 'POST',
					body: {
						orderId: draftOrderId.trim(),
						returnBranchId: draftReturnBranch || undefined,
						items: validItems,
						refundNote: draftRefundNote.trim() || undefined
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
				await loadReturns();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/returns] create failed:', err);
		}
	}

	// ── Modal confirm hành động trạng thái ──
	type ConfirmKind = 'approve' | 'reject' | 'complete';
	let confirmModalDisplay = $state(false);
	let confirmKind = $state<ConfirmKind>('approve');
	let confirmTarget = $state<ReturnRow | null>(null);

	function openConfirmModal(kind: ConfirmKind, row: ReturnRow) {
		confirmKind = kind;
		confirmTarget = row;
		formError = undefined;
		confirmModalDisplay = true;
	}

	function confirmTitle(): string {
		if (confirmKind === 'approve') return pageContents.confirmModal.approveTitle[lang];
		if (confirmKind === 'reject') return pageContents.confirmModal.rejectTitle[lang];
		return pageContents.confirmModal.completeTitle[lang];
	}

	function confirmBody(): string {
		if (confirmKind === 'approve') return pageContents.confirmModal.approveBody[lang];
		if (confirmKind === 'reject') return pageContents.confirmModal.rejectBody[lang];
		return pageContents.confirmModal.completeBody[lang];
	}

	async function submitConfirm() {
		if (submitting || !confirmTarget?._id || !encryptionKeys) return;
		const endpoint =
			confirmKind === 'approve'
				? '/api/admin/returns/approve'
				: confirmKind === 'reject'
					? '/api/admin/returns/reject'
					: '/api/admin/returns/complete';
		submitting = true;
		formError = undefined;
		try {
			const response = await encryption.fetchSecure(
				endpoint,
				{ method: 'POST', body: { returnId: confirmTarget._id } },
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				const toastKey =
					confirmKind === 'approve'
						? pageContents.toasts.approved
						: confirmKind === 'reject'
							? pageContents.toasts.rejected
							: pageContents.toasts.completed;
				showToast(
					response.message ? resolveServerMessage(response.message, lang, toastKey) : toastKey[lang],
					'success'
				);
				confirmModalDisplay = false;
				await loadReturns();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/returns] status action failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadReturns(), loadBranches()]);
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
			<Button color="success" onClick={openCreateModal} data-test="admin-returns-create">
				{pageContents.createButton[lang]}
			</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange} data-test="admin-returns-status-filter">
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each RETURN_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadReturns}>
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
			<Button color="primary" variant="outline" onClick={loadReturns}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if returns.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap" data-test="admin-returns-table">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.returnCode[lang]}</th>
						<th scope="col">{pageContents.table.orderId[lang]}</th>
						<th scope="col">{pageContents.table.branch[lang]}</th>
						<th scope="col">{pageContents.table.items[lang]}</th>
						<th scope="col">{pageContents.table.refund[lang]}</th>
						<th scope="col">{pageContents.table.createdAt[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each returns as row (row._id)}
						<tr data-test="admin-returns-row">
							<td class="col-code">{row.returnCode ?? '—'}</td>
							<td class="col-wrap">{row.orderId ?? '—'}</td>
							<td>{branchLabel(row.returnBranchId ?? row.originBranchId)}</td>
							<td class="col-wrap">{itemsSummary(row)}</td>
							<td class="col-num">{formatMoney(row.totalRefundAmount)}</td>
							<td>{formatDateTime(row.createdAt)}</td>
							<td class="col-status">
								<span class="status-badge status-{statusColor(row.status)}" data-return-status={row.status}>{statusLabel(row.status)}</span>
							</td>
							<td class="col-actions">
								<div class="row-actions">
									{#if row.status === 'requested' || row.status === 'approved'}
										<!-- Quy ước màu nút: approve = primary -->
										<Button color="primary" size="sm" onClick={() => openConfirmModal('approve', row)}>
											{pageContents.actions.approve[lang]}
										</Button>
									{/if}
									{#if row.status === 'requested' || row.status === 'approved'}
										<!-- Quy ước màu nút: reject = error -->
										<Button color="error" variant="outline" size="sm" onClick={() => openConfirmModal('reject', row)}>
											{pageContents.actions.reject[lang]}
										</Button>
									{/if}
									{#if row.status === 'approved'}
										<!-- Quy ước màu nút: complete = success -->
										<Button color="success" size="sm" onClick={() => openConfirmModal('complete', row)}>
											{pageContents.actions.complete[lang]}
										</Button>
									{/if}
									{#if row.status === 'completed' || row.status === 'rejected'}
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
					<div class="order-load-row">
						<label class="form-field order-id-field">
							<span class="form-label">{pageContents.createModal.orderId[lang]}</span>
							<input
								class="admin-input"
								type="text"
								placeholder="order::…"
								bind:value={draftOrderId}
								data-test="admin-returns-order-id"
							/>
						</label>
						<Button color="primary" variant="outline" size="sm" onClick={loadOrderItems} data-test="admin-returns-load-order">
							{pageContents.createModal.loadOrder[lang]}
						</Button>
					</div>
					{#if loadedOrder}
						<p class="order-loaded-note">
							{pageContents.createModal.orderLoaded[lang]}: {loadedOrder.orderCode ?? loadedOrder._id}
							{#if loadedOrder.createdAt}
								· {formatDateTime(loadedOrder.createdAt)}
							{/if}
						</p>
					{/if}
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.returnBranch[lang]}</span>
						<select class="admin-select modal-select" bind:value={draftReturnBranch} data-test="admin-returns-branch">
							<option value="">—</option>
							{#each branches as b (b._id)}
								<option value={b._id}>{b.name ?? b._id}</option>
							{/each}
						</select>
					</label>
					{#each draftItems as item, idx}
						<div class="return-item-row">
							<label class="form-field return-item-variant">
								<span class="form-label">{pageContents.createModal.variant[lang]}</span>
								<select class="admin-select modal-select" bind:value={item.variantId}>
									{#each loadedOrder?.items ?? [] as oi (oi.variantId)}
										<option value={oi.variantId}>{orderItemLabel(oi.variantId)}</option>
									{/each}
								</select>
							</label>
							<label class="form-field return-item-qty">
								<span class="form-label">{pageContents.createModal.quantity[lang]}</span>
								<input class="admin-input" type="number" min="1" step="1" bind:value={item.quantity} />
							</label>
							<label class="form-field return-item-reason">
								<span class="form-label">{pageContents.createModal.reason[lang]}</span>
								<input class="admin-input" type="text" bind:value={item.reason} />
							</label>
							{#if draftItems.length > 1}
								<Button color="error" variant="ghost" size="sm" onClick={() => removeDraftItem(idx)}>
									{pageContents.createModal.removeItem[lang]}
								</Button>
							{/if}
						</div>
					{/each}
					{#if loadedOrder}
						<Button color="default" variant="outline" size="sm" onClick={addDraftItem}>
							{pageContents.createModal.addItem[lang]}
						</Button>
					{/if}
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.refundNote[lang]}</span>
						<textarea class="admin-textarea" rows="2" bind:value={draftRefundNote} disabled={submitting}></textarea>
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create = success -->
				<Button color="success" onClick={submitCreate} loading={submitting} disabled={submitting} data-test="admin-returns-submit">
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
				{:else if confirmKind === 'reject'}
					<!-- reject = error -->
					<Button color="error" onClick={submitConfirm} loading={submitting} disabled={submitting}>
						{pageContents.confirmModal.submitReject[lang]}
					</Button>
				{:else}
					<!-- complete = success -->
					<Button color="success" onClick={submitConfirm} loading={submitting} disabled={submitting}>
						{pageContents.confirmModal.submitComplete[lang]}
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

	.col-num {
		font-variant-numeric: tabular-nums;
	}

	.col-wrap {
		white-space: normal;
		min-width: 8rem;
		max-width: 20rem;
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

	.modal-select {
		width: 100%;
		height: 2.5rem;
	}

	.order-load-row {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;

		.order-id-field {
			flex: 1;
		}

		@media (max-width: 720px) {
			flex-direction: column;
			align-items: stretch;
		}
	}

	.order-loaded-note {
		font-size: 0.8rem;
		color: var(--foreground-500);
		margin: 0;
	}

	.return-item-row {
		display: grid;
		grid-template-columns: 2fr 0.7fr 1.4fr auto;
		gap: 0.5rem;
		align-items: end;

		@media (max-width: 720px) {
			grid-template-columns: 1fr;
		}
	}
</style>
