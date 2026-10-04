<script lang="ts">
	// SidebarFooter — user menu / settings, dính đáy.
	import type { SidebarSectionProps } from './_interface';

	let { children, ...props }: SidebarSectionProps = $props();
</script>

<div class="sidebar-footer">
	{@render children?.()}
</div>

<style lang="scss">
	// User menu / settings — dính đáy, tách bằng border-top.
	.sidebar-footer {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.75rem;
		min-height: 3.5rem;
		border-top: var(--border-width, 1px) solid var(--border, hsl(0 0% 88%));

		@media (prefers-color-scheme: dark) {
			border-top-color: var(--border, hsl(0 0% 24%));
		}
	}
</style>
