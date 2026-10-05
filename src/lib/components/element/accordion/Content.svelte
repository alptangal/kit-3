<script lang="ts">
	// src/lib/components/element/accordion/Content.svelte
	// Accordion.Content — <div role="region" aria-labelledby="acc-hd-{rootId}-{value}"
	// id="acc-ct-{rootId}-{value}">. Khi mở: in:fly (y:-4, duration theo ctx) ·
	// khi đóng: out:fade (duration 0 nếu reduced-motion — ctx.duration).
	// duration:0 thì Svelte bỏ qua transition (hiển thị/ngay).
	import { fade, fly } from 'svelte/transition';
	import { styleSynced } from '$modules';
	import { getAccordionContext, getAccordionItemContext } from './_context';
	import type { AccordionContentProps } from './_interface';

	let { children, ...props }: AccordionContentProps = $props();

	const ctx = getAccordionContext();
	const item = getAccordionItemContext();
	const value = $derived(item?.value ?? '');
	const rootId = $derived(ctx?.rootId ?? '');
	// isOpen track value (Root) → mount/unmount reactive khi toggle.
	const open = $derived(value ? ctx?.isOpen(value) ?? false : false);
	const dur = $derived(ctx?.duration ?? 300);

	const styleDerived = $derived.by(() =>
		styleSynced(
			{
				defaultStyles: ['accordion-content'],
				propStyles: props.class
			},
			props.overwriteDefaultStyles
		)
	);
</script>

<div
	role="region"
	id={`acc-ct-${rootId}-${value}`}
	aria-labelledby={`acc-hd-${rootId}-${value}`}
	data-accordion-value={value}
	class={styleDerived}
	{...props}
>
	{#if open}
		<div class="accordion-content-inner" in:fly={{ y: -4, duration: dur }} out:fade={{ duration: dur }}>
			{@render children?.()}
		</div>
	{/if}
</div>

<style lang="scss">
	.accordion-content {
		display: block;

		.accordion-content-inner {
			padding-bottom: 0.75rem;
			font-size: 0.875rem;
			line-height: 1.6;
			color: var(--muted, var(--foreground));
		}
	}
</style>
