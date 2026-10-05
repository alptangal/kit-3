<script lang="ts">
	// src/lib/components/element/context-menu/Item.svelte
	// ContextMenu.Item — mục menu (role="menuitem", native button). Click/Enter/Space
	// → gọi onselect (callback) rồi đóng menu (ctx.close + focus trả target).
	// Disabled: aria-disabled + không activate. destructive (màu danger),
	// icon (iconify, bên trái label — điều khiển kích thước qua font-size vì
	// svg iconify render inline 1em).
	import { styleSynced } from '$modules';
	import { Icon } from '$components/element';
	import { getContextMenuContext } from './_context';
	import type { ContextMenuItemProps } from './_interface';

	let {
		disabled = false,
		destructive = false,
		icon,
		onselect,
		children,
		onclick: onClick,
		...props
	}: ContextMenuItemProps = $props();

	const ctx = getContextMenuContext();

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'context-menu-item',
			disabled ? 'disabled' : undefined,
			destructive ? 'destructive' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function activate(e: MouseEvent) {
		if (disabled) return;
		onClick?.(e);
		onselect?.();
		ctx?.close();
	}
</script>

<button
	type="button"
	role="menuitem"
	data-cm-item
	data-cm-disabled={disabled || undefined}
	class={styleDerived}
	aria-disabled={disabled || undefined}
	tabindex={disabled ? -1 : 0}
	onclick={(e) => activate(e)}
	{...props}
>
	{#if icon}
		<span class="context-menu-item__icon" aria-hidden="true">
			<Icon {icon} />
		</span>
	{/if}
	{#if children}
		<span class="label">{@render children()}</span>
	{/if}
</button>

<style lang="scss">
	.context-menu-item {
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
		cursor: var(--cursor-interactive);
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

		/* svg iconify render inline 1em → điều khiển KÍCH THƯỚC bằng font-size
		   (bẫy: chọn font-size trên span wrapper, không phải chiều rộng cố định). */
		.context-menu-item__icon {
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			font-size: 1rem;
			color: var(--muted, var(--foreground));
		}

		.label {
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&.destructive {
			color: var(--danger, hsl(0 72% 51%));

			.context-menu-item__icon {
				color: currentColor;
			}

			@media (hover: hover) and (pointer: fine) {
				&:not(.disabled):hover {
					background-color: color-mix(in srgb, var(--danger, hsl(0 72% 51%)) 12%, transparent);
				}
			}
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			cursor: var(--cursor-disabled);
			pointer-events: none;
		}
	}
</style>
