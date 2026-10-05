// src/lib/components/element/card/Title.svelte
// Card.Title — heading trong card (mặc định element h3, font-size 1.0625rem/600, margin 0).
<script lang="ts">
	import { styleSynced } from '$modules';
	import type { CardTitleProps } from './_interface';

let { as: asProp, class: classProp, children, ...props }: CardTitleProps = $props();

const styleDerived = $derived.by(() =>
	styleSynced(
		{
			defaultStyles: ['card-title'] as (string | undefined)[],
			propStyles: classProp
		},
		props.overwriteDefaultStyles
	)
);
</script>

<svelte:element this={asProp ?? 'h3'} class={styleDerived} {...props}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.card-title {
		margin: 0;
		font-size: 1.0625rem;
		font-weight: 600;
		line-height: 1.4;
		color: var(--foreground);
		min-width: 0;
	}
</style>
