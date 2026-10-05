<script lang="ts">
	// src/lib/components/element/popover/Root.svelte
	// Popover.Root — wrapper (position:relative) giữ state `open` (bindable) +
	// Symbol context + outside-click / Escape + intent hover (timers). Trigger &
	// Content là slot, đọc context. Fork lifecycle từ dropdown-menu (id Math.random,
	// focus trả trigger rAF) nhưng content là role="dialog" (không phải menu).
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { styleSynced } from '$modules';
	import { setPopoverContext } from './_context';
	import type { PopoverConfigs, PopoverRootProps } from './_interface';

	let {
		defaultOpen = false,
		// Uncontrolled: khởi tạo từ defaultOpen; Controlled (bind:open): parent thắng.
		open = $bindable(defaultOpen),
		trigger = 'click',
		position = 'start',
		'aria-label': ariaLabel,
		children,
		...props
	}: PopoverRootProps = $props();

	let rootEl: HTMLDivElement;

	// id nội bộ (SSR an toàn — không phụ thuộc crypto).
	const rootId = `pv-root-${Math.random().toString(36).slice(2, 10)}`;
	const contentId = `pv-content-${Math.random().toString(36).slice(2, 10)}`;

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = ['popover-root'];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Timers intent hover (chỉ active khi trigger="hover"); cleanup onDestroy.
	let showTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	function clearTimers() {
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
	}

	const configs: PopoverConfigs = $state({
		ref: undefined,
		rootId,
		contentId,
		get open() {
			return open;
		},
		get trigger() {
			return trigger;
		},
		get position() {
			return position;
		},
		get delay() {
			return props.delay;
		},
		rootRef: undefined,
		triggerRef: undefined,
		setOpen(v: boolean) {
			open = v;
		},
		toggle() {
			open = !open;
		},
		/** đóng + trả focus về control trigger (click/hover mode).
		 *  Focus mode KHÔNG refocus — focusin lên trigger sẽ mở lại (loop). */
		close() {
			clearTimers();
			open = false;
			if (trigger !== 'focus') {
				requestAnimationFrame(() => {
					rootEl
						?.querySelector<HTMLElement>
						('[data-pv-trigger] button, [data-pv-trigger] a[href], [data-pv-trigger] [tabindex]:not([tabindex="-1"])')
						?.focus();
				});
			}
		},
		/** intent hover — gọi từ Trigger (enter/leave trigger) và Content
		 *  (enter/leave content) để user được đưa chuột vào panel đọc. */
		hoverEnter() {
			if (trigger !== 'hover') return;
			clearTimeout(hideTimer);
			if (open) return;
			showTimer = setTimeout(() => {
				open = true;
			}, props.delay?.show ?? 200);
		},
		hoverLeave() {
			if (trigger !== 'hover') return;
			clearTimeout(showTimer);
			hideTimer = setTimeout(() => {
				open = false;
			}, props.delay?.hide ?? 150);
		}
	});

	$effect(() => {
		configs.ref = rootEl;
		configs.rootRef = rootEl;
	});

	setPopoverContext(configs);
	export { configs };

	onDestroy(() => clearTimers());

	// Outside-click: chỉ lắng nghe khi đang open (track `open` để tự mount/unmount).
	$effect(() => {
		if (!browser || !open) return;
		function onMousedown(e: MouseEvent) {
			if (rootEl && !rootEl.contains(e.target as Node)) configs.close();
		}
		document.addEventListener('mousedown', onMousedown);
		return () => document.removeEventListener('mousedown', onMousedown);
	});

	// Escape (đóng + focus trả trigger ở click/hover mode).
	$effect(() => {
		if (!browser || !open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				configs.close();
			}
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

<div
	class={styleDerived}
	aria-label={ariaLabel}
	bind:this={rootEl}
	data-pv-root
	data-open={open || undefined}
	data-trigger={trigger}
>
	{@render children?.()}
</div>

<style lang="scss">
	.popover-root {
		--popover-gap: 8px;
		position: relative;
		display: inline-flex;
	}
</style>
