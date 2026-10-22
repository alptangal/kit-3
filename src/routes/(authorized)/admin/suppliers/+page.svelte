<!-- src/routes/(authorized)/admin/suppliers/+page.svelte -->
<script lang="ts">
	import { tick } from 'svelte';
	import { Button, DataTable, Pagination, AlertDialog, Badge, Spinner } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { EmailInput, ImageUpload, Input, Label, PhoneInput, Select, Switch, TextField, Textarea, AddressInput } from '$components/form';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import type { Size } from '$components/interface';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDate as formatDateShared } from '$modules/i18n';
	import { onMount } from 'svelte';	import { page } from '$app/state';
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

	// BẪY: form state/draft có thể chứa null/undefined (Input unmount emit
	// undefined qua bind; JSON.stringify draft biến thành null) → .trim() trực
	// tiếp nổ "can't access property trim ... is undefined" (console prod).
	// Mọi site .trim() trên form state đi qua helper này.
	const str = (v: unknown): string => (typeof v === 'string' ? v : '');

	const SUPPLIER_STATUSES = ['active', 'inactive'] as const;
	const PO_STATUSES = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'] as const;

	// ── Options cho Select component filter (yêu cầu batch 3: tái sử dụng Select
	// thay select native cho cả 4 filter). Value '' = tất cả (giữ parity select cũ).
	const supplierStatusOptions = $derived(
		SUPPLIER_STATUSES.map((s) => ({
			value: s,
			label: s === 'active' ? pageContents.supplierModal.statusActive[lang] : pageContents.supplierModal.statusInactive[lang]
		}))
	);
	const poStatusOptions = $derived(PO_STATUSES.map((s) => ({ value: s, label: poStatusLabel(s) })));

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
	// Mobile caption (yêu cầu 2c): search icon → text field; filter status vào
	// popover từ nút tune; create → icon button. isMobile từ client store.
	const isMobile = $derived(client.browser?.isMobile ?? false);
	let mobileSearchOpen = $state(false);
	let mobileFilterOpen = $state(false);
	// bind:this Input component → instance { configs } (export { configs } cuối
	// Input/Main.svelte) — focus() qua instance.configs.focus().
	let mobileSearchInputInstance = $state<{ configs: { focus: () => void } } | undefined>(undefined);
	let sortField = $state('');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	let branches = $state<BranchOption[]>([]);
	let variantOptions = $state<VariantOption[]>([]);

	// Options Select filter PO (bắt buộc value string — lọc row thiếu _id)
	const poBranchOptions = $derived(branches.map((b) => ({ value: b._id, label: b.name ?? b._id })));
	const poSupplierOptions = $derived(
		suppliers
			.filter((s): s is SupplierRow & { _id: string } => typeof s._id === 'string')
			.map((s) => ({ value: s._id, label: s.name ?? s._id }))
	);
	// ── Sticky at-bottom (pattern purchases: cuộn tới đáy bảng → bỏ padding
	// caption/pagination + inset để tối đa không gian row; rời đáy → trả lại) ──
	let wrapEl = $state<HTMLElement | undefined>(undefined);
	let tableScrolled = $state(false);
	let wrapAtBottom = $state(false);
	let paginationPopped = $state(false);
	let scrollRaf = 0;
	function onTableScroll() {
		const el = wrapEl;
		if (!el) return;
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			const scrollTop = el.scrollTop;
			// BẪY: nếu nội dung vừa màn (scrollHeight ≈ clientHeight) thì atBottom
			// luôn true → kẹt trạng thái thu padding vĩnh viễn. Chỉ coi là "đáy"
			// khi wrap thực sự scrollable.
			const scrollable = el.scrollHeight > el.clientHeight + 4;
			const atBottom = scrollable && scrollTop + el.clientHeight >= el.scrollHeight - 4;
			tableScrolled = scrollTop > 8;
			wrapAtBottom = atBottom;
			if (atBottom && !paginationPopped) {
				paginationPopped = true;
				setTimeout(() => (paginationPopped = false), 450);
			} else if (!atBottom) {
				paginationPopped = false;
			}
		});
	}

	// ── Modal tạo/sửa nhà cung cấp ──
	let supplierModalDisplay = $state(false);
	let supplierSubmitting = $state(false);
	let supplierError = $state<string | undefined>(undefined);
	// Ref Modal.Container.Body (element DOM) — dùng cho scroll-to-invalid khi submit
	let supplierModalBodyEl = $state<HTMLElement | undefined>(undefined);
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
	// ImageUpload defer ref — gọi uploadPending() khi submit, seedFromImages() khi mở modal
	let supplierImageUpload = $state<{
		uploadPending: () => Promise<string[] | string | undefined>;
		seedFromImages: (urls: string[]) => void;
		hasDeferPending: boolean;
	} | undefined>(undefined);

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
	// select-all 'filtered': DataTable đọc flag này (allPageSelected) — true khi
	// user đã chọn select-all toàn bộ kết quả filter (qua fetch ids).
	let allFilteredSelected = $state(false);
	let bulkDeleteDisplay = $state(false);
	let bulkDeleting = $state(false);

	// Select-all đa trang: fetch TẤT CẢ suppliers khớp filter hiện tại (page 1,
	// pageSize = total) rồi gán ids — mirror body loadSuppliers.
	async function selectAllFilteredSuppliers() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/list',
				{
					method: 'POST',
					body: {
						page: 1,
						pageSize: Math.max(suppliersTotal, 1),
						status: supplierStatusFilter || undefined,
						search: searchQuery?.trim() || undefined,
						sortField: sortField || undefined,
						sortDirection
					}
				},
				encryptionKeys
			);
			if (!response.ok) return;
			const data = response.data as { items?: Array<{ _id?: unknown }> } | undefined;
			selectedIds = (data?.items ?? [])
				.map((s) => s._id)
				.filter((id): id is string => typeof id === 'string');
			allFilteredSelected = selectedIds.length > 0;
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/suppliers] select-all filtered failed:', err);
		}
	}

	// clearSelection theo 2 chiều (bulk-bar close / bulk delete): DataTable
	// selected set + page selectedIds + flag all-filtered.
	function clearSuppliersSelection() {
		selectedIds = [];
		allFilteredSelected = false;
	}

	// Bulk count hiển thị: khi select-all toàn bộ kết quả filter → hiện TOTAL
	// (fetch ids bị thiếu 1 số row → count thật lệch; user chốt hiển thị total).
	const bulkDisplayCount = $derived(allFilteredSelected && suppliersTotal > selectedIds.length ? suppliersTotal : selectedIds.length);

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
	// Dirty-guard PO (chuẩn chung — mirror closeGuard NCC + quickDirty purchases):
	// snapshot JSON so với baseline → attemptClose hỏi discard khi dirty.
	let dirtyPOCloseDisplay = $state(false);
	const poDirty = $derived(poForm.poCode !== '' || poForm.supplierId !== '' || poForm.branchId !== '' || poForm.expectedAt !== '' || poForm.items.some((it) => it.variantId !== '' || it.lotNumber));
	const poCloseGuard = createCloseGuard({
		form: () => poForm,
		openConfirm: () => (dirtyPOCloseDisplay = true),
		close: () => {
			poModalDisplay = false;
			dirtyPOCloseDisplay = false;
		}
	});
	// Select component (chuẩn chung): option objects thay select native.
	const poSupplierModalOptions = $derived(
		poSupplierOptions.length > 0
			? poSupplierOptions
			: suppliers
				.filter((s): s is SupplierRow & { _id: string } => typeof s._id === 'string')
				.map((s) => ({ value: s._id, label: s.name ?? s._id }))
	);
	const poBranchModalOptions = $derived(branches.map((b) => ({ value: b._id, label: b.name ?? b._id })));
	const poVariantModalOptions = $derived(
		variantOptions.map((v) => ({ value: v._id, label: v.sku ? `${v.sku} — ${v.displayName ?? ''}` : (v.displayName ?? v._id) }))
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
				// Selection là id THẬT (getRowId _id) — giữ qua refetch; nhưng nếu
				// select-all filtered và total thay đổi (row mới/xóa) → drop flag để
				// user chọn lại (tránh bulk delete nhầm id ngoài tập filter mới).
				if (allFilteredSelected && selectedIds.length !== suppliersTotal) {
					allFilteredSelected = false;
				}
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
		void seedImagesAfterMount();
		if (resumed) showToast(pageContents.toasts.draftRestored[lang], 'success');
		closeGuard.markClean();
	}

	// Defer seed: khi modal mở, component ImageUpload MỚI mount (nằm trong
	// {#if supplierModalDisplay}) — ref còn undefined ngay sau set display=true.
	// KHÔNG dùng $effect (track supplierForm.images sâu + mutate deferEntries
	// trong child → effect_update_depth_exceeded). Gọi qua awaitTick sau khi
	// set display: component đã mount, ref sẵn sàng, chạy 1 lần duy nhất.
	// Entries từ images đã lưu (resume draft / edit row): chỉ seed URL thật —
	// file local draft KHÔNG sống sót qua reload (blob URL chết).
	async function seedImagesAfterMount() {
		await tick();
		if (supplierModalDisplay && supplierImageUpload) {
			supplierImageUpload.seedFromImages(supplierForm.images);
		}
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
		void seedImagesAfterMount();
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
		if (!str(supplierForm.name).trim()) {
			return pageContents.form.requireName[lang];
		}
		const t = supplierForm;
		if (t.phones.some((p) => str(p).trim() && !PHONE_RE.test(str(p).trim()))) return pageContents.form.invalidPhone[lang];
		if (t.emails.some((e) => str(e).trim() && !EMAIL_RE.test(str(e).trim()))) return pageContents.form.invalidEmail[lang];
		if (str(t.zalo).trim() && !ZALO_RE.test(str(t.zalo).trim())) return pageContents.form.invalidZalo[lang];
		if (str(t.telegram).trim() && !TELEGRAM_RE.test(str(t.telegram).trim())) return pageContents.form.invalidTelegram[lang];
		if (str(t.discord).trim() && !DISCORD_RE.test(str(t.discord).trim())) return pageContents.form.invalidDiscord[lang];
		if (str(t.facebook).trim() && !FACEBOOK_RE.test(str(t.facebook).trim())) return pageContents.form.invalidFacebook[lang];
		return undefined;
	}

	// Map lỗi validate → CSS selector field tương ứng trong modal (scroll-to-invalid
	// yêu cầu 4f: submit khi invalid → cuộn tới field đầu tiên từ trên xuống).
	// Thứ tự khớp thứ tự check trong validateSupplierForm (name → phone → email → social).
	const FIELD_SELECTORS = {
		requireName: '[data-field="supplier-name"]',
		invalidPhone: '[data-field="supplier-phones"]',
		invalidEmail: '[data-field="supplier-emails"]',
		invalidZalo: '[data-field="supplier-zalo"]',
		invalidTelegram: '[data-field="supplier-telegram"]',
		invalidDiscord: '[data-field="supplier-discord"]',
		invalidFacebook: '[data-field="supplier-facebook"]'
	} as const;

	// Scroll tới field invalid đầu tiên (trong .modal-body-root overflow container)
	// root hoá tham số — dùng chung cho modal NCC + PO.
	function scrollToInvalidField(selector: string, rootEl?: HTMLElement | null) {
		const root = rootEl ?? supplierModalBodyEl;
		if (!root) return;
		const el = root.querySelector<HTMLElement>(selector);
		if (!el) return;
		el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		// Flash viền để user dễ định vị
		el.classList.add('field-flash');
		setTimeout(() => el.classList.remove('field-flash'), 1600);
	}

	// Map lỗi validate PO → selector (thứ tự khớp validatePOForm:
	// code → supplier → branch → items).
	const FIELD_SELECTORS_PO = {
		requireCode: '[data-field="po-code"]',
		requireSupplier: '[data-field="po-supplier"]',
		requireBranch: '[data-field="po-branch"]',
		requireItems: '[data-field="po-items"]',
		requireItem: '[data-field="po-items"]'
	} as const;
	let poModalBodyEl = $state<HTMLElement | undefined>(undefined);

	// ── STT tag + cảnh báo trùng: trả map value→số lần xuất hiện (>=2 = dup) ──
	function countDuplicates(values: string[]): Map<string, number> {
		const counts = new Map<string, number>();
		for (const v of values) {
			const key = str(v).trim().toLowerCase();
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
				label: str(a.label).trim() || undefined,
				address: str(a.address).trim(),
				ward: (str(bd?.ward) || str(a.ward)).trim() || undefined,
				province: (str(bd?.province) || str(a.province)).trim() || undefined,
				district: (str(bd?.district) || str(a.district)).trim() || undefined,
				country: (str(bd?.province) || str(a.province)).trim() ? 'Việt Nam' : undefined
			};
		});
		// Cấp 1 = entry đầu (địa chỉ chính) — đồng bộ field legacy address/district/province
		const main = entries[0];
		// avatarUrl là CON TRỎ vào 1 URL trong images (nếu images có mà avatar không
		// khớp URL nào → dùng ảnh đầu)
		const images = t.images.map((u) => str(u).trim()).filter(Boolean);
		const avatar = images.includes(str(t.avatarUrl)) ? str(t.avatarUrl) : (images[0] ?? '');
		return {
			name: str(t.name).trim(),
			contactPerson: str(t.contactPerson).trim() || undefined,
			address: main?.address || undefined,
			ward: main?.ward || undefined,
			district: main?.district || undefined,
			province: main?.province || undefined,
			country: main?.country || undefined,
			phones: t.phones.map((p) => str(p).trim()).filter(Boolean),
			emails: t.emails.map((e) => str(e).trim()).filter(Boolean),
			addresses: entries.filter((a) => a.address),
			zalo: str(t.zalo).trim() || undefined,
			telegram: str(t.telegram).trim() || undefined,
			discord: str(t.discord).trim() || undefined,
			facebook: str(t.facebook).trim() || undefined,
			images: images.length > 0 ? images : undefined,
			avatarUrl: avatar || undefined,
			note: str(t.note).trim() || undefined,
			status: t.status
		};
	}

	async function submitSupplier() {
		if (supplierSubmitting || !encryptionKeys) return;
		const validationError = validateSupplierForm();
		if (validationError) {
			supplierError = validationError;
			// Scroll tới field invalid đầu tiên để user can thiệp (yêu cầu 4f)
			const key = (Object.keys(FIELD_SELECTORS) as (keyof typeof FIELD_SELECTORS)[]).find((k) =>
				validationError === pageContents.form[k]?.[lang]
			);
			if (key) scrollToInvalidField(FIELD_SELECTORS[key]);
			return;
		}
		supplierError = undefined;
		supplierSubmitting = true;
		try {
			// DEFER images: upload các file local chờ tải lên TRƯỚC khi build payload
			// (yêu cầu 4c — không upload rác khi hủy form). Fail upload → dừng, giữ modal.
			if (supplierImageUpload) {
				const uploaded = await supplierImageUpload.uploadPending();
				if (uploaded === undefined) {
					supplierSubmitting = false;
					return;
				}
				if (Array.isArray(uploaded)) supplierForm.images = uploaded;
				else supplierForm.images = [uploaded];
			}
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
			.then(() => showToast(pageContents.toasts.bulkCopied[lang].replace('{count}', String(bulkDisplayCount)), 'success'))
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
				clearSuppliersSelection();
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
		// markClean SAU khi modal render 1 frame — baseline snapshot poForm hiện tại.
		void (async () => {
			await tick();
			poCloseGuard.markClean();
		})();
		void loadVariantOptions();
	}

	function addPOItem() {
		poForm.items = [...poForm.items, { variantId: '', quantity: 1, unitCost: 0 }];
	}

	function removePOItem(index: number) {
		poForm.items = poForm.items.filter((_, i) => i !== index);
	}

	function validatePOForm(): string | undefined {
		if (!str(poForm.poCode).trim()) return pageContents.form.requireCode[lang];
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
			// Scroll tới field invalid đầu tiên (chuẩn chung với modal NCC).
			const key = (Object.keys(FIELD_SELECTORS_PO) as (keyof typeof FIELD_SELECTORS_PO)[]).find((k) =>
				validationError === pageContents.form[k]?.[lang]
			);
			if (key) scrollToInvalidField(FIELD_SELECTORS_PO[key], poModalBodyEl);
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
						poCode: str(poForm.poCode).trim(),
						supplierId: poForm.supplierId,
						branchId: poForm.branchId,
						expectedAt: poForm.expectedAt || undefined,
						items: poForm.items.map((item) => ({
							variantId: item.variantId,
							quantity: Number(item.quantity),
							unitCost: Number(item.unitCost),
							lotNumber: str(item.lotNumber).trim() || undefined,
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
				poCloseGuard.markClean();
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
		if (str(supplierForm.name).trim() || supplierForm.phones.length > 0 || supplierForm.emails.length > 0) {
			saveDraftDebounced();
		}
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section
	class="admin-page admin-page--fullheight"
	class:at-bottom={wrapAtBottom}
	class:is-scrolled={tableScrolled}
	data-active-tab={activeTab}
>

	<!-- ── Tab ── -->
	<div class="tab-strip" role="tablist" class:is-scrolled={tableScrolled}>
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
			<div class="admin-table-wrap" bind:this={wrapEl} onscroll={onTableScroll}>
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
					// id THẬT (_id DB) — root cause select-all 20/28 + bulk ids sai:
					// default idOf = String(index trang) → stale giữa trang.
					getRowId={(row) => String((row as unknown as SupplierRow)._id ?? '')}
					selection={selectedIds}
					selectAllMode="filtered"
					bind:allFilteredSelected={allFilteredSelected}
					onSelectAllFiltered={selectAllFilteredSuppliers}
					onSelectionChange={(ids) => (selectedIds = ids)}
					class={tableScrolled ? 'caption-collapsed' : undefined}
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
								<span class="bulk-count">{pageContents.bulk.selected[lang].replace('{count}', String(bulkDisplayCount))}</span>
								<Button color="primary" variant="soft" size="sm" onClick={bulkCopySelected}>
									{pageContents.bulk.copy[lang]}
								</Button>
								<Button color="error" variant="soft" size="sm" onClick={() => { bulkDeleteDisplay = true; }} data-test="suppliers-bulk-delete">
									{pageContents.bulk.delete[lang]}
								</Button>
								<Button color="default" variant="ghost" size="sm" onClick={clearSuppliersSelection}>
									<Icon icon={iconify['close-rounded']} size="sm" />
								</Button>
							</div>
						{/if}
							<div class="admin-search" data-suggest>
								{#if isMobile && !mobileSearchOpen}
									<!-- mobile 2c: search icon → click mở text field (autofocus);
									     đóng khi blur RỖNG (có từ khoá → giữ field, user chốt) -->
									<button
										type="button"
										class="mobile-caption-icon"
										aria-label={lang === 'vi' ? 'Tìm kiếm' : 'Search'}
										data-test="suppliers-mobile-search-open"
										onclick={() => {
											mobileSearchOpen = true;
											suggestOpen = true;
											// autofocus sau khi mount (attr autofocus có thể bị bỏ qua khi re-render)
											setTimeout(() => mobileSearchInputInstance?.configs.focus(), 0);
										}}
									>
										<Icon icon={iconify['search-rounded']} size="sm" />
									</button>
								{:else}
									<Input
										bind:this={mobileSearchInputInstance}
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
															// mobile: rỗng → thu về icon (có từ khoá → giữ field)
															if (isMobile && !str(searchQuery).trim()) mobileSearchOpen = false;
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
								{/if}
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
							<!-- yêu cầu 7: filter VÀO caption (bỏ admin-filters row).
							     Batch 3: Select component thay select native (tái sử dụng).
							     Mobile 2c: filter status đẩy vào popover từ nút tune. -->
							{#if !isMobile}
								<Select
									class="admin-filter-select"
									size="sm"
									bind:value={supplierStatusFilter}
									options={supplierStatusOptions}
									searchable
									clearable
									placeholder={pageContents.filters.allStatuses[lang]}
									onValueChange={() => onFilterChange()}
									data-test="suppliers-filter-status"
								/>
							{/if}
							<!-- nút create vào caption (yêu cầu 3: bỏ admin-header) -->
							<div class="admin-actions-group">
								{#if isMobile}
									<div class="mobile-filter-anchor">
										<button
											type="button"
											class="mobile-caption-icon"
											aria-label={pageContents.filters.allStatuses[lang]}
											data-test="suppliers-mobile-filter-btn"
											onclick={() => (mobileFilterOpen = !mobileFilterOpen)}
										>
											<Icon icon={iconify['tune-rounded']} size="sm" />
										</button>
										{#if mobileFilterOpen}
											<div class="mobile-filter-popover">
												<Select
													class="admin-filter-select"
													size="sm"
													bind:value={supplierStatusFilter}
													options={supplierStatusOptions}
													searchable
													clearable
													placeholder={pageContents.filters.allStatuses[lang]}
													onValueChange={() => {
														onFilterChange();
													}}
													data-test="suppliers-filter-status-mobile"
												/>
											</div>
										{/if}
									</div>
								{:else}
									<Button color="default" variant="outline" size="sm" onClick={refresh} aria-label={pageContents.states.retry[lang]}>
										<Icon icon={iconify['tune-rounded']} size="sm" />
									</Button>
								{/if}
								<!-- Quy ước màu nút: create = success -->
								{#if isMobile}
									<Button color="success" size="sm" onClick={openSupplierModal} aria-label={pageContents.actions.createSupplier[lang]} data-test="suppliers-create-btn">
										<Icon icon={iconify['add-rounded']} size="sm" />
									</Button>
								{:else}
									<Button color="success" size="sm" onClick={openSupplierModal} data-test="suppliers-create-btn">
										{pageContents.actions.createSupplier[lang]}
									</Button>
								{/if}
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
			<div class="admin-table-wrap" bind:this={wrapEl} onscroll={onTableScroll}>
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
					class={tableScrolled ? 'caption-collapsed' : undefined}
					data-test="purchase-orders-datatable"
				>
					{#snippet captionTools()}
						<!-- yêu cầu 7: filter PO vào caption. Batch 3: Select component thay
						     select native (tái sử dụng, user chốt thay cả 4 filter). -->
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poStatusFilter}
							options={poStatusOptions}
							searchable
							clearable
							placeholder={pageContents.filters.allStatuses[lang]}
							onValueChange={() => onFilterChange()}
						/>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poBranchFilter}
							options={poBranchOptions}
							searchable
							clearable
							placeholder={pageContents.filters.allBranches[lang]}
							onValueChange={() => onFilterChange()}
						/>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poSupplierFilter}
							options={poSupplierOptions}
							searchable
							clearable
							placeholder={pageContents.filters.allSuppliers[lang]}
							onValueChange={() => onFilterChange()}
						/>
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
	<footer
		class="admin-pagination"
		class:pagination-collapsed={tableScrolled}
		class:pagination-pop={paginationPopped}
	>
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
			<Modal.Container.Body bind:ref={supplierModalBodyEl}>
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
							<div data-field="supplier-name">
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
							</div>
						<TextField name="supplier-contact">
							<Label>{pageContents.supplierModal.contact[lang]}</Label>
							<Input
								type="text"
								bind:value={supplierForm.contactPerson}
								disabled={supplierSubmitting}
							/>
						</TextField>
					</div>
					<!-- ── Hình ảnh multiple (defer batch 3: preview local — chỉ upload
						     KHI SUBMIT qua uploadPending, tránh rác khi hủy form) ── -->
					<ImageUpload
						bind:this={supplierImageUpload}
						images={supplierForm.images}
						bind:avatarUrl={supplierForm.avatarUrl}
						label={pageContents.supplierModal.images[lang]}
						disabled={supplierSubmitting}
						defer
					/>
					<!-- ── Phones + emails multiple: Badge STT + Input component.
						     Batch 3: Badge góc trái-trên + remove góc phải-trên ĐÈ LÊN VIỀN
						     TRÊN của field (absolute, không tốn chiều cao; kích thước nhỏ). ── -->
					<div class="form-grid" style="gap: 0.5rem;" data-field="supplier-phones">
						{#each supplierForm.phones as phone, phoneIndex (phoneIndex)}
							<div class="field-row" class:field-row--dup={(phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) >= 2}>
								<Badge class="field-row-stt" label={String(phoneIndex + 1)} size="xs" variant="soft" color={(phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-phone-stt-${phoneIndex}`} />
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
							disabled={supplierSubmitting || supplierForm.phones.some((p) => (p ?? '').trim() !== '' && !PHONE_RE.test((p ?? '').trim()))}
							onclick={() => {
								supplierForm.phones = [...supplierForm.phones, ''];
							}}
						>+ {pageContents.supplierModal.addPhone[lang]}</button>
						{#each supplierForm.emails as email, emailIndex (emailIndex)}
							<div class="field-row" class:field-row--dup={(emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) >= 2} data-field="supplier-emails">
								<Badge class="field-row-stt" label={String(emailIndex + 1)} size="xs" variant="soft" color={(emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-email-stt-${emailIndex}`} />
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
														disabled={supplierSubmitting || supplierForm.emails.some((e) => (e ?? '').trim() !== '' && !EMAIL_RE.test((e ?? '').trim()))}
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
							<div class="address-entry" class:field-row--dup={(addressDupCounts.get(str(entry.address).trim().toLowerCase()) ?? 0) >= 2}>
								<div class="address-entry__head">
									<Badge class="field-row-stt" label={String(addrIndex + 1)} size="xs" variant="soft" color={(addressDupCounts.get(str(entry.address).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-address-stt-${addrIndex}`} />
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
							disabled={supplierSubmitting || supplierForm.addresses.some((a) => (a.address ?? '').trim() === '')}
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
							<div data-field="supplier-zalo">
							<TextField name="supplier-zalo">
								<Label>{pageContents.supplierModal.zalo[lang]}</Label>
								<Input
									type="text"
									bind:value={supplierForm.zalo}
									placeholder={pageContents.supplierModal.zaloPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</TextField>
							</div>
							<div data-field="supplier-telegram">
							<TextField name="supplier-telegram">
								<Label>{pageContents.supplierModal.telegram[lang]}</Label>
								<Input
									type="text"
									bind:value={supplierForm.telegram}
									placeholder={pageContents.supplierModal.telegramPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</TextField>
							</div>
							<div data-field="supplier-discord">
							<TextField name="supplier-discord">
								<Label>{pageContents.supplierModal.discord[lang]}</Label>
								<Input
									type="text"
									bind:value={supplierForm.discord}
									placeholder={pageContents.supplierModal.discordPlaceholder[lang]}
									disabled={supplierSubmitting}
								/>
							</TextField>
							</div>
							<div data-field="supplier-facebook">
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
				<AlertDialog.Description>{pageContents.bulk.desc[lang].replace('{count}', String(bulkDisplayCount))}</AlertDialog.Description>
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

<!-- ── Modal tạo đơn mua hàng (chuẩn chung: TextField/Input + Select + dirty-guard) ── -->
{#if poModalDisplay}
	<Modal bind:display={poModalDisplay} size="lg" isDimissable onCloseAttempt={() => poCloseGuard.attemptClose()}>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.poModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body bind:ref={poModalBodyEl}>
				{#if poError}
					<div class="form-error-banner" role="alert">{poError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<div data-field="po-code">
							<TextField name="po-code" required>
								<Label>{pageContents.poModal.code[lang]}</Label>
								<Input
									type="text"
									bind:value={poForm.poCode}
									disabled={poSubmitting}
									data-test="po-form-code"
								/>
							</TextField>
						</div>
						<div class="form-field" data-field="po-expected">
							<span class="form-label">{pageContents.poModal.expectedAt[lang]}</span>
							<input class="admin-input" type="date" bind:value={poForm.expectedAt} disabled={poSubmitting} />
						</div>
					</div>
					<div class="form-grid-2">
						<div class="form-field" data-field="po-supplier">
							<span class="form-label">{pageContents.poModal.supplier[lang]}</span>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={poForm.supplierId}
								options={poSupplierModalOptions}
								searchable
								clearable
								placeholder={pageContents.poModal.supplierPlaceholder[lang]}
								disabled={poSubmitting}
							/>
						</div>
						<div class="form-field" data-field="po-branch">
							<span class="form-label">{pageContents.poModal.branch[lang]}</span>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={poForm.branchId}
								options={poBranchModalOptions}
								searchable
								clearable
								placeholder={pageContents.poModal.branchPlaceholder[lang]}
								disabled={poSubmitting}
							/>
						</div>
					</div>

					<div class="items-block" data-field="po-items">
						<p class="form-label">{pageContents.poModal.items[lang]}</p>
						{#each poForm.items as item, index (index)}
							<div class="po-item">
								<Select
									class="admin-filter-select po-item-variant"
									size="sm"
									bind:value={item.variantId}
									options={poVariantModalOptions}
									searchable
									clearable
									placeholder={pageContents.poModal.itemVariantPlaceholder[lang]}
									disabled={poSubmitting}
								/>
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
						poCloseGuard.attemptClose();
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>

	<!-- Dirty-guard confirm (chuẩn chung với modal NCC) -->
	{#if dirtyPOCloseDisplay}
		<AlertDialog bind:open={dirtyPOCloseDisplay} title={pageContents.dirty.title[lang]} description={pageContents.dirty.desc[lang]}>
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
							poCloseGuard.confirmDiscard();
						}}
					>
						{pageContents.dirty.discard[lang]}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog>
	{/if}
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

	/* ── Fullheight (pattern purchases): ZERO 3 var sticky của layout — wrap tự
	   scroll trong page (caption/th sticky bám wrap, không bám layout) ── */
	.admin-page--fullheight {
		height: 100%;
		max-width: none;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		transition: padding 200ms ease, gap 200ms ease;
		/* caption/th sticky của DataTable đọc 3 var này từ ancestor — zero để
		   sticky top = 0 (bám đỉnh wrap, không bị "hở" dưới header layout) */
		--admin-header-h: 0px;
		--admin-filters-h: 0px;
		--admin-page-header-h: 0px;

		@media (max-width: 767px) {
			padding: 0.75rem;
		}

		// Scroll → co page padding + gap tăng không gian row (yêu cầu 1 sticky
		// tab-strip: bỏ padding khi cuộn; dừng cuộn trả lại — transition tự đảo)
		&.is-scrolled {
			gap: 0.375rem;
			padding-top: 0.5rem;
			padding-bottom: 0.5rem;
		}
	}

	/* Cuộn tới đáy: bỏ hết padding page + pagination để tối đa không gian row.
	   Rời đáy (scroll to top) → media 767 trả lại padding như ban đầu. */
	.admin-page--fullheight.at-bottom {
		@media (max-width: 767px) {
			padding: 0;
		}
	}

	.admin-table-area {
		flex: 1;
		min-height: 0;
	}

	.admin-table-wrap {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
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
		transition: box-shadow 200ms ease;
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
		transition: padding 200ms ease, font-size 200ms ease;

		&.active {
			color: var(--foreground);
			font-weight: 600;
			border-bottom-color: var(--primary);
		}

		&:hover {
			color: var(--foreground);
		}
	}

	// Scroll sang dưới → tab-strip thu nhỏ (pattern admin-inset-header.is-scrolled);
	// scroll về top → trả lại padding ban đầu (transition tự đảo).
	.tab-strip.is-scrolled {
		box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);

		.tab-item {
			padding: 0.3rem 0.75rem;
			font-size: 0.8rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tab-strip,
		.tab-item {
			transition: none;
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

	/* Select component filter trong captionTools (batch 3: thay select native).
	   BẪY: scoped selector không match element Select (mang hash Select component)
	   → :global() bắt buộc (pattern purchases +page.svelte:4640). */
	:global(.datatable-caption-tools .admin-filter-select) {
		width: 10rem;
		max-width: 10rem;
		flex-shrink: 0;

		:global(.select-trigger) {
			height: 2.25rem;
			min-height: 2.25rem;
			border-radius: 0.5rem;
			border: 1px solid var(--default-300);
			background: var(--default-50, transparent);
			font-size: 0.85rem;
		}
	}

	/* Scroll → caption collapsed (DataTable root class từ page): ẩn desc +
	   co caption đã làm ở DataTable; ở đây thu nhỏ tools (search/select/btn). */
	:global(.datatable-root.caption-collapsed) {
		:global(.datatable-caption-tools .admin-search .input-root),
		:global(.datatable-caption-tools .admin-filter-select .select-trigger) {
			height: 1.75rem;
			min-height: 1.75rem;
		}

		:global(.datatable-caption-tools .admin-actions-group .button-root) {
			height: 1.75rem;
			min-height: 1.75rem;
			padding-inline: 0.625rem;
		}

		:global(.datatable-caption-tools .bulk-bar) {
			height: 1.75rem;
		}
	}

	/* Select component trong modal PO (batch 4: đồng bộ chuẩn chung) —
	   full-width trong form-field, trigger cùng style admin-select. */
	:global(.modal-body-root .admin-filter-select) {
		width: 100%;

		:global(.select-trigger) {
			height: 2.25rem;
			min-height: 2.25rem;
			border-radius: 0.5rem;
			border: 1px solid var(--default-300);
			background: var(--default-50, transparent);
			font-size: 0.85rem;
		}
	}

	.po-item :global(.admin-filter-select.po-item-variant) {
		flex: 1 1 12rem;
		min-width: 10rem;
	}

	@media (max-width: 767px) {
		:global(.datatable-caption-tools .admin-filter-select) {
			width: 100%;
			max-width: 100%;
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

	/* Fullheight: wrap tự cuộn dọc (scroll container của page) — đọc cả 2 chiều */
	.admin-page--fullheight .admin-table-wrap {
		overflow: auto;
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

	/* ── Pagination collapsed/pop (pattern purchases): cuộn → gọn lại; chạm đáy
	   → "pop" animation 450ms 1 lần. ≤767 mới áp — desktop giữ nguyên. ── */
	@media (max-width: 767px) {
		.pagination-collapsed.admin-pagination {
			padding-block: 0.15rem;
			font-size: 0.75rem;
		}
		.at-bottom .admin-pagination {
			padding-block: 0;
			font-size: 0.7rem;
		}
		.pagination-pop.admin-pagination {
			animation: pagination-pop-anim 450ms ease-out;
		}
		@keyframes pagination-pop-anim {
			0% {
				transform: scale(0.94);
			}
			60% {
				transform: scale(1.04);
			}
			100% {
				transform: scale(1);
			}
		}
		@media (prefers-reduced-motion: reduce) {
			.pagination-pop.admin-pagination {
				animation: none;
			}
		}
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

	/* Scroll-to-invalid: flash viền field lỗi 1.6s để user định vị nhanh */
	.field-flash {
		animation: field-flash-pulse 1.6s ease-out;
		border-radius: 0.5rem;
	}
	@keyframes field-flash-pulse {
		0%, 60% {
			box-shadow: 0 0 0 2px var(--color-sky-500, #0ea5e9);
		}
		100% {
			box-shadow: 0 0 0 2px transparent;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.field-flash {
			animation: none;
			box-shadow: 0 0 0 2px var(--color-sky-500, #0ea5e9);
		}
	}

	.form-grid {
		display: grid;
		gap: 0.75rem;
	}

	/* hàng phone/email + nút xoá.
	   Batch 3: Badge STT (trái) + remove (phải) ĐÈ LÊN VIỀN TRÊN của field
	   (absolute, translateY(-50%)) → không tốn chiều cao hàng; kích thước nhỏ
	   (1.15rem) tiết kiệm không gian. Z-index trên viền input; field-row cần
	   margin-top để badge không bị cắt bởi field phía trên (modal-body có
	   overflow-y auto → không clip nếu đủ khoảng cách gap 0.5rem + 0.6rem). */
	.field-row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.55rem;

		& > :global(.input-root) {
			flex: 1;
			min-width: 0;
		}
	}

	/* Badge STT đè viền trên góc trái — dịch trái ra ngoài 1 nửa width để
	   "treo" trên mép (x=-50% so với góc), y giữa viền. Badge thu nhỏ:
	   padding-inline 0.35rem + min-height 1.15rem (size-xs token lớn hơn nhu cầu). */
	.field-row > :global(.field-row-stt),
	.field-row > .field-row-stt {
		position: absolute;
		top: 0;
		left: 0.6rem;
		transform: translate(-50%, -50%);
		z-index: 2;
		min-height: 1.15rem;
		padding-inline: 0.35rem;
		font-size: 0.65rem;
		line-height: 1;
		border-radius: 9999px;
		box-shadow: 0 0 0 2px var(--background, #fff);
	}

	.field-row-remove {
		position: absolute;
		top: 0;
		right: 0.6rem;
		transform: translate(50%, -50%);
		z-index: 2;
		flex: none;
		width: 1.15rem;
		height: 1.15rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 9999px;
		background: var(--background, #fff);
		color: var(--foreground-500, inherit);
		cursor: pointer;
		font-size: 0.625rem;
		line-height: 1;
		transition: background 0.15s ease, color 0.15s ease;

		&:hover:not(:disabled) {
			background: color-mix(in oklab, var(--error) 10%, transparent);
			color: var(--error);
			border-color: var(--error);
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

	/* Mobile caption (yêu cầu 2c): icon search/filter/create thu gọn + popover filter */
	.mobile-caption-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		cursor: pointer;

		&:hover {
			background: var(--default-100);
		}
	}

	.mobile-filter-anchor {
		position: relative;
	}

	.mobile-filter-popover {
		position: absolute;
		top: calc(100% + 0.375rem);
		right: 0;
		z-index: 30;
		background: var(--background);
		border: 1px solid var(--default-300);
		border-radius: 0.5rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
		padding: 0.5rem;
		width: 12rem;

		:global(.admin-filter-select) {
			width: 100%;
			max-width: 100%;
		}
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

	/* ── Multiple addresses: entry block (badge/remove đè viền trên — mirror .field-row) ── */
	.address-entry {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.55rem;
		padding: 0.6rem;
		border: 1px solid var(--default-200);
		border-radius: 0.6rem;

		&.field-row--dup {
			border-color: var(--error);
		}
	}

	.address-entry > :global(.field-row-stt),
	.address-entry > .field-row-stt {
		position: absolute;
		top: 0;
		left: 0.6rem;
		transform: translate(-50%, -50%);
		z-index: 2;
		min-height: 1.15rem;
		padding-inline: 0.35rem;
		font-size: 0.65rem;
		line-height: 1;
		border-radius: 9999px;
		box-shadow: 0 0 0 2px var(--background, #fff);
	}

	.address-entry .field-row-remove {
		top: 0;
		right: 0.6rem;
		transform: translate(50%, -50%);
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
		.admin-page--fullheight {
			padding-bottom: 12rem;
		}
		/* FAB fixed góc phải đè "Rows: 20" (page-size) khi cuộn — chừa chỗ phải */
		.admin-pagination {
			padding-right: 4.75rem;
		}
	}

	/* ── Bridge inset (pattern purchases): layout .admin-inset đọc :has() từ page
	   để co padding-bottom + header khi page chạm đáy (at-bottom) ── */
	:global(.admin-inset:has(.admin-page--fullheight)) .admin-page--fullheight {
		@media (max-width: 767px) {
			padding-bottom: 4.5rem;
		}
	}

	:global(.admin-inset:has(.admin-page--fullheight.at-bottom)) .admin-page--fullheight {
		@media (max-width: 767px) {
			padding-bottom: 0;
		}
	}

	/* Mobile chạm đáy: inset-header (breadcrumb) zero padding (yêu cầu 2 —
	   breadcrumb co hết cỡ khi cuộn đáy, trả lại khi rời đáy) */
	:global(.admin-inset:has(.admin-page--fullheight.at-bottom)) :global(.admin-inset-header) {
		@media (max-width: 767px) {
			padding: 0;
		}
	}
</style>
