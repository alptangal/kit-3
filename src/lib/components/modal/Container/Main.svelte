<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { getModalContext } from '../useModalContext.svelte';
	import { setModalContainerContext } from '../useModalContext.svelte';
	import { releaseModalHeader } from '.';
	import type { ModalContainerConfigs, ModalContainerProps } from '../_interface';

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

	// Keep header as first child for proper visual/semantic order (requirement #8)
	$effect(() => {
		const headerRef = configs.children.header?.ref;
		if (headerRef && configs.ref && configs.ref.firstChild !== headerRef) {
			configs.ref.insertBefore(headerRef, configs.ref.firstChild);
		}
	});

	// Move content-wrapper children into container on mount (legacy auto-wrap compat)
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

		&.size-xs { width: 20rem; }
		&.size-sm { width: 24rem; }
		&.size-md { width: 32rem; }
		&.size-lg { width: 40rem; }
		&.size-xl { width: 48rem; }
		&.size-2xl { width: 56rem; }
		&.size-3xl { width: 64rem; }
		&.size-4xl { width: 72rem; }
		&.size-5xl { width: 80rem; }
		&.size-6xl { width: 88rem; }
		&.size-7xl { width: 96rem; }
		&.size-8xl { width: 104rem; }
		&.size-9xl { width: 112rem; }
		&.size-full {
			width: 100%;
			max-width: none;
			max-height: none;
			height: 100%;
			border-radius: 0;
		}
	}
</style>
