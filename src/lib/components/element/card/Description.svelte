// src/lib/components/element/card/Description.svelte
// Card.Description — text phụ (mặc định element p, 0.875rem, màu --muted).
<script lang="ts">
	import { styleSynced } from '$modules';
import type { CardDescriptionProps } from './_interface';

let { as: asProp, class: classProp, children, ...props }: CardDescriptionProps = $props();

const styleDerived = $derived.by(() =>
	styleSynced(
		{
			defaultStyles: ['card-description'] as (string | undefined)[],
			propStyles: classProp
		},
		props.overwriteDefaultStyles
	)
);
</script>

<svelte:element this={asProp ?? 'p'} class={styleDerived} {...props}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.card-description {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--muted, var(--foreground));
		min-width: 0;
	}
</style>
