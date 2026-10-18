<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, DataTable } from '$components/element';
	import type { DataTableColumn, DataTableStatus } from '$components/element/datatable';
	import { Modal } from '$components/modal';
	import { AlertDialog } from '$lib/components/element/alert-dialog';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { formatDateTime, formatNumber, getLang } from '$modules/i18n';
	import { resolveServerMessage } from '../_interface';

	type ChannelAccountStatus = 'connected' | 'disconnected' | 'error' | 'pending';
	type ChannelOrderStatus = 'pending_import' | 'imported' | 'failed' | 'cancelled';

	type ChannelAccount = {
		documentKey: string;
		channel: string;
		name: string;
		status: ChannelAccountStatus;
		shopId: string | null;
		lastSyncAt: string | null;
		syncCursor: string | null;
		config: Record<string, unknown>;
		lastError: string | null;
		hasCredentials: boolean;
		createdAt: string | null;
		updatedAt: string | null;
	};

	type ChannelFieldDef = {
		key: string;
		label: { vi: string; en: string };
		inputType: 'text' | 'password' | 'number' | 'select' | 'checkbox';
		options?: { value: string; label: string }[];
		placeholder?: string;
		required?: boolean;
	};

	type ChannelMeta = {
		channel: string;
		label: { vi: string; en: string };
		credentialFields: ChannelFieldDef[];
		configFields: ChannelFieldDef[];
	};

	type ChannelOrderItem = {
		variantId: string | null;
		channelSku: string;
		name: string;
		quantity: number;
		unitPrice: number;
	};

	type ChannelOrder = {
		documentKey: string;
		channel: string;
		channelOrderId: string;
		channelAccountId: string;
		orderId: string | null;
		status: ChannelOrderStatus;
		customerName: string | null;
		phone: string | null;
		address: string | null;
		items: ChannelOrderItem[];
		totalAmount: number;
		currency: string;
		shippingFee: number;
		importError: string | null;
		receivedAt: string | null;
		importedAt: string | null;
		createdAt: string | null;
	};

	const pageContents = {
		vi: {
			title: 'Kênh bán',
			subtitle: 'Kết nối và đồng bộ đơn hàng từ các sàn thương mại điện tử và mạng xã hội',
			accountsSection: 'Tài khoản kênh',
			accountsEmpty: 'Chưa có kênh nào được kết nối',
			accountsLoading: 'Đang tải danh sách kênh...',
			ordersSection: 'Đơn hàng từ kênh',
			ordersEmpty: 'Chưa có đơn hàng nào từ kênh',
			ordersLoading: 'Đang tải đơn hàng...',
			connectBtn: 'Kết nối kênh mới',
			createAccount: 'Kết nối kênh',
			channelLabel: 'Kênh',
			nameLabel: 'Tên tài khoản',
			nameRequired: 'Vui lòng nhập tên tài khoản',
			shopIdLabel: 'ID cửa hàng (tuỳ chọn)',
			credentialsSection: 'Thông tin đăng nhập API',
			configSection: 'Cấu hình thêm',
			cancel: 'Đóng',
			save: 'Lưu',
			delete: 'Xóa',
			deleteTitle: 'Xóa tài khoản kênh?',
			deleteDescription:
				'Hành động này không thể hoàn tác. Tài khoản kênh sẽ bị xóa vĩnh viễn.',
			deleteKeep: 'Giữ lại',
			sync: 'Đồng bộ',
			testConnection: 'Kiểm tra',
			edit: 'Sửa',
			importBtn: 'Nhập đơn',
			connected: 'Đã kết nối',
			disconnected: 'Mất kết nối',
			errorStatus: 'Lỗi',
			pending: 'Chờ kết nối',
			pending_import: 'Chờ nhập',
			imported: 'Đã nhập',
			failed: 'Lỗi',
			cancelled: 'Đã huỷ',
			lastSync: 'Đồng bộ lần cuối',
			never: 'Chưa bao giờ',
			status: 'Trạng thái',
			customer: 'Khách hàng',
			phone: 'SĐT',
			total: 'Tổng tiền',
			channelOrder: 'Mã đơn kênh',
			quantity: 'SL',
			placedAt: 'Nhận lúc',
			actions: 'Thao tác',
			searchOrders: 'Tìm đơn theo mã/khách/SĐT...',
			searchAccounts: 'Tìm kênh theo tên...',
			ordersCaption: 'Danh sách đơn hàng đồng bộ từ các kênh bán',
			loading: 'Đang tải...',
			selectChannelFirst: 'Chọn kênh trước',
			credentialsHint: 'Thông tin đăng nhập được mã hoá (AES-GCM) trước khi lưu.',
			importConfirmTitle: 'Nhập đơn kênh vào hệ thống?',
			importConfirmDescription:
				'Đơn sẽ được tạo trong danh sách đơn hàng nội bộ với trạng thái chờ xử lí. Không trừ tồn kho cho đến khi đơn được xử lí.',
			importCancel: 'Để sau',
			importOk: 'Nhập đơn',
			noCredentials: 'Chưa có thông tin đăng nhập',
			allStatuses: 'Tất cả',
			updatedToast: 'Đã cập nhật kênh',
			createdToast: 'Đã kết nối kênh',
			deletedToast: 'Đã xóa kênh',
			deleteFailed: 'Xóa kênh thất bại',
			saveFailed: 'Lưu kênh thất bại',
			importFailed: 'Nhập đơn thất bại',
			importSuccess: 'Đã nhập đơn',
			syncFailed: 'Đồng bộ thất bại',
			syncSuccess: 'Đồng bộ xong',
			duplicates: 'trùng',
			testOk: 'Kết nối thành công',
			testFailed: 'Kết nối thất bại',
			loadAccountsFailed: 'Không tải được danh sách kênh',
			loadOrdersFailed: 'Không tải được đơn hàng từ kênh',
			new: 'mới'
		},
		en: {
			title: 'Sales channels',
			subtitle: 'Connect and sync orders from e-commerce platforms and social networks',
			accountsSection: 'Channel accounts',
			accountsEmpty: 'No channel connected yet',
			accountsLoading: 'Loading channels...',
			ordersSection: 'Orders from channels',
			ordersEmpty: 'No orders from channels yet',
			ordersLoading: 'Loading orders...',
			connectBtn: 'Connect new channel',
			createAccount: 'Connect channel',
			channelLabel: 'Channel',
			nameLabel: 'Account name',
			nameRequired: 'Please enter an account name',
			shopIdLabel: 'Shop ID (optional)',
			credentialsSection: 'API credentials',
			configSection: 'Additional configuration',
			cancel: 'Close',
			save: 'Save',
			delete: 'Delete',
			deleteTitle: 'Delete channel account?',
			deleteDescription:
				'This action cannot be undone. The channel account will be permanently deleted.',
			deleteKeep: 'Keep',
			sync: 'Sync',
			testConnection: 'Test',
			edit: 'Edit',
			importBtn: 'Import',
			connected: 'Connected',
			disconnected: 'Disconnected',
			errorStatus: 'Error',
			pending: 'Pending',
			pending_import: 'Pending import',
			imported: 'Imported',
			failed: 'Failed',
			cancelled: 'Cancelled',
			lastSync: 'Last sync',
			never: 'Never',
			status: 'Status',
			customer: 'Customer',
			phone: 'Phone',
			total: 'Total',
			channelOrder: 'Channel order ID',
			quantity: 'Qty',
			placedAt: 'Received',
			actions: 'Actions',
			searchOrders: 'Search by ID/customer/phone...',
			searchAccounts: 'Search channel by name...',
			ordersCaption: 'Orders synced from sales channels',
			loading: 'Loading...',
			selectChannelFirst: 'Select a channel first',
			credentialsHint: 'Credentials are encrypted (AES-GCM) before storing.',
			importConfirmTitle: 'Import channel order into system?',
			importConfirmDescription:
				'An internal order will be created with pending status. Stock is not deducted until the order is processed.',
			importCancel: 'Later',
			importOk: 'Import',
			noCredentials: 'No credentials yet',
			allStatuses: 'All',
			updatedToast: 'Channel updated',
			createdToast: 'Channel connected',
			deletedToast: 'Channel deleted',
			deleteFailed: 'Failed to delete channel',
			saveFailed: 'Failed to save channel',
			importFailed: 'Failed to import order',
			importSuccess: 'Imported order',
			syncFailed: 'Sync failed',
			syncSuccess: 'Sync done',
			duplicates: 'duplicates',
			testOk: 'Connection OK',
			testFailed: 'Connection failed',
			loadAccountsFailed: 'Failed to load channels',
			loadOrdersFailed: 'Failed to load channel orders',
			new: 'new'
		}
	} as const;
	type PageKey = keyof typeof pageContents.vi;

	const t = (key: PageKey) => pageContents[lang][key];

	const channelIcons: Record<string, { icon: string; color: string }> = {
		shopee: { icon: 'simple-icons:shopee', color: '#ee4d2d' },
		tiktok_shop: { icon: 'simple-icons:tiktok', color: '#000000' },
		facebook: { icon: 'simple-icons:facebook', color: '#1877f2' },
		lazada: { icon: 'simple-icons:lazada', color: '#0f146d' },
		threads: { icon: 'simple-icons:threads', color: '#000000' },
		instagram: { icon: 'simple-icons:instagram', color: '#e1306c' },
		telegram: { icon: 'simple-icons:telegram', color: '#26a5e4' },
		discord: { icon: 'simple-icons:discord', color: '#5865f2' },
		google: { icon: 'simple-icons:google', color: '#4285f4' }
	};

	const accountStatusBadge: Record<string, string> = {
		connected: 'success',
		disconnected: 'muted',
		error: 'error',
		pending: 'warning'
	};
	const accountStatusColumn: Record<string, DataTableStatus> = {
		connected: 'success',
		disconnected: 'default',
		error: 'danger',
		pending: 'warning'
	};
	const orderStatusColumn: Record<string, DataTableStatus> = {
		pending_import: 'warning',
		imported: 'success',
		failed: 'danger',
		cancelled: 'default'
	};

	const accountStatusLabel = (status: ChannelAccountStatus): PageKey =>
		({
			connected: 'connected',
			disconnected: 'disconnected',
			error: 'errorStatus',
			pending: 'pending'
		})[status] as PageKey;
	const orderStatusLabel = (status: ChannelOrderStatus): PageKey =>
		({
			pending_import: 'pending_import',
			imported: 'imported',
			failed: 'failed',
			cancelled: 'cancelled'
		})[status] as PageKey;

	// i18n: lang theo prefs (client.browser.language) — reactive, đổi ngay khi
	// user switch ngôn ngữ (trước đây $state set 1 lần trong onMount → không đổi).
	const lang = $derived(getLang());
	let encryptionKeys: { publicKey: CryptoKey; privateKey: CryptoKey } | null = null;

	let accounts = $state<ChannelAccount[]>([]);
	let channelMeta = $state<ChannelMeta[]>([]);
	let orders = $state<ChannelOrder[]>([]);
	let isLoadingAccounts = $state(true);
	let isLoadingOrders = $state(true);
	let errorAccounts = $state('');
	let errorOrders = $state('');

	let searchAccounts = $state('');
	let searchOrders = $state('');
	let statusFilter = $state('');

	let connectModalDisplay = $state(false);
	let editingKey: string | null = $state(null);
	let connectForm = $state<{
		channel: string;
		name: string;
		shopId: string;
		credentials: Record<string, string>;
		config: Record<string, string | boolean>;
	}>({ channel: '', name: '', shopId: '', credentials: {}, config: {} });

	let deleteDialogOpen = $state(false);
	let deleteTarget: ChannelAccount | null = $state(null);
	let deleteBusy = $state(false);

	let importDialogOpen = $state(false);
	let importTarget: ChannelOrder | null = $state(null);
	let importBusy = $state(false);

	const showToast = (title: string, color: 'success' | 'error') => {
		if (!client.browser) client.browser = {};
		client.browser.toasts?.create?.({ title, color });
	};

	const accountsAny = $derived(accounts as unknown as Record<string, unknown>[]);
	const ordersAny = $derived(orders as unknown as Record<string, unknown>[]);
	const activeMeta = $derived(channelMeta.find((m) => m.channel === connectForm.channel) ?? null);

	const accountColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'channel',
			label: t('channelLabel'),
			sortable: true,
			accessor: (row) => String(row.channel ?? '')
		},
		{
			id: 'name',
			label: t('nameLabel'),
			sortable: true,
			accessor: (row) => String(row.name ?? '')
		},
		{
			id: 'status',
			label: t('status'),
			sortable: true,
			accessor: (row) => t(accountStatusLabel(String(row.status) as ChannelAccountStatus)),
			status: (_v, row) => accountStatusColumn[String(row.status)] ?? 'muted',
			noHighlight: true
		},
		{
			id: 'lastSyncAt',
			label: t('lastSync'),
			sortable: true,
			accessor: (row) =>
				row.lastSyncAt ? formatDateTime(String(row.lastSyncAt), lang) : t('never')
		}
	]);

	const orderColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'channel',
			label: t('channelLabel'),
			sortable: true,
			accessor: (row) => String(row.channel ?? '')
		},
		{
			id: 'channelOrderId',
			label: t('channelOrder'),
			sortable: true,
			accessor: (row) => String(row.channelOrderId ?? '')
		},
		{
			id: 'customerName',
			label: t('customer'),
			sortable: true,
			accessor: (row) => String(row.customerName ?? '—')
		},
		{
			id: 'phone',
			label: t('phone'),
			sortable: false,
			accessor: (row) => String(row.phone ?? '—')
		},
		{
			id: 'items',
			label: t('quantity'),
			sortable: false,
			accessor: (row) => {
				const items = (row.items as { quantity?: number }[]) ?? [];
				return items.reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
			}
		},
		{
			id: 'totalAmount',
			label: t('total'),
			sortable: true,
			accessor: (row) => `${formatNumber(Number(row.totalAmount ?? 0), lang)} ${String(row.currency ?? 'VND')}`
		},
		{
			id: 'status',
			label: t('status'),
			sortable: true,
			accessor: (row) => t(orderStatusLabel(String(row.status) as ChannelOrderStatus)),
			status: (_v, row) => orderStatusColumn[String(row.status)] ?? 'muted',
			noHighlight: true
		},
		{
			id: 'receivedAt',
			label: t('placedAt'),
			sortable: true,
			accessor: (row) => (row.receivedAt ? formatDateTime(String(row.receivedAt), lang) : '—')
		}
	]);

	async function loadMeta() {
		if (!encryptionKeys) return;
		const response = await encryption.fetchSecure(
			'/api/admin/channels/channels-metadata',
			{ method: 'POST', body: {} },
			encryptionKeys
		);
		if (response.ok && response.data?.channels) {
			channelMeta = response.data.channels as ChannelMeta[];
		}
	}

	async function loadAccounts() {
		if (!encryptionKeys) return;
		isLoadingAccounts = true;
		errorAccounts = '';
		const response = await encryption.fetchSecure(
			'/api/admin/channels/accounts-list',
			{ method: 'POST', body: { search: searchAccounts || undefined } },
			encryptionKeys
		);
		if (response.ok && response.data?.accounts) {
			accounts = response.data.accounts as ChannelAccount[];
		} else {
			errorAccounts = resolveServerMessage(response.message, lang, {
				vi: pageContents.vi.loadAccountsFailed,
				en: pageContents.en.loadAccountsFailed
			});
		}
		isLoadingAccounts = false;
	}

	async function loadOrders() {
		if (!encryptionKeys) return;
		isLoadingOrders = true;
		errorOrders = '';
		const response = await encryption.fetchSecure(
			'/api/admin/channels/orders-list',
			{
				method: 'POST',
				body: {
					search: searchOrders || undefined,
					status: statusFilter || undefined,
					page: 1,
					pageSize: 50
				}
			},
			encryptionKeys
		);
		if (response.ok && response.data?.orders) {
			orders = response.data.orders as ChannelOrder[];
		} else {
			errorOrders = resolveServerMessage(response.message, lang, {
				vi: pageContents.vi.loadOrdersFailed,
				en: pageContents.en.loadOrdersFailed
			});
		}
		isLoadingOrders = false;
	}

	function openCreateModal() {
		editingKey = null;
		connectForm = {
			channel: channelMeta[0]?.channel ?? '',
			name: '',
			shopId: '',
			credentials: {},
			config: {}
		};
		connectModalDisplay = true;
	}

	function openEditModal(acc: ChannelAccount) {
		editingKey = acc.documentKey;
		connectForm = {
			channel: acc.channel,
			name: acc.name,
			shopId: acc.shopId ?? '',
			credentials: {},
			config: Object.fromEntries(
				Object.entries(acc.config ?? {}).map(([k, v]) => [k, v == null ? '' : (v as string | boolean)])
			)
		};
		connectModalDisplay = true;
	}

	function selectEditChannel(channel: string) {
		connectForm.channel = channel;
		connectForm.credentials = {};
		connectForm.config = {};
	}

	async function submitConnect() {
		if (!encryptionKeys) return;
		if (!connectForm.channel) {
			showToast(t('selectChannelFirst'), 'error');
			return;
		}
		if (!connectForm.name.trim()) {
			showToast(t('nameRequired'), 'error');
			return;
		}
		const nonEmptyCredentials = Object.fromEntries(
			Object.entries(connectForm.credentials).filter(([, v]) => v !== '')
		);
		const payload: {
			channel: string;
			name: string;
			shopId?: string;
			config?: Record<string, string | boolean>;
			credentials?: Record<string, string>;
			documentKey?: string;
		} = {
			channel: connectForm.channel,
			name: connectForm.name.trim(),
			shopId: connectForm.shopId.trim() || undefined,
			config: connectForm.config
		};
		if (Object.keys(nonEmptyCredentials).length > 0) payload.credentials = nonEmptyCredentials;
		if (editingKey) payload.documentKey = editingKey;

		const response = await encryption.fetchSecure(
			editingKey ? '/api/admin/channels/accounts-update' : '/api/admin/channels/accounts-create',
			{ method: 'POST', body: payload },
			encryptionKeys
		);
		if (response.ok) {
			showToast(editingKey ? t('updatedToast') : t('createdToast'), 'success');
			connectModalDisplay = false;
			await loadAccounts();
		} else {
			showToast(
				resolveServerMessage(response.message, lang, {
					vi: pageContents.vi.saveFailed,
					en: pageContents.en.saveFailed
				}),
				'error'
			);
		}
	}

	async function submitDelete() {
		if (!encryptionKeys || !deleteTarget || deleteBusy) return;
		deleteBusy = true;
		const target = deleteTarget;
		const response = await encryption.fetchSecure(
			'/api/admin/channels/accounts-delete',
			{ method: 'POST', body: { documentKey: target.documentKey } },
			encryptionKeys
		);
		deleteBusy = false;
		deleteDialogOpen = false;
		deleteTarget = null;
		if (response.ok) {
			showToast(t('deletedToast'), 'success');
			await loadAccounts();
		} else {
			showToast(
				resolveServerMessage(response.message, lang, {
					vi: pageContents.vi.deleteFailed,
					en: pageContents.en.deleteFailed
				}),
				'error'
			);
		}
	}

	async function submitImport() {
		if (!encryptionKeys || !importTarget || importBusy) return;
		importBusy = true;
		const target = importTarget;
		const response = await encryption.fetchSecure(
			'/api/admin/channels/orders-import',
			{ method: 'POST', body: { documentKey: target.documentKey } },
			encryptionKeys
		);
		importBusy = false;
		if (response.ok) {
			const code = (response.data?.orderCode as string) ?? '';
			const unmatched = (response.data?.unmatchedSkus as string[]) ?? [];
			showToast(
				unmatched.length > 0
					? `${t('importSuccess')} ${code} — SKU: ${unmatched.join(', ')}`
					: `${t('importSuccess')} ${code}`,
				unmatched.length > 0 ? 'error' : 'success'
			);
			importDialogOpen = false;
			importTarget = null;
			await loadOrders();
		} else {
			showToast(
				resolveServerMessage(response.message, lang, {
					vi: pageContents.vi.importFailed,
					en: pageContents.en.importFailed
				}),
				'error'
			);
		}
	}

	async function syncAccount(acc: ChannelAccount) {
		if (!encryptionKeys) return;
		const response = await encryption.fetchSecure(
			'/api/admin/channels/sync',
			{ method: 'POST', body: { documentKey: acc.documentKey } },
			encryptionKeys
		);
		if (response.ok) {
			const d = response.data ?? { inserted: 0, skipped: 0 };
			showToast(
				lang === 'vi'
					? `${t('syncSuccess')}: ${d.inserted ?? 0} ${t('new')}, ${d.skipped ?? 0} ${t('duplicates')}`
					: `${t('syncSuccess')}: ${d.inserted ?? 0} new, ${d.skipped ?? 0} duplicates`,
				'success'
			);
			await Promise.all([loadAccounts(), loadOrders()]);
		} else {
			showToast(
				resolveServerMessage(response.message, lang, {
					vi: pageContents.vi.syncFailed,
					en: pageContents.en.syncFailed
				}),
				'error'
			);
		}
	}

	async function testConnection(acc: ChannelAccount) {
		if (!encryptionKeys) return;
		const response = await encryption.fetchSecure(
			'/api/admin/channels/test-connection',
			{ method: 'POST', body: { documentKey: acc.documentKey } },
			encryptionKeys
		);
		if (response.ok && response.data?.ok) {
			showToast(t('testOk'), 'success');
		} else {
			showToast(
				resolveServerMessage(response.message, lang, {
					vi: pageContents.vi.testFailed,
					en: pageContents.en.testFailed
				}),
				'error'
			);
		}
		await loadAccounts();
	}

	function openDeleteDialog(acc: ChannelAccount) {
		deleteTarget = acc;
		deleteDialogOpen = true;
	}

	function openImportDialog(order: ChannelOrder) {
		importTarget = order;
		importDialogOpen = true;
	}

	onMount(() => {
		if (!client.browser) client.browser = {};
		(async () => {
			const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
			encryptionKeys = { privateKey, publicKey };
			await loadMeta();
			await loadAccounts();
			await loadOrders();
		})();
	});
