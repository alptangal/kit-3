<!-- src/routes/(authorized)/admin/suppliers/+page.svelte -->
<script lang="ts">
	import { flushSync, tick } from 'svelte';
	import { Button, DataTable, Pagination, AlertDialog, Badge, Spinner } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { EmailInput, ImageUpload, Input, Label, PhoneInput, Select, Switch, TextField, Textarea, AddressInput, Description } from '$components/form';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import type { Size } from '$components/interface';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDate as formatDateShared, formatDateTimeSec } from '$modules/i18n';
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
		createdBy?: string | null;
		createdAt?: string | null;
		updatedBy?: string | null;
		updatedAt?: string | null;
	}

	interface SupplierAddressEntry {
		label?: string;
		address: string;
		ward?: string;
		province?: string;
		district?: string;
		country?: string;
		// Địa giới hệ MỚI (34 tỉnh 2 cấp, sáp nhập 2025) — song song hệ cũ
		newProvince?: string;
		newWard?: string;
	}

	// Entry lịch sử — khớp SupplierHistoryEntry (src/lib/server/db/suppliers.ts)
	interface HistoryEntry {
		_id: string;
		type: 'update' | 'restore';
		actorId?: string;
		actorName?: string;
		createdAt?: string;
		changes: { field: string; before: string | null; after: string | null }[];
	}

	// 6 field social dạng TAG multi-value (mảng string)
	type SocialFieldKey = 'zalo' | 'telegram' | 'discord' | 'facebook' | 'instagram' | 'website';
	const SOCIAL_FIELDS: SocialFieldKey[] = ['zalo', 'telegram', 'discord', 'facebook', 'instagram', 'website'];

	// Batch 15 (m12278-8): placeholder gợi ý theo field (url/username/value hợp
	// lệ) — key `${sf}Placeholder` trong supplierModal i18n.
	function sfPlaceholderKey(sf: SocialFieldKey) {
		return `${sf}Placeholder` as keyof typeof pageContents.supplierModal;
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
		// B50 (m21047): đơn vị nhập + hệ số (lưu nguyên trạng — nhận hàng hiểu "48 chai/thùng")
		unitName?: string;
		unitFactor?: number;
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
		// B50 (m21047): đơn vị có sẵn của variant + giá nhập dự kiến (server enrich)
		units?: { name: string; factor: number; price?: number | null }[] | null;
		lastPurchaseCost?: number | null;
		price?: number | null; // B52 (m25115) detail edit
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
		// Batch10 (m06635-3): setting modal (filter + sort) từ nút tune header/FAB
		settings: {
			title: { vi: 'Cài đặt danh sách', en: 'List settings' },
			filterStatus: { vi: 'Trạng thái', en: 'Status' },
			sortBy: { vi: 'Sắp xếp theo', en: 'Sort by' },
			sortDirection: { vi: 'Chiều sắp xếp', en: 'Sort direction' },
			asc: { vi: 'Tăng dần', en: 'Ascending' },
			desc: { vi: 'Giảm dần', en: 'Descending' },
			apply: { vi: 'Áp dụng', en: 'Apply' },
			reset: { vi: 'Đặt lại', en: 'Reset' }
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
			edit: { vi: 'Sửa', en: 'Edit' },
			search: { vi: 'Tìm kiếm', en: 'Search' },
			filter: { vi: 'Lọc trạng thái', en: 'Filter status' }
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
			nameChecking: { vi: 'đang kiểm tra…', en: 'checking…' },
			nameTaken: { vi: 'Tên đã tồn tại', en: 'Name already exists' },
			// Batch 17: Description xanh dưới input khi name qua check + không trùng
			nameAvailable: { vi: 'Tên có thể sử dụng', en: 'Name is available' },
			// Batch 21: name rỗng khi submit → Description error chuẩn component
			nameRequired: { vi: 'Vui lòng nhập tên nhà cung cấp', en: 'Supplier name is required' },
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
			phones: { vi: 'Số điện thoại', en: 'Phone numbers' },
			addPhone: { vi: 'Thêm số điện thoại', en: 'Add phone number' },
			removePhone: { vi: 'Xoá số điện thoại', en: 'Remove phone number' },
			emailPlaceholder: { vi: 'Email', en: 'Email' },
			emails: { vi: 'Email', en: 'Emails' },
			addEmail: { vi: 'Thêm email', en: 'Add email' },
			removeEmail: { vi: 'Xoá email', en: 'Remove email' },
			// Batch10 (m06635-6c): cảnh báo text khi phone/email trùng trong danh sách
			dupPhone: { vi: 'Số điện thoại đã tồn tại trong danh sách', en: 'This phone number already exists in the list' },
			dupEmail: { vi: 'Email đã tồn tại trong danh sách', en: 'This email already exists in the list' },
			// Batch 22 (m00193-2): aria-label deep action passive field
			callAction: { vi: 'Gọi', en: 'Call' },
			emailAction: { vi: 'Gửi email', en: 'Send email' },
			mapAction: { vi: 'Mở Google Maps', en: 'Open Google Maps' },
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
			instagram: { vi: 'Instagram', en: 'Instagram' },
			instagramPlaceholder: { vi: '@username hoặc link instagram.com/...', en: '@username or instagram.com/... link' },
			instagramInvalid: { vi: 'Instagram phải là @username hoặc link instagram.com', en: 'Instagram must be @username or instagram.com link' },
			website: { vi: 'Website', en: 'Website' },
			websitePlaceholder: { vi: 'Link trang web (https://...)', en: 'Website link (https://...)' },
			websiteInvalid: { vi: 'Website phải là link http(s) hợp lệ', en: 'Website must be a valid http(s) link' },
			socialAdd: { vi: 'Thêm giá trị…', en: 'Add value…' },
			socialDuplicate: { vi: 'Giá trị đã tồn tại', en: 'Value already exists' },
			socialInvalidTag: { vi: 'Giá trị không hợp lệ', en: 'Invalid value' },
			socialOpen: { vi: 'Mở link', en: 'Open link' },
			socialRemove: { vi: 'Xoá', en: 'Remove' },
			socialEdit: { vi: 'Sửa', en: 'Edit' },
			status: { vi: 'Trạng thái', en: 'Status' },
			statusActive: { vi: 'Đang hoạt động', en: 'Active' },
			statusInactive: { vi: 'Ngừng hoạt động', en: 'Inactive' },
			submit: { vi: 'Tạo', en: 'Create' },
			// Batch 18: nút more khi item breadcrumb tràn bị ẩn vào popover
			crumbMore: { vi: 'Xem đường dẫn', en: 'Show path' },
			save: { vi: 'Lưu thay đổi', en: 'Save changes' },
			duplicateWarn: { vi: 'Có giá trị trùng lặp', en: 'Duplicate value' },
			// Batch 11: field passive metadata (cuối form, edit mode)
			passiveCreatedAt: { vi: 'Tạo lúc', en: 'Created' },
			passiveUpdatedAt: { vi: 'Cập nhật lần cuối', en: 'Last updated' },
			passiveHint: { vi: 'Nhấn đúp để sửa', en: 'Double-tap to edit' },
		},
		// Batch 20 (A4): more-menu footer form modal — history / delete / analytics
		more: {
			label: { vi: 'Tuỳ chọn khác', en: 'More options' },
			history: { vi: 'Lịch sử', en: 'History' },
			delete: { vi: 'Xoá nhà cung cấp', en: 'Delete supplier' },
			analytics: { vi: 'Phân tích nhập hàng', en: 'Purchase analytics' },
			deleteTitle: { vi: 'Xoá nhà cung cấp?', en: 'Delete supplier?' },
			deleteDesc: {
				vi: 'Nhà cung cấp này sẽ bị xoá vĩnh viễn khỏi hệ thống.',
				en: 'This supplier will be permanently removed.'
			},
			deleteConfirm: { vi: 'Xoá', en: 'Delete' },
			deleted: { vi: 'Đã xoá nhà cung cấp', en: 'Supplier deleted' },
			analyticsTitle: { vi: 'Thống kê nhập hàng', en: 'Purchase statistics' },
			analyticsLoading: { vi: 'Đang tải thống kê…', en: 'Loading statistics…' },
			analyticsEmpty: { vi: 'Chưa có đơn nhập nào được ghi nhận', en: 'No purchase orders recorded yet' },
			analyticsOrderCount: { vi: 'Số đơn đã nhập', en: 'Orders received' },
			analyticsTotalQuantity: { vi: 'Tổng lượng hàng', en: 'Total quantity' },
			analyticsTotalValue: { vi: 'Tổng giá trị', en: 'Total value' },
			analyticsMonthly: { vi: 'Theo tháng', en: 'By month' },
			analyticsColPeriod: { vi: 'Tháng', en: 'Period' },
			analyticsColOrders: { vi: 'Đơn', en: 'Orders' },
			analyticsColQty: { vi: 'Lượng', en: 'Quantity' },
			analyticsColValue: { vi: 'Giá trị', en: 'Value' }
		},
		history: {
			viewHistory: { vi: 'Lịch sử', en: 'History' }
		},
		historyModal: {
			title: { vi: 'Lịch sử thay đổi', en: 'Change history' },
			empty: { vi: 'Chưa có thay đổi nào được ghi nhận', en: 'No changes recorded yet' },
			loading: { vi: 'Đang tải lịch sử…', en: 'Loading history…' },
			update: { vi: 'Cập nhật', en: 'Updated' },
			restore: { vi: 'Khôi phục', en: 'Restored' },
			by: { vi: 'bởi', en: 'by' },
			unknownActor: { vi: 'Không rõ', en: 'Unknown' },
			noChanges: { vi: 'Không có trường nào thay đổi', en: 'No fields changed' },
			restoreBtn: { vi: 'Khôi phục', en: 'Restore' },
			confirmTitle: { vi: 'Khôi phục dữ liệu?', en: 'Restore data?' },
			confirmDesc: {
				vi: 'Các trường trong lần thay đổi này sẽ quay về giá trị trước đó. Hành động này sẽ được ghi vào lịch sử.',
				en: 'The fields in this change will be reverted to their previous values. This action will be recorded in history.'
			},
			confirmYes: { vi: 'Khôi phục', en: 'Restore' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			viewHistory: { vi: 'Lịch sử', en: 'History' },
			fieldLabels: {
				name: { vi: 'Tên', en: 'Name' },
				contactPerson: { vi: 'Người liên hệ', en: 'Contact person' },
				address: { vi: 'Địa chỉ', en: 'Address' },
				ward: { vi: 'Phường/xã', en: 'Ward' },
				district: { vi: 'Quận/huyện', en: 'District' },
				province: { vi: 'Tỉnh/thành', en: 'Province' },
				country: { vi: 'Quốc gia', en: 'Country' },
				phones: { vi: 'Số điện thoại', en: 'Phone numbers' },
				emails: { vi: 'Email', en: 'Emails' },
				addresses: { vi: 'Danh sách địa chỉ', en: 'Addresses' },
				zalo: { vi: 'Zalo', en: 'Zalo' },
				facebook: { vi: 'Facebook', en: 'Facebook' },
				telegram: { vi: 'Telegram', en: 'Telegram' },
				discord: { vi: 'Discord', en: 'Discord' },
				instagram: { vi: 'Instagram', en: 'Instagram' },
				website: { vi: 'Website', en: 'Website' },
				avatarUrl: { vi: 'Ảnh đại diện', en: 'Avatar' },
				images: { vi: 'Hình ảnh', en: 'Images' },
				imageFulls: { vi: 'Ảnh bản gốc', en: 'Original images' },
				note: { vi: 'Ghi chú', en: 'Note' },
				status: { vi: 'Trạng thái', en: 'Status' }
			}
		},
		poModal: {
			title: { vi: 'Tạo đơn mua hàng', en: 'Create purchase order' },
			code: { vi: 'Mã PO', en: 'PO code' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			supplierPlaceholder: { vi: 'Chọn nhà cung cấp', en: 'Select a supplier' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			branchPlaceholder: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			expectedAt: { vi: 'Ngày dự kiến nhận', en: 'Expected at' },
			rootCrumb: { vi: 'Đơn mua hàng', en: 'Purchase orders' },
			expectedAtPast: { vi: 'Ngày dự kiến phải từ hôm nay trở đi', en: 'Expected date must be today or later' },
			variantSave: { vi: 'Lưu', en: 'Save' },
			variantSaved: { vi: 'Đã cập nhật sản phẩm', en: 'Variant updated successfully' },
			variantUpdateFailed: { vi: 'Cập nhật sản phẩm thất bại', en: 'Failed to update variant' },
			fxNote: { vi: 'Tỷ giá', en: 'FX rate' },
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
			submit: { vi: 'Tạo đơn mua', en: 'Create PO' },
			// B47 (m19661): edit mode — nút Save + crumb theo poCode
			save: { vi: 'Lưu thay đổi', en: 'Save changes' },
			// B49 (chain B): generate code + quick create + review + share
			generateCode: { vi: 'Tạo mã tự động', en: 'Auto-generate code' },
			createNew: { vi: 'Tạo mới "{value}"', en: 'Create new "{value}"' },
			quickCreateSupplier: { vi: 'Nhà cung cấp mới', en: 'New supplier' },
			quickCreateBranch: { vi: 'Chi nhánh mới', en: 'New branch' },
			quickCreateVariant: { vi: 'Sản phẩm mới', en: 'New variant' },
			quickCreateName: { vi: 'Tên', en: 'Name' },
			quickCreateSku: { vi: 'Mã SKU', en: 'SKU' },
			quickCreateDisplayName: { vi: 'Tên hiển thị', en: 'Display name' },
			quickCreatePrice: { vi: 'Giá (tuỳ chọn)', en: 'Price (optional)' },
			quickCreatePhone: { vi: 'Số điện thoại (tuỳ chọn)', en: 'Phone (optional)' },
			quickCreateEmail: { vi: 'Email (tuỳ chọn)', en: 'Email (optional)' },
			quickCreateProduct: { vi: 'Sản phẩm gốc', en: 'Parent product' },
			quickCreateProductPlaceholder: { vi: 'Chọn sản phẩm gốc', en: 'Select a parent product' },
			quickCreate: { vi: 'Tạo', en: 'Create' },
			duplicateItem: { vi: 'Có sản phẩm bị lặp trong danh sách', en: 'Duplicate item in list' },
			reviewTitle: { vi: 'Xác nhận tạo đơn', en: 'Confirm purchase order' },
			reviewTitleEdit: { vi: 'Xác nhận cập nhật', en: 'Confirm update' },
			reviewSupplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			reviewBranch: { vi: 'Chi nhánh', en: 'Branch' },
			reviewExpectedAt: { vi: 'Ngày dự kiến nhận', en: 'Expected at' },
			reviewItems: { vi: 'Số mặt hàng', en: 'Items count' },
			reviewConfirm: { vi: 'Xác nhận', en: 'Confirm' },
			shareTitle: { vi: 'Chia sẻ đơn hàng', en: 'Share purchase order' },
		variantDetailEdit: { vi: "Sửa thông tin", en: "Edit details" },
		variantDetailSave: { vi: "Lưu thay đổi", en: "Save changes" },
		variantDetailCancel: { vi: "Huỷ", en: "Cancel" },
		variantDetailNameRequired: { vi: "Tên hiển thị không được để trống", en: "Display name is required" },
		variantDetailPriceLabel: { vi: "Giá", en: "Price" },
			share: { vi: 'Chia sẻ', en: 'Share' },
			shareDownload: { vi: 'Tải ảnh về', en: 'Download image' },
			shareClose: { vi: 'Đóng', en: 'Close' },
			shareAppTitle: { vi: 'ĐƠN ĐẶT HÀNG', en: 'PURCHASE ORDER' },
			shareSupplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			shareBranch: { vi: 'Chi nhánh', en: 'Branch' },
			shareDate: { vi: 'Ngày nhận', en: 'Expected' },
			shareItem: { vi: 'Mặt hàng', en: 'Item' },
			shareQty: { vi: 'SL', en: 'Qty' },
			// B50 (m21047): đơn vị + giá nhập dự kiến trong item hàng
			itemUnit: { vi: 'Đơn vị', en: 'Unit' },
			itemUnitPlaceholder: { vi: 'Đơn vị (tuỳ chọn)', en: 'Unit (optional)' },
			itemUnitHint: { vi: 'Ví dụ: chiếc, thùng, lốc, dây', en: 'e.g. piece, box, pack, coil' },
			itemExpectedCost: { vi: 'Giá nhập dự kiến', en: 'Expected unit cost' }
		},
		statusModal: {
			title: { vi: 'Cập nhật trạng thái PO', en: 'Update PO status' },
			status: { vi: 'Trạng thái mới', en: 'New status' },
			confirm: { vi: 'Cập nhật', en: 'Update' },
			// B47 (m19661): xoá PO (chỉ draft/cancelled) từ status modal
			delete: { vi: 'Xoá đơn', en: 'Delete order' },
			deleteTitle: { vi: 'Xoá đơn mua hàng?', en: 'Delete purchase order?' },
			deleteDesc: {
				vi: 'Đơn mua hàng này sẽ bị xoá vĩnh viễn. Chỉ đơn nháp hoặc đã huỷ được xoá.',
				en: 'This purchase order will be permanently removed. Only draft or cancelled orders can be deleted.'
			}
		},
		toasts: {
			supplierCreated: { vi: 'Đã tạo nhà cung cấp', en: 'Supplier created' },
			supplierFailed: { vi: 'Tạo nhà cung cấp không thành công', en: 'Failed to create supplier' },
			supplierUpdated: { vi: 'Đã cập nhật nhà cung cấp', en: 'Supplier updated' },
			supplierUpdateFailed: { vi: 'Cập nhật nhà cung cấp không thành công', en: 'Failed to update supplier' },
			urlCopied: { vi: 'Đã copy URL ảnh', en: 'Image URL copied' },
			draftRestored: { vi: 'Đã phục hồi bản nháp chưa lưu', en: 'Draft restored' },
			restored: { vi: 'Đã khôi phục dữ liệu nhà cung cấp', en: 'Supplier data restored' },
			draftSaved: { vi: 'Bản nháp đã lưu tự động', en: 'Draft saved' },
			bulkDeleted: { vi: 'Đã xoá {count} nhà cung cấp', en: 'Deleted {count} suppliers' },
			bulkDeleteFailed: { vi: 'Xoá hàng loạt không thành công', en: 'Bulk delete failed' },
			bulkCopied: { vi: 'Đã copy {count} dòng', en: 'Copied {count} rows' },

			// B46 (m18161): bulk xoá đơn mua hàng (chỉ draft/cancelled được xoá)
			poBulkDeleted: { vi: 'Đã xoá {count} đơn mua hàng', en: 'Deleted {count} purchase orders' },
			poBulkNone: { vi: 'Không có đơn nào được xoá (chỉ nháp/đã huỷ được xoá)', en: 'No orders deleted (only draft/cancelled can be deleted)' },
			poBulkPartial: { vi: '{count} đơn không xoá được (chỉ nháp/đã huỷ được xoá)', en: '{count} orders could not be deleted (only draft/cancelled)' },
			poBulkDeleteFailed: { vi: 'Xoá đơn mua hàng không thành công', en: 'Failed to delete purchase orders' },
			poCreated: { vi: 'Đã tạo đơn mua hàng', en: 'Purchase order created' },
			poFailed: { vi: 'Tạo đơn mua không thành công', en: 'Failed to create purchase order' },
			poUpdated: { vi: 'Đã cập nhật đơn mua hàng', en: 'Purchase order updated' },
			poUpdateFailed: { vi: 'Cập nhật đơn mua không thành công', en: 'Failed to update purchase order' },
			poDeleted: { vi: 'Đã xoá đơn mua hàng', en: 'Purchase order deleted' },
		poVariantUpdated: { vi: "Đã cập nhật sản phẩm", en: "Variant updated successfully" },
		poVariantUpdateFailed: { vi: "Cập nhật sản phẩm thất bại", en: "Failed to update variant" },
			statusUpdated: { vi: 'Đã cập nhật trạng thái', en: 'Status updated' },
			statusFailed: { vi: 'Cập nhật trạng thái không thành công', en: 'Failed to update status' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' },
			// Batch 20 (A4): xoá 1 NCC từ more-menu footer form modal
			supplierDeleted: { vi: 'Đã xoá nhà cung cấp', en: 'Supplier deleted' },
			supplierDeleteFailed: { vi: 'Xoá nhà cung cấp không thành công', en: 'Failed to delete supplier' }
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
		// Batch 44 (m17527): hỏi load draft hay form mới khi bấm create + có draft
		draftPrompt: {
			title: { vi: 'Có bản nháp chưa lưu', en: 'Unsaved draft found' },
			desc: {
				vi: 'Bạn có bản nháp chưa lưu từ lần tạo trước. Tải lại bản nháp hay bắt đầu form mới?',
				en: 'You have an unsaved draft from a previous session. Load it or start a new form?'
			},
			loadDraft: { vi: 'Tải bản nháp', en: 'Load draft' },
			newForm: { vi: 'Form mới', en: 'New form' }
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
			selected: { vi: 'Đã chọn {count}', en: '{count} selected' },
			// Batch 28b: chọn hết các dòng khớp filter (fetch tất cả qua API) —
			// chỉ hiện khi >2 dòng đã chọn và chưa chọn hết.
			selectAll: { vi: 'Chọn tất cả', en: 'Select all' },
			uncheckAll: { vi: 'Bỏ chọn tất cả', en: 'Uncheck all' }
		},
		// B46 (m18161): bulk bar + dialog xoá PO
		poBulk: {
			title: { vi: 'Xoá đơn mua hàng đã chọn?', en: 'Delete selected purchase orders?' },
			desc: {
				vi: 'Chỉ đơn ở trạng thái nháp hoặc đã huỷ được xoá vĩnh viễn.',
				en: 'Only draft or cancelled orders are permanently removed.'
			},
			confirm: { vi: 'Xoá', en: 'Delete' },
			cancel: { vi: 'Huỷ', en: 'Cancel' }
		},
		suggest: {
			title: { vi: 'Từ khoá đã tìm', en: 'Recent searches' }
		},
		form: {
			requireName: { vi: 'Vui lòng nhập tên nhà cung cấp', en: 'Please enter a supplier name' },
			invalidPhone: { vi: 'Số điện thoại không hợp lệ', en: 'Invalid phone number' },
			invalidEmail: { vi: 'Email không hợp lệ', en: 'Invalid email' },
			invalidAddress: { vi: 'Địa chỉ cần chọn tỉnh/thành (hệ cũ hoặc mới)', en: 'Address needs a province selected (old or new system)' },
			invalidZalo: { vi: 'Zalo phải là số điện thoại hoặc link zalo.me', en: 'Zalo must be a phone number or zalo.me link' },
			invalidTelegram: { vi: 'Telegram phải là @username hoặc link t.me', en: 'Telegram must be @username or t.me link' },
			invalidDiscord: { vi: 'Discord chỉ nhận tên người dùng (2-32 ký tự)', en: 'Discord accepts username only (2-32 chars)' },
			invalidFacebook: { vi: 'Facebook phải là link facebook.com hoặc fb.com', en: 'Facebook must be a facebook.com or fb.com link' },
			invalidInstagram: { vi: 'Instagram phải là @username hoặc link instagram.com', en: 'Instagram must be an @username or instagram.com link' },
			invalidWebsite: { vi: 'Website phải là link http(s) hợp lệ', en: 'Website must be a valid http(s) link' },
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

	// Hiển thị giá trị before/after trong timeline: snapshot là JSON string
	// (snapshotValue — JSON.stringify) → parse mảng/phần tử phức hợp ra gọn;
	// rỗng → '—' (giá trị bị xoá/trống).
	function snapshotDisplay(raw: string | null | undefined): string {
		if (raw === null || raw === undefined || raw === '') return '—';
		if (raw.startsWith('[') || raw.startsWith('{')) {
			try {
				const parsed: unknown = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					if (parsed.length === 0) return '—';
					return parsed
						.map((item) => {
							if (typeof item === 'string') return item;
							if (item && typeof item === 'object' && 'address' in (item as object)) {
								return str((item as { address?: unknown }).address) || '—';
							}
							return String(item);
						})
						.filter((s) => s && s !== '—')
						.join(', ');
				}
				if (parsed && typeof parsed === 'object') return str(JSON.stringify(parsed)) || raw;
			} catch {
				/* không phải JSON → trả raw */
			}
		}
		return raw;
	}

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
	// B48 (m20355): deep-link ?tab=purchase-orders — refresh giữ đúng tab đang mở
	let activeTab = $state<'suppliers' | 'purchase-orders'>(
		page.url.searchParams.get('tab') === 'purchase-orders' ? 'purchase-orders' : 'suppliers'
	);

	let suppliers = $state<SupplierRow[]>([]);
	let suppliersTotal = $state(0);
	let suppliersPage = $state(1);
	let suppliersLoading = $state(false);
	let suppliersError = $state<string | undefined>(undefined);
	let suppliersLoadedOnce = $state(false);
	// Deep-link (batch 11, 5f): ?supplier=<id> mở modal edit đúng NCC — chỉ consume 1 lần/lần load trang.
	let deepLinkConsumed = $state(false);
	// B38 (m13838): deep-link modal con — ?modal=history|analytics cạnh ?supplier=
	// để restore đúng modal sau refresh. Đặt khi mở từ UI, gỡ khi cả 2 modal đóng.
	let historyParam = $state('');

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

	// B46 (m18161): tab PO theo chuẩn tab suppliers — search server + suggest,
	// sort server (setting modal PO), bulk chọn nhiều + copy/delete.
	let PO_PREFS_KEY = '/admin/suppliers/po';
	let poSearchQuery = $state<string | undefined>('');
	let poSearching = $state(false);
	let poSearchDebounce: ReturnType<typeof setTimeout>;
	let poSearchArmed = false;
	let poSuggestOpen = $state(false);
	let poSearchFocused = $state(false);
	let poMobileSearchOpen = $state(false);
	let poMobileSearchInputInstance = $state<{ configs: { focus: () => void } } | undefined>(undefined);
	let poSortField = $state('');
	let poSortDirection = $state<'asc' | 'desc'>('desc');
	let poSettingModalDisplay = $state(false);
	let poSettingSortField = $state('');
	let poSettingSortDirection = $state<'asc' | 'desc'>('desc');
	$effect(() => {
		if (poSettingModalDisplay) {
			poSettingSortField = poSortField;
			poSettingSortDirection = poSortDirection;
		}
	});
	let poSelectedIds = $state<string[]>([]);
	let poBulkDeleting = $state(false);
	let poBulkDeleteDisplay = $state(false);

	// ── Search server + sort server (pattern purchases) ──
	const PREFS_KEY = '/admin/suppliers';
	let searchQuery = $state<string | undefined>('');
	let searching = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout>;
	let searchArmed = false;
	let suggestOpen = $state(false);
	let searchFocused = $state(false);
	// Mobile caption (yêu cầu 2c): search icon → text field; filter status vào
	// popover từ nút tune; create → icon button. isMobile từ client store.
	const isMobile = $derived(client.browser?.isMobile ?? false);
	let mobileSearchOpen = $state(false);
	// Batch10 (m06635-2,3): setting modal (filter + sort) — mở từ nút tune header
	// datatable VÀ nút setting FAB thay popover gắn caption. mobileFilterOpen BỎ
	// (popover caption xoá hẳn — modal thay thế).
	let settingModalDisplay = $state(false);
	// Draft sort trong setting modal (apply mới ghi vào sortField/sortDirection).
	// Mở modal → seed draft từ state hiện tại ($effect 1 lần khi display bật).
	let settingSortField = $state('');
	let settingSortDirection = $state<'asc' | 'desc'>('desc');
	$effect(() => {
		if (settingModalDisplay) {
			settingSortField = sortField;
			settingSortDirection = sortDirection;
		}
	});

	// B52 (m25115): expectedAt min = hôm nay (local YYYY-MM-DD).
	$effect(() => {
		const now = new Date();
		poExpectedMin = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
	});
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
	// Batch8 mục 1: scroll-ACTIVE theo HÀNH ĐỘNG cuộn (không phải vị trí) —
	// đang cuộn = co padding-block các thành phần cố định, dừng 200ms = trả lại
	// như ban đầu (kể cả khi đang ở giữa trang).
	// Batch9-fix (user m05997): iOS Safari momentum + rubber-band ở đáy tiếp tục
	// bắn scroll event 4-5 GIÂY sau khi user đã buông ngón (mỗi bounce reset
	// timer) → tab-strip/pagination/breadcrumb kẹt ẩn "vĩnh viễn" theo cảm nhận.
	// FIX: bỏ qua event khi (a) scrollTop KHÔNG đổi so với event trước, hoặc
	// (b) VƯỢT biên (rubber-band: top<0 hoặc top>maxScroll — giá trị đàn hồi
	// đổi liên tục khi bounce) — chỉ cú kéo thật trong biên mới prolong ẩn.
	let scrollActive = $state(false);
	let scrollActiveTimer: ReturnType<typeof setTimeout>;
	let lastActiveScrollTop = -1;
	function markScrollActive(scrollTop: number, maxScroll: number) {
		const rubber = scrollTop < 0 || scrollTop > maxScroll;
		if (!rubber && scrollTop !== lastActiveScrollTop) {
			scrollActive = true;
		}
		lastActiveScrollTop = scrollTop;
		clearTimeout(scrollActiveTimer);
		scrollActiveTimer = setTimeout(() => {
			scrollActive = false;
			lastActiveScrollTop = -1;
		}, 200);
	}
	function onTableScroll() {
		const el = wrapEl;
		if (!el) return;
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			markScrollActive(el.scrollTop, el.scrollHeight - el.clientHeight);
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

	// Safari iOS ≤15.3 bỏ rule có :has() + 100dvh → layout fullheight chết →
	// .admin-table-wrap KHÔNG scroll được (scrollH ≈ clientH), cả trang cuộn
	// bên trong root Container (div.w-full.h-full.overflow-auto, +layout.svelte:178)
	// chứ KHÔNG phải window → onscroll wrap không bắn, window.scrollY luôn 0.
	// Fallback: khi wrap không scrollable, tìm ancestor scroll container thật.
	function findScrollContainer(): HTMLElement | undefined {
		let el = wrapEl?.parentElement;
		while (el && el !== document.body) {
			const ov = getComputedStyle(el).overflowY;
			if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight + 4) return el;
			el = el.parentElement;
		}
		return undefined;
	}
	function onWindowScroll() {
		// Batch 39 (m14077): scroll event từ .admin-table-wrap cũng lan lên document
		// (capture) và gọi hàm này TRƯỚC onTableScroll — 2 hàm dùng CHUNG scrollRaf
		// nên hàm này chiếm rAF, onTableScroll bị guard return → tableScrolled /
		// wrapAtBottom / scrollActive KHÔNG bao giờ cập nhật theo table-scroll
		// (tab-strip/pagination/FAB ẩn-khi-cuộn chết từ Batch 9/25). Guard sớm:
		// khi wrap tự cuộn được, nhường event cho onTableScroll (listener trên wrap).
		const wrapNow = wrapEl;
		if (wrapNow && wrapNow.scrollHeight > wrapNow.clientHeight + 4) return;
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			const el = wrapEl;
			if (!el || el.scrollHeight > el.clientHeight + 4) return; // wrap tự cuộn — bỏ qua
			// scroll container thật: window hoặc ancestor overflow:auto (root Container)
			const sc = findScrollContainer();
			const top = sc ? sc.scrollTop : window.scrollY;
			const viewH = sc ? sc.clientHeight : window.innerHeight;
			const totalH = sc ? sc.scrollHeight : document.documentElement.scrollHeight;
			// Batch 26.2 (m02698) → Batch39 (m14077): đường ROOT-scroll (iOS ≤15.3 —
			// :has() chết → wrap không tự cuộn, trang cuộn ở root Container) ĐÃ
			// kích hoạt bộ ẩn-đang-cuộn (tab-strip/tools/pagination/FAB + breadcrumb
			// layout B39): markScrollActive có sẵn guard rubber-band iOS + skip
			// scrollTop không đổi → chỉ cú kéo thật mới ẩn, dừng 200ms trả lại —
			// không còn "mất tab switch" theo mọi cú vuốt (nguyên nhân B26.2).
			markScrollActive(top, totalH - viewH);
			tableScrolled = top > 8;
			wrapAtBottom = top + viewH >= totalH - 4;
			if (wrapAtBottom && !paginationPopped) {
				paginationPopped = true;
				setTimeout(() => (paginationPopped = false), 450);
			} else if (!wrapAtBottom) {
				paginationPopped = false;
			}
		});
	}

	// ── Modal tạo/sửa nhà cung cấp ──
	let supplierModalDisplay = $state(false);
	// Batch 18: mobile breadcrumb tràn → item "Suppliers" (cấp cao nhất) ẩn vào
	// popover sau nút more (ưu tiên giữ item cấp thấp nhất theo yêu cầu user)
	let crumbTitleEl = $state<HTMLElement | null>(null);
	let suppliersCrumbHidden = $state(false);
	let crumbMoreOpen = $state(false);
	let supplierSubmitting = $state(false);
	let supplierError = $state<string | undefined>(undefined);
	// Batch 21: submit-attempt fail → render viền đỏ + message error chuẩn component trên các field
	let supplierSubmitAttempted = $state(false);
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
		zalo: string[];
		telegram: string[];
		discord: string[];
		facebook: string[];
		instagram: string[];
		website: string[];
		images: string[];
		/** Batch 15 (m12278-5): original URLs 1-1 images (thumb) — full-view detail */
		imageFulls: string[];
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
		zalo: [],
		telegram: [],
		discord: [],
		facebook: [],
		instagram: [],
		website: [],
		images: [],
		imageFulls: [],
		avatarUrl: '',
		note: '',
		status: 'active'
	});
	// breakdown cho từng entry addresses (AddressInput bind 2 chiều từng phần tử)
	let supplierAddressBreakdowns = $state<{ province: string; district: string; ward?: string }[]>([]);
	// breakdown hệ MỚI (34 tỉnh 2 cấp) cho từng entry — gen 2 chiều với breakdown cũ qua mapping
	let supplierNewAddressBreakdowns = $state<{ province: string; ward: string }[]>([]);
	// ImageUpload defer ref — gọi uploadPending() khi submit, seedFromImages() khi mở modal.
	// Batch 15 (m12278-5): getUploadPairs() trả { thumb, original }[] — payload
	// lưu images = thumb URLs + imageFulls = original URLs (full-view detail).
	let supplierImageUpload = $state<{
		uploadPending: () => Promise<string[] | string | undefined>;
		seedFromImages: (urls: string[]) => void;
		seedFromImagePairs: (pairs: { thumb: string; original?: string }[]) => void;
		syncFulls: (fulls: string[]) => void;
		getUploadPairs: () => { thumb: string; original?: string }[];
		hasDeferPending: boolean;
		// B32 (m07236): có entry đặt avatar chờ submit
		hasDeferWantAvatar: boolean;
	} | undefined>(undefined);

	// ── Batch 15 (m12278-7): name check realtime — name = key nghiệp vụ ──
	// Debounce 400ms sau khi gõ → POST /api/admin/suppliers/check-name →
	// supplierNameTaken → disable submit + badge đỏ cạnh field. Edit exclude
	// chính nó (supplierEditId). Kiểm tra lại khi mở modal (draft resume/edit
	// prefill) — server là nguồn sự thật.
	let supplierNameTaken = $state(false);
	let supplierNameChecking = $state(false);
	// Batch 17: name đã qua check (có kết quả) → Input/Description đổi màu
	// success/error; reset khi name đổi (scheduleNameCheck/checkSupplierNameNow).
	let supplierNameChecked = $state(false);
	// B37 (m13545): style success/error chỉ áp sau EVENT validation (blur field
	// name hoặc submit-attempt) — không tự áp khi mở modal (name === original
	// từng bật checked=true ngay khi prefill → viền xanh vô lý).
	let supplierNameTouched = $state(false);
	let nameCheckTimer: ReturnType<typeof setTimeout> | undefined;
	// Batch 16 (m13579-3): tên GỐC của row đang sửa — quay về đúng tên gốc thì
	// không gọi API check (name = chính nó, không phải trùng). Create = ''.
	// Cố ý non-reactive (snapshot original, chỉ đọc trong handler) — Batch 20
	// thêm so sánh trong markup nên cần $state.
	let supplierOriginalName = $state('');

	async function checkSupplierNameNow() {
		const name = str(supplierForm.name).trim();
		if (!name || !encryptionKeys) {
			supplierNameTaken = false;
			supplierNameChecked = false;
			return;
		}
		// B37: về đúng giá trị gốc → bỏ qua API, không bật checked (style chờ
		// event blur/submit). checking bật từ scheduleNameCheck sẽ tắt ở đây.
		if (name === supplierOriginalName.trim()) {
			supplierNameTaken = false;
			supplierNameChecking = false;
			return;
		}
		supplierNameChecking = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/check-name',
				{
					method: 'POST',
					body: {
						name,
						// Edit: bỏ qua chính nó (đổi field khác không tính là trùng tên)
						excludeId: supplierEditMode === 'edit' ? supplierEditId ?? undefined : undefined
					}
				},
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { exists?: boolean } | undefined;
				supplierNameTaken = !!data?.exists;
				supplierNameChecked = true;
			} else {
				// API lỗi → không chặn submit (chỉ mất check, server không có unique)
				supplierNameTaken = false;
				supplierNameChecked = false;
			}
		} catch {
			supplierNameTaken = false;
			supplierNameChecked = false;
		} finally {
			supplierNameChecking = false;
		}
	}

	function scheduleNameCheck() {
		clearTimeout(nameCheckTimer);
		const name = str(supplierForm.name).trim();
		if (!name) {
			supplierNameTaken = false;
			supplierNameChecking = false;
			supplierNameChecked = false;
			supplierNameTouched = false;
			return;
		}
		// B37: về đúng tên gốc → bỏ qua API (không trùng), nhưng KHÔNG bật
		// checked=true nữa — style success chờ event blur/submit của user.
		if (name === supplierOriginalName.trim()) {
			supplierNameTaken = false;
			supplierNameChecking = false;
			return;
		}
		supplierNameChecking = true;
		supplierNameChecked = false;
		nameCheckTimer = setTimeout(() => {
			void checkSupplierNameNow();
		}, 400);
	}

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

	// ── History timeline (batch 6: xem + khôi phục từng entry) ──
	// Backend: POST /suppliers/history {supplierId} → {entries}; POST /suppliers/restore
	// {supplierId, historyId} → {supplier}. Entry shape từ suppliers.ts SupplierHistoryEntry.
	let historyDisplay = $state(false);

	// B34 (m11088): breadcrumb analytics/history dùng cùng cách modal address (Batch 21) —
	// đo tràn rồi gom TỪNG nấc ĐẦU (Suppliers → tên NCC) vào popover more; còn dư chỗ thì trả
	// lại. 2 modal không dùng chung state với form (analytics mở KÈM form).
	let anaCrumbNavEl = $state<HTMLElement | null>(null);
	let anaCrumbOverflow = $state(0);
	let anaCrumbMoreOpen = $state(false);
	let hisCrumbNavEl = $state<HTMLElement | null>(null);
	let hisCrumbOverflow = $state(0);
	let hisCrumbMoreOpen = $state(false);
	
	// B51 (m24556): chuẩn hoá breadcrumb PO — mỗi modal PO = 1 node trong tree;
	// tràn → nấc cha lùi vào popover more (ưu tiên node lá), tap node → về panel.
	let poCrumbNavEl = $state<HTMLElement | null>(null);
	let poCrumbOverflow = $state(0);
	let poCrumbMoreOpen = $state(false);
	let stCrumbNavEl = $state<HTMLElement | null>(null);
	let stCrumbOverflow = $state(0);
	let stCrumbMoreOpen = $state(false);
	let rvCrumbNavEl = $state<HTMLElement | null>(null);
	let rvCrumbOverflow = $state(0);
	let rvCrumbMoreOpen = $state(false);
	let qcCrumbNavEl = $state<HTMLElement | null>(null);
	let qcCrumbOverflow = $state(0);
	let qcCrumbMoreOpen = $state(false);
	let vdCrumbNavEl = $state<HTMLElement | null>(null);
	let vdCrumbOverflow = $state(0);
	let vdCrumbMoreOpen = $state(false);
	let shCrumbNavEl = $state<HTMLElement | null>(null);
	let shCrumbOverflow = $state(0);
	let shCrumbMoreOpen = $state(false);
	async function measureTitleCrumbs(
		nav: HTMLElement | null,
		onlyMobile: boolean,
		getOverflow: () => number,
		setOverflow: (v: number) => void
	) {
		if (!nav || onlyMobile) {
			if (getOverflow() !== 0) setOverflow(0);
			return;
		}
		// bất kỳ item con scrollWidth > clientWidth+1 = đang bị cắt (như address).
		// Bỏ qua more-button + popover: popover item nowrap+ellipsis cũng có
		// scrollWidth > clientWidth nhưng KHÔNG phải nấc breadcrumb trên nav
		// (address không dính vì popover nằm ngoài nav .address-step__crumbs).
		const anyTruncated = () => {
			for (const el of nav.children) {
				const item = el as HTMLElement;
				if (item.classList.contains('supplier-modal-title__more') || item.classList.contains('supplier-crumb-popover')) continue;
				if (item.scrollWidth > item.clientWidth + 1) return true;
			}
			return false;
		};
		let guard = 0;
		while (anyTruncated() && guard < 8) {
			setOverflow(getOverflow() + 1);
			guard += 1;
			await tick();
		}
		while (getOverflow() > 0 && guard < 16) {
			setOverflow(getOverflow() - 1);
			guard += 1;
			await tick();
			if (anyTruncated()) {
				setOverflow(getOverflow() + 1);
				break;
			}
		}
	}
	let historyLoading = $state(false);
	let historyEntries = $state<HistoryEntry[]>([]);
	let historySupplier: { _id: string; name?: string } | null = $state(null);
	let restoreBusy = $state<string | null>(null); // historyId đang restore
	let historyConfirmDisplay = $state(false);
	let historyPendingRestore: HistoryEntry | null = $state(null);

	function openHistoryModal(row: SupplierRow) {
		historySupplier = { _id: str(row._id), name: str(row.name) };
		historyEntries = [];
		historyDisplay = true;
		void loadHistory();
		// B38: ghi ?modal=history để refresh restore lại đúng modal này
		setModalParam('history');
	}

	// Footer form modal: nhớ row đang edit để mở history không cần tham số.
	let historySupplierRow = $state<SupplierRow | undefined>(undefined);
	// Field passive (batch 11): metadata created/updated hiển thị cuối form modal —
	// chỉ edit mode có dữ liệu (create chưa có gì để hiển thị).
	let supplierPassive = $state<{ createdBy?: string; createdAt?: string; updatedBy?: string; updatedAt?: string } | null>(null);

	// Batch 24 mục 1: passive field — field hợp lệ bị khoá; đúp chạm trong 300ms unlock + focus, chạm đơn mở deep action
	let supplierFieldUnlocked = $state<Record<string, boolean>>({});
	const supplierTapTimers = new Map<string, ReturnType<typeof setTimeout>>();
	function resetSupplierPassiveFields() {
		for (const t of supplierTapTimers.values()) clearTimeout(t);
		supplierTapTimers.clear();
		supplierFieldUnlocked = {};
	}
	function openSupplierDeepAction(kind: 'phone' | 'email' | 'address', index: number) {
		const anchor = document.querySelector<HTMLAnchorElement>('[data-action-anchor="' + kind + '-' + index + '"]');
		anchor?.click();
	}
	function handleSupplierPassiveTap(e: MouseEvent, kind: 'phone' | 'email' | 'address', index: number) {
		if (supplierSubmitting) return;
		const key = kind + '-' + index;
		const pending = supplierTapTimers.get(key);
		if (pending) {
			clearTimeout(pending);
			supplierTapTimers.delete(key);
			supplierFieldUnlocked[key] = true;
			const wrap = (e.currentTarget as HTMLElement | null)?.closest('.field-icon-wrap, .address-passive-wrap');
			setTimeout(() => { const el = wrap?.querySelector('input, textarea') as HTMLElement | null; el?.focus(); }, 0);
			return;
		}
		supplierTapTimers.set(key, setTimeout(() => {
			supplierTapTimers.delete(key);
			openSupplierDeepAction(kind, index);
		}, 300));
	}
	function openHistoryFromFooter() {
		if (!historySupplierRow) return;
		openHistoryModal(historySupplierRow);
	}

	// ── Batch 20 (A4): more-menu footer — item hành động ──
	function moreOpenHistory() {
		supplierMoreOpen = false;
		openHistoryFromFooter();
	}

	function moreOpenDelete() {
		supplierMoreOpen = false;
		supplierDeleteDisplay = true;
	}

	// Phân tích: gọi API analytics/query type=supplier-summary (pattern
	// callAnalytics trang analytics — fetchSecure tự mã hoá, body là OBJECT).
	async function loadSupplierSummary() {
		if (!encryptionKeys || !supplierEditId || supplierAnalyticsLoading) return;
		supplierAnalyticsLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/analytics/query',
				{ method: 'POST', body: { type: 'supplier-summary', supplierId: supplierEditId } },
				encryptionKeys
			);
			if (response.ok) {
				supplierAnalyticsData = response.data as {
					orderCount: number;
					totalQuantity: number;
					totalValue: number;
					monthly: Array<{ period: string; orderCount: number; quantity: number; value: number }>;
				};
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.requestFailed), 'error');
				supplierAnalyticsDisplay = false;
			}
		} catch (err) {
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			supplierAnalyticsDisplay = false;
			if (import.meta.env.DEV) console.error('[admin/suppliers] supplier summary failed:', err);
		} finally {
			supplierAnalyticsLoading = false;
		}
	}

	function moreOpenAnalytics() {
		supplierMoreOpen = false;
		supplierAnalyticsDisplay = true;
		supplierAnalyticsData = undefined;
		void loadSupplierSummary();
		// B38: ghi ?modal=analytics để refresh restore lại đúng modal này
		setModalParam('analytics');
	}

	// B38: helper ghi/gỡ ?modal= trên URL (pattern ?supplier= batch 11 —
	// replaceState giữ nguyên history entry).
	function setModalParam(modal: string) {
		historyParam = modal;
		if (page.url.searchParams.get('modal') !== modal) {
			page.url.searchParams.set('modal', modal);
			history.replaceState(history.state, '', page.url);
		}
	}
	function cleanModalParam() {
		historyParam = '';
		if (page.url.searchParams.has('modal')) {
			page.url.searchParams.delete('modal');
			history.replaceState(history.state, '', page.url);
		}
	}

	// Xoá 1 NCC từ more-menu — TÁI SỬ DỤNG endpoint bulk-delete {ids:[id]}
	// (pattern bulkDeleteSelected). Sau xoá: toast + đóng modal edit (NCC đã
	// xoá không còn gì để edit) + refresh list.
	async function deleteSupplierFromMore() {
		if (!encryptionKeys || supplierDeleting || !supplierEditId) return;
		supplierDeleting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/bulk-delete',
				{ method: 'POST', body: { ids: [supplierEditId] } },
				encryptionKeys
			);
			supplierDeleting = false;
			if (response.ok) {
				showToast(pageContents.toasts.supplierDeleted[lang], 'success');
				supplierDeleteDisplay = false;
				supplierAnalyticsDisplay = false;
				supplierModalDisplay = false;
				resetSupplierPassiveFields();
				cleanSupplierParam();
				closeGuard.markClean();
				await loadSuppliers();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.supplierDeleteFailed), 'error');
			}
		} catch (err) {
			supplierDeleting = false;
			showToast(pageContents.toasts.supplierDeleteFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/suppliers] delete supplier failed:', err);
		}
	}

	async function loadHistory(opts?: { keepOnFail?: boolean }) {
		if (!historySupplier || !encryptionKeys) return;
		historyLoading = true;
		try {
			const res = await encryption.fetchSecure(
				'/api/admin/suppliers/history',
				{
					method: 'POST',
					// BẪY: fetchSecure tự mã hoá body — truyền OBJECT (không stringify,
					// stringify trước sẽ encrypt chuỗi JSON → server 400)
					body: { supplierId: historySupplier._id }
				},
				encryptionKeys
			);
			historyEntries = ((res.data as { entries?: HistoryEntry[] } | undefined)?.entries ?? []) as HistoryEntry[];
		} catch {
			// keepOnFail (restore-refresh): giữ entries cũ — đừng xoá dữ liệu
			// đang xem chỉ vì 1 lần fetch fail (network flapping tới Capella)
			if (!opts?.keepOnFail) historyEntries = [];
		} finally {
			historyLoading = false;
		}
	}

	// Restore: gọi endpoint rồi refresh bảng + danh sách history (entry 'restore' mới xuất hiện)
	async function performRestore(entry: HistoryEntry) {
		if (!historySupplier || !encryptionKeys || restoreBusy) return;
		restoreBusy = entry._id;
		try {
			const res = await encryption.fetchSecure(
				'/api/admin/suppliers/restore',
				{
					method: 'POST',
					body: { supplierId: historySupplier._id, historyId: entry._id }
				},
				encryptionKeys
			);
			if (!res.ok) {
				showToast(resolveServerMessage(res.message, lang, pageContents.toasts.saveFailed[lang]), 'error');
				return;
			}
			showToast(pageContents.toasts.restored[lang], 'success');
			historyConfirmDisplay = false;
			historyPendingRestore = null;
			await Promise.all([loadSuppliers(), loadHistory({ keepOnFail: true })]);
		} catch {
			showToast(pageContents.toasts.saveFailed[lang], 'error');
		} finally {
			// NHỊP chờ: showToast trước, reset busy sau — nút confirm không kẹt
			restoreBusy = null;
		}
	}

	// ── Dirty-guard (pattern brands: createCloseGuard + AlertDialog) ──
	let dirtyCloseDisplay = $state(false);
	// Batch 44 (m17527): prompt hỏi load draft hay form mới. draftPromptSaved
	// giữ JSON draft chờ quyết định; đóng dialog không chọn → giữ nguyên draft.
	let draftPromptDisplay = $state(false);
	let draftPromptSaved = $state<string | undefined>(undefined);
	const closeGuard = createCloseGuard({
		form: () => supplierForm,
		openConfirm: () => (dirtyCloseDisplay = true),
		close: () => {
			supplierModalDisplay = false;
			resetSupplierPassiveFields();
			dirtyCloseDisplay = false;
			// Deep-link (5f): đóng modal → gỡ ?supplier khỏi URL (share link
			// chỉ hợp khi modal đang mở)
			cleanSupplierParam();
		}
	});

	// Batch 18: đo tràn breadcrumb title modal (mobile) — container co bởi
	// min-width:0 nên scrollWidth > clientWidth = có item bị ép. Ẩn item CAO
	// NHẤT (Suppliers) vào popover trước; hàng còn [more][›][name] — nếu vẫn
	// tràn thì ellipsis trên name xử lý (đã có). Chỉ reset khi đang ẩn + tick
	// (DOM flush về [Suppliers][›][name]) trước đo — reset vô điều kiện gây
	// ping-pong RO vô hạn. Effect KHÔNG đọc suppliersCrumbHidden qua deps.
	async function measureCrumbOverflow() {
		if (!isMobile || !crumbTitleEl) return;
		if (suppliersCrumbHidden) {
			suppliersCrumbHidden = false;
			await tick();
		}
		// Batch 18 (review P1): title.scrollWidth === clientWidth LUÔN vì các item
		// con (__crumb/__name) có min-width:0 + overflow:hidden nuốt hết độ chênh
		// (probe tĩnh xác minh: title 343/343, name 543/274). Đo trên item CUỐI
		// (name active) — bị ellipsis cắt = đang tràn.
		const activeEl = crumbTitleEl.querySelector('.supplier-modal-title__name--active');
		const crumbEl = crumbTitleEl.querySelector('.supplier-modal-title__crumb');
		const overflowEl = activeEl ?? crumbEl;
		suppliersCrumbHidden = !!overflowEl && overflowEl.scrollWidth > overflowEl.clientWidth + 1;
	}

	$effect(() => {
		// deps: modal mở (element mount mới) / name/editMode/isMobile đổi →
		// DOM render lại → đo sau 1 frame. KHÔNG đọc suppliersCrumbHidden (loop).
		void supplierModalDisplay;
		void crumbTitleEl;
		void supplierForm.name;
		void supplierEditMode;
		void isMobile;
		const raf = requestAnimationFrame(measureCrumbOverflow);
		// Batch 14 lesson: viewport/rotate đổi không trigger effect → ResizeObserver
		const ro = new ResizeObserver(() => requestAnimationFrame(measureCrumbOverflow));
		if (crumbTitleEl) ro.observe(crumbTitleEl);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});

	$effect(() => {
		// modal đóng → reset popover (đo tự hết hiệu lực vì element unmount)
		if (!supplierModalDisplay) {
			suppliersCrumbHidden = false;
			crumbMoreOpen = false;
		}
	});

	$effect(() => {
		// Batch 18 (review P3): outside-click đóng popover — dùng mousedown như
		// Select click-outside, vì các nút trong form (vd image-upload row-btn)
		// gọi stopPropagation() trên click → event không bubble tới document.
		if (!crumbMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (crumbTitleEl && t && crumbTitleEl.contains(t)) return; // tap more/item → tự xử
			crumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	$effect(() => {
		// Batch 20 (A4): outside-click đóng more-menu footer — cùng cơ chế
		// mousedown (nút form stopPropagation click). Guard contains: tap nút
		// more / item menu → handler riêng xử lý, không đóng tại đây.
		if (!supplierMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (supplierMoreEl && t && supplierMoreEl.contains(t)) return;
			supplierMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	$effect(() => {
		// B34: đo tràn breadcrumb analytics/history sau khi modal render (1 frame).
		void supplierAnalyticsDisplay;
		void supplierAnalyticsLoading;
		void historySupplierRow?.name;
		void isMobile;
		void lang;
		const raf = requestAnimationFrame(() => void measureTitleCrumbs(anaCrumbNavEl, !isMobile, () => anaCrumbOverflow, (v) => (anaCrumbOverflow = v)));
		const ro = new ResizeObserver(() => requestAnimationFrame(() => void measureTitleCrumbs(anaCrumbNavEl, !isMobile, () => anaCrumbOverflow, (v) => (anaCrumbOverflow = v))));
		if (anaCrumbNavEl) ro.observe(anaCrumbNavEl);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});

	$effect(() => {
		void historyDisplay;
		void historyLoading;
		void historySupplier?.name;
		void isMobile;
		void lang;
		const raf = requestAnimationFrame(() => void measureTitleCrumbs(hisCrumbNavEl, !isMobile, () => hisCrumbOverflow, (v) => (hisCrumbOverflow = v)));
		const ro = new ResizeObserver(() => requestAnimationFrame(() => void measureTitleCrumbs(hisCrumbNavEl, !isMobile, () => hisCrumbOverflow, (v) => (hisCrumbOverflow = v))));
		if (hisCrumbNavEl) ro.observe(hisCrumbNavEl);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});

	$effect(() => {
		// B34: outside-click đóng popover breadcrumb analytics/history (cơ chế
		// mousedown như popover form modal — Batch 18 review P3).
		if (!anaCrumbMoreOpen && !hisCrumbMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (anaCrumbMoreOpen && anaCrumbNavEl && t && anaCrumbNavEl.contains(t)) return;
			if (hisCrumbMoreOpen && hisCrumbNavEl && t && hisCrumbNavEl.contains(t)) return;
			anaCrumbMoreOpen = false;
			hisCrumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});
	
	// B51 (m24556): đo tràn breadcrumb 6 modal PO sau render + resize (pattern B34).
	$effect(() => {
		void poModalDisplay;
		void statusModalDisplay;
		void poReviewDisplay;
		void variantDetailDisplay;
		void poShareDisplay;
		void quickCreateDisplay;
		void statusRow?.poCode;
		void poShareData?.poCode;
		void poEditMode;
		void isMobile;
		void lang;
		const measureAll = () => {
			const jobs: Array<[HTMLElement | null, () => number, (v: number) => void]> = [
				[poCrumbNavEl, () => poCrumbOverflow, (v) => (poCrumbOverflow = v)],
				[stCrumbNavEl, () => stCrumbOverflow, (v) => (stCrumbOverflow = v)],
				[rvCrumbNavEl, () => rvCrumbOverflow, (v) => (rvCrumbOverflow = v)],
				[qcCrumbNavEl, () => qcCrumbOverflow, (v) => (qcCrumbOverflow = v)],
				[vdCrumbNavEl, () => vdCrumbOverflow, (v) => (vdCrumbOverflow = v)],
				[shCrumbNavEl, () => shCrumbOverflow, (v) => (shCrumbOverflow = v)],
			];
			for (const [nav, get, set] of jobs) void measureTitleCrumbs(nav, !isMobile, get, set);
		};
		const raf = requestAnimationFrame(measureAll);
		const ro = new ResizeObserver(() => requestAnimationFrame(measureAll));
		for (const nav of [poCrumbNavEl, stCrumbNavEl, rvCrumbNavEl, qcCrumbNavEl, vdCrumbNavEl, shCrumbNavEl]) {
			if (nav) ro.observe(nav);
		}
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
	
	// B51 (m24556): outside-click đóng popover breadcrumb modal PO (mousedown —
	// nút form stopPropagation click, Batch 18 review P3).
	$effect(() => {
		if (!poCrumbMoreOpen && !stCrumbMoreOpen && !rvCrumbMoreOpen && !qcCrumbMoreOpen && !vdCrumbMoreOpen && !shCrumbMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (poCrumbMoreOpen && poCrumbNavEl && t && poCrumbNavEl.contains(t)) return;
			if (stCrumbMoreOpen && stCrumbNavEl && t && stCrumbNavEl.contains(t)) return;
			if (rvCrumbMoreOpen && rvCrumbNavEl && t && rvCrumbNavEl.contains(t)) return;
			if (qcCrumbMoreOpen && qcCrumbNavEl && t && qcCrumbNavEl.contains(t)) return;
			if (vdCrumbMoreOpen && vdCrumbNavEl && t && vdCrumbNavEl.contains(t)) return;
			if (shCrumbMoreOpen && shCrumbNavEl && t && shCrumbNavEl.contains(t)) return;
			poCrumbMoreOpen = false;
			stCrumbMoreOpen = false;
			rvCrumbMoreOpen = false;
			qcCrumbMoreOpen = false;
			vdCrumbMoreOpen = false;
			shCrumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	$effect(() => {
		// Batch 20 (A4): modal đóng → reset more-menu + panel analytics
		// (element unmount, đo tự hết hiệu lực — chỉ cần reset state).
		if (!supplierAnalyticsDisplay) {
			anaCrumbOverflow = 0;
			anaCrumbMoreOpen = false;
		}
		if (!historyDisplay) {
			hisCrumbOverflow = 0;
			hisCrumbMoreOpen = false;
		}
		if (!supplierModalDisplay) {
			supplierMoreOpen = false;
			supplierDeleteDisplay = false;
			supplierAnalyticsDisplay = false;
			supplierAnalyticsData = undefined;
			supplierAnalyticsLoading = false;
		}
		if (!poModalDisplay) {
			poCrumbOverflow = 0;
			poCrumbMoreOpen = false;
		}
		if (!statusModalDisplay) {
			stCrumbOverflow = 0;
			stCrumbMoreOpen = false;
		}
		if (!poReviewDisplay) {
			rvCrumbOverflow = 0;
			rvCrumbMoreOpen = false;
		}
		if (!quickCreateDisplay) {
			qcCrumbOverflow = 0;
			qcCrumbMoreOpen = false;
		}
		if (!variantDetailDisplay) {
			vdCrumbOverflow = 0;
			vdCrumbMoreOpen = false;
		}
		if (!poShareDisplay) {
			shCrumbOverflow = 0;
			shCrumbMoreOpen = false;
		}
		// B38: cả 2 modal con đã đóng → gỡ ?modal= khỏi URL (param chỉ hợp
		// khi modal đang mở). historyParam chặn replaceState mỗi lần effect chạy.
		void historyDisplay;
		void supplierAnalyticsDisplay;
		if (!historyDisplay && !supplierAnalyticsDisplay && historyParam) {
			cleanModalParam();
		}
	});
	// Deep-link (batch 11, 5f): gỡ ?supplier= khỏi URL giữ nguyên query khác
	function cleanSupplierParam() {
		cleanModalParam();
		if (page.url.searchParams.has('supplier')) {
			page.url.searchParams.delete('supplier');
			history.replaceState(history.state, '', page.url);
		}
	}

	// Batch 16 (mục 8): tap phần Suppliers/tên trên breadcrumb step-picker địa giới
	// (mobile) → đóng step modal về form supplier (liền mạch, KHÔNG đóng form modal).
	// Bấm hộ nút ✕ của step modal bằng synthetic event — address-input không expose
	// API đóng; dispatchEvent (không .click()) vì Playwright/probe intercept.
	function attemptCloseStepModal() {
		const closeBtn = document.querySelector<HTMLButtonElement>('.address-step__close');
		closeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
	}

	// Batch 17: tap 'Nhà cung cấp' trên breadcrumb step modal → đóng TẤT CẢ
	// (step TRƯỚC rồi form modal — dirty-guard hiện nếu form dirty, không bị
	// step modal đè). Step đóng trượt vẫn tiếp tục attemptClose.
	function closeAllFromStep() {
		attemptCloseStepModal();
		closeGuard.attemptClose();
	}

	// ── Bulk selection (yêu cầu 2: STT hover → checkbox, copy/delete hàng loạt) ──
	let selectedIds = $state<string[]>([]);
	// select-all 'filtered': DataTable đọc flag này (allPageSelected) — true khi
	// user đã chọn select-all toàn bộ kết quả filter (qua fetch ids).
	let allFilteredSelected = $state(false);
	let selectAllBusy = $state(false);
	let bulkDeleteDisplay = $state(false);
	let bulkDeleting = $state(false);

	// ── Batch 20 (A4): more-menu footer form modal — thay nút history bằng
	// icon more mở popover (history / delete / analytics). Pattern Batch 18:
	// mousedown outside-click + guard contains (nút form stopPropagation click).
	let supplierMoreOpen = $state(false);
	let supplierMoreEl = $state<HTMLElement | null>(null);
	// Xoá 1 NCC từ more-menu: confirm AlertDialog → POST bulk-delete {ids:[id]}
	let supplierDeleteDisplay = $state(false);
	let supplierDeleting = $state(false);
	// Panel phân tích: dữ liệu API type=supplier-summary
	let supplierAnalyticsDisplay = $state(false);
	let supplierAnalyticsLoading = $state(false);
	let supplierAnalyticsData = $state<{
		orderCount: number;
		totalQuantity: number;
		totalValue: number;
		monthly: Array<{ period: string; orderCount: number; quantity: number; value: number }>;
	} | undefined>(undefined);

	// Select-all đa trang: fetch TẤT CẢ suppliers khớp filter hiện tại (page 1,
	// pageSize = total) rồi gán ids — mirror body loadSuppliers.
	async function selectAllFilteredSuppliers() {
		if (!encryptionKeys || selectAllBusy) return;
		selectAllBusy = true;
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
		} finally {
			selectAllBusy = false;
		}
	}

	// clearSelection theo 2 chiều (bulk-bar close / bulk delete): DataTable
	// selected set + page selectedIds + flag all-filtered.
	function clearSuppliersSelection() {
		selectedIds = [];
		allFilteredSelected = false;
	}

	// Batch 28c: count = số id THẬT đã chọn — select-all fetch ĐỦ toàn bộ ids
	// nên selectedIds.length luôn khớp số row chọn (deselect 1 row → count giảm ngay).
	const bulkDisplayCount = $derived(selectedIds.length);

	// Batch 28c: user deselect bớt row sau select-all → drop flag để nút
	// Uncheck all đổi về Select all (effect tự chặn nên không loop).
	$effect(() => {
		if (allFilteredSelected && selectedIds.length < suppliersTotal) allFilteredSelected = false;
	});

	// ── Modal tạo PO ──
	let poModalDisplay = $state(false);
	let poSubmitting = $state(false);
	let poError = $state<string | undefined>(undefined);
	// B47 (m19661): edit PO draft — mode + id + row gốc (crumb active)
	let poEditMode = $state<'create' | 'edit'>('create');
	let poEditId = $state<string | null>(null);
	let poOriginalCode = $state('');
	// B47: xoá 1 PO từ status modal (chỉ draft/cancelled)
	let poDeleteConfirmDisplay = $state(false);
	let poDeleteBusy = $state(false);
	// B52 (m25115): mốc min cho expectedAt — hôm nay (local).
	let poExpectedMin = $state("");
	// B52 (m25115): tiền tệ — system currency (VND mặc định) + tỷ giá USD→VND (cache 30 phút).
	let poCurrency = $state<"VND" | "USD">("VND");
	let poFxRate = $state(0); // số VND cho 1 USD
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
	// B49 (chain B): item CUỐI hợp lệ mới cho phép "Thêm dòng" (list rỗng → enabled).
	const lastPoItemValid = $derived.by(() => {
		if (poForm.items.length === 0) return true;
		const last = poForm.items[poForm.items.length - 1];
		return !!last.variantId && Number.isFinite(last.quantity) && last.quantity > 0;
	});

	// B50 (m21047): nút Save PO disabled khi form invalid — disable thay vì báo lỗi lúc bấm.
	const poFormInvalid = $derived(validatePOForm() !== undefined);
	// B49 (chain B): 2 dòng trùng variantId → highlight + chặn submit.
	function poItemDuplicate(index: number): boolean {
		const cur = poForm.items[index];
		if (!cur || !cur.variantId) return false;
		return poForm.items.some((it, i) => i !== index && it.variantId === cur.variantId);
	}

	// ── B49 (chain B): review trước submit ──
	let poReviewDisplay = $state(false);
	// ── B49 (chain B): share ảnh sau khi tạo PO thành công ──
	let poShareDisplay = $state(false);
	let poShareData = $state<null | { poCode: string; supplierLabel: string; branchLabel: string; expectedAt: string; totalCost: number; items: { label: string; quantity: number }[] }>(null); // B52 (m25115) totalCost
	let poShareBusy = $state(false);
	// ── B49 (chain B): quick-create từ Select (supplier/branch/variant) ──
	let quickCreateKind = $state<null | 'supplier' | 'branch' | 'variant'>(null);
	// B50 (m21047): PO select đang đợi supplier mới — tạo xong chọn vào Select + nạp lại
	let poSelectPendingSupplier: { seedName?: string } | null = null;
	// target: field đợi giá trị sau khi tạo — 'supplier' | 'branch' | index item (string số)
	let quickCreateTarget = $state<null | 'supplier' | 'branch' | string>(null);
	let quickCreateName = $state('');
	let quickCreatePhone = $state('');
	let quickCreateEmail = $state('');
	let quickCreateSku = $state('');
	let quickCreateDisplayName = $state('');
	let quickCreatePrice = $state('');
	let quickCreateProductId = $state('');
	let quickCreateBusy = $state(false);
	let quickCreateError = $state<string | undefined>(undefined);
	let quickCreateProducts = $state<{ _id: string; name?: string }[]>([]);
	let quickCreateProductsLoaded = $state(false);
	// B49 (chain B): display riêng cho Modal quick-create (bind:display cần $state).
	let quickCreateDisplay = $state(false);
	// B49 (chain B): options product cho quick-create variant.
	const quickCreateProductOptions = $derived(quickCreateProducts.map((p) => ({ value: p._id, label: p.name ?? p._id })));
	// B49 (chain B): variant đang xem detail (read-only).
	const variantDetail = $derived(variantOptions.find((v) => v._id === variantDetailId) ?? null);
	// B49 (chain B): variant quick-create cần danh sách product — load khi mở modal.
	$effect(() => {
		if (quickCreateKind === 'variant') void loadQuickCreateProducts();
	});
	// ── B49 (chain B): variant detail read-only ──
	let variantDetailDisplay = $state(false);
	// B52 (m25115): edit variant từ detail modal — displayName + price (endpoint /api/admin/variants/update).
	let variantDetailEditing = $state(false);
	let variantDetailDisplayName = $state("");
	let variantDetailPrice = $state("");
	let variantDetailBusy = $state(false);
	let variantDetailError = $state<string | undefined>(undefined);
	let variantDetailId = $state<string | null>(null);

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

	// B46.2 (m19177): card fields tab PO — mirror purchases page (title = code)
	let poCardFieldIds = $state<string[]>(['code', 'status', 'totalCost', 'expectedAt']);

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

	// B46 (m18161): search debounce PO — cùng pattern suppliers, guard tab PO.
	$effect(() => {
		void poSearchQuery;
		if (activeTab !== 'purchase-orders') return;
		if (!poSearchArmed) {
			poSearchArmed = true;
			return;
		}
		clearTimeout(poSearchDebounce);
		poSearching = true;
		poSearchDebounce = setTimeout(() => {
			posPage = 1;
			currentPagingPage = 1;
			void loadPOs();
		}, 300);
	});

	// BẪY: card mode mobile unmount Input trong caption → emit undefined qua
	// bind:value. Guard mọi chỗ đọc searchQuery bằng (searchQuery ?? '').
	function saveSearchKeyword() {
		const kw = (searchQuery ?? '').trim();
		if (kw) recordSearchKeyword(PREFS_KEY, kw);
	}

	// Batch 17: popover suggest lọc theo từ đang gõ — chỉ hiện keyword chứa
	// chuỗi search hiện tại (case-insensitive); search rỗng → hiện tất cả.
	const recentKeywordsFiltered = $derived.by(() => {
		const q = (searchQuery ?? '').trim().toLowerCase();
		const all = getSearchKeywords(PREFS_KEY);
		return q ? all.filter((k) => k.toLowerCase().includes(q)) : all;
	});

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

	// B52 (m25115): sort PO từ DataTable header — persist prefs giống suppliers.
	function onPOSortChange(columnId: string, order: "asc" | "desc" | null) {
		if (!order || !columnId) {
			poSortField = "";
			poSortDirection = "desc";
		} else {
			poSortField = columnId;
			poSortDirection = order;
		}
		saveDataTablePrefs(PO_PREFS_KEY, {
			sort: poSortField ? { field: poSortField, direction: poSortDirection } : undefined,
			cardFields: poCardFieldIds
		});
		poSearching = true;
		posPage = 1;
		currentPagingPage = 1;
		void loadPOs();
	}

	// ── Filter tab suppliers: persist filters + searching skeleton ──
	async function onSupplierFilterChange() {
		saveDataTablePrefs(PREFS_KEY, {
			filters: { status: supplierStatusFilter || null },
			cardFields: cardFieldIds
		});
		suppliersPage = 1;
		currentPagingPage = 1;
		searching = true; // B53 (m26523): skeleton khi filter
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

	// B52 (m25115): giá PO hiển thị theo đơn vị tiền hệ thống; USD → quy đổi qua tỷ giá live.
	function formatPoMoney(vndAmount?: number): string {
		const v = vndAmount ?? 0;
		if (poCurrency === "USD" && poFxRate > 0) {
			return new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US", {
				style: "currency",
				currency: "USD",
				maximumFractionDigits: 2
			}).format(v / poFxRate);
		}
		return new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US", {
			style: "currency",
			currency: "VND",
			maximumFractionDigits: 0
		}).format(v);
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
				// Deep-link (batch 11, 5f): URL ?supplier=<id> → tự mở modal edit
				// đúng NCC một lần sau khi dữ liệu sẵn sàng.
				if (!deepLinkConsumed) {
					deepLinkConsumed = true;
					const linkId = page.url.searchParams.get('supplier');
					if (linkId) {
						const row = suppliers.find((s) => s._id === linkId) as SupplierRow | undefined;
						if (row) openSupplierEditModal(row as unknown as Record<string, unknown>);
						// id không còn tồn tại → dọn param tránh mở lại vòng sau
						else cleanSupplierParam();
						// B38: restore modal con (history/analytics) sau khi form đã mở —
						// analytics/history cần supplierEditId/historySupplierRow sẵn sàng.
						const modalParam = page.url.searchParams.get('modal');
						if (row && modalParam === 'history') openHistoryFromFooter();
						else if (row && modalParam === 'analytics') moreOpenAnalytics();
					}
				}
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
						supplierId: poSupplierFilter || undefined,
						// B46 (m18161): search + sort server cho tab PO
						search: (poSearchQuery ?? '').trim() || undefined,
						sortField: poSortField || undefined,
						sortDirection: poSortField ? poSortDirection : undefined
					}
				},
				encryptionKeys
			);
			posLoading = false;
			poSearching = false;
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
			poSearching = false;
			posError = resolveServerMessage(undefined, lang, pageContents.states.errorTitlePOs);
			if (import.meta.env.DEV) console.error('[admin/suppliers] load POs failed:', err);
		}
	}

	function switchTab(tab: 'suppliers' | 'purchase-orders') {
		if (activeTab === tab) return;
		activeTab = tab;
		// B48 (m20355): đồng bộ deep-link ?tab= (gỡ khi về suppliers — URL mặc định sạch)
		if (tab === 'purchase-orders') {
			if (page.url.searchParams.get('tab') !== 'purchase-orders') {
				page.url.searchParams.set('tab', 'purchase-orders');
				history.replaceState(history.state, '', page.url);
			}
		} else if (page.url.searchParams.has('tab')) {
			page.url.searchParams.delete('tab');
			history.replaceState(history.state, '', page.url);
		}
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
			accessor: (row) => formatPoMoney((row as unknown as PurchaseOrderRow).totalCost), // B52 (m25115) currency
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


	// Options sort từ supplierColumns sortable (mirror header sort).
	const settingSortOptions = $derived(
		supplierColumns
			.filter((c) => c.sortable)
			.map((c) => ({ value: c.id, label: c.label }))
	);

	// B46 (m18161): sort options PO từ poColumns sortable.
	const poSortOptions = $derived(
		poColumns
			.filter((c) => c.sortable)
			.map((c) => ({ value: c.id, label: c.label }))
	);

	// ── Modal tạo/sửa nhà cung cấp ──
	function emptySupplierForm() {
		return {
			name: '',
			contactPerson: '',
			address: '',
			phones: [] as string[],
			emails: [] as string[],
			addresses: [] as SupplierAddressEntry[],
			zalo: [] as string[],
			telegram: [] as string[],
			discord: [] as string[],
			facebook: [] as string[],
			instagram: [] as string[],
			website: [] as string[],
			images: [] as string[],
			/** Batch 15 (m12278-5): original URLs 1-1 images (thumb) — full-view */
			imageFulls: [] as string[],
			avatarUrl: '',
			note: '',
			status: 'active'
		};
	}

	// Batch 44 (m17527): apply JSON draft đã lưu vào form + seed breakdowns.
	// Tách từ luồng resume cũ của openSupplierModal để prompt Load draft dùng lại.
	function applyDraftToForm(raw: string): boolean {
		try {
			const saved = JSON.parse(raw) as Partial<typeof supplierForm>;
			if (!saved || typeof saved !== 'object' || !saved.name) return false;
			// BẪY: mảng từ draft JSON có thể chứa null (Input unmount emit
			// undefined qua bind → JSON.stringify biến thành null) → x.trim() nổ
			const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
			const socialArr = (v: unknown) => {
				// Draft cũ (batch ≤6): social là string đơn → bọc thành mảng 1 phần tử
				if (typeof v === 'string' && v.trim()) return [v.trim()];
				return arr(v);
			};
			supplierForm = {
				...emptySupplierForm(),
				...saved,
				phones: arr(saved.phones),
				emails: arr(saved.emails),
				addresses: Array.isArray(saved.addresses) ? saved.addresses : [],
				zalo: socialArr(saved.zalo),
				telegram: socialArr(saved.telegram),
				discord: socialArr(saved.discord),
				facebook: socialArr(saved.facebook),
				instagram: socialArr(saved.instagram),
				website: socialArr(saved.website),
				images: arr(saved.images),
				imageFulls: arr(saved.imageFulls),
				avatarUrl: saved.avatarUrl ?? '',
				note: saved.note ?? '',
				status: saved.status ?? 'active'
			};
			supplierAddressBreakdowns = supplierForm.addresses.map((a) => ({
				province: a.province ?? '',
				district: a.district ?? '',
				ward: a.ward
			}));
			supplierNewAddressBreakdowns = supplierForm.addresses.map((a) => ({
				province: a.newProvince ?? '',
				ward: a.newWard ?? ''
			}));
			return true;
		} catch {
			clearDraftPref(DRAFT_FORM_KEY);
			return false;
		}
	}
	function handleDraftPromptLoad() {
		if (draftPromptSaved && applyDraftToForm(draftPromptSaved)) {
			showToast(pageContents.toasts.draftRestored[lang], 'success');
		}
		draftPromptSaved = undefined;
	}
	function handleDraftPromptNew() {
		clearDraft(); // user chọn form mới → xoá draft, sau không prompt lại
		draftPromptSaved = undefined;
	}
	function openSupplierModal() {
		supplierEditMode = 'create';
		supplierEditId = null;
		supplierOriginalName = '';
		// Batch 20 (A5): reset trạng thái check name — tránh badge/hint thừa
		// từ lần mở modal trước (state sống ngoài vòng đời modal).
		supplierNameTaken = false;
		supplierNameChecking = false;
		supplierNameChecked = false;
		supplierNameTouched = false;
		supplierPassive = null;
		// Batch 44 (m17527): có draft có dữ liệu → HỎI (prompt) thay vì tự resume.
		// Chọn Load draft → applyDraftToForm; chọn New form → xoá draft vĩnh viễn;
		// đóng dialog không chọn → giữ draft, form trống phía sau.
		const raw = readDraftPref(DRAFT_FORM_KEY);
		let hasDraft = false;
		if (typeof raw === 'string' && raw) {
			try {
				const saved = JSON.parse(raw) as Partial<typeof supplierForm>;
				if (saved && typeof saved === 'object' && saved.name) hasDraft = true;
			} catch {
				clearDraftPref(DRAFT_FORM_KEY);
			}
		}
		if (hasDraft) {
			draftPromptSaved = raw;
			draftPromptDisplay = true;
		}
		supplierForm = emptySupplierForm();
		supplierAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.province ?? '',
			district: a.district ?? '',
			ward: a.ward
		}));
		supplierNewAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.newProvince ?? '',
			ward: a.newWard ?? ''
		}));
		supplierError = undefined;
		supplierSubmitAttempted = false;
		supplierModalDisplay = true;
		void seedImagesAfterMount();
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
			// Batch 15 (m12278-5): seed kèm imageFulls — entry EXISTING biết URL
			// bản gốc cho full-view (imageFulls 1-1 theo index images).
			const pairs = supplierForm.images.map((thumb, i) => ({
				thumb,
				original: str(supplierForm.imageFulls[i] ?? '').trim() || undefined
			}));
			supplierImageUpload.seedFromImagePairs(pairs);
		}
	}
	// ── Edit: prefill form từ row của bảng (dùng chung form với create) ──
	function openSupplierEditModal(row: Record<string, unknown>) {
		const r = row as unknown as SupplierRow;
		supplierEditMode = 'edit';
		supplierEditId = r._id ?? null;
		supplierOriginalName = r.name ?? '';
		// Batch 20 (A5): reset 3 state check name TRƯỚC khi render — fix lỗi
		// mở detail NCC (chưa thao tác gì) vẫn hiện badge "Tên đã tồn tại" /
		// "đang kiểm tra" từ lần thao tác trước (state sống ngoài vòng đời
		// modal). $effect theo dõi name sẽ schedule check lại ngay sau đó;
		// nếu name === original → checked=true (xanh) không bật checking.
		supplierNameTaken = false;
		supplierNameChecking = false;
		supplierNameChecked = false;
		supplierNameTouched = false;
		// Deep-link (5f): giữ ?supplier=<id> trên URL để chia sẻ link đúng NCC
		if (r._id && page.url.searchParams.get('supplier') !== r._id) {
			page.url.searchParams.set('supplier', r._id);
			history.replaceState(history.state, '', page.url);
		}
		historySupplierRow = r;
		supplierPassive = {
			createdBy: r.createdBy ?? undefined,
			createdAt: r.createdAt ?? undefined,
			updatedBy: r.updatedBy ?? undefined,
			updatedAt: r.updatedAt ?? undefined
		};
		const addr0 = r.addresses?.[0];
		supplierForm = {
			name: r.name ?? '',
			contactPerson: r.contactPerson ?? '',
			// cấp 1 = entry đầu của addresses (bỏ field đơn)
			address: addr0?.address ?? r.address ?? '',
			phones: [...(r.phones ?? [])],
			emails: [...(r.emails ?? [])],
			addresses: (r.addresses ?? []).map((a) => ({ ...a })),
			// Social: doc cũ lưu string đơn → bọc mảng; doc mới là mảng
			zalo: toSocialArray((r as Record<string, unknown>).zalo),
			telegram: toSocialArray((r as Record<string, unknown>).telegram),
			discord: toSocialArray((r as Record<string, unknown>).discord),
			facebook: toSocialArray((r as Record<string, unknown>).facebook),
			instagram: toSocialArray((r as Record<string, unknown>).instagram),
			website: toSocialArray((r as Record<string, unknown>).website),
			images: [...(r.images ?? [])],
			imageFulls: [...((r as Record<string, unknown>).imageFulls as string[] ?? [])],
			avatarUrl: (r as Record<string, unknown>).avatarUrl as string | undefined ?? r.images?.[0] ?? '',
			note: (r as Record<string, unknown>).note as string | undefined ?? '',
			status: r.status ?? 'active'
		};
		supplierAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.province ?? '',
			district: a.district ?? '',
			ward: a.ward
		}));
		supplierNewAddressBreakdowns = supplierForm.addresses.map((a) => ({
			province: a.newProvince ?? '',
			ward: a.newWard ?? ''
		}));
		supplierError = undefined;
		supplierSubmitAttempted = false;
		supplierModalDisplay = true;
		void seedImagesAfterMount();
		// Batch 16 (m13579-5): baseline Save-gate chụp CÙNG thời điểm markClean
		// (event handler — không cần untrack) → dirty-guard và Save nhất quán.
		supplierEditBaseline = JSON.stringify(supplierForm);
		closeGuard.markClean();
	}

	// ── Validate social theo từng mạng + phone/email (regex thuần trang tự giữ) ──
	const PHONE_RE = /^(\+?84|0)(\d{8,10})$/;
	const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const ZALO_RE = /^(\+?84|0)\d{8,10}$|^https?:\/\/(zalo\.me\/\S+)$/i;
	const TELEGRAM_RE = /^@[A-Za-z0-9_]{4,32}$|^https?:\/\/(t\.me\/\S+)$/i;
	const DISCORD_RE = /^[A-Za-z0-9._]{2,32}$/;
	const FACEBOOK_RE = /^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/\S+$/i;
	const INSTAGRAM_RE = /^@[A-Za-z0-9._]{1,30}$|^https?:\/\/(www\.)?instagram\.com\/\S+$/i;
	const WEBSITE_RE = /^https?:\/\/\S+\.\S+$/i;

	// Batch 24 mục 1: field hợp lệ + không trùng ⇒ passive (disabled) cho tới khi đúp chạm unlock
	function supplierPhoneValid(index: number): boolean {
		const phone = str(supplierForm.phones[index]).trim();
		return !!phone && PHONE_RE.test(phone) && (phoneDupCounts.get(phone.toLowerCase()) ?? 0) < 2;
	}
	function supplierEmailValid(index: number): boolean {
		const email = str(supplierForm.emails[index]).trim();
		return !!email && EMAIL_RE.test(email) && (emailDupCounts.get(email.toLowerCase()) ?? 0) < 2;
	}

	// Batch14 (m11713): address entry "hợp lệ" = đã chọn địa giới (tỉnh hệ cũ
	// hoặc hệ mới) — điều kiện để bật nút "+ Add address" và validate submit.
	// Entry chỉ có text địa chỉ chi tiết mà không có tỉnh vẫn tính CHƯA hợp lệ.
	// Batch 20 (A7): entry "có nội dung" = text địa chỉ OR đã chọn địa giới bất
	// kỳ (cũ/mới) — entry RỖNG HOÀN TOÀN không chặn nút add (user cần thêm
	// dòng mới; entry rỗng được prune lúc submit). Định nghĩa invalid MỚI:
	// đã có nội dung mà chưa chọn tỉnh — đúng ý user "field item invalid thì
	// không cho thêm mới", tránh khoá cứng vì entry trắng.
	function addressEntryHasContent(index: number): boolean {
		const a = supplierForm.addresses[index];
		const bd = supplierAddressBreakdowns[index];
		const nbd = supplierNewAddressBreakdowns[index];
		return (
			str(a?.address).trim() !== '' ||
			str(bd?.province).trim() !== '' ||
			str(bd?.district).trim() !== '' ||
			str(bd?.ward).trim() !== '' ||
			str(nbd?.province).trim() !== '' ||
			str(nbd?.ward).trim() !== ''
		);
	}

	function addressEntryInvalid(index: number): boolean {
		if (!addressEntryHasContent(index)) return false;
		const bd = supplierAddressBreakdowns[index];
		const nbd = supplierNewAddressBreakdowns[index];
		return !str(bd?.province).trim() && !str(nbd?.province).trim();
	}

	// Batch 22 (m00193-2): entry đủ điều kiện deep-action Maps? — CẦN address
	// text không rỗng VÀ có tỉnh (hệ cũ hoặc mới). Không yêu cầu đủ 3 cấp:
	// Maps search vẫn chạy với tỉnh + address.
	function addressEntryActionable(index: number): boolean {
		const a = supplierForm.addresses[index];
		if (!a || !str(a.address).trim()) return false;
		const bd = supplierAddressBreakdowns[index];
		const nbd = supplierNewAddressBreakdowns[index];
		return !!str(bd?.province).trim() || !!str(nbd?.province).trim();
	}

	// Batch 22: URL Google Maps cho entry — query = [label, address, ward,
	// district, province] bỏ phần rỗng, join ', ' rồi encodeURIComponent.
	function addressMapsUrl(index: number): string {
		const a = supplierForm.addresses[index];
		const bd = supplierAddressBreakdowns[index];
		const nbd = supplierNewAddressBreakdowns[index];
		const parts = [
			str(a?.label).trim(),
			str(a?.address).trim(),
			str(bd?.ward).trim(),
			str(bd?.district).trim(),
			str(bd?.province).trim() || str(nbd?.province).trim()
		].filter(Boolean);
		return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
	}

	// Social giá trị từ server: doc cũ = string đơn, doc mới = mảng → chuẩn hoá
	// thành mảng string sạch (dùng cho prefill edit + validate + payload).
	function toSocialArray(v: unknown): string[] {
		if (typeof v === 'string') {
			const s = v.trim();
			return s ? [s] : [];
		}
		if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x.trim());
		return [];
	}

	// Mỗi social entry hợp lệ? (validate từng tag khi add + khi submit)
	function socialEntryInvalid(field: SocialFieldKey, value: string): boolean {
		const s = value.trim();
		if (!s) return true;
		switch (field) {
			case 'zalo':
				return !ZALO_RE.test(s);
			case 'telegram':
				return !TELEGRAM_RE.test(s);
			case 'discord':
				return !DISCORD_RE.test(s);
			case 'facebook':
				return !FACEBOOK_RE.test(s);
			case 'instagram':
				return !INSTAGRAM_RE.test(s);
			case 'website':
				return !WEBSITE_RE.test(s);
		}
	}

	// ── Social tags: add/edit/remove (multi-value, cấm trùng) ──
	const socialDraftInputs = $state<Record<SocialFieldKey, string>>({
		zalo: '', telegram: '', discord: '', facebook: '', instagram: '', website: ''
	});
	const socialTagErrors = $state<Record<SocialFieldKey, 'socialDuplicate' | 'socialInvalidTag' | null>>({
		zalo: null, telegram: null, discord: null, facebook: null, instagram: null, website: null
	});
	let editingSocial = $state<{ field: SocialFieldKey; index: number; value: string } | null>(null);

	function addSocialTag(field: SocialFieldKey) {
		const value = socialDraftInputs[field].trim();
		if (!value) return;
		if (socialEntryInvalid(field, value)) {
			socialTagErrors[field] = 'socialInvalidTag';
			return;
		}
		// Cấm trùng (case-insensitive) trong cùng field
		if (supplierForm[field].some((v) => v.trim().toLowerCase() === value.toLowerCase())) {
			socialTagErrors[field] = 'socialDuplicate';
			return;
		}
		socialTagErrors[field] = null;
		supplierForm[field] = [...supplierForm[field], value];
		socialDraftInputs[field] = '';
	}

	function removeSocialTag(field: SocialFieldKey, index: number) {
		supplierForm[field] = supplierForm[field].filter((_, i) => i !== index);
		if (editingSocial?.field === field && editingSocial.index === index) editingSocial = null;
	}

	function startSocialEdit(field: SocialFieldKey, index: number) {
		editingSocial = { field, index, value: supplierForm[field][index] };
	}

	// Commit edit inline: giá trị rỗng → xoá tag; trùng/hợp lệ check như add.
	// BẪY: onblur + Enter kích đôi (Enter → commit → editingSocial=null → blur
	// không còn target) — commit kiểm tra editingSocial trước khi chạy.
	function commitSocialEdit() {
		const edit = editingSocial;
		if (!edit) return;
		editingSocial = null;
		const value = edit.value.trim();
		const others = supplierForm[edit.field].filter((_, i) => i !== edit.index);
		if (!value) {
			removeSocialTag(edit.field, edit.index);
			return;
		}
		if (socialEntryInvalid(edit.field, value)) return; // giữ giá trị cũ
		if (others.some((v) => v.trim().toLowerCase() === value.toLowerCase())) return; // trùng → giữ cũ
		const next = [...supplierForm[edit.field]];
		next[edit.index] = value;
		supplierForm[edit.field] = next;
	}

	// Tag link → href mở tab mới. @username (telegram/instagram) đổi thành URL;
	// zalo SĐT không có link → chỉ link khi là http(s).
	function socialTagHref(field: SocialFieldKey, value: string): string {
		const s = value.trim();
		if (/^https?:\/\//i.test(s)) return s;
		// Batch 11 (5d): mọi network có thể build URL trang — nút open-tab hiện
		// cho mọi giá trị hợp lệ, không chỉ giá trị dạng link sẵn.
		if (field === 'telegram' && s.startsWith('@')) return `https://t.me/${s.slice(1)}`;
		if (field === 'instagram' && s.startsWith('@')) return `https://instagram.com/${s.slice(1)}`;
		if (field === 'zalo' && /^(\+?84|0)\d{8,10}$/.test(s)) return `https://zalo.me/${s.replace(/^\+?84/, '0')}`;
		if (field === 'facebook') return `https://facebook.com/${s.replace(/^@/, '')}`;
		if (field === 'website') return /^https?:/i.test(s) ? s : `https://${s}`;
		return '';
	}

	function validateSupplierForm(): string | undefined {
		if (!str(supplierForm.name).trim()) {
			return pageContents.form.requireName[lang];
		}
		const t = supplierForm;
		if (t.phones.some((p) => str(p).trim() && !PHONE_RE.test(str(p).trim()))) return pageContents.form.invalidPhone[lang];
		if (t.emails.some((e) => str(e).trim() && !EMAIL_RE.test(str(e).trim()))) return pageContents.form.invalidEmail[lang];
		// Batch14 (m11713): address có text nhưng chưa chọn tỉnh (cũ/mới) → chưa hợp lệ.
		// Entry rỗng hoàn toàn thì bỏ qua (được prune lúc submit).
		// Batch 20 (A7): hợp nhất điều kiện qua addressEntryInvalid (đã gồm
		// has-content) — giữ hành vi cũ: entry có text mà thiếu địa giới = lỗi.
		if (t.addresses.some((_a, i) => addressEntryInvalid(i))) return pageContents.form.invalidAddress[lang];
		for (const f of SOCIAL_FIELDS) {
			if (t[f].some((v) => socialEntryInvalid(f, v))) {
				return pageContents.form[`invalid${f[0].toUpperCase()}${f.slice(1)}` as keyof typeof pageContents.form][lang];
			}
		}
		return undefined;
	}

	// Map lỗi validate → CSS selector field tương ứng trong modal (scroll-to-invalid
	// yêu cầu 4f: submit khi invalid → cuộn tới field đầu tiên từ trên xuống).
	// Thứ tự khớp thứ tự check trong validateSupplierForm (name → phone → email → social).
	const FIELD_SELECTORS = {
		requireName: '[data-field="supplier-name"]',
		invalidPhone: '[data-field="supplier-phones"]',
		invalidEmail: '[data-field="supplier-emails"]',
		invalidAddress: '[data-field="supplier-addresses"]',
		invalidZalo: '[data-field="social-zalo"]',
		invalidTelegram: '[data-field="social-telegram"]',
		invalidDiscord: '[data-field="social-discord"]',
		invalidFacebook: '[data-field="social-facebook"]',
		invalidInstagram: '[data-field="social-instagram"]',
		invalidWebsite: '[data-field="social-website"]'
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

	// Batch10 (m06635-5b): focus input của row VỪA THÊM (cuối cùng) trong block.
	// Gọi sau flushSync mount row — phần thân focus nằm trong cùng user gesture
	// (iOS Safari chỉ mở keyboard khi focus trong gesture).
	// fieldSelector: khối bọc row (vd '[data-field="supplier-phones"]');
	// rowClass: class row bên trong (address-entry) khi không có data-field riêng.
	function focusLastFieldRow(rootEl: HTMLElement | null | undefined, fieldSelector?: string, rowClass?: string) {
		if (!rootEl) return;
		const scope = fieldSelector ? rootEl.querySelector<HTMLElement>(fieldSelector) : rootEl;
		if (!scope) return;
		const rows = scope.querySelectorAll<HTMLElement>(rowClass ? `.${rowClass}` : '.field-row');
		const last = rows[rows.length - 1];
		last?.querySelector<HTMLInputElement>('input')?.focus();
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
	// Batch10 (m06635-5c): form invalid → nút submit disable (validate toàn form
	// + trùng phone/email/address). Tên trống + row rỗng là trạng thái khởi tạo
	// create — vẫn tính invalid (user phải điền tối thiểu tên).
	// Batch 15 (m12278-7): tên TRÙNG DB (nameTaken) → chặn submit.
	// Batch 16 (m13579-5): edit chưa sửa gì (bằng baseline chụp lúc mở modal)
	// → Save disable (đồng bộ dirty-guard — cả hai cùng chụp 1 thời điểm).
	const supplierFormInvalid = $derived(!!validateSupplierForm() || hasDuplicates || supplierNameTaken);
	let supplierEditBaseline = '';
	const supplierEditDirty = $derived(supplierEditMode !== 'edit' || JSON.stringify(supplierForm) !== supplierEditBaseline || !!supplierImageUpload?.hasDeferPending || !!supplierImageUpload?.hasDeferWantAvatar); // B32 (m07236): dirty thêm ảnh pending/wantAvatar

	function buildSupplierPayload() {
		const t = supplierForm;
		// Batch14 (m11713): prune entry RỖNG (không text + không chọn tỉnh) khỏi
		// addresses + breakdowns ĐỒNG THỜI (giữ index khớp nhau) — dọn node rác
		// do draft resume/add-row bỏ trống trước khi build payload.
		const keepIdx: number[] = [];
		t.addresses.forEach((a, i) => {
			if (str(a.address).trim() || str(supplierAddressBreakdowns[i]?.province).trim() || str(supplierNewAddressBreakdowns[i]?.province).trim()) {
				keepIdx.push(i);
			}
		});
		const keptAddresses = keepIdx.map((i) => t.addresses[i]);
		const keptBds = keepIdx.map((i) => supplierAddressBreakdowns[i]);
		const keptNbds = keepIdx.map((i) => supplierNewAddressBreakdowns[i]);
		// breakdown từng entry (bind 2 chiều với AddressInput) merge lại vào addresses
		// — cả hệ cũ (province/district/ward) lẫn hệ mới (newProvince/newWard)
		const entries = keptAddresses.map((a, i) => {
			const bd = keptBds[i];
			const nbd = keptNbds[i];
			return {
				label: str(a.label).trim() || undefined,
				address: str(a.address).trim(),
				ward: (str(bd?.ward) || str(a.ward)).trim() || undefined,
				province: (str(bd?.province) || str(a.province)).trim() || undefined,
				district: (str(bd?.district) || str(a.district)).trim() || undefined,
				newProvince: (str(nbd?.province) || str(a.newProvince)).trim() || undefined,
				newWard: (str(nbd?.ward) || str(a.newWard)).trim() || undefined,
				country: (str(bd?.province) || str(a.province)).trim() ? 'Việt Nam' : undefined
			};
		});
		// Cấp 1 = entry đầu (địa chỉ chính) — đồng bộ field legacy address/district/province
		const main = entries[0];
		// avatarUrl là CON TRỎ vào 1 URL trong images (nếu images có mà avatar không
		// khớp URL nào → dùng ảnh đầu)
		const images = t.images.map((u) => str(u).trim()).filter(Boolean);
		const avatar = images.includes(str(t.avatarUrl)) ? str(t.avatarUrl) : (images[0] ?? '');
		// Batch 15 (m12278-5): cặp thumb→original theo thứ tự images — imageFulls
		// 1-1 images (index khớp) để detail full-view lấy bản gốc.
		const imageFulls = t.imageFulls ?? [];
		const alignedFulls = images
			.map((thumb, i) => str(imageFulls[i] ?? '').trim())
			.filter(Boolean);
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
			zalo: t.zalo.map((v) => v.trim()).filter(Boolean).length ? t.zalo.map((v) => v.trim()).filter(Boolean) : undefined,
			telegram: t.telegram.map((v) => v.trim()).filter(Boolean).length ? t.telegram.map((v) => v.trim()).filter(Boolean) : undefined,
			discord: t.discord.map((v) => v.trim()).filter(Boolean).length ? t.discord.map((v) => v.trim()).filter(Boolean) : undefined,
			facebook: t.facebook.map((v) => v.trim()).filter(Boolean).length ? t.facebook.map((v) => v.trim()).filter(Boolean) : undefined,
			instagram: t.instagram.map((v) => v.trim()).filter(Boolean).length ? t.instagram.map((v) => v.trim()).filter(Boolean) : undefined,
			website: t.website.map((v) => v.trim()).filter(Boolean).length ? t.website.map((v) => v.trim()).filter(Boolean) : undefined,
			images: images.length > 0 ? images : undefined,
			imageFulls: images.length > 0 && alignedFulls.length > 0 ? alignedFulls : undefined,
			avatarUrl: avatar || undefined,
			note: str(t.note).trim() || undefined,
			status: t.status
		};
	}

	async function submitSupplier() {
		if (supplierSubmitting || !encryptionKeys) return;
		const validationError = validateSupplierForm();
		if (validationError) {
			// Batch 21: attempt fail → bật lớp visual error (viền đỏ + message) trên các field
			supplierAttemptBaseline = supplierValidationSnapshot();
			supplierSubmitAttempted = true;
			supplierError = validationError;
			// Scroll tới field invalid đầu tiên để user can thiệp (yêu cầu 4f)
			const key = (Object.keys(FIELD_SELECTORS) as (keyof typeof FIELD_SELECTORS)[]).find((k) =>
				validationError === pageContents.form[k]?.[lang]
			);
			if (key) scrollToInvalidField(FIELD_SELECTORS[key]);
			return;
		}
		supplierError = undefined;
		supplierSubmitAttempted = false;
		// Chốt mode create/update TRƯỚC try → nhánh catch cũng biết cần báo
		// toast "tạo thất bại" hay "cập nhật thất bại".
		const isEdit = supplierEditMode === 'edit' && !!supplierEditId;
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
				// Batch 15 (m12278-5): kéo pairs thumb→original vào form — payload
				// build SupplierPayload đọc t.imageFulls theo index images.
				const pairs = supplierImageUpload.getUploadPairs();
				supplierForm.imageFulls = pairs.map((p) => p.original ?? '');
			}
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
				closeGuard.markClean();
				// Batch 15 (m12278-6): GIỮ MODAL MỞ cả 2 mode — create: reset form
				// (sẵn sàng nhập NCC tiếp theo); edit: dữ liệu modal đồng bộ theo
				// response (user thấy ngay kết quả). Đóng = user bấm ✕/back.
				// Batch 23: server trả supplier ở TOP-LEVEL `data` (không phải data.supplier)
				// → đọc cả 2 shape để không bỏ sót doc mới nhất.
				const rawData = response.data as
					| Record<string, unknown>
					| { supplier?: Record<string, unknown> }
					| undefined;
				const respSupplier =
					(rawData && typeof rawData === 'object' && 'supplier' in rawData
						? (rawData as { supplier?: Record<string, unknown> }).supplier
						: undefined) ?? (rawData as Record<string, unknown> | undefined);
				if (isEdit) {
					// Batch 23 (m00590): UPDATE giữ nguyên data mới nhất — KHÔNG reset form.
					// Chỉ đồng bộ metadata/images từ doc server trả về (nếu có).
					if (respSupplier && typeof respSupplier === 'object') {
						supplierPassive = {
							createdBy: (respSupplier.createdBy as string | null) ?? supplierPassive?.createdBy,
							createdAt: (respSupplier.createdAt as string | null) ?? supplierPassive?.createdAt,
							updatedBy: (respSupplier.updatedBy as string | null) ?? undefined,
							updatedAt: (respSupplier.updatedAt as string | null) ?? undefined
						};
						// Đồng bộ images/imageFulls theo doc mới (upload URL thật)
						if (Array.isArray(respSupplier.images)) supplierForm.images = respSupplier.images as string[];
						if (Array.isArray(respSupplier.imageFulls)) supplierForm.imageFulls = respSupplier.imageFulls as string[];
					}
					// Re-seed ImageUpload entries: file pending đã upload xong →
					// entries trở thành URL (không còn pending).
					void seedImagesAfterMount();
					// Baseline = dữ liệu vừa lưu → nút Save tắt cho tới khi user sửa tiếp.
					supplierEditBaseline = JSON.stringify(supplierForm);
				} else {
					// B50 (m21047): nếu luồng PO quick-create supplier → chọn supplier vừa tạo vào Select PO.
					if (poSelectPendingSupplier) {
						poSelectPendingSupplier = null;
						const newSupplierId = String(respSupplier?._id ?? '');
						if (newSupplierId) {
							poForm.supplierId = newSupplierId;
						}
					}
					// CREATE thành công → reset về form trống (giữ modal mở)
					supplierForm = emptySupplierForm();
					supplierAddressBreakdowns = [];
					supplierNewAddressBreakdowns = [];
					supplierError = undefined;
					void seedImagesAfterMount();
				}
				await loadSuppliers();
			} else {
				const failMessage = resolveServerMessage(
					response.message,
					lang,
					isEdit ? pageContents.toasts.supplierUpdateFailed : pageContents.toasts.supplierFailed
				);
				supplierError = failMessage;
				// Batch 23 (m00590): toast thông báo trạng thái save (kể cả khi fail).
				showToast(failMessage, 'error');
			}
		} catch (err) {
			supplierSubmitting = false;
			const failMessage = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			supplierError = failMessage;
			showToast(failMessage, 'error');
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

	// ── B46 (m18161): PO search keyword + bulk — mirror suppliers ──
	function savePOSearchKeyword() {
		const kw = (poSearchQuery ?? '').trim();
		if (kw) recordSearchKeyword(PO_PREFS_KEY, kw);
	}

	const poRecentKeywordsFiltered = $derived.by(() => {
		const q = (poSearchQuery ?? '').trim().toLowerCase();
		const all = getSearchKeywords(PO_PREFS_KEY);
		return q ? all.filter((k) => k.toLowerCase().includes(q)) : all;
	});

	function clearPOsSelection() {
		poSelectedIds = [];
	}

	function poBulkDisplayCount(): number {
		return poSelectedIds.length;
	}

	// Bulk copy PO (TSV: header + các cột đang hiển thị — mirror bulkCopySelected).
	function bulkCopyPOSelected() {
		const cols = poColumns.filter((c) => c.id !== 'actions' && typeof c.accessor === 'function');
		const header = cols.map((c) => String(c.label)).join('\t');
		const rows = pos
			.filter((p) => p._id && poSelectedIds.includes(p._id))
			.map((p) => cols.map((c) => String((c.accessor as (row: unknown) => unknown)(p) ?? '')).join('\t'));
		const tsv = [header, ...rows].join('\n');
		navigator.clipboard
			.writeText(tsv)
			.then(() => showToast(pageContents.toasts.bulkCopied[lang].replace('{count}', String(poSelectedIds.length)), 'success'))
			.catch(() => showToast(pageContents.toasts.requestFailed[lang], 'error'));
	}

	// Bulk delete PO qua /api/admin/purchases/bulk action=delete (chỉ
	// draft/cancelled được xoá — received/ordered trả failed → toast).
	async function bulkDeletePOsSelected() {
		if (!encryptionKeys || poBulkDeleting || poSelectedIds.length === 0) return;
		poBulkDeleting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchases/bulk',
				{ method: 'POST', body: { ids: poSelectedIds, action: 'delete' } },
				encryptionKeys
			);
			poBulkDeleting = false;
			if (response.ok) {
				const data = response.data as { deleted?: string[]; failed?: Array<{ id: string; reason: string }> } | undefined;
				const deletedCount = data?.deleted?.length ?? 0;
				const failedCount = data?.failed?.length ?? 0;
				if (deletedCount > 0) {
					showToast(pageContents.toasts.poBulkDeleted[lang].replace('{count}', String(deletedCount)), 'success');
				} else {
					showToast(pageContents.toasts.poBulkNone[lang], 'error');
				}
				if (failedCount > 0 && deletedCount > 0) {
					// một phần thành công — gợi ý user một số dòng không xoá được
					showToast(pageContents.toasts.poBulkPartial[lang].replace('{count}', String(failedCount)), 'error');
				}
				poBulkDeleteDisplay = false;
				clearPOsSelection();
				await loadPOs();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.poBulkDeleteFailed), 'error');
			}
		} catch (err) {
			poBulkDeleting = false;
			showToast(pageContents.toasts.poBulkDeleteFailed, 'error');
			if (import.meta.env.DEV) console.error('[admin/suppliers] bulk delete PO failed:', err);
		}
	}

	// B52 (m25115): tải currency system + tỷ giá (cache 30 phút trong session).
	let poCurrencyLoadedAt = 0;
	async function loadCurrency() {
		if (!encryptionKeys) return;
		if (Date.now() - poCurrencyLoadedAt < 30 * 60 * 1000 && poCurrencyLoadedAt > 0) return;
		poCurrencyLoadedAt = Date.now();
		try {
			const settingsRes = await encryption.fetchSecure(
				"/api/admin/system-settings/get",
				{ method: "POST", body: {} },
				encryptionKeys
			);
			if (settingsRes.ok) {
				const commerce = (settingsRes.data as { settings?: { commerce?: { currency?: string } } } | undefined)?.settings?.commerce;
				if (commerce?.currency === "USD") poCurrency = "USD";
				else poCurrency = "VND";
			}
		} catch {
			// settings fail → giữ VND mặc định
		}
		if (poCurrency !== "USD") return;
		try {
			const fxRes = await encryption.fetchSecure(
				"/api/admin/currency-rates",
				{ method: "POST", body: {} },
				encryptionKeys
			);
			if (fxRes.ok) {
				const rates = (fxRes.data as { rates?: { VND?: number } } | undefined)?.rates;
				if (typeof rates?.VND === "number" && rates.VND > 0) poFxRate = rates.VND;
			}
		} catch {
			// fx fail → formatPoMoney rơi về VND display poCurrency vẫn USD + fx 0 → guard đã chặn
		}
	}

	// ── Modal tạo PO ──
	function openPOModal() {
		poEditMode = 'create'; // B47 (m19661)
		poForm = { poCode: '', supplierId: '', branchId: '', expectedAt: '', items: [] };
		poError = undefined;
		poModalDisplay = true;
		// markClean SAU khi modal render 1 frame — baseline snapshot poForm hiện tại.
		void (async () => {
			await tick();
			poCloseGuard.markClean();
		})();
		void loadVariantOptions();
		void loadCurrency(); // B52 (m25115)
	}

	function addPOItem() {
		// B49 (chain B): unitCost khỏi UI — giữ 0 trong type (server POItem yêu cầu).
		poForm.items = [...poForm.items, { variantId: '', quantity: 1, unitCost: 0 }];
	}

	function removePOItem(index: number) {
		poForm.items = poForm.items.filter((_, i) => i !== index);
	}

	// ── B49 (chain B): quick-create từ Select khi search không thấy ──
	function openQuickCreate(kind: 'supplier' | 'branch' | 'variant', value: string, target: 'supplier' | 'branch' | string) {
		// B50 (m21047): supplier → mở form create ĐẦY ĐỦ tab suppliers (PO modal giữ phía sau).
		// Tạo xong Select PO tự nạp lại (loadSuppliers) + chọn supplier vừa tạo.
		if (kind === 'supplier') {
			poSelectPendingSupplier = { seedName: value.trim() };
			openSupplierModal();
			return;
		}
		quickCreateKind = kind;
		quickCreateDisplay = true;
		quickCreateTarget = target;
		quickCreateError = undefined;
		// seed tên đã gõ vào field đầu tiên (name/sku) để user đỡ gõ lại.
		const seeded = value.trim();
		// B50 (m21047): supplier đã return sớm — quick-create chỉ còn branch/variant (name không dùng).
		quickCreateName = '';
		quickCreatePhone = '';
		quickCreateEmail = '';
		quickCreateSku = kind === 'variant' ? seeded : '';
		quickCreateDisplayName = '';
		quickCreatePrice = '';
		quickCreateProductId = '';
		quickCreateProductsLoaded = false;
		quickCreateProducts = [];
	}
	function closeQuickCreate() {
		quickCreateDisplay = false;
		quickCreateKind = null;
		quickCreateTarget = null;
		quickCreateError = undefined;
	}
	// Load danh sách product cho quick-create variant (load 1 lần khi mở modal).
	async function loadQuickCreateProducts() {
		if (!encryptionKeys || quickCreateProductsLoaded) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/list',
				{ method: 'POST', body: { page: 1, pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				quickCreateProducts = ((response.data as { items?: { _id: string; name?: string }[] } | undefined)?.items ?? []);
				quickCreateProductsLoaded = true;
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/suppliers] load quick-create products failed:', err);
		}
	}
	async function submitQuickCreate() {
		if (quickCreateBusy || !encryptionKeys || !quickCreateKind) return;
		const kind = quickCreateKind;
		quickCreateBusy = true;
		quickCreateError = undefined;
		try {
			if (kind === 'supplier') {
				const name = str(quickCreateName).trim();
				if (!name) {
					quickCreateBusy = false;
					return;
				}
				const body: Record<string, unknown> = { name, status: 'active' };
				if (str(quickCreatePhone).trim()) body.phones = [str(quickCreatePhone).trim()];
				if (str(quickCreateEmail).trim()) body.emails = [str(quickCreateEmail).trim()];
				const response = await encryption.fetchSecure(
					'/api/admin/suppliers/create',
					{ method: 'POST', body },
					encryptionKeys
				);
				if (!response.ok) {
					quickCreateError = resolveServerMessage(response.message, lang, pageContents.toasts.supplierFailed);
					quickCreateBusy = false;
					return;
				}
				const created = (response.data ?? {}) as Record<string, unknown>;
				const newId = str(created._id);
				showToast(pageContents.toasts.supplierCreated[lang], 'success');
				await loadSuppliers();
				// set giá trị vào field đợi (poForm.supplierId hoặc item variant...).
				applyQuickCreateTarget('supplier', newId);
				closeQuickCreate();
			} else if (kind === 'branch') {
				const name = str(quickCreateName).trim();
				if (!name) {
					quickCreateBusy = false;
					return;
				}
				const response = await encryption.fetchSecure(
					'/api/admin/inventory/branches/create',
					{ method: 'POST', body: { name } },
					encryptionKeys
				);
				if (!response.ok) {
					quickCreateError = resolveServerMessage(response.message, lang, { vi: 'Tạo chi nhánh thất bại', en: 'Failed to create branch' });
					quickCreateBusy = false;
					return;
				}
				const created = (response.data ?? {}) as Record<string, unknown>;
				const newId = str(created._id ?? created.branchId ?? created.documentKey);
				showToast({ vi: 'Đã tạo chi nhánh', en: 'Branch created' }[lang as 'vi' | 'en'], 'success');
				await loadBranches();
				applyQuickCreateTarget('branch', newId);
				closeQuickCreate();
			} else {
				// variant — bắt buộc productId + sku + displayName.
				const sku = str(quickCreateSku).trim();
				const displayName = str(quickCreateDisplayName).trim();
				if (!quickCreateProductId || !sku || !displayName) {
					quickCreateBusy = false;
					return;
				}
				const priceNum = Number(quickCreatePrice);
				const response = await encryption.fetchSecure(
					'/api/admin/variants/create',
					{
						method: 'POST',
						body: {
							productId: quickCreateProductId,
							sku,
							displayName,
							price: Number.isFinite(priceNum) ? priceNum : 0,
							attributes: {}
						}
					},
					encryptionKeys
				);
				if (!response.ok) {
					quickCreateError = resolveServerMessage(response.message, lang, { vi: 'Tạo sản phẩm thất bại', en: 'Failed to create variant' });
					quickCreateBusy = false;
					return;
				}
				showToast({ vi: 'Đã tạo sản phẩm', en: 'Variant created' }[lang as 'vi' | 'en'], 'success');
				// create trả documentKey (không phải _id) → refresh list rồi tìm theo sku.
				await loadVariantOptions();
				const found = variantOptions.find((v) => (v.sku ?? '').toUpperCase() === sku.toUpperCase());
				if (found) applyQuickCreateTarget('variant', found._id);
				closeQuickCreate();
			}
		} catch (err) {
			quickCreateBusy = false;
			quickCreateError = { vi: 'Tạo mới thất bại. Vui lòng thử lại.', en: 'Failed to create. Please try again.' }[lang as 'vi' | 'en'];
			if (import.meta.env.DEV) console.error('[admin/suppliers] quick create failed:', err);
		}
	}
	function applyQuickCreateTarget(kind: 'supplier' | 'branch' | 'variant', id: string) {
		if (!quickCreateTarget) return;
		if (kind === 'supplier' && quickCreateTarget === 'supplier') {
			poForm.supplierId = id;
		} else if (kind === 'branch' && quickCreateTarget === 'branch') {
			poForm.branchId = id;
		} else if (kind === 'variant' && quickCreateTarget !== 'supplier' && quickCreateTarget !== 'branch') {
			const idx = Number(quickCreateTarget);
			if (Number.isInteger(idx) && poForm.items[idx]) poForm.items[idx].variantId = id;
		}
		quickCreateTarget = null;
	}

	// ── B49 (chain B): tap giá trị đã chọn → detail (supplier edit / variant read-only) ──
	// B52 (m25115): edit variant từ modal detail (displayName + price).
	function openVariantDetailEditor() {
		if (!variantDetail) return;
		variantDetailDisplayName = variantDetail.displayName ?? "";
		variantDetailPrice = variantDetail.price != null ? String(variantDetail.price) : "";
		variantDetailError = undefined;
		variantDetailEditing = true;
	}

	async function saveVariantDetail() {
		if (!variantDetail || variantDetailBusy) return;
		const documentKey = variantDetail._id;
		const displayName = variantDetailDisplayName.trim();
		const priceRaw = variantDetailPrice.trim();
		if (!displayName) {
			variantDetailError = pageContents.poModal.variantDetailNameRequired[lang];
			return;
		}
		variantDetailBusy = true;
		variantDetailError = undefined;
		try {
			const response = await encryption.fetchSecure(
				"/api/admin/variants/update",
				{
					method: "POST",
					body: {
						documentKey,
						displayName,
						...(priceRaw !== "" ? { price: Number(priceRaw) } : {})
					}
				},
				encryptionKeys
			);
			if (response.ok) {
				showToast(pageContents.toasts.poVariantUpdated[lang], "success");
				variantDetailEditing = false;
				await loadVariantOptions();
			} else {
				variantDetailError = resolveServerMessage(response.message, lang, pageContents.toasts.poVariantUpdateFailed);
			}
		} catch (err) {
			variantDetailError = resolveServerMessage(undefined, lang, pageContents.toasts.poVariantUpdateFailed);
			if (import.meta.env.DEV) console.error("[admin/suppliers] variant update failed:", err);
		} finally {
			variantDetailBusy = false;
		}
	}
	function openSelectDetail(kind: 'supplier' | 'variant', value: string) {
		if (kind === 'supplier') {
			const row = suppliers.find((s) => s._id === value);
			if (row) openSupplierEditModal(row as unknown as Record<string, unknown>);
		} else {
			if (!variantOptions.some((v) => v._id === value)) return;
			variantDetailId = value;
			variantDetailDisplay = true;
		}
	}

	// B47 (m19661): sửa PO draft — fetch chi tiết (list không trả items) rồi fill form.
	// PO đã nhận/huỷ (khác draft) không sửa được → toast lỗi server.
	async function openPOEditModal(row: PurchaseOrderRow) {
		if (!row._id || !encryptionKeys) return;
		poError = undefined;
		poEditMode = 'edit';
		poEditId = row._id;
		poOriginalCode = row.poCode ?? '';
		poModalDisplay = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchase-orders/get',
				{ method: 'POST', body: { poId: row._id } },
				encryptionKeys
			);
			if (response.ok) {
				const po = (response.data ?? {}) as Record<string, unknown>;
				poForm = {
					poCode: (po.poCode as string) ?? '',
					supplierId: (po.supplierId as string) ?? '',
					branchId: (po.branchId as string) ?? '',
					expectedAt: (po.expectedAt as string) ?? '',
					items: (Array.isArray(po.items) ? po.items : []).map((it: Record<string, unknown>) => ({
						variantId: (it.variantId as string) ?? '',
						quantity: Number(it.quantity) || 1,
						unitCost: Number(it.unitCost) || 0,
						lotNumber: (it.lotNumber as string) ?? undefined,
						expiresAt: (it.expiresAt as string) ?? undefined
					}))
				};
			} else {
				poError = resolveServerMessage(response.message, lang, pageContents.toasts.requestFailed);
			}
		} catch (err) {
			poError = pageContents.toasts.requestFailed[lang];
			if (import.meta.env.DEV) console.error('[admin/suppliers] fetch PO for edit failed:', err);
		}
		void loadVariantOptions();
		void (async () => {
			await tick();
			poCloseGuard.markClean();
		})();
	}

	// B47: xoá 1 PO từ status modal — TÁI SỬ DỤNG endpoint bulk {ids:[1]}
	// (server chỉ cho xoá draft/cancelled — khác → toast poBulkNone).
	async function deletePOFromStatus() {
		if (!statusRow?._id || poDeleteBusy || !encryptionKeys) return;
		poDeleteBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchases/bulk',
				{ method: 'POST', body: { ids: [statusRow._id], action: 'delete' } },
				encryptionKeys
			);
			poDeleteBusy = false;
			if (response.ok) {
				const deleted = Number((response.data as { deleted?: number } | undefined)?.deleted ?? 0);
				showToast(
					deleted > 0
						? pageContents.toasts.poDeleted[lang]
						: pageContents.toasts.poBulkNone[lang],
					deleted > 0 ? 'success' : 'error'
				);
				poDeleteConfirmDisplay = false;
				statusModalDisplay = false;
				await loadPOs();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.poBulkDeleteFailed), 'error');
			}
		} catch (err) {
			poDeleteBusy = false;
			showToast(pageContents.toasts.poBulkDeleteFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/suppliers] delete PO failed:', err);
		}
	}

	function validatePOForm(): string | undefined {
		if (!str(poForm.poCode).trim()) return pageContents.form.requireCode[lang];
		if (!poForm.supplierId) return pageContents.form.requireSupplier[lang];
		if (!poForm.branchId) return pageContents.form.requireBranch[lang];
		if (poForm.items.length === 0) return pageContents.form.requireItems[lang];
		for (const item of poForm.items) {
			// B49 (chain B): bỏ unitCost khỏi validate (giá bỏ khỏi form).
			if (!item.variantId || !Number.isFinite(item.quantity) || item.quantity <= 0) {
				return pageContents.form.requireItem[lang];
			}
		}
		// B49 (chain B): chặn 2 dòng trùng variantId.
		if (poForm.items.some((_, i) => poItemDuplicate(i))) return pageContents.poModal.duplicateItem[lang];
		// B52 (m25115): expectedAt không chấp nhận quá khứ.
		if (str(poForm.expectedAt).trim() && poExpectedMin && str(poForm.expectedAt).trim() < poExpectedMin) return pageContents.poModal.expectedAtPast[lang];
		return undefined;
	}

	// B49 (chain B): nút Save chỉ mở dialog review — validate trước khi mở.
	function openPOReview() {
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
		poReviewDisplay = true;
	}

	async function doSubmitPO() {
		if (poSubmitting || !encryptionKeys) return;
		// B49: review đã validate — giữ 1 lần nữa để an toàn (dup có thể vừa xảy ra).
		const validationError = validatePOForm();
		if (validationError) {
			poReviewDisplay = false;
			poError = validationError;
			return;
		}
		const isEdit = poEditMode === 'edit' && !!poEditId;
		poSubmitting = true;
		try {
			const payload = {
				poCode: str(poForm.poCode).trim(),
				supplierId: poForm.supplierId,
				branchId: poForm.branchId,
				expectedAt: poForm.expectedAt || undefined,
				items: poForm.items.map((item) => ({
					variantId: item.variantId,
					quantity: Number(item.quantity),
					// B50 (m21047): giá nhập dự kiến (fill từ PO gần nhất — user sửa được)
					unitCost: Number(item.unitCost) || 0,
					// B50: đơn vị nhập (tuỳ chọn) — server lưu nguyên trạng
					unitName: str(item.unitName).trim() || undefined,
					unitFactor: Number(item.unitFactor) > 0 ? Number(item.unitFactor) : undefined,
					lotNumber: str(item.lotNumber).trim() || undefined,
					expiresAt: item.expiresAt || undefined
				})),
				totalCost: poTotalCost
			};
			const response = await encryption.fetchSecure(
				isEdit ? '/api/admin/purchase-orders/update' : '/api/admin/purchase-orders/create',
				{
					method: 'POST',
					// B47: edit — patch field PO (server whitelist PO_ADMIN_SAFE_FIELDS,
					// chỉ draft được sửa — status khác trả poNotReceivable).
					body: isEdit ? { poId: poEditId, patch: payload } : payload
				},
				encryptionKeys
			);
			poSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, isEdit ? pageContents.toasts.poUpdated : pageContents.toasts.poCreated)
						: isEdit ? pageContents.toasts.poUpdated[lang] : pageContents.toasts.poCreated[lang],
					'success'
				);
				poReviewDisplay = false;
				poModalDisplay = false;
				poCloseGuard.markClean();
				// B49 (chain B): create thành công → mở modal share ảnh (edit → đóng luôn).
				if (!isEdit) {
					poShareData = {
						poCode: str(poForm.poCode).trim(),
						supplierLabel: getSupplierLabel(poForm.supplierId),
						branchLabel: getBranchLabel(poForm.branchId),
						expectedAt: poForm.expectedAt,
						totalCost: poTotalCost, // B52 (m25115)
						items: poForm.items.map((item) => ({ label: getVariantLabel(item.variantId), quantity: Number(item.quantity) || 0 }))
					};
					poShareDisplay = true;
				}
				await loadPOs();
			} else {
				poReviewDisplay = false;
				poError = resolveServerMessage(response.message, lang, isEdit ? pageContents.toasts.poUpdateFailed : pageContents.toasts.poFailed);
			}
		} catch (err) {
			poSubmitting = false;
			poReviewDisplay = false;
			poError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/suppliers] submit PO failed:', err);
		}
	}

	// B49 (chain B): render canvas → blob → navigator.share files (iOS 15+) hoặc download.
	async function sharePoImage(forceDownload = false) {
		if (poShareBusy || !poShareData) return;
		poShareBusy = true;
		try {
			const el = document.getElementById('po-share-canvas');
			if (!el) throw new Error('share canvas missing');
			const { default: html2canvas } = await import('html2canvas');
			const canvas = await html2canvas(el as HTMLElement, { backgroundColor: '#ffffff', scale: 2 });
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
			poShareBusy = false;
			if (!blob) return;
			const fileName = (poShareData.poCode || 'purchase-order') + '.png';
			const file = new File([blob], fileName, { type: 'image/png' });
			const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
			if (!forceDownload && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
				await nav.share({ files: [file], title: poShareData.poCode });
			} else {
				// Fallback download (desktop / share files không khả dụng).
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = fileName;
				a.click();
				URL.revokeObjectURL(url);
			}
		} catch (err) {
			poShareBusy = false;
			if (import.meta.env.DEV) console.error('[admin/suppliers] share PO image failed:', err);
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

	// BẪY TS: onMount async trả `Promise<() => void>` — cleanup trong callback
	// async KHÔNG hợp lệ (Svelte chỉ đọc return đồng bộ) → tách listener sync
	// onMount riêng; async init dùng onMount(async) thứ hai không return gì.
	// B31 (m06998-3): swipe trái/phải đổi tab suppliers ↔ purchase-orders.
	// Chỉ mobile + gesture ngang rõ (|dx|≥56, |dy|≤32, ≤600ms) để không nuốt scroll dọc
	// hay tap card; bỏ qua khi bắt đầu trên control (input/select/popover).
	let pageEl: HTMLElement | undefined;
	let touchStartX = 0;
	let touchStartY = 0;
	let touchStartT = 0;
	function onTouchStart(e: TouchEvent) {
		if (!isMobile || e.touches.length !== 1) return;
		const t = e.target as HTMLElement | null;
		if (t?.closest?.('input, textarea, select, .suggest-popover, .select-trigger, .mobile-filter-popover')) return;
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
		touchStartT = Date.now();
	}
	function onTouchEnd(e: TouchEvent) {
		if (!isMobile || !touchStartT) return;
		const t = e.changedTouches[0];
		if (!t) return;
		const dx = t.clientX - touchStartX;
		const dy = t.clientY - touchStartY;
		const dt = Date.now() - touchStartT;
		touchStartT = 0;
		if (dt > 600 || Math.abs(dx) < 56 || Math.abs(dy) > 32) return;
		if (dx < 0 && activeTab === 'suppliers') switchTab('purchase-orders');
		else if (dx > 0 && activeTab === 'purchase-orders') switchTab('suppliers');
	}

	onMount(() => {
		// Safari ≤15.3: scroll fallback — root Container (div.w-full.h-full.overflow-auto
		// ở +layout.svelte) là scroll container thật, window không bắn scroll event.
		// Batch 25 fix: scroll event KHÔNG bubble → window listener không thấy scroll
		// của root Container; scrollHost walk-up lúc mount cũng miss vì trang còn
		// ngắn (chưa scrollable). Dùng capture trên document — bắt scroll của MỌI
		// element bất kể mount lúc nào, không cần re-find.
		document.addEventListener('scroll', onWindowScroll, { capture: true, passive: true });
		// B31: swipe đổi tab — capture để không bị nuốt bởi scroll container con.
		pageEl?.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
		pageEl?.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
		return () => {
			document.removeEventListener('scroll', onWindowScroll, { capture: true });
			pageEl?.removeEventListener('touchstart', onTouchStart, { capture: true });
			pageEl?.removeEventListener('touchend', onTouchEnd, { capture: true });
		};
	});
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
		void supplierForm.instagram;
		void supplierForm.website;
		void supplierForm.images;
		void supplierForm.avatarUrl;
		void supplierForm.note;
		void supplierForm.status;
		if (str(supplierForm.name).trim() || supplierForm.phones.length > 0 || supplierForm.emails.length > 0) {
			saveDraftDebounced();
		}
	});

	// ── Batch 15 (m12278-7): name check realtime — track tên + mode/id, debounce
	// 400ms → API check. Modal đóng → huỷ timer + reset badge.
	$effect(() => {
		if (!supplierModalDisplay) {
			clearTimeout(nameCheckTimer);
			supplierNameTaken = false;
			supplierNameChecking = false;
			supplierNameChecked = false;
			supplierNameTouched = false;
			return;
		}
		void supplierForm.name;
		void supplierEditMode;
		void supplierEditId;
		scheduleNameCheck();
		return () => clearTimeout(nameCheckTimer);
	});

	// ── Batch 21: snapshot các field liên quan validation — dùng làm baseline
	// lúc submit-attempt fail; effect dưới so sánh để biết user ĐÃ SỬA chưa.
	// Gồm breakdowns (addressEntryInvalid đọc province từ breakdown state).
	function supplierValidationSnapshot(): string {
		const f = supplierForm;
		return JSON.stringify([
			f.name,
			f.phones,
			f.emails,
			f.addresses.map((a) => [a.label, a.address, a.province, a.district, a.newProvince, a.newWard]),
			f.zalo, f.telegram, f.discord, f.facebook, f.instagram, f.website,
			supplierAddressBreakdowns,
			supplierNewAddressBreakdowns
		]);
	}
	let supplierAttemptBaseline = '';

	// ── Batch 21: user sửa field sau submit-attempt fail → tắt lớp visual error
	// (viền đỏ/message) để không "kẹt" lỗi đã sửa. KHÔNG reset ngay khi attempted
	// bật true (effect re-run vì attempted là dep → phải qua baseline so sánh,
	// form chưa đổi thì giữ visual).
	$effect(() => {
		if (!supplierSubmitAttempted) return;
		const current = supplierValidationSnapshot();
		if (current !== supplierAttemptBaseline) supplierSubmitAttempted = false;
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section
	class="admin-page admin-page--fullheight"
	bind:this={pageEl}
	class:at-bottom={wrapAtBottom}
	// Batch 11 (yêu cầu 2): mọi rule scroll/animate/co-padding CHỈ mobile —
	// PC giữ nguyên bố cục tĩnh (is-scrolled thu gọn chỉ mobile qua CSS @media).
	class:is-scrolled={tableScrolled && isMobile}
	class:is-scrolling={scrollActive && isMobile}
	data-active-tab={activeTab}
>

	<!-- ── Tab ── -->
	<div class="tab-strip" role="tablist" class:is-scrolled={tableScrolled && isMobile} class:is-scrolling={scrollActive && isMobile}>
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
					loading={suppliersLoading || searching}
						// Batch 12: highlight + filter theo query search box của trang
						searchQuery={searchQuery ?? ''}
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
					selectAllBusy={selectAllBusy}
					bind:allFilteredSelected={allFilteredSelected}
					onSelectAllFiltered={selectAllFilteredSuppliers}
					onSelectionChange={(ids) => (selectedIds = ids)}
					// BẪY memory: class:directive trên component CHẾT — gộp vào expression class
					// Batch 11: caption co/ẩn khi cuộn CHỈ mobile
					class={[
						tableScrolled && isMobile ? 'caption-collapsed' : undefined,
						scrollActive && isMobile ? 'tools-hidden-mobile' : undefined
					].filter(Boolean).join(' ') || undefined}
					data-test="suppliers-datatable"
				>
					{#snippet captionTools()}
						<!-- BẪY: searchQuery có thể undefined (card mode unmount Input) → ?? ''.
							Bulk-bar KHÔNG swap thay search (Input unmount → onDestroy emit value=undefined
							→ $effect search → searching=true → skeleton → mất selection hiển thị).
							Chỉ THÊM bulk-bar cạnh search — pattern purchases (bulk-bar cuối captionTools). -->
						<!-- Batch8 mục 2: đang cuộn trên mobile → ẨN row tools (search/filter/create)
							bằng CSS display:none — KHÔNG {#if} (unmount Input emit undefined → reload
							storm + mất từ khoá). Bulk-bar GIỮ khi có selection. -->
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
											// Batch10 (m06635-1): flushSync mount field + focus TRONG
											// user gesture (iOS Safari chỉ mở keyboard khi focus nằm
											// trong gesture — setTimeout(0) thoát gesture → hỏng).
											flushSync(() => {
												mobileSearchOpen = true;
												suggestOpen = true;
											});
											mobileSearchInputInstance?.configs.focus();
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
								{#if suggestOpen && recentKeywordsFiltered.length > 0}
									<div class="suggest-popover" role="listbox">
										<p class="suggest-title">{pageContents.suggest.title[lang]}</p>
										{#each recentKeywordsFiltered as kw (kw)}
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
							<div class="admin-actions-group">
								<!-- Batch10 (m06635-3): nút setting (tune) header datatable mở
									SETTING MODAL (filter + sort) — cả desktop lẫn mobile thay
									popover gắn caption (bị ẩn theo row tools khi cuộn). -->
								{#if isMobile}
								<button
									type="button"
									class="mobile-caption-icon"
									aria-label={pageContents.filters.allStatuses[lang]}
									data-test="suppliers-mobile-filter-btn"
									onclick={() => (settingModalDisplay = true)}
								>
									<Icon icon={iconify['tune-rounded']} size="sm" />
								</button>
							{:else}
								<Button color="default" variant="outline" size="sm" onClick={() => { settingModalDisplay = true; }} aria-label={pageContents.filters.allStatuses[lang]} data-test="suppliers-header-setting-btn">
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
						{#if selectedIds.length > 0}
							<!-- bulk-bar khi chọn ≥1 row -->
							<div class="bulk-row" data-test="suppliers-bulk-row">
							<div class="bulk-bar" data-test="suppliers-bulk-bar">
								<span class="bulk-count">{pageContents.bulk.selected[lang].replace('{count}', String(bulkDisplayCount))}</span>
								{#if allFilteredSelected}
									<!-- Batch 28c: đã chọn hết kết quả filter → đổi thành Uncheck all
									   (clear sync local — không cần loading/spinner). -->
									<Button color="default" variant="soft" size="sm" onClick={clearSuppliersSelection} data-test="suppliers-bulk-uncheck-all">
										{pageContents.bulk.uncheckAll[lang]}
									</Button>
									<!-- Batch 28b: chưa chọn hết + >2 dòng → offer chọn hết các dòng khớp
									   filter (fetch toàn bộ qua onSelectAllFiltered).
									   busy guard: selectAllBusy → nút loading/spinner. -->
								{:else if selectedIds.length > 2}
									<Button color="default" variant="soft" size="sm" loading={selectAllBusy} onClick={selectAllFilteredSuppliers} data-test="suppliers-bulk-select-all">
										{pageContents.bulk.selectAll[lang]}
									</Button>
								{/if}
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
							</div>
						{/if}

					{/snippet}
					{#snippet actionsContent(row)}
						{@const supplier = row as unknown as SupplierRow}
						<div class="row-actions">
							<!-- update/edit = primary; history đã dời vào footer form modal -->
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
					// B46 (m18161): bulk chọn nhiều PO — mirror tab suppliers
					selectable
					showIndex
					indexCheckboxes
					// B46.2 (m19177): đồng bộ DataTable PO với tab suppliers — STT cộng offset phân trang server
					indexOffset={(posPage - 1) * pageSize}
					// B46.2: card mode mobile + tap card mở modal update-status (action duy nhất của PO)
					cardFields={poCardFieldIds}
					mobileTapMode="callback"
					// B47 (m19661): tap card — draft mở modal SỬA (fetch chi tiết),
					// trạng thái khác mở modal cập nhật trạng thái (mirror suppliers tap = edit)
					onRowClick={(row) => {
					const po = row as unknown as PurchaseOrderRow;
					if (po.status === 'draft') void openPOEditModal(po);
					else openStatusModal(po);
				}}
					selection={poSelectedIds}
					selectionTools={false}
					getRowId={(row) => String((row as PurchaseOrderRow)._id ?? '')}
					onSelectionChange={(ids) => (poSelectedIds = ids)}
				onSortChange={onPOSortChange}
					pageSize={pageSize}
					showPagination={false}
					sortable
					resizable={{ enabled: true, fit: true }}
					loading={posLoading || poSearching || (posLoading && !posLoadedOnce)}
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.states.emptyPOs[lang]}
					loadingLabel={pageContents.states.loading[lang]}
					captionDescription={{ vi: 'Tìm kiếm, lọc và quản lý đơn mua hàng', en: 'Search, filter and manage purchase orders' }}
					caption={{ vi: 'Danh sách đơn mua hàng', en: 'Purchase orders list' }}
					actionsLabel={{ vi: pageContents.poTable.actions[lang], en: pageContents.poTable.actions[lang] }}
					stickyHead
					// Batch 11: co caption khi cuộn CHỈ mobile; B46.2: ẩn tools khi cuộn (B8 mục 2)
					class={[
						tableScrolled && isMobile ? 'caption-collapsed' : undefined,
						scrollActive && isMobile ? 'tools-hidden-mobile' : undefined
					].filter(Boolean).join(' ') || undefined}
					data-test="purchase-orders-datatable"
				>
					{#snippet captionTools()}
						<!-- B46 (m18161): search + suggest từ khoá PO — mirror tab suppliers.
						     Mobile: icon mở input; desktop: input inline. -->
						{#if poMobileSearchOpen}
							<div class="admin-search" data-suggest>
								<Input
									size="sm"
									bind:value={poSearchQuery}
									placeholder={pageContents.poTable.searchPlaceholder ? pageContents.poTable.searchPlaceholder[lang] : undefined}
									bind:this={poMobileSearchInputInstance}
									events={[{ events: {
										focus: { handler() { poSearchFocused = true; poSuggestOpen = true; } },
										blur: { handler() { poSearchFocused = false; poSuggestOpen = false; savePOSearchKeyword(); if (isMobile && !str(poSearchQuery).trim()) poMobileSearchOpen = false; } }
									} }]}
								/>
								{#if poSuggestOpen && poRecentKeywordsFiltered.length > 0}
									<div class="suggest-popover" data-suggest>
										<span class="suggest-popover__title">{pageContents.suggest.title[lang]}</span>
										{#each poRecentKeywordsFiltered as kw (kw)}
											<button
												type="button"
												class="suggest-popover__item"
												onmousedown={(e) => e.preventDefault()}
												onclick={() => {
													poSearchQuery = kw;
													posPage = 1;
													currentPagingPage = 1;
													void loadPOs();
													poSuggestOpen = false;
												}}
											>
												{kw}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{:else if isMobile}
							<button
								type="button"
								class="mobile-caption-icon"
								aria-label={pageContents.actions.search[lang]}
								data-test="po-mobile-search-open"
								onclick={() => {
									flushSync(() => {
										poMobileSearchOpen = true;
										poSuggestOpen = true;
									});
									poMobileSearchInputInstance?.configs.focus();
								}}
							>
								<Icon icon={iconify['search-rounded']} size="sm" />
							</button>
						{:else}
							<div class="admin-search" data-suggest>
								<Input
									size="sm"
									bind:value={poSearchQuery}
									placeholder={pageContents.poTable.searchPlaceholder ? pageContents.poTable.searchPlaceholder[lang] : undefined}
									events={[{ events: {
										focus: { handler() { poSearchFocused = true; poSuggestOpen = true; } },
										blur: { handler() { poSearchFocused = false; poSuggestOpen = false; savePOSearchKeyword(); } }
									} }]}
								/>
								{#if poSuggestOpen && poRecentKeywordsFiltered.length > 0}
									<div class="suggest-popover" data-suggest>
										<span class="suggest-popover__title">{pageContents.suggest.title[lang]}</span>
										{#each poRecentKeywordsFiltered as kw (kw)}
											<button
												type="button"
												class="suggest-popover__item"
												onmousedown={(e) => e.preventDefault()}
												onclick={() => {
													poSearchQuery = kw;
													posPage = 1;
													currentPagingPage = 1;
													void loadPOs();
													poSuggestOpen = false;
												}}
											>
												{kw}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
						<!-- B46 (m18161): bulk-bar PO — hiện khi có dòng chọn
						(mirror bulk-bar suppliers; B31: hàng riêng dưới actions).
						-->						<!-- yêu cầu 7: filter PO vào caption. Batch 3: Select component thay
						     select native. B47 (m19661): mobile ẨN filter (đã có setting modal
						     qua nút tune/FAB — đồng bộ tab suppliers). -->
						{#if !isMobile}
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
						{/if}
						<div class="admin-actions-group">
							<!-- B47: tune = SETTING MODAL (filter+sort) đồng bộ suppliers;
							     refresh vẫn qua pull dữ liệu khi Apply. Mobile: nút icon. -->
							{#if isMobile}
							<button
								type="button"
								class="mobile-caption-icon"
								aria-label={pageContents.settings.title[lang]}
								data-test="po-mobile-filter-btn"
								onclick={() => (poSettingModalDisplay = true)}
							>
								<Icon icon={iconify['tune-rounded']} size="sm" />
							</button>
							{:else}
							<Button color="default" variant="outline" size="sm" onClick={() => { poSettingModalDisplay = true; }} aria-label={pageContents.settings.title[lang]} data-test="po-header-setting-btn">
								<Icon icon={iconify['tune-rounded']} size="sm" />
							</Button>
							{/if}
							{#if isMobile}
							<Button color="success" size="sm" onClick={openPOModal} aria-label={pageContents.actions.createPO[lang]} data-test="po-create-btn">
								<Icon icon={iconify['add-rounded']} size="sm" />
							</Button>
							{:else}
							<Button color="success" size="sm" onClick={openPOModal} data-test="po-create-btn">
								{pageContents.actions.createPO[lang]}
							</Button>
							{/if}
						</div>

						<!-- B46 (m18161): bulk-bar PO — hàng riêng (B31) khi có chọn -->
						{#if poSelectedIds.length > 0}
							<div class="bulk-row">
								<div class="bulk-bar" data-test="po-bulk-bar">
									<span class="bulk-count">{pageContents.bulk.selected[lang].replace('{count}', String(poBulkDisplayCount()))}</span>
									<Button color="default" variant="soft" size="sm" onClick={bulkCopyPOSelected}>
										{pageContents.bulk.copy[lang]}
									</Button>
									<Button color="error" variant="soft" size="sm" onClick={() => { poBulkDeleteDisplay = true; }}>
										{pageContents.bulk.delete[lang]}
									</Button>
									<Button color="default" variant="soft" size="sm" onClick={clearPOsSelection} aria-label={pageContents.bulk.cancel[lang]}>
										<Icon icon={iconify['close-rounded']} size="sm" />
									</Button>
								</div>
							</div>
						{/if}
					{/snippet}
					{#snippet actionsContent(row)}
						{@const po = row as unknown as PurchaseOrderRow}
						<div class="row-actions">
							<!-- update/edit = primary -->
							<Button color="primary" variant="ghost" size="sm" onClick={() => openStatusModal(po)}>
								{pageContents.actions.updateStatus[lang]}
							</Button>
							{#if po.status === 'draft'}
								<!-- B47 (m19661): sửa PO (chỉ draft — server chặn) -->
								<Button color="default" variant="ghost" size="sm" onClick={() => openPOEditModal(po)}>
									{pageContents.actions.edit[lang]}
								</Button>
							{/if}
						</div>
					{/snippet}
				</DataTable>
			</div>
		{/if}
	{/if}

	<!-- ── Phân trang (server-side, dùng chung 2 tab) ── -->
	<footer
		class="admin-pagination"
		// Batch 11: co/ẩn pagination khi cuộn CHỈ mobile
		class:pagination-collapsed={scrollActive && isMobile}
		class:pagination-pop={paginationPopped && isMobile}
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

	<!-- ── FAB mobile (pattern purchases). Batch9c (m06530): 3 nút cùng cấp
		create + search + setting; group ẨN theo HÀNH ĐỘNG cuộn (opacity giống
		tab/pagination — scrollY=0 → ẩn, đang cuộn → ẩn, dừng → hiện).
		Batch 11: logic cuộn CHỈ mobile (PC @768 display:none có sẵn). -->
	<div
		class="fab-group"
		class:fab-hidden={isMobile && !tableScrolled}
		class:is-scrolling={scrollActive && isMobile}
		data-suggest
	>
		<!-- Batch10 (m06635-1): flushSync mount field + focus TRONG gesture (iOS
			Safari chỉ mở keyboard khi focus trong user gesture). Batch10-7: DOM
			create → setting → search + column-reverse → hiển thị TỪ TRÊN XUỐNG =
			search → setting → create (yêu cầu: search trước setting). -->
		<button
			type="button"
			class="fab fab--primary"
			aria-label={activeTab === 'suppliers' ? pageContents.actions.createSupplier[lang] : pageContents.actions.createPO[lang]}
			data-test="suppliers-fab"
			onclick={() => {
				// Batch10 (m06635-4): create mở modal NGAY (theo activeTab) — bỏ menu.
				if (activeTab === 'suppliers') openSupplierModal();
				else openPOModal();
			}}
		>
			<Icon icon={iconify['add-rounded']} />
		</button>
		<!-- Batch10 (m06635-2,3): setting mở SETTING MODAL (filter+sort) thay popover
			gắn caption — popover nằm trong row tools bị ẩn khi cuộn → "không có modal". -->
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.filters.allStatuses[lang]}
			data-test="suppliers-fab-setting"
			onclick={() => {
				// B46 (m18161): setting FAB mở modal đúng tab (suppliers / purchase orders)
				if (activeTab === 'suppliers') settingModalDisplay = true;
				else poSettingModalDisplay = true;
				scrollActive = false;
			}}
		>
			<Icon icon={iconify['tune-rounded']} />
		</button>
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.actions.search[lang]}
			data-test="suppliers-fab-search-btn"
			onclick={() => {
				// Batch10 (m06635-1): flushSync mount field + focus TRONG gesture
				// (iOS Safari — keyboard chỉ mở khi focus trong user gesture).
				// B46 (m18161): tab PO mở search PO riêng.
				if (activeTab === 'suppliers') {
					flushSync(() => {
						mobileSearchOpen = true;
						scrollActive = false;
					});
					mobileSearchInputInstance?.configs.focus();
				} else {
					flushSync(() => {
						poMobileSearchOpen = true;
						scrollActive = false;
					});
					poMobileSearchInputInstance?.configs.focus();
				}
			}}
		>
			<Icon icon={iconify['search-rounded']} />
		</button>
	</div>
</section>

<!-- ── Modal tạo/sửa nhà cung cấp (dùng chung form; dirty-guard qua onCloseAttempt) ── -->
{#if supplierModalDisplay}
	<Modal
		bind:display={supplierModalDisplay}
		size="lg"
		isDimissable
		onCloseAttempt={() => closeGuard.attemptClose()}
		// Batch 11 (5b): không auto-focus nút đầu tiên (nút ✕ đầu DOM) — trên
		// Safari iOS 15.1 trạng thái focus-ring y hệt trạng thái thường, user
		// tưởng modal "đã sẵn sàng đóng". Giữ focus tại chỗ, chỉ cài Tab-trap.
		autoFocus={false}
		// Mobile (batch7): full-size modal — class làm hook CSS scoped bên dưới
		class="supplier-modal-root"
	>
		<Modal.Container class="supplier-modal-container">
			<Modal.Container.Header
				actionButtons={{ close: { display: !isMobile } }}
			>
				<div class="supplier-modal-title" bind:this={crumbTitleEl}>
					<!-- Batch 18: bỏ chevron back (lãng phí không gian — breadcrumb
					     Suppliers › tên đã đủ nghĩa quay lại). Mobile breadcrumb tràn →
					     item Suppliers (cấp cao nhất) ẩn vào popover sau nút more, ưu
					     tiên giữ item cấp thấp nhất (name/active). -->
					{#if isMobile && suppliersCrumbHidden}
						<button
							type="button"
							class="supplier-modal-title__more"
							data-test="supplier-crumb-more"
							aria-label={pageContents.supplierModal.crumbMore[lang]}
							aria-expanded={crumbMoreOpen}
							disabled={supplierSubmitting}
							onclick={() => (crumbMoreOpen = !crumbMoreOpen)}
						>
							<Icon icon={iconify['more-horiz-rounded']} size="sm" />
						</button>
						{#if crumbMoreOpen}
							<div class="supplier-crumb-popover" role="menu">
								<button
									type="button"
									class="supplier-crumb-popover__item"
									disabled={supplierSubmitting}
									onclick={() => {
										crumbMoreOpen = false;
										closeGuard.attemptClose();
									}}
								>
									{pageContents.title[lang]}
								</button>
							</div>
						{/if}
					{/if}
					{#if !isMobile || !suppliersCrumbHidden}
						{#if isMobile}
							<button
								type="button"
								class="supplier-modal-title__label supplier-modal-title__crumb"
								disabled={supplierSubmitting}
								onclick={() => closeGuard.attemptClose()}
							>
								{pageContents.title[lang]}
							</button>
						{:else}
							<span class="supplier-modal-title__label">
								{pageContents.title[lang]}
							</span>
						{/if}
					{/if}
					{#if supplierEditMode === 'edit' && supplierForm.name}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">{supplierForm.name}</span>
					{:else if supplierEditMode !== 'edit'}
						<!-- Batch 17b: create — crumb theo cấu trúc Suppliers › Create -->
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.supplierModal.submit[lang]}
						</span>
					{/if}
				</div>
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
						<!-- Batch 15 (m12278-7): badge đỏ "Tên đã tồn tại" cạnh label —
						     chặn submit khi name = key nghiệp vụ trùng DB -->
							<TextField name="supplier-name" required>
								<Label>
									{pageContents.supplierModal.name[lang]}
									{#if supplierNameTaken}
										<span class="supplier-name-check supplier-name-check--taken">{pageContents.supplierModal.nameTaken[lang]}</span>
									{/if}
								</Label>
								<div class="field-icon-wrap">
									<Input
										type="text"
										bind:value={supplierForm.name}
										disabled={supplierSubmitting}
										loading={supplierNameChecking}
										color={supplierSubmitAttempted && !str(supplierForm.name).trim() ? 'error'
											: ((supplierNameTouched && supplierNameChecked) ? (supplierNameTaken ? 'error' : 'success') : undefined)}
										class={supplierNameTaken ? 'supplier-name-taken' : ((supplierNameTouched && supplierNameChecked) && !supplierNameChecking ? 'supplier-name-available' : undefined)}
										data-test="supplier-form-name"
										events={[{ events: { blur: { handler() { supplierNameTouched = true; } } } }]}
									/>
									<Icon class="field-icon" icon={iconify['storefront-outline-rounded']} />
								</div>
								{#if supplierSubmitAttempted && !str(supplierForm.name).trim()}
									<!-- Batch 21: name rỗng khi submit → Description error chuẩn component -->
									<Description persistent color="error" class="form-hint error-hint">{pageContents.supplierModal.nameRequired[lang]}</Description>
								{:else if str(supplierForm.name).trim()}
									{#if supplierNameTouched && supplierNameChecking}
										<Description persistent class="form-hint">{pageContents.supplierModal.nameChecking[lang]}</Description>
									{:else if supplierNameTaken}
										<Description persistent color="error" class="form-hint error-hint">{pageContents.supplierModal.nameTaken[lang]}</Description>
									{:else if supplierNameTouched && supplierNameChecked && str(supplierForm.name).trim() !== supplierOriginalName.trim()}
										<!-- Batch 20: ẩn hint xanh khi name === original (mở detail chưa
										     thao tác → không hiện message validation nào; viền xanh giữ) -->
										<Description persistent color="success" class="form-hint success-hint">{pageContents.supplierModal.nameAvailable[lang]}</Description>
									{/if}
								{/if}
							</TextField>
							</div>
						<TextField name="supplier-contact">
							<Label>{pageContents.supplierModal.contact[lang]}</Label>
							<div class="field-icon-wrap">
								<Input
									type="text"
									bind:value={supplierForm.contactPerson}
									disabled={supplierSubmitting}
								/>
								<Icon class="field-icon" icon={iconify['person-outline-rounded']} />
							</div>
						</TextField>
					</div>
					<!-- ── Hình ảnh multiple (defer batch 3: preview local — chỉ upload
						     KHI SUBMIT qua uploadPending, tránh rác khi hủy form) ── -->
					<!-- ── Images: items-block solid (giống address/social, batch6) ── -->
					<div class="items-block social-group">
						<span class="items-block__label">{pageContents.supplierModal.images[lang]}</span>
						<ImageUpload
							bind:this={supplierImageUpload}
							images={supplierForm.images}
							bind:avatarUrl={supplierForm.avatarUrl}
							disabled={supplierSubmitting}
							defer
						/>
					</div>
					<!-- ── Phones + emails multiple: items-block solid (giống social) +
							     Badge STT nền ĐỤC (yêu cầu batch6: hết khuyết bg trái) +
							     line vertical trục x giữa + label giữa border line. ── -->
					<div class="items-block form-items-block" data-field="supplier-phones">
						<span class="items-block__label">{pageContents.supplierModal.phones[lang]}</span>
						{#each supplierForm.phones as phone, phoneIndex (phoneIndex)}
							<div class="field-row" class:field-row--dup={(phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) >= 2}>
								<Badge class="field-row-stt" label={String(phoneIndex + 1)} size="xs" variant="solid" color={(phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-phone-stt-${phoneIndex}`} />
								<div class="field-icon-wrap">
									<PhoneInput bind:value={supplierForm.phones[phoneIndex]} placeholder={pageContents.supplierModal.phonePlaceholder[lang]} disabled={supplierSubmitting || (supplierPhoneValid(phoneIndex) && !supplierFieldUnlocked['phone-' + phoneIndex])}
										color={str(phone).trim() && !PHONE_RE.test(str(phone).trim()) ? 'error' : undefined}
									/>
									{#if str(phone).trim() && PHONE_RE.test(str(phone).trim()) && (phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) < 2}
										<!-- Batch 22 (m00193-2): item hợp lệ → passive field — icon
										     thành <a> deep-action GỌI NGAY (tel:). Item rỗng/invalid →
										     icon tĩnh như cũ. -->
										<a class="field-icon field-icon--action" href={`tel:${str(phone).replace(/[^\d+]/g, '')}`} aria-label={`${pageContents.supplierModal.callAction[lang]} ${str(phone).trim()}`} tabindex={-1} data-action-anchor={'phone-' + phoneIndex}>
											<Icon icon={iconify['call-outline-rounded']} />
										</a>
									{:else}
										<Icon class="field-icon" icon={iconify['call-outline-rounded']} />
									{/if}
									{#if supplierPhoneValid(phoneIndex) && !supplierFieldUnlocked['phone-' + phoneIndex]}
										<button type="button" class="field-passive-hit" title={pageContents.supplierModal.passiveHint[lang]} aria-label={pageContents.supplierModal.passiveHint[lang]} onclick={(e) => handleSupplierPassiveTap(e, 'phone', phoneIndex)}></button>
									{/if}
								</div>
								<button
									type="button"
									class="field-row-remove"
									aria-label={pageContents.supplierModal.removePhone[lang]}
									disabled={supplierSubmitting}
									onclick={() => {
										supplierForm.phones = supplierForm.phones.filter((_, i) => i !== phoneIndex);
									}}
								>✕</button>
								{#if (phoneDupCounts.get(str(phone).trim().toLowerCase()) ?? 0) >= 2}
									<span class="field-row-dup-msg">{pageContents.supplierModal.dupPhone[lang]}</span>
								{:else if str(phone).trim() && !PHONE_RE.test(str(phone).trim())}
									<!-- Batch 17b: message validate inline như login/register -->
									<span class="field-row-dup-msg">{pageContents.form.invalidPhone[lang]}</span>
								{/if}
							</div>
						{/each}
						<!-- Batch 22 (m00193-2): gate CHẶT — MỌI item hiện có phải
						     non-empty + regex-pass mới cho thêm (kể cả item giữa). -->
						<button
							type="button"
							class="field-add"
							disabled={supplierSubmitting ||
								supplierForm.phones.some((p) => {
									const v = (p ?? '').trim();
									return !v || !PHONE_RE.test(v) || (phoneDupCounts.get(v.toLowerCase()) ?? 0) >= 2;
								})}
							onclick={() => {
								// Batch10 (m06635-5b): flushSync mount row + focus TRONG gesture
								// (iOS Safari chỉ mở keyboard khi focus trong user gesture).
								flushSync(() => {
									supplierForm.phones = [...supplierForm.phones, ''];
								});
								focusLastFieldRow(supplierModalBodyEl, '[data-field="supplier-phones"]');
							}}
						>+ {pageContents.supplierModal.addPhone[lang]}</button>
					</div>
					<div class="items-block form-items-block" data-field="supplier-emails">
						<span class="items-block__label">{pageContents.supplierModal.emails[lang]}</span>
						{#each supplierForm.emails as email, emailIndex (emailIndex)}
							<div class="field-row" class:field-row--dup={(emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) >= 2}>
								<Badge class="field-row-stt" label={String(emailIndex + 1)} size="xs" variant="solid" color={(emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-email-stt-${emailIndex}`} />
								<div class="field-icon-wrap">
									<EmailInput bind:value={supplierForm.emails[emailIndex]} placeholder={pageContents.supplierModal.emailPlaceholder[lang]} disabled={supplierSubmitting || (supplierEmailValid(emailIndex) && !supplierFieldUnlocked['email-' + emailIndex])}
										color={str(email).trim() && !EMAIL_RE.test(str(email).trim()) ? 'error' : undefined}
									/>
									{#if str(email).trim() && EMAIL_RE.test(str(email).trim()) && (emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) < 2}
										<!-- Batch 22: passive field — icon thành <a> GỬI EMAIL NGAY
										     (mailto:). Item rỗng/invalid → icon tĩnh. -->
										<a class="field-icon field-icon--action" href={`mailto:${str(email).trim()}`} aria-label={`${pageContents.supplierModal.emailAction[lang]} ${str(email).trim()}`} tabindex={-1} data-action-anchor={'email-' + emailIndex}>
											<Icon icon={iconify['mail-outline-rounded']} />
										</a>
									{:else}
										<Icon class="field-icon" icon={iconify['mail-outline-rounded']} />
									{/if}
									{#if supplierEmailValid(emailIndex) && !supplierFieldUnlocked['email-' + emailIndex]}
										<button type="button" class="field-passive-hit" title={pageContents.supplierModal.passiveHint[lang]} aria-label={pageContents.supplierModal.passiveHint[lang]} onclick={(e) => handleSupplierPassiveTap(e, 'email', emailIndex)}></button>
									{/if}
								</div>
								<button
									type="button"
									class="field-row-remove"
									aria-label={pageContents.supplierModal.removeEmail[lang]}
									disabled={supplierSubmitting}
									onclick={() => {
										supplierForm.emails = supplierForm.emails.filter((_, i) => i !== emailIndex);
									}}
								>✕</button>
								{#if (emailDupCounts.get(str(email).trim().toLowerCase()) ?? 0) >= 2}
									<span class="field-row-dup-msg">{pageContents.supplierModal.dupEmail[lang]}</span>
								{:else if str(email).trim() && !EMAIL_RE.test(str(email).trim())}
									<!-- Batch 17b: message validate inline như login/register -->
									<span class="field-row-dup-msg">{pageContents.form.invalidEmail[lang]}</span>
								{/if}
							</div>
						{/each}
						<!-- Batch 22: gate CHẶT như phones — MỌI email non-empty + hợp lệ. -->
						<button
							type="button"
							class="field-add"
							disabled={supplierSubmitting ||
								supplierForm.emails.some((e) => {
									const v = (e ?? '').trim();
									return !v || !EMAIL_RE.test(v) || (emailDupCounts.get(v.toLowerCase()) ?? 0) >= 2;
								})}
							onclick={() => {
								// Batch10 (m06635-5b): flushSync + focus trong gesture.
								flushSync(() => {
									supplierForm.emails = [...supplierForm.emails, ''];
								});
								focusLastFieldRow(supplierModalBodyEl, '[data-field="supplier-emails"]');
							}}
						>+ {pageContents.supplierModal.addEmail[lang]}</button>
					</div>
					<!-- ── Multiple addresses (yêu cầu 1g: BỎ address đơn — block này là duy nhất;
					     entry đầu = địa chỉ chính cho payload cấp 1) ── -->
					<div class="items-block social-group" data-field="supplier-addresses">
						<span class="items-block__label">{pageContents.supplierModal.addresses[lang]}</span>
						{#each supplierForm.addresses as entry, addrIndex (addrIndex)}
							<div class="address-entry" class:field-row--dup={(addressDupCounts.get(str(entry.address).trim().toLowerCase()) ?? 0) >= 2}>
								<div class="address-entry__head">
									<Badge class="field-row-stt" label={String(addrIndex + 1)} size="xs" variant="solid" color={(addressDupCounts.get(str(entry.address).trim().toLowerCase()) ?? 0) >= 2 ? 'error' : 'primary'} data-test={`supplier-address-stt-${addrIndex}`} />
									<div class="field-icon-wrap address-label-wrap">
										<Input
											type="text"
											bind:value={entry.label}
											placeholder={pageContents.supplierModal.addressLabelPlaceholder[lang]}
											disabled={supplierSubmitting}
											size="sm"
										/>
										{#if addressEntryActionable(addrIndex)}
											<!-- Batch 22 (m00193-2): entry có địa chỉ + tỉnh → passive
											     field — icon thành <a target="_blank"> MỞ GOOGLE MAPS
											     (search query = label + address + chuỗi địa giới). -->
											<a
												class="field-icon field-icon--action"
												href={addressMapsUrl(addrIndex)}
												target="_blank"
												rel="noopener noreferrer"
												aria-label={pageContents.supplierModal.mapAction[lang]}
												tabindex={-1} data-action-anchor={'address-' + addrIndex}
											>
												<Icon icon={iconify['map-pin-outline-rounded']} />
											</a>
										{:else}
											<Icon class="field-icon" icon={iconify['map-pin-outline-rounded']} />
										{/if}
									</div>
									<button
										type="button"
										class="field-row-remove"
										aria-label={pageContents.supplierModal.removeAddress[lang]}
										disabled={supplierSubmitting}
										onclick={() => {
											supplierForm.addresses = supplierForm.addresses.filter((_, i) => i !== addrIndex);
											supplierAddressBreakdowns = supplierAddressBreakdowns.filter((_, i) => i !== addrIndex);
											supplierNewAddressBreakdowns = supplierNewAddressBreakdowns.filter((_, i) => i !== addrIndex);
										}}
									>✕</button>
								</div>
								<!-- Batch 16 (mục 8): breadcrumb 3 cấp trên step modal mobile.
								     Batch 17 (yêu cầu 3d): Suppliers › Create/Tên › Địa chỉ —
								     tap Suppliers → đóng TẤT CẢ về datatable; tap Create/Tên →
								     chỉ đóng step modal về form. Comment để NGOÀI tag: comment
								     HTML trong tag = lỗi cú pháp Svelte "Expected token >". -->
								<div class="address-passive-wrap">
								<AddressInput
									bind:value={entry.address}
									bind:breakdown={supplierAddressBreakdowns[addrIndex]}
									bind:newBreakdown={supplierNewAddressBreakdowns[addrIndex]}
									placeholder={pageContents.supplierModal.addressPlaceholder[lang]}
									disabled={supplierSubmitting || (addressEntryActionable(addrIndex) && !supplierFieldUnlocked['address-' + addrIndex])}
									breadcrumbHome={pageContents.title[lang] ?? 'Suppliers'}
									breadcrumbName={supplierEditMode === 'edit' ? (supplierForm.name || null) : pageContents.supplierModal.submit[lang]}
									onBreadcrumbHomeTap={closeAllFromStep}
									onBreadcrumbNameTap={attemptCloseStepModal}
								/>
								{#if addressEntryActionable(addrIndex) && !supplierFieldUnlocked['address-' + addrIndex]}
									<button type="button" class="field-passive-hit" title={pageContents.supplierModal.passiveHint[lang]} aria-label={pageContents.supplierModal.passiveHint[lang]} onclick={(e) => handleSupplierPassiveTap(e, 'address', addrIndex)}></button>
								{/if}
								</div>
								{#if supplierSubmitAttempted && addressEntryInvalid(addrIndex)}
									<!-- Batch 21: AddressInput KHÔNG có prop color → message inline
									     per-entry theo pattern .field-row-dup-msg (absolute top:100%,
									     cha .address-entry có position:relative) -->
									<span class="field-row-dup-msg">{pageContents.form.invalidAddress[lang]}</span>
								{/if}
							</div>
						{/each}
						<!-- Batch 20 (A7) + Batch 22 (m00193-2): chặn add khi BẤT KỲ
						     entry hiện có: thiếu tỉnh (Batch 20) HOẶC address rỗng
						     (Batch 22 — gate chặt: mọi item phải có giá trị hợp lệ,
						     không trống thì mới cho thêm item mới). Entry vừa thêm
						     còn rỗng → chưa thêm được entry thứ hai cho tới khi điền. -->
						<button
							type="button"
							class="field-add"
							disabled={supplierSubmitting ||
								(supplierForm.addresses.length > 0 &&
									supplierForm.addresses.some((_a, i) => addressEntryInvalid(i) || !str(supplierForm.addresses[i].address).trim()))}
							onclick={() => {
								// Batch10 (m06635-5b): flushSync + focus trong gesture.
								flushSync(() => {
									supplierForm.addresses = [...supplierForm.addresses, { label: '', address: '', province: '', district: '' }];
									supplierAddressBreakdowns = [...supplierAddressBreakdowns, { province: '', district: '', ward: '' }];
									supplierNewAddressBreakdowns = [...supplierNewAddressBreakdowns, { province: '', ward: '' }];
								});
								focusLastFieldRow(supplierModalBodyEl, undefined, 'address-entry');
							}}
						>+ {pageContents.supplierModal.addAddress[lang]}</button>
					</div>
					<!-- ── Social block: 6 field dạng TAG multi-value (yêu cầu batch7:
					     enter tạo mới, icon open-tab + remove, click text edit, cấm trùng) ── -->
					<div class="items-block social-group">
						<span class="items-block__label">{pageContents.supplierModal.social[lang]}</span>
						<div class="form-grid-2">
							{#each SOCIAL_FIELDS as sf (sf)}
								<div class="social-tag-block" data-field="social-{sf}">
									<span class="social-tag-block__label">{pageContents.supplierModal[sf][lang]}</span>
									<div class="social-tags">
										{#each supplierForm[sf] as tag, ti (ti)}
											{@const tagInvalid = socialEntryInvalid(sf, tag)}
											{@const isLink = !!socialTagHref(sf, tag)}
											<span
												class="social-tag"
												class:social-tag--invalid={tagInvalid}
												class:social-tag--link={isLink}
											>
												{#if isLink}
													<!-- Batch 15 (m12278-9): <a> thật thay vì window.open —
													     window.open(url,'_blank','noopener') bị popup blocker
													     chặn âm thầm (bấm không có tác dụng). <a target=_blank>
													     khai báo sẵn → browser cho phép, middle-click cũng chạy. -->
													<a
														class="social-tag__open"
														href={socialTagHref(sf, tag)}
														target="_blank"
														rel="noopener noreferrer"
														title={pageContents.supplierModal.socialOpen[lang]}
														aria-label={pageContents.supplierModal.socialOpen[lang]}
													>
														<Icon icon={iconify['open-in-new-rounded']} size="sm" />
													</a>
												{/if}
												<!-- click text → edit inline (chuyển thành input) -->
												{#if editingSocial?.field === sf && editingSocial.index === ti}
													<input
														class="social-tag__edit"
														type="text"
														bind:value={editingSocial.value}
														onkeydown={(e) => {
															if (e.key === 'Enter') commitSocialEdit();
															else if (e.key === 'Escape') editingSocial = null;
														}}
														onblur={commitSocialEdit}
													/>
												{:else}
													<button
														type="button"
														class="social-tag__text"
														title={pageContents.supplierModal.socialEdit[lang]}
														onclick={() => startSocialEdit(sf, ti)}
													>{tag}</button>
												{/if}
												<button
													type="button"
													class="social-tag__remove"
													title={pageContents.supplierModal.socialRemove[lang]}
													aria-label={pageContents.supplierModal.socialRemove[lang]}
													onclick={() => removeSocialTag(sf, ti)}
												>
													<Icon icon={iconify['close-rounded']} size="sm" />
												</button>
											</span>
										{/each}
										<input
											class="social-tags__input"
											type="text"
											placeholder={pageContents.supplierModal[sfPlaceholderKey(sf)][lang]}
											bind:value={socialDraftInputs[sf]}
											onkeydown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault();
													addSocialTag(sf);
												}
											}}
											disabled={supplierSubmitting}
										/>
									</div>
									{#if socialTagErrors[sf]}
										<span class="social-tag-error">{pageContents.supplierModal[socialTagErrors[sf]!][lang]}</span>
									{/if}
								</div>
							{/each}
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
					<!-- ── Field passive (batch 11): metadata created/updated — chỉ edit mode ── -->
					{#if supplierEditMode === 'edit' && supplierPassive}
						<dl class="supplier-passive" data-test="supplier-passive">
							{#if supplierPassive.createdAt}
								<div class="supplier-passive__row">
									<dt>{pageContents.supplierModal.passiveCreatedAt[lang]}</dt>
									<dd>{formatDate(supplierPassive.createdAt)}{#if supplierPassive.createdBy}<span class="supplier-passive__sep">·</span>{supplierPassive.createdBy}{/if}</dd>
								</div>
							{/if}
							{#if supplierPassive.updatedAt}
								<div class="supplier-passive__row">
									<dt>{pageContents.supplierModal.passiveUpdatedAt[lang]}</dt>
									<dd>{formatDate(supplierPassive.updatedAt)}{#if supplierPassive.updatedBy}<span class="supplier-passive__sep">·</span>{supplierPassive.updatedBy}{/if}</dd>
								</div>
							{/if}
						</dl>
					{/if}
					</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- Batch 20 (A4): thay nút History bằng icon more mở popover
					(history / delete / analytics). Chỉ edit mode — nhóm riêng cách
					Save/Cancel khoảng trống. Bọc trong div relative làm anchor +
					guard outside-click (supplierMoreEl.contains). -->
				{#if supplierEditMode === 'edit'}
					<div class="supplier-more-wrap" bind:this={supplierMoreEl}>
						<!-- Batch 22 (m00193-3): dùng lại component Button (variant ghost +
						     aspect-square) — đồng bộ hệ style với Save/Cancel cùng footer,
						     thay button raw .supplier-more-btn riêng lẻ. -->
						<Button
							variant="ghost"
							color="default"
							aspect-square
							aria-label={pageContents.more.label[lang]}
							aria-expanded={supplierMoreOpen}
							disabled={supplierSubmitting}
							data-test="suppliers-more-btn"
							onclick={() => {
									supplierMoreOpen = !supplierMoreOpen;
								}}
						>
							<Icon icon={iconify['more-horiz-rounded']} size="sm" />
						</Button>
						{#if supplierMoreOpen}
							<div class="supplier-more-popover" role="menu">
								<button
									type="button"
									class="supplier-more-popover__item"
									role="menuitem"
									disabled={supplierSubmitting}
									onclick={moreOpenHistory}
									data-test="suppliers-more-history"
								>
									{pageContents.more.history[lang]}
								</button>
								<button
									type="button"
									class="supplier-more-popover__item supplier-more-popover__item--danger"
									role="menuitem"
									disabled={supplierSubmitting}
									onclick={moreOpenDelete}
									data-test="suppliers-more-delete"
								>
									{pageContents.more.delete[lang]}
								</button>
								<button
									type="button"
									class="supplier-more-popover__item"
									role="menuitem"
									disabled={supplierSubmitting}
									onclick={moreOpenAnalytics}
									data-test="suppliers-more-analytics"
								>
									{pageContents.more.analytics[lang]}
								</button>
							</div>
						{/if}
					</div>
				{/if}
				<span class="supplier-footer-spacer"></span>
				<!-- create/save = success. Batch10 (m06635-5c): disable khi form invalid
					(đỡ thao tác lãng phí — submit chỉ bật khi dữ liệu hợp lệ). -->
				<!-- Batch 16 (m13579-5): edit mode — Save chỉ bật khi form dirty. -->
				<Button color="success" onClick={submitSupplier} loading={supplierSubmitting} disabled={supplierSubmitting || supplierFormInvalid || !supplierEditDirty}>
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

	<!-- ── Batch 44 (m17527): prompt load draft hay form mới khi create ── -->
	{#if draftPromptDisplay}
	<AlertDialog bind:open={draftPromptDisplay} title={pageContents.draftPrompt.title[lang]} description={pageContents.draftPrompt.desc[lang]}>
	<AlertDialog.Content>
	<AlertDialog.Header variant="info">
	<AlertDialog.Title>{pageContents.draftPrompt.title[lang]}</AlertDialog.Title>
	<AlertDialog.Description>{pageContents.draftPrompt.desc[lang]}</AlertDialog.Description>
	</AlertDialog.Header>
	<AlertDialog.Footer>
	<AlertDialog.Cancel onclick={handleDraftPromptLoad}>{pageContents.draftPrompt.loadDraft[lang]}</AlertDialog.Cancel>
	<AlertDialog.Action
	color="primary"
	onselect={handleDraftPromptNew}
	>
	{pageContents.draftPrompt.newForm[lang]}
	</AlertDialog.Action>
	</AlertDialog.Footer>
	</AlertDialog.Content>
	</AlertDialog>
	{/if}

<!-- ── Batch10 (m06635-3): Setting modal (filter status + sort) — mở từ nút
	tune header datatable (desktop + mobile) và nút setting FAB. Thay popover
	gắn caption (bị ẩn theo row tools khi đang cuộn → click FAB "không thấy"). ── -->
{#if settingModalDisplay}
	<Modal bind:display={settingModalDisplay} size="sm">
		<Modal.Container>
			<Modal.Container.Header>{pageContents.settings.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="setting-form" data-test="suppliers-setting-modal">
					<TextField name="suppliers-setting-status">
						<Label>{pageContents.settings.filterStatus[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={supplierStatusFilter}
							options={supplierStatusOptions}
							searchable
							clearable
							/* Batch 11 (yêu cầu 2b): panel option KHÔNG portal — nằm trong
							   .modal-body-root (overflow-y:auto) → phần dưới list bị footer
							   che, phải cuộn body mới thấy. Fullscreen mode = overlay riêng,
							   không còn xung đột scroll-container. */
							fullscreen
							placeholder={pageContents.filters.allStatuses[lang]}
							data-test="suppliers-setting-status"
						/>
					</TextField>
					<TextField name="suppliers-setting-sort">
						<Label>{pageContents.settings.sortBy[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={settingSortField}
							options={settingSortOptions}
							clearable
							fullscreen
							placeholder={pageContents.settings.sortBy[lang]}
							data-test="suppliers-setting-sort"
						/>
					</TextField>
					<TextField name="suppliers-setting-direction">
						<Label>{pageContents.settings.sortDirection[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={settingSortDirection}
							options={[
								{ value: 'asc', label: pageContents.settings.asc[lang] },
								{ value: 'desc', label: pageContents.settings.desc[lang] }
							]}
							fullscreen
							data-test="suppliers-setting-direction"
						/>
					</TextField>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button
					color="secondary"
					variant="outline"
					disabled={supplierStatusFilter === '' && settingSortField === ''}
					onClick={() => {
						settingSortField = '';
						settingSortDirection = 'desc';
					}}
				>
					{pageContents.settings.reset[lang]}
				</Button>
				<Button
					color="primary"
					data-test="suppliers-setting-apply"
					onClick={() => {
						sortField = settingSortField;
						sortDirection = settingSortDirection === 'asc' ? 'asc' : 'desc';
						settingModalDisplay = false;
						// mirror onSupplierFilterChange + onSupplierSortChange: persist
						// (filter + sort) + về trang 1 + reload
						saveDataTablePrefs(PREFS_KEY, {
							filters: { status: supplierStatusFilter || null },
							sort: sortField ? { field: sortField, direction: sortDirection } : undefined,
							cardFields: cardFieldIds
						});
						suppliersPage = 1;
						currentPagingPage = 1;
						void loadSuppliers();
					}}
				>
					{pageContents.settings.apply[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- B46 (m18161): setting modal PO — sort server (mirror setting modal suppliers, -->
<!--     nhưng chỉ sort: filter PO đã nằm caption). -->
<!-- B46 (m18161): setting modal PO — sort server (mirror setting modal -->
<!--     suppliers: Modal.Container + Select fullscreen, không RadioGroup). -->
{#if poSettingModalDisplay}
	<Modal bind:display={poSettingModalDisplay} size="sm">
		<Modal.Container>
			<Modal.Container.Header>{pageContents.settings.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="setting-form" data-test="po-setting-modal">
					<!-- B47 (m19661): filter PO đẩy VÀO setting modal (mobile ẩn select
					     caption) — mirror setting modal suppliers 3 field. -->
					<TextField name="po-setting-status">
						<Label>{pageContents.settings.filterStatus[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poStatusFilter}
							options={poStatusOptions}
							searchable
							clearable
							fullscreen
							placeholder={pageContents.filters.allStatuses[lang]}
							data-test="po-setting-status"
						/>
					</TextField>
					<TextField name="po-setting-branch">
						<Label>{pageContents.filters.allBranches[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poBranchFilter}
							options={poBranchOptions}
							searchable
							clearable
							fullscreen
							placeholder={pageContents.filters.allBranches[lang]}
							data-test="po-setting-branch"
						/>
					</TextField>
					<TextField name="po-setting-supplier">
						<Label>{pageContents.filters.allSuppliers[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poSupplierFilter}
							options={poSupplierOptions}
							searchable
							clearable
							fullscreen
							placeholder={pageContents.filters.allSuppliers[lang]}
							data-test="po-setting-supplier"
						/>
					</TextField>
					<TextField name="po-setting-sort">
						<Label>{pageContents.settings.sortBy[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poSettingSortField}
							options={poSortOptions}
							clearable
							fullscreen
							placeholder={pageContents.settings.sortBy[lang]}
							data-test="po-setting-sort"
						/>
					</TextField>
					<TextField name="po-setting-direction">
						<Label>{pageContents.settings.sortDirection[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={poSettingSortDirection}
							options={
								[
									{ value: 'asc', label: pageContents.settings.asc[lang] },
									{ value: 'desc', label: pageContents.settings.desc[lang] }
								]
							}
							fullscreen
							data-test="po-setting-direction"
						/>
					</TextField>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button
					color="secondary"
					variant="outline"
					disabled={!poSettingSortField && !poStatusFilter && !poBranchFilter && !poSupplierFilter}
					onClick={() => {
						poSettingSortField = '';
						poSettingSortDirection = 'desc';
						poStatusFilter = '';
						poBranchFilter = '';
						poSupplierFilter = '';
					}}
				>
					{pageContents.settings.reset[lang]}
				</Button>
				<Button
					color="primary"
					data-test="po-setting-apply"
					onClick={() => {
						poSortField = poSettingSortField;
						poSortDirection = poSettingSortDirection === 'asc' ? 'asc' : 'desc';
						poSettingModalDisplay = false;
						// B47: persist filter+sort (mirror suppliers setting apply)
						saveDataTablePrefs(PO_PREFS_KEY, {
							filters: {
								status: poStatusFilter || null,
								branch: poBranchFilter || null,
								supplier: poSupplierFilter || null
							},
							sort: poSortField ? { field: poSortField, direction: poSortDirection } : undefined,
							cardFields: poCardFieldIds
						});
						posPage = 1;
						currentPagingPage = 1;
						void loadPOs();
					}}
				>
					{pageContents.settings.apply[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}



<!-- B46 (m18161): confirm xoá PO đã chọn (bulk).
-->						
{#if poBulkDeleteDisplay}
	<AlertDialog bind:open={poBulkDeleteDisplay}>
		<AlertDialog.Content>
			<AlertDialog.Header variant="danger">
				<AlertDialog.Title>{pageContents.poBulk.title[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.poBulk.desc[lang]}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.poBulk.cancel[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action
					color="danger"
					disabled={poBulkDeleting}
					data-test="po-bulk-delete-confirm"
					onselect={bulkDeletePOsSelected}
				>
					{pageContents.poBulk.confirm[lang]}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog>
{/if}


<!-- ── Modal lịch sử thay đổi (timeline kiểu git + khôi phục từng entry) ── -->
{#if historyDisplay}
	<!-- B33 (m10313): class hook CSS full-size mobile (mirror analytics B32). -->
	<Modal bind:display={historyDisplay} size="lg" class="supplier-history-modal-root">
		<Modal.Container>
			<Modal.Container.Header>
				{#if isMobile}
					<!-- B33 (m10313): breadcrumb 3 cấp Suppliers › Tên NCC › Lịch sử —
					     tap Suppliers chỉ ĐÓNG history (form phía sau giữ nguyên; history
					     có thể mở thẳng từ list-row — lúc đó không có form để quay về). -->
					<div class="supplier-modal-title" bind:this={hisCrumbNavEl}>
						{#if hisCrumbOverflow > 0}
							<button
								type="button"
								class="supplier-modal-title__more"
								aria-label={pageContents.supplierModal.crumbMore[lang]}
								aria-expanded={hisCrumbMoreOpen}
								onclick={() => (hisCrumbMoreOpen = !hisCrumbMoreOpen)}
							>
								<Icon icon={iconify['more-horiz-rounded']} size="sm" />
							</button>
							{#if hisCrumbMoreOpen}
								<div class="supplier-crumb-popover" role="menu">
									{#if hisCrumbOverflow >= 1}
										<button
											type="button"
											class="supplier-crumb-popover__item"
											onclick={() => {
												hisCrumbMoreOpen = false;
												historyDisplay = false;
												// B36 (m13430): tap Suppliers = về datatable — đóng cả form (dirty-guard
												// hỏi Discard khi dirty) chứ không chỉ history.
												closeGuard.attemptClose();
											}}
										>
											{pageContents.title[lang]}
										</button>
									{/if}
									{#if hisCrumbOverflow >= 2}
										<button
											type="button"
											class="supplier-crumb-popover__item"
											onclick={() => {
												hisCrumbMoreOpen = false;
												historyDisplay = false;
											}}
										>
											{historySupplier?.name}
										</button>
									{/if}
								</div>
							{/if}
						{/if}
						{#if hisCrumbOverflow < 1}
							<button
								type="button"
								class="supplier-modal-title__label supplier-modal-title__crumb"
								onclick={() => {
									// B36 (m13430): về datatable — đóng cả form (dirty-guard).
									historyDisplay = false;
									closeGuard.attemptClose();
								}}
							>
								{pageContents.title[lang]}
							</button>
						{/if}
						{#if hisCrumbOverflow < 2}
							<span class="supplier-modal-title__name" aria-hidden="true">›</span>
							<!-- B33.1 (m10792): crumb giữa = quay về modal form detail KHI history mở từ footer
							     form (historySupplierRow có). Mở thẳng từ list-row (openHistoryModal) thì KHÔNG
							     có form phía sau ⇒ span tĩnh không bấm được. -->
							{#if historySupplierRow}
								<button
									type="button"
									class="supplier-modal-title__name supplier-modal-title__crumb"
									onclick={() => (historyDisplay = false)}
								>
									{historySupplier?.name}
								</button>
							{:else}
								<span class="supplier-modal-title__name">{historySupplier?.name}</span>
							{/if}
						{/if}
						{#if hisCrumbOverflow < 2}
							<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						{/if}
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.historyModal.title[lang]}
						</span>
					</div>
				{:else}
					{pageContents.historyModal.title[lang]}{historySupplier?.name ? ` — ${historySupplier.name}` : ''}
				{/if}
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if historyLoading}
					<div class="history-state">{pageContents.historyModal.loading[lang]}</div>
				{:else if historyEntries.length === 0}
					<div class="history-state">{pageContents.historyModal.empty[lang]}</div>
				{:else}
					<div class="history-timeline" data-test="suppliers-history-timeline">
						{#each historyEntries as entry (entry._id)}
							{@const entryLabel = pageContents.historyModal[entry.type === 'restore' ? 'restore' : 'update'][lang]}
							<div class="history-entry" class:history-entry--restore={entry.type === 'restore'}>
								<div class="history-entry__rail">
									<span class="history-dot" class:history-dot--restore={entry.type === 'restore'}></span>
								</div>
								<div class="history-entry__card">
									<!-- Batch 16 (m13579-11): timeline 2 row — row 1 badge+time,
									     row 2 "by actor"; mỗi row ellipsis chống kéo dãn card. -->
									<div class="history-entry__head">
										<Badge variant="soft" color={entry.type === 'restore' ? 'success' : 'info'} label={entryLabel} />
										<!-- Batch 15 (m12278-2): timeline thêm giờ:phút:giây -->
										<time class="history-time">{entry.createdAt ? formatDateTimeSec(entry.createdAt, lang) : ''}</time>
									</div>
									<div class="history-entry__actor">
										<span class="history-actor">
											{pageContents.historyModal.by[lang]}
											{entry.actorName || pageContents.historyModal.unknownActor[lang]}
										</span>
									</div>
									{#if entry.changes.length === 0}
										<p class="history-nochanges">{pageContents.historyModal.noChanges[lang]}</p>
									{:else}
										<ul class="history-changes">
											{#each entry.changes as ch (ch.field)}
												<li class="history-change">
													<span class="history-change__field">{pageContents.historyModal.fieldLabels[ch.field]?.[lang] ?? ch.field}</span>
													<del class="history-change__before">{snapshotDisplay(ch.before)}</del>
													<ins class="history-change__after">{snapshotDisplay(ch.after)}</ins>
												</li>
											{/each}
										</ul>
									{/if}
									{#if entry.type === 'update'}
										<div class="history-entry__actions">
											<Button
												color="secondary"
												variant="outline"
												size="xs"
												disabled={restoreBusy !== null}
												onClick={() => {
													historyPendingRestore = entry;
													historyConfirmDisplay = true;
												}}
												data-test="suppliers-restore-btn"
											>
												{pageContents.historyModal.restoreBtn[lang]}
											</Button>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</Modal.Container.Body>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Batch 20 (A4): panel phân tích nhập hàng theo NCC (more-menu) ── -->
{#if supplierAnalyticsDisplay}
	<Modal bind:display={supplierAnalyticsDisplay} size="sm" class="supplier-analytics-modal-root">
		<Modal.Container>
			<Modal.Container.Header>
				{#if isMobile}
					<!-- B33 (m10313): breadcrumb 3 cấp Suppliers › Tên NCC › Thống kê (cấu trúc window/modal).
					     B34 (m11088): tràn → gom nấc ĐẦU vào popover more (cách modal address — Batch 21). -->
					<div class="supplier-modal-title" bind:this={anaCrumbNavEl}>
						{#if anaCrumbOverflow > 0}
							<button
								type="button"
								class="supplier-modal-title__more"
								aria-label={pageContents.supplierModal.crumbMore[lang]}
								aria-expanded={anaCrumbMoreOpen}
								onclick={() => (anaCrumbMoreOpen = !anaCrumbMoreOpen)}
							>
								<Icon icon={iconify['more-horiz-rounded']} size="sm" />
							</button>
							{#if anaCrumbMoreOpen}
								<div class="supplier-crumb-popover" role="menu">
									{#if anaCrumbOverflow >= 1}
										<button
											type="button"
											class="supplier-crumb-popover__item"
											onclick={() => {
												anaCrumbMoreOpen = false;
												supplierAnalyticsDisplay = false;
												// B36 (m13430): tap Suppliers = về datatable — đóng cả form (dirty-guard
												// hỏi Discard khi dirty) chứ không chỉ analytics.
												closeGuard.attemptClose();
											}}
										>
											{pageContents.title[lang]}
										</button>
									{/if}
									{#if anaCrumbOverflow >= 2}
										<button
											type="button"
											class="supplier-crumb-popover__item"
											onclick={() => {
												anaCrumbMoreOpen = false;
												supplierAnalyticsDisplay = false;
											}}
										>
											{historySupplierRow?.name}
										</button>
									{/if}
								</div>
							{/if}
						{/if}
						{#if anaCrumbOverflow < 1}
							<button
								type="button"
								class="supplier-modal-title__label supplier-modal-title__crumb"
								onclick={() => {
									// B36 (m13430): về datatable — đóng cả form (dirty-guard).
									supplierAnalyticsDisplay = false;
									closeGuard.attemptClose();
								}}
							>
								{pageContents.title[lang]}
							</button>
						{/if}
						{#if anaCrumbOverflow < 2}
							<span class="supplier-modal-title__name" aria-hidden="true">›</span>
							<!-- B33.1 (m10792): crumb giữa = quay về modal form detail (form luôn mở phía sau
							     vì analytics chỉ mở từ footer form). -->
							<button
								type="button"
								class="supplier-modal-title__name supplier-modal-title__crumb"
								onclick={() => (supplierAnalyticsDisplay = false)}
							>
								{historySupplierRow?.name}
							</button>
						{/if}
						{#if anaCrumbOverflow < 2}
							<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						{/if}
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.more.analyticsTitle[lang]}
						</span>
					</div>
				{:else}
					{pageContents.more.analyticsTitle[lang]}{historySupplierRow?.name ? ` — ${historySupplierRow.name}` : ''}
				{/if}
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if supplierAnalyticsLoading}
					<div class="history-state">{pageContents.more.analyticsLoading[lang]}</div>
				{:else if !supplierAnalyticsData || supplierAnalyticsData.orderCount === 0}
					<div class="history-state">{pageContents.more.analyticsEmpty[lang]}</div>
				{:else}
					<div class="supplier-analytics" data-test="suppliers-analytics-panel">
						<div class="supplier-analytics__totals">
							<div class="supplier-analytics__stat">
								<span class="supplier-analytics__stat-value">{Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(supplierAnalyticsData.orderCount)}</span>
								<span class="supplier-analytics__stat-label">{pageContents.more.analyticsOrderCount[lang]}</span>
							</div>
							<div class="supplier-analytics__stat">
								<span class="supplier-analytics__stat-value">{Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(supplierAnalyticsData.totalQuantity)}</span>
								<span class="supplier-analytics__stat-label">{pageContents.more.analyticsTotalQuantity[lang]}</span>
							</div>
							<div class="supplier-analytics__stat">
								<span class="supplier-analytics__stat-value">{formatMoney(supplierAnalyticsData.totalValue)}</span>
								<span class="supplier-analytics__stat-label">{pageContents.more.analyticsTotalValue[lang]}</span>
							</div>
						</div>
						{#if supplierAnalyticsData.monthly.length > 0}
							<div class="supplier-analytics__monthly">
								<div class="supplier-analytics__monthly-title">{pageContents.more.analyticsMonthly[lang]}</div>
								<table class="supplier-analytics__table">
									<thead>
										<tr>
											<th>{pageContents.more.analyticsColPeriod[lang]}</th>
											<th class="num">{pageContents.more.analyticsColOrders[lang]}</th>
											<th class="num">{pageContents.more.analyticsColQty[lang]}</th>
											<th class="num">{pageContents.more.analyticsColValue[lang]}</th>
										</tr>
									</thead>
									<tbody>
										{#each supplierAnalyticsData.monthly as m (m.period)}
											<tr>
												<td>{m.period}</td>
												<td class="num">{Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(m.orderCount)}</td>
												<td class="num">{Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(m.quantity)}</td>
												<td class="num">{formatMoney(m.value)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{/if}
			</Modal.Container.Body>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Batch 20 (A4): AlertDialog confirm xoá 1 NCC từ more-menu ── -->
{#if supplierDeleteDisplay}
	<AlertDialog
		bind:open={supplierDeleteDisplay}
		title={pageContents.more.deleteTitle[lang]}
		description={pageContents.more.deleteDesc[lang]}
	>
		<AlertDialog.Content>
			<AlertDialog.Header variant="danger">
				<AlertDialog.Title>{pageContents.more.deleteTitle[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.more.deleteDesc[lang]}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.bulk.cancel[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action
					color="danger"
					disabled={supplierDeleting}
					onselect={() => {
						void deleteSupplierFromMore();
					}}
					data-test="suppliers-more-delete-confirm"
				>
					{pageContents.more.deleteConfirm[lang]}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog>
{/if}

<!-- ── AlertDialog confirm khôi phục entry ── -->
{#if historyConfirmDisplay}
	<AlertDialog
		bind:open={historyConfirmDisplay}
		title={pageContents.historyModal.confirmTitle[lang]}
		description={pageContents.historyModal.confirmDesc[lang]}
	>
		<AlertDialog.Content>
			<AlertDialog.Header variant="info">
				<AlertDialog.Title>{pageContents.historyModal.confirmTitle[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.historyModal.confirmDesc[lang]}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.historyModal.cancel[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action color="primary" disabled={restoreBusy !== null} onselect={() => historyPendingRestore && void performRestore(historyPendingRestore)}>
					{pageContents.historyModal.confirmYes[lang]}
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
{#snippet poCodeTrailing()}
	<!-- B49 (chain B): nút generate mã PO ngay trong input (trailing snippet của Input) -->
	<Button
		type="button"
		variant="ghost"
		size="xs"
		disabled={poSubmitting}
		aria-label={pageContents.poModal.generateCode[lang]}

		onclick={() => {
			poForm.poCode = "QN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
		}}
	>
		<Icon icon={iconify['edit-outline-rounded']} size="xs" />
	</Button>
{/snippet}
{#if poModalDisplay}
	<Modal bind:display={poModalDisplay} size="lg" isDimissable onCloseAttempt={() => poCloseGuard.attemptClose()} class="supplier-modal-root">
		<Modal.Container>
			<!-- B47 (m19661): ẨN nút ✕ header trên mobile (đồng bộ suppliers form
			     — chỉ đóng qua crumb/back) -->
			<Modal.Container.Header actionButtons={{ close: { display: !isMobile } }}>
				<!-- B46 (m18161): breadcrumb 3 nấc [Suppliers › Create PO] giống form modal
				     — tap nấc Suppliers đóng modal về datatable.
				     B47: edit mode — active = poCode (đồng bộ Suppliers › tên NCC) -->
				<div class="supplier-modal-title" bind:this={poCrumbNavEl}>
				{#if poCrumbOverflow > 0}
					<button
						type="button"
						class="supplier-modal-title__more"
						aria-label={pageContents.supplierModal.crumbMore[lang as 'vi' | 'en']}
						aria-expanded={poCrumbMoreOpen}
						tabindex={poCrumbOverflow > 0 ? 0 : -1}
						aria-hidden={poCrumbOverflow > 0 ? undefined : 'true'}
						style={poCrumbOverflow > 0 ? undefined : 'visibility:hidden;pointer-events:none;'}
						onclick={() => (poCrumbMoreOpen = !poCrumbMoreOpen)}
					>
						<svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
					</button>
					{#if poCrumbMoreOpen}
						<div class="supplier-crumb-popover" role="menu">
							<button
								type="button"
								class="supplier-crumb-popover__item"
								role="menuitem"
								onclick={() => {
									poCrumbMoreOpen = false;
									poCloseGuard.attemptClose();
								}}
							>{pageContents.poModal.rootCrumb[lang]}</button>
						</div>
					{/if}
				{/if}
				{#if poCrumbOverflow < 1}
					<button
						type="button"
						class="supplier-modal-title__label supplier-modal-title__crumb"
						disabled={poSubmitting}
						onclick={() => poCloseGuard.attemptClose()}
					>
						{pageContents.poModal.rootCrumb[lang]}
					</button>
				{/if}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name supplier-modal-title__name--active">
						{poEditMode === 'edit' ? (poOriginalCode || poForm.poCode) : pageContents.poModal.title[lang]}
					</span>
				</div>
			</Modal.Container.Header>
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
									trailing={poCodeTrailing}
								/>
							</TextField>
						</div>
						<div data-field="po-expected">
						  <TextField name="po-expected">
						    <Label>{pageContents.poModal.expectedAt[lang]}</Label>
						    <input class="admin-input" type="date" min={poExpectedMin} bind:value={poForm.expectedAt} disabled={poSubmitting} />
						  </TextField>
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
								fullscreen={isMobile}
								fullscreenCrumbs={[
									{ label: pageContents.poModal.rootCrumb[lang], kind: 'crumb' },
									{ label: pageContents.poModal.title[lang], kind: 'crumb' },
									{ label: pageContents.poModal.supplier[lang], kind: 'current' }
								]}
								fullscreenCrumbTap={(i) => {
									if (i === 0) poCloseGuard.attemptClose();
									// nấc 1 (PO modal title) chỉ hiển thị — không hành động.
								}}
								allowCreate
								createOptionLabel={pageContents.poModal.createNew[lang]}
								onOptionCreate={(value) => openQuickCreate('supplier', value, 'supplier')}
								onTriggerDetail={() => openSelectDetail('supplier', poForm.supplierId)}
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
								fullscreen={isMobile}
								fullscreenCrumbs={[
									{ label: pageContents.poModal.rootCrumb[lang], kind: 'crumb' },
									{ label: pageContents.poModal.title[lang], kind: 'crumb' },
									{ label: pageContents.poModal.branch[lang], kind: 'current' }
								]}
								fullscreenCrumbTap={(i) => {
									if (i === 0) poCloseGuard.attemptClose();
								}}
								allowCreate
								createOptionLabel={pageContents.poModal.createNew[lang]}
								onOptionCreate={(value) => openQuickCreate('branch', value, 'branch')}
							/>
						</div>
					</div>

					<div class="items-block" data-field="po-items">
						<p class="form-label">{pageContents.poModal.items[lang]}</p>
						{#each poForm.items as item, index (index)}
							<!-- B49 (chain B): highlight dòng trùng variant -->
							<div class="po-item" class:po-item--dup={poItemDuplicate(index)}>
								<!-- B50 (m21047): badge STT góc trái + remove ✕ góc phải (mẫu .field-row) -->
								<Badge class="po-item-stt" label={`#${index + 1}`} size="xs" variant="solid" color={poItemDuplicate(index) ? 'error' : 'primary'} />
								<button type="button" class="po-item-remove" aria-label={pageContents.poModal.removeItem[lang]} disabled={poSubmitting} onclick={() => removePOItem(index)}>✕</button>
								<div class="po-item-field">
									<span class="form-label po-item-label">{pageContents.poModal.itemVariant[lang]}</span>
									<Select
										class="admin-filter-select po-item-variant"
										size="sm"
										bind:value={item.variantId}
										options={poVariantModalOptions}
										searchable
										clearable
										placeholder={pageContents.poModal.itemVariantPlaceholder[lang]}
										disabled={poSubmitting}
												fullscreen={isMobile}
										fullscreenCrumbs={[
											{ label: pageContents.poModal.rootCrumb[lang], kind: 'crumb' },
											{ label: pageContents.poModal.title[lang], kind: 'crumb' },
											{ label: pageContents.poModal.itemVariant[lang], kind: 'current' }
										]}
										fullscreenCrumbTap={(i) => {
											if (i === 0) poCloseGuard.attemptClose();
										}}
												allowCreate
										createOptionLabel={pageContents.poModal.createNew[lang]}
										onOptionCreate={(value) => openQuickCreate('variant', value, String(index))}
										onTriggerDetail={() => openSelectDetail('variant', item.variantId)}
									onValueChange={() => {
										// B50 (m21047): chọn variant → fill giá nhập dự kiến + hệ số đơn vị đầu tiên
										const v = variantOptions.find((vv) => vv._id === item.variantId);
										item.unitCost = v?.lastPurchaseCost ?? 0;
										item.unitFactor = v?.units?.[0]?.factor ?? undefined;
									}}
									/>
								</div>
								<div class="po-item-field">
									<span class="form-label po-item-label">{pageContents.poModal.itemQuantity[lang]}</span>
									<input class="admin-input po-item-num" type="number" min="1" step="1" bind:value={item.quantity} disabled={poSubmitting} placeholder={pageContents.poModal.itemQuantity[lang]} />
								</div>
								<!-- B50 (m21047): đơn vị nhập — gợi ý từ units variant, cho gõ mới -->
								<div class="po-item-field">
									<span class="form-label po-item-label">{pageContents.poModal.itemUnit[lang]}</span>
									<Select
										class="admin-filter-select po-item-unit"
										size="sm"
										bind:value={item.unitName}
										options={variantOptions.find((v) => v._id === item.variantId)?.units?.map((u) => ({ value: u.name, label: u.name })) ?? []}
										allowCreate
										createOptionLabel={pageContents.poModal.itemUnitHint[lang]}
										clearable
										placeholder={pageContents.poModal.itemUnitPlaceholder[lang]}
										disabled={poSubmitting}
									/>
								</div>
								<!-- B50 (m21047): giá nhập dự kiến fill từ PO gần nhất — user sửa được -->
								<div class="po-item-field">
									<span class="form-label po-item-label">{pageContents.poModal.itemExpectedCost[lang]}</span>
									<input class="admin-input po-item-num" type="number" min="0" step="any" bind:value={item.unitCost} disabled={poSubmitting} placeholder={pageContents.poModal.itemExpectedCost[lang]} />
								</div>
								<!-- B49 (chain B): input unitCost ĐÃ LOẠI BỎ khỏi form (giữ trong type = 0) -->
								<div class="po-item-field">
									<span class="form-label po-item-label">{pageContents.poModal.itemLot[lang]}</span>
									<input class="admin-input po-item-lot" type="text" bind:value={item.lotNumber} disabled={poSubmitting} placeholder={pageContents.poModal.itemLot[lang]} />
								</div>
								<div class="po-item-field">
									<span class="form-label po-item-label">{pageContents.poModal.itemExpires[lang]}</span>
									<input class="admin-input po-item-date" type="date" bind:value={item.expiresAt} disabled={poSubmitting} />
								</div>
							</div>
						{/each}
						<!-- B49 (chain B): chỉ thêm dòng khi dòng CUỐI hợp lệ -->
						<Button
							color="default"
							variant="outline"
							size="sm"
							disabled={poSubmitting || (poForm.items.length > 0 && !lastPoItemValid)}
							onClick={addPOItem}
						>
							{pageContents.poModal.addItem[lang]}
						</Button>
						<!-- B49 (chain B): giá đã bỏ khỏi form — ẩn total khi 0 -->
						{#if poTotalCost > 0}
							<p class="po-total">
								{pageContents.poModal.totalCost[lang]}: <strong>{formatPoMoney(poTotalCost)}</strong>
							</p>
						{/if}
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<!-- B49 (chain B): Save chỉ mở review — submit thật qua dialog Confirm -->
				<Button color="success" onClick={openPOReview} loading={poSubmitting} disabled={poSubmitting || poFormInvalid}>
					{poEditMode === 'edit' ? pageContents.poModal.save[lang] : pageContents.poModal.submit[lang]}
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

<!-- ── B49 (chain B): Review trước submit ── -->
{#if poReviewDisplay}
	<Modal bind:display={poReviewDisplay} size="sm" isDimissable class="supplier-modal-root">
		<Modal.Container>
			<Modal.Container.Header actionButtons={{ close: { display: !isMobile } }}>
				<div class="supplier-modal-title" bind:this={rvCrumbNavEl}>
			{#if rvCrumbOverflow > 0}
				<button
					type="button"
					class="supplier-modal-title__more"
					aria-label={pageContents.supplierModal.crumbMore[lang as 'vi' | 'en']}
					aria-expanded={rvCrumbMoreOpen}
					tabindex={rvCrumbOverflow > 0 ? 0 : -1}
					aria-hidden={rvCrumbOverflow > 0 ? undefined : 'true'}
					style={rvCrumbOverflow > 0 ? undefined : 'visibility:hidden;pointer-events:none;'}
					onclick={() => (rvCrumbMoreOpen = !rvCrumbMoreOpen)}
				>
					<svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
				</button>
				{#if rvCrumbMoreOpen}
					<div class="supplier-crumb-popover" role="menu">
						<button
							type="button"
							class="supplier-crumb-popover__item"
							role="menuitem"
							onclick={() => {
								rvCrumbMoreOpen = false;
								poReviewDisplay = false;
							}}
						>{pageContents.poModal.rootCrumb[lang]}</button>
						<button
							type="button"
							class="supplier-crumb-popover__item"
							role="menuitem"
							onclick={() => {
								rvCrumbMoreOpen = false;
								poReviewDisplay = false;
							}}
						>{pageContents.poModal.title[lang]}</button>
					</div>
				{/if}
			{/if}
			{#if rvCrumbOverflow < 1}
					<button
						type="button"
						class="supplier-modal-title__label supplier-modal-title__crumb"
						disabled={poSubmitting}
						onclick={() => {
							poReviewDisplay = false;
						}}
					>
						{pageContents.poModal.rootCrumb[lang]}
					</button>
			{/if}
			{#if rvCrumbOverflow < 2}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
				<button type="button" class="supplier-modal-title__name supplier-modal-title__crumb" disabled={poSubmitting} onclick={() => { poReviewDisplay = false; }}>{pageContents.poModal.title[lang]}</button>
			{/if}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name supplier-modal-title__name--active">
						{poEditMode === 'edit' ? pageContents.poModal.reviewTitleEdit[lang] : pageContents.poModal.reviewTitle[lang]}
					</span>
				</div>
			</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="po-review">
					<div class="po-review-row"><span>{pageContents.poModal.reviewSupplier[lang]}</span><strong>{getSupplierLabel(poForm.supplierId)}</strong></div>
					<div class="po-review-row"><span>{pageContents.poModal.reviewBranch[lang]}</span><strong>{getBranchLabel(poForm.branchId)}</strong></div>
					<div class="po-review-row"><span>{pageContents.poModal.reviewExpectedAt[lang]}</span><strong>{poForm.expectedAt ? formatDate(poForm.expectedAt) : '—'}</strong></div>
					<div class="po-review-row"><span>{pageContents.poModal.reviewItems[lang]}</span><strong>{poForm.items.length}</strong></div>
					<div class="po-review-row"><span>{pageContents.poModal.totalCost[lang]}</span><strong>{formatPoMoney(poTotalCost)}</strong></div>
					<div class="po-review-items">
						{#each poForm.items as item, index (index)}
							<div class="po-review-item">{getVariantLabel(item.variantId)} × {item.quantity}</div>
						{/each}
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={doSubmitPO} loading={poSubmitting} disabled={poSubmitting}>
					{pageContents.poModal.reviewConfirm[lang]}
				</Button>
				<Button color="default" variant="ghost" disabled={poSubmitting} onClick={() => { poReviewDisplay = false; }}>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── B49 (chain B): Quick-create (supplier / branch / variant) ── -->
{#if quickCreateKind}
	<Modal bind:display={quickCreateDisplay} size="sm" isDimissable onCloseAttempt={() => { if (!quickCreateBusy) closeQuickCreate(); }} class="supplier-modal-root">
		<Modal.Container>
			<Modal.Container.Header actionButtons={{ close: { display: !isMobile } }}>
				<div class="supplier-modal-title" bind:this={qcCrumbNavEl}>
			{#if qcCrumbOverflow > 0}
				<button
					type="button"
					class="supplier-modal-title__more"
					aria-label={pageContents.supplierModal.crumbMore[lang as 'vi' | 'en']}
					aria-expanded={qcCrumbMoreOpen}
					tabindex={qcCrumbOverflow > 0 ? 0 : -1}
					aria-hidden={qcCrumbOverflow > 0 ? undefined : 'true'}
					style={qcCrumbOverflow > 0 ? undefined : 'visibility:hidden;pointer-events:none;'}
					onclick={() => (qcCrumbMoreOpen = !qcCrumbMoreOpen)}
				>
					<svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
				</button>
				{#if qcCrumbMoreOpen}
					<div class="supplier-crumb-popover" role="menu">
						<button
							type="button"
							class="supplier-crumb-popover__item"
							role="menuitem"
							onclick={() => {
								qcCrumbMoreOpen = false;
								closeQuickCreate();
							}}
						>{pageContents.poModal.rootCrumb[lang]}</button>
						<button
							type="button"
							class="supplier-crumb-popover__item"
							role="menuitem"
							onclick={() => {
								qcCrumbMoreOpen = false;
								closeQuickCreate();
							}}
						>{pageContents.poModal.title[lang]}</button>
					</div>
				{/if}
			{/if}
			{#if qcCrumbOverflow < 1}
					<button
						type="button"
						class="supplier-modal-title__label supplier-modal-title__crumb"
						disabled={quickCreateBusy}
						onclick={() => {
							closeQuickCreate();
						}}
					>
						{pageContents.poModal.rootCrumb[lang]}
					</button>
			{/if}
			{#if qcCrumbOverflow < 2}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
				<button type="button" class="supplier-modal-title__name supplier-modal-title__crumb" disabled={quickCreateBusy} onclick={() => { closeQuickCreate(); }}>{pageContents.poModal.title[lang]}</button>
			{/if}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name supplier-modal-title__name--active">
						{quickCreateKind === 'supplier' ? pageContents.poModal.quickCreateSupplier[lang] : quickCreateKind === 'branch' ? pageContents.poModal.quickCreateBranch[lang] : pageContents.poModal.quickCreateVariant[lang]}
					</span>
				</div>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if quickCreateError}
					<div class="form-error-banner" role="alert">{quickCreateError}</div>
				{/if}
				{#if quickCreateKind === 'supplier'}
					<div class="form-field">
						<span class="form-label">{pageContents.poModal.quickCreateName[lang]} *</span>
						<input class="admin-input" type="text" bind:value={quickCreateName} disabled={quickCreateBusy} data-test="quick-create-name" />
					</div>
					<div class="form-field">
						<span class="form-label">{pageContents.poModal.quickCreatePhone[lang]}</span>
						<PhoneInput bind:value={quickCreatePhone} disabled={quickCreateBusy} />
					</div>
					<div class="form-field">
						<span class="form-label">{pageContents.poModal.quickCreateEmail[lang]}</span>
						<EmailInput bind:value={quickCreateEmail} disabled={quickCreateBusy} />
					</div>
				{:else if quickCreateKind === 'branch'}
					<div class="form-field">
						<span class="form-label">{pageContents.poModal.quickCreateName[lang]} *</span>
						<input class="admin-input" type="text" bind:value={quickCreateName} disabled={quickCreateBusy} data-test="quick-create-name" />
					</div>
				{:else}
					<div class="form-field">
						<span class="form-label">{pageContents.poModal.quickCreateProduct[lang]} *</span>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={quickCreateProductId}
							options={quickCreateProductOptions}
							searchable
							placeholder={pageContents.poModal.quickCreateProductPlaceholder[lang]}
							disabled={quickCreateBusy}
						/>
					</div>
					<div class="form-field">
						<span class="form-label">{pageContents.poModal.quickCreateSku[lang]} *</span>
						<input class="admin-input" type="text" bind:value={quickCreateSku} disabled={quickCreateBusy} />
					</div>
					<div class="form-field">
						<span class="form-label">{pageContents.poModal.quickCreateDisplayName[lang]} *</span>
						<input class="admin-input" type="text" bind:value={quickCreateDisplayName} disabled={quickCreateBusy} />
					</div>
					<div class="form-field">
						<span class="form-label">{pageContents.poModal.quickCreatePrice[lang]}</span>
						<input class="admin-input" type="number" min="0" step="any" bind:value={quickCreatePrice} disabled={quickCreateBusy} />
					</div>
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create = success -->
				<Button
					color="success"
					onClick={submitQuickCreate}
					loading={quickCreateBusy}
					disabled={quickCreateBusy || (quickCreateKind === 'variant'
						? (!quickCreateProductId || !quickCreateSku.trim() || !quickCreateDisplayName.trim())
						: !quickCreateName.trim())}
				>
					{pageContents.poModal.quickCreate[lang]}
				</Button>
				<Button color="default" variant="ghost" disabled={quickCreateBusy} onClick={() => { closeQuickCreate(); }}>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── B49 (chain B): Variant detail read-only ── -->
{#if variantDetailDisplay}
	<Modal bind:display={variantDetailDisplay} size="sm" isDimissable class="supplier-modal-root">
		<Modal.Container>
			<Modal.Container.Header actionButtons={{ close: { display: !isMobile } }}>
				<div class="supplier-modal-title" bind:this={vdCrumbNavEl}>
			{#if vdCrumbOverflow > 0}
				<button
					type="button"
					class="supplier-modal-title__more"
					aria-label={pageContents.supplierModal.crumbMore[lang as 'vi' | 'en']}
					aria-expanded={vdCrumbMoreOpen}
					tabindex={vdCrumbOverflow > 0 ? 0 : -1}
					aria-hidden={vdCrumbOverflow > 0 ? undefined : 'true'}
					style={vdCrumbOverflow > 0 ? undefined : 'visibility:hidden;pointer-events:none;'}
					onclick={() => (vdCrumbMoreOpen = !vdCrumbMoreOpen)}
				>
					<svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
				</button>
				{#if vdCrumbMoreOpen}
					<div class="supplier-crumb-popover" role="menu">
						<button
							type="button"
							class="supplier-crumb-popover__item"
							role="menuitem"
							onclick={() => {
								vdCrumbMoreOpen = false;
								variantDetailDisplay = false;
							}}
						>{pageContents.poModal.rootCrumb[lang]}</button>
						<button
							type="button"
							class="supplier-crumb-popover__item"
							role="menuitem"
							onclick={() => {
								vdCrumbMoreOpen = false;
								variantDetailDisplay = false;
							}}
						>{pageContents.poModal.title[lang]}</button>
					</div>
				{/if}
			{/if}
			{#if vdCrumbOverflow < 1}
					<button
						type="button"
						class="supplier-modal-title__label supplier-modal-title__crumb"
						onclick={() => {
							variantDetailDisplay = false;
						}}
					>
						{pageContents.poModal.rootCrumb[lang]}
					</button>
			{/if}
			{#if vdCrumbOverflow < 2}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
				<button type="button" class="supplier-modal-title__name supplier-modal-title__crumb" onclick={() => { variantDetailDisplay = false; }}>{pageContents.poModal.title[lang]}</button>
			{/if}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name supplier-modal-title__name--active">{pageContents.poModal.itemVariant[lang]}</span>
				</div>
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if variantDetail}
					{#if variantDetailEditing}
						<!-- B52 (m25115): update variant từ detail modal -->
						<div class="po-review">
							<div class="po-review-row"><span>{pageContents.poModal.quickCreateSku[lang]}</span><strong>{variantDetail.sku ?? '—'}</strong></div>
							<div class="form-field" data-field="variant-detail-name">
								<span class="form-label">{pageContents.poModal.quickCreateDisplayName[lang]}</span>
								<input class="admin-input" type="text" bind:value={variantDetailDisplayName} disabled={variantDetailBusy} maxlength="200" />
							</div>
							<div class="form-field" data-field="variant-detail-price">
								<span class="form-label">{pageContents.poModal.variantDetailPriceLabel[lang]}</span>
								<input class="admin-input" type="number" min="0" step="any" bind:value={variantDetailPrice} disabled={variantDetailBusy} />
							</div>
							{#if variantDetailError}<p class="form-hint form-hint--error">{variantDetailError}</p>{/if}
						</div>
					{:else}
						<div class="po-review">
							<div class="po-review-row"><span>{pageContents.poModal.quickCreateSku[lang]}</span><strong>{variantDetail.sku ?? '—'}</strong></div>
							<div class="po-review-row"><span>{pageContents.poModal.quickCreateDisplayName[lang]}</span><strong>{variantDetail.displayName ?? '—'}</strong></div>
						</div>
					{/if}
				{/if}
			</Modal.Container.Body>
			<Modal.Container.Footer>
				{#if variantDetailEditing}
					<Button color="success" onClick={saveVariantDetail} loading={variantDetailBusy} disabled={variantDetailBusy} data-test="variant-detail-save">
						{pageContents.poModal.variantDetailSave[lang]}
					</Button>
					<Button variant="ghost" onClick={() => { variantDetailEditing = false; }} disabled={variantDetailBusy}>
						{pageContents.poModal.variantDetailCancel[lang]}
					</Button>
				{:else}
					<Button variant="outline" onClick={openVariantDetailEditor} data-test="variant-detail-edit">
						{pageContents.poModal.variantDetailEdit[lang]}
					</Button>
				{/if}
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── B49 (chain B): Share ảnh PO sau khi tạo thành công ── -->
{#if poShareDisplay && poShareData}
	<Modal bind:display={poShareDisplay} size="sm" isDimissable class="supplier-modal-root">
		<Modal.Container>
			<Modal.Container.Header actionButtons={{ close: { display: true } }}>
				<div class="supplier-modal-title" bind:this={shCrumbNavEl}>
			{#if shCrumbOverflow > 0}
				<button
					type="button"
					class="supplier-modal-title__more"
					aria-label={pageContents.supplierModal.crumbMore[lang as 'vi' | 'en']}
					aria-expanded={shCrumbMoreOpen}
					tabindex={shCrumbOverflow > 0 ? 0 : -1}
					aria-hidden={shCrumbOverflow > 0 ? undefined : 'true'}
					style={shCrumbOverflow > 0 ? undefined : 'visibility:hidden;pointer-events:none;'}
					onclick={() => (shCrumbMoreOpen = !shCrumbMoreOpen)}
				>
					<svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
				</button>
				{#if shCrumbMoreOpen}
					<div class="supplier-crumb-popover" role="menu">
						<button
							type="button"
							class="supplier-crumb-popover__item"
							role="menuitem"
							onclick={() => {
								shCrumbMoreOpen = false;
								poShareDisplay = false;
							}}
						>{pageContents.poModal.rootCrumb[lang]}</button>
					</div>
				{/if}
			{/if}
			{#if shCrumbOverflow < 1}
					<button
						type="button"
						class="supplier-modal-title__label supplier-modal-title__crumb"
						onclick={() => {
							poShareDisplay = false;
						}}
					>
						{pageContents.poModal.rootCrumb[lang]}
					</button>
			{/if}
			{#if shCrumbOverflow < 2}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name">{poShareData.poCode}</span>
			{/if}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name supplier-modal-title__name--active">{pageContents.poModal.shareTitle[lang]}</span>
				</div>
			</Modal.Container.Header>
			<Modal.Container.Body>
				<!-- html2canvas chỉ render màu hex/rgb an toàn → inline style, không oklch -->
				<div id="po-share-canvas" class="po-share-canvas">
					<div class="po-share-brand">{pageContents.poModal.shareAppTitle[lang]}</div>
					<div class="po-share-code">{poShareData.poCode}</div>
					<div class="po-share-row"><span>{pageContents.poModal.shareSupplier[lang]}</span><strong>{poShareData.supplierLabel}</strong></div>
					<div class="po-share-row"><span>{pageContents.poModal.shareBranch[lang]}</span><strong>{poShareData.branchLabel}</strong></div>
					<div class="po-share-row"><span>{pageContents.poModal.shareDate[lang]}</span><strong>{poShareData.expectedAt ? formatDate(poShareData.expectedAt) : '—'}</strong></div>
					<div class="po-share-row po-share-total"><span>{pageContents.poModal.totalCost[lang]}</span><strong>{formatPoMoney(poShareData.totalCost)}</strong></div>
						<table class="po-share-table">
						<thead><tr><th>{pageContents.poModal.shareItem[lang]}</th><th>{pageContents.poModal.shareQty[lang]}</th></tr></thead>
						<tbody>
							{#each poShareData.items as it, shareIndex (shareIndex)}
								<tr><td>{it.label}</td><td>{it.quantity}</td></tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- share = primary -->
				<Button color="primary" onClick={() => sharePoImage(false)} loading={poShareBusy} disabled={poShareBusy}>
					{pageContents.poModal.share[lang]}
				</Button>
				<Button color="default" variant="outline" disabled={poShareBusy} onClick={() => sharePoImage(true)}>
					{pageContents.poModal.shareDownload[lang]}
				</Button>
				<Button color="default" variant="ghost" disabled={poShareBusy} onClick={() => { poShareDisplay = false; }}>
					{pageContents.poModal.shareClose[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal cập nhật trạng thái PO ── -->
{#if statusModalDisplay}
	<Modal bind:display={statusModalDisplay} size="sm" isDimissable class="supplier-modal-root">
		<Modal.Container>
			<!-- B47 (m19661): ẨN nút ✕ header trên mobile (đồng bộ suppliers form) -->
			<Modal.Container.Header actionButtons={{ close: { display: !isMobile } }}>
				<!-- B46 (m18161): breadcrumb 3 nấc [Suppliers › PO code › Update status].
				     Tap nấc Suppliers đóng modal về datatable; nấc PO code đóng status modal
				     về datatable (PO list không có modal chi tiết riêng). -->
				<div class="supplier-modal-title" bind:this={stCrumbNavEl}>
				{#if stCrumbOverflow > 0}
					<button
						type="button"
						class="supplier-modal-title__more"
						aria-label={pageContents.supplierModal.crumbMore[lang as 'vi' | 'en']}
						aria-expanded={stCrumbMoreOpen}
						tabindex={stCrumbOverflow > 0 ? 0 : -1}
						aria-hidden={stCrumbOverflow > 0 ? undefined : 'true'}
						style={stCrumbOverflow > 0 ? undefined : 'visibility:hidden;pointer-events:none;'}
						onclick={() => (stCrumbMoreOpen = !stCrumbMoreOpen)}
					>
						<svg width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.75"/><circle cx="12" cy="12" r="1.75"/><circle cx="19" cy="12" r="1.75"/></svg>
					</button>
					{#if stCrumbMoreOpen}
						<div class="supplier-crumb-popover" role="menu">
							<button
								type="button"
								class="supplier-crumb-popover__item"
								role="menuitem"
								onclick={() => {
									stCrumbMoreOpen = false;
									statusModalDisplay = false;
								}}
							>{pageContents.poModal.rootCrumb[lang]}</button>
						</div>
					{/if}
				{/if}
				{#if stCrumbOverflow < 1}
					<button
						type="button"
						class="supplier-modal-title__label supplier-modal-title__crumb"
						disabled={statusBusy}
						onclick={() => (statusModalDisplay = false)}
					>
						{pageContents.poModal.rootCrumb[lang]}
					</button>
				{/if}
				{#if stCrumbOverflow < 2}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name">{statusRow?.poCode ?? '—'}</span>
				{/if}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name supplier-modal-title__name--active">{pageContents.statusModal.title[lang]}</span>
				</div>
			</Modal.Container.Header>
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
				{#if statusRow && (statusRow.status === 'draft' || statusRow.status === 'cancelled')}
					<!-- B47 (m19661): xoá PO (chỉ draft/cancelled — server bulk chặn
					     received/ordered). Confirm qua AlertDialog riêng. -->
					<Button color="error" variant="outline" disabled={statusBusy} onClick={() => { poDeleteConfirmDisplay = true; }} data-test="po-delete-btn">
						{pageContents.statusModal.delete[lang]}
					</Button>
				{/if}
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

<!-- B47 (m19661): confirm xoá 1 PO từ status modal -->
{#if poDeleteConfirmDisplay}
	<AlertDialog bind:open={poDeleteConfirmDisplay} title={pageContents.statusModal.deleteTitle[lang]} description={pageContents.statusModal.deleteDesc[lang]}>
		<AlertDialog.Content>
			<AlertDialog.Header variant="danger">
				<AlertDialog.Title>{pageContents.statusModal.deleteTitle[lang]}</AlertDialog.Title>
				<AlertDialog.Description>{pageContents.statusModal.deleteDesc[lang]}</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>{pageContents.poBulk.cancel[lang]}</AlertDialog.Cancel>
				<AlertDialog.Action
					color="danger"
					disabled={poDeleteBusy}
					data-test="po-delete-confirm"
					onselect={() => {
						void deletePOFromStatus();
					}}
				>
					{pageContents.statusModal.delete[lang]}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog>
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

		// Scroll → co page padding BLOCK + gap tăng không gian row (yêu cầu 1 sticky
		// tab-strip: dừng cuộn trả lại — transition tự đảo). Batch7: GIỮ padding
		// inline (ngang) — chỉ co block (dọc).
		// Batch8: co theo HÀNH ĐỘNG cuộn (is-scrolling = đang cuộn, dừng 200ms trả
		// lại) — is-scrolled giữ lại cho trạng thái vị trí (top > 8px).
		// Batch 11 (yêu cầu 2): CHỈ mobile — PC giữ padding tĩnh.
		@media (max-width: 767px) {
			&.is-scrolled,
			&.is-scrolling {
				gap: 0.375rem;
				padding-block: 0.5rem;
			}
		}
	}

	/* Cuộn tới đáy: bỏ padding block page + pagination để tối đa không gian row.
	   Rời đáy (scroll to top) → media 767 trả lại padding như ban đầu. */
	.admin-page--fullheight.at-bottom {
		@media (max-width: 767px) {
			padding-block: 0;
		}
	}

	/* B42.2 (m15631): kính mờ cần row CUỘN qua sau thanh — wrap clip tại mép
	   dưới tab khiến card không bao giờ đi vào vùng header/tab → blur vùng
	   trống nhìn như nền đặc. Kéo wrap lên phủ sau header+tab, padding bù
	   giữ nội dung đầu tại chỗ; nền wrap trong suốt (row nền riêng) để kính
	   nhìn xuyên. Caption/th sticky đẩy xuống đáy tab (top cũ = đỉnh wrap
	   mới = sau header, bị header z-500 che mất). Tab height 2.4375rem đo
	   mobile 390px; --admin-tab-top layout đo live (tự co theo header). */
	@media (max-width: 767px) {
		.admin-page--fullheight .admin-table-wrap {
			border: 0;
			margin-top: calc(-1 * (var(--admin-tab-top, 0px) + 0.75rem + 2.4375rem + 0.75rem));
			padding-top: calc(var(--admin-tab-top, 0px) + 0.75rem + 2.4375rem + 0.75rem);
			background: transparent;
		}
		/* Caption/th sticky trong wrap (scrollport đỉnh = y 0 viewport) — ghim
		   NGAY DƯỚI tab (tab đáy = tab-top + tab height khi đã ghim).
		   Specificity (0,4,0) thắng rule mobile (0,3,0) của DataTable —
		   :global top-level (0,1,0) THUA rule đó, caption/th ghim y=0 sau kính. */
		.admin-page--fullheight :global(.datatable-root.datatable-sticky-head .datatable-caption) {
			top: calc(var(--admin-tab-top, 0px) + 2.4375rem);
		}
		.admin-page--fullheight :global(.datatable-root.datatable-sticky-head .datatable-th) {
			top: calc(var(--admin-tab-top, 0px) + 2.4375rem + var(--datatable-caption-h, 1.75rem));
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
		/* Layout cuộn ở root (Safari <15.4 không dvh → fullheight chết): header
		   breadcrumb sticky top:0 z-500 ĐÈ tab-strip sticky top:0 z-20 khi cả hai
		   cùng ghim → tab cần top = chiều cao header. KHÔNG dùng --admin-header-h:
		   page zero-hoá var này cho DataTable sticky (khối .admin-page--fullheight
		   ở trên) → tab-strip kế thừa 0px. Layout set --admin-tab-top (không bị
		   page shadow). */
		top: var(--admin-tab-top, 0px);
		z-index: 20;
		// Batch40 (m14876): co về 0 khi đang cuộn — datatable giãn chiếm vùng tab ẩn.
		max-height: 5rem;
		transition: box-shadow 200ms ease, opacity 150ms ease, max-height 200ms ease,
			background 200ms ease;
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
		transition: padding 200ms ease, font-size 200ms ease, opacity 150ms ease;

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
	// Batch9 (user m05696): ĐANG cuộn → ẨN tab-strip (tăng rows hiển thị),
	// dừng 200ms → trả lại. is-scrolled giữ cho trạng thái vị trí.
	// Batch9b (m06345): display:none co flow → khi trả lại ở đáy, nội dung bị
	// đẩy xuống (row cuối che vĩnh viễn — max-scroll đổi giữa chừng). Đổi
	// OPACITY: tab-strip giữ chỗ trong flow, chỉ mờ đi → max-scroll ổn định.
	/* B42 (m15333) → B42.3 (m16282): thay cơ chế ẩn-khi-cuộn B40 bằng TRONG
	   SUỐT thuần khi cuộn — giữ nguyên vị trí + chiều cao, không nền không blur,
	   row datatable lộ trực tiếp phía sau. Dừng cuộn → class gỡ, nền đặc trở
	   lại (transition background 200ms trong .tab-strip). */
	.tab-strip.is-scrolling {
		background: transparent;
		/* B42.5 (divider): đường kẻ dưới tab cũng phải trong suốt khi cuộn —
		   border 1px đặc là "divider X" còn sót user báo. Dừng cuộn → trả lại. */
		border-bottom-color: transparent;
	}

	/* B42.4 (m16450): ẩn text tab khi cuộn (opacity 0, 150ms) — nền giữ
	   transparent B42.3; dừng cuộn → text trở lại. */
	.tab-strip.is-scrolling .tab-item {
		opacity: 0;
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
	   co caption đã làm ở DataTable; ở đây thu nhỏ tools (search/select/btn).
	   Batch 11 (yêu cầu 2): CHỈ mobile — PC caption giữ kích thước tĩnh. */
	@media (max-width: 767px) {
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
	}

	/* Batch8 mục 2: mobile đang cuộn → ẨN row tools (search/filter/create) bằng
	   display:none — Input vẫn mounted (không emit undefined qua bind:value).
	   Class tách khỏi caption-collapsed (vị trí) — chỉ khi ĐANG cuộn (hành động).
	   Bulk-bar + mobile-filter-popover mở vẫn hiện (user đang thao tác). */
	:global(.datatable-root.tools-hidden-mobile) {
		@media (max-width: 767px) {
			:global(.datatable-caption-tools .admin-search:not(:has(.mobile-filter-popover))),
			:global(.datatable-caption-tools .admin-actions-group:not(:has(.mobile-filter-popover))) {
				/* Batch9b (m06345): opacity thay display — giữ flow height ổn định
				   (display:none co flow → trả lại ở đáy xô nội dung che row cuối). */
				opacity: 0;
				pointer-events: none;
				transition: opacity 150ms ease;
			}
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

	/* B50: bỏ flex: 1 1 12rem — flex-basis dọc làm select-root cao 192px (khoảng trống giữa qty và unit) */

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
		/* Batch8: tắt scroll anchoring — anchor tự điều chỉnh scrollTop khi
		   scroll-active co/giãn padding + ẩn/hiện tools (đổi layout) → bắn scroll
		   event → markScrollActive lại → LOOP co/giãn vĩnh viễn (top dao động
		   27↔63). DataTable không có ảnh lazy → mất anchor vô hại. */
		overflow-anchor: none;
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

	/* ── Pagination: Batch9 ĐANG cuộn → ẨN hẳn (tăng rows hiển thị), dừng
	   200ms → trả lại. pop-anim giữ (chạm đáy flash 1 lần khi hiện lại). ── */
	.admin-pagination {
		transition: opacity 150ms ease;
	}

	.pagination-collapsed.admin-pagination {
		opacity: 0;
		pointer-events: none;
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

	/* ── History timeline (kiểu git log: rail dọc + dot + card diff) ── */
	.history-state {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--color-text-muted, var(--muted, #6b7280));
		font-size: 0.9rem;
	}
	.history-timeline {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	// Footer form modal: History trái — spacer đẩy Save/Cancel sang phải
	// (footer là flex justify-end; spacer flex:1 chiếm khoảng giữa).
	// Class thật của footer element là .modal-footer-root (Footer/Main.svelte).
	:global(.modal-footer-root .supplier-footer-spacer) {
		flex: 1;
	}

	.history-entry {
		display: flex;
		gap: 0.75rem;
	}
	/* rail: cột 12px chứa dot + đoạn line nối xuống entry sau (nốt cuối không line) */
	.history-entry__rail {
		flex: 0 0 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 0.45rem;
	}
	.history-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--color-sky-500, #0ea5e9);
		flex: 0 0 auto;
	}
	.history-dot--restore {
		background: var(--success, #22c55e);
	}
	.history-entry:not(:last-child) .history-entry__rail::after {
		content: '';
		flex: 1;
		width: 1px;
		background: var(--border, hsl(240 5.9% 90%));
		margin-top: 4px;
	}
	.history-entry__card {
		flex: 1;
		min-width: 0;
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: 0.625rem;
		padding: 0.65rem 0.85rem;
		margin-bottom: 0.75rem;
		background: var(--surface, transparent);
	}
	.history-entry--restore .history-entry__card {
		border-color: var(--success-soft, hsl(143, 85%, 96%));
	}
	/* Batch 16 (m13579-11): 2 row — head (badge+time) + actor ("by" + tên).
	   Actor dài → ellipsis, không dãn card / scrollbar. */
	.history-entry__head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		margin-bottom: 0.25rem;
	}
	.history-entry__actor {
		min-width: 0;
		margin-bottom: 0.5rem;
	}
	.history-time {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8rem;
		color: var(--color-text-muted, var(--muted, #6b7280));
	}
	.history-actor {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8rem;
		color: var(--color-text-muted, var(--muted, #6b7280));
	}
	.history-nochanges {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-muted, var(--muted, #6b7280));
	}
	.history-changes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.history-change {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
		line-height: 1.45;
	}
	.history-change__field {
		flex: 0 0 auto;
		min-width: 7.5rem;
		font-weight: 600;
		color: var(--color-text, var(--foreground));
	}
	.history-change__before {
		color: var(--error);
		text-decoration-color: hsl(0 84% 65% / 0.6);
		word-break: break-word;
	}
	.history-change__after {
		color: var(--success, #16a34a);
		text-decoration: none;
		word-break: break-word;
	}
	.history-entry__actions {
		margin-top: 0.5rem;
		display: flex;
		justify-content: flex-end;
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

	/* Batch10 (m06635-3): setting modal — các field xếp dọc */
	.setting-form {
		display: flex;
		flex-direction: column;
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

		& > :global(.input-root),
		& > .field-icon-wrap {
			flex: 1;
			min-width: 0;
		}
	}

	/* ── Batch 16: icon trong input (pattern .auth-input-wrapper login —
	   icon absolute trái, input padding-left đền. Icon ĐỨNG SAU Input trong
	   DOM → sibling `~` sync màu khi .input-root.color-error (không :has(),
	   Safari 15 target). ── */
	.field-icon-wrap {
		position: relative;
		display: flex;
		align-items: center;
		min-width: 0;
		flex: 1;

		:global(.input-root) {
			flex: 1;
			min-width: 0;
		}

		:global(.field-icon) {
			position: absolute;
			left: 0.875rem;
			top: 50%;
			transform: translateY(-50%);
			font-size: 1.125rem;
			color: var(--foreground-400);
			pointer-events: none;
			z-index: 2;
			transition: color 0.2s;
		}

		:global(.input-root.color-error) ~ :global(.field-icon) {
			color: var(--error) !important;
		}

		:global(.input-root.color-success) ~ :global(.field-icon) {
			color: var(--success) !important;
		}

		:global(.input-root) :global(.input-highlight-wrapper) {
			padding-left: 2.5rem !important;
		}

		/* ── Batch 22 (m00193-2): passive field deep-action — icon bọc <a>
		   class .field-icon--action: item hợp lệ → màu primary + cursor pointer
		   + hit-area đủ touch 2.25rem; giữ absolute trái đúng chỗ icon tĩnh. ── */
		:global(a.field-icon--action) {
			position: absolute;
			left: 0.875rem;
			top: 50%;
			transform: translateY(-50%);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			font-size: 1.125rem;
			color: var(--primary);
			cursor: pointer;
			z-index: 3;
			transition: color 0.2s;
			/* BẮT BUỘC: .field-icon (icon tĩnh) có pointer-events:none — anchor
			   mang CẢ 2 class nên thừa hưởng, click xuyên qua dù z-index 3.
			   Không reset → Playwright click TimeoutError, hit test rơi vào
			   .input-highlight-wrapper. */
			pointer-events: auto;

			/* Hit-area cảm ứng: icon chỉ 16px (Audit m00440 chuẩn 44px).
			   inset -0.75rem → vùng bấm ~40px, dừng trước text input
			   (wrapper padding-left 2.5rem = 40px) để không cướp focus. */
			&::after {
				content: '';
				position: absolute;
				inset: -0.75rem;
				border-radius: 9999px;
			}

			@media (hover: hover) and (pointer: fine) {
				&:hover {
					color: var(--primary-600, var(--primary));
				}
			}
		}
	}

	/* Batch 24 mục 1: passive-hit overlay đè lên field bị khoá (input disabled không phát click) */
	.field-passive-hit { position: absolute; inset: 0; z-index: 4; background: transparent; border: 0; padding: 0; touch-action: manipulation; cursor: pointer; }
	.address-passive-wrap { position: relative; }

	/* Line vertical trục x giữa (batch6): cột dọc nối các item qua tâm,
	   đặt ::before bên trái mỗi row trừ row đầu — nằm giữa gap 2 item. */
	.form-items-block > .field-row + .field-row::before {
		content: '';
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: calc(-0.55rem - 1px);
		height: calc(0.55rem + 2px);
		width: 1px;
		background: var(--default-300);
	}

	/* Badge STT đè viền trên góc trái — variant=solid nền ĐỤC (batch6: hết
	   "khuyết bg trái" do badge soft bán trong suốt lộ viền input xuyên qua). */
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

		/* Audit m00440: touch 18px quá nhỏ trên cảm ứng (chuẩn 44px). Desktop
		   pointer fine giữ 18px (mật độ form); coarse pointer mở hit-area.
		   width/height đủ 28px nhìn thấy + pseudo ::after phủ 44px quanh tâm —
		   không phá layout absolute giữa field-row (transform giữ nguyên). */
		@media (pointer: coarse) {
			width: 1.75rem;
			height: 1.75rem;
			font-size: 0.75rem;

			&::after {
				content: '';
				position: absolute;
				inset: -0.5rem;
			}
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
		/* min-width:0 — grid item mặc định min-width:auto: tên file ImageUpload dài
		   đẩy min-content cột grid phình, ellipsis trong component không bao giờ
		   kích hoạt (batch 16 fix ellipsis tên file). */
		min-width: 0;
		padding: 0.75rem;
		border: 1px dashed var(--default-300);
		border-radius: 0.75rem;
		/* position:relative đặt TRỰC TIẾP (không qua :has() — Safari ≤15.3 bỏ
		   rule có :has() → label mất điểm neo absolute, trôi khỏi viền). */
		position: relative;
	}

	/* Label block NGỰA TRÊN BORDER LINE (batch6): label absolute dịch -50% lên
	   giữa viền, nền background che đoạn border phía sau. */
	.form-items-block,
	.social-group {
		position: relative;
	}

	.items-block__label {
		position: absolute;
		top: 0;
		left: 0.75rem;
		transform: translateY(-50%);
		padding-inline: 0.375rem;
		background: var(--background, #fff);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--foreground);
		white-space: nowrap;
	}

	.po-item {
		position: relative;
		display: grid;
		/* B50 (m21047): 6 cột — variant / qty / unit / cost / lot / date (remove → ✕ góc phải trên) */
		grid-template-columns: minmax(10rem, 2fr) 5rem minmax(6rem, 1fr) minmax(7rem, 1fr) minmax(6rem, 1fr) minmax(8rem, 1fr);
		gap: 0.5rem;
		align-items: start;
		/* B50: group item nổi bật — nền nhạt + viền, chứa badge STT / ✕ góc */
		background: var(--muted, #f3f4f6);
		border: 1px solid var(--default-300, #e5e7eb);
		border-radius: 0.75rem;
		padding: 1.25rem 0.75rem 0.75rem;


		&.po-item--dup {
			/* B49 (chain B): dòng trùng variant — viền error */
			outline: 1px solid #dc2626;
			outline-offset: 4px;
			border-radius: 0.5rem;
		}

		@media (max-width: 860px) {
			/* B47 (m19661): minmax(0,1fr) — 1fr không co dưới min-content của input làm hàng Items tràn 390px mobile */
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
	}

	/* B53 (m26523): input date expectedAt khớp chiều cao Input component (min-height chuẩn size-md) */
	:global(.supplier-modal-root [data-field='po-expected'] .admin-input) { min-height: 2.875rem; }

	/* B49 (chain B): bọc label nhỏ trên mỗi field trong hàng item */
	.po-item-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;

		/* B50 (m21047): xoá &.po-item-field--remove — field remove đã thay bằng ✕ badge góc */
	}

	.po-item-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted-foreground);
		line-height: 1.2;
	}

	/* B50 (m21047): badge STT góc trái trên + nút ✕ góc phải trên (mẫu .field-row-stt / .field-row-remove) */
	/* Badge render hash riêng → class qua props.class phải :global (B46 pattern) */
	.po-item :global(.po-item-stt) {
		position: absolute;
		top: -0.5rem;
		left: 0.75rem;
		z-index: 1;
	}

	.po-item-remove {
		position: absolute;
		top: -0.5rem;
		right: 0.5rem;
		z-index: 1;
		min-width: 1.75rem;
		min-height: 1.75rem;
		border: 0;
		border-radius: 0.375rem;
		background: transparent;
		color: var(--muted-foreground);
		font-size: 0.875rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover {
			background: var(--error, #dc2626);
			color: #fff;
		}
	}

	/* B49 (chain B): review trước submit */
	.po-review {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.po-review-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.9rem;
		color: var(--muted-foreground);

		strong {
			color: var(--foreground);
			text-align: right;
		}
	}

	.po-review-items {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		border-top: 1px solid var(--border);
		padding-top: 0.5rem;
		margin-top: 0.25rem;
	}

	.po-review-item {
		font-size: 0.85rem;
		color: var(--foreground);
	}

	/* B49 (chain B): share canvas — CHỈ màu hex an toàn (html2canvas không đọc oklch) */
	.po-share-canvas {
		background-color: #ffffff;
		color: #111111;
		padding: 1rem;
		border-radius: 0.5rem;
		font-family: system-ui, sans-serif;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.po-share-brand {
		font-size: 0.7rem;
		letter-spacing: 0.2em;
		font-weight: 700;
		color: #666666;
		text-align: center;
	}

	.po-share-code {
		font-size: 1.2rem;
		font-weight: 700;
		text-align: center;
		color: #111111;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #111111;
	}

	.po-share-row {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.85rem;
		color: #555555;

		strong {
			color: #111111;
			text-align: right;
		}
	}

	.po-share-table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 0.25rem;
		font-size: 0.8rem;

		th,
		td {
			border: 1px solid #dddddd;
			padding: 0.3rem 0.5rem;
			text-align: left;
			color: #111111;
		}

		th {
			background-color: #f3f4f6;
			font-weight: 700;
		}

		td:last-child,
		th:last-child {
			text-align: right;
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

	/* B31 (m06998-2): mobile nút create (Button size-sm 2.75rem) KHÔNG bằng
	   nút icon search/setting (2.25rem) trong cùng group → thu Button về 2.25rem
	   CHỈ mobile; khi cuộn caption-collapsed co 1.75rem giữ nguyên. */
	@media (max-width: 767px) {
		:global(.datatable-caption-tools .admin-actions-group .button-root) {
			height: 2.25rem;
			min-height: 2.25rem;
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

	@media (max-width: 767px) {
		.bulk-row {
			flex-basis: 100%;
		}
	}

	.bulk-count {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
	}

	/* B52 (m25115): bulk-bar nổi khi có selection — không phải cuộn lên caption để thao tác.
	   Mobile: fixed đáy viewport (trên pagination z-300). Desktop giữ trong caption tools. */
	@media (max-width: 767px) {
		.bulk-row {
			position: fixed;
			left: 0;
			right: 0;
			bottom: calc(2.75rem + 0.75rem); // trên pagination fixed (B25)
			z-index: 310;
			padding: 0.5rem 0.75rem;
			background: var(--background, #fff);
			border-top: 1px solid var(--default-300);
			padding-right: 4.75rem; // chỗ FAB (giống pagination B25)
		}
  /* B53 (m26523): khi đang cuộn ẩn bulk-bar như các group khác (breadcrumb/tab/pagination) —
     giữ chỗ trong flow để không đảy layout (pattern tab-strip B9b) */
  @media (max-width: 767px) {
    .admin-page.is-scrolling .bulk-row {
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms ease;
    }
    .admin-page .bulk-row {
      transition: opacity 150ms ease;
    }
  }

	}



	.field-row--dup {
		& > :global(.input-root),
		& > :global(.address-input),
		& > .admin-input {
			border-color: var(--error);
		}
	}

	/* Batch10 (m06635-6c): text cảnh báo trùng dưới field-row */
	.field-row-dup-msg {
		position: absolute;
		top: 100%;
		left: 2.75rem;
		font-size: 0.72rem;
		color: var(--error);
		pointer-events: none;
	}

	/* Batch 21: message invalid trong .address-entry — absolute top:100% đè entry
	   kế tiếp (margin-top chỉ 0.55rem) → chuyển static, chảy trong entry. */
	.address-entry .field-row-dup-msg {
		position: static;
		margin-top: -0.15rem;
		padding-left: 0.3rem;
	}

	.form-dup-banner {
		background: color-mix(in oklab, var(--error) 8%, transparent);
		border-left-color: var(--error);
	}

	/* ── Multiple addresses: entry block (badge/remove đè viền trên — mirror .field-row).
	   Batch6: solid border ĐỒNG NHẤT với social-group; line vertical trục x giữa. */
	.address-entry {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.55rem;
		padding: 0.6rem;
		border: 1px solid var(--default-300);
		border-radius: 0.6rem;

		&.field-row--dup {
			border-color: var(--error);
		}
	}

	.social-group > .address-entry + .address-entry::before {
		content: '';
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: calc(-0.55rem - 1px);
		height: calc(0.55rem + 2px);
		width: 1px;
		background: var(--default-300);
	}

	/* Batch14 (m11713-3): badge/remove nằm trong .address-entry__head (flex row
	   cùng Input label) — KHÔNG phải con trực tiếp → selector phải ĐI QUA head,
	   không dùng `>` trực tiếp (trước đây `.address-entry > .field-row-stt`
	   không khớp → badge hiển thị flex thường, KHÁC phone/email). */
	.address-entry > :global(.field-row-stt),
	.address-entry__head > :global(.field-row-stt),
	.address-entry > .field-row-stt,
	.address-entry__head > .field-row-stt {
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

	.address-entry > .field-row-remove,
	.address-entry .address-entry__head > .field-row-remove {
		top: 0;
		right: 0.6rem;
		transform: translate(50%, -50%);
	}

	.address-entry__head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.social-group {
		border-style: solid;
	}

	/* ── Social tags (batch7): chips multi-value — enter tạo, click text edit
	   inline, icon open-tab link, remove; input "Thêm giá trị…" inline cuối ── */
	.social-tag-block {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.social-tag-block__label {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--foreground-600, var(--foreground));
	}
	.social-tags {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.5rem;
		min-height: 2.5rem;
		border: 1px solid var(--default-200);
		border-radius: 0.5rem;
		background: var(--background);
	}
	.social-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		padding-inline: 0.375rem 0.25rem;
		padding-block: 0.125rem;
		border-radius: 0.375rem;
		background: var(--primary-50, var(--default-100));
		color: var(--primary-700, var(--foreground));
		font-size: 0.8rem;
		line-height: 1.2;
		max-width: 100%;
	}
	.social-tag--invalid {
		background: var(--error-50, var(--default-100));
		color: var(--error-600, var(--error));
		text-decoration: line-through;
	}
	.social-tag--invalid .social-tag__text {
		color: inherit;
	}
	.social-tag__text {
		border: none;
		background: transparent;
		padding: 0.125rem 0.25rem;
		font: inherit;
		color: inherit;
		cursor: text;
		overflow-wrap: anywhere;
		text-align: left;
	}
	.social-tag__open,
	.social-tag__remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
		padding: 0;
		flex: none;
		text-decoration: none; /* Batch 15: __open giờ là <a> — bỏ underline */

		/* Audit m00440: 20px khó bấm trên cảm ứng — hit-area 44px qua pseudo
		   (không đổi size hiển thị, chip vẫn gọn). Chỉ coarse pointer. */
		@media (pointer: coarse) {
			position: relative;

			&::after {
				content: '';
				position: absolute;
				inset: -0.625rem;
			}
		}
	}
	/* Batch 11 (5d): remove button theo quy tắc thiết kế chung — màu error.
	   Open-tab giữ màu chip (primary); hover tách riêng 2 nút. */
	.social-tag__open:hover {
		background: rgb(0 0 0 / 0.08);
	}
	.social-tag__remove {
		color: var(--error, #dc2626);
	}
	.social-tag--invalid .social-tag__remove {
		color: inherit;
	}
	.social-tag__remove:hover {
		background: var(--error-50, rgb(0 0 0 / 0.08));
		color: var(--error-600, var(--error, #dc2626));
	}
	.social-tag__edit {
		font: inherit;
		color: inherit;
		background: var(--background);
		border: 1px solid var(--primary);
		border-radius: 0.25rem;
		padding: 0.0625rem 0.25rem;
		min-width: 4rem;
		outline: none;
	}
	.social-tags__input {
		flex: 1;
		min-width: 6rem;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.8rem;
		outline: none;
		padding: 0.125rem;
		color: var(--foreground);
		/* Audit m00440: input thô — placeholder dài ("Zalo number or zalo.me/... link")
		   KHÔNG tự ellipsis ở mọi browser → cắt cụt giữa từ trên mobile.
		   overflow-hidden + ellipsis cho cả value lẫn placeholder. */
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.social-tag-error {
		font-size: 0.75rem;
		color: var(--error);
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
		/* Batch9c (m06530): ẩn theo HÀNH ĐỘNG cuộn giống tab/pagination —
		   scrollY=0 → ẩn (row caption tools đang hiện), đang cuộn → ẩn,
		   dừng 200ms → hiện lại. Batch10: bỏ fab-keep (menu create đã bỏ). */
		transition: opacity 200ms ease;
		&.fab-hidden {
			opacity: 0;
			pointer-events: none;
		}
		/* Batch8: đang cuộn mờ đi (giữ chỗ trong flow — pointer-events chặn tap chìm) */
		&.is-scrolling {
			opacity: 0;
			pointer-events: none;
		}

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

	/* Batch 25 (yêu cầu 2): pagination LUÔN cố định sát đáy viewport mobile —
	   footer tách khỏi flow trang (height table thay đổi theo data khiến
	   pagination di chuyển). Fixed bottom + background để che nội dung cuộn
	   phía sau; FAB bottom đẩy xuống dưới pagination (z-index FAB 400 > 300).
	   CHỈ mobile (max-width: 767px) — desktop giữ footer trong flow. */
	@media (max-width: 767px) {
		.admin-page--fullheight .admin-pagination {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 300;
			padding: 0.5rem 0.75rem 0.75rem;
			padding-right: 4.75rem; /* chừa chỗ FAB phải (giữ rule cũ) */
			background: var(--background);
			border-top: 1px solid var(--default-300);
		}
		/* FAB giữ bottom 7.25rem (116px > pagination 2 hàng ~101px) —
		   hạ 4.25rem sẽ đè lên thanh pagination khi FAB hiện lại giữa trang */
	}

	/* ── Mobile FULL-SIZE modal (batch7 yêu cầu 1): modal form NCC chiếm trọn
	   màn hình — bỏ padding root, container fullwidth + fullheight, nội dung
	   start từ trên (không center dọc), header/footer sticky tự nhiên (flex
	   column: header/footer flex sibling đứng yên, body tự cuộn tới đáy →
	   nút Save/Close luôn với tới được). Áp CHỈ mobile touch — desktop giữ
	   modal giữa màn hình. ── */
	@media (hover: none) and (pointer: coarse), (max-width: 640px) {
		:global(.modal-root.supplier-modal-root) {
			padding: 0;
			align-items: stretch;
		}
		:global(.supplier-modal-root .modal-container-root) {
			/* Full-bleed qua position:fixed + inset:0 — KHÔNG dùng vh/dvh:
			   100vh trên iOS = large viewport (vươn sau toolbar) → footer vẫn
			   chìm; dvh chỉ hỗ trợ từ iOS 15.4. Fixed inset:0 = đúng vùng nhìn
			   thấy trên mọi trình duyệt, kể cả Safari ≤15.3. */
			position: fixed;
			inset: 0;
			width: 100% !important; /* thắng .size-lg (40rem) — scoped CSS load sau page CSS */
			max-width: none;
			max-height: none;
			border-radius: 0;
			margin: 0;
		}
		/* Header modal: co padding → gọn như breadcrumb bar. Batch 16 (m13579-2):
		   title breadcrumb đẩy sang TRÁI (header mặc định justify-end làm title
		   trôi phải khi ẩn nút close trên mobile). */
		:global(.supplier-modal-root .modal-header-root) {
			padding-block: 0.5rem;
			justify-content: flex-start;
		}
		/* Batch 18: title chiếm đủ width header (clientWidth cố định, không theo
		   content) — toggle ẩn item breadcrumb không đổi kích thước container →
		   ResizeObserver không fire lại vô hạn (ping-pong). */
		.supplier-modal-title {
			flex: 1 1 auto;
		}
	}

	/* B32 (m07236): modal analytics full-size mobile — copy batch7 block với
	   class riêng .supplier-analytics-modal-root (giữ block .supplier-modal-root
	   nguyên vẹn; desktop modal vẫn size sm giữa màn hình). */
	@media (hover: none) and (pointer: coarse), (max-width: 640px) {
		:global(.modal-root.supplier-analytics-modal-root),
		:global(.modal-root.supplier-history-modal-root) {
			padding: 0;
			align-items: stretch;
		}
		:global(.supplier-analytics-modal-root .modal-container-root),
		:global(.supplier-history-modal-root .modal-container-root) {
			position: fixed;
			inset: 0;
			width: 100% !important; /* thắng .size-sm/.size-lg — scoped CSS load sau page CSS */
			max-width: none;
			max-height: none;
			border-radius: 0;
			margin: 0;
		}
		:global(.supplier-analytics-modal-root .modal-header-root),
		:global(.supplier-history-modal-root .modal-header-root) {
			padding-block: 0.5rem;
			justify-content: flex-start;
		}
		.supplier-modal-title {
			flex: 1 1 auto;
		}
	}

	/* Batch 11 (5c): title modal đồng bộ tên supplier — label + tên với ellipsis
	   (tên dài không vỡ layout). Back chevron chỉ mobile (thay nút ✕). */
	.supplier-modal-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		/* Batch 18: mốc định vị popover tràn breadcrumb */
		position: relative;
		/* Batch 18 (review P3): tạo stacking context z3 để popover con thắng
		   .field-icon (z2 thăng lên context modal-container-root; header chỉ z1). */
		z-index: 3;
	}

	/* Batch 18: nút more — hiện khi item breadcrumb bị ẩn vào popover (mobile) */
	.supplier-modal-title__more {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		margin-left: -0.25rem;
		border: 0;
		border-radius: 0.5rem;
		background: transparent;
		color: var(--foreground-500);
		cursor: pointer;
		flex-shrink: 0;

		&:hover {
			background: hsl(0 0% 0% / 0.06);
		}

		&:disabled {
			cursor: default;
			opacity: 0.5;
		}
	}

	/* Batch 18: popover item breadcrumb bị ẩn — cấu trúc breadcrumb trục Y */
	.supplier-crumb-popover {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 10rem;
		padding: 0.35rem;
		background: var(--background);
		border: 1px solid var(--default-300);
		border-radius: 0.65rem;
		/* Batch 18 (review P3): token đúng là --box-shadow-lg (variables.scss:570),
		   --shadow-lg không tồn tại — fallback luôn chạy, mất --shadow-color theme. */
		box-shadow: var(--box-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
	}

	.supplier-crumb-popover__item {
		display: block;
		width: 100%;
		padding: 0.45rem 0.6rem;
		text-align: left; /* B35 (m13229): thống nhất căn trái như address popover */
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		/* Batch 18 (review P3): --foreground-500 light = 4.41:1 fail sát AA 4.5
		   (text 16px/500); --foreground-600 = 7.0:1 PASS. */
		color: var(--foreground-600);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background: var(--default-100, var(--default-200));
		}

		&:disabled {
			cursor: default;
		}
	}

	.supplier-modal-title__label {
		flex-shrink: 0;
		font-weight: 600;
	}

	/* Batch 16 (m13579-2): mobile — label thành nút breadcrumb item DEACTIVE
	   (muted) nhưng tap được (quay lại datatable qua attemptClose). Reset
	   style button về dạng text, min-width 0 để label dài co được trong header. */
	.supplier-modal-title__crumb {
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		font-weight: 600;
		color: var(--foreground-500);
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;

		&:disabled {
			cursor: default;
		}
	}

	.supplier-modal-title__name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--foreground-500);
		font-weight: 400;
	}

	/* Batch 16 (m13579-2): name = breadcrumb item ACTIVE (đậm hơn item label). */
	.supplier-modal-title__name--active {
		color: var(--foreground);
		font-weight: 600;
	}

	/* Batch 16 (m13579-10): nút ✕ variant outline ĐỎ (viền + icon red-500/700
	   hiển thị VĨNH VIỄN) trông như đang focus/hold ngay khi mở modal. Loại
	   trừ state kẹt bằng code: tap state theo instance (mỗi lần mở = Button
	   mới), autoFocus=false giữ focus ở trigger, :active chỉ trong lúc nhấn.
	   → root cause là thiết kế outline đỏ. ✕ = đóng (không destructive) →
	   trung tính hoá RIÊNG modal này, không đụng Header dùng chung. */
	:global(.supplier-modal-root .modal-container-root .modal-close-button) {
		--color: var(--foreground-500, hsl(240 3.83% 46.08%)) !important;
		--border-color: transparent !important;

		@media (hover: hover) and (pointer: fine) {
			&:hover {
				--background: var(--default-200, hsl(240 4.9% 89.8%));
				--color: var(--foreground);
			}
		}
	}

	/* Batch 15 (m12278-10): dấu phân tách breadcrumb — không co giãn */
	.supplier-modal-title__name[aria-hidden='true'] {
		flex: none;
		overflow: visible;
	}

	/* Batch 15 (m12278-7): badge trạng thái check name — tách khỏi label,
	   không chiếm layout label (inline-flex nhỏ, self-end căn theo đáy chữ). */
	.supplier-name-check {
		display: inline-flex;
		align-items: center;
		margin-left: 0.375rem;
		padding: 0.0625rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.6875rem;
		line-height: 1.2;
		white-space: nowrap;
		vertical-align: middle;

		/* Batch 16 (m13579-3b): bỏ badge checking (spinner trên Input thay thế
		   qua prop loading) — chỉ còn modifier --taken. */
		&--taken {
			color: hsl(0 0% 100%);
			background: var(--error, hsl(356.95 95.9% 57.72%));
			font-weight: 500;
		}
	}

	/* Batch 15 (m12278-7): viền đỏ input khi name trùng — class nằm CÙNG
	   phần tử .input-root (props.class ghép qua styleSynced) → :global().
	   BẪY 2 lớp: (1) data-field div KHÔNG có class .form-field → selector
	   theo attr; (2) modal Body (.modal-body-root) set border-color
	   TRỰC TIẾP longhand var(--default-400) → phải set longhand + !important
	   đè cả :focus-within (đỏ giữ nguyên khi focus). */
	[data-field='supplier-name'] :global(.supplier-name-taken.input-root),
	[data-field='supplier-name'] :global(.supplier-name-taken.input-root:focus-within) {
		border-color: var(--error, hsl(356.95 95.9% 57.72%)) !important;
	}

	/* Batch 17: viền xanh khi name qua check + không trùng (mirror viền đỏ) */
	[data-field='supplier-name'] :global(.supplier-name-available.input-root),
	[data-field='supplier-name'] :global(.supplier-name-available.input-root:focus-within) {
		border-color: var(--success, #22c55e) !important;
	}

	/* Batch 17: Description trạng thái check name — copy từ register
	   (src/routes/(unauthorized)/register/+page.svelte:1314-1338). :global vì
	   class nằm trong Description component (props.class qua styleSynced). */
	:global(.supplier-modal-root .form-hint) {
		font-size: 0.75rem !important;
		color: var(--foreground-400, #71717a) !important;
		margin-top: 0.25rem !important;
		transition: all 0.3s ease;
		opacity: 0.8;
	}

	:global(.supplier-modal-root .error-hint) {
		color: var(--error, hsl(356.95 95.9% 57.72%)) !important;
		opacity: 1;
		animation: supplier-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	:global(.supplier-modal-root .success-hint) {
		color: var(--success, #22c55e) !important;
		opacity: 1;
	}

	@keyframes supplier-shake {
		10%,
		90% {
			transform: translate3d(-1px, 0, 0);
		}
		20%,
		80% {
			transform: translate3d(2px, 0, 0);
		}
		30%,
		70% {
			transform: translate3d(-4px, 0, 0);
		}
		40%,
		60% {
			transform: translate3d(4px, 0, 0);
		}
	}

	/* Batch 11 (5e): field passive — thông tin created/updated ở cuối form */
	.supplier-passive {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		padding: 0.75rem 0.875rem;
		border: 1px dashed var(--default-300, hsl(0 0% 88%));
		border-radius: 0.625rem;
		background: var(--default-50, hsl(0 0% 98%));
		font-size: 0.8125rem;

		dt {
			color: var(--foreground-500);
			font-weight: 500;
		}

		dd {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			margin: 0;
			color: var(--foreground);
		}
	}

	.supplier-passive__row {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.supplier-passive__sep {
		color: var(--foreground-300);
	}

	/* ── Batch 23: bỏ workaround ẩn .input-group-actions khi loading ──
	   Batch 20 (A6) ẩn clear button vì spinner overlay ::after của Input ĐÈ lên
	   action buttons. Batch 23 đã bỏ overlay spinner ở component Input (spinner
	   nay nằm trong .input-group-actions, SAU clear button) ⇒ KHÔNG cần ẩn nữa. */

	/* Thêm animate: pulse opacity cho cả input-root khi checking (spinner
	   input-spin 0.7s đã có từ _styles.scss — bổ sung nhịp thở dễ thấy). */
	@keyframes supplier-name-loading-pulse {
		0%,
		100% {
			opacity: 0.75;
		}
		50% {
			opacity: 0.45;
		}
	}

	[data-field='supplier-name'] :global(.input-root.loading) {
		animation: supplier-name-loading-pulse 1.2s ease-in-out infinite;
	}

	/* ── Batch 20 (A4): more-menu footer form modal.
	   Batch 22 (m00193-3): nút mở giờ là component Button (ghost +
	   aspect-square) — CSS .supplier-more-btn raw ĐÃ XOÁ. ── */
	.supplier-more-wrap {
		position: relative;
	}

	.supplier-more-popover {
		position: absolute;
		bottom: calc(100% + 0.35rem);
		left: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 11rem;
		padding: 0.35rem;
		background: var(--background);
		border: 1px solid var(--default-300);
		border-radius: 0.65rem;
		/* Token đúng là --box-shadow-lg (--shadow-lg không tồn tại — Batch 18) */
		box-shadow: var(--box-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
	}

	.supplier-more-popover__item {
		display: block;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		/* --foreground-600 AA 7.0:1 (--foreground-500 light 4.41:1 fail sát) */
		color: var(--foreground-600);
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;

		&:hover:not(:disabled),
		&:focus-visible {
			background: var(--default-100, var(--default-200));
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.supplier-more-popover__item--danger {
		color: var(--error, hsl(356.95 95.9% 57.72%));

		&:hover:not(:disabled),
		&:focus-visible {
			background: var(--error-50, hsl(356.95 95.9% 57.72% / 0.08));
		}
	}

	/* ── Batch 20 (A4): panel phân tích nhập hàng ── */
	.supplier-analytics {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.supplier-analytics__totals {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.supplier-analytics__stat {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--default-300, hsl(0 0% 88%));
		border-radius: 0.625rem;
		background: var(--default-50, hsl(0 0% 98%));
		min-width: 0;
	}

	.supplier-analytics__stat-value {
		/* Giá trị động dài (tiền tệ) — ellipsis nguyên tắc toàn hệ thống */
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 600;
		font-size: 0.9375rem;
		color: var(--foreground);
	}

	.supplier-analytics__stat-label {
		font-size: 0.75rem;
		color: var(--foreground-600);
	}

	.supplier-analytics__monthly-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--foreground);
		margin-bottom: 0.35rem;
	}

	.supplier-analytics__table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;

		th,
		td {
			padding: 0.3rem 0.45rem;
			border-bottom: 1px solid var(--default-200, hsl(0 0% 92%));
			text-align: left;
			color: var(--foreground-600);
		}

		th {
			font-weight: 600;
			color: var(--foreground);
		}

		th.num,
		td.num {
			text-align: right;
			font-variant-numeric: tabular-nums;
		}

		tbody tr:last-child td {
			border-bottom: 0;
		}
	}
</style>
