<script lang="ts">
	import type { BasicProps } from '$components/interface';

	export interface MenuBarProps extends BasicProps {
		userName?: string;
		userEmail?: string;
		avatarUrl?: string;
		role?: string;
		notificationCount?: number;
		showNotifications?: boolean;
		showSettings?: boolean;
		showLogout?: boolean;
		onLogout?: () => void;
		onSettings?: () => void;
		onNotifications?: () => void;
	}

	export interface MenuBarConfigs extends BasicProps {
		userName: string;
		userEmail: string;
		avatarUrl: string;
		role: string;
		notificationCount: number;
		showNotifications: boolean;
		showSettings: boolean;
		showLogout: boolean;
	}
</script>

{#if typeof MenuBar === 'undefined'}
	<div class="menu-bar" role="banner">
		<span class="menu-bar__placeholder">MenuBar component placeholder</span>
	</div>
{:else}
	<nav class="menu-bar" role="navigation" aria-label="User menu bar">
		<div class="menu-bar__left">
			{#if configs.avatarUrl}
				<img src={configs.avatarUrl} alt="User avatar" class="menu-bar__avatar" />
			{/if}
			<span class="menu-bar__name">{configs.userName}</span>
			{#if configs.role}
				<span class="menu-bar__role">{configs.role}</span>
			{/if}
		</div>
		<div class="menu-bar__right">
			{#if configs.showNotifications}
				<button
					class="menu-bar__icon-btn"
					aria-label="Notifications"
					onclick={() => props.onNotifications?.()}
				>
					<span class="menu-bar__icon">🔔</span>
					{#if configs.notificationCount > 0}
						<span class="menu-bar__badge">{configs.notificationCount}</span>
					{/if}
				</button>
			{/if}
			{#if configs.showSettings}
				<button
					class="menu-bar__icon-btn"
					aria-label="Settings"
					onclick={() => props.onSettings?.()}
				>
					<span class="menu-bar__icon">⚙️</span>
				</button>
			{/if}
			{#if configs.showLogout}
				<button
					class="menu-bar__icon-btn menu-bar__icon-btn--logout"
					aria-label="Logout"
					onclick={() => props.onLogout?.()}
				>
					<span class="menu-bar__icon">🚪</span>
				</button>
			{/if}
		</div>
	</nav>
{/if}

<style lang="scss">
	.menu-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		background: var(--background, #09090b);
		border-bottom: 1px solid var(--border, rgb(255 255 255 / 0.08));
		min-height: 3rem;
		width: 100%;

		&__left {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
		&__right {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
		&__avatar {
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			object-fit: cover;
		}
		&__name {
			font-size: 0.875rem;
			font-weight: 500;
			color: var(--foreground, #f4f4f5);
		}
		&__role {
			font-size: 0.75rem;
			color: var(--foreground-400, #71717a);
			background: var(--foreground-200, #27272a);
			padding: 0.125rem 0.5rem;
			border-radius: var(--radius-full, 9999px);
		}
		&__icon-btn {
			position: relative;
			background: transparent;
			border: none;
			cursor: pointer;
			padding: 0.25rem;
			color: var(--foreground, #f4f4f5);
			border-radius: var(--radius-sm, 0.25rem);
			&:hover {
				background: var(--foreground-200, #27272a);
			}
			&--logout:hover {
				background: var(--danger-500, #ef4444);
			}
		}
		&__icon {
			font-size: 1.25rem;
		}
		&__badge {
			position: absolute;
			top: -0.25rem;
			right: -0.25rem;
			background: var(--danger-500, #ef4444);
			color: #fff;
			font-size: 0.625rem;
			font-weight: 600;
			min-width: 1rem;
			height: 1rem;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: var(--radius-full, 9999px);
		}
		&__placeholder {
			color: var(--foreground-400, #71717a);
			font-size: 0.875rem;
		}
	}
</style>