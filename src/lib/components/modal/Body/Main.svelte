<script lang="ts">
	import { styleSynced } from '$modules';
	import type { ModalBodyConfigs, ModalBodyProps } from '../_interface';
	import { getModalContainerContext } from '../Container';

	let { children, ...props }: ModalBodyProps = $props();
	const modalContainerContext = getModalContainerContext();
	let configs: ModalBodyConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = ['modal-body-root'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
	if (modalContainerContext) {
		modalContainerContext.children.body = configs;
	}
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.modal-body-root {
	}
</style>
