<script lang="ts">
	// src/lib/components/element/dropdown-menu/Trigger.svelte
	// DropdownMenu.Trigger — nút mở/đóng menu. Toggle qua context; ARIA:
	// aria-haspopup="menu" + aria-expanded + aria-controls (contentId từ context).
	import { styleSynced } from '$modules';
	import { getDropdownMenuContext } from './_context';
	import type { DropdownMenuTriggerProps } from './_interface';

	let {
		disabled = false,
		children,
		onclick: onClick,
		...props
	}: DropdownMenuTriggerProps = $props();

	const ctx = getDropdownMenuContext();
	const open = $derived(ctx?.open ?? false);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'dropdown-menu-trigger',
			disabled ? 'disabled' : undefined,
			open ? 'open' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function handleClick(e: MouseEvent) {
		onClick?.(e);
		if (disabled || !ctx) return;
		e.stopPropagation();
		ctx.toggle();
	}
</script>

<button
	type="button"
	data-dm-trigger
	{disabled}
	aria-haspopup="menu"
	aria-expanded={open}
	aria-controls={ctx?.contentId}
	class={styleDerived}
	onclick={handleClick}
	{...props}
>
	{@render children?.()}
</button>

<style lang="scss">
	.dropdown-menu-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: flex-start;
		min-height: 2.25rem;
		padding: 0 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.25rem;
		color: var(--foreground);
		background: transparent;
		border: 0;
		border-radius: var(--border-radius-md, 0.375rem);
		cursor: pointer;
		user-select: none;
		transition: background-color var(--transition-duration, 150ms) ease;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: 2px;
		}

		@media (hover: hover) and (pointer: fine) {
			&:not(.disabled):hover {
				background-color: var(--content2, hsl(240 4.8% 96%));
			}
		}

		&.open {
			background-color: var(--content2, hsl(240 4.8% 96%));
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: not-allowed;
			pointer-events: none;
		}
	}
</style>
