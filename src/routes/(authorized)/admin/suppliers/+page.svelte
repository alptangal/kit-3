<!-- src/routes/(authorized)/admin/suppliers/+page.svelte -->
<script lang="ts">
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { AddressInput, EmailInput, ImageUpload, Input, PhoneInput } from '$components/form';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDate as formatDateShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolveServerMessage } from '../_interface';

	interface SupplierRow {
		_id?: string;
		name?: string;
		contactPerson?: string | null;
		address?: string | null;
		status?: string;
		createdAt?: string | null;
	}

	interface PurchaseOrderRow {
		_id?: string;
		poCode?: string;
		supplierId?: string;
		branchId?: string;
		status?: string;
		totalCost?: number;
		expectedAt?: string | null;
		receivedAt?: string | null;
		createdAt?: string | null;
	}

	interface POItem {
		variantId: string;
		quantity: number;
		unitCost: number;
		lotNumber?: string;
		expiresAt?: string;
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

	// ── Nội dung song ngữ ──
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Nhà cung cấp', en: 'Suppliers' },
		subtitle: {
			vi: 'Quản lý nhà cung cấp và đơn mua hàng (purchase orders)',
			en: 'Manage suppliers and purchase orders'
		},
		tabs: {
			suppliers: { vi: 'Nhà cung cấp', en: 'Suppliers' },
			purchaseOrders: { vi: 'Đơn mua hàng', en: 'Purchase orders' }
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' },
			allSuppliers: { vi: 'Tất cả nhà cung cấp', en: 'All suppliers' }
		},
		supplierTable: {
			name: { vi: 'Tên', en: 'Name' },
			contact: { vi: 'Người liên hệ', en: 'Contact' },
			address: { vi: 'Địa chỉ', en: 'Address' },
			status: { vi: 'Trạng thái', en: 'Status' },
			createdAt: { vi: 'Tạo lúc', en: 'Created' }
		},
		poTable: {
			code: { vi: 'Mã PO', en: 'PO code' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			status: { vi: 'Trạng thái', en: 'Status' },
			totalCost: { vi: 'Tổng chi phí', en: 'Total cost' },
			expectedAt: { vi: 'Dự kiến nhận', en: 'Expected' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		poStatuses: {
			draft: { vi: 'Nháp', en: 'Draft' },
			ordered: { vi: 'Đã đặt', en: 'Ordered' },
			partially_received: { vi: 'Nhận một phần', en: 'Partially received' },
			received: { vi: 'Đã nhận', en: 'Received' },
			cancelled: { vi: 'Đã huỷ', en: 'Cancelled' }
		},
		actions: {
			createSupplier: { vi: 'Tạo nhà cung cấp', en: 'Create supplier' },
			createPO: { vi: 'Tạo đơn mua', en: 'Create PO' },
			updateStatus: { vi: 'Cập nhật trạng thái', en: 'Update status' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitleSuppliers: { vi: 'Không tải được nhà cung cấp', en: 'Failed to load suppliers' },
			errorTitlePOs: { vi: 'Không tải được đơn mua hàng', en: 'Failed to load purchase orders' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			emptySuppliers: { vi: 'Chưa có nhà cung cấp nào', en: 'No suppliers yet' },
			emptyPOs: { vi: 'Chưa có đơn mua hàng nào', en: 'No purchase orders yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCountSuppliers: { vi: '{total} nhà cung cấp', en: '{total} suppliers' },
			totalCountPOs: { vi: '{total} đơn mua hàng', en: '{total} purchase orders' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		supplierModal: {
			title: { vi: 'Tạo nhà cung cấp', en: 'Create supplier' },
			name: { vi: 'Tên nhà cung cấp', en: 'Supplier name' },
			contact: { vi: 'Người liên hệ (tuỳ chọn)', en: 'Contact person (optional)' },
			address: { vi: 'Địa chỉ (tuỳ chọn)', en: 'Address (optional)' },
			addressPlaceholder: { vi: 'Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành...', en: 'House number, street, ward, district, province...' },
			avatar: { vi: 'Ảnh đại diện (tuỳ chọn)', en: 'Avatar (optional)' },
			phonePlaceholder: { vi: 'Số điện thoại', en: 'Phone number' },
			addPhone: { vi: 'Thêm số điện thoại', en: 'Add phone number' },
			removePhone: { vi: 'Xoá số điện thoại', en: 'Remove phone number' },
			emailPlaceholder: { vi: 'Email', en: 'Email' },
			addEmail: { vi: 'Thêm email', en: 'Add email' },
			removeEmail: { vi: 'Xoá email', en: 'Remove email' },
			zalo: { vi: 'Zalo (tuỳ chọn)', en: 'Zalo (optional)' },
			zaloPlaceholder: { vi: 'Số Zalo hoặc link', en: 'Zalo number or link' },
			facebook: { vi: 'Facebook (tuỳ chọn)', en: 'Facebook (optional)' },
			facebookPlaceholder: { vi: 'Link Facebook', en: 'Facebook link' },
			status: { vi: 'Trạng thái', en: 'Status' },
			submit: { vi: 'Tạo', en: 'Create' }
		},
		poModal: {
			title: { vi: 'Tạo đơn mua hàng', en: 'Create purchase order' },
			code: { vi: 'Mã PO', en: 'PO code' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			supplierPlaceholder: { vi: 'Chọn nhà cung cấp', en: 'Select a supplier' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			branchPlaceholder: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			expectedAt: { vi: 'Ngày dự kiến nhận', en: 'Expected at' },
			items: { vi: 'Các mặt hàng', en: 'Items' },
			itemVariant: { vi: 'Sản phẩm', en: 'Variant' },
			itemVariantPlaceholder: { vi: 'Chọn sản phẩm', en: 'Select a variant' },
			itemQuantity: { vi: 'Số lượng', en: 'Quantity' },
			itemUnitCost: { vi: 'Đơn giá', en: 'Unit cost' },
			itemLot: { vi: 'Số lô (tuỳ chọn)', en: 'Lot number (optional)' },
			itemExpires: { vi: 'Hết hạn (tuỳ chọn)', en: 'Expires at (optional)' },
			addItem: { vi: 'Thêm dòng', en: 'Add item' },
			removeItem: { vi: 'Bỏ dòng', en: 'Remove' },
			totalCost: { vi: 'Tổng chi phí (tự tính)', en: 'Total cost (auto)' },
			submit: { vi: 'Tạo đơn mua', en: 'Create PO' }
		},
		statusModal: {
			title: { vi: 'Cập nhật trạng thái PO', en: 'Update PO status' },
			status: { vi: 'Trạng thái mới', en: 'New status' },
			confirm: { vi: 'Cập nhật', en: 'Update' }
		},
		toasts: {
			supplierCreated: { vi: 'Đã tạo nhà cung cấp', en: 'Supplier created' },
			supplierFailed: { vi: 'Tạo nhà cung cấp không thành công', en: 'Failed to create supplier' },
			poCreated: { vi: 'Đã tạo đơn mua hàng', en: 'Purchase order created' },
			poFailed: { vi: 'Tạo đơn mua không thành công', en: 'Failed to create purchase order' },
			statusUpdated: { vi: 'Đã cập nhật trạng thái', en: 'Status updated' },
			statusFailed: { vi: 'Cập nhật trạng thái không thành công', en: 'Failed to update status' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireName: { vi: 'Vui lòng nhập tên nhà cung cấp', en: 'Please enter a supplier name' },
			requireCode: { vi: 'Vui lòng nhập mã PO', en: 'Please enter a PO code' },
			requireSupplier: { vi: 'Vui lòng chọn nhà cung cấp', en: 'Please select a supplier' },
			requireBranch: { vi: 'Vui lòng chọn chi nhánh', en: 'Please select a branch' },
			requireItems: { vi: 'Vui lòng thêm ít nhất một mặt hàng', en: 'Please add at least one item' },
			requireItem: { vi: 'Mỗi dòng cần sản phẩm, số lượng và đơn giá hợp lệ', en: 'Each item needs a variant, valid quantity and unit cost' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// pathname ép về string (route phase 4 chưa có trong RouteId)

	const SUPPLIER_STATUSES = ['active', 'inactive'] as const;
	const PO_STATUSES = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'] as const;

	function poStatusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.poStatuses;
		const label = pageContents.poStatuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function poStatusColor(status?: string): 'success' | 'warning' | 'danger' | 'default' {
		switch (status) {
			case 'received':
				return 'success';
			case 'ordered':
			case 'partially_received':
				return 'warning';
			case 'cancelled':
				return 'danger';
			default:
				return 'default';
		}
	}

	// ── Tab + trạng thái danh sách ──
	let activeTab = $state<'suppliers' | 'purchase-orders'>('suppliers');

	let suppliers = $state<SupplierRow[]>([]);
	let suppliersTotal = $state(0);
	let suppliersPage = $state(1);
	let suppliersLoading = $state(false);
	let suppliersError = $state<string | undefined>(undefined);
	let suppliersLoadedOnce = $state(false);

	let pos = $state<PurchaseOrderRow[]>([]);
	let posTotal = $state(0);
	let posPage = $state(1);
	let posLoading = $state(false);
	let posError = $state<string | undefined>(undefined);
	let posLoadedOnce = $state(false);

	let pageSize = $state(20);
	let supplierStatusFilter = $state('');
	let poStatusFilter = $state('');
	let poBranchFilter = $state('');
	let poSupplierFilter = $state('');

	let branches = $state<BranchOption[]>([]);
	let variantOptions = $state<VariantOption[]>([]);

	// ── Modal tạo nhà cung cấp ──
	let supplierModalDisplay = $state(false);
	let supplierSubmitting = $state(false);
	let supplierError = $state<string | undefined>(undefined);
	// Form đầy đủ: phones/emails (multiple), địa chỉ breakdown (tỉnh/huyện auto detect),
	// avatarUrl (ImageUpload), zalo, facebook — tái sử dụng component hệ thống
	let supplierForm = $state<{
		name: string;
		contactPerson: string;
		address: string;
		phones: string[];
		emails: string[];
		zalo: string;
		facebook: string;
		avatarUrl: string;
		status: string;
	}>({
		name: '',
		contactPerson: '',
		address: '',
		phones: [],
		emails: [],
		zalo: '',
		facebook: '',
		avatarUrl: '',
		status: 'active'
	});
	// breakdown địa chỉ (province/district) — tách khỏi address string để bind 2 chiều với AddressInput
	let supplierAddressBreakdown = $state<{ province: string; district: string }>({ province: '', district: '' });

	// ── Modal tạo PO ──
	let poModalDisplay = $state(false);
	let poSubmitting = $state(false);
	let poError = $state<string | undefined>(undefined);
	let poForm = $state<{
		poCode: string;
		supplierId: string;
		branchId: string;
		expectedAt: string;
		items: POItem[];
	}>({
		poCode: '',
		supplierId: '',
		branchId: '',
		expectedAt: '',
		items: []
	});
	const poTotalCost = $derived(
		poForm.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0)
	);

	// ── Modal cập nhật trạng thái PO ──
	let statusModalDisplay = $state(false);
	let statusRow = $state<PurchaseOrderRow | null>(null);
	let newStatus = $state('');
	let statusBusy = $state(false);
	let statusError = $state<string | undefined>(undefined);

	// ── Derived ──
	const totalPages = $derived(
		activeTab === 'suppliers'
			? Math.max(1, Math.ceil(suppliersTotal / pageSize))
			: Math.max(1, Math.ceil(posTotal / pageSize))
	);
	const currentPage = $derived(activeTab === 'suppliers' ? suppliersPage : posPage);

	// Bind 2 chiều cho Pagination element: đồng bộ theo tab đang mở.
	// Pattern customers: effect armed-guard theo dõi page → refetch (tránh trùng onMount).
	let currentPagingPage = $state(1);
	let pagingArmed = false;
	$effect(() => {
		void currentPagingPage;
		if (!pagingArmed) {
			pagingArmed = true;
			return;
		}
		void refreshPaging();
	});
	async function refreshPaging() {
		if (activeTab === 'suppliers') {
			if (suppliersPage === currentPagingPage) return;
			suppliersPage = currentPagingPage;
			await loadSuppliers();
		} else {
			if (posPage === currentPagingPage) return;
			posPage = currentPagingPage;
			await loadPOs();
		}
	}
	const totalCountText = $derived(
		activeTab === 'suppliers'
			? pageContents.pagination.totalCountSuppliers[lang].replace('{total}', String(suppliersTotal))
			: pageContents.pagination.totalCountPOs[lang].replace('{total}', String(posTotal))
	);

	function getBranchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const branch = branches.find((b) => b._id === branchId);
		return branch?.name ?? branchId;
	}

	function getSupplierLabel(supplierId?: string | null): string {
		if (!supplierId) return '—';
		const supplier = suppliers.find((s) => s._id === supplierId);
		return supplier?.name ?? supplierId;
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

	function formatMoney(value?: number): string {
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value ?? 0);
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
			if (import.meta.env.DEV) console.error('[admin/suppliers] load branches failed:', err);
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
				variantOptions = (response.data as { items?: VariantOption[] } | undefined)?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/suppliers] load variants failed:', err);
		}
	}

	async function loadSuppliers() {
		if (!encryptionKeys) return;
		suppliersLoading = true;
		suppliersError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/list',
				{
					method: 'POST',
					body: {
						page: suppliersPage,
						pageSize,
						status: supplierStatusFilter || undefined
					}
				},
				encryptionKeys
			);
			suppliersLoading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: SupplierRow[]; total?: number; page?: number }
					| undefined;
				suppliers = data?.items ?? [];
				if (typeof data?.total === 'number') suppliersTotal = data.total;
				if (typeof data?.page === 'number') suppliersPage = data.page;
				suppliersLoadedOnce = true;
			} else {
				suppliersError = resolveServerMessage(response.message, lang, pageContents.states.errorTitleSuppliers);
			}
		} catch (err) {
			suppliersLoading = false;
			suppliersError = resolveServerMessage(undefined, lang, pageContents.states.errorTitleSuppliers);
			if (import.meta.env.DEV) console.error('[admin/suppliers] load suppliers failed:', err);
		}
	}

	async function loadPOs() {
		if (!encryptionKeys) return;
		posLoading = true;
		posError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchase-orders/list',
				{
					method: 'POST',
					body: {
						page: posPage,
						pageSize,
						status: poStatusFilter || undefined,
						branchId: poBranchFilter || undefined,
						supplierId: poSupplierFilter || undefined
					}
				},
				encryptionKeys
			);
			posLoading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: PurchaseOrderRow[]; total?: number; page?: number }
					| undefined;
				pos = data?.items ?? [];
				if (typeof data?.total === 'number') posTotal = data.total;
				if (typeof data?.page === 'number') posPage = data.page;
				posLoadedOnce = true;
			} else {
				posError = resolveServerMessage(response.message, lang, pageContents.states.errorTitlePOs);
			}
		} catch (err) {
			posLoading = false;
			posError = resolveServerMessage(undefined, lang, pageContents.states.errorTitlePOs);
			if (import.meta.env.DEV) console.error('[admin/suppliers] load POs failed:', err);
		}
	}

	function switchTab(tab: 'suppliers' | 'purchase-orders') {
		if (activeTab === tab) return;
		activeTab = tab;
		// Đồng bộ paginator sang state page của tab mới (không refetch —
		// refreshPaging đã guard cùng-value)
		currentPagingPage = tab === 'suppliers' ? suppliersPage : posPage;
		if (tab === 'suppliers' && !suppliersLoadedOnce) void loadSuppliers();
		if (tab === 'purchase-orders' && !posLoadedOnce) void loadPOs();
	}

	async function refresh() {
		if (activeTab === 'suppliers') await loadSuppliers();
		else await loadPOs();
	}

	// ── Phân trang / filter ──
	async function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		suppliersPage = 1;
		posPage = 1;
		currentPagingPage = 1;
		if (activeTab === 'suppliers') await loadSuppliers();
		else await loadPOs();
	}

	async function onFilterChange() {
		suppliersPage = 1;
		posPage = 1;
		await refresh();
	}

	// ---------- DataTable columns ----------
	const suppliersAny = $derived(suppliers as unknown as Record<string, unknown>[]);
	const supplierColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'name',
			label: pageContents.supplierTable.name[lang],
			sortable: true,
			accessor: (row) => (row as unknown as SupplierRow).name ?? '—'
		},
		{
			id: 'contact',
			label: pageContents.supplierTable.contact[lang],
			sortable: true,
			accessor: (row) => (row as unknown as SupplierRow).contactPerson ?? '—'
		},
		{
			id: 'address',
			label: pageContents.supplierTable.address[lang],
			accessor: (row) => (row as unknown as SupplierRow).address ?? '—',
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.supplierTable.status[lang],
			sortable: true,
			accessor: (row) => {
				const status = (row as unknown as SupplierRow).status;
				return status === 'active' ? (lang === 'vi' ? 'Đang hoạt động' : 'Active') : (status ?? '—');
			},
			status: (_value, row) =>
				(row as unknown as SupplierRow).status === 'active' ? 'success' : 'default'
		},
		{
			id: 'createdAt',
			label: pageContents.supplierTable.createdAt[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as SupplierRow).createdAt),
			noHighlight: true
		}
	]);

	const posAny = $derived(pos as unknown as Record<string, unknown>[]);
	const poColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'code',
			label: pageContents.poTable.code[lang],
			sortable: true,
			accessor: (row) => (row as unknown as PurchaseOrderRow).poCode ?? '—'
		},
		{
			id: 'supplier',
			label: pageContents.poTable.supplier[lang],
			sortable: true,
			accessor: (row) => getSupplierLabel((row as unknown as PurchaseOrderRow).supplierId),
			noHighlight: true
		},
		{
			id: 'branch',
			label: pageContents.poTable.branch[lang],
			accessor: (row) => getBranchLabel((row as unknown as PurchaseOrderRow).branchId),
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.poTable.status[lang],
			sortable: true,
			accessor: (row) => poStatusLabel((row as unknown as PurchaseOrderRow).status),
			status: (_value, row) => poStatusColor((row as unknown as PurchaseOrderRow).status)
		},
		{
			id: 'totalCost',
			label: pageContents.poTable.totalCost[lang],
			sortable: true,
			accessor: (row) => formatMoney((row as unknown as PurchaseOrderRow).totalCost),
			noHighlight: true
		},
		{
			id: 'expectedAt',
			label: pageContents.poTable.expectedAt[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as PurchaseOrderRow).expectedAt),
			noHighlight: true
		}
	]);

	// ── Modal tạo nhà cung cấp ──
	function openSupplierModal() {
		supplierForm = { name: '', contactPerson: '', address: '', phones: [], emails: [], zalo: '', facebook: '', avatarUrl: '', status: 'active' };
		supplierAddressBreakdown = { province: '', district: '' };
		supplierError = undefined;
		supplierModalDisplay = true;
	}

	function validateSupplierForm(): string | undefined {
		if (!supplierForm.name.trim()) {
			return pageContents.form.requireName[lang];
		}
		return undefined;
	}

	async function submitSupplier() {
		if (supplierSubmitting || !encryptionKeys) return;
		const validationError = validateSupplierForm();
		if (validationError) {
			supplierError = validationError;
			return;
		}
		supplierError = undefined;
		supplierSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/create',
				{
					method: 'POST',
					body: {
						name: supplierForm.name.trim(),
						contactPerson: supplierForm.contactPerson.trim() || undefined,
						address: supplierForm.address.trim() || undefined,
						ward: undefined,
						district: supplierAddressBreakdown.district || undefined,
						province: supplierAddressBreakdown.province || undefined,
						country: supplierAddressBreakdown.province ? 'Việt Nam' : undefined,
						phones: supplierForm.phones.length > 0 ? supplierForm.phones : undefined,
						emails: supplierForm.emails.length > 0 ? supplierForm.emails : undefined,
						zalo: supplierForm.zalo.trim() || undefined,
						facebook: supplierForm.facebook.trim() || undefined,
						avatarUrl: supplierForm.avatarUrl.trim() || undefined,
						status: supplierForm.status
					}
				},
				encryptionKeys
			);
			supplierSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.supplierCreated)
						: pageContents.toasts.supplierCreated[lang],
					'success'
				);
				supplierModalDisplay = false;
				await loadSuppliers();
			} else {
				supplierError = resolveServerMessage(response.message, lang, pageContents.toasts.supplierFailed);
			}
		} catch (err) {
			supplierSubmitting = false;
			supplierError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/suppliers] create supplier failed:', err);
		}
	}

	// ── Modal tạo PO ──
	function openPOModal() {
		poForm = { poCode: '', supplierId: '', branchId: '', expectedAt: '', items: [] };
		poError = undefined;
		poModalDisplay = true;
		void loadVariantOptions();
	}

	function addPOItem() {
		poForm.items = [...poForm.items, { variantId: '', quantity: 1, unitCost: 0 }];
	}

	function removePOItem(index: number) {
		poForm.items = poForm.items.filter((_, i) => i !== index);
	}

	function validatePOForm(): string | undefined {
		if (!poForm.poCode.trim()) return pageContents.form.requireCode[lang];
		if (!poForm.supplierId) return pageContents.form.requireSupplier[lang];
		if (!poForm.branchId) return pageContents.form.requireBranch[lang];
		if (poForm.items.length === 0) return pageContents.form.requireItems[lang];
		for (const item of poForm.items) {
			if (!item.variantId || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitCost) || item.unitCost < 0) {
				return pageContents.form.requireItem[lang];
			}
		}
		return undefined;
	}

	async function submitPO() {
		if (poSubmitting || !encryptionKeys) return;
		const validationError = validatePOForm();
		if (validationError) {
			poError = validationError;
			return;
		}
		poError = undefined;
		poSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchase-orders/create',
				{
					method: 'POST',
					body: {
						poCode: poForm.poCode.trim(),
						supplierId: poForm.supplierId,
						branchId: poForm.branchId,
						expectedAt: poForm.expectedAt || undefined,
						items: poForm.items.map((item) => ({
							variantId: item.variantId,
							quantity: Number(item.quantity),
							unitCost: Number(item.unitCost),
							lotNumber: item.lotNumber?.trim() || undefined,
							expiresAt: item.expiresAt || undefined
						})),
						totalCost: poTotalCost
					}
				},
				encryptionKeys
			);
			poSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.poCreated)
						: pageContents.toasts.poCreated[lang],
					'success'
				);
				poModalDisplay = false;
				await loadPOs();
			} else {
				poError = resolveServerMessage(response.message, lang, pageContents.toasts.poFailed);
			}
		} catch (err) {
			poSubmitting = false;
			poError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/suppliers] create PO failed:', err);
		}
	}

	// ── Modal cập nhật trạng thái PO ──
	function openStatusModal(row: PurchaseOrderRow) {
		statusRow = row;
		newStatus = row.status ?? 'draft';
		statusError = undefined;
		statusModalDisplay = true;
	}

	async function confirmStatus() {
		if (!statusRow || statusBusy || !encryptionKeys || !newStatus) return;
		statusBusy = true;
		statusError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchase-orders/update-status',
				{
					method: 'POST',
					body: {
						poId: statusRow._id,
						status: newStatus
					}
				},
				encryptionKeys
			);
			statusBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.statusUpdated)
						: pageContents.toasts.statusUpdated[lang],
					'success'
				);
				statusModalDisplay = false;
				await loadPOs();
			} else {
				statusError = resolveServerMessage(response.message, lang, pageContents.toasts.statusFailed);
			}
		} catch (err) {
			statusBusy = false;
			statusError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/suppliers] update PO status failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadSuppliers()]);
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
			{#if activeTab === 'suppliers'}
				<Button color="success" onClick={openSupplierModal}>{pageContents.actions.createSupplier[lang]}</Button>
			{:else}
				<Button color="success" onClick={openPOModal}>{pageContents.actions.createPO[lang]}</Button>
			{/if}
		</div>
	</header>

	<!-- ── Tab ── -->
	<div class="tab-strip" role="tablist">
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'suppliers'}
			role="tab"
			aria-selected={activeTab === 'suppliers'}
			onclick={() => switchTab('suppliers')}
		>
			{pageContents.tabs.suppliers[lang]}
		</button>
		<button
			type="button"
			class="tab-item"
			class:active={activeTab === 'purchase-orders'}
			role="tab"
			aria-selected={activeTab === 'purchase-orders'}
			onclick={() => switchTab('purchase-orders')}
		>
			{pageContents.tabs.purchaseOrders[lang]}
		</button>
	</div>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		{#if activeTab === 'suppliers'}
			<select class="admin-select" bind:value={supplierStatusFilter} onchange={onFilterChange}>
				<option value="">{pageContents.filters.allStatuses[lang]}</option>
				{#each SUPPLIER_STATUSES as status (status)}
					<option value={status}>{status === 'active' ? (lang === 'vi' ? 'Đang hoạt động' : 'Active') : (lang === 'vi' ? 'Ngừng hoạt động' : 'Inactive')}</option>
				{/each}
			</select>
		{:else}
			<select class="admin-select" bind:value={poStatusFilter} onchange={onFilterChange}>
				<option value="">{pageContents.filters.allStatuses[lang]}</option>
				{#each PO_STATUSES as status (status)}
					<option value={status}>{poStatusLabel(status)}</option>
				{/each}
			</select>
			<select class="admin-select" bind:value={poBranchFilter} onchange={onFilterChange}>
				<option value="">{pageContents.filters.allBranches[lang]}</option>
				{#each branches as branch (branch._id)}
					<option value={branch._id}>{branch.name ?? branch._id}</option>
				{/each}
			</select>
			<select class="admin-select" bind:value={poSupplierFilter} onchange={onFilterChange}>
				<option value="">{pageContents.filters.allSuppliers[lang]}</option>
				{#each suppliers as supplier (supplier._id)}
					<option value={supplier._id}>{supplier.name ?? supplier._id}</option>
				{/each}
			</select>
		{/if}
		<Button color="default" variant="outline" size="sm" onClick={refresh}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	<!-- ── Tab SUPPLIERS ── -->
	{#if activeTab === 'suppliers'}
		{#if suppliersError}
			<div class="admin-state error" role="alert">
				<p class="state-title">{pageContents.states.errorTitleSuppliers[lang]}</p>
				<p class="state-detail">{suppliersError}</p>
				<Button color="primary" variant="outline" onClick={loadSuppliers}>{pageContents.states.retry[lang]}</Button>
			</div>
		{:else}
			<!-- DataTable — server-side paging: paging trong DataTable TẮT -->
			<div class="admin-table-wrap">
				<DataTable
					data={suppliersAny}
					columns={supplierColumns}
					pageSize={pageSize}
					showPagination={false}
					sortable
					searchable
					searchPlaceholder={{ vi: 'Tìm nhà cung cấp…', en: 'Search suppliers…' }}
					resizable={{ enabled: true, fit: true }}
					loading={suppliersLoading && !suppliersLoadedOnce}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.emptySuppliers[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					caption={{ vi: 'Danh sách nhà cung cấp', en: 'Suppliers list' }}
					stickyHead
					data-test="suppliers-datatable"
				/>
			</div>
		{/if}
	{:else}
		<!-- ── Tab PURCHASE ORDERS ── -->
		{#if posError}
			<div class="admin-state error" role="alert">
				<p class="state-title">{pageContents.states.errorTitlePOs[lang]}</p>
				<p class="state-detail">{posError}</p>
				<Button color="primary" variant="outline" onClick={loadPOs}>{pageContents.states.retry[lang]}</Button>
			</div>
		{:else}
			<div class="admin-table-wrap">
				<DataTable
					data={posAny}
					columns={poColumns}
					pageSize={pageSize}
					showPagination={false}
					sortable
					searchable
					searchPlaceholder={{ vi: 'Tìm đơn mua hàng…', en: 'Search purchase orders…' }}
					resizable={{ enabled: true, fit: true }}
					loading={posLoading && !posLoadedOnce}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.emptyPOs[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					caption={{ vi: 'Danh sách đơn mua hàng', en: 'Purchase orders list' }}
					actionsLabel={{ vi: pageContents.poTable.actions[lang], en: pageContents.poTable.actions[lang] }}
					stickyHead
					data-test="purchase-orders-datatable"
				>
					{#snippet actionsContent(row)}
						{@const po = row as unknown as PurchaseOrderRow}
						<div class="row-actions">
							<!-- update/edit = primary -->
							<Button color="primary" variant="ghost" size="sm" onClick={() => openStatusModal(po)}>
								{pageContents.actions.updateStatus[lang]}
							</Button>
						</div>
					{/snippet}
				</DataTable>
			</div>
		{/if}
	{/if}

	<!-- ── Phân trang (server-side, dùng chung 2 tab) ── -->
	<footer class="admin-pagination">
		<span class="total-count">{totalCountText}</span>
		<div class="page-controls">
			<Pagination
				bind:page={currentPagingPage}
				totalPages={totalPages}
				loading={activeTab === 'suppliers' ? suppliersLoading : posLoading}
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

<!-- ── Modal tạo nhà cung cấp ── -->
{#if supplierModalDisplay}
	<Modal bind:display={supplierModalDisplay} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.supplierModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if supplierError}
					<div class="form-error-banner" role="alert">{supplierError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.supplierModal.name[lang]}</span>
							<input class="admin-input" type="text" bind:value={supplierForm.name} disabled={supplierSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.supplierModal.contact[lang]}</span>
							<input class="admin-input" type="text" bind:value={supplierForm.contactPerson} disabled={supplierSubmitting} />
						</label>
					</div>
					<div class="form-grid-2">
						<div class="form-field">
							<span class="form-label">{pageContents.supplierModal.avatar[lang]}</span>
							<ImageUpload bind:value={supplierForm.avatarUrl} label="" disabled={supplierSubmitting} />
						</div>
						<div class="form-grid" style="gap: 0.5rem;">
							<!-- phones multiple: PhoneInput per slot + nút thêm/xoá -->
							{#each supplierForm.phones as _, phoneIndex (phoneIndex)}
								<div class="field-row">
									<PhoneInput bind:value={supplierForm.phones[phoneIndex]} placeholder={pageContents.supplierModal.phonePlaceholder[lang]} disabled={supplierSubmitting} />
									<button
										type="button"
										class="field-row-remove"
										aria-label={pageContents.supplierModal.removePhone[lang]}
										disabled={supplierSubmitting}
										onclick={() => {
											supplierForm.phones = supplierForm.phones.filter((_, i) => i !== phoneIndex);
										}}
									>✕</button>
								</div>
							{/each}
							<button
								type="button"
								class="field-add"
								disabled={supplierSubmitting}
								onclick={() => {
									supplierForm.phones = [...supplierForm.phones, ''];
								}}
							>+ {pageContents.supplierModal.addPhone[lang]}</button>
							<!-- emails multiple -->
							{#each supplierForm.emails as _, emailIndex (emailIndex)}
								<div class="field-row">
									<EmailInput bind:value={supplierForm.emails[emailIndex]} placeholder={pageContents.supplierModal.emailPlaceholder[lang]} disabled={supplierSubmitting} />
									<button
										type="button"
										class="field-row-remove"
										aria-label={pageContents.supplierModal.removeEmail[lang]}
										disabled={supplierSubmitting}
										onclick={() => {
											supplierForm.emails = supplierForm.emails.filter((_, i) => i !== emailIndex);
										}}
									>✕</button>
								</div>
							{/each}
							<button
								type="button"
								class="field-add"
								disabled={supplierSubmitting}
								onclick={() => {
									supplierForm.emails = [...supplierForm.emails, ''];
								}}
							>+ {pageContents.supplierModal.addEmail[lang]}</button>
						</div>
					</div>
					<!-- Địa chỉ: auto complete nhận dạng chuỗi → chọn tỉnh/huyện qua select/option -->
					<AddressInput
						bind:value={supplierForm.address}
						bind:breakdown={supplierAddressBreakdown}
						label={pageContents.supplierModal.address[lang]}
						placeholder={pageContents.supplierModal.addressPlaceholder[lang]}
						disabled={supplierSubmitting}
					/>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.supplierModal.zalo[lang]}</span>
							<input class="admin-input" type="text" bind:value={supplierForm.zalo} disabled={supplierSubmitting} placeholder={pageContents.supplierModal.zaloPlaceholder[lang]} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.supplierModal.facebook[lang]}</span>
							<input class="admin-input" type="text" bind:value={supplierForm.facebook} disabled={supplierSubmitting} placeholder={pageContents.supplierModal.facebookPlaceholder[lang]} />
						</label>
					</div>
					<label class="form-field">
						<span class="form-label">{pageContents.supplierModal.status[lang]}</span>
						<select class="admin-select" bind:value={supplierForm.status} disabled={supplierSubmitting}>
							{#each SUPPLIER_STATUSES as status (status)}
								<option value={status}>{status === 'active' ? (lang === 'vi' ? 'Đang hoạt động' : 'Active') : (lang === 'vi' ? 'Ngừng hoạt động' : 'Inactive')}</option>
							{/each}
						</select>
					</label>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitSupplier} loading={supplierSubmitting} disabled={supplierSubmitting}>
					{pageContents.supplierModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={supplierSubmitting}
					onClick={() => {
						supplierModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal tạo đơn mua hàng ── -->
{#if poModalDisplay}
	<Modal bind:display={poModalDisplay} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.poModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if poError}
					<div class="form-error-banner" role="alert">{poError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.poModal.code[lang]}</span>
							<input class="admin-input" type="text" bind:value={poForm.poCode} disabled={poSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.poModal.expectedAt[lang]}</span>
							<input class="admin-input" type="date" bind:value={poForm.expectedAt} disabled={poSubmitting} />
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.poModal.supplier[lang]}</span>
							<select class="admin-select" bind:value={poForm.supplierId} disabled={poSubmitting}>
								<option value="" disabled>{pageContents.poModal.supplierPlaceholder[lang]}</option>
								{#each suppliers as supplier (supplier._id)}
									<option value={supplier._id}>{supplier.name ?? supplier._id}</option>
								{/each}
							</select>
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.poModal.branch[lang]}</span>
							<select class="admin-select" bind:value={poForm.branchId} disabled={poSubmitting}>
								<option value="" disabled>{pageContents.poModal.branchPlaceholder[lang]}</option>
								{#each branches as branch (branch._id)}
									<option value={branch._id}>{branch.name ?? branch._id}</option>
								{/each}
							</select>
						</label>
					</div>

					<div class="items-block">
						<p class="form-label">{pageContents.poModal.items[lang]}</p>
						{#each poForm.items as item, index (index)}
							<div class="po-item">
								<select class="admin-select po-item-variant" bind:value={item.variantId} disabled={poSubmitting}>
									<option value="" disabled>{pageContents.poModal.itemVariantPlaceholder[lang]}</option>
									{#each variantOptions as variant (variant._id)}
										<option value={variant._id}>
											{variant.sku ? `${variant.sku} — ${variant.displayName ?? ''}` : (variant.displayName ?? variant._id)}
										</option>
									{/each}
								</select>
								<input class="admin-input po-item-num" type="number" min="1" step="1" bind:value={item.quantity} disabled={poSubmitting} placeholder={pageContents.poModal.itemQuantity[lang]} />
								<input class="admin-input po-item-num" type="number" min="0" step="any" bind:value={item.unitCost} disabled={poSubmitting} placeholder={pageContents.poModal.itemUnitCost[lang]} />
								<input class="admin-input po-item-lot" type="text" bind:value={item.lotNumber} disabled={poSubmitting} placeholder={pageContents.poModal.itemLot[lang]} />
								<input class="admin-input po-item-date" type="date" bind:value={item.expiresAt} disabled={poSubmitting} />
								<!-- delete/remove = error -->
								<Button color="error" variant="ghost" size="sm" disabled={poSubmitting} onClick={() => removePOItem(index)}>
									{pageContents.poModal.removeItem[lang]}
								</Button>
							</div>
						{/each}
						<Button color="default" variant="outline" size="sm" disabled={poSubmitting} onClick={addPOItem}>
							{pageContents.poModal.addItem[lang]}
						</Button>
						<p class="po-total">
							{pageContents.poModal.totalCost[lang]}: <strong>{formatMoney(poTotalCost)}</strong>
						</p>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitPO} loading={poSubmitting} disabled={poSubmitting}>
					{pageContents.poModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={poSubmitting}
					onClick={() => {
						poModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal cập nhật trạng thái PO ── -->
{#if statusModalDisplay}
	<Modal bind:display={statusModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.statusModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<p class="modal-intro">
					<strong>{statusRow?.poCode ?? '—'}</strong>
					— {getSupplierLabel(statusRow?.supplierId)}
				</p>
				{#if statusError}
					<div class="form-error-banner" role="alert">{statusError}</div>
				{/if}
				<label class="form-field">
					<span class="form-label">{pageContents.statusModal.status[lang]}</span>
					<select class="admin-select" bind:value={newStatus} disabled={statusBusy}>
						{#each PO_STATUSES as status (status)}
							<option value={status}>{poStatusLabel(status)}</option>
						{/each}
					</select>
				</label>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- update/edit = primary -->
				<Button color="primary" onClick={confirmStatus} loading={statusBusy}>
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

	/* hàng phone/email + nút xoá */
	.field-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;

		& > :global(.input-root) {
			flex: 1;
			min-width: 0;
		}
	}

	.field-row-remove {
		flex: none;
		width: 1.75rem;
		height: 1.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--foreground-500, inherit);
		cursor: pointer;
		font-size: 0.8125rem;
		transition: background 0.15s ease, color 0.15s ease;

		&:hover:not(:disabled) {
			background: color-mix(in oklab, var(--error) 10%, transparent);
			color: var(--error);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.field-add {
		align-self: flex-start;
		padding: 0.25rem 0.5rem;
		border: 1px dashed var(--border, #d1d5db);
		border-radius: 0.375rem;
		background: transparent;
		color: var(--primary-600, var(--primary));
		font-size: 0.8125rem;
		cursor: pointer;
		transition: background 0.15s ease;

		&:hover:not(:disabled) {
			background: color-mix(in oklab, var(--primary) 8%, transparent);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
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

	.items-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 1px dashed var(--default-300);
		border-radius: 0.75rem;
	}

	.po-item {
		display: grid;
		grid-template-columns: minmax(10rem, 2fr) 5rem 6rem minmax(6rem, 1fr) minmax(8rem, 1fr) auto;
		gap: 0.5rem;
		align-items: center;

		@media (max-width: 860px) {
			grid-template-columns: 1fr 1fr;
		}
	}

	.po-item-num {
		width: auto;
	}

	.po-total {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
		color: var(--foreground);
	}
</style>
