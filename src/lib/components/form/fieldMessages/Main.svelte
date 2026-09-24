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
	// Use $derived.by to properly capture props reactivity
	const showValid = $derived.by(() => props.showValid ?? false);
	// Pass as getter function to preserve reactivity in useMessageDisplay
	const messageDisplay = useMessageDisplay(() => ({ showValid }));

	let configs: fieldMessagesConfigs = $state({
		get size() {
			if (props.size) return props.size;
			const textFieldSize = textFieldContext?.size ?? client.browser?.size ?? 'md';
			const sizeIdx = sizeIndex.indexOf(textFieldSize);
			// Use same size as textField, or one smaller if available (not for xs)
			const defaultSize = sizeIndex[Math.max(0, sizeIdx - 1)];
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
		/* Ghi đè utility `size-*` của Tailwind (size-xs = w/h 20rem) — class size-* của
		   project chỉ mang biến CSS, component này phải tự co theo nội dung */
		width: auto;
		height: auto;
		min-width: 0;
		min-height: 0;
		.valid {
			color: var(--success);
		}
		.invalid {
			color: var(--error);
		}
		font-size: var(--font-size);
	}
</style>