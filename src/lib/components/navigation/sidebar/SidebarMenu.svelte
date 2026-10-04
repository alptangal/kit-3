<script lang="ts">
	// SidebarMenu — danh sách item trong group (li ngữ cảnh).
	import type { SidebarMenuProps } from './_interface';

	let { children, ...props }: SidebarMenuProps = $props();
</script>

<ul class="sidebar-menu" role="list">
	{@render children?.()}
</ul>

<style lang="scss">
	.sidebar-menu {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
</style>
