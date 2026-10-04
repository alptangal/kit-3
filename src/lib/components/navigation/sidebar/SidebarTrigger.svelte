<script lang="ts">
	// SidebarTrigger — nút toggle (desktop: collapse rail; mobile: mở offcanvas).
	// Đọc context để gọi toggle; icon 3 gạch (hamburger).
	import { getSidebarContext } from './_context';
	import type { SidebarTriggerProps } from './_interface';

	let { ...props }: SidebarTriggerProps = $props();
	const ctx = getSidebarContext();

	function handle() {
		ctx?.toggle();
	}
</script>

<button
	class="sidebar-trigger"
	type="button"
	aria-label="Toggle sidebar"
	aria-expanded={ctx?.state.isMobile ? ctx.state.open : !ctx?.state.collapsed}
	onclick={handle}
>
	<svg class="trigger-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<path
			d="M4 6h16M4 12h16M4 18h16"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>
	</svg>
</button>

<style lang="scss">
	.sidebar-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 0;
		border-radius: var(--border-radius-sm, 0.375rem);
		background: transparent;
		color: var(--muted, var(--foreground));
		cursor: pointer;
		transition: background-color var(--transition-duration, 150ms) ease;

		&:hover {
			background: var(--content2, hsl(240 4.8% 96%));
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, var(--focus, hsl(243 75% 59%)));
			outline-offset: 2px;
		}

		.trigger-icon {
			width: 1.125rem;
			height: 1.125rem;
		}
	}
</style>
