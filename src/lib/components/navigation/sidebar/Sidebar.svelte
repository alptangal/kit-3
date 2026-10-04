<script lang="ts">
	// src/lib/components/navigation/sidebar/Sidebar.svelte
	// Sidebar — <aside> chứa Header + Content (scroll) + Footer (qua slot).
	// Desktop: sticky 100dvh, width token. "icon" + collapsed → icon rail.
	// "offcanvas" (desktop) / mobile → overlay fixed + overlay click đóng.
	import { getSidebarContext } from './_context';
	import type { SidebarProps } from './_interface';

	let { children, ...props }: SidebarProps = $props();
	const ctx = getSidebarContext();
	// $derived (KHÔNG const) để recompute khi Provider đổi open/collapsed/isMobile.
	// Fallback nếu Sidebar standalone (không Provider) — demo đơn giản.
	const state = $derived(ctx?.state ?? { open: true, collapsed: false, isMobile: false });
	const sidebarClass = $derived(ctx?.sidebarClass ?? 'sidebar-aside');
	const showOverlay = $derived(!!ctx && ctx.isOffcanvasActive);

	function handleOverlayClick() {
		ctx?.setOpen(false);
	}
</script>

{#if showOverlay}
	<!-- Overlay che content (mobile offcanvas / desktop offcanvas), tap để đóng -->
	<div class="sidebar-overlay" onclick={handleOverlayClick} aria-hidden="true"></div>
{/if}

<aside class={sidebarClass} aria-label={props['aria-label'] ?? 'Sidebar'}>
	{@render children?.()}
</aside>

<style lang="scss">
	@use '_styles.scss';
</style>
