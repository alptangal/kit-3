<script lang="ts">
	import { iconify } from '$assets/icons/iconify';
	import { Button } from '$components/element';
	import type { BasicProps } from '$components/interface';
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { getModalContext } from '..';
	import type { ModalHeaderConfigs, ModalHeaderProps } from '../_interface';
	import { getModalContainerContext } from '../Container';

	let { children, ...props }: ModalHeaderProps = $props();
	let modalContainerContext = getModalContainerContext();
	let modalContext = getModalContext();
	let configs: ModalHeaderConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'modal-header-root',
				children ? 'justify-between' : 'justify-end'
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		actionButton: {
			close: {
				get display() {
					return props.actionButtons?.close?.display ?? true;
				},
				get size() {
					if (modalContext?.size == 'full') return '9xl';
					return modalContext?.size ?? client.browser?.size ?? 'md';
				},
				get event() {
					const defaultEvents: BasicProps['events'] = [
						{
							events: {
								mousedown() {
									if (modalContext) modalContext.display = false;
								}
							}
						}
					];
					return defaultEvents;
				}
			}
		}
	});
	if (modalContainerContext) {
		modalContainerContext.children.header = configs;
	}

	onMount(() => {});
</script>

<svelte:element this={props.as ?? 'header'} bind:this={configs.ref} class={configs.style}>
	{@render children?.()}
	{#if configs.actionButton.close?.display}
		<Button
			icon={iconify['close-rounded']}
			size={configs.actionButton.close.size}
			events={configs.actionButton.close.event}
			color="error"
			variant="outline"
			class="px-0! h-fit!"
			aria-label="Close modal"
		/>
	{/if}
</svelte:element>

<style lang="scss">
	.modal-header-root {
		@apply flex gap-2 items-center;
	}
</style>