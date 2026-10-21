<!-- src/routes/(authorized)/admin/suppliers/+page.svelte -->
<script lang="ts">
	import { Button, DataTable, Pagination, AlertDialog, Badge, Spinner } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { EmailInput, ImageUpload, Input, Label, PhoneInput, Switch, TextField, Textarea, AddressInput } from '$components/form';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import type { Size } from '$components/interface';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDate as formatDateShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolveServerMessage } from '../_interface';
	import { recordSearchKeyword, saveDataTablePrefs, getSearchKeywords, userPrefs, saveDraftPref, clearDraftPref, readDraftPref } from '$store/user-prefs.svelte';
	import { createCloseGuard } from '$modules/close-guard.svelte';

	interface SupplierRow {
		_id?: string;
		name?: string;
		contactPerson?: string | null;
		address?: string | null;
		phones?: string[] | null;
		emails?: string[] | null;
		addresses?: SupplierAddressEntry[] | null;
		images?: string[] | null;
		note?: string | null;
		status?: string;
		createdAt?: string | null;
	}

	interface SupplierAddressEntry {
		label?: string;
		address: string;
		ward?: string;
		province?: string;
		district?: string;
		country?: string;
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
			createdAt: { vi: 'Tạo lúc', en: 'Created' },
			updatedAt: { vi: 'Cập nhật', en: 'Updated' },
			actions: { vi: 'Thao tác', en: 'Actions' }
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
			updateStatus: { vi: 'Cập nhật trạng thái', en: 'Update status' },
			edit: { vi: 'Sửa', en: 'Edit' }
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
			titleEdit: { vi: 'Sửa nhà cung cấp', en: 'Edit supplier' },
			name: { vi: 'Tên nhà cung cấp', en: 'Supplier name' },
			contact: { vi: 'Người liên hệ (tuỳ chọn)', en: 'Contact person (optional)' },
			address: { vi: 'Địa chỉ (tuỳ chọn)', en: 'Address (optional)' },
			addressPlaceholder: { vi: 'Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành...', en: 'House number, street, ward, district, province...' },
			addresses: { vi: 'Danh sách địa chỉ', en: 'Addresses' },
			addAddress: { vi: 'Thêm địa chỉ', en: 'Add address' },
			removeAddress: { vi: 'Xoá địa chỉ', en: 'Remove address' },
			addressLabelPlaceholder: { vi: 'Nhãn (vd: Kho, Văn phòng...)', en: 'Label (e.g. Warehouse, Office...)' },
			wardPlaceholder: { vi: 'Chọn phường/xã', en: 'Select ward' },
			images: { vi: 'Hình ảnh', en: 'Images' },
			note: { vi: 'Ghi chú', en: 'Note' },
			notePlaceholder: { vi: 'Ghi chú về nhà cung cấp...', en: 'Notes about this supplier...' },
			phonePlaceholder: { vi: 'Số điện thoại', en: 'Phone number' },
			addPhone: { vi: 'Thêm số điện thoại', en: 'Add phone number' },
			removePhone: { vi: 'Xoá số điện thoại', en: 'Remove phone number' },
			emailPlaceholder: { vi: 'Email', en: 'Email' },
			addEmail: { vi: 'Thêm email', en: 'Add email' },
			removeEmail: { vi: 'Xoá email', en: 'Remove email' },
			social: { vi: 'Mạng xã hội', en: 'Social networks' },
			zalo: { vi: 'Zalo', en: 'Zalo' },
			zaloPlaceholder: { vi: 'Số Zalo hoặc link zalo.me/...', en: 'Zalo number or zalo.me/... link' },
			zaloInvalid: { vi: 'Zalo phải là số điện thoại hoặc link zalo.me', en: 'Zalo must be a phone number or zalo.me link' },
			telegram: { vi: 'Telegram', en: 'Telegram' },
			telegramPlaceholder: { vi: '@username hoặc link t.me/...', en: '@username or t.me/... link' },
			telegramInvalid: { vi: 'Telegram phải là @username hoặc link t.me', en: 'Telegram must be @username or t.me link' },
			discord: { vi: 'Discord', en: 'Discord' },
			discordPlaceholder: { vi: 'Tên người dùng Discord', en: 'Discord username' },
			discordInvalid: { vi: 'Discord chỉ nhận tên người dùng (2-32 ký tự)', en: 'Discord accepts username only (2-32 chars)' },
			facebook: { vi: 'Facebook', en: 'Facebook' },
			facebookPlaceholder: { vi: 'Link facebook.com/...', en: 'facebook.com/... link' },
			facebookInvalid: { vi: 'Facebook phải là link facebook.com hoặc fb.com', en: 'Facebook must be a facebook.com or fb.com link' },
			status: { vi: 'Trạng thái', en: 'Status' },
			statusActive: { vi: 'Đang hoạt động', en: 'Active' },
			statusInactive: { vi: 'Ngừng hoạt động', en: 'Inactive' },
			submit: { vi: 'Tạo', en: 'Create' },
			save: { vi: 'Lưu thay đổi', en: 'Save changes' },
			duplicateWarn: { vi: 'Có giá trị trùng lặp', en: 'Duplicate value' }
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
			supplierUpdated: { vi: 'Đã cập nhật nhà cung cấp', en: 'Supplier updated' },
			supplierUpdateFailed: { vi: 'Cập nhật nhà cung cấp không thành công', en: 'Failed to update supplier' },
			urlCopied: { vi: 'Đã copy URL ảnh', en: 'Image URL copied' },
			draftRestored: { vi: 'Đã phục hồi bản nháp chưa lưu', en: 'Draft restored' },
			draftSaved: { vi: 'Bản nháp đã lưu tự động', en: 'Draft saved' },
			bulkDeleted: { vi: 'Đã xoá {count} nhà cung cấp', en: 'Deleted {count} suppliers' },
			bulkDeleteFailed: { vi: 'Xoá hàng loạt không thành công', en: 'Bulk delete failed' },
			bulkCopied: { vi: 'Đã copy {count} dòng', en: 'Copied {count} rows' },
			poCreated: { vi: 'Đã tạo đơn mua hàng', en: 'Purchase order created' },
			poFailed: { vi: 'Tạo đơn mua không thành công', en: 'Failed to create purchase order' },
			statusUpdated: { vi: 'Đã cập nhật trạng thái', en: 'Status updated' },
			statusFailed: { vi: 'Cập nhật trạng thái không thành công', en: 'Failed to update status' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		dirty: {
			title: { vi: 'Bỏ thay đổi?', en: 'Discard changes?' },
			desc: {
				vi: 'Form của bạn có thay đổi chưa lưu. Nếu bỏ bây giờ, các thay đổi này sẽ mất.',
				en: 'Your form has unsaved changes. If you discard now, these changes will be lost.'
			},
			continueEdit: { vi: 'Tiếp tục chỉnh sửa', en: 'Keep editing' },
			discard: { vi: 'Bỏ thay đổi', en: 'Discard' }
		},
		bulk: {
			title: { vi: 'Xoá nhà cung cấp đã chọn?', en: 'Delete selected suppliers?' },
			desc: {
				vi: 'Các nhà cung cấp đã chọn sẽ bị xoá vĩnh viễn khỏi hệ thống.',
				en: 'The selected suppliers will be permanently removed.'
			},
			confirm: { vi: 'Xoá', en: 'Delete' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			copy: { vi: 'Copy', en: 'Copy' },
			delete: { vi: 'Xoá', en: 'Delete' },
			selected: { vi: 'Đã chọn {count}', en: '{count} selected' }
		},
		suggest: {
			title: { vi: 'Từ khoá đã tìm', en: 'Recent searches' }
		},
		form: {
			requireName: { vi: 'Vui lòng nhập tên nhà cung cấp', en: 'Please enter a supplier name' },
			invalidPhone: { vi: 'Số điện thoại không hợp lệ', en: 'Invalid phone number' },
			invalidEmail: { vi: 'Email không hợp lệ', en: 'Invalid email' },
			invalidZalo: { vi: 'Zalo phải là số điện thoại hoặc link zalo.me', en: 'Zalo must be a phone number or zalo.me link' },
			invalidTelegram: { vi: 'Telegram phải là @username hoặc link t.me', en: 'Telegram must be @username or t.me link' },
			invalidDiscord: { vi: 'Discord chỉ nhận tên người dùng (2-32 ký tự)', en: 'Discord accepts username only (2-32 chars)' },
			invalidFacebook: { vi: 'Facebook phải là link facebook.com hoặc fb.com', en: 'Facebook must be a facebook.com or fb.com link' },
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

	// ── Search server + sort server (pattern purchases) ──
	const PREFS_KEY = '/admin/suppliers';
	let searchQuery = $state<string | undefined>('');
	let searching = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout>;
	let searchArmed = false;
	let suggestOpen = $state(false);
	let searchFocused = $state(false);
	let mobileFabOpen = $state(false);
	let sortField = $state('');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	let branches = $state<BranchOption[]>([]);
	let variantOptions = $state<VariantOption[]>([]);

	// ── Modal tạo/sửa nhà cung cấp ──
	let supplierModalDisplay = $state(false);
	let supplierSubmitting = $state(false);
	let supplierError = $state<string | undefined>(undefined);
	// 'create' | 'edit' — cùng 1 form; edit prefill từ row + Lưu qua /suppliers/update
	let supplierEditMode = $state<'create' | 'edit'>('create');
	let supplierEditId = $state<string | null>(null);
	// Form đầy đủ: phones/emails (multiple), addresses (multiple block), social
	// (zalo/telegram/discord/facebook), images (multiple + avatarUrl con trỏ), note.
	// NOTE: address/province/district CẤP 1 lấy từ entry đầu của addresses
	// (bỏ field address đơn — yêu cầu user 1g) — giữ key trong form để payload ổn định.
	let supplierForm = $state<{
		name: string;
		contactPerson: string;
		address: string;
		phones: string[];
		emails: string[];
		addresses: SupplierAddressEntry[];
		zalo: string;
		telegram: string;
		discord: string;
		facebook: string;
		images: string[];
		avatarUrl: string;
		note: string;
		status: string;
	}>({
		name: '',
		contactPerson: '',
		address: '',
		phones: [],
		emails: [],
		addresses: [],
		zalo: '',
		telegram: '',
		discord: '',
		facebook: '',
		images: [],
		avatarUrl: '',
		note: '',
		status: 'active'
	});
	// breakdown cho từng entry addresses (AddressInput bind 2 chiều từng phần tử)
	let supplierAddressBreakdowns = $state<{ province: string; district: string; ward?: string }[]>([]);

	// ── Draft DB (yêu cầu 1k: reload page → resume) — field `drafts` trong
	// user-prefs (server cap 5 form × 20KB). Tách khỏi datatable.filters vì
	// filters cap value 100 chars — draft form JSON dài hơn nhiều.
	const DRAFT_FORM_KEY = 'suppliers:create';
	let draftTimer: ReturnType<typeof setTimeout> | undefined;
	let draftHydrated = $state(false); // $state BẮT BUỘC — không track thì $effect draft không re-run

	function saveDraftDebounced() {
		if (supplierEditMode !== 'create' || !draftHydrated) return;
		clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			// Lọc null/undefined trong mảng (Input unmount emit undefined qua bind —
			// JSON.stringify biến thành null, resume sau đó sẽ nổ .trim())
			const f = supplierForm;
			const clean = {
				...f,
				phones: f.phones.filter((p): p is string => typeof p === 'string'),
				emails: f.emails.filter((e): e is string => typeof e === 'string'),
				images: f.images.filter((i): i is string => typeof i === 'string')
			};
			saveDraftPref(DRAFT_FORM_KEY, JSON.stringify(clean));
		}, 500);
	}

	function clearDraft() {
		clearDraftPref(DRAFT_FORM_KEY);
	}

	// ── Dirty-guard (pattern brands: createCloseGuard + AlertDialog) ──
	let dirtyCloseDisplay = $state(false);
	const closeGuard = createCloseGuard({
		form: () => supplierForm,
		openConfirm: () => (dirtyCloseDisplay = true),
		close: () => {
			supplierModalDisplay = false;
			dirtyCloseDisplay = false;
		}
	});

	// ── Bulk selection (yêu cầu 2: STT hover → checkbox, copy/delete hàng loạt) ──
	let selectedIds = $state<string[]>([]);
	let bulkDeleteDisplay = $state(false);
	let bulkDeleting = $state(false);

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

	// ── Search debounce 300ms (pattern purchases): effect + armed-guard —
	// lần chạy đầu (init) không fetch; các lần sau searching=true → skeleton,
	// reset page=1 rồi load. Chỉ áp dụng cho tab suppliers.
	let cardFieldIds = $state<string[]>(['name', 'status', 'contact', 'address']);

	$effect(() => {
		void searchQuery;
		if (activeTab !== 'suppliers') return;
		if (!searchArmed) {
			searchArmed = true;
			return;
		}
		clearTimeout(searchDebounce);
		searching = true;
		searchDebounce = setTimeout(() => {
			suppliersPage = 1;
			currentPagingPage = 1;
			void loadSuppliers();
		}, 300);
	});

	// BẪY: card mode mobile unmount Input trong caption → emit undefined qua
	// bind:value. Guard mọi chỗ đọc searchQuery bằng (searchQuery ?? '').
	function saveSearchKeyword() {
		const kw = (searchQuery ?? '').trim();
		if (kw) recordSearchKeyword(PREFS_KEY, kw);
	}

	function mergeIconClasses(
		styles: ReadonlyArray<string | undefined> | undefined,
		extra: string
	): string[] {
		return [...(styles ?? []).filter((c): c is string => typeof c === 'string'), extra];
	}

	// ── Sort server handler (DataTable onSortChange) — persist prefs + reload ──
	function onSupplierSortChange(columnId: string, order: 'asc' | 'desc' | null) {
		if (!order || !columnId) {
			sortField = '';
			sortDirection = 'desc';
		} else {
			sortField = columnId;
			sortDirection = order;
		}
		saveDataTablePrefs(PREFS_KEY, {
			sort: sortField ? { field: sortField, direction: sortDirection } : undefined,
			cardFields: cardFieldIds
		});
		searching = true; // skeleton cả khi sort lại
		suppliersPage = 1;
		currentPagingPage = 1;
		void loadSuppliers();
	}

	// ── Filter tab suppliers: persist filters + searching skeleton ──
	async function onSupplierFilterChange() {
		saveDataTablePrefs(PREFS_KEY, {
			filters: { status: supplierStatusFilter || null },
			cardFields: cardFieldIds
		});
		suppliersPage = 1;
		currentPagingPage = 1;
		await loadSuppliers();
	}

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
						status: supplierStatusFilter || undefined,
						search: (searchQuery ?? '').trim() || undefined,
						sortField: sortField || undefined,
						sortDirection: sortField ? sortDirection : undefined
					}
				},
				encryptionKeys
			);
			suppliersLoading = false;
			searching = false;
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
			searching = false;
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
		if (activeTab === 'suppliers') {
			await onSupplierFilterChange();
			return;
		}
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
			width: '220px',
			accessor: (row) => (row as unknown as SupplierRow).name ?? '—'
		},
		{
			id: 'contact',
			label: pageContents.supplierTable.contact[lang],
			sortable: true,
			accessor: (row) => {
				const r = row as unknown as SupplierRow;
				return r.contactPerson || r.phones?.[0] || '—';
			}
		},
		{
			id: 'address',
			label: pageContents.supplierTable.address[lang],
			accessor: (row) => {
				const r = row as unknown as SupplierRow;
				return r.address || r.addresses?.[0]?.address || '—';
			},
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
		},
		{
			id: 'updatedAt',
			label: pageContents.supplierTable.updatedAt[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as SupplierRow & { updatedAt?: string | null }).updatedAt),
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

	// ── Modal tạo/sửa nhà cung cấp ──
	function emptySupplierForm() {
		return {
			name: '',
			contactPerson: '',
			address: '',
			phones: [] as string[],
			emails: [] as string[],
			addresses: [] as SupplierAddressEntry[],
			zalo: '',
			telegram: '',
			discord: '',
			facebook: '',
			images: [] as string[],
			avatarUrl: '',
			note: '',
			status: 'active'
		};
	}

	function openSupplierModal() {
		supplierEditMode = 'create';
		supplierEditId = null;
		// Draft create có dữ liệu → resume; rỗng → form sạch
		const raw = readDraftPref(DRAFT_FORM_KEY);
		let resumed = false;
		if (typeof raw === 'string' && raw) {
			try {
				const saved = JSON.parse(raw) as Partial<typeof supplierForm>;
				if (saved && typeof saved === 'object' && saved.name) {
					// BẪY: mảng từ draft JSON có thể chứa null (Input unmount emit
					// undefined qua bind → JSON.stringify biến thành null) → x.trim() nổ
					const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
					supplierForm = {
						...emptySupplierForm(),
						...saved,
						phones: arr(saved.phones),
						emails: arr(saved.emails),
						addresses: Array.isArray(saved.addresses) ? saved.addresses : [],
						images: arr(saved.images),
						avatarUrl: saved.avatarUrl ?? '',
						note: saved.note ?? '',
						status: saved.status ?? 'active'
					};
					resumed = true;
				}
			} catch {
				clearDraftPref(DRAFT_FORM_KEY);
			}
		}
		if (!resumed) supplierForm = emptySupplierForm();
		supplierAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.province ?? '',
			district: a.district ?? '',
			ward: a.ward
		}));
		supplierError = undefined;
		supplierModalDisplay = true;
		if (resumed) showToast(pageContents.toasts.draftRestored[lang], 'success');
		closeGuard.markClean();
	}

	// ── Edit: prefill form từ row của bảng (dùng chung form với create) ──
	function openSupplierEditModal(row: Record<string, unknown>) {
		const r = row as unknown as SupplierRow;
		supplierEditMode = 'edit';
		supplierEditId = r._id ?? null;
		const addr0 = r.addresses?.[0];
		supplierForm = {
			name: r.name ?? '',
			contactPerson: r.contactPerson ?? '',
			// cấp 1 = entry đầu của addresses (bỏ field đơn)
			address: addr0?.address ?? r.address ?? '',
			phones: [...(r.phones ?? [])],
			emails: [...(r.emails ?? [])],
			addresses: (r.addresses ?? []).map((a) => ({ ...a })),
			zalo: (r as Record<string, unknown>).zalo as string | undefined ?? '',
			telegram: (r as Record<string, unknown>).telegram as string | undefined ?? '',
			discord: (r as Record<string, unknown>).discord as string | undefined ?? '',
			facebook: (r as Record<string, unknown>).facebook as string | undefined ?? '',
			images: [...(r.images ?? [])],
			avatarUrl: (r as Record<string, unknown>).avatarUrl as string | undefined ?? r.images?.[0] ?? '',
			note: (r as Record<string, unknown>).note as string | undefined ?? '',
			status: r.status ?? 'active'
		};
		supplierAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.province ?? '',
			district: a.district ?? '',
			ward: a.ward
		}));
		supplierError = undefined;
		supplierModalDisplay = true;
		closeGuard.markClean();
	}

	// ── Validate social theo từng mạng + phone/email (regex thuần trang tự giữ) ──
	const PHONE_RE = /^(\+?84|0)(\d{8,10})$/;
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const ZALO_RE = /^(\+?84|0)\d{8,10}$|^https?:\/\/(zalo\.me\/\S+)$/i;
	const TELEGRAM_RE = /^@[A-Za-z0-9_]{4,32}$|^https?:\/\/(t\.me\/\S+)$/i;
	const DISCORD_RE = /^[A-Za-z0-9._]{2,32}$/;
	const FACEBOOK_RE = /^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/\S+$/i;

	function validateSupplierForm(): string | undefined {
		if (!supplierForm.name.trim()) {
			return pageContents.form.requireName[lang];
		}
		const t = supplierForm;
		if (t.phones.some((p) => p.trim() && !PHONE_RE.test(p.trim()))) return pageContents.form.invalidPhone[lang];
		if (t.emails.some((e) => e.trim() && !EMAIL_RE.test(e.trim()))) return pageContents.form.invalidEmail[lang];
		if (t.zalo.trim() && !ZALO_RE.test(t.zalo.trim())) return pageContents.form.invalidZalo[lang];
		if (t.telegram.trim() && !TELEGRAM_RE.test(t.telegram.trim())) return pageContents.form.invalidTelegram[lang];
		if (t.discord.trim() && !DISCORD_RE.test(t.discord.trim())) return pageContents.form.invalidDiscord[lang];
		if (t.facebook.trim() && !FACEBOOK_RE.test(t.facebook.trim())) return pageContents.form.invalidFacebook[lang];
		return undefined;
	}

	// ── STT tag + cảnh báo trùng: trả map value→số lần xuất hiện (>=2 = dup) ──
	function countDuplicates(values: string[]): Map<string, number> {
		const counts = new Map<string, number>();
		for (const v of values) {
			const key = v.trim().toLowerCase();
			if (!key) continue;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return counts;
	}

	const phoneDupCounts = $derived(countDuplicates(supplierForm.phones));
	const emailDupCounts = $derived(countDuplicates(supplierForm.emails));
	const addressDupCounts = $derived(countDuplicates(supplierForm.addresses.map((a) => a.address ?? '')));
	const hasDuplicates = $derived(
		[...phoneDupCounts.values(), ...emailDupCounts.values(), ...addressDupCounts.values()].some((n) => n >= 2)
	);

	function buildSupplierPayload() {
		const t = supplierForm;
		// breakdown từng entry (bind 2 chiều với AddressInput) merge lại vào addresses
		const entries = t.addresses.map((a, i) => {
			const bd = supplierAddressBreakdowns[i];
			return {
				label: (a.label ?? '').trim() || undefined,
				address: (a.address ?? '').trim(),
				ward: (bd?.ward || a.ward || '').trim() || undefined,
				province: (bd?.province || a.province || '').trim() || undefined,
				district: (bd?.district || a.district || '').trim() || undefined,
				country: (bd?.province || a.province || '').trim() ? 'Việt Nam' : undefined
			};
		});
		// Cấp 1 = entry đầu (địa chỉ chính) — đồng bộ field legacy address/district/province
		const main = entries[0];
		// avatarUrl là CON TRỎ vào 1 URL trong images (nếu images có mà avatar không
		// khớp URL nào → dùng ảnh đầu)
		const images = t.images.map((u) => u.trim()).filter(Boolean);
		const avatar = images.includes(t.avatarUrl) ? t.avatarUrl : (images[0] ?? '');
		return {
			name: t.name.trim(),
			contactPerson: t.contactPerson.trim() || undefined,
			address: main?.address || undefined,
			ward: main?.ward || undefined,
			district: main?.district || undefined,
			province: main?.province || undefined,
			country: main?.country || undefined,
			phones: t.phones.map((p) => p.trim()).filter(Boolean),
			emails: t.emails.map((e) => e.trim()).filter(Boolean),
			addresses: entries.filter((a) => a.address),
			zalo: t.zalo.trim() || undefined,
			telegram: t.telegram.trim() || undefined,
			discord: t.discord.trim() || undefined,
			facebook: t.facebook.trim() || undefined,
			images: images.length > 0 ? images : undefined,
			avatarUrl: avatar || undefined,
			note: t.note.trim() || undefined,
			status: t.status
		};
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
			const isEdit = supplierEditMode === 'edit' && !!supplierEditId;
			const response = await encryption.fetchSecure(
				isEdit ? '/api/admin/suppliers/update' : '/api/admin/suppliers/create',
				{
					method: 'POST',
					body: isEdit
						? { supplierId: supplierEditId, patch: buildSupplierPayload() }
						: buildSupplierPayload()
				},
				encryptionKeys
			);
			supplierSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, isEdit ? pageContents.toasts.supplierUpdated : pageContents.toasts.supplierCreated)
						: isEdit ? pageContents.toasts.supplierUpdated[lang] : pageContents.toasts.supplierCreated[lang],
					'success'
				);
				if (!isEdit) clearDraft(); // create thành công → xoá draft
				closeGuard.markClean(); // đóng programmatic không qua onCloseAttempt
				supplierModalDisplay = false;
				await loadSuppliers();
			} else {
				supplierError = resolveServerMessage(response.message, lang, isEdit ? pageContents.toasts.supplierUpdateFailed : pageContents.toasts.supplierFailed);
			}
		} catch (err) {
			supplierSubmitting = false;
			supplierError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/suppliers] submit supplier failed:', err);
		}
	}

	// ── Bulk copy (TSV: header + các cột đang hiển thị) + bulk delete ──
	function bulkCopySelected() {
		const cols = supplierColumns.filter((c) => c.id !== 'actions' && typeof c.accessor === 'function');
		const header = cols.map((c) => String(c.label)).join('\t');
		const rows = suppliers
			.filter((s) => s._id && selectedIds.includes(s._id))
			.map((s) => cols.map((c) => String((c.accessor as (row: unknown) => unknown)(s) ?? '')).join('\t'));
		const tsv = [header, ...rows].join('\n');
		navigator.clipboard
			.writeText(tsv)
			.then(() => showToast(pageContents.toasts.bulkCopied[lang].replace('{count}', String(selectedIds.length)), 'success'))
			.catch(() => showToast(pageContents.toasts.requestFailed[lang], 'error'));
	}

	async function bulkDeleteSelected() {
		if (!encryptionKeys || bulkDeleting || selectedIds.length === 0) return;
		bulkDeleting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/bulk-delete',
				{ method: 'POST', body: { ids: selectedIds } },
				encryptionKeys
			);
			bulkDeleting = false;
			if (response.ok) {
				const data = response.data as { deleted?: number } | undefined;
				showToast(pageContents.toasts.bulkDeleted[lang].replace('{count}', String(data?.deleted ?? selectedIds.length)), 'success');
				bulkDeleteDisplay = false;
				selectedIds = [];
				await loadSuppliers();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.bulkDeleteFailed), 'error');
			}
		} catch (err) {
			bulkDeleting = false;
			showToast(pageContents.toasts.bulkDeleteFailed, 'error');
			if (import.meta.env.DEV) console.error('[admin/suppliers] bulk delete failed:', err);
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
		// Restore prefs TRƯỚC load (pattern purchases): sort + cardFields
		const prefs = userPrefs.datatable?.[PREFS_KEY];
		if (prefs?.sort?.field) {
			sortField = prefs.sort.field;
			sortDirection = prefs.sort.direction === 'asc' ? 'asc' : 'desc';
		}
		cardFieldIds = prefs?.cardFields?.length ? [...prefs.cardFields] : ['name', 'status', 'contact', 'address'];
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadSuppliers()]);
		draftHydrated = true; // mở khoá draft auto-save sau khi store đã hydrate từ layout
	});

	// ── Draft auto-save (yêu cầu 1k): form create có dữ liệu → debounce 500ms
	// ghi DB qua user-prefs (draft = filters key 'draft'). Edit mode KHÔNG draft
	// (đang sửa row thật — reload mất là hợp lý, draft chỉ cho create).
	$effect(() => {
		if (!draftHydrated || supplierEditMode !== 'create') return;
		// Track SÂU từng field — `void supplierForm` chỉ track reference, mutate
		// property (bind:value gõ chữ) KHÔNG re-run effect → draft không bao giờ save.
		void supplierForm.name;
		void supplierForm.contactPerson;
		void supplierForm.address;
		void supplierForm.phones;
		void supplierForm.emails;
		void supplierForm.addresses;
		void supplierForm.zalo;
		void supplierForm.telegram;
		void supplierForm.discord;
		void supplierForm.facebook;
		void supplierForm.images;
		void supplierForm.avatarUrl;
		void supplierForm.note;
		void supplierForm.status;
		if (supplierForm.name.trim() || supplierForm.phones.length > 0 || supplierForm.emails.length > 0) {
			saveDraftDebounced();
		}
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page">

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

	<!-- (admin-filters ĐÃ BỎ — filter chuyển vào DataTable captionTools, yêu cầu 7) -->

	<!-- ── Tab SUPPLIERS ── -->
	{#if activeTab === 'suppliers'}
		{#if suppliersError}
			<div class="admin-state error" role="alert">
				<p class="state-title">{pageContents.states.errorTitleSuppliers[lang]}</p>
				<p class="state-detail">{suppliersError}</p>
				<Button color="primary" variant="outline" onClick={loadSuppliers}>{pageContents.states.retry[lang]}</Button>
			</div>
		{:else}
			<!-- DataTable — server-side paging + server sort + server search:
					paging trong DataTable TẮT (Pagination footer), sort/search qua
					onSortChange/captionTools (pattern purchases). Card mode mobile qua
					cardFields + mobileTapMode="callback". Yêu cầu 2: selectable + STT
					hover → checkbox + bulk copy/delete qua bulk-bar trong caption. -->
			<div class="admin-table-wrap">
				<DataTable
					data={suppliersAny}
					columns={supplierColumns}
					pageSize={pageSize}
					showPagination={false}
					sortable
					sortMode="server"
					bind:sortColumn={sortField}
					bind:sortDirection={sortDirection}
					onSortChange={onSupplierSortChange}
					resizable={{ enabled: true, fit: true }}
					loading={suppliersLoading && !suppliersLoadedOnce || searching}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.emptySuppliers[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					caption={{ vi: 'Danh sách nhà cung cấp', en: 'Suppliers list' }}
					captionDescription={{ vi: 'Tìm kiếm, sắp xếp và quản lý nhà cung cấp', en: 'Search, sort and manage suppliers' }}
					cardFields={cardFieldIds}
					mobileTapMode="callback"
					onRowClick={(row) => openSupplierEditModal(row)}
					actionsLabel={{ vi: pageContents.supplierTable.actions[lang], en: pageContents.supplierTable.actions[lang] }}
					stickyHead
					selectable
					showIndex
					indexOffset={(suppliersPage - 1) * pageSize}
					indexCheckboxes
					checkOnRowClick
					selectionTools={false}
					onSelectionChange={(ids) => (selectedIds = ids)}
					data-test="suppliers-datatable"
				>
					{#snippet captionTools()}
						<!-- BẪY: searchQuery có thể undefined (card mode unmount Input) → ?? ''.
							Bulk-bar KHÔNG swap thay search (Input unmount → onDestroy emit value=undefined
							→ $effect search → searching=true → skeleton → mất selection hiển thị).
							Chỉ THÊM bulk-bar cạnh search — pattern purchases (bulk-bar cuối captionTools). -->
						{#if selectedIds.length > 0}
							<!-- bulk-bar khi chọn ≥1 row -->
							<div class="bulk-bar" data-test="suppliers-bulk-bar">
								<span class="bulk-count">{pageContents.bulk.selected[lang].replace('{count}', String(selectedIds.length))}</span>
								<Button color="primary" variant="soft" size="sm" onClick={bulkCopySelected}>
									{pageContents.bulk.copy[lang]}
								</Button>
								<Button color="error" variant="soft" size="sm" onClick={() => { bulkDeleteDisplay = true; }} data-test="suppliers-bulk-delete">
									{pageContents.bulk.delete[lang]}
								</Button>
								<Button color="default" variant="ghost" size="sm" onClick={() => { selectedIds = []; }}>
									<Icon icon={iconify['close-rounded']} size="sm" />
								</Button>
							</div>
						{/if}
							<div class="admin-search" data-suggest>
								<Input
									type="text"
									size="sm"
									placeholder={{ vi: 'Tìm NCC, SĐT, email…', en: 'Search name, phone, email…' }}
									bind:value={searchQuery}
									events={[
										{
											events: {
												focus: {
													handler() {
														searchFocused = true;
														suggestOpen = true;
													}
												},
												blur: {
													handler() {
														searchFocused = false;
														suggestOpen = false; // yêu cầu 5: blur → ẩn popover đúng flow
														saveSearchKeyword();
													}
												}
											}
										}
									]}
								>
									{#snippet leading(data)}
										{#if searching}
											<!-- yêu cầu 9: đang chờ kết quả → icon thành spinner loading -->
											<span class="admin-search-loading">
												<Spinner size="xs" pattern="circle" />
											</span>
										{:else}
											<Icon
												icon={iconify['search-rounded']}
												size={(data?.size ?? 'sm') as Size}
												class={mergeIconClasses(data?.defaultStyles, 'admin-search-icon')}
											/>
										{/if}
									{/snippet}
								</Input>
								<!-- yêu cầu 6: ĐÃ BỎ nút clear riêng — Input component có sẵn clear button -->
								{#if suggestOpen && getSearchKeywords(PREFS_KEY).length > 0}
									<div class="suggest-popover" role="listbox">
										<p class="suggest-title">{pageContents.suggest.title[lang]}</p>
										{#each getSearchKeywords(PREFS_KEY) as kw (kw)}
											<button
												type="button"
												class="suggest-item"
												role="option"
												aria-selected="false"
												onmousedown={(e) => e.preventDefault()}
												onclick={() => {
													searchQuery = kw;
													suggestOpen = false;
													suppliersPage = 1;
													currentPagingPage = 1;
													void loadSuppliers();
												}}
											>
												{kw}
											</button>
										{/each}
									</div>
								{/if}
							</div>
							<!-- yêu cầu 7: filter VÀO caption (bỏ admin-filters row) -->
							<select
								class="admin-select"
								bind:value={supplierStatusFilter}
								onchange={onFilterChange}
								data-test="suppliers-filter-status"
							>
								<option value="">{pageContents.filters.allStatuses[lang]}</option>
								{#each SUPPLIER_STATUSES as status (status)}
									<option value={status}>{status === 'active' ? pageContents.supplierModal.statusActive[lang] : pageContents.supplierModal.statusInactive[lang]}</option>
								{/each}
							</select>
							<!-- nút create vào caption (yêu cầu 3: bỏ admin-header) -->
							<div class="admin-actions-group">
								<Button color="default" variant="outline" size="sm" onClick={refresh} aria-label={pageContents.states.retry[lang]}>
									<Icon icon={iconify['tune-rounded']} size="sm" />
								</Button>
								<!-- Quy ước màu nút: create = success -->
								<Button color="success" size="sm" onClick={openSupplierModal} data-test="suppliers-create-btn">
									{pageContents.actions.createSupplier[lang]}
								</Button>
							</div>
					{/snippet}
					{#snippet actionsContent(row)}
						{@const supplier = row as unknown as SupplierRow}
						<div class="row-actions">
							<!-- update/edit = primary -->
							<Button color="primary" variant="ghost" size="sm" onClick={() => openSupplierEditModal(row)}>
								{pageContents.actions.edit[lang]}
							</Button>
						</div>
					{/snippet}
				</DataTable>
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
					{#snippet captionTools()}
						<!-- yêu cầu 7: filter PO vào caption -->
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
						<div class="admin-actions-group">
							<Button color="default" variant="outline" size="sm" onClick={refresh} aria-label={pageContents.states.retry[lang]}>
								<Icon icon={iconify['tune-rounded']} size="sm" />
							</Button>
							<Button color="success" size="sm" onClick={openPOModal} data-test="po-create-btn">
								{pageContents.actions.createPO[lang]}
							</Button>
						</div>
					{/snippet}
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

	<!-- ── FAB mobile (pattern purchases): nút chính toggle menu, mục menu = create theo tab ── -->
	{#if mobileFabOpen}
		<div class="fab-menu-backdrop" onclick={() => (mobileFabOpen = false)} aria-hidden="true"></div>
	{/if}
	<div class="fab-group" data-suggest>
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.states.retry[lang]}
			onclick={refresh}
		>
			<Icon icon={iconify['tune-rounded']} />
		</button>
		<button
			type="button"
			class="fab fab--primary"
			aria-label={pageContents.actions.createSupplier[lang]}
			data-test="suppliers-fab"
			onclick={() => (mobileFabOpen = !mobileFabOpen)}
		>
			<Icon icon={mobileFabOpen ? iconify['close-rounded'] : iconify['add-rounded']} />
		</button>
		{#if mobileFabOpen}
			<div class="fab-menu" role="menu">
				<button
					type="button"
					class="fab-menu-item"
					role="menuitem"
					onclick={() => {
						mobileFabOpen = false;
						if (activeTab === 'suppliers') openSupplierModal();
						else openPOModal();
					}}
				>
					{activeTab === 'suppliers' ? pageContents.actions.createSupplier[lang] : pageContents.actions.createPO[lang]}
				</button>
				<button
					type="button"
					class="fab-menu-item"
					role="menuitem"
					onclick={() => {
						mobileFabOpen = false;
						void refresh();
					}}
				>
					{pageContents.states.retry[lang]}
				</button>
			</div>
		{/if}
	</div>
</section>

<!-- ── Modal tạo/sửa nhà cung cấp (dùng chung form; dirty-guard qua onCloseAttempt) ── -->
{#if supplierModalDisplay}
	<Modal
		bind:display={supplierModalDisplay}
		size="lg"
		isDimissable
		onCloseAttempt={() => closeGuard.attemptClose()}
	>
		<Modal.Container>
			<Modal.Container.Header>
				{supplierEditMode === 'edit' ? pageContents.supplierModal.titleEdit[lang] : pageContents.supplierModal.title[lang]}
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if supplierError}
					<div class="form-error-banner" role="alert">{supplierError}</div>
				{/if}
				{#if hasDuplicates}
					<div class="form-error-banner form-dup-banner" role="alert">
						{pageContents.supplierModal.duplicateWarn[lang]}
					</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<!-- yêu cầu 1e: dùng Input component (không native input) -->
						<TextField name="supplier-name" required>
							<Label>{pageContents.supplierModal.name[lang]}</Label>
							<Input
								type="text"
								bind:value={supplierForm.name}
								disabled={supplierSubmitting}
								data-test="supplier-form-name"
							/>
						</TextField>
						<TextField name="supplier-contact">
							<Label>{pageContents.supplierModal.contact[lang]}</Label>
							<Input
								type="text"
								bind:value={supplierForm.contactPerson}
								disabled={supplierSubmitting}
							/>
						</TextField>
					</div>
					<!-- ── Hình ảnh multiple (yêu cầu 1b: add button row riêng, 1c hover action, 1d bỏ change/remove riêng) ── -->
					<ImageUpload
						images={supplierForm.images}
						bind:avatarUrl={supplierForm.avatarUrl}
						label={pageContents.supplierModal.images[lang]}
						disabled={supplierSubmitting}
					/>
					<!-- ── Phones + emails multiple: Badge STT + Input component ── -->
					<div class="form-grid" style="gap: 0.5rem;">
						{#each supplierForm.phones as phone, phoneIndex (phoneIndex)}
							<div class="field-row" class:field-row--dup={(phoneDupCounts.get(phone.trim().toLowerCase()) ?? 0) >= 2}>
								<Badge label={String(phoneIndex + 1)} size="xs" variant="soft" color={(phoneDupCounts.get(phone.trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-phone-stt-${phoneIndex}`} />
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
						{#each supplierForm.emails as email, emailIndex (emailIndex)}
							<div class="field-row" class:field-row--dup={(emailDupCounts.get(email.trim().toLowerCase()) ?? 0) >= 2}>
								<Badge label={String(emailIndex + 1)} size="xs" variant="soft" color={(emailDupCounts.get(email.trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-email-stt-${emailIndex}`} />
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
					<!-- ── Multiple addresses (yêu cầu 1g: BỎ address đơn — block này là duy nhất;
					     entry đầu = địa chỉ chính cho payload cấp 1) ── -->
					<div class="items-block">
						<span class="form-label">{pageContents.supplierModal.addresses[lang]}</span>
						{#each supplierForm.addresses as entry, addrIndex (addrIndex)}
							<div class="address-entry" class:field-row--dup={(addressDupCounts.get((entry.address ?? '').trim().toLowerCase()) ?? 0) >= 2}>
								<div class="address-entry__head">
									<Badge label={String(addrIndex + 1)} size="xs" variant="soft" color={(addressDupCounts.get((entry.address ?? '').trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-address-stt-${addrIndex}`} />
									<Input
										type="text"
										bind:value={entry.label}
										placeholder={pageContents.supplierModal.addressLabelPlaceholder[lang]}
										disabled={supplierSubmitting}
										size="sm"
									/>
									<button
										type="button"
										class="field-row-remove"
										aria-label={pageContents.supplierModal.removeAddress[lang]}
										disabled={supplierSubmitting}
										onclick={() => {
											supplierForm.addresses = supplierForm.addresses.filter((_, i) => i !== addrIndex);
											supplierAddressBreakdowns = supplierAddressBreakdowns.filter((_, i) => i !== addrIndex);
										}}
									>✕</button>
								</div>
								<AddressInput
									bind:value={entry.address}
									bind:breakdown={supplierAddressBreakdowns[addrIndex]}
									placeholder={pageContents.supplierModal.addressPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</div>
						{/each}
						<button
							type="button"
							class="field-add"
							disabled={supplierSubmitting}
							onclick={() => {
								supplierForm.addresses = [...supplierForm.addresses, { label: '', address: '', province: '', district: '' }];
								supplierAddressBreakdowns = [...supplierAddressBreakdowns, { province: '', district: '', ward: '' }];
							}}
						>+ {pageContents.supplierModal.addAddress[lang]}</button>
					</div>
					<!-- ── Social block: Input component (yêu cầu 1e) ── -->
					<div class="items-block social-block">
						<span class="form-label">{pageContents.supplierModal.social[lang]}</span>
						<div class="form-grid-2">
							<TextField name="supplier-zalo">
								<Label>{pageContents.supplierModal.zalo[lang]}</Label>
								<Input
									type="text"
									bind:value={supplierForm.zalo}
									placeholder={pageContents.supplierModal.zaloPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</TextField>
							<TextField name="supplier-telegram">
								<Label>{pageContents.supplierModal.telegram[lang]}</Label>
								<Input
									type="text"
									bind:value={supplierForm.telegram}
									placeholder={pageContents.supplierModal.telegramPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</TextField>
							<TextField name="supplier-discord">
								<Label>{pageContents.supplierModal.discord[lang]}</Label>
								<Input
									type="text"
									bind:value={supplierForm.discord}
									placeholder={pageContents.supplierModal.discordPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</TextField>
							<TextField name="supplier-facebook">
								<Label>{pageContents.supplierModal.facebook[lang]}</Label>
								<Input
									type="text"
									bind:value={supplierForm.facebook}
									placeholder={pageContents.supplierModal.facebookPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</TextField>
						</div>
					</div>
					<!-- ── Note long text (yêu cầu 1i) ── -->
					<TextField name="supplier-note">
						<Label>{pageContents.supplierModal.note[lang]}</Label>
						<Textarea
							bind:value={supplierForm.note}
							placeholder={pageContents.supplierModal.notePlaceholder[lang]}
							rows={3}
							autoResize
							maxLength={2000}
							disabled={supplierSubmitting}
							data-test="supplier-form-note"
						/>
					</TextField>
					<!-- ── Status: Switch (yêu cầu 1f: giảm thao tác) ── -->
					<div class="form-field">
						<span class="form-label">{pageContents.supplierModal.status[lang]}</span>
						<Switch
							checked={supplierForm.status === 'active'}
							label={supplierForm.status === 'active' ? pageContents.supplierModal.statusActive[lang] : pageContents.supplierModal.statusInactive[lang]}
							disabled={supplierSubmitting}
							color="success"
							onchange={(checked) => (supplierForm.status = checked ? 'active' : 'inactive')}
							data-test="supplier-form-status"
						/>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitSupplier} loading={supplierSubmitting} disabled={supplierSubmitting}>
					{supplierEditMode === 'edit' ? pageContents.supplierModal.save[lang] : pageContents.supplierModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={supplierSubmitting}
					onClick={() => {
						closeGuard.attemptClose();
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog dirty-close (pattern purchases/brands) ── -->
{#if dirtyCloseDisplay}
	<AlertDialog bind:open={dirtyCloseDisplay} title={pageContents.dirty.title[lang]} description={pageContents.dirty.desc[lang]}>
		<AlertDialog.Content>
			<AlertDialog.Header variant="info">
				<AlertDialog.Title>{pageContents.dirty.title[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.dirty.desc[lang]}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.dirty.continueEdit[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action
					color="primary"
					onselect={() => {
						// confirmDiscard → close() → supplierModalDisplay=false; AlertDialog tự đóng qua bind:open
						closeGuard.confirmDiscard();
					}}
				>
					{pageContents.dirty.discard[lang]}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog>
{/if}

<!-- ── AlertDialog bulk-delete (yêu cầu 2: xóa hàng loạt qua confirm) ── -->
{#if bulkDeleteDisplay}
	<AlertDialog bind:open={bulkDeleteDisplay} title={pageContents.bulk.title[lang]} description={pageContents.bulk.desc[lang]}>
		<AlertDialog.Content>
			<AlertDialog.Header variant="danger">
				<AlertDialog.Title>{pageContents.bulk.title[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.bulk.desc[lang].replace('{count}', String(selectedIds.length))}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.bulk.cancel[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action
					color="danger"
					disabled={bulkDeleting}
					onselect={() => {
						void bulkDeleteSelected();
					}}
				>
					{pageContents.bulk.confirm[lang]}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog>
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

	/* ── Tab-strip: sticky khi cuộn (yêu cầu 4 — scroll to bottom giữ tab-strip) ── */
	.tab-strip {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid var(--default-200);
		background: var(--background);
		position: sticky;
		top: 0;
		z-index: 20;
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
		// Cột phải (phones/emails multiple) tự dồn lên đầu — không stretch
		// theo cột trái (avatar cao) → hết khoảng trống dọc bất đối xứng.
		align-items: start;

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

	/* ── Search trong captionTools (pattern purchases) ── */
	.admin-search {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.admin-search-icon {
		opacity: 0.6;
	}

	.admin-search-loading {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
	}

	/* Suggest popover từ khoá đã tìm */
	.suggest-popover {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		min-width: 14rem;
		max-height: 16rem;
		overflow-y: auto;
		background: var(--background);
		border: 1px solid var(--default-300);
		border-radius: 0.65rem;
		box-shadow: var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
		padding: 0.35rem;
		z-index: 50;
	}

	.suggest-title {
		margin: 0.25rem 0.5rem;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--foreground-500);
	}

	.suggest-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.45rem 0.6rem;
		border: none;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--foreground);
		font-size: 0.85rem;
		cursor: pointer;

		&:hover {
			background: var(--default-100);
		}
	}

	/* ── Caption tools: actions-group (create/refresh) + bulk-bar (yêu cầu 2/3/7) ── */
	.admin-actions-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.bulk-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.bulk-count {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.field-row--dup {
		& > :global(.input-root),
		& > :global(.address-input),
		& > .admin-input {
			border-color: var(--error);
		}
	}

	.form-dup-banner {
		background: color-mix(in oklab, var(--error) 8%, transparent);
		border-left-color: var(--error);
	}

	/* ── Multiple addresses: entry block ── */
	.address-entry {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.6rem;
		border: 1px solid var(--default-200);
		border-radius: 0.6rem;

		&.field-row--dup {
			border-color: var(--error);
		}
	}

	.address-entry__head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.address-entry__label {
		flex: 1;
		height: 2.25rem;
	}

	.social-block {
		border-style: solid;
	}

	/* ── FAB mobile (pattern purchases) ── */
	.fab-group {
		position: fixed;
		right: 1rem;
		bottom: 7.25rem;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.6rem;
		z-index: 400;

		@media (min-width: 768px) {
			display: none;
		}
	}

	.fab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border: 1px solid var(--default-300);
		box-shadow: var(--shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1));
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;

		&:active {
			transform: scale(0.96);
		}
	}

	.fab--primary {
		width: 3.25rem;
		height: 3.25rem;
		background: var(--primary);
		color: var(--primary-contrast, #fff);
		border-color: transparent;
	}

	.fab--secondary {
		width: 2.75rem;
		height: 2.75rem;
		background: var(--background);
		color: var(--foreground);
	}

	.fab-menu {
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.5rem);
		min-width: 11rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		background: var(--background);
		border: 1px solid var(--default-200);
		border-radius: 0.75rem;
		box-shadow: var(--shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
		padding: 0.35rem;
	}

	.fab-menu-item {
		text-align: left;
		padding: 0.55rem 0.75rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--foreground);
		font-size: 0.875rem;
		cursor: pointer;
		white-space: nowrap;

		&:hover {
			background: var(--default-100);
		}
	}

	.fab-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 390;

		@media (min-width: 768px) {
			display: none;
		}
	}

	/* Fullheight padding bottom cho FAB (pattern purchases) — FAB group 2 nút
	   chồng dọc cao ~7rem + pagination ~3rem → đệm 12rem để card cuối và
	   pagination không bị FAB fixed che khi cuộn hết danh sách */
	@media (max-width: 767px) {
		.admin-page {
			padding-bottom: 12rem;
		}
		/* FAB fixed góc phải đè "Rows: 20" (page-size) khi cuộn — chừa chỗ phải */
		.admin-pagination {
			padding-right: 4.75rem;
		}
	}
</style>
