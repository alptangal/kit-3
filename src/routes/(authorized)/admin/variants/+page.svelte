<script lang="ts">
	// src/routes/(authorized)/admin/variants/+page.svelte
	// B6.2: migrate sang DataTable + Pagination (pattern users/brands/products page).
	// FIX BUG pre-existing: page cũ fetch GET ?params + PATCH/DELETE method +
	// đọc data.success/data.items nhưng endpoint chỉ export POST (readAdminRequest
	// mã hoá RSA) → bảng không bao giờ render, delete/update luôn chết. Chuyển
	// sang encryption.fetchSecure POST cho list + create/update/delete.
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
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

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

	// Form state — trường số giữ string (Input value là string), parse khi submit.
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
		lowStockThreshold: '',
		imageUrl: '',
		status: 'active'
	});

	// Fetch variants — fetchSecure POST (endpoint mã hoá RSA).
	async function fetchVariants() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
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
						productId: selectedProduct || undefined
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
			void fetchVariants();
		}, 300);
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
			accessor: (row) => (row as unknown as VariantListItem).displayName,
			render: (value, row) => {
				const v = row as unknown as VariantListItem;
				const barcode = v.barcode ? ` · ${v.barcode}` : '';
				return `${String(value)}${barcode}`;
			},
			sortable: false
		},
		{
			id: 'product',
			label: pageContents.productLabel[lang],
			accessor: (row) => {
				const v = row as unknown as VariantListItem;
				return productNameById.get(v.productId) ?? '—';
			},
			sortable: false
		},
		{
			id: 'sku',
			label: pageContents.skuLabel[lang],
			accessor: (row) => (row as unknown as VariantListItem).sku,
			sortable: false
		},
		{
			id: 'attributes',
			label: pageContents.attributesLabel[lang],
			accessor: (row) => {
				const v = row as unknown as VariantListItem;
				const entries = Object.entries(v.attributes ?? {});
				if (entries.length === 0) return '—';
				return entries.map(([k, val]) => `${k}: ${val}`).join(', ');
			},
			sortable: false
		},
		{
			id: 'price',
			label: pageContents.priceLabel[lang],
			accessor: (row) => formatPrice((row as unknown as VariantListItem).price),
			sortable: false
		},
		{
			id: 'status',
			label: pageContents.statusLabel[lang],
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
			lowStockThreshold:
				variant.lowStockThreshold != null ? String(variant.lowStockThreshold) : '',
			imageUrl: variant.imageUrl ?? '',
			status: variant.status
		};
		modalOpen = true;
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
			lowStockThreshold: '',
			imageUrl: '',
			status: 'active'
		};
		formErrors = {};
		editingVariant = null;
		formSubmitting = false;
	}

	// Thêm dòng thuộc tính trống (key tạm "attr{N}" tránh trùng).
	function addAttribute() {
		const nextIndex = Object.keys(formData.attributes).length + 1;
		formData.attributes = { ...formData.attributes, [`attr${nextIndex}`]: '' };
	}

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

	// Close modals
	function closeModals() {
		modalOpen = false;
		resetForm();
	}

	// Initial load — fetchProducts song song fetchVariants (select filter +
	// modal cần products sớm; trước đây chạy sequential khiến modal mở lúc
	// product list chưa về → select rỗng).
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

<section class="admin-page">
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<div class="admin-header-actions">
			<Button color="primary" onClick={openCreateModal}>
				{pageContents.addVariant[lang]}
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
			bind:value={selectedProduct}
			aria-label={pageContents.productLabel[lang]}
		>
			<option value="">{pageContents.allProducts[lang]}</option>
			{#each products as product (product._id)}
				<option value={product._id}>{product.name}</option>
			{/each}
		</select>
		<Checkbox bind:checked={showDeleted}>
			{pageContents.showDeleted[lang]}
		</Checkbox>
	</div>

	<!-- ── Trạng thái loading/first-load error ── -->
	{#if loadError}
		<div class="admin-state admin-state--error" data-test="variants-load-error">{loadError}</div>
	{/if}

	<!-- ── Bảng variants (DataTable + snippet actions) ── -->
	<div class="admin-table-wrap">
		<DataTable
			data={variantsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.empty[lang]}
			loadingLabel={pageContents.loading[lang]}
			caption={{ vi: 'Danh sách biến thể', en: 'Variant list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
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
			<span class="page-info">Page {pageNumber} of {totalPages}</span>
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
	<Modal bind:display={modalOpen} onClose={closeModals} size="lg">
		<ModalContainer>
			<ModalHeader>
				<h2 class="modal-title">
					{editingVariant ? pageContents.editTitle[lang] : pageContents.createTitle[lang]}
				</h2>
			</ModalHeader>
			<ModalBody class="modal-body">
				<TextField name="variant-product" required>
					<Label>{pageContents.productLabel[lang]}</Label>
					<select
						class="modal-select"
						bind:value={formData.productId}
						aria-label={pageContents.productLabel[lang]}
					>
						<option value="">—</option>
						{#each products as product (product._id)}
							<option value={product._id}>{product.name}</option>
						{/each}
					</select>
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
					</TextField>
					<TextField name="variant-cost">
						<Label>{pageContents.costLabel[lang]}</Label>
						<Input type="number" bind:value={formData.costPrice} />
					</TextField>
				</div>

				<div class="grid-2">
					<TextField name="variant-weight">
						<Label>{pageContents.weightLabel[lang]}</Label>
						<Input type="number" bind:value={formData.weight} />
					</TextField>
					<TextField name="variant-image">
						<Label>{pageContents.imageLabel[lang]}</Label>
						<Input bind:value={formData.imageUrl} placeholder="https://example.com/image.jpg" />
					</TextField>
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
				</fieldset>
			</ModalBody>
			<ModalFooter class="modal-footer">
				<Button variant="outline" onClick={closeModals} disabled={formSubmitting}>
					{pageContents.cancel[lang]}
				</Button>
				<Button
					variant="solid"
					color="primary"
					loading={formSubmitting}
					onClick={submitForm}
				>
					{editingVariant ? pageContents.saveEdit[lang] : pageContents.saveCreate[lang]}
				</Button>
			</ModalFooter>
		</ModalContainer>
	</Modal>
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
	}

	.admin-search {
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

	.page-info {
		font-size: 0.875rem;
		color: var(--muted);
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
</style>
