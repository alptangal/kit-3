<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { getCheckboxContext } from '../checkbox';
	import { getTextFieldContext } from '../textField';
	import type { LabelConfigs, LabelProps } from './_interface';

	let { children, ...props }: LabelProps = $props();
	let configs: LabelConfigs = $state({
		get style() {
			const defaultStyles: (string | undefined)[] = [
				'label-root',
				`size-${this.size}`,
				`color-${this.color}`
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get color() {
			if (props.color) return props.color;
			// Đọc từ computed color của input nếu có
			if (textFieldContext?.children?.input?.color) {
				const inputColor = textFieldContext.children.input.color;
				if (inputColor !== 'default') return inputColor;
			}
			// Fallback về validation.isValid
			if (typeof textFieldContext?.children?.input?.validation.isValid == 'boolean')
				return textFieldContext?.children?.input?.validation.isValid ? 'success' : 'error';
			if (checkboxContext?.required) {
				if (typeof checkboxContext?.validation.isValid == 'boolean')
					return checkboxContext.validation.isValid ? 'success' : 'error';
				return 'default';
			}
			return 'default';
		},
		get size() {
			return (
				props.size ??
				textFieldContext?.size ??
				checkboxContext?.size ??
				client.browser?.size ??
				'md'
			);
		}
	});
	const textFieldContext = getTextFieldContext();
	const checkboxContext = getCheckboxContext();
</script>

<svelte:element this={props.as ?? 'div'} bind:this={configs.ref} class={configs.style}>
	{@render children?.()}
	{#if !props.hiddenRequiredIndicator && (textFieldContext?.required || checkboxContext?.required)}
		<span class="color-[var(--error)]"> * </span>
	{/if}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	@use '$styles/colors.scss';
	.label-root {
		font-size: var(--font-size);
		color: var(--color);
	}
</style>
