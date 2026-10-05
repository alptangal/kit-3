<script lang="ts">
	// src/lib/components/element/popover/Trigger.svelte
	// Popover.Trigger — span wrapper bọc control do user tự render (button/link).
	// Không tự render button (khác dropdown-menu) vì popover trigger thường là
	// avatar/menu-dots/sửa-đăng — user kiểm soát markup. ARIA (aria-haspopup=
	// "dialog" + aria-expanded + aria-controls) gắn lên span — assertable bởi probe
	// P1. Intent theo mode trigger:
	//   click → onclick (bubble từ control con) toggle;
	//   hover → mouseenter/mouseleave (timers intent nằm trong Root.configs);
	//   focus → focusin mở / focusout đóng (guard: focus chuyển vào content thì KHÔNG đóng).
	import { styleSynced } from '$modules';
	import { getPopoverContext } from './_context';
	import type { PopoverTriggerProps } from './_interface';

	let {
		disabled = false,
		children,
		'aria-label': ariaLabel,
		...props
	}: PopoverTriggerProps = $props();

	const ctx = getPopoverContext();
	const open = $derived(ctx?.open ?? false);
	const triggerMode = $derived(ctx?.trigger ?? 'click');

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'popover-trigger',
			`mode-${triggerMode}`,
			disabled ? 'disabled' : undefined,
			open ? 'open' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function handleMouseEnter() {
		if (disabled || !ctx || triggerMode !== 'hover') return;
		ctx.hoverEnter();
	}
	function handleMouseLeave() {
		if (!ctx || triggerMode !== 'hover') return;
		ctx.hoverLeave();
	}
	function handleFocusIn() {
		if (disabled || !ctx || triggerMode !== 'focus') return;
		ctx.setOpen(true);
	}
	function handleFocusOut(e: FocusEvent) {
		if (!ctx || triggerMode !== 'focus') return;
		// Focus chuyển sang content (panel) thì không đóng — giữ mở để user thao tác.
		const related = e.relatedTarget as Node | null;
		if (related && ctx.rootRef?.contains(related)) return;
		ctx.setOpen(false);
	}
	function handleClick() {
		if (disabled || !ctx || triggerMode !== 'click') return;
		ctx.toggle();
	}
</script>

<span
	data-pv-trigger
	class={styleDerived}
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-controls={ctx?.contentId}
	aria-label={ariaLabel}
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
	onfocusin={handleFocusIn}
	onfocusout={handleFocusOut}
	onclick={handleClick}
	{...props}
>
	{@render children?.()}
</span>

<style lang="scss">
	.popover-trigger {
		position: relative;
		display: inline-flex;
		align-items: center;

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			pointer-events: none;
		}
	}
</style>
