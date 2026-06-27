<script lang="ts">
	import type { Trigger } from '.';

	let { children, ...props }: Trigger = $props();
</script>

<svelte:element this={props.as ?? 'div'} class={props.class}>
	{@render children?.()}
</svelte:element>
