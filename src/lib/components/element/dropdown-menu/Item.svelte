<script lang="ts">
	// src/lib/components/element/dropdown-menu/Item.svelte
	// DropdownMenu.Item — mục menu (role="menuitem", native button). Click/Enter/Space
	// → gọi onselect rồi đóng menu (ctx.close). Disabled: aria-disabled + không activate.
	// variant destructive (đỏ), inset (lùi). leading/trailing là snippet.
	import { styleSynced } from '$modules';
	import { getDropdownMenuContext } from './_context';
	import type { DropdownMenuItemProps } from './_interface';

	let {
		disabled = false,
		inset = false,
		variant = 'default',
		onselect,
		leading,
		trailing,
		children,
		onclick: onClick,
		...props
	}: DropdownMenuItemProps = $props();

	const ctx = getDropdownMenuContext();

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'dropdown-menu-item',
			disabled ? 'disabled' : undefined,
			inset ? 'inset' : undefined,
			variant === 'destructive' ? 'destructive' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function activate(e: MouseEvent) {
		if (disabled) return;
		onClick?.(e);
		onselect?.(e);
		ctx?.close();
	}
</script>

<button
	type="button"
	role="menuitem"
	data-dm-item
	data-dm-item-disabled={disabled || undefined}
	class={styleDerived}
	aria-disabled={disabled || undefined}
	tabindex={disabled ? -1 : 0}
	onclick={(e) => activate(e)}
	{...props}
>
	{#if leading}
		<span class="leading" aria-hidden="true">{@render leading()}</span>
	{/if}
	{#if children}
		<span class="label">{@render children()}</span>
	{/if}
	{#if trailing}
		<span class="trailing" aria-hidden="true">{@render trailing()}</span>
	{/if}
</button>

<style lang="scss">
	.dropdown-menu-item {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: var(--foreground);
		background: transparent;
		border: 0;
		border-radius: var(--border-radius-sm, 0.25rem);
		cursor: pointer;
		text-align: left;
		transition: background-color var(--transition-duration, 150ms) ease;

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500);
			outline-offset: -2px;
		}

		@media (hover: hover) and (pointer: fine) {
			&:not(.disabled):hover {
				background-color: var(--content2, hsl(240 4.8% 96%));
			}
		}

		.leading,
		.trailing {
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			width: 1rem;
			color: var(--muted, var(--foreground));
		}

		.label {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&.inset {
			padding-left: 1.375rem;
		}

		&.destructive {
			color: var(--destructive, hsl(0 72% 51%));

			.leading,
			.trailing {
				color: currentColor;
			}

			@media (hover: hover) and (pointer: fine) {
				&:not(.disabled):hover {
					background-color: color-mix(in srgb, var(--destructive, hsl(0 72% 51%)) 12%, transparent);
				}
			}
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: not-allowed;
			pointer-events: none;
		}
	}
</style>
