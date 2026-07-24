<script lang="ts">
	import { onMount } from 'svelte';
	import type { WindowConfigs, WindowProps } from './_interface';
	import { browser } from '$app/environment';
	import { client } from '$store/basic.svelte';
	import { handleEvents } from '$modules/_attachments';
	import * as uuid from 'uuid';

	let { children, ...props }: WindowProps = $props();
	let configs: WindowConfigs = $state({
		event: {
			load(e) {
				if (configs.ref) {
					const randomId = uuid.v7();
					client.browser.windows.set(props.name ?? randomId, { ref: configs.ref });
					console.log(client.browser.windows);
				}
			}
		}
	});

	onMount(() => {
		if (browser) {
			if (!client.browser) client.browser = {};
			if (!client.browser.windows) client.browser.windows = new Map();
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	{@attach handleEvents([{ events: [configs.event ?? {}] }])}
>
	{@render children?.()}
</svelte:element>
