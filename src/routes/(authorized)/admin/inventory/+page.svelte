<!-- src/routes/(authorized)/admin/inventory/+page.svelte -->
<script lang="ts">
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDate as formatDateShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolveServerMessage } from '../_interface';

	interface StockRow {
		_id?: string;
		variantId?: string;
		branchId?: string;
		quantityOnHand?: number;
		quantityReserved?: number;
		updatedAt?: string | null;
	}

	interface LotRow {
		_id?: string;
		variantId?: string;
		branchId?: string;
		lotNumber?: string;
		quantityOnHand?: number;
		manufacturedAt?: string | null;
		expiresAt?: string | null;
		receivedAt?: string | null;
		supplierId?: string | null;
		status?: string;
		createdAt?: string | null;
	}

	interface BranchOption {
		_id: string;
		name?: string;
		isWarehouse?: boolean;
	}

	interface VariantOption {
		_id: string;
		sku?: string;
		displayName?: string;
	}

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

	// ── Nội dung song ngữ (index bằng string — pattern trang users) ──
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Tồn kho', en: 'Inventory' },
		subtitle: {
			vi: 'Theo dõi tồn kho theo chi nhánh, quản lý lô hàng và điều chỉnh số lượng',
			en: 'Track stock per branch, manage lots and adjust quantities'
		},
		tabs: {
			stock: { vi: 'Tồn kho', en: 'Stock' },
			lots: { vi: 'Lô hàng', en: 'Lots' }
		},
		filters: {
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' },
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			variantSearch: { vi: 'Mã sản phẩm (variantId)', en: 'Variant id' },
			includeZero: { vi: 'Hiện cả hàng tồn 0', en: 'Include zero stock' }
		},
		stockTable: {
			variant: { vi: 'Sản phẩm', en: 'Variant' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			onHand: { vi: 'Tồn thực', en: 'On hand' },
			reserved: { vi: 'Đặt trước', en: 'Reserved' },
			updated: { vi: 'Cập nhật', en: 'Updated' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		lotsTable: {
			lotNumber: { vi: 'Số lô', en: 'Lot number' },
			variant: { vi: 'Sản phẩm', en: 'Variant' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			quantity: { vi: 'Số lượng', en: 'Quantity' },
			expires: { vi: 'Hết hạn', en: 'Expires' },
			received: { vi: 'Nhận', en: 'Received' },
			status: { vi: 'Trạng thái', en: 'Status' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		lotStatuses: {
			active: { vi: 'Đang dùng', en: 'Active' },
			expired: { vi: 'Hết hạn', en: 'Expired' },
			depleted: { vi: 'Cạn', en: 'Depleted' },
			quarantined: { vi: 'Cách ly', en: 'Quarantined' }
		},
		actions: {
			adjust: { vi: 'Điều chỉnh', en: 'Adjust' },
			createLot: { vi: 'Tạo lô hàng', en: 'Create lot' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitleStock: { vi: 'Không tải được tồn kho', en: 'Failed to load stock' },
			errorTitleLots: { vi: 'Không tải được lô hàng', en: 'Failed to load lots' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			emptyStock: { vi: 'Chưa có tồn kho nào', en: 'No stock records' },
			emptyLots: { vi: 'Chưa có lô hàng nào', en: 'No lots yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCountStock: { vi: '{total} bản ghi tồn kho', en: '{total} stock records' },
			totalCountLots: { vi: '{total} lô hàng', en: '{total} lots' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		adjustModal: {
			title: { vi: 'Điều chỉnh tồn kho', en: 'Adjust stock' },
			intro: {
				vi: 'Nhập số thay đổi (dương để tăng, âm để giảm). Không thể giảm dưới 0.',
				en: 'Enter a change (positive to add, negative to reduce). Cannot go below 0.'
			},
			change: { vi: 'Số thay đổi', en: 'Change' },
			note: { vi: 'Ghi chú (tuỳ chọn)', en: 'Note (optional)' },
			confirm: { vi: 'Áp dụng', en: 'Apply' }
		},
		lotModal: {
			title: { vi: 'Tạo lô hàng', en: 'Create lot' },
			variant: { vi: 'Sản phẩm (variantId)', en: 'Variant id' },
			variantPlaceholder: { vi: 'Chọn sản phẩm', en: 'Select a variant' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			branchPlaceholder: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			lotNumber: { vi: 'Số lô', en: 'Lot number' },
			quantity: { vi: 'Số lượng', en: 'Quantity' },
			manufacturedAt: { vi: 'Ngày sản xuất', en: 'Manufactured at' },
			expiresAt: { vi: 'Ngày hết hạn', en: 'Expires at' },
			supplierId: { vi: 'Mã nhà cung cấp (tuỳ chọn)', en: 'Supplier id (optional)' },
			status: { vi: 'Trạng thái', en: 'Status' },
			submit: { vi: 'Tạo lô', en: 'Create lot' }
		},
		toasts: {
			adjusted: { vi: 'Đã điều chỉnh tồn kho', en: 'Stock adjusted' },
			lotCreated: { vi: 'Đã tạo lô hàng', en: 'Lot created' },
			adjustFailed: { vi: 'Điều chỉnh không thành công', en: 'Adjustment failed' },
			lotFailed: { vi: 'Tạo lô không thành công', en: 'Failed to create lot' },
			actionFailed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// pathname ép về string (các route phase 4 chưa có trong RouteId → 'no overlap')

	const LOT_STATUSES = ['active', 'expired', 'depleted', 'quarantined'] as const;
	type LotStatus = (typeof LOT_STATUSES)[number];

	function lotStatusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.lotStatuses;
		const label = pageContents.lotStatuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function lotStatusColor(status?: string): 'success' | 'warning' | 'danger' | 'default' {
		switch (status) {
			case 'active':
				return 'success';
			case 'quarantined':
				return 'warning';
			case 'expired':
				return 'danger';
			default:
				return 'default';
		}
	}

	// ── Tab + trạng thái danh sách ──
	let activeTab = $state<'stock' | 'lots'>('stock');

	let stock = $state<StockRow[]>([]);
	let stockTotal = $state(0);
	let stockPage = $state(1);
	let stockLoading = $state(false);
	let stockError = $state<string | undefined>(undefined);
	let stockLoadedOnce = $state(false);

	let lots = $state<LotRow[]>([]);
	let lotsTotal = $state(0);
	let lotsPage = $state(1);
	let lotsLoading = $state(false);
	let lotsError = $state<string | undefined>(undefined);
	let lotsLoadedOnce = $state(false);

	let pageSize = $state(20);
	let branchFilter = $state('');
	let variantFilter = $state('');
	let includeZero = $state(false);
	let lotStatusFilter = $state('');

	let branches = $state<BranchOption[]>([]);
	let variantOptions = $state<VariantOption[]>([]);
	let variantOptionsLoading = $state(false);

	// ── Modal điều chỉnh tồn kho ──
	let adjustModalDisplay = $state(false);
	let adjustRow = $state<StockRow | null>(null);
	let adjustChange = $state(0);
	let adjustNote = $state('');
	let adjustBusy = $state(false);
	let adjustError = $state<string | undefined>(undefined);

	// ── Modal tạo lô ──
	let lotModalDisplay = $state(false);
	let lotSubmitting = $state(false);
	let lotError = $state<string | undefined>(undefined);
	let lotForm = $state<{
		variantId: string;
		branchId: string;
		lotNumber: string;
		quantityOnHand: number;
		manufacturedAt: string;
		expiresAt: string;
		supplierId: string;
		status: string;
	}>({
		variantId: '',
		branchId: '',
		lotNumber: '',
		quantityOnHand: 0,
		manufacturedAt: '',
		expiresAt: '',
		supplierId: '',
		status: 'active'
	});

	// ── Derived ──
	const totalPages = $derived(
		activeTab === 'stock' ? Math.max(1, Math.ceil(stockTotal / pageSize)) : Math.max(1, Math.ceil(lotsTotal / pageSize))
	);
	const currentPage = $derived(activeTab === 'stock' ? stockPage : lotsPage);
	const totalCountText = $derived(
		activeTab === 'stock'
			? pageContents.pagination.totalCountStock[lang].replace('{total}', String(stockTotal))
			: pageContents.pagination.totalCountLots[lang].replace('{total}', String(lotsTotal))
	);

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

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDate(raw?: string | Date | null) {
		return formatDateShared(raw, lang);
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
			if (import.meta.env.DEV) console.error('[admin/inventory] load branches failed:', err);
		}
	}

	async function loadVariantOptions() {
		if (!encryptionKeys || variantOptionsLoading) return;
		variantOptionsLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/list',
				{ method: 'POST', body: { page: 1, pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				variantOptions = (response.data as { items?: VariantOption[] } | undefined)?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/inventory] load variants failed:', err);
		}
		variantOptionsLoading = false;
	}

	async function loadStock() {
		if (!encryptionKeys) return;
		stockLoading = true;
		stockError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/stock/list',
				{
					method: 'POST',
					body: {
						page: stockPage,
						pageSize,
						branchId: branchFilter || undefined,
						variantId: variantFilter.trim() || undefined,
						includeZero: includeZero || undefined
					}
				},
				encryptionKeys
			);
			stockLoading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: StockRow[]; total?: number; page?: number }
					| undefined;
				stock = data?.items ?? [];
				if (typeof data?.total === 'number') stockTotal = data.total;
				if (typeof data?.page === 'number') stockPage = data.page;
				stockLoadedOnce = true;
			} else {
				stockError = resolveServerMessage(response.message, lang, pageContents.states.errorTitleStock);
			}
		} catch (err) {
			stockLoading = false;
			stockError = resolveServerMessage(undefined, lang, pageContents.states.errorTitleStock);
			if (import.meta.env.DEV) console.error('[admin/inventory] load stock failed:', err);
		}
	}

	async function loadLots() {
		if (!encryptionKeys) return;
		lotsLoading = true;
		lotsError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/lots/list',
				{
					method: 'POST',
					body: {
						page: lotsPage,
						pageSize,
						branchId: branchFilter || undefined,
						variantId: variantFilter.trim() || undefined,
						status: lotStatusFilter || undefined
					}
				},
				encryptionKeys
			);
			lotsLoading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: LotRow[]; total?: number; page?: number }
					| undefined;
				lots = data?.items ?? [];
				if (typeof data?.total === 'number') lotsTotal = data.total;
				if (typeof data?.page === 'number') lotsPage = data.page;
				lotsLoadedOnce = true;
			} else {
				lotsError = resolveServerMessage(response.message, lang, pageContents.states.errorTitleLots);
			}
		} catch (err) {
			lotsLoading = false;
			lotsError = resolveServerMessage(undefined, lang, pageContents.states.errorTitleLots);
			if (import.meta.env.DEV) console.error('[admin/inventory] load lots failed:', err);
		}
	}

	function switchTab(tab: 'stock' | 'lots') {
		if (activeTab === tab) return;
		activeTab = tab;
		// Gọi 1 lần đầu tiên khi tab chưa từng load
		if (tab === 'stock' && !stockLoadedOnce) void loadStock();
		if (tab === 'lots' && !lotsLoadedOnce) void loadLots();
	}

	async function refresh() {
		if (activeTab === 'stock') await loadStock();
		else await loadLots();
	}

	// ── Phân trang / filter ──
	// Pagination element bind:page — mỗi tab có trang riêng; state trung gian
	// currentPagingPage + effect armed-guard sync theo activeTab (pattern suppliers)
	let currentPagingPage = $state(1);
	let pagingArmed = $state(false);

	$effect(() => {
		// Theo dõi tab + trang riêng của tab → sync currentPagingPage khi đổi tab
		void activeTab;
		void stockPage;
		void lotsPage;
		currentPagingPage = activeTab === 'stock' ? stockPage : lotsPage;
	});

	$effect(() => {
		void currentPagingPage;
		if (!pagingArmed) {
			pagingArmed = true;
			return;
		}
		// User bấm Pagination → đẩy về trang tab đang mở (nếu khác mới load)
		if (activeTab === 'stock') {
			if (currentPagingPage !== stockPage && !stockLoading) {
				stockPage = currentPagingPage;
				void loadStock();
			}
		} else {
			if (currentPagingPage !== lotsPage && !lotsLoading) {
				lotsPage = currentPagingPage;
				void loadLots();
			}
		}
	});

	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === currentPage) return;
		if (activeTab === 'stock') {
			if (stockLoading) return;
			stockPage = target;
			await loadStock();
		} else {
			if (lotsLoading) return;
			lotsPage = target;
			await loadLots();
		}
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		stockPage = 1;
		lotsPage = 1;
		if (activeTab === 'stock') await loadStock();
		else await loadLots();
	}

	async function onFilterChange() {
		stockPage = 1;
		lotsPage = 1;
		await refresh();
	}

	// ---------- DataTable ----------
	const stockAny = $derived(stock as unknown as Record<string, unknown>[]);
	const lotsAny = $derived(lots as unknown as Record<string, unknown>[]);
	const stockColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'variant',
			label: pageContents.stockTable.variant[lang],
			sortable: true,
			accessor: (row) => getVariantLabel((row as unknown as StockRow).variantId)
		},
		{
			id: 'branch',
			label: pageContents.stockTable.branch[lang],
			accessor: (row) => getBranchLabel((row as unknown as StockRow).branchId),
			noHighlight: true
		},
		{
			id: 'onHand',
			label: pageContents.stockTable.onHand[lang],
			sortable: true,
			accessor: (row) => String((row as unknown as StockRow).quantityOnHand ?? 0),
			noHighlight: true
		},
		{
			id: 'reserved',
			label: pageContents.stockTable.reserved[lang],
			sortable: true,
			accessor: (row) => String((row as unknown as StockRow).quantityReserved ?? 0),
			noHighlight: true
		},
		{
			id: 'updated',
			label: pageContents.stockTable.updated[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as StockRow).updatedAt),
			noHighlight: true
		}
	]);
	const lotColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'lotNumber',
			label: pageContents.lotsTable.lotNumber[lang],
			sortable: true,
			accessor: (row) => (row as unknown as LotRow).lotNumber ?? '—'
		},
		{
			id: 'variant',
			label: pageContents.lotsTable.variant[lang],
			sortable: true,
			accessor: (row) => getVariantLabel((row as unknown as LotRow).variantId)
		},
		{
			id: 'branch',
			label: pageContents.lotsTable.branch[lang],
			accessor: (row) => getBranchLabel((row as unknown as LotRow).branchId),
			noHighlight: true
		},
		{
			id: 'quantity',
			label: pageContents.lotsTable.quantity[lang],
			sortable: true,
			accessor: (row) => String((row as unknown as LotRow).quantityOnHand ?? 0),
			noHighlight: true
		},
		{
			id: 'expires',
			label: pageContents.lotsTable.expires[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as LotRow).expiresAt),
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.lotsTable.status[lang],
			sortable: true,
			accessor: (row) => lotStatusLabel((row as unknown as LotRow).status),
			status: (_v, row) => lotStatusColor((row as unknown as LotRow).status)
		}
	]);

	// ── Modal điều chỉnh tồn kho ──
	function openAdjustModal(row: StockRow) {
		adjustRow = row;
		adjustChange = 0;
		adjustNote = '';
		adjustError = undefined;
		adjustModalDisplay = true;
	}

	async function confirmAdjust() {
		if (!adjustRow || adjustBusy || !encryptionKeys) return;
		if (!Number.isFinite(adjustChange) || adjustChange === 0) {
			adjustError =
				lang === 'vi' ? 'Số thay đổi phải khác 0' : 'Change must be non-zero';
			return;
		}
		adjustBusy = true;
		adjustError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/stock/adjust',
				{
					method: 'POST',
					body: {
						variantId: adjustRow.variantId,
						branchId: adjustRow.branchId,
						change: Number(adjustChange),
						note: adjustNote.trim() || undefined
					}
				},
				encryptionKeys
			);
			adjustBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.adjusted)
						: pageContents.toasts.adjusted[lang],
					'success'
				);
				adjustModalDisplay = false;
				await loadStock();
			} else {
				adjustError = resolveServerMessage(response.message, lang, pageContents.toasts.adjustFailed);
			}
		} catch (err) {
			adjustBusy = false;
			adjustError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/inventory] adjust failed:', err);
		}
	}

	// ── Modal tạo lô ──
	function openLotModal() {
		lotForm = {
			variantId: variantFilter || '',
			branchId: branchFilter || '',
			lotNumber: '',
			quantityOnHand: 0,
			manufacturedAt: '',
			expiresAt: '',
			supplierId: '',
			status: 'active'
		};
		lotError = undefined;
		lotModalDisplay = true;
		void loadVariantOptions();
	}

	function validateLotForm(): string | undefined {
		if (!lotForm.variantId) {
			return lang === 'vi' ? 'Vui lòng chọn sản phẩm' : 'Please select a variant';
		}
		if (!lotForm.branchId) {
			return lang === 'vi' ? 'Vui lòng chọn chi nhánh' : 'Please select a branch';
		}
		if (!lotForm.lotNumber.trim()) {
			return lang === 'vi' ? 'Vui lòng nhập số lô' : 'Please enter a lot number';
		}
		if (!Number.isFinite(lotForm.quantityOnHand) || lotForm.quantityOnHand < 0) {
			return lang === 'vi' ? 'Số lượng phải là số không âm' : 'Quantity must be a non-negative number';
		}
		return undefined;
	}

	async function submitLot() {
		if (lotSubmitting || !encryptionKeys) return;

		const validationError = validateLotForm();
		if (validationError) {
			lotError = validationError;
			return;
		}

		lotError = undefined;
		lotSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/lots/create',
				{
					method: 'POST',
					body: {
						variantId: lotForm.variantId,
						branchId: lotForm.branchId,
						lotNumber: lotForm.lotNumber.trim(),
						quantityOnHand: Number(lotForm.quantityOnHand),
						manufacturedAt: lotForm.manufacturedAt || undefined,
						expiresAt: lotForm.expiresAt || undefined,
						receivedAt: new Date().toISOString(),
						supplierId: lotForm.supplierId.trim() || undefined,
						status: lotForm.status
					}
				},
				encryptionKeys
			);
			lotSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.lotCreated)
						: pageContents.toasts.lotCreated[lang],
					'success'
				);
				lotModalDisplay = false;
				await loadLots();
			} else {
				lotError = resolveServerMessage(response.message, lang, pageContents.toasts.lotFailed);
			}
		} catch (err) {
			lotSubmitting = false;
			lotError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/inventory] create lot failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadVariantOptions(), loadStock()]);
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
			{#if activeTab === 'lots'}
				<Button color="success" onClick={openLotModal}>{pageContents.actions.createLot[lang]}</Button>
			{/if}
		</div>
	</header>

	<!-- ── Tab stock / lots ── -->
	<div class="tab-strip" role="tablist">
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'stock'}
			role="tab"
			aria-selected={activeTab === 'stock'}
			onclick={() => switchTab('stock')}
		>
			{pageContents.tabs.stock[lang]}
		</button>
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'lots'}
			role="tab"
			aria-selected={activeTab === 'lots'}
			onclick={() => switchTab('lots')}
		>
			{pageContents.tabs.lots[lang]}
		</button>
	</div>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select
			class="admin-select"
			bind:value={branchFilter}
			onchange={onFilterChange}
			aria-label={pageContents.stockTable.branch[lang]}
		>
			<option value="">{pageContents.filters.allBranches[lang]}</option>
			{#each branches as branch (branch._id)}
				<option value={branch._id}>{branch.name ?? branch._id}</option>
			{/each}
		</select>
		<input
			class="admin-input filter-variant"
			type="text"
			bind:value={variantFilter}
			placeholder={pageContents.filters.variantSearch[lang]}
			aria-label={pageContents.filters.variantSearch[lang]}
		/>
		{#if activeTab === 'stock'}
			<label class="filter-checkbox">
				<input type="checkbox" bind:checked={includeZero} onchange={onFilterChange} />
				{pageContents.filters.includeZero[lang]}
			</label>
		{:else}
			<select
				class="admin-select"
				bind:value={lotStatusFilter}
				onchange={onFilterChange}
				aria-label={pageContents.lotsTable.status[lang]}
			>
				<option value="">{pageContents.filters.allStatuses[lang]}</option>
				{#each LOT_STATUSES as status (status)}
					<option value={status}>{lotStatusLabel(status)}</option>
				{/each}
			</select>
		{/if}
		<Button color="default" variant="outline" size="sm" onClick={refresh}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	<!-- ── Tab STOCK — DataTable (component có sẵn) ──
	     Server-side paging: paging trong DataTable TẮT, footer Pagination điều khiển server. -->
	{#if activeTab === 'stock'}
		{#if stockError}
			<div class="admin-state error" role="alert">
				<p class="state-title">{pageContents.states.errorTitleStock[lang]}</p>
				<p class="state-detail">{stockError}</p>
				<Button color="primary" variant="outline" onClick={loadStock}>{pageContents.states.retry[lang]}</Button>
			</div>
		{:else}
			<div class="admin-table-wrap">
				<DataTable
					data={stockAny}
					columns={stockColumns}
					pageSize={pageSize}
					showPagination={false}
					sortable
					searchable
					searchPlaceholder={{ vi: 'Tìm tồn kho…', en: 'Search stock…' }}
					resizable={{ enabled: true, fit: true }}
					loading={stockLoading && !stockLoadedOnce}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.emptyStock[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					caption={{ vi: 'Tồn kho theo biến thể', en: 'Stock by variant' }}
					actionsLabel={pageContents.stockTable.actions[lang]}
					stickyHead
					data-test="inventory-stock-datatable"
				>
					{#snippet actionsContent(row)}
						{@const r = row as unknown as StockRow}
						<div class="row-actions">
							<!-- update/edit = primary -->
							<Button color="primary" variant="ghost" size="sm" onClick={() => openAdjustModal(r)}>
								{pageContents.actions.adjust[lang]}
							</Button>
						</div>
					{/snippet}
				</DataTable>
			</div>
		{/if}
	{:else}
		<!-- ── Tab LOTS — DataTable ── -->
		{#if lotsError}
			<div class="admin-state error" role="alert">
				<p class="state-title">{pageContents.states.errorTitleLots[lang]}</p>
				<p class="state-detail">{lotsError}</p>
				<Button color="primary" variant="outline" onClick={loadLots}>{pageContents.states.retry[lang]}</Button>
			</div>
		{:else}
			<div class="admin-table-wrap">
				<DataTable
					data={lotsAny}
					columns={lotColumns}
					pageSize={pageSize}
					showPagination={false}
					sortable
					searchable
					searchPlaceholder={{ vi: 'Tìm lô hàng…', en: 'Search lots…' }}
					resizable={{ enabled: true, fit: true }}
					loading={lotsLoading && !lotsLoadedOnce}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.emptyLots[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					caption={{ vi: 'Danh sách lô hàng', en: 'Lots list' }}
					stickyHead
					data-test="inventory-lots-datatable"
				/>
			</div>
		{/if}
	{/if}

	<!-- ── Phân trang (server-side, shared giữa 2 tab) ── -->
	<footer class="admin-pagination">
		<span class="total-count">{totalCountText}</span>
		<div class="page-controls">
			<Pagination
				bind:page={currentPagingPage}
				totalPages={totalPages}
				loading={activeTab === 'stock' ? stockLoading : lotsLoading}
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

<!-- ── Modal điều chỉnh tồn kho ── -->
{#if adjustModalDisplay}
	<Modal bind:display={adjustModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.adjustModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">{pageContents.adjustModal.intro[lang]}</p>
				<p class="modal-intro">
					<strong>{getVariantLabel(adjustRow?.variantId)}</strong>
					— {getBranchLabel(adjustRow?.branchId)}
					({adjustRow?.quantityOnHand ?? 0})
				</p>
				{#if adjustError}
					<div class="form-error-banner" role="alert">{adjustError}</div>
				{/if}
				<label class="form-field">
					<span class="form-label">{pageContents.adjustModal.change[lang]}</span>
					<input class="admin-input" type="number" step="1" bind:value={adjustChange} disabled={adjustBusy} />
				</label>
				<label class="form-field">
					<span class="form-label">{pageContents.adjustModal.note[lang]}</span>
					<input class="admin-input" type="text" bind:value={adjustNote} disabled={adjustBusy} />
				</label>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- update/edit = primary -->
				<Button color="primary" onClick={confirmAdjust} loading={adjustBusy}>
					{pageContents.adjustModal.confirm[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						adjustModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal tạo lô hàng ── -->
{#if lotModalDisplay}
	<Modal bind:display={lotModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.lotModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if lotError}
					<div class="form-error-banner" role="alert">{lotError}</div>
				{/if}
				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.lotModal.variant[lang]}</span>
						<select class="admin-select" bind:value={lotForm.variantId} disabled={lotSubmitting}>
							<option value="" disabled>{pageContents.lotModal.variantPlaceholder[lang]}</option>
							{#each variantOptions as variant (variant._id)}
								<option value={variant._id}>
									{variant.sku ? `${variant.sku} — ${variant.displayName ?? ''}` : (variant.displayName ?? variant._id)}
								</option>
							{/each}
						</select>
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.lotModal.branch[lang]}</span>
						{#if branches.length > 0}
							<select class="admin-select" bind:value={lotForm.branchId} disabled={lotSubmitting}>
								<option value="" disabled>{pageContents.lotModal.branchPlaceholder[lang]}</option>
								{#each branches as branch (branch._id)}
									<option value={branch._id}>{branch.name ?? branch._id}</option>
								{/each}
							</select>
						{:else}
							<input class="admin-input" type="text" bind:value={lotForm.branchId} disabled={lotSubmitting} />
						{/if}
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.lotModal.lotNumber[lang]}</span>
						<input class="admin-input" type="text" bind:value={lotForm.lotNumber} disabled={lotSubmitting} />
					</label>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.lotModal.quantity[lang]}</span>
							<input class="admin-input" type="number" min="0" step="1" bind:value={lotForm.quantityOnHand} disabled={lotSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.lotModal.status[lang]}</span>
							<select class="admin-select" bind:value={lotForm.status} disabled={lotSubmitting}>
								{#each LOT_STATUSES as status (status)}
									<option value={status}>{lotStatusLabel(status)}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.lotModal.manufacturedAt[lang]}</span>
							<input class="admin-input" type="date" bind:value={lotForm.manufacturedAt} disabled={lotSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.lotModal.expiresAt[lang]}</span>
							<input class="admin-input" type="date" bind:value={lotForm.expiresAt} disabled={lotSubmitting} />
						</label>
					</div>
					<label class="form-field">
						<span class="form-label">{pageContents.lotModal.supplierId[lang]}</span>
						<input class="admin-input" type="text" bind:value={lotForm.supplierId} disabled={lotSubmitting} />
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitLot} loading={lotSubmitting} disabled={lotSubmitting}>
					{pageContents.lotModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={lotSubmitting}
					onClick={() => {
						lotModalDisplay = false;
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

	.tab-strip {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--default-200);
	}

	.tab-item {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		border: none;
		background: transparent;
		color: var(--foreground-500);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;

		&.active {
			color: var(--foreground);
			font-weight: 600;
			border-bottom-color: var(--primary);
		}

		&:hover {
			color: var(--foreground);
		}
	}

	.admin-filters {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.filter-variant {
		max-width: 18rem;
	}

	.filter-checkbox {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--foreground);
		cursor: pointer;
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
		   theo wrap (khong cuon) -> thead truot mat. Co stickyHead: wrap phai
		   thoat scroll context (beng ngang do .datatable-table-wrap tu cuon). */
		&:has(:global(.datatable-sticky-head)) {
			overflow-x: visible;
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
