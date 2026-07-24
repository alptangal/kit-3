<script lang="ts">
	import { getFormContext } from '$components/form/form';
	import type { EventListener } from '$components/interface';
	import { styleSynced } from '$modules';
	import { handleEvents } from '$modules/_attachments';
	import { profile } from '$store/basic.svelte';
	import { setCheckboxCtx } from '.';
	import type { Checkbox } from './_interface';

	let { children, checked = $bindable(), ...props }: Checkbox = $props();
	const formCtx = getFormContext();
	let configs = $state({
		status: {
			hover: undefined as undefined | boolean,
			valid: undefined as undefined | boolean
		},
		ref: undefined as undefined | HTMLElement,
		get size() {
			return props.size ?? formCtx.size ?? 'md';
		},
		get style() {
			const defaultStyles: string[] = ['checkbox-root'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		},
		get color() {
			return props.color ?? 'default';
		},
		events: {
			touchstart: {
				handler(e) {
					checked = !checked;
				}
			},
			get click() {
				if (profile.browser.type?.includes('desktop')) return this.touchstart;
				return undefined;
			},
			get mouseover() {
				if (!profile.browser.type?.includes('desktop')) return undefined;
				return {
					handler() {
						configs.status.hover = true;
					}
				};
			},
			get mouseleave() {
				if (!profile.browser.type?.includes('desktop')) return undefined;
				return {
					handler() {
						configs.status.hover = false;
					}
				};
			}
		} as EventListener
	});
	setCheckboxCtx({
		get checked() {
			return checked;
		},
		get size() {
			return configs.size;
		},
		get color() {
			return configs.color;
		},
		get status() {
			return {
				get hover() {
					return configs.status.hover;
				},
				get valid() {
					return configs.status.valid;
				}
			};
		},
		get required() {
			return props.required;
		}
	});
</script>

<svelte:element
	this={props.as ?? 'div'}
	bind:this={configs.ref}
	data-checked={checked}
	data-color={configs.color}
	data-hover={configs.status.hover}
	class={configs.style}
	{@attach handleEvents([...(!props.disabled ? [{ events: [configs.events] }] : [])])}
>
	{@render children?.()}
</svelte:element>

<style lang="scss">
	.checkbox-root {
		@apply flex cursor-pointer;
	}
	:global(.checkbox-root *) {
		transition: all ease-in-out 0.3s;
	}
</style>
