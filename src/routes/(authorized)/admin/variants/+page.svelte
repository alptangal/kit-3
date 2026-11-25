<script lang="ts">
	// src/routes/(authorized)/admin/variants/+page.svelte
	// B6.2: migrate sang DataTable + Pagination (pattern users/brands/products page).
	// FIX BUG pre-existing: page cũ fetch GET ?params + PATCH/DELETE method +
	// đọc data.success/data.items nhưng endpoint chỉ export POST (readAdminRequest
	// mã hoá RSA) → bảng không bao giờ render, delete/update luôn chết. Chuyển
	// sang encryption.fetchSecure POST cho list + create/update/delete.
	import { onMount, flushSync, tick } from 'svelte';
	import { Button, DataTable, Pagination, AlertDialog, Spinner } from '$components/element';
	import { ImageUpload, Input, Label, TextField, Select } from '$components/form';
	import { Checkbox } from '$components/form/checkbox';
	import { Modal } from '$components/modal';
	import { ModalContainer } from '$components/modal/Container';
	import { ModalHeader } from '$components/modal/Header';
	import { ModalBody } from '$components/modal/Body';
	import { ModalFooter } from '$components/modal/Footer';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import type { DataTableColumn } from '$components/element/datatable';
	import { resolveServerMessage } from '../_interface';
	import type { Size } from '$components/interface';
	import { saveDraft, readDraft, clearDraft } from '$modules/draft-store';
	import {
		recordSearchKeyword,
		saveDataTablePrefs,
		getSearchKeywords
	} from '$store/user-prefs.svelte';
	import DraftRestoreDialog from '../../_DraftRestoreDialog.svelte';
	import { createCloseGuard } from '$modules/close-guard.svelte';

	import { subscribeDbChanges } from '$modules/db-realtime';
	// P3: dialog xác nhận khi đóng modal với form còn dirty.
	import DirtyCloseDialog from '../DirtyCloseDialog.svelte';
	// Types
	interface VariantListItem {
		_id: string;
		productId: string;
		sku: string;
		barcode?: string;
		attributes: Record<string, string>;
		displayName: string;
		price: number;
		costPrice?: number;
		weight?: number;
		trackLot?: boolean;
		trackExpiry?: boolean;
		trackSerial?: boolean;
		units?: Array<{ name: string; factor: number; price?: number | null }>;
		lowStockThreshold?: number;
		imageUrl?: string;
		status: string;
		createdAt: string;
		updatedAt: string;
		deletedAt?: string | null;
	}

	interface ProductItem {
		_id: string;
		name: string;
	}

	// Ngôn ngữ
	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : (client.browser?.language === 'en' ? 'en' : 'en')
	);

	// Type mở (pattern users/brands page) — lang index không narrow.
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Biến thể', en: 'Variants' },
		subtitle: { vi: 'Quản lý biến thể sản phẩm', en: 'Manage product variants' },
		addVariant: { vi: 'Thêm biến thể', en: 'Add Variant' },
		searchPlaceholder: { vi: 'Tìm biến thể (SKU, tên, mã vạch)…', en: 'Search variants (SKU, name, barcode)…' },
		allProducts: { vi: 'Tất cả sản phẩm', en: 'All Products' },
		showDeleted: { vi: 'Hiện đã xoá', en: 'Show deleted' },
		empty: { vi: 'Chưa có biến thể', en: 'No variants found' },
		loading: { vi: 'Đang tải…', en: 'Loading variants…' },
		createTitle: { vi: 'Tạo biến thể', en: 'Create Variant' },
		editTitle: { vi: 'Sửa biến thể', en: 'Edit Variant' },
		productLabel: { vi: 'Sản phẩm', en: 'Product' },
		skuLabel: { vi: 'Mã SKU', en: 'SKU' },
		barcodeLabel: { vi: 'Mã vạch', en: 'Barcode' },
		displayNameLabel: { vi: 'Tên hiển thị', en: 'Display Name' },
		priceLabel: { vi: 'Giá bán', en: 'Price' },
		costLabel: { vi: 'Giá vốn', en: 'Cost Price' },
		weightLabel: { vi: 'Trọng lượng (g)', en: 'Weight (g)' },
		attributesLabel: { vi: 'Thuộc tính', en: 'Attributes' },
		attrNamePlaceholder: { vi: 'Tên thuộc tính (vd: Size)', en: 'Attribute (e.g., Size)' },
		attrValuePlaceholder: { vi: 'Giá trị (vd: M)', en: 'Value (e.g., M)' },
		addAttr: { vi: 'Thêm thuộc tính', en: 'Add Attribute' },
		advancedLabel: { vi: 'Nâng cao', en: 'Advanced' },
		trackLotLabel: { vi: 'Theo dõi lô', en: 'Track Lots' },
		trackExpiryLabel: { vi: 'Theo dõi hạn dùng', en: 'Track Expiry' },
		trackSerialLabel: { vi: 'Theo dõi serial/IMEI', en: 'Track Serial/IMEI' },
		unitsLabel: { vi: 'Đơn vị quy đổi', en: 'Unit conversions' },
		addUnit: { vi: 'Thêm đơn vị', en: 'Add unit' },
		unitName: { vi: 'Tên đơn vị (vd: Lốc)', en: 'Unit name (e.g. Pack)' },
		unitFactor: { vi: 'Hệ số', en: 'Factor' },
		unitPrice: { vi: 'Giá bán', en: 'Price' },
		unitsNote: {
			vi: 'Dòng đầu là đơn vị gốc (hệ số 1, khoá cố định). Hệ số = số đơn vị gốc trong 1 đơn vị này (vd: Lốc = 6).',
			en: 'First row is the base unit (factor 1, locked). Factor = base units per this unit (e.g. Pack = 6).'
		},
		lowStockLabel: { vi: 'Ngưỡng tồn kho thấp', en: 'Low Stock Threshold' },
		imageLabel: { vi: 'URL ảnh', en: 'Image URL' },
		statusLabel: { vi: 'Trạng thái', en: 'Status' },
		cancel: { vi: 'Huỷ', en: 'Cancel' },
		saveCreate: { vi: 'Tạo biến thể', en: 'Create Variant' },
		saveEdit: { vi: 'Lưu thay đổi', en: 'Save Changes' },
		editAction: { vi: 'Sửa', en: 'Edit' },
		deleteAction: { vi: 'Xoá', en: 'Delete' },
		variantCol: { vi: 'Biến thể', en: 'Variant' },
		updated: { vi: 'Cập nhật', en: 'Updated' },
		totalCount: { vi: '{n} biến thể', en: '{n} variants' },
		// ── B54 ──
		rowsPerPage: { vi: 'Dòng/trang', en: 'Rows per page' },
		crumbMore: { vi: 'Xem đường dẫn', en: 'Show path' },
		settings: {
			title: { vi: 'Tuỳ chọn hiển thị', en: 'Display Settings' },
			product: { vi: 'Sản phẩm', en: 'Product' },
			sortBy: { vi: 'Sắp xếp theo', en: 'Sort By' },
			sortDirection: { vi: 'Hướng sắp xếp', en: 'Sort Direction' },
			sortAsc: { vi: 'Tăng dần', en: 'Ascending' },
			sortDesc: { vi: 'Giảm dần', en: 'Descending' },
			reset: { vi: 'Đặt lại', en: 'Reset' },
			apply: { vi: 'Áp dụng', en: 'Apply' }
		},
		suggest: {
			title: { vi: 'Tìm kiếm gần đây', en: 'Recent searches' }
		},
		bulk: {
			selected: { vi: 'Đã chọn {count}', en: '{count} selected' },
			copy: { vi: 'Sao chép', en: 'Copy' },
			delete: { vi: 'Xoá', en: 'Delete' },
			copied: { vi: 'Đã sao chép {count} biến thể', en: 'Copied {count} variants' },
			deleted: { vi: 'Đã xoá {count} biến thể', en: 'Deleted {count} variants' },
			deleteFailed: { vi: 'Xoá biến thể thất bại', en: 'Failed to delete variants' },
			title: { vi: 'Xoá biến thể', en: 'Delete variants' },
			desc: {
				vi: 'Xoá {count} biến thể đã chọn? Hành động này không thể hoàn tác.',
				en: 'Delete {count} selected variants? This action cannot be undone.'
			},
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			confirm: { vi: 'Xoá', en: 'Delete' }
		},
		quickCreate: {
			title: { vi: 'Tạo sản phẩm mới', en: 'Create New Product' },
			nameLabel: { vi: 'Tên sản phẩm', en: 'Product Name' },
			createBtn: { vi: 'Tạo', en: 'Create' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			created: { vi: 'Đã tạo sản phẩm — chọn lại trong danh sách', en: 'Product created — pick it from the list' }
		},
		createNew: { vi: 'Tạo mới "{value}"', en: 'Create new "{value}"' },
		states: {
			loadFailed: { vi: 'Không tải được danh sách biến thể', en: 'Failed to load variants' },
			created: { vi: 'Đã tạo biến thể', en: 'Variant created' },
			updated: { vi: 'Đã lưu thay đổi', en: 'Variant updated' },
			deleted: { vi: 'Đã xoá biến thể', en: 'Variant deleted' },
			deleteFailed: { vi: 'Không xoá được biến thể', en: 'Failed to delete variant' },
			operationFailed: { vi: 'Thao tác thất bại', en: 'Operation failed' },
			networkError: { vi: 'Lỗi kết nối', en: 'Network error' }
		}
	};

	// ── Cặp khoá RSA cho mọi fetchSecure trên trang ──
	let encryptionKeys = $state<
		| undefined
		| { publicKey: CryptoKey; privateKey: CryptoKey }
	>(undefined);

	// State
	let variants = $state<VariantListItem[]>([]);
	let products = $state<ProductItem[]>([]);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let selectedProduct = $state('');
	let showDeleted = $state(false);
	// Modal create/edit dùng chung 1 biến display (bind:display — modal tự
	// đóng qua Escape/backdrop phải sync ngược về parent, one-way sẽ hở).
	let modalOpen = $state(false);
	let editingVariant = $state<VariantListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	// ── B54: chuẩn UI/UX theo page suppliers ──
	const PREFS_KEY = '/admin/variants';
	let isMobile = $derived(client.browser?.isMobile ?? false);
	// Search suggest (từ khoá đã tìm gần đây)
	let searching = $state(false);
	let searchFocused = $state(false);
	let suggestOpen = $state(false);
	let mobileSearchOpen = $state(false);
	let mobileSearchInputInstance: { configs: { focus: () => void } } | undefined = $state(undefined);
	let searchDebounce: ReturnType<typeof setTimeout> | undefined;
	let searchArmed = false;
	// Bulk selection
	let selectedIds = $state<string[]>([]);
	let bulkDeleteDisplay = $state(false);
	let bulkDeleting = $state(false);
	// Setting modal
	let settingModalDisplay = $state(false);
	let settingSortField = $state('');
	let settingSortDirection = $state<'asc' | 'desc'>('desc');
	// Scroll state (ẩn bulk-bar / FAB khi cuộn)
	let tableScrolled = $state(false);
	let scrollActive = $state(false);
	let scrollRaf = 0;
	let scrollActiveTimer: ReturnType<typeof setTimeout> | undefined;
	let lastActiveScrollTop = -1;
	let wrapEl: HTMLElement | undefined = $state(undefined);
	// Sort hiện hành (server-side, lưu prefs)
	let sortField = $state('');
	let sortDirection = $state<'asc' | 'desc'>('desc');
	let dataTableSortColumn = $state('');
	let dataTableSortDirection = $state<'asc' | 'desc'>('desc');
	// Sync bindDataTable → sortField khi click header (onSortChange đã gán;
	// đây chỉ seed từ prefs nếu sau này khôi phục sort từ prefs).
	$effect(() => {
		if (dataTableSortColumn !== sortField) dataTableSortColumn = sortField;
		if (dataTableSortDirection !== sortDirection) dataTableSortDirection = sortDirection;
	});
	// Select product trong form — remote lazyload
	let formProductKeyword = $state('');
	// Seed option product đang chọn (edit mode: đảm bảo label hiển thị dù chưa load).
	let formProductOptions = $derived.by(() => {
		const opts: Array<{ value: string; label: string }> = [];
		const pid = formData.productId;
		if (pid) {
			const name = productNameById.get(pid);
			if (name) opts.push({ value: pid, label: name });
		}
		return opts;
	});
	let quickCreateDisplay = $state(false);
	let quickCreateName = $state('');
	let quickCreateBusy = $state(false);
	let quickCreatePendingValue = '';
	// Modal crumb overflow (more-popover)
	let crumbTitleEl: HTMLElement | undefined = $state(undefined);
	let crumbMoreOpen = $state(false);
	let variantsCrumbHidden = $state(false);
	// Quick-create modal crumb
	let qcCrumbTitleEl: HTMLElement | undefined = $state(undefined);
	let qcCrumbMoreOpen = $state(false);
	let qcCrumbHidden = $state(false);

	const str = (v: unknown): string => (typeof v === 'string' ? v : '');

	// ── B9 draft autosave ──
	// draftOn: flag từ system settings (getPublicDefaults → layout data.system);
	// draftFormKey: form đang mở (đổi khi mở create/edit khác row).
	let { data } = $props();
	let draftOn = $derived((data as { system?: { draftRestore?: boolean } })?.system?.draftRestore !== false);
	let draftFormKey = $state<string | null>(null);
	let pendingDraftFormKey: string | null = null;
	let draftRestoreDisplay = $state(false);
	let draftUserId: string = '';
	let draftAutosaveArmed = false;

	// Form state — trường số giữ string (Input value là string), parse khi submit.
	// units: mảng đơn vị quy đổi (P2) — dòng đầu là base factor 1.
	let formData = $state({
		productId: '',
		sku: '',
		barcode: '',
		attributes: {} as Record<string, string>,
		displayName: '',
		price: '',
		costPrice: '',
		weight: '',
		trackLot: false,
		trackExpiry: false,
		trackSerial: false,
		units: [] as Array<{ name: string; factor: string; price: string }>,
		lowStockThreshold: '',
		imageUrl: '',
		status: 'active'
	});

	// % lợi nhuận (P2): (price − cost) / cost — đủ 2 giá > 0 mới tính.
	let profitPercent = $derived.by(() => {
		const price = Number(formData.price);
		const cost = Number(formData.costPrice);
		if (!Number.isFinite(price) || !Number.isFinite(cost) || price <= 0 || cost <= 0) return null;
		return Math.round(((price - cost) / cost) * 1000) / 10;
	});

	// Gợi ý giá (P2): giá bán gần nhất từ price_history — fetch khi mở form edit/create.
	let latestPriceHint = $state<{ price: number; at: string } | null>(null);
	let latestPriceLoading = $state(false);

	async function fetchLatestPriceHint(variantId: string) {
		if (!encryptionKeys) return;
		latestPriceLoading = true;
		latestPriceHint = null;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/latest-prices',
				{ method: 'POST', body: { variantId } },
				encryptionKeys
			);
			if (response.ok) {
				const d = response.data as { lastPrice?: number; lastPriceAt?: string } | undefined;
				if (d?.lastPrice != null) {
					latestPriceHint = { price: d.lastPrice, at: d.lastPriceAt ?? '' };
				}
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[admin/variants] latest price hint failed:', err);
		} finally {
			latestPriceLoading = false;
		}
	}

	// Áp gợi ý giá vào form price
	function applyLatestPriceHint() {
		if (latestPriceHint) {
			formData.price = String(latestPriceHint.price);
		}
	}

	// ── P3 confirm-dirty: chặn đóng modal khi form còn thay đổi chưa lưu ──
	// baseline cập nhật ở mọi điểm formData được set (openCreate/openEdit/
	// applyDraftRestore/discardDraft); attemptClose so snapshot hiện tại với
	// baseline → dirty thì mở dialog xác nhận thay vì đóng luôn.
	let dirtyCloseDisplay = $state(false);
	const closeGuard = createCloseGuard({
		form: () => formData,
		openConfirm: () => (dirtyCloseDisplay = true),
		close: () => closeModals()
	});

	// Fetch variants — fetchSecure POST (endpoint mã hoá RSA).
	async function fetchVariants() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		searching = false;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/list',
				{
					method: 'POST',
					body: {
						page: pageNumber,
						pageSize,
						includeDeleted: showDeleted,
						search: searchQuery || undefined,
						productId: selectedProduct || undefined,
						sortBy: sortField || undefined,
						sortDirection: sortField ? sortDirection : undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: VariantListItem[]; total?: number; page?: number }
					| undefined;
				variants = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number' && data.page !== pageNumber) {
					// response gán lại page (server clamp) — chặn effect refetch
					pendingPageApply = true;
					pageNumber = data.page;
				}
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.loadFailed);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.loadFailed);
			if (import.meta.env.DEV) console.error('[variants] fetch error:', err);
		}
	}

	// Fetch danh sách product cho filter + modal (fetchSecure POST).
	async function fetchProducts() {
		if (!encryptionKeys) return;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/list',
				{ method: 'POST', body: { page: 1, pageSize: 100, includeDeleted: false } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: ProductItem[] } | undefined;
				products = (data?.items ?? []).map((p) => ({ _id: p._id, name: p.name }));
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[variants] fetch products error:', err);
		}
	}

	// Tên product theo _id (map lookup — dùng trong cột table).
	const productNameById = $derived(new Map(products.map((p) => [p._id, p.name])));

	// Search debounce 300ms — theo dõi searchQuery bằng effect (Input không có
	// prop oninput; bind:value là nguồn đủ). Bỏ qua lần đầu (tránh trùng onMount).
	$effect(() => {
		void searchQuery;
		if (!searchArmed) {
			searchArmed = true;
			return;
		}
		clearTimeout(searchDebounce);
		searching = true;
		searchDebounce = setTimeout(() => {
			pageNumber = 1;
			void fetchVariants();
		}, 300);
	});

	// ── B54: search suggest theo từ khoá đã tìm (pattern suppliers) ──
	const saveSearchKeyword = () => {
		const kw = (searchQuery ?? '').trim();
		if (kw) recordSearchKeyword(PREFS_KEY, kw);
	};
	const recentKeywordsFiltered = $derived.by(() => {
		const q = (searchQuery ?? '').trim().toLowerCase();
		const all = getSearchKeywords(PREFS_KEY);
		if (!q) return all;
		return all.filter((k: string) => k.toLowerCase().includes(q));
	});

	// Select filter + Checkbox không có callback — theo dõi bằng $effect
	// (pattern users/brands/products page; chỉ chạy sau lần đầu để tránh
	// refetch trùng onMount). Mỗi filter 1 effect riêng với guard + last-value.
	let productFilterArmed = false;
	let lastProduct = '';
	$effect(() => {
		const current = selectedProduct;
		if (!productFilterArmed) {
			productFilterArmed = true;
			lastProduct = current;
			return;
		}
		if (current === lastProduct) return;
		lastProduct = current;
		pageNumber = 1;
		void fetchVariants();
	});

	let deletedToggleArmed = false;
	let lastShowDeleted = false;
	$effect(() => {
		const current = showDeleted;
		if (!deletedToggleArmed) {
			deletedToggleArmed = true;
			lastShowDeleted = current;
			return;
		}
		if (current === lastShowDeleted) return;
		lastShowDeleted = current;
		pageNumber = 1;
		void fetchVariants();
	});

	// Pagination — server-side: effect theo dõi pageNumber + pageSize refetch.
	// Chỉ chạy SAU lần đầu (tránh trùng onMount); pendingPageApply bỏ qua lần
	// response gán lại page (chống vòng lặp fetch). Pattern users/brands page.
	let totalPages = $derived(Math.ceil(total / pageSize) || 1);
	let paginationArmed = false;
	let pendingPageApply = false;
	$effect(() => {
		void pageNumber;
		void pageSize;
		if (!paginationArmed) {
			paginationArmed = true;
			return;
		}
		if (pendingPageApply) {
			pendingPageApply = false;
			return;
		}
		void fetchVariants();
	});

	// ── B54: scroll state (pattern suppliers) — ẩn bulk-bar/FAB khi cuộn ──
	const markScrollActive = (scrollTop: number, maxScroll: number) => {
		const rubber = scrollTop < 0 || scrollTop > maxScroll;
		if (!rubber && scrollTop !== lastActiveScrollTop) scrollActive = true;
		lastActiveScrollTop = scrollTop;
		clearTimeout(scrollActiveTimer);
		scrollActiveTimer = setTimeout(() => {
			scrollActive = false;
			lastActiveScrollTop = -1;
		}, 200);
	};
	const findScrollContainer = (): HTMLElement | null => {
		let el = wrapEl?.parentElement ?? null;
		while (el) {
			const style = getComputedStyle(el);
			if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 4) return el;
			el = el.parentElement;
		}
		return null;
	};
	const onTableScroll = () => {
		const el = wrapEl;
		if (!el || scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			markScrollActive(el.scrollTop, el.scrollHeight - el.clientHeight);
			tableScrolled = el.scrollTop > 8;
		});
	};
	const onWindowScroll = () => {
		const wrapNow = wrapEl;
		if (wrapNow && wrapNow.scrollHeight > wrapNow.clientHeight + 4) return; // wrap tự cuộn — nhường onTableScroll
		if (scrollRaf) return;
		const scrollEl = findScrollContainer();
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			const target = scrollEl ?? window;
			const top = scrollEl ? scrollEl.scrollTop : window.scrollY;
			markScrollActive(top, (scrollEl ? scrollEl.scrollHeight - scrollEl.clientHeight : 0));
			tableScrolled = top > 8;
			void target;
		});
	};

	// ── B54: sort server-side (pattern suppliers onSupplierSortChange) ──
	const onVariantSortChange = (columnId: string | undefined, order: string | undefined) => {
		if (!order || !columnId) {
			sortField = '';
			sortDirection = 'desc';
		} else {
			sortField = columnId;
			sortDirection = order === 'asc' ? 'asc' : 'desc';
		}
		saveDataTablePrefs(PREFS_KEY, {
			sort: sortField ? { field: sortField, direction: sortDirection } : undefined
		});
		searching = true;
		pageNumber = 1;
		pendingPageApply = true;
		void fetchVariants();
	};

	// ── B54: setting modal — seed draft khi mở ──
	$effect(() => {
		if (!settingModalDisplay) return;
		settingSortField = sortField;
		settingSortDirection = sortDirection;
	});
	const applySettingModal = () => {
		sortField = settingSortField;
		sortDirection = settingSortDirection === 'asc' ? 'asc' : 'desc';
		settingModalDisplay = false;
		saveDataTablePrefs(PREFS_KEY, {
			filters: {
				product: selectedProduct || null,
				showDeleted: showDeleted || null
			},
			sort: sortField ? { field: sortField, direction: sortDirection } : undefined
		});
		pageNumber = 1;
		pendingPageApply = true;
		void fetchVariants();
	};

	// ── B54: bulk selection + copy + delete ──
	const clearVariantsSelection = () => {
		selectedIds = [];
	};
	const bulkDisplayCount = $derived(selectedIds.length);
	const bulkCopySelected = () => {
		const cols = allColumns.filter(
			(c) => c.id !== 'actions' && typeof c.accessor === 'function'
		);
		const header = cols.map((c) => String(c.label)).join('\t');
		const rows = variants
			.filter((v) => v._id && selectedIds.includes(v._id))
			.map((v) =>
				cols
					.map((c) =>
						String(
							(c.accessor as (row: unknown) => unknown)(v as unknown as Record<string, unknown>) ?? ''
						)
					)
					.join('\t')
			);
		const tsv = [header, ...rows].join('\n');
		navigator.clipboard
			.writeText(tsv)
			.then(() => {
				showToast(pageContents.bulk.copied[lang].replace('{count}', String(selectedIds.length)));
			})
			.catch(() => showToast(pageContents.states.operationFailed[lang], 'error'));
	};
	const bulkDeleteSelected = async () => {
		if (!encryptionKeys || bulkDeleting || selectedIds.length === 0) return;
		bulkDeleting = true;
		try {
			const res = await encryption.fetchSecure('/api/admin/variants/bulk', {
				method: 'POST',
				body: { ids: selectedIds }
			});
			if (res.ok) {
				const deleted = (res.data?.deleted as number | undefined) ?? selectedIds.length;
				showToast(pageContents.bulk.deleted[lang].replace('{count}', String(deleted)));
				bulkDeleteDisplay = false;
				clearVariantsSelection();
				await fetchVariants();
			} else {
				showToast(pageContents.bulk.deleteFailed[lang], 'error');
			}
		} catch {
			showToast(pageContents.states.networkError[lang], 'error');
		} finally {
			bulkDeleting = false;
		}
	};

	// ── B54: modal title crumb measure (pattern suppliers) ──
	const measureTitleCrumbs = async (
		nav: HTMLElement | undefined,
		onlyMobile: boolean,
		getOverflow: () => number,
		setOverflow: (n: number) => void
	) => {
		if (!nav || onlyMobile) {
			if (getOverflow() !== 0) setOverflow(0);
			return;
		}
		const anyTruncated = (): boolean => {
			for (const child of Array.from(nav.children)) {
				const cls = child.className ?? '';
				if (
					typeof cls === 'string' &&
					(cls.includes('supplier-modal-title__more') || cls.includes('supplier-crumb-popover'))
				)
					continue;
				if (child.scrollWidth > child.clientWidth + 1) return true;
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
	};
	const measureCrumbOverflow = async () => {
		if (!isMobile || !crumbTitleEl) return;
		if (variantsCrumbHidden) {
			variantsCrumbHidden = false;
			await tick();
		}
		const activeEl = crumbTitleEl.querySelector('.supplier-modal-title__name--active');
		const crumbEl = crumbTitleEl.querySelector('.supplier-modal-title__crumb');
		const overflowEl = (activeEl ?? crumbEl) as HTMLElement | null;
		variantsCrumbHidden = !!overflowEl && overflowEl.scrollWidth > overflowEl.clientWidth + 1;
	};
	$effect(() => {
		void modalOpen;
		void crumbTitleEl;
		void formData.displayName;
		void editingVariant;
		void isMobile;
		const raf = requestAnimationFrame(() => void measureCrumbOverflow());
		let ro: ResizeObserver | undefined;
		if (crumbTitleEl && typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(() => {
				requestAnimationFrame(() => void measureCrumbOverflow());
			});
			ro.observe(crumbTitleEl);
		}
		return () => {
			cancelAnimationFrame(raf);
			ro?.disconnect();
		};
	});
	$effect(() => {
		if (!modalOpen) {
			variantsCrumbHidden = false;
			crumbMoreOpen = false;
		}
	});
	$effect(() => {
		if (!crumbMoreOpen) return;
		const onDown = (event: MouseEvent) => {
			if (crumbTitleEl?.contains(event.target as Node)) return;
			crumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDown);
		return () => document.removeEventListener('mousedown', onDown);
	});
	// Quick-create modal crumb measure (2 nấc — không cần popover guard loop dài)
	const measureQcCrumbOverflow = async () => {
		if (!isMobile || !qcCrumbTitleEl) return;
		if (qcCrumbHidden) {
			qcCrumbHidden = false;
			await tick();
		}
		const activeEl = qcCrumbTitleEl.querySelector('.supplier-modal-title__name--active');
		const crumbEl = qcCrumbTitleEl.querySelector('.supplier-modal-title__crumb');
		const overflowEl = (activeEl ?? crumbEl) as HTMLElement | null;
		qcCrumbHidden = !!overflowEl && overflowEl.scrollWidth > overflowEl.clientWidth + 1;
	};
	$effect(() => {
		void quickCreateDisplay;
		void qcCrumbTitleEl;
		void quickCreateName;
		void isMobile;
		const raf = requestAnimationFrame(() => void measureQcCrumbOverflow());
		let ro: ResizeObserver | undefined;
		if (qcCrumbTitleEl && typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(() => {
				requestAnimationFrame(() => void measureQcCrumbOverflow());
			});
			ro.observe(qcCrumbTitleEl);
		}
		return () => {
			cancelAnimationFrame(raf);
			ro?.disconnect();
		};
	});
	$effect(() => {
		if (!quickCreateDisplay) {
			qcCrumbHidden = false;
			qcCrumbMoreOpen = false;
		}
	});
	$effect(() => {
		if (!qcCrumbMoreOpen) return;
		const onDown = (event: MouseEvent) => {
			if (qcCrumbTitleEl?.contains(event.target as Node)) return;
			qcCrumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDown);
		return () => document.removeEventListener('mousedown', onDown);
	});

	// ── B54: setting modal — options ──
	let settingProductOptions = $derived.by(() => {
		const opts: Array<{ value: string; label: string }> = products.map((p) => ({
			value: p._id,
			label: p.name
		}));
		if (selectedProduct && !opts.some((o) => o.value === selectedProduct)) {
			const name = productNameById.get(selectedProduct);
			if (name) opts.unshift({ value: selectedProduct, label: name });
		}
		return opts;
	});
	const settingSortOptions = $derived(
		['variant', 'product', 'sku', 'price', 'status', 'updated'].map((id) => ({
			value: id,
			label:
				id === 'variant'
					? pageContents.variantCol[lang]
					: id === 'product'
						? pageContents.productLabel[lang]
						: id === 'sku'
							? pageContents.skuLabel[lang]
							: id === 'price'
								? pageContents.priceLabel[lang]
								: id === 'status'
									? pageContents.statusLabel[lang]
									: pageContents.updated[lang]
		}))
	);

	// ── B54: Select product remote lazyload (trang 1 qua loadOptions; scroll-load
	// server KHÔNG hỗ trợ — Select loadMore chỉ slice nội bộ, xem báo cáo risk) ──
	const loadFormProductOptions = async (query?: string) => {
		if (!encryptionKeys) return [];
		try {
			const res = await encryption.fetchSecure('/api/admin/products/list', {
				method: 'POST',
				body: {
					page: 1,
					pageSize: 20,
					search: query ?? undefined,
					includeDeleted: false
				}
			});
			if (!res.ok) return [];
			const items = (res.data?.items as Array<{ _id?: string; name?: string }> | undefined) ?? [];
			return items
				.filter((p) => typeof p._id === 'string' && typeof p.name === 'string')
				.map((p) => ({ value: p._id as string, label: p.name as string }));
		} catch {
			return [];
		}
	};

	// ── B54: quick-create product từ Select (2 bước: tạo product → reload options
	// → user tự chọn; hasVariants=true vì variants gắn vào product) ──
	const openQuickCreate = (value: string) => {
		quickCreatePendingValue = value.trim();
		quickCreateName = quickCreatePendingValue;
		
		quickCreateDisplay = true;
	};
	const closeQuickCreate = () => {
		quickCreateDisplay = false;
		quickCreateName = '';
		
		quickCreatePendingValue = '';
	};
	const submitQuickCreate = async () => {
		if (!encryptionKeys || quickCreateBusy) return;
		const name = quickCreateName.trim();
		if (!name) return;
		quickCreateBusy = true;
		try {
			const res = await encryption.fetchSecure('/api/admin/products/create', {
				method: 'POST',
				body: { name, hasVariants: true, status: 'active' }
			});
			if (res.ok) {
				showToast(pageContents.quickCreate.created[lang]);
				void fetchProducts();
				// productId đang giữ TEXT user gõ (Select allowCreate gán value=raw
				// query, chưa có _id thật) → reset để user chọn lại product mới.
				if (formData.productId === quickCreatePendingValue) formData.productId = '';
				closeQuickCreate();
			} else {
				showToast(resolveServerMessage(res.message, lang, pageContents.states.operationFailed) || pageContents.states.operationFailed[lang], 'error');
			}
		} catch {
			showToast(pageContents.states.networkError[lang], 'error');
		} finally {
			quickCreateBusy = false;
		}
	};

	// ── B6.2: DataTable columns ──
	// Mobile (375px): 8 cột bóp thành 325px → truncate cực đoan ("đ...",
	// "Ara...") — giá tiền không đọc được. Ẩn cột phụ (product/sku/attributes)
	// trên mobile, chỉ giữ variant + price + status + updated (bỏ luôn updated
	// nếu vẫn chật). Actions đã ẩn sẵn trên mobile (DataTable xử lý).
	const isMobileViewport = $derived(client.browser?.isMobile ?? false);
	const variantsAny = $derived(variants as unknown as Record<string, unknown>[]);
	const allColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'variant',
			label: pageContents.variantCol[lang],
			sortable: true,
			accessor: (row) => (row as unknown as VariantListItem).displayName,
			render: (value, row) => {
				const v = row as unknown as VariantListItem;
				const barcode = v.barcode ? ` · ${v.barcode}` : '';
				return `${String(value)}${barcode}`;
			}
		},
		{
			id: 'product',
			label: pageContents.productLabel[lang],
			sortable: true,
			accessor: (row) => {
				const v = row as unknown as VariantListItem;
				return productNameById.get(v.productId) ?? '—';
			}
		},
		{
			id: 'sku',
			label: pageContents.skuLabel[lang],
			sortable: true,
			accessor: (row) => (row as unknown as VariantListItem).sku
		},
		{
			id: 'attributes',
			label: pageContents.attributesLabel[lang],
			accessor: (row) => {
				const v = row as unknown as VariantListItem;
				const entries = Object.entries(v.attributes ?? {});
				if (entries.length === 0) return '—';
				return entries.map(([k, val]) => `${k}: ${val}`).join(', ');
			}
		},
		{
			id: 'price',
			label: pageContents.priceLabel[lang],
			sortable: true,
			accessor: (row) => formatPrice((row as unknown as VariantListItem).price)
		},
		{
			id: 'status',
			label: pageContents.statusLabel[lang],
			sortable: true,
			accessor: (row) => (row as unknown as VariantListItem).status,
			status: (value) => {
				const s = String(value ?? '');
				if (s === 'active') return 'success';
				if (s === 'inactive') return 'default';
				if (s === 'draft') return 'warning';
				if (s === 'discontinued') return 'danger';
				return 'default';
			}
		},
		{
			id: 'updated',
			label: pageContents.updated[lang],
			sortable: true,
			accessor: (row) => formatDate((row as unknown as VariantListItem).updatedAt),
			noHighlight: true
		}
	]);
	// Mobile: bỏ product/sku/attributes (thông tin phụ, đã có trong tên variant
	// + modal edit) — giữ 5 cột: variant/price/status/updated + actions (ẩn).
	const columns = $derived(
		isMobileViewport
			? allColumns.filter((c) => !['product', 'sku', 'attributes'].includes(c.id))
			: allColumns
	);

	// Gộp class: defaultStyles snippet là (string|undefined)[] — lọc undefined
	// trước khi truyền vào Icon class (string[]). Helper này nằm trong script
	// (không inline trong attribute class) vì unocss svelte-scoped parse
	// attribute class bằng acorn — TS syntax inline làm preprocess crash.
	function mergeIconClasses(
		styles: ReadonlyArray<string | undefined> | undefined,
		extra: string
	): string[] {
		return [...(styles ?? []).filter((c): c is string => typeof c === 'string'), extra];
	}

	function formatDate(dateStr?: string | null): string {
		if (!dateStr) return '—';
		try {
			return new Date(dateStr).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return '—';
		}
	}

	function formatPrice(price?: number | null): string {
		if (typeof price !== 'number' || Number.isNaN(price)) return '—';
		try {
			return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				style: 'currency',
				currency: 'VND',
				maximumFractionDigits: 0
			}).format(price);
		} catch {
			return String(price);
		}
	}

	// Open create modal
	function openCreateModal() {
		resetForm();
		if (maybeRestoreDraft('variants:create')) return;
		draftFormKey = 'variants:create';
		draftUserId = currentUserId();
		draftAutosaveArmed = false;
		closeGuard.markClean();
		modalOpen = true;
	}

	// Open edit modal
	function openEditModal(variant: VariantListItem) {
		resetForm();
		editingVariant = variant;
		formData = {
			productId: variant.productId,
			sku: variant.sku,
			barcode: variant.barcode ?? '',
			attributes: variant.attributes ?? {},
			displayName: variant.displayName,
			// Trường số: state là string (Input value string) — render số về string.
			price: variant.price != null ? String(variant.price) : '',
			costPrice: variant.costPrice != null ? String(variant.costPrice) : '',
			weight: variant.weight != null ? String(variant.weight) : '',
			trackLot: variant.trackLot ?? false,
			trackExpiry: variant.trackExpiry ?? false,
			trackSerial: variant.trackSerial ?? false,
			units: (variant.units ?? []).map((u) => ({
				name: u.name,
				factor: String(u.factor),
				price: u.price != null ? String(u.price) : ''
			})),
			lowStockThreshold:
				variant.lowStockThreshold != null ? String(variant.lowStockThreshold) : '',
			imageUrl: variant.imageUrl ?? '',
			status: variant.status
		};
		const key = `variants:edit:${variant._id}`;
		if (maybeRestoreDraft(key)) return;
		draftFormKey = key;
		draftUserId = currentUserId();
		draftAutosaveArmed = false;
		closeGuard.markClean();
		modalOpen = true;
		// P2 gợi ý giá: giá bán gần nhất của variant này
		void fetchLatestPriceHint(variant._id);
	}

	// B9: đọc draft khi mở form — nếu còn bản nháp, hiện dialog hỏi khôi phục
	// (return true = caller tạm dừng mở modal, chờ user chọn trong dialog).
	function maybeRestoreDraft(formKey: string): boolean {
		if (!draftOn) return false;
		const userId = currentUserId();
		if (!userId) return false;
		draftUserId = userId;
		const draft = readDraft<typeof formData>(userId, formKey);
		if (!draft) return false;
		pendingDraftFormKey = formKey;
		draftRestoreDisplay = true;
		return true;
	}

	function currentUserId(): string {
		return (data as { user?: { userId?: string } })?.user?.userId ?? '';
	}

	// User chọn Khôi phục trong dialog — áp data + mở modal.
	function applyDraftRestore() {
		if (!pendingDraftFormKey) return;
		const draft = readDraft<typeof formData>(draftUserId, pendingDraftFormKey);
		if (draft) formData = { ...formData, ...draft };
		draftFormKey = pendingDraftFormKey;
		pendingDraftFormKey = null;
		draftAutosaveArmed = false;
		closeGuard.markClean(); // baseline = draft đã khôi phục (user mới mở form)
		modalOpen = true;
	}

	// User chọn Bỏ qua trong dialog — clear draft vĩnh viễn.
	function discardDraft() {
		if (pendingDraftFormKey) {
			clearDraft(draftUserId, pendingDraftFormKey);
			draftFormKey = pendingDraftFormKey;
			pendingDraftFormKey = null;
			closeGuard.markClean(); // form vừa reset (sạch)
			modalOpen = true;
		}
	}

	// Reset form
	function resetForm() {
		formData = {
			productId: '',
			sku: '',
			barcode: '',
			attributes: {},
			displayName: '',
			price: '',
			costPrice: '',
			weight: '',
			trackLot: false,
			trackExpiry: false,
			trackSerial: false,
			units: [],
			lowStockThreshold: '',
			imageUrl: '',
			status: 'active'
		};
		formErrors = {};
		editingVariant = null;
		formSubmitting = false;
		draftFormKey = null;
		pendingDraftFormKey = null;
		latestPriceHint = null;
	}

	// Thêm dòng thuộc tính trống (key tạm "attr{N}" tránh trùng).
	function addAttribute() {
		const nextIndex = Object.keys(formData.attributes).length + 1;
		formData.attributes = { ...formData.attributes, [`attr${nextIndex}`]: '' };
	}

	// B9 autosave draft: theo dõi formData khi modal đang mở — debounce 500ms
	// trong saveDraft. Bỏ qua lần đầu (resetForm set rồi mới có effect đầu).
	// LƯU Ý Svelte 5: `void formData` KHÔNG đăng ký track (chỉ đọc tham chiếu
	// biến, không đọc property) → effect không re-run khi gõ. JSON.stringify
	// đọc từng property (deep) → track đúng mọi thay đổi của form.
	$effect(() => {
		void JSON.stringify(formData);
		if (!draftFormKey || !draftOn) return;
		if (!draftAutosaveArmed) {
			draftAutosaveArmed = true;
			return;
		}
		saveDraft(draftUserId, draftFormKey, { ...formData });
	});

	// Validate form
	function validateForm(): boolean {
		formErrors = {};
		if (!formData.productId) {
			formErrors.productId = 'Product is required';
		}
		if (!formData.sku.trim()) {
			formErrors.sku = 'SKU is required';
		}
		if (!formData.displayName.trim()) {
			formErrors.displayName = 'Display name is required';
		}
		const price = Number(formData.price);
		if (formData.price !== '' && (Number.isNaN(price) || price < 0)) {
			formErrors.price = 'Price must be a number >= 0';
		}
		return Object.keys(formErrors).length === 0;
	}

	// Parse trường số string → number cho API (trống → bỏ qua để API giữ default).
	function parseNumberField(value: string): number | undefined {
		if (value === '') return undefined;
		const n = Number(value);
		return Number.isNaN(n) ? undefined : n;
	}

	// Submit form — fetchSecure POST create/update (endpoint chỉ POST).
	async function submitForm() {
		if (!encryptionKeys || !validateForm()) return;

		formSubmitting = true;
		try {
			// Trường số: parse string → number trước khi gửi (API nhận number).
			// units (P2): bỏ dòng trống, factor nguyên >= 1, price optional.
			const payload = {
				productId: formData.productId,
				sku: formData.sku,
				barcode: formData.barcode,
				attributes: formData.attributes,
				displayName: formData.displayName,
				price: parseNumberField(formData.price) ?? 0,
				costPrice: parseNumberField(formData.costPrice) ?? 0,
				weight: parseNumberField(formData.weight) ?? 0,
				trackLot: formData.trackLot,
				trackExpiry: formData.trackExpiry,
				trackSerial: formData.trackSerial,
				units: formData.units
					.filter((u) => u.name.trim() && Number(u.factor) >= 1)
					.map((u) => ({
						name: u.name.trim(),
						factor: Math.max(1, Math.floor(Number(u.factor) || 1)),
						price: u.price !== '' ? Number(u.price) : null
					})),
				lowStockThreshold: parseNumberField(formData.lowStockThreshold) ?? 0,
				imageUrl: formData.imageUrl,
				status: formData.status
			};
			const response = await encryption.fetchSecure(
				editingVariant ? '/api/admin/variants/update' : '/api/admin/variants/create',
				{
					method: 'POST',
					body: editingVariant ? { documentKey: editingVariant._id, ...payload } : payload
				},
				encryptionKeys
			);
			formSubmitting = false;
			if (response.ok) {
				showToast(
					resolveServerMessage(response.message, lang, {
						vi: editingVariant ? pageContents.states.updated.vi : pageContents.states.created.vi,
						en: editingVariant ? pageContents.states.updated.en : pageContents.states.created.en
					})
				);
				// B9: save thành công → xoá draft (chỉ khi đúng form vừa submit).
				if (draftFormKey && draftUserId) clearDraft(draftUserId, draftFormKey);
				closeModals();
				void fetchVariants();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.operationFailed),
					'error'
				);
			}
		} catch (err) {
			formSubmitting = false;
			showToast(pageContents.states.networkError[lang], 'error');
			if (import.meta.env.DEV) console.error('[variants] submit error:', err);
		}
	}

	// Delete variant — fetchSecure POST delete (documentKey trong body).
	async function deleteVariant(variant: VariantListItem) {
		if (!encryptionKeys) return;
		if (!confirm(`Delete "${variant.displayName}" (SKU: ${variant.sku})? This action cannot be undone.`)) return;

		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/delete',
				{ method: 'POST', body: { documentKey: variant._id } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.states.deleted));
				void fetchVariants();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.deleteFailed),
					'error'
				);
			}
		} catch (err) {
			showToast(pageContents.states.networkError[lang], 'error');
			if (import.meta.env.DEV) console.error('[variants] delete error:', err);
		}
	}

	// Toast chuẩn hoá — client.browser?.toasts (pattern users/brands page).
	function showToast(text: string, tone: 'success' | 'error' = 'success') {
		if (!client.browser) client.browser = {};
		client.browser.toasts?.create({ title: text, color: tone });
	}

	// Close modals — ĐÓNG THẬT (programmatic, bypass guard). Dùng khi: submit
	// ok, user xác nhận discard trong dialog, hoặc nút Xoá (delete). Nút Cancel
	// + ESC/backdrop/× đi qua closeGuard.attemptClose (dirty → dialog xác nhận).
	function closeModals() {
		dirtyCloseDisplay = false;
		modalOpen = false;
		resetForm();
	}

	// Initial load — fetchProducts song song fetchVariants (select filter +
	// modal cần products sớm; trước đây chạy sequential khiến modal mở lúc
	// product list chưa về → select rỗng).
	// B8 realtime: refetch list khi collection thay đổi từ client khác
	onMount(() => subscribeDbChanges('variants', () => void fetchVariants()));
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		void fetchProducts();
		await fetchVariants();
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<svelte:window onscroll={onWindowScroll} />

