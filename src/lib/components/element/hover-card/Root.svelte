<script lang="ts">
	// src/lib/components/element/hover-card/Root.svelte
	// HoverCard.Root — wrapper (position:relative) giữ state `open` (bindable) +
	// Symbol context + intent timers: show (delay, default 300ms) / hide (150ms).
	// Timers nằm trong Root; Trigger/Content gọi show/hide/cancelShow/cancelHide.
	// Cleanup cả 2 timer onDestroy. ESC → hide (giữ mở khi open).
	import { browser } from '$app/environment';
	import { onDestroy } from 'svelte';
	import { convertToMiliseconds, styleSynced } from '$modules';
	import { setHoverCardContext } from './_context';
	import type { HoverCardConfigs, HoverCardRootProps } from './_interface';

	const HIDE_DELAY = 150; // cố định (đối xứng popover hover hide)

	let {
		// Uncontrolled: ban đầu closed; Controlled (bind:open): parent thắng.
		open = $bindable(false),
		'aria-label': ariaLabel,
		children,
		...props
	}: HoverCardRootProps = $props();

	let rootEl: HTMLDivElement;

	// id nội bộ (SSR an toàn — không phụ thuộc crypto).
	const rootId = `hc-root-${Math.random().toString(36).slice(2, 10)}`;
	const contentId = `hc-content-${Math.random().toString(36).slice(2, 10)}`;

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = ['hover-card-root'];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	// Timers intent (show/hide); show trước khi hide → huỷ ngược (anti-flicker).
	let showTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	const configs: HoverCardConfigs = $state({
		ref: undefined,
		rootId,
		contentId,
		get open() {
			return open;
		},
		get duration() {
			return convertToMiliseconds(props.duration) ?? 200;
		},
		get showDelay() {
			return convertToMiliseconds(props.delay) ?? 300;
		},
		rootRef: undefined,
		triggerRef: undefined,
		/** mở: huỷ timer hide pending (đã rời trigger rồi quay lại) + setTimer show.
		 *  Nếu đã open: chỉ huỷ hide (keep-alive, không reset delay). */
		show() {
			clearTimeout(hideTimer);
			if (open) return;
			showTimer = setTimeout(() => {
				open = true;
			}, configs.showDelay);
		},
		/** đóng: huỷ timer show pending + setTimer hide (grace 150ms để chuột
		 *  kịp đưa vào content mà không bị chớp tắt). */
		hide() {
			clearTimeout(showTimer);
			hideTimer = setTimeout(() => {
				open = false;
			}, HIDE_DELAY);
		},
		/** huỷ cả 2 timer (focusout / mouseleave cuối / unmount). */
		cancelShow() {
			clearTimeout(showTimer);
		},
		cancelHide() {
			clearTimeout(hideTimer);
		}
	});

	$effect(() => {
		configs.ref = rootEl;
		configs.rootRef = rootEl;
	});

	setHoverCardContext(configs);
	export { configs };

	onDestroy(() => {
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
	});

	// ESC → hide (content role="tooltip" không bắt focus, listener global khi open).
	$effect(() => {
		if (!browser || !open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				configs.hide();
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
	data-hc-root
	data-open={open || undefined}
>
	{@render children?.()}
</div>

<style lang="scss">
	.hover-card-root {
		--hover-card-gap: 8px;
		position: relative;
		display: inline-flex;
	}
</style>
