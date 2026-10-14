<!-- src/routes/(authorized)/admin/cameras/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$components/element';
	import { Modal } from '$components/modal';
	import { AlertDialog } from '$lib/components/element/alert-dialog';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { resolveServerMessage } from '../_interface';

	interface CameraRow {
		_id?: string;
		name?: string;
		branchId?: string;
		brand?: string;
		model?: string | null;
		host?: string;
		port?: number;
		channel?: number;
		username?: string | null;
		hasPassword?: boolean;
		status?: string;
		lastTestedAt?: string | null;
		lastTestMessage?: string | null;
		createdAt?: string | null;
	}

	interface BranchOption {
		_id: string;
		name?: string;
		isWarehouse?: boolean;
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
		title: { vi: 'Camera giám sát', en: 'Surveillance cameras' },
		subtitle: {
			vi: 'Quản lý camera, kiểm tra kết nối và chụp ảnh (MVP qua HTTP API camera)',
			en: 'Manage cameras, test connections and capture snapshots (MVP via camera HTTP API)'
		},
		brandLabels: {
			ezviz: { vi: 'Ezviz', en: 'Ezviz' },
			hikvision: { vi: 'Hikvision', en: 'Hikvision' },
			dahua: { vi: 'Dahua', en: 'Dahua' },
			other: { vi: 'Khác', en: 'Other' }
		},
		statusLabels: {
			online: { vi: 'Trực tuyến', en: 'Online' },
			offline: { vi: 'Mất kết nối', en: 'Offline' },
			unknown: { vi: 'Chưa kiểm tra', en: 'Not tested' },
			unsupported: { vi: 'Không hỗ trợ', en: 'Unsupported' }
		},
		filters: {
			allStatuses: { vi: 'Tất cả trạng thái', en: 'All statuses' },
			allBrands: { vi: 'Tất cả hãng', en: 'All brands' },
			allBranches: { vi: 'Tất cả chi nhánh', en: 'All branches' }
		},
		card: {
			lastTested: { vi: 'Kiểm tra lần cuối', en: 'Last tested' },
			never: { vi: 'Chưa kiểm tra', en: 'Never tested' },
			passwordSet: { vi: 'Đã đặt mật khẩu', en: 'Password set' },
			noPassword: { vi: 'Chưa có mật khẩu', en: 'No password' },
			test: { vi: 'Kiểm tra kết nối', en: 'Test connection' },
			snapshot: { vi: 'Chụp ảnh', en: 'Snapshot' },
			edit: { vi: 'Sửa', en: 'Edit' },
			del: { vi: 'Xóa', en: 'Delete' },
			testing: { vi: 'Đang kiểm tra…', en: 'Testing…' },
			capturing: { vi: 'Đang chụp…', en: 'Capturing…' }
		},
		actions: {
			create: { vi: 'Thêm camera', en: 'Add camera' }
		},
		states: {
			loading: { vi: 'Đang tải dữ liệu…', en: 'Loading data…' },
			errorTitle: { vi: 'Không tải được danh sách camera', en: 'Failed to load cameras' },
			retry: { vi: 'Thử lại', en: 'Retry' },
			empty: { vi: 'Chưa có camera nào', en: 'No cameras yet' }
		},
		pagination: {
			prev: { vi: 'Trước', en: 'Prev' },
			next: { vi: 'Sau', en: 'Next' },
			pageInfo: { vi: 'Trang {page}/{total}', en: 'Page {page}/{total}' },
			totalCount: { vi: '{total} camera', en: '{total} cameras' },
			pageSizeLabel: { vi: 'Số dòng:', en: 'Rows:' }
		},
		formModal: {
			titleCreate: { vi: 'Thêm camera', en: 'Add camera' },
			titleEdit: { vi: 'Sửa camera', en: 'Edit camera' },
			name: { vi: 'Tên camera', en: 'Camera name' },
			branch: { vi: 'Chi nhánh', en: 'Branch' },
			branchPlaceholder: { vi: 'Chọn chi nhánh', en: 'Select a branch' },
			brand: { vi: 'Hãng', en: 'Brand' },
			brandPlaceholder: { vi: 'Chọn hãng', en: 'Select a brand' },
			model: { vi: 'Model (tuỳ chọn)', en: 'Model (optional)' },
			host: { vi: 'Host / IP', en: 'Host / IP' },
			port: { vi: 'Port', en: 'Port' },
			channel: { vi: 'Kênh (channel)', en: 'Channel' },
			username: { vi: 'Tên đăng nhập', en: 'Username' },
			password: { vi: 'Mật khẩu', en: 'Password' },
			passwordHint: { vi: 'Để trống nếu giữ nguyên mật khẩu cũ. Mật khẩu được mã hóa trên server, không bao giờ hiển thị lại.', en: 'Leave blank to keep the old password. Stored encrypted on the server, never displayed again.' },
			clearPassword: { vi: 'Xóa mật khẩu đã lưu', en: 'Clear stored password' },
			ezvizNote: { vi: 'Ezviz không có HTTP API nội bộ công khai — MVP chỉ lưu thông tin, không test/chụp được. Cần Ezviz OpenAPI (xem backlog).', en: 'Ezviz has no public local HTTP API — MVP stores info only, cannot test/capture. Needs Ezviz OpenAPI (backlog).' },
			submitCreate: { vi: 'Tạo', en: 'Create' },
			submitUpdate: { vi: 'Lưu', en: 'Save' }
		},
		snapshotModal: {
			title: { vi: 'Ảnh chụp camera', en: 'Camera snapshot' },
			download: { vi: 'Tải về', en: 'Download' }
		},
		deleteDialog: {
			title: { vi: 'Xóa camera?', en: 'Delete camera?' },
			description: { vi: 'Hành động này không thể hoàn tác. Camera sẽ bị xóa vĩnh viễn khỏi hệ thống.', en: 'This action cannot be undone. The camera will be permanently removed.' },
			cancel: { vi: 'Hủy', en: 'Cancel' },
			confirm: { vi: 'Xóa', en: 'Delete' }
		},
		toasts: {
			created: { vi: 'Đã tạo camera', en: 'Camera created' },
			updated: { vi: 'Đã cập nhật camera', en: 'Camera updated' },
			deleted: { vi: 'Đã xóa camera', en: 'Camera deleted' },
			tested: { vi: 'Đã kiểm tra kết nối', en: 'Connection tested' },
			failed: { vi: 'Thao tác không thành công', en: 'Operation failed' },
			requestFailed: { vi: 'Đã xảy ra lỗi không xác định', en: 'Unexpected error occurred' }
		},
		form: {
			requireName: { vi: 'Vui lòng nhập tên camera', en: 'Please enter a camera name' },
			requireBranch: { vi: 'Vui lòng chọn chi nhánh', en: 'Please select a branch' },
			requireBrand: { vi: 'Vui lòng chọn hãng', en: 'Please select a brand' },
			requireHost: { vi: 'Vui lòng nhập host/IP', en: 'Please enter host/IP' }
		},
		modals: {
			cancel: { vi: 'Đóng', en: 'Close' }
		}
	};

	const CAMERA_BRANDS = ['ezviz', 'hikvision', 'dahua', 'other'] as const;

	function brandLabel(brand?: string): string {
		const key = (brand ?? '') as keyof typeof pageContents.brandLabels;
		const label = pageContents.brandLabels[key];
		return label ? label[lang] : (brand ?? '—');
	}

	function statusLabel(status?: string): string {
		const key = (status ?? '') as keyof typeof pageContents.statusLabels;
		const label = pageContents.statusLabels[key];
		return label ? label[lang] : (status ?? '—');
	}

	function statusBadgeClass(status?: string): string {
		switch (status) {
			case 'online':
				return 'status-success';
			case 'offline':
				return 'status-error';
			case 'unsupported':
				return 'status-warning';
			default:
				return 'status-default';
		}
	}

	// ── Trạng thái danh sách ──
	let cameras = $state<CameraRow[]>([]);
	let camerasTotal = $state(0);
	let camerasPage = $state(1);
	let camerasLoading = $state(false);
	let camerasError = $state<string | undefined>(undefined);
	let camerasLoadedOnce = $state(false);

	let pageSize = $state(12);
	let statusFilter = $state('');
	let brandFilter = $state('');
	let branchFilter = $state('');

	let branches = $state<BranchOption[]>([]);

	// Busy theo từng camera (test/snapshot)
	let testingId = $state<string | undefined>(undefined);
	let capturingId = $state<string | undefined>(undefined);

	// ── Modal thêm/sửa ──
	let formModalDisplay = $state(false);
	let formSubmitting = $state(false);
	let formError = $state<string | undefined>(undefined);
	let editingId = $state<string | undefined>(undefined);
	let form = $state<{
		name: string;
		branchId: string;
		brand: string;
		model: string;
		host: string;
		port: string;
		channel: string;
		username: string;
		password: string;
		clearPassword: boolean;
	}>({
		name: '',
		branchId: '',
		brand: '',
		model: '',
		host: '',
		port: '80',
		channel: '1',
		username: '',
		password: '',
		clearPassword: false
	});

	// ── Modal xem ảnh chụp ──
	let snapshotModalDisplay = $state(false);
	let snapshotImage = $state('');
	let snapshotMime = $state('image/jpeg');

	// ── AlertDialog xóa ──
	let deleteDialogOpen = $state(false);
	let deletingRow = $state<CameraRow | null>(null);
	let deleteBusy = $state(false);

	// ── Derived ──
	const totalPages = $derived(Math.max(1, Math.ceil(camerasTotal / pageSize)));

	function getBranchLabel(branchId?: string | null): string {
		if (!branchId) return '—';
		const branch = branches.find((b) => b._id === branchId);
		return branch?.name ?? branchId;
	}

	function formatDate(raw?: string | Date | null): string {
		if (!raw) return pageContents.card.never[lang];
		try {
			const date = typeof raw === 'string' ? new Date(raw) : raw;
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}).format(date);
		} catch {
			return pageContents.card.never[lang];
		}
	}

	function showToast(text: string, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title: text, color });
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
			if (import.meta.env.DEV) console.error('[admin/cameras] load branches failed:', err);
		}
	}

	async function loadCameras() {
		if (!encryptionKeys) return;
		camerasLoading = true;
		camerasError = undefined;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/cameras/list',
				{
					method: 'POST',
					body: {
						page: camerasPage,
						pageSize,
						status: statusFilter || undefined,
						brand: brandFilter || undefined,
						branchId: branchFilter || undefined
					}
				},
				encryptionKeys
			);
			camerasLoading = false;
			if (response.ok) {
				const data = response.data as
					| { items?: CameraRow[]; total?: number; page?: number }
					| undefined;
				cameras = data?.items ?? [];
				if (typeof data?.total === 'number') camerasTotal = data.total;
				if (typeof data?.page === 'number') camerasPage = data.page;
				camerasLoadedOnce = true;
			} else {
				camerasError = resolveServerMessage(response.message, lang, pageContents.states.errorTitle);
			}
		} catch (err) {
			camerasLoading = false;
			camerasError = resolveServerMessage(undefined, lang, pageContents.states.errorTitle);
			if (import.meta.env.DEV) console.error('[admin/cameras] load cameras failed:', err);
		}
	}

	async function goToPage(target: number) {
		if (target < 1 || target > totalPages || target === camerasPage || camerasLoading) return;
		camerasPage = target;
		await loadCameras();
	}

	async function changePageSize(newSize: number) {
		if (newSize === pageSize) return;
		pageSize = newSize;
		camerasPage = 1;
		await loadCameras();
	}

	async function onFilterChange() {
		camerasPage = 1;
		await loadCameras();
	}

	// ── Modal thêm/sửa ──
	function openCreateModal() {
		editingId = undefined;
		form = { name: '', branchId: '', brand: '', model: '', host: '', port: '80', channel: '1', username: '', password: '', clearPassword: false };
		formError = undefined;
		formModalDisplay = true;
	}

	function openEditModal(row: CameraRow) {
		editingId = row._id;
		form = {
			name: row.name ?? '',
			branchId: row.branchId ?? '',
			brand: row.brand ?? '',
			model: row.model ?? '',
			host: row.host ?? '',
			port: row.port !== undefined ? String(row.port) : '80',
			channel: row.channel !== undefined ? String(row.channel) : '1',
			username: row.username ?? '',
			password: '',
			clearPassword: false
		};
		formError = undefined;
		formModalDisplay = true;
	}

	function validateForm(): string | undefined {
		if (!form.name.trim()) return pageContents.form.requireName[lang];
		if (!form.branchId) return pageContents.form.requireBranch[lang];
		if (!form.brand) return pageContents.form.requireBrand[lang];
		if (!form.host.trim()) return pageContents.form.requireHost[lang];
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
		const base = {
			name: form.name.trim(),
			branchId: form.branchId,
			brand: form.brand,
			model: form.model.trim() || undefined,
			host: form.host.trim(),
			port: Number(form.port) || 80,
			channel: Number(form.channel) || 1,
			username: form.username.trim() || undefined
		};
		const body = editingId
			? {
					...base,
					cameraId: editingId,
					password: form.password || undefined,
					clearPassword: form.clearPassword || undefined
				}
			: { ...base, password: form.password || undefined };
		try {
			const response = await encryption.fetchSecure(
				editingId ? '/api/admin/cameras/update' : '/api/admin/cameras/create',
				{ method: 'POST', body },
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
				await loadCameras();
			} else {
				formError = resolveServerMessage(response.message, lang, pageContents.toasts.failed);
			}
		} catch (err) {
			formSubmitting = false;
			formError = resolveServerMessage(undefined, lang, pageContents.toasts.requestFailed);
			if (import.meta.env.DEV) console.error('[admin/cameras] submit failed:', err);
		}
	}

	// ── Kiểm tra kết nối ──
	async function testCamera(row: CameraRow) {
		if (testingId || !encryptionKeys || !row._id) return;
		testingId = row._id;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/cameras/test',
				{ method: 'POST', body: { cameraId: row._id } },
				encryptionKeys
			);
			testingId = undefined;
			if (response.ok) {
				const data = response.data as { status?: string; testMessage?: string } | undefined;
				showToast(
					`${statusLabel(data?.status)}${data?.testMessage ? ` — ${data.testMessage}` : ''}`,
					data?.status === 'online' ? 'success' : 'error'
				);
				await loadCameras();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			testingId = undefined;
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/cameras] test failed:', err);
		}
	}

	// ── Chụp ảnh ──
	async function captureCamera(row: CameraRow) {
		if (capturingId || !encryptionKeys || !row._id) return;
		capturingId = row._id;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/cameras/snapshot',
				{ method: 'POST', body: { cameraId: row._id } },
				encryptionKeys
			);
			capturingId = undefined;
			if (response.ok) {
				const data = response.data as { imageBase64?: string; mimeType?: string } | undefined;
				if (data?.imageBase64) {
					snapshotImage = `data:${data.mimeType ?? 'image/jpeg'};base64,${data.imageBase64}`;
					snapshotMime = data.mimeType ?? 'image/jpeg';
					snapshotModalDisplay = true;
					await loadCameras();
				} else {
					showToast(pageContents.toasts.failed[lang], 'error');
				}
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			capturingId = undefined;
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/cameras] snapshot failed:', err);
		}
	}

	function downloadSnapshot() {
		if (!snapshotImage) return;
		const ext = snapshotMime.includes('png') ? 'png' : 'jpg';
		const a = document.createElement('a');
		a.href = snapshotImage;
		a.download = `snapshot-${Date.now()}.${ext}`;
		a.click();
	}

	// ── Xóa ──
	function askDelete(row: CameraRow) {
		deletingRow = row;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!deletingRow || deleteBusy || !encryptionKeys) return;
		deleteBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/cameras/delete',
				{ method: 'POST', body: { cameraId: deletingRow._id } },
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
				await loadCameras();
			} else {
				showToast(resolveServerMessage(response.message, lang, pageContents.toasts.failed), 'error');
			}
		} catch (err) {
			deleteBusy = false;
			showToast(pageContents.toasts.requestFailed[lang], 'error');
			if (import.meta.env.DEV) console.error('[admin/cameras] delete failed:', err);
		}
	}

	onMount(async () => {
		if (!client.browser) client.browser = {};
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadBranches(), loadCameras()]);
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
			<Button color="success" onClick={openCreateModal} data-test="cameras-create">
				{pageContents.actions.create[lang]}
			</Button>
		</div>
	</header>

	<!-- ── Bộ lọc ── -->
	<div class="admin-filters">
		<select class="admin-select" bind:value={statusFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allStatuses[lang]}</option>
			{#each ['online', 'offline', 'unknown'] as status (status)}
				<option value={status}>{statusLabel(status)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={brandFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allBrands[lang]}</option>
			{#each CAMERA_BRANDS as brand (brand)}
				<option value={brand}>{brandLabel(brand)}</option>
			{/each}
		</select>
		<select class="admin-select" bind:value={branchFilter} onchange={onFilterChange}>
			<option value="">{pageContents.filters.allBranches[lang]}</option>
			{#each branches as branch (branch._id)}
				<option value={branch._id}>{branch.name ?? branch._id}</option>
			{/each}
		</select>
		<Button color="default" variant="outline" size="sm" onClick={loadCameras}>
			{pageContents.states.retry[lang]}
		</Button>
	</div>

	<!-- ── Danh sách ── -->
	{#if camerasLoading && !camerasLoadedOnce}
		<div class="admin-state" role="status">
			<p>{pageContents.states.loading[lang]}</p>
		</div>
	{:else if camerasError}
		<div class="admin-state error" role="alert">
			<p class="state-title">{pageContents.states.errorTitle[lang]}</p>
			<p class="state-detail">{camerasError}</p>
			<Button color="primary" variant="outline" onClick={loadCameras}>{pageContents.states.retry[lang]}</Button>
		</div>
	{:else if cameras.length === 0}
		<div class="admin-state">
			<p>{pageContents.states.empty[lang]}</p>
		</div>
	{:else}
		<div class="camera-grid" data-test="cameras-grid">
			{#each cameras as row (row._id)}
				<article class="camera-card" data-test="cameras-card">
					<header class="camera-card-head">
						<div class="camera-card-title">
							<span class="status-dot status-dot-{row.status ?? 'unknown'}" aria-hidden="true"></span>
							<h3 class="camera-name">{row.name ?? '—'}</h3>
						</div>
						<span class="brand-badge">{brandLabel(row.brand)}</span>
					</header>
					<dl class="camera-card-body">
						<div class="camera-meta">
							<dt class="meta-label">Host</dt>
							<dd class="meta-value">{row.host ?? '—'}:{row.port ?? 80}</dd>
						</div>
						<div class="camera-meta">
							<dt class="meta-label">{pageContents.formModal.channel[lang]}</dt>
							<dd class="meta-value">{row.channel ?? 1}</dd>
						</div>
						<div class="camera-meta">
							<dt class="meta-label">{pageContents.filters.allBranches[lang]}</dt>
							<dd class="meta-value">{getBranchLabel(row.branchId)}</dd>
						</div>
						<div class="camera-meta">
							<dt class="meta-label">{pageContents.card.lastTested[lang]}</dt>
							<dd class="meta-value">{formatDate(row.lastTestedAt)}</dd>
						</div>
					</dl>
					<div class="camera-status-row">
						<span class="status-badge {statusBadgeClass(row.status)}" data-test="cameras-status">{statusLabel(row.status)}</span>
						<span class="password-flag" class:has-password={row.hasPassword}>
							{row.hasPassword ? pageContents.card.passwordSet[lang] : pageContents.card.noPassword[lang]}
						</span>
					</div>
					{#if row.lastTestMessage}
						<p class="camera-test-message" title={row.lastTestMessage}>{row.lastTestMessage}</p>
					{/if}
					<footer class="camera-card-actions">
						<!-- update/test = primary -->
						<Button color="primary" variant="outline" size="sm" loading={testingId === row._id} disabled={!!testingId || !!capturingId} onclick={() => testCamera(row)}>
							{testingId === row._id ? pageContents.card.testing[lang] : pageContents.card.test[lang]}
						</Button>
						<Button color="primary" variant="outline" size="sm" loading={capturingId === row._id} disabled={!!testingId || !!capturingId} onclick={() => captureCamera(row)}>
							{capturingId === row._id ? pageContents.card.capturing[lang] : pageContents.card.snapshot[lang]}
						</Button>
						<Button color="primary" variant="ghost" size="sm" disabled={!!testingId || !!capturingId} onclick={() => openEditModal(row)}>
							{pageContents.card.edit[lang]}
						</Button>
						<!-- delete = error -->
						<Button color="error" variant="ghost" size="sm" disabled={!!testingId || !!capturingId} onclick={() => askDelete(row)}>
							{pageContents.card.del[lang]}
						</Button>
					</footer>
				</article>
			{/each}
		</div>
	{/if}

	<!-- ── Phân trang ── -->
	<footer class="admin-pagination">
		<span class="total-count">
			{pageContents.pagination.totalCount[lang].replace('{total}', String(camerasTotal))}
		</span>
		<div class="page-controls">
			<Button
				color="default"
				variant="outline"
				size="sm"
				disabled={camerasPage <= 1}
				onClick={() => goToPage(camerasPage - 1)}
			>
				{pageContents.pagination.prev[lang]}
			</Button>
			<span class="page-info">
				{pageContents.pagination.pageInfo[lang]
					.replace('{page}', String(camerasPage))
					.replace('{total}', String(totalPages))}
			</span>
			<Button
				color="default"
				variant="outline"
				size="sm"
				disabled={camerasPage >= totalPages}
				onClick={() => goToPage(camerasPage + 1)}
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
					{#each [12, 24, 48] as size (size)}
						<option value={size}>{size}</option>
					{/each}
				</select>
			</label>
		</div>
	</footer>
</section>

<!-- ── Modal thêm/sửa camera ── -->
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
				{#if form.brand === 'ezviz'}
					<div class="brand-note" role="note">{pageContents.formModal.ezvizNote[lang]}</div>
				{/if}
				<div class="form-grid">
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.name[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.name} disabled={formSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.branch[lang]}</span>
							<select class="admin-select" bind:value={form.branchId} disabled={formSubmitting}>
								<option value="" disabled>{pageContents.formModal.branchPlaceholder[lang]}</option>
								{#each branches as branch (branch._id)}
									<option value={branch._id}>{branch.name ?? branch._id}</option>
								{/each}
							</select>
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.brand[lang]}</span>
							<select class="admin-select" bind:value={form.brand} disabled={formSubmitting}>
								<option value="" disabled>{pageContents.formModal.brandPlaceholder[lang]}</option>
								{#each CAMERA_BRANDS as brand (brand)}
									<option value={brand}>{brandLabel(brand)}</option>
								{/each}
							</select>
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.model[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.model} disabled={formSubmitting} />
						</label>
					</div>
					<div class="form-grid-3">
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.host[lang]}</span>
							<input class="admin-input" type="text" bind:value={form.host} disabled={formSubmitting} placeholder="192.168.1.64" />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.port[lang]}</span>
							<input class="admin-input" type="number" min="1" max="65535" bind:value={form.port} disabled={formSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.channel[lang]}</span>
							<input class="admin-input" type="number" min="1" bind:value={form.channel} disabled={formSubmitting} />
						</label>
					</div>
					<div class="form-grid-2">
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.username[lang]}</span>
							<input class="admin-input" type="text" autocomplete="off" bind:value={form.username} disabled={formSubmitting} />
						</label>
						<label class="form-field">
							<span class="form-label">{pageContents.formModal.password[lang]}</span>
							<input class="admin-input" type="password" autocomplete="new-password" bind:value={form.password} disabled={formSubmitting} />
							<span class="form-hint">{pageContents.formModal.passwordHint[lang]}</span>
						</label>
					</div>
					{#if editingId}
						<label class="form-check">
							<input type="checkbox" bind:checked={form.clearPassword} disabled={formSubmitting} />
							<span>{pageContents.formModal.clearPassword[lang]}</span>
						</label>
					{/if}
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

<!-- ── Modal xem ảnh chụp ── -->
{#if snapshotModalDisplay}
	<Modal bind:display={snapshotModalDisplay} size="lg" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>{pageContents.snapshotModal.title[lang]}</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="preview-wrap">
					<img class="preview-image" src={snapshotImage} alt="snapshot" />
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<Button color="primary" onClick={downloadSnapshot}>
					{pageContents.snapshotModal.download[lang]}
				</Button>
				<Button
					color="default"
					variant="ghost"
					onClick={() => {
						snapshotModalDisplay = false;
					}}
				>
					{pageContents.modals.cancel[lang]}
				</Button>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog xóa camera ── -->
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

	/* ── Grid camera ── */
	.camera-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}

	.camera-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
	}

	.camera-card-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.camera-card-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.camera-name {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.brand-badge {
		flex-shrink: 0;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 600;
		background: var(--default-200);
		color: var(--foreground-600);
	}

	.status-dot {
		flex-shrink: 0;
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 999px;
		background: var(--foreground-500);

		&.status-dot-online {
			background: var(--success);
			box-shadow: 0 0 0 3px var(--success-100, transparent);
		}

		&.status-dot-offline {
			background: var(--error);
			box-shadow: 0 0 0 3px var(--danger-100, transparent);
		}

		&.status-dot-unknown {
			background: var(--foreground-500);
		}
	}

	.camera-card-body {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin: 0;
	}

	.camera-meta {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}

	.meta-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		color: var(--foreground-500);
	}

	.meta-value {
		font-size: 0.88rem;
		color: var(--foreground);
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.camera-status-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.password-flag {
		font-size: 0.75rem;
		color: var(--foreground-500);

		&.has-password {
			color: var(--success-700, var(--success));
		}
	}

	.camera-test-message {
		margin: 0;
		font-size: 0.8rem;
		color: var(--foreground-500);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.camera-card-actions {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		margin-top: auto;
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

		&.status-default {
			background: var(--default-200);
			color: var(--foreground-600);
		}
	}

	/* ── Preview ── */
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

	.page-info {
		font-size: 0.85rem;
		color: var(--foreground);
		min-width: 6rem;
		text-align: center;
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

	.brand-note {
		background: var(--warning-100, var(--default-200));
		color: var(--warning-700, var(--foreground-600));
		border-left: 3px solid var(--warning, var(--foreground-600));
		border-radius: 0.5rem;
		padding: 0.6rem 0.85rem;
		font-size: 0.82rem;
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

	.form-grid-3 {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: 2fr 1fr 1fr;

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
		font-weight: 400;
	}

	.form-check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--foreground);
	}
</style>
