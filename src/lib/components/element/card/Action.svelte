// src/lib/components/element/card/Action.svelte
// Card.Action — vùng hành động góc phải (vd icon button menu ⋮):
// margin-left auto để đẩy về cuối hàng (Header), tự căn đầu hàng (align-self start).
<script lang="ts">
	import { styleSynced } from '$modules';
import type { CardActionProps } from './_interface';

let { as: asProp, class: classProp, children, ...props }: CardActionProps = $props();

const styleDerived = $derived.by(() =>
	styleSynced(
		{
			defaultStyles: ['card-action'] as (string | undefined)[],
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
	.card-action {
		margin-inline-start: auto;
		align-self: flex-start;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		min-width: 0;
	}
</style>
