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
	let configs: TextFieldConfigs = $state({
		status: {
			get changed() {
				return configs.previousValue !== configs.value;
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
			}
		},
		reset() {
			if (configs.children?.input) configs.children.input.reset();
			requestAnimationFrame(() => {
				configs.previousValue = undefined;
			});
		}
	});
	const formContext = getFormContext();
	setTextFieldContext(configs);
	onMount(() => {
		if (formContext) {
			if (!formContext.childrens) formContext.childrens = new SvelteSet();
			formContext.childrens.add(configs);
		}
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
		&.hover {
		}
		&.disabled {
			--cursor: not-allowed;
			opacity: var(--disabled-opacity);
		}
		cursor: var(--cursor);
	}
</style>
