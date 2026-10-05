// src/lib/components/element/card/Footer.svelte
// Card.Footer — chân card: border-top + hàng nút (flex row, gap 0.5rem, align center).
<script lang="ts">
	import { styleSynced } from '$modules';
import type { CardFooterProps } from './_interface';

let { as: asProp, class: classProp, children, ...props }: CardFooterProps = $props();

const styleDerived = $derived.by(() =>
	styleSynced(
		{
			defaultStyles: ['card-footer'] as (string | undefined)[],
			propStyles: classProp
		},
		props.overwriteDefaultStyles
	)
);
</script>

<svelte:element this={asProp ?? 'div'} class={styleDerived} {...props}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '_styles.scss' as card;

	.card-footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		min-width: 0;
		padding: 1rem 1.25rem;
		border-top: 1px solid card.$card-border-color;

		@media (prefers-color-scheme: dark) {
			border-top-color: hsl(240 5.9% 24%);
		}
	}
</style>
