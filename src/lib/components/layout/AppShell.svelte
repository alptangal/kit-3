<script lang="ts">
	import { Header } from './index';
	import { MenuBar } from './menu-bar/Main.svelte';
	import { NavigationBar } from './navigation-bar/Main.svelte';
	import type { BasicProps } from '$components/interface';
	import type { NavigationItem } from './navigation-bar/Main.svelte';

	export interface AppShellProps extends BasicProps {
		userName?: string;
		userEmail?: string;
		avatarUrl?: string;
		role?: string;
		brand?: string;
		navItems?: NavigationItem[];
		notificationCount?: number;
		showNotifications?: boolean;
		showSettings?: boolean;
		onLogout?: () => void;
		onSettings?: () => void;
		onNotifications?: () => void;
	}

	let {
		userName = 'User',
		userEmail = '',
		avatarUrl = '',
		role = 'user',
		brand = 'RetailApp',
		navItems = [],
		notificationCount = 0,
		showNotifications = true,
		showSettings = true,
		onLogout,
		onSettings,
		onNotifications,
		...props
	}: AppShellProps = $props();
</script>

<div class="app-shell" data-role={role}>
	<!-- Header with MenuBar integrated -->
	<Header class="app-shell__header" as="div">
		<MenuBar
			 userName={userName}
			userEmail={userEmail}
			avatarUrl={avatarUrl}
			role={role}
			notificationCount={notificationCount}
			showNotifications={showNotifications}
			showSettings={showSettings}
			onLogout={onLogout}
			onSettings={onSettings}
			onNotifications={onNotifications}
		/>
	</Header>

	<!-- Navigation Bar (sidebar/drawer) -->
	<NavigationBar
		brand={brand}
		items={navItems}
		onToggle={() => {}}
	/>

	<!-- Main Content Area -->
	<main class="app-shell__main">
		<slot />
	</main>
</div>

<style lang="scss">
	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		background: var(--background, #09090b);
		color: var(--foreground, #f4f4f5);

		&__header {
			flex-shrink: 0;
			z-index: 100;
		}

		&__main {
			flex: 1;
			overflow-y: auto;
			padding: 1rem;
			margin-left: 16rem; // nav-sidebar width
			transition: margin-left 0.3s ease;

			@media (max-width: 768px) {
				margin-left: 0; // Mobile: nav is overlay
			}
		}
	}
</style>