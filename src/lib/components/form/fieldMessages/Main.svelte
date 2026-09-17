<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { sizeIndex } from '../description';
	import { getTextFieldContext } from '../textField';
	import { getCheckboxContext } from '../checkbox';
	import { useMessageDisplay } from '../composables/useMessageDisplay.svelte';
	import type { fieldMessagesConfigs, FieldMessagesProps } from './_interface';

	let { ...props }: FieldMessagesProps = $props();
	const textFieldContext = getTextFieldContext();
	const checkboxContext = getCheckboxContext();

	// shared message display composable (unified pattern with Description)
	const messageDisplay = useMessageDisplay({ showValid: props.showValid });

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
		},
		get messages() {
			return messageDisplay.rawMessages;
		}
	});

	const visibleMessages = $derived(messageDisplay.visibleMessages);
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{#each visibleMessages as item, key (key)}
		<p class={item.kind}>{messageDisplay.formatContent(item)}</p>
	{/each}
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
