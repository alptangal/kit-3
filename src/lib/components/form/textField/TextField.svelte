<script lang="ts">
	import { onMount } from 'svelte';
	import type { TextField } from './_interface';
	import { setTextfieldCtx } from '.';
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { getFormContext } from '../form';
	import { styleSynced } from '$modules';
	import { SvelteMap } from 'svelte/reactivity';
	import { profile } from '$store/basic.svelte';

	let { children, ...props }: TextField = $props();
	let configs = $state({
		status: {
			focus: false
		},
		onFocus: undefined as undefined | SvelteMap<string, () => void>,
		ref: undefined as undefined | HTMLElement,
		events: {
			click: {
				handler(e: MouseEvent) {
					e.preventDefault();
					configs.status.focus = true;
					// if (
					// 	(e.target as HTMLElement).tagName != 'INPUT' &&
					// 	configs.ref?.contains(e.target as HTMLElement)
					// ) {
					// 	if (configs.status.focus) configs.status.focus = false;
					// 	return;
					// }
					// if (!configs.status.focus) configs.status.focus = true;
					//if (configs.status.focus) return;
					if (configs.onFocus) {
						configs.onFocus.forEach((fallback) => {
							fallback();
						});
					}
				}
			},
			touchstart: {
				handler(e: MouseEvent) {
					e.preventDefault();
					configs.status.focus = true;
					// if (
					// 	(e.target as HTMLElement).tagName != 'INPUT' &&
					// 	configs.ref?.contains(e.target as HTMLElement)
					// ) {
					// 	if (configs.status.focus) configs.status.focus = false;
					// 	return;
					// }
					// if (!configs.status.focus) configs.status.focus = true;
					//if (configs.status.focus) return;
					if (configs.onFocus) {
						configs.onFocus.forEach((fallback) => {
							fallback();
						});
					}
				}
			}
		} as EventListener,
		get style() {
			const defaultStyles: string[] = ['textfield'];
			return styleSynced({ defaultStyles, propStyles: props.class }, props.overwriteDefaultStyles);
		}
	});
	const formCtx = getFormContext();

	setTextfieldCtx({
		get ref() {
			return configs.ref;
		},
		get required() {
			return props.required;
		},
		get disabled() {
			return props.disabled;
		},
		get status() {
			return configs.status;
		},
		get size() {
			return props.size ?? formCtx.size;
		},
		get isInvalid() {
			return props.isInvalid;
		},
		onFocus(id, fallback) {
			if (!configs.onFocus) configs.onFocus = new SvelteMap();
			configs.onFocus.set(id, fallback);
		},
		onBlur(val) {
			configs.status.focus = val;
		}
	});
	onMount(() => {});
</script>

{#if typeof children == 'function'}
	<svelte:element
		this={props.as ?? 'div'}
		bind:this={configs.ref}
		class={configs.style}
		data-is-invalid={props.isInvalid}
		{@attach handleEvents([{ events: [configs.events] }])}
	>
		{@render children()}
	</svelte:element>
{:else}
	<div class="text-red-500 font-bold text-2xl">
		TextField Error:
		<p class="text-xl">Not contain content</p>
	</div>
{/if}

<style lang="scss">
	.textfield {
		&[data-is-invalid='true'] {
			color: hsl(var(--danger));
		}
	}
</style>
