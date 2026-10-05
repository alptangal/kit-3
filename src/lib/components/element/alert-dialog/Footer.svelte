<script lang="ts">
	// src/lib/components/element/alert-dialog/Footer.svelte
	// AlertDialog.Footer — flex row-reverse (Action trước, Cancel sau — shadcn),
	// gap 0.5rem, padding 1rem 1.5rem 1.5rem (spec).
	import { styleSynced } from '$modules';
	import type { AlertDialogFooterProps } from './_interface';

	let { children, ...props }: AlertDialogFooterProps = $props();

	const styleDerived = $derived.by(() => {
		return styleSynced(
			{ defaultStyles: ['alert-dialog-footer'], propStyles: props.class },
			props.overwriteDefaultStyles
		);
	});
</script>

<div class={styleDerived} data-ad-footer>
	{@render children?.()}
</div>

<style lang="scss">
	.alert-dialog-footer {
		display: flex;
		flex-direction: row-reverse;
		gap: 0.5rem;
		padding: 1rem 1.5rem 1.5rem;
	}
</style>
