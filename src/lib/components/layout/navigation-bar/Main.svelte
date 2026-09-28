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

	function hasRole(roles?: string[]): boolean {
		if (!roles || roles.length === 0) return true;
		const userRoles = (window as any).__userRoles ?? [];
		return roles.some(r => userRoles.includes(r));
	}

	let isMobile = $derived(client.browser?.isMobile ?? false);
	let filteredItems = $derived(configs.items.filter(item => hasRole(item.roles)));
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
	{#if isMobile}
		<!-- Mobile: Overlay drawer -->
		{#if configs.isOpen}
			<div class="nav-overlay" on:click={() => (configs.isOpen = false)} />
		{/if}
		<div class="nav-sidebar {configs.isOpen ? 'nav-sidebar--open' : ''}">
			<div class="nav-brand">{#if configs.brand}{configs.brand}{/if}</div>
			<div class="nav-list">
				{#each filteredItems as item, i}
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
				{/each}
			</div>
		</div>
		<button class="nav-toggle" aria-label="Toggle navigation" on:click={() => configs.isOpen = !configs.isOpen}>
			<span class="nav-toggle-icon" aria-hidden="true">☰</span>
		</button>
	{:else}
		<!-- Desktop: Sidebar -->
		<div class="nav-sidebar nav-sidebar--desktop">
			<div class="nav-brand">{#if configs.brand}{configs.brand}{/if}</div>
			<div class="nav-list">
				{#each filteredItems as item, i}
					<a
						href={item.href}
						class="nav-item {item.active ? 'nav-item--active' : ''}"
						on:click={() => props.onToggle?.()}
					>
						{#if item.icon}<span class="nav-icon">{item.icon}</span>{/if}
						<span class="nav-label">{item.label}</span>
					</a>
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
		width: var(--nav-width, 16rem);
		background: var(--background);
		border-right: var(--border-width) solid var(--border, rgb(255 255 255 / 0.08));
		display: flex;
		flex-direction: column;
		transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
		z-index: 1000;
		overflow-y: auto;
		overflow-x: hidden;

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
			gap: var(--gap-sm);
			padding: var(--padding-md);
			border-bottom: var(--border-width) solid var(--border, rgb(255 255 255 / 0.08));
			font-size: var(--font-size-xl);
			font-weight: 600;
			color: var(--foreground);
		}

		&__list {
			flex: 1;
			display: flex;
			flex-direction: column;
			padding: var(--gap-sm) 0;
		}

		&__item {
			display: flex;
			align-items: center;
			gap: var(--gap-md);
			padding: var(--padding-sm) var(--padding-md);
			color: var(--foreground);
			text-decoration: none;
			font-size: var(--font-size-sm);
			border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
			transition: background-color 0.2s, transform 0.2s;
			margin-left: calc(var(--padding-sm) * -1);

			&:hover {
				background: var(--foreground-200);
				transform: translateX(var(--gap-sm));
			}

			&--active {
				background: var(--foreground-200);
				margin-left: 0;
				font-weight: 500;
			}
		}

		&__icon {
			font-size: var(--font-size-md);
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
		top: var(--padding-md);
		left: var(--padding-md);
		width: var(--min-height-lg);
		height: var(--min-height-lg);
		background: var(--background);
		border: var(--border-width) solid var(--border, rgb(255 255 255 / 0.08));
		border-radius: var(--radius-sm);
		cursor: pointer;
		z-index: 1001;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;

		&:hover {
			background: var(--foreground-200);
		}

		@media (max-width: 768px) {
			display: flex;
		}
	}

	.nav-toggle-icon {
		font-size: var(--font-size-2xl);
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