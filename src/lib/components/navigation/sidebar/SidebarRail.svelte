<script lang="ts">
	// SidebarRail — quai dọc cạnh sidebar (shadcn sidebar-07): hiện khi sidebar
	// ĐANG ẨN (icon collapsed / offcanvas closed), tap để toggle (railToggle).
	// Hiệu ứng "peek" (hover → mở rộng tạm) là CSS :hover trên .sidebar-aside
	// (icon mode) — KHÔNG qua JS, để tránh flicker: rail là absolute right:0 nên
	// trượt theo aside khi expand, dùng mouseenter/leave sẽ enter/leave liên tục.
	// tabIndex -1 theo shadcn: không vào vòng Tab (trigger trong header vẫn toggle).
	import { getSidebarContext } from './_context';
	import { styleSynced } from '$modules';
	import type { SidebarRailProps } from './_interface';

	let { 'aria-label': ariaLabel, ...props }: SidebarRailProps = $props();
	const ctx = getSidebarContext();

	const railClass = $derived(ctx?.railClass ?? 'sidebar-rail');

	const styleDerived = $derived.by(() =>
		styleSynced({ defaultStyles: [railClass], propStyles: props.class }, props.overwriteDefaultStyles)
	);

	function handleClick(e: MouseEvent) {
		props.onclick?.(e);
		ctx?.railToggle();
	}
</script>

<button
	class={styleDerived}
	type="button"
	data-sb-rail
	tabindex={-1}
	aria-label={ariaLabel ?? 'Toggle sidebar'}
	onclick={handleClick}
>
	<span class="sr-only">Toggle Sidebar</span>
</button>

<style lang="scss">
	// Quai 16px dán mép phải aside, lòi ra content 8px (16/2) khi sidebar ẩn.
	// Aside z-index 1000 → rail z-index 1001 để nổi lên content ở nửa lòi ra.
	// (RTL: mirror sang mép trái — demo hiện tại LTR nên dùng `right` cố định,
	//  đồng bộ với `left: 0` của .sidebar-aside.)
	.sidebar-rail {
		position: absolute;
		inset-block: 0;
		right: 0;
		width: 1rem;
		margin-right: -0.5rem;
		border: 0;
		border-radius: var(--border-radius-md, 0.5rem) 0 0 var(--border-radius-md, 0.5rem);
		background: transparent;
		cursor: pointer;
		z-index: 1001;
		transition:
			background-color var(--transition-duration, 300ms) ease,
			box-shadow var(--transition-duration, 300ms) ease;

		// Vạch chỉ báo màu border (hover không phải active — Rail là child,
		// không có ::before để dùng `before:` như shadcn).
		&::after {
			content: '';
			position: absolute;
			inset-block: 0;
			right: 0;
			width: 1px;
			background: transparent;
			transition: background-color var(--transition-duration, 300ms) ease;
		}

		@media (hover: hover) and (pointer: fine) {
			&:hover {
				&::after {
					background: var(--border, hsl(0 0% 88%));
				}
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, var(--focus, hsl(243 75% 59%)));
			outline-offset: 2px;
		}

		// Sidebar đang HIỆN → rail không còn tác dụng: vô hình + không nhận sự kiện.
		&.sidebar-rail-hidden {
			visibility: hidden;
			pointer-events: none;
		}

		@media (prefers-color-scheme: dark) {
			&:hover::after {
				background: var(--border, hsl(0 0% 24%));
			}
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
