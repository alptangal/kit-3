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
		padding: var(--padding-md) var(--padding-lg);
		background: var(--background);
		border-bottom: var(--border-width) solid var(--border, rgb(255 255 255 / 0.08));
		min-height: var(--min-height-lg);
		width: 100%;

		&__left {
			display: flex;
			align-items: center;
			gap: var(--gap-md);
		}
		&__right {
			display: flex;
			align-items: center;
			gap: var(--gap-md);
		}
		&__avatar {
			width: var(--min-height-md);
			height: var(--min-height-md);
			border-radius: var(--radius-full);
			object-fit: cover;
		}
		&__name {
			font-size: var(--font-size-sm);
			font-weight: 500;
			color: var(--foreground);
		}
		&__role {
			font-size: var(--font-size-xs);
			color: var(--foreground-400);
			background: var(--foreground-200);
			padding: var(--padding-xs) var(--padding-sm);
			border-radius: var(--radius-full);
		}
		&__icon-btn {
			position: relative;
			background: transparent;
			border: none;
			cursor: pointer;
			padding: var(--padding-xs);
			color: var(--foreground);
			border-radius: var(--radius-sm);
			&:hover {
				background: var(--foreground-200);
			}
			&--logout:hover {
				background: var(--danger-500);
			}
		}
		&__icon {
			font-size: var(--font-size-lg);
		}
		&__badge {
			position: absolute;
			top: calc(var(--padding-xs) * -1);
			right: calc(var(--padding-xs) * -1);
			background: var(--danger-500);
			color: var(--color-white);
			font-size: var(--font-size-xs);
			font-weight: 600;
			min-width: var(--min-height-xs);
			height: var(--min-height-xs);
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: var(--radius-full);
		}
		&__placeholder {
			color: var(--foreground-400);
			font-size: var(--font-size-sm);
		}
	}
</style>