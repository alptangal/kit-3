<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { getCheckboxContext } from '../checkbox';
	import { getTextFieldContext } from '../textField';
	import type { LabelConfigs, LabelProps } from './_interface';

	let { children, ...props }: LabelProps = $props();
	const textFieldContext = getTextFieldContext();
	const checkboxContext = getCheckboxContext();

	// Generate for attribute if not provided and we have a textField context with name
	const forId = $derived(props.for ?? (textFieldContext?.name ? `field-${textFieldContext.name}` : undefined));

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
			// Đọc từ computed color của input nếu có (đã set qua prop color)
			if (textFieldContext?.children?.input?.color) {
				const inputColor = textFieldContext.children.input.color;
				if (inputColor !== 'default') return inputColor;
			}
			// Kiểm tra validation state của input child — áp dụng cùng logic
			// với Input.colorDerived để KHÔNG hiện error/success khi:
			// - Đang validate (isValid == 'pending')
			// - Chưa validate (chưa blur, chưa có validation.process)
			// (Tránh regression: label mặc định bị color-error/color-success)
			const childInput = textFieldContext?.children?.input;
			if (childInput?.validation) {
				const validation = childInput.validation;
				const isValid = validation.isValid;
				const process = validation.process;
				if (process && process.size > 0) {
					// Đã có quá trình validate → dùng kết quả
					if (isValid == 'pending') return 'default';
					return isValid ? 'success' : 'error';
				}
				// Chưa có quá trình validate (chưa blur) → trung tính
				return 'default';
			}
			// Checkbox context fallback
			if (checkboxContext?.required) {
				if (typeof checkboxContext?.validation?.isValid == 'boolean')
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
</script>

<svelte:element this={props.as ?? 'label'} bind:this={configs.ref} class={configs.style} for={forId}>
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