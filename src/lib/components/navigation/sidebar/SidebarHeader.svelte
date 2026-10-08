<script lang="ts">
	// SidebarHeader — brand/logo + title, hoặc slot tùy biến (team switcher, trigger).
	import type { SidebarSectionProps } from './_interface';

	let { children, ...props }: SidebarSectionProps = $props();
</script>

<div class="sidebar-header">
	{@render children?.()}
</div>

<style lang="scss">
	// Brand/logo + trigger — scoped: slot con nhận hash của SidebarHeader (Svelte 5).
	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding-block: 1rem;
		min-height: 3.5rem;
	}
</style>
