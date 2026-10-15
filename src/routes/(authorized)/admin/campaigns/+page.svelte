<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, DataTable, Pagination } from '$components/element';
	import type { DataTableColumn } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { AlertDialog } from '$lib/components/element/alert-dialog';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { resolveServerMessage } from '../_interface';

	let lang = $state<'vi' | 'en'>('vi');
	let encryptionKeys: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null;

	// ---------- i18n ----------
	const pageContents = {
		vi: {
			title: 'Chiến dịch marketing',
			subtitle: 'Quản lý các chiến dịch marketing đa kênh',
			create: 'Tạo chiến dịch',
			edit: 'Sửa chiến dịch',
			launch: 'Khởi chạy',
			pause: 'Tạm dừng',
			complete: 'Hoàn thành',
			cancel: 'Hủy',
			delete: 'Xóa',
			save: 'Lưu',
			close: 'Đóng',
			confirmDelete: 'Xóa chiến dịch',
			confirmDeleteDesc: 'Bạn có chắc muốn xóa chiến dịch này? Hành động không thể hoàn tác.',
			cancelConfirm: 'Giữ lại',
			confirmBtn: 'Xóa vĩnh viễn',
			filtersAll: 'Tất cả',
			filterType: 'loại',
			filterStatus: 'trạng thái',
			colName: 'Tên',
			colType: 'Loại',
			colStatus: 'Trạng thái',
			colBudget: 'Ngân sách / Đã chi',
			colDates: 'Thời gian',
			colReached: 'Đã đạt / Mục tiêu',
			colActions: 'Thao tác',
			fieldName: 'Tên chiến dịch *',
			fieldType: 'Loại *',
			fieldDescription: 'Mô tả',
			fieldBudget: 'Ngân sách',
			fieldTarget: 'Mục tiêu (số người đạt)',
			fieldStart: 'Bắt đầu',
			fieldEnd: 'Kết thúc',
			fieldPromotions: 'Liên kết khuyến mãi',
			promotionsHint: 'Giữ Ctrl (Cmd) để chọn nhiều khuyến mãi',
			empty: 'Chưa có chiến dịch nào',
			loading: 'Đang tải...',
			prev: 'Trước',
			next: 'Sau',
			linkedCount: '{count} khuyến mãi'
		},
		en: {
			title: 'Marketing campaigns',
			subtitle: 'Manage multi-channel marketing campaigns',
			create: 'Create campaign',
			edit: 'Edit campaign',
			launch: 'Launch',
			pause: 'Pause',
			complete: 'Complete',
			cancel: 'Cancel',
			delete: 'Delete',
			save: 'Save',
			close: 'Close',
			confirmDelete: 'Delete campaign',
			confirmDeleteDesc: 'Are you sure you want to delete this campaign? This cannot be undone.',
			cancelConfirm: 'Keep it',
			confirmBtn: 'Delete permanently',
			filtersAll: 'All',
			filterType: 'type',
			filterStatus: 'status',
			colName: 'Name',
			colType: 'Type',
			colStatus: 'Status',
			colBudget: 'Budget / Spent',
			colDates: 'Timeline',
			colReached: 'Reached / Target',
			colActions: 'Actions',
			fieldName: 'Campaign name *',
			fieldType: 'Type *',
			fieldDescription: 'Description',
			fieldBudget: 'Budget',
			fieldTarget: 'Target (people reached)',
			fieldStart: 'Start',
			fieldEnd: 'End',
			fieldPromotions: 'Linked promotions',
			promotionsHint: 'Hold Ctrl (Cmd) to select multiple promotions',
			empty: 'No campaigns yet',
			loading: 'Loading...',
			prev: 'Previous',
			next: 'Next',
			linkedCount: '{count} promotions'
		}
	} as const;
	type PageLang = keyof typeof pageContents;
	const t = (key: keyof (typeof pageContents)['vi']) => pageContents[lang as PageLang][key];

	const toasts = {
		created: { vi: 'Đã tạo chiến dịch', en: 'Campaign created' },
		updated: { vi: 'Đã cập nhật chiến dịch', en: 'Campaign updated' },
		deleted: { vi: 'Đã xóa chiến dịch', en: 'Campaign deleted' },
		launched: { vi: 'Đã khởi chạy chiến dịch', en: 'Campaign launched' },
		paused: { vi: 'Đã tạm dừng chiến dịch', en: 'Campaign paused' },
		completed: { vi: 'Đã hoàn thành chiến dịch', en: 'Campaign completed' },
		cancelled: { vi: 'Đã hủy chiến dịch', en: 'Campaign cancelled' },
		loadFailed: { vi: 'Không thể tải danh sách', en: 'Failed to load campaigns' },
		createFailed: { vi: 'Không thể tạo chiến dịch', en: 'Failed to create campaign' },
		updateFailed: { vi: 'Không thể cập nhật chiến dịch', en: 'Failed to update campaign' },
		deleteFailed: { vi: 'Không thể xóa chiến dịch', en: 'Failed to delete campaign' },
		actionFailed: { vi: 'Thao tác thất bại', en: 'Action failed' },
		requestFailed: { vi: 'Lỗi kết nối máy chủ', en: 'Server request failed' }
	} as const;

	const typeLabels: Record<string, { vi: string; en: string }> = {
		promotion: { vi: 'Khuyến mãi', en: 'Promotion' },
		email: { vi: 'Email', en: 'Email' },
		push: { vi: 'Push', en: 'Push' },
		social: { vi: 'Mạng xã hội', en: 'Social' },
		discount_code: { vi: 'Mã giảm giá', en: 'Discount code' }
	};
	const statusLabels: Record<string, { vi: string; en: string }> = {
		draft: { vi: 'Nháp', en: 'Draft' },
		active: { vi: 'Đang chạy', en: 'Active' },
		paused: { vi: 'Tạm dừng', en: 'Paused' },
		completed: { vi: 'Hoàn thành', en: 'Completed' },
		cancelled: { vi: 'Đã hủy', en: 'Cancelled' }
	};

	// ---------- state ----------
	interface CampaignItem {
		_id: string;
		campaignId: string;
		name: string;
		description?: string;
		type: string;
		status: string;
		budget?: number;
		spent?: number;
		promotionIds?: string[];
		segmentRules?: { field: string; operator: string; value: string | number }[];
		targetCount?: number;
		reachedCount?: number;
		startAt?: string;
		endAt?: string;
		createdAt: string;
		updatedAt: string;
	}

	let items: CampaignItem[] = $state([]);
	let total = $state(0);
	let page = $state(1);
	const pageSize = 20;
	let isLoading = $state(false);
	let loadedOnce = $state(false);
	let errorMessage = $state('');

	let filterType = $state('');
	let filterStatus = $state('');

	let createModalDisplay = $state(false);
	let editModalDisplay = $state(false);
	let deleteDialogOpen = $state(false);
	let deleteBusy = $state(false);
	let deleteTarget = $state<CampaignItem | null>(null);
	let editTarget = $state<CampaignItem | null>(null);

	interface PromotionOption {
		_id: string;
		code: string;
		name: string;
	}
	let promotionOptions: PromotionOption[] = $state([]);
	let selectedPromotionIds: string[] = $state([]);

	let form = $state({
		name: '',
		type: 'promotion' as string,
		description: '',
		budget: '' as string | number,
		targetCount: '' as string | number,
		startAt: '',
		endAt: ''
	});

	// ---------- helpers ----------
	function showToast(title: string, color: 'success' | 'error' | 'warning' | 'info' | 'default') {
		if (client.browser?.toasts) {
			client.browser.toasts.create({ title, color });
		}
	}

	function fmtToast(tc: { vi: string; en: string }): string {
		return lang === 'en' ? tc.en : tc.vi;
	}

	function formatCurrency(value?: number): string {
		if (value === undefined || value === null) return '—';
		return new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(value);
	}

	function formatDate(value?: string): string {
		if (!value) return '—';
		try {
			return new Date(value).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US');
		} catch {
			return value;
		}
	}

	// ---------- data ----------
	async function load() {
		isLoading = true;
		errorMessage = '';
		try {
			if (!encryptionKeys) return;
			const response = await encryption.fetchSecure(
				'/api/admin/campaigns/list',
				{
					method: 'POST',
					body: {
						type: filterType || undefined,
						status: filterStatus || undefined,
						page,
						pageSize
					}
				},
				encryptionKeys
			);
			if (response.ok && response.data) {
				items = (response.data.items ?? []) as CampaignItem[];
				total = response.data.total ?? 0;
				loadedOnce = true;
			} else {
				errorMessage = resolveServerMessage(response.message, lang, {
					vi: toasts.loadFailed.vi,
					en: toasts.loadFailed.en
				});
			}
		} catch (e) {
			if (import.meta.env.DEV) console.error('[admin/campaigns] load failed:', e);
			errorMessage = fmtToast(toasts.requestFailed);
		} finally {
			isLoading = false;
		}
	}

	async function loadPromotions() {
		try {
			if (!encryptionKeys) return;
			const response = await encryption.fetchSecure(
				'/api/admin/promotions/list',
				{ method: 'POST', body: { pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok && response.data) {
				promotionOptions = (response.data.items ?? []) as PromotionOption[];
			}
		} catch (e) {
			if (import.meta.env.DEV) console.error('[admin/campaigns] loadPromotions failed:', e);
		}
	}

	// ---------- actions ----------
	function openCreate() {
		form = {
			name: '',
			type: 'promotion',
			description: '',
			budget: '',
			targetCount: '',
			startAt: '',
			endAt: ''
		};
		selectedPromotionIds = [];
		createModalDisplay = true;
	}

	function openEdit(item: CampaignItem) {
		form = {
			name: item.name ?? '',
			type: item.type ?? 'promotion',
			description: item.description ?? '',
			budget: item.budget ?? '',
			targetCount: item.targetCount ?? '',
			startAt: item.startAt ? item.startAt.slice(0, 16) : '',
			endAt: item.endAt ? item.endAt.slice(0, 16) : ''
		};
		selectedPromotionIds = [...(item.promotionIds ?? [])];
		editTarget = item;
		editModalDisplay = true;
	}

	async function submitCreate(): Promise<void> {
		if (!form.name || !form.type) return;
		try {
			if (!encryptionKeys) return;
			const response = await encryption.fetchSecure(
				'/api/admin/campaigns/create',
				{
					method: 'POST',
					body: {
						name: form.name,
						type: form.type,
						description: form.description || undefined,
						budget: form.budget === '' ? undefined : Number(form.budget),
						targetCount: form.targetCount === '' ? undefined : Number(form.targetCount),
						startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
						endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
						promotionIds: selectedPromotionIds
					}
				},
				encryptionKeys
			);
			if (response.ok) {
				createModalDisplay = false;
				showToast(fmtToast(toasts.created), 'success');
				await load();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, {
						vi: toasts.createFailed.vi,
						en: toasts.createFailed.en
					}),
					'error'
				);
			}
		} catch (e) {
			if (import.meta.env.DEV) console.error('[admin/campaigns] create failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	async function submitEdit(): Promise<void> {
		if (!editTarget || !form.name || !form.type) return;
		try {
			if (!encryptionKeys) return;
			const response = await encryption.fetchSecure(
				'/api/admin/campaigns/update',
				{
					method: 'POST',
					body: {
						campaignId: editTarget.campaignId,
						name: form.name,
						type: form.type,
						description: form.description || undefined,
						budget: form.budget === '' ? undefined : Number(form.budget),
						targetCount: form.targetCount === '' ? undefined : Number(form.targetCount),
						startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
						endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
						promotionIds: selectedPromotionIds
					}
				},
				encryptionKeys
			);
			if (response.ok) {
				editModalDisplay = false;
				showToast(fmtToast(toasts.updated), 'success');
				await load();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, {
						vi: toasts.updateFailed.vi,
						en: toasts.updateFailed.en
					}),
					'error'
				);
			}
		} catch (e) {
			if (import.meta.env.DEV) console.error('[admin/campaigns] update failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	async function transition(
		item: CampaignItem,
		action: 'launch' | 'pause' | 'complete' | 'cancel'
	) {
		try {
			if (!encryptionKeys) return;
			const response = await encryption.fetchSecure(
				`/api/admin/campaigns/${action}`,
				{ method: 'POST', body: { campaignId: item.campaignId } },
				encryptionKeys
			);
			if (response.ok) {
				const map: Record<string, { vi: string; en: string }> = {
					launch: toasts.launched,
					pause: toasts.paused,
					complete: toasts.completed,
					cancel: toasts.cancelled
				};
				showToast(fmtToast(map[action]), 'success');
				await load();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, {
						vi: toasts.actionFailed.vi,
						en: toasts.actionFailed.en
					}),
					'error'
				);
			}
		} catch (e) {
			if (import.meta.env.DEV) console.error('[admin/campaigns] transition failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	function askDelete(item: CampaignItem) {
		deleteTarget = item;
		deleteDialogOpen = true;
	}

	async function submitDelete() {
		const target = deleteTarget;
		if (!target?.campaignId || !encryptionKeys || deleteBusy) return;
		deleteBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/campaigns/delete',
				{ method: 'POST', body: { campaignId: target.campaignId } },
				encryptionKeys
			);
			deleteBusy = false;
			if (response.ok) {
				deleteDialogOpen = false;
				deleteTarget = null;
				showToast(fmtToast(toasts.deleted), 'success');
				await load();
			} else {
				showToast(
					resolveServerMessage(response.message, lang, {
						vi: toasts.deleteFailed.vi,
						en: toasts.deleteFailed.en
					}),
					'error'
				);
			}
		} catch (e) {
			deleteBusy = false;
			if (import.meta.env.DEV) console.error('[admin/campaigns] delete failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	// ---------- DataTable ----------
	// Map campaign status -> DataTableStatus ('default'|'success'|'warning'|'danger'|'info')
	function statusColor(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
		switch (status) {
			case 'active':
				return 'success';
			case 'paused':
				return 'warning';
			case 'cancelled':
				return 'danger';
			case 'completed':
				return 'info';
			default:
				return 'default';
		}
	}

	const itemsAny = $derived(items as unknown as Record<string, unknown>[]);
	const columns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'name',
			label: t('colName'),
			sortable: true,
			accessor: (row) => {
				const item = row as unknown as CampaignItem;
				const sub = item.promotionIds?.length
					? ` — ${t('linkedCount').replace('{count}', String(item.promotionIds.length))}`
					: '';
				return `${item.name}${sub}`;
			}
		},
		{
			id: 'type',
			label: t('colType'),
			sortable: true,
			accessor: (row) =>
				typeLabels[(row as unknown as CampaignItem).type]?.[lang] ??
				(row as unknown as CampaignItem).type,
			noHighlight: true
		},
		{
			id: 'status',
			label: t('colStatus'),
			sortable: true,
			accessor: (row) =>
				statusLabels[(row as unknown as CampaignItem).status]?.[lang] ??
				(row as unknown as CampaignItem).status,
			status: (_value, row) => statusColor((row as unknown as CampaignItem).status)
		},
		{
			id: 'budget',
			label: t('colBudget'),
			accessor: (row) => {
				const item = row as unknown as CampaignItem;
				const sub = item.spent !== undefined ? ` (${formatCurrency(item.spent)})` : '';
				return `${formatCurrency(item.budget)}${sub}`;
			},
			noHighlight: true
		},
		{
			id: 'dates',
			label: t('colDates'),
			accessor: (row) => {
				const item = row as unknown as CampaignItem;
				return `${formatDate(item.startAt)} → ${formatDate(item.endAt)}`;
			},
			noHighlight: true
		},
		{
			id: 'reached',
			label: t('colReached'),
			sortable: true,
			accessor: (row) => {
				const item = row as unknown as CampaignItem;
				return `${item.reachedCount ?? 0} / ${item.targetCount ?? 0}`;
			},
			noHighlight: true
		}
	]);

	// ---------- lifecycle ----------
	onMount(async () => {
		if (!client.browser) client.browser = {};
		lang = client.browser?.language === 'en' ? 'en' : 'vi';
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([load(), loadPromotions()]);
	});
