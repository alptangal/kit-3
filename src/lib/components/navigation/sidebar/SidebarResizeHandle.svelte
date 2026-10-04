<script lang="ts">
	// src/lib/components/navigation/sidebar/SidebarResizeHandle.svelte
	// P2 — handle kéo thay đổi độ rộng sidebar (dán mép PHẢI <aside>, desktop only).
	// Pointer events + setPointerCapture: giữ bắt move/up dù chuột rời handle,
	// không cần listener document thủ công (tránh leak + conflict với auto-flip).
	// Mobile: không render (aside offcanvas có width cố định, không resize).
	import { getSidebarContext } from './_context';
	import type { SidebarResizeHandleProps } from './_interface';

	let { 'aria-label': ariaLabel = 'Resize sidebar', ...props }: SidebarResizeHandleProps = $props();

	const ctx = getSidebarContext();
	// Chỉ hiện khi desktop (không mobile). Provider + handle render trong <aside>
	// nên đọc được context (mobile → ctx.isMobile true → ẩn). User tắt resize
	// bằng collapsible prop 'resizable={false}' trên Provider (ctx.resizable).
	const show = $derived(!!ctx && !ctx.isMobile && ctx.resizable !== false);

	function onPointerDown(e: PointerEvent) {
		if (!ctx || !show) return;
		e.preventDefault();
		// Bắt capture TRÊN handle (rất ngắn, scope gọn, không document-level)
		(e.target as Element).setPointerCapture?.(e.pointerId);
		ctx.startResize(e.clientX);
	}

	function onPointerMove(e: PointerEvent) {
		if (!ctx) return;
		ctx.applyResize(e.clientX);
	}

	function onPointerUp(e: PointerEvent) {
		if (!ctx) return;
		(e.target as Element).releasePointerCapture?.(e.pointerId);
		ctx.endResize();
	}

	function onKeydown(e: KeyboardEvent) {
		// A11y: phím mũi tên đổi width ±16px (ghim trong Provider clamp 200–480).
		if (!ctx) return;
		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			e.preventDefault();
			const delta = e.key === 'ArrowRight' ? 16 : -16;
			ctx.setWidth(ctx.width + delta);
		}
	}
</script>

{#if show}
	<!-- Resize handle — <button type=button> native (interactive element thật →
	     pointer/keyboard listeners hợp lệ, không cần svelte-ignore; pattern
	     chuẩn cho panel resizable: focusable + phím mũi tên ±16px, aria-label
	     thông báo chức năng cho SR). Không role="separator": button là
	     interactive, role separator (non-interactive) sẽ bị a11y rule chặn. -->
	<button
		type="button"
		class="sidebar-resize-handle"
		class:resizing={ctx?.resizing}
		aria-label={ariaLabel}
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onkeydown={onKeydown}
	></button>
{/if}

<style lang="scss">
	/* Dán mép PHẢI aside, vertical. Hit area rộng (12px) nhưng chỉ hiện visual
	   (2px) khi hover — tránh đường kẻ sừng sỏ lúc thường. Position absolute
	   nên không bị transition width của aside làm trôi (theo từng frame). */
	.sidebar-resize-handle {
		position: absolute;
		top: 0;
		right: -4px; /* 4px ngoài mép + nằm trong aside (aside overflow visible) */
		bottom: 0;
		width: 12px;
		cursor: col-resize;
		z-index: 10;
		/* Reset default <button> (native element, tránh border/padding browser) */
		margin: 0;
		padding: 0;
		border: none;
		appearance: none;
		background: transparent;
		transition: background-color var(--transition-duration, 150ms) ease;

		&::after {
			/* Gạch visual 2px ở tâm hit area */
			content: '';
			position: absolute;
			top: 0;
			bottom: 0;
			right: 5px;
			width: 2px;
			background: transparent;
			transition: background-color var(--transition-duration, 150ms) ease;
		}

		&:hover::after,
		&.resizing::after {
			background: var(--border, hsl(0 0% 88%));
		}

		&:hover {
			background: rgb(0 0 0 / 0.02);
		}

		&.resizing {
			/* Đang kéo: cursor col-resize + gạch nổi */
			background: rgb(0 0 0 / 0.04);
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, var(--focus, hsl(243 75% 59%)));
			outline-offset: -1px;
		}
	}

	@media (prefers-color-scheme: dark) {
		.sidebar-resize-handle {
			&::after {
				transition: background-color var(--transition-duration, 150ms) ease;
			}

			&:hover::after,
			&.resizing::after {
				background: var(--border, hsl(0 0% 24%));
			}
		}
	}
</style>
