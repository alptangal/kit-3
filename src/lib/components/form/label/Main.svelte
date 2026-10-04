<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { getCheckboxContext } from '../checkbox';
	import { getTextFieldContext } from '../textField';
	import { getSelectContext } from '../select/_context';
	import type { LabelConfigs, LabelProps } from './_interface';

	let { children, ...props }: LabelProps = $props();
	const textFieldContext = getTextFieldContext();
	const checkboxContext = getCheckboxContext();
	const selectContext = getSelectContext();

	// Generate for attribute if not provided and we have a context with name
	const forId = $derived(
		props.for ??
			(textFieldContext?.name ? `field-${textFieldContext.name}` : undefined) ??
			(selectContext?.name ? `field-${selectContext.name}` : undefined)
	);

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

			// Read color from input's explicit prop first (set via color={...})
			// This handles async validation states like email availability checks
			const childInput = textFieldContext?.children?.input;
			if (childInput?.color && childInput.color !== 'default') {
				return childInput.color;
			}

			// Fall back to validation state if input doesn't have explicit color
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

			// Checkbox context (M8 — đổi màu SAU khi validate, không áp khi khởi tạo)
			// Source isValid trả 'pending' (string) khi required chưa validate →
			// chỉ nhận BOOLEAN (đã validate) → màu; 'pending'/undefined → trung tính.
			if (checkboxContext?.required) {
				if (typeof checkboxContext?.validation?.isValid == 'boolean')
					return checkboxContext.validation.isValid ? 'success' : 'error';
				return 'default';
			}

			// Select context (M8 — MIRROR input: gate LABEL bằng "đã validate")
			// Source isValid của Select trả presence boolean ngay khi required (để
			// Form submit chặn đúng), NÊN label KHÔNG đọc isValid trực tiếp mà chỉ
			// đổi màu khi process đã chạy (process.size > 0) — pending → trung tính.
			// Kết quả: label required Select chỉ đổi màu error/success SAU khi
			// blur/change/submit, đúng chuẩn input/checkbox, không áp lúc khởi tạo.
			if (selectContext?.required) {
				const validation = selectContext.validation;
				const isValid = validation?.isValid;
				const process = validation?.process;
				if (process && process.size > 0) {
					if (isValid == 'pending') return 'default';
					return isValid ? 'success' : 'error';
				}
				return 'default';
			}
			return 'default';
		},
		get size() {
			return (
				props.size ??
				textFieldContext?.size ??
				checkboxContext?.size ??
				selectContext?.size ??
				client.browser?.size ??
				'md'
			);
		}
	});
</script>

<svelte:element this={props.as ?? 'label'} bind:this={configs.ref} class={configs.style} for={forId}>
	{@render children?.()}
	{#if
		!props.hiddenRequiredIndicator &&
		(textFieldContext?.required || checkboxContext?.required || selectContext?.required)
	}
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