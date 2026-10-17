<script lang="ts">
	// src/routes/(authorized)/admin/categories/+page.svelte
	// B6.2: migrate sang DataTable + Pagination (pattern users/brands page).
	// FIX BUG pre-existing: page cũ fetch GET ?params + đọc data.success/items
	// nhưng endpoint chỉ export POST (readAdminRequest mã hoá RSA) → bảng
	// không bao giờ render. Chuyển sang encryption.fetchSecure POST.
	// Category KHÔNG có deletedAt trong schema (hard-delete) → không toggle
	// "Show deleted". Tree hiển thị flatten theo depth — prefix '↳ ' ở cột
	// Category (DataTable render là string thuần, không HTML).
	import { onMount } from 'svelte';
	import { Button, DataTable, Pagination } from '$components/element';
	import { Input, Label, TextField } from '$components/form';
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
	interface CategoryListItem {
		_id: string;
		name: string;
		slug: string;
		parentId?: string | null;
		status: string;
		createdAt: string;
		updatedAt: string;
	}

	// Ngôn ngữ
	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : (client.browser?.language === 'en' ? 'en' : 'en')
	);

	// Type mở (pattern users/brands page) — lang index không narrow.
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Danh mục', en: 'Categories' },
		subtitle: { vi: 'Quản lý danh mục sản phẩm', en: 'Manage product categories' },
		addCategory: { vi: 'Thêm danh mục', en: 'Add Category' },
		searchPlaceholder: { vi: 'Tìm danh mục…', en: 'Search categories…' },
		empty: { vi: 'Chưa có danh mục', en: 'No categories found' },
		loading: { vi: 'Đang tải…', en: 'Loading categories…' },
		createTitle: { vi: 'Tạo danh mục', en: 'Create Category' },
		editTitle: { vi: 'Sửa danh mục', en: 'Edit Category' },
		nameLabel: { vi: 'Tên danh mục', en: 'Category Name' },
		slugLabel: { vi: 'Slug', en: 'Slug' },
		parentLabel: { vi: 'Danh mục cha', en: 'Parent Category' },
		parentNone: { vi: 'Không có (cấp cao nhất)', en: 'None (top level)' },
		statusLabel: { vi: 'Trạng thái', en: 'Status' },
		cancel: { vi: 'Huỷ', en: 'Cancel' },
		saveCreate: { vi: 'Tạo danh mục', en: 'Create Category' },
		saveEdit: { vi: 'Lưu thay đổi', en: 'Save Changes' },
		editAction: { vi: 'Sửa', en: 'Edit' },
		deleteAction: { vi: 'Xoá', en: 'Delete' },
		updated: { vi: 'Cập nhật', en: 'Updated' },
		totalCount: { vi: '{n} danh mục', en: '{n} categories' },
		states: {
			loadFailed: { vi: 'Không tải được danh sách danh mục', en: 'Failed to load categories' },
			created: { vi: 'Đã tạo danh mục', en: 'Category created' },
			updated: { vi: 'Đã lưu thay đổi', en: 'Category updated' },
			deleted: { vi: 'Đã xoá danh mục', en: 'Category deleted' },
			deleteFailed: { vi: 'Không xoá được danh mục', en: 'Failed to delete category' },
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
	let categories = $state<CategoryListItem[]>([]);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	let searchQuery = $state('');
	// Modal create/edit dùng chung 1 biến display (bind:display — modal tự
	// đóng qua Escape/backdrop phải sync ngược về parent, one-way sẽ hở).
	let modalOpen = $state(false);
	let editingCategory = $state<CategoryListItem | null>(null);
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
		slug: '',
		parentId: '',
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

	// Fetch categories — fetchSecure POST (endpoint mã hoá RSA).
	async function fetchCategories() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/categories/list',
				{
					method: 'POST',
					body: {
						page: pageNumber,
						pageSize,
						search: searchQuery || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { categories?: CategoryListItem[]; total?: number; page?: number }
					| undefined;
				categories = data?.categories ?? [];
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
			if (import.meta.env.DEV) console.error('[categories] fetch error:', err);
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
			void fetchCategories();
		}, 300);
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
		void fetchCategories();
	});

	// ── Tree: build depth cho từng category (parentId có thể nằm ngoài trang
	// hiện tại — node mồ côi coi như root, depth 0). Flatten để đút vào
	// DataTable (row = node, cột Category render prefix '↳ ' theo depth). ──
	interface TreeRow {
		category: CategoryListItem;
		depth: number;
	}

	function buildTreeRows(): TreeRow[] {
		const byId = new Map<string, TreeRow>();
		for (const c of categories) byId.set(c._id, { category: c, depth: 0 });

		const roots: TreeRow[] = [];
		for (const row of byId.values()) {
			const parent = row.category.parentId ? byId.get(row.category.parentId) : undefined;
			if (parent) {
				row.depth = parent.depth + 1;
			} else {
				roots.push(row);
			}
		}
		// Duyệt theo level: parent luôn đứng trước con. Chu trình parentId
		// (A→B→A) không vào roots → kèm cuối để không "mất" row.
		const out: TreeRow[] = [];
		const walk = (rows: TreeRow[], level: number) => {
			for (const r of rows) {
				if (r.depth !== level) continue;
				out.push(r);
				const children = [...byId.values()].filter(
					(x) => x.category.parentId === r.category._id
				);
				walk(children, level + 1);
			}
		};
		walk(roots, 0);
		for (const row of byId.values()) {
			if (!out.includes(row)) out.push(row);
		}
		return out;
	}

	const treeRows = $derived(buildTreeRows());

	// Row đút vào DataTable: row = category + _treeDepth marker (đọc trong
	// render cột). Object mới — không đột biến dữ liệu gốc.
	const tableRows = $derived(
		treeRows.map(({ category, depth }) => ({
			...category,
			_treeDepth: depth
		}))
	);
	const tableRowsAny = $derived(tableRows as unknown as Record<string, unknown>[]);

	// ── B6.2: DataTable columns ──
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'category',
			label: pageContents.title[lang],
			accessor: (row) => (row as unknown as CategoryListItem).name,
			render: (value, row) => {
				const depth = (row as unknown as { _treeDepth?: number })._treeDepth ?? 0;
				return depth > 0 ? `${'↳ '.repeat(depth)}${String(value)}` : String(value);
			}
		},
		{
			id: 'slug',
			label: pageContents.slugLabel[lang],
			accessor: (row) => (row as unknown as CategoryListItem).slug
		},
		{
			id: 'status',
			label: pageContents.statusLabel[lang],
			sortable: true,
			accessor: (row) => (row as unknown as CategoryListItem).status,
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
			sortable: true,
			accessor: (row) => formatDate((row as unknown as CategoryListItem).updatedAt),
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

	// Nhãn parent hiển thị theo depth (same prefix '↳ ' như cột table).
	function treeLabel(row: TreeRow): string {
		return row.depth > 0 ? `${'↳ '.repeat(row.depth)}${row.category.name}` : row.category.name;
	}

	// Danh sách parent khả dụng: loại chính nó + toàn bộ descendants (chọn
	// descendant làm parent → chu trình, node rơi khỏi tree).
	let availableParents = $derived.by(() => {
		const options: { value: string; label: string }[] = [];
		if (!editingCategory) {
			for (const r of treeRows) {
				options.push({ value: r.category._id, label: treeLabel(r) });
			}
			return options;
		}
		// Tập _id bị loại = editingCategory + descendants (BFS vòng lặp tới cố định)
		const excluded = new Set<string>([editingCategory._id]);
		let changed = true;
		while (changed) {
			changed = false;
			for (const r of treeRows) {
				if (r.category.parentId && excluded.has(r.category.parentId) && !excluded.has(r.category._id)) {
					excluded.add(r.category._id);
					changed = true;
				}
			}
		}
		for (const r of treeRows) {
			if (!excluded.has(r.category._id)) {
				options.push({ value: r.category._id, label: treeLabel(r) });
			}
		}
		return options;
	});

	// Open create modal
	function openCreateModal() {
		resetForm();
		if (maybeRestoreDraft('categories:create')) return;
		draftFormKey = 'categories:create';
		draftUserId = currentUserId();
		draftAutosaveArmed = false;
		closeGuard.markClean();
		modalOpen = true;
	}

	// Open edit modal
	function openEditModal(category: CategoryListItem) {
		resetForm();
		editingCategory = category;
		formData = {
			name: category.name,
			slug: category.slug,
			parentId: category.parentId ?? '',
			status: category.status
		};
		const key = `categories:edit:${category._id}`;
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
		formData = { name: '', slug: '', parentId: '', status: 'active' };
		formErrors = {};
		editingCategory = null;
		formSubmitting = false;
		draftFormKey = null;
		pendingDraftFormKey = null;
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
			formErrors.name = 'Category name is required';
		} else if (formData.name.trim().length < 2) {
			formErrors.name = 'Category name must be at least 2 characters';
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
				editingCategory ? '/api/admin/categories/update' : '/api/admin/categories/create',
				{
					method: 'POST',
					body: editingCategory
						? {
								documentKey: editingCategory._id,
								name: formData.name,
								slug: formData.slug,
								parentId: formData.parentId || null,
								status: formData.status
							}
						: {
								name: formData.name,
								slug: formData.slug,
								parentId: formData.parentId || undefined,
								status: formData.status
							}
				},
				encryptionKeys
			);
			formSubmitting = false;
			if (response.ok) {
				showToast(
					resolveServerMessage(response.message, lang, {
						vi: editingCategory ? pageContents.states.updated.vi : pageContents.states.created.vi,
						en: editingCategory ? pageContents.states.updated.en : pageContents.states.created.en
					})
				);
				// B9: save thành công → xoá draft (chỉ khi đúng form vừa submit).
				if (draftFormKey && draftUserId) clearDraft(draftUserId, draftFormKey);
				closeModals();
				void fetchCategories();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.operationFailed),
					'error'
				);
			}
		} catch (err) {
			formSubmitting = false;
			showToast(pageContents.states.networkError[lang], 'error');
			if (import.meta.env.DEV) console.error('[categories] submit error:', err);
		}
	}

	// Delete category — fetchSecure POST delete (documentKey trong body).
	// Server chặn xoá khi có children hoặc đang dùng bởi product (toast error).
	async function deleteCategory(category: CategoryListItem) {
		if (!encryptionKeys) return;
		if (!confirm(`Delete "${category.name}"? This action cannot be undone.`)) return;

		try {
			const response = await encryption.fetchSecure(
				'/api/admin/categories/delete',
				{ method: 'POST', body: { documentKey: category._id } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.states.deleted));
				void fetchCategories();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.deleteFailed),
					'error'
				);
			}
		} catch (err) {
			showToast(pageContents.states.networkError[lang], 'error');
			if (import.meta.env.DEV) console.error('[categories] delete error:', err);
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
	onMount(() => subscribeDbChanges('categories', () => void fetchCategories()));
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchCategories();
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
				{pageContents.addCategory[lang]}
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
	</div>

	<!-- ── Trạng thái loading/first-load error ── -->
	{#if loadError}
		<div class="admin-state admin-state--error" data-test="categories-load-error">{loadError}</div>
	{/if}

	<!-- ── Bảng categories (DataTable + snippet actions) ── -->
	<div class="admin-table-wrap">
		<DataTable
			data={tableRowsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			searchable
			searchPlaceholder={pageContents.searchPlaceholder}
			resizable={{ enabled: true, fit: true }}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.empty[lang]}
			loadingLabel={pageContents.loading[lang]}
			caption={{ vi: 'Danh sách danh mục', en: 'Category list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
			stickyHead
			mobileTapMode="callback"
			onRowClick={(row) => openEditModal(row as unknown as CategoryListItem)}
			cardFields={['category', 'slug', 'status', 'updated']}
			data-test="categories-datatable"
		>
			{#snippet actionsContent(row)}
				{@const category = row as unknown as CategoryListItem}
				<div class="row-actions">
					<Button variant="ghost" size="sm" onClick={() => openEditModal(category)} data-test="category-action-edit">
						{pageContents.editAction[lang]}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						color="error"
						onClick={() => deleteCategory(category)}
						data-test="category-action-delete"
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
	<Modal bind:display={modalOpen} onClose={closeModals} onCloseAttempt={closeGuard.attemptClose} size="md">
		<ModalContainer>
			<ModalHeader>
				<h2 class="modal-title">
					{editingCategory ? pageContents.editTitle[lang] : pageContents.createTitle[lang]}
				</h2>
			</ModalHeader>
			<ModalBody class="modal-body">
				<div class="grid-2">
					<TextField name="category-name" required>
						<Label>{pageContents.nameLabel[lang]}</Label>
						<Input
							bind:value={formData.name}
							placeholder={lang === 'vi' ? 'Nhập tên danh mục' : 'Enter category name'}
						/>
						{#if formErrors.name}
							<span class="field-error" role="alert">{formErrors.name}</span>
						{/if}
					</TextField>
					<TextField name="category-slug" required>
						<Label>{pageContents.slugLabel[lang]}</Label>
						<Input bind:value={formData.slug} placeholder="auto-generated from name" />
						{#if formErrors.slug}
							<span class="field-error" role="alert">{formErrors.slug}</span>
						{/if}
					</TextField>
				</div>

				<TextField name="category-parent">
					<Label>{pageContents.parentLabel[lang]}</Label>
					<select
						class="modal-select"
						bind:value={formData.parentId}
						aria-label={pageContents.parentLabel[lang]}
					>
						<option value="">{pageContents.parentNone[lang]}</option>
						{#each availableParents as parent (parent.value)}
							<option value={parent.value}>{parent.label}</option>
						{/each}
					</select>
				</TextField>

				<TextField name="category-status">
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
				{#if editingCategory}
					<!-- B5: mobile tap row mở modal edit — nút Xoá để xóa ngay từ modal. -->
					<Button
						variant="ghost"
						color="error"
						disabled={formSubmitting}
						data-test="category-modal-delete"
						onClick={() => {
							const category = editingCategory;
							closeModals();
							if (category) void deleteCategory(category);
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
					color={editingCategory ? 'primary' : 'success'}
					loading={formSubmitting}
					onClick={submitForm}
				>
					{editingCategory ? pageContents.saveEdit[lang] : pageContents.saveCreate[lang]}
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

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	/* B5: nút Xoá trong modal edit — đẩy sang trái (tách khỏi nhóm Cancel/Save). */
	/* B5: :global toan phan — footer render qua ModalFooter (scope khac),
	   anchor scoped .modal-footer khong match. */
	:global(.modal-footer [data-test='category-modal-delete']) {
		margin-right: auto;
	}
</style>
