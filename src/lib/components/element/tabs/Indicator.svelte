<script lang="ts">
	// src/lib/components/element/tabs/Indicator.svelte
	// Tabs.Indicator — vạch trượt (chỉ render khi type='underline', List gate).
	// Absolute trong tablist (position:relative): horizontal → bottom 0 (left/width
	// theo trigger active); vertical → left 0 (top/height). Position tính từ
	// triggerRefs[activeValue].offsetLeft/offsetWidth (rAF sau activeValue đổi) +
	// ResizeObserver (listEl) + window resize (cleanup onDestroy).
	// `left`/`width`/`top`/`height` transition qua var(--duration) (Root truyền
	// inline); prefers-reduced-motion → transition none (CSS).
	import { getTabsContext } from './_context';

	const ctx = getTabsContext();

	// pos readonly: left/width (horizontal) · top/height (vertical); ready = đã đo
	// lần đầu (tránh "trượt từ 0" khi mount).
	let pos = $state({ left: 0, width: 0, top: 0, height: 0, ready: false, visible: false });

	const isVertical = $derived(ctx?.orientation === 'vertical');

	function measure() {
		if (!ctx) return;
		const active = ctx.activeValue;
		const ref = active ? ctx.triggerRefs.get(active) : undefined;
		if (!ref) {
			pos = { ...pos, visible: false };
			return;
		}
		pos = {
			left: ref.offsetLeft,
			width: ref.offsetWidth,
			top: ref.offsetTop,
			height: ref.offsetHeight,
			ready: true,
			visible: true
		};
	}

	// activeValue đổi (hay mount) → đo lại (rAF để layout settle).
	$effect(() => {
		const v = ctx?.activeValue;
		if (!v) return;
		const raf = requestAnimationFrame(measure);
		return () => cancelAnimationFrame(raf);
	});

	// Resize list (font load / đổi kích thước) + resize window.
	$effect(() => {
		const list = ctx?.listEl;
		if (!list || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(measure);
		ro.observe(list);
		window.addEventListener('resize', measure);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', measure);
		};
	});
</script>

{#if pos.visible}
	<div
		class="tabs-indicator"
		class:ready={pos.ready}
		class:vertical={isVertical}
		aria-hidden="true"
		style:left={pos.left ? `${pos.left}px` : undefined}
		style:width={pos.width ? `${pos.width}px` : undefined}
		style:top={isVertical ? `${pos.top}px` : undefined}
		style:height={isVertical ? `${pos.height}px` : undefined}
	></div>
{/if}

<style lang="scss">
	.tabs-indicator {
		position: absolute;
		bottom: 0;
		left: 0;
		height: 2px;
		width: 0;
		border-radius: var(--border-radius-full, 999px);
		background-color: var(--primary, var(--foreground));
		pointer-events: none;
		transition:
			left var(--duration, 300ms) cubic-bezier(0.65, 0, 0.35, 1),
			width var(--duration, 300ms) cubic-bezier(0.65, 0, 0.35, 1),
			top var(--duration, 300ms) cubic-bezier(0.65, 0, 0.35, 1),
			height var(--duration, 300ms) cubic-bezier(0.65, 0, 0.35, 1);

		// mount: không animate lần đo đầu (tránh trượt từ left:0)
		&:not(.ready) {
			transition: none;
		}

		&.vertical {
			bottom: auto;
			top: 0;
			left: 0;
			width: 2px;
			height: 0;
		}

		@media (prefers-reduced-motion: reduce) {
			transition: none;
		}
	}
</style>
