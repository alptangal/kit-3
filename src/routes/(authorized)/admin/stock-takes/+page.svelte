<!-- src/routes/(authorized)/admin/stock-takes/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolveServerMessage } from '../_interface';

	interface StockTakeRow {
		_id: string;
		branchId?: string;
		referenceNumber?: string;
		status?: string;
		startedBy?: string;
		completedBy?: string | null;
		totalItems?: number;
		totalVariance?: number;
		variancePercentage?: number;
		notes?: string | null;
		startedAt?: string | null;
		completedAt?: string | null;
	}

	interface StockTakeItemRow {
		variantId: string;
		lotId?: string | null;
		systemQuantity: number;
		countedQuantity: number;
		variance: number;
		varianceReason?: string | null;
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
		title: { vi: 'Kiểm kê kho', en: 'Stock takes' },
		subtitle: {
			vi: 'Tạo phiếu kiểm kê, nhập số đếm thực tế và hoàn tất đối chiếu chênh lệch',
			en: 'Create stock takes, enter counted quantities and complete variance review'
		},
		nav: {
			users: { vi: 'Người dùng', en: 'Users' },
			orders: { vi: 'Đơn hàng', en: 'Orders' },
			inventory: { vi: 'Tồn kho', en: 'Inventory' },
			suppliers: { vi: 'Nhà cung cấp', en: 'Suppliers' },
			promotions: { vi: 'Khuyến mãi', en: 'Promotions' },
			stockTakes: { vi: 'Kiểm kê', en: 'Stock takes' },
			posSessions: { vi: 'POS', en: 'POS' }
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' }
		},
		table: {
			reference: { vi: 'Số tham chiếu', en: 'Reference' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			status: { vi: 'Trạng thái', en: 'Status' },
			totalItems: { vi: 'Số mục', en: 'Items' },
			totalVariance: { vi: 'Tổng chênh lệch', en: 'Total variance' },
			variancePct: { vi: '% chênh lệch', en: 'Variance %' },
			started: { vi: 'Bắt đầu', en: 'Started' },
			completed: { vi: 'Hoàn tất', en: 'Completed' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		statuses: {
			draft: { vi: 'Nháp', en: 'Draft' },
			in_progress: { vi: 'Đang kiểm', en: 'In progress' },
			completed: { vi: 'Hoàn tất', en: 'Completed' }
		},
		actions: {
			create: { vi: 'Tạo phiếu kiểm kê', en: 'Create stock take' },
			detail: { vi: 'Chi tiết', en: 'Detail' },
			start: { vi: 'Bắt đầu kiểm', en: 'Start' },
			complete: { vi: 'Hoàn tất', en: 'Complete' },
			addItem: { vi: 'Thêm mục', en: 'Add item' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			loadingDetail: { vi: 'Đang tải chi tiết…', en: 'Loading detail…' },
			errorTitle: { vi: 'Không tải được phiếu kiểm kê', en: 'Failed to load stock takes' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có phiếu kiểm kê nào', en: 'No stock takes yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			pageInfo: { vi: 'Trang {page}/{total}', en: 'Page {page}/{total}' },
			totalCount: { vi: '{total} phiếu kiểm kê', en: '{total} stock takes' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		createModal: {
			title: { vi: 'Tạo phiếu kiểm kê', en: 'Create stock take' },
			reference: { vi: 'Số tham chiếu', en: 'Reference number' },
			notes: { vi: 'Ghi chú (tuỳ chọn)', en: 'Notes (optional)' },
			submit: { vi: 'Tạo', en: 'Create' }
		},
		detailModal: {
			title: { vi: 'Chi tiết phiếu kiểm kê', en: 'Stock take detail' },
			itemsTitle: { vi: 'Các mục kiểm', en: 'Counted items' },
			variant: { vi: 'Sản phẩm', en: 'Variant' },
			lot: { vi: 'Lô', en: 'Lot' },
			systemQty: { vi: 'Tồn hệ thống', en: 'System qty' },
			countedQty: { vi: 'Số đếm', en: 'Counted' },
			variance: { vi: 'Chênh lệch', en: 'Variance' },
			reason: { vi: 'Lý do', en: 'Reason' },
			emptyItems: { vi: 'Chưa có mục kiểm nào', en: 'No counted items yet' },
			addItemTitle: { vi: 'Thêm mục kiểm', en: 'Add counted item' },
			itemVariant: { vi: 'Sản phẩm', en: 'Variant' },
			itemVariantPlaceholder: { vi: 'Chọn sản phẩm', en: 'Select a variant' },
			itemLot: { vi: 'ID lô (tuỳ chọn)', en: 'Lot id (optional)' },
			itemSystemQty: { vi: 'Tồn hệ thống', en: 'System quantity' },
			itemCountedQty: { vi: 'Số đếm thực tế', en: 'Counted quantity' },
			itemReason: { vi: 'Lý do chênh lệch (tuỳ chọn)', en: 'Variance reason (optional)' },
			add: { vi: 'Thêm', en: 'Add' },
			completeTitle: { vi: 'Hoàn tất phiếu kiểm kê', en: 'Complete stock take' },
			completeIntro: {
				vi: 'Phiếu sẽ chuyển sang trạng thái hoàn tất và không thể thêm/sửa mục nữa.',
				en: 'The stock take will be marked completed and can no longer be modified.'
			},
			completeNotes: { vi: 'Ghi chú khi hoàn tất (tuỳ chọn)', en: 'Completion notes (optional)' },
			confirmComplete: { vi: 'Xác nhận hoàn tất', en: 'Confirm complete' },
			startConfirm: { vi: 'Bắt đầu kiểm kho?', en: 'Start counting?' },
			confirmStart: { vi: 'Bắt đầu', en: 'Start' }
		},
		toasts: {
			created: { vi: 'Đã tạo phiếu kiểm kê', en: 'Stock take created' },
			createFailed: { vi: 'Tạo phiếu không thành công', en: 'Failed to create stock take' },
			started: { vi: 'Đã bắt đầu kiểm kê', en: 'Stock take started' },
			startFailed: { vi: 'Bắt đầu kiểm kê không thành công', en: 'Failed to start stock take' },
			completed: { vi: 'Đã hoàn tất kiểm kê', en: 'Stock take completed' },
			completeFailed: { vi: 'Hoàn tất không thành công', en: 'Failed to complete stock take' },
			itemAdded: { vi: 'Đã thêm mục kiểm', en: 'Item added' },
			itemFailed: { vi: 'Thêm mục kiểm không thành công', en: 'Failed to add item' },
			detailFailed: { vi: 'Không tải được chi tiết', en: 'Failed to load detail' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireReference: { vi: 'Vui lòng nhập số tham chiếu', en: 'Please enter a reference number' },
			requireVariant: { vi: 'Vui lòng chọn sản phẩm', en: 'Please select a variant' },
			requireQty: { vi: 'Số lượng phải là số không âm', en: 'Quantities must be non-negative numbers' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// pathname ép về string
	const currentPath = $derived(page.url.pathname as string);

	const STOCK_TAKE_STATUSES = ['draft', 'in_progress', 'completed'] as const;

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): string {
		switch (status) {
			case 'draft':
				return 'default';
			case 'in_progress':
				return 'warning';
			case 'completed':
				return 'success';
			default:
				return 'default';
		}
	}

	// ── Danh sách ──
	let stockTakes = $state<StockTakeRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let statusFilter = $state('');

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	let branches = $state<{ _id: string; name?: string }[]>([]);

	function getBranchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const branch = branches.find((b) => b._id === branchId);
		return branch?.name ?? branchId;
	}

	function getVariantLabel(variantId?: string | null): string {
		if (!variantId) return '—';
		const variant = variantOptions.find((v) => v._id === variantId);
		if (!variant) return variantId;
		return variant.sku ? `${variant.sku} — ${variant.displayName ?? ''}` : (variant.displayName ?? variantId);
	}

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

	// ── Modal chi tiết ──
	let detailModalDisplay = $state(false);
	let detailLoading = $state(false);
	let detailError = $state<string | undefined>(undefined);
	let detailRow = $state<StockTakeRow | null>(null);
	let detailItems = $state<StockTakeItemRow[]>([]);

	let variantOptions = $state<VariantOption[]>([]);
	let variantOptionsLoaded = $state(false);

	// Thêm mục kiểm
	let addItemOpen = $state(false);
	let itemForm = $state<{
		variantId: string;
		lotId: string;
		systemQuantity: number;
		countedQuantity: number;
		varianceReason: string;
	}>({ variantId: '', lotId: '', systemQuantity: 0, countedQuantity: 0, varianceReason: '' });
	let itemBusy = $state(false);
	let itemError = $state<string | undefined>(undefined);

	// Hoàn tất
	let completeOpen = $state(false);
	let completeNotes = $state('');
	let completeBusy = $state(false);
	let completeError = $state<string | undefined>(undefined);

	// Bắt đầu
	let startOpen = $state(false);
	let startBusy = $state(false);
	let startError = $state<string | undefined>(undefined);

	const canEditItems = $derived(detailRow?.status === 'draft' || detailRow?.status === 'in_progress');

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
				branches = (response.data as { _id: string; name?: string }[] | undefined) ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/stock-takes] load branches failed:', err);
		}
	}

	async function loadVariantOptions() {
		if (!encryptionKeys || variantOptionsLoaded) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/list',
				{ method: 'POST', body: { page: 1, pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				variantOptions = (response.data as { items?: VariantOption[] } | undefined)?.items ?? [];
				variantOptionsLoaded = true;
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/stock-takes] load variants failed:', err);
		}
	}

	async function loadStockTakes() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/stock-takes/list',
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
					| { items?: StockTakeRow[]; total?: number; page?: number }
					| undefined;
				stockTakes = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/stock-takes] load failed:', err);
		}
	}

	async function openDetail(row: StockTakeRow) {
		if (!encryptionKeys) return;
		detailRow = row;
		detailItems = [];
		detailError = undefined;
		detailModalDisplay = true;
		detailLoading = true;
		void loadVariantOptions();
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/stock-takes/get',
				{ method: 'POST', body: { stockTakeId: row._id } },
				encryptionKeys
			);
			detailLoading = false;
			if (response.ok) {
				const data = response.data as { stockTake?: StockTakeRow; items?: StockTakeItemRow[] } | undefined;
				detailRow = data?.stockTake ?? row;
				detailItems = data?.items ?? [];
			} else {
				detailError = resolveServerMessage(response.message, lang, pageContents.toasts.detailFailed);
			}
		} catch (err) {
			detailLoading = false;
			detailError = resolveServerMessage(undefined, lang, pageContents.toasts.detailFailed);
			if (import.meta.env.DEV) console.error('[admin/stock-takes] load detail failed:', err);
		}
	}

	async function refreshDetail() {
		if (detailRow) {
			const currentId = detailRow._id;
			await openDetail({ ...detailRow, _id: currentId });
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadStockTakes();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadStockTakes();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadStockTakes();
	}

	// ── Modal tạo ──
	let createModalDisplay = $state(false);
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);
	let form = $state<{ referenceNumber: string; notes: string }>({ referenceNumber: '', notes: '' });

	function openCreateModal() {
		form = { referenceNumber: '', notes: '' };
		formError = undefined;
		createModalDisplay = true;
	}

	async function submitStockTake() {
		if (submitting || !encryptionKeys) return;
		if (!form.referenceNumber.trim()) {
			formError = pageContents.form.requireReference[lang];
			return;
		}
		formError = undefined;
		submitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/stock-takes/create',
				{
					method: 'POST',
					body: {
						referenceNumber: form.referenceNumber.trim(),
						notes: form.notes.trim() || undefined
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
				await loadStockTakes();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.createFailed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/stock-takes] create failed:', err);
		}
	}

	// ── Bắt đầu kiểm ──
	function openStartModal() {
		if (!detailRow) return;
		startError = undefined;
		startOpen = true;
	}

	async function confirmStart() {
		if (!detailRow || startBusy || !encryptionKeys) return;
		startBusy = true;
		startError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/stock-takes/start',
				{ method: 'POST', body: { stockTakeId: detailRow._id } },
				encryptionKeys
			);
			startBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.started)
						: pageContents.toasts.started[lang],
					'success'
				);
				startOpen = false;
				await loadStockTakes();
				await refreshDetail();
			} else {
				startError = resolveServerMessage(response.message, lang, pageContents.toasts.startFailed);
			}
		} catch (err) {
			startBusy = false;
			startError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/stock-takes] start failed:', err);
		}
	}

	// ── Thêm mục kiểm ──
	function openAddItem() {
		itemForm = { variantId: '', lotId: '', systemQuantity: 0, countedQuantity: 0, varianceReason: '' };
		itemError = undefined;
		addItemOpen = true;
	}

	async function submitItem() {
		if (!detailRow || itemBusy || !encryptionKeys) return;
		if (!itemForm.variantId) {
			itemError = pageContents.form.requireVariant[lang];
			return;
		}
		if (!Number.isFinite(itemForm.systemQuantity) || !Number.isFinite(itemForm.countedQuantity) || itemForm.systemQuantity < 0 || itemForm.countedQuantity < 0) {
			itemError = pageContents.form.requireQty[lang];
			return;
		}
		itemBusy = true;
		itemError = undefined;
		const variance = Number(itemForm.countedQuantity) - Number(itemForm.systemQuantity);
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/stock-takes/items/add',
				{
					method: 'POST',
					body: {
						stockTakeId: detailRow._id,
						item: {
							variantId: itemForm.variantId,
							lotId: itemForm.lotId.trim() || undefined,
							systemQuantity: Number(itemForm.systemQuantity),
							countedQuantity: Number(itemForm.countedQuantity),
							variance,
							varianceReason: itemForm.varianceReason.trim() || undefined
						}
					}
				},
				encryptionKeys
			);
			itemBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.itemAdded)
						: pageContents.toasts.itemAdded[lang],
					'success'
				);
				addItemOpen = false;
				await refreshDetail();
			} else {
				itemError = resolveServerMessage(response.message, lang, pageContents.toasts.itemFailed);
			}
		} catch (err) {
			itemBusy = false;
			itemError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/stock-takes] add item failed:', err);
		}
	}

	// ── Hoàn tất ──
	function openCompleteModal() {
		if (!detailRow) return;
		completeNotes = '';
		completeError = undefined;
		completeOpen = true;
	}

	async function confirmComplete() {
		if (!detailRow || completeBusy || !encryptionKeys) return;
		completeBusy = true;
		completeError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/stock-takes/complete',
				{
					method: 'POST',
					body: {
						stockTakeId: detailRow._id,
						notes: completeNotes.trim() || undefined
					}
				},
				encryptionKeys
			);
			completeBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.completed)
						: pageContents.toasts.completed[lang],
					'success'
				);
				completeOpen = false;
				await loadStockTakes();
				await refreshDetail();
			} else {
				completeError = resolveServerMessage(response.message, lang, pageContents.toasts.completeFailed);
			}
		} catch (err) {
			completeBusy = false;
			completeError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/stock-takes] complete failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadStockTakes(), loadBranches()]);
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page">
	<!-- ── Nav liên kết nhanh giữa các trang quản trị ── -->
	<nav class="admin-nav" aria-label={lang === 'vi' ? 'Trang quản trị' : 'Admin pages'}>
		<a href="/admin" class:active={currentPath === '/admin'}>{pageContents.nav.users[lang]}</a>
		<a href="/admin/orders" class:active={currentPath === '/admin/orders'}>{pageContents.nav.orders[lang]}</a>
		<a href="/admin/inventory" class:active={currentPath === '/admin/inventory'}>{pageContents.nav.inventory[lang]}</a>
		<a href="/admin/suppliers" class:active={currentPath === '/admin/suppliers'}>{pageContents.nav.suppliers[lang]}</a>
		<a href="/admin/promotions" class:active={currentPath === '/admin/promotions'}>{pageContents.nav.promotions[lang]}</a>
		<a href="/admin/stock-takes" class:active={currentPath === '/admin/stock-takes'}>{pageContents.nav.stockTakes[lang]}</a>
		<a href="/admin/pos-sessions" class:active={currentPath === '/admin/pos-sessions'}>{pageContents.nav.posSessions[lang]}</a>
	</nav>

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

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each STOCK_TAKE_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadStockTakes}>
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
			<Button color="primary" variant="outline" onClick={loadStockTakes}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if stockTakes.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.reference[lang]}</th>
						<th scope="col">{pageContents.table.branch[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.totalItems[lang]}</th>
						<th scope="col">{pageContents.table.totalVariance[lang]}</th>
						<th scope="col">{pageContents.table.variancePct[lang]}</th>
						<th scope="col">{pageContents.table.started[lang]}</th>
						<th scope="col">{pageContents.table.completed[lang]}</th>
						<th scope="col" class="col-actions">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each stockTakes as row (row._id)}
						<tr>
							<td class="col-code">{row.referenceNumber ?? '—'}</td>
							<td>{getBranchLabel(row.branchId)}</td>
							<td class="col-status">
								<span class="status-badge status-{statusColor(row.status)}">{statusLabel(row.status)}</span>
							</td>
							<td class="col-num">{row.totalItems ?? 0}</td>
							<td class="col-num">{row.totalVariance ?? 0}</td>
							<td class="col-num">{row.variancePercentage ?? 0}%</td>
							<td>{formatDateTime(row.startedAt)}</td>
							<td>{formatDateTime(row.completedAt)}</td>
							<td class="col-actions">
								<div class="row-actions">
									<!-- update/edit = primary -->
									<Button color="primary" variant="ghost" size="sm" onClick={() => openDetail(row)}>
										{pageContents.actions.detail[lang]}
									</Button>
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
	<Modal bind:display={createModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.createModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.reference[lang]}</span>
						<input class="admin-input" type="text" bind:value={form.referenceNumber} disabled={submitting} />
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.notes[lang]}</span>
						<input class="admin-input" type="text" bind:value={form.notes} disabled={submitting} />
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitStockTake} loading={submitting} disabled={submitting}>
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

