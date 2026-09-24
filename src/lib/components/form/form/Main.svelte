<script lang="ts">
	import type { ServerResponse } from '$interfaces/basic';
	import { apiFetch, styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { encryption } from '$modules/encryption';
	import { client } from '$store/basic.svelte';
	import { setFormContext } from '.';
	import type { FormConfigs, FormProps } from './_interface';
	import { SvelteSet } from 'svelte/reactivity';

	let { children, ...props }: FormProps = $props();
	// Guard re-entry phiến bản (non-reactive) — chặn submit thứ hai trong khi
	// submit trước đó còn đang await. Button-click được chặn bởi disabled, nhưng
	// đường Enter key đi thẳng vào form submit event, không qua Button.
	let submitting = false;
	let configs: FormConfigs = $state({
		// Initialize childrens as SvelteSet for reactivity
		childrens: new SvelteSet(),
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
								// preventDefault phải chạy trước guard — nếu return sớm
								// khi đang submitting, browser sẽ native-submit (reload trang).
								const event = e as SubmitEvent;
								event.preventDefault();
								if (submitting) return;
								// Always call onSubmit — page tự validate bên trong handler
								// (vd handleLogin set formError khi validateForm fail), nên phải chạy
								// cả khi configs.validation.isValid false.
								// Await + giữ loading trong suốt onSubmit — thay cơ chế cũ nằm ở
								// Button onClick (bỏ để hết double-call), đồng thời bao phủ đường
								// Enter key vốn không đi qua Button click handler.
								configs.disabled = true;
								configs.loading = true;
								submitting = true;
								try {
									if (props.onSubmit) await props.onSubmit();
								} finally {
									configs.disabled = false;
									configs.loading = false;
									submitting = false;
								}
								// Chỉ submit API khi có action thật — action mặc định '#' nghĩa là
								// page tự xử lý qua onSubmit (fetchSecure), không post form đi đâu.
								// Trước đây '#' là truthy nên rơi vào apiFetch('#', {method:'get', body})
								// → page error "Request with GET/HEAD method cannot have body".
								const hasAction = configs.action && configs.action !== '#';
								if (!hasAction || !configs.validation.isValid) return;
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
					const childrenArray = [...configs.childrens.values()];
					// Filter to only check children that have validation (required fields)
					// Skip checkboxes and other components with undefined validation
					const validatedChildren = childrenArray.filter(child =>
						child.validation && child.validation.isValid !== undefined
					);
					if (validatedChildren.length === 0) return true;

					return validatedChildren.every(
						(children) =>
							children.validation?.isValid === true &&
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
