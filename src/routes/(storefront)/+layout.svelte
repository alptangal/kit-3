// src/routes/(storefront)/+layout.svelte
// Layout công khai tối giản cho storefront (Phase 5): header logo + nav,
// footer. KHÔNG yêu cầu đăng nhập — nhưng vẫn hiện link Tài khoản/Quản trị
// nếu locals.user đã có session.
<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { STOREFRONT_CONTENTS, sf } from './_interface';
	import type { Snippet } from 'svelte';
	import type { LayoutProps } from './$types';
	import { page as pageStore } from '$app/state';

	let { children }: LayoutProps & { children: Snippet } = $props();

	// Ngôn ngữ theo browser client (pattern admin pages).
	const lang: 'vi' | 'en' = $derived(
		client.browser?.language === 'vi' ? 'vi' : 'en'
	);

	const t = STOREFRONT_CONTENTS;

	// session user từ +layout.server.ts (null khi anonymous).
	const user = $derived(pageStore.data?.user as { userId?: string } | null | undefined);
	const isLoggedIn = $derived(!!user?.userId);

	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		get style() {
			const defaultStyles: string[] = ['storefront-layout', 'min-h-dvh', 'w-full'];
			return styleSynced({ defaultStyles });
		}
	});
</script>

<div bind:this={configs.ref} class={configs.style}>
	<header class="storefront-header">
		<div class="storefront-header-inner">
			<a href="/store" class="storefront-logo">
				<span class="storefront-logo-mark">{sf(t.layout.brand, lang)}</span>
			</a>
			<nav class="storefront-nav">
				<a href="/store/products" class="storefront-nav-link">{sf(t.layout.navProducts, lang)}</a>
				<a href="/store/search" class="storefront-nav-link storefront-nav-search" aria-label={sf(t.layout.navSearch, lang)}>
					{sf(t.layout.navSearch, lang)}
				</a>
				<a href="/store/cart" class="storefront-nav-link storefront-nav-cart">
					{sf(t.layout.navCart, lang)}
				</a>
				{#if isLoggedIn}
					<a href="/store/account" class="storefront-nav-link storefront-nav-account">
						{sf(t.layout.navAccount, lang)}
					</a>
					<a href="/store/account" class="storefront-nav-link storefront-nav-orders">
						{sf(t.layout.navOrders, lang)}
					</a>
				{:else}
					<a href="/login" class="storefront-nav-link">{sf(t.layout.navAccount, lang)}</a>
				{/if}
			</nav>
		</div>
	</header>

	<main class="storefront-main">
		{@render children()}
	</main>

	<footer class="storefront-footer">
		<p>{sf(t.layout.footerNote, lang)}</p>
	</footer>
</div>

<style lang="scss">
	.storefront-layout {
		min-height: 100dvh;
		width: 100%;
		display: flex;
		flex-direction: column;
		background: var(--background, #fafafa);
		color: var(--foreground, #111);
	}

	.storefront-header {
		width: 100%;
		border-bottom: 1px solid var(--border, #e5e5e5);
		background: var(--background, #fff);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.storefront-header-inner {
		max-width: 1120px;
		margin: 0 auto;
		padding: 0.875rem 1.25rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.storefront-logo {
		text-decoration: none;
		font-weight: 700;
		font-size: 1.15rem;
		color: var(--foreground, #111);
	}

	.storefront-logo-mark {
		letter-spacing: 0.02em;
	}

	.storefront-nav {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.storefront-nav-link {
		text-decoration: none;
		color: var(--muted-foreground, #555);
		font-size: 0.925rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;

		&:hover {
			color: var(--foreground, #111);
		}
	}

	.storefront-nav-icon {
		display: inline-flex;
	}

	.storefront-main {
		flex: 1;
		width: 100%;
		max-width: 1120px;
		margin: 0 auto;
		padding: 2rem 1.25rem 3rem;
	}

	.storefront-footer {
		width: 100%;
		border-top: 1px solid var(--border, #e5e5e5);
		padding: 1.25rem;
		text-align: center;
		color: var(--muted-foreground, #777);
		font-size: 0.85rem;
	}
</style>
