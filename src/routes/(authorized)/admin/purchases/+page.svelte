<!-- src/routes/(authorized)/admin/purchases/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
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
	}

	interface BranchOption {
		_id: string;
		name?: string;
		isWarehouse?: boolean;
	}

	interface SupplierOption {
		_id: string;
		name?: string;
	}

	interface CategoryOption {
		_id: string;
		name?: string;
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
			receive: { vi: 'Nhận hàng', en: 'Receive' },
			detail: { vi: 'Chi tiết', en: 'Detail' },
			remove: { vi: 'Xoá', en: 'Remove' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			submit: { vi: 'Tạo phiếu nhập', en: 'Create purchase' },
			addItem: { vi: 'Thêm dòng', en: 'Add item' }
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
		toasts: {
			created: { vi: 'Tạo phiếu nhập thành công', en: 'Purchase created successfully' },
			received: { vi: 'Nhận hàng thành công', en: 'Received successfully' },
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
			pageSize: { vi: 'Số dòng/trang', en: 'Rows per page' }
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

	function statusColor(status?: string): string {
		switch (status) {
			case 'received':
				return 'success';
			case 'ordered':
			case 'partially_received':
				return 'warning';
			case 'cancelled':
				return 'error';
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

	function changePage(delta: number) {
		const next = page + delta;
		if (next < 1 || next > totalPages) return;
		page = next;
		void loadPurchases();
	}

	function onPageSizeChange() {
		page = 1;
		void loadPurchases();
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
			<!-- Quy ước màu nút: create = success -->
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
		<select class="admin-select" bind:value={branchFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allBranches[lang]}</option>
			{#each branches as b (b._id)}
				<option value={b._id}>{b.name ?? b._id}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={supplierFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allSuppliers[lang]}</option>
			{#each suppliers as s (s._id)}
				<option value={s._id}>{s.name ?? s._id}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={categoryFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allCategories[lang]}</option>
			{#each categories as c (c._id)}
				<option value={c._id}>{c.name ?? c._id}</option>
			{/each}
		</select>
		<input class="admin-input admin-date" type="date" bind:value={dateFrom} onchange={onFilterChange} aria-label={pageContents.filters.from[lang]} />
		<input class="admin-input admin-date" type="date" bind:value={dateTo} onchange={onFilterChange} aria-label={pageContents.filters.to[lang]} />
	</div>

	<!-- ── Danh sách ── -->
	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if listError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{listError}</p>
			<Button color="primary" variant="outline" onClick={() => void loadPurchases()}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if purchases.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.code[lang]}</th>
						<th scope="col">{pageContents.table.source[lang]}</th>
						<th scope="col">{pageContents.table.supplier[lang]}</th>
						<th scope="col">{pageContents.table.branch[lang]}</th>
						<th scope="col">{pageContents.table.status[lang]}</th>
						<th scope="col">{pageContents.table.items[lang]}</th>
						<th scope="col">{pageContents.table.totalCost[lang]}</th>
						<th scope="col">{pageContents.table.receivedAt[lang]}</th>
						<th scope="col" class="col-actions">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each purchases as row (row._id)}
						<tr>
							<td class="col-code">{row.poCode ?? '—'}</td>
							<td>{sourceLabel(row.source)}</td>
							<td>{getSupplierLabel(row.supplierId)}</td>
							<td>{getBranchLabel(row.branchId)}</td>
							<td class="col-status">
								<span class="status-badge status-{statusColor(row.status)}">{statusLabel(row.status)}</span>
							</td>
							<td class="col-num">{row.items?.length ?? 0}</td>
							<td class="col-num">{formatMoney(row.totalCost)}</td>
							<td>{formatDate(row.receivedAt ?? row.createdAt)}</td>
							<td class="col-actions">
								<div class="row-actions">
									{#if row.status === 'ordered' || row.status === 'partially_received'}
										<!-- update = primary -->
										<Button color="primary" variant="ghost" size="sm" loading={receiveSubmitting} onClick={() => receivePO(row)}>
											{pageContents.actions.receive[lang]}
										</Button>
									{/if}
									<Button color="default" variant="ghost" size="sm" onClick={() => openDetail(row)}>
										{pageContents.actions.detail[lang]}
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- ── Phân trang ── -->
		<div class="admin-pagination">
			<span class="total-count">{pageContents.pagination.total[lang]} {total} {pageContents.pagination.records[lang]}</span>
			<div class="page-controls">
				<Button color="default" variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(-1)}>‹</Button>
				<span class="page-info">{page} / {totalPages}</span>
				<Button color="default" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => changePage(1)}>›</Button>
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
								<select class="admin-select" bind:value={quickSupplierId}>
									<option value="">—</option>
									{#each suppliers as s (s._id)}
										<option value={s._id}>{s.name ?? s._id}</option>
									{/each}
								</select>
							</label>
						{:else if quickMode === 'category'}
							<label class="form-field">
								<span class="form-label">{pageContents.quickModal.category[lang]}</span>
								<select class="admin-select" bind:value={quickCategoryId} onchange={switchQuickMode}>
									<option value="">—</option>
									{#each categories as c (c._id)}
										<option value={c._id}>{c.name ?? c._id}</option>
									{/each}
								</select>
							</label>
						{/if}
						<label class="form-field">
							<span class="form-label">{pageContents.quickModal.branch[lang]}</span>
							<select class="admin-select" bind:value={quickBranchId}>
								<option value="">—</option>
								{#each branches as b (b._id)}
									<option value={b._id}>{b.name ?? b._id}</option>
								{/each}
							</select>
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

	.zoom-body {
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
</style>
