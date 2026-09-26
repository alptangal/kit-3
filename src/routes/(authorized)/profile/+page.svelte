<!-- src/routes/(authorized)/profile/+page.svelte -->
<script lang="ts">
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
		}
	};

	const displayName = $derived(
		[data.user.lastName, data.user.firstName].filter(Boolean).join(' ') || data.user.username || '—'
	);
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
</section>

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
</style>
