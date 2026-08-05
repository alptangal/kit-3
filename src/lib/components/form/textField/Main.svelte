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
				configs.status.hover ? 'hover' : undefined
			];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get name() {
			return props.name;
		},
		get required() {
			return props.required;
		},
		get event() {
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
							event.preventDefault();
							if (event.detail == 1) {
								if (configs.status.focus) {
								} else {
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
		cursor: var(--cursor);
	}
</style>
