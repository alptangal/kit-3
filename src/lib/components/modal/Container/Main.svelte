<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { getModalContext } from '..';
	import type { ModalContainerConfigs, ModalContainerProps } from '../_interface';
	import { releaseModalHeader, setModalContainerContext } from '.';

	let { children, ...props }: ModalContainerProps = $props();
	const modalContext = getModalContext();
	let configs: ModalContainerConfigs = $state({
		get size() {
			return props.size ?? modalContext?.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'modal-container-root',
				`size-${this.size}`,
				`placement-${this.placement}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get placement() {
			return props.placement ?? modalContext?.placement ?? 'center';
		},
		children: {}
	});
	if (modalContext) {
		modalContext.children.container = configs;
	}
	setModalContainerContext(configs);

	$effect(() => {
		const headerRef = configs.children.header?.ref;
		if (headerRef && configs.ref && configs.ref.firstChild !== headerRef) {
			configs.ref.insertBefore(headerRef, configs.ref.firstChild);
		}
	});

	onMount(() => {
		if (modalContext?.children.contentWrapper && configs.ref) {
			while (modalContext.children.contentWrapper.firstChild) {
				configs.ref.appendChild(modalContext.children.contentWrapper.firstChild);
			}
		}
	});
	onDestroy(() => {
		if (modalContext?.children.container === configs) {
			modalContext.children.container = undefined;
		}
	});
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	.modal-container-root {
		&.placement-center {
			top: 50%;
		}
		&.placement-top {
			top: 0;
		}
		&.placement-bottom {
			bottom: 0;
		}
		background: var(--default-200);
		border-radius: var(--border-radius);
		padding: var(--padding);
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		width: var(--width);
	}
</style>
