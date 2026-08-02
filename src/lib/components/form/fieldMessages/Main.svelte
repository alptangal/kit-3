<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { sizeIndex } from '../description';
	import { getTextFieldContext } from '../textField';
	import type { fieldMessagesConfigs, FieldMessagesProps } from './_interface';

	let { ...props }: FieldMessagesProps = $props();
	let configs: fieldMessagesConfigs = $state({
		get size() {
			if (props.size) return props.size;
			const defaultSize =
				sizeIndex[sizeIndex.indexOf(textFieldContext?.size ?? client.browser?.size ?? 'md') - 1];
			return defaultSize;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = ['fieldMessages-root', `size-${this.size}`];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
	const textFieldContext = getTextFieldContext();
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{#if textFieldContext && textFieldContext.children?.input?.validation.messages?.size}
		{#each textFieldContext.children.input.validation.messages
			.values()
			.filter((item) => item.content) as item, key (key)}
			<p class={item.kind}>{item.content![client.browser?.language ?? 'en']}</p>
		{/each}
	{/if}
</svelte:element>

<style lang="scss">
	@use '$styles/colors.scss';
	@use '$styles/sizes.scss';
	.fieldMessages-root {
		.valid {
			color: var(--success);
		}
		.invalid {
			color: var(--error);
		}
		font-size: var(--font-size);
	}
</style>
