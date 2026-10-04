<script lang="ts">
	// src/lib/components/element/context-menu/Root.svelte
	// ContextMenu.Root — wrapper quanh "target" (mọi children = vùng bị right-click).
	// Giữ state `open` (bindable), `pos` (điểm chuột), `target` (element bị click)
	// + Symbol context + outside-click / Escape / Tab. right-click (contextmenu)
	// trên target: preventDefault (ngăn menu native) + mở menu tại điểm chuột.
	// NOTE: open luôn do right-click điều khiển (uncontrolled-open); nếu user bind:open
	// thì Root vẫn sync `open = true` khi right-click (không để state cha cản mở menu).
	import { browser } from '$app/environment';
	import { styleSynced } from '$modules';
	import { setContextMenuContext } from './_context';
	import type { ContextMenuConfigs, ContextMenuRootProps } from './_interface';

	let {
		open = $bindable(false),
		'aria-label': ariaLabel,
		children,
		...props
	}: ContextMenuRootProps = $props();

	let rootEl: HTMLDivElement;

	// id nội bộ (liên kết aria-controls); Math.random SSR an toàn (mirror dropdown).
	const rootId = `cm-root-${Math.random().toString(36).slice(2, 10)}`;
	const contentId = `cm-content-${Math.random().toString(36).slice(2, 10)}`;

	// Điểm chuột + element bị right-click (cho use case per-target + trả focus khi đóng).
	let pos = $state({ x: 0, y: 0 });
	let targetEl = $state<HTMLElement | undefined>(undefined);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = ['context-menu-root'];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	let configs: ContextMenuConfigs = $state({
		ref: undefined,
		get rootId() {
			return rootId;
		},
		get contentId() {
			return contentId;
		},
		get open() {
			return open;
		},
		get pos() {
			return pos;
		},
		get target() {
			return targetEl;
		},
		/**
		 * Đóng menu. `restoreFocus` (mặc định true — Escape / chọn item) trả focus về
		 * target bị right-click; outside-click gọi `close(false)` để không "nuốt" focus.
		 */
		close(restoreFocus = true) {
			open = false;
			if (restoreFocus) {
				const t = targetEl;
				requestAnimationFrame(() => t?.focus?.({ preventScroll: true }));
			}
		}
	});

	$effect(() => {
		configs.ref = rootEl;
	});

	setContextMenuContext(configs);
	export { configs };

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault(); // chặn menu native
		e.stopPropagation();
		pos = { x: e.clientX, y: e.clientY };
		targetEl = (e.target as HTMLElement) ?? rootEl;
		open = true; // uncontrolled-open: luôn mở (kể cả khi parent bind:open)
	}

	// Outside-click (mousedown trái bên ngoài root) → đóng, KHÔNG trả focus
	// (chuẩn: focus đi theo click mới). Chỉ mount khi đang open.
	$effect(() => {
		if (!browser || !open) return;
		function onMousedown(e: MouseEvent) {
			if (rootEl && !rootEl.contains(e.target as Node)) open = false;
		}
		document.addEventListener('mousedown', onMousedown);
		return () => document.removeEventListener('mousedown', onMousedown);
	});

	// Escape (đóng + focus trả target) / Tab (đóng, cho focus rời đi).
	$effect(() => {
		if (!browser || !open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				configs.close(true);
			} else if (e.key === 'Tab') {
				open = false;
			}
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- contextmenu là hành vi CÓ chủ đích trên toàn target (mọi children = target);
     element target con (row/card) có tabindex=0 để nhận focus trả về khi đóng. -->
<div
	class={styleDerived}
	id={rootId}
	aria-label={ariaLabel}
	data-open={open || undefined}
	bind:this={rootEl}
	oncontextmenu={handleContextMenu}
>
	{@render children?.()}
</div>

<style lang="scss">
	.context-menu-root {
		display: block;
	}
</style>
