<script lang="ts">
	// src/lib/components/element/hover-card/Trigger.svelte
	// HoverCard.Trigger — span wrapper bọc control do user tự render (button/link/
	// anchor text). Intent: mouseenter → show (delay ở Root); mouseleave → hide
	// (grace 150ms); focusin/focusout parity với chuột (keyboard a11y).
	// A11y: aria-describedby={contentId} khi open (mô tả = card).
	import { styleSynced } from '$modules';
	import { getHoverCardContext } from './_context';
	import type { HoverCardTriggerProps } from './_interface';

	let {
		disabled = false,
		children,
		'aria-label': ariaLabel,
		...props
	}: HoverCardTriggerProps = $props();

	const ctx = getHoverCardContext();
	const open = $derived(ctx?.open ?? false);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'hover-card-trigger',
			disabled ? 'disabled' : undefined,
			open ? 'open' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function handleMouseEnter() {
		if (disabled || !ctx) return;
		ctx.show();
	}
	function handleMouseLeave() {
		if (!ctx) return;
		ctx.hide();
	}
	function handleFocusIn() {
		if (disabled || !ctx) return;
		ctx.show();
	}
	function handleFocusOut() {
		if (!ctx) return;
		// Rời trigger → hide (grace 150ms cho chuột kịp vào content); nếu focus
		// chuyển sang content (focusable inside) thì content có keep-alive riêng.
		ctx.hide();
	}
</script>

<span
	data-hc-trigger
	class={styleDerived}
	aria-describedby={open ? ctx?.contentId : undefined}
	aria-label={ariaLabel}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	onfocusin={handleFocusIn}
	onfocusout={handleFocusOut}
	{...props}
>
	{@render children?.()}
</span>

<style lang="scss">
	.hover-card-trigger {
		position: relative;
		display: inline-flex;
		align-items: center;

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			pointer-events: none;
		}
	}
</style>
