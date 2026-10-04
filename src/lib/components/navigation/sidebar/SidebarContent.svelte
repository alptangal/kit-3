<script lang="ts">
	// SidebarContent — vùng scroll chính (chứa SidebarGroup).
	import type { SidebarSectionProps } from './_interface';

	let { children, ...props }: SidebarSectionProps = $props();
</script>

<div class="sidebar-content">
	{@render children?.()}
</div>

<style lang="scss">
	// Vùng scroll chính; group con cách nhau (slot → :global).
	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.25rem 0.75rem 1rem;

		&::-webkit-scrollbar {
			width: 6px;
		}

		&::-webkit-scrollbar-thumb {
			background: var(--border, hsl(0 0% 88%));
			border-radius: 3px;
		}

		:global(.sidebar-group) + :global(.sidebar-group) {
			margin-top: 1rem;
		}
	}
</style>
