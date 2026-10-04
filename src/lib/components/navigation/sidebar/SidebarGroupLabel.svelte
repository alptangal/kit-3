<script lang="ts">
	// SidebarGroupLabel — tiêu đề nhóm (uppercase, muted).
	import type { SidebarGroupLabelProps } from './_interface';

	let { children, ...props }: SidebarGroupLabelProps = $props();
</script>

<div class="sidebar-group-label">
	{@render children?.()}
</div>

<style lang="scss">
	.sidebar-group-label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.025em;
		text-transform: uppercase;
		color: var(--muted, var(--foreground));
		padding: 0.375rem 0.75rem;
	}
</style>
