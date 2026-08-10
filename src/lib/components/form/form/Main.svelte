<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { client } from '$store/basic.svelte';
	import { setFormContext } from '.';
	import type { FormConfigs, FormProps } from './_interface';

	let { children, ...props }: FormProps = $props();
	let configs: FormConfigs = $state({
		_loading: undefined as undefined | boolean,
		get loading() {
			if (!configs.childrens?.size) return false;
			const someFieldLoading = [...configs.childrens.values()].some((children) => children.loading);
			if (someFieldLoading) return someFieldLoading;
			return this._loading;
		},
		set loading(v) {
			this._loading = v;
		},
		get style() {
			const defaultStyles: (string | undefined)[] = ['form-root', `size-${this.size}`];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get method() {
			return props.method ?? 'get';
		},
		get size() {
			return props.size ?? client.browser?.size ?? 'md';
		},
		get action() {
			return props.action;
		},
		get event() {
			const defaultEvents: FormConfigs['event'] = [
				{
					events: {
						submit: {
							async handler(e) {
								const event = e as SubmitEvent;
								event.preventDefault();
								await goto(resolve('/login'));
							}
						}
					}
				}
			];
			return defaultEvents;
		},
		validation: {
			get isValid() {
				if (configs.childrens?.size) {
					return [...configs.childrens.values()].every(
						(children) =>
							children.validation?.isValid !== false &&
							children.loading != true &&
							children.validation?.isValid != 'pending'
					);
				}
				return true;
			}
		}
	});
	setFormContext(configs);
</script>

<svelte:element
	this={props.as ?? 'form'}
	bind:this={configs.ref}
	class={configs.style}
	method={configs.method}
	{@attach handleEvents(configs.event)}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	@use '$styles/sizes.scss';
	.form-root {
		@apply flex flex-col;
		gap: var(--gap);
	}
</style>
