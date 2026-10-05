// src/lib/components/element/card/Content.svelte
// Card.Content — vùng thân card (slot chính): flex-1 + min-height 0 để không tràn khi
// card có height giới hạn; min-width 0 cho nội dung dài không phá layout.
<script lang="ts">
	import { styleSynced } from '$modules';
	import type { CardContentProps } from './_interface';

let { as: asProp, class: classProp, children, ...props }: CardContentProps = $props();

const styleDerived = $derived.by(() =>
	styleSynced(
		{
			defaultStyles: ['card-content'] as (string | undefined)[],
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
	.card-content {
		flex: 1 1 auto;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		padding: 1rem 1.25rem;
	}
</style>
