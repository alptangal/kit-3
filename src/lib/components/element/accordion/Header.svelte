<script lang="ts">
	// src/lib/components/element/accordion/Header.svelte
	// Accordion.Header — semantic wrapper (div.accordion-header) chứa
	// Accordion.Trigger. Trigger giữ id "acc-hd-{rootId}-{value}"
	// (content aria-labelledby trỏ về trigger).
	import { styleSynced } from '$modules';
	import type { AccordionHeaderProps } from './_interface';

	let { children, ...props }: AccordionHeaderProps = $props();

	const styleDerived = $derived.by(() =>
		styleSynced(
			{
				defaultStyles: ['accordion-header'],
				propStyles: props.class
			},
			props.overwriteDefaultStyles
		)
	);
</script>

<div class={styleDerived} {...props}>
	{@render children?.()}
</div>

<style lang="scss">
	.accordion-header {
		display: flex;
	}
</style>
