<!-- src/routes/(authorized)/admin/purchases/+page.svelte -->
<script lang="ts">
	import { Button, DataTable, Pagination, Accordion } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Input, Select } from '$components/form';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDate as formatDateShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface PurchaseRow {
		_id?: string;
		poCode?: string;
		supplierId?: string | null;
		branchId?: string;
		categoryId?: string | null;
		status?: string;
		source?: string;
		note?: string | null;
		vouchers?: Array<{ type: 'money' | 'gift'; value?: number; giftVariantId?: string; giftQuantity?: number; note?: string }>;
		items?: POItem[];
		totalCost?: number;
		receivedAt?: string | null;
		createdAt?: string | null;
	}

	interface POItem {
		variantId: string;
		quantity: number;
		unitCost: number;
		lotNumber?: string;
		expiresAt?: string;
		manufacturedAt?: string;
		unitCostEffective?: number;
		voucher?: { type: 'money' | 'gift'; value?: number; giftVariantId?: string; giftQuantity?: number; note?: string };
	}

	interface BranchOption {
		_id: string;
		name?: string;
		isWarehouse?: boolean;
	}

	interface SupplierOption {
		_id: string;
		name?: string;
		displayName?: string;
	}

	interface CategoryOption {
		_id: string;
		name?: string;
		displayName?: string;
	}

	interface VariantOption {
		_id: string;
		sku?: string;
		displayName?: string;
		price?: number;
		costPrice?: number;
		productId?: string;
	}

	interface ReceiptImage {
		dataUrl: string;
		name: string;
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
		title: { vi: 'Nhập hàng', en: 'Purchases' },
		subtitle: {
			vi: 'Nhập nhanh đa kiểu (theo NCC / sản phẩm / thể loại) + nhận hàng qua đơn mua',
			en: 'Multi-mode quick purchasing (supplier / product / category) + PO receiving'
		},
		actions: {
			createQuick: { vi: 'Nhập nhanh', en: 'Quick purchase' },
			createFull: { vi: 'Nhập hàng đầy đủ', en: 'Full purchase' },
			returnSupplier: { vi: 'Trả hàng NCC', en: 'Return to supplier' },
			receive: { vi: 'Nhận hàng', en: 'Receive' },
			detail: { vi: 'Chi tiết', en: 'Detail' },
			remove: { vi: 'Xoá', en: 'Remove' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			submit: { vi: 'Tạo phiếu nhập', en: 'Create purchase' },
			addItem: { vi: 'Thêm dòng', en: 'Add item' },
			back: { vi: 'Quay lại', en: 'Back' },
			next: { vi: 'Tiếp tục', en: 'Next' },
			delete: { vi: 'Xoá dòng', en: 'Remove row' }
		},
		filters: {
			allSources: { vi: 'Mọi kiểu nhập', en: 'All sources' },
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' },
			allSuppliers: { vi: 'Tất cả nhà cung cấp', en: 'All suppliers' },
			allCategories: { vi: 'Tất cả thể loại', en: 'All categories' },
			from: { vi: 'Từ ngày', en: 'From' },
			to: { vi: 'Đến ngày', en: 'To' }
		},
		sourceLabels: {
			quick: { vi: 'Nhập nhanh', en: 'Quick' },
			order: { vi: 'Đơn mua', en: 'Order' }
		},
		table: {
			code: { vi: 'Mã phiếu', en: 'Code' },
			source: { vi: 'Kiểu nhập', en: 'Source' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			status: { vi: 'Trạng thái', en: 'Status' },
			items: { vi: 'Số dòng', en: 'Items' },
			totalCost: { vi: 'Tổng tiền', en: 'Total cost' },
			receivedAt: { vi: 'Nhận lúc', en: 'Received at' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		statusLabels: {
			draft: { vi: 'Nháp', en: 'Draft' },
			ordered: { vi: 'Đã đặt', en: 'Ordered' },
			partially_received: { vi: 'Nhận một phần', en: 'Partially received' },
			received: { vi: 'Đã nhận', en: 'Received' },
			cancelled: { vi: 'Đã huỷ', en: 'Cancelled' }
		},
		quickModal: {
			title: { vi: 'Nhập nhanh', en: 'Quick purchase' },
			mode: { vi: 'Kiểu nhập', en: 'Purchase mode' },
			modeSupplier: { vi: 'Theo nhà cung cấp', en: 'By supplier' },
			modeProduct: { vi: 'Theo sản phẩm', en: 'By product' },
			modeCategory: { vi: 'Theo thể loại', en: 'By category' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			category: { vi: 'Thể loại', en: 'Category' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			variant: { vi: 'Sản phẩm', en: 'Product' },
			quantity: { vi: 'Số lượng', en: 'Quantity' },
			unitCost: { vi: 'Đơn giá', en: 'Unit cost' },
			lotNumber: { vi: 'Số lô', en: 'Lot number' },
			note: { vi: 'Ghi chú', en: 'Note' },
			receiptImages: { vi: 'Ảnh hóa đơn (tối đa 5, mỗi ảnh ≤ 300KB)', en: 'Receipt images (max 5, each ≤ 300KB)' },
			upload: { vi: 'Tải ảnh lên', en: 'Upload images' },
			expirySection: { vi: 'Hạn sử dụng (áp dụng cho toàn phiếu)', en: 'Expiry (applies to whole purchase)' },
			expiryModeDirect: { vi: 'Ngày cụ thể', en: 'Exact dates' },
			expiryModeDays: { vi: 'Theo số ngày', en: 'By days' },
			manufacturedAt: { vi: 'Ngày sản xuất', en: 'Manufactured at' },
			expiresAt: { vi: 'Hạn sử dụng', en: 'Expires at' },
			manufacturedDaysAgo: { vi: 'Sản xuất cách đây (ngày)', en: 'Manufactured days ago' },
			expiresInDays: { vi: 'Hạn sau (ngày)', en: 'Expires in (days)' },
			requireBranch: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			requireVariant: { vi: 'Chọn sản phẩm cho từng dòng', en: 'Select a product for each row' },
			requireSupplier: { vi: 'Chọn nhà cung cấp', en: 'Select a supplier' },
			requireCategory: { vi: 'Chọn thể loại', en: 'Select a category' },
			requireItems: { vi: 'Thêm ít nhất 1 dòng nhập', en: 'Add at least 1 item' },
			tooManyImages: { vi: 'Tối đa 5 ảnh', en: 'Max 5 images' },
			imageTooLarge: { vi: 'Không nén được ảnh dưới 300KB', en: 'Unable to compress image below 300KB' },
			total: { vi: 'Tổng tiền', en: 'Total' },
			loadingVariants: { vi: 'Đang tải sản phẩm…', en: 'Loading products…' }
		},
		fullModal: {
			title: { vi: 'Nhập hàng đầy đủ', en: 'Full purchase' },
			stepInfo: { vi: '1. Thông tin chung', en: '1. General info' },
			stepItems: { vi: '2. Sản phẩm nhập', en: '2. Items' },
			stepReview: { vi: '3. Xem lại & voucher', en: '3. Review & vouchers' },
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			note: { vi: 'Ghi chú', en: 'Note' },
			receiptImages: { vi: 'Ảnh hóa đơn (tối đa 5, mỗi ảnh ≤ 300KB)', en: 'Receipt images (max 5, each ≤ 300KB)' },
			upload: { vi: 'Tải ảnh lên', en: 'Upload images' },
			expirySection: { vi: 'Hạn sử dụng chung (áp dụng cho dòng không nhập riêng)', en: 'Common expiry (applies to lines without their own)' },
			expiryModeDirect: { vi: 'Ngày cụ thể', en: 'Exact dates' },
			expiryModeDays: { vi: 'Theo số ngày', en: 'By days' },
			manufacturedAt: { vi: 'Ngày sản xuất', en: 'Manufactured at' },
			expiresAt: { vi: 'Hạn sử dụng', en: 'Expires at' },
			manufacturedDaysAgo: { vi: 'Sản xuất cách đây (ngày)', en: 'Manufactured days ago' },
			expiresInDays: { vi: 'Hạn sau (ngày)', en: 'Expires in (days)' },
			searchPlaceholder: { vi: 'Tìm theo tên / mã / barcode…', en: 'Search by name / SKU / barcode…' },
			search: { vi: 'Tìm sản phẩm', en: 'Search product' },
			addFromSearch: { vi: 'Thêm', en: 'Add' },
			notFound: { vi: 'Không tìm thấy sản phẩm', en: 'No product found' },
			createNew: { vi: 'Tạo mới', en: 'Create new' },
			scanBarcode: { vi: 'Quét barcode / QR', en: 'Scan barcode / QR' },
			barcodeFound: { vi: 'Đã tìm thấy sản phẩm theo barcode', en: 'Product found by barcode' },
			barcodeNotFound: { vi: 'Không có sản phẩm nào với barcode này', en: 'No product with this barcode' },
			itemNo: { vi: 'STT', en: 'No.' },
			itemName: { vi: 'Sản phẩm', en: 'Product' },
			itemQty: { vi: 'SL', en: 'Qty' },
			itemCost: { vi: 'Đơn giá', en: 'Unit cost' },
			quantity: { vi: 'Số lượng', en: 'Quantity' },
			lotNumber: { vi: 'Số lô', en: 'Lot number' },
			perLineManufacturedAt: { vi: 'NSX riêng dòng', en: 'Per-line mfg date' },
			perLineExpiresAt: { vi: 'HSD riêng dòng', en: 'Per-line expiry' },
			itemNote: { vi: 'Ghi chú dòng', en: 'Line note' },
			voucherType: { vi: 'Khuyến mãi NCC', en: 'Supplier promo' },
			voucherNone: { vi: 'Không', en: 'None' },
			voucherMoney: { vi: 'Giảm tiền', en: 'Money off' },
			voucherGift: { vi: 'Tặng quà', en: 'Gift' },
			voucherValue: { vi: 'Số tiền giảm', en: 'Discount amount' },
			giftVariant: { vi: 'Sản phẩm quà tặng', en: 'Gift product' },
			giftQuantity: { vi: 'Số lượng quà', en: 'Gift quantity' },
			poVouchers: { vi: 'Voucher tổng đơn (giảm tiền từ NCC)', en: 'Order-level vouchers (money off)' },
			addPoVoucher: { vi: 'Thêm voucher tổng', en: 'Add order voucher' },
			voucherAmount: { vi: 'Số tiền giảm', en: 'Amount' },
			summary: { vi: 'Tạm tính', en: 'Subtotal' },
			totalDiscount: { vi: 'Giảm giá', en: 'Discount' },
			totalPayable: { vi: 'Thực trả', en: 'Payable' },
			totalUnits: { vi: 'Tổng số lượng nhận (kể cả quà)', en: 'Total units (incl. gifts)' },
			effectiveUnitCost: { vi: 'Giá vốn đơn vị sau phân bổ', en: 'Allocated unit cost' },
			requireBranch: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			requireItems: { vi: 'Thêm ít nhất 1 dòng nhập', en: 'Add at least 1 item' },
			requireVariant: { vi: 'Chọn sản phẩm cho từng dòng', en: 'Select a product for each row' },
			created: { vi: 'Tạo phiếu nhập thành công', en: 'Purchase created successfully' },
			productName: { vi: 'Tên sản phẩm', en: 'Product name' },
			category: { vi: 'Thể loại', en: 'Category' },
			brand: { vi: 'Thương hiệu', en: 'Brand' },
			sku: { vi: 'Mã SKU', en: 'SKU' },
			barcode: { vi: 'Barcode', en: 'Barcode' },
			price: { vi: 'Giá bán', en: 'Sale price' },
			costPrice: { vi: 'Giá vốn', en: 'Cost price' },
			createProductFirst: { vi: 'Sản phẩm chưa có — tạo mới tại đây', en: 'Product not found — create it here' },
			createProduct: { vi: '1) Tạo sản phẩm', en: '1) Create product' },
			createVariant: { vi: '2) Tạo phân loại & chọn', en: '2) Create variant & select' },
			productCreated: { vi: 'Đã tạo sản phẩm — tiếp tục tạo phân loại', en: 'Product created — continue with variant' },
			variantCreated: { vi: 'Đã tạo phân loại — đã thêm vào danh sách nhập', en: 'Variant created — added to purchase list' },
			creating: { vi: 'Đang tạo…', en: 'Creating…' }
		},
		detailModal: {
			title: { vi: 'Chi tiết phiếu nhập', en: 'Purchase detail' },
			receiptImages: { vi: 'Ảnh hóa đơn', en: 'Receipt images' },
			noImages: { vi: 'Không có ảnh hóa đơn', en: 'No receipt images' },
			items: { vi: 'Dòng nhập', en: 'Line items' },
			receiveConfirm: {
				vi: 'Nhận hàng sẽ tạo lot + cộng tồn kho cho từng dòng. Tiếp tục?',
				en: 'Receiving will create lots and add stock for each line. Continue?'
			}
		},
		returnModal: {
			title: { vi: 'Trả hàng nhà cung cấp', en: 'Return to supplier' },
			intro: {
				vi: 'Chọn NCC + chi nhánh, nhập số lượng cần trả từ tồn kho hiện có. Tồn kho sẽ bị trừ ngay.',
				en: 'Pick supplier + branch, enter quantities to return from current stock. Stock will be deducted immediately.'
			},
			supplier: { vi: 'Nhà cung cấp', en: 'Supplier' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			reason: { vi: 'Lý do trả (tuỳ chọn)', en: 'Reason (optional)' },
			variant: { vi: 'Hàng hoá', en: 'Item' },
			stock: { vi: 'Tồn kho', en: 'In stock' },
			quantity: { vi: 'Số lượng trả', en: 'Return qty' },
			unitCost: { vi: 'Giá trị/đv', en: 'Unit cost' },
			loading: { vi: 'Đang tải tồn kho…', en: 'Loading stock…' },
			empty: { vi: 'Chi nhánh chưa có tồn kho', en: 'No stock at this branch' },
			loadStock: { vi: 'Tải tồn kho', en: 'Load stock' },
			requireSupplier: { vi: 'Chọn nhà cung cấp', en: 'Select a supplier' },
			requireBranch: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			requireItems: { vi: 'Nhập số lượng trả cho ít nhất 1 dòng', en: 'Enter return quantity for at least 1 line' },
			overStock: { vi: 'Số lượng trả vượt tồn kho', en: 'Return quantity exceeds stock' },
			submit: { vi: 'Xác nhận trả hàng', en: 'Confirm return' }
		},
		toasts: {
			created: { vi: 'Tạo phiếu nhập thành công', en: 'Purchase created successfully' },
			received: { vi: 'Nhận hàng thành công', en: 'Received successfully' },
			returned: { vi: 'Trả hàng NCC thành công', en: 'Purchase return created successfully' },
			failed: { vi: 'Thao tác thất bại', en: 'Action failed' },
			requestFailed: { vi: 'Lỗi kết nối máy chủ', en: 'Server request failed' }
		},
		states: {
			loading: { vi: 'Đang tải…', en: 'Loading…' },
			empty: { vi: 'Chưa có phiếu nhập nào', en: 'No purchases yet' },
			errorTitle: { vi: 'Không tải được danh sách', en: 'Failed to load list' },
			retry: { vi: 'Thử lại', en: 'Retry' }
		},
		pagination: {
			total: { vi: 'Tổng', en: 'Total' },
			records: { vi: 'bản ghi', en: 'records' },
			pageSize: { vi: 'Số dòng/trang', en: 'Rows per page' },
			prev: { vi: 'Trước', en: 'Previous' },
			next: { vi: 'Sau', en: 'Next' }
		}
	};

	// ── Danh sách + filter ──
	let purchases = $state<PurchaseRow[]>([]);
	let total = $state(0);
	let page = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadedOnce = $state(false);
	let listError = $state<string | undefined>(undefined);

	let sourceFilter = $state('');
	let statusFilter = $state('');
	let branchFilter = $state('');
	let supplierFilter = $state('');
	let categoryFilter = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');

	// ── Options cho filter + form ──
	let branches = $state<BranchOption[]>([]);
	let suppliers = $state<SupplierOption[]>([]);
	let categories = $state<CategoryOption[]>([]);
	let variantOptions = $state<VariantOption[]>([]);
	let variantsLoading = $state(false);

	// ── Options cho component Select (searchable) — category/supplier/branch ──
	// Native <select> giữ cho enum cố định (source/status/page-size/variant —
	// variant có search riêng + aria/probe cũ). Select dùng value=_id, label=name.
	const branchSelectOptions = $derived(
		branches.map((b) => ({ value: b._id, label: b.name ?? b._id }))
	);
	const supplierSelectOptions = $derived(
		suppliers.map((s) => ({ value: s._id, label: s.displayName ?? s.name ?? s._id }))
	);
	const categorySelectOptions = $derived(
		categories.map((c) => ({ value: c._id, label: c.displayName ?? c.name ?? c._id }))
	);
	const brandSelectOptions = $derived(
		brands.map((b) => ({ value: b._id, label: b.displayName ?? b.name ?? b._id }))
	);

	// ── Modal nhập nhanh ──
	let quickModalDisplay = $state(false);
	let quickSubmitting = $state(false);
	let quickError = $state<string | undefined>(undefined);
	let quickMode = $state<'supplier' | 'product' | 'category'>('supplier');
	let quickSupplierId = $state('');
	let quickCategoryId = $state('');
	let quickBranchId = $state('');
	let quickNote = $state('');
	type QuickItem = { variantId: string; quantity: number; unitCost: number; lotNumber: string };
	let quickItems = $state<QuickItem[]>([]);
	let receiptImages = $state<ReceiptImage[]>([]);
	let expiryMode = $state<'direct' | 'days'>('direct');
	let quickManufacturedAt = $state('');
	let quickExpiresAt = $state('');
	let quickManufacturedDaysAgo = $state(0);
	let quickExpiresInDays = $state(7);

	// ── Modal nhập hàng đầy đủ (flow 3 bước) ──
	type FullItem = {
		key: string;
		variantId: string;
		displayName: string;
		sku: string;
		quantity: number;
		unitCost: number;
		lotNumber: string;
		manufacturedAt: string; // rỗng → dùng expiry chung
		expiresAt: string; // rỗng → dùng expiry chung
		note: string;
		voucherType: 'none' | 'money' | 'gift';
		voucherValue: number;
		giftVariantId: string;
		giftQuantity: number;
	};
	type PoVoucherDraft = { key: string; value: number };

	let fullModalDisplay = $state(false);
	let fullStep = $state<1 | 2 | 3>(1);
	let fullSubmitting = $state(false);
	let fullError = $state<string | undefined>(undefined);
	let fullSupplierId = $state('');
	let fullBranchId = $state('');
	let fullNote = $state('');
	let fullItems = $state<FullItem[]>([]);
	let fullReceiptImages = $state<ReceiptImage[]>([]);
	let fullExpiryMode = $state<'direct' | 'days'>('direct');
	let fullManufacturedAt = $state('');
	let fullExpiresAt = $state('');
	let fullManufacturedDaysAgo = $state(0);
	let fullExpiresInDays = $state(7);
	let fullPoVouchers = $state<PoVoucherDraft[]>([]);

	// Search sản phẩm trong full modal
	let fullSearch = $state('');
	let fullSearchResults = $state<VariantOption[]>([]);
	let fullSearching = $state(false);
	let fullSearched = $state(false);

	// Scan barcode trong full modal
	let fullBarcodeCodes = $state<string[]>([]);
	let fullBarcodeMessage = $state<string | undefined>(undefined);

	// Lark-style create-on-the-fly
	let createSectionOpen = $state(false);
	let newProductName = $state('');
	let newProductCategoryId = $state('');
	let newProductBrandId = $state('');
	let newVariantSku = $state('');
	let newVariantBarcode = $state('');
	let newVariantPrice = $state(0);
	let newVariantCostPrice = $state(0);
	let productCreating = $state(false);
	let variantCreating = $state(false);
	let newProductDocId = $state('');
	let brands = $state<SupplierOption[]>([]);

	// ── Modal chi tiết + nhận hàng ──
	let detailModalDisplay = $state(false);
	let detailPO = $state<(PurchaseRow & { receiptImages?: string[] }) | null>(null);
	let detailLoading = $state(false);
	let detailZoom = $state<string | null>(null);
	let zoomModalDisplay = $state(false);
	let receiveSubmitting = $state(false);

	// ── Phân trang ──
	const pageSizes = [10, 20, 50, 100];
	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDate(raw?: string | Date | null): string {
		return formatDateShared(raw, lang);
	}

	function formatMoney(value?: number): string {
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value ?? 0);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	function sourceLabel(source?: string): string {
		if (!source) return '—';
		const label = pageContents.sourceLabels[source];
		return label ? label[lang] : source;
	}

	function statusLabel(status?: string): string {
		if (!status) return '—';
		const label = pageContents.statusLabels[status];
		return label ? label[lang] : status;
	}

	function statusColor(status?: string): 'success' | 'warning' | 'danger' | 'default' {
		switch (status) {
			case 'received':
				return 'success';
			case 'ordered':
			case 'partially_received':
				return 'warning';
			case 'cancelled':
				// DataTableStatus không có 'error' — map sang 'danger'
				return 'danger';
			default:
				return 'default';
		}
	}

	function getSupplierLabel(id?: string | null): string {
		if (!id) return '—';
		return suppliers.find((s) => s._id === id)?.name ?? id;
	}

	function getBranchLabel(id?: string | null): string {
		if (!id) return '—';
		return branches.find((b) => b._id === id)?.name ?? id;
	}

	function getCategoryLabel(id?: string | null): string {
		if (!id) return '—';
		return categories.find((c) => c._id === id)?.name ?? id;
	}

	function getVariantLabel(id?: string): string {
		if (!id) return '—';
		const v = variantOptions.find((x) => x._id === id);
		return v ? `${v.displayName ?? ''}${v.sku ? ` (${v.sku})` : ''}` : id;
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
			if (import.meta.env.DEV) console.error('[admin/purchases] load branches failed:', err);
		}
	}

	async function loadSuppliers() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/suppliers/list',
				{ method: 'POST', body: { page: 1, pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: SupplierOption[] } | undefined;
				suppliers = data?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/purchases] load suppliers failed:', err);
		}
	}

	async function loadCategories() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/categories/list',
				{ method: 'POST', body: { page: 1, pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { categories?: CategoryOption[] } | undefined;
				categories = data?.categories ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/purchases] load categories failed:', err);
		}
	}

	async function loadVariantOptions() {
		if (!encryptionKeys) return;
		variantsLoading = true;
		try {
			const body: Record<string, unknown> = { page: 1, pageSize: 100 };
			// mode 'category': lấy products theo category rồi fetch variants của từng product
			if (quickMode === 'category' && quickCategoryId) {
				const productsRes = await encryption.fetchSecure(
					'/api/admin/products/list',
					{ method: 'POST', body: { page: 1, pageSize: 100, categoryId: quickCategoryId } },
					encryptionKeys
				);
				const products = (productsRes.data as { items?: Array<{ _id: string }> } | undefined)?.items ?? [];
				if (products.length === 0) {
					variantOptions = [];
					return;
				}
				// Variants không filter theo productId-list — fetch theo từng product (ghép kết quả)
				const results: VariantOption[] = [];
				for (const p of products.slice(0, 20)) {
					const res = await encryption.fetchSecure(
						'/api/admin/variants/list',
						{ method: 'POST', body: { page: 1, pageSize: 100, productId: p._id } },
						encryptionKeys
					);
					if (res.ok) {
						const items = (res.data as { items?: VariantOption[] } | undefined)?.items ?? [];
						results.push(...items);
					}
				}
				variantOptions = results;
			} else {
				const response = await encryption.fetchSecure(
					'/api/admin/variants/list',
					{ method: 'POST', body },
					encryptionKeys
				);
				if (response.ok) {
					variantOptions = (response.data as { items?: VariantOption[] } | undefined)?.items ?? [];
				}
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/purchases] load variants failed:', err);
		} finally {
			variantsLoading = false;
		}
	}

	async function loadPurchases() {
		if (!encryptionKeys) return;
		loading = true;
		listError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchases/list',
				{
					method: 'POST',
					body: {
						page,
						pageSize,
						source: sourceFilter || undefined,
						status: statusFilter || undefined,
						branchId: branchFilter || undefined,
						supplierId: supplierFilter || undefined,
						categoryId: categoryFilter || undefined,
						dateFrom: dateFrom ? new Date(dateFrom).toISOString() : undefined,
						dateTo: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			loadedOnce = true;
			if (response.ok) {
				const data = response.data as { items?: PurchaseRow[]; total?: number } | undefined;
				purchases = data?.items ?? [];
				total = data?.total ?? 0;
			} else {
				listError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			loading = false;
			loadedOnce = true;
			listError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/purchases] fetch error:', err);
		}
	}

	function onFilterChange() {
		page = 1;
		void loadPurchases();
	}

	function onPageSizeChange() {
		page = 1;
		void loadPurchases();
	}

	// ---------- DataTable ----------
	const purchasesAny = $derived(purchases as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'code',
			label: pageContents.table.code[lang],
			accessor: (row) => (row as unknown as PurchaseRow).poCode ?? '—'
		},
		{
			id: 'source',
			label: pageContents.table.source[lang],
			accessor: (row) => sourceLabel((row as unknown as PurchaseRow).source),
			noHighlight: true
		},
		{
			id: 'supplier',
			label: pageContents.table.supplier[lang],
			accessor: (row) => getSupplierLabel((row as unknown as PurchaseRow).supplierId),
			noHighlight: true
		},
		{
			id: 'branch',
			label: pageContents.table.branch[lang],
			accessor: (row) => getBranchLabel((row as unknown as PurchaseRow).branchId),
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			accessor: (row) => statusLabel((row as unknown as PurchaseRow).status),
			status: (_value, row) => statusColor((row as unknown as PurchaseRow).status)
		},
		{
			id: 'items',
			label: pageContents.table.items[lang],
			accessor: (row) => String((row as unknown as PurchaseRow).items?.length ?? 0),
			noHighlight: true
		},
		{
			id: 'totalCost',
			label: pageContents.table.totalCost[lang],
			accessor: (row) => formatMoney((row as unknown as PurchaseRow).totalCost),
			noHighlight: true
		},
		{
			id: 'receivedAt',
			label: pageContents.table.receivedAt[lang],
			accessor: (row) => {
				const r = row as unknown as PurchaseRow;
				return formatDate(r.receivedAt ?? r.createdAt);
			},
			noHighlight: true
		}
	]);

	// ── Trả hàng NCC ──
	interface ReturnItem {
		variantId: string;
		displayName: string;
		sku: string;
		stock: number;
		quantity: number;
		unitCost: number;
	}
	let returnModalDisplay = $state(false);
	let returnSubmitting = $state(false);
	let returnError = $state<string | undefined>(undefined);
	let returnSupplierId = $state('');
	let returnBranchId = $state('');
	let returnReason = $state('');
	let returnItems = $state<ReturnItem[]>([]);
	let returnStockLoading = $state(false);

	function openReturnModal() {
		returnSupplierId = '';
		returnBranchId = branchFilter || '';
		returnReason = '';
		returnItems = [];
		returnError = undefined;
		returnModalDisplay = true;
	}

	// Nạp tồn kho theo chi nhánh — dòng 'Trả về NCC' lấy từ stock có sẵn
	async function loadReturnStock() {
		if (!encryptionKeys || !returnBranchId) return;
		returnStockLoading = true;
		try {
			// Đảm bảo variantOptions có dữ liệu (tên/sku/costPrice hiển thị dòng)
			if (variantOptions.length === 0) {
				const body: Record<string, unknown> = { page: 1, pageSize: 100 };
				const variantsRes = await encryption.fetchSecure(
					'/api/admin/variants/list',
					{ method: 'POST', body },
					encryptionKeys
				);
				if (variantsRes.ok) {
					variantOptions = (variantsRes.data as { items?: VariantOption[] } | undefined)?.items ?? [];
				}
			}
			const response = await encryption.fetchSecure(
				'/api/admin/inventory/stock/list',
				{ method: 'POST', body: { page: 1, pageSize: 100, branchId: returnBranchId } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: Array<Record<string, unknown>> } | undefined;
				const stockItems = data?.items ?? [];
				returnItems = stockItems.map((s) => {
					const variantId = String(s.variantId ?? '');
					const variant = variantOptions.find((v) => v._id === variantId);
					return {
						variantId,
						displayName: variant?.displayName ?? variantId,
						sku: variant?.sku ?? '',
						stock: Number(s.quantityOnHand ?? 0),
						quantity: 0,
						unitCost: Number(variant?.costPrice ?? 0)
					};
				});
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/purchases] load return stock failed:', err);
		} finally {
			returnStockLoading = false;
		}
	}

	function submitReturn(): string | null {
		if (!returnSupplierId) return pageContents.returnModal.requireSupplier[lang];
		if (!returnBranchId) return pageContents.returnModal.requireBranch[lang];
		const valid = returnItems.filter((it) => Number(it.quantity) > 0);
		if (valid.length === 0) return pageContents.returnModal.requireItems[lang];
		for (const it of valid) {
			if (Number(it.quantity) > it.stock) return pageContents.returnModal.overStock[lang];
		}
		return null;
	}

	async function submitPurchaseReturn() {
		const err = submitReturn();
		if (err) {
			returnError = err;
			return;
		}
		if (!encryptionKeys) return;
		returnSubmitting = true;
		returnError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchases/return',
				{
					method: 'POST',
					body: {
						supplierId: returnSupplierId,
						branchId: returnBranchId,
						reason: returnReason || undefined,
						items: returnItems
							.filter((it) => Number(it.quantity) > 0)
							.map((it) => ({
								variantId: it.variantId,
								quantity: Math.floor(Number(it.quantity)),
								unitCost: Number(it.unitCost) || 0
							}))
					}
				},
				encryptionKeys
			);
			if (response.ok) {
				showToast(pageContents.toasts.returned[lang], 'success');
				returnModalDisplay = false;
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/purchases] return failed:', err);
			showToast(resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed), 'error');
		} finally {
			returnSubmitting = false;
		}
	}

	// ── Nhập nhanh ──
	function openQuickModal() {
		quickMode = 'supplier';
		quickSupplierId = '';
		quickCategoryId = '';
		quickBranchId = branchFilter || '';
		quickNote = '';
		quickItems = [{ variantId: '', quantity: 1, unitCost: 0, lotNumber: '' }];
		receiptImages = [];
		expiryMode = 'direct';
		quickManufacturedAt = '';
		quickExpiresAt = '';
		quickManufacturedDaysAgo = 0;
		quickExpiresInDays = 7;
		quickError = undefined;
		quickModalDisplay = true;
		void loadVariantOptions();
	}

	function switchQuickMode() {
		// mode category cần variants lọc theo category
		void loadVariantOptions();
	}

	function addQuickItem() {
		quickItems = [...quickItems, { variantId: '', quantity: 1, unitCost: 0, lotNumber: '' }];
	}

	function removeQuickItem(index: number) {
		quickItems = quickItems.filter((_, i) => i !== index);
	}

	const quickTotal = $derived(quickItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0), 0));

	function validateQuickForm(): string | undefined {
		if (!quickBranchId) return pageContents.quickModal.requireBranch[lang];
		if (quickMode === 'supplier' && !quickSupplierId) return pageContents.quickModal.requireSupplier[lang];
		if (quickMode === 'category' && !quickCategoryId) return pageContents.quickModal.requireCategory[lang];
		if (quickItems.length === 0) return pageContents.quickModal.requireItems[lang];
		for (const it of quickItems) {
			if (!it.variantId) return pageContents.quickModal.requireVariant[lang];
			if (!Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0) return pageContents.quickModal.requireItems[lang];
		}
		if (expiryMode === 'direct' && quickExpiresAt && quickManufacturedAt && quickExpiresAt < quickManufacturedAt) {
			return pageContents.quickModal.requireItems[lang];
		}
		return undefined;
	}

	// Nén ảnh client qua canvas ≤300KB/ảnh
	async function compressImage(file: File): Promise<string> {
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error('read failed'));
			reader.readAsDataURL(file);
		});
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error('decode failed'));
			image.src = dataUrl;
		});
		const maxDim = 1280;
		let { width, height } = img;
		if (width > maxDim || height > maxDim) {
			const ratio = Math.min(maxDim / width, maxDim / height);
			width = Math.round(width * ratio);
			height = Math.round(height * ratio);
		}
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return dataUrl;
		ctx.drawImage(img, 0, 0, width, height);
		let quality = 0.8;
		let out = canvas.toDataURL('image/jpeg', quality);
		while (out.length > 300 * 1024 * 1.37 && quality > 0.3) {
			quality -= 0.1;
			out = canvas.toDataURL('image/jpeg', quality);
		}
		return out;
	}

	async function onReceiptFilesSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length === 0) return;
		if (receiptImages.length + files.length > 5) {
			quickError = pageContents.quickModal.tooManyImages[lang];
			return;
		}
		quickError = undefined;
		for (const file of files) {
			try {
				const dataUrl = await compressImage(file);
				receiptImages = [...receiptImages, { dataUrl, name: file.name }];
			} catch {
				quickError = pageContents.quickModal.imageTooLarge[lang];
			}
		}
	}

	function removeReceiptImage(index: number) {
		receiptImages = receiptImages.filter((_, i) => i !== index);
	}

	async function submitQuick() {
		if (quickSubmitting || !encryptionKeys) return;
		const validationError = validateQuickForm();
		if (validationError) {
			quickError = validationError;
			return;
		}
		quickError = undefined;
		quickSubmitting = true;
		try {
			const body: Record<string, unknown> = {
				mode: quickMode,
				branchId: quickBranchId,
				items: quickItems.map((it) => ({
					variantId: it.variantId,
					quantity: Number(it.quantity),
					unitCost: Number(it.unitCost),
					lotNumber: it.lotNumber.trim() || undefined
				})),
				totalCost: quickTotal,
				note: quickNote.trim() || undefined,
				expiryMode,
				...(quickMode === 'supplier' ? { supplierId: quickSupplierId } : {}),
				...(quickMode === 'category' ? { categoryId: quickCategoryId } : {}),
				...(receiptImages.length > 0 ? { receiptImages: receiptImages.map((r) => r.dataUrl) } : {})
			};
			if (expiryMode === 'direct') {
				if (quickManufacturedAt) body.manufacturedAt = new Date(quickManufacturedAt).toISOString();
				if (quickExpiresAt) body.expiresAt = new Date(quickExpiresAt).toISOString();
			} else {
				body.manufacturedDaysAgo = Number(quickManufacturedDaysAgo) || 0;
				body.expiresInDays = Number(quickExpiresInDays) || 0;
			}

			const response = await encryption.fetchSecure(
				'/api/admin/purchases/create',
				{ method: 'POST', body },
				encryptionKeys
			);
			quickSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.created)
						: pageContents.toasts.created[lang],
					'success'
				);
				quickModalDisplay = false;
				page = 1;
				await loadPurchases();
			} else {
				quickError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			quickSubmitting = false;
			quickError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/purchases] create failed:', err);
		}
	}

	// ── Nhập hàng đầy đủ (flow 3 bước + search + scan + create-on-the-fly) ──

	let fullItemSeq = 0;
	function newFullItem(partial?: Partial<FullItem>): FullItem {
		fullItemSeq += 1;
		return {
			key: `fi-${fullItemSeq}`,
			variantId: '',
			displayName: '',
			sku: '',
			quantity: 1,
			unitCost: 0,
			lotNumber: '',
			manufacturedAt: '',
			expiresAt: '',
			note: '',
			voucherType: 'none',
			voucherValue: 0,
			giftVariantId: '',
			giftQuantity: 1,
			...partial
		};
	}

	async function loadBrands() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/brands/list',
				{ method: 'POST', body: { page: 1, pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: SupplierOption[] } | undefined;
				brands = data?.items ?? [];
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/purchases] load brands failed:', err);
		}
	}

	function openFullModal() {
		fullStep = 1;
		fullSupplierId = '';
		fullBranchId = branchFilter || '';
		fullNote = '';
		fullItems = [newFullItem()];
		fullReceiptImages = [];
		fullExpiryMode = 'direct';
		fullManufacturedAt = '';
		fullExpiresAt = '';
		fullManufacturedDaysAgo = 0;
		fullExpiresInDays = 7;
		fullPoVouchers = [];
		fullSearch = '';
		fullSearchResults = [];
		fullSearched = false;
		fullBarcodeCodes = [];
		fullBarcodeMessage = undefined;
		createSectionOpen = false;
		newProductDocId = '';
		fullError = undefined;
		fullModalDisplay = true;
		if (brands.length === 0) void loadBrands();
	}

	function addFullItemFromVariant(v: VariantOption) {
		// Trùng variant → cộng dồn số lượng dòng hiện có
		const existing = fullItems.find((it) => it.variantId === v._id);
		if (existing) {
			existing.quantity += 1;
			fullItems = [...fullItems];
			return;
		}
		// Dòng trống đầu tiên → điền vào; không thì thêm dòng mới
		const emptyIdx = fullItems.findIndex((it) => !it.variantId);
		if (emptyIdx >= 0) {
			fullItems[emptyIdx] = newFullItem({
				variantId: v._id,
				displayName: v.displayName ?? v._id,
				sku: v.sku ?? '',
				unitCost: Number(v.costPrice) || 0
			});
			fullItems = [...fullItems];
		} else {
			fullItems = [
				...fullItems,
				newFullItem({ variantId: v._id, displayName: v.displayName ?? v._id, sku: v.sku ?? '', unitCost: Number(v.costPrice) || 0 })
			];
		}
	}

	async function runFullSearch() {
		if (!encryptionKeys) return;
		const term = fullSearch.trim();
		if (!term) {
			fullSearchResults = [];
			fullSearched = false;
			return;
		}
		fullSearching = true;
		fullError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/list',
				{ method: 'POST', body: { page: 1, pageSize: 20, search: term } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: VariantOption[] } | undefined;
				fullSearchResults = data?.items ?? [];
				fullSearched = true;
			} else {
				fullError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			fullError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/purchases] search variants failed:', err);
		} finally {
			fullSearching = false;
		}
	}

	// Barcode detect → tìm variant theo barcode → tự điền dòng nhập
	$effect(() => {
		const codes = fullBarcodeCodes;
		const code = codes?.[codes.length - 1];
		if (!code || !encryptionKeys) return;
		void (async () => {
			fullBarcodeMessage = undefined;
			try {
				const response = await encryption.fetchSecure(
					'/api/admin/variants/list',
					{ method: 'POST', body: { page: 1, pageSize: 5, search: code } },
					encryptionKeys
				);
				if (response.ok) {
					const items = (response.data as { items?: Array<VariantOption & { barcode?: string }> } | undefined)?.items ?? [];
					const exact = items.find((v) => v.barcode === code) ?? (items.length === 1 ? items[0] : undefined);
					if (exact) {
						addFullItemFromVariant(exact);
						fullBarcodeMessage = `${pageContents.fullModal.barcodeFound[lang]}: ${exact.displayName ?? exact._id}`;
					} else {
						// Không tìm thấy → mở sẵn form tạo mới kiểu Lark, barcode điền sẵn
						createSectionOpen = true;
						newVariantBarcode = code;
						fullBarcodeMessage = pageContents.fullModal.barcodeNotFound[lang];
					}
				}
			} catch (err) {
				if (import.meta.env.DEV) console.error('[admin/purchases] barcode lookup failed:', err);
			}
		})();
	});

	function removeFullItem(index: number) {
		fullItems = fullItems.filter((_, i) => i !== index);
	}

	// Derived tổng hợp cho bước review
	const fullSubtotal = $derived(fullItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0), 0));
	const fullDiscount = $derived(
		fullItems.reduce((s, it) => s + (it.voucherType === 'money' ? Number(it.voucherValue) || 0 : 0), 0) +
			fullPoVouchers.reduce((s, v) => s + (Number(v.value) || 0), 0)
	);
	const fullGiftUnits = $derived(
		fullItems.reduce((s, it) => s + (it.voucherType === 'gift' ? Number(it.giftQuantity) || 0 : 0), 0)
	);
	const fullPayable = $derived(Math.max(0, fullSubtotal - fullDiscount));
	const fullTotalUnits = $derived(fullItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0) + fullGiftUnits);
	const fullPerUnitCost = $derived(fullTotalUnits > 0 ? Math.round((fullPayable / fullTotalUnits) * 10000) / 10000 : 0);

	function validateFullForm(): string | undefined {
		if (!fullBranchId) return pageContents.fullModal.requireBranch[lang];
		if (fullItems.length === 0) return pageContents.fullModal.requireItems[lang];
		for (const it of fullItems) {
			if (!it.variantId) return pageContents.fullModal.requireVariant[lang];
			if (!Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0) return pageContents.fullModal.requireItems[lang];
			if (it.voucherType === 'gift' && (!it.giftVariantId || Number(it.giftQuantity) <= 0)) {
				return pageContents.fullModal.requireVariant[lang];
			}
		}
		if (fullExpiryMode === 'direct' && fullExpiresAt && fullManufacturedAt && fullExpiresAt < fullManufacturedAt) {
			return pageContents.quickModal.requireItems[lang];
		}
		return undefined;
	}

	async function onFullReceiptFilesSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length === 0) return;
		if (fullReceiptImages.length + files.length > 5) {
			fullError = pageContents.quickModal.tooManyImages[lang];
			return;
		}
		fullError = undefined;
		for (const file of files) {
			try {
				const dataUrl = await compressImage(file);
				fullReceiptImages = [...fullReceiptImages, { dataUrl, name: file.name }];
			} catch {
				fullError = pageContents.quickModal.imageTooLarge[lang];
			}
		}
	}

	function removeFullReceiptImage(index: number) {
		fullReceiptImages = fullReceiptImages.filter((_, i) => i !== index);
	}

	async function createProductOnTheFly() {
		if (productCreating || !encryptionKeys || !newProductName.trim()) return;
		productCreating = true;
		fullError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/create',
				{
					method: 'POST',
					body: {
						name: newProductName.trim(),
						categoryId: newProductCategoryId || undefined,
						brandId: newProductBrandId || undefined,
						hasVariants: true
					}
				},
				encryptionKeys
			);
			productCreating = false;
			if (response.ok) {
				const data = response.data as { documentKey?: string } | undefined;
				newProductDocId = data?.documentKey ?? '';
				showToast(pageContents.fullModal.productCreated[lang], 'success');
			} else {
				fullError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			productCreating = false;
			fullError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/purchases] create product failed:', err);
		}
	}

	async function createVariantOnTheFly() {
		if (variantCreating || !encryptionKeys || !newProductDocId || !newVariantSku.trim()) return;
		variantCreating = true;
		fullError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/create',
				{
					method: 'POST',
					body: {
						productId: newProductDocId,
						sku: newVariantSku.trim(),
						barcode: newVariantBarcode.trim() || undefined,
						displayName: newProductName.trim(),
						price: Number(newVariantPrice) || 0,
						costPrice: Number(newVariantCostPrice) || undefined,
						attributes: {}
					}
				},
				encryptionKeys
			);
			variantCreating = false;
			if (response.ok) {
				const data = response.data as { documentKey?: string } | undefined;
				const variantId = data?.documentKey ?? '';
				if (variantId) {
					addFullItemFromVariant({
						_id: variantId,
						sku: newVariantSku.trim(),
						displayName: newProductName.trim(),
						price: Number(newVariantPrice) || 0,
						costPrice: Number(newVariantCostPrice) || 0
					});
				}
				showToast(pageContents.fullModal.variantCreated[lang], 'success');
				// Reset form tạo mới nhưng giữ mở search
				newProductName = '';
				newProductCategoryId = '';
				newProductBrandId = '';
				newVariantSku = '';
				newVariantBarcode = '';
				newVariantPrice = 0;
				newVariantCostPrice = 0;
				newProductDocId = '';
				createSectionOpen = false;
			} else {
				fullError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			variantCreating = false;
			fullError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/purchases] create variant failed:', err);
		}
	}

	async function submitFull() {
		if (fullSubmitting || !encryptionKeys) return;
		const validationError = validateFullForm();
		if (validationError) {
			fullError = validationError;
			fullStep = 1;
			return;
		}
		fullError = undefined;
		fullSubmitting = true;
		try {
			const items = fullItems.map((it) => {
				const body: Record<string, unknown> = {
					variantId: it.variantId,
					quantity: Number(it.quantity),
					unitCost: Number(it.unitCost),
					lotNumber: it.lotNumber.trim() || undefined,
					manufacturedAt: it.manufacturedAt ? new Date(it.manufacturedAt).toISOString() : undefined,
					expiresAt: it.expiresAt ? new Date(it.expiresAt).toISOString() : undefined
				};
				if (it.voucherType === 'money' && Number(it.voucherValue) > 0) {
					body.voucher = { type: 'money', value: Number(it.voucherValue), note: it.note.trim() || undefined };
				} else if (it.voucherType === 'gift' && it.giftVariantId && Number(it.giftQuantity) > 0) {
					body.voucher = { type: 'gift', giftVariantId: it.giftVariantId, giftQuantity: Number(it.giftQuantity), note: it.note.trim() || undefined };
				}
				return body;
			});
			const vouchers = fullPoVouchers
				.filter((v) => Number(v.value) > 0)
				.map((v) => ({ type: 'money' as const, value: Number(v.value) }));

			const body: Record<string, unknown> = {
				mode: fullSupplierId ? 'supplier' : 'product',
				branchId: fullBranchId,
				items,
				totalCost: fullPayable,
				vouchers: vouchers.length > 0 ? vouchers : undefined,
				note: fullNote.trim() || undefined,
				expiryMode: fullExpiryMode,
				...(fullSupplierId ? { supplierId: fullSupplierId } : {}),
				...(fullReceiptImages.length > 0 ? { receiptImages: fullReceiptImages.map((r) => r.dataUrl) } : {})
			};
			if (fullExpiryMode === 'direct') {
				if (fullManufacturedAt) body.manufacturedAt = new Date(fullManufacturedAt).toISOString();
				if (fullExpiresAt) body.expiresAt = new Date(fullExpiresAt).toISOString();
			} else {
				body.manufacturedDaysAgo = Number(fullManufacturedDaysAgo) || 0;
				body.expiresInDays = Number(fullExpiresInDays) || 0;
			}

			const response = await encryption.fetchSecure(
				'/api/admin/purchases/create',
				{ method: 'POST', body },
				encryptionKeys
			);
			fullSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.created)
						: pageContents.fullModal.created[lang],
					'success'
				);
				fullModalDisplay = false;
				page = 1;
				await loadPurchases();
			} else {
				fullError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			fullSubmitting = false;
			fullError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/purchases] full create failed:', err);
		}
	}

	// ── Chi tiết + nhận hàng ──
	async function openDetail(row: PurchaseRow) {
		if (!encryptionKeys || !row._id) return;
		detailLoading = true;
		detailPO = row;
		detailZoom = null;
		detailModalDisplay = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchases/get',
				{ method: 'POST', body: { poId: row._id } },
				encryptionKeys
			);
			detailLoading = false;
			if (response.ok) {
				const data = response.data as { po?: PurchaseRow & { receiptImages?: string[] } } | undefined;
				detailPO = data?.po ?? row;
			}
		} catch (err) {
			detailLoading = false;
			if (import.meta.env.DEV) console.error('[admin/purchases] detail failed:', err);
		}
	}

	function openZoom(dataUrl: string) {
		detailZoom = dataUrl;
		zoomModalDisplay = true;
	}

	async function receivePO(row: PurchaseRow) {
		if (!encryptionKeys || !row._id) return;
		if (!confirm(pageContents.detailModal.receiveConfirm[lang])) return;
		receiveSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/purchases/get',
				{ method: 'POST', body: { poId: row._id, receive: true } },
				encryptionKeys
			);
			receiveSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.received)
						: pageContents.toasts.received[lang],
					'success'
				);
				await loadPurchases();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			receiveSubmitting = false;
			showToast(resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed), 'error');
			if (import.meta.env.DEV) console.error('[admin/purchases] receive failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadSuppliers(), loadCategories(), loadPurchases()]);
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
			<!-- Quy ước màu nút: create = success, destructive (trả NCC trừ tồn) = error soft -->
			<Button color="error" variant="soft" onClick={openReturnModal} data-test="purchases-return-btn">
				{pageContents.actions.returnSupplier[lang]}
			</Button>
			<Button color="primary" variant="soft" onClick={openFullModal}>{pageContents.actions.createFull[lang]}</Button>
			<Button color="success" onClick={openQuickModal}>{pageContents.actions.createQuick[lang]}</Button>
		</div>
	</header>

	<!-- ── Filter ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={sourceFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allSources[lang]}</option>
			<option value="quick">{pageContents.sourceLabels.quick[lang]}</option>
			<option value="order">{pageContents.sourceLabels.order[lang]}</option>
		</select>
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each Object.entries(pageContents.statusLabels) as [key, label]}
				<option value={key}>{(label as any)[lang]}</option>
			{/each}
		</select>
		<Select
			class="admin-filter-select"
			bind:value={branchFilter}
			options={branchSelectOptions}
			searchable
			clearable
			placeholder={pageContents.filters.allBranches[lang]}
			onValueChange={() => onFilterChange()}
		/>
		<Select
			class="admin-filter-select"
			bind:value={supplierFilter}
			options={supplierSelectOptions}
			searchable
			clearable
			placeholder={pageContents.filters.allSuppliers[lang]}
			onValueChange={() => onFilterChange()}
		/>
		<Select
			class="admin-filter-select"
			bind:value={categoryFilter}
			options={categorySelectOptions}
			searchable
			clearable
			placeholder={pageContents.filters.allCategories[lang]}
			onValueChange={() => onFilterChange()}
		/>
		<input class="admin-input admin-date" type="date" bind:value={dateFrom} onchange={onFilterChange} aria-label={pageContents.filters.from[lang]} />
		<input class="admin-input admin-date" type="date" bind:value={dateTo} onchange={onFilterChange} aria-label={pageContents.filters.to[lang]} />
	</div>

	<!-- ── Danh sách ── -->
	{#if listError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{listError}</p>
			<Button color="primary" variant="outline" onClick={() => void loadPurchases()}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else}
		<!-- ── Bảng đơn nhập — DataTable (component có sẵn) ──
		     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
		     Pagination element bên dưới bind:page điều khiển server.
		     Skeleton/empty do DataTable tự render qua loadingLabel/emptyLabel. -->
		<div class="admin-table-wrap">
			<DataTable
				data={purchasesAny}
				{columns}
				pageSize={pageSize}
				showPagination={false}
				loading={loading && !loadedOnce}
				visual={{ striped: true, hoverable: true }}
				emptyLabel={pageContents.states.empty[lang]}
				loadingLabel={pageContents.states.loading[lang]}
				caption={{ vi: 'Danh sách đơn nhập hàng', en: 'Purchase orders list' }}
				actionsLabel={{ vi: pageContents.table.actions[lang], en: pageContents.table.actions[lang] }}
				stickyHead
				data-test="purchases-datatable"
			>
				{#snippet actionsContent(row)}
					{@const r = row as unknown as PurchaseRow}
					<div class="row-actions">
						{#if r.status === 'ordered' || r.status === 'partially_received'}
							<!-- update = primary -->
							<Button color="primary" variant="ghost" size="sm" loading={receiveSubmitting} onClick={() => receivePO(r)}>
								{pageContents.actions.receive[lang]}
							</Button>
						{/if}
						<Button color="default" variant="ghost" size="sm" onClick={() => openDetail(r)}>
							{pageContents.actions.detail[lang]}
						</Button>
					</div>
				{/snippet}
			</DataTable>
		</div>

		<!-- ── Phân trang (server-side) ── -->
		<div class="admin-pagination">
			<span class="total-count">{pageContents.pagination.total[lang]} {total} {pageContents.pagination.records[lang]}</span>
			<div class="page-controls">
				<Pagination
					bind:page={page}
					totalPages={totalPages}
					loading={loading}
					variant="compact"
					prevLabel={pageContents.pagination.prev[lang]}
					nextLabel={pageContents.pagination.next[lang]}
					aria-label={pageContents.title[lang]}
				/>
				<span class="page-size">
					<span class="page-size-label">{pageContents.pagination.pageSize[lang]}</span>
					<select class="admin-select" bind:value={pageSize} onchange={onPageSizeChange}>
						{#each pageSizes as s (s)}
							<option value={s}>{s}</option>
						{/each}
					</select>
				</span>
			</div>
		</div>
	{/if}

	<!-- ── Modal nhập nhanh ── -->
	{#if quickModalDisplay}
		<Modal bind:display={quickModalDisplay} size="lg" isDimissable>
			<Modal.Container>
				<Modal.Container.Header>{pageContents.quickModal.title[lang]}</Modal.Container.Header>
				<Modal.Container.Body>
					{#if quickError}
						<div class="form-error-banner" role="alert">{quickError}</div>
					{/if}

					<div class="mode-radio-group" role="radiogroup" aria-label={pageContents.quickModal.mode[lang]}>
						<label class="mode-radio">
							<input type="radio" name="quickMode" value="supplier" bind:group={quickMode} onchange={switchQuickMode} />
							<span>{pageContents.quickModal.modeSupplier[lang]}</span>
						</label>
						<label class="mode-radio">
							<input type="radio" name="quickMode" value="product" bind:group={quickMode} onchange={switchQuickMode} />
							<span>{pageContents.quickModal.modeProduct[lang]}</span>
						</label>
						<label class="mode-radio">
							<input type="radio" name="quickMode" value="category" bind:group={quickMode} onchange={switchQuickMode} />
							<span>{pageContents.quickModal.modeCategory[lang]}</span>
						</label>
					</div>

					<div class="form-grid form-grid-2">
						{#if quickMode === 'supplier'}
							<label class="form-field">
								<span class="form-label">{pageContents.quickModal.supplier[lang]}</span>
								<Select
									class="admin-filter-select"
									bind:value={quickSupplierId}
									options={supplierSelectOptions}
									searchable
									clearable
								/>
							</label>
						{:else if quickMode === 'category'}
							<label class="form-field">
								<span class="form-label">{pageContents.quickModal.category[lang]}</span>
								<Select
									class="admin-filter-select"
									bind:value={quickCategoryId}
									options={categorySelectOptions}
									searchable
									clearable
									onValueChange={() => switchQuickMode()}
								/>
							</label>
						{/if}
						<label class="form-field">
							<span class="form-label">{pageContents.quickModal.branch[lang]}</span>
							<Select
								class="admin-filter-select"
								bind:value={quickBranchId}
								options={branchSelectOptions}
								searchable
								clearable
							/>
						</label>
					</div>

					<!-- ── Dòng nhập ── -->
					<div class="items-block">
						{#if variantsLoading}
							<p class="variants-loading">{pageContents.quickModal.loadingVariants[lang]}</p>
						{/if}
						{#each quickItems as item, index}
							<div class="po-item">
								<select class="admin-select" bind:value={item.variantId} aria-label={pageContents.quickModal.variant[lang]}>
									<option value="">—</option>
									{#each variantOptions as v (v._id)}
										<option value={v._id}>{v.displayName ?? v._id}{v.sku ? ` (${v.sku})` : ''}</option>
									{/each}
								</select>
								<input class="admin-input po-item-num" type="number" min="1" bind:value={item.quantity} aria-label={pageContents.quickModal.quantity[lang]} />
								<input class="admin-input po-item-num" type="number" min="0" step="1000" bind:value={item.unitCost} aria-label={pageContents.quickModal.unitCost[lang]} />
								<input class="admin-input" type="text" bind:value={item.lotNumber} placeholder={pageContents.quickModal.lotNumber[lang]} aria-label={pageContents.quickModal.lotNumber[lang]} />
								<Button color="error" variant="ghost" size="sm" onClick={() => removeQuickItem(index)} aria-label={pageContents.actions.remove[lang]}>✕</Button>
							</div>
						{/each}
						<Button color="default" variant="outline" size="sm" onClick={addQuickItem}>{pageContents.actions.addItem[lang]}</Button>
						<p class="po-total">{pageContents.quickModal.total[lang]}: <strong>{formatMoney(quickTotal)}</strong></p>
					</div>

					<!-- ── Hạn sử dụng ── -->
					<div class="items-block">
						<div class="mode-radio-group" role="radiogroup" aria-label={pageContents.quickModal.expirySection[lang]}>
							<label class="mode-radio">
								<input type="radio" name="expiryMode" value="direct" bind:group={expiryMode} />
								<span>{pageContents.quickModal.expiryModeDirect[lang]}</span>
							</label>
							<label class="mode-radio">
								<input type="radio" name="expiryMode" value="days" bind:group={expiryMode} />
								<span>{pageContents.quickModal.expiryModeDays[lang]}</span>
							</label>
						</div>
						{#if expiryMode === 'direct'}
							<div class="form-grid form-grid-2">
								<label class="form-field">
									<span class="form-label">{pageContents.quickModal.manufacturedAt[lang]}</span>
									<input class="admin-input" type="date" bind:value={quickManufacturedAt} />
								</label>
								<label class="form-field">
									<span class="form-label">{pageContents.quickModal.expiresAt[lang]}</span>
									<input class="admin-input" type="date" bind:value={quickExpiresAt} />
								</label>
							</div>
						{:else}
							<div class="form-grid form-grid-2">
								<label class="form-field">
									<span class="form-label">{pageContents.quickModal.manufacturedDaysAgo[lang]}</span>
									<input class="admin-input" type="number" min="0" bind:value={quickManufacturedDaysAgo} />
								</label>
								<label class="form-field">
									<span class="form-label">{pageContents.quickModal.expiresInDays[lang]}</span>
									<input class="admin-input" type="number" min="1" bind:value={quickExpiresInDays} />
								</label>
							</div>
						{/if}
					</div>

					<!-- ── Ảnh hóa đơn ── -->
					<div class="items-block">
						<span class="form-label">{pageContents.quickModal.receiptImages[lang]}</span>
						<input type="file" accept="image/*" multiple onchange={onReceiptFilesSelected} />
						{#if receiptImages.length > 0}
							<div class="receipt-strip">
								{#each receiptImages as img, index}
									<div class="receipt-thumb">
										<img src={img.dataUrl} alt={img.name} onclick={() => openZoom(img.dataUrl)} />
										<button type="button" class="receipt-remove" onclick={() => removeReceiptImage(index)} aria-label={pageContents.actions.remove[lang]}>✕</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<label class="form-field">
						<span class="form-label">{pageContents.quickModal.note[lang]}</span>
						<input class="admin-input" type="text" bind:value={quickNote} />
					</label>
				</Modal.Container.Body>
				<Modal.Container.Footer>
					<!-- create = success -->
					<Button color="success" onClick={submitQuick} loading={quickSubmitting} disabled={quickSubmitting}>
						{pageContents.actions.submit[lang]}
					</Button>
					<Button color="default" variant="ghost" disabled={quickSubmitting} onclick={() => { quickModalDisplay = false; }}>
						{pageContents.actions.cancel[lang]}
					</Button>
				</Modal.Container.Footer>
			</Modal.Container>
		</Modal>
	{/if}

	<!-- ── Modal nhập hàng đầy đủ (3 bước) ── -->
	{#if fullModalDisplay}
		<Modal bind:display={fullModalDisplay} size="xl" isDimissable>
			<Modal.Container>
				<Modal.Container.Header>{pageContents.fullModal.title[lang]}</Modal.Container.Header>
				<Modal.Container.Body>
					{#if fullError}
						<div class="form-error-banner" role="alert">{fullError}</div>
					{/if}

					<!-- Bước indicator -->
					<div class="full-steps">
						<button type="button" class="full-step" class:full-step--active={fullStep === 1} onclick={() => (fullStep = 1)}>
							{pageContents.fullModal.stepInfo[lang]}
						</button>
						<button type="button" class="full-step" class:full-step--active={fullStep === 2} onclick={() => (fullStep = 2)}>
							{pageContents.fullModal.stepItems[lang]}
						</button>
						<button type="button" class="full-step" class:full-step--active={fullStep === 3} onclick={() => (fullStep = 3)}>
							{pageContents.fullModal.stepReview[lang]}
						</button>
					</div>

					<!-- Bước 1: NCC + chi nhánh + ảnh hóa đơn + expiry chung -->
					{#if fullStep === 1}
						<div class="form-grid-2">
							<label class="form-field">
								<span class="form-label">{pageContents.fullModal.supplier[lang]}</span>
								<Select
									class="admin-filter-select"
									bind:value={fullSupplierId}
									options={supplierSelectOptions}
									searchable
									clearable
								/>
							</label>
							<label class="form-field">
								<span class="form-label form-label--required">{pageContents.fullModal.branch[lang]}</span>
								<Select
									class="admin-filter-select"
									bind:value={fullBranchId}
									options={branchSelectOptions}
									searchable
									clearable
								/>
							</label>
						</div>

						<div class="items-block">
							<span class="form-label">{pageContents.fullModal.expirySection[lang]}</span>
							<div class="mode-radio-group">
								<label class="mode-radio">
									<input type="radio" name="fullExpiryMode" value="direct" bind:group={fullExpiryMode} />
									{pageContents.fullModal.expiryModeDirect[lang]}
								</label>
								<label class="mode-radio">
									<input type="radio" name="fullExpiryMode" value="days" bind:group={fullExpiryMode} />
									{pageContents.fullModal.expiryModeDays[lang]}
								</label>
							</div>
							{#if fullExpiryMode === 'direct'}
								<div class="form-grid-2">
									<label class="form-field">
										<span class="form-label">{pageContents.fullModal.manufacturedAt[lang]}</span>
										<input class="admin-input" type="date" bind:value={fullManufacturedAt} />
									</label>
									<label class="form-field">
										<span class="form-label">{pageContents.fullModal.expiresAt[lang]}</span>
										<input class="admin-input" type="date" bind:value={fullExpiresAt} />
									</label>
								</div>
							{:else}
								<div class="form-grid-2">
									<label class="form-field">
										<span class="form-label">{pageContents.fullModal.manufacturedDaysAgo[lang]}</span>
										<input class="admin-input" type="number" min="0" bind:value={fullManufacturedDaysAgo} />
									</label>
									<label class="form-field">
										<span class="form-label">{pageContents.fullModal.expiresInDays[lang]}</span>
										<input class="admin-input" type="number" min="0" bind:value={fullExpiresInDays} />
									</label>
								</div>
							{/if}
						</div>

						<div class="items-block">
							<span class="form-label">{pageContents.fullModal.receiptImages[lang]}</span>
							<input type="file" accept="image/*" multiple onchange={onFullReceiptFilesSelected} data-test="full-receipt-input" />
							{#if fullReceiptImages.length > 0}
								<div class="receipt-strip">
									{#each fullReceiptImages as img, i (img.dataUrl)}
										<div class="receipt-thumb">
											<img src={img.dataUrl} alt={img.name} />
											<button type="button" class="receipt-thumb__remove" onclick={() => removeFullReceiptImage(i)}>×</button>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<label class="form-field">
							<span class="form-label">{pageContents.fullModal.note[lang]}</span>
							<input class="admin-input" type="text" bind:value={fullNote} />
						</label>
					{/if}

					<!-- Bước 2: search + scan + tạo mới + accordion items -->
					{#if fullStep === 2}
						<div class="full-search-block">
							<div class="full-search-row">
								<input
									class="admin-input full-search-input"
									type="text"
									placeholder={pageContents.fullModal.searchPlaceholder[lang]}
									bind:value={fullSearch}
									onkeydown={(e) => { if (e.key === 'Enter') void runFullSearch(); }}
									data-test="full-search-input"
								/>
								<Button color="primary" variant="soft" loading={fullSearching} onclick={runFullSearch} data-test="full-search-btn">
									{pageContents.fullModal.search[lang]}
								</Button>
							</div>
							{#if fullSearched}
								{#if fullSearchResults.length > 0}
									<div class="full-search-results" data-test="full-search-results">
										{#each fullSearchResults as v (v._id)}
											<div class="full-search-result">
												<span class="full-search-result__name">{v.displayName ?? v._id}{v.sku ? ` · ${v.sku}` : ''}</span>
												<Button color="success" variant="soft" size="sm" onclick={() => addFullItemFromVariant(v)}>
													{pageContents.fullModal.addFromSearch[lang]}
												</Button>
											</div>
										{/each}
									</div>
								{:else}
									<div class="full-search-empty">
										<span>{pageContents.fullModal.notFound[lang]}</span>
										<Button color="primary" variant="soft" onclick={() => { createSectionOpen = true; }}>
											{pageContents.fullModal.createNew[lang]}
										</Button>
									</div>
								{/if}
							{/if}
						</div>

						<div class="full-scan-block">
							<span class="form-label">{pageContents.fullModal.scanBarcode[lang]}</span>
							<Input type="barcode" bind:codes={fullBarcodeCodes} cameraOn importOn beepOn data-test="full-barcode-input" />
							{#if fullBarcodeMessage}
								<span class="full-scan-message">{fullBarcodeMessage}</span>
							{/if}
						</div>

						<!-- Tạo mới Lark-style -->
						{#if createSectionOpen}
							<div class="full-create-section" data-test="full-create-section">
								<span class="form-label">{pageContents.fullModal.createProductFirst[lang]}</span>
								<span class="full-create-step">{pageContents.fullModal.createProduct[lang]}</span>
								<div class="form-grid-2">
									<label class="form-field">
										<span class="form-label form-label--required">{pageContents.fullModal.productName[lang]}</span>
										<input class="admin-input" type="text" bind:value={newProductName} data-test="new-product-name" />
									</label>
									<label class="form-field">
										<span class="form-label">{pageContents.fullModal.category[lang]}</span>
										<Select
											class="admin-filter-select"
											bind:value={newProductCategoryId}
											options={categorySelectOptions}
											searchable
											clearable
										/>
									</label>
								</div>
								<label class="form-field">
									<span class="form-label">{pageContents.fullModal.brand[lang]}</span>
									<Select
										class="admin-filter-select"
										bind:value={newProductBrandId}
										options={brandSelectOptions}
										searchable
										clearable
									/>
								</label>
								<Button color="success" loading={productCreating} disabled={productCreating || !newProductName.trim()} onclick={createProductOnTheFly} data-test="create-product-btn">
									{productCreating ? pageContents.fullModal.creating[lang] : pageContents.fullModal.createProduct[lang]}
								</Button>

								{#if newProductDocId}
									<span class="full-create-step">{pageContents.fullModal.createVariant[lang]}</span>
									<div class="form-grid-2">
										<label class="form-field">
											<span class="form-label form-label--required">{pageContents.fullModal.sku[lang]}</span>
											<input class="admin-input" type="text" bind:value={newVariantSku} data-test="new-variant-sku" />
										</label>
										<label class="form-field">
											<span class="form-label">{pageContents.fullModal.barcode[lang]}</span>
											<input class="admin-input" type="text" bind:value={newVariantBarcode} data-test="new-variant-barcode" />
										</label>
									</div>
									<div class="form-grid-2">
										<label class="form-field">
											<span class="form-label">{pageContents.fullModal.price[lang]}</span>
											<input class="admin-input" type="number" min="0" bind:value={newVariantPrice} />
										</label>
										<label class="form-field">
											<span class="form-label">{pageContents.fullModal.costPrice[lang]}</span>
											<input class="admin-input" type="number" min="0" bind:value={newVariantCostPrice} />
										</label>
									</div>
									<Button color="success" loading={variantCreating} disabled={variantCreating || !newVariantSku.trim()} onclick={createVariantOnTheFly} data-test="create-variant-btn">
										{variantCreating ? pageContents.fullModal.creating[lang] : pageContents.fullModal.createVariant[lang]}
									</Button>
								{/if}
							</div>
						{/if}

						<!-- Accordion danh sách items -->
						<div class="full-items-list" data-test="full-items-list">
							{#each fullItems as it, i (it.key)}
								<Accordion type="multiple">
									<Accordion.Item value={it.key}>
										<Accordion.Trigger>
											<span class="accordion-summary-row" data-test={`full-item-row-${i}`}>
												<span class="accordion-summary-row__no">{i + 1}</span>
												<span class="accordion-summary-row__name">{it.displayName || pageContents.fullModal.requireVariant[lang]}</span>
												<span class="accordion-summary-row__meta">×{it.quantity}</span>
												<span class="accordion-summary-row__meta">{formatMoney(it.unitCost * it.quantity)}</span>
											</span>
										</Accordion.Trigger>
										<Accordion.Content>
											<div class="full-item-form">
												{#if !it.variantId}
													<div class="full-search-row">
														<input class="admin-input" type="text" placeholder={pageContents.fullModal.searchPlaceholder[lang]} bind:value={fullSearch} />
														<Button color="primary" variant="soft" size="sm" loading={fullSearching} onclick={runFullSearch}>
															{pageContents.fullModal.search[lang]}
														</Button>
													</div>
													{#if fullSearched && fullSearchResults.length > 0}
														<div class="full-search-results">
															{#each fullSearchResults as v (v._id)}
																<div class="full-search-result">
																	<span class="full-search-result__name">{v.displayName ?? v._id}{v.sku ? ` · ${v.sku}` : ''}</span>
																	<Button color="success" variant="soft" size="sm" onclick={() => addFullItemFromVariant(v)}>
																		{pageContents.fullModal.addFromSearch[lang]}
																	</Button>
																</div>
															{/each}
														</div>
													{/if}
												{/if}
												<div class="form-grid-2">
													<label class="form-field">
														<span class="form-label form-label--required">{pageContents.fullModal.quantity[lang]}</span>
														<input class="admin-input" type="number" min="1" bind:value={it.quantity} data-test={`full-item-qty-${i}`} />
													</label>
													<label class="form-field">
														<span class="form-label form-label--required">{pageContents.fullModal.itemCost[lang]}</span>
														<input class="admin-input" type="number" min="0" bind:value={it.unitCost} data-test={`full-item-cost-${i}`} />
													</label>
												</div>
												<div class="form-grid-2">
													<label class="form-field">
														<span class="form-label">{pageContents.fullModal.lotNumber[lang]}</span>
														<input class="admin-input" type="text" bind:value={it.lotNumber} data-test={`full-item-lot-${i}`} />
													</label>
													<label class="form-field">
														<span class="form-label">{pageContents.fullModal.perLineManufacturedAt[lang]}</span>
														<input class="admin-input" type="date" bind:value={it.manufacturedAt} />
													</label>
												</div>
												<div class="form-grid-2">
													<label class="form-field">
														<span class="form-label">{pageContents.fullModal.perLineExpiresAt[lang]}</span>
														<input class="admin-input" type="date" bind:value={it.expiresAt} />
													</label>
													<label class="form-field">
														<span class="form-label">{pageContents.fullModal.itemNote[lang]}</span>
														<input class="admin-input" type="text" bind:value={it.note} />
													</label>
												</div>
												<div class="form-grid-2">
													<label class="form-field">
														<span class="form-label">{pageContents.fullModal.voucherType[lang]}</span>
														<select class="admin-select" bind:value={it.voucherType} data-test={`full-item-voucher-type-${i}`}>
															<option value="none">{pageContents.fullModal.voucherNone[lang]}</option>
															<option value="money">{pageContents.fullModal.voucherMoney[lang]}</option>
															<option value="gift">{pageContents.fullModal.voucherGift[lang]}</option>
														</select>
													</label>
													{#if it.voucherType === 'money'}
														<label class="form-field">
															<span class="form-label">{pageContents.fullModal.voucherValue[lang]}</span>
															<input class="admin-input" type="number" min="0" bind:value={it.voucherValue} data-test={`full-item-voucher-value-${i}`} />
														</label>
													{:else if it.voucherType === 'gift'}
														<label class="form-field">
															<span class="form-label form-label--required">{pageContents.fullModal.giftVariant[lang]}</span>
															<select class="admin-select" bind:value={it.giftVariantId} data-test={`full-item-gift-variant-${i}`}>
																<option value="">—</option>
																{#each fullItems.filter((x) => x.variantId && x.variantId !== it.variantId) as src (src.key)}
																	<option value={src.variantId}>{src.displayName}</option>
																{/each}
															</select>
														</label>
													{/if}
												</div>
												{#if it.voucherType === 'gift'}
													<label class="form-field">
														<span class="form-label form-label--required">{pageContents.fullModal.giftQuantity[lang]}</span>
														<input class="admin-input" type="number" min="1" bind:value={it.giftQuantity} data-test={`full-item-gift-qty-${i}`} />
													</label>
												{/if}
												<Button color="error" variant="soft" size="sm" onclick={() => removeFullItem(i)}>
													{pageContents.actions.delete[lang]}
												</Button>
											</div>
										</Accordion.Content>
									</Accordion.Item>
								</Accordion>
							{/each}
							<Button color="success" variant="soft" onclick={() => { fullItems = [...fullItems, newFullItem()]; }} data-test="full-add-item">
								+ {pageContents.fullModal.stepItems[lang]}
							</Button>
						</div>
					{/if}

					<!-- Bước 3: review + voucher tổng đơn -->
					{#if fullStep === 3}
						<div class="full-review" data-test="full-review">
							<div class="detail-grid">
								<span>{pageContents.fullModal.summary[lang]}</span>
								<strong>{formatMoney(fullSubtotal)}</strong>
								<span>{pageContents.fullModal.totalDiscount[lang]}</span>
								<strong class="full-review__discount">{fullDiscount > 0 ? `-${formatMoney(fullDiscount)}` : formatMoney(0)}</strong>
								<span>{pageContents.fullModal.totalPayable[lang]}</span>
								<strong data-test="full-review-payable">{formatMoney(fullPayable)}</strong>
								<span>{pageContents.fullModal.totalUnits[lang]}</span>
								<strong>{fullTotalUnits}</strong>
								<span>{pageContents.fullModal.effectiveUnitCost[lang]}</span>
								<strong>{fullPerUnitCost}</strong>
							</div>

							<div class="full-po-vouchers" data-test="full-po-vouchers">
								<span class="form-label">{pageContents.fullModal.poVouchers[lang]}</span>
								{#each fullPoVouchers as v, i (v.key)}
									<div class="full-po-voucher">
										<input class="admin-input" type="number" min="0" placeholder={pageContents.fullModal.voucherAmount[lang]} bind:value={v.value} data-test={`po-voucher-value-${i}`} />
										<Button color="error" variant="soft" size="sm" onclick={() => { fullPoVouchers = fullPoVouchers.filter((x) => x.key !== v.key); }}>×</Button>
									</div>
								{/each}
								<Button color="primary" variant="soft" size="sm" onclick={() => { fullPoVouchers = [...fullPoVouchers, { key: `pv-${Date.now()}`, value: 0 }]; }} data-test="add-po-voucher">
									{pageContents.fullModal.addPoVoucher[lang]}
								</Button>
							</div>
						</div>
					{/if}
				</Modal.Container.Body>
				<Modal.Container.Footer>
					{#if fullStep > 1}
						<Button color="default" variant="ghost" onclick={() => { fullStep = (fullStep - 1) as 1 | 2 | 3; }}>
							{pageContents.actions.back[lang]}
						</Button>
					{/if}
					<Button color="default" variant="ghost" disabled={fullSubmitting} onclick={() => { fullModalDisplay = false; }}>
						{pageContents.actions.cancel[lang]}
					</Button>
					{#if fullStep < 3}
						<Button color="primary" onclick={() => { fullStep = (fullStep + 1) as 1 | 2 | 3; }}>
							{pageContents.actions.next[lang]}
						</Button>
					{:else}
						<Button color="success" loading={fullSubmitting} disabled={fullSubmitting} onclick={submitFull} data-test="full-submit">
							{pageContents.actions.submit[lang]}
						</Button>
					{/if}
				</Modal.Container.Footer>
			</Modal.Container>
		</Modal>
	{/if}

	<!-- ── Modal trả hàng NCC ── -->
	{#if returnModalDisplay}
		<Modal bind:display={returnModalDisplay} size="lg" isDimissable>
			<Modal.Container>
				<Modal.Container.Header>{pageContents.returnModal.title[lang]}</Modal.Container.Header>
				<Modal.Container.Body>
					<p class="modal-intro">{pageContents.returnModal.intro[lang]}</p>
					{#if returnError}
						<div class="form-error-banner" role="alert">{returnError}</div>
					{/if}
					<div class="form-grid-2">
						<div class="form-field">
							<label class="form-label" for="return-supplier">{pageContents.returnModal.supplier[lang]}</label>
							<select
								id="return-supplier"
								class="admin-select"
								bind:value={returnSupplierId}
								onchange={() => { returnError = undefined; }}
							>
								<option value="">—</option>
								{#each suppliers as s (s._id)}
									<option value={s._id}>{s.name ?? s.displayName ?? s._id}</option>
								{/each}
							</select>
						</div>
						<div class="form-field">
							<label class="form-label" for="return-branch">{pageContents.returnModal.branch[lang]}</label>
							<select id="return-branch" class="admin-select" bind:value={returnBranchId} onchange={() => { returnItems = []; returnError = undefined; }}>
								<option value="">—</option>
								{#each branches as b (b._id)}
									<option value={b._id}>{b.name ?? b._id}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="form-field">
						<label class="form-label" for="return-reason">{pageContents.returnModal.reason[lang]}</label>
						<input id="return-reason" class="admin-input" type="text" bind:value={returnReason} />
					</div>
					{#if returnBranchId}
						{#if returnItems.length === 0}
							<div class="return-load-row">
								<Button color="primary" variant="soft" loading={returnStockLoading} disabled={returnStockLoading} onclick={loadReturnStock} data-test="return-load-stock">
									{pageContents.returnModal.loadStock[lang]}
								</Button>
							</div>
						{:else}
							<div class="return-items" data-test="return-items">
								{#if returnStockLoading}
									<p class="admin-state">{pageContents.returnModal.loading[lang]}</p>
								{/if}
								{#each returnItems as it, i (it.variantId)}
									<div class="return-item" class:return-item--active={Number(it.quantity) > 0} data-test={`return-item-${i}`}>
										<div class="return-item-info">
											<span class="return-item-name">{it.displayName}{it.sku ? ` · ${it.sku}` : ''}</span>
											<span class="return-item-stock">{pageContents.returnModal.stock[lang]}: {it.stock}</span>
										</div>
										<div class="return-item-inputs">
											<input
												class="admin-input return-item-qty"
												type="number"
												min="0"
												max={it.stock}
												step="1"
												bind:value={it.quantity}
												aria-label={pageContents.returnModal.quantity[lang]}
												data-test={`return-item-qty-${i}`}
											/>
											<input
												class="admin-input return-item-cost"
												type="number"
												min="0"
												step="1"
												bind:value={it.unitCost}
												aria-label={pageContents.returnModal.unitCost[lang]}
												data-test={`return-item-cost-${i}`}
											/>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</Modal.Container.Body>
				<Modal.Container.Footer>
					<Button color="default" variant="ghost" disabled={returnSubmitting} onclick={() => { returnModalDisplay = false; }}>
						{pageContents.actions.cancel[lang]}
					</Button>
					<Button
						color="error"
						loading={returnSubmitting}
						disabled={returnSubmitting || returnItems.length === 0}
						onclick={submitPurchaseReturn}
						data-test="return-submit"
					>
						{pageContents.returnModal.submit[lang]}
					</Button>
				</Modal.Container.Footer>
			</Modal.Container>
		</Modal>
	{/if}

	<!-- ── Modal chi tiết ── -->
	{#if detailModalDisplay && detailPO}
		<Modal bind:display={detailModalDisplay} size="lg" isDimissable>
			<Modal.Container>
				<Modal.Container.Header>{pageContents.detailModal.title[lang]}</Modal.Container.Header>
				<Modal.Container.Body>
					<div class="detail-grid">
						<div><span class="detail-label">{pageContents.table.code[lang]}:</span> {detailPO.poCode ?? '—'}</div>
						<div><span class="detail-label">{pageContents.table.source[lang]}:</span> {sourceLabel(detailPO.source)}</div>
						<div><span class="detail-label">{pageContents.table.supplier[lang]}:</span> {getSupplierLabel(detailPO.supplierId)}</div>
						<div><span class="detail-label">{pageContents.table.branch[lang]}:</span> {getBranchLabel(detailPO.branchId)}</div>
						<div><span class="detail-label">{pageContents.table.category[lang] ?? 'Thể loại'}:</span> {getCategoryLabel(detailPO.categoryId)}</div>
						<div><span class="detail-label">{pageContents.table.status[lang]}:</span> {statusLabel(detailPO.status)}</div>
						<div><span class="detail-label">{pageContents.table.totalCost[lang]}:</span> {formatMoney(detailPO.totalCost)}</div>
						<div><span class="detail-label">{pageContents.table.receivedAt[lang]}:</span> {formatDate(detailPO.receivedAt)}</div>
					</div>
					{#if detailPO.note}
						<p class="detail-note">{detailPO.note}</p>
					{/if}

					<h3 class="detail-section">{pageContents.detailModal.items[lang]}</h3>
					<div class="admin-table-wrap">
						<table class="admin-table">
							<thead>
								<tr>
									<th scope="col">{pageContents.quickModal.variant[lang]}</th>
									<th scope="col">{pageContents.quickModal.quantity[lang]}</th>
									<th scope="col">{pageContents.quickModal.unitCost[lang]}</th>
									<th scope="col">{pageContents.quickModal.lotNumber[lang]}</th>
								</tr>
							</thead>
							<tbody>
								{#each detailPO.items ?? [] as item (item.variantId + String(item.quantity))}
									<tr>
										<td>{getVariantLabel(item.variantId)}</td>
										<td class="col-num">{item.quantity}</td>
										<td class="col-num">{formatMoney(item.unitCost)}</td>
										<td>{item.lotNumber ?? '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<h3 class="detail-section">{pageContents.detailModal.receiptImages[lang]}</h3>
					{#if (detailPO.receiptImages ?? []).length === 0}
						<p class="detail-note">{pageContents.detailModal.noImages[lang]}</p>
					{:else}
						<div class="receipt-strip">
							{#each detailPO.receiptImages ?? [] as img, index (index)}
								<div class="receipt-thumb">
									<img src={img} alt="receipt-{index}" onclick={() => openZoom(img)} />
								</div>
							{/each}
						</div>
					{/if}
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>
	{/if}

	<!-- ── Modal phóng to ảnh (bind:display bắt buộc) ── -->
	{#if zoomModalDisplay}
		<Modal bind:display={zoomModalDisplay} size="xl" isDimissable>
			<Modal.Container>
				<Modal.Container.Body class="zoom-body">
					{#if detailZoom}
						<img class="zoom-img" src={detailZoom} alt="receipt zoom" />
					{/if}
				</Modal.Container.Body>
			</Modal.Container>
		</Modal>
	{/if}
</section>

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

	.admin-filters {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.admin-date {
		width: auto;
		min-width: 9.5rem;
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
	}

	// Component Select trong admin-filters + form-field: class đặt trên
	// .select-root (as=div) — không inline TS trong attr class (unocss/acorn).
	// Trigger cao bằng .admin-select, root width auto trong filters /
	// 100% trong form-grid.
	.admin-filter-select {
		width: auto;
		min-width: 11rem;

		:global(.select-trigger) {
			height: 2.25rem;
			min-height: 2.25rem;
			border-radius: 0.5rem;
			border: 1px solid var(--default-300);
			background: var(--default-50, transparent);
			font-size: 0.85rem;
		}
	}

	.form-field .admin-filter-select {
		width: 100%;
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
	}

	.admin-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
	}

	/* Nút action trong actionsContent — chống nén (bẫy 39px clip) */
	.row-actions {
		display: flex;
		gap: 0.25rem;
		width: 1%;
		min-width: fit-content;
	}

	/* Bảng items read-only trong modal detail — giữ CSS riêng */
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

	.col-num {
		font-variant-numeric: tabular-nums;
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

	.form-error-banner {
		background: var(--danger-soft, hsl(358, 62.5%, 90.6%));
		color: var(--error);
		border-left: 3px solid var(--error);
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
	}

	/* ── Modal trả hàng NCC ── */
	.modal-intro {
		font-size: 0.85rem;
		color: var(--foreground-500);
		margin: 0 0 0.85rem;
	}

	.return-load-row {
		display: flex;
		justify-content: center;
		padding: 0.75rem 0;
	}

	.return-items {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 20rem;
		overflow-y: auto;
		margin-top: 0.75rem;
		padding-right: 0.25rem;
	}

	.return-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--foreground-100);
		border-radius: 0.5rem;

		&--active {
			border-color: var(--primary);
			background: var(--primary-soft, hsl(212, 100%, 97%));
		}
	}

	.return-item-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.return-item-name {
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.return-item-stock {
		font-size: 0.75rem;
		color: var(--foreground-500);
	}

	.return-item-inputs {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.return-item-qty {
		width: 5.5rem;
	}

	.return-item-cost {
		width: 7rem;
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

	.mode-radio-group {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.mode-radio {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--foreground);
		cursor: pointer;
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
		grid-template-columns: minmax(10rem, 2fr) 5rem 6rem minmax(6rem, 1fr) auto;
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

	.variants-loading {
		font-size: 0.8rem;
		color: var(--foreground-500);
		margin: 0;
	}

	.receipt-strip {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.receipt-thumb {
		position: relative;
		width: 5rem;
		height: 5rem;
		border-radius: 0.5rem;
		overflow: hidden;
		border: 1px solid var(--default-300);

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			cursor: zoom-in;
		}
	}

	.receipt-remove {
		position: absolute;
		top: 0.15rem;
		right: 0.15rem;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 999px;
		border: none;
		background: rgb(0 0 0 / 0.6);
		color: #fff;
		font-size: 0.7rem;
		line-height: 1;
		cursor: pointer;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem 1.5rem;
		font-size: 0.9rem;

		@media (max-width: 680px) {
			grid-template-columns: 1fr;
		}
	}

	.detail-label {
		font-weight: 600;
		color: var(--foreground-500);
	}

	.detail-note {
		font-size: 0.85rem;
		color: var(--foreground-500);
		margin: 0.5rem 0 0;
	}

	.detail-section {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 1rem 0 0.5rem;
	}

	/* class truyền qua prop của component (compiler scoped không thấy) — :global để rule áp lên element component */
	:global(.zoom-body) {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
	}

	.zoom-img {
		max-width: 100%;
		max-height: 80vh;
		object-fit: contain;
	}

	.receipt-thumb__remove {
		position: absolute;
		top: 0.15rem;
		right: 0.15rem;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 999px;
		border: none;
		background: rgb(0 0 0 / 0.6);
		color: #fff;
		font-size: 0.8rem;
		line-height: 1;
		cursor: pointer;
	}

	/* ── Modal nhập hàng đầy đủ ── */
	.full-steps {
		display: flex;
		gap: 0.25rem;
		margin-bottom: 1rem;
		border-bottom: 1px solid var(--default-200);
		padding-bottom: 0.5rem;
	}

	.full-step {
		flex: 1;
		padding: 0.4rem 0.5rem;
		border: none;
		background: transparent;
		color: var(--foreground-500);
		font-size: 0.85rem;
		font-weight: 500;
		border-radius: 0.375rem;
		cursor: pointer;

		&--active {
			background: var(--primary-soft, hsl(221 83% 53% / 0.12));
			color: var(--primary-600, hsl(221 83% 53%));
		}
	}

	.full-search-block {
		margin-bottom: 1rem;
	}

	.full-search-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;

		> :first-child {
			flex: 1;
		}
	}

	.full-search-results {
		margin-top: 0.5rem;
		border: 1px solid var(--default-200);
		border-radius: 0.5rem;
		max-height: 12rem;
		overflow-y: auto;
	}

	.full-search-result {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.4rem 0.6rem;

		& + .full-search-result {
			border-top: 1px solid var(--default-100);
		}
	}

	.full-search-result__name {
		flex: 1;
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.full-search-empty {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.5rem;
		padding: 0.5rem 0.6rem;
		border: 1px dashed var(--default-300);
		border-radius: 0.5rem;
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.full-scan-block {
		margin-bottom: 1rem;

		.form-label {
			display: block;
			margin-bottom: 0.35rem;
		}
	}

	.full-scan-message {
		display: block;
		margin-top: 0.35rem;
		font-size: 0.8rem;
		color: var(--success-600, hsl(142 71% 45%));
	}

	.full-create-section {
		margin-bottom: 1rem;
		padding: 0.75rem;
		border: 1px solid var(--default-200);
		border-radius: 0.5rem;
		background: var(--default-50, transparent);

		.form-label {
			display: block;
			margin-bottom: 0.35rem;
		}

		> .full-create-step {
			display: block;
			margin: 0.75rem 0 0.5rem;
			font-weight: 600;
			font-size: 0.85rem;
			color: var(--foreground-500);
		}
	}

	.full-items-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: stretch;
	}

	.accordion-summary-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		font-size: 0.9rem;
		text-align: left;

		&__no {
			flex: 0 0 auto;
			min-width: 1.75rem;
			height: 1.75rem;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			border-radius: 999px;
			background: var(--default-100);
			color: var(--foreground-500);
			font-size: 0.75rem;
			font-weight: 600;
		}

		&__name {
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-weight: 500;
		}

		&__meta {
			flex: 0 0 auto;
			color: var(--foreground-500);
			font-variant-numeric: tabular-nums;
		}
	}

	.full-item-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding-top: 0.5rem;
	}

	.full-review {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.full-review__discount {
		color: var(--danger-600, hsl(358 75% 59%));
	}

	.full-po-vouchers {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		.form-label {
			display: block;
		}
	}

	.full-po-voucher {
		display: flex;
		gap: 0.5rem;
		align-items: center;

		> .admin-input {
			flex: 1;
		}
	}
</style>
