<script lang="ts">
	// src/routes/(authorized)/admin/products/+page.svelte
	// B6.2: migrate sang DataTable + Pagination (pattern users/brands page).
	// FIX BUG pre-existing: page cũ fetch GET ?params + đọc data.success/items
	// nhưng endpoint chỉ export POST (readAdminRequest mã hoá RSA) → bảng
	// không bao giờ render. Chuyển sang encryption.fetchSecure POST.
	import { onMount, flushSync, tick } from 'svelte';
	import { AlertDialog, Button, DataTable, Pagination, Spinner } from '$components/element';
	import { ImageUpload, Input, Label, TextField, Select, Textarea } from '$components/form';
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
	// B54: search-suggest + setting-modal prefs (pattern suppliers page).
	import { recordSearchKeyword, getSearchKeywords, saveDataTablePrefs, userPrefs } from '$store/user-prefs.svelte';
	import DraftRestoreDialog from '../../_DraftRestoreDialog.svelte';
	import { createCloseGuard } from '$modules/close-guard.svelte';

	import { subscribeDbChanges } from '$modules/db-realtime';
	// P3: dialog xác nhận khi đóng modal với form còn dirty.
	import DirtyCloseDialog from '../DirtyCloseDialog.svelte';
	// Types
	// B56: variant item cho bảng Thống kê (modal products — chỉ fields hiển thị).
