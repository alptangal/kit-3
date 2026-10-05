<script lang="ts">
	// src/lib/components/element/accordion/Item.svelte
	// Accordion.Item — 1 item (div.accordion-item[data-value]). Set ITEM context
	// (value) để Trigger/Content bên trong dùng cùng id (aria-controls /
	// aria-labelledby / isOpen(id)). Border-bottom --border (spec).
	import { styleSynced } from '$modules';
	import { setAccordionItemContext } from './_context';
	import type { AccordionItemProps } from './_interface';

	let { value, children, ...props }: AccordionItemProps = $props();

	// Item context: Trigger/Content đọc value (không cần truyền props value trùng).
	setAccordionItemContext({ get value() { return value; } });

	const styleDerived = $derived.by(() =>
		styleSynced(
			{
				defaultStyles: ['accordion-item'],
				propStyles: props.class
			},
			props.overwriteDefaultStyles
		)
	);
</script>

<div data-value={value} class={styleDerived} {...props}>
	{@render children?.()}
</div>

<style lang="scss">
	.accordion-item {
		border-bottom: 1px solid var(--border);
	}
</style>
