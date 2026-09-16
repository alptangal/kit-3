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
		if (
			modalContext?.children.contentWrapper &&
			configs.ref &&
			configs.ref.parentElement !== modalContext.children.contentWrapper
		) {
			while (
				modalContext.children.contentWrapper.firstChild &&
				modalContext.children.contentWrapper.firstChild !== configs.ref
			) {
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
		position: relative;
		background: var(--default-200, #18181b);
		border-radius: var(--border-radius, 1rem);
		padding: var(--padding, 1.25rem);
		width: var(--width, 32rem);
		max-width: calc(100vw - 2rem);
		max-height: calc(100dvh - 2.5rem);
		overflow-y: auto;
		box-sizing: border-box;
		box-shadow:
			0 25px 50px -12px rgba(0, 0, 0, 0.6),
			0 0 0 1px rgba(255, 255, 255, 0.1);
		z-index: 10001;

		&.placement-center {
			margin: auto;
		}
		&.placement-top {
			margin: 2rem auto auto auto;
		}
		&.placement-bottom {
			margin: auto auto 2rem auto;
		}
	}
</style>
