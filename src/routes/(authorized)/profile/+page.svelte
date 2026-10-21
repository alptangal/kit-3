<!-- src/routes/(authorized)/profile/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Icon, AlertDialog, Tabs, Accordion } from '$components/element';
	import { Input } from '$components/form';
	import { getAllSearchKeywords, clearSearchKeywords, recordSearchKeyword } from '$store/user-prefs.svelte';
	import { encryption } from '$modules/encryption';
	import { browserSupportsWebAuthn, startRegistration, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
	import { client } from '$store/basic.svelte';

	// data.user từ (authorized)/+layout.server.ts (MetaUser)
	let { data } = $props();

	const lang = $derived(client.browser?.language === 'vi' ? 'vi' : 'en');

	const pageContents = {
		title: {
			vi: 'Hồ sơ cá nhân',
			en: 'Profile'
		},
		name: {
			vi: 'Họ và tên',
			en: 'Full name'
		},
		username: {
			vi: 'Tên đăng nhập',
			en: 'Username'
		},
		role: {
			vi: 'Vai trò',
			en: 'Role'
		},
		roleUnknown: {
			vi: 'Chưa xác định',
			en: 'Unknown'
		},

		// ── C6: tabs profile hiện đại ──
		tabOverview: {
			vi: 'Tổng quan',
			en: 'Overview'
		},
		tabSecurity: {
			vi: 'Bảo mật',
			en: 'Security'
		},
		tabApiKeys: {
			vi: 'Khóa API',
			en: 'API keys'
		},
		tabSearch: {
			vi: 'Tìm kiếm',
			en: 'Search'
		},

		// ── Lịch sử tìm kiếm ──
		searchHistoryTitle: {
			vi: 'Lịch sử tìm kiếm',
			en: 'Search history'
		},
		searchHistoryHint: {
			vi: 'Các từ khóa bạn đã dùng trên các trang quản trị. Xóa những mục không cần để gọn gợi ý tìm kiếm.',
			en: 'Keywords you used across admin pages. Clear unneeded ones to tidy up search suggestions.'
		},
		searchHistoryEmpty: {
			vi: 'Chưa có từ khóa nào được lưu.',
			en: 'No keywords saved yet.'
		},
		searchHistoryClearOne: {
			vi: 'Xóa',
			en: 'Delete'
		},
		searchHistoryClearRoute: {
			vi: 'Xóa cả trang',
			en: 'Clear page'
		},
		searchHistoryClearAll: {
			vi: 'Xóa tất cả',
			en: 'Clear all'
		},
		searchHistoryDeleted: {
			vi: 'Đã xóa lịch sử tìm kiếm',
			en: 'Search history cleared'
		},

		// ── Passkey / sinh trắc học ──
		passkeyTitle: {
			vi: 'Đăng nhập sinh trắc học (Passkey)',
			en: 'Biometric sign-in (Passkey)'
		},
		passkeySubtitle: {
			vi: 'Dùng vân tay / khuôn mặt / PIN của thiết bị để đăng nhập không cần mật khẩu.',
			en: 'Use fingerprint / face / device PIN to sign in without a password.'
		},
		passkeyUnavailable: {
			vi: 'Thiết bị hoặc trình duyệt không hỗ trợ Passkey.',
			en: 'This device or browser does not support Passkeys.'
		},
		// 2: hint khi trình duyệt OK nhưng thiết bị chưa bật platform authenticator —
		// hướng dẫn bật Windows Hello / Touch ID rồi quay lại đăng ký.
		passkeyAuthenticatorHint: {
			vi: 'Thiết bị này chưa bật khoá sinh trắc học (Windows Hello / Touch ID). Hãy bật trong phần cài đặt hệ điều hành rồi quay lại đăng ký thiết bị.',
			en: 'This device has no platform authenticator enabled (Windows Hello / Touch ID). Enable it in your OS settings, then come back to register this device.'
		},
		passkeyRegister: {
			vi: 'Đăng ký thiết bị mới',
			en: 'Register new device'
		},
		passkeyRegistering: {
			vi: 'Đang đăng ký...',
			en: 'Registering...'
		},
		passkeyEmpty: {
			vi: 'Chưa có thiết bị nào được đăng ký.',
			en: 'No device registered yet.'
		},
		passkeyLastUsed: {
			vi: 'Dùng lần cuối',
			en: 'Last used'
		},
		passkeyCreatedAt: {
			vi: 'Tạo lúc',
			en: 'Created'
		},
		passkeyNever: {
			vi: 'Chưa từng',
			en: 'Never'
		},
		passkeyRename: {
			vi: 'Đổi tên',
			en: 'Rename'
		},
		passkeyDelete: {
			vi: 'Xoá',
			en: 'Delete'
		},
		passkeySave: {
			vi: 'Lưu',
			en: 'Save'
		},
		passkeyCancel: {
			vi: 'Huỷ',
			en: 'Cancel'
		},
		passkeyDeleteConfirmTitle: {
			vi: 'Xoá thiết bị này?',
			en: 'Delete this device?'
		},
		passkeyDeleteConfirmBody: {
			vi: 'Bạn sẽ không thể đăng nhập bằng thiết bị này nữa. Hành động không thể hoàn tác.',
			en: 'You will no longer be able to sign in with this device. This cannot be undone.'
		},
		passkeyBackedUp: {
			vi: 'Đã đồng bộ đám mây',
			en: 'Cloud-synced'
		},
		passkeySingleDevice: {
			vi: 'Chỉ trên thiết bị này',
			en: 'This device only'
		},
		passkeyLoadFailed: {
			vi: 'Không tải được danh sách thiết bị',
			en: 'Failed to load devices'
		},
		passkeyRegisterSuccess: {
			vi: 'Đăng ký thiết bị thành công',
			en: 'Device registered'
		},
		passkeyRegisterFailed: {
			vi: 'Đăng ký thiết bị thất bại',
			en: 'Device registration failed'
		},
		passkeyRenameFailed: {
			vi: 'Đổi tên thiết bị thất bại',
			en: 'Device rename failed'
		},
		passkeyDeleteFailed: {
			vi: 'Xoá thiết bị thất bại',
			en: 'Device deletion failed'
		},
		passkeyRenameSuccess: {
			vi: 'Đã đổi tên thiết bị',
			en: 'Device renamed'
		},
		passkeyDeleteSuccess: {
			vi: 'Đã xoá thiết bị',
			en: 'Device deleted'
		},
		passkeyNamePlaceholder: {
			vi: 'Ví dụ: iPhone của tôi',
			en: 'e.g. My iPhone'
		},

		// ── Đổi mật khẩu ──
		passwordTitle: {
			vi: 'Đổi mật khẩu',
			en: 'Change password'
		},
		passwordSubtitle: {
			vi: 'Dùng mật khẩu hiện tại để xác nhận, sau đó đặt mật khẩu mới (tối thiểu 8 ký tự).',
			en: 'Confirm with your current password, then set a new one (min 8 characters).'
		},
		passwordOld: {
			vi: 'Mật khẩu hiện tại',
			en: 'Current password'
		},
		passwordNew: {
			vi: 'Mật khẩu mới',
			en: 'New password'
		},
		passwordConfirm: {
			vi: 'Nhập lại mật khẩu mới',
			en: 'Confirm new password'
		},
		passwordSave: {
			vi: 'Đổi mật khẩu',
			en: 'Change password'
		},
		passwordSaving: {
			vi: 'Đang lưu...',
			en: 'Saving...'
		},
		passwordMismatch: {
			vi: 'Mật khẩu nhập lại không khớp',
			en: 'Passwords do not match'
		},
		passwordSuccess: {
			vi: 'Đã đổi mật khẩu thành công',
			en: 'Password changed successfully'
		},

		// ── Secret Key API ──
		apiKeysTitle: {
			vi: 'Secret Key API',
			en: 'Secret API keys'
		},
		apiKeysSubtitle: {
			vi: 'Dùng key Bearer sk-... để gọi /api/agent/* từ ngoài (script, CI, AI agent).',
			en: 'Use a Bearer sk-... key to call /api/agent/* from outside (scripts, CI, AI agents).'
		},
		apiKeysCreate: {
			vi: 'Tạo key mới',
			en: 'Create key'
		},
		apiKeysCreating: {
			vi: 'Đang tạo...',
			en: 'Creating...'
		},
		apiKeysNameLabel: {
			vi: 'Tên key',
			en: 'Key name'
		},
		apiKeysNamePlaceholder: {
			vi: 'Ví dụ: CI bot',
			en: 'e.g. CI bot'
		},
		apiKeysEmpty: {
			vi: 'Chưa có key nào.',
			en: 'No API keys yet.'
		},
		apiKeysShowOnce: {
			vi: 'Sao chép ngay — key sẽ KHÔNG bao giờ hiển thị lại!',
			en: 'Copy it now — this key will NEVER be shown again!'
		},
		apiKeysCopy: {
			vi: 'Sao chép',
			en: 'Copy'
		},
		apiKeysCopied: {
			vi: 'Đã sao chép',
			en: 'Copied'
		},
		apiKeysRevoke: {
			vi: 'Thu hồi',
			en: 'Revoke'
		},
		apiKeysRevoked: {
			vi: 'Đã thu hồi',
			en: 'Revoked'
		},
		apiKeysRevokeConfirmTitle: {
			vi: 'Thu hồi key này?',
			en: 'Revoke this key?'
		},
		apiKeysRevokeConfirmBody: {
			vi: 'Mọi request dùng key này sẽ bị từ chối ngay lập tức. Không thể hoàn tác.',
			en: 'All requests using this key will be rejected immediately. This cannot be undone.'
		},
		apiKeysLoadFailed: {
			vi: 'Không tải được danh sách key',
			en: 'Failed to load API keys'
		},
		apiKeysCreateFailed: {
			vi: 'Tạo key thất bại',
			en: 'Failed to create key'
		},
		apiKeysRevokeFailed: {
			vi: 'Thu hồi thất bại',
			en: 'Failed to revoke'
		},
		apiKeysCreateSuccess: {
			vi: 'Đã tạo key',
			en: 'Key created'
		},
		apiKeysRevokeSuccess: {
			vi: 'Đã thu hồi key',
			en: 'Key revoked'
		},
		apiKeysLastUsed: {
			vi: 'Dùng lần cuối',
			en: 'Last used'
		},
		apiKeysCreatedAt: {
			vi: 'Tạo lúc',
			en: 'Created'
		},
		apiKeysCancel: {
			vi: 'Huỷ',
			en: 'Cancel'
		}
	};

	const displayName = $derived(
		[data.user.lastName, data.user.firstName].filter(Boolean).join(' ') || data.user.username || '—'
	);

	// ── C6: tabs profile (overview / security / api-keys) ──
	let profileTab = $state('overview');

	// ── Passkey state ──
	interface CredentialRow {
		credentialId: string;
		name: string;
		createdAt: string;
		lastUsedAt?: string | null;
		deviceType?: string;
		backedUp?: boolean;
	}

	let passkeySupported = $state(false);
	// 2: tách 2 mức check — passkeyAuthenticator = thiết bị CÓ platform
	// authenticator (Touch ID / Face ID / Windows Hello). FALSE → nút đăng ký
	// disabled + hint hướng dẫn (pattern login page d205bb38 — KHÔNG ẩn hoàn toàn:
	// user không biết chức năng tồn tại, không thể đăng ký kể cả khi cắm security key).
	let passkeyAuthenticator = $state(false);
	let passkeyLoading = $state(false);
	let passkeyRegistering = $state(false);
	let credentials = $state<CredentialRow[]>([]);
	let renamingId = $state<string | undefined>(undefined);
	let renameDraft = $state('');
	let deleteTarget = $state<CredentialRow | undefined>(undefined);
	let deleteDialogOpen = $state(false);

	// ── Lịch sử tìm kiếm (từ user-prefs store) ──
	let searchHistoryVersion = $state(0);
	const searchHistory = $derived.by(() => {
		void searchHistoryVersion;
		return getAllSearchKeywords(); // Record<route, string[]>
	});

	function removeSearchKeyword(routeKey: string, keyword: string) {
		const remaining = (getAllSearchKeywords()[routeKey] ?? []).filter((k) => k !== keyword);
		clearSearchKeywords(routeKey);
		if (remaining.length > 0) {
			for (const k of [...remaining].reverse()) recordSearchKeyword(routeKey, k);
		}
		searchHistoryVersion += 1;
		toast(msg('searchHistoryDeleted'), undefined, 'success');
	}

	function removeSearchRoute(routeKey: string) {
		clearSearchKeywords(routeKey);
		searchHistoryVersion += 1;
		toast(msg('searchHistoryDeleted'), undefined, 'success');
	}

	function removeAllSearchHistory() {
		clearSearchKeywords();
		searchHistoryVersion += 1;
		toast(msg('searchHistoryDeleted'), undefined, 'success');
	}

	// Toast helper — cùng pattern login page
	function toast(title: string, description: string | undefined, color: 'success' | 'error') {
		client.browser?.toasts?.create({ title, description, color });
	}

	function msg(key: keyof typeof pageContents): string {
		const c = pageContents[key] as { vi: string; en: string };
		return c[lang] ?? c.en;
	}

	async function loadCredentials() {
		if (!data.user.userId) return;
		passkeyLoading = true;
		try {
			const res = await encryption.fetchSecure('/api/admin/webauthn/list', {
				method: 'post',
				body: { userId: data.user.userId }
			});
			if (res.ok) {
				credentials = (res.data?.credentials ?? []) as CredentialRow[];
			} else {
				toast(msg('passkeyLoadFailed'), res.message?.[lang] ?? res.message?.en, 'error');
			}
		} catch (e) {
			toast(msg('passkeyLoadFailed'), e instanceof Error ? e.message : String(e), 'error');
		} finally {
			passkeyLoading = false;
		}
	}

	async function handleRegister() {
		if (!data.user.userId || passkeyRegistering) return;
		passkeyRegistering = true;
		try {
			// 1. Lấy options từ server (challenge in-memory TTL 5 phút)
			const optRes = await encryption.fetchSecure('/api/auth/webauthn/register/options', {
				method: 'post',
				body: { userId: data.user.userId }
			});
			if (!optRes.ok || !optRes.data?.options) {
				toast(msg('passkeyRegisterFailed'), optRes.message?.[lang] ?? optRes.message?.en, 'error');
				return;
			}

			// 2. Gọi authenticator (Touch ID / Face ID / Windows Hello / fingerprint)
			const attResp = await startRegistration({ optionsJSON: optRes.data.options });

			// 3. Gửi attestation về server verify + lưu credential
			const verRes = await encryption.fetchSecure('/api/auth/webauthn/register/verify', {
				method: 'post',
				body: { userId: data.user.userId, response: attResp }
			});
			if (!verRes.ok) {
				toast(msg('passkeyRegisterFailed'), verRes.message?.[lang] ?? verRes.message?.en, 'error');
				return;
			}

			toast(msg('passkeyRegisterSuccess'), undefined, 'success');
			await loadCredentials();
		} catch (e) {
			// User huỷ prompt authenticator (NotAllowedError) — không hiện lỗi to
			const em = e instanceof Error ? e.message : String(e);
			if (!/NotAllowed|aborted/i.test(em)) {
				toast(msg('passkeyRegisterFailed'), em, 'error');
			}
		} finally {
			passkeyRegistering = false;
		}
	}

	function startRename(cred: CredentialRow) {
		renamingId = cred.credentialId;
		renameDraft = cred.name;
	}

	async function submitRename() {
		const id = renamingId;
		if (!id) return;
		const clean = renameDraft.trim().slice(0, 64);
		if (!clean) return;
		try {
			const res = await encryption.fetchSecure('/api/admin/webauthn/rename', {
				method: 'post',
				body: { credentialId: id, name: clean }
			});
			if (res.ok) {
				const row = credentials.find((c) => c.credentialId === id);
				if (row) row.name = clean;
				toast(msg('passkeyRenameSuccess'), undefined, 'success');
				renamingId = undefined;
			} else {
				toast(msg('passkeyRenameFailed'), res.message?.[lang] ?? res.message?.en, 'error');
			}
		} catch (e) {
			toast(msg('passkeyRenameFailed'), e instanceof Error ? e.message : String(e), 'error');
		}
	}

	function confirmDelete(cred: CredentialRow) {
		deleteTarget = cred;
		deleteDialogOpen = true;
	}

	async function handleDelete() {
		const cred = deleteTarget;
		if (!cred) return;
		try {
			const res = await encryption.fetchSecure('/api/admin/webauthn/delete', {
				method: 'post',
				body: { credentialId: cred.credentialId }
			});
			if (res.ok) {
				credentials = credentials.filter((c) => c.credentialId !== cred.credentialId);
				toast(msg('passkeyDeleteSuccess'), undefined, 'success');
			} else {
				toast(msg('passkeyDeleteFailed'), res.message?.[lang] ?? res.message?.en, 'error');
			}
		} catch (e) {
			toast(msg('passkeyDeleteFailed'), e instanceof Error ? e.message : String(e), 'error');
		} finally {
			deleteTarget = undefined;
			deleteDialogOpen = false;
		}
	}

	function formatDate(raw: string | undefined | null): string {
		if (!raw) return msg('passkeyNever');
		try {
			return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			}).format(new Date(raw));
		} catch {
			return '—';
		}
	}

	onMount(() => {
		// Đồng bộ login page: 2 mức check — passkeySupported = WebAuthn API sẵn sàng
		// (hiện section + nút đăng ký), passkeyAuthenticator = thiết bị CÓ platform
		// authenticator (false → nút disabled + hint hướng dẫn bật, KHÔNG ẩn).
		void (async () => {
			passkeySupported =
				typeof window !== 'undefined' &&
				typeof (window as { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined' &&
				browserSupportsWebAuthn();
			// BẪY Safari iOS 15.1: platformAuthenticatorIsAvailable() (IUPAA) có thể
			// REJECT (NotSupportedError/AbortError WebKit cũ) hoặc treo — gate false
			// ở đây làm nút đăng ký disabled VĨNH VIỄN không log. Optimistic: lỗi
			// gate → giả định CÓ authenticator (user bấm sẽ thấy lỗi thật từ
			// startRegistration nếu thật sự không có).
			if (passkeySupported) {
				try {
					passkeyAuthenticator = await platformAuthenticatorIsAvailable();
				} catch {
					passkeyAuthenticator = true;
				}
				// WebKit cũ đôi khi resolve false SAI (không có platform nhưng
				// security key vẫn dùng được) — vẫn optimistic để không khoá nút.
				if (!passkeyAuthenticator) passkeyAuthenticator = true;
				void loadCredentials();
			}
		})();
	});

	// ── Đổi mật khẩu ──
	let pwdOld = $state('');
	let pwdNew = $state('');
	let pwdConfirm = $state('');
	let pwdSaving = $state(false);

	async function submitPassword() {
		if (pwdSaving) return;
		if (pwdNew !== pwdConfirm) {
			toast(msg('passwordMismatch'), undefined, 'error');
			return;
		}
		pwdSaving = true;
		try {
			const res = await encryption.fetchSecure('/api/agent/profile/change-password', {
				method: 'post',
				body: { oldPassword: pwdOld, newPassword: pwdNew }
			});
			if (res.ok) {
				toast(msg('passwordSuccess'), undefined, 'success');
				pwdOld = '';
				pwdNew = '';
				pwdConfirm = '';
			} else {
				toast(res.message?.[lang] ?? res.message?.en ?? 'Error', undefined, 'error');
			}
		} catch (e) {
			toast(e instanceof Error ? e.message : String(e), undefined, 'error');
		} finally {
			pwdSaving = false;
		}
	}

	// ── Secret Key API ──
	interface ApiKeyRow {
		documentKey: string;
		name: string;
		prefix: string;
		createdAt?: string;
		lastUsedAt?: string;
		revokedAt?: string;
	}

	let apiKeys = $state<ApiKeyRow[]>([]);
	let apiKeysLoading = $state(false);
	let apiKeysCreating = $state(false);
	let newKeyName = $state('');
	let showCreateModal = $state(false);
	let createdKey = $state('');
	let copied = $state(false);
	let revokeTarget = $state<ApiKeyRow | undefined>(undefined);
	let revokeDialogOpen = $state(false);

	async function loadApiKeys() {
		apiKeysLoading = true;
		try {
			const res = await encryption.fetchSecure('/api/agent/keys/list', { method: 'post' });
			if (res.ok) {
				apiKeys = (res.data?.keys ?? []) as ApiKeyRow[];
			} else {
				toast(msg('apiKeysLoadFailed'), res.message?.[lang] ?? res.message?.en, 'error');
			}
		} catch (e) {
			toast(msg('apiKeysLoadFailed'), e instanceof Error ? e.message : String(e), 'error');
		} finally {
			apiKeysLoading = false;
		}
	}

	async function submitCreateKey() {
		if (apiKeysCreating) return;
		const name = newKeyName.trim();
		if (!name) return;
		apiKeysCreating = true;
		try {
			const res = await encryption.fetchSecure('/api/agent/keys/create', {
				method: 'post',
				body: { name }
			});
			if (res.ok && res.data?.key) {
				createdKey = res.data.key as string;
				copied = false;
				newKeyName = '';
				showCreateModal = false;
				toast(msg('apiKeysCreateSuccess'), undefined, 'success');
				await loadApiKeys();
			} else {
				toast(msg('apiKeysCreateFailed'), res.message?.[lang] ?? res.message?.en, 'error');
			}
		} catch (e) {
			toast(msg('apiKeysCreateFailed'), e instanceof Error ? e.message : String(e), 'error');
		} finally {
			apiKeysCreating = false;
		}
	}

	async function copyCreatedKey(): Promise<void> {
		try {
			await navigator.clipboard.writeText(createdKey);
			copied = true;
		} catch {
			// clipboard API có thể bị chặn — fallback select
			copied = false;
		}
	}

	function confirmRevoke(key: ApiKeyRow) {
		revokeTarget = key;
		revokeDialogOpen = true;
	}

	async function handleRevoke() {
		const key = revokeTarget;
		if (!key) return;
		try {
			const res = await encryption.fetchSecure('/api/agent/keys/revoke', {
				method: 'post',
				body: { documentKey: key.documentKey }
			});
			if (res.ok) {
				apiKeys = apiKeys.map((k) =>
					k.documentKey === key.documentKey ? { ...k, revokedAt: new Date().toISOString() } : k
				);
				toast(msg('apiKeysRevokeSuccess'), undefined, 'success');
			} else {
				toast(msg('apiKeysRevokeFailed'), res.message?.[lang] ?? res.message?.en, 'error');
			}
		} catch (e) {
			toast(msg('apiKeysRevokeFailed'), e instanceof Error ? e.message : String(e), 'error');
		} finally {
			revokeTarget = undefined;
			revokeDialogOpen = false;
		}
	}

	// Load keys cùng lúc passkey (mọi user đều xem được key của mình — route tự check permission)
	$effect(() => {
		if (data.user.userId) void loadApiKeys();
	});
</script>

<svelte:head>
	<title>{pageContents.title[lang]}</title>
</svelte:head>

<section class="profile-page">
	<header class="profile-header">
		<div class="profile-avatar" aria-hidden="true">
			{data.user.username.slice(0, 2).toUpperCase()}
		</div>
		<div class="profile-header-text">
			<h1 class="profile-title">{pageContents.title[lang]}</h1>
			<p class="profile-username">{data.user.username}</p>
		</div>
	</header>

	{#snippet tabOverviewContent()}
		<dl class="profile-info">
			<div class="info-row">
				<dt>{pageContents.name[lang]}</dt>
				<dd>{displayName}</dd>
			</div>
			<div class="info-row">
				<dt>{pageContents.username[lang]}</dt>
				<dd>{data.user.username}</dd>
			</div>
			<div class="info-row">
				<dt>{pageContents.role[lang]}</dt>
				<dd>
					<span class="role-badge">
						{data.user.roleName ?? data.user.roleId ?? pageContents.roleUnknown[lang]}
					</span>
				</dd>
			</div>
		</dl>
	{/snippet}

	{#snippet tabSecurityContent()}
		<!-- Passkey / biometrics section -->
		<section class="passkey-section">
		<header class="passkey-header">
			<div class="passkey-heading">
				<Icon class="passkey-icon" icon="lucide:fingerprint" size="md" />
				<div>
					<h2 class="passkey-title">{msg('passkeyTitle')}</h2>
					<p class="passkey-subtitle">{msg('passkeySubtitle')}</p>
				</div>
			</div>
			{#if passkeySupported}
				<Button
					class="passkey-register-btn"
					color="primary"
					variant="ghost"
					loading={passkeyRegistering}
					disabled={passkeyRegistering}
					onclick={handleRegister}
				>
					{passkeyRegistering ? msg('passkeyRegistering') : msg('passkeyRegister')}
				</Button>
			{/if}
		</header>

		{#if !passkeySupported}
			<p class="passkey-unavailable">{msg('passkeyUnavailable')}</p>
		{:else if passkeyLoading && credentials.length === 0}
			<div class="passkey-loading"><span class="passkey-spinner"></span></div>
		{:else if credentials.length === 0}
			<p class="passkey-empty">{msg('passkeyEmpty')}</p>
		{:else}
			<ul class="passkey-list">
				{#each credentials as cred (cred.credentialId)}
					<li class="passkey-item">
						<div class="passkey-item-main">
							{#if renamingId === cred.credentialId}
								<div class="passkey-rename-row">
									<Input
										type="text"
										bind:value={renameDraft}
										placeholder={msg('passkeyNamePlaceholder')}
										class="passkey-rename-input"
									/>
									<Button
										variant="ghost"
										color="success"
										size="sm"
										onclick={submitRename}
									>
										{msg('passkeySave')}
									</Button>
									<Button
										variant="ghost"
										color="default"
										size="sm"
										onclick={() => (renamingId = undefined)}
									>
										{msg('passkeyCancel')}
									</Button>
								</div>
							{:else}
								<span class="passkey-name" title={cred.credentialId}>{cred.name}</span>
								<span class="passkey-meta">
									{msg('passkeyCreatedAt')}: {formatDate(cred.createdAt)}
									· {msg('passkeyLastUsed')}: {formatDate(cred.lastUsedAt)}
									{#if cred.backedUp}
										· {msg('passkeyBackedUp')}
									{:else}
										· {msg('passkeySingleDevice')}
									{/if}
								</span>
							{/if}
						</div>
						<div class="passkey-item-actions">
							{#if renamingId !== cred.credentialId}
								<Button
									variant="link"
									color="default"
									size="sm"
									onclick={() => startRename(cred)}
								>
									{msg('passkeyRename')}
								</Button>
								<Button
									variant="link"
									color="error"
									size="sm"
									onclick={() => confirmDelete(cred)}
								>
									{msg('passkeyDelete')}
								</Button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Đổi mật khẩu (self-service) -->
	<section class="pwd-section">
		<header class="pwd-header">
			<div class="passkey-heading">
				<Icon class="passkey-icon" icon="lucide:key-round" size="md" />
				<div>
					<h2 class="passkey-title">{msg('passwordTitle')}</h2>
					<p class="passkey-subtitle">{msg('passwordSubtitle')}</p>
				</div>
			</div>
		</header>
		<form
			class="pwd-form"
			onsubmit={(e) => {
				e.preventDefault();
				void submitPassword();
			}}
		>
			<label class="pwd-field">
				<span class="pwd-label">{msg('passwordOld')}</span>
				<Input type="password" bind:value={pwdOld} autocomplete="current-password" required />
			</label>
			<label class="pwd-field">
				<span class="pwd-label">{msg('passwordNew')}</span>
				<Input type="password" bind:value={pwdNew} autocomplete="new-password" required />
			</label>
			<label class="pwd-field">
				<span class="pwd-label">{msg('passwordConfirm')}</span>
				<Input type="password" bind:value={pwdConfirm} autocomplete="new-password" required />
			</label>
			<div class="pwd-actions">
				<Button type="submit" color="primary" variant="solid" disabled={pwdSaving} loading={pwdSaving}>
					{pwdSaving ? msg('passwordSaving') : msg('passwordSave')}
				</Button>
			</div>
		</form>
	</section>
	{/snippet}

	{#snippet tabApiKeysContent()}
		<!-- Secret Key API -->
		<section class="keys-section">
		<header class="pwd-header">
			<div class="passkey-heading">
				<Icon class="passkey-icon" icon="lucide:shield-keyhole" size="md" />
				<div>
					<h2 class="passkey-title">{msg('apiKeysTitle')}</h2>
					<p class="passkey-subtitle">{msg('apiKeysSubtitle')}</p>
				</div>
			</div>
			<Button
				color="primary"
				variant="ghost"
				loading={apiKeysCreating}
				disabled={apiKeysCreating}
				onclick={() => {
					showCreateModal = true;
				}}
			>
				{msg('apiKeysCreate')}
			</Button>
		</header>

		{#if apiKeysLoading && apiKeys.length === 0}
			<div class="passkey-loading"><span class="passkey-spinner"></span></div>
		{:else if apiKeys.length === 0}
			<p class="passkey-empty">{msg('apiKeysEmpty')}</p>
		{:else}
			<ul class="passkey-list">
				{#each apiKeys as key (key.documentKey)}
					<li class="passkey-item" class:passkey-item--revoked={!!key.revokedAt}>
						<div class="passkey-item-main">
							<span class="passkey-name">
								{key.name}
								<code class="keys-prefix">{key.prefix}…</code>
							</span>
							<span class="passkey-meta">
								{msg('apiKeysCreatedAt')}: {formatDate(key.createdAt)}
								· {msg('apiKeysLastUsed')}: {formatDate(key.lastUsedAt)}
								{#if key.revokedAt}
									· {msg('apiKeysRevoked')}
								{/if}
							</span>
						</div>
						<div class="passkey-item-actions">
							{#if !key.revokedAt}
								<Button variant="link" color="error" size="sm" onclick={() => confirmRevoke(key)}>
									{msg('apiKeysRevoke')}
								</Button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
		</section>
	{/snippet}

	{#snippet tabSearchContent()}
		<!-- ── Nhóm 4: quản lí lịch sử tìm kiếm ── -->
		<section class="keys-section" data-test="search-history">
			<header class="pwd-header">
				<div class="passkey-heading">
					<Icon class="passkey-icon" icon="lucide:search" size="md" />
					<div>
						<h2 class="passkey-title">{msg('searchHistoryTitle')}</h2>
						<p class="passkey-subtitle">{msg('searchHistoryHint')}</p>
					</div>
				</div>
				{#if Object.keys(searchHistory).some((r) => (searchHistory[r] ?? []).length > 0)}
					<Button
						color="error"
						variant="soft"
						size="sm"
						onclick={removeAllSearchHistory}
						data-test="search-history-clear-all"
					>
						{msg('searchHistoryClearAll')}
					</Button>
				{/if}
			</header>

			{#if Object.keys(searchHistory).length === 0 || !Object.keys(searchHistory).some((r) => (searchHistory[r] ?? []).length > 0)}
				<p class="passkey-empty" data-test="search-history-empty">{msg('searchHistoryEmpty')}</p>
			{:else}
				{#each Object.entries(searchHistory) as [routeKey, keywords] (routeKey)}
					{#if keywords.length > 0}
						<div class="sh-route" data-test="search-history-route">
							<div class="sh-route-head">
								<span class="sh-route-key">{routeKey}</span>
								<Button
									color="default"
									variant="ghost"
									size="sm"
									onclick={() => removeSearchRoute(routeKey)}
									data-test="search-history-clear-route"
								>
									{msg('searchHistoryClearRoute')}
								</Button>
							</div>
							<div class="sh-chips">
								{#each keywords as kw (kw)}
									<span class="sh-chip">
										<span class="sh-chip-text">{kw}</span>
										<button
											type="button"
											class="sh-chip-x"
											aria-label="{msg('searchHistoryClearOne')}: {kw}"
											onclick={() => removeSearchKeyword(routeKey, kw)}
											data-test="search-history-remove-kw"
										>✕</button>
									</span>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			{/if}
		</section>
	{/snippet}

	<!-- ── C6: Tabs desktop — wrapper div mang data-test (Tabs.Root không forward) ── -->
	<div class="profile-tabs" data-test="profile-tabs">
	<Tabs bind:value={profileTab} type="underline">
		<Tabs.List>
			<Tabs.Trigger value="overview" icon="lucide:user" data-test="profile-tab-overview">
				{pageContents.tabOverview[lang]}
			</Tabs.Trigger>
			<Tabs.Trigger value="security" icon="lucide:shield" data-test="profile-tab-security">
				{pageContents.tabSecurity[lang]}
			</Tabs.Trigger>
			<Tabs.Trigger value="api-keys" icon="lucide:shield-keyhole" data-test="profile-tab-api-keys">
				{pageContents.tabApiKeys[lang]}
			</Tabs.Trigger>
			<Tabs.Trigger value="search" icon="lucide:search" data-test="profile-tab-search">
				{pageContents.tabSearch[lang]}
			</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="overview" data-test="profile-tab-content-overview">
			{@render tabOverviewContent()}
		</Tabs.Content>

		<Tabs.Content value="security" data-test="profile-tab-content-security">
			{@render tabSecurityContent()}
		</Tabs.Content>

		<Tabs.Content value="api-keys" data-test="profile-tab-content-api-keys">
			{@render tabApiKeysContent()}
		</Tabs.Content>

		<Tabs.Content value="search" data-test="profile-tab-content-search">
			{@render tabSearchContent()}
		</Tabs.Content>
	</Tabs>
	</div>

	<!-- ── C6: ACCORDION mobile <768px — cùng pattern settings, chia sẻ
	     state profileTab: mở item = chọn tab, đổi breakpoint giữ mục đang xem ── -->
	<div class="profile-accordion" data-test="profile-accordion">
		<Accordion type="single" collapsible bind:value={profileTab}>
			<Accordion.Item value="overview">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:user" data-test="profile-acc-trigger-overview">
						{pageContents.tabOverview[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="profile-acc-content-overview">
					<dl class="profile-info">
						<div class="info-row">
							<dt>{pageContents.name[lang]}</dt>
							<dd>{displayName}</dd>
						</div>
						<div class="info-row">
							<dt>{pageContents.username[lang]}</dt>
							<dd>{data.user.username}</dd>
						</div>
						<div class="info-row">
							<dt>{pageContents.role[lang]}</dt>
							<dd>
								<span class="role-badge">
									{data.user.roleName ?? data.user.roleId ?? pageContents.roleUnknown[lang]}
								</span>
							</dd>
						</div>
					</dl>
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="security">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:shield" data-test="profile-acc-trigger-security">
						{pageContents.tabSecurity[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="profile-acc-content-security">
					{@render tabSecurityContent()}
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="api-keys">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:shield-keyhole" data-test="profile-acc-trigger-api-keys">
						{pageContents.tabApiKeys[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="profile-acc-content-api-keys">
					{@render tabApiKeysContent()}
				</Accordion.Content>
			</Accordion.Item>
			<Accordion.Item value="search">
				<Accordion.Header>
					<Accordion.Trigger icon="lucide:search" data-test="profile-acc-trigger-search">
						{pageContents.tabSearch[lang]}
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content data-test="profile-acc-content-search">
					{@render tabSearchContent()}
				</Accordion.Content>
			</Accordion.Item>
		</Accordion>
	</div>
</section>

<!-- Modal tạo key mới -->
<AlertDialog bind:open={showCreateModal}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{msg('apiKeysCreate')}</AlertDialog.Title>
			<AlertDialog.Description>{msg('apiKeysNameLabel')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{msg('apiKeysCancel')}</AlertDialog.Cancel>
			<AlertDialog.Action color="primary" onclick={submitCreateKey}>
				{apiKeysCreating ? msg('apiKeysCreating') : msg('apiKeysCreate')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

<!-- Modal hiển thị raw key ĐÚNG 1 LẦN -->
<AlertDialog open={createdKey !== ''}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{msg('apiKeysCreateSuccess')}</AlertDialog.Title>
			<AlertDialog.Description>{msg('apiKeysShowOnce')}</AlertDialog.Description>
		</AlertDialog.Header>
		<div class="keys-reveal">
			<code class="keys-reveal-code">{createdKey}</code>
			<Button variant="ghost" color="primary" size="sm" onclick={copyCreatedKey}>
				{copied ? msg('apiKeysCopied') : msg('apiKeysCopy')}
			</Button>
		</div>
		<AlertDialog.Footer>
			<AlertDialog.Action color="primary" onclick={() => (createdKey = '')}>
				{msg('passkeySave')}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

<AlertDialog bind:open={revokeDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{msg('apiKeysRevokeConfirmTitle')}</AlertDialog.Title>
			<AlertDialog.Description>{revokeTarget?.name} — {msg('apiKeysRevokeConfirmBody')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{msg('apiKeysCancel')}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={handleRevoke}>{msg('apiKeysRevoke')}</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

<AlertDialog bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header variant="danger">
			<AlertDialog.Title>{msg('passkeyDeleteConfirmTitle')}</AlertDialog.Title>
			<AlertDialog.Description>{deleteTarget?.name} — {msg('passkeyDeleteConfirmBody')}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{msg('passkeyCancel')}</AlertDialog.Cancel>
			<AlertDialog.Action color="danger" onclick={handleDelete}>{msg('passkeyDelete')}</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog>

<style lang="scss">
	.profile-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1.5rem;
		max-width: 720px;
		margin: 0 auto;
		width: 100%;
	}

	.profile-header {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.profile-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 999px;
		background: var(--primary-100);
		color: var(--primary-700);
		font-weight: 700;
		font-size: 1.2rem;
		flex-shrink: 0;
	}

	.profile-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--foreground);
		margin: 0;
	}

	.profile-username {
		font-size: 0.9rem;
		color: var(--foreground-500);
		margin: 0.15rem 0 0;
	}

	.profile-info {
		display: flex;
		flex-direction: column;
		margin: 0;
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
		overflow: hidden;
	}

	.info-row {
		display: grid;
		grid-template-columns: minmax(9rem, 1fr) 2fr;
		gap: 1rem;
		padding: 0.85rem 1rem;

		& + .info-row {
			border-top: 1px solid var(--default-200);
		}

		dt {
			font-size: 0.85rem;
			color: var(--foreground-500);
			margin: 0;
			align-self: center;
		}

		dd {
			font-size: 0.95rem;
			color: var(--foreground);
			margin: 0;
			word-break: break-word;
		}
	}

	.role-badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 500;
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		background: var(--primary-100);
		color: var(--primary-700);
	}

	@media (max-width: 560px) {
		.profile-page {
			padding: 1rem;
		}

		.info-row {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}
	}

	/* ── C6: Tabs desktop / Accordion mobile — chia sẻ state profileTab ── */
	.profile-accordion {
		display: none;
	}

	@media (max-width: 767px) {
		.profile-tabs {
			display: none;
		}

		.profile-accordion {
			display: block;
		}
	}

	/* ── Passkey section ── */
	.passkey-section {
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.passkey-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.passkey-heading {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		min-width: 0;
	}

	/* class truyền qua prop vào Icon/Input → scoped hash của component con
	   không match selector cục bộ — bọc :global nhưng giới hạn phạm vi qua
	   .passkey-section cha để không loang ra ngoài. */
	.passkey-section :global(.passkey-icon) {
		color: var(--primary-600);
		flex-shrink: 0;
		margin-top: 0.15rem;
	}

	.passkey-title {
		font-size: 1.05rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.passkey-subtitle {
		font-size: 0.82rem;
		color: var(--foreground-500);
		margin: 0.15rem 0 0;
		max-width: 34rem;
	}

	.passkey-unavailable,
	.passkey-empty {
		font-size: 0.88rem;
		color: var(--foreground-500);
		margin: 0;
		padding: 0.5rem 0 0.25rem;
	}

	.passkey-loading {
		display: flex;
		justify-content: center;
		padding: 0.75rem 0;
	}

	.passkey-spinner {
		display: inline-block;
		width: 1.25rem;
		height: 1.25rem;
		border: 2px solid var(--default-300);
		border-top-color: var(--primary-600);
		border-radius: 50%;
		animation: passkey-spin 0.8s linear infinite;
	}

	@keyframes passkey-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Nhóm 4: lịch sử tìm kiếm ── */
	.sh-route {
		margin-bottom: 0.75rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--default-200);
		border-radius: 0.5rem;
	}

	.sh-route-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}

	.sh-route-key {
		font-family: var(--font-mono, monospace);
		font-size: 0.8rem;
		color: var(--foreground-500);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sh-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.sh-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.3rem 0.2rem 0.6rem;
		border: 1px solid var(--default-200);
		border-radius: 999px;
		font-size: 0.82rem;
		background: var(--content1, transparent);
	}

	.sh-chip-text {
		max-width: 14rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sh-chip-x {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.1rem;
		height: 1.1rem;
		border: none;
		border-radius: 50%;
		background: transparent;
		color: var(--foreground-500);
		font-size: 0.7rem;
		line-height: 1;
		cursor: pointer;

		&:hover {
			background: var(--error, hsl(0 84% 60%));
			color: white;
		}
	}

	.passkey-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.passkey-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 0;

		& + .passkey-item {
			border-top: 1px solid var(--default-200);
		}
	}

	.passkey-item-main {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.passkey-name {
		font-size: 0.92rem;
		font-weight: 500;
		color: var(--foreground);
		overflow-wrap: anywhere;
	}

	.passkey-meta {
		font-size: 0.78rem;
		color: var(--foreground-500);
	}

	.passkey-item-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.passkey-rename-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.passkey-section :global(.passkey-rename-input) {
		min-width: 12rem;
	}

	@media (max-width: 560px) {
		.passkey-item {
			flex-direction: column;
			align-items: flex-start;
		}

		.passkey-item-actions {
			padding-left: 0;
		}
	}

	// ── Đổi mật khẩu ──
	.pwd-section,
	.keys-section {
		border: 1px solid var(--default-300);
		border-radius: 0.75rem;
		background: var(--background);
		padding: 1.25rem;
	}

	.pwd-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.pwd-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		max-width: 26rem;
	}

	.pwd-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.pwd-label {
		font-size: 0.85rem;
		color: var(--foreground-500);
	}

	.pwd-actions {
		display: flex;
		justify-content: flex-end;
	}

	// ── Secret Key API ──
	.keys-prefix {
		font-size: 0.75rem;
		color: var(--foreground-500);
		background: var(--default-100, var(--default-200));
		border-radius: 0.25rem;
		padding: 0.1rem 0.35rem;
		margin-left: 0.4rem;
	}

	.passkey-item--revoked {
		opacity: 0.55;
	}

	.keys-reveal {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 1.25rem 0.75rem;
		flex-wrap: wrap;
	}

	.keys-reveal-code {
		font-size: 0.8rem;
		word-break: break-all;
		background: var(--default-100, var(--default-200));
		border-radius: 0.35rem;
		padding: 0.45rem 0.6rem;
		flex: 1;
		min-width: 0;
	}
</style>
