// src/lib/components/element/card/Header.svelte
// Card.Header — hàng đầu card: flex row, gap, align start.
// Action tự đẩy phải (margin-left auto) — không dùng :global() (fragile + vi phạm scoped CSS).
<script lang="ts">
	import { styleSynced } from '$modules';
	import type { CardHeaderProps } from './_interface';

let { as: asProp, class: classProp, children, ...props }: CardHeaderProps = $props();

const styleDerived = $derived.by(() =>
	styleSynced(
		{
			defaultStyles: ['card-header'] as (string | undefined)[],
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
	.card-header {
		// 1 dòng (nowrap): heading-text (flex 1 1 auto, min-width 0) tự wrap nội bộ khi dài;
		// .card-action luôn cùng hàng, bị đẩy phải nhờ margin-inline-start auto.
		display: flex;
		flex-wrap: nowrap;
		gap: 0.75rem;
		align-items: flex-start;
		min-width: 0;
		padding: 1rem 1.25rem;
	}
</style>
