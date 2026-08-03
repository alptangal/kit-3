<script lang="ts">
	import { styleSynced } from '$modules';
	import { client } from '$store/basic.svelte';
	import { setFormContext } from '.';
	import type { FormConfigs, FormProps } from './_interface';

	let { children, ...props }: FormProps = $props();
	let configs: FormConfigs = $state({
		get loading() {
			if (!configs.childrens?.size) return false;
			return configs.childrens.values().some((children) => children.loading);
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
		validation: {
			get isValid() {
				if (configs.childrens?.size) {
					return configs.childrens
						.values()
						.every(
							(children) => children.validation?.isValid !== false && children.loading != true
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
