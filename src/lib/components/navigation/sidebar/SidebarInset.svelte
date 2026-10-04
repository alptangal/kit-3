<script lang="ts">
	// SidebarInset — main content nằm ngay cạnh Sidebar (cùng Provider).
	// flex:1, min-width 0 (tránh overflow), tự scroll.
	import type { SidebarSectionProps } from './_interface';

	let { children, ...props }: SidebarSectionProps = $props();
</script>

<div class="sidebar-inset">
	{@render children?.()}
</div>

<style lang="scss">
	// Main content cạnh sidebar — flex:1, min-width 0, tự scroll dọc.
	.sidebar-inset {
		flex: 1;
		min-width: 0;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
</style>