</script>

<svelte:head>
	<title>{t('title')}</title>
</svelte:head>

<section class="admin-page">
	<header class="admin-header">
		<div class="admin-header-text">
			<h1 class="admin-title">{t('title')}</h1>
			<p class="admin-subtitle">{t('subtitle')}</p>
		</div>
		<div class="admin-header-actions">
			<!-- Quy ước màu nút: create = success -->
			<Button color="success" onClick={openCreate} data-test="campaigns-create">
				{t('create')}
			</Button>
		</div>
	</header>

	<div class="admin-filters">
		<select
			class="admin-select"
			bind:value={filterType}
			onchange={() => {
				page = 1;
				load();
			}}
		>
			<option value="">{t('filtersAll')} — {t('filterType')}</option>
			{#each Object.keys(typeLabels) as k (k)}
				<option value={k}>{typeLabels[k][lang]}</option>
			{/each}
		</select>
		<select
			class="admin-select"
			bind:value={filterStatus}
			onchange={() => {
				page = 1;
				load();
			}}
		>
			<option value="">{t('filtersAll')} — {t('filterStatus')}</option>
			{#each Object.keys(statusLabels) as k (k)}
				<option value={k}>{statusLabels[k][lang]}</option>
			{/each}
		</select>
	</div>

	{#if errorMessage}
		<div class="admin-state admin-state--error" role="alert">{errorMessage}</div>
	{:else}
	<!-- ── Bảng chiến dịch — DataTable (component có sẵn) ──
	     Server-side paging: data = 1 trang server, paging trong DataTable TẮT,
	     Pagination element bên dưới bind:page điều khiển server. -->
	<div class="admin-table-wrap">
		<DataTable
			data={itemsAny}
			{columns}
			pageSize={pageSize}
			showPagination={false}
			sortable
			searchable
			searchPlaceholder={{ vi: 'Tìm chiến dịch…', en: 'Search campaigns…' }}
			resizable={{ enabled: true, fit: true }}
			loading={isLoading && !loadedOnce}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={t('empty')}
			loadingLabel={t('loading')}
			caption={{ vi: 'Danh sách chiến dịch', en: 'Campaigns list' }}
			actionsLabel={{ vi: t('colActions'), en: t('colActions') }}
			stickyHead
			data-test="campaigns-datatable"
		>
			{#snippet actionsContent(row)}
				{@const item = row as unknown as CampaignItem}
				<div class="row-actions">
					{#if item.status === 'draft'}
						<Button size="sm" color="success" onClick={() => transition(item, 'launch')}
							>{t('launch')}</Button
						>
					{/if}
					{#if item.status === 'active'}
						<Button size="sm" variant="outline" onClick={() => transition(item, 'pause')}
							>{t('pause')}</Button
						>
					{/if}
					{#if item.status === 'active' || item.status === 'paused'}
						<Button size="sm" color="info" onClick={() => transition(item, 'complete')}
							>{t('complete')}</Button
						>
					{/if}
					{#if item.status === 'draft' || item.status === 'active' || item.status === 'paused'}
						<Button size="sm" variant="ghost" onClick={() => transition(item, 'cancel')}
							>{t('cancel')}</Button
						>
					{/if}
					<Button size="sm" color="primary" variant="ghost" onClick={() => openEdit(item)}
						>{t('edit')}</Button
					>
					<Button size="sm" color="error" variant="ghost" onClick={() => askDelete(item)}
						>{t('delete')}</Button
					>
				</div>
			{/snippet}
		</DataTable>
	</div>

	<!-- ── Phân trang (server-side) ── -->
	<div class="admin-pagination">
		<Pagination
			bind:page={page}
			totalPages={totalPages}
			loading={isLoading}
			variant="compact"
			prevLabel={t('prev')}
			nextLabel={t('next')}
			aria-label={t('title')}
		/>
	</div>
	{/if}
</section>

<!-- Create modal -->
{#if createModalDisplay}
	<Modal bind:display={createModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>{t('create')}</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="form-grid">
					<div class="form-field">
						<label class="form-label" for="campaign-name">{t('fieldName')}</label>
						<input class="admin-input" id="campaign-name" bind:value={form.name} />
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-type">{t('fieldType')}</label>
						<select class="admin-select" id="campaign-type" bind:value={form.type}>
							{#each Object.keys(typeLabels) as k (k)}
								<option value={k}>{typeLabels[k][lang]}</option>
							{/each}
						</select>
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="campaign-desc">{t('fieldDescription')}</label>
						<textarea class="admin-input" id="campaign-desc" rows="3" bind:value={form.description}
						></textarea>
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-budget">{t('fieldBudget')}</label>
						<input
							class="admin-input"
							id="campaign-budget"
							type="number"
							min="0"
							bind:value={form.budget}
						/>
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-target">{t('fieldTarget')}</label>
						<input
							class="admin-input"
							id="campaign-target"
							type="number"
							min="0"
							bind:value={form.targetCount}
						/>
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-start">{t('fieldStart')}</label>
						<input
							class="admin-input"
							id="campaign-start"
							type="datetime-local"
							bind:value={form.startAt}
						/>
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-end">{t('fieldEnd')}</label>
						<input
							class="admin-input"
							id="campaign-end"
							type="datetime-local"
							bind:value={form.endAt}
						/>
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="campaign-promotions">{t('fieldPromotions')}</label>
						<select
							class="admin-input"
							id="campaign-promotions"
							multiple
							bind:value={selectedPromotionIds}
							size="5"
						>
							{#each promotionOptions as promo (promo._id)}
								<option value={promo._id}>{promo.code} — {promo.name}</option>
							{/each}
						</select>
						<div class="form-hint">{t('promotionsHint')}</div>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-actions">
					<Button
						variant="ghost"
						onClick={() => {
							createModalDisplay = false;
						}}>{t('close')}</Button
					>
					<Button color="success" onClick={submitCreate}>{t('save')}</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- Edit modal -->
{#if editModalDisplay}
	<Modal bind:display={editModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>{t('edit')}</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="form-grid">
					<div class="form-field">
						<label class="form-label" for="campaign-edit-name">{t('fieldName')}</label>
						<input class="admin-input" id="campaign-edit-name" bind:value={form.name} />
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-edit-type">{t('fieldType')}</label>
						<select class="admin-select" id="campaign-edit-type" bind:value={form.type}>
							{#each Object.keys(typeLabels) as k (k)}
								<option value={k}>{typeLabels[k][lang]}</option>
							{/each}
						</select>
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="campaign-edit-desc">{t('fieldDescription')}</label>
						<textarea
							class="admin-input"
							id="campaign-edit-desc"
							rows="3"
							bind:value={form.description}
						></textarea>
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-edit-budget">{t('fieldBudget')}</label>
						<input
							class="admin-input"
							id="campaign-edit-budget"
							type="number"
							min="0"
							bind:value={form.budget}
						/>
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-edit-target">{t('fieldTarget')}</label>
						<input
							class="admin-input"
							id="campaign-edit-target"
							type="number"
							min="0"
							bind:value={form.targetCount}
						/>
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-edit-start">{t('fieldStart')}</label>
						<input
							class="admin-input"
							id="campaign-edit-start"
							type="datetime-local"
							bind:value={form.startAt}
						/>
					</div>
					<div class="form-field">
						<label class="form-label" for="campaign-edit-end">{t('fieldEnd')}</label>
						<input
							class="admin-input"
							id="campaign-edit-end"
							type="datetime-local"
							bind:value={form.endAt}
						/>
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="campaign-edit-promotions">{t('fieldPromotions')}</label>
						<select
							class="admin-input"
							id="campaign-edit-promotions"
							multiple
							bind:value={selectedPromotionIds}
							size="5"
						>
							{#each promotionOptions as promo (promo._id)}
								<option value={promo._id}>{promo.code} — {promo.name}</option>
							{/each}
						</select>
						<div class="form-hint">{t('promotionsHint')}</div>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-actions">
					<Button
						variant="ghost"
						onClick={() => {
							editModalDisplay = false;
						}}>{t('close')}</Button
					>
					<Button color="primary" onClick={submitEdit}>{t('save')}</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog xoá chiến dịch ── -->
<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{t('confirmDelete')}</AlertDialog.Title>
			<AlertDialog.Description>{t('confirmDeleteDesc')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{t('cancelConfirm')}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={submitDelete}>
				{t('confirmBtn')}
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
		align-items: flex-start;
		gap: 1rem;
	}

	.admin-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.admin-subtitle {
		color: var(--muted-foreground);
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
	}

	.admin-filters {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.admin-select,
	.admin-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--default-300);
		border-radius: 0.5rem;
		background: var(--background);
		color: var(--foreground);
		font-size: 0.875rem;

		&:focus {
			outline: none;
			border-color: var(--primary);
		}
	}

	.admin-state {
		padding: 2rem;
		text-align: center;
		color: var(--muted-foreground);

		&--error {
			color: var(--error);
		}
	}

	.admin-table-wrap {
		overflow-x: auto;
		border: 1px solid var(--default-300);
		border-radius: 0.5rem;
	}

	/* Nút action trong actionsContent — chống nén (bẫy 39px clip) */
	.row-actions {
		display: flex;
		gap: 0.375rem;
		width: 1%;
		min-width: fit-content;
	}

	.admin-pagination {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.75rem;
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.875rem;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;

		&--full {
			grid-column: 1 / -1;
		}
	}

	.form-label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--foreground);
	}

	.form-hint {
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		width: 100%;
	}
</style>
