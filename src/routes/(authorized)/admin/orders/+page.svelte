<!-- src/routes/(authorized)/admin/orders/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolveServerMessage } from '../_interface';

	interface OrderItem {
		variantId: string;
		lotId?: string | null;
		quantity: number;
		price: number;
	}

	interface OrderRow {
		_id?: string;
		orderCode?: string;
		customerId?: string | null;
		staffId?: string | null;
		branchId?: string | null;
		status?: string;
		items?: OrderItem[];
		totalAmount?: number;
		createdAt?: string | null;
		updatedAt?: string | null;
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
		price?: number;
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

	// ── Nội dung song ngữ ──
	// { [k: string]: any } — cùng pattern trang users: lang là union type rộng nên
	// phải index bằng chuỗi thay vì khoá literal.
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Đơn hàng', en: 'Orders' },
		subtitle: {
			vi: 'Quản lý đơn hàng theo chi nhánh — tạo, cập nhật trạng thái, huỷ đơn',
			en: 'Manage orders per branch — create, update status, cancel'
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
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' }
		},
		table: {
			orderCode: { vi: 'Mã đơn hàng', en: 'Order code' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			status: { vi: 'Trạng thái', en: 'Status' },
			items: { vi: 'Số mặt hàng', en: 'Items' },
			total: { vi: 'Tổng tiền', en: 'Total' },
			created: { vi: 'Ngày tạo', en: 'Created' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		statuses: {
			pending: { vi: 'Chờ xử lý', en: 'Pending' },
			paid: { vi: 'Đã thanh toán', en: 'Paid' },
			fulfilled: { vi: 'Hoàn tất', en: 'Fulfilled' },
			cancelled: { vi: 'Đã huỷ', en: 'Cancelled' },
			returned: { vi: 'Đã trả hàng', en: 'Returned' }
		},
		actions: {
			detail: { vi: 'Chi tiết', en: 'Detail' },
			updateStatus: { vi: 'Trạng thái', en: 'Status' },
			cancel: { vi: 'Huỷ đơn', en: 'Cancel' },
			create: { vi: 'Tạo đơn hàng', en: 'Create order' }
		},
		states: {
			loading: { vi: 'Đang tải đơn hàng…', en: 'Loading orders…' },
			errorTitle: { vi: 'Không tải được danh sách đơn hàng', en: 'Failed to load orders' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có đơn hàng nào', en: 'No orders yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			pageInfo: { vi: 'Trang {page}/{total}', en: 'Page {page}/{total}' },
			totalCount: { vi: '{total} đơn hàng', en: '{total} orders' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		createModal: {
			title: { vi: 'Tạo đơn hàng', en: 'Create order' },
			orderCode: { vi: 'Mã đơn hàng', en: 'Order code' },
			orderCodePlaceholder: { vi: 'VD: ORD-2026-0001', en: 'e.g. ORD-2026-0001' },
			customerId: { vi: 'Mã khách hàng (tuỳ chọn)', en: 'Customer id (optional)' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			branchPlaceholder: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			items: { vi: 'Mặt hàng', en: 'Items' },
			variantPlaceholder: { vi: 'Chọn sản phẩm', en: 'Select a variant' },
			quantity: { vi: 'SL', en: 'Qty' },
			price: { vi: 'Đơn giá', en: 'Price' },
			addItem: { vi: 'Thêm mặt hàng', en: 'Add item' },
			totalLabel: { vi: 'Tạm tính:', en: 'Subtotal:' },
			submit: { vi: 'Tạo đơn', en: 'Create' }
		},
		statusModal: {
			title: { vi: 'Cập nhật trạng thái', en: 'Update status' },
			intro: { vi: 'Chọn trạng thái mới cho đơn hàng này.', en: 'Choose a new status for this order.' },
			confirm: { vi: 'Xác nhận', en: 'Confirm' }
		},
		cancelModal: {
			title: { vi: 'Huỷ đơn hàng', en: 'Cancel order' },
			intro: {
				vi: 'Huỷ đơn sẽ hoàn lại số lượng vào tồn kho. Chỉ đơn ở trạng thái "Chờ xử lý" mới huỷ được.',
				en: 'Cancelling returns quantities to stock. Only pending orders can be cancelled.'
			},
			confirm: { vi: 'Huỷ đơn hàng', en: 'Cancel order' }
		},
		detailModal: {
			title: { vi: 'Chi tiết đơn hàng', en: 'Order detail' },
			items: { vi: 'Mặt hàng', en: 'Items' },
			variant: { vi: 'Sản phẩm', en: 'Variant' },
			quantity: { vi: 'SL', en: 'Qty' },
			price: { vi: 'Đơn giá', en: 'Price' },
			subtotal: { vi: 'Thành tiền', en: 'Subtotal' },
			customer: { vi: 'Khách hàng', en: 'Customer' },
			staff: { vi: 'Nhân viên', en: 'Staff' },
			notFound: { vi: 'Không tải được chi tiết đơn hàng', en: 'Failed to load order detail' }
		},
		toasts: {
			created: { vi: 'Đã tạo đơn hàng', en: 'Order created' },
			statusUpdated: { vi: 'Đã cập nhật trạng thái', en: 'Status updated' },
			cancelled: { vi: 'Đã huỷ đơn hàng', en: 'Order cancelled' },
			createFailed: { vi: 'Tạo đơn hàng không thành công', en: 'Failed to create order' },
			actionFailed: { vi: 'Thao tác không thành công', en: 'Action failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// pathname ép về string: các route phase 4 chưa tồn tại hết trong RouteId
	// tại thời điểm trang đầu tiên → literal comparison báo 'no overlap'.
	const currentPath = $derived(page.url.pathname as string);

	// ── Danh mục ──
	const ORDER_STATUSES = ['pending', 'paid', 'fulfilled', 'cancelled', 'returned'] as const;
	type OrderStatus = (typeof ORDER_STATUSES)[number];

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): string {
		switch (status) {
			case 'paid':
			case 'fulfilled':
				return 'success';
			case 'pending':
				return 'warning';
			case 'cancelled':
				return 'error';
			default:
				return 'default';
		}
	}

	// ── Trạng thái danh sách ──
	let orders = $state<OrderRow[]>([]);
	let total = $state(0);
	let pageNum = $state(1);
	let pageSize = $state(20);
	let statusFilter = $state('');
	let branchFilter = $state('');
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);

	// ── Danh mục chi nhánh ──
	let branches = $state<BranchOption[]>([]);

	// ── Modal tạo đơn ──
	let createModalDisplay = $state(false);
	let createSubmitting = $state(false);
	let createError = $state<string | undefined>(undefined);
	let createForm = $state<{ orderCode: string; customerId: string; branchId: string }>({
		orderCode: '',
		customerId: '',
		branchId: ''
	});
	let createItems = $state<Array<{ variantId: string; quantity: number; price: number }>>([
		{ variantId: '', quantity: 1, price: 0 }
	]);
	let variantOptions = $state<VariantOption[]>([]);
	let variantOptionsLoading = $state(false);
	const createTotal = $derived(
		createItems.reduce(
			(sum, item) => (item.variantId && Number(item.quantity) > 0 ? sum + Number(item.quantity) * Number(item.price) : sum),
			0
		)
	);

	// ── Modal cập nhật trạng thái ──
	let statusModalDisplay = $state(false);
	let statusModalOrder = $state<OrderRow | null>(null);
	let statusModalValue = $state<string>('pending');
	let statusModalBusy = $state(false);

	// ── Modal huỷ đơn ──
	let cancelModalDisplay = $state(false);
	let cancelModalOrder = $state<OrderRow | null>(null);
	let cancelModalBusy = $state(false);

	// ── Modal chi tiết ──
	let detailModalDisplay = $state(false);
	let detailModalLoading = $state(false);
	let detailModalError = $state<string | undefined>(undefined);
	let detailOrder = $state<OrderRow | null>(null);

	// ── Derived ──
	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	const pageInfoText = $derived(
		pageContents.pagination.pageInfo[lang].replace('{page}', String(pageNum)).replace('{total}', String(totalPages))
	);
	const totalCountText = $derived(
		pageContents.pagination.totalCount[lang].replace('{total}', String(total))
	);

	function getBranchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const branch = branches.find((b) => b._id === branchId);
		return branch?.name ?? branchId;
	}

	function formatDate(raw?: string | Date | null): string {
		if (!raw) return '—';
		try {
			const date = typeof raw === 'string' ? new Date(raw) : raw;
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit'
			}).format(date);
		} catch {
			return '—';
		}
	}

	function formatMoney(value?: number | null): string {
		if (value == null) return '—';
		try {
			return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				style: 'currency',
				currency: 'VND',
				maximumFractionDigits: 0
			}).format(value);
		} catch {
			return String(value);
		}
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
				const data = response.data as BranchOption[] | undefined;
				branches = data ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/orders] load branches failed:', err);
		}
	}

	async function loadOrders() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/orders/list',
				{
					method: 'POST',
					body: {
						page: pageNum,
						pageSize,
						status: statusFilter || undefined,
						branchId: branchFilter || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: OrderRow[]; total?: number; page?: number; pageSize?: number }
					| undefined;
				orders = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNum = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/orders] load orders failed:', err);
		}
	}

	async function refresh() {
		await loadOrders();
	}

	/** Gọi 1 thao tác đổi trạng thái/huỷ — trả true nếu thành công */
	async function runAction(
		url: string,
		body: Record<string, unknown>,
		successFallback: { vi: string; en: string }
	): Promise<boolean> {
		if (!encryptionKeys) return false;
		try {
			const response = await encryption.fetchSecure(url, { method: 'POST', body }, encryptionKeys);
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, successFallback)
						: lang === 'vi'
							? successFallback.vi
							: successFallback.en,
					'success'
				);
				return true;
			}
			showToast(
				resolveServerMessage(response.message, lang, pageContents.toasts.actionFailed),
				'error'
			);
			return false;
		} catch (err) {
			if (import.meta.env.DEV) console.error(`[admin/orders] ${url} failed:`, err);
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			return false;
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
				const data = response.data as { items?: VariantOption[] } | undefined;
				variantOptions = data?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/orders] load variants failed:', err);
		}
		variantOptionsLoading = false;
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNum || loading) return;
		pageNum = target;
		await loadOrders();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		pageNum = 1;
		await loadOrders();
	}

	async function onFilterChange() {
		pageNum = 1;
		await loadOrders();
	}

	// ── Modal tạo đơn ──
	function openCreateModal() {
		createForm = { orderCode: '', customerId: '', branchId: branchFilter || '' };
		createItems = [{ variantId: '', quantity: 1, price: 0 }];
		createError = undefined;
		createModalDisplay = true;
		void loadVariantOptions();
	}

	function addCreateItem() {
		createItems = [...createItems, { variantId: '', quantity: 1, price: 0 }];
	}

	function removeCreateItem(index: number) {
		if (createItems.length <= 1) {
			createItems = [{ variantId: '', quantity: 1, price: 0 }];
			return;
		}
		createItems = createItems.filter((_, i) => i !== index);
	}

	function onVariantSelected(item: { variantId: string; price: number }) {
		const variant = variantOptions.find((v) => v._id === item.variantId);
		if (variant?.price != null) item.price = variant.price;
	}

	function validateCreateForm(): string | undefined {
		if (!createForm.orderCode.trim()) {
			return lang === 'vi' ? 'Vui lòng nhập mã đơn hàng' : 'Please enter an order code';
		}
		if (!createForm.branchId.trim()) {
			return lang === 'vi' ? 'Vui lòng chọn chi nhánh' : 'Please select a branch';
		}
		const validItems = createItems.filter((item) => item.variantId && Number(item.quantity) > 0);
		if (validItems.length === 0) {
			return lang === 'vi'
				? 'Cần ít nhất 1 mặt hàng hợp lệ (đã chọn sản phẩm và số lượng > 0)'
				: 'At least 1 valid item is required (variant selected and quantity > 0)';
		}
		return undefined;
	}

	async function submitCreate() {
		if (createSubmitting || !encryptionKeys) return;

		const validationError = validateCreateForm();
		if (validationError) {
			createError = validationError;
			return;
		}

		createError = undefined;
		createSubmitting = true;
		const items = createItems
			.filter((item) => item.variantId && Number(item.quantity) > 0)
			.map((item) => ({ variantId: item.variantId, quantity: Number(item.quantity), price: Number(item.price) || 0 }));
		const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

		try {
			const response = await encryption.fetchSecure(
				'/api/admin/orders/create',
				{
					method: 'POST',
					body: {
						orderCode: createForm.orderCode.trim(),
						customerId: createForm.customerId.trim() || undefined,
						branchId: createForm.branchId,
						items,
						totalAmount
					}
				},
				encryptionKeys
			);
			createSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.created)
						: pageContents.toasts.created[lang],
					'success'
				);
				createModalDisplay = false;
				await loadOrders();
			} else {
				createError = resolveServerMessage(response.message, lang, pageContents.toasts.createFailed);
			}
		} catch (err) {
			createSubmitting = false;
			createError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/orders] create failed:', err);
		}
	}

	// ── Modal trạng thái / huỷ / chi tiết ──
	function openStatusModal(row: OrderRow) {
		statusModalOrder = row;
		statusModalValue = ORDER_STATUSES.includes((row.status ?? '') as OrderStatus)
			? (row.status as OrderStatus)
			: 'pending';
		statusModalDisplay = true;
	}

	async function confirmStatusChange() {
		if (!statusModalOrder || statusModalBusy) return;
		statusModalBusy = true;
		const ok = await runAction(
			'/api/admin/orders/update-status',
			{ orderId: statusModalOrder._id, status: statusModalValue },
			pageContents.toasts.statusUpdated
		);
		statusModalBusy = false;
		if (ok) {
			statusModalDisplay = false;
			await refresh();
		}
	}

	function openCancelModal(row: OrderRow) {
		cancelModalOrder = row;
		cancelModalDisplay = true;
	}

	async function confirmCancel() {
		if (!cancelModalOrder || cancelModalBusy) return;
		cancelModalBusy = true;
		const ok = await runAction(
			'/api/admin/orders/cancel',
			{ orderId: cancelModalOrder._id },
			pageContents.toasts.cancelled
		);
		cancelModalBusy = false;
		if (ok) {
			cancelModalDisplay = false;
			await refresh();
		}
	}

	async function openDetailModal(row: OrderRow) {
		detailOrder = null;
		detailModalError = undefined;
		detailModalDisplay = true;
		detailModalLoading = true;
		if (!encryptionKeys) {
			detailModalLoading = false;
			detailModalError = pageContents.detailModal.notFound[lang];
			return;
		}
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/orders/get',
				{ method: 'POST', body: { orderId: row._id } },
				encryptionKeys
			);
			if (response.ok) {
				detailOrder = (response.data as OrderRow | undefined) ?? null;
			} else {
				detailModalError = resolveServerMessage(response.message, lang, pageContents.detailModal.notFound);
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/orders] detail failed:', err);
			detailModalError = resolveServerMessage(undefined, lang, pageContents.detailModal.notFound);
		}
		detailModalLoading = false;
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadOrders()]);
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page">
	<!-- ── Nav liên kết nhanh giữa các trang quản trị ── -->
	<!-- pathname ép về string: các route phase 4 chưa tồn tại hết trong RouteId
	     tại thời điểm trang đầu tiên → literal comparison báo 'no overlap'. -->
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
		<select
			class="admin-select"
			bind:value={statusFilter}
			onchange={onFilterChange}
			aria-label={pageContents.table.status[lang]}
		>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each ORDER_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<select
			class="admin-select"
			bind:value={branchFilter}
			onchange={onFilterChange}
			aria-label={pageContents.table.branch[lang]}
		>
			<option value="">{pageContents.filters.allBranches[lang]}</option>
			{#each branches as branch (branch._id)}
				<option value={branch._id}>{branch.name ?? branch._id}</option>
			{/each}
		</select>
	</div>

	<!-- ── Trạng thái loading ── -->
	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={refresh}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if orders.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<!-- ── Bảng đơn hàng (HTML thuần — theo pattern trang users) ── -->
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.orderCode[lang]}</th>
						<th scope="col">{pageContents.table.branch[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.items[lang]}</th>
						<th scope="col">{pageContents.table.total[lang]}</th>
						<th scope="col">{pageContents.table.created[lang]}</th>
						<th scope="col" class="col-actions">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each orders as row (row._id ?? row.orderCode)}
						<tr>
							<td class="col-code">{row.orderCode ?? '—'}</td>
							<td>{getBranchLabel(row.branchId)}</td>
							<td class="col-status">
								<span class="status-badge status-{statusColor(row.status)}">{statusLabel(row.status)}</span>
							</td>
							<td>{row.items?.length ?? 0}</td>
							<td class="col-money">{formatMoney(row.totalAmount)}</td>
							<td>{formatDate(row.createdAt)}</td>
							<td class="col-actions">
								<div class="row-actions">
									<Button color="default" variant="ghost" size="sm" onClick={() => openDetailModal(row)}>
										{pageContents.actions.detail[lang]}
									</Button>
									<!-- update/edit = primary -->
									<Button color="primary" variant="ghost" size="sm" onClick={() => openStatusModal(row)}>
										{pageContents.actions.updateStatus[lang]}
									</Button>
									{#if row.status === 'pending'}
										<!-- delete/remove = error -->
										<Button color="error" variant="ghost" size="sm" onClick={() => openCancelModal(row)}>
											{pageContents.actions.cancel[lang]}
										</Button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- ── Phân trang ── -->
		<footer class="admin-pagination">
			<span class="total-count">{totalCountText}</span>
			<div class="page-controls">
				<Button
					color="default"
					variant="outline"
					size="sm"
					disabled={pageNum <= 1 || loading}
					onClick={() => goToPage(pageNum - 1)}
				>
					{pageContents.pagination.prev[lang]}
				</Button>
				<span class="page-info">{pageInfoText}</span>
				<Button
					color="default"
					variant="outline"
					size="sm"
					disabled={pageNum >= totalPages || loading}
					onClick={() => goToPage(pageNum + 1)}
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
	{/if}
</section>

<!-- ── Modal tạo đơn hàng ── -->
{#if createModalDisplay}
	<Modal bind:display={createModalDisplay} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.createModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if createError}
					<div class="form-error-banner" role="alert">{createError}</div>
				{/if}

				<div class="form-grid">
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.orderCode[lang]}</span>
						<input
							class="admin-input"
							type="text"
							bind:value={createForm.orderCode}
							placeholder={pageContents.createModal.orderCodePlaceholder[lang]}
							disabled={createSubmitting}
						/>
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.customerId[lang]}</span>
						<input
							class="admin-input"
							type="text"
							bind:value={createForm.customerId}
							disabled={createSubmitting}
						/>
					</label>
					<label class="form-field">
						<span class="form-label">{pageContents.createModal.branch[lang]}</span>
						{#if branches.length > 0}
							<select class="admin-select" bind:value={createForm.branchId} disabled={createSubmitting}>
								<option value="" disabled>{pageContents.createModal.branchPlaceholder[lang]}</option>
								{#each branches as branch (branch._id)}
									<option value={branch._id}>{branch.name ?? branch._id}</option>
								{/each}
							</select>
						{:else}
							<input
								class="admin-input"
								type="text"
								bind:value={createForm.branchId}
								placeholder={pageContents.createModal.branchPlaceholder[lang]}
								disabled={createSubmitting}
							/>
						{/if}
					</label>
				</div>

				<div class="items-editor">
					<p class="items-editor-title">{pageContents.createModal.items[lang]}</p>
					{#each createItems as item, index (index)}
						<div class="item-row">
							<select
								class="admin-select item-variant"
								bind:value={item.variantId}
								onchange={() => onVariantSelected(item)}
								disabled={createSubmitting || variantOptionsLoading}
								aria-label={pageContents.createModal.variantPlaceholder[lang]}
							>
								<option value="" disabled>
									{variantOptionsLoading
										? pageContents.states.loading[lang]
										: pageContents.createModal.variantPlaceholder[lang]}
								</option>
								{#each variantOptions as variant (variant._id)}
									<option value={variant._id}>
										{variant.sku ? `${variant.sku} — ${variant.displayName ?? ''}` : (variant.displayName ?? variant._id)}
									</option>
								{/each}
							</select>
							<input
								class="admin-input item-qty"
								type="number"
								min="1"
								step="1"
								bind:value={item.quantity}
								aria-label={pageContents.createModal.quantity[lang]}
								disabled={createSubmitting}
							/>
							<input
								class="admin-input item-price"
								type="number"
								min="0"
								step="1000"
								bind:value={item.price}
								aria-label={pageContents.createModal.price[lang]}
								disabled={createSubmitting}
							/>
							<!-- remove = error -->
							<Button
								color="error"
								variant="ghost"
								size="sm"
								onClick={() => removeCreateItem(index)}
								disabled={createSubmitting}
							>
								✕
							</Button>
						</div>
					{/each}
					<div class="items-editor-footer">
						<Button color="default" variant="outline" size="sm" onClick={addCreateItem} disabled={createSubmitting}>
							{pageContents.createModal.addItem[lang]}
						</Button>
						<span class="items-total">
							{pageContents.createModal.totalLabel[lang]}
							<strong>{formatMoney(createTotal)}</strong>
						</span>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitCreate} loading={createSubmitting} disabled={createSubmitting}>
					{pageContents.createModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={createSubmitting}
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

<!-- ── Modal cập nhật trạng thái ── -->
{#if statusModalDisplay}
	<Modal bind:display={statusModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.statusModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">
					{pageContents.statusModal.intro[lang]}
					<strong>{statusModalOrder?.orderCode ?? '—'}</strong>
				</p>
				<select class="admin-select" bind:value={statusModalValue} disabled={statusModalBusy}>
					{#each ORDER_STATUSES as status (status)}
						<option value={status}>{statusLabel(status)}</option>
					{/each}
				</select>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- update/edit = primary -->
				<Button color="primary" onClick={confirmStatusChange} loading={statusModalBusy}>
					{pageContents.statusModal.confirm[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						statusModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal huỷ đơn ── -->
{#if cancelModalDisplay}
	<Modal bind:display={cancelModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.cancelModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">{pageContents.cancelModal.intro[lang]}</p>
				<p class="modal-intro"><strong>{cancelModalOrder?.orderCode ?? '—'}</strong></p>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- delete/remove = error -->
				<Button color="error" onClick={confirmCancel} loading={cancelModalBusy}>
					{pageContents.cancelModal.confirm[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						cancelModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal chi tiết đơn ── -->
{#if detailModalDisplay}
	<Modal bind:display={detailModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.detailModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if detailModalLoading}
					<div class="admin-state" role="status">
						<p>{pageContents.states.loading[lang]}</p>
					</div>
				{:else if detailModalError}
					<div class="form-error-banner" role="alert">{detailModalError}</div>
				{:else if detailOrder}
					<p class="modal-intro detail-head">
						<strong>{detailOrder.orderCode ?? '—'}</strong>
						<span class="status-badge status-{statusColor(detailOrder.status)}">{statusLabel(detailOrder.status)}</span>
					</p>
					<dl class="detail-grid">
						<div>
							<dt>{pageContents.detailModal.customer[lang]}</dt>
							<dd>{detailOrder.customerId ?? '—'}</dd>
						</div>
						<div>
							<dt>{pageContents.detailModal.staff[lang]}</dt>
							<dd>{detailOrder.staffId ?? '—'}</dd>
						</div>
						<div>
							<dt>{pageContents.table.branch[lang]}</dt>
							<dd>{getBranchLabel(detailOrder.branchId)}</dd>
						</div>
						<div>
							<dt>{pageContents.table.created[lang]}</dt>
							<dd>{formatDate(detailOrder.createdAt)}</dd>
						</div>
					</dl>
					<table class="detail-items">
						<thead>
							<tr>
								<th scope="col">{pageContents.detailModal.variant[lang]}</th>
								<th scope="col">{pageContents.detailModal.quantity[lang]}</th>
								<th scope="col">{pageContents.detailModal.price[lang]}</th>
								<th scope="col">{pageContents.detailModal.subtotal[lang]}</th>
							</tr>
						</thead>
						<tbody>
							{#each detailOrder.items ?? [] as item, index (index)}
								<tr>
									<td class="detail-variant">{item.variantId}</td>
									<td>{item.quantity}</td>
									<td>{formatMoney(item.price)}</td>
									<td>{formatMoney(item.quantity * item.price)}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="3">{pageContents.table.total[lang]}</td>
								<td class="col-money">{formatMoney(detailOrder.totalAmount)}</td>
							</tr>
						</tfoot>
					</table>
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

	.col-money {
		font-variant-numeric: tabular-nums;
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
		margin-bottom: 1rem;
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

	.items-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		border-top: 1px solid var(--default-200);
		padding-top: 0.75rem;
	}

	.items-editor-title {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.item-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 4.5rem 7.5rem auto;
		gap: 0.5rem;
		align-items: center;
	}

	.item-variant {
		width: 100%;
		min-width: 0;
		text-overflow: ellipsis;
	}

	.item-qty,
	.item-price {
		min-width: 0;
	}

	.items-editor-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 0.25rem;
	}

	.items-total {
		font-size: 0.9rem;
		color: var(--foreground-500);

		strong {
			color: var(--foreground);
			font-variant-numeric: tabular-nums;
		}
	}

	.detail-head {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin: 0 0 1rem;

		dt {
			font-size: 0.75rem;
			text-transform: uppercase;
			color: var(--foreground-500);
		}

		dd {
			margin: 0.15rem 0 0;
			font-size: 0.9rem;
			color: var(--foreground);
			word-break: break-all;
		}
	}

	.detail-items {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;

		th,
		td {
			padding: 0.5rem 0.6rem;
			border-bottom: 1px solid var(--default-200);
			text-align: left;
		}

		th {
			font-size: 0.72rem;
			text-transform: uppercase;
			color: var(--foreground-500);
			background: var(--default-100);
		}

		tfoot td {
			font-weight: 700;
			border-bottom: none;
		}
	}

	.detail-variant {
		max-width: 16rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 680px) {
		.item-row {
			grid-template-columns: minmax(0, 1fr) 3.5rem 6rem auto;
		}

		.detail-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
