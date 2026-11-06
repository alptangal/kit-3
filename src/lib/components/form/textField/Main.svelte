<script lang="ts">
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { onMount } from 'svelte';
	import { setTextFieldContext } from '.';
	import { getFormContext } from '../form';
	import type { TextFieldConfigs, TextFieldProps } from './_interface';
	import { SvelteSet } from 'svelte/reactivity';

	let { children, ...props }: TextFieldProps = $props();
	let _initialCaptured = false;
	let _wasFocused = false;
	let configs: TextFieldConfigs = $state({
		// initialValue nằm trong $state → getter changed reactive với nó
		// Capture initial value at creation time (mount) from the bound value or formContext.data
		initialValue: (() => {
			// Will be set in onMount - placeholder
			return undefined as string | undefined;
		})(),
		status: {
			touched: false,
			get changed() {
				// So sánh giá trị hiện tại vs giá trị mốc ban đầu (chuẩn hóa undefined thành ''):
				// false → pristine, true → dirty
				return (configs.initialValue ?? '') !== (configs.value ?? '');
			}
		},
		get size() {
			return props.size ?? formContext?.size ?? client.browser?.size ?? 'md';
		},
		get style() {
			// has-value: mirror Input — field đang có dữ liệu (khác rỗng) để CSS
			// phân biệt field có data (label/description cùng context đọc theo).
			const hasValue = (configs.value ?? '') !== '';
			const defaultStyles: (string | undefined)[] = [
				'textField-root',
				hasValue ? 'has-value' : undefined,
				configs.status.hover ? 'hover' : undefined,
				this.disabled ? 'disabled' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get name() {
			return props.name;
		},
		get required() {
			return props.required;
		},
		get disabled() {
			return props.disabled ?? formContext?.disabled ?? undefined;
		},
		get loading() {
			return props.loading ?? formContext?.loading ?? false;
		},
		get event() {
			if (this.disabled) return [];
			const eventDefault: TextFieldConfigs['event'] = [
				{
					events: {
						mouseover() {
							configs.status.hover = true;
						},
						mouseleave() {
							configs.status.hover = false;
						},
						mousedown(e) {
							const event = e as MouseEvent;
							const target = event.target as HTMLElement;
							const isControl = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
							// Chỉ prevent default nếu không click trực tiếp vào thẻ input/textarea
							// để không làm hỏng tính năng native (ví dụ: double click bôi đen text)
							if (!isControl) {
								event.preventDefault();
							}
							
							// Tap vùng field có radio group (ngoài các radio item): chọn option enabled
							// kế tiếp (quay vòng) thay vì chỉ focus — không gate status.focus để tap
							// liên tiếp vẫn chuyển option. Click trong .radiogroup-root (radio item /
							// label của radio) → để native tự xử lý.
							if (
								!isControl &&
								!configs.children?.input &&
								!configs.children?.datetime &&
								configs.children?.radiogroup &&
								!target.closest('.radiogroup-root')
							) {
								configs.children.radiogroup.selectNext?.();
								return;
							}
							if (event.detail == 1) {
								if (!configs.status.focus) {
									configs.status.selectAll = false;
									// Click truc tiep vao control (input/textarea) -> giu hanh vi cu
									// (chi focus Input). Click vao vung field (label, khoang trong)
									// -> focus control phu hop (input -> datetime -> radiogroup).
									if (isControl) {
										if (configs.children?.input) configs.children.input.focus();
										else if (configs.children?.textarea) configs.children.textarea.focus();
									} else {
										configs.focus?.();
									}
								}
							} else if (event.detail == 2 && configs.value?.length) {
								configs.status.selectAll = true;
								configs.focus?.();
							}
						}
					}
				}
			];
			return eventDefault;
		},
		setValue(input) {
			configs.previousValue = configs.value;
			configs.value = input;
		},
		onEnter() {
			if (formContext && (formContext.childrens?.size ?? 0) > 1 && formContext.ref) {
				const fields = [...formContext.ref.querySelectorAll('.textField-root')].filter((children) =>
					[...children.classList].includes('textField-root')
				);
				const currentIndex = fields.findIndex((field) => field === configs.ref);

				if (formContext.childrens?.size) {
					[...formContext.childrens.values()].forEach((children) => {
						if (
							children.ref == fields[currentIndex < fields.length - 1 ? currentIndex + 1 : 0] &&
							children.focus
						) {
							requestAnimationFrame(() => {
								if (children.focus) children.focus();
							});
						}
					});
				}
			}
		},
		get onTab() {
			return this.onEnter;
		},
		focus() {
			// Thu tu fallback: Input -> InputDatetime -> RadioGroup.
			// Label/TextField goi ham nay de dua focus vao control dung cua field.
			if (configs.children?.input?.focus) configs.children.input.focus();
			else if (configs.children?.textarea?.focus) configs.children.textarea.focus();
			else if (configs.children?.datetime?.focus) configs.children.datetime.focus();
			else if (configs.children?.radiogroup?.focus) configs.children.radiogroup.focus();
		},
		validation: {
			setValid(v) {
				if (!configs.validation) return;
				configs.validation.isValid = v;
			},
			get isValid() {
				// Delegate to child input's validation if available
				return configs.children?.input?.validation?.isValid ?? configs.children?.textarea?.validation?.isValid ?? undefined;
			}
		},
		reset() {
			_wasFocused = false;
			configs.status.touched = false;
			if (configs.children?.input) configs.children.input.reset();
			if (configs.children?.textarea) configs.children.textarea.reset();
			// Khôi phục configs.value ngay lập tức → changed getter báo false mà không cần RAF
			configs.value = configs.initialValue;
			configs.previousValue = configs.initialValue;
			if (configs.validation) configs.validation.isValid = undefined;
		}
	});
	const formContext = getFormContext();
	setTextFieldContext(configs);

	// Lắng nghe dữ liệu ban đầu từ formContext.data nếu có
	$effect(() => {
		if (formContext?.data && props.name && props.name in formContext.data && !_initialCaptured) {
			const init = formContext.data[props.name];
			configs.initialValue = init != null ? String(init) : '';
			if (configs.value === undefined) {
				configs.value = configs.initialValue;
			}
			_initialCaptured = true;
		}
	});

	// Theo dõi chu kỳ focus -> blur để đánh dấu touched (kích hoạt validation khi blur)
	$effect(() => {
		const isFocused = configs.status.focus;
		if (isFocused) {
			_wasFocused = true;
		} else if (_wasFocused && !isFocused) {
			configs.status.touched = true;
		}
	});

	// Sync value and validation from child Input to TextField
	$effect(() => {
		const childInput = configs.children?.input;
		if (childInput) {
			// Sync value — BasicConfigs.value rộng string|number; TextField hẹp string
			if (
				childInput.value !== undefined &&
				childInput.value !== null &&
				configs.value !== childInput.value
			) {
				configs.value = typeof childInput.value === 'number' ? String(childInput.value) : childInput.value;
			}
			// Expose child's validation state
			if (childInput.validation) {
				configs.validation = childInput.validation;
			}
		}
	});

	onMount(() => {
		// Capture initial value at mount time - this is the pristine state
		if (!_initialCaptured) {
			configs.initialValue = configs.value ?? '';
			_initialCaptured = true;
		}
		// NOTE: Do NOT add TextField to formContext.childrens.
		// The child Input component will register itself in its own onMount.
		// This avoids duplicate registration and ensures Form validates the actual Input components.
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	class={configs.style}
	{@attach handleEvents(configs.event)}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.textField-root {
		--cursor: text;
		width: 100%;
		min-width: 0;
		&.disabled {
			--cursor: not-allowed;
			opacity: var(--disabled-opacity);
		}
		cursor: var(--cursor);
	}
</style>
