<script lang="ts">
	// SidebarMenuItem — <li> wrapper cho 1 menu item.
	import type { SidebarMenuItemProps } from './_interface';

	let { children, ...props }: SidebarMenuItemProps = $props();
</script>

<li class="sidebar-menu-item">
	{@render children?.()}
</li>
