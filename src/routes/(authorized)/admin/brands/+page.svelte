<script lang="ts">
	// src/routes/(authorized)/admin/brands/+page.svelte
	// B6.2: migrate sang DataTable + Pagination (pattern users page).
	// FIX BUG pre-existing: page cũ fetch GET ?params + đọc data.success/data.items
	// nhưng endpoint chỉ export POST (readAdminRequest mã hoá RSA) + response
	// {ok, message, data:{brands}} → bảng không bao giờ render. Chuyển sang
	// encryption.fetchSecure POST như users page.
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


	import { subscribeDbChanges } from '$modules/db-realtime';
	// Types
	interface BrandListItem {
		_id: string;
		name: string;
		slug: string;
		logoUrl?: string;
		description?: string;
		status: string;
		createdAt: string;
		updatedAt: string;
		deletedAt?: string | null;
	}

	// Ngôn ngữ
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// Type mở (pattern users page) — lang index không narrow.
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Thương hiệu', en: 'Brands' },
		subtitle: { vi: 'Quản lý thương hiệu sản phẩm', en: 'Manage product brands' },
		addBrand: { vi: 'Thêm thương hiệu', en: 'Add Brand' },
		searchPlaceholder: { vi: 'Tìm thương hiệu…', en: 'Search brands…' },
		showDeleted: { vi: 'Hiện đã xoá', en: 'Show deleted' },
		empty: { vi: 'Chưa có thương hiệu', en: 'No brands found' },
		loading: { vi: 'Đang tải…', en: 'Loading brands…' },
		createTitle: { vi: 'Tạo thương hiệu', en: 'Create Brand' },
		editTitle: { vi: 'Sửa thương hiệu', en: 'Edit Brand' },
		nameLabel: { vi: 'Tên thương hiệu', en: 'Brand Name' },
		slugLabel: { vi: 'Slug', en: 'Slug' },
		logoLabel: { vi: 'URL logo', en: 'Logo URL' },
		descLabel: { vi: 'Mô tả', en: 'Description' },
		statusLabel: { vi: 'Trạng thái', en: 'Status' },
		cancel: { vi: 'Huỷ', en: 'Cancel' },
		saveCreate: { vi: 'Tạo thương hiệu', en: 'Create Brand' },
		saveEdit: { vi: 'Lưu thay đổi', en: 'Save Changes' },
		editAction: { vi: 'Sửa', en: 'Edit' },
		deleteAction: { vi: 'Xoá', en: 'Delete' },
		updated: { vi: 'Cập nhật', en: 'Updated' },
		totalCount: { vi: '{n} thương hiệu', en: '{n} brands' },
		deletedBadge: { vi: 'Đã xoá', en: 'Deleted' },
		states: {
			loadFailed: { vi: 'Không tải được danh sách thương hiệu', en: 'Failed to load brands' },
			created: { vi: 'Đã tạo thương hiệu', en: 'Brand created' },
			updated: { vi: 'Đã lưu thay đổi', en: 'Brand updated' },
			deleted: { vi: 'Đã xoá thương hiệu', en: 'Brand deleted' },
			deleteFailed: { vi: 'Không xoá được thương hiệu', en: 'Failed to delete brand' },
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
	let brands = $state<BrandListItem[]>([]);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	let showDeleted = $state(false);
	// Modal create/edit dùng chung 1 biến display (bind:display — modal tự
	// đóng qua Escape/backdrop phải sync ngược về parent, one-way sẽ hở).
	// create khi editingBrand=null, edit khi editingBrand set.
	let modalOpen = $state(false);
	let editingBrand = $state<BrandListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	// Form state
	let formData = $state({
		name: '',
		slug: '',
		logoUrl: '',
		description: '',
		status: 'active'
	});

	// Fetch brands — fetchSecure POST (endpoint mã hoá RSA).
	async function fetchBrands() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/brands/list',
				{
					method: 'POST',
					body: {
						page: pageNumber,
						pageSize,
						includeDeleted: showDeleted,
						search: searchQuery || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { brands?: BrandListItem[]; total?: number; page?: number }
					| undefined;
				brands = data?.brands ?? [];
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
			if (import.meta.env.DEV) console.error('[brands] fetch error:', err);
		}
	}

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
			void fetchBrands();
		}, 300);
	});

	// Checkbox không có callback — theo dõi showDeleted bằng $effect
	// (pattern users page; chỉ chạy sau lần đầu để tránh refetch trùng onMount).
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
		void fetchBrands();
	});

	// Pagination — server-side: Pagination element chỉ có bindable page (không
	// callback) — effect theo dõi pageNumber + pageSize refetch server. Chỉ chạy
	// SAU lần đầu (tránh trùng onMount); pendingPageApply bỏ qua lần response
	// gán lại page (chống vòng lặp fetch). Pattern users page.
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
		void fetchBrands();
	});

	// ── B6.2: DataTable columns ──
	const brandsAny = $derived(brands as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'brand',
			label: pageContents.title[lang],
			accessor: (row) => (row as unknown as BrandListItem).name,
			sortable: false
		},
		{
			id: 'slug',
			label: pageContents.slugLabel[lang],
			accessor: (row) => (row as unknown as BrandListItem).slug,
			sortable: false
		},
		{
			id: 'status',
			label: pageContents.statusLabel[lang],
			accessor: (row) => (row as unknown as BrandListItem).status,
			status: (value) => {
				const s = String(value ?? '');
				if (s === 'active') return 'success';
				if (s === 'inactive') return 'default';
				return 'default';
			}
		},
		{
			id: 'updated',
			label: pageContents.updated[lang],
			accessor: (row) => formatDate((row as unknown as BrandListItem).updatedAt),
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

	function isRowDeleted(brand: BrandListItem): boolean {
		return !!brand.deletedAt;
	}

	// Open create modal
	function openCreateModal() {
		resetForm();
		modalOpen = true;
	}

	// Open edit modal
	function openEditModal(brand: BrandListItem) {
		resetForm();
		editingBrand = brand;
		formData = {
			name: brand.name,
			slug: brand.slug,
			logoUrl: brand.logoUrl ?? '',
			description: brand.description ?? '',
			status: brand.status
		};
		modalOpen = true;
	}

	// Reset form
	function resetForm() {
		formData = { name: '', slug: '', logoUrl: '', description: '', status: 'active' };
		formErrors = {};
		editingBrand = null;
		formSubmitting = false;
	}

	// Generate slug from name
	function generateSlug(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_-]+/g, '-')
			.replace(/^-+|-+$/g, '');
	}

	// Auto-generate slug khi gõ name (Input không có prop oninput — theo dõi
	// bằng effect; nếu user tự gõ slug khác bản auto → ngừng theo dõi).
	// LƯU Ý: Input khi unmount (modal đóng) ghi ngược value = undefined qua
	// bind:value (Input Main.svelte onDestroy) → guard typeof trước khi generate.
	let autoSlugArmed = false;
	let autoSlugFollow = true;
	$effect(() => {
		void formData.name;
		void formData.slug;
		if (!autoSlugArmed) {
			autoSlugArmed = true;
			return;
		}
		if (!autoSlugFollow) return;
		if (typeof formData.name !== 'string' || typeof formData.slug !== 'string') return;
		if (formData.slug && formData.slug !== generateSlug(formData.name)) {
			// slug bị user sửa tay → ngừng auto
			autoSlugFollow = false;
			return;
		}
		formData.slug = generateSlug(formData.name);
	});

	// Validate form
	function validateForm(): boolean {
		formErrors = {};
		if (!formData.name.trim()) {
			formErrors.name = 'Brand name is required';
		} else if (formData.name.trim().length < 2) {
			formErrors.name = 'Brand name must be at least 2 characters';
		}
		if (!formData.slug.trim()) {
			formErrors.slug = 'Slug is required';
		} else if (formData.slug.trim().length < 2) {
			formErrors.slug = 'Slug must be at least 2 characters';
		} else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
			formErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
		}
		return Object.keys(formErrors).length === 0;
	}

	// Submit form — fetchSecure POST create/update.
	async function submitForm() {
		if (!encryptionKeys || !validateForm()) return;

		formSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				editingBrand ? '/api/admin/brands/update' : '/api/admin/brands/create',
				{
					method: 'POST',
					body: editingBrand
						? { documentKey: editingBrand._id, ...formData }
						: formData
				},
				encryptionKeys
			);
			formSubmitting = false;
			if (response.ok) {
				showToast(
					resolveServerMessage(response.message, lang, {
						vi: editingBrand ? pageContents.states.updated.vi : pageContents.states.created.vi,
						en: editingBrand ? pageContents.states.updated.en : pageContents.states.created.en
					})
				);
				closeModals();
				void fetchBrands();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.operationFailed),
					'error'
				);
			}
		} catch (err) {
			formSubmitting = false;
			showToast(pageContents.states.networkError[lang], 'error');
			if (import.meta.env.DEV) console.error('[brands] submit error:', err);
		}
	}

	// Delete brand — fetchSecure POST delete (documentKey trong body).
	async function deleteBrand(brand: BrandListItem) {
		if (!encryptionKeys) return;
		if (!confirm(`Delete "${brand.name}"? This action cannot be undone.`)) return;

		try {
			const response = await encryption.fetchSecure(
				'/api/admin/brands/delete',
				{ method: 'POST', body: { documentKey: brand._id } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.deleted)
				);
				void fetchBrands();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.deleteFailed),
					'error'
				);
			}
		} catch (err) {
			showToast(pageContents.states.networkError[lang], 'error');
			if (import.meta.env.DEV) console.error('[brands] delete error:', err);
		}
	}

	// Toast chuẩn hoá — client.browser?.toasts (pattern users page).
	function showToast(text: string, tone: 'success' | 'error' = 'success') {
		if (!client.browser) client.browser = {};
		client.browser.toasts?.create({ title: text, color: tone });
	}

	// Close modals
	function closeModals() {
		modalOpen = false;
		resetForm();
	}

	// Initial load
	// B8 realtime: refetch list khi collection thay đổi từ client khác
	onMount(() => subscribeDbChanges('brands', () => void fetchBrands()));
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchBrands();
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
				{pageContents.addBrand[lang]}
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
		<Checkbox bind:checked={showDeleted}>
			{pageContents.showDeleted[lang]}
		</Checkbox>
	</div>

	<!-- ── Trạng thái loading/first-load error ── -->
	{#if loadError}
		<div class="admin-state admin-state--error" data-test="brands-load-error">{loadError}</div>
	{/if}

	<!-- ── Bảng brands (DataTable + snippet actions) ── -->
	<div class="admin-table-wrap">
		<DataTable
			data={brandsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.empty[lang]}
			loadingLabel={pageContents.loading[lang]}
			caption={{ vi: 'Danh sách thương hiệu', en: 'Brand list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
			stickyHead
			mobileTapMode="callback"
			onRowClick={(row) => openEditModal(row as unknown as BrandListItem)}
			cardFields={['brand', 'slug', 'status', 'updated']}
			data-test="brands-datatable"
		>
			{#snippet actionsContent(row)}
				{@const brand = row as unknown as BrandListItem}
				<div class="row-actions">
					<Button variant="ghost" size="sm" onClick={() => openEditModal(brand)} data-test="brand-action-edit">
						{pageContents.editAction[lang]}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						color="error"
						onClick={() => deleteBrand(brand)}
						data-test="brand-action-delete"
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
	<Modal bind:display={modalOpen} onClose={closeModals} size="md">
		<ModalContainer>
			<ModalHeader>
				<h2 class="modal-title">
					{editingBrand ? pageContents.editTitle[lang] : pageContents.createTitle[lang]}
				</h2>
			</ModalHeader>
			<ModalBody class="modal-body">
				<div class="grid-2">
					<TextField name="brand-name" required>
						<Label>{pageContents.nameLabel[lang]}</Label>
						<Input
							bind:value={formData.name}
							placeholder={lang === 'vi' ? 'Nhập tên thương hiệu' : 'Enter brand name'}
						/>
						{#if formErrors.name}
							<span class="field-error" role="alert">{formErrors.name}</span>
						{/if}
					</TextField>
					<TextField name="brand-slug" required>
						<Label>{pageContents.slugLabel[lang]}</Label>
						<Input bind:value={formData.slug} placeholder="auto-generated from name" />
						{#if formErrors.slug}
							<span class="field-error" role="alert">{formErrors.slug}</span>
						{/if}
					</TextField>
				</div>

				<TextField name="brand-logo">
					<Label>{pageContents.logoLabel[lang]}</Label>
					<Input bind:value={formData.logoUrl} placeholder="https://example.com/logo.png" />
				</TextField>

				<div>
					<label for="brand-description" class="modal-field-label">{pageContents.descLabel[lang]}</label>
					<textarea
						id="brand-description"
						class="modal-textarea"
						rows={3}
						value={formData.description}
						oninput={(e) => (formData.description = (e.target as HTMLTextAreaElement).value)}
						placeholder={lang === 'vi' ? 'Nhập mô tả thương hiệu…' : 'Enter brand description…'}
					></textarea>
				</div>

				<TextField name="brand-status">
					<Label>{pageContents.statusLabel[lang]}</Label>
					<select
						class="modal-select"
						bind:value={formData.status}
						aria-label={pageContents.statusLabel[lang]}
					>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
				</TextField>
			</ModalBody>
			<ModalFooter class="modal-footer">
				{#if editingBrand}
					<!-- B5: mobile tap row mở modal edit — nút Xoá để xóa ngay từ modal. -->
					<Button
						variant="ghost"
						color="error"
						disabled={formSubmitting}
						data-test="brand-modal-delete"
						onClick={() => {
							const brand = editingBrand;
							closeModals();
							if (brand) void deleteBrand(brand);
						}}
					>
						{pageContents.deleteAction[lang]}
					</Button>
				{/if}
				<Button variant="outline" onClick={closeModals} disabled={formSubmitting}>
					{pageContents.cancel[lang]}
				</Button>
				<Button
					variant="solid"
					color="primary"
					loading={formSubmitting}
					onClick={submitForm}
				>
					{editingBrand ? pageContents.saveEdit[lang] : pageContents.saveCreate[lang]}
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

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	/* B5: nút Xoá trong modal edit — đẩy sang trái (tách khỏi nhóm Cancel/Save). */
	/* B5: :global toan phan — footer render qua ModalFooter (scope khac),
	   anchor scoped .modal-footer khong match. */
	:global(.modal-footer [data-test='brand-modal-delete']) {
		margin-right: auto;
	}
</style>
