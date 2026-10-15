<script lang="ts">
	// src/routes/(authorized)/admin/products/+page.svelte
	// B6.2: migrate sang DataTable + Pagination (pattern users/brands page).
	// FIX BUG pre-existing: page cũ fetch GET ?params + đọc data.success/items
	// nhưng endpoint chỉ export POST (readAdminRequest mã hoá RSA) → bảng
	// không bao giờ render. Chuyển sang encryption.fetchSecure POST.
	import { onMount } from 'svelte';
	import { Button, DataTable, Pagination } from '$components/element';
	import { Input, Label, TextField } from '$components/form';
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
	import DraftRestoreDialog from '../../_DraftRestoreDialog.svelte';
	import { createCloseGuard } from '$modules/close-guard.svelte';

	import { subscribeDbChanges } from '$modules/db-realtime';
	// P3: dialog xác nhận khi đóng modal với form còn dirty.
	import DirtyCloseDialog from '../DirtyCloseDialog.svelte';
	// Types
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
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let selectedCategory = $state('');
	let selectedBrand = $state('');
	let showDeleted = $state(false);
	// Modal create/edit dùng chung 1 biến display (bind:display — modal tự
	// đóng qua Escape/backdrop phải sync ngược về parent, one-way sẽ hở).
	let modalOpen = $state(false);
	let editingProduct = $state<ProductListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

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
		void fetchProducts();
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
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'product',
			label: pageContents.productCol[lang],
			accessor: (row) => (row as unknown as ProductListItem).name,
			render: (value, row) => {
				const p = row as unknown as ProductListItem;
				const desc = p.description ? ` — ${p.description.slice(0, 40)}` : '';
				return `${String(value)}${desc}`;
			},
			sortable: false
		},
		{
			id: 'category',
			label: pageContents.categoryLabel[lang],
			accessor: (row) => {
				const p = row as unknown as ProductListItem;
				return p.categoryId ? categoryNameById.get(p.categoryId) ?? '—' : '—';
			},
			sortable: false
		},
		{
			id: 'brand',
			label: pageContents.brandLabel[lang],
			accessor: (row) => {
				const p = row as unknown as ProductListItem;
				return p.brandId ? brandNameById.get(p.brandId) ?? '—' : '—';
			},
			sortable: false
		},
		{
			id: 'variants',
			label: pageContents.variantsCol[lang],
			accessor: (row) => {
				const p = row as unknown as ProductListItem;
				if (!p.hasVariants) return pageContents.simpleProduct[lang];
				const n = Object.keys(p.variantAttributes ?? {}).length;
				return pageContents.attrCount[lang].replace('{n}', String(n));
			},
			sortable: false
		},
		{
			id: 'status',
			label: pageContents.statusLabel[lang],
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
		if (!confirm(`Delete "${product.name}"? This action cannot be undone.`)) return;

		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/delete',
				{ method: 'POST', body: { documentKey: product._id } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.states.deleted));
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

	// Initial load
	// B8 realtime: refetch list khi collection thay đổi từ client khác
	onMount(() => subscribeDbChanges('products', () => void fetchProducts()));
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchProducts();
		void fetchOptions();
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
			<Button color="success" onClick={openCreateModal}>
				{pageContents.addProduct[lang]}
			</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<div class="admin-search">
			<Input placeholder={pageContents.searchPlaceholder[lang]} bind:value={searchQuery}>
				{#snippet leading(data)}
					<Icon
						icon={iconify['search-rounded']}
						size={(data?.size ?? 'sm') as Size}
						class={mergeIconClasses(data?.defaultStyles, 'admin-search-icon')}
					/>
				{/snippet}
			</Input>
		</div>
		<select
			class="admin-select"
			bind:value={selectedCategory}
			aria-label={pageContents.categoryLabel[lang]}
		>
			<option value="">{pageContents.allCategories[lang]}</option>
			{#each categories as cat (cat._id)}
				<option value={cat._id}>{cat.name}</option>
			{/each}
		</select>
		<select
			class="admin-select"
			bind:value={selectedBrand}
			aria-label={pageContents.brandLabel[lang]}
		>
			<option value="">{pageContents.allBrands[lang]}</option>
			{#each brands as brand (brand._id)}
				<option value={brand._id}>{brand.name}</option>
			{/each}
		</select>
		<Checkbox bind:checked={showDeleted}>
			{pageContents.showDeleted[lang]}
		</Checkbox>
	</div>

	<!-- ── Trạng thái loading/first-load error ── -->
	{#if loadError}
		<div class="admin-state admin-state--error" data-test="products-load-error">{loadError}</div>
	{/if}

	<!-- ── Bảng products (DataTable + snippet actions) ── -->
	<div class="admin-table-wrap">
		<DataTable
			data={productsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.empty[lang]}
			loadingLabel={pageContents.loading[lang]}
			caption={{ vi: 'Danh sách sản phẩm', en: 'Product list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
			stickyHead
			mobileTapMode="callback"
			onRowClick={(row) => openEditModal(row as unknown as ProductListItem)}
			cardFields={['product', 'category', 'status']}
			data-test="products-datatable"
		>
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
						onClick={() => deleteProduct(product)}
						data-test="product-action-delete"
					>
						{pageContents.deleteAction[lang]}
					</Button>
				</div>
			{/snippet}
		</DataTable>
	</div>

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
	<Modal bind:display={modalOpen} onClose={closeModals} onCloseAttempt={closeGuard.attemptClose} size="lg">
		<ModalContainer>
			<ModalHeader>
				<h2 class="modal-title">
					{editingProduct ? pageContents.editTitle[lang] : pageContents.createTitle[lang]}
				</h2>
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

				<div>
					<label for="product-description" class="modal-field-label">{pageContents.descLabel[lang]}</label>
					<textarea
						id="product-description"
						class="modal-textarea"
						rows={3}
						value={formData.description}
						oninput={(e) => (formData.description = (e.target as HTMLTextAreaElement).value)}
						placeholder={lang === 'vi' ? 'Nhập mô tả sản phẩm…' : 'Enter product description…'}
					></textarea>
				</div>

				<div class="grid-2">
					<TextField name="product-category">
						<Label>{pageContents.categoryLabel[lang]}</Label>
						<select
							class="modal-select"
							bind:value={formData.categoryId}
							aria-label={pageContents.categoryLabel[lang]}
						>
							<option value="">—</option>
							{#each categories as cat (cat._id)}
								<option value={cat._id}>{cat.name}</option>
							{/each}
						</select>
					</TextField>
					<TextField name="product-brand">
						<Label>{pageContents.brandLabel[lang]}</Label>
						<select
							class="modal-select"
							bind:value={formData.brandId}
							aria-label={pageContents.brandLabel[lang]}
						>
							<option value="">—</option>
							{#each brands as brand (brand._id)}
								<option value={brand._id}>{brand.name}</option>
							{/each}
						</select>
					</TextField>
				</div>

				<div class="grid-2">
					<TextField name="product-image">
						<Label>{pageContents.imageLabel[lang]}</Label>
						<Input bind:value={formData.imageUrl} placeholder="https://example.com/image.jpg" />
					</TextField>
					<TextField name="product-status">
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
					<!-- B5: mobile tap row mở modal edit — nút Xoá để xóa ngay từ modal. -->
					<Button
						variant="ghost"
						color="error"
						disabled={formSubmitting}
						data-test="product-modal-delete"
						onClick={() => {
							const product = editingProduct;
							closeModals();
							if (product) void deleteProduct(product);
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
		gap: 1rem;
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
			top: calc(var(--admin-header-h, 0px) + var(--admin-body-pad-top, 0.5rem));
			z-index: 400;
			background: var(--background, #fff);
			padding-block: 0.25rem;
			margin-block: -0.25rem;
		}
	}

	.admin-search {
		flex: 1;
		min-width: 220px;
		max-width: 320px;
	}

	.admin-select {
		padding: 0.375rem 0.625rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		color: var(--foreground);
		font-size: 0.875rem;
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
			margin-block: -0.25rem;
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

	.modal-textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		color: var(--foreground);
		resize: none;
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

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	/* B5: nút Xoá trong modal edit — đẩy sang trái (tách khỏi nhóm Cancel/Save). */
	/* B5: :global toan phan — footer render qua ModalFooter (scope khac),
	   anchor scoped .modal-footer khong match. */
	:global(.modal-footer [data-test='product-modal-delete']) {
		margin-right: auto;
	}
</style>
