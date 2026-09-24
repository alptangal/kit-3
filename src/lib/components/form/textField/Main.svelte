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
			const defaultStyles: (string | undefined)[] = [
				'textField-root',
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
							// Chỉ prevent default nếu không click trực tiếp vào thẻ input/textarea
							// để không làm hỏng tính năng native (ví dụ: double click bôi đen text)
							if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
								event.preventDefault();
							}
							
							if (event.detail == 1) {
								if (!configs.status.focus) {
									configs.status.selectAll = false;
									if (configs.children?.input) configs.children.input.focus();
								}
							} else if (event.detail == 2 && configs.value?.length) {
								configs.status.selectAll = true;
								if (configs.children?.input) configs.children.input.focus();
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
			if (configs.children?.input?.focus) configs.children.input.focus();
		},
		validation: {
			setValid(v) {
				if (!configs.validation) return;
				configs.validation.isValid = v;
			},
			get isValid() {
				// Delegate to child input's validation if available
				return configs.children?.input?.validation?.isValid ?? undefined;
			}
		},
		reset() {
			_wasFocused = false;
			configs.status.touched = false;
			if (configs.children?.input) configs.children.input.reset();
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
			// Sync value
			if (childInput.value !== undefined && configs.value !== childInput.value) {
				configs.value = childInput.value;
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
		&.hover {
		}
		&.disabled {
			--cursor: not-allowed;
			opacity: var(--disabled-opacity);
		}
		cursor: var(--cursor);
	}
</style>
