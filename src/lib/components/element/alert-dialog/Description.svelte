<script lang="ts">
	// src/lib/components/element/alert-dialog/Description.svelte
	// AlertDialog.Description — `<p id={descriptionId}>` cho Content
	// aria-describedby. Register hasDescription=true. 0.875rem, --muted,
	// line-height 1.6 (spec).
	import { styleSynced } from '$modules';
	import { getAlertDialogContext } from './_context';
	import type { AlertDialogDescriptionProps } from './_interface';

	let { children, ...props }: AlertDialogDescriptionProps = $props();
	const ctx = getAlertDialogContext();

	// Register đồng bộ TRƯỚC khi render (Content đọc derived hasDescription).
	// Guard: KHÔNG top-level `return` (Svelte 5 parse error) — ctx luôn có
	// vì Root là cha trực tiếp; `if (ctx)` chỉ là defensive.
	if (ctx) ctx.hasDescription = true;

	const styleDerived = $derived.by(() => {
		return styleSynced(
			{ defaultStyles: ['alert-dialog-description'], propStyles: props.class },
			props.overwriteDefaultStyles
		);
	});
</script>

<p class={styleDerived} id={ctx?.descriptionId}>
	{@render children?.()}
</p>

<style lang="scss">
	.alert-dialog-description {
		font-size: 0.875rem;
		line-height: 1.6;
		margin: 0;
		color: var(--muted, var(--foreground));
	}
</style>
