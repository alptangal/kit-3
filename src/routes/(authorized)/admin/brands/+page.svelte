<script lang="ts">
	// src/routes/(authorized)/admin/brands/+page.svelte
	// B6.2: migrate sang DataTable + Pagination (pattern users page).
	// FIX BUG pre-existing: page cũ fetch GET ?params + đọc data.success/data.items
	// nhưng endpoint chỉ export POST (readAdminRequest mã hoá RSA) + response
	// {ok, message, data:{brands}} → bảng không bao giờ render. Chuyển sang
	// encryption.fetchSecure POST như users page.
	// Batch 54: đồng bộ chuẩn UI/UX suppliers — search suggest từ khoá + setting
	// modal (sort/filter) + bulk copy/delete + FAB mobile + modal breadcrumb
	// more-popover + skeleton. Sort CHỐT client-side (listBrands không sort server).
	import { onMount, flushSync, tick } from 'svelte';
	import { Button, DataTable, Pagination, AlertDialog, Spinner } from '$components/element';
	import { ImageUpload, Input, Label, TextField, Select, Textarea } from '$components/form';
	import { Modal } from '$components/modal';
	import { ModalContainer } from '$components/modal/Container';
	import { ModalHeader } from '$components/modal/Header';
	import { ModalBody } from '$components/modal/Body';
	import { ModalFooter } from '$components/modal/Footer';
	import { Icon } from '$components/element/icon';
	import { iconify } from '$assets/icons/iconify';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { recordSearchKeyword, saveDataTablePrefs, getSearchKeywords, userPrefs } from '$store/user-prefs.svelte';
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
	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : (client.browser?.language === 'en' ? 'en' : 'en')
	);

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
		// Batch54: setting modal (filter + sort) — pattern suppliers
		settings: {
			title: { vi: 'Cài đặt danh sách', en: 'List settings' },
			showDeleted: { vi: 'Hiện đã xoá', en: 'Show deleted' },
			sortBy: { vi: 'Sắp xếp theo', en: 'Sort by' },
			sortDirection: { vi: 'Chiều sắp xếp', en: 'Sort direction' },
			asc: { vi: 'Tăng dần', en: 'Ascending' },
			desc: { vi: 'Giảm dần', en: 'Descending' },
			apply: { vi: 'Áp dụng', en: 'Apply' },
			reset: { vi: 'Đặt lại', en: 'Reset' }
		},
		// Batch54: bulk copy/delete + dialog confirm
		bulk: {
			title: { vi: 'Xoá thương hiệu đã chọn?', en: 'Delete selected brands?' },
			desc: {
				vi: 'Các thương hiệu đã chọn sẽ bị xoá vĩnh viễn khỏi hệ thống.',
				en: 'The selected brands will be permanently removed.'
			},
			confirm: { vi: 'Xoá', en: 'Delete' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			copy: { vi: 'Copy', en: 'Copy' },
			delete: { vi: 'Xoá', en: 'Delete' },
			selected: { vi: 'Đã chọn {count}', en: '{count} selected' }
		},
		// Batch54: suggest popover từ khoá đã tìm
		suggest: {
			title: { vi: 'Từ khoá đã tìm', en: 'Recent searches' }
		},
		// B55 mục 6: more menu footer modal (thống kê + xoá qua AlertDialog)
		more: {
			label: { vi: 'Thêm thao tác', en: 'More actions' },
			stats: { vi: 'Thống kê', en: 'Statistics' },
			delete: { vi: 'Xoá thương hiệu', en: 'Delete brand' },
			deleteTitle: { vi: 'Xoá thương hiệu này?', en: 'Delete this brand?' },
			deleteDesc: {
				vi: 'Thương hiệu sẽ bị xoá vĩnh viễn khỏi hệ thống.',
				en: 'The brand will be permanently removed.'
			},
			deleteConfirm: { vi: 'Xoá', en: 'Delete' },
			statsModal: { products: { vi: 'Số sản phẩm', en: 'Products' } }
		},
		// Batch54: nút more khi breadcrumb modal tràn
		crumbMore: { vi: 'Xem đường dẫn', en: 'Show path' },
		states: {
			loadFailed: { vi: 'Không tải được danh sách thương hiệu', en: 'Failed to load brands' },
			created: { vi: 'Đã tạo thương hiệu', en: 'Brand created' },
			updated: { vi: 'Đã lưu thay đổi', en: 'Brand updated' },
			deleted: { vi: 'Đã xoá thương hiệu', en: 'Brand deleted' },
			deleteFailed: { vi: 'Không xoá được thương hiệu', en: 'Failed to delete brand' },
			operationFailed: { vi: 'Thao tác thất bại', en: 'Operation failed' },
			networkError: { vi: 'Lỗi kết nối', en: 'Network error' },
			bulkDeleted: { vi: 'Đã xoá {count} thương hiệu', en: 'Deleted {count} brands' },
			bulkDeleteFailed: { vi: 'Không xoá được thương hiệu đã chọn', en: 'Failed to delete selected brands' },
			bulkCopied: { vi: 'Đã copy {count} thương hiệu', en: 'Copied {count} brands' },
			copyFailed: { vi: 'Không copy được', en: 'Copy failed' }
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
	// B55 mục 4: trạng thái đang xử lý search (debounce → fetch xong) — animation
	let searching = $state(false);
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

	// B55 mục 2: options Select status (component Select thay select raw)
	const brandStatusOptions = [
		{ value: 'active', label: 'Active' },
		{ value: 'inactive', label: 'Inactive' }
	];

	// Form state
	let formData = $state({
		name: '',
		slug: '',
		logoUrl: '',
		description: '',
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

	// ── Batch54: chuẩn suppliers — search suggest + setting + bulk + FAB + crumb ──
	const PREFS_KEY = '/admin/brands';
	const str = (v: unknown): string => (typeof v === 'string' ? v : '');
	const isMobile = $derived(client.browser?.isMobile ?? false);

	// Search suggest (pattern suppliers): mobile icon → field; popover từ khoá.
	let searchFocused = $state(false);
	let suggestOpen = $state(false);
	let mobileSearchOpen = $state(false);
	let mobileSearchInputInstance = $state<{ configs: { focus: () => void } } | undefined>(undefined);

	function saveSearchKeyword() {
		const kw = (searchQuery ?? '').trim();
		if (kw) recordSearchKeyword(PREFS_KEY, kw);
	}
	const recentKeywordsFiltered = $derived.by(() => {
		const q = (searchQuery ?? '').trim().toLowerCase();
		const all = getSearchKeywords(PREFS_KEY);
		return q ? all.filter((k) => k.toLowerCase().includes(q)) : all;
	});

	// ── B55 mục 6: more menu footer modal (pattern suppliers B20) ──
	let brandMoreOpen = $state(false);
	let brandMoreEl = $state<HTMLElement | undefined>(undefined);
	let brandDeleteDisplay = $state(false);
	let brandStatsDisplay = $state(false);
	let brandStatsLoading = $state(false);
	let brandStatsData = $state<{ products: number } | undefined>(undefined);
	// Brand chờ xác nhận xoá từ row action (deleteBrand không còn window.confirm)
	let pendingDeleteBrand = $state<BrandListItem | undefined>(undefined);

	// Sort — CHỐT client-side (listBrands chỉ nhận page/pageSize/includeDeleted/search).
	// DataTable sortable tự sort data đã load; onSortChange chỉ persist prefs.
	let sortField = $state('');
	let sortDirection = $state<'asc' | 'desc'>('desc');

	// Setting modal (filter showDeleted + sort) — pattern suppliers: mở từ nút
	// tune header (desktop) / icon mobile + FAB. Apply mới ghi vào state thật.
	let settingModalDisplay = $state(false);
	let settingSortField = $state('');
	let settingSortDirection = $state<'asc' | 'desc'>('desc');
	// Select value là string → draft showDeleted dạng 'true'/'false' (convert khi Apply).
	let settingShowDeleted = $state<'true' | 'false'>('false');
	$effect(() => {
		if (settingModalDisplay) {
			settingSortField = sortField;
			settingSortDirection = sortDirection;
			settingShowDeleted = showDeleted ? 'true' : 'false';
		}
	});

	// Bulk selection (pattern suppliers).
	let selectedIds = $state<string[]>([]);
	let bulkDeleteDisplay = $state(false);
	let bulkDeleting = $state(false);
	const bulkDisplayCount = $derived(selectedIds.length);

	function clearBrandsSelection() {
		selectedIds = [];
	}

	// Bulk copy TSV (header + các cột accessor) — pattern suppliers bulkCopySelected.
	function bulkCopySelected() {
		const cols = columns.filter((c) => c.id !== 'actions' && typeof c.accessor === 'function');
		const header = cols.map((c) => String(c.label)).join('\t');
		const rows = brands
			.filter((b) => b._id && selectedIds.includes(b._id))
			.map((b) =>
				cols.map((c) => String((c.accessor as (row: unknown) => unknown)(b) ?? '')).join('\t')
			);
		const tsv = [header, ...rows].join('\n');
		navigator.clipboard
			.writeText(tsv)
			.then(() =>
				showToast(pageContents.states.bulkCopied[lang].replace('{count}', String(bulkDisplayCount)))
			)
			.catch(() => showToast(pageContents.states.copyFailed[lang], 'error'));
	}

	// Bulk delete — POST /api/admin/brands/bulk {ids} (endpoint riêng Batch54).
	async function bulkDeleteSelected() {
		if (!encryptionKeys || bulkDeleting || selectedIds.length === 0) return;
		bulkDeleting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/brands/bulk',
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
					)
				);
				bulkDeleteDisplay = false;
				clearBrandsSelection();
				await fetchBrands();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, pageContents.states.bulkDeleteFailed),
					'error'
				);
			}
		} catch (err) {
			bulkDeleting = false;
			showToast(pageContents.states.bulkDeleteFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[brands] bulk delete failed:', err);
		}
	}

	// ── Batch54: setting modal Apply — gán sort + showDeleted + persist prefs +
	// về trang 1 + reload (mirror suppliers setting Apply). Reset disabled khi
	// hết filter/sort. ──
	function applyBrandsSettings() {
		sortField = settingSortField;
		sortDirection = settingSortDirection === 'asc' ? 'asc' : 'desc';
		showDeleted = settingShowDeleted === 'true';
		settingModalDisplay = false;
		saveDataTablePrefs(PREFS_KEY, {
			filters: { showDeleted: showDeleted === true ? true : null },
			sort: sortField ? { field: sortField, direction: sortDirection } : undefined
		});
		pageNumber = 1;
		void fetchBrands();
	}

	// ── Batch54: DataTable onSortChange — sort client-side (bindable tự sort data
	// đã load); handler CHỈ persist prefs (không refetch — listBrands không sort).
	function onBrandsSortChange(columnId: string, order: 'asc' | 'desc' | null) {
		if (!order || !columnId) {
			sortField = '';
			sortDirection = 'desc';
		} else {
			sortField = columnId;
			sortDirection = order === 'asc' ? 'asc' : 'desc';
		}
		saveDataTablePrefs(PREFS_KEY, {
			filters: { showDeleted: showDeleted === true ? true : null },
			sort: sortField ? { field: sortField, direction: sortDirection } : undefined
		});
	}

	// ── Scroll state minimal (pattern suppliers 660-802 — chỉ phần is-scrolling +
	// fab-hidden cho mobile): tableScrolled quyết định FAB ẩn/hiện; scrollActive
	// ẩn bulk-bar/FAB khi đang cuộn. Wrap không tự cuộn (iOS ≤15.3 :has chết) →
	// fallback document capture walk-up ancestor (pattern suppliers).
	let wrapEl = $state<HTMLElement | undefined>(undefined);
	let tableScrolled = $state(false);
	let scrollActive = $state(false);
	let scrollRaf = 0;
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
	function applyScrollTop(top: number, viewH: number, totalH: number) {
		markScrollActive(top, totalH - viewH);
		tableScrolled = top > 8;
	}
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
		// wrap tự cuộn được → nhường event cho onTableScroll (listener trên wrap);
		// 2 handler dùng CHUNG scrollRaf (pattern suppliers B39 guard).
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
			applyScrollTop(top, viewH, totalH);
		});
	}
	function onTableScroll() {
		const el = wrapEl;
		if (!el) return;
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => {
			scrollRaf = 0;
			applyScrollTop(el.scrollTop, el.clientHeight, el.scrollHeight);
		});
	}

	// ── Modal breadcrumb more-popover (pattern suppliers B18/B34) ──
	let crumbNavEl = $state<HTMLElement | null>(null);
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
	// Đo tràn breadcrumb modal sau render + resize (rAF + ResizeObserver).
	$effect(() => {
		void modalOpen;
		void editingBrand?.name;
		void formData.name;
		void isMobile;
		void lang;
		const raf = requestAnimationFrame(() =>
			void measureTitleCrumbs(crumbNavEl, !isMobile, () => crumbOverflow, (v) => (crumbOverflow = v))
		);
		const ro = new ResizeObserver(() =>
			requestAnimationFrame(() =>
				void measureTitleCrumbs(crumbNavEl, !isMobile, () => crumbOverflow, (v) => (crumbOverflow = v))
			)
		);
		if (crumbNavEl) ro.observe(crumbNavEl);
		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
	// Reset more-popover khi đóng modal.
	$effect(() => {
		if (!modalOpen) {
			crumbMoreOpen = false;
			crumbOverflow = 0;
		}
	});
	// Outside-click đóng popover breadcrumb (mousedown — pattern B34 review P3).
	$effect(() => {
		if (!crumbMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (crumbNavEl && t && crumbNavEl.contains(t)) return;
			crumbMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
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
			searching = false; // B55: search xong (cả ok lẫn lỗi response)
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
			searching = false;
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
		searching = true; // B55: đang xử lý search — bật ngay khi gõ, tắt khi fetch xong
		searchDebounce = setTimeout(() => {
			pageNumber = 1;
			void fetchBrands();
		}, 300);
	});

	// Batch54: Checkbox showDeleted TRONG admin-filters bỏ — filter chuyển vào
	// setting modal (Apply mới fetch explicit → không cần effect refetch).

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
			sortable: true
		},
		{
			id: 'slug',
			label: pageContents.slugLabel[lang],
			accessor: (row) => (row as unknown as BrandListItem).slug,
			sortable: true
		},
		{
			id: 'status',
			label: pageContents.statusLabel[lang],
			sortable: true,
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
			sortable: true,
			accessor: (row) => formatDate((row as unknown as BrandListItem).updatedAt),
			noHighlight: true
		}
	]);

	// Options sortBy từ columns sortable (id + label hiện tại).
	// (khai báo SAU columns — $derived không hoist, dùng trước sẽ TS error)
	const settingSortOptions = $derived(
		columns.filter((c) => c.sortable).map((c) => ({ value: c.id, label: String(c.label) }))
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

	function isRowDeleted(brand: BrandListItem): boolean {
		return !!brand.deletedAt;
	}

	// Open create modal
	function openCreateModal() {
		resetForm();
		if (maybeRestoreDraft('brands:create')) return;
		draftFormKey = 'brands:create';
		draftUserId = currentUserId();
		draftAutosaveArmed = false;
		closeGuard.markClean();
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
		const key = `brands:edit:${brand._id}`;
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
			draftAutosaveArmed = false; // form vừa reset (sạch) — re-arm để không ghi ngược draft rỗng
			closeGuard.markClean();
			modalOpen = true;
		}
	}

	// Reset form
	function resetForm() {
		formData = { name: '', slug: '', logoUrl: '', description: '', status: 'active' };
		formErrors = {};
		editingBrand = null;
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
				// B9: save thành công → xoá draft (chỉ khi đúng form vừa submit).
				if (draftFormKey && draftUserId) clearDraft(draftUserId, draftFormKey);
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

	// ── B55 mục 6: more menu handlers ──
	function moreOpenStats() {
		brandMoreOpen = false;
		brandStatsDisplay = true;
		brandStatsData = undefined;
		void loadBrandStats();
	}

	function moreOpenDelete() {
		brandMoreOpen = false;
		brandDeleteDisplay = true;
	}

	// Thống kê: tổng số sản phẩm thuộc brand (pageSize 1 — chỉ cần total).
	async function loadBrandStats() {
		if (!encryptionKeys || !editingBrand || brandStatsLoading) return;
		brandStatsLoading = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/products/list',
				{ method: 'POST', body: { page: 1, pageSize: 1, brandId: editingBrand._id } },
				encryptionKeys
			);
			if (response.ok) {
				const data = response.data as { total?: number } | undefined;
				brandStatsData = { products: data?.total ?? 0 };
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.states.operationFailed), 'error');
				brandStatsDisplay = false;
			}
		} catch (err) {
			showToast(pageContents.states.networkError[lang], 'error');
			brandStatsDisplay = false;
			if (import.meta.env.DEV) console.error('[brands] stats error:', err);
		} finally {
			brandStatsLoading = false;
		}
	}

	// Delete brand — fetchSecure POST delete (documentKey trong body).
	// B55 mục 6: window.confirm bỏ — xác nhận qua AlertDialog brandDeleteDisplay
	// (more-menu footer hoặc row action đều mở dialog trước khi gọi).
	async function deleteBrand(brand: BrandListItem) {
		if (!encryptionKeys) return;

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
				// Đóng modal form nếu đang mở (xoá từ more-menu — pattern suppliers)
				closeModals();
				pendingDeleteBrand = undefined;
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

	// Close modals — ĐÓNG THẬT (programmatic, bypass guard). Dùng khi: submit
	// ok, user xác nhận discard trong dialog, hoặc nút Xoá (delete). Nút Cancel
	// + ESC/backdrop/× đi qua closeGuard.attemptClose (dirty → dialog xác nhận).
	function closeModals() {
		dirtyCloseDisplay = false;
		modalOpen = false;
		brandMoreOpen = false;
		brandDeleteDisplay = false;
		brandStatsDisplay = false;
		pendingDeleteBrand = undefined;
		resetForm();
	}

	// B55 mục 6: outside-click đóng more-menu footer (mousedown — pattern suppliers).
	$effect(() => {
		if (!brandMoreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (brandMoreEl && t && brandMoreEl.contains(t)) return;
			brandMoreOpen = false;
		};
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});

	// Initial load
	// B8 realtime: refetch list khi collection thay đổi từ client khác
	onMount(() => subscribeDbChanges('brands', () => void fetchBrands()));
	// Batch54: scroll event KHÔNG bubble → capture trên document bắt scroll của
	// mọi element (pattern suppliers B25; iOS ≤15.3 trang cuộn ở root Container).
	onMount(() => {
		document.addEventListener('scroll', onWindowScroll, { capture: true, passive: true });
		return () => {
			document.removeEventListener('scroll', onWindowScroll, { capture: true });
		};
	});
	onMount(async () => {
		if (!client.browser) client.browser = {};
		// Batch54: restore prefs TRƯỚC load đầu (pattern suppliers) — sort + showDeleted.
		const prefs = userPrefs.datatable?.[PREFS_KEY];
		if (prefs?.sort?.field) {
			sortField = prefs.sort.field;
			sortDirection = prefs.sort.direction === 'asc' ? 'asc' : 'desc';
		}
		if (prefs?.filters?.showDeleted === true) showDeleted = true;
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await fetchBrands();
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="admin-page" class:is-scrolling={scrollActive && isMobile}>
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{pageContents.title[lang]}</h1>
			<p class="admin-subtitle">{pageContents.subtitle[lang]}</p>
		</div>
		<div class="admin-header-actions">
			<!-- Quy ước màu nút: create = success. Mobile ẩn (FAB thay) — desktop giữ. -->
			{#if !isMobile}
				<Button color="success" onClick={openCreateModal}>
					{pageContents.addBrand[lang]}
				</Button>
			{/if}
		</div>
	</header>

	<!-- ── Bộ lọc (Batch54: search 3 nhánh pattern suppliers — mobile icon mở
	     field + suggest popover từ khoá; showDeleted chuyển vào setting modal) ── -->
	<!-- B55 mục 5: search + setting + create dời vào captionTools của DataTable
	     (đồng bộ suppliers — cùng 1 row, search input chiếm phần còn lại). -->

	<!-- ── Trạng thái loading/first-load error ── -->
	{#if loadError}
		<div class="admin-state admin-state--error" data-test="brands-load-error">{loadError}</div>
	{/if}

	<!-- ── Bảng brands (DataTable + snippet actions) ── -->
	<div class="admin-table-wrap" bind:this={wrapEl} onscroll={onTableScroll}>
		<DataTable
			data={brandsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			bind:sortColumn={sortField}
			bind:sortDirection={sortDirection}
			onSortChange={onBrandsSortChange}
			searchQuery={searchQuery ?? ''}
			resizable={{ enabled: true, fit: true }}
			loading={loading || searching}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.empty[lang]}
			loadingLabel={pageContents.loading[lang]}
			caption={{ vi: 'Danh sách thương hiệu', en: 'Brand list' }}
			actionsLabel={{ vi: 'Thao tác', en: 'Actions' }}
			stickyHead
			mobileTapMode="callback"
			onRowClick={(row) => openEditModal(row as unknown as BrandListItem)}
			cardFields={['brand', 'slug', 'status', 'updated']}
			selectable
			showIndex
			indexCheckboxes
			checkOnRowClick
			selectionTools={false}
			getRowId={(row) => String((row as unknown as BrandListItem)._id ?? '')}
			selection={selectedIds}
			onSelectionChange={(ids) => (selectedIds = [...ids])}
			// B55 mục 3+5: gộp class expression (class:directive chết trên component)
			class={[
				tableScrolled && isMobile ? 'caption-collapsed' : undefined,
				scrollActive && isMobile ? 'tools-hidden-mobile' : undefined
			]
				.filter(Boolean)
				.join(' ') || undefined}
			data-test="brands-datatable"
		>
			{#snippet captionTools()}
				<!-- B55 mục 5: search 3 nhánh pattern suppliers (mobile icon flushSync →
				     field + suggest popover). searchQuery ?? '' — unmount emit undefined. -->
				<div class="admin-search" data-suggest>
					{#if isMobile && !mobileSearchOpen}
						<button
							type="button"
							class="mobile-caption-icon"
							aria-label={lang === 'vi' ? 'Tìm kiếm' : 'Search'}
							data-test="brands-mobile-search-open"
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
									<!-- B55 mục 4: đang xử lý search → spinner thay icon -->
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
									onmousedown={(e) => e.preventDefault()}
									onclick={() => {
										searchQuery = kw;
										suggestOpen = false;
										pageNumber = 1;
										void fetchBrands();
									}}
								>
									{kw}
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<div class="admin-actions-group">
					{#if isMobile}
						<button
							type="button"
							class="mobile-caption-icon"
							aria-label={pageContents.settings.title[lang]}
							data-test="brands-mobile-filter-btn"
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
								settingModalDisplay = true;
							}}
							aria-label={pageContents.settings.title[lang]}
							data-test="brands-header-setting-btn"
						>
							<Icon icon={iconify['tune-rounded']} size="sm" />
						</Button>
					{/if}
					<!-- Quy ước màu nút: create = success. Desktop giữ text, mobile icon. -->
					{#if isMobile}
						<Button
							color="success"
							size="sm"
							onClick={openCreateModal}
							aria-label={pageContents.addBrand[lang]}
							data-test="brands-create-btn"
						>
							<Icon icon={iconify['add-rounded']} size="sm" />
						</Button>
					{:else}
						<Button color="success" size="sm" onClick={openCreateModal} data-test="brands-create-btn">
							{pageContents.addBrand[lang]}
						</Button>
					{/if}
				</div>
			{/snippet}
			{#snippet actionsContent(row)}
				{@const brand = row as unknown as BrandListItem}
				<div class="row-actions">
					<Button variant="ghost" size="sm" onClick={() => openEditModal(brand)} data-test="brand-action-edit">
						{pageContents.editAction[lang]}
					</Button>
					<!-- B55: xoá qua AlertDialog confirm (window.confirm đã bỏ) -->
					<Button
						variant="ghost"
						size="sm"
						color="error"
						onClick={() => {
							pendingDeleteBrand = brand;
							brandDeleteDisplay = true;
						}}
						data-test="brand-action-delete"
					>
						{pageContents.deleteAction[lang]}
					</Button>
				</div>
			{/snippet}
		</DataTable>

		{#if selectedIds.length > 0}
			<!-- Batch54: bulk-bar khi chọn ≥1 row (pattern suppliers — cạnh table,
			mobile fixed đáy viewport; ẩn khi đang cuộn qua .is-scrolling). -->
			<div class="bulk-row" data-test="brands-bulk-row">
				<div class="bulk-bar" data-test="brands-bulk-bar">
					<span class="bulk-count"
						>{pageContents.bulk.selected[lang].replace('{count}', String(bulkDisplayCount))}</span
					>
					<Button color="primary" variant="soft" size="sm" onClick={bulkCopySelected}>
						{pageContents.bulk.copy[lang]}
					</Button>
					<Button
						color="error"
						variant="soft"
						size="sm"
						onClick={() => {
							bulkDeleteDisplay = true;
						}}
						data-test="brands-bulk-delete"
					>
						{pageContents.bulk.delete[lang]}
					</Button>
					<Button color="default" variant="ghost" size="sm" onClick={clearBrandsSelection}>
						<Icon icon={iconify['close-rounded']} size="sm" />
					</Button>
				</div>
			</div>
		{/if}
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

	<!-- ── Batch54: FAB mobile (pattern suppliers — 3 nút create/setting/search;
	     ẩn khi chưa cuộn + khi đang cuộn; desktop display:none ≥768px) ── -->
	<div
		class="fab-group"
		class:fab-hidden={isMobile && !tableScrolled}
		class:is-scrolling={scrollActive && isMobile}
	>
		<button
			type="button"
			class="fab fab--primary"
			aria-label={pageContents.addBrand[lang]}
			data-test="brands-fab"
			onclick={openCreateModal}
		>
			<Icon icon={iconify['add-rounded']} />
		</button>
		<button
			type="button"
			class="fab fab--secondary"
			aria-label={pageContents.settings.title[lang]}
			data-test="brands-fab-setting"
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
			aria-label={lang === 'vi' ? 'Tìm kiếm' : 'Search'}
			data-test="brands-fab-search-btn"
			onclick={() => {
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

	<!-- ── Create/Edit Modal ── -->
	<Modal
		bind:display={modalOpen}
		onClose={closeModals}
		onCloseAttempt={closeGuard.attemptClose}
		size="md"
		class="supplier-modal-root"
		autoFocus={false}
	>
		<ModalContainer>
			<ModalHeader actionButtons={{ close: { display: !isMobile } }}>
				<!-- Batch54: breadcrumb modal title (pattern suppliers B16/B18) —
				crumb page title (tap = đóng về list) › active (name/create). Tràn →
				item đầu ẩn vào popover more (đo scrollWidth rAF + RO). -->
				<div class="supplier-modal-title" bind:this={crumbNavEl}>
					{#if isMobile && crumbOverflow > 0}
						<button
							type="button"
							class="supplier-modal-title__more"
							data-test="brands-crumb-more"
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
					{#if !isMobile || crumbOverflow === 0}
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
					{#if editingBrand && formData.name}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active"
							>{formData.name}</span
						>
					{:else if !editingBrand}
						<span class="supplier-modal-title__name" aria-hidden="true">›</span>
						<span class="supplier-modal-title__name supplier-modal-title__name--active"
							>{pageContents.addBrand[lang]}</span
						>
					{/if}
				</div>
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

				<!-- SỬA: ImageUpload (upload thẳng hosting ngoài + preview + xoá)
				     thay URL input tay — bind cùng field formData.logoUrl -->
				<ImageUpload bind:value={formData.logoUrl} label={pageContents.logoLabel[lang]} />

				<TextField name="brand-description">
					<Label>{pageContents.descLabel[lang]}</Label>
					<Textarea
						bind:value={formData.description}
						rows={3}
						placeholder={{ vi: 'Nhập mô tả thương hiệu…', en: 'Enter brand description…' }}
					/>
				</TextField>

				<TextField name="brand-status">
					<Label>{pageContents.statusLabel[lang]}</Label>
					<Select
						bind:value={formData.status}
						options={brandStatusOptions}
						clearable={false}
						name="brand-status"
					/>
				</TextField>
			</ModalBody>
			<ModalFooter class="modal-footer">
				{#if editingBrand}
					<!-- B55 mục 6: nút Xoá → icon more mở popover (thống kê / xoá).
					     Bọc div relative làm anchor + outside-click guard brandMoreEl. -->
					<div class="brand-more-wrap" bind:this={brandMoreEl}>
						<Button
							variant="ghost"
							color="default"
							aspect-square
							aria-label={pageContents.more.label[lang]}
							aria-expanded={brandMoreOpen}
							disabled={formSubmitting}
							data-test="brand-more-btn"
							onclick={() => {
								brandMoreOpen = !brandMoreOpen;
							}}
						>
							<Icon icon={iconify['more-horiz-rounded']} size="sm" />
						</Button>
						{#if brandMoreOpen}
							<div class="brand-more-popover" role="menu">
								<button
									type="button"
									class="brand-more-popover__item"
									role="menuitem"
									disabled={brandStatsLoading}
									onclick={moreOpenStats}
									data-test="brand-more-stats"
								>
									{pageContents.more.stats[lang]}
								</button>
								<button
									type="button"
									class="brand-more-popover__item brand-more-popover__item--danger"
									role="menuitem"
									disabled={formSubmitting}
									onclick={moreOpenDelete}
									data-test="brand-more-delete"
								>
									{pageContents.more.delete[lang]}
								</button>
							</div>
						{/if}
					</div>
				{/if}
				<span class="brand-footer-spacer"></span>
				<Button
					variant="outline"
					onClick={() => { closeGuard.attemptClose(); }}
					disabled={formSubmitting}
				>
					{pageContents.cancel[lang]}
				</Button>
				<Button
					variant="solid"
					color={editingBrand ? 'primary' : 'success'}
					loading={formSubmitting}
					onClick={submitForm}
				>
					{editingBrand ? pageContents.saveEdit[lang] : pageContents.saveCreate[lang]}
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

	<!-- ── Batch54: Setting modal (showDeleted + sort) — pattern suppliers; mở từ
	     nút tune desktop / icon mobile + FAB. Select fullscreen trên mobile. ── -->
	{#if settingModalDisplay}
		<Modal bind:display={settingModalDisplay} size="sm">
			<ModalContainer>
				<ModalHeader>{pageContents.settings.title[lang]}</ModalHeader>
				<ModalBody>
					<div class="setting-form" data-test="brands-setting-modal">
						<TextField name="brands-setting-show-deleted">
							<Label>{pageContents.settings.showDeleted[lang]}</Label>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={settingShowDeleted}
								fullscreen={isMobile}
								options={[
									{ value: 'false', label: lang === 'vi' ? 'Không' : 'No' },
									{ value: 'true', label: lang === 'vi' ? 'Có' : 'Yes' }
								]}
								data-test="brands-setting-show-deleted"
							/>
						</TextField>
						<TextField name="brands-setting-sort">
							<Label>{pageContents.settings.sortBy[lang]}</Label>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={settingSortField}
								options={settingSortOptions}
								clearable
								fullscreen={isMobile}
								placeholder={pageContents.settings.sortBy[lang]}
								data-test="brands-setting-sort"
							/>
						</TextField>
						<TextField name="brands-setting-direction">
							<Label>{pageContents.settings.sortDirection[lang]}</Label>
							<Select
								class="admin-filter-select"
								size="sm"
								bind:value={settingSortDirection}
								options={[
									{ value: 'asc', label: pageContents.settings.asc[lang] },
									{ value: 'desc', label: pageContents.settings.desc[lang] }
								]}
								fullscreen={isMobile}
								data-test="brands-setting-direction"
							/>
						</TextField>
					</div>
				</ModalBody>
				<ModalFooter class="modal-footer">
					<Button
						color="secondary"
						variant="outline"
						disabled={settingSortField === '' && settingShowDeleted !== 'true'}
						onClick={() => {
							settingSortField = '';
							settingSortDirection = 'desc';
							settingShowDeleted = 'false';
						}}
					>
						{pageContents.settings.reset[lang]}
					</Button>
					<Button
						color="primary"
						data-test="brands-setting-apply"
						onClick={applyBrandsSettings}
					>
						{pageContents.settings.apply[lang]}
					</Button>
				</ModalFooter>
			</ModalContainer>
		</Modal>
	{/if}

	<!-- ── Batch54: AlertDialog bulk-delete (pattern suppliers) ── -->
	{#if bulkDeleteDisplay}
		<AlertDialog
			bind:open={bulkDeleteDisplay}
			title={pageContents.bulk.title[lang]}
			description={pageContents.bulk.desc[lang]}
		>
			<AlertDialog.Content>
				<AlertDialog.Header variant="danger">
					<AlertDialog.Title>{pageContents.bulk.title[lang]}</AlertDialog.Title>
					<AlertDialog.Description
						>{pageContents.bulk.desc[lang].replace('{count}', String(bulkDisplayCount))}</AlertDialog.Description
					>
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

	<!-- ── B55 mục 6: AlertDialog xác nhận xoá 1 brand (more-menu / row action) ── -->
	{#if brandDeleteDisplay}
		<AlertDialog
			bind:open={brandDeleteDisplay}
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
						onselect={() => {
							const brand = pendingDeleteBrand ?? editingBrand;
							pendingDeleteBrand = undefined;
							if (brand) void deleteBrand(brand);
						}}
						data-test="brand-delete-confirm"
					>
						{pageContents.more.deleteConfirm[lang]}
					</AlertDialog.Action>
				</AlertDialog.Footer>
			</AlertDialog.Content>
		</AlertDialog>
	{/if}

	<!-- ── B55 mục 6: AlertDialog thống kê brand (số sản phẩm liên quan) ── -->
	{#if brandStatsDisplay}
		<AlertDialog bind:open={brandStatsDisplay} title={pageContents.more.stats[lang]}>
			<AlertDialog.Content>
				<AlertDialog.Header variant="info">
					<AlertDialog.Title>{pageContents.more.stats[lang]}</AlertDialog.Title>
					<AlertDialog.Description>{editingBrand?.name ?? ''}</AlertDialog.Description>
				</AlertDialog.Header>
				<!-- B55: số liệu thống kê (brandStatsData từ /api/admin/products/list) -->
				<div class="brand-stats-row">
					<span class="brand-stats-row__label">{pageContents.more.statsModal.products[lang]}</span>
					<span class="brand-stats-row__value" data-test="brand-stats-products">
						{#if brandStatsLoading || brandStatsData === undefined}…{:else}{brandStatsData.products}{/if}
					</span>
				</div>
				<AlertDialog.Footer>
					<AlertDialog.Cancel>{pageContents.cancel[lang]}</AlertDialog.Cancel>
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

		&.is-scrolling .bulk-row {
			opacity: 0;
			pointer-events: none;
		}

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

	/* B55 mục 5: .admin-filters bỏ — search + tools dời vào captionTools của
	   DataTable (cùng 1 row). .admin-search rule Batch54 (relative inline-flex)
	   giữ nguyên + bổ sung flex:1 bên dưới. */

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

	/* B5: nút Xoá trong modal edit — đẩy sang trái (tách khỏi nhóm Cancel/Save). */
	/* B5: :global toan phan — footer render qua ModalFooter (scope khac),
	   anchor scoped .modal-footer khong match. */
	/* B55 mục 6: nút Xoá thay bằng more-wrap — spacer đẩy Save/Cancel sang phải
	   (footer element class thật .modal-footer-root — scoped anchor không match). */
	:global(.modal-footer-root .brand-footer-spacer) {
		flex: 1;
	}

	/* B55 mục 6: more-menu footer (clone suppliers B20) */
	.brand-stats-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0;
	}

	.brand-stats-row__label {
		color: var(--muted, var(--foreground));
		font-size: 0.875rem;
	}

	.brand-stats-row__value {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.brand-more-wrap {
		position: relative;
	}

	.brand-more-popover {
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
		box-shadow: var(--box-shadow-lg, 0 10px 30px hsl(0 0% 0% / 0.12));
	}

	.brand-more-popover__item {
		display: block;
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--foreground-600, var(--foreground));
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

	.brand-more-popover__item--danger {
		color: var(--danger, hsl(356.95 95.9% 57.72%));

		&:hover:not(:disabled),
		&:focus-visible {
			background: color-mix(in srgb, var(--danger, hsl(356.95 95.9% 57.72%)) 8%, transparent);
		}
	}

	/* ═══ Batch54: search suggest + mobile icon + bulk + FAB + modal crumb ═══ */

	/* ── Search area: relative để suggest-popover neo đúng (gộp rule cũ) ── */
	/* B55 mục 3: search input chiếm PHẦN CÒN LẠI của row caption-tools
	   (setting/create chỉ chiếm phần vừa đủ). */
	.admin-search {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		max-width: 420px;
	}

	/* Select filter trong captionTools (brands chưa dùng — giữ pattern suppliers
	   cho nhất quán; selector scoped không match element mang hash → :global()). */
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

	/* B55: cuộn → caption collapsed — thu nhỏ tools CHỈ mobile (pattern suppliers). */
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
		}
	}

	/* B55: mobile đang cuộn → ẨN row tools bằng opacity (giữ flow height —
	   display:none co flow che row cuối). Class do page đặt trên DataTable root. */
	:global(.datatable-root.tools-hidden-mobile) {
		@media (max-width: 767px) {
			:global(.datatable-caption-tools .admin-search:not(:has(.suggest-popover))),
			:global(.datatable-caption-tools .admin-actions-group:not(:has(.mobile-filter-popover))) {
				opacity: 0;
				pointer-events: none;
				transition: opacity 150ms ease;
			}
		}
	}

	/* B55: mobile nút Button trong caption-tools thu 2.25rem (size-sm mặc định
	   2.75rem — lệch icon 2.25rem cùng group). */
	@media (max-width: 767px) {
		:global(.datatable-caption-tools .admin-actions-group .button-root) {
			height: 2.25rem;
			min-height: 2.25rem;
		}
	}

	.admin-actions-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	.admin-search-loading {
		display: inline-flex;
		align-items: center;
		width: 1.25rem;
	}

	/* ── Suggest keywords popover (pattern suppliers 7491+) ── */
	.suggest-popover {
		position: absolute;
		top: calc(100% + 0.35rem);
		left: 0;
		z-index: 50;
		min-width: 14rem;
		max-height: 16rem;
		overflow-y: auto;
		background: var(--background);
		border: 1px solid var(--default-300);
		border-radius: 0.65rem;
		box-shadow: var(--box-shadow-lg, 0 10px 30px hsl(0 0% 0% / 0.12));
		padding: 0.35rem;
	}

	.suggest-title {
		margin: 0.25rem 0.5rem 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: 0.72rem;
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

	/* ── Mobile icon buttons trong caption/tools (pattern suppliers) ── */
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

	/* ── Bulk bar (pattern suppliers) ── */
	.bulk-row {
		display: flex;
		justify-content: center;
	}

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
			padding-right: 4.75rem;
			background: var(--background);
			border-top: 1px solid var(--default-300);
			transition: opacity 150ms ease;
		}
	}

	/* ── FAB mobile (pattern suppliers 7886+) ── */
	.fab-group {
		position: fixed;
		right: 1rem;
		bottom: 7.25rem;
		z-index: 400;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.6rem;
		transition: opacity 200ms ease;

		&.fab-hidden {
			opacity: 0;
			pointer-events: none;
		}

		&.is-scrolling {
			opacity: 0;
			pointer-events: none;
		}
	}

	@media (min-width: 768px) {
		.fab-group {
			display: none;
		}
	}

	.fab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border: 1px solid var(--default-300);
		box-shadow: var(--shadow-md, 0 4px 12px hsl(0 0% 0% / 0.15));
		cursor: pointer;
		transition:
			transform 120ms ease,
			box-shadow 120ms ease,
			opacity 200ms ease;

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
		.admin-pagination {
			padding-right: 4.75rem;
		}
	}

	/* ── Modal breadcrumb title (pattern suppliers 7985+) ── */
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
		box-shadow: var(--box-shadow-lg, 0 10px 30px hsl(0 0% 0% / 0.12));
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.supplier-modal-title__name {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--foreground-500);
		font-weight: 400;

		&--active {
			color: var(--foreground);
			font-weight: 600;
		}
	}

	.supplier-modal-title__name[aria-hidden='true'] {
		flex: none;
		overflow: visible;
	}

	/* ── Modal fullscreen mobile (pattern suppliers B7 — fixed inset 0, KHÔNG
	   vh/dvh — iOS ≤15.3 chết). Áp cho modal có class supplier-modal-root. ── */
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

		.supplier-modal-title {
			flex: 1 1 auto;
		}
	}

	/* ── Setting modal form ── */
	.setting-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
