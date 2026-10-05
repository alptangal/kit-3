<script lang="ts">
	// src/lib/components/element/alert-dialog/Title.svelte
	// AlertDialog.Title — `<h3 id={titleId}>` cho Content aria-labelledby.
	// Register hasTitle=true (đồng bộ) để Content tính đúng ARIA.
	// font 1.0625rem/600, margin 0 (spec).
	import { styleSynced } from '$modules';
	import { getAlertDialogContext } from './_context';
	import type { AlertDialogTitleProps } from './_interface';

	let { children, ...props }: AlertDialogTitleProps = $props();
	const ctx = getAlertDialogContext();

	// Register đồng bộ TRƯỚC khi render (Content đọc derived hasTitle).
	// Guard: KHÔNG top-level `return` (Svelte 5 parse error) — ctx luôn có
	// vì Root là cha trực tiếp; `if (ctx)` chỉ là defensive.
	if (ctx) ctx.hasTitle = true;

	const styleDerived = $derived.by(() => {
		return styleSynced(
			{ defaultStyles: ['alert-dialog-title'], propStyles: props.class },
			props.overwriteDefaultStyles
		);
	});
</script>

<h3 class={styleDerived} id={ctx?.titleId}>
	{@render children?.()}
</h3>

<style lang="scss">
	.alert-dialog-title {
		font-size: 1.0625rem;
		font-weight: 600;
		line-height: 1.4;
		margin: 0;
		color: var(--foreground);
	}
</style>
