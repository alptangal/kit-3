<!-- src/routes/(authorized)/profile/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Icon, AlertDialog } from '$components/element';
	import { Input } from '$components/form';
	import { encryption } from '$modules/encryption';
	import {
		browserSupportsWebAuthn,
		startRegistration,
		bufferToBase64URLString
	} from '@simplewebauthn/browser';
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
		}
	};

	const displayName = $derived(
		[data.user.lastName, data.user.firstName].filter(Boolean).join(' ') || data.user.username || '—'
	);

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
	let passkeyLoading = $state(false);
	let passkeyRegistering = $state(false);
	let credentials = $state<CredentialRow[]>([]);
	let renamingId = $state<string | undefined>(undefined);
	let renameDraft = $state('');
	let deleteTarget = $state<CredentialRow | undefined>(undefined);
	let deleteDialogOpen = $state(false);

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
				toast(msg('passkeyRenameFailed' as never), res.message?.[lang] ?? res.message?.en, 'error');
			}
		} catch (e) {
			toast(msg('passkeyRenameFailed' as never), e instanceof Error ? e.message : String(e), 'error');
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
				toast(msg('passkeyDeleteFailed' as never), res.message?.[lang] ?? res.message?.en, 'error');
			}
		} catch (e) {
			toast(msg('passkeyDeleteFailed' as never), e instanceof Error ? e.message : String(e), 'error');
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
		passkeySupported =
			typeof window !== 'undefined' &&
			typeof (window as { PublicKeyCredential?: unknown }).PublicKeyCredential !== 'undefined' &&
			browserSupportsWebAuthn();
		if (passkeySupported) void loadCredentials();
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
</section>

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
</style>
