<script lang="ts">
	import type { BasicProps } from '$components/interface';
	import { goto } from '$app/navigation';
	import { client } from '$store/basic.svelte';
	import { browser } from '$app/environment';

	export interface NavigationItem {
		label: string;
		href: string;
		icon?: string;
		roles?: string[];
		active?: boolean;
	}

	export interface NavigationBarProps extends BasicProps {
		items?: NavigationItem[];
		brand?: string;
		onToggle?: () => void;
	}

	export interface NavigationBarConfigs extends BasicProps {
		items: NavigationItem[];
		brand: string;
		isOpen: boolean;
	}
</script>

<svelte:head>
	<style>
		/* Hide native scrollbar for navigation */
		.nav-sidebar::-webkit-scrollbar {
			display: none;
		}
	</style>
</svelte:head>

<div class="nav-wrapper">
	{#if client.browser?.isMobile}
		<!-- Mobile: Overlay drawer -->
		{#if configs.isOpen}
			<div class="nav-overlay" on:click={() => (configs.isOpen = false)} />
		{/if}
		<div class="nav-sidebar {configs.isOpen ? 'nav-sidebar--open' : ''}">
			<div class="nav-brand">{#if configs.brand}{configs.brand}{{/if}}</div>
			<div class="nav-list">
				{#each configs.items as item, i}
					{#if !item.roles || (item.roles && item.roles.some(r => (window as any).__userRoles?.includes(r)))}
						<a
							href={item.href}
							class="nav-item {item.active ? 'nav-item--active' : ''}"
							on:click={() => {
								configs.isOpen = false;
								if (props.onToggle) props.onToggle();
							}}
						>
							{#if item.icon}<span class="nav-icon">{item.icon}</span>{/if}
							<span class="nav-label">{item.label}</span>
						</a>
					{/if}
				{/each}
			</div>
		</div>
		<button class="nav-toggle" aria-label="Toggle navigation" on:click={() => configs.isOpen = !configs.isOpen}>
			<span class="nav-toggle-icon" aria-hidden="true">☰</span>
		</button>
	{:else}
		<!-- Desktop: Sidebar -->
		<div class="nav-sidebar nav-sidebar--desktop">
			<div class="nav-brand">{#if configs.brand}{configs.brand}{{/if}}</div>
			<div class="nav-list">
				{#each configs.items as item, i}
					{#if !item.roles || (item.roles && item.roles.some(r => (window as any).__userRoles?.includes(r)))}
						<a
							href={item.href}
							class="nav-item {item.active ? 'nav-item--active' : ''}"
							on:click={() => props.onToggle?.()}
						>
							{#if item.icon}<span class="nav-icon">{item.icon}</span>{/if}
							<span class="nav-label">{item.label}</span>
						</a>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.nav-wrapper {
		position: relative;
		display: flex;
	}

	.nav-sidebar {
		position: fixed;
		top: 0;
		left: 0;
		height: 100vh;
		width: 16rem;
		background: var(--background, #09090b);
		border-right: 1px solid var(--border, rgb(255 255 255 / 0.08));
		display: flex;
		flex-direction: column;
		transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
		z-index: 1000;
		overflow-y: auto;
		overflow-x: hidden;

		--nav-width: 16rem;

		// Hidden state
		transform: translateX(-100%);
		opacity: 0;

		&--open {
			transform: translateX(0);
			opacity: 1;
		}

		&--desktop {
			transform: translateX(0);
			opacity: 1;
			// Desktop: always visible, no transition needed
		}

		&__brand {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			padding: 1rem;
			border-bottom: 1px solid var(--border, rgb(255 255 255 / 0.08));
			font-size: 1.25rem;
			font-weight: 600;
			color: var(--foreground, #f4f4f5);
		}

		&__list {
			flex: 1;
			display: flex;
			flex-direction: column;
			padding: 0.5rem 0;
		}

		&__item {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			padding: 0.75rem 1rem;
			color: var(--foreground, #f4f4f5);
			text-decoration: none;
			font-size: 0.875rem;
			border-radius: 0 0.25rem 0.25rem 0;
			transition: background-color 0.2s, padding-left 0.2s;
			margin-left: -0.5rem;

			&:hover {
				background: var(--foreground-200, #27272a);
				padding-left: 1rem;
			}

			&--active {
				background: var(--foreground-200, #27272a);
				margin-left: 0;
				font-weight: 500;
			}
		}

		&__icon {
			font-size: 1rem;
			opacity: 0.7;
		}
	}

	.nav-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 999;
	}

	.nav-toggle {
		display: none;
		position: fixed;
		top: 1rem;
		left: 1rem;
		width: 2.5rem;
		height: 2.5rem;
		background: var(--background, #09090b);
		border: 1px solid var(--border, rgb(255 255 255 / 0.08));
		border-radius: 0.25rem;
		cursor: pointer;
		z-index: 1001;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;

		&:hover {
			background: var(--foreground-200, #27272a);
		}

		@media (max-width: 768px) {
			display: flex;
		}
	}

	.nav-toggle-icon {
		font-size: 1.5rem;
	}

	.nav-label {
		display: block;
	}

	@media (max-width: 768px) {
		.nav-sidebar.nav-sidebar--open {
			transform: translateX(0);
		}
	}
</style>