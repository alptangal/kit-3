<!-- src/routes/(authorized)/admin/expenses/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { AlertDialog } from '$lib/components/element/alert-dialog';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDate as formatDateShared } from '$modules/i18n';
	import { resolveServerMessage } from '../_interface';

	interface ExpenseRow {
		_id?: string;
		branchId?: string;
		category?: string;
		amount?: number;
		spentAt?: string | null;
		description?: string | null;
		receiptImages?: string[];
		createdBy?: string;
		createdAt?: string | null;
	}

	interface BranchOption {
		_id: string;
		name?: string;
		isWarehouse?: boolean;
	}

	interface CategoryBreakdownItem {
		category: string;
		total: number;
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
		title: { vi: 'Chi phí vận hành', en: 'Operating expenses' },
		subtitle: {
			vi: 'Quản lý chi phí vận hành theo chi nhánh và danh mục',
			en: 'Manage operating expenses by branch and category'
		},
		categoryLabels: {
			rent: { vi: 'Thuê mặt bằng', en: 'Rent' },
			salary: { vi: 'Lương', en: 'Salary' },
			utility: { vi: 'Tiện ích', en: 'Utility' },
			marketing: { vi: 'Marketing', en: 'Marketing' },
			logistics: { vi: 'Vận chuyển', en: 'Logistics' },
			other: { vi: 'Khác', en: 'Other' }
		},
		filters: {
			allCategories: { vi: 'Tất cả danh mục', en: 'All categories' },
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' },
			from: { vi: 'Từ ngày', en: 'From' },
			to: { vi: 'Đến ngày', en: 'To' }
		},
		table: {
			category: { vi: 'Danh mục', en: 'Category' },
			amount: { vi: 'Số tiền', en: 'Amount' },
			spentAt: { vi: 'Ngày chi', en: 'Spent at' },
			description: { vi: 'Mô tả', en: 'Description' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			receipts: { vi: 'Hóa đơn', en: 'Receipts' },
			actions: { vi: 'Thao tác', en: 'Actions' }
		},
		summary: {
			totalInPeriod: { vi: 'Tổng trong kỳ', en: 'Total in period' },
			breakdown: { vi: 'Phân bổ theo danh mục', en: 'Breakdown by category' }
		},
		actions: {
			create: { vi: 'Thêm chi phí', en: 'Add expense' },
			edit: { vi: 'Sửa', en: 'Edit' },
			del: { vi: 'Xóa', en: 'Delete' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh sách chi phí', en: 'Failed to load expenses' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có bản ghi chi phí nào', en: 'No expense records yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCount: { vi: '{total} bản ghi', en: '{total} records' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		formModal: {
			titleCreate: { vi: 'Thêm chi phí', en: 'Add expense' },
			titleEdit: { vi: 'Sửa chi phí', en: 'Edit expense' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			branchPlaceholder: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			category: { vi: 'Danh mục', en: 'Category' },
			categoryPlaceholder: { vi: 'Chọn danh mục', en: 'Select a category' },
			amount: { vi: 'Số tiền', en: 'Amount' },
			spentAt: { vi: 'Ngày chi', en: 'Spent at' },
			description: { vi: 'Mô tả (tuỳ chọn)', en: 'Description (optional)' },
			receipts: { vi: 'Ảnh hóa đơn (tối đa 3, tự nén ≤300KB)', en: 'Receipt images (max 3, auto-compressed ≤300KB)' },
			addImages: { vi: 'Thêm ảnh', en: 'Add images' },
			submitCreate: { vi: 'Tạo', en: 'Create' },
			submitUpdate: { vi: 'Lưu', en: 'Save' }
		},
		imageModal: {
			title: { vi: 'Ảnh hóa đơn', en: 'Receipt image' },
			download: { vi: 'Tải về', en: 'Download' }
		},
		deleteDialog: {
			title: { vi: 'Xóa bản ghi chi phí?', en: 'Delete expense record?' },
			description: { vi: 'Hành động này không thể hoàn tác. Bản ghi chi phí sẽ bị xóa vĩnh viễn.', en: 'This action cannot be undone. The expense record will be permanently deleted.' },
			cancel: { vi: 'Hủy', en: 'Cancel' },
			confirm: { vi: 'Xóa', en: 'Delete' }
		},
		toasts: {
			created: { vi: 'Đã tạo bản ghi chi phí', en: 'Expense created' },
			updated: { vi: 'Đã cập nhật bản ghi chi phí', en: 'Expense updated' },
			deleted: { vi: 'Đã xóa bản ghi chi phí', en: 'Expense deleted' },
			failed: { vi: 'Thao tác không thành công', en: 'Operation failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireBranch: { vi: 'Vui lòng chọn chi nhánh', en: 'Please select a branch' },
			requireCategory: { vi: 'Vui lòng chọn danh mục', en: 'Please select a category' },
			requireAmount: { vi: 'Số tiền phải lớn hơn 0', en: 'Amount must be greater than 0' },
			requireSpentAt: { vi: 'Vui lòng chọn ngày chi', en: 'Please select a date' },
			maxImages: { vi: 'Tối đa 3 ảnh hóa đơn', en: 'Maximum 3 receipt images' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const EXPENSE_CATEGORIES = ['rent', 'salary', 'utility', 'marketing', 'logistics', 'other'] as const;
	const MAX_IMAGES = 3;
	const MAX_IMAGE_BYTES = 300 * 1024;

	function categoryLabel(category?: string): string {
		const key = (category ?? '') as keyof typeof pageContents.categoryLabels;
		const label = pageContents.categoryLabels[key];
		return label ? label[lang] : (category ?? '—');
	}

	function categoryColor(category?: string): string {
		switch (category) {
			case 'rent':
				return 'warning';
			case 'salary':
				return 'success';
			case 'utility':
				return 'primary';
			case 'marketing':
				return 'error';
			default:
				return 'default';
		}
	}

	// ── Trạng thái danh sách ──
	let expenses = $state<ExpenseRow[]>([]);
	let expensesTotal = $state(0);
	let expensesPage = $state(1);
	let expensesLoading = $state(false);
	let expensesError = $state<string | undefined>(undefined);
	let expensesLoadedOnce = $state(false);
	let totalAmount = $state(0);
	let categoryBreakdown = $state<CategoryBreakdownItem[]>([]);

	let pageSize = $state(20);
	let categoryFilter = $state('');
	let branchFilter = $state('');
	let fromFilter = $state('');
	let toFilter = $state('');

	let branches = $state<BranchOption[]>([]);

	// ── Modal thêm/sửa ──
	let formModalDisplay = $state(false);
	let formSubmitting = $state(false);
	let formError = $state<string | undefined>(undefined);
	let editingId = $state<string | undefined>(undefined);
	let form = $state<{
		branchId: string;
		category: string;
		amount: string;
		spentAt: string;
		description: string;
		receiptImages: string[];
	}>({
		branchId: '',
		category: '',
		amount: '',
		spentAt: '',
		description: '',
		receiptImages: []
	});

	// ── Modal xem ảnh ──
	let imageModalDisplay = $state(false);
	let previewImage = $state('');

	// ── AlertDialog xóa ──
	let deleteDialogOpen = $state(false);
	let deletingRow = $state<ExpenseRow | null>(null);
	let deleteBusy = $state(false);

	// ── Derived ──
	const totalPages = $derived(Math.max(1, Math.ceil(expensesTotal / pageSize)));

	function getBranchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const branch = branches.find((b) => b._id === branchId);
		return branch?.name ?? branchId;
	}

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDate(raw?: string | Date | null) {
		return formatDateShared(raw, lang);
	}

	function formatMoney(value?: number): string {
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(value ?? 0);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Nén ảnh client-side về ≤300KB (canvas, giữ tỉ lệ, JPEG 0.8) ──
	async function compressImage(file: File): Promise<string> {
		const dataUrl = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result ?? ''));
			reader.onerror = () => reject(new Error('read-failed'));
			reader.readAsDataURL(file);
		});
		try {
			const img = await new Promise<HTMLImageElement>((resolve, reject) => {
				const image = new Image();
				image.onload = () => resolve(image);
				image.onerror = () => reject(new Error('decode-failed'));
				image.src = dataUrl;
			});
			const maxDim = 1600;
			let { width, height } = img;
			if (width > maxDim || height > maxDim) {
				const scale = maxDim / Math.max(width, height);
				width = Math.round(width * scale);
				height = Math.round(height * scale);
			}
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return dataUrl;
			ctx.drawImage(img, 0, 0, width, height);
			let quality = 0.8;
			let out = canvas.toDataURL('image/jpeg', quality);
			while (out.length * 0.75 > MAX_IMAGE_BYTES && quality > 0.3) {
				quality -= 0.15;
				out = canvas.toDataURL('image/jpeg', quality);
			}
			return out;
		} catch {
			// Không decode được (vd PNG đặc biệt) → dùng nguyên bản nếu nhỏ, ngược lại từ chối
			if (file.size <= MAX_IMAGE_BYTES) return dataUrl;
			throw new Error('too-large');
		}
	}

	async function onReceiptsChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (files.length === 0) return;
		const room = MAX_IMAGES - form.receiptImages.length;
		if (files.length > room) {
			showToast(pageContents.form.maxImages[lang], 'error');
		}
		const picked = files.slice(0, Math.max(0, room));
		for (const file of picked) {
			try {
				const compressed = await compressImage(file);
				form.receiptImages = [...form.receiptImages, compressed];
			} catch {
				showToast(pageContents.form.maxImages[lang], 'error');
			}
		}
		input.value = '';
	}

	function removeReceipt(index: number) {
		form.receiptImages = form.receiptImages.filter((_, i) => i !== index);
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
			if (import.meta.env.DEV) console.error('[admin/expenses] load branches failed:', err);
		}
	}

	async function loadExpenses() {
		if (!encryptionKeys) return;
		expensesLoading = true;
		expensesError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/expenses/list',
				{
					method: 'POST',
					body: {
						page: expensesPage,
						pageSize,
						category: categoryFilter || undefined,
						branchId: branchFilter || undefined,
						from: fromFilter || undefined,
						to: toFilter || undefined
					}
				},
				encryptionKeys
			);
			expensesLoading = false;
			if (response.ok) {
				const data = response.data as
					| {
							items?: ExpenseRow[];
							total?: number;
							page?: number;
							totalAmount?: number;
							categoryBreakdown?: CategoryBreakdownItem[];
					  }
					| undefined;
				expenses = data?.items ?? [];
				if (typeof data?.total === 'number') expensesTotal = data.total;
				if (typeof data?.page === 'number') expensesPage = data.page;
				totalAmount = typeof data?.totalAmount === 'number' ? data.totalAmount : 0;
				categoryBreakdown = data?.categoryBreakdown ?? [];
				expensesLoadedOnce = true;
			} else {
				expensesError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			expensesLoading = false;
			expensesError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/expenses] load expenses failed:', err);
		}
	}

	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === expensesPage || expensesLoading) return;
		expensesPage = target;
		await loadExpenses();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		expensesPage = 1;
		await loadExpenses();
	}

	async function onFilterChange() {
		expensesPage = 1;
		await loadExpenses();
	}

	// ── Modal thêm/sửa ──
	function openCreateModal() {
		editingId = undefined;
		form = { branchId: '', category: '', amount: '', spentAt: '', description: '', receiptImages: [] };
		formError = undefined;
		formModalDisplay = true;
	}

	function openEditModal(row: ExpenseRow) {
		editingId = row._id;
		form = {
			branchId: row.branchId ?? '',
			category: row.category ?? '',
			amount: row.amount !== undefined ? String(row.amount) : '',
			spentAt: row.spentAt ? String(row.spentAt).slice(0, 10) : '',
			description: row.description ?? '',
			receiptImages: Array.isArray(row.receiptImages) ? [...row.receiptImages] : []
		};
		formError = undefined;
		formModalDisplay = true;
	}

	function validateForm(): string | undefined {
		if (!form.branchId) return pageContents.form.requireBranch[lang];
		if (!form.category) return pageContents.form.requireCategory[lang];
		const amount = Number(form.amount);
		if (!Number.isFinite(amount) || amount <= 0) return pageContents.form.requireAmount[lang];
		if (!form.spentAt) return pageContents.form.requireSpentAt[lang];
		if (form.receiptImages.length > MAX_IMAGES) return pageContents.form.maxImages[lang];
		return undefined;
	}

	async function submitForm() {
		if (formSubmitting || !encryptionKeys) return;
		const validationError = validateForm();
		if (validationError) {
			formError = validationError;
			return;
		}
		formError = undefined;
		formSubmitting = true;
		const payload = {
			branchId: form.branchId,
			category: form.category,
			amount: Number(form.amount),
			spentAt: form.spentAt,
			description: form.description.trim() || undefined,
			receiptImages: form.receiptImages
		};
		try {
			const response = await encryption.fetchSecure(
				editingId ? '/api/admin/expenses/update' : '/api/admin/expenses/create',
				{
					method: 'POST',
					body: editingId ? { ...payload, expenseId: editingId } : payload
				},
				encryptionKeys
			);
			formSubmitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, editingId ? pageContents.toasts.updated : pageContents.toasts.created)
						: (editingId ? pageContents.toasts.updated : pageContents.toasts.created)[lang],
					'success'
				);
				formModalDisplay = false;
				await loadExpenses();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			formSubmitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/expenses] submit failed:', err);
		}
	}

	// ── Xem ảnh hóa đơn ──
	function openImage(image: string) {
		previewImage = image;
		imageModalDisplay = true;
	}

	function downloadPreview() {
		if (!previewImage) return;
		const a = document.createElement('a');
		a.href = previewImage;
		a.download = `receipt-${Date.now()}.jpg`;
		a.click();
	}

	// ── Xóa ──
	function askDelete(row: ExpenseRow) {
		deletingRow = row;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!deletingRow || deleteBusy || !encryptionKeys) return;
		deleteBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/expenses/delete',
				{ method: 'POST', body: { expenseId: deletingRow._id } },
				encryptionKeys
			);
			deleteBusy = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.deleted)
						: pageContents.toasts.deleted[lang],
					'success'
				);
				deleteDialogOpen = false;
				deletingRow = null;
				await loadExpenses();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			deleteBusy = false;
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/expenses] delete failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadExpenses()]);
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
			<Button color="success" onClick={openCreateModal} data-test="expenses-create">
				{pageContents.actions.create[lang]}
			</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={categoryFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allCategories[lang]}</option>
			{#each EXPENSE_CATEGORIES as category (category)}
				<option value={category}>{categoryLabel(category)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={branchFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allBranches[lang]}</option>
			{#each branches as branch (branch._id)}
				<option value={branch._id}>{branch.name ?? branch._id}</option>
			{/each}
		</select>
		<label class="filter-date">
			<span>{pageContents.filters.from[lang]}</span>
			<input class="admin-input filter-date-input" type="date" bind:value={fromFilter} onchange={onFilterChange} />
		</label>
		<label class="filter-date">
			<span>{pageContents.filters.to[lang]}</span>
			<input class="admin-input filter-date-input" type="date" bind:value={toFilter} onchange={onFilterChange} />
		</label>
		<Button color="default" variant="outline" size="sm" onClick={loadExpenses}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	<!-- ── Tổng hợp ── -->
	<div class="summary-row">
		<div class="summary-card" data-test="expenses-total">
			<span class="summary-label">{pageContents.summary.totalInPeriod[lang]}</span>
			<strong class="summary-value">{formatMoney(totalAmount)}</strong>
		</div>
		{#if categoryBreakdown.length > 0}
			<div class="summary-breakdown" data-test="expenses-breakdown">
				<span class="summary-label">{pageContents.summary.breakdown[lang]}</span>
				<div class="breakdown-badges">
					{#each categoryBreakdown as item (item.category)}
						<span class="status-badge status-{categoryColor(item.category)}">
							{categoryLabel(item.category)}: {formatMoney(item.total)}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- ── Danh sách ── -->
	{#if expensesLoading && !expensesLoadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if expensesError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{expensesError}</p>
			<Button color="primary" variant="outline" onClick={loadExpenses}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if expenses.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col">{pageContents.table.category[lang]}</th>
						<th scope="col">{pageContents.table.amount[lang]}</th>
						<th scope="col">{pageContents.table.spentAt[lang]}</th>
						<th scope="col">{pageContents.table.branch[lang]}</th>
						<th scope="col">{pageContents.table.description[lang]}</th>
						<th scope="col">{pageContents.table.receipts[lang]}</th>
						<th scope="col" class="col-actions">{pageContents.table.actions[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each expenses as row (row._id)}
						<tr data-test="expenses-row">
							<td class="col-status">
								<span class="status-badge status-{categoryColor(row.category)}">{categoryLabel(row.category)}</span>
							</td>
							<td class="col-num">{formatMoney(row.amount)}</td>
							<td>{formatDate(row.spentAt)}</td>
							<td>{getBranchLabel(row.branchId)}</td>
							<td class="col-wrap">{row.description ?? '—'}</td>
							<td>
								{#if row.receiptImages && row.receiptImages.length > 0}
									<div class="receipt-thumbs">
										{#each row.receiptImages as image, i (i)}
											<button type="button" class="receipt-thumb" onclick={() => openImage(image)} title="{pageContents.imageModal.title[lang]} {i + 1}">
												<img src={image} alt="receipt {i + 1}" />
											</button>
										{/each}
									</div>
								{:else}
									—
								{/if}
							</td>
							<td class="col-actions">
								<div class="row-actions">
									<!-- update/edit = primary -->
									<Button color="primary" variant="ghost" size="sm" onClick={() => openEditModal(row)}>
										{pageContents.actions.edit[lang]}
									</Button>
									<!-- delete = error -->
									<Button color="error" variant="ghost" size="sm" onClick={() => askDelete(row)}>
										{pageContents.actions.del[lang]}
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- ── Phân trang ── -->
	<footer class="admin-pagination">
		<span class="total-count">
			{pageContents.pagination.totalCount[lang].replace('{total}', String(expensesTotal))}
		</span>
		<div class="page-controls">
			<Button
				color="default"
				variant="outline"
				size="sm"
				disabled={expensesPage <= 1}
				onClick={() => goToPage(expensesPage - 1)}
			>
				{pageContents.pagination.prev[lang]}
			</Button>
			<Button
				color="default"
				variant="outline"
				size="sm"
				disabled={expensesPage >= totalPages}
				onClick={() => goToPage(expensesPage + 1)}
			>
				{pageContents.pagination.next[lang]}
			</Button>
			<label class="page-size">
				<span class="page-size-label">{pageContents.pagination.pageSizeLabel[lang]}</span>
				<select
					class="admin-select"
					value={pageSize}
					onchange={(e) => changePageSize(Number((e.currentTarget as HTMLSelectElement).value))}
				>
					{#each [10, 20, 50, 100] as size (size)}
						<option value={size}>{size}</option>
					{/each}
				</select>
			</label>
		</div>
	</footer>
</section>

<!-- ── Modal thêm/sửa chi phí ── -->
{#if formModalDisplay}
	<Modal bind:display={formModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				{editingId ? pageContents.formModal.titleEdit[lang] : pageContents.formModal.titleCreate[lang]}
			</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.branch[lang]}</span>
							<select class="admin-select" bind:value={form.branchId} disabled={formSubmitting}>
								<option value="" disabled>{pageContents.formModal.branchPlaceholder[lang]}</option>
								{#each branches as branch (branch._id)}
									<option value={branch._id}>{branch.name ?? branch._id}</option>
								{/each}
							</select>
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.category[lang]}</span>
							<select class="admin-select" bind:value={form.category} disabled={formSubmitting}>
								<option value="" disabled>{pageContents.formModal.categoryPlaceholder[lang]}</option>
								{#each EXPENSE_CATEGORIES as category (category)}
									<option value={category}>{categoryLabel(category)}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.amount[lang]}</span>
							<input class="admin-input" type="number" min="0" step="any" bind:value={form.amount} disabled={formSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.spentAt[lang]}</span>
							<input class="admin-input" type="date" bind:value={form.spentAt} disabled={formSubmitting} />
						</label>
					</div>
					<label class="form-field">
						<span class="form-label">{pageContents.formModal.description[lang]}</span>
						<textarea class="admin-input form-textarea" rows="2" bind:value={form.description} disabled={formSubmitting}></textarea>
					</label>
					<div class="form-field">
						<span class="form-label">{pageContents.formModal.receipts[lang]}</span>
						{#if form.receiptImages.length > 0}
							<div class="receipt-thumbs">
								{#each form.receiptImages as image, i (i)}
									<div class="receipt-thumb-editable">
										<button type="button" class="receipt-thumb" onclick={() => openImage(image)}>
											<img src={image} alt="receipt {i + 1}" />
										</button>
										<!-- delete/remove = error -->
										<button type="button" class="receipt-remove" onclick={() => removeReceipt(i)} disabled={formSubmitting}>×</button>
									</div>
								{/each}
							</div>
						{/if}
						{#if form.receiptImages.length < MAX_IMAGES}
							<input class="form-file" type="file" accept="image/*" multiple onchange={onReceiptsChange} disabled={formSubmitting} />
						{/if}
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitForm} loading={formSubmitting} disabled={formSubmitting}>
					{editingId ? pageContents.formModal.submitUpdate[lang] : pageContents.formModal.submitCreate[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={formSubmitting}
					onClick={() => {
						formModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── Modal xem ảnh hóa đơn ── -->
{#if imageModalDisplay}
	<Modal bind:display={imageModalDisplay} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.imageModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="preview-wrap">
					<img class="preview-image" src={previewImage} alt="receipt" />
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button color="primary" onClick={downloadPreview}>
					{pageContents.imageModal.download[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						imageModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog xóa bản ghi chi phí ── -->
<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{pageContents.deleteDialog.title[lang]}</AlertDialog.Title>
			<AlertDialog.Description>{pageContents.deleteDialog.description[lang]}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{pageContents.deleteDialog.cancel[lang]}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={confirmDelete}>
				{pageContents.deleteDialog.confirm[lang]}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

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

	.filter-date {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.filter-date-input {
		width: auto;
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

		option {
			background: var(--default-200);
			color: var(--foreground);
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

		p {
			margin: 0;
		}
	}

	/* ── Tổng hợp ── */
	.summary-row {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: stretch;
	}

	.summary-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.9rem 1.1rem;
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
		min-width: 12rem;
	}

	.summary-breakdown {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.9rem 1.1rem;
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
		flex: 1;
		min-width: 16rem;
	}

	.summary-label {
		font-size: 0.8rem;
		color: var(--foreground-500);
	}

	.summary-value {
		font-size: 1.3rem;
		color: var(--foreground);
		font-variant-numeric: tabular-nums;
	}

	.breakdown-badges {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	/* ── Bảng ── */
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

	.col-num {
		font-variant-numeric: tabular-nums;
	}

	.col-wrap {
		white-space: normal;
		min-width: 12rem;
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

		&.status-primary {
			background: var(--primary-100, var(--default-200));
			color: var(--primary);
		}

		&.status-default {
			background: var(--default-200);
			color: var(--foreground-600);
		}
	}

	/* ── Ảnh hóa đơn ── */
	.receipt-thumbs {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.receipt-thumb {
		width: 2.5rem;
		height: 2.5rem;
		padding: 0;
		border: 1px solid var(--default-300);
		border-radius: 0.4rem;
		overflow: hidden;
		cursor: zoom-in;
		background: transparent;

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			display: block;
		}
	}

	.receipt-thumb-editable {
		position: relative;
	}

	.receipt-remove {
		position: absolute;
		top: -0.4rem;
		right: -0.4rem;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		border: none;
		background: var(--error);
		color: #fff;
		font-size: 0.75rem;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.form-file {
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.preview-wrap {
		display: flex;
		justify-content: center;
		max-height: 70vh;
		overflow: auto;
	}

	.preview-image {
		max-width: 100%;
		max-height: 65vh;
		object-fit: contain;
		border-radius: 0.5rem;
	}

	/* ── Phân trang ── */
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

	/* ── Form ── */
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

	.form-textarea {
		height: auto;
		padding: 0.5rem 0.75rem;
		resize: vertical;
	}
</style>
