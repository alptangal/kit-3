<script lang="ts">
	import { onMount } from 'svelte';
	import type { TextField } from './_interface';
	import { setTextfieldCtx, type MetaNode } from '.';
	import type { EventListener } from '$components/interface';
	import { handleEvents } from '$modules/_attachments';
	import { getFormContext } from '../form';
	import { styleSynced } from '$modules';
	import { SvelteMap } from 'svelte/reactivity';
	import { v7 as uuidV7 } from 'uuid';
	import { some } from 'es-toolkit/compat';

	let { children, ...props }: TextField = $props();
	let configs = $state({
		name: undefined as undefined | string,
		status: {
			focus: false,
			firstAction: false,
			isInvalid: undefined as undefined | boolean,
			get loading() {
				if (configs.childrens)
					return some([...configs.childrens.values()] as MetaNode[], (node) => node.loading);
				return false;
			}
		},
		value: undefined as undefined | string | number,
		errorMessages: undefined as undefined | SvelteMap<keyof EventListener, string>,
		onFocus: undefined as undefined | SvelteMap<string, () => void>,
		ref: undefined as undefined | HTMLElement,
		events: {
			load: {
				handler() {
					if (formCtx.insertMetaNode && configs.name) {
						formCtx.insertMetaNode({
							name: configs.name,
							ref: configs.ref,
							isValid: isValid,
							reset,
							get loading() {
								return configs.status.loading;
							},
							focus
						});
					}
				}
			},
			get click() {
				return this.touchstart;
			},
			mousedown: {
				handler(e: MouseEvent) {
					if (configs.status.focus && e.detail < 2) {
						e.preventDefault();
					}
				}
			},
			touchstart: {
				handler(e: MouseEvent) {
					e.preventDefault();
					configs.status.focus = true;
					if (!configs.status.firstAction) configs.status.firstAction = true;
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
		},
		childrens: undefined as undefined | SvelteMap<string, MetaNode>
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
			return configs.status.isInvalid;
		},
		set isInvalid(val) {
			configs.status.isInvalid = val;
		},
		insertErrorMessage(item) {
			const { eventName, message } = item;
			if (!message) return;
			if (!configs.errorMessages) configs.errorMessages = new SvelteMap();
			configs.errorMessages.set(eventName, message);
		},
		get validate() {
			return props.validate;
		},
		onFocus(id, fallback) {
			if (!configs.onFocus) configs.onFocus = new SvelteMap();
			configs.onFocus.set(id, fallback);
		},
		onBlur(val) {
			configs.status.focus = val;
		},
		updateValue(val) {
			configs.value = val;
		},
		insertMetaNode(data) {
			if (!configs.childrens) configs.childrens = new SvelteMap();
			configs.childrens.set(data.name ?? uuidV7(), data);
		},
		onEnter() {
			if (configs.ref) formCtx.nextNode?.(configs.ref);
		}
	});

	$effect(() => {
		if (configs.status.firstAction && props.required && !configs.value && !configs.status.focus) {
			configs.status.isInvalid = true;
		} else if (props.required && configs.value) {
			configs.status.isInvalid = false;
		}
	});

	function isValid() {
		if (props.required && !configs.value) return false;
		return !configs.status.isInvalid;
	}
	function reset() {
		configs.status.isInvalid = undefined;
		configs.status.firstAction = false;
		//if (configs.resetInput) configs.resetInput();
		if (configs.childrens) {
			configs.childrens.values().forEach((node) => {
				if (node.reset) node.reset();
			});
		}
		configs.value = undefined;
		configs.errorMessages = undefined;
	}
	function focus() {
		if (configs.childrens) {
			for (const node of configs.childrens.values()) {
				if (node && node.focus) {
					node.focus();
				}
			}
		}
	}

	//=---------------------------------------------
	// function isValid(value) {
	// 	if (!props.validate) return true;
	// 	if (configs.status.validateOperator == 'AND') {
	// 		console.log(props.validate);
	// 	} else {
	// 	}
	// 	return false;
	// }

	//--------------------------
	onMount(() => {
		if (props.isInvalid != undefined) configs.status.isInvalid = props.isInvalid;
		configs.name = props.name ?? uuidV7();
	});
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
		{#if configs.errorMessages}
			{#each configs.errorMessages.values() as item, idx (idx)}
				<p
					class={configs.status.isInvalid
						? configs.status.focus
							? 'text-[hsl(var(--danger))]'
							: 'text-[hsl(var(--danger-100))]'
						: configs.status.focus
							? 'text-[hsl(var(--success))]'
							: 'text-[hsl(var(--success-100))]'}
				>
					{item}
				</p>
			{/each}
		{/if}
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