<!-- ── Modal chi tiết ── -->
{#if detailModalDisplay}
	<Modal bind:display={detailModalDisplay} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				{pageContents.detailModal.title[lang]} — {detailRow?.referenceNumber ?? '—'}
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if detailLoading}
					<p class="modal-intro">{pageContents.states.loadingDetail[lang]}</p>
				{:else if detailError}
					<div class="form-error-banner" role="alert">{detailError}</div>
				{:else}
					<p class="modal-intro">
						<span class="status-badge status-{statusColor(detailRow?.status)}">{statusLabel(detailRow?.status)}</span>
					</p>
					{#if canEditItems}
						<div class="detail-actions">
							<Button color="default" variant="outline" size="sm" onClick={openAddItem}>
								{pageContents.actions.addItem[lang]}
							</Button>
							{#if detailRow?.status === 'draft'}
								<Button color="primary" variant="outline" size="sm" onClick={openStartModal}>
									{pageContents.actions.start[lang]}
								</Button>
							{/if}
							{#if detailRow?.status === 'in_progress'}
								<Button color="success" variant="outline" size="sm" onClick={openCompleteModal}>
									{pageContents.actions.complete[lang]}
								</Button>
							{/if}
						</div>
					{/if}

					{#if detailItems.length === 0}
						<p class="modal-intro">{pageContents.detailModal.emptyItems[lang]}</p>
					{:else}
						<div class="detail-table-wrap">
							<table class="detail-table">
								<thead>
									<tr>
										<th scope="col">{pageContents.detailModal.variant[lang]}</th>
										<th scope="col">{pageContents.detailModal.lot[lang]}</th>
										<th scope="col">{pageContents.detailModal.systemQty[lang]}</th>
										<th scope="col">{pageContents.detailModal.countedQty[lang]}</th>
										<th scope="col">{pageContents.detailModal.variance[lang]}</th>
										<th scope="col">{pageContents.detailModal.reason[lang]}</th>
									</tr>
								</thead>
								<tbody>
									{#each detailItems as item, index (index)}
										<tr>
											<td>{getVariantLabel(item.variantId)}</td>
											<td>{item.lotId ?? '—'}</td>
											<td class="col-num">{item.systemQuantity}</td>
											<td class="col-num">{item.countedQuantity}</td>
											<td class="col-num" class:variance-negative={(item.variance ?? 0) < 0} class:variance-positive={(item.variance ?? 0) > 0}>
												{item.variance > 0 ? '+' : ''}{item.variance}
											</td>
											<td class="col-wrap">{item.varianceReason ?? '—'}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						detailModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal thêm mục kiểm ── -->
{#if addItemOpen}
	<Modal bind:display={addItemOpen} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.detailModal.addItemTitle[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if itemError}
					<div class="form-error-banner" role="alert">{itemError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.detailModal.itemVariant[lang]}</span>
						<select class="admin-select" bind:value={itemForm.variantId} disabled={itemBusy}>
							<option value="" disabled>{pageContents.detailModal.itemVariantPlaceholder[lang]}</option>
							{#each variantOptions as variant (variant._id)}
								<option value={variant._id}>
									{variant.sku ? `${variant.sku} — ${variant.displayName ?? ''}` : (variant.displayName ?? variant._id)}
								</option>
							{/each}
						</select>
					</label>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.detailModal.itemLot[lang]}</span>
							<input class="admin-input" type="text" bind:value={itemForm.lotId} disabled={itemBusy} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.detailModal.itemSystemQty[lang]}</span>
							<input class="admin-input" type="number" min="0" step="1" bind:value={itemForm.systemQuantity} disabled={itemBusy} />
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.detailModal.itemCountedQty[lang]}</span>
							<input class="admin-input" type="number" min="0" step="1" bind:value={itemForm.countedQuantity} disabled={itemBusy} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.detailModal.itemReason[lang]}</span>
							<input class="admin-input" type="text" bind:value={itemForm.varianceReason} disabled={itemBusy} />
						</label>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitItem} loading={itemBusy} disabled={itemBusy}>
					{pageContents.detailModal.add[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={itemBusy}
					onClick={() => {
						addItemOpen = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal bắt đầu ── -->
{#if startOpen}
	<Modal bind:display={startOpen} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.detailModal.startConfirm[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if startError}
					<div class="form-error-banner" role="alert">{startError}</div>
				{/if}
				<p class="modal-intro">{detailRow?.referenceNumber ?? '—'}</p>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- update (status transition) = primary -->
				<Button color="primary" onClick={confirmStart} loading={startBusy}>
					{pageContents.detailModal.confirmStart[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						startOpen = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal hoàn tất ── -->
{#if completeOpen}
	<Modal bind:display={completeOpen} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.detailModal.completeTitle[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if completeError}
					<div class="form-error-banner" role="alert">{completeError}</div>
				{/if}
				<p class="modal-intro">{pageContents.detailModal.completeIntro[lang]}</p>
				<label class="form-field">
					<span class="form-label">{pageContents.detailModal.completeNotes[lang]}</span>
					<input class="admin-input" type="text" bind:value={completeNotes} disabled={completeBusy} />
				</label>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- update (status transition) = primary -->
				<Button color="primary" onClick={confirmComplete} loading={completeBusy}>
					{pageContents.detailModal.confirmComplete[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						completeOpen = false;
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

	.admin-nav {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--default-200);
		padding-bottom: 0.5rem;

		a {
			padding: 0.35rem 0.75rem;
			border-radius: 0.5rem;
			font-size: 0.85rem;
			color: var(--foreground-500);
			text-decoration: none;

			&:hover {
				background: var(--default-100);
				color: var(--foreground);
			}

			&.active {
				background: var(--default-200);
				color: var(--foreground);
				font-weight: 600;
			}
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
	}

	.col-actions {
		text-align: right;
	}

	.row-actions {
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
		flex-wrap: wrap;
	}

	.col-status {
		white-space: nowrap;
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

	.modal-intro {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--foreground);
		line-height: 1.5;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.detail-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}

	.detail-table-wrap {
		overflow-x: auto;
		border: 1px solid var(--default-200);
		border-radius: 0.5rem;
	}

	.detail-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;

		th,
		td {
			padding: 0.5rem 0.75rem;
			border-bottom: 1px solid var(--default-200);
			text-align: left;
			white-space: nowrap;
		}

		th {
			background: var(--default-100);
			font-weight: 600;
			color: var(--foreground-500);
		}
	}

	.variance-positive {
		color: var(--success, var(--foreground));
		font-weight: 600;
	}

	.variance-negative {
		color: var(--error);
		font-weight: 600;
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
</style>
