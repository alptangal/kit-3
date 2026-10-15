<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, DataTable } from '$components/element';
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
			title: 'Social media',
			subtitle: 'Quản lý tài khoản mạng xã hội và bài đăng',
			accountsTitle: 'Tài khoản',
			postsTitle: 'Bài đăng',
			connect: 'Kết nối',
			editAcc: 'Sửa',
			disconnect: 'Ngắt kết nối',
			delete: 'Xóa',
			compose: 'Soạn bài',
			editPost: 'Sửa bài',
			save: 'Lưu',
			close: 'Đóng',
			confirmDeleteAcc: 'Ngắt kết nối tài khoản',
			confirmDeleteAccDesc: 'Token lưu trữ sẽ bị xóa. Bạn có thể kết nối lại bất cứ lúc nào.',
			confirmDeletePost: 'Xóa bài đăng',
			confirmDeletePostDesc: 'Bạn có chắc muốn xóa bài đăng này? Hành động không thể hoàn tác.',
			cancelConfirm: 'Giữ lại',
			confirmBtn: 'Xóa',
			colPlatform: 'Nền tảng',
			colContent: 'Nội dung',
			colStatus: 'Trạng thái',
			colScheduled: 'Lên lịch',
			colPublished: 'Đã đăng',
			colPermalink: 'Liên kết',
			colActions: 'Thao tác',
			fieldPlatform: 'Nền tảng *',
			fieldAccountName: 'Tên tài khoản *',
			fieldHandle: 'Handle (@user)',
			fieldPageId: 'Page ID',
			fieldAccessToken: 'Access token (tùy chọn)',
			fieldContent: 'Nội dung *',
			fieldMediaUrls: 'Media URLs (mỗi dòng 1 URL)',
			fieldSchedule: 'Lên lịch (tùy chọn)',
			emptyAccounts: 'Chưa kết nối tài khoản nào',
			emptyPosts: 'Chưa có bài đăng nào',
			loading: 'Đang tải...',
			connected: 'Đã kết nối',
			disconnected: 'Chưa kết nối',
			errorState: 'Lỗi',
			lastSync: 'Đồng bộ: {date}',
			followers: '{count} người theo dõi',
			preview: 'Xem trước'
		},
		en: {
			title: 'Social media',
			subtitle: 'Manage social accounts and posts',
			accountsTitle: 'Accounts',
			postsTitle: 'Posts',
			connect: 'Connect',
			editAcc: 'Edit',
			disconnect: 'Disconnect',
			delete: 'Delete',
			compose: 'Compose',
			editPost: 'Edit post',
			save: 'Save',
			close: 'Close',
			confirmDeleteAcc: 'Disconnect account',
			confirmDeleteAccDesc: 'Stored token will be removed. You can reconnect anytime.',
			confirmDeletePost: 'Delete post',
			confirmDeletePostDesc: 'Are you sure you want to delete this post? This cannot be undone.',
			cancelConfirm: 'Keep it',
			confirmBtn: 'Delete',
			colPlatform: 'Platform',
			colContent: 'Content',
			colStatus: 'Status',
			colScheduled: 'Scheduled',
			colPublished: 'Published',
			colPermalink: 'Link',
			colActions: 'Actions',
			fieldPlatform: 'Platform *',
			fieldAccountName: 'Account name *',
			fieldHandle: 'Handle (@user)',
			fieldPageId: 'Page ID',
			fieldAccessToken: 'Access token (optional)',
			fieldContent: 'Content *',
			fieldMediaUrls: 'Media URLs (one per line)',
			fieldSchedule: 'Schedule (optional)',
			emptyAccounts: 'No accounts connected yet',
			emptyPosts: 'No posts yet',
			loading: 'Loading...',
			connected: 'Connected',
			disconnected: 'Disconnected',
			errorState: 'Error',
			lastSync: 'Synced: {date}',
			followers: '{count} followers',
			preview: 'Preview'
		}
	} as const;
	type PageLang = keyof typeof pageContents;
	const t = (key: keyof (typeof pageContents)['vi']) => pageContents[lang as PageLang][key];

	const toasts = {
		connected: { vi: 'Đã kết nối tài khoản', en: 'Account connected' },
		updatedAcc: { vi: 'Đã cập nhật tài khoản', en: 'Account updated' },
		disconnected: { vi: 'Đã ngắt kết nối', en: 'Account disconnected' },
		deletedAcc: { vi: 'Đã xóa tài khoản', en: 'Account deleted' },
		createdPost: { vi: 'Đã tạo bài đăng', en: 'Post created' },
		updatedPost: { vi: 'Đã cập nhật bài đăng', en: 'Post updated' },
		scheduled: { vi: 'Đã lên lịch bài đăng', en: 'Post scheduled' },
		published: { vi: 'Đã đăng bài (mock)', en: 'Post published (mock)' },
		cancelled: { vi: 'Đã hủy bài đăng', en: 'Post cancelled' },
		deletedPost: { vi: 'Đã xóa bài đăng', en: 'Post deleted' },
		loadFailed: { vi: 'Không thể tải dữ liệu', en: 'Failed to load data' },
		createFailed: { vi: 'Thao tác thất bại', en: 'Action failed' },
		requestFailed: { vi: 'Lỗi kết nối máy chủ', en: 'Server request failed' }
	} as const;

	// ---------- platform meta ----------
	const PLATFORMS = [
		'facebook',
		'instagram',
		'zalo',
		'tiktok',
		'youtube',
		'twitter_x',
		'linkedin'
	] as const;
	type SocialPlatform = (typeof PLATFORMS)[number];

	const platformLabels: Record<SocialPlatform, { vi: string; en: string }> = {
		facebook: { vi: 'Facebook', en: 'Facebook' },
		instagram: { vi: 'Instagram', en: 'Instagram' },
		zalo: { vi: 'Zalo', en: 'Zalo' },
		tiktok: { vi: 'TikTok', en: 'TikTok' },
		youtube: { vi: 'YouTube', en: 'YouTube' },
		twitter_x: { vi: 'Twitter (X)', en: 'Twitter (X)' },
		linkedin: { vi: 'LinkedIn', en: 'LinkedIn' }
	};
	const platformIcons: Record<SocialPlatform, string> = {
		facebook: 'lucide:facebook',
		instagram: 'lucide:instagram',
		zalo: 'lucide:phone',
		tiktok: 'lucide:text',
		youtube: 'lucide:youtube',
		twitter_x: 'lucide:twitter',
		linkedin: 'lucide:linkedin'
	};
	const platformBrand: Record<SocialPlatform, string> = {
		facebook: '#1877f2',
		instagram: '#e4405f',
		zalo: '#0068ff',
		tiktok: '#111827',
		youtube: '#ff0000',
		twitter_x: '#0f1419',
		linkedin: '#0a66c2'
	};

	const accStatusLabels: Record<string, { vi: string; en: string }> = {
		connected: { vi: 'Đã kết nối', en: 'Connected' },
		disconnected: { vi: 'Chưa kết nối', en: 'Disconnected' },
		error: { vi: 'Lỗi', en: 'Error' }
	};
	const accStatusClass: Record<string, string> = {
		connected: 'success',
		disconnected: 'muted',
		error: 'error'
	};

	const postStatusLabels: Record<string, { vi: string; en: string }> = {
		draft: { vi: 'Nháp', en: 'Draft' },
		scheduled: { vi: 'Đã lên lịch', en: 'Scheduled' },
		publishing: { vi: 'Đang đăng', en: 'Publishing' },
		published: { vi: 'Đã đăng', en: 'Published' },
		failed: { vi: 'Thất bại', en: 'Failed' },
		cancelled: { vi: 'Đã hủy', en: 'Cancelled' }
	};
	const postStatusClass: Record<string, string> = {
		draft: 'muted',
		scheduled: 'info',
		publishing: 'warning',
		published: 'success',
		failed: 'error',
		cancelled: 'muted'
	};

	// Map cho DataTableStatus ('default'|'success'|'warning'|'danger'|'info')
	function postStatusColor(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
		switch (postStatusClass[status]) {
			case 'success':
				return 'success';
			case 'info':
				return 'info';
			case 'warning':
				return 'warning';
			case 'error':
				// DataTableStatus không có 'error' — map sang 'danger'
				return 'danger';
			default:
				return 'default';
		}
	}

	// ---------- state ----------
	interface SocialAccountItem {
		_id: string;
		accountId: string;
		platform: string;
		accountName: string;
		handle?: string;
		pageId?: string;
		followersCount?: number;
		status: string;
		lastSyncAt?: string;
		createdAt: string;
		updatedAt: string;
	}

	interface SocialPostItem {
		_id: string;
		socialPostId: string;
		campaignId?: string;
		platform: string;
		content: string;
		mediaUrls?: string[];
		scheduledAt?: string;
		publishedAt?: string;
		status: string;
		error?: string;
		externalPostId?: string;
		permalink?: string;
		createdAt: string;
		updatedAt: string;
	}

	let accounts: SocialAccountItem[] = $state([]);
	let posts: SocialPostItem[] = $state([]);
	let isLoadingAccounts = $state(false);
	let isLoadingPosts = $state(false);
	let errorAccounts = $state('');
	let errorPosts = $state('');

	let connectModalDisplay = $state(false);
	let connectTargetPlatform = $state<string>('facebook');
	let connectEditTarget = $state<SocialAccountItem | null>(null);
	let connectForm = $state({ accountName: '', handle: '', pageId: '', accessToken: '' });

	let composeModalDisplay = $state(false);
	let composeTarget = $state<SocialPostItem | null>(null);
	let composeForm = $state({
		platform: 'facebook' as string,
		content: '',
		mediaUrls: '',
		scheduledAt: ''
	});

	let deleteAccDialogOpen = $state(false);
	let deleteAccTarget = $state<SocialAccountItem | null>(null);
	let deletePostDialogOpen = $state(false);
	let deletePostTarget = $state<SocialPostItem | null>(null);
	let deleteBusy = $state(false);

	// ---------- helpers ----------
	function showToast(title: string, color: 'success' | 'error' | 'warning' | 'info' | 'default') {
		if (client.browser?.toasts) {
			client.browser.toasts.create({ title, color });
		}
	}

	function fmtToast(tc: { vi: string; en: string }): string {
		return lang === 'en' ? tc.en : tc.vi;
	}

	function platformLabel(p: string): string {
		return platformLabels[p as SocialPlatform]?.[lang] ?? p;
	}

	function formatDate(value?: string): string {
		if (!value) return '—';
		try {
			return new Date(value).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
		} catch {
			return value;
		}
	}

	function fmtCount(value?: number): string {
		return (value ?? 0).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
	}

	// ---------- data ----------
	async function loadAccounts() {
		isLoadingAccounts = true;
		errorAccounts = '';
		try {
			if (!encryptionKeys) return;
			const response = await encryption.fetchSecure(
				'/api/admin/social/accounts/list',
				{ method: 'POST', body: { pageSize: 100 } },
				encryptionKeys
			);
			if (response.ok && response.data) {
				accounts = (response.data.items ?? []) as SocialAccountItem[];
			} else {
				errorAccounts = resolveServerMessage(response.message, lang, {
					vi: toasts.loadFailed.vi,
					en: toasts.loadFailed.en
				});
			}
		} catch (e) {
			if (import.meta.env.DEV) console.error('[admin/social] loadAccounts failed:', e);
			errorAccounts = fmtToast(toasts.requestFailed);
		} finally {
			isLoadingAccounts = false;
		}
	}

	async function loadPosts() {
		isLoadingPosts = true;
		errorPosts = '';
		try {
			if (!encryptionKeys) return;
			const response = await encryption.fetchSecure(
				'/api/admin/social/posts/list',
				{ method: 'POST', body: { pageSize: 50 } },
				encryptionKeys
			);
			if (response.ok && response.data) {
				posts = (response.data.items ?? []) as SocialPostItem[];
			} else {
				errorPosts = resolveServerMessage(response.message, lang, {
					vi: toasts.loadFailed.vi,
					en: toasts.loadFailed.en
				});
			}
		} catch (e) {
			if (import.meta.env.DEV) console.error('[admin/social] loadPosts failed:', e);
			errorPosts = fmtToast(toasts.requestFailed);
		} finally {
			isLoadingPosts = false;
		}
	}

	// ---------- account actions ----------
	function openConnect(platform: string) {
		connectTargetPlatform = platform;
		connectEditTarget = null;
		connectForm = { accountName: '', handle: '', pageId: '', accessToken: '' };
		connectModalDisplay = true;
	}

	function openEditAccount(acc: SocialAccountItem) {
		connectTargetPlatform = acc.platform;
		connectEditTarget = acc;
		connectForm = {
			accountName: acc.accountName ?? '',
			handle: acc.handle ?? '',
			pageId: acc.pageId ?? '',
			accessToken: ''
		};
		connectModalDisplay = true;
	}

	async function submitConnect(): Promise<void> {
		if (!connectForm.accountName) return;
		try {
			if (!encryptionKeys) return;
			const isEdit = !!connectEditTarget;
			const editTarget = connectEditTarget;
			const url = isEdit
				? '/api/admin/social/accounts/update'
				: '/api/admin/social/accounts/connect';
			const body =
				isEdit && editTarget
					? {
							accountId: editTarget.accountId,
							accountName: connectForm.accountName,
							handle: connectForm.handle || undefined,
							pageId: connectForm.pageId || undefined,
							accessToken: connectForm.accessToken || undefined
						}
					: {
							platform: connectTargetPlatform,
							accountName: connectForm.accountName,
							handle: connectForm.handle || undefined,
							pageId: connectForm.pageId || undefined,
							accessToken: connectForm.accessToken || undefined
						};
			const response = await encryption.fetchSecure(url, { method: 'POST', body }, encryptionKeys);
			if (response.ok) {
				connectModalDisplay = false;
				showToast(fmtToast(isEdit ? toasts.updatedAcc : toasts.connected), 'success');
				await loadAccounts();
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
			if (import.meta.env.DEV) console.error('[admin/social] connect failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	function askDisconnect(acc: SocialAccountItem) {
		deleteAccTarget = acc;
		deleteAccDialogOpen = true;
	}

	async function submitDisconnect() {
		const target = deleteAccTarget;
		if (!target?.accountId || !encryptionKeys || deleteBusy) return;
		deleteBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/social/accounts/disconnect',
				{ method: 'POST', body: { accountId: target.accountId } },
				encryptionKeys
			);
			deleteBusy = false;
			if (response.ok) {
				deleteAccDialogOpen = false;
				deleteAccTarget = null;
				showToast(fmtToast(toasts.disconnected), 'success');
				await loadAccounts();
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
			deleteBusy = false;
			if (import.meta.env.DEV) console.error('[admin/social] disconnect failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	// ---------- post actions ----------
	function openCompose() {
		composeTarget = null;
		composeForm = { platform: 'facebook', content: '', mediaUrls: '', scheduledAt: '' };
		composeModalDisplay = true;
	}

	function openEditPost(post: SocialPostItem) {
		composeTarget = post;
		composeForm = {
			platform: post.platform,
			content: post.content ?? '',
			mediaUrls: (post.mediaUrls ?? []).join('\n'),
			scheduledAt: post.scheduledAt ? post.scheduledAt.slice(0, 16) : ''
		};
		composeModalDisplay = true;
	}

	function mediaUrlsToArray(raw: string): string[] {
		return raw
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	async function submitCompose(): Promise<void> {
		if (!composeForm.platform || !composeForm.content.trim()) return;
		try {
			if (!encryptionKeys) return;
			const mediaUrls = mediaUrlsToArray(composeForm.mediaUrls);
			const isEdit = !!composeTarget;
			const editTarget = composeTarget;
			const url = isEdit ? '/api/admin/social/posts/update' : '/api/admin/social/posts/create';
			const body =
				isEdit && editTarget
					? {
							socialPostId: editTarget.socialPostId,
							platform: composeForm.platform,
							content: composeForm.content,
							mediaUrls,
							scheduledAt: composeForm.scheduledAt
								? new Date(composeForm.scheduledAt).toISOString()
								: undefined
						}
					: {
							platform: composeForm.platform,
							content: composeForm.content,
							mediaUrls,
							scheduledAt: composeForm.scheduledAt
								? new Date(composeForm.scheduledAt).toISOString()
								: undefined
						};
			const response = await encryption.fetchSecure(url, { method: 'POST', body }, encryptionKeys);
			if (response.ok) {
				composeModalDisplay = false;
				showToast(fmtToast(isEdit ? toasts.updatedPost : toasts.createdPost), 'success');
				await loadPosts();
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
			if (import.meta.env.DEV) console.error('[admin/social] compose failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	async function postAction(post: SocialPostItem, action: 'schedule' | 'publish' | 'cancel') {
		try {
			if (!encryptionKeys) return;
			if (action === 'schedule') {
				// schedule cần scheduledAt → mở modal compose với giờ hiện tại +1h
				openEditPost(post);
				return;
			}
			const url =
				action === 'publish'
					? '/api/admin/social/posts/publish-now'
					: '/api/admin/social/posts/cancel';
			const response = await encryption.fetchSecure(
				url,
				{ method: 'POST', body: { socialPostId: post.socialPostId } },
				encryptionKeys
			);
			if (response.ok) {
				showToast(fmtToast(action === 'publish' ? toasts.published : toasts.cancelled), 'success');
				await loadPosts();
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
			if (import.meta.env.DEV) console.error('[admin/social] postAction failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	function askDeletePost(post: SocialPostItem) {
		deletePostTarget = post;
		deletePostDialogOpen = true;
	}

	async function submitDeletePost() {
		const target = deletePostTarget;
		if (!target?.socialPostId || !encryptionKeys || deleteBusy) return;
		deleteBusy = true;
		try {
			const response = await encryption.fetchSecure(
				'/api/admin/social/posts/delete',
				{ method: 'POST', body: { socialPostId: target.socialPostId } },
				encryptionKeys
			);
			deleteBusy = false;
			if (response.ok) {
				deletePostDialogOpen = false;
				deletePostTarget = null;
				showToast(fmtToast(toasts.deletedPost), 'success');
				await loadPosts();
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
			deleteBusy = false;
			if (import.meta.env.DEV) console.error('[admin/social] deletePost failed:', e);
			showToast(fmtToast(toasts.requestFailed), 'error');
		}
	}

	// ---------- lifecycle ----------
	onMount(async () => {
		if (!client.browser) client.browser = {};
		lang = client.browser?.language === 'en' ? 'en' : 'vi';
		const { privateKey, publicKey } = await encryption.generateRSAKeyPair();
		encryptionKeys = { privateKey, publicKey };
		await Promise.all([loadAccounts(), loadPosts()]);
	});

	// ---------- DataTable columns (posts) ----------
	const postsAny = $derived(posts as unknown as Record<string, unknown>[]);
	const postColumns = $derived<DataTableColumn<Record<string, unknown>>[]>([
		{
			id: 'platform',
			label: t('colPlatform'),
			sortable: true,
			accessor: (row) => platformLabel((row as unknown as SocialPostItem).platform),
			noHighlight: true
		},
		{
			id: 'content',
			label: t('colContent'),
			sortable: true,
			accessor: (row) => {
				const post = row as unknown as SocialPostItem;
				const mediaPart = post.mediaUrls?.length ? ` (${post.mediaUrls.length} media)` : '';
				return `${post.content}${mediaPart}`;
			}
		},
		{
			id: 'status',
			label: t('colStatus'),
			sortable: true,
			accessor: (row) =>
				postStatusLabels[(row as unknown as SocialPostItem).status]?.[lang] ??
				(row as unknown as SocialPostItem).status,
			status: (_value, row) => postStatusColor((row as unknown as SocialPostItem).status)
		},
		{
			id: 'scheduledAt',
			label: t('colScheduled'),
			sortable: true,
			accessor: (row) => formatDate((row as unknown as SocialPostItem).scheduledAt),
			noHighlight: true
		},
		{
			id: 'publishedAt',
			label: t('colPublished'),
			sortable: true,
			accessor: (row) => formatDate((row as unknown as SocialPostItem).publishedAt),
			noHighlight: true
		},
		{
			id: 'permalink',
			label: t('colPermalink'),
			accessor: (row) => (row as unknown as SocialPostItem).permalink ?? '—',
			noHighlight: true
		}
	]);
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
			<Button color="success" onClick={openCompose} data-test="social-compose">
				{t('compose')}
			</Button>
		</div>
	</header>

	<!-- ══════════ Khu 1: Accounts ══════════ -->
	<div class="section-head">
		<h2>{t('accountsTitle')}</h2>
	</div>
	{#if isLoadingAccounts}
		<div class="admin-state" role="status"><p>{t('loading')}</p></div>
	{:else if errorAccounts}
		<div class="admin-state admin-state--error" role="alert">{errorAccounts}</div>
	{:else if accounts.length === 0}
		<div class="admin-state">{t('emptyAccounts')}</div>
	{:else}
		<div class="accounts-grid" data-test="social-accounts">
			{#each accounts as acc (acc._id)}
				<div class="account-card" data-test="social-account-card">
					<div class="account-card-top">
						<span
							class="platform-icon"
							style:background={platformBrand[acc.platform as SocialPlatform] ?? '#888'}
							><i
								class="iconify"
								data-icon={platformIcons[acc.platform as SocialPlatform] ?? 'lucide:share-2'}
							></i></span
						>
						<div class="account-card-info">
							<div class="account-card-name">{acc.accountName}</div>
							<div class="account-card-sub">
								{platformLabel(acc.platform)}{acc.handle ? ` · ${acc.handle}` : ''}
							</div>
						</div>
						<span class="status-badge status-badge--{accStatusClass[acc.status] ?? 'muted'}"
							>{accStatusLabels[acc.status]?.[lang] ?? acc.status}</span
						>
					</div>
					<div class="account-card-meta">
						<span>{t('followers').replace('{count}', fmtCount(acc.followersCount))}</span>
						<span>{t('lastSync').replace('{date}', formatDate(acc.lastSyncAt))}</span>
					</div>
					<div class="account-card-actions">
						{#if acc.status !== 'connected'}
							<Button size="sm" color="success" onClick={() => openConnect(acc.platform)}
								>{t('connect')}</Button
							>
						{:else}
							<Button size="sm" variant="outline" onClick={() => openEditAccount(acc)}
								>{t('editAcc')}</Button
							>
							<Button size="sm" color="error" variant="ghost" onClick={() => askDisconnect(acc)}
								>{t('disconnect')}</Button
							>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ══════════ Khu 2: Posts ══════════ -->
	<div class="section-head">
		<h2>{t('postsTitle')}</h2>
	</div>
	{#if errorPosts}
		<div class="admin-state admin-state--error" role="alert">{errorPosts}</div>
	{:else}
	<!-- ── Bảng bài đăng — DataTable (component có sẵn) ──
	     KHÔNG phân trang server (API pageSize 50, client render tất cả). -->
	<div class="admin-table-wrap">
		<DataTable
			data={postsAny}
			columns={postColumns}
			pageSize={posts.length || 10}
			showPagination={false}
			sortable
			searchable
			searchPlaceholder={{ vi: 'Tìm bài đăng…', en: 'Search posts…' }}
			resizable={{ enabled: true, fit: true }}
			loading={isLoadingPosts}
			visual={{ striped: true, hoverable: true }}
			emptyLabel={t('emptyPosts')}
			loadingLabel={t('loading')}
			caption={{ vi: 'Danh sách bài đăng mạng xã hội', en: 'Social posts list' }}
			actionsLabel={{ vi: t('colActions'), en: t('colActions') }}
			stickyHead
			data-test="social-posts-datatable"
		>
			{#snippet actionsContent(row)}
				{@const post = row as unknown as SocialPostItem}
				<div class="row-actions">
					{#if post.status === 'draft'}
						<Button size="sm" color="primary" onClick={() => postAction(post, 'schedule')}
							>{t('fieldSchedule')}</Button
						>
					{/if}
					{#if post.status === 'draft' || post.status === 'scheduled'}
						<Button size="sm" color="success" onClick={() => postAction(post, 'publish')}
							>{t('colPublished')}</Button
						>
					{/if}
					{#if post.status === 'draft' || post.status === 'scheduled'}
						<Button size="sm" variant="ghost" onClick={() => postAction(post, 'cancel')}
							>{t('cancelConfirm')}</Button
						>
					{/if}
					{#if post.status === 'draft' || post.status === 'failed'}
						<Button
							size="sm"
							color="primary"
							variant="ghost"
							onClick={() => openEditPost(post)}>{t('editPost')}</Button
						>
					{/if}
					<Button
						size="sm"
						color="error"
						variant="ghost"
						onClick={() => askDeletePost(post)}>{t('delete')}</Button
					>
				</div>
			{/snippet}
		</DataTable>
	</div>
	{/if}
</section>

<!-- Connect modal (kết nối / sửa tài khoản) -->
{#if connectModalDisplay}
	<Modal bind:display={connectModalDisplay} size="sm" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>
					{connectEditTarget
						? `${t('editAcc')} — ${platformLabel(connectTargetPlatform)}`
						: `${t('connect')} — ${platformLabel(connectTargetPlatform)}`}
				</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="form-grid">
					<div class="form-field">
						<label class="form-label" for="soc-acc-name">{t('fieldAccountName')}</label>
						<input class="admin-input" id="soc-acc-name" bind:value={connectForm.accountName} />
					</div>
					<div class="form-field">
						<label class="form-label" for="soc-acc-handle">{t('fieldHandle')}</label>
						<input class="admin-input" id="soc-acc-handle" bind:value={connectForm.handle} />
					</div>
					<div class="form-field">
						<label class="form-label" for="soc-acc-page">{t('fieldPageId')}</label>
						<input class="admin-input" id="soc-acc-page" bind:value={connectForm.pageId} />
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="soc-acc-token">{t('fieldAccessToken')}</label>
						<input
							class="admin-input"
							id="soc-acc-token"
							type="password"
							bind:value={connectForm.accessToken}
						/>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-actions">
					<Button
						variant="ghost"
						onClick={() => {
							connectModalDisplay = false;
						}}>{t('close')}</Button
					>
					<Button color="success" onClick={submitConnect}>{t('save')}</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- Compose modal (soạn / sửa bài) -->
{#if composeModalDisplay}
	<Modal bind:display={composeModalDisplay} size="md" isDimissable>
		<Modal.Container>
			<Modal.Container.Header>
				<h3>{composeTarget ? t('editPost') : t('compose')}</h3>
			</Modal.Container.Header>
			<Modal.Container.Body>
				<div class="form-grid">
					<div class="form-field">
						<label class="form-label" for="soc-post-platform">{t('fieldPlatform')}</label>
						<select class="admin-select" id="soc-post-platform" bind:value={composeForm.platform}>
							{#each PLATFORMS as p (p)}
								<option value={p}>{platformLabel(p)}</option>
							{/each}
						</select>
					</div>
					<div class="form-field">
						<label class="form-label" for="soc-post-schedule">{t('fieldSchedule')}</label>
						<input
							class="admin-input"
							id="soc-post-schedule"
							type="datetime-local"
							bind:value={composeForm.scheduledAt}
						/>
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="soc-post-content">{t('fieldContent')}</label>
						<textarea
							class="admin-input"
							id="soc-post-content"
							rows="5"
							bind:value={composeForm.content}
						></textarea>
					</div>
					<div class="form-field form-field--full">
						<label class="form-label" for="soc-post-media">{t('fieldMediaUrls')}</label>
						<textarea
							class="admin-input"
							id="soc-post-media"
							rows="3"
							bind:value={composeForm.mediaUrls}
						></textarea>
					</div>
				</div>
			</Modal.Container.Body>
			<Modal.Container.Footer>
				<div class="modal-actions">
					<Button
						variant="ghost"
						onClick={() => {
							composeModalDisplay = false;
						}}>{t('close')}</Button
					>
					<Button color="success" onClick={submitCompose}>{t('save')}</Button>
				</div>
			</Modal.Container.Footer>
		</Modal.Container>
	</Modal>
{/if}

<!-- ── AlertDialog ngắt kết nối tài khoản ── -->
<AlertDialog bind:open={deleteAccDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{t('confirmDeleteAcc')}</AlertDialog.Title>
			<AlertDialog.Description>{t('confirmDeleteAccDesc')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{t('cancelConfirm')}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={submitDisconnect}>
				{t('disconnect')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

<!-- ── AlertDialog xoá bài đăng ── -->
<AlertDialog bind:open={deletePostDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{t('confirmDeletePost')}</AlertDialog.Title>
			<AlertDialog.Description>{t('confirmDeletePostDesc')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{t('cancelConfirm')}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={submitDeletePost}>
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

	.section-head {
		h2 {
			font-size: 1.125rem;
			font-weight: 600;
			color: var(--foreground);
			margin: 0;
		}
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
		&--info {
			background: color-mix(in srgb, #3b82f6 15%, transparent);
			color: #3b82f6;
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
	}

	/* Nút action trong actionsContent — chống nén (bẫy 39px clip) */
	.row-actions {
		display: flex;
		gap: 0.375rem;
		width: 1%;
		min-width: fit-content;
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

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		width: 100%;
	}
</style>
