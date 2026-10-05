<script lang="ts">
	// src/lib/components/element/tabs/Content.svelte
	// Tabs.Content — <div role="tabpanel">. `hidden` (display:none) khi tab không
	// active → giữ DOM + state (form/scroll không mất) theo ARIA tabs pattern.
	// id/aria-labelledby liên kết Trigger ("tabs-tr-{rootId}-{value}").
	import { styleSynced } from '$modules';
	import { getTabsContext } from './_context';
	import type { TabsContentProps } from './_interface';

	let { value, children, ...props }: TabsContentProps = $props();

	const ctx = getTabsContext();
	const active = $derived(ctx?.activeValue === value);
	const rootId = $derived(ctx?.rootId ?? '');

	const styleDerived = $derived.by(() =>
		styleSynced(
			{
				defaultStyles: ['tabs-content', active ? 'active' : undefined],
				propStyles: props.class
			},
			props.overwriteDefaultStyles
		)
	);
</script>

<div
	role="tabpanel"
	id={`tabs-pn-${rootId}-${value}`}
	aria-labelledby={`tabs-tr-${rootId}-${value}`}
	class={styleDerived}
	hidden={!active}
>
	{@render children?.()}
</div>

<style lang="scss">
	.tabs-content {
		padding-top: 0.75rem;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--foreground);

		&[hidden] {
			display: none;
		}
	}
</style>
