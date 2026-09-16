<script lang="ts">
	import type { ServerResponse } from '$interfaces/basic';
	import { apiFetch, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { encryption } from '$modules/encryption';
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
			return props.action ?? '#';
		},
		get encryptDisabled() {
			return props.encryptDisabled;
		},
		get data() {
			return props.data;
		},
		status: {
			get changed() {
				if (!configs.childrens?.size) return false;
				return [...configs.childrens.values()].some((children) => children.status?.changed === true);
			}
		},
		get event() {
			const defaultEvents: FormConfigs['event'] = [
				{
					events: {
						submit: {
							async handler(e) {
								if (props.onSubmit) props.onSubmit();
								const event = e as SubmitEvent;
								event.preventDefault();
								if (!configs.validation.isValid || !configs.action) return;
								const jsonData: { [k: string]: string | boolean | undefined | null } = {};
								[...(configs.childrens?.values() ?? [])].forEach((children) => {
									if ('checked' in children) {
										if (children.name) jsonData[children.name] = children.checked;
									} else if ('value' in children) {
										if (children.name) jsonData[children.name] = children.value;
									}
								});
								let res: ServerResponse | undefined;
								if (configs.encryptDisabled) {
									res = await apiFetch(configs.action, { method: configs.method, body: jsonData });
								} else {
									res = await encryption.fetchSecure(configs.action, {
										method: configs.method,
										body: jsonData
									});
								}
								if (res.ok) {
									configs.reset();
									if (props.onReset) props.onReset();
								}
								configs.disabled = false;
								configs.loading = false;
								if (props.onResponse) props.onResponse();
							}
						},
						reset: {
							handler(e) {
								e.preventDefault();
								configs.reset();
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
		},
		reset() {
			if (configs.childrens?.size) {
				[...configs.childrens.values()].forEach((children) => children.reset());
			}
			if (props.onReset) props.onReset();
		},
		get onReset() {
			return props.onReset;
		},
		get onSubmit() {
			return props.onSubmit;
		},
		get onResponse() {
			return props.onResponse;
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
