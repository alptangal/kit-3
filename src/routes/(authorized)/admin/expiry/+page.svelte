<!-- src/routes/(authorized)/admin/expiry/+page.svelte -->
<script lang="ts">
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { resolveServerMessage } from '../_interface';

	interface ExpiryLotRow {
		_id: string;
		variantId: string;
		displayName: string | null;
		sku: string | null;
		branchId: string;
		lotNumber: string;
		quantityOnHand: number;
		manufacturedAt: string | null;
		expiresAt: string | null;
		daysRemaining: number | null;
		bucket: 'expired' | 'le7' | 'le15' | 'le30' | 'gt30';
	}

	interface ExpiryCounts {
		expired: number;
		le7: number;
		le15: number;
		le30: number;
		gt30: number;
	}

	interface BranchOption {
		_id: string;
		name?: string;
	}

	type BucketKey = 'all' | 'expired' | 'le7' | 'le15' | 'le30' | 'gt30';

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
		title: { vi: 'Hạn sử dụng', en: 'Expiry management' },
		subtitle: {
			vi: 'Theo dõi lot cận date và tạo khuyến mãi xả hàng',
			en: 'Track near-expiry lots and create clearance promotions'
		},
		buckets: {
			all: { vi: 'Tất cả', en: 'All' },
			expired: { vi: 'Quá hạn', en: 'Expired' },
			le7: { vi: '≤ 7 ngày', en: '≤ 7 days' },
			le15: { vi: '≤ 15 ngày', en: '≤ 15 days' },
			le30: { vi: '≤ 30 ngày', en: '≤ 30 days' },
			gt30: { vi: '> 30 ngày', en: '> 30 days' }
		},
		filters: {
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' },
			days: { vi: 'Khoảng ngày', en: 'Days window' },
			includeExpired: { vi: 'Bao gồm quá hạn', en: 'Include expired' }
		},
		table: {
			variant: { vi: 'Sản phẩm', en: 'Product' },
			lot: { vi: 'Số lô', en: 'Lot' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			quantity: { vi: 'Tồn', en: 'Qty' },
			manufacturedAt: { vi: 'Ngày SX', en: 'Mfg date' },
			expiresAt: { vi: 'Hạn dùng', en: 'Expires' },
			daysRemaining: { vi: 'Còn lại', en: 'Days left' }
		},
		actions: {
			createPromotion: { vi: 'Tạo khuyến mãi xả hàng', en: 'Create clearance promotion' },
			cancel: { vi: 'Huỷ', en: 'Cancel' },
			submit: { vi: 'Tạo khuyến mãi', en: 'Create promotion' },
			selectSome: { vi: 'Chọn lot', en: 'Select lots' }
		},
		promotionModal: {
			title: { vi: 'Khuyến mãi xả hàng', en: 'Clearance promotion' },
			discount: { vi: 'Phần trăm giảm (%)', en: 'Discount percent (%)' },
			days: { vi: 'Thời hạn (ngày)', en: 'Duration (days)' },
			selectedLots: { vi: 'Lot đã chọn', en: 'Selected lots' },
			requireLots: { vi: 'Chọn ít nhất 1 lot', en: 'Select at least 1 lot' },
			requireDiscount: { vi: 'Phần trăm giảm phải từ 1 đến 100', en: 'Discount must be 1-100' }
		},
		toasts: {
			created: { vi: 'Tạo khuyến mãi xả hàng thành công', en: 'Clearance promotion created' },
			failed: { vi: 'Thao tác thất bại', en: 'Action failed' },
			requestFailed: { vi: 'Lỗi kết nối máy chủ', en: 'Server request failed' }
		},
		states: {
			loading: { vi: 'Đang tải…', en: 'Loading…' },
			empty: { vi: 'Không có lot nào cận date', en: 'No near-expiry lots' },
			errorTitle: { vi: 'Không tải được danh sách', en: 'Failed to load list' },
			retry: { vi: 'Thử lại', en: 'Retry' }
		},
		promotionsLink: { vi: 'Xem khuyến mãi', en: 'View promotions' },
		daysUnit: { vi: 'ngày', en: 'days' },
		expiredLabel: { vi: 'quá hạn', en: 'expired' }
	};

	// ── State ──
	let lots = $state<ExpiryLotRow[]>([]);
	let counts = $state<ExpiryCounts>({ expired: 0, le7: 0, le15: 0, le30: 0, gt30: 0 });
	let total = $state(0);
	let page = $state(1);
	let pageSize = $state(20);
	let loading = $state(false);
	let loadedOnce = $state(false);
	let listError = $state<string | undefined>(undefined);

	let bucketFilter = $state<BucketKey>('all');
	let branchFilter = $state('');
	let daysWindow = $state(30);
	let includeExpired = $state(true);

	let branches = $state<BranchOption[]>([]);
	let selectedLotIds = $state<string[]>([]);

	// ── Modal khuyến mãi ──
	let promoModalDisplay = $state(false);
	let promoSubmitting = $state(false);
	let promoError = $state<string | undefined>(undefined);
	let promoDiscount = $state(20);
	let promoDays = $state(7);
	let createdPromotionCode = $state<string | null>(null);

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	// days window theo bucket filter
	const effectiveDays = $derived(
		bucketFilter === 'le7' ? 7 : bucketFilter === 'le15' ? 15 : bucketFilter === 'le30' ? 30 : daysWindow
	);

	function formatDate(raw?: string | null): string {
		if (!raw) return '—';
		try {
			const date = new Date(raw);
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit'
			}).format(date);
		} catch {
			return '—';
		}
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
	}

	function getBranchLabel(id?: string): string {
		if (!id) return '—';
		return branches.find((b) => b._id === id)?.name ?? id;
	}

	function daysLabel(row: ExpiryLotRow): string {
		if (row.daysRemaining === null) return '—';
		if (row.daysRemaining < 0) return `${pageContents.expiredLabel[lang]} (${row.daysRemaining})`;
		return `${row.daysRemaining} ${pageContents.daysUnit[lang]}`;
	}

	function daysClass(row: ExpiryLotRow): string {
		if (row.daysRemaining === null) return '';
		if (row.daysRemaining < 0) return 'cell-danger';
		if (row.daysRemaining < 7) return 'cell-warn';
		return '';
	}

	function bucketCount(key: Exclude<BucketKey, 'all'>): number {
		return counts[key];
	}

	// ── API ──
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
			if (import.meta.env.DEV) console.error('[admin/expiry] load branches failed:', err);
		}
	}

	async function loadLots() {
		if (!encryptionKeys) return;
		loading = true;
		listError = undefined;
		try {
			// bucket filter: lấy dải rộng rồi client lọc theo bucket khi cần chính xác
			// (server đã nhóm counts riêng — list lấy theo days window + includeExpired)
			const response = await encryption.fetchSecure(
				'/api/admin/expiry/list',
				{
					method: 'POST',
					body: {
						days: effectiveDays,
						includeExpired,
						branchId: branchFilter || undefined,
						page,
						pageSize
					}
				},
				encryptionKeys
			);
			loading = false;
			loadedOnce = true;
			if (response.ok) {
				const data = response.data as { items?: ExpiryLotRow[]; total?: number; counts?: ExpiryCounts } | undefined;
				let items = data?.items ?? [];
				if (bucketFilter !== 'all') {
					const key = bucketFilter as Exclude<BucketKey, 'all'>;
					items = items.filter((row) => row.bucket === key);
				}
				lots = items;
				total = data?.total ?? 0;
				counts = data?.counts ?? counts;
			} else {
				listError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			loading = false;
			loadedOnce = true;
			listError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/expiry] fetch error:', err);
		}
	}

	function onFilterChange() {
		page = 1;
		selectedLotIds = [];
		void loadLots();
	}

	function switchBucket(next: BucketKey) {
		bucketFilter = next;
		onFilterChange();
	}

	function changePage(delta: number) {
		const next = page + delta;
		if (next < 1 || next > totalPages) return;
		page = next;
		selectedLotIds = [];
		void loadLots();
	}

	function toggleLot(lotId: string, checked: boolean) {
		if (checked) {
			selectedLotIds = [...selectedLotIds, lotId];
		} else {
			selectedLotIds = selectedLotIds.filter((id) => id !== lotId);
		}
	}

	const allPageSelected = $derived(lots.length > 0 && lots.every((l) => selectedLotIds.includes(l._id)));

	function toggleAll(checked: boolean) {
		if (checked) {
			selectedLotIds = [...new Set([...selectedLotIds, ...lots.map((l) => l._id)])];
		} else {
			selectedLotIds = selectedLotIds.filter((id) => !lots.some((l) => l._id === id));
		}
	}

	function openPromoModal() {
		promoError = undefined;
		promoDiscount = 20;
		promoDays = 7;
		promoModalDisplay = true;
	}

	function validatePromoForm(): string | undefined {
		if (selectedLotIds.length === 0) return pageContents.promotionModal.requireLots[lang];
		const d = Number(promoDiscount);
		if (!Number.isFinite(d) || d < 1 || d > 100) return pageContents.promotionModal.requireDiscount[lang];
		return undefined;
	}

	async function submitPromotion() {
		if (promoSubmitting || !encryptionKeys) return;
		const validationError = validatePromoForm();
		if (validationError) {
			promoError = validationError;
			return;
		}
		promoError = undefined;
		promoSubmitting = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/expiry/create-promotion',
				{
					method: 'POST',
					body: {
						lotIds: selectedLotIds,
						discountPercent: Number(promoDiscount),
						days: Number(promoDays) || 7
					}
				},
				encryptionKeys
			);
			promoSubmitting = false;
			if (response.ok) {
				const data = response.data as { promotion?: { code?: string } } | undefined;
				createdPromotionCode = data?.promotion?.code ?? null;
				showToast(
					response.message
						? resolveServerMessage(response.message, lang, pageContents.toasts.created)
						: pageContents.toasts.created[lang],
					'success'
				);
				promoModalDisplay = false;
				selectedLotIds = [];
				await loadLots();
			} else {
				promoError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			promoSubmitting = false;
			promoError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/expiry] create promotion failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadLots()]);
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
			<!-- create = success -->
			<Button color="success" disabled={selectedLotIds.length === 0} onClick={openPromoModal}>
				{pageContents.actions.createPromotion[lang]}{selectedLotIds.length > 0 ? ` (${selectedLotIds.length})` : ''}
			</Button>
		</div>
	</header>

	<!-- ── Badge nhóm hạn ── -->
	<div class="bucket-strip" role="tablist">
		<button type="button" class="bucket-item" class:active={bucketFilter === 'all'} onclick={() => switchBucket('all')}>
			{pageContents.buckets.all[lang]}
		</button>
		<button type="button" class="bucket-item bucket-danger" class:active={bucketFilter === 'expired'} onclick={() => switchBucket('expired')}>
			{pageContents.buckets.expired[lang]} <span class="bucket-count">{bucketCount('expired')}</span>
		</button>
		<button type="button" class="bucket-item bucket-warn" class:active={bucketFilter === 'le7'} onclick={() => switchBucket('le7')}>
			{pageContents.buckets.le7[lang]} <span class="bucket-count">{bucketCount('le7')}</span>
		</button>
		<button type="button" class="bucket-item" class:active={bucketFilter === 'le15'} onclick={() => switchBucket('le15')}>
			{pageContents.buckets.le15[lang]} <span class="bucket-count">{bucketCount('le15')}</span>
		</button>
		<button type="button" class="bucket-item" class:active={bucketFilter === 'le30'} onclick={() => switchBucket('le30')}>
			{pageContents.buckets.le30[lang]} <span class="bucket-count">{bucketCount('le30')}</span>
		</button>
		<button type="button" class="bucket-item" class:active={bucketFilter === 'gt30'} onclick={() => switchBucket('gt30')}>
			{pageContents.buckets.gt30[lang]} <span class="bucket-count">{bucketCount('gt30')}</span>
		</button>
	</div>

	<!-- ── Filter ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={branchFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allBranches[lang]}</option>
			{#each branches as b (b._id)}
				<option value={b._id}>{b.name ?? b._id}</option>
			{/each}
		</select>
		<label class="filter-check">
			<input type="checkbox" bind:checked={includeExpired} onchange={onFilterChange} />
			<span>{pageContents.filters.includeExpired[lang]}</span>
		</label>
	</div>

	<!-- ── Danh sách lot ── -->
	{#if loading && !loadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if listError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{listError}</p>
			<Button color="primary" variant="outline" onClick={loadLots}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if lots.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="admin-table-wrap">
			<table class="admin-table">
				<thead>
					<tr>
						<th scope="col" class="col-check">
							<input
								type="checkbox"
								checked={allPageSelected}
								onchange={(e) => toggleAll((e.currentTarget as HTMLInputElement).checked)}
								aria-label="select all"
							/>
						</th>
						<th scope="col">{pageContents.table.variant[lang]}</th>
						<th scope="col">{pageContents.table.lot[lang]}</th>
						<th scope="col">{pageContents.table.branch[lang]}</th>
						<th scope="col">{pageContents.table.quantity[lang]}</th>
						<th scope="col">{pageContents.table.manufacturedAt[lang]}</th>
						<th scope="col">{pageContents.table.expiresAt[lang]}</th>
						<th scope="col">{pageContents.table.daysRemaining[lang]}</th>
					</tr>
				</thead>
				<tbody>
					{#each lots as row (row._id)}
						<tr>
							<td class="col-check">
								<input
									type="checkbox"
									checked={selectedLotIds.includes(row._id)}
									onchange={(e) => toggleLot(row._id, (e.currentTarget as HTMLInputElement).checked)}
									aria-label={`select ${row.lotNumber}`}
								/>
							</td>
							<td class="col-name">
								{row.displayName ?? row.variantId}
								{#if row.sku}<span class="cell-sku"> ({row.sku})</span>{/if}
							</td>
							<td class="col-code">{row.lotNumber || '—'}</td>
							<td>{getBranchLabel(row.branchId)}</td>
							<td class="col-num">{row.quantityOnHand}</td>
							<td>{formatDate(row.manufacturedAt)}</td>
							<td>{formatDate(row.expiresAt)}</td>
							<td class="col-num {daysClass(row)}">{daysLabel(row)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="admin-pagination">
			<span class="total-count">{total}</span>
			<div class="page-controls">
				<Button color="default" variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(-1)}>‹</Button>
				<span class="page-info">{page} / {totalPages}</span>
				<Button color="default" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => changePage(1)}>›</Button>
			</div>
		</div>
	{/if}

	<!-- ── Modal tạo khuyến mãi xả hàng ── -->
	{#if promoModalDisplay}
		<Modal bind:display={promoModalDisplay} size="sm" isDimissable>
			<Modal.Container>
				<Modal.Container.Header>{pageContents.promotionModal.title[lang]}</Modal.Container.Header>
				<Modal.Container.Body>
					{#if promoError}
						<div class="form-error-banner" role="alert">{promoError}</div>
					{/if}
					<p class="modal-intro">{pageContents.promotionModal.selectedLots[lang]}: <strong>{selectedLotIds.length}</strong></p>
					<div class="form-grid">
						<label class="form-field">
							<span class="form-label">{pageContents.promotionModal.discount[lang]}</span>
							<input class="admin-input" type="number" min="1" max="100" bind:value={promoDiscount} disabled={promoSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.promotionModal.days[lang]}</span>
							<input class="admin-input" type="number" min="1" bind:value={promoDays} disabled={promoSubmitting} />
						</label>
					</div>
				</Modal.Container.Body>
				<Modal.Container.Footer>
					<!-- create = success -->
					<Button color="success" onClick={submitPromotion} loading={promoSubmitting} disabled={promoSubmitting}>
						{pageContents.actions.submit[lang]}
					</Button>
					<Button color="default" variant="ghost" disabled={promoSubmitting} onclick={() => (promoModalDisplay = false)}>
						{pageContents.actions.cancel[lang]}
					</Button>
				</Modal.Container.Footer>
			</Modal.Container>
		</Modal>
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

	.bucket-strip {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.bucket-item {
		padding: 0.4rem 0.9rem;
		border-radius: 999px;
		border: 1px solid var(--default-300);
		background: var(--background);
		color: var(--foreground-600);
		font-size: 0.85rem;
		cursor: pointer;

		&.active {
			background: var(--primary);
			border-color: var(--primary);
			color: var(--primary-foreground, #fff);
		}
	}

	.bucket-danger.active {
		background: var(--error);
		border-color: var(--error);
	}

	.bucket-warn.active {
		background: var(--warning, hsl(38, 92%, 50%));
		border-color: var(--warning, hsl(38, 92%, 50%));
		color: hsl(0, 0%, 10%);
	}

	.bucket-count {
		display: inline-block;
		margin-left: 0.35rem;
		font-weight: 700;
	}

	.admin-filters {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.filter-check {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--foreground);
		cursor: pointer;
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
	}

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

	.col-check {
		width: 2.5rem;
		text-align: center;
	}

	.col-name {
		white-space: normal;
		min-width: 12rem;
	}

	.cell-sku {
		color: var(--foreground-500);
		font-size: 0.8rem;
	}

	.col-code {
		font-weight: 600;
		color: var(--foreground);
	}

	.col-num {
		font-variant-numeric: tabular-nums;
	}

	.cell-danger {
		color: var(--error);
		font-weight: 700;
	}

	.cell-warn {
		color: var(--warning, hsl(38, 92%, 40%));
		font-weight: 700;
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
	}

	.page-info {
		font-size: 0.85rem;
		color: var(--foreground);
		min-width: 6rem;
		text-align: center;
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

	.modal-intro {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
		color: var(--foreground);
	}

	.form-grid {
		display: grid;
		gap: 0.75rem;
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

	.admin-input {
		height: 2.5rem;
		padding: 0 0.75rem;
		border-radius: var(--field-radius, 0.75rem);
		border: 1px solid var(--default-300);
		background: var(--default-50, transparent);
		color: var(--foreground);
		font-size: 0.9rem;
		width: 100%;
	}
</style>
