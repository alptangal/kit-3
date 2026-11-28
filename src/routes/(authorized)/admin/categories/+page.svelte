<script lang="ts">
	// src/routes/(authorized)/admin/categories/+page.svelte
	// B6.2: migrate sang DataTable + Pagination (pattern users/brands page).
	// B54: đồng bộ chuẩn UI/UX page suppliers — search suggest từ khoá, setting
	// modal (sort + showDeleted), bulk copy/delete + selection, FAB mobile,
	// modal breadcrumb more-popover, skeleton (DataTable loading).
	// FIX BUG pre-existing: page cũ fetch GET ?params + đọc data.success/items
	// nhưng endpoint chỉ export POST (readAdminRequest mã hoá RSA) → bảng
	// không bao giờ render. Chuyển sang encryption.fetchSecure POST.
	// Category KHÔNG có deletedAt trong schema (hard-delete) → toggle
	// "Show deleted" chỉ persist prefs (server bỏ qua includeDeleted).
	import { onMount, flushSync, tick } from 'svelte';
	import { Button, DataTable, Pagination, AlertDialog, Spinner } from '$components/element';
	import { Input, Label, TextField, Select, Checkbox } from '$components/form';
	import { Modal } from '$components/modal';
	import { ModalContainer } from '$components/modal/Container';
	import { ModalHeader } from '$components/modal/Header';
	import { ModalBody } from '$components/modal/Body';
	import { ModalFooter } from '$components/modal/Footer';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import type { DataTableColumn, DataTableSortOrder } from '$components/element/datatable';
	import { resolveServerMessage } from '../_interface';
	import type { Size } from '$components/interface';
	import { saveDraft, readDraft, clearDraft } from '$modules/draft-store';
	import DraftRestoreDialog from '../../_DraftRestoreDialog.svelte';
	import { createCloseGuard } from '$modules/close-guard.svelte';

	import { subscribeDbChanges } from '$modules/db-realtime';
	// P3: dialog xác nhận khi đóng modal với form còn dirty.
	import DirtyCloseDialog from '../DirtyCloseDialog.svelte';
	// B54: prefs trang (sort/showDeleted) + từ khoá tìm kiếm gần đây.
	import {
		recordSearchKeyword,
		getSearchKeywords,
		saveDataTablePrefs,
		userPrefs
	} from '$store/user-prefs.svelte';
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

	// B54: isMobile — pattern suppliers (client.browser.isMobile).
	const isMobile: boolean = $derived(client.browser?.isMobile === true);

	// B54: helper — searchQuery có thể undefined (Input unmount emit undefined).
	const str = (v: unknown): string => (typeof v === 'string' ? v : '');

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
		// B54: thêm mới — breadcrumb more + search mobile + suggest + settings + bulk.
		crumbMore: { vi: 'Xem đường dẫn', en: 'Show path' },
		searchMobile: { vi: 'Tìm kiếm', en: 'Search' },
		suggest: { title: { vi: 'Từ khoá đã tìm', en: 'Recent searches' } },
		settings: {
			title: { vi: 'Cài đặt danh sách', en: 'List settings' },
			sortBy: { vi: 'Sắp xếp theo', en: 'Sort by' },
			sortDirection: { vi: 'Chiều sắp xếp', en: 'Sort direction' },
			asc: { vi: 'Tăng dần', en: 'Ascending' },
			desc: { vi: 'Giảm dần', en: 'Descending' },
			apply: { vi: 'Áp dụng', en: 'Apply' },
			reset: { vi: 'Đặt lại', en: 'Reset' },
			showDeleted: { vi: 'Hiện danh mục đã xoá', en: 'Show deleted categories' }
		},
		bulk: {
			title: { vi: 'Xoá danh mục đã chọn?', en: 'Delete selected categories?' },
			desc: {
				vi: '{count} danh mục sẽ bị xoá vĩnh viễn. Danh mục có danh mục con hoặc đang dùng bởi sản phẩm sẽ bị bỏ qua và báo lỗi.',
				en: '{count} categories will be permanently deleted. Categories with children or in use by products are skipped and reported.'
			},
			confirm: { vi: 'Xoá', en: 'Delete' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			copy: { vi: 'Copy', en: 'Copy' },
			delete: { vi: 'Xoá', en: 'Delete' },
			selected: { vi: 'Đã chọn {count}', en: 'Selected {count}' }
		},
		// B55 mục 6: more-menu footer modal (thống kê / xoá) — pattern suppliers.

		// B57: quick-create category (pattern suppliers).
		quickCreate: {
			title: { vi: 'Tạo mới nhanh', en: 'Quick create' },
			create: { vi: 'Tạo', en: 'Create' },
			createNew: { vi: 'Tạo mới "{value}"', en: 'Create new "{value}"' },
			nameLabel: { vi: 'Tên', en: 'Name' },
			failed: { vi: 'Tạo mới thất bại. Vui lòng thử lại.', en: 'Failed to create. Please try again.' }
		},
		more: {
			label: { vi: 'Tuỳ chọn khác', en: 'More options' },
			stats: { vi: 'Thống kê', en: 'Statistics' },
			delete: { vi: 'Xoá danh mục', en: 'Delete category' },
			deleteTitle: { vi: 'Xoá danh mục?', en: 'Delete category?' },
			deleteDesc: {
				vi: 'Danh mục này sẽ bị xoá vĩnh viễn khỏi hệ thống.',
				en: 'This category will be permanently removed.'
			},
			deleteConfirm: { vi: 'Xoá', en: 'Delete' },
			statsModal: { vi: 'Thống kê danh mục', en: 'Category statistics' },
			statsChildren: { vi: 'Số danh mục con', en: 'Child categories' },
			// B56: cột bảng con trong stats modal (DataTable chuẩn).
			statsChildrenCols: {
				name: { vi: 'Tên', en: 'Name' },
				slug: { vi: 'Slug', en: 'Slug' },
				status: { vi: 'Trạng thái', en: 'Status' },
				empty: { vi: 'Không có danh mục con', en: 'No child categories' }
			},
			// B56: analytics nhập hàng theo danh mục (clone suppliers more.analytics*).
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
			analyticsColValue: { vi: 'Giá trị', en: 'Value' },
		},
		states: {
			loadFailed: { vi: 'Không tải được danh sách danh mục', en: 'Failed to load categories' },
			created: { vi: 'Đã tạo danh mục', en: 'Category created' },
			updated: { vi: 'Đã lưu thay đổi', en: 'Category updated' },
			deleted: { vi: 'Đã xoá danh mục', en: 'Category deleted' },
			deleteFailed: { vi: 'Không xoá được danh mục', en: 'Failed to delete category' },
			operationFailed: { vi: 'Thao tác thất bại', en: 'Operation failed' },
			networkError: { vi: 'Lỗi kết nối', en: 'Network error' },
			bulkDeleted: { vi: 'Đã xoá {count} danh mục', en: 'Deleted {count} categories' },
			bulkDeleteFailed: { vi: 'Xoá hàng loạt không thành công', en: 'Bulk delete failed' },
			bulkCopied: { vi: 'Đã copy {count} dòng', en: 'Copied {count} rows' }
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
	// B55 mục 4: trạng thái "đang xử lý" cho search/filter (debounce 300ms +
	// fetch) — tách khỏi loading để spinner search hoạt động riêng.
	let searching = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let total = $state(0);
	let pageNumber = $state(1);
	let pageSize = $state(20);
	// B54: string | undefined — Input unmount (card mode / mobile swap) emit
	// value = undefined qua bind:value → không dùng type thuần string.
	let searchQuery = $state<string | undefined>('');
	// Modal create/edit dùng chung 1 biến display (bind:display — modal tự
	// đóng qua Escape/backdrop phải sync ngược về parent, one-way sẽ hở).
	let modalOpen = $state(false);
	let editingCategory = $state<CategoryListItem | null>(null);
	let formErrors = $state<Record<string, string>>({});
	let formSubmitting = $state(false);

	// ── B57: quick-create category từ Select parent (pattern suppliers B49) ──
	let quickCreateDisplay = $state(false);
	let quickCreateName = $state('');
	let quickCreateBusy = $state(false);
	let quickCreateError = $state('');
	let quickCreatePendingValue = $state('');

	// ── B54: sort client (server listCategories KHÔNG sort) + prefs ──
	const PREFS_KEY = '/admin/categories';
	let sortField = $state<string | undefined>('');
	let sortDirection = $state<'asc' | 'desc'>('desc');
	// B54: showDeleted — category hard-delete nhưng vẫn persist prefs (server
	// nhận includeDeleted, bỏ qua). Toggle ở setting modal (pattern brands).
	let showDeleted = $state(false);

	// ── B54: setting modal (sort + showDeleted) — pattern suppliers B10 ──
	let settingModalDisplay = $state(false);
	let settingSortField = $state('');
	let settingSortDirection = $state<'asc' | 'desc'>('desc');
	let settingShowDeleted = $state(false);
	$effect(() => {
		if (settingModalDisplay) {
			settingSortField = str(sortField);
			settingSortDirection = sortDirection;
			settingShowDeleted = showDeleted;
		}
	});

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
						search: str(searchQuery).trim() || undefined,
						includeDeleted: showDeleted || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			searching = false;
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
			searching = false;
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
		// B55 mục 4: bật searching ngay khi gõ (feedback trước debounce).
		searching = true;
		searchDebounce = setTimeout(() => {
			if (pageNumber === 1) void fetchCategories();
			else pageNumber = 1;
		}, 300);
	});

	// B54: toggle showDeleted (setting modal Apply) — refetch 1 lần (pattern
	// brands deletedToggleArmed). pageNumber khác 1 → về trang 1 (effect
	// pagination tự fetch); đã ở trang 1 → fetch trực tiếp.
	let deletedToggleArmed = false;
	$effect(() => {
		void showDeleted;
		if (!deletedToggleArmed) {
			deletedToggleArmed = true;
			return;
		}
		// B55 mục 4: toggle filter (setting modal Apply) → searching như search.
		searching = true;
		if (pageNumber === 1) void fetchCategories();
		else pageNumber = 1;
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

	// ── B56: columns bảng con trong stats modal (Tên/Slug/Trạng thái).
	const statsChildrenColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'name',
			label: pageContents.more.statsChildrenCols.name[lang],
			accessor: (row) => (row as unknown as CategoryListItem).name
		},
		{
			id: 'slug',
			label: pageContents.more.statsChildrenCols.slug[lang],
			accessor: (row) => (row as unknown as CategoryListItem).slug
		},
		{
			id: 'status',
			label: pageContents.more.statsChildrenCols.status[lang],
			accessor: (row) => (row as unknown as CategoryListItem).status,
			status: (value) => {
				const s = String(value ?? '');
				if (s === 'active') return 'success';
				if (s === 'inactive') return 'default';
				return 'default';
			}
		}
	]);

	// Options sortBy từ columns sortable (id + label hiện tại).
	// (khai báo SAU columns — $derived không hoist, dùng trước sẽ TS error)
	const settingSortOptions = $derived(
		columns.filter((c) => c.sortable).map((c) => ({ value: c.id, label: String(c.label) }))
	);

	// B54: sort client — bind:sortColumn/sortDirection tự sort; onSortChange
	// chỉ persist prefs (server listCategories không nhận sort).
	function onSortPersist(columnId: string, order: DataTableSortOrder) {
		void saveDataTablePrefs(PREFS_KEY, {
			sort: { field: columnId, direction: order }
		});
	}

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

	// B55 mục 2: options cho Select parent trong modal — thêm đầu mục
	// "Không có (cấp cao nhất)" với value '' (formData.parentId mặc định '').
	const parentSelectOptions = $derived([
		{ value: '', label: pageContents.parentNone[lang] },
		...availableParents
	]);

	// B55 mục 2: options Select status trong modal.
	const categoryStatusOptions = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' }
	];

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

	// ── B57: quick-create category từ Select parent (pattern suppliers B49) ──
	function openQuickCreate(value: string) {
		quickCreatePendingValue = value;
		quickCreateName = value;
		quickCreateError = '';
		quickCreateDisplay = true;
	}

	function closeQuickCreate() {
		quickCreateDisplay = false;
		quickCreateName = '';
		quickCreateError = '';
	}

	async function submitQuickCreate() {
		const name = quickCreateName.trim();
		if (!name || quickCreateBusy || !encryptionKeys) return;
		quickCreateBusy = true;
		quickCreateError = '';
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/categories/create',
				{ method: 'POST', body: { name, slug: generateSlug(name) } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { documentKey?: string } | undefined;
				showToast(pageContents.quickCreate.title[lang]);
				await fetchCategories();
				if (data?.documentKey) formData.parentId = data.documentKey;
				closeQuickCreate();
			} else {
				quickCreateError = resolveServerMessage(response.message, lang, pageContents.quickCreate.failed);
			}
		} catch (err) {
			quickCreateError = pageContents.quickCreate.failed[lang];
			if (import.meta.env.DEV) console.error('[categories] quick-create error:', err);
		} finally {
			quickCreateBusy = false;
		}
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
	// B55 mục 6: confirm chuyển sang AlertDialog (categoryDeleteDisplay) —
	// bỏ window.confirm native.
	async function deleteCategory(category: CategoryListItem) {
		if (!encryptionKeys) return;

		try {
			const response = await encryption.fetchSecure(
				'/api/admin/categories/delete',
				{ method: 'POST', body: { documentKey: category._id } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(resolveServerMessage(response.message, lang, pageContents.states.deleted));
				// Đóng modal form nếu đang mở (xoá từ more-menu — pattern suppliers)
				closeModals();
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
		// B55 mục 6: reset more-menu + dialogs khi đóng modal.
		categoryMoreOpen = false;
		categoryDeleteDisplay = false;
		categoryStatsDisplay = false;
		categoryAnalyticsDisplay = false;
		categoryAnalyticsData = undefined;
		categoryAnalyticsLoading = false;
		resetForm();
	}

	// ── B55 mục 6: more-menu footer modal (pattern suppliers Batch 20) ──
	let categoryMoreOpen = $state(false);
	let categoryMoreEl = $state<HTMLElement | null>(null);
	let categoryDeleteDisplay = $state(false);
	let categoryStatsDisplay = $state(false);
	// B56: bảng con stats — lọc từ list ĐÃ load (đếm client, không fetch).
	let categoryStatsChildren = $state<CategoryListItem[]>([]);
	// B56: modal phân tích nhập hàng theo danh mục (clone suppliers).
	let categoryAnalyticsDisplay = $state(false);
	let categoryAnalyticsLoading = $state(false);
	let categoryAnalyticsData = $state<undefined | {
		orderCount: number;
		totalQuantity: number;
		totalValue: number;
		monthly: Array<{ period: string; orderCount: number; quantity: number; value: number }>;
	}>(undefined);
	// B56: breadcrumb 3 nấc cho stats + analytics modal (state riêng).
	let statsCrumbNavEl = $state<HTMLElement | null>(null);
	let statsCrumbOverflow = $state(0);
	let statsCrumbMoreOpen = $state(false);
	let anaCrumbNavEl = $state<HTMLElement | null>(null);
	let anaCrumbOverflow = $state(0);
	let anaCrumbMoreOpen = $state(false);

	function moreOpenStats() {
		categoryMoreOpen = false;
		categoryStatsDisplay = true;
		categoryStatsChildren = categories.filter((c) => c.parentId === editingCategory?._id);
	}
	
	// B56: mở modal phân tích — reset data + fetch (pattern suppliers moreOpenAnalytics).
	function moreOpenAnalytics() {
		categoryMoreOpen = false;
		categoryAnalyticsDisplay = true;
		categoryAnalyticsData = undefined;
		void loadCategorySummary();
	}

	// B56: gọi API analytics/query type=category-summary (fetchSecure tự mã hoá).
	async function loadCategorySummary() {
		if (!encryptionKeys || !editingCategory || categoryAnalyticsLoading) return;
		categoryAnalyticsLoading = true;
		try {
			const response = await encryption.fetchSecure(
			'/api/admin/analytics/query',
			{ method: 'POST', body: { type: 'category-summary', categoryId: editingCategory._id } },
			encryptionKeys
			);
			if (response.ok) {
				categoryAnalyticsData = response.data as {
					orderCount: number;
					totalQuantity: number;
					totalValue: number;
					monthly: Array<{ period: string; orderCount: number; quantity: number; value: number }>;
				};
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.states.operationFailed), 'error');
				categoryAnalyticsDisplay = false;
			}
		} catch (err) {
			showToast(pageContents.states.networkError[lang], 'error');
			categoryAnalyticsDisplay = false;
			if (import.meta.env.DEV) console.error('[admin/categories] summary failed:', err);
		} finally {
			categoryAnalyticsLoading = false;
		}
	}
	
	function moreOpenDelete() {
		categoryMoreOpen = false;
		categoryDeleteDisplay = true;
	}
	
	// B56: format tiền (clone suppliers — Intl theo lang, không currency code).
	function formatMoney(value?: number): string {
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value ?? 0);
	}

	// Thống kê: số danh mục con — đếm client từ list đã load (không fetch).
	const editingChildrenCount = $derived.by(() => {
		const cat = editingCategory;
		if (!cat) return 0;
		return categories.filter((c) => c.parentId === cat._id).length;
	});

	$effect(() => {
		// Outside-click đóng more-menu footer (mousedown — pattern suppliers).
		if (!categoryMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (categoryMoreEl && t && categoryMoreEl.contains(t)) return;
			categoryMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	// ── B54: search suggest từ khoá (pattern suppliers) ──
	// Lưu từ khoá khi blur (có nội dung) — recordSearchKeyword routeKey.
	function saveSearchKeyword() {
		const kw = str(searchQuery).trim();
		if (kw) recordSearchKeyword(PREFS_KEY, kw);
	}
	// Gợi ý từ khoá đã tìm, lọc theo query đang gõ.
	const recentKeywordsFiltered = $derived.by(() => {
		const q = str(searchQuery).trim().toLowerCase();
		const all = getSearchKeywords(PREFS_KEY);
		if (!q) return all;
		return all.filter((k) => k.toLowerCase().includes(q));
	});
	let searchFocused = $state(false);
	let suggestOpen = $state(false);
	// Mobile 2c: search icon → text field; đóng khi blur RỖNG.
	let mobileSearchOpen = $state(false);
	// bind:this Input component → instance { configs } — focus() qua
	// instance.configs.focus() (flushSync mount + focus TRONG user gesture).
	let mobileSearchInputInstance = $state<{ configs: { focus: () => void } } | undefined>(
		undefined
	);

	// ── B54: bulk copy/delete + selection ──
	let selectedIds = $state<string[]>([]);
	let bulkDeleting = $state(false);
	let bulkDeleteDisplay = $state(false);

	function clearSelection() {
		selectedIds = [];
	}

	// Bulk copy TSV: header + các cột có accessor function (pattern suppliers).
	function bulkCopySelected() {
		const cols = columns.filter((c) => c.id !== 'actions' && typeof c.accessor === 'function');
		const header = cols.map((c) => String(c.label)).join('\t');
		const rows = tableRowsAny
			.filter((r) => str(r._id) && selectedIds.includes(str(r._id)))
			.map((r) =>
				cols
					.map((c) => String((c.accessor as (row: unknown) => unknown)(r) ?? ''))
					.join('\t')
			);
		const tsv = [header, ...rows].join('\n');
		navigator.clipboard
			.writeText(tsv)
			.then(() =>
				showToast(
					pageContents.states.bulkCopied[lang].replace('{count}', String(selectedIds.length)),
					'success'
				)
			)
			.catch(() => showToast(pageContents.states.operationFailed[lang], 'error'));
	}

	async function bulkDeleteSelected() {
		if (!encryptionKeys || bulkDeleting || selectedIds.length === 0) return;
		bulkDeleting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/categories/bulk',
				{ method: 'POST', body: { ids: selectedIds } },
				encryptionKeys
			);
			bulkDeleting = false;
			if (response.ok) {
				const data = response.data as { deleted?: number } | undefined;
				showToast(
					pageContents.states.bulkDeleted[lang].replace(
						'{count}',
						String(data?.deleted ?? selectedIds.length)
					),
					'success'
				);
				bulkDeleteDisplay = false;
				clearSelection();
				void fetchCategories();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.bulkDeleteFailed),
					'error'
				);
			}
		} catch (err) {
			bulkDeleting = false;
			showToast(pageContents.states.bulkDeleteFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[categories] bulk delete failed:', err);
		}
	}

	// ── B54: scroll state minimal (pattern suppliers 566-660) — chỉ phần cần
	// cho is-scrolling + fab-hidden. Wrap tự cuộn → onTableScroll; iOS ≤15.3
	// (:has() chết → wrap không cuộn, trang cuộn ở root Container) →
	// onWindowScroll qua document capture. ──
	let wrapEl = $state<HTMLElement | undefined>(undefined);
	let tableScrolled = $state(false);
	// B56: đồng bộ suppliers — trạng thái đáy bảng + pop animation pagination.
	let wrapAtBottom = $state(false);
	let paginationPopped = $state(false);
	let scrollRaf = 0;
	let scrollActive = $state(false);
	let scrollActiveTimer: ReturnType<typeof setTimeout>;
	let lastActiveScrollTop = -1;
	function markScrollActive(scrollTop: number, maxScroll: number) {
		// iOS rubber-band: bỏ qua event ngoài biên (top<0 / top>max) + top không
		// đổi — chỉ cú kéo thật trong biên mới prolong ẩn (dừng 200ms trả lại).
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
			// khi wrap thực sự scrollable (clone suppliers).
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

	// Tìm ancestor scroll container thật (root Container overflow:auto).
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
		// Wrap tự cuộn được → nhường event cho onTableScroll (2 hàm chung rAF).
		const wrapNow = wrapEl;
		if (wrapNow && wrapNow.scrollHeight > wrapNow.clientHeight + 4) return;
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			const el = wrapEl;
			if (!el || el.scrollHeight > el.clientHeight + 4) return;
			const sc = findScrollContainer();
			const top = sc ? sc.scrollTop : window.scrollY;
			const viewH = sc ? sc.clientHeight : window.innerHeight;
			const totalH = sc ? sc.scrollHeight : document.documentElement.scrollHeight;
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

	// ── B54: modal breadcrumb more-popover (pattern suppliers B18/B34) ──
	let crumbTitleEl = $state<HTMLElement | null>(null);
	// crumbOverflow = số nấc breadcrumb bị ẩn vào more-popover (0 = hiển thị đủ).
	let crumbOverflow = $state(0);
	let crumbMoreOpen = $state(false);
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
		// Bất kỳ item con scrollWidth > clientWidth+1 = đang bị cắt. Bỏ qua
		// more-button + popover (popover item nowrap ellipsis cũng tràn nhưng
		// không phải nấc breadcrumb trên nav).
		const anyTruncated = () => {
			for (const el of nav.children) {
				const item = el as HTMLElement;
				if (
					item.classList.contains('supplier-modal-title__more') ||
					item.classList.contains('supplier-crumb-popover')
				)
					continue;
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
	$effect(() => {
		// Đo tràn breadcrumb sau khi modal render (1 frame) + resize.
		void modalOpen;
		void editingCategory?.name;
		void isMobile;
		void lang;
		const measure = () =>
			void measureTitleCrumbs(
				crumbTitleEl,
				!isMobile,
				() => crumbOverflow,
				(v) => (crumbOverflow = v)
			);
		const raf = requestAnimationFrame(measure);
		const ro = new ResizeObserver(() => requestAnimationFrame(measure));
		if (crumbTitleEl) ro.observe(crumbTitleEl);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
	$effect(() => {
		// Outside-click đóng popover crumb (mousedown — pattern suppliers).
		if (!crumbMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (crumbTitleEl && t && crumbTitleEl.contains(t)) return;
			crumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});
	$effect(() => {
		// Đóng modal → reset trạng thái crumb (mở lại đo từ đầu).
		if (!modalOpen) {
			crumbOverflow = 0;
			crumbMoreOpen = false;
		}
	});
	
	// B56: đo tràn breadcrumb stats modal sau render + resize (pattern B34).
	$effect(() => {
		void categoryStatsDisplay;
		void editingCategory?.name;
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
	
	// B56: đo tràn breadcrumb analytics modal (pattern suppliers B34).
	$effect(() => {
		void categoryAnalyticsDisplay;
		void categoryAnalyticsLoading;
		void editingCategory?.name;
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
	
	// B56: outside-click đóng popover breadcrumb stats + analytics (mousedown).
	$effect(() => {
		if (!statsCrumbMoreOpen && !anaCrumbMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (statsCrumbMoreOpen && statsCrumbNavEl && t && statsCrumbNavEl.contains(t)) return;
			if (anaCrumbMoreOpen && anaCrumbNavEl && t && anaCrumbNavEl.contains(t)) return;
			statsCrumbMoreOpen = false;
			anaCrumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});
	
	// B56: modal con đóng → reset crumb riêng (element unmount, chỉ reset state).
	$effect(() => {
		if (!categoryStatsDisplay) {
			statsCrumbOverflow = 0;
			statsCrumbMoreOpen = false;
		}
		if (!categoryAnalyticsDisplay) {
			anaCrumbOverflow = 0;
			anaCrumbMoreOpen = false;
		}
	});

	// Initial load
	// B54: seed prefs sort + showDeleted TRƯỚC generateRSAKeyPair + load
	// (pattern suppliers 3639).
	onMount(() => subscribeDbChanges('categories', () => void fetchCategories()));
	onMount(() => {
		// B54: scroll listener document capture (root Container là scroll
		// container — scroll không bubble, phải capture).
		document.addEventListener('scroll', onWindowScroll, { capture: true, passive: true });
		return () => {
			document.removeEventListener('scroll', onWindowScroll, { capture: true });
		};
	});
	onMount(async () => {
		if (!client.browser) client.browser = {};
		const prefs = userPrefs.datatable?.[PREFS_KEY];
		if (prefs?.sort?.field) {
			sortField = prefs.sort.field;
			sortDirection = prefs.sort.direction === 'asc' ? 'asc' : 'desc';
		}
		if (prefs?.filters?.showDeleted === true) showDeleted = true;
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchCategories();
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section
	class="admin-page admin-page--fullheight"
	class:at-bottom={wrapAtBottom}
	class:is-scrolled={tableScrolled && isMobile}
	class:is-scrolling={scrollActive && isMobile}
>
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<!-- B55 mục 5: create chuyển vào caption tools (pattern suppliers) —
		     bỏ nút header tránh trùng chức năng (mobile đã có FAB). -->
	</header>

	<!-- ── Trạng thái loading/first-load error ── -->
	{#if loadError}
		<div class="admin-state admin-state--error" data-test="categories-load-error">{loadError}</div>
	{/if}

	<!-- ── Bảng categories (DataTable + captionTools bulk + snippet actions) ── -->
	<div class="admin-table-wrap" bind:this={wrapEl} onscroll={onTableScroll}>
		<DataTable
			data={tableRowsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			bind:sortColumn={sortField}
			bind:sortDirection={sortDirection}
			onSortChange={onSortPersist}
			// highlight theo query trang (search thật do server làm)
			searchQuery={searchQuery ?? ''}
			resizable={{ enabled: true, fit: true }}
			loading={loading || searching}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.empty[lang]}
			loadingLabel={pageContents.loading[lang]}
			caption={{ vi: 'Danh sách danh mục', en: 'Category list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
			stickyHead
			selectable
			showIndex
			indexOffset={(pageNumber - 1) * pageSize}
			indexCheckboxes
			checkOnRowClick
			selectionTools={false}
			// id THẬT (_id DB) — default idOf = index trang → stale giữa trang
			getRowId={(row) => String((row as unknown as CategoryListItem)._id ?? '')}
			selection={selectedIds}
			onSelectionChange={(ids) => (selectedIds = ids)}
			mobileTapMode="callback"
			onRowClick={(row) => openEditModal(row as unknown as CategoryListItem)}
			cardFields={['category', 'slug', 'status', 'updated']}
			class={[
				tableScrolled && isMobile ? 'caption-collapsed' : undefined,
				scrollActive && isMobile ? 'tools-hidden-mobile' : undefined
			].filter(Boolean).join(' ') || undefined}
			data-test="categories-datatable"
		>
			{#snippet captionTools()}
				<!-- B55 mục 5: search + setting + create vào caption row (pattern
				     suppliers) — luôn 1 row, search chiếm phần còn lại. -->
				<div class="admin-search" data-suggest>
					{#if isMobile && !mobileSearchOpen}
						<!-- mobile 2c: search icon → click mở text field (autofocus);
						     đóng khi blur RỖNG (có từ khoá → giữ field) -->
						<button
							type="button"
							class="mobile-caption-icon"
							aria-label={pageContents.searchMobile[lang]}
							data-test="categories-mobile-search-open"
							onclick={() => {
								// flushSync mount field + focus TRONG user gesture (iOS Safari
								// chỉ mở keyboard khi focus nằm trong gesture).
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
									<!-- B55 mục 4: đang chờ kết quả search/filter → icon thành spinner -->
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
					{#if suggestOpen && recentKeywordsFiltered.length > 0}
						<div class="suggest-popover" role="listbox">
							<p class="suggest-title">{pageContents.suggest.title[lang]}</p>
							{#each recentKeywordsFiltered as kw (kw)}
								<button
									type="button"
									class="suggest-item"
									role="option"
									aria-selected="false"
									// preventDefault giữ focus input (mousedown không blur)
									onmousedown={(e) => e.preventDefault()}
									onclick={() => {
										searchQuery = kw;
										suggestOpen = false;
										if (pageNumber === 1) void fetchCategories();
										else pageNumber = 1;
									}}
								>
									{kw}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- B54: setting modal (sort + showDeleted) — desktop outline tune,
				     mobile icon (categories không có Select filter trang). -->
				<div class="admin-actions-group">
					{#if isMobile}
						<button
							type="button"
							class="mobile-caption-icon"
							aria-label={pageContents.settings.title[lang]}
							data-test="categories-mobile-filter-btn"
							onclick={() => {
								settingModalDisplay = true;
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
								settingModalDisplay = true;
							}}
							aria-label={pageContents.settings.title[lang]}
							data-test="categories-setting-btn"
						>
							<Icon icon={iconify['tune-rounded']} size="sm" />
						</Button>
					{/if}
					<!-- Quy ước màu nút: create = success. Mobile icon-only (FAB chỉ
					     hiện khi đã cuộn — đây là lối create khi chưa cuộn). -->
					{#if isMobile}
						<Button
							color="success"
							size="sm"
							onClick={openCreateModal}
							aria-label={pageContents.addCategory[lang]}
							data-test="categories-create-btn"
						>
							<Icon icon={iconify['add-rounded']} size="sm" />
						</Button>
					{:else}
						<Button color="success" size="sm" onClick={openCreateModal} data-test="categories-create-btn">
							{pageContents.addCategory[lang]}
						</Button>
					{/if}
				</div>
				{#if selectedIds.length > 0}
					<!-- bulk-bar khi chọn ≥1 row — mobile fixed đáy (trên pagination) -->
					<div class="bulk-row" data-test="categories-bulk-row">
						<div class="bulk-bar" data-test="categories-bulk-bar">
							<span class="bulk-count">
								{pageContents.bulk.selected[lang].replace('{count}', String(selectedIds.length))}
							</span>
							<Button color="primary" variant="soft" size="sm" onClick={bulkCopySelected} data-test="categories-bulk-copy">
								{pageContents.bulk.copy[lang]}
							</Button>
							<Button
								color="error"
								variant="soft"
								size="sm"
								onClick={() => {
									bulkDeleteDisplay = true;
								}}
								data-test="categories-bulk-delete"
							>
								{pageContents.bulk.delete[lang]}
							</Button>
							<Button color="default" variant="ghost" size="sm" onClick={clearSelection} aria-label={pageContents.cancel[lang]}>
								<Icon icon={iconify['close-rounded']} size="sm" />
							</Button>
						</div>
					</div>
				{/if}
			{/snippet}
			{#snippet actionsContent(row)}
				{@const category = row as unknown as CategoryListItem}
				<div class="row-actions">
					<Button variant="ghost" size="sm" onClick={() => openEditModal(category)} data-test="category-action-edit">
						{pageContents.editAction[lang]}
					</Button>
					<!-- B55 mục 6: window.confirm đã bỏ → Delete mở AlertDialog xác nhận
					     (editingCategory = row để dialog hiển thị đúng tên). -->
					<Button
						variant="ghost"
						size="sm"
						color="error"
						onClick={() => {
							editingCategory = category;
							categoryDeleteDisplay = true;
						}}
						data-test="category-action-delete"
					>
						{pageContents.deleteAction[lang]}
					</Button>
				</div>
			{/snippet}
		</DataTable>
	</div>

	<!-- ── Pagination server-side ── -->
	<footer
	class="admin-pagination"
	class:pagination-collapsed={scrollActive && isMobile}
	class:pagination-pop={paginationPopped && isMobile}
	>
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

	<!-- ── Create/Edit Modal (B54: breadcrumb + more-popover, ẩn X mobile) ── -->
	<Modal
		bind:display={modalOpen}
		onClose={closeModals}
		onCloseAttempt={closeGuard.attemptClose}
		size="md"
		class="supplier-modal-root"
	>
		<ModalContainer>
			<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
				<div class="supplier-modal-title" bind:this={crumbTitleEl}>
					{#if isMobile && crumbOverflow > 0}
						<button
							type="button"
							class="supplier-modal-title__more"
							data-test="category-crumb-more"
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
					{#if !isMobile || crumbOverflow === 0}
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
							<span class="supplier-modal-title__label">
								{pageContents.title[lang]}
							</span>
						{/if}
					{/if}
					{#if editingCategory}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{formData.name || pageContents.editTitle[lang]}
						</span>
					{:else}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active">
							{pageContents.saveCreate[lang]}
						</span>
					{/if}
				</div>
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
					<!-- B55 mục 2: tái sử dụng Select component thay select raw. -->
					<Select
						bind:value={formData.parentId}
						options={parentSelectOptions}
						searchable
						clearable
						placeholder={pageContents.parentNone[lang]}
						name="category-parent"
						allowCreate
						createOptionLabel={pageContents.quickCreate.createNew[lang]}
						onOptionCreate={(value) => openQuickCreate(value)}
					/>
				</TextField>

				<TextField name="category-status">
					<Label>{pageContents.statusLabel[lang]}</Label>
					<!-- B55 mục 2: Select component — status không cho clear. -->
					<Select
						bind:value={formData.status}
						options={categoryStatusOptions}
						clearable={false}
						name="category-status"
					/>
				</TextField>
			</ModalBody>
			<ModalFooter class="modal-footer">
				{#if editingCategory}
					<!-- B55 mục 6: thay nút Xoá bằng icon more mở popover
					     (thống kê / xoá qua AlertDialog) — pattern suppliers Batch 20.
					     Bọc div relative làm anchor + guard outside-click. -->
					<div class="category-more-wrap" bind:this={categoryMoreEl}>
						<Button
							variant="ghost"
							color="default"
							aspect-square
							aria-label={pageContents.more.label[lang]}
							aria-expanded={categoryMoreOpen}
							disabled={formSubmitting}
							data-test="category-more-btn"
							onclick={() => {
								categoryMoreOpen = !categoryMoreOpen;
							}}
						>
							<Icon icon={iconify['more-horiz-rounded']} size="sm" />
						</Button>
						{#if categoryMoreOpen}
							<div class="category-more-popover" role="menu">
								<button
									type="button"
									class="category-more-popover__item"
									role="menuitem"
									disabled={formSubmitting}
									onclick={moreOpenStats}
									data-test="category-more-stats"
								>
									{pageContents.more.stats[lang]}
								</button>
									<!-- B56: item Phân tích (analytics) — mở modal thống kê nhập hàng. -->
									<button
									type="button"
									class="category-more-popover__item"
									role="menuitem"
									disabled={formSubmitting}
									onclick={moreOpenAnalytics}
									data-test="category-more-analytics"
								>
									{pageContents.more.analyticsTitle[lang]}
								</button>
								<button
									type="button"
									class="category-more-popover__item category-more-popover__item--danger"
									role="menuitem"
									disabled={formSubmitting}
									onclick={moreOpenDelete}
									data-test="category-more-delete"
								>
									{pageContents.more.delete[lang]}
								</button>
							</div>
						{/if}
					</div>
				{/if}
				<span class="category-footer-spacer"></span>
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

	<!-- ── B57: Quick-create category (Select parent allowCreate) ── -->
	<Modal
		bind:display={quickCreateDisplay}
		onClose={closeQuickCreate}
		onCloseAttempt={() => { if (!quickCreateBusy) closeQuickCreate(); }}
		isDimissable
		size="sm"
		class="supplier-modal-root"
	>
		<ModalContainer>
			<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
				{pageContents.quickCreate.title[lang]}
			</ModalHeader>
			<ModalBody>
				{#if quickCreateError}
					<div class="form-error-banner" role="alert">{quickCreateError}</div>
				{/if}
				<TextField name="quick-create-name">
					<Label>{pageContents.quickCreate.nameLabel[lang]}</Label>
					<Input
						bind:value={quickCreateName}
						disabled={quickCreateBusy}
						data-test="quick-create-name"
					/>
				</TextField>
			</ModalBody>
			<ModalFooter class="modal-footer">
				<Button
					variant="solid"
					color="success"
					loading={quickCreateBusy}
					disabled={quickCreateBusy || !quickCreateName.trim()}
					onClick={submitQuickCreate}
					data-test="quick-create-submit"
				>
					{pageContents.quickCreate.create[lang]}
				</Button>
				<Button variant="outline" disabled={quickCreateBusy} onClick={closeQuickCreate}>
					{pageContents.cancel[lang]}
				</Button>
			</ModalFooter>
		</ModalContainer>
	</Modal>

	<!-- ── B54: Setting modal (sort + showDeleted) — pattern suppliers B10 ── -->
	{#if settingModalDisplay}
		<Modal bind:display={settingModalDisplay} size="sm" class="supplier-modal-root">
			<ModalContainer>
				<ModalHeader>{pageContents.settings.title[lang]}</ModalHeader>
				<ModalBody>
					<div class="setting-form" data-test="categories-setting-modal">
						<TextField name="categories-setting-sort">
							<Label>{pageContents.settings.sortBy[lang]}</Label>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={settingSortField}
								options={settingSortOptions}
								clearable
								fullscreen
								placeholder={pageContents.settings.sortBy[lang]}
								data-test="categories-setting-sort"
							/>
						</TextField>
						<TextField name="categories-setting-direction">
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
								data-test="categories-setting-direction"
							/>
						</TextField>
						<div class="setting-check">
							<Checkbox bind:checked={settingShowDeleted} data-test="categories-setting-show-deleted">
								{pageContents.settings.showDeleted[lang]}
							</Checkbox>
						</div>
					</div>
				</ModalBody>
				<ModalFooter class="modal-footer">
					<Button
						color="secondary"
						variant="outline"
						disabled={settingSortField === '' && !settingShowDeleted}
						onClick={() => {
							settingSortField = '';
							settingSortDirection = 'desc';
							settingShowDeleted = false;
						}}
					>
						{pageContents.settings.reset[lang]}
					</Button>
					<Button
						color="primary"
						data-test="categories-setting-apply"
						onClick={() => {
							const prevShowDeleted = showDeleted;
							sortField = settingSortField;
							sortDirection = settingSortDirection === 'asc' ? 'asc' : 'desc';
							showDeleted = settingShowDeleted;
							settingModalDisplay = false;
							void saveDataTablePrefs(PREFS_KEY, {
								filters: { showDeleted: showDeleted || null },
								sort: sortField ? { field: sortField, direction: sortDirection } : undefined
							});
							// showDeleted đổi → effect toggle tự fetch (tránh double).
							// Sort client không cần fetch — chỉ về trang 1.
							if (prevShowDeleted === showDeleted && pageNumber !== 1) pageNumber = 1;
						}}
					>
						{pageContents.settings.apply[lang]}
					</Button>
				</ModalFooter>
			</ModalContainer>
		</Modal>
	{/if}

	<!-- ── B54: AlertDialog bulk-delete (confirm xoá hàng loạt) ── -->
	{#if bulkDeleteDisplay}
		<AlertDialog
			bind:open={bulkDeleteDisplay}
			title={pageContents.bulk.title[lang]}
			description={pageContents.bulk.desc[lang]}
		>
			<AlertDialog.Content>
				<AlertDialog.Header variant="danger">
					<AlertDialog.Title>{pageContents.bulk.title[lang]}</AlertDialog.Title>
					<AlertDialog.Description>
						{pageContents.bulk.desc[lang].replace('{count}', String(selectedIds.length))}
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

	<!-- ── B55 mục 6: AlertDialog confirm xoá 1 danh mục từ more-menu ── -->
	{#if categoryDeleteDisplay}
		<AlertDialog
			bind:open={categoryDeleteDisplay}
			title={pageContents.more.deleteTitle[lang]}
			description={pageContents.more.deleteDesc[lang]}
		>
			<AlertDialog.Content>
				<AlertDialog.Header variant="danger">
					<AlertDialog.Title>{pageContents.more.deleteTitle[lang]}</AlertDialog.Title>
					<AlertDialog.Description>
						{pageContents.more.deleteDesc[lang]} «{editingCategory?.name ?? ''}»
					</AlertDialog.Description>
				</AlertDialog.Header>
				<AlertDialog.Footer>
					<AlertDialog.Cancel>{pageContents.bulk.cancel[lang]}</AlertDialog.Cancel>
					<AlertDialog.Action
						color="danger"
						disabled={formSubmitting}
						onselect={() => {
							const category = editingCategory;
							closeModals();
							if (category) void deleteCategory(category);
						}}
						data-test="category-more-delete-confirm"
					>
						{pageContents.more.deleteConfirm[lang]}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog>
	{/if}

	<!-- ── B56: Modal thống kê (DataTable danh mục con — đếm client) ── -->
	{#if categoryStatsDisplay}
		<Modal
			bind:display={categoryStatsDisplay}
			onClose={() => (categoryStatsDisplay = false)}
			size="lg"
			class="supplier-modal-root"
		>
		<ModalContainer>
			<ModalHeader>
				<div class="supplier-modal-title" bind:this={statsCrumbNavEl}>
					{#if isMobile && statsCrumbOverflow > 0}
						<button
							type="button"
							class="supplier-modal-title__more"
							data-test="category-stats-crumb-more"
							aria-label={pageContents.crumbMore[lang]}
							aria-expanded={statsCrumbMoreOpen}
							onclick={() => (statsCrumbMoreOpen = !statsCrumbMoreOpen)}
							>
								<Icon icon={iconify['more-horiz-rounded']} size="sm" />
							</button>
							{#if statsCrumbMoreOpen}
								<div class="supplier-crumb-popover" role="menu">
									<button
										type="button"
										class="supplier-crumb-popover__item"
										onclick={() => {
											statsCrumbMoreOpen = false;
											categoryStatsDisplay = false;
											// B36: về datatable — đóng cả form (dirty-guard hỏi Discard khi dirty).
											closeGuard.attemptClose();
										}}
										>
											{pageContents.title[lang]}
										</button>
								</div>
							{/if}
						{/if}
					{#if !isMobile || statsCrumbOverflow === 0}
						{#if isMobile}
							<button
								type="button"
								class="supplier-modal-title__label supplier-modal-title__crumb"
								onclick={() => {
									categoryStatsDisplay = false;
									closeGuard.attemptClose();
								}}
								>
									{pageContents.title[lang]}
								</button>
						{:else}
							<span class="supplier-modal-title__label">
								{pageContents.title[lang]}
							</span>
						{/if}
					{/if}
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<button
						type="button"
						class="supplier-modal-title__name supplier-modal-title__crumb"
						onclick={() => (categoryStatsDisplay = false)}
						>
							{editingCategory?.name ?? ''}
						</button>
					<span class="supplier-modal-title__name" aria-hidden="true">›</span>
					<span class="supplier-modal-title__name supplier-modal-title__name--active">
						{pageContents.more.statsModal[lang]}
					</span>
				</div>
			</ModalHeader>
			<ModalBody class="modal-body">
				<DataTable
					data={categoryStatsChildren as unknown as Record<string, unknown>[]}
					columns={statsChildrenColumns}
					pageSize={20}
					showIndex
					visual={{ striped: true, hoverable: true }}
					emptyLabel={pageContents.more.statsChildrenCols.empty[lang]}
					caption={{ vi: 'Danh sách danh mục con', en: 'Child category list' }}
				/>
			</ModalBody>
		</ModalContainer>
		</Modal>
	{/if}

	<!-- ── B56: Modal phân tích nhập hàng theo danh mục (clone suppliers) ── -->
	{#if categoryAnalyticsDisplay}
		<Modal
			bind:display={categoryAnalyticsDisplay}
			onClose={() => (categoryAnalyticsDisplay = false)}
			size="sm"
			class="supplier-analytics-modal-root"
		>
		<ModalContainer>
			<ModalHeader>
				{#if isMobile}
					<div class="supplier-modal-title" bind:this={anaCrumbNavEl}>
						{#if anaCrumbOverflow > 0}
							<button
								type="button"
								class="supplier-modal-title__more"
								data-test="category-analytics-crumb-more"
								aria-label={pageContents.crumbMore[lang]}
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
													categoryAnalyticsDisplay = false;
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
													categoryAnalyticsDisplay = false;
													}}
												>
													{editingCategory?.name ?? ''}
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
										categoryAnalyticsDisplay = false;
										closeGuard.attemptClose();
									}}
									>
										{pageContents.title[lang]}
									</button>
							{/if}
							{#if anaCrumbOverflow < 2}
								<span class="supplier-modal-title__name" aria-hidden="true">›</span>
								<button
									type="button"
									class="supplier-modal-title__name supplier-modal-title__crumb"
									onclick={() => (categoryAnalyticsDisplay = false)}
									>
										{editingCategory?.name ?? ''}
									</button>
							{/if}
							<span class="supplier-modal-title__name" aria-hidden="true">›</span>
							<span class="supplier-modal-title__name supplier-modal-title__name--active">
								{pageContents.more.analyticsTitle[lang]}
							</span>
					</div>
				{:else}
					{pageContents.more.analyticsTitle[lang]}{editingCategory?.name ? ` — ${editingCategory.name}` : ''}
				{/if}
			</ModalHeader>
			<ModalBody class="modal-body">
				{#if categoryAnalyticsLoading}
					<div class="history-state">{pageContents.more.analyticsLoading[lang]}</div>
				{:else if !categoryAnalyticsData || categoryAnalyticsData.orderCount === 0}
					<div class="history-state">{pageContents.more.analyticsEmpty[lang]}</div>
				{:else}
					<div class="supplier-analytics" data-test="categories-analytics-panel">
						<div class="supplier-analytics__totals">
							<div class="supplier-analytics__stat">
								<span class="supplier-analytics__stat-value">{Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(categoryAnalyticsData.orderCount)}</span>
								<span class="supplier-analytics__stat-label">{pageContents.more.analyticsOrderCount[lang]}</span>
							</div>
							<div class="supplier-analytics__stat">
								<span class="supplier-analytics__stat-value">{Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(categoryAnalyticsData.totalQuantity)}</span>
								<span class="supplier-analytics__stat-label">{pageContents.more.analyticsTotalQuantity[lang]}</span>
							</div>
							<div class="supplier-analytics__stat">
								<span class="supplier-analytics__stat-value">{formatMoney(categoryAnalyticsData.totalValue)}</span>
								<span class="supplier-analytics__stat-label">{pageContents.more.analyticsTotalValue[lang]}</span>
							</div>
						</div>
						{#if categoryAnalyticsData.monthly.length > 0}
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
										{#each categoryAnalyticsData.monthly as m (m.period)}
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
			</ModalBody>
		</ModalContainer>
		</Modal>
	{/if}

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

	<!-- ── B54: FAB mobile (3 nút: create/setting/search) — ẩn khi chưa cuộn ── -->
	<div
		class="fab-group"
		class:fab-hidden={isMobile && !tableScrolled}
		class:is-scrolling={scrollActive && isMobile}
		data-suggest
	>
		<button
			type="button"
			class="fab fab--primary"
			aria-label={pageContents.addCategory[lang]}
			data-test="categories-fab"
			onclick={() => openCreateModal()}
		>
			<Icon icon={iconify['add-rounded']} />
		</button>
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.settings.title[lang]}
			data-test="categories-fab-setting"
			onclick={() => {
				settingModalDisplay = true;
				scrollActive = false;
			}}
		>
			<Icon icon={iconify['tune-rounded']} />
		</button>
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.searchMobile[lang]}
			data-test="categories-fab-search-btn"
			onclick={() => {
				// flushSync mount field + focus TRONG gesture (iOS keyboard).
				flushSync(() => {
					mobileSearchOpen = true;
					suggestOpen = true;
					scrollActive = false;
				});
				mobileSearchInputInstance?.configs.focus();
			}}
		>
			<Icon icon={iconify['search-rounded']} />
		</button>
	</div>
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

	/* ── B56: Fullheight (clone suppliers) — ZERO 3 var sticky của layout: wrap
	   tự scroll trong page (caption/th sticky bám wrap, không bám layout). ── */
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
			&.is-scrolled,
			&.is-scrolling {
				gap: 0.375rem;
				padding-block: 0.5rem;
			}
		}
	}

	/* Cuộn tới đáy: bỏ padding block page — tối đa không gian row. */
	.admin-page--fullheight.at-bottom {
		@media (max-width: 767px) {
			padding-block: 0;
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

	/* B55 mục 5: search VÀO caption của DataTable (bỏ .admin-filters row) —
	   luôn cùng row với setting/create; search chiếm phần còn lại của row
	   (flex:1) sau khi setting/create chiếm phần của chúng. */
	.admin-search {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		max-width: none;
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

	/* B54: mobile icon search/filter thu gọn (pattern suppliers). */
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

	/* ── B55 mục 5: caption tools (pattern suppliers) ── */
	.admin-actions-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	/* Mobile: Button size-sm (2.75rem) KHÔNG bằng nút icon (2.25rem) trong
	   cùng group → thu Button về 2.25rem CHỈ mobile; caption-collapsed co
	   1.75rem giữ nguyên. */
	@media (max-width: 767px) {
		:global(.datatable-caption-tools .admin-actions-group .button-root) {
			height: 2.25rem;
			min-height: 2.25rem;
		}
	}

	/* Select filter (nếu trang thêm sau) trong caption — width cố định 10rem
	   (pattern suppliers). */
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

	/* Scroll → caption collapsed (mobile): thu nhỏ tools (search/btn). */
	@media (max-width: 767px) {
		:global(.datatable-root.caption-collapsed) {
			:global(.datatable-caption-tools .admin-search .input-root) {
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

	/* B55: mobile đang cuộn → ẨN row tools (opacity — giữ flow height).
	   Bulk-bar vẫn hiện (user đang thao tác). */
	:global(.datatable-root.tools-hidden-mobile) {
		@media (max-width: 767px) {
			:global(.datatable-caption-tools .admin-search),
			:global(.datatable-caption-tools .admin-actions-group) {
				opacity: 0;
				pointer-events: none;
				transition: opacity 150ms ease;
			}
		}
	}

	/* ── B55 mục 6: more-menu footer modal (clone suppliers) ── */
	.category-more-wrap {
		position: relative;
	}

	.category-more-popover {
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
		box-shadow: var(--box-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
	}

	.category-more-popover__item {
		display: block;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
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

	.category-more-popover__item--danger {
		color: var(--error, hsl(356.95 95.9% 57.72%));

		&:hover:not(:disabled),
		&:focus-visible {
			background: var(--error-50, hsl(356.95 95.9% 57.72% / 0.08));
		}
	}

	/* Footer form modal: more-menu trái — spacer đẩy Save/Cancel sang phải
	   (footer là flex justify-end; spacer flex:1 chiếm khoảng giữa).
	   Class thật của footer element là .modal-footer-root (Footer/Main.svelte). */
	:global(.modal-footer-root .category-footer-spacer) {
		flex: 1;
	}

	/* B54: form trong setting modal (pattern suppliers .setting-form). */
	.setting-form {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.setting-check {
		display: flex;
		align-items: center;
	}

	/* B57: banner lỗi trong quick-create modal (pattern suppliers). */
	.form-error-banner {
		background: var(--danger-soft, hsl(358, 62.5%, 90.6%));
		color: var(--error);
		border-left: 3px solid var(--error);
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
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

	/* B56: Fullheight — wrap tự cuộn dọc (scroll container của page). */
	.admin-page--fullheight .admin-table-wrap {
		overflow: auto;
		/* Tắt scroll anchoring — anchor tự điều chỉnh scrollTop khi scroll-active
		   co/giãn padding → LOOP co/giãn (bẫy suppliers Batch8). */
		overflow-anchor: none;
	}

	/* Nút action trong cột actions DataTable (snippet actionsContent). */
	.row-actions {
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
	}

	/* B54: bulk-bar (copy nguyên pattern suppliers). */
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

	/* B54: bulk-bar nổi khi có selection. Mobile: fixed đáy viewport (trên
	   pagination). Desktop giữ trong caption tools. */
	@media (max-width: 767px) {
		.bulk-row {
			position: fixed;
			left: 0;
			right: 0;
			bottom: calc(2.75rem + 0.75rem); // trên pagination (B25)
			z-index: 310;
			padding: 0.5rem 0.75rem;
			background: var(--background, #fff);
			border-top: 1px solid var(--default-300);
			padding-right: 4.75rem; // chỗ FAB (giống pagination B25)
		}
	}

	/* B53: khi đang cuộn ẩn bulk-bar như các group khác — giữ chỗ trong flow
	   để không đẩy layout (transition riêng để mờ đi mượt). */
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


	.admin-pagination {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.25rem;
	}

	/* B56: pagination pop-anim (clone suppliers — flash khi hiện lại đáy). */
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

	/* ── B54: FAB mobile (copy pattern suppliers) ── */
	.fab-group {
		position: fixed;
		right: 1rem;
		bottom: 7.25rem;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.6rem;
		z-index: 400;
		/* ẩn theo HÀNH ĐỘNG cuộn — scrollY=0 → ẩn (tools đang hiện), đang cuộn
		   → ẩn, dừng 200ms → hiện lại. */
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

	/* Fullheight padding bottom cho FAB — FAB group 3 nút chồng dọc ~7rem +
	   pagination ~3rem → đệm 12rem để card cuối không bị FAB fixed che. */
	@media (max-width: 767px) {
		.admin-page--fullheight {
			padding-bottom: 12rem;
		}

		/* B56: chừa chỗ phải cho FAB (giữ rule cũ). */
		.admin-pagination {
			padding-right: 4.75rem;
		}

		/* B56: pagination LUÔN cố định sát đáy viewport mobile — clone suppliers
		   Batch 25 (fixed bottom + background che nội dung cuộn; FAB z400 > 300). */
		.admin-page--fullheight .admin-pagination {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 300;
			padding: 0.5rem 0.75rem 0.75rem;
			padding-right: 4.75rem;
			background: var(--background);
			border-top: 1px solid var(--default-300);
		}
	}

	/* ── B54: Mobile FULL-SIZE modal (copy pattern suppliers batch7) — modal
	   form chiếm trọn màn hình. KHÔNG dùng vh/dvh (iOS ≤15.3 chết) — fixed
	   inset:0 = đúng vùng nhìn thấy trên mọi trình duyệt. ── */
	@media (hover: none) and (pointer: coarse), (max-width: 640px) {
		:global(.modal-root.supplier-modal-root) {
			padding: 0;
			align-items: stretch;
		}

		:global(.supplier-modal-root .modal-container-root) {
			position: fixed;
			inset: 0;
			width: 100% !important; /* thắng .size-md — scoped CSS load sau page CSS */
			max-width: none;
			max-height: none;
			border-radius: 0;
			margin: 0;
		}

		/* Header modal: co padding + title đẩy sang TRÁI (header mặc định
		   justify-end làm title trôi phải khi ẩn nút close trên mobile). */
		:global(.supplier-modal-root .modal-header-root) {
			padding-block: 0.5rem;
			justify-content: flex-start;
		}

		/* Title chiếm đủ width header (clientWidth cố định) — toggle ẩn item
		   breadcrumb không đổi kích thước container → RO không ping-pong. */
		.supplier-modal-title {
			flex: 1 1 auto;
		}
	}

	/* B54: modal-title breadcrumb (copy pattern suppliers B16/B18). */
	.supplier-modal-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		/* mốc định vị popover tràn breadcrumb */
		position: relative;
		/* stacking context z3 để popover con thắng .field-icon (z2) */
		z-index: 3;
	}

	/* nút more — hiện khi item breadcrumb bị ẩn vào popover (mobile) */
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

	/* popover item breadcrumb bị ẩn — cấu trúc breadcrumb trục Y */
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
		/* token đúng là --box-shadow-lg (variables.scss:570) */
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
		/* --foreground-600 = 7.0:1 PASS AA (--foreground-500 fail sát 4.5) */
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

	/* mobile — label thành nút breadcrumb item DEACTIVE nhưng tap được
	   (quay lại datatable qua attemptClose). Reset style button về text. */
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

	/* name = breadcrumb item ACTIVE (đậm hơn item label). */
	.supplier-modal-title__name--active {
		color: var(--foreground);
		font-weight: 600;
	}

	/* dấu phân tách breadcrumb — không co giãn */
	.supplier-modal-title__name[aria-hidden='true'] {
		flex: none;
		overflow: visible;
	}

	/* ✕ = đóng (không destructive) → trung tính hoá (pattern suppliers). */
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

	/* ── B56: analytics nhập hàng (clone suppliers .supplier-analytics*) ── */
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

	/* B56: state loading/empty cho analytics (clone suppliers .history-state).
	   Tên class giữ nguyên — tương thích pattern chung, mỗi page scoped riêng. */
	.history-state {
		padding: 2rem 1rem;
		text-align: center;
		color: var(--color-text-muted, var(--muted, #6b7280));
		font-size: 0.9rem;
	}

	/* B56: modal analytics full-size mobile — clone suppliers (class riêng
	   .supplier-analytics-modal-root; desktop vẫn size sm giữa màn). */
	@media (hover: none) and (pointer: coarse), (max-width: 640px) {
		:global(.modal-root.supplier-analytics-modal-root) {
			padding: 0;
			align-items: stretch;
		}
		:global(.supplier-analytics-modal-root .modal-container-root) {
			position: fixed;
			inset: 0;
			width: 100% !important; /* thắng .size-sm — scoped CSS load sau page CSS */
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
</style>
