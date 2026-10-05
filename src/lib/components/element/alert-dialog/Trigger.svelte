<script lang="ts">
	// src/lib/components/element/alert-dialog/Trigger.svelte
	// AlertDialog.Trigger — bọc slot (user đặt <button> bên trong), click → mở dialog.
	// Span inline-flex trong suốt, KHÔNG steal click; data-ad-trigger để Root.close()
	// tìm về trả focus. ARIA: aria-haspopup="dialog" trên span (bổ sung — nút con
	// của user tự có button semantics).
	import { styleSynced } from '$modules';
	import { getAlertDialogContext } from './_context';
	import type { AlertDialogTriggerProps } from './_interface';

	let {
		disabled = false,
		children,
		onclick: onClick,
		...props
	}: AlertDialogTriggerProps = $props();

	const ctx = getAlertDialogContext();
	const open = $derived(ctx?.open ?? false);

	const styleDerived = $derived.by(() => {
		const defaultStyles: (string | undefined)[] = [
			'alert-dialog-trigger',
			disabled ? 'disabled' : undefined,
			open ? 'open' : undefined
		];
		return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
	});

	function handleClick(e: MouseEvent) {
		onClick?.(e);
		if (disabled || !ctx || ctx.open) return;
		e.stopPropagation();
		// Ghi element active TRƯỚC khi mở — lúc này focus vẫn ở trigger
		// (bấm chuột vào button → focus vào button). Content mount sau,
		// focus sẽ được bắt lại ở đây nếu cần.
		ctx.saveLastActive(document.activeElement as HTMLElement | null);
		ctx.setOpen(true);
	}
</script>

<span
	data-ad-trigger
	class={styleDerived}
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-controls={ctx?.rootId}
	onclick={handleClick}
	{...props}
>
	{@render children?.()}
</span>

<style lang="scss">
	.alert-dialog-trigger {
		display: inline-flex;

		&.disabled {
			opacity: var(--disabled-opacity, 0.5);
			pointer-events: none;
			cursor: var(--cursor-disabled, not-allowed);
		}
	}
</style>
