<script lang="ts">
	import { styleSynced } from '$modules';
	import type { ModalFooterConfigs, ModalFooterProps } from '../_interface';
	import { getModalContainerContext } from '../Container';

	let { children, ...props }: ModalFooterProps = $props();
	const modalContainerContext = getModalContainerContext();
	let configs: ModalFooterConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = ['modal-footer-root'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
	if (modalContainerContext) {
		modalContainerContext.children.footer = configs;
	}
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.modal-footer-root {
	}
</style>
