<script lang="ts">
	// SidebarHeader — brand/logo + title, hoặc slot tùy biến (team switcher, trigger).
	import type { SidebarSectionProps } from './_interface';

	let { children, ...props }: SidebarSectionProps = $props();
</script>

<div class="sidebar-header">
	{@render children?.()}
</div>

<style lang="scss">
	// Brand/logo + trigger — scoped: slot con nhận hash của SidebarHeader (Svelte 5).
	// Yêu cầu 8: bỏ padding-block 1rem + min-height 3.5rem → header gọn, tiết
	// kiệm chiều dọc (row brand + trigger nằm trong header không cần khoảng đệm
	// riêng — khoảng cách do .sidebar gap + padding item đảm nhiệm). Demo
	// /ui/sidebar dùng chung — cùng độ gọn.
	.sidebar-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding-block: 0.25rem;
		min-height: 0;
	}
</style>