interface VariantListItem {
	_id: string;
	sku?: string;
	displayName?: string;
	price?: number;
	status?: string;
}
interface ProductListItem {
		_id: string;
		name: string;
		description?: string;
		categoryId?: string;
		brandId?: string;
		hasVariants: boolean;
		variantAttributes?: Record<string, string[]>;
		imageUrl?: string;
		status: string;
		createdBy?: string;
		createdAt: string;
		updatedAt: string;
		deletedAt?: string | null;
	}

	interface OptionItem {
		_id: string;
		name: string;
	}

	// Ngôn ngữ
	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : (client.browser?.language === 'en' ? 'en' : 'en')
	);

	// Type mở (pattern users/brands page) — lang index không narrow.
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Sản phẩm', en: 'Products' },
		subtitle: { vi: 'Quản lý danh mục sản phẩm', en: 'Manage your product catalog' },
		addProduct: { vi: 'Thêm sản phẩm', en: 'Add Product' },
		searchPlaceholder: { vi: 'Tìm sản phẩm…', en: 'Search products…' },
		allCategories: { vi: 'Tất cả danh mục', en: 'All Categories' },
		allBrands: { vi: 'Tất cả thương hiệu', en: 'All Brands' },
		showDeleted: { vi: 'Hiện đã xoá', en: 'Show deleted' },
		empty: { vi: 'Chưa có sản phẩm', en: 'No products found' },
		loading: { vi: 'Đang tải…', en: 'Loading products…' },
		createTitle: { vi: 'Tạo sản phẩm', en: 'Create Product' },
		editTitle: { vi: 'Sửa sản phẩm', en: 'Edit Product' },
		nameLabel: { vi: 'Tên sản phẩm', en: 'Product Name' },
		descLabel: { vi: 'Mô tả', en: 'Description' },
		imageLabel: { vi: 'URL ảnh', en: 'Image URL' },
		categoryLabel: { vi: 'Danh mục', en: 'Category' },
		brandLabel: { vi: 'Thương hiệu', en: 'Brand' },
		statusLabel: { vi: 'Trạng thái', en: 'Status' },
		variantsLabel: { vi: 'Thuộc tính biến thể', en: 'Variant Attributes' },
		hasVariantsLabel: { vi: 'Sản phẩm có biến thể', en: 'This product has variants' },
		attrNamePlaceholder: { vi: 'Tên thuộc tính (vd: Size, Color)', en: 'Attribute name (e.g., Size, Color)' },
		attrValuesPlaceholder: { vi: 'Giá trị (cách nhau bằng dấu phẩy)', en: 'Values (comma separated)' },
		addAttr: { vi: 'Thêm thuộc tính', en: 'Add Attribute' },
		cancel: { vi: 'Huỷ', en: 'Cancel' },
		saveCreate: { vi: 'Tạo sản phẩm', en: 'Create Product' },
		saveEdit: { vi: 'Lưu thay đổi', en: 'Save Changes' },
		editAction: { vi: 'Sửa', en: 'Edit' },
		deleteAction: { vi: 'Xoá', en: 'Delete' },
		productCol: { vi: 'Sản phẩm', en: 'Product' },
		variantsCol: { vi: 'Biến thể', en: 'Variants' },
		updated: { vi: 'Cập nhật', en: 'Updated' },
		totalCount: { vi: '{n} sản phẩm', en: '{n} products' },
		attrCount: { vi: '{n} thuộc tính', en: '{n} attributes' },
		simpleProduct: { vi: 'Đơn giản', en: 'Simple' },
		states: {
			loadFailed: { vi: 'Không tải được danh sách sản phẩm', en: 'Failed to load products' },
			created: { vi: 'Đã tạo sản phẩm', en: 'Product created' },
			updated: { vi: 'Đã lưu thay đổi', en: 'Product updated' },
			deleted: { vi: 'Đã xoá sản phẩm', en: 'Product deleted' },
			deleteFailed: { vi: 'Không xoá được sản phẩm', en: 'Failed to delete product' },
			operationFailed: { vi: 'Thao tác thất bại', en: 'Operation failed' },
			networkError: { vi: 'Lỗi kết nối', en: 'Network error' }
		},
		// B54: search suggest + setting modal + bulk + crumb + quick-create.
		search: { vi: 'Tìm kiếm', en: 'Search' },
		suggest: { vi: 'Từ khoá đã tìm', en: 'Recent searches' },
		crumbMore: { vi: 'Xem đường dẫn', en: 'Show path' },
		settings: {
			title: { vi: 'Cài đặt danh sách', en: 'List settings' },
			filterCategory: { vi: 'Danh mục', en: 'Category' },
			filterBrand: { vi: 'Thương hiệu', en: 'Brand' },
			showDeleted: { vi: 'Hiện đã xoá', en: 'Show deleted' },
			apply: { vi: 'Áp dụng', en: 'Apply' },
			reset: { vi: 'Đặt lại', en: 'Reset' }
		},
		bulk: {
			selected: { vi: 'Đã chọn {count}', en: '{count} selected' },
			copy: { vi: 'Copy', en: 'Copy' },
			delete: { vi: 'Xoá', en: 'Delete' },
			title: { vi: 'Xoá sản phẩm đã chọn?', en: 'Delete selected products?' },
			desc: {
				vi: '{count} sản phẩm sẽ bị xoá. Sản phẩm còn biến thể sẽ không xoá được.',
				en: '{count} products will be deleted. Products with variants cannot be deleted.'
			},
			confirm: { vi: 'Xoá', en: 'Delete' },
			cancel: { vi: 'Huỷ', en: 'Cancel' }
		},
		toasts: {
			bulkCopied: { vi: 'Đã copy {count} dòng', en: 'Copied {count} rows' },
			bulkDeleted: { vi: 'Đã xoá {count} sản phẩm', en: 'Deleted {count} products' },
			bulkDeleteFailed: { vi: 'Không xoá được sản phẩm đã chọn', en: 'Failed to delete selected products' },
			copiedFailed: { vi: 'Không copy được', en: 'Failed to copy' }
		},
		quickCreate: {
			title: { vi: 'Tạo mới nhanh', en: 'Quick create' },
			create: { vi: 'Tạo', en: 'Create' },
			createNew: { vi: 'Tạo mới "{value}"', en: 'Create new "{value}"' },
			nameLabel: { vi: 'Tên', en: 'Name' },
			failed: { vi: 'Tạo mới thất bại. Vui lòng thử lại.', en: 'Failed to create. Please try again.' }
		},
		// ── B55: more menu + stats modal + delete confirm ──
		more: {
			label: { vi: 'Thêm tuỳ chọn', en: 'More options' },
			stats: { vi: 'Thống kê', en: 'Statistics' },
			delete: { vi: 'Xoá', en: 'Delete' },
			analytics: { vi: 'Phân tích nhập hàng', en: 'Purchase analytics' },
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
		statsModal: {
			title: { vi: 'Thống kê', en: 'Statistics' },
			variants: { vi: 'Số biến thể', en: 'Variants' },
			close: { vi: 'Đóng', en: 'Close' },
			variantsCol: { vi: 'Tên biến thể', en: 'Variant' },
			skuCol: { vi: 'SKU', en: 'SKU' },
			priceCol: { vi: 'Giá', en: 'Price' },
			statusCol: { vi: 'Trạng thái', en: 'Status' }
		},
		deleteConfirm: {
			title: { vi: 'Xoá sản phẩm', en: 'Delete product' },
			desc: { vi: 'Sản phẩm sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.', en: 'The product will be permanently deleted. This action cannot be undone.' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			confirm: { vi: 'Xoá', en: 'Delete' }
		}
	};

	// ── Cặp khoá RSA cho mọi fetchSecure trên trang ──
	let encryptionKeys = $state<
		| undefined
		| { publicKey: CryptoKey; privateKey: CryptoKey }
	>(undefined);

	// State
	let products = $state<ProductListItem[]>([]);
	let categories = $state<OptionItem[]>([]);
	let brands = $state<OptionItem[]>([]);
	let loading = $state(false);
let searching = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let selectedCategory = $state('');
	let selectedBrand = $state('');
	let showDeleted = $state(false);

	// ── Options cho component Select (searchable) — category/brand filter + modal ──
	const categorySelectOptions = $derived(categories.map((c) => ({ value: c._id, label: c.name })));
	const brandSelectOptions = $derived(brands.map((b) => ({ value: b._id, label: b.name })));

	// Options cho Select status trong form modal (label giữ tiếng Anh như option RAW cũ).
	const productStatusOptions = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' },
		{ value: 'draft', label: 'Draft' },
		{ value: 'discontinued', label: 'Discontinued' }
	];

	// ── B54: isMobile + scroll state (pattern suppliers — minimal) ──
	const isMobile = $derived(client.browser?.isMobile ?? false);
	let wrapEl = $state<HTMLElement | undefined>(undefined);
	let tableScrolled = $state(false);
	// B56: at-bottom — cuộn tới đáy bảng → bỏ padding-block page (mở rộng row);
	// paginationPopped: tick 450ms kích at-bottom một lần (pattern suppliers).
	let wrapAtBottom = $state(false);
	let paginationPopped = $state(false);
	let scrollActive = $state(false);
	let scrollRaf = 0;
	let scrollActiveTimer: ReturnType<typeof setTimeout> | undefined;
	let lastActiveScrollTop = -1;

	// markScrollActive: bật scrollActive (ẩn bulk-row/FAB khi đang cuộn), timer
	// 200ms tắt lại. Rubber-band iOS (top<0 / top>maxScroll) bỏ qua.
	function markScrollActive(scrollTop: number, maxScroll: number) {
		const rubber = scrollTop < 0 || scrollTop > maxScroll;
		if (!rubber && scrollTop !== lastActiveScrollTop) scrollActive = true;
		lastActiveScrollTop = scrollTop;
		if (scrollActiveTimer) clearTimeout(scrollActiveTimer);
		scrollActiveTimer = setTimeout(() => {
			scrollActive = false;
			lastActiveScrollTop = -1;
		}, 200);
	}

	// onTableScroll: cuộn TRONG table wrap (desktop + mobile).
	function onTableScroll() {
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			const el = wrapEl;
			if (!el) return;
			markScrollActive(el.scrollTop, el.scrollHeight - el.clientHeight);
			const scrollTop = el.scrollTop;
			const scrollable = el.scrollHeight > el.clientHeight + 4;
			const atBottom = scrollable && scrollTop + el.clientHeight >= el.scrollHeight - 4;
			tableScrolled = scrollTop > 8 && scrollable;
			wrapAtBottom = atBottom;
			if (atBottom && !paginationPopped) {
				paginationPopped = true;
				setTimeout(() => (paginationPopped = false), 450);
			} else if (!atBottom) {
				paginationPopped = false;
			}
		});
	}

	// findScrollContainer: walk-up tìm ancestor cuộn được (mobile — table wrap
	// overflow visible khi stickyHead, cuộn thật sự ở window/parent).
	function findScrollContainer(start: HTMLElement | null): HTMLElement | null {
		let el: HTMLElement | null = start;
		while (el && el !== document.body) {
			const style = window.getComputedStyle(el);
			const oy = style.overflowY;
			if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 4) return el;
			el = el.parentElement;
		}
		return null;
	}

	// onWindowScroll: scroll không bubble — bắt capture trên document; NHƯỜNG
	// wrapEl nếu nó đang cuộn được (guard sớm — 2 handler chung scrollRaf).
	function onWindowScroll(event: Event) {
		const wrapNow = wrapEl;
		if (wrapNow && wrapNow.scrollHeight > wrapNow.clientHeight + 4) return;
		if (scrollRaf) return;
		const target = event.target as HTMLElement | null;
		const container = target instanceof HTMLElement ? (findScrollContainer(target) ?? document.documentElement) : document.documentElement;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			const top = container === document.documentElement ? window.scrollY : container.scrollTop;
			const viewH = container === document.documentElement ? window.innerHeight : container.clientHeight;
			const totalH = container === document.documentElement ? document.documentElement.scrollHeight : container.scrollHeight;
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

	// ── B54: search-suggest state ──
	let searchFocused = $state(false);
	let suggestOpen = $state(false);
	let mobileSearchOpen = $state(false);
	let mobileSearchInputInstance = $state<{ configs: { focus: () => void } } | undefined>(undefined);

	// Lưu keyword khi blur / chọn suggest.
	function saveSearchKeyword() {
		const kw = (searchQuery ?? '').trim();
		if (kw) recordSearchKeyword('/admin/products', kw);
	}
	const recentKeywordsFiltered = $derived.by(() => {
		const q = (searchQuery ?? '').toLowerCase();
		return getSearchKeywords('/admin/products').filter((kw) => kw.toLowerCase().includes(q));
	});

	// ── B54: bulk selection state ──
	let selectedIds = $state<string[]>([]);
	let allFilteredSelected = $state(false);
	let selectAllBusy = $state(false);
	let bulkDeleteDisplay = $state(false);
	let bulkDeleting = $state(false);
	let bulkDisplayCount = $derived(selectedIds.length);

	// Chọn tất cả (filtered mode): fetch toàn bộ ids khớp filter hiện tại.
	async function selectAllFilteredProducts() {
		if (selectAllBusy || !encryptionKeys) return;
		selectAllBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/list',
				{
					method: 'POST',
					body: {
						page: 1,
						pageSize: Math.max(total, 1),
						includeDeleted: showDeleted,
						search: searchQuery || undefined,
						categoryId: selectedCategory || undefined,
						brandId: selectedBrand || undefined
					}
				},
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: ProductListItem[] } | undefined;
				selectedIds = (data?.items ?? []).map((p) => p._id);
				allFilteredSelected = selectedIds.length > 0;
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[products] select all error:', err);
		} finally {
			selectAllBusy = false;
		}
	}

	function clearProductsSelection() {
		selectedIds = [];
		allFilteredSelected = false;
	}

	// allFilteredSelected=true nhưng selection bị giảm (user uncheck 1 row) → tắt.
	$effect(() => {
		if (allFilteredSelected && selectedIds.length < total) allFilteredSelected = false;
	});

	// Bulk copy TSV (pattern suppliers): header + các dòng được chọn.
	async function bulkCopySelected() {
		if (!navigator.clipboard) return;
		const cols = columns.filter((c) => c.id !== 'actions' && typeof c.accessor === 'function');
		const header = cols.map((c) => String(c.label)).join('\t');
		const rows = products
			.filter((p) => selectedIds.includes(p._id))
			.map((p) =>
				cols
					.map((c) => String((c.accessor as (row: Record<string, unknown>) => unknown)(p as unknown as Record<string, unknown>) ?? ''))
					.join('\t')
			);
		const tsv = [header, ...rows].join('\n');
		navigator.clipboard
			.writeText(tsv)
			.then(() => showToast(pageContents.toasts.bulkCopied[lang].replace('{count}', String(selectedIds.length))))
			.catch(() => showToast(pageContents.toasts.copiedFailed[lang], 'error'));
	}

	// Bulk delete → POST /api/admin/products/bulk.
	async function bulkDeleteSelected() {
		if (bulkDeleting || !encryptionKeys || selectedIds.length === 0) return;
		bulkDeleting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/bulk',
				{ method: 'POST', body: { ids: selectedIds } },
				encryptionKeys
			);
			bulkDeleting = false;
			if (response.ok) {
				const data = response.data as { deleted?: number } | undefined;
				showToast(pageContents.toasts.bulkDeleted[lang].replace('{count}', String(data?.deleted ?? 0)));
				bulkDeleteDisplay = false;
				clearProductsSelection();
				await fetchProducts();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.bulkDeleteFailed), 'error');
			}
		} catch (err) {
			bulkDeleting = false;
			showToast(pageContents.toasts.bulkDeleteFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[products] bulk delete error:', err);
		}
	}

	// ── B54: setting modal state (category/brand/showDeleted) ──
	let settingModalDisplay = $state(false);
	// Draft trong modal: chỉ Apply mới ghi về filter thật + saveDataTablePrefs.
	let settingCategory = $state('');
	let settingBrand = $state('');
	let settingShowDeleted = $state(false);

	// ── B54: modal crumb more-popover state ──
	// B56: breadcrumb modal Thống kê (state riêng — modal khác form modal).
	let statsCrumbNavEl = $state<HTMLElement | null>(null);
	let statsCrumbOverflow = $state(0);
	let statsCrumbMoreOpen = $state(false);
	// B56: breadcrumb modal Phân tích.
	let anaCrumbNavEl = $state<HTMLElement | null>(null);
	let anaCrumbOverflow = $state(0);
	let anaCrumbMoreOpen = $state(false);
	let crumbTitleEl = $state<HTMLElement | undefined>(undefined);
	let productsCrumbHidden = $state(false);
	let crumbMoreOpen = $state(false);

	// Đo tràn: item CUỐI trong crumb (active name hoặc crumb button) — nếu
	// scrollWidth vượt clientWidth +1 → gom vào more popover.
	async function measureCrumbOverflow() {
		if (!isMobile || !crumbTitleEl) return;
		if (productsCrumbHidden) {
			productsCrumbHidden = false;
			await tick();
		}
		const activeEl = crumbTitleEl.querySelector<HTMLElement>('.supplier-modal-title__name--active');
		const crumbEl = crumbTitleEl.querySelector<HTMLElement>('.supplier-modal-title__crumb');
		const overflowEl = activeEl ?? crumbEl;
		productsCrumbHidden = !!overflowEl && overflowEl.scrollWidth > overflowEl.clientWidth + 1;
	}

	// Ẩn/hiện label gốc: hidden → hiện more button; mở lại modal → reset.
	$effect(() => {
		void modalOpen;
		void crumbTitleEl;
		void formData.name;
		void editingProduct;
		void isMobile;
		const raf = requestAnimationFrame(() => void measureCrumbOverflow());
		const ro = new ResizeObserver(() => requestAnimationFrame(() => void measureCrumbOverflow()));
		if (crumbTitleEl) ro.observe(crumbTitleEl);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
	$effect(() => {
		if (!modalOpen) {
			productsCrumbHidden = false;
			crumbMoreOpen = false;
		}
	});

	// B56: đo tràn breadcrumb 3 nấc cho modal con (pattern suppliers measureTitleCrumbs).
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
		const anyTruncated = () => {
			for (const item of nav.children) {
				const el = item as HTMLElement;
				const cls = el.className || '';
				if (typeof cls === 'string' && (cls.includes('supplier-modal-title__more') || cls.includes('supplier-crumb-popover'))) continue;
				if (el.scrollWidth > el.clientWidth + 1) return true;
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

	$effect(() => {
		void productStatsDisplay;
		void productStatsLoading;
		void editingProduct?.name;
		void isMobile;
		void lang;
		const raf = requestAnimationFrame(() => void measureTitleCrumbs(statsCrumbNavEl, !isMobile, () => statsCrumbOverflow, (v) => (statsCrumbOverflow = v)));
		const ro = new ResizeObserver(() => requestAnimationFrame(() => void measureTitleCrumbs(statsCrumbNavEl, !isMobile, () => statsCrumbOverflow, (v) => (statsCrumbOverflow = v))));
		if (statsCrumbNavEl) ro.observe(statsCrumbNavEl);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});

	$effect(() => {
		if (!productStatsDisplay) {
			statsCrumbOverflow = 0;
			statsCrumbMoreOpen = false;
		}
	});

	$effect(() => {
		void productAnalyticsDisplay;
		void productAnalyticsLoading;
		void editingProduct?.name;
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
		if (!productAnalyticsDisplay) {
			anaCrumbOverflow = 0;
			anaCrumbMoreOpen = false;
		}
	});
	// Outside-click đóng popover crumb.
	$effect(() => {
		if (!crumbMoreOpen) return;
		const handler = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (crumbTitleEl && target && !crumbTitleEl.contains(target)) crumbMoreOpen = false;
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	});

	// ── B54: quick-create category/brand từ Select (allowCreate) ──
	let quickCreateKind = $state<'category' | 'brand' | null>(null);
	let quickCreateDisplay = $state(false);
	let quickCreateTarget = $state<'categoryId' | 'brandId' | null>(null);
	let quickCreateName = $state('');
	let quickCreateBusy = $state(false);
	let quickCreateError = $state<string | undefined>(undefined);
	// Callback nạp lại options của Select vừa tạo (gán bởi loadOptions closure).
	let quickCreateReload: (() => Promise<void>) | null = null;

	// remote lazy-load options cho Select category/brand trong modal:
	// loadOptions(query) → fetch trang đầu pageSize 100 (cap server). Remote
	// search thay loadedOptions — đủ cho danh sách option lớn.
	async function fetchRemoteOptions(
		kind: 'category' | 'brand',
		query?: string
	): Promise<{ value: string; label: string }[]> {
		if (!encryptionKeys) return [];
		const response = await encryption.fetchSecure(
			kind === 'category' ? '/api/admin/categories/list' : '/api/admin/brands/list',
			{ method: 'POST', body: { page: 1, pageSize: 100, search: query || undefined } },
			encryptionKeys
		);
		if (!response.ok) return [];
		const data = response.data as { categories?: OptionItem[]; brands?: OptionItem[] } | undefined;
		const items = kind === 'category' ? (data?.categories ?? []) : (data?.brands ?? []);
		return items.map((c) => ({ value: c._id, label: c.name }));
	}

	function openQuickCreate(kind: 'category' | 'brand', value: string, target: 'categoryId' | 'brandId', reload: () => Promise<void>) {
		quickCreateKind = kind;
		quickCreateDisplay = true;
		quickCreateTarget = target;
		quickCreateName = value;
		quickCreateError = undefined;
		quickCreateReload = reload;
	}

	function closeQuickCreate() {
		quickCreateDisplay = false;
		quickCreateKind = null;
		quickCreateTarget = null;
		quickCreateError = undefined;
		quickCreateReload = null;
	}

	// Tạo nhanh category/brand: POST create + chọn giá trị mới vào Select.
	async function submitQuickCreate() {
		if (quickCreateBusy || !encryptionKeys) return;
		const name = quickCreateName.trim();
		if (!name || !quickCreateKind) return;
		const kind = quickCreateKind;
		quickCreateBusy = true;
		try {
			// slug gen client (server yêu cầu slug unique — categories/create +
			// brands/create validate slug bắt buộc).
			const slug =
				name
					.toLowerCase()
					.normalize('NFD')
					.replace(/[̀-ͯ]/g, '')
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-+|-+$/g, '') || `${kind}-${Date.now()}`;
			const response = await encryption.fetchSecure(
				kind === 'category' ? '/api/admin/categories/create' : '/api/admin/brands/create',
				{ method: 'POST', body: { name, slug } },
				encryptionKeys
			);
			quickCreateBusy = false;
			if (!response.ok) {
				quickCreateError = resolveServerMessage(response.message, lang, pageContents.quickCreate.failed);
				return;
			}
			const data = response.data as { documentKey?: string } | undefined;
			const newId = data?.documentKey ?? '';
			showToast(pageContents.quickCreate.title[lang]);
			// Nạp lại options Select (loadOptions closure) rồi chọn giá trị mới.
			if (quickCreateReload) await quickCreateReload();
			if (newId && quickCreateTarget) formData[quickCreateTarget] = newId;
			closeQuickCreate();
		} catch (err) {
			quickCreateBusy = false;
			quickCreateError = pageContents.quickCreate.failed[lang];
			if (import.meta.env.DEV) console.error('[products] quick create error:', err);
		}
	}

	// Modal create/edit dùng chung 1 biến display (bind:display — modal tự
	// đóng qua Escape/backdrop phải sync ngược về parent, one-way sẽ hở).
	let modalOpen = $state(false);
	let editingProduct = $state<ProductListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	// ── B55: more menu trong footer modal (Thống kê + Xoá) ──
	let productMoreOpen = $state(false);
	let productMoreEl = $state<HTMLElement | null>(null);
	let productDeleteDisplay = $state(false);
	let productStatsDisplay = $state(false);
	let productStatsLoading = $state(false);
	// B56: danh sách biến thể phụ thuộc (modal Thống kê).
	let productStatsData = $state<VariantListItem[]>([]);
	let productStatsTotal = $state(0);
	let productAnalyticsDisplay = $state(false);
	let productAnalyticsLoading = $state(false);
	let productAnalyticsData = $state<
		{ orderCount: number; totalQuantity: number; totalValue: number; monthly: Array<{ period: string; orderCount: number; quantity: number; value: number }> } | undefined
	>(undefined);
	// Product chờ xác nhận xoá từ row action (deleteProduct không còn window.confirm)
	let pendingDeleteProduct = $state<ProductListItem | undefined>(undefined);

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

	// Form state
	let formData = $state({
		name: '',
		description: '',
		categoryId: '',
		brandId: '',
		hasVariants: false,
		variantAttributes: {} as Record<string, string[]>,
		imageUrl: '',
		status: 'active'
	});

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

	// Fetch products — fetchSecure POST (endpoint mã hoá RSA).
	async function fetchProducts() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/list',
				{
					method: 'POST',
					body: {
						page: pageNumber,
						pageSize,
						includeDeleted: showDeleted,
						search: searchQuery || undefined,
						categoryId: selectedCategory || undefined,
						brandId: selectedBrand || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			searching = false;
			if (response.ok) {
				const data = response.data as
					| { items?: ProductListItem[]; total?: number; page?: number }
					| undefined;
				products = data?.items ?? [];
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
			searching = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.loadFailed);
			if (import.meta.env.DEV) console.error('[products] fetch error:', err);
		}
	}

	// Fetch danh sách category/brand cho filter + modal (fetchSecure POST).
	async function fetchOptions() {
		if (!encryptionKeys) return;
		try {
			const [catRes, brandRes] = await Promise.all([
				encryption.fetchSecure(
					'/api/admin/categories/list',
					{ method: 'POST', body: { page: 1, pageSize: 100 } },
					encryptionKeys
				),
				encryption.fetchSecure(
					'/api/admin/brands/list',
					{ method: 'POST', body: { page: 1, pageSize: 100, includeDeleted: false } },
					encryptionKeys
				)
			]);
			if (catRes.ok) {
				const data = catRes.data as { categories?: OptionItem[] } | undefined;
				categories = (data?.categories ?? []).map((c) => ({ _id: c._id, name: c.name }));
			}
			if (brandRes.ok) {
				const data = brandRes.data as { brands?: OptionItem[] } | undefined;
				brands = (data?.brands ?? []).map((b) => ({ _id: b._id, name: b.name }));
			}
		} catch (err) {
			if (import.meta.env.DEV) console.error('[products] fetch options error:', err);
		}
	}

	// Tên category/brand theo _id (map lookup — dùng trong cột table).
	const categoryNameById = $derived(
		new Map(categories.map((c) => [c._id, c.name]))
	);
	const brandNameById = $derived(new Map(brands.map((b) => [b._id, b.name])));

	// Search debounce 300ms — theo dõi searchQuery bằng effect (Input không có
	// prop oninput; bind:value là nguồn đủ). Bỏ qua lần đầu (tránh trùng onMount).
	let searchDebounce: ReturnType<typeof setTimeout>;
	let searchArmed = false;
	$effect(() => {
		void searchQuery;
		if (!searchArmed) {
			searchArmed = true;
			return;
		}
		searching = true;
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			pageNumber = 1;
			void fetchProducts();
		}, 300);
	});

	// Checkbox/Select filter không có callback — theo dõi bằng $effect
	// (pattern users/brands page; chỉ chạy sau lần đầu để tránh refetch trùng
	// onMount). Mỗi filter 1 effect riêng với guard + last-value.
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
		searching = true;
		void fetchProducts();
	});

	let categoryFilterArmed = false;
	let lastCategory = '';
	$effect(() => {
		const current = selectedCategory;
		if (!categoryFilterArmed) {
			categoryFilterArmed = true;
			lastCategory = current;
			return;
		}
		if (current === lastCategory) return;
		lastCategory = current;
		pageNumber = 1;
		searching = true;
		void fetchProducts();
	});

	let brandFilterArmed = false;
	let lastBrand = '';
	$effect(() => {
		const current = selectedBrand;
		if (!brandFilterArmed) {
			brandFilterArmed = true;
			lastBrand = current;
			return;
		}
		if (current === lastBrand) return;
		lastBrand = current;
		pageNumber = 1;
		searching = true;
		void fetchProducts();
	});

	// ── B55: outside-click đóng more popover (pattern suppliers) ──
	$effect(() => {
		if (!productMoreOpen) return;
		const onDocMousedown = (event: MouseEvent) => {
			const target = event.target as Node | null;
			if (productMoreEl && target && productMoreEl.contains(target)) return;
			productMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocMousedown, true);
		return () => document.removeEventListener('mousedown', onDocMousedown, true);
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
		void fetchProducts();
	});

	// ── B6.2: DataTable columns ──
	const productsAny = $derived(products as unknown as Record<string, unknown>[]);
	const productStatsColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{ id: 'sku', label: pageContents.statsModal.skuCol[lang], accessor: (row) => String((row as unknown as VariantListItem).sku ?? ''), render: (v) => String(v ?? '') },
		{ id: 'displayName', label: pageContents.statsModal.variantsCol[lang], accessor: (row) => String((row as unknown as VariantListItem).displayName ?? ''), render: (v) => String(v ?? '') },
		{ id: 'price', label: pageContents.statsModal.priceCol[lang], accessor: (row) => (row as unknown as VariantListItem).price as number, render: (v) => formatMoney(Number(v)) },
		{
			id: 'status',
			label: pageContents.statsModal.statusCol[lang],
			accessor: (row) => String((row as unknown as VariantListItem).status ?? ''),
			status: (v) => {
				const s = String(v ?? '');
				if (s === 'active') return 'success';
				if (s === 'inactive') return 'default';
				if (s === 'draft') return 'warning';
				if (s === 'discontinued') return 'danger';
				return 'default';
			}
		}
]);

	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'product',
			label: pageContents.productCol[lang],
			sortable: true,
			accessor: (row) => (row as unknown as ProductListItem).name,
			render: (value, row) => {
				const p = row as unknown as ProductListItem;
				const desc = p.description ? ` — ${p.description.slice(0, 40)}` : '';
				return `${String(value)}${desc}`;
			}
		},
		{
			id: 'category',
			label: pageContents.categoryLabel[lang],
			accessor: (row) => {
				const p = row as unknown as ProductListItem;
				return p.categoryId ? categoryNameById.get(p.categoryId) ?? '—' : '—';
			}
		},
		{
			id: 'brand',
			label: pageContents.brandLabel[lang],
			accessor: (row) => {
				const p = row as unknown as ProductListItem;
				return p.brandId ? brandNameById.get(p.brandId) ?? '—' : '—';
			}
		},
		{
			id: 'variants',
			label: pageContents.variantsCol[lang],
			accessor: (row) => {
				const p = row as unknown as ProductListItem;
				if (!p.hasVariants) return pageContents.simpleProduct[lang];
				const n = Object.keys(p.variantAttributes ?? {}).length;
				return pageContents.attrCount[lang].replace('{n}', String(n));
			}
		},
		{
			id: 'status',
			label: pageContents.statusLabel[lang],
			sortable: true,
			accessor: (row) => (row as unknown as ProductListItem).status,
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
			accessor: (row) => formatDate((row as unknown as ProductListItem).updatedAt),
			noHighlight: true
		}
	]);

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

	function isRowDeleted(product: ProductListItem): boolean {
		return !!product.deletedAt;
	}

	// Open create modal
	function openCreateModal() {
		resetForm();
		if (maybeRestoreDraft('products:create')) return;
		draftFormKey = 'products:create';
		draftUserId = currentUserId();
		draftAutosaveArmed = false;
		closeGuard.markClean();
		modalOpen = true;
	}

	// Open edit modal
	function openEditModal(product: ProductListItem) {
		resetForm();
		editingProduct = product;
		formData = {
			name: product.name,
			description: product.description ?? '',
			categoryId: product.categoryId ?? '',
			brandId: product.brandId ?? '',
			hasVariants: product.hasVariants,
			variantAttributes: product.variantAttributes ?? {},
			imageUrl: product.imageUrl ?? '',
			status: product.status
		};
		const key = `products:edit:${product._id}`;
		if (maybeRestoreDraft(key)) return;
		draftFormKey = key;
		draftUserId = currentUserId();
		draftAutosaveArmed = false;
		closeGuard.markClean();
		modalOpen = true;
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
			name: '',
			description: '',
			categoryId: '',
			brandId: '',
			hasVariants: false,
			variantAttributes: {},
			imageUrl: '',
			status: 'active'
		};
		formErrors = {};
		editingProduct = null;
		formSubmitting = false;
		draftFormKey = null;
		pendingDraftFormKey = null;
	}

	// Thêm dòng thuộc tính variant trống (key tạm "attribute{N}" tránh trùng)
	function addAttribute() {
		const nextIndex = Object.keys(formData.variantAttributes).length + 1;
		formData.variantAttributes = { ...formData.variantAttributes, [`attribute${nextIndex}`]: [] };
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
		if (!formData.name.trim()) {
			formErrors.name = 'Product name is required';
		} else if (formData.name.trim().length < 2) {
			formErrors.name = 'Product name must be at least 2 characters';
		}
		if (formData.hasVariants && Object.keys(formData.variantAttributes).length === 0) {
			formErrors.variantAttributes = 'At least one variant attribute is required';
		}
		return Object.keys(formErrors).length === 0;
	}

	// Submit form — fetchSecure POST create/update.
	async function submitForm() {
		if (!encryptionKeys || !validateForm()) return;

		formSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				editingProduct ? '/api/admin/products/update' : '/api/admin/products/create',
				{
					method: 'POST',
					body: editingProduct
						? { documentKey: editingProduct._id, ...formData }
						: formData
				},
				encryptionKeys
			);
			formSubmitting = false;
			if (response.ok) {
				showToast(
					resolveServerMessage(response.message, lang, {
						vi: editingProduct ? pageContents.states.updated.vi : pageContents.states.created.vi,
						en: editingProduct ? pageContents.states.updated.en : pageContents.states.created.en
					})
				);
				// B9: save thành công → xoá draft (chỉ khi đúng form vừa submit).
				if (draftFormKey && draftUserId) clearDraft(draftUserId, draftFormKey);
				closeModals();
				void fetchProducts();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.operationFailed),
					'error'
				);
			}
		} catch (err) {
			formSubmitting = false;
			showToast(pageContents.states.networkError[lang], 'error');
			if (import.meta.env.DEV) console.error('[products] submit error:', err);
		}
	}

	// Delete product — fetchSecure POST delete (documentKey trong body).
	async function deleteProduct(product: ProductListItem) {
		if (!encryptionKeys) return;

		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/delete',
				{ method: 'POST', body: { documentKey: product._id } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.states.deleted));
				// Đóng modal form nếu đang mở (xoá từ more-menu — pattern suppliers)
				closeModals();
				pendingDeleteProduct = undefined;
				void fetchProducts();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.deleteFailed),
					'error'
				);
			}
		} catch (err) {
			showToast(pageContents.states.networkError[lang], 'error');
			if (import.meta.env.DEV) console.error('[products] delete error:', err);
		}
	}

	// ── B55: more menu handlers ──
	function moreOpenStats() {
		productMoreOpen = false;
		productStatsDisplay = true;
		productStatsData = [];
		void loadProductStats();
	}

	async function loadProductStats() {
		if (!encryptionKeys || !editingProduct || productStatsLoading) return;
		productStatsLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/variants/list',
				{ method: 'POST', body: { page: 1, pageSize: 20, productId: editingProduct._id } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { items?: VariantListItem[]; total?: number } | undefined;
				productStatsData = data?.items ?? [];
				productStatsTotal = data?.total ?? (data?.items?.length ?? 0);
			} else {
				productStatsDisplay = false;
				showToast(pageContents.states.networkError[lang], 'error');
			}
		} catch {
			productStatsDisplay = false;
			showToast(pageContents.states.networkError[lang], 'error');
		} finally {
			productStatsLoading = false;
		}
	}

	// B56: phân tích nhập hàng theo sản phẩm (endpoint analytics/query).
	async function loadProductAnalytics() {
		if (!encryptionKeys || !editingProduct || productAnalyticsLoading) return;
		productAnalyticsLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/analytics/query',
				{ method: 'POST', body: { type: 'product-summary', productId: editingProduct._id } },
				encryptionKeys
			);
			if (response.ok) {
				productAnalyticsData = response.data as {
					orderCount: number;
					totalQuantity: number;
					totalValue: number;
					monthly: Array<{ period: string; orderCount: number; quantity: number; value: number }>;
				} | undefined;
			} else {
				productAnalyticsDisplay = false;
				showToast(pageContents.states.networkError[lang], 'error');
			}
		} catch {
			productAnalyticsDisplay = false;
			showToast(pageContents.states.networkError[lang], 'error');
		} finally {
			productAnalyticsLoading = false;
		}
	}

	function moreOpenAnalytics() {
		productMoreOpen = false;
		productAnalyticsDisplay = true;
		productAnalyticsData = undefined;
		void loadProductAnalytics();
	}

	function formatMoney(value: number | undefined | null): string {
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value ?? 0);
	}

	function moreOpenDelete() {
		productMoreOpen = false;
		productDeleteDisplay = true;
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
		productMoreOpen = false;
		resetForm();
	}

	// Initial load
	// B8 realtime: refetch list khi collection thay đổi từ client khác
	onMount(() => subscribeDbChanges('products', () => void fetchProducts()));
	// B54: scroll không bubble — bắt capture trên document cho cả wrap + window.
	onMount(() => {
		document.addEventListener('scroll', onWindowScroll, { capture: true, passive: true });
		return () => document.removeEventListener('scroll', onWindowScroll, { capture: true } as EventListenerOptions);
	});
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		// B54: restore filter prefs (category/brand/showDeleted) TRƯỚC load đầu.
		const prefs = userPrefs.datatable?.['/admin/products'];
		if (prefs?.filters) {
			selectedCategory = typeof prefs.filters.category === 'string' ? prefs.filters.category : '';
			selectedBrand = typeof prefs.filters.brand === 'string' ? prefs.filters.brand : '';
			showDeleted = prefs.filters.showDeleted === true;
		}
		await fetchProducts();
		void fetchOptions();
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page admin-page--fullheight" class:at-bottom={wrapAtBottom} class:is-scrolling={scrollActive && isMobile}>
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<div class="admin-header-actions">
			<!-- Quy ước màu nút: create = success -->
			<Button color="success" onClick={openCreateModal}>
				{pageContents.addProduct[lang]}
			</Button>
		</div>
	</header>

	<!-- ── B54: FAB mobile (create/setting/search — ẩn khi chưa cuộn) ── -->
	<div
		class="fab-group"
		class:fab-hidden={isMobile && !tableScrolled}
		class:is-scrolling={scrollActive && isMobile}
		data-suggest
	>
		<button
			type="button"
			class="fab fab--primary"
			aria-label={pageContents.addProduct[lang]}
			data-test="products-fab"
			onclick={openCreateModal}
		>
			<Icon icon={iconify['add-rounded']} size="sm" />
		</button>
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.settings.title[lang]}
			onclick={() => {
				settingCategory = selectedCategory;
				settingBrand = selectedBrand;
				settingShowDeleted = showDeleted;
				settingModalDisplay = true;
				scrollActive = false;
			}}
		>
			<Icon icon={iconify['tune-rounded']} size="sm" />
		</button>
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.search[lang]}
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

	<!-- ── Trạng thái loading/first-load error ── -->
	{#if loadError}
		<div class="admin-state admin-state--error" data-test="products-load-error">{loadError}</div>
	{/if}

	<!-- ── Bảng products (DataTable + snippet actions) ── -->
	<div class="admin-table-wrap" bind:this={wrapEl} onscroll={onTableScroll}>
		<DataTable
			data={productsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			searchQuery={searchQuery ?? ''}
			resizable={{ enabled: true, fit: true }}
			loading={loading || searching}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.empty[lang]}
			loadingLabel={pageContents.loading[lang]}
			caption={{ vi: 'Danh sách sản phẩm', en: 'Product list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
			stickyHead
			mobileTapMode="callback"
			onRowClick={(row) => openEditModal(row as unknown as ProductListItem)}
			cardFields={['product', 'category', 'status']}
			selection={selectedIds}
			onSelectionChange={(ids) => (selectedIds = ids)}
			selectable
			showIndex
			indexOffset={(pageNumber - 1) * pageSize}
			indexCheckboxes
			checkOnRowClick
			selectionTools={false}
			getRowId={(row) => String((row as unknown as ProductListItem)._id ?? '')}
			selectAllMode="filtered"
			selectAllBusy={selectAllBusy}
			bind:allFilteredSelected={allFilteredSelected}
			onSelectAllFiltered={selectAllFilteredProducts}
			class={[tableScrolled && isMobile ? 'caption-collapsed' : undefined, scrollActive && isMobile ? 'tools-hidden-mobile' : undefined]
				.filter(Boolean)
				.join(' ') || undefined}
			data-test="products-datatable"
		>
			{#snippet captionTools()}
				<div class="admin-search" data-suggest>
					{#if isMobile && !mobileSearchOpen}
						<button
							type="button"
							class="mobile-caption-icon"
							aria-label={pageContents.search[lang]}
							data-test="products-mobile-search-open"
							onclick={() => {
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
												if (isMobile && !searchQuery.trim()) mobileSearchOpen = false;
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
							<div class="suggest-popover" role="listbox">
								<p class="suggest-title">{pageContents.suggest[lang]}</p>
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
											pageNumber = 1;
											void fetchProducts();
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
						<Select
							class="admin-filter-select"
							bind:value={selectedCategory}
							options={categorySelectOptions}
							searchable
							clearable
							placeholder={pageContents.allCategories[lang]}
							name="category-filter"
							data-test="products-filter-category"
						/>
						<Select
							class="admin-filter-select"
							bind:value={selectedBrand}
							options={brandSelectOptions}
							searchable
							clearable
							placeholder={pageContents.allBrands[lang]}
							name="brand-filter"
							data-test="products-filter-brand"
						/>
						<Checkbox bind:checked={showDeleted}>
							{pageContents.showDeleted[lang]}
						</Checkbox>
					{/if}
					<div class="admin-actions-group">
						{#if isMobile}
							<button
								type="button"
								class="mobile-caption-icon"
								aria-label={pageContents.settings.title[lang]}
								data-test="products-mobile-filter-btn"
								onclick={() => {
									settingModalDisplay = true;
									scrollActive = false;
								}}
							>
								<Icon icon={iconify['tune-rounded']} size="sm" />
							</button>
						{:else}
							<Button
								color="default"
								variant="outline"
								size="sm"
								onClick={() => {
									settingCategory = selectedCategory;
									settingBrand = selectedBrand;
									settingShowDeleted = showDeleted;
									settingModalDisplay = true;
								}}
								aria-label={pageContents.settings.title[lang]}
								data-test="products-header-setting-btn"
							>
								<Icon icon={iconify['tune-rounded']} size="sm" />
							</Button>
						{/if}
						<!-- Quy ước màu nút: create = success -->
						{#if isMobile}
							<Button color="success" size="sm" onClick={openCreateModal} aria-label={pageContents.addProduct[lang]} data-test="products-create-btn">
								<Icon icon={iconify['add-rounded']} size="sm" />
							</Button>
						{:else}
							<Button color="success" size="sm" onClick={openCreateModal} data-test="products-create-btn">
								{pageContents.addProduct[lang]}
							</Button>
						{/if}
					</div>
			{/snippet}
			{#snippet actionsContent(row)}
				{@const product = row as unknown as ProductListItem}
				<div class="row-actions">
					<Button variant="ghost" size="sm" onClick={() => openEditModal(product)} data-test="product-action-edit">
						{pageContents.editAction[lang]}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						color="error"
						onClick={() => {
							pendingDeleteProduct = product;
							productDeleteDisplay = true;
						}}
						data-test="product-action-delete"
					>
						{pageContents.deleteAction[lang]}
					</Button>
				</div>
			{/snippet}
		</DataTable>
	</div>

	<!-- ── B54: bulk bar (copy/delete + count) ── -->
	{#if selectedIds.length > 0}
		<div class="bulk-row" data-test="products-bulk-row">
			<div class="bulk-bar" data-test="products-bulk-bar">
				<span class="bulk-count">{pageContents.bulk.selected[lang].replace('{count}', String(bulkDisplayCount))}</span>
				<Button color="primary" variant="soft" size="sm" onClick={bulkCopySelected} data-test="products-bulk-copy">
					{pageContents.bulk.copy[lang]}
				</Button>
				<Button
					color="error"
					variant="soft"
					size="sm"
					onClick={() => {
						bulkDeleteDisplay = true;
					}}
					data-test="products-bulk-delete"
				>
					{pageContents.bulk.delete[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					size="sm"
					onClick={clearProductsSelection}
					aria-label={pageContents.bulk.cancel[lang]}
					data-test="products-bulk-clear"
				>
					<Icon icon={iconify['close-rounded']} size="sm" />
				</Button>
			</div>
		</div>
	{/if}

	<!-- ── Pagination server-side ── -->
	<footer class="admin-pagination" class:pagination-pop={paginationPopped && isMobile}>
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
				<span>{lang === 'vi' ? 'Row/trang' : 'Rows per page'}</span>
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
		isDimissable
		autoFocus={false}
		class="supplier-modal-root"
	>
		<ModalContainer>
			<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
				<div class="supplier-modal-title" bind:this={crumbTitleEl}>
					{#if isMobile && productsCrumbHidden}
						<button
							type="button"
							class="supplier-modal-title__more"
							data-test="product-crumb-more"
							aria-label={pageContents.crumbMore[lang]}
							aria-expanded={crumbMoreOpen}
							disabled={formSubmitting}
							onclick={() => (crumbMoreOpen = !crumbMoreOpen)}
						>
							<Icon icon={iconify['more-horiz-rounded']} size="sm" />
						</button>
						{#if crumbMoreOpen}
							<div class="supplier-crumb-popover" role="menu">
								<button
									type="button"
									class="supplier-crumb-popover__item"
									disabled={formSubmitting}
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
					{#if !isMobile || !productsCrumbHidden}
						{#if isMobile}
							<button
								type="button"
								class="supplier-modal-title__label supplier-modal-title__crumb"
								disabled={formSubmitting}
								onclick={() => closeGuard.attemptClose()}
							>
								{pageContents.title[lang]}
							</button>
						{:else}
							<span class="supplier-modal-title__label">{pageContents.title[lang]}</span>
						{/if}
					{/if}
					{#if editingProduct && formData.name}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">{formData.name}</span>
					{:else if !editingProduct}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.createTitle[lang]}
						</span>
					{/if}
				</div>
			</ModalHeader>
			<ModalBody class="modal-body">
				<TextField name="product-name" required>
					<Label>{pageContents.nameLabel[lang]}</Label>
					<Input
						bind:value={formData.name}
						placeholder={lang === 'vi' ? 'Nhập tên sản phẩm' : 'Enter product name'}
					/>
					{#if formErrors.name}
						<span class="field-error" role="alert">{formErrors.name}</span>
					{/if}
				</TextField>

				<TextField name="product-description">
					<Label>{pageContents.descLabel[lang]}</Label>
					<Textarea
						bind:value={formData.description}
						rows={3}
						placeholder={{ vi: 'Nhập mô tả sản phẩm…', en: 'Enter product description…' }}
					/>
				</TextField>

				<div class="grid-2">
					<TextField name="product-category">
						<Label>{pageContents.categoryLabel[lang]}</Label>
						<Select
							class="modal-filter-select"
							bind:value={formData.categoryId}
							options={categorySelectOptions}
							searchable
							clearable
							placeholder="—"
							name="product-category"
							fullscreen={isMobile}
							fullscreenCrumbs={[
								{ label: pageContents.title[lang], kind: 'crumb' },
								{ label: editingProduct ? pageContents.editTitle[lang] : pageContents.createTitle[lang], kind: 'current' }
							]}
							fullscreenCrumbTap={(i) => {
								if (i === 0) closeGuard.attemptClose();
							}}
							remoteSearch
							loadOptions={(query) => fetchRemoteOptions('category', query)}
							allowCreate
							createOptionLabel={pageContents.quickCreate.createNew[lang]}
							onOptionCreate={(value) =>
								openQuickCreate('category', value, 'categoryId', async () => {
									await fetchOptions();
								})}
							data-test="products-modal-category"
						/>
					</TextField>
					<TextField name="product-brand">
						<Label>{pageContents.brandLabel[lang]}</Label>
						<Select
							class="modal-filter-select"
							bind:value={formData.brandId}
							options={brandSelectOptions}
							searchable
							clearable
							placeholder="—"
							name="product-brand"
							fullscreen={isMobile}
							fullscreenCrumbs={[
								{ label: pageContents.title[lang], kind: 'crumb' },
								{ label: editingProduct ? pageContents.editTitle[lang] : pageContents.createTitle[lang], kind: 'current' }
							]}
							fullscreenCrumbTap={(i) => {
								if (i === 0) closeGuard.attemptClose();
							}}
							remoteSearch
							loadOptions={(query) => fetchRemoteOptions('brand', query)}
							allowCreate
							createOptionLabel={pageContents.quickCreate.createNew[lang]}
							onOptionCreate={(value) =>
								openQuickCreate('brand', value, 'brandId', async () => {
									await fetchOptions();
								})}
							data-test="products-modal-brand"
						/>
					</TextField>
				</div>

				<div class="grid-2">
					<TextField name="product-image" class="product-image-field">
						<!-- SỬA: dùng ImageUpload (upload thẳng hosting ngoài + preview + xoá)
						     thay URL input tay — vẫn bind cùng field formData.imageUrl.
						     BỎ Label bọc ngoài: ImageUpload đã render label riêng (trước đó
						     label lặp 2 lần — ui-checker bắt ở screenshot verify). -->
						<ImageUpload bind:value={formData.imageUrl} label={pageContents.imageLabel[lang]} disabled={loading} />
					</TextField>
					<TextField name="product-status">
						<Label>{pageContents.statusLabel[lang]}</Label>
						<Select bind:value={formData.status} options={productStatusOptions} clearable={false} name="product-status" />
					</TextField>
				</div>

				<div class="variant-block">
					<div class="variant-toggle">
						<Checkbox bind:checked={formData.hasVariants}>
							{pageContents.hasVariantsLabel[lang]}
						</Checkbox>
					</div>
					{#if formData.hasVariants}
						<div class="variant-rows">
							{#each Object.entries(formData.variantAttributes) as [attrName, values], i (attrName)}
								<div class="variant-row">
									<input
										class="modal-input"
										placeholder={pageContents.attrNamePlaceholder[lang]}
										value={attrName}
										oninput={(e) => {
											const newName = (e.target as HTMLInputElement).value;
											if (newName !== attrName) {
												const newAttrs = { ...formData.variantAttributes };
												delete newAttrs[attrName];
												if (newName) newAttrs[newName] = values;
												formData.variantAttributes = newAttrs;
											}
										}}
									/>
									<input
										class="modal-input"
										placeholder={pageContents.attrValuesPlaceholder[lang]}
										value={values.join(', ')}
										oninput={(e) => {
											const newValues = (e.target as HTMLInputElement).value
												.split(',')
												.map((v) => v.trim())
												.filter(Boolean);
											formData.variantAttributes = { ...formData.variantAttributes, [attrName]: newValues };
										}}
									/>
									<Button
										variant="ghost"
										size="sm"
										color="error"
										onClick={() => {
											const newAttrs = { ...formData.variantAttributes };
											delete newAttrs[attrName];
											formData.variantAttributes = newAttrs;
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
							{#if formErrors.variantAttributes}
								<span class="field-error" role="alert">{formErrors.variantAttributes}</span>
							{/if}
						</div>
					{/if}
				</div>
			</ModalBody>
			<ModalFooter class="modal-footer">
				{#if editingProduct}
					<!-- B55: more menu (Thống kê + Xoá) — pattern suppliers more-wrap. -->
					<div class="product-more-wrap" bind:this={productMoreEl}>
						<Button
							variant="ghost"
							color="default"
							aspect-square
							aria-label={pageContents.more.label[lang]}
							aria-expanded={productMoreOpen}
							disabled={formSubmitting}
							data-test="product-more-btn"
							onclick={() => {
								productMoreOpen = !productMoreOpen;
							}}
						>
							<Icon icon={iconify['more-horiz-rounded']} size="sm" />
						</Button>
						{#if productMoreOpen}
							<div class="product-more-popover" role="menu">
								<button
									type="button"
									class="product-more-popover__item"
									role="menuitem"
									disabled={formSubmitting}
									onclick={moreOpenStats}
									data-test="product-more-stats"
								>
									{pageContents.more.stats[lang]}
								</button>
								<button
									type="button"
									class="product-more-popover__item"
									role="menuitem"
									disabled={formSubmitting}
									onclick={moreOpenAnalytics}
									data-test="product-more-analytics"
								>
									{pageContents.more.analytics[lang]}
								</button>
								<button
									type="button"
									class="product-more-popover__item product-more-popover__item--danger"
									role="menuitem"
									disabled={formSubmitting}
									onclick={moreOpenDelete}
									data-test="product-more-delete"
								>
									{pageContents.more.delete[lang]}
								</button>
							</div>
						{/if}
					</div>
				{/if}
				<span class="modal-footer-spacer"></span>
				<Button
					variant="outline"
					onClick={() => { closeGuard.attemptClose(); }}
					disabled={formSubmitting}
				>
					{pageContents.cancel[lang]}
				</Button>
				<Button
					variant="solid"
					color={editingProduct ? 'primary' : 'success'}
					loading={formSubmitting}
					onClick={submitForm}
				>
					{editingProduct ? pageContents.saveEdit[lang] : pageContents.saveCreate[lang]}
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

	<!-- ── B54: setting modal (filter category/brand + showDeleted) ── -->
	{#if settingModalDisplay}
		<Modal bind:display={settingModalDisplay} size="sm" onClose={() => (settingModalDisplay = false)}>
			<Modal.Container>
				<Modal.Container.Header>
					<h2 class="modal-title">{pageContents.settings.title[lang]}</h2>
				</Modal.Container.Header>
				<Modal.Container.Body>
					<div class="setting-form" data-test="products-setting-form">
						<TextField name="setting-category">
							<Label>{pageContents.settings.filterCategory[lang]}</Label>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={settingCategory}
								options={categorySelectOptions}
								searchable
								clearable
								placeholder={pageContents.allCategories[lang]}
								fullscreen
							/>
						</TextField>
						<TextField name="setting-brand">
							<Label>{pageContents.settings.filterBrand[lang]}</Label>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={settingBrand}
								options={brandSelectOptions}
								searchable
								clearable
								placeholder={pageContents.allBrands[lang]}
								fullscreen
							/>
						</TextField>
						<div class="setting-check">
							<Checkbox bind:checked={settingShowDeleted}>
								{pageContents.settings.showDeleted[lang]}
							</Checkbox>
						</div>
					</div>
				</Modal.Container.Body>
				<Modal.Container.Footer>
					<Button
						color="secondary"
						variant="outline"
						disabled={settingCategory === '' && settingBrand === '' && !settingShowDeleted}
						onClick={() => {
							settingCategory = '';
							settingBrand = '';
							settingShowDeleted = false;
						}}
						data-test="products-setting-reset"
					>
						{pageContents.settings.reset[lang]}
					</Button>
					<Button
						color="primary"
						onClick={() => {
							selectedCategory = settingCategory;
							selectedBrand = settingBrand;
							showDeleted = settingShowDeleted;
							settingModalDisplay = false;
							saveDataTablePrefs('/admin/products', {
								filters: {
									category: settingCategory || null,
									brand: settingBrand || null,
									showDeleted: settingShowDeleted ? true : null
								}
							});
						}}
						data-test="products-setting-apply"
					>
						{pageContents.settings.apply[lang]}
					</Button>
				</Modal.Container.Footer>
			</Modal.Container>
		</Modal>
	{/if}

	<!-- ── B54: quick-create modal (category/brand) ── -->
	{#if quickCreateKind}
		<Modal
			bind:display={quickCreateDisplay}
			size="sm"
			isDimissable
			onCloseAttempt={() => {
				if (!quickCreateBusy) closeQuickCreate();
			}}
			class="supplier-modal-root"
		>
			<Modal.Container>
				<Modal.Container.Header actionButtons={{ close: { display: !isMobile } }}>
					<div class="supplier-modal-title">
						<span class="supplier-modal-title__label">{pageContents.title[lang]}</span>
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.quickCreate.title[lang]}
						</span>
					</div>
				</Modal.Container.Header>
				<Modal.Container.Body>
					{#if quickCreateError}
						<div class="form-error-banner" role="alert">{quickCreateError}</div>
					{/if}
					<div class="setting-form">
						<TextField name="quick-create-name" required>
							<Label>{pageContents.quickCreate.nameLabel[lang]}</Label>
							<Input
								bind:value={quickCreateName}
								disabled={quickCreateBusy}
								data-test="quick-create-name"
							/>
						</TextField>
					</div>
				</Modal.Container.Body>
				<Modal.Container.Footer>
					<Button
						color="success"
						onClick={submitQuickCreate}
						loading={quickCreateBusy}
						disabled={quickCreateBusy || !quickCreateName.trim()}
						data-test="quick-create-submit"
					>
						{pageContents.quickCreate.create[lang]}
					</Button>
					<Button color="default" variant="ghost" disabled={quickCreateBusy} onClick={closeQuickCreate}>
						{pageContents.cancel[lang]}
					</Button>
				</Modal.Container.Footer>
			</Modal.Container>
		</Modal>
	{/if}

	<!-- ── B54: AlertDialog xác nhận bulk delete ── -->
	{#if bulkDeleteDisplay}
		<AlertDialog bind:open={bulkDeleteDisplay}>
			<AlertDialog.Content>
				<AlertDialog.Header variant="danger">
					<AlertDialog.Title>{pageContents.bulk.title[lang]}</AlertDialog.Title>
					<AlertDialog.Description>
						{pageContents.bulk.desc[lang].replace('{count}', String(selectedIds.length))}
					</AlertDialog.Description>
				</AlertDialog.Header>
				<AlertDialog.Footer>
					<AlertDialog.Cancel disabled={bulkDeleting}>{pageContents.bulk.cancel[lang]}</AlertDialog.Cancel>
					<AlertDialog.Action
						color="danger"
						disabled={bulkDeleting}
						data-test="products-bulk-delete-confirm"
						onselect={bulkDeleteSelected}
					>
						{pageContents.bulk.confirm[lang]}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog>
	{/if}

	<!-- ── B55: xác nhận xoá product (AlertDialog thay window.confirm) ── -->
	{#if productDeleteDisplay}
		<AlertDialog bind:open={productDeleteDisplay}>
			<AlertDialog.Content>
				<AlertDialog.Header variant="danger">
					<AlertDialog.Title>{pageContents.deleteConfirm.title[lang]}</AlertDialog.Title>
					<AlertDialog.Description>
						{pageContents.deleteConfirm.desc[lang]}
					</AlertDialog.Description>
				</AlertDialog.Header>
				<AlertDialog.Footer>
					<AlertDialog.Cancel disabled={formSubmitting}>
						{pageContents.deleteConfirm.cancel[lang]}
					</AlertDialog.Cancel>
					<AlertDialog.Action
						color="danger"
						disabled={formSubmitting}
						data-test="product-delete-confirm"
						onselect={() => {
							const product = pendingDeleteProduct ?? editingProduct;
							pendingDeleteProduct = undefined;
							productDeleteDisplay = false;
							if (product) void deleteProduct(product);
						}}
					>
						{pageContents.deleteConfirm.confirm[lang]}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog>
	{/if}

	<!-- ── B55: modal thống kê product ── -->
	{#if productStatsDisplay}
		<Modal bind:display={productStatsDisplay} size="lg" class="supplier-modal-root">
			<ModalContainer>
				<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
					{#if isMobile}
						<div class="supplier-modal-title" bind:this={statsCrumbNavEl}>
							{#if statsCrumbOverflow > 0}
								<button type="button" class="supplier-modal-title__more" aria-label={pageContents.crumbMore[lang]} aria-expanded={statsCrumbMoreOpen} onclick={() => (statsCrumbMoreOpen = !statsCrumbMoreOpen)}>
									<Icon icon={iconify['more-horiz-rounded']} size="sm" />
								</button>
								{#if statsCrumbMoreOpen}
									<div class="supplier-crumb-popover" role="menu">
										{#if statsCrumbOverflow >= 1}
											<button type="button" class="supplier-crumb-popover__item" role="menuitem" onclick={() => { statsCrumbMoreOpen = false; productStatsDisplay = false; }}>{pageContents.title[lang]}</button>
										{/if}
										{#if statsCrumbOverflow >= 2}
											<button type="button" class="supplier-crumb-popover__item" role="menuitem" onclick={() => { statsCrumbMoreOpen = false; productStatsDisplay = false; }}>{editingProduct?.name ?? ''}</button>
										{/if}
									</div>
								{/if}
							{/if}
							<button type="button" class="supplier-modal-title__label supplier-modal-title__crumb" onclick={() => (productStatsDisplay = false)}>{pageContents.title[lang]}</button>
							{#if statsCrumbOverflow < 2}
								<span class="supplier-modal-title__name" aria-hidden="true">›</span>
								<button type="button" class="supplier-modal-title__name supplier-modal-title__crumb" onclick={() => (productStatsDisplay = false)}>{editingProduct?.name ?? ''}</button>
							{/if}
							<span class="supplier-modal-title__name--active">{pageContents.statsModal.title[lang]}</span>
						</div>
					{:else}
						{pageContents.statsModal.title[lang]}{editingProduct?.name ? ` — ${editingProduct.name}` : ''}
					{/if}
				</ModalHeader>
				<ModalBody>
					<DataTable
						data={productStatsData as unknown as Record<string, unknown>[]}
						columns={productStatsColumns}
						pageSize={20}
						sortable
						loading={productStatsLoading}
						visual={{ striped: true }}
						emptyLabel={pageContents.statsModal.variants[lang]}
						showIndex
						getRowId={(row) => String((row as unknown as VariantListItem)._id ?? '')}
						class="admin-stats-table"
						data-test="product-stats-datatable"
					/>
				</ModalBody>
			</ModalContainer>
		</Modal>
	{/if}

	<!-- ── B56: modal phân tích nhập hàng theo sản phẩm ── -->
	{#if productAnalyticsDisplay}
		<Modal bind:display={productAnalyticsDisplay} size="sm" class="supplier-analytics-modal-root">
			<ModalContainer>
				<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
					{#if isMobile}
						<div class="supplier-modal-title" bind:this={anaCrumbNavEl}>
							{#if anaCrumbOverflow > 0}
								<button type="button" class="supplier-modal-title__more" aria-label={pageContents.crumbMore[lang]} aria-expanded={anaCrumbMoreOpen} onclick={() => (anaCrumbMoreOpen = !anaCrumbMoreOpen)}>
									<Icon icon={iconify['more-horiz-rounded']} size="sm" />
								</button>
								{#if anaCrumbMoreOpen}
									<div class="supplier-crumb-popover" role="menu">
										{#if anaCrumbOverflow >= 1}
											<button type="button" class="supplier-crumb-popover__item" role="menuitem" onclick={() => { anaCrumbMoreOpen = false; productAnalyticsDisplay = false; }}>{pageContents.title[lang]}</button>
										{/if}
										{#if anaCrumbOverflow >= 2}
											<button type="button" class="supplier-crumb-popover__item" role="menuitem" onclick={() => { anaCrumbMoreOpen = false; productAnalyticsDisplay = false; }}>{editingProduct?.name ?? ''}</button>
										{/if}
									</div>
								{/if}
							{/if}
							<button type="button" class="supplier-modal-title__label supplier-modal-title__crumb" onclick={() => (productAnalyticsDisplay = false)}>{pageContents.title[lang]}</button>
							{#if anaCrumbOverflow < 2}
								<span class="supplier-modal-title__name" aria-hidden="true">›</span>
								<button type="button" class="supplier-modal-title__name supplier-modal-title__crumb" onclick={() => (productAnalyticsDisplay = false)}>{editingProduct?.name ?? ''}</button>
							{/if}
							<span class="supplier-modal-title__name--active">{pageContents.more.analyticsTitle[lang]}</span>
						</div>
					{:else}
						{pageContents.more.analyticsTitle[lang]}{editingProduct?.name ? ` — ${editingProduct.name}` : ''}
					{/if}
				</ModalHeader>
				<ModalBody>
					{#if productAnalyticsLoading}
						<div class="history-state">{pageContents.more.analyticsLoading[lang]}</div>
					{:else if !productAnalyticsData || productAnalyticsData.orderCount === 0}
						<div class="history-state">{pageContents.more.analyticsEmpty[lang]}</div>
					{:else}
						<div class="supplier-analytics" data-test="products-analytics-panel">
							<div class="supplier-analytics__totals">
								<div class="supplier-analytics__stat">
									<span class="supplier-analytics__stat-value">{new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(productAnalyticsData.orderCount)}</span>
									<span class="supplier-analytics__stat-label">{pageContents.more.analyticsOrderCount[lang]}</span>
								</div>
								<div class="supplier-analytics__stat">
									<span class="supplier-analytics__stat-value">{new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(productAnalyticsData.totalQuantity)}</span>
									<span class="supplier-analytics__stat-label">{pageContents.more.analyticsTotalQuantity[lang]}</span>
								</div>
								<div class="supplier-analytics__stat">
									<span class="supplier-analytics__stat-value">{formatMoney(productAnalyticsData.totalValue)}</span>
									<span class="supplier-analytics__stat-label">{pageContents.more.analyticsTotalValue[lang]}</span>
								</div>
							</div>
							{#if productAnalyticsData.monthly.length > 0}
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
										{#each productAnalyticsData.monthly as m (m.period)}
											<tr>
												<td>{m.period}</td>
												<td class="num">{new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(m.orderCount)}</td>
												<td class="num">{new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(m.quantity)}</td>
												<td class="num">{formatMoney(m.value)}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						</div>
					{/if}
				</ModalBody>
			</ModalContainer>
		</Modal>
	{/if}

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

	/* B56: fullheight (pattern suppliers) — page chiếm trọn khung, wrap tự cuộn;
	   ZERO 3 var sticky của layout để caption/th sticky bám đỉnh wrap. */
	.admin-page--fullheight {
		height: 100%;
		max-width: none;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		transition: padding 200ms ease, gap 200ms ease;
		--admin-header-h: 0px;
		--admin-filters-h: 0px;
		--admin-page-header-h: 0px;

		@media (max-width: 767px) {
			padding: 0.75rem;
		}

		@media (max-width: 767px) {
			&.is-scrolling {
				gap: 0.375rem;
				padding-block: 0.5rem;
			}
		}
	}

	/* Cuộn tới đáy: bỏ padding block page (pattern suppliers at-bottom). */
	.admin-page--fullheight.at-bottom {
		@media (max-width: 767px) {
			padding-block: 0;
		}
	}

	/* B56: wrap tự cuộn dọc trong page fullheight (pattern suppliers). */
	.admin-page--fullheight .admin-table-wrap {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
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

	.admin-search {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		max-width: none;
	}

	.admin-select {
		padding: 0.375rem 0.625rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		color: var(--foreground);
		font-size: 0.875rem;
	}

	// Component Select trong captionTools (searchable category/brand): class đặt
	// trên .select-root (as=div) — element mang hash Select nên rule scoped
	// `.admin-filter-select.s-<trang>` không match (bẫy scoped). Nhắm qua anchor
	// .datatable-caption-tools + :global() (pattern suppliers B55).
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

	// B55: caption-collapsed — co chiều cao controls trên mobile khi cuộn.
	:global(.datatable-root.caption-collapsed) {
		@media (max-width: 767px) {
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
		}
	}

	// B55: tools-hidden-mobile — ẩn tools khi cuộn trên mobile (giữ mobile-filter-popover).
	:global(.datatable-root.tools-hidden-mobile) {
		@media (max-width: 767px) {
			:global(.datatable-caption-tools .admin-search:not(:has(.mobile-filter-popover))),
			:global(.datatable-caption-tools .admin-actions-group:not(:has(.mobile-filter-popover))) {
				opacity: 0;
				pointer-events: none;
				transition: opacity 150ms ease;
			}
		}
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

	}

	/* B56: pop-anim (pattern suppliers — flash khi pagination hiện lại đáy). */
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

	.grid-2 {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));

		@media (max-width: 640px) {
			grid-template-columns: 1fr;
		}
	}

	.field-error {
		display: block;
		font-size: 0.75rem;
		color: var(--danger, #ef4444);
		margin-top: 0.25rem;
	}

	// Component Select trong modal (searchable category/brand): class đặt trên
	// .select-root; trigger style khớp .modal-select.
	/* class đặt trên component Select (hash khác) — B53.2: phải :global top-level */
	/* class đặt trên component Select (hash khác) — B53.2: :global() FULL-qualified */
	:global(.modal-filter-select) {
		width: 100%;
	}

	:global(.modal-filter-select .select-trigger) {
		width: 100%;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--background);
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

	.variant-block {
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.variant-rows {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.variant-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		width: 100%;
	}

	// B55: spacer đẩy nhóm Cancel/Save sang phải trong ModalFooter (scope khác
	// nên :global full — pattern suppliers .supplier-footer-spacer).
	:global(.modal-footer-root .modal-footer-spacer) {
		flex: 1;
	}

	/* ── B55: more-menu footer form modal (clone pattern suppliers more-wrap). ── */
	.product-more-wrap {
		position: relative;
	}

	.product-more-popover {
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

	.product-more-popover__item {
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

	.product-more-popover__item--danger {
		color: var(--error, hsl(356.95 95.9% 57.72%));

		&:hover:not(:disabled),
		&:focus-visible {
			background: var(--error-50, hsl(356.95 95.9% 57.72% / 0.08));
		}
	}

	/* ── B56: analytics panel (pattern suppliers) + history-state + stats table ── */

	.history-state {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--color-text-muted, var(--muted, #6b7280));
		font-size: 0.9rem;
	}

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

	/* ═══════════ B54: search suggest + mobile caption + bulk + FAB + crumb ═══════════ */

	.admin-search-loading {
		display: inline-flex;
		align-items: center;
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
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--foreground);
		font-size: 0.85rem;
		cursor: pointer;

		&:hover {
			background: var(--default-100);
		}
	}

	.admin-actions-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
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

	.bulk-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.bulk-row {
		@media (max-width: 767px) {
			flex-basis: 100%;
		}
	}

	.bulk-count {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--foreground);
	}

	/* Mobile: bulk bar fixed trên pagination, đủ chỗ cho FAB (4.75rem phải). */
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
	}

	/* Ẩn bulk bar khi đang cuộn (mobile) — .is-scrolling đặt trên section. */
	@media (max-width: 767px) {
		.admin-page.is-scrolling .bulk-row {
			opacity: 0;
			pointer-events: none;
		}
	}

	.admin-page .bulk-row {
		transition: opacity 150ms ease;
	}

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
		transition: transform 0.15s ease;

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

	/* B56: pagination cố định sát đáy viewport mobile (pattern suppliers —
	   footer tách khỏi flow; FAB bottom 7.25rem > pagination không đè). */
	@media (max-width: 767px) {
		.admin-page--fullheight .admin-pagination {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 300;
			padding: 0.5rem 0.75rem 0.75rem;
			padding-right: 4.75rem; /* chừa chỗ FAB phải */
			background: var(--background);
			border-top: 1px solid var(--default-300);
		}
	}

	/* Mobile: modal full màn (pattern suppliers — class trên Modal root). */
	@media (hover: none) and (pointer: coarse), (max-width: 640px) {
		:global(.modal-root.supplier-modal-root) {
			padding: 0;
			align-items: stretch;
		}

		:global(.supplier-modal-root .modal-container-root) {
			position: fixed;
			inset: 0;
			width: 100% !important;
			max-width: none;
			max-height: none;
			border-radius: 0;
			margin: 0;
		}

		:global(.supplier-modal-root .modal-header-root) {
			padding-block: 0.5rem;
			justify-content: flex-start;
		}

	/* B56: modal analytics full-size mobile — copy suppliers block với class riêng
	   .supplier-analytics-modal-root (desktop modal vẫn size sm giữa màn hình). */
	@media (hover: none) and (pointer: coarse), (max-width: 640px) {
		:global(.modal-root.supplier-analytics-modal-root) {
			padding: 0;
			align-items: stretch;
		}
		:global(.supplier-analytics-modal-root .modal-container-root) {
			position: fixed;
			inset: 0;
			width: 100% !important; /* thắng .size-sm/.size-lg — scoped CSS load sau page CSS */
			max-width: none;
			max-height: none;
			border-radius: 0;
			margin: 0;
		}
		:global(.supplier-analytics-modal-root .modal-header-root) {
			padding-block: 0.5rem;
			justify-content: flex-start;
		}
		.supplier-modal-title {
			flex: 1 1 auto;
		}
	}

		.supplier-modal-title {
			flex: 1 1 auto;
		}
	}

	/* ── B54: modal breadcrumb title (crumb + more popover) ── */
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

		&:hover {
			background: var(--default-100, var(--default-200));
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
			color: var(--foreground-500);
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

	.setting-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-error-banner {
		padding: 0.6rem 0.75rem;
		border-radius: 0.5rem;
		background: var(--danger-50, rgb(239 68 68 / 0.08));
		color: var(--danger-600, #dc2626);
		font-size: 0.85rem;
	}
</style>
