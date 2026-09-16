<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { fly } from 'svelte/transition';
	import { getCheckboxContext } from '../checkbox';
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
		},
		get messages() {
			return (
				textFieldContext?.children?.input?.validation.messages ??
				checkboxContext?.validation.messages
			);
		}
	});
	const textFieldContext = getTextFieldContext();
	const checkboxContext = getCheckboxContext();
	const visibleMessages = $derived.by(() => {
		const msgs = [...(configs.messages ?? []).values()].filter((item) => item.content);
		const hasInvalid = msgs.some((item) => item.kind === 'invalid');
		if (hasInvalid) {
			return msgs.filter((item) => item.kind === 'invalid');
		}
		if (props.showValid) {
			return msgs.filter((item) => item.kind === 'valid');
		}
		return [];
	});
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{#each visibleMessages as item, key (key)}
		<p class={item.kind}>{item.content![client.browser?.language ?? 'en']}</p>
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
