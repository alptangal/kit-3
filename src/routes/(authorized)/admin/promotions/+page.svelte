<!-- src/routes/(authorized)/admin/promotions/+page.svelte -->
<script lang="ts">
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDateTime as formatDateTimeShared } from '$modules/i18n';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolveServerMessage } from '../_interface';

	interface PromotionRow {
		_id?: string;
		code?: string;
		name?: string;
		type?: string;
		value?: number;
		minOrderValue?: number | null;
		maxDiscountAmount?: number | null;
		usageLimit?: number | null;
		usageCount?: number;
		status?: string;
		startAt?: string | null;
		endAt?: string | null;
		createdAt?: string | null;
	}

	// ── Ngôn ngữ ──
	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : (client.browser?.language ?? 'en'));

	// ── Cặp khoá RSA ──
	let encryptionKeys = $state<
		| undefined
		| {
				publicKey: CryptoKey;
				privateKey: CryptoKey;
		  }
	>(undefined);

	// ── Nội dung song ngữ ──
	const pageContents: { [k: string]: any } = {
		title: { vi: 'Khuyến mãi', en: 'Promotions' },
		subtitle: {
			vi: 'Quản lý mã khuyến mãi: phần trăm, số tiền cố định hoặc mua X tặng Y',
			en: 'Manage promotion codes: percentage, fixed amount or buy-x-get-y'
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' }
		},
		table: {
			code: { vi: 'Mã', en: 'Code' },
			name: { vi: 'Tên', en: 'Name' },
			type: { vi: 'Loại', en: 'Type' },
			value: { vi: 'Giá trị', en: 'Value' },
			minOrder: { vi: 'Đơn tối thiểu', en: 'Min order' },
			usage: { vi: 'Lượt dùng', en: 'Usage' },
			window: { vi: 'Thời gian', en: 'Window' },
			status: { vi: 'Trạng thái', en: 'Status' }
		},
		types: {
			percentage: { vi: 'Phần trăm', en: 'Percentage' },
			fixed_amount: { vi: 'Số tiền cố định', en: 'Fixed amount' },
			buy_x_get_y: { vi: 'Mua X tặng Y', en: 'Buy X get Y' }
		},
		statuses: {
			active: { vi: 'Đang chạy', en: 'Active' },
			inactive: { vi: 'Tạm tắt', en: 'Inactive' },
			expired: { vi: 'Hết hạn', en: 'Expired' }
		},
		actions: {
			create: { vi: 'Tạo khuyến mãi', en: 'Create promotion' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được khuyến mãi', en: 'Failed to load promotions' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có khuyến mãi nào', en: 'No promotions yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			totalCount: { vi: '{total} khuyến mãi', en: '{total} promotions' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		createModal: {
			title: { vi: 'Tạo khuyến mãi', en: 'Create promotion' },
			code: { vi: 'Mã', en: 'Code' },
			name: { vi: 'Tên', en: 'Name' },
			type: { vi: 'Loại', en: 'Type' },
			value: { vi: 'Giá trị', en: 'Value' },
			valueHint: {
				percentage: { vi: 'Phần trăm giảm (0-100)', en: 'Discount percent (0-100)' },
				fixed_amount: { vi: 'Số tiền giảm', en: 'Discount amount' },
				buy_x_get_y: { vi: 'Số lượng mua để được tặng', en: 'Buy quantity to earn the gift' }
			},
			minOrder: { vi: 'Giá trị đơn tối thiểu (tuỳ chọn)', en: 'Min order value (optional)' },
			maxDiscount: { vi: 'Giảm tối đa (tuỳ chọn)', en: 'Max discount amount (optional)' },
			usageLimit: { vi: 'Giới hạn lượt dùng (tuỳ chọn)', en: 'Usage limit (optional)' },
			startAt: { vi: 'Bắt đầu', en: 'Start at' },
			endAt: { vi: 'Kết thúc', en: 'End at' },
			status: { vi: 'Trạng thái', en: 'Status' },
			submit: { vi: 'Tạo', en: 'Create' }
		},
		toasts: {
			created: { vi: 'Đã tạo khuyến mãi', en: 'Promotion created' },
			failed: { vi: 'Tạo khuyến mãi không thành công', en: 'Failed to create promotion' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireCode: { vi: 'Vui lòng nhập mã', en: 'Please enter a code' },
			requireName: { vi: 'Vui lòng nhập tên', en: 'Please enter a name' },
			requireValue: { vi: 'Giá trị phải là số không âm', en: 'Value must be a non-negative number' },
			requireWindow: { vi: 'Vui lòng chọn thời gian bắt đầu và kết thúc', en: 'Please choose start and end times' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	// pathname ép về string

	const PROMOTION_TYPES = ['percentage', 'fixed_amount', 'buy_x_get_y'] as const;
	const PROMOTION_STATUSES = ['active', 'inactive', 'expired'] as const;

	function typeLabel(type?: string): string {
		const key = (type ?? '') as keyof typeof pageContents.types;
		const label = pageContents.types[key];
		return label ? label[lang] : (type ?? '—');
	}

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statuses;
		const label = pageContents.statuses[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusColor(status?: string): 'success' | 'warning' | 'danger' | 'default' {
		switch (status) {
			case 'active':
				return 'success';
			case 'inactive':
				return 'warning';
			case 'expired':
				// DataTableStatus không có 'error' — map sang 'danger'
				return 'danger';
			default:
				return 'default';
		}
	}

	// ── Danh sách ──
	let promotions = $state<PromotionRow[]>([]);
	let total = $state(0);
	let pageNo = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadError = $state<string | undefined>(undefined);
	let loadedOnce = $state(false);
	let statusFilter = $state('');

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	// i18n: format qua helper dùng chung ($modules/i18n) — cùng shape trước đây.
	function formatDateTime(raw?: string | null): string {
		return formatDateTimeShared(raw, lang);
	}

	function formatMoney(value?: number | null): string {
		if (value === null || value === undefined) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US').format(value);
	}

	function formatValue(row: PromotionRow): string {
		if (row.type === 'percentage') return `${row.value ?? 0}%`;
		return formatMoney(row.value);
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	// ── Gọi API ──
	async function loadPromotions() {
		if (!encryptionKeys) return;
		loading = true;
		loadError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/promotions/list',
				{
					method: 'POST',
					body: {
						page: pageNo,
						pageSize,
						status: statusFilter || undefined
					}
				},
				encryptionKeys
			);
			loading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: PromotionRow[]; total?: number; page?: number }
					| undefined;
				promotions = data?.items ?? [];
				if (typeof data?.total === 'number') total = data.total;
				if (typeof data?.page === 'number') pageNo = data.page;
				loadedOnce = true;
			} else {
				loadError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			loading = false;
			loadError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/promotions] load failed:', err);
		}
	}

	// ── Phân trang / filter ──
	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === pageNo || loading) return;
		pageNo = target;
		await loadPromotions();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize || loading) return;
		pageSize = newSize;
		pageNo = 1;
		await loadPromotions();
	}

	async function onFilterChange() {
		if (loading) return;
		pageNo = 1;
		await loadPromotions();
	}

	// ── DataTable columns (status pill qua col.status — 'error' → 'danger') ──
	const promotionsAny = $derived(promotions as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'code',
			label: pageContents.table.code[lang],
			sortable: true,
			accessor: (row) => (row as unknown as PromotionRow).code ?? '—'
		},
		{
			id: 'name',
			label: pageContents.table.name[lang],
			sortable: true,
			accessor: (row) => (row as unknown as PromotionRow).name ?? '—'
		},
		{
			id: 'type',
			label: pageContents.table.type[lang],
			sortable: true,
			accessor: (row) => typeLabel((row as unknown as PromotionRow).type)
		},
		{
			id: 'value',
			label: pageContents.table.value[lang],
			accessor: (row) => formatValue((row as unknown as PromotionRow))
		},
		{
			id: 'minOrder',
			label: pageContents.table.minOrder[lang],
			accessor: (row) => formatMoney((row as unknown as PromotionRow).minOrderValue)
		},
		{
			id: 'usage',
			label: pageContents.table.usage[lang],
			sortable: true,
			accessor: (row) => {
				const r = row as unknown as PromotionRow;
				return `${r.usageCount ?? 0}${r.usageLimit ? ` / ${r.usageLimit}` : ''}`;
			}
		},
		{
			id: 'window',
			label: pageContents.table.window[lang],
			accessor: (row) => {
				const r = row as unknown as PromotionRow;
				return `${formatDateTime(r.startAt)} → ${formatDateTime(r.endAt)}`;
			},
			noHighlight: true
		},
		{
			id: 'status',
			label: pageContents.table.status[lang],
			sortable: true,
			accessor: (row) => statusLabel((row as unknown as PromotionRow).status),
			status: (_value, row) => statusColor((row as unknown as PromotionRow).status)
		}
	]);

	// ── Modal tạo ──
	let createModalDisplay = $state(false);
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);
	let form = $state<{
		code: string;
		name: string;
		type: string;
		value: number;
		minOrderValue: number | null;
		maxDiscountAmount: number | null;
		usageLimit: number | null;
		startAt: string;
		endAt: string;
		status: string;
	}>({
		code: '',
		name: '',
		type: 'percentage',
		value: 0,
		minOrderValue: null,
		maxDiscountAmount: null,
		usageLimit: null,
		startAt: '',
		endAt: '',
		status: 'active'
	});

	function openCreateModal() {
		form = {
			code: '',
			name: '',
			type: 'percentage',
			value: 0,
			minOrderValue: null,
			maxDiscountAmount: null,
			usageLimit: null,
			startAt: '',
			endAt: '',
			status: 'active'
		};
		formError = undefined;
		createModalDisplay = true;
	}

	function validateForm(): string | undefined {
		if (!form.code.trim()) return pageContents.form.requireCode[lang];
		if (!form.name.trim()) return pageContents.form.requireName[lang];
		if (!Number.isFinite(form.value) || form.value < 0) return pageContents.form.requireValue[lang];
		if (!form.startAt || !form.endAt) return pageContents.form.requireWindow[lang];
		return undefined;
	}

	async function submitPromotion() {
		if (submitting || !encryptionKeys) return;
		const validationError = validateForm();
		if (validationError) {
			formError = validationError;
			return;
		}
		formError = undefined;
		submitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/promotions/create',
				{
					method: 'POST',
					body: {
						code: form.code.trim(),
						name: form.name.trim(),
						type: form.type,
						value: Number(form.value),
						minOrderValue: form.minOrderValue ?? undefined,
						maxDiscountAmount: form.maxDiscountAmount ?? undefined,
						usageLimit: form.usageLimit ?? undefined,
						startAt: new Date(form.startAt).toISOString(),
						endAt: new Date(form.endAt).toISOString(),
						status: form.status
					}
				},
				encryptionKeys
			);
			submitting = false;
			if (response.ok) {
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.created)
						: pageContents.toasts.created[lang],
					'success'
				);
				createModalDisplay = false;
				await loadPromotions();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			submitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/promotions] create failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await loadPromotions();
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
			<Button color="success" onClick={openCreateModal}>{pageContents.actions.create[lang]}</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each PROMOTION_STATUSES as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadPromotions}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	{#if loadError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{loadError}</p>
			<Button color="primary" variant="outline" onClick={loadPromotions}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else}
	<!-- ── Bảng khuyến mãi — DataTable (component có sẵn) ──
	     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
	     Pagination element bên dưới bind:page điều khiển server.
	     Skeleton + empty state do DataTable tự xử lý (loadingLabel/emptyLabel). -->
	<div class="admin-table-wrap">
		<DataTable
			data={promotionsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			searchable
			searchPlaceholder={{ vi: 'Tìm khuyến mãi…', en: 'Search promotions…' }}
			resizable={{ enabled: true, fit: true }}
			loading={loading}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={pageContents.states.empty[lang]}
			loadingLabel={pageContents.states.loading[lang]}
			caption={{ vi: 'Danh sách khuyến mãi', en: 'Promotion list' }}
			stickyHead
			data-test="promotions-datatable"
		/>
	</div>

	<!-- ── Phân trang (server-side) ── -->
	<footer class="admin-pagination">
		<span class="total-count">{pageContents.pagination.totalCount[lang].replace('{total}', String(total))}</span>
		<div class="page-controls">
			<Pagination
				bind:page={pageNo}
				totalPages={totalPages}
				loading={loading}
				variant="compact"
				prevLabel={pageContents.pagination.prev[lang]}
				nextLabel={pageContents.pagination.next[lang]}
				aria-label={pageContents.title[lang]}
			/>
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
	{/if}
</section>

<!-- ── Modal tạo khuyến mãi ── -->
{#if createModalDisplay}
	<Modal bind:display={createModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.createModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				{#if formError}
					<div class="form-error-banner" role="alert">{formError}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.code[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.code} disabled={submitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.name[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.name} disabled={submitting} />
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.type[lang]}</span>
							<select class="admin-select" bind:value={form.type} disabled={submitting}>
								{#each PROMOTION_TYPES as type (type)}
									<option value={type}>{typeLabel(type)}</option>
								{/each}
							</select>
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.value[lang]}</span>
							<input class="admin-input" type="number" min="0" step="any" bind:value={form.value} disabled={submitting} />
							<span class="form-hint">{pageContents.createModal.valueHint[form.type as keyof typeof pageContents.createModal.valueHint][lang]}</span>
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.minOrder[lang]}</span>
							<input class="admin-input" type="number" min="0" step="any" bind:value={form.minOrderValue} disabled={submitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.maxDiscount[lang]}</span>
							<input class="admin-input" type="number" min="0" step="any" bind:value={form.maxDiscountAmount} disabled={submitting} />
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.usageLimit[lang]}</span>
							<input class="admin-input" type="number" min="0" step="1" bind:value={form.usageLimit} disabled={submitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.status[lang]}</span>
							<select class="admin-select" bind:value={form.status} disabled={submitting}>
								{#each PROMOTION_STATUSES as status (status)}
									<option value={status}>{statusLabel(status)}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.startAt[lang]}</span>
							<input class="admin-input" type="datetime-local" bind:value={form.startAt} disabled={submitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.createModal.endAt[lang]}</span>
							<input class="admin-input" type="datetime-local" bind:value={form.endAt} disabled={submitting} />
						</label>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<!-- create/save = success -->
				<Button color="success" onClick={submitPromotion} loading={submitting} disabled={submitting}>
					{pageContents.createModal.submit[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					disabled={submitting}
					onClick={() => {
						createModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

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

	.admin-table-wrap {
		overflow-x: auto;
		border-radius: 0.75rem;
		border: 1px solid var(--default-300);
		background: var(--background);
		/* Sticky thead: wrap overflow-x auto tao scroll context - th sticky bam
		   theo wrap (khong cuon) -> thead truot mat. Co stickyHead: wrap phai
		   thoat scroll context (beng ngang do .datatable-table-wrap tu cuon). */
		&:has(:global(.datatable-sticky-head)) {
			overflow-x: visible;
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

	.form-hint {
		font-size: 0.75rem;
		color: var(--foreground-500);
	}
</style>
