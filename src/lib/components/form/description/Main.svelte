<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { fly } from 'svelte/transition';
	import { sizeIndex } from '.';
	import { getTextFieldContext } from '../textField';
	import type { DescriptionConfigs, DescriptionProps } from './_interface';
	import { getCheckboxContext } from '../checkbox';

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
			const parentSize =
				textFieldContext?.size ?? checkboxContext?.size ?? client.browser?.size ?? 'md';
			const defaultSize = sizeIndex[sizeIndex.indexOf(parentSize) - 1];
			return defaultSize;
		},
		get persistent() {
			return props.persistent ?? false;
		},
		get autoHide() {
			return props.autoHide ?? true;
		}
	});
	const textFieldContext = getTextFieldContext();
	const checkboxContext = getCheckboxContext();

	const shouldRender = $derived.by(() => {
		if (configs.persistent || !configs.autoHide) return true;
		const hasMessages =
			Boolean(textFieldContext?.children?.input?.validation.messages?.size) ||
			Boolean(checkboxContext?.validation.messages?.size);
		return !hasMessages;
	});
</script>

{#if shouldRender}
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

		&.color-description-error {
			--color: var(--error);
			color: var(--error);
		}
		&.color-description-success {
			--color: var(--success);
			color: var(--success);
		}
		&.color-description-warning {
			--color: var(--warning);
			color: var(--warning);
		}
		&.color-description-info {
			--color: var(--info, var(--color-sky-500));
			color: var(--info, var(--color-sky-500));
		}
		&.color-description-default {
			--color: var(--foreground-400, #71717a);
		}
	}
</style>
