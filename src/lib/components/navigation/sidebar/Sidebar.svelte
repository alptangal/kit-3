<script lang="ts">
	// src/lib/components/navigation/sidebar/Sidebar.svelte
	// Sidebar — <aside> chứa Header + Content (scroll) + Footer (qua slot).
	// Desktop: sticky 100dvh, width token. "icon" + collapsed → icon rail.
	// "offcanvas" (desktop) / mobile → overlay fixed + overlay click đóng.
	// P2: resize width (ctx.width) — style inline áp TRỰC TIẾP trên aside
	// (win cao hơn token --sb-width), CSS tắt transition khi ctx.resizing.
	// ResizeHandle render TRƯỚC slot children (để layer z-index dưới content,
	// nhưng absolute → không chiếm layout).
	import { getSidebarContext } from './_context';
	import SidebarResizeHandle from './SidebarResizeHandle.svelte';
	import type { SidebarProps } from './_interface';

	let { children, ...props }: SidebarProps = $props();
	const ctx = getSidebarContext();
	// $derived (KHÔNG const) để recompute khi Provider đổi open/collapsed/isMobile/
	// width/resizing. Fallback nếu Sidebar standalone (không Provider) — demo đơn giản.
	const state = $derived(ctx?.state ?? { open: true, collapsed: false, isMobile: false });
	const sidebarClass = $derived(ctx?.sidebarClass ?? 'sidebar-aside');
	// P3: logo ẨN khi collapsed (desktop) → class 'sidebar-logo-hidden' (demo CSS
	// ẩn .brand). Square + Y-align menu item nằm trong rule .sidebar-collapsed.
	// Animation label: CHỈ khi chế độ BẬT (ctx.labelAnimation) VÀ user vừa expand.
	const logoClass = $derived(!!ctx?.hideLogoWhenCollapsed ? 'sidebar-logo-hidden' : '');
	const labelAnimActive = $derived(!!ctx?.labelAnimActive && !!ctx?.labelAnimation);
	// Overlay chỉ khi offcanvas đang MỞ (mobile open / desktop offcanvas open).
	// Trước đây chỉ check isOffcanvasActive → mobile overlay render kể cả khi
	// sidebar đang ĐÓNG (isMobile luôn true) → fixed inset:0 che toàn trang,
	// không click được content (phát hiện khi làm admin layout B6.1 — nút
	// mobile-trigger trong inset header không bấm nổi).
	const showOverlay = $derived(!!ctx && ctx.isOffcanvasActive && state.open);

	// P2 resize: width inline + class 'sidebar-resizing' (tắt transition).
	// Mobile/offcanvas: width cố định → không áp (aside dùng token --sb-width).
	// P3: COLLAPSED (icon rail) → cũng KHÔNG áp inline: CSS --sb-width: 72px +
	// peek :hover sẽ lo width. Inline 240px ghi đè rail → item không square,
	// không căn trục Y (width là "user width khi mở", không phải width rail).
	const widthStyle = $derived(
		ctx && !ctx.isMobile && !ctx.collapsed && ctx.resizable !== false
			? `width: ${ctx.width}px;`
			: undefined
	);

	function handleOverlayClick() {
		ctx?.setOpen(false);
	}
</script>

{#if showOverlay}
	<!-- Overlay che content (mobile offcanvas / desktop offcanvas), tap để đóng -->
	<div class="sidebar-overlay" onclick={handleOverlayClick} aria-hidden="true"></div>
{/if}

<aside
	class={[sidebarClass, logoClass, labelAnimActive ? 'sidebar-label-anim' : ''].filter(Boolean).join(' ')}
	class:sidebar-resizing={!!ctx?.resizing}
	style={widthStyle}
	aria-label={props['aria-label'] ?? 'Sidebar'}
>
	<!-- P2: handle resize mép PHẢI (desktop only, tự ẩn khi mobile/resizable=false) -->
	<SidebarResizeHandle />
	{@render children?.()}
</aside>

<style lang="scss">
	@use '_styles.scss';

	/* Đang kéo resize: tắt transition width để bám sát con trỏ (không follow delay) */
	.sidebar-aside.sidebar-resizing {
		transition: transform var(--transition-duration, 300ms) cubic-bezier(0.16, 1, 0.3, 1);
	}
</style>
