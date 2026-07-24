<script lang="ts">
	import { onMount } from 'svelte';
	import type { ModalConfigs, ModalProps } from './_interface';
	import { client } from '$store/basic.svelte';
	import { handleEvents } from '$modules/_attachments';

	let { children, display = $bindable(), ...props }: ModalProps = $props();
	let configs: ModalConfigs = $state({
		event: {
			load: {
				handler() {
					if (configs.ref && client.browser?.modalStorage) {
						client.browser.modalStorage.appendChild(configs.ref);
					}
				}
			}
		}
	});

	onMount(() => {
		if (!client.browser) {
			client.browser = {};
		}
		if (!client.browser.modalStorage) {
			const modalEl = document.createElement('div');
			modalEl.classList.add('modal-storage');
			document.body.appendChild(modalEl);
			client.browser.modalStorage = modalEl;
		}
	});
</script>

{#if display}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		{@attach handleEvents([{ events: [configs.event ?? {}] }])}
	>
		{@render children?.()}
	</svelte:element>
{/if}