</script>

<svelte:head>
	<title>{t('title')} — Admin</title>
</svelte:head>

<section class="admin-page" data-test="admin-channels-page">
	<header class="admin-header">
		<div>
			<h1 class="admin-title">{t('title')}</h1>
			<p class="admin-subtitle">{t('subtitle')}</p>
		</div>
		<div class="admin-header-actions">
			<Button color="success" onClick={openCreateModal} data-test="channels-connect-btn">
				{t('connectBtn')}
			</Button>
		</div>
	</header>

	<!-- ===== Khu 1: tài khoản kênh ===== -->
	<div class="section-head">
		<h2>{t('accountsSection')}</h2>
		<input
			class="admin-input search-input"
			type="text"
			placeholder={t('searchAccounts')}
			bind:value={searchAccounts}
			onchange={loadAccounts}
			data-test="channels-search-input"
		/>
	</div>

	{#if isLoadingAccounts}
		<div class="admin-state" role="status"><p>{t('accountsLoading')}</p></div>
	{:else if errorAccounts}
		<div class="admin-state admin-state--error" role="alert"><p>{errorAccounts}</p></div>
	{:else if accounts.length === 0}
		<div class="admin-state"><p>{t('accountsEmpty')}</p></div>
	{:else}
		<div class="accounts-grid" data-test="channels-accounts-grid">
			{#each accounts as acc (acc.documentKey)}
				{@const meta = channelMeta.find((m) => m.channel === acc.channel)}
				<div class="account-card" data-test="channels-account-card">
					<div class="account-card-top">
						<span
							class="platform-icon"
							style:background={channelIcons[acc.channel]?.color ?? '#64748b'}
						>
							<i class="iconify" data-icon={channelIcons[acc.channel]?.icon ?? 'lucide:shopping-bag'}></i>
						</span>
						<div class="account-card-info">
							<div class="account-card-name">{acc.name}</div>
							<div class="account-card-sub">{meta?.label[lang] ?? acc.channel}</div>
						</div>
						<span class="status-badge status-badge--{accountStatusBadge[acc.status] ?? 'muted'}">
							{t(accountStatusLabel(acc.status))}
						</span>
					</div>
					<div class="account-card-meta">
						<span>
							{t('lastSync')}:
							{acc.lastSyncAt ? formatDateTime(acc.lastSyncAt, lang) : t('never')}
						</span>
						{#if acc.lastError}<span class="account-card-error">{acc.lastError}</span>{/if}
						{#if !acc.hasCredentials}<span>{t('noCredentials')}</span>{/if}
					</div>
					<div class="account-card-actions">
						<Button
							size="sm"
							color="primary"
							variant="outline"
							onClick={() => syncAccount(acc)}
							data-test="channels-sync-btn">{t('sync')}</Button
						>
						<Button
							size="sm"
							color="primary"
							variant="ghost"
							onClick={() => testConnection(acc)}
							data-test="channels-test-btn">{t('testConnection')}</Button
						>
						<Button
							size="sm"
							color="primary"
							variant="ghost"
							onClick={() => openEditModal(acc)}
							data-test="channels-edit-btn">{t('edit')}</Button
						>
						<Button
							size="sm"
							color="error"
							variant="ghost"
							onClick={() => openDeleteDialog(acc)}
							data-test="channels-delete-btn">{t('delete')}</Button
						>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ===== Khu 2: đơn hàng từ kênh ===== -->
	<div class="section-head">
		<h2>{t('ordersSection')}</h2>
		<div class="orders-filter">
			<input
				class="admin-input"
				type="text"
				placeholder={t('searchOrders')}
				bind:value={searchOrders}
				onchange={loadOrders}
				data-test="channels-orders-search"
			/>
			<select
				class="admin-select"
				bind:value={statusFilter}
				onchange={loadOrders}
				data-test="channels-orders-status-filter"
			>
				<option value="">{t('status')}: {t('allStatuses')}</option>
				<option value="pending_import">{t('pending_import')}</option>
				<option value="imported">{t('imported')}</option>
				<option value="failed">{t('failed')}</option>
				<option value="cancelled">{t('cancelled')}</option>
			</select>
		</div>
	</div>

	{#if isLoadingOrders}
		<div class="admin-state" role="status"><p>{t('ordersLoading')}</p></div>
	{:else if errorOrders}
		<div class="admin-state admin-state--error" role="alert"><p>{errorOrders}</p></div>
	{:else}
		<div class="admin-table-wrap">
			<DataTable
				data={ordersAny}
				columns={orderColumns}
				pageSize={orders.length || 10}
				showPagination={false}
				sortable
				searchable={false}
				resizable={{ enabled: true, fit: true }}
				loading={isLoadingOrders}
				visual={{ striped: true, hoverable: true }}
				emptyLabel={t('ordersEmpty')}
				loadingLabel={t('loading')}
				caption={{ vi: pageContents.vi.ordersCaption, en: pageContents.en.ordersCaption }}
				actionsLabel={{ vi: pageContents.vi.actions, en: pageContents.en.actions }}
				stickyHead
				data-test="channels-orders-table"
			>
				{#snippet actionsContent(row)}
					{@const order = row as unknown as ChannelOrder}
					<div class="row-actions">
						{#if order.status === 'pending_import'}
							<Button
								size="sm"
								color="success"
								onClick={() => openImportDialog(order)}
								data-test="channels-import-btn">{t('importBtn')}</Button
							>
						{:else if order.orderId}
							<span class="imported-order-code">{order.orderId}</span>
						{/if}
					</div>
				{/snippet}
			</DataTable>
		</div>
	{/if}
</section>

<!-- ===== Modal kết nối / sửa kênh ===== -->
{#if connectModalDisplay}
	<Modal bind:display={connectModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>{editingKey ? t('edit') : t('createAccount')}</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="form-grid">
					{#if !editingKey}
						<div class="form-field form-field--full">
							<label class="form-label" for="connect-channel">{t('channelLabel')}</label>
							<select
								class="admin-select"
								id="connect-channel"
								bind:value={connectForm.channel}
								onchange={(e) => selectEditChannel(e.currentTarget.value)}
								data-test="channels-form-channel"
							>
								{#each channelMeta as m (m.channel)}
									<option value={m.channel}>{m.label[lang]}</option>
								{/each}
							</select>
						</div>
					{/if}
					<div class="form-field">
						<label class="form-label" for="connect-name">{t('nameLabel')}</label>
						<input
							class="admin-input"
							id="connect-name"
							bind:value={connectForm.name}
							data-test="channels-form-name"
						/>
					</div>
					<div class="form-field">
						<label class="form-label" for="connect-shopid">{t('shopIdLabel')}</label>
						<input
							class="admin-input"
							id="connect-shopid"
							bind:value={connectForm.shopId}
							data-test="channels-form-shopid"
						/>
					</div>

					{#if activeMeta}
						{#if activeMeta.credentialFields.length > 0}
							<div class="form-field form-field--full">
								<h4 class="form-section-title">{t('credentialsSection')}</h4>
								<p class="form-hint">{t('credentialsHint')}</p>
							</div>
							{#each activeMeta.credentialFields as f (f.key)}
								<div class="form-field">
									<label class="form-label" for="cred-{f.key}">{f.label[lang]}</label>
									{#if f.inputType === 'select'}
										<select
											class="admin-select"
											id="cred-{f.key}"
											bind:value={connectForm.credentials[f.key]}
										>
											{#each f.options ?? [] as opt (opt.value)}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									{:else}
										<input
											class="admin-input"
											id="cred-{f.key}"
											type={f.inputType === 'password'
												? 'password'
												: f.inputType === 'number'
													? 'number'
													: 'text'}
											placeholder={f.placeholder ?? ''}
											bind:value={connectForm.credentials[f.key]}
											data-test="channels-form-credential"
										/>
									{/if}
								</div>
							{/each}
						{/if}
						{#if activeMeta.configFields.length > 0}
							<div class="form-field form-field--full">
								<h4 class="form-section-title">{t('configSection')}</h4>
							</div>
							{#each activeMeta.configFields as f (f.key)}
								<div class="form-field">
									{#if f.inputType === 'checkbox'}
										<label class="checkbox-label">
											<input
												type="checkbox"
												checked={Boolean(connectForm.config[f.key])}
												onchange={(e) =>
													(connectForm.config[f.key] = e.currentTarget.checked)}
											/>
											{f.label[lang]}
										</label>
									{:else}
										<label class="form-label" for="cfg-{f.key}">{f.label[lang]}</label>
										{#if f.inputType === 'select'}
											<select
												class="admin-select"
												id="cfg-{f.key}"
												bind:value={connectForm.config[f.key] as string}
											>
												{#each f.options ?? [] as opt (opt.value)}
													<option value={opt.value}>{opt.label}</option>
												{/each}
											</select>
										{:else}
											<input
												class="admin-input"
												id="cfg-{f.key}"
												type={f.inputType === 'number' ? 'number' : 'text'}
												placeholder={f.placeholder ?? ''}
												bind:value={connectForm.config[f.key] as string}
												data-test="channels-form-config"
											/>
										{/if}
									{/if}
								</div>
							{/each}
						{/if}
					{/if}
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-actions">
					<Button variant="ghost" onClick={() => { connectModalDisplay = false; }}>{t('cancel')}</Button>
					<Button color="success" onClick={submitConnect} data-test="channels-form-submit">
						{t('save')}
					</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ===== AlertDialog xóa kênh ===== -->
<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{t('deleteTitle')}</AlertDialog.Title>
			<AlertDialog.Description>{t('deleteDescription')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{t('deleteKeep')}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={submitDelete}>{t('delete')}</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

<!-- ===== AlertDialog import đơn ===== -->
<AlertDialog bind:open={importDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="info">
			<AlertDialog.Title>{t('importConfirmTitle')}</AlertDialog.Title>
			<AlertDialog.Description>
				{t('importConfirmDescription')}
				{#if importTarget && importTarget.items.length > 0}
					<ul class="import-items-preview">
						{#each importTarget.items as it, idx (idx)}
							<li>{it.name} × {it.quantity}</li>
						{/each}
					</ul>
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{t('importCancel')}</AlertDialog.Cancel>
			<AlertDialog.Action color="primary" onclick={submitImport}>{t('importOk')}</AlertDialog.Action>
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
	.admin-header-actions {
		display: flex;
		gap: 0.5rem;
	}
	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		h2 {
			font-size: 1.125rem;
			font-weight: 600;
			color: var(--foreground);
			margin: 0;
		}
	}
	.search-input {
		max-width: 240px;
	}
	.orders-filter {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.accounts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.875rem;
	}
	.account-card {
		border: 1px solid var(--default-300);
		border-radius: 0.625rem;
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		background: var(--background);
	}
	.account-card-top {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}
	.platform-icon {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		flex-shrink: 0;
		.iconify {
			font-size: 1.125rem;
		}
	}
	.account-card-info {
		flex: 1;
		min-width: 0;
	}
	.account-card-name {
		font-weight: 500;
		color: var(--foreground);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.account-card-sub {
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}
	.account-card-meta {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}
	.account-card-error {
		color: var(--error);
	}
	.account-card-actions {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.status-badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
		&--success {
			background: color-mix(in srgb, var(--success) 15%, transparent);
			color: var(--success);
		}
		&--warning {
			background: color-mix(in srgb, #f59e0b 15%, transparent);
			color: #f59e0b;
		}
		&--error {
			background: color-mix(in srgb, var(--error) 15%, transparent);
			color: var(--error);
		}
		&--muted {
			background: var(--default-200);
			color: var(--muted-foreground);
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
		/* Sticky thead: wrap overflow-x auto tao scroll context - th sticky bam
		   theo wrap (khong cuon) -> thead truot mat. Co stickyHead: wrap phai
		   thoat scroll context (beng ngang do .datatable-table-wrap tu cuon). */
		&:has(:global(.datatable-sticky-head)) {
			overflow-x: visible;
		}
	}
	.row-actions {
		display: flex;
		gap: 0.375rem;
		width: 1%;
		min-width: fit-content;
	}
	.imported-order-code {
		font-size: 0.75rem;
		color: var(--muted-foreground);
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
	.form-section-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--primary);
		margin: 0;
	}
	.form-hint {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		margin: 0;
	}
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: var(--foreground);
	}
	.import-items-preview {
		margin: 0.5rem 0 0;
		padding-left: 1.25rem;
		font-size: 0.8125rem;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		width: 100%;
	}
</style>
