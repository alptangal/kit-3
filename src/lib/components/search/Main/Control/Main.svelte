<script lang="ts">
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { getSearchMainContext } from '../_context';
	import type { SearchMainControlConfigs, SearchMainControlProps } from '../_interface';

	let { ...props }: SearchMainControlProps = $props();
	let searchMainCtx = getSearchMainContext();
	let configs: SearchMainControlConfigs = $state({
		get disabled() {
			return props.disabled ?? searchMainCtx?.disabled ?? client.browser?.disabled;
		},
		get size() {
			return props.size ?? searchMainCtx?.size ?? client.browser?.size;
		},
		event: {
			load: {
				handler() {
					if (searchMainCtx?.insertNode) {
						searchMainCtx.insertNode({
							ref: configs.ref
						});
					}
				}
			}
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	data-size={configs.size}
	{@attach handleEvents([{ events: [configs.event ?? {}] }])}
>
	control
</svelte:element>