<section
	class="admin-page"
	class:is-scrolled={tableScrolled && isMobile}
	class:is-scrolling={scrollActive && isMobile}
>
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<div class="admin-header-actions">
			<!-- Quy ước màu nút: create = success -->
			<Button color="success" onClick={openCreateModal}>
				{pageContents.addVariant[lang]}
			</Button>
		</div>
	</header>

	<!-- ── Bộ lọc + search suggest + setting (pattern suppliers captionTools) ── -->
	<div class="admin-filters">
		<div class="admin-search" data-suggest>
			{#if isMobile && !mobileSearchOpen}
				<button
					type="button"
					class="mobile-caption-icon"
					data-test="variants-mobile-search-open"
					onclick={() => {
						flushSync(() => {
							mobileSearchOpen = true;
							suggestOpen = true;
						});
						mobileSearchInputInstance?.configs.focus();
					}}
					aria-label={pageContents.searchPlaceholder[lang]}
				>
					<Icon icon={iconify['search-rounded']} size="sm" />
				</button>
			{:else}
				<Input
					bind:this={mobileSearchInputInstance}
					placeholder={pageContents.searchPlaceholder[lang]}
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
										suggestOpen = false;
										saveSearchKeyword();
										if (isMobile && !str(searchQuery).trim()) mobileSearchOpen = false;
									}
								}
							}
						}
					]}
				>
					{#snippet leading(data)}
						{#if searching}
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
				{#if suggestOpen && recentKeywordsFiltered.length > 0}
					<div class="suggest-popover" role="listbox" data-suggest>
						<p class="suggest-title">{pageContents.suggest.title[lang]}</p>
						{#each recentKeywordsFiltered as kw (kw)}
							<button
								type="button"
								class="suggest-item"
								role="option"
								onmousedown={(e) => e.preventDefault()}
								onclick={() => {
									searchQuery = kw;
									suggestOpen = false;
									pageNumber = 1;
									void fetchVariants();
								}}
							>
								{kw}
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
		{#if !isMobile}
			<Checkbox bind:checked={showDeleted}>
				{pageContents.showDeleted[lang]}
			</Checkbox>
		{/if}
		{#if isMobile}
			<button
				type="button"
				class="mobile-caption-icon"
				data-test="variants-mobile-filter-btn"
				onclick={() => {
				settingModalDisplay = true;
			}}
				aria-label={pageContents.settings.title[lang]}
			>
				<Icon icon={iconify['tune-rounded']} size="sm" />
			</button>
		{:else}
			<Button
				color="default"
				variant="outline"
				size="sm"
				data-test="variants-header-setting-btn"
				onclick={() => {
				settingModalDisplay = true;
			}}
			>
				{pageContents.settings.title[lang]}
			</Button>
		{/if}
	</div>

	<!-- ── Trạng thái loading/first-load error ── -->
	{#if loadError}
		<div class="admin-state admin-state--error" data-test="variants-load-error">{loadError}</div>
	{/if}

	<!-- ── Bảng variants (DataTable + snippet actions) ── -->
	<div class="admin-table-wrap" bind:this={wrapEl} onscroll={onTableScroll}>
		<DataTable
			data={variantsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			sortMode="server"
			bind:sortColumn={dataTableSortColumn}
			bind:sortDirection={dataTableSortDirection}
			onSortChange={onVariantSortChange}
			searchable
			searchPlaceholder={{ vi: 'Tìm biến thể…', en: 'Search variants…' }}
			resizable={{ enabled: true, fit: true }}
			loading={loading || searching}
			searchQuery={searchQuery ?? ''}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.empty[lang]}
			loadingLabel={pageContents.loading[lang]}
			caption={{ vi: 'Danh sách biến thể', en: 'Variant list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
			stickyHead
			selectable
			showIndex
			indexOffset={(pageNumber - 1) * pageSize}
			indexCheckboxes
			checkOnRowClick
			selectionTools={false}
			getRowId={(row) => String((row as unknown as VariantListItem)._id ?? '')}
			selection={selectedIds}
			onSelectionChange={(ids) => (selectedIds = ids)}
			mobileTapMode="callback"
			onRowClick={(row) => openEditModal(row as unknown as VariantListItem)}
			cardFields={['variant', 'sku', 'price', 'status']}
			class={
				[tableScrolled && isMobile ? 'caption-collapsed' : undefined, scrollActive && isMobile ? 'tools-hidden-mobile' : undefined]
					.filter(Boolean)
					.join(' ') || undefined
			}
			data-test="variants-datatable"
		>
			{#snippet actionsContent(row)}
				{@const variant = row as unknown as VariantListItem}
				<div class="row-actions">
					<Button variant="ghost" size="sm" onClick={() => openEditModal(variant)} data-test="variant-action-edit">
						{pageContents.editAction[lang]}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						color="error"
						onClick={() => deleteVariant(variant)}
						data-test="variant-action-delete"
					>
						{pageContents.deleteAction[lang]}
					</Button>
				</div>
			{/snippet}
		</DataTable>
	</div>

	<!-- ── B54: bulk bar (copy/delete) ── -->
	{#if selectedIds.length > 0}
		<div class="bulk-row" data-test="variants-bulk-row">
			<div class="bulk-bar">
				<span class="bulk-count">
					{pageContents.bulk.selected[lang].replace('{count}', String(bulkDisplayCount))}
				</span>
				<Button variant="soft" color="primary" size="sm" onClick={bulkCopySelected}>
					{pageContents.bulk.copy[lang]}
				</Button>
				<Button
					variant="soft"
					color="error"
					size="sm"
					data-test="variants-bulk-delete"
					onClick={() => {
						bulkDeleteDisplay = true;
					}}
				>
					{pageContents.bulk.delete[lang]}
				</Button>
				<Button variant="ghost" size="sm" aria-label={pageContents.cancel[lang]} onClick={clearVariantsSelection}>
					<Icon icon={iconify['close-rounded']} size="sm" />
				</Button>
			</div>
		</div>
	{/if}

	<!-- ── B54: FAB mobile (search/setting/create) ── -->
	{#if isMobile}
		<div
			class="fab-group"
			class:fab-hidden={isMobile && !tableScrolled}
			class:is-scrolling={scrollActive && isMobile}
			data-suggest
		>
			<button type="button" class="fab fab--primary" aria-label={pageContents.addVariant[lang]} onclick={() => openCreateModal()}>
				<Icon icon={iconify['add-rounded']} size="md" />
			</button>
			<button
				type="button"
				class="fab fab--secondary"
				aria-label={pageContents.settings.title[lang]}
				onclick={() => {
					settingModalDisplay = true;
					scrollActive = false;
				}}
			>
				<Icon icon={iconify['tune-rounded']} size="sm" />
			</button>
			<button
				type="button"
				class="fab fab--secondary"
				aria-label={pageContents.searchPlaceholder[lang]}
				onclick={() => {
					flushSync(() => {
						mobileSearchOpen = true;
						scrollActive = false;
					});
					mobileSearchInputInstance?.configs.focus();
				}}
			>
				<Icon icon={iconify['search-rounded']} size="sm" />
			</button>
		</div>
	{/if}

	<!-- ── Pagination server-side ── -->
	<footer class="admin-pagination">
		<span class="total-count">{pageContents.totalCount[lang].replace('{n}', String(total))}</span>
		<div class="page-controls">
			<Pagination
				bind:page={pageNumber}
				totalPages={totalPages}
				loading={loading}
				variant="compact"
				prevLabel={{ vi: 'Trước', en: 'Previous' }}
				nextLabel={{ vi: 'Sau', en: 'Next' }}
				aria-label={pageContents.title[lang]}
			/>
			<label class="page-size">
				<span>{pageContents.rowsPerPage[lang]}</span>
				<select
					class="admin-select"
					value={pageSize}
					onchange={(e) => {
						pageSize = Number((e.currentTarget as HTMLSelectElement).value);
						pageNumber = 1;
						// effect theo dõi pageSize tự refetch
					}}
				>
					<option value={10}>10</option>
					<option value={20}>20</option>
					<option value={50}>50</option>
				</select>
			</label>
		</div>
	</footer>

	<!-- ── Create/Edit Modal ── -->
	<Modal
		bind:display={modalOpen}
		onClose={closeModals}
		onCloseAttempt={closeGuard.attemptClose}
		size="lg"
		class="supplier-modal-root"
	>
		<ModalContainer>
			<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
				<div class="supplier-modal-title" bind:this={crumbTitleEl}>
					{#if isMobile && variantsCrumbHidden}
						<button
							type="button"
							class="supplier-modal-title__more"
							data-test="variants-crumb-more"
							aria-label={pageContents.crumbMore[lang]}
							aria-expanded={crumbMoreOpen}
							onclick={() => (crumbMoreOpen = !crumbMoreOpen)}
						>
							<Icon icon={iconify['more-horiz-rounded']} size="sm" />
						</button>
						{#if crumbMoreOpen}
							<div class="supplier-crumb-popover" role="menu">
								<button
									type="button"
									class="supplier-crumb-popover__item"
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
					{#if !isMobile || !variantsCrumbHidden}
						{#if isMobile}
							<button
								type="button"
								class="supplier-modal-title__label supplier-modal-title__crumb"
								onclick={() => closeGuard.attemptClose()}
							>
								{pageContents.title[lang]}
							</button>
						{:else}
							<span class="supplier-modal-title__label">{pageContents.title[lang]}</span>
						{/if}
					{/if}
					{#if editingVariant}
						{#if str(editingVariant.displayName).trim()}
							<span class="supplier-modal-title__name" aria-hidden="true">›</span>
							<span class="supplier-modal-title__name supplier-modal-title__name--active">
								{editingVariant.displayName}
							</span>
						{/if}
					{:else}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.addVariant[lang]}
						</span>
					{/if}
				</div>
			</ModalHeader>
			<ModalBody class="modal-body">
				<TextField name="variant-product" required>
					<Label>{pageContents.productLabel[lang]}</Label>
					<Select
						class="modal-select"
						bind:value={formData.productId}
						options={formProductOptions}
						remoteSearch
						loadOptions={loadFormProductOptions}
						searchable
						clearable
						placeholder={pageContents.allProducts[lang]}
						fullscreen={isMobile}
						fullscreenCrumbs={[
							{ label: pageContents.title[lang], kind: 'crumb' },
							{
								label: editingVariant
									? str(editingVariant.displayName) || pageContents.editTitle[lang]
									: pageContents.addVariant[lang],
								kind: 'current'
							}
						]}
						fullscreenCrumbTap={(index) => {
							if (index === 0) closeGuard.attemptClose();
						}}
						allowCreate
						createOptionLabel={pageContents.createNew[lang].replace('{value}', formProductKeyword)}
						onSearch={(query: string) => (formProductKeyword = query)}
						onOptionCreate={(value: string) => openQuickCreate(value)}
					/>
					{#if formErrors.productId}
						<span class="field-error" role="alert">{formErrors.productId}</span>
					{/if}
				</TextField>

				<div class="grid-2">
					<TextField name="variant-sku" required>
						<Label>{pageContents.skuLabel[lang]}</Label>
						<Input
							bind:value={formData.sku}
							placeholder={lang === 'vi' ? 'Nhập SKU' : 'Enter SKU'}
						/>
						{#if formErrors.sku}
							<span class="field-error" role="alert">{formErrors.sku}</span>
						{/if}
					</TextField>
					<TextField name="variant-barcode">
						<Label>{pageContents.barcodeLabel[lang]}</Label>
						<Input
							bind:value={formData.barcode}
							placeholder={lang === 'vi' ? 'Nhập mã vạch (tuỳ chọn)' : 'Enter barcode (optional)'}
						/>
					</TextField>
				</div>

				<TextField name="variant-display-name" required>
					<Label>{pageContents.displayNameLabel[lang]}</Label>
					<Input
						bind:value={formData.displayName}
						placeholder={lang === 'vi' ? 'Nhập tên hiển thị' : 'Enter display name'}
					/>
					{#if formErrors.displayName}
						<span class="field-error" role="alert">{formErrors.displayName}</span>
					{/if}
				</TextField>

				<div class="grid-2">
					<TextField name="variant-price" required>
						<Label>{pageContents.priceLabel[lang]}</Label>
						<Input type="number" bind:value={formData.price} />
						{#if formErrors.price}
							<span class="field-error" role="alert">{formErrors.price}</span>
						{/if}
						{#if latestPriceHint && Number(formData.price) !== latestPriceHint.price}
							<button
								type="button"
								class="price-hint"
								data-test="variant-price-hint"
								title={latestPriceHint.at}
								onclick={applyLatestPriceHint}
							>
								{lang === 'vi' ? 'Giá gần nhất:' : 'Last price:'}&nbsp;
								{formatPrice(latestPriceHint.price)}
							</button>
						{/if}
					</TextField>
					<TextField name="variant-cost">
						<Label>{pageContents.costLabel[lang]}</Label>
						<Input type="number" bind:value={formData.costPrice} />
						{#if profitPercent !== null}
							<span
								class="profit-badge"
								class:profit-badge--neg={profitPercent < 0}
								data-test="variant-profit-percent"
							>
								{lang === 'vi' ? 'Lợi nhuận' : 'Profit'}: {profitPercent > 0 ? '+' : ''}{profitPercent}%
							</span>
						{/if}
					</TextField>
				</div>

				<div class="grid-2">
					<TextField name="variant-weight">
						<Label>{pageContents.weightLabel[lang]}</Label>
						<Input type="number" bind:value={formData.weight} />
					</TextField>
					<!-- SỬA: ImageUpload (upload thẳng hosting ngoài + preview + xoá)
					     thay URL input tay — bind cùng field formData.imageUrl -->
					<div>
						<ImageUpload bind:value={formData.imageUrl} label={pageContents.imageLabel[lang]} />
					</div>
				</div>

				<!-- Thuộc tính (key-value động) -->
				<fieldset class="attr-fieldset">
					<legend class="modal-field-label">{pageContents.attributesLabel[lang]}</legend>
					<div class="attr-rows">
						{#each Object.entries(formData.attributes) as [attrName, attrValue], i (attrName)}
							<div class="variant-row">
								<input
									class="modal-input"
									placeholder={pageContents.attrNamePlaceholder[lang]}
									value={attrName}
									oninput={(e) => {
										const newName = (e.target as HTMLInputElement).value;
										if (newName !== attrName) {
											const newAttrs = { ...formData.attributes };
											delete newAttrs[attrName];
											if (newName) newAttrs[newName] = attrValue;
											formData.attributes = newAttrs;
										}
									}}
								/>
								<input
									class="modal-input"
									placeholder={pageContents.attrValuePlaceholder[lang]}
									value={attrValue}
									oninput={(e) => {
										formData.attributes = {
											...formData.attributes,
											[attrName]: (e.target as HTMLInputElement).value
										};
									}}
								/>
								<Button
									variant="ghost"
									size="sm"
									color="error"
									onClick={() => {
										const newAttrs = { ...formData.attributes };
										delete newAttrs[attrName];
										formData.attributes = newAttrs;
									}}
									aria-label="Remove attribute"
								>
									✕
								</Button>
							</div>
						{/each}
						<Button variant="outline" size="sm" onClick={addAttribute}>
							{pageContents.addAttr[lang]}
						</Button>
					</div>
				</fieldset>

				<!-- Nâng cao -->
				<fieldset class="attr-fieldset">
					<legend class="modal-field-label">{pageContents.advancedLabel[lang]}</legend>
					<div class="grid-2">
						<div class="advanced-check">
							<Checkbox bind:checked={formData.trackLot}>
								{pageContents.trackLotLabel[lang]}
							</Checkbox>
						</div>
						<div class="advanced-check">
							<Checkbox bind:checked={formData.trackExpiry}>
								{pageContents.trackExpiryLabel[lang]}
							</Checkbox>
						</div>
						<div class="advanced-check">
							<Checkbox bind:checked={formData.trackSerial}>
								{pageContents.trackSerialLabel[lang]}
							</Checkbox>
						</div>
						<TextField name="variant-low-stock">
							<Label>{pageContents.lowStockLabel[lang]}</Label>
							<Input type="number" bind:value={formData.lowStockThreshold} />
						</TextField>
						<TextField name="variant-status">
							<Label>{pageContents.statusLabel[lang]}</Label>
							<select
								class="modal-select"
								bind:value={formData.status}
								aria-label={pageContents.statusLabel[lang]}
							>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
								<option value="draft">Draft</option>
								<option value="discontinued">Discontinued</option>
							</select>
						</TextField>
					</div>

					<!-- Đơn vị quy đổi (P2) — dòng đầu = base (factor 1) -->
					<div class="units-block">
						<div class="units-head">
							<span class="modal-field-label">{pageContents.unitsLabel[lang]}</span>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									formData.units = [...formData.units, { name: '', factor: '1', price: '' }];
								}}
								data-test="variant-add-unit"
							>
								{pageContents.addUnit[lang]}
							</Button>
						</div>
						{#if formData.units.length > 0}
							<div class="units-rows">
								{#each formData.units as unit, i (i)}
									<div class="units-row" data-test={`variant-unit-${i}`}>
										<input
											class="modal-input"
											placeholder={pageContents.unitName[lang]}
											bind:value={unit.name}
										/>
										<input
											class="modal-input units-factor"
											type="number"
											min="1"
											step="1"
											disabled={i === 0}
											bind:value={unit.factor}
											aria-label={pageContents.unitFactor[lang]}
										/>
										<input
											class="modal-input units-price"
											type="number"
											min="0"
											placeholder={pageContents.unitPrice[lang]}
											bind:value={unit.price}
										/>
										{#if i > 0}
											<Button
												variant="ghost"
												color="error"
												size="sm"
												onClick={() => {
													formData.units = formData.units.filter((_, idx) => idx !== i);
												}}
											>
												{pageContents.deleteAction[lang]}
											</Button>
										{/if}
									</div>
								{/each}
								<p class="units-note">{pageContents.unitsNote[lang]}</p>
							</div>
						{/if}
					</div>
				</fieldset>
			</ModalBody>
			<ModalFooter class="modal-footer">
				{#if editingVariant}
					<!-- B5: mobile tap row mở modal edit — nút Xoá để xóa ngay từ modal. -->
					<Button
						variant="ghost"
						color="error"
						disabled={formSubmitting}
						data-test="variant-modal-delete"
						onClick={() => {
							const variant = editingVariant;
							closeModals();
							if (variant) void deleteVariant(variant);
						}}
					>
						{pageContents.deleteAction[lang]}
					</Button>
				{/if}
				<Button
					variant="outline"
					onClick={() => { closeGuard.attemptClose(); }}
					disabled={formSubmitting}
				>
					{pageContents.cancel[lang]}
				</Button>
				<Button
					variant="solid"
					color={editingVariant ? 'primary' : 'success'}
					loading={formSubmitting}
					onClick={submitForm}
				>
					{editingVariant ? pageContents.saveEdit[lang] : pageContents.saveCreate[lang]}
				</Button>
			</ModalFooter>
		</ModalContainer>
	</Modal>

	<!-- ── B9: dialog hỏi khôi phục bản nháp ── -->
	<DraftRestoreDialog
		bind:display={draftRestoreDisplay}
		onRestore={applyDraftRestore}
		onDiscard={discardDraft}
		{lang}
	/>

	<!-- ── P3: dialog xác nhận khi đóng modal mà form còn dirty ── -->
	<DirtyCloseDialog
		bind:open={dirtyCloseDisplay}
		title={{ vi: 'Bỏ thay đổi?', en: 'Discard changes?' }}
		description={{
			vi: 'Form của bạn có thay đổi chưa lưu. Nếu bỏ bây giờ, các thay đổi này sẽ mất.',
			en: 'Your form has unsaved changes. If you discard now, these changes will be lost.'
		}}
		discardLabel={{ vi: 'Bỏ thay đổi', en: 'Discard' }[lang]}
		continueLabel={{ vi: 'Tiếp tục chỉnh sửa', en: 'Keep editing' }[lang]}
		onDiscard={closeGuard.confirmDiscard}
	/>

	<!-- ── B54: Setting modal (filter product + showDeleted + sort) ── -->
	{#if settingModalDisplay}
		<Modal bind:display={settingModalDisplay} size="sm" class="supplier-modal-root">
			<ModalContainer>
				<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
					<div class="supplier-modal-title">
						<span class="supplier-modal-title__label">{pageContents.title[lang]}</span>
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.settings.title[lang]}
						</span>
					</div>
				</ModalHeader>
				<ModalBody class="modal-body">
					<TextField name="variants-setting-product">
						<Label>{pageContents.settings.product[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={selectedProduct}
							options={settingProductOptions}
							remoteSearch
							loadOptions={loadFormProductOptions}
							searchable
							clearable
							placeholder={pageContents.allProducts[lang]}
							fullscreen={isMobile}
						/>
					</TextField>
					<TextField name="variants-setting-sort">
						<Label>{pageContents.settings.sortBy[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={settingSortField}
							options={settingSortOptions}
							clearable
							fullscreen={isMobile}
						/>
					</TextField>
					<TextField name="variants-setting-direction">
						<Label>{pageContents.settings.sortDirection[lang]}</Label>
						<Select
							class="admin-filter-select"
							size="sm"
							bind:value={settingSortDirection}
							options={[
								{ value: 'asc', label: pageContents.settings.sortAsc[lang] },
								{ value: 'desc', label: pageContents.settings.sortDesc[lang] }
							]}
							fullscreen={isMobile}
						/>
					</TextField>
					<Checkbox bind:checked={showDeleted}>
						{pageContents.showDeleted[lang]}
					</Checkbox>
				</ModalBody>
				<ModalFooter class="modal-footer">
					<Button
						color="secondary"
						variant="outline"
						disabled={selectedProduct === '' && settingSortField === ''}
						onclick={() => {
							settingSortField = '';
							settingSortDirection = 'desc';
							selectedProduct = '';
							showDeleted = false;
						}}
					>
						{pageContents.settings.reset[lang]}
					</Button>
					<Button
						color="primary"
						data-test="variants-setting-apply"
						onclick={applySettingModal}
					>
						{pageContents.settings.apply[lang]}
					</Button>
				</ModalFooter>
			</ModalContainer>
		</Modal>
	{/if}

	<!-- ── B54: quick-create product từ Select ── -->
	{#if quickCreateDisplay}
		<Modal
			bind:display={quickCreateDisplay}
			size="sm"
			class="supplier-modal-root"
			onCloseAttempt={() => {
				if (!quickCreateBusy) closeQuickCreate();
			}}
		>
			<ModalContainer>
				<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
					<div class="supplier-modal-title" bind:this={qcCrumbTitleEl}>
						{#if isMobile && qcCrumbHidden}
							<button
								type="button"
								class="supplier-modal-title__more"
								aria-label={pageContents.crumbMore[lang]}
								aria-expanded={qcCrumbMoreOpen}
								onclick={() => (qcCrumbMoreOpen = !qcCrumbMoreOpen)}
							>
								<Icon icon={iconify['more-horiz-rounded']} size="sm" />
							</button>
							{#if qcCrumbMoreOpen}
								<div class="supplier-crumb-popover" role="menu">
									<button
										type="button"
										class="supplier-crumb-popover__item"
										onclick={() => {
											qcCrumbMoreOpen = false;
											closeQuickCreate();
										}}
									>
										{pageContents.title[lang]}
									</button>
								</div>
							{/if}
						{/if}
						{#if !isMobile || !qcCrumbHidden}
							{#if isMobile}
								<button
									type="button"
									class="supplier-modal-title__label supplier-modal-title__crumb"
									onclick={() => closeQuickCreate()}
								>
									{pageContents.title[lang]}
								</button>
							{:else}
								<span class="supplier-modal-title__label">{pageContents.title[lang]}</span>
							{/if}
						{/if}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.quickCreate.title[lang]}
						</span>
					</div>
				</ModalHeader>
				<ModalBody class="modal-body">
					<TextField name="quick-create-name" required>
						<Label>{pageContents.quickCreate.nameLabel[lang]}</Label>
						<Input
							type="text"
							bind:value={quickCreateName}
							placeholder={quickCreatePendingValue}
						/>
					</TextField>
				</ModalBody>
				<ModalFooter class="modal-footer">
					<Button color="secondary" variant="ghost" disabled={quickCreateBusy} onclick={closeQuickCreate}>
						{pageContents.quickCreate.cancel[lang]}
					</Button>
					<Button
						color="success"
						loading={quickCreateBusy}
						disabled={quickCreateBusy || !quickCreateName.trim()}
						onclick={() => void submitQuickCreate()}
					>
						{pageContents.quickCreate.createBtn[lang]}
					</Button>
				</ModalFooter>
			</ModalContainer>
		</Modal>
	{/if}

	<!-- ── B54: AlertDialog xác nhận bulk delete ── -->
	{#if bulkDeleteDisplay}
		<AlertDialog bind:open={bulkDeleteDisplay} title={pageContents.bulk.title[lang]} description={pageContents.bulk.desc[lang]}>
			<AlertDialog.Content>
				<AlertDialog.Header variant="danger">
					<AlertDialog.Title>{pageContents.bulk.title[lang]}</AlertDialog.Title>
					<AlertDialog.Description>
						{pageContents.bulk.desc[lang].replace('{count}', String(bulkDisplayCount))}
					</AlertDialog.Description>
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
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.admin-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
	}

	.admin-subtitle {
		font-size: 0.875rem;
		color: var(--muted);
		margin-top: 0.25rem;
	}

	.admin-header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.admin-filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;

		/* B5: sticky dưới admin header (mobile — var đo bằng ResizeObserver
		   trên .admin-inset). margin-block âm giữ nhịp gap 1rem của .admin-page. */
		@media (max-width: 767px) {
			position: sticky;
			top: var(--admin-header-h, 0px);
			z-index: 400;
			background: var(--background, #fff);
			padding-block: 0.25rem;
			margin-block: -1rem;
		}
	}

	.admin-search {
		position: relative;
		flex: 1;
		min-width: 220px;
		max-width: 320px;
	}

	.admin-select {
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		color: var(--foreground);
		font-size: 0.8125rem;
	}

	.admin-state {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	.admin-state--error {
		background: color-mix(in srgb, var(--danger, #ef4444) 10%, transparent);
		color: var(--danger, #ef4444);
		border: 1px solid color-mix(in srgb, var(--danger, #ef4444) 25%, transparent);
	}

	.admin-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);

		/* B5: card mode mobile — bỏ khung bảng rỗng (card tự có border). */
		@media (max-width: 767px) {
			border: 0;
			border-radius: 0;
		}

		/* Sticky thead: wrap overflow-x auto tạo scroll context — th sticky bám
		   theo wrap (không cuộn) → thead trượt mất. Mở overflow khi DataTable
		   có stickyHead (cả mobile + desktop; cuộn ngang do .datatable-table-wrap
		   tự cuộn — rule max-1024/min-768 của component đã mở overflow visible). */
		&:has(:global(.datatable-sticky-head)) {
			overflow-x: visible;
		}
	}

	/* Nút action trong cột actions DataTable (snippet actionsContent). */
	.row-actions {
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
	}

	.admin-pagination {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.25rem;

		/* B5: sticky đáy viewport khi list dài hơn màn hình (mobile). */
		@media (max-width: 767px) {
			position: sticky;
			bottom: 0;
			z-index: 300;
			background: var(--background, #fff);
			padding-block: 0.5rem;
			margin-block: -1rem;
		}
	}

	.total-count {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.page-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.page-size {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--muted);

		select {
			padding: 0.25rem 0.5rem;
			border-radius: 0.375rem;
			border: 1px solid var(--default-300);
			background: var(--background);
			color: var(--foreground);
			font-size: 0.8125rem;
		}
	}

	.modal-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.modal-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.grid-2 {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));

		@media (max-width: 640px) {
			grid-template-columns: 1fr;
		}
	}

	.modal-field-label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--foreground);
		margin-bottom: 0.5rem;
	}

	.field-error {
		display: block;
		font-size: 0.75rem;
		color: var(--danger, #ef4444);
		margin-top: 0.25rem;
	}

	/* ── P2: % lợi nhuận + gợi ý giá + đơn vị quy đổi ── */
	.profit-badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--success, #16a34a);
		margin-top: 0.25rem;

		&--neg {
			color: var(--danger, #ef4444);
		}
	}

	.price-hint {
		display: inline-block;
		font-size: 0.75rem;
		color: var(--primary);
		background: none;
		border: none;
		padding: 0;
		margin-top: 0.25rem;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-style: dotted;

		&:hover {
			text-decoration-style: solid;
		}
	}

	.units-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.units-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.units-rows {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.units-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;

		.modal-input {
			flex: 1;
		}
	}

	.units-factor {
		flex: 0 0 5.5rem !important;
	}

	.units-price {
		flex: 0 0 8rem !important;
	}

	.units-note {
		font-size: 0.72rem;
		color: var(--muted-foreground, #6b7280);
		margin: 0;
	}

	.modal-select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		color: var(--foreground);
		font: inherit;
	}

	.modal-input {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		color: var(--foreground);
		font: inherit;

		&:focus {
			outline: 2px solid var(--primary);
			outline-offset: -1px;
		}
	}

	.attr-fieldset {
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.attr-rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.variant-row {
		display: flex;
		gap: 0.5rem;
		width: 100%;
		align-items: center;
	}

	.advanced-check {
		display: flex;
		align-items: center;
		// Căn hàng select cạnh checkbox trên cùng 1 grid-row.
		padding-top: 1.75rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	/* B5: nút Xoá trong modal edit — đẩy sang trái (tách khỏi nhóm Cancel/Save). */
	/* B5: :global toan phan — footer render qua ModalFooter (scope khac),
	   anchor scoped .modal-footer khong match. */
	:global(.modal-footer [data-test='variant-modal-delete']) {
		margin-right: auto;
	}

	/* ── B54: search suggest + mobile caption icon ── */
	.admin-search-loading {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
	}
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
	@media (max-width: 767px) {
		:global(.admin-filters .admin-actions-group .button-root) {
			height: 2.25rem;
			min-height: 2.25rem;
		}
	}

	/* ── B54: bulk bar ── */
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
	@media (max-width: 767px) {
		.bulk-row {
			position: fixed;
			left: 0;
			right: 0;
			bottom: calc(2.75rem + 0.75rem);
			z-index: 310;
			padding: 0.5rem 0.75rem;
			background: var(--background, #fff);
			border-top: 1px solid var(--default-300);
			padding-right: 4.75rem;
		}
		.admin-page.is-scrolling .bulk-row {
			opacity: 0;
			pointer-events: none;
			transition: opacity 150ms ease;
		}
		.admin-page .bulk-row {
			transition: opacity 150ms ease;
		}
	}

	/* ── B54: FAB mobile ── */
	.fab-group {
		position: fixed;
		right: 1rem;
		bottom: 7.25rem;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.6rem;
		z-index: 400;
		transition: opacity 200ms ease;
		&.fab-hidden {
			opacity: 0;
			pointer-events: none;
		}
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
		transition:
			transform 0.15s ease,
			box-shadow 0.15s ease;
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
	@media (max-width: 767px) {
		.admin-page--fullheight {
			padding-bottom: 12rem;
		}
		.admin-pagination {
			padding-right: 4.75rem;
		}
	}

	/* ── B54: modal title crumbs ── */
	.supplier-modal-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		position: relative;
		z-index: 3;
	}
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
		box-shadow: var(--box-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
	}
	.supplier-crumb-popover__item {
		display: block;
		width: 100%;
		padding: 0.45rem 0.6rem;
		text-align: left;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
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
	.supplier-modal-title__name--active {
		color: var(--foreground);
		font-weight: 600;
	}
	.supplier-modal-title__name[aria-hidden='true'] {
		flex: none;
		overflow: visible;
	}
	@media (hover: none), (pointer: coarse), (max-width: 640px) {
		:global(.supplier-modal-root .modal-header-root) {
			padding-block: 0.5rem;
			justify-content: flex-start;
		}
	}
	:global(.supplier-modal-root .modal-container-root .modal-close-button) {
		--color: var(--foreground-500, #6b7280) !important;
		--border-color: transparent !important;
	}
	@media (hover: hover) and (pointer: fine) {
		:global(.supplier-modal-root .modal-container-root .modal-close-button) {
			&:hover {
				--background: var(--default-200, #e5e7eb);
				--color: var(--foreground);
			}
		}
	}
</style>
