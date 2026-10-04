<script lang="ts">
	// SidebarGroup — nhóm menu có label (vd "Chính", "Cấu hình").
	import type { SidebarGroupProps } from './_interface';

	let { children, ...props }: SidebarGroupProps = $props();
</script>

<div class="sidebar-group">
	{@render children?.()}
</div>

<style lang="scss">
	.sidebar-group {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
</style>
