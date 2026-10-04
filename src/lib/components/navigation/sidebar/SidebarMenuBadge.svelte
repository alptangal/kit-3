<script lang="ts">
	// SidebarMenuBadge — con số / chip nhỏ ở đuôi menu item.
	import type { SidebarMenuBadgeProps } from './_interface';

	let { children, ...props }: SidebarMenuBadgeProps = $props();
</script>

<span class="sidebar-menu-badge">
	{@render children?.()}
</span>

<style lang="scss">
	.sidebar-menu-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 600;
		background: var(--primary, var(--color-indigo-500, hsl(243 75% 59%)));
		color: #fff;
	}
</style>
