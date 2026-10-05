<script lang="ts">
	// src/lib/components/element/alert-dialog/Cancel.svelte
	// AlertDialog.Cancel — nút GHOST ("Hủy"): bg transparent + border
	// (var(--border), fallback hsl 90%), text --foreground, hover bg --content2.
	// Click → close (Root.close: focus trả trigger). data-ad-cancel: Content
	// dùng cho focus trap 2 nút.
	import { styleSynced } from '$modules';
	import { getAlertDialogContext } from './_context';
	import type { AlertDialogCancelProps } from './_interface';

	let {
		onclick: onClick,
		disabled = false,
		children,
		...props
	}: AlertDialogCancelProps = $props();
	// Guard: KHÔNG top-level `return` (Svelte 5 parse error) — ctx luôn có
	// vì Root là cha trực tiếp; các handler tự guard `!ctx`.
	const ctx = getAlertDialogContext();

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'alert-dialog-cancel',
			disabled ? 'disabled' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function handleClick(e: MouseEvent) {
		onClick?.(e);
		if (disabled || !ctx) return;
		e.stopPropagation();
		ctx.close();
	}
</script>

<button
	type="button"
	class={styleDerived}
	data-ad-cancel
	disabled={disabled || undefined}
	onclick={handleClick}
	{...props}
>
	{@render children?.()}
</button>

<style lang="scss">
	.alert-dialog-cancel {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: 2.375rem;
		padding: 0 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		font-family: inherit;
		line-height: 1;
		color: var(--foreground);
		background: transparent;
		// border copy dropdown-content: var(--border), fallback hsl 90%.
		border: 1px solid var(--border, hsl(240 5.9% 90%));
		border-radius: var(--border-radius-md, 0.375rem);
		cursor: pointer;
		user-select: none;
		transition: background-color 150ms cubic-bezier(0.65, 0, 0.35, 1);

		@media (hover: hover) and (pointer: fine) {
			&:hover:not(.disabled) {
				background: var(--content2, hsl(240 4.8% 96%));
			}
		}

		&:focus-visible {
			outline: 2px solid var(--color-indigo-500, hsl(241 100% 68.6%));
			outline-offset: 2px;
		}

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			pointer-events: none;
		}

		@media (prefers-color-scheme: dark) {
			border-color: hsl(240 5.9% 20%);
		}
	}
</style>
