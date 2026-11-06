<script lang="ts">
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
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

	// ── Batch 23: label dùng style "color hover" khi field đang focus hoặc đã
	// có dữ liệu (thay vì CHỈ kích hoạt khi hover chuột) ──
	// hasValue: field cha (TextField) đang có dữ liệu — gồm cả RadioGroup và
	// InputDatetime đăng ký ngược vào children (value nằm ở child, không nằm
	// ở configs.value của TextField).
	const hasValue = $derived.by(() => {
		const field = textFieldContext;
		if (!field) return false;
		if ((field.value ?? '') !== '') return true;
		const radiogroup = field.children?.radiogroup;
		if (radiogroup && radiogroup.value) return true;
		const datetime = field.children?.datetime;
		if (datetime && (datetime.value ?? '') !== '') return true;
		const textarea = field.children?.textarea;
		if (textarea && (textarea.value ?? '') !== '') return true;
		return false;
	});
	// isFocused: input/radio/datetime trong cùng field đang được focus
	const isFocused = $derived(!!textFieldContext?.status?.focus);
	// Áp style hover của theme (--color đậm hơn) khi focus hoặc có giá trị
	const hoverActive = $derived(isFocused || hasValue);

	let configs: LabelConfigs = $state({
		get style() {
			// has-value: field cha (TextField) đang có dữ liệu — CSS phân biệt label
			// của field có data vs field trống (yêu cầu batch 3 #input).
			// hover: áp style "color hover" của theme khi field đang focus HOẶC đã
			// có giá trị (Batch 23) — trước đây chỉ kích hoạt khi hover chuột.
			const defaultStyles: (string | undefined)[] = [
				'label-root',
				hasValue ? 'has-value' : undefined,
				hoverActive ? 'hover' : undefined,
				textFieldContext?.disabled ? 'disabled' : undefined,
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

		/* has-value: field cha có dữ liệu → label đậm hơn 1 nấc để phân biệt
		   (yêu cầu batch 3 #input — áp dụng cả label).
		   Màu chữ để theme điều khiển qua --color để style "color hover"
		   (Batch 23) áp dụng được cả khi focus lẫn khi field đã có giá trị
		   (kể cả màu success/error của validation). */
		&.has-value {
			font-weight: 600;
		}
	}
</style>