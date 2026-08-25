<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { fly } from 'svelte/transition';
	import type {
		ToastContentDescriptionConfigs,
		ToastContentDescriptionProps
	} from '../../_interface';
	import { sizeIndex } from '$components/form/description';
	import { getToastContext } from '../..';

	let { children, ...props }: ToastContentDescriptionProps = $props();
	let configs: ToastContentDescriptionConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'description-root',
				`size-${this.size}`,
				`color-description-${this.color}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get color() {
			return props.color ?? 'default';
		},
		get size() {
			if (props.size) return props.size;
			const parentSize = toastContext?.size ?? client.browser?.size ?? 'md';
			const defaultSize = sizeIndex[sizeIndex.indexOf(parentSize) - 1];
			return defaultSize;
		}
	});
	const toastContext = getToastContext();
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	transition:fly={client.browser?.transition?.fly}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	@use '$styles/colors.scss';
	.description-root {
		font-size: var(--font-size);
		color: var(--color);
	}
</style>
