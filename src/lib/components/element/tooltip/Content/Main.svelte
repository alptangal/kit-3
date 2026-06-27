<script lang="ts">
	import { fly } from 'svelte/transition';
	import type { Content } from '.';
	import { getTooltipContext } from '../Provider';
	import { profile } from '$store/basic.svelte';

	let { children, ...props }: Content = $props();
	let configs = $state({
		ref: undefined as undefined | HTMLElement,
		status: {
			position: {
				x: undefined as undefined | number,
				y: undefined as undefined | number
			}
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={[
		...(typeof props.class == 'string' ? [props.class] : props.class ? props.class : []),
		'tooltip-content'
	]}
>
	{@render children?.()}
</svelte:element>
