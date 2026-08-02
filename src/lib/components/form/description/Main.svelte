<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { fly } from 'svelte/transition';
	import { sizeIndex } from '.';
	import { getTextFieldContext } from '../textField';
	import type { DescriptionConfigs, DescriptionProps } from './_interface';

	let { children, ...props }: DescriptionProps = $props();
	let configs: DescriptionConfigs = $state({
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
			const parentSize = textFieldContext?.size ?? client.browser?.size ?? 'md';
			const defaultSize = sizeIndex[sizeIndex.indexOf(parentSize) - 1];
			return defaultSize;
		}
	});
	const textFieldContext = getTextFieldContext();
</script>

{#if (textFieldContext && !textFieldContext.children?.input?.validation.messages?.size) || !textFieldContext}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		transition:fly={client.browser?.transition?.fly}
	>
		{@render children?.()}
	</svelte:element>
{/if}

<style lang="scss">
	@use '$styles/sizes.scss';
	@use '$styles/colors.scss';
	.description-root {
		font-size: var(--font-size);
		color: var(--color);
	}
</style>
